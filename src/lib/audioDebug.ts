/**
 * Lightweight debug bus for the audio playback pipeline.
 * Enabled via ?debug=audio in URL or localStorage.audioDebug=1.
 * Components subscribe via useAudioDebug().
 */
import { useEffect, useState } from "react";

export type AudioDebugLevel = "info" | "warn" | "error";

export interface AudioDebugEvent {
  id: number;
  ts: number;
  level: AudioDebugLevel;
  source: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface AudioDebugSnapshot {
  slotId: string | null;
  songTitle: string | null;
  archiveUrl: string | null;
  resolvedArchiveId: string | null;
  directTrackUrl: string | null;
  lastError: string | null;
  playbackState: string;
  events: AudioDebugEvent[];
}

const MAX_EVENTS = 60;

let counter = 0;
let snapshot: AudioDebugSnapshot = {
  slotId: null,
  songTitle: null,
  archiveUrl: null,
  resolvedArchiveId: null,
  directTrackUrl: null,
  lastError: null,
  playbackState: "idle",
  events: [],
};
const listeners = new Set<(s: AudioDebugSnapshot) => void>();

const emit = () => {
  // shallow clone for React change detection
  const s = { ...snapshot, events: [...snapshot.events] };
  snapshot = s;
  listeners.forEach((l) => l(s));
};

export const isAudioDebugEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    if (window.location.search.includes("debug=audio")) return true;
    return window.localStorage.getItem("audioDebug") === "1";
  } catch {
    return false;
  }
};

export const audioDebug = {
  log(source: string, message: string, data?: Record<string, unknown>, level: AudioDebugLevel = "info") {
    if (!isAudioDebugEnabled()) return;
    counter += 1;
    const evt: AudioDebugEvent = { id: counter, ts: Date.now(), level, source, message, data };
    snapshot.events = [evt, ...snapshot.events].slice(0, MAX_EVENTS);
    if (level === "error") snapshot.lastError = `${source}: ${message}`;
    emit();
  },
  setSlot(slotId: string | null, songTitle: string | null, archiveUrl: string | null, directTrackUrl: string | null) {
    if (!isAudioDebugEnabled()) return;
    snapshot.slotId = slotId;
    snapshot.songTitle = songTitle;
    snapshot.archiveUrl = archiveUrl;
    snapshot.directTrackUrl = directTrackUrl;
    snapshot.resolvedArchiveId = archiveUrl?.match(/archive\.org\/details\/([^/?#]+)/)?.[1] ?? null;
    emit();
  },
  setDirectTrackUrl(url: string | null) {
    if (!isAudioDebugEnabled()) return;
    snapshot.directTrackUrl = url;
    emit();
  },
  setPlaybackState(state: string) {
    if (!isAudioDebugEnabled()) return;
    snapshot.playbackState = state;
    emit();
  },
  clearError() {
    snapshot.lastError = null;
    emit();
  },
  clearAll() {
    snapshot = {
      slotId: null,
      songTitle: null,
      archiveUrl: null,
      resolvedArchiveId: null,
      directTrackUrl: null,
      lastError: null,
      playbackState: "idle",
      events: [],
    };
    emit();
  },
  getSnapshot: () => snapshot,
};

export const useAudioDebug = (): AudioDebugSnapshot => {
  const [snap, setSnap] = useState<AudioDebugSnapshot>(snapshot);
  useEffect(() => {
    listeners.add(setSnap);
    return () => {
      listeners.delete(setSnap);
    };
  }, []);
  return snap;
};
