import Flutter
import UIKit

/// The app's root (Main.storyboard): Flutter's view controller, with a
/// launch splash that wears the saved Appearance.
///
/// Flutter keeps its splash view up from the moment the window shows until
/// Dart paints its first frame, which is after `main()` has initialised
/// Supabase, analytics and the rest. By default that view is the launch
/// storyboard, which is always cream, so a Dark or Aurora user stared at the
/// cream canvas for that whole wait and then saw it snap dark once the intro
/// started. This splash reads the same keychain entry `main()` reads
/// (`kThemeStorageKey` in `theme_controller.dart`) and draws exactly what the
/// launch curtain's first frame draws: the K, centred, in the palette's ink
/// on the palette's canvas.
///
/// The storyboard itself still shows for the moment before this view exists:
/// iOS draws it before any app code runs, so nothing here can recolour it.
///
/// The colours here mirror `lib/theme/palette/kallo_palette_values.dart`;
/// change them together.
class RootViewController: FlutterViewController {
  override func awakeFromNib() {
    super.awakeFromNib()
    splashScreenView = LaunchSplash.makeView(choice: LaunchSplash.storedChoice())
  }
}

enum LaunchSplash {
  /// flutter_secure_storage's default iOS service, and the key the Dart
  /// theme controller stores the Appearance choice under.
  private static let service = "flutter_secure_storage_service"
  private static let account = "kallo.theme"

  /// The stored `KalloThemeChoice` name (`system`, `light`, `dark`,
  /// `aurora`), or nil when nothing is stored or the keychain says no.
  static func storedChoice() -> String? {
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: account,
      kSecAttrSynchronizable: kSecAttrSynchronizableAny,
      kSecReturnData: true,
      kSecMatchLimit: kSecMatchLimitOne,
    ]
    var result: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
      let data = result as? Data
    else { return nil }
    return String(data: data, encoding: .utf8)
  }

  static func makeView(choice: String?) -> UIView {
    let (canvas, ink) = colors(for: choice)
    let view = UIView()
    view.backgroundColor = canvas

    // The storyboard's K, recoloured: the asset is a single-colour glyph, so
    // as a template it takes the ink at the same size and position.
    let mark = UIImageView(image: UIImage(named: "LaunchImage")?.withRenderingMode(.alwaysTemplate))
    mark.tintColor = ink
    mark.contentMode = .center
    mark.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(mark)
    NSLayoutConstraint.activate([
      mark.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      mark.centerYAnchor.constraint(equalTo: view.centerYAnchor),
    ])
    return view
  }

  private static let light = (canvas: rgb(0xF8F7F4), ink: rgb(0x141413))
  private static let dark = (canvas: rgb(0x0F0F0E), ink: rgb(0xF2F1EC))
  private static let aurora = (canvas: rgb(0x131114), ink: rgb(0xF4F0EC))

  /// System (and anything missing or unknown, as in Dart) follows the
  /// phone between light and Dark; the others are fixed.
  private static func colors(for choice: String?) -> (UIColor, UIColor) {
    switch choice {
    case "light": return light
    case "dark": return dark
    case "aurora": return aurora
    default:
      return (
        UIColor { $0.userInterfaceStyle == .dark ? dark.canvas : light.canvas },
        UIColor { $0.userInterfaceStyle == .dark ? dark.ink : light.ink }
      )
    }
  }

  private static func rgb(_ hex: Int) -> UIColor {
    UIColor(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: 1
    )
  }
}
