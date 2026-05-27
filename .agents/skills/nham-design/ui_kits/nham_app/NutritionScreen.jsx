/* eslint-disable */
/** NutritionScreen — placeholder. The real screen is a deep long-term
    macro/micronutrient pattern analysis (see components/nutrition/ in
    the source repo). Out of scope for this kit. */
function NutritionScreen() {
  const T = window.NhamTokens;
  return (
    <main style={{ flex: 1, padding: "32px", overflowY: "auto", fontFamily: T.font.sans }}>
      <div style={{ maxWidth: 720, margin: "60px auto", textAlign: "center" }}>
        <Eyebrow>Pattern analysis</Eyebrow>
        <h1 style={{ margin: "12px 0 0", fontFamily: T.font.serif, fontWeight: 400, fontSize: 44, color: T.color.text, letterSpacing: "-0.03em" }}>
          Nutrition <span style={{ fontStyle: "italic", fontWeight: 300, color: T.color.accent }}>coming soon.</span>
        </h1>
        <p style={{ margin: "16px auto 0", maxWidth: 480, fontFamily: T.font.sans, fontWeight: 300, fontSize: 16, color: T.color.textMuted, lineHeight: 1.6 }}>
          The full pattern analysis — macro rhythm, micronutrient grid, food-idea drawer — is in the source repo at <code style={{ fontFamily: T.font.mono, fontSize: 13, color: T.color.text }}>components/nutrition/</code>. It is out of scope for this UI kit.
        </p>
        <div style={{ marginTop: 32, padding: 24, borderRadius: 22, border: "1px solid rgba(232,213,181,0.6)", background: T.color.elev, textAlign: "left" }}>
          <p style={{ margin: 0, fontFamily: T.font.serif, fontSize: 17, color: T.color.text, lineHeight: 1.55 }}>
            “The last 30 days felt steady on <span style={{ fontStyle: "italic", color: T.color.accent }}>calories and protein</span>, but fat and fiber have been thin.”
          </p>
          <p style={{ margin: "10px 0 0", fontFamily: T.font.sans, fontSize: 12, color: T.color.stone }}>
            an editor's note — 30 logged days · 84% avg confidence
          </p>
        </div>
      </div>
    </main>
  );
}
window.NutritionScreen = NutritionScreen;
