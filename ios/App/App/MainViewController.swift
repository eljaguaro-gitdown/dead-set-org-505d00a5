import UIKit
import Capacitor

/// App-embedded Capacitor plugins aren't auto-discovered like packaged ones —
/// they must be registered on the bridge by a CAPBridgeViewController
/// subclass (referenced from Main.storyboard).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAudioPlugin())
    }
}
