import Foundation
import Capacitor

/**
 * Hands incoming custom-scheme URLs to the web layer.
 *
 * Only one thing needs this today: completing an auth round trip. Supabase
 * sends confirmation and password-reset links back to a redirect URL, and on
 * device that has to be `org.deadset.app://auth-callback` — `capacitor://localhost`
 * is neither allow-listable in Supabase nor registered with iOS, so those links
 * used to fall through to the project's Site URL and open the website in Safari
 * while the app stayed signed out. Since OAuth is hidden on native, email is the
 * only way in, so there was effectively no way in.
 *
 * This is deliberately NOT @capacitor/app. That plugin does the same job, but
 * adding it means a lockfile update, and this repo's bun.lock resolves through
 * a private registry that CI can reach and local tooling often cannot. Forty
 * lines of Swift against a scheme we already own costs less than that
 * coupling. The JS twin is src/lib/deepLink.ts.
 *
 * Scheme registration lives in Info.plist → CFBundleURLTypes and must stay in
 * step with NATIVE_URL_SCHEME in src/lib/authRedirect.ts.
 */
@objc(DeepLinkPlugin)
public class DeepLinkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DeepLinkPlugin"
    public let jsName = "DeepLink"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "consumePendingUrl", returnType: CAPPluginReturnPromise)
    ]

    /// Set before the web layer can possibly be listening — a cold start opens
    /// the app *because* of the URL, so the event would fire into nothing.
    /// AppDelegate writes here; JS drains it on mount via consumePendingUrl().
    private static var pendingUrl: String?
    private static weak var live: DeepLinkPlugin?

    override public func load() {
        DeepLinkPlugin.live = self
    }

    /// Called from AppDelegate's application(_:open:options:).
    ///
    /// Routed explicitly rather than through Capacitor's internal open-URL
    /// notification: AppDelegate already receives the callback, and one
    /// direct call is easier to reason about than a notification name that
    /// is not part of the plugin API contract.
    @objc public static func handle(url: URL) {
        let value = url.absoluteString
        pendingUrl = value
        // If the web layer is already up, deliver immediately as well —
        // consumePendingUrl() is idempotent, so a double delivery is harmless.
        live?.notifyListeners("appUrlOpen", data: ["url": value])
    }

    @objc func consumePendingUrl(_ call: CAPPluginCall) {
        let value = DeepLinkPlugin.pendingUrl
        DeepLinkPlugin.pendingUrl = nil
        call.resolve(["url": value as Any])
    }
}
