import UIKit
import livekit_react_native

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // LiveKit (calls) needs its audio engine prepared once, before any React Native code runs.
    LivekitReactNative.setup()
    return true
  }
}
