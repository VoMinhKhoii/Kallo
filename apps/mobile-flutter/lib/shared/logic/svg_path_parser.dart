import 'dart:ui';

/// Builds a [Path] from SVG path data, synchronously.
///
/// Covers the absolute commands the brand vectors are drawn with — `M`, `L`,
/// `H`, `V`, `Q`, `C` and `Z` — and nothing else. flutter_svg is not the
/// answer where this is used: `SvgPicture` compiles its source on a background
/// isolate and paints nothing on the frame it is first built, and the launch
/// intro's first frame has to match the native launch screen exactly.
///
/// Strict on purpose. A relative command, an arc or an exponent throws a
/// [FormatException] instead of drawing something subtly different: the brand
/// files contain none, so a re-export that introduces one should fail its test
/// rather than ship a wrong letter.
Path parseSvgPathData(String data) {
  final tokens = _token.allMatches(data).map((m) => m[0]!).toList();
  final path = Path();
  var i = 0;
  var command = '';
  var x = 0.0, y = 0.0, startX = 0.0, startY = 0.0;

  double number() {
    if (i >= tokens.length || _isCommand(tokens[i])) {
      throw FormatException('Command "$command" is missing a number', data);
    }
    return double.parse(tokens[i++]);
  }

  while (i < tokens.length) {
    if (_isCommand(tokens[i])) command = tokens[i++];
    switch (command) {
      case 'M':
        x = startX = number();
        y = startY = number();
        path.moveTo(x, y);
        command = 'L'; // Further pairs after a moveto are implicit linetos.
      case 'L':
        x = number();
        y = number();
        path.lineTo(x, y);
      case 'H':
        x = number();
        path.lineTo(x, y);
      case 'V':
        y = number();
        path.lineTo(x, y);
      case 'Q':
        final cx = number(), cy = number();
        x = number();
        y = number();
        path.quadraticBezierTo(cx, cy, x, y);
      case 'C':
        final c1x = number(), c1y = number(), c2x = number(), c2y = number();
        x = number();
        y = number();
        path.cubicTo(c1x, c1y, c2x, c2y, x, y);
      case 'Z':
        path.close();
        x = startX;
        y = startY;
        // Z takes no numbers, so one here could never be consumed.
        if (i < tokens.length && !_isCommand(tokens[i])) {
          throw FormatException('Stray number after "Z"', data);
        }
      default:
        throw FormatException('Unsupported path command "$command"', data);
    }
  }
  return path;
}

/// A command letter, or an unsigned or negative decimal. Anything else in the
/// data (an exponent's `e`, say) tokenises as a letter and is rejected above.
final RegExp _token = RegExp(r'[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)');

bool _isCommand(String token) => _letter.hasMatch(token);

final RegExp _letter = RegExp(r'^[A-Za-z]$');
