/* eslint-disable */
/** Shared tiny helpers used across the kit. */
const T = window.NhamTokens;

/** Lucide icon, declarative. `<Icon name="arrow-up" size={16} />`
    We re-run lucide.createIcons() after each render so the <i> tags
    swap into SVGs. */
function Icon({ name, size = 16, color = "currentColor", className = "", style = {} }) {
  return React.createElement("i", {
    "data-lucide": name,
    className,
    style: { width: size, height: size, color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...style },
  });
}

React.useEffect && React.useLayoutEffect; // touch refs so esbuild-safe

/** After every commit, ensure lucide has swapped icons in. */
function useLucide() {
  React.useEffect(() => {
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  });
}

/** Tiny classnames helper. */
function cx(...args) { return args.filter(Boolean).join(" "); }

/** Eyebrow label — UPPERCASE, 10px, 0.2em tracking, stone color. */
function Eyebrow({ children, color = T.color.stone, style = {} }) {
  return React.createElement("span", {
    style: {
      fontFamily: T.font.sans, fontWeight: 700, fontSize: 10,
      textTransform: "uppercase", letterSpacing: "0.2em", color, ...style,
    },
  }, children);
}

window.Icon = Icon;
window.useLucide = useLucide;
window.cx = cx;
window.Eyebrow = Eyebrow;
