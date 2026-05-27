/* eslint-disable */
// Shared design tokens for the Nhẩm UI kit.
// Mirrors the --nham-* CSS custom properties in colors_and_type.css
// so JSX inline styles don't have to hardcode hex values.
window.NhamTokens = {
  color: {
    surface:    "#fefbf6",
    elev:       "#ffffff",
    text:       "#2c2416",
    textMuted:  "#8b7355",
    textSoft:   "#6b5d4f",
    accent:     "#c9a87c",
    accentDark: "#b89968",
    border:     "#e8d5b5",
    borderSoft: "rgba(232, 213, 181, 0.6)",
    hover:      "#f0eae0",
    track:      "#f5f4f0",
    stone:      "#a8a29e",
    btn:        "#695e4e",
    btnHover:   "#5a5043",
    macroProtein: "#c9a87c",
    macroCarbs:   "#8b7355",
    macroFat:     "#a8a29e",
    success: "#7ca368",
    danger:  "#d37b69",
    heat: ["#7ca368", "#a6c495", "#d4c9ad", "#e09c84", "#d37b69"],
  },
  font: {
    serif:  '"Lora", "Source Serif Pro", Georgia, serif',
    sans:   '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    mono:   '"JetBrains Mono", ui-monospace, Menlo, monospace',
  },
  radius: {
    md: 8, lg: 10, xl: 14, "2xl": 18, "3xl": 22, "4xl": 26, pill: 9999,
  },
  shadow: {
    xs: "0 1px 2px rgba(44, 36, 22, 0.04)",
    sm: "0 2px 8px rgba(44, 36, 22, 0.05)",
    md: "0 10px 32px rgba(44, 36, 22, 0.05)",
    lg: "0 20px 50px rgba(44, 36, 22, 0.08)",
    hero: "0 30px 60px -15px rgba(201, 168, 124, 0.25)",
  },
};
