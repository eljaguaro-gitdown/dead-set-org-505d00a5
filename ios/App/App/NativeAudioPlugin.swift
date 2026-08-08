import Foundation
import Capacitor
import AVFoundation
import MediaPlayer

/**
 * Native playback engine for the Capacitor shell.
 *
 * WKWebView cannot keep HTML5 audio alive across backgrounding/lock on
 * modern iOS (WebKit suspends its media processes regardless of the app's
 * audio session — see WebKit #203293). So on the native app, playback runs
 * here on AVQueuePlayer, and the web app drives it through this plugin.
 * The JS twin is src/lib/player/nativeEngine.ts.
 *
 * Contract mirrors the web GaplessEngine: load a queue, auto-advance with
 * trackChanged events, queueEnded after the last track, progress at 4 Hz.
 * Lock-screen / control-center transport is wired via MPRemoteCommandCenter
 * and now-playing metadata via MPNowPlayingInfoCenter.
 */
@objc(NativeAudioPlugin)
public class NativeAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAudioPlugin"
    public let jsName = "NativeAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "append", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "seek", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "gotoIndex", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
    ]

    private struct Track {
        let id: String
        let url: URL
        let title: String
        let artist: String
        let album: String
        let artworkUrl: URL?
    }

    private var player = AVQueuePlayer()
    private var tracks: [Track] = []
    /// Queue position of player.currentItem within `tracks`.
    private var headIndex: Int = 0
    /// Live AVPlayerItems currently in the queue, parallel to tracks[headIndex...].
    private var liveItems: [AVPlayerItem] = []
    private var timeObserver: Any?
    private var currentItemObservation: NSKeyValueObservation?
    private var rateObservation: NSKeyValueObservation?
    private var statusObservations: [NSKeyValueObservation] = []
    private var artworkCache: [URL: MPMediaItemArtwork] = [:]
    private var lastReportedPlaying = false

    /// Cosmic Charlie from the bundled web assets — the lock-screen artwork.
    /// (Original brand art; also keeps trademarked imagery off store-reviewed
    /// surfaces.) Used whenever a track's artworkUrl isn't a fetchable http(s)
    /// URL — the webview hands us capacitor://localhost/... paths, which
    /// URLSession can't resolve.
    private lazy var bundledArtwork: MPMediaItemArtwork? = {
        let candidates = [
            Bundle.main.url(forResource: "cosmic-charlie", withExtension: "jpg", subdirectory: "public"),
            Bundle.main.url(forResource: "icon-512", withExtension: "png", subdirectory: "public/icons"),
            Bundle.main.url(forResource: "icon-192", withExtension: "png", subdirectory: "public/icons"),
        ]
        for case let url? in candidates {
            if let data = try? Data(contentsOf: url), let image = UIImage(data: data) {
                return MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            }
        }
        return nil
    }()

    public override func load() {
        configureRemoteCommands()
    }

    deinit {
        teardownPlayer()
    }

    // MARK: - JS API

    @objc func load(_ call: CAPPluginCall) {
        guard let rawTracks = call.getArray("tracks") as? [[String: Any]] else {
            call.reject("tracks array required")
            return
        }
        let startIndex = call.getInt("startIndex") ?? 0
        let autoplay = call.getBool("autoplay") ?? true

        let parsed: [Track] = rawTracks.compactMap { dict in
            guard let id = dict["id"] as? String,
                  let urlString = dict["url"] as? String,
                  let url = URL(string: urlString) else { return nil }
            return Track(
                id: id,
                url: url,
                title: dict["title"] as? String ?? "Dead Set",
                artist: dict["artist"] as? String ?? "Grateful Dead",
                album: dict["album"] as? String ?? "Dead Set",
                artworkUrl: (dict["artworkUrl"] as? String).flatMap { URL(string: $0) }
            )
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.assertPlaybackSession()
            self.tracks = parsed
            self.rebuildQueue(from: min(max(startIndex, 0), max(parsed.count - 1, 0)), autoplay: autoplay)
            call.resolve()
        }
    }

    @objc func append(_ call: CAPPluginCall) {
        guard let dict = call.getObject("track"),
              let id = dict["id"] as? String,
              let urlString = dict["url"] as? String,
              let url = URL(string: urlString) else {
            call.reject("track {id, url} required")
            return
        }
        let track = Track(
            id: id,
            url: url,
            title: dict["title"] as? String ?? "Dead Set",
            artist: dict["artist"] as? String ?? "Grateful Dead",
            album: dict["album"] as? String ?? "Dead Set",
            artworkUrl: (dict["artworkUrl"] as? String).flatMap { URL(string: $0) }
        )
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.tracks.append(track)
            let item = self.makeItem(for: track)
            self.liveItems.append(item)
            self.player.insert(item, after: self.player.items().last)
            call.resolve()
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.assertPlaybackSession()
            self?.player.play()
            call.resolve()
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.player.pause()
            call.resolve()
        }
    }

    @objc func seek(_ call: CAPPluginCall) {
        let seconds = call.getDouble("seconds") ?? 0
        DispatchQueue.main.async { [weak self] in
            self?.seekCurrent(to: seconds)
            call.resolve()
        }
    }

    @objc func gotoIndex(_ call: CAPPluginCall) {
        let index = call.getInt("index") ?? 0
        let autoplay = call.getBool("autoplay") ?? true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard index >= 0 && index < self.tracks.count else {
                call.reject("index out of range")
                return
            }
            self.assertPlaybackSession()
            self.rebuildQueue(from: index, autoplay: autoplay)
            call.resolve()
        }
    }

    @objc func setVolume(_ call: CAPPluginCall) {
        let volume = Float(call.getDouble("volume") ?? 1.0)
        DispatchQueue.main.async { [weak self] in
            self?.player.volume = min(1, max(0, volume))
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.teardownPlayer()
            self.tracks = []
            self.headIndex = 0
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            call.resolve()
        }
    }

    @objc func getState(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            call.resolve([
                "index": self.currentIndex() ?? -1,
                "isPlaying": self.player.timeControlStatus == .playing,
                "currentTime": self.player.currentTime().seconds.isFinite ? self.player.currentTime().seconds : 0,
                "duration": self.currentDuration(),
            ])
        }
    }

    // MARK: - queue plumbing

    private func makeItem(for track: Track) -> AVPlayerItem {
        let asset = AVURLAsset(url: track.url)
        let item = AVPlayerItem(asset: asset)
        let observation = item.observe(\.status) { [weak self] observed, _ in
            guard let self, observed.status == .failed else { return }
            let message = observed.error?.localizedDescription ?? "playback failed"
            self.notifyListeners("error", data: ["message": message])
            DispatchQueue.main.async {
                // Skip the broken tape and keep the night moving.
                if self.player.currentItem === observed {
                    self.player.advanceToNextItem()
                }
            }
        }
        statusObservations.append(observation)
        return item
    }

    private func rebuildQueue(from index: Int, autoplay: Bool) {
        teardownPlayer()
        headIndex = index
        guard !tracks.isEmpty else { return }

        liveItems = tracks[index...].map { makeItem(for: $0) }
        player = AVQueuePlayer(items: liveItems)
        player.actionAtItemEnd = .advance

        // .initial matters: without it KVO only fires on *advance*, so the
        // first track of a queue would never report trackChanged or write
        // its lock-screen metadata.
        currentItemObservation = player.observe(\.currentItem, options: [.initial, .new]) { [weak self] _, _ in
            DispatchQueue.main.async { self?.handleCurrentItemChanged() }
        }
        rateObservation = player.observe(\.timeControlStatus) { [weak self] _, _ in
            DispatchQueue.main.async { self?.handlePlayStateChanged() }
        }
        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] _ in
            self?.emitProgress()
        }

        if autoplay { player.play() }
        // KVO fires for the initial item too, which emits trackChanged.
    }

    private func teardownPlayer() {
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        timeObserver = nil
        currentItemObservation?.invalidate()
        currentItemObservation = nil
        rateObservation?.invalidate()
        rateObservation = nil
        statusObservations.forEach { $0.invalidate() }
        statusObservations = []
        player.pause()
        player.removeAllItems()
        liveItems = []
    }

    private func currentIndex() -> Int? {
        guard let current = player.currentItem else { return nil }
        guard let liveIdx = liveItems.firstIndex(where: { $0 === current }) else { return nil }
        return headIndex + liveIdx
    }

    private func currentDuration() -> Double {
        guard let item = player.currentItem else { return 0 }
        let d = item.duration.seconds
        return d.isFinite ? d : 0
    }

    private func seekCurrent(to seconds: Double) {
        let time = CMTime(seconds: max(0, seconds), preferredTimescale: 600)
        player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
            self?.updateNowPlayingProgress()
        }
    }

    // MARK: - events up to JS

    private func handleCurrentItemChanged() {
        guard let index = currentIndex(), index < tracks.count else {
            // Ran off the end of the queue.
            if player.currentItem == nil && !tracks.isEmpty {
                notifyListeners("queueEnded", data: [:])
                MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            }
            return
        }
        let track = tracks[index]
        notifyListeners("trackChanged", data: ["id": track.id, "index": index])
        updateNowPlayingMetadata(for: track)
    }

    private func handlePlayStateChanged() {
        let isPlaying = player.timeControlStatus == .playing
        guard isPlaying != lastReportedPlaying else { return }
        lastReportedPlaying = isPlaying
        notifyListeners("playbackState", data: ["isPlaying": isPlaying])
        updateNowPlayingProgress()
    }

    private func emitProgress() {
        let currentTime = player.currentTime().seconds
        notifyListeners("progress", data: [
            "currentTime": currentTime.isFinite ? currentTime : 0,
            "duration": currentDuration(),
        ])
        updateNowPlayingProgress()
    }

    // MARK: - lock screen / control center

    private func assertPlaybackSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("NativeAudio: session assert failed: \(error)")
        }
    }

    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.addTarget { [weak self] _ in
            DispatchQueue.main.async {
                self?.assertPlaybackSession()
                self?.player.play()
            }
            return .success
        }
        center.pauseCommand.addTarget { [weak self] _ in
            DispatchQueue.main.async { self?.player.pause() }
            return .success
        }
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            DispatchQueue.main.async {
                guard let self else { return }
                if self.player.timeControlStatus == .playing { self.player.pause() }
                else { self.player.play() }
            }
            return .success
        }
        center.nextTrackCommand.addTarget { [weak self] _ in
            DispatchQueue.main.async { self?.player.advanceToNextItem() }
            return .success
        }
        center.previousTrackCommand.addTarget { [weak self] _ in
            DispatchQueue.main.async {
                guard let self else { return }
                // Standard convention: restart if mid-song, else previous track.
                if self.player.currentTime().seconds > 3 || (self.currentIndex() ?? 0) == 0 {
                    self.seekCurrent(to: 0)
                } else if let index = self.currentIndex() {
                    self.rebuildQueue(from: index - 1, autoplay: true)
                }
            }
            return .success
        }
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let positionEvent = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            DispatchQueue.main.async { self?.seekCurrent(to: positionEvent.positionTime) }
            return .success
        }
    }

    private func updateNowPlayingMetadata(for track: Track) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyArtist: track.artist,
            MPMediaItemPropertyAlbumTitle: track.album,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: player.currentTime().seconds.isFinite ? player.currentTime().seconds : 0,
            MPMediaItemPropertyPlaybackDuration: currentDuration(),
            MPNowPlayingInfoPropertyPlaybackRate: player.timeControlStatus == .playing ? 1.0 : 0.0,
        ]
        if let artworkUrl = track.artworkUrl,
           artworkUrl.scheme == "https" || artworkUrl.scheme == "http" {
            if let cached = artworkCache[artworkUrl] {
                info[MPMediaItemPropertyArtwork] = cached
            } else {
                if let bundled = bundledArtwork { info[MPMediaItemPropertyArtwork] = bundled }
                fetchArtwork(from: artworkUrl)
            }
        } else if let bundled = bundledArtwork {
            info[MPMediaItemPropertyArtwork] = bundled
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func updateNowPlayingProgress() {
        guard var info = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }
        let currentTime = player.currentTime().seconds
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime.isFinite ? currentTime : 0
        info[MPMediaItemPropertyPlaybackDuration] = currentDuration()
        info[MPNowPlayingInfoPropertyPlaybackRate] = player.timeControlStatus == .playing ? 1.0 : 0.0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    private func fetchArtwork(from url: URL) {
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data, let image = UIImage(data: data) else { return }
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            DispatchQueue.main.async {
                self.artworkCache[url] = artwork
                if var info = MPNowPlayingInfoCenter.default().nowPlayingInfo {
                    info[MPMediaItemPropertyArtwork] = artwork
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
                }
            }
        }.resume()
    }
}
