import Flutter
import UIKit

/// The app's root (Main.storyboard): Flutter's view controller, with a
/// launch splash in the palette the app will open in.
///
/// Flutter keeps its splash view up from the moment the window shows until
/// Dart paints its first frame, which is after `main()` has initialised
/// Supabase, analytics and the rest. There is no theme setting: the app is
/// light on a light phone and Aurora on a dark one (`theme_controller.dart`).
/// This splash draws exactly what the launch curtain's first frame draws: the
/// K, centred, in the palette's ink on the palette's canvas.
///
/// The launch storyboard shows for the moment before this view exists; iOS
/// draws it before any app code runs, and it follows the phone the same way
/// (the `LaunchBackground` colour and the `LaunchImage` K both have a dark
/// variant, in Aurora's colours).
///
/// The colours here mirror `lib/theme/palette/kallo_palette_values.dart`;
/// change them together.
class RootViewController: FlutterViewController {
  override func awakeFromNib() {
    super.awakeFromNib()
    splashScreenView = LaunchSplash.makeView()
  }
}

enum LaunchSplash {
  static func makeView() -> UIView {
    let view = UIView()
    view.backgroundColor = UIColor { $0.userInterfaceStyle == .dark ? aurora.canvas : light.canvas }

    // The storyboard's K, recoloured: the asset is a single-colour glyph, so
    // as a template it takes the ink at the same size and position.
    let mark = UIImageView(image: UIImage(named: "LaunchImage")?.withRenderingMode(.alwaysTemplate))
    mark.tintColor = UIColor { $0.userInterfaceStyle == .dark ? aurora.ink : light.ink }
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
  private static let aurora = (canvas: rgb(0x131114), ink: rgb(0xF4F0EC))

  private static func rgb(_ hex: Int) -> UIColor {
    UIColor(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: 1
    )
  }
}
