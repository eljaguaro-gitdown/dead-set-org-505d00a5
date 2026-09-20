import Foundation
import UIKit
import AuthenticationServices
import Capacitor

/**
 * Runs an OAuth round trip in the SYSTEM browser and hands the callback URL
 * back to the web layer.
 *
 * Why this has to exist: Google refuses OAuth inside an embedded web view
 * (`disallowed_useragent`), and a plain redirect out of the WKWebView cannot
 * come back into it. So `signInWithOAuth` — which just navigates — can never
 * work in the Capacitor shell, which is why Google and Apple sign-in were
 * hidden on native. `ASWebAuthenticationSession` is the sanctioned way out:
 * iOS presents a Safari-backed sheet that Google accepts, shares the user's
 * existing Safari sign-in state (one tap when they are already signed in to
 * Google), and captures the redirect to `callbackURLScheme` itself.
 *
 * That last part is why this does not go through DeepLinkPlugin: the session
 * intercepts `org.deadset.app://` before iOS routes it to AppDelegate, so the
 * callback arrives as this promise's return value. The two plugins cover
 * different legs — DeepLinkPlugin catches links opened from OUTSIDE the app
 * (an email confirmation tapped in Mail), this one catches the redirect at
 * the end of a flow the app itself started. Both end up in the same parser,
 * src/lib/nativeAuthSession.ts.
 *
 * Deliberately NOT @capacitor/browser or a third-party OAuth plugin: this
 * repo's bun.lock resolves through a private registry that CI can reach and
 * local tooling often cannot, so a new dependency cannot be relocked outside
 * that environment. Same reasoning as DeepLinkPlugin.swift.
 *
 * The JS twin is src/lib/webAuth.ts.
 */
@objc(WebAuthPlugin)
public class WebAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WebAuthPlugin"
    public let jsName = "WebAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    /// ASWebAuthenticationSession is cancelled the moment it is deallocated,
    /// and the local in `signIn` goes out of scope as soon as that method
    /// returns — so the session has to be held here or the sheet closes
    /// immediately with no error.
    private var session: ASWebAuthenticationSession?

    @objc func signIn(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("A sign-in URL is required.", "invalid_url")
            return
        }
        guard let scheme = call.getString("callbackScheme"), !scheme.isEmpty else {
            call.reject("A callback scheme is required.", "invalid_scheme")
            return
        }

        // UIKit presentation has to happen on the main thread; Capacitor calls
        // arrive on a background queue.
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.reject("The sign-in view went away.", "failed")
                return
            }

            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: scheme
            ) { [weak self] callbackUrl, error in
                self?.session = nil

                if let error = error as? ASWebAuthenticationSessionError,
                   error.code == .canceledLogin {
                    // The user dismissed the sheet, or declined the "wants to
                    // use ... to Sign In" prompt. Not an error to shout about.
                    call.reject("Sign-in was cancelled.", "cancelled")
                    return
                }
                if let error = error {
                    call.reject(error.localizedDescription, "failed")
                    return
                }
                guard let callbackUrl = callbackUrl else {
                    call.reject("Sign-in finished without a callback.", "failed")
                    return
                }
                call.resolve(["url": callbackUrl.absoluteString])
            }

            session.presentationContextProvider = self
            // Left false on purpose: an ephemeral session would ignore the
            // Safari cookie jar, so a fan already signed in to Google would
            // have to type a password. Sharing that state is the whole UX win.
            session.prefersEphemeralWebBrowserSession = false

            self.session = session

            if !session.start() {
                self.session = nil
                call.reject("Could not open the sign-in page.", "failed")
            }
        }
    }
}

extension WebAuthPlugin: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return self.bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
