import ImageIO
import Intents
import UIKit

/// The image a communication notification shows for its sender: their photo
/// when it loads, otherwise the same warm initials disc the app draws
/// (`lib/shared/widgets/avatar/profile_avatar.dart`). Always an image — the
/// system's grey silhouette is what this exists to replace.
enum SenderAvatar {
  /// Long enough for a slow cell connection, short enough that a dead host
  /// still leaves the extension most of its ~30 s budget.
  private static let timeout: TimeInterval = 8
  /// iOS renders the avatar at ~40 pt; 3× of that, so a large upload is
  /// decoded straight to a thumbnail instead of blowing the extension's
  /// ~24 MB memory ceiling.
  private static let maxPixels = 120

  private static let session: URLSession = {
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = timeout
    config.timeoutIntervalForResource = timeout
    return URLSession(configuration: config)
  }()

  /// Calls `completion` exactly once, on a background queue. Returns the
  /// in-flight fetch so the extension can cancel it at its deadline.
  @discardableResult
  static func load(
    for sender: PushSender,
    completion: @escaping (INImage) -> Void
  ) -> URLSessionTask? {
    guard let url = sender.avatarURL else {
      completion(initialsDisc(for: sender))
      return nil
    }
    let task = session.dataTask(with: url) { data, response, _ in
      let ok = (response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false
      if ok, let data, let png = thumbnailPNG(from: data) {
        completion(INImage(imageData: png))
      } else {
        completion(initialsDisc(for: sender))
      }
    }
    task.resume()
    return task
  }

  private static func thumbnailPNG(from data: Data) -> Data? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixels,
    ]
    guard let thumb = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    else { return nil }
    return UIImage(cgImage: thumb).pngData()
  }

  // MARK: - Initials disc

  /// `_discTints` in profile_avatar.dart, as (start, end) RGBA.
  private static let tints: [(UIColor, UIColor)] = [
    (rgba(0xC9A87C, 0x59), rgba(0xE8E6DC, 0x73)),
    (rgba(0xB8A890, 0x66), rgba(0x9C8C78, 0x59)),
    (rgba(0xCFC6BA, 0x73), rgba(0xA9A193, 0x59)),
  ]
  /// `KalloColors.surface` — the canvas the in-app disc's translucent tint sits on.
  private static let canvas = rgba(0xF8F7F4, 0xFF)
  /// `KalloColors.text`.
  private static let ink = rgba(0x141413, 0xFF)

  /// Square on purpose: iOS crops the sender image to a circle itself.
  private static func initialsDisc(for sender: PushSender) -> INImage {
    let side = CGFloat(maxPixels)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let tint = tints[tintIndex(sender.tintKey ?? sender.id)]
    let image = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)
      .image { context in
        let rect = CGRect(x: 0, y: 0, width: side, height: side)
        canvas.setFill()
        context.fill(rect)
        let gradient = CGGradient(
          colorsSpace: CGColorSpaceCreateDeviceRGB(),
          colors: [tint.0.cgColor, tint.1.cgColor] as CFArray,
          locations: [0, 1]
        )
        if let gradient {
          context.cgContext.drawLinearGradient(
            gradient,
            start: CGPoint(x: 0, y: side / 2),
            end: CGPoint(x: side, y: side / 2),
            options: []
          )
        }
        let initial = sender.name.first.map { String($0).uppercased() } ?? "·"
        let text = NSAttributedString(
          string: initial,
          attributes: [
            .font: UIFont.systemFont(ofSize: side * 0.42, weight: .medium),
            .foregroundColor: ink,
          ]
        )
        let size = text.size()
        text.draw(at: CGPoint(x: (side - size.width) / 2, y: (side - size.height) / 2))
      }
    return image.pngData().map(INImage.init(imageData:)) ?? INImage(imageData: Data())
  }

  /// `discTintIndex` in profile_avatar.dart, which itself replicates the web's
  /// JavaScript `(hash * 31 + charCodeAt) | 0` over UTF-16 code units — so a
  /// person's disc is the same colour on the lock screen as in the app.
  static func tintIndex(_ key: String) -> Int {
    var hash: Int32 = 0
    for unit in key.utf16 {
      hash = hash &* 31 &+ Int32(unit)
    }
    return abs(Int(hash)) % tints.count
  }

  private static func rgba(_ rgb: UInt32, _ alpha: UInt32) -> UIColor {
    UIColor(
      red: CGFloat((rgb >> 16) & 0xFF) / 255,
      green: CGFloat((rgb >> 8) & 0xFF) / 255,
      blue: CGFloat(rgb & 0xFF) / 255,
      alpha: CGFloat(alpha) / 255
    )
  }
}
