// Finds an element in `idb ui describe-all` output: by its label or text, or as
// the text field under a point. Pure, so drive-ios.mjs stays thin.

/** @typedef {{ x: number, y: number, width: number, height: number }} Frame */
/** @typedef {{ type?: string, AXLabel?: string | null, AXValue?: string | null, frame?: Frame }} Element */

// What a tap means to hit, ahead of the static text that often shares its label.
const CONTROLS = [
  'Button',
  'TextField',
  'SecureTextField',
  'Link',
  'CheckBox',
  'Switch',
];

export function isTextField(element) {
  return /TextField/.test(element.type ?? '');
}

/**
 * The element labelled `label` (a whole label or one of its lines; Flutter
 * joins a control's texts with newlines), controls first, or the text field
 * containing the point `at`. Off-screen elements, which idb reports at zero
 * size, never match.
 * @param {Element[]} elements
 * @param {{ label?: string, at?: { x: number, y: number } }} query
 */
export function findElement(elements, { label, at }) {
  const visible = elements.filter(
    (e) =>
      e.type !== 'Application' &&
      e.frame &&
      e.frame.width > 0 &&
      e.frame.height > 0
  );
  const match = at
    ? visible.find((e) => isTextField(e) && contains(e.frame, at))
    : [...visible]
        .filter((e) => texts(e).includes(label))
        .sort((a, b) => rank(a) - rank(b))[0];
  return match ? { element: match, center: centerOf(match.frame) } : null;
}

function texts(element) {
  return [element.AXLabel, element.AXValue]
    .filter(Boolean)
    .flatMap((text) => [text, ...text.split('\n')])
    .map((text) => text.trim());
}

function rank(element) {
  const i = CONTROLS.indexOf(element.type ?? '');
  return i === -1 ? CONTROLS.length : i;
}

function contains(frame, point) {
  return (
    point.x >= frame.x &&
    point.x <= frame.x + frame.width &&
    point.y >= frame.y &&
    point.y <= frame.y + frame.height
  );
}

function centerOf(frame) {
  return {
    x: Math.round(frame.x + frame.width / 2),
    y: Math.round(frame.y + frame.height / 2),
  };
}
