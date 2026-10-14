const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const sceneDelegate = `
// Arborist Dog scene lifecycle (managed by with-ios-scenes).
class ArboristDogSceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
             options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate,
          let factory = appDelegate.reactNativeFactory else { return }
    let window = UIWindow(windowScene: windowScene)
    window.backgroundColor = UIColor(red: 11 / 255, green: 57 / 255, blue: 17 / 255, alpha: 1)
    self.window = window
    appDelegate.window = window
    var launchOptions = appDelegate.reactLaunchOptions ?? [:]
    if let context = connectionOptions.urlContexts.first {
      launchOptions[.url] = context.url
      launchOptions[.sourceApplication] = context.options.sourceApplication
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityKey": activity
      ]
    }
    factory.startReactNative(withModuleName: "main", in: window,
                             launchOptions: launchOptions)
    window.makeKeyAndVisible()
  }

  func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    for context in contexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [
        .openInPlace: context.options.openInPlace
      ]
      if let source = context.options.sourceApplication {
        options[.sourceApplication] = source
      }
      if let annotation = context.options.annotation {
        options[.annotation] = annotation
      }
      _ = appDelegate?.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: userActivity,
                                 restorationHandler: { _ in })
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }
  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }
  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }
  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }
}
`;

function transformAppDelegate(source) {
  if (source.includes('// Arborist Dog scene lifecycle')) return source;
  const startup = /#if os\(iOS\) \|\| os\(tvOS\)\s+window = UIWindow\(frame: UIScreen\.main\.bounds\)[\s\S]*?#endif/;
  if (!startup.test(source) || !source.includes('var window: UIWindow?')) {
    throw new Error('Unsupported Expo AppDelegate template: review iOS scene migration before building.');
  }
  return source
    .replace('var window: UIWindow?', 'var window: UIWindow?\n  var reactLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?')
    .replace(startup, 'reactLaunchOptions = launchOptions') + sceneDelegate;
}

module.exports = function withIOSScenes(config) {
  config = withInfoPlist(config, config => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).ArboristDogSceneDelegate',
        }],
      },
    };
    return config;
  });
  return withAppDelegate(config, config => {
    if (config.modResults.language !== 'swift') throw new Error('iOS scenes require the Swift Expo AppDelegate.');
    config.modResults.contents = transformAppDelegate(config.modResults.contents);
    return config;
  });
};
module.exports.transformAppDelegate = transformAppDelegate;
