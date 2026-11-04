import SwiftUI
import UIKit

/// Be Vietnam Pro, bundled into the extension (the same TTFs the app ships,
/// referenced from `assets/google_fonts/`). Fixed sizes: every line box below
/// is measured from the font size before it is laid out, so the type must not
/// grow underneath the arithmetic.
enum WidgetFont {
  static func regular(_ size: Double) -> Font { .custom("BeVietnamPro-Regular", fixedSize: size) }
  static func medium(_ size: Double) -> Font { .custom("BeVietnamPro-Medium", fixedSize: size) }
  static func semibold(_ size: Double) -> Font { .custom("BeVietnamPro-SemiBold", fixedSize: size) }

  /// How wide `text` sets in the regular weight — the measure the unit line's
  /// fit test needs before anything is laid out.
  static func width(_ text: String, regular size: Double) -> Double {
    let font = UIFont(name: "BeVietnamPro-Regular", size: size) ?? .systemFont(ofSize: size)
    return Double((text as NSString).size(withAttributes: [.font: font]).width)
  }
}
