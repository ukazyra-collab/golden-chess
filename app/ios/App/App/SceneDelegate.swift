import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let bridgeVC = CAPBridgeViewController()
        window?.rootViewController = bridgeVC
        window?.makeKeyAndVisible()
        // no rubber band at the ends of the page: the board and the tab bar stay put, like in a native app
        bridgeVC.loadViewIfNeeded()
        bridgeVC.webView?.scrollView.bounces = false
        bridgeVC.webView?.scrollView.showsVerticalScrollIndicator = false
        bridgeVC.webView?.scrollView.showsHorizontalScrollIndicator = false

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        if let sv = (window?.rootViewController as? CAPBridgeViewController)?.webView?.scrollView {
            sv.bounces = false
            sv.showsVerticalScrollIndicator = false
            sv.showsHorizontalScrollIndicator = false
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
