/* eslint-disable */
/** MealCard — the persisted meal entry in the logging timeline.
    Mirrors components/logging/feed/persisted-meal-card.tsx
    Collapsed by default: shows quoted meal text + macro inline + kcal total.
    Expanded: groups list with per-group macros + total row. */
function MealCard({ meal, defaultExpanded = false }) {
  const T = window.KalloTokens;
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const fmt = v => v == null ? "N/A" : `${Math.round(v)}g`;
  const fmtKcal = v => v == null ? "N/A" : `${Math.round(v)} kcal`;

  return (
    <article style={{ position: "relative" }}>
      {/* Timeline dot + line */}
      <span style={{ position: "absolute", left: -43, top: 28, width: 8, height: 8, borderRadius: 999, border: `2px solid ${T.color.accent}`, background: "#fff", boxSizing: "border-box" }} />
      <span style={{ position: "absolute", left: -40, top: 36, bottom: 0, width: 1, background: "rgba(232,213,181,0.6)" }} />

      {/* Time label */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: 11, letterSpacing: "0.15em", color: "rgba(139,115,85,0.6)" }}>
          {meal.time}
        </span>
      </div>

      {/* Card */}
      <div style={{
        borderRadius: T.radius["3xl"],
        border: "1px solid rgba(232,213,181,0.6)",
        background: T.color.elev,
        padding: "18px 20px",
        boxShadow: T.shadow.sm,
        transition: "box-shadow .2s",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <p style={{ margin: 0, fontFamily: T.font.serif, fontSize: 17, lineHeight: 1.5, color: T.color.text }}>
            “{meal.rawInput}”
          </p>
          <button
            onClick={() => setExpanded(e => !e)}
            aria-label="Toggle details"
            aria-expanded={expanded}
            style={{
              border: "none", background: "transparent",
              padding: 4, borderRadius: 999,
              color: "rgba(139,115,85,0.6)", cursor: "pointer",
              transition: "transform .2s",
              transform: expanded ? "rotate(180deg)" : "none",
            }}>
            <Icon name="chevron-down" size={16} />
          </button>
        </div>

        {!expanded && (
          <div style={{
            marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline",
            fontFamily: T.font.sans, fontVariantNumeric: "tabular-nums",
          }}>
            <span style={{ fontSize: 11, color: T.color.textMuted }}>
              P: {fmt(meal.protein)}{"  "}C: {fmt(meal.carbs)}{"  "}F: {fmt(meal.fat)}
            </span>
            <span style={{ fontWeight: 700, color: T.color.text, fontSize: 14 }}>
              {fmtKcal(meal.calories)}
            </span>
          </div>
        )}

        {expanded && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed rgba(232,213,181,1)" }}>
            {meal.groups.map((g, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", fontFamily: T.font.sans, fontSize: 13,
              }}>
                <span style={{ fontWeight: 500, color: T.color.text }}>{g.name}</span>
                <div style={{ display: "flex", gap: 12, fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ fontSize: 10, color: T.color.textMuted }}>
                    P:{fmt(g.protein)} C:{fmt(g.carbs)} F:{fmt(g.fat)}
                  </span>
                  <span style={{ fontWeight: 700, color: T.color.text, minWidth: 64, textAlign: "right" }}>
                    {fmtKcal(g.calories)}
                  </span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px dashed rgba(232,213,181,0.6)", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: T.font.sans }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: T.color.text }}>Total</span>
              <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                <span style={{ fontSize: 11, color: T.color.textMuted, fontVariantNumeric: "tabular-nums" }}>
                  P: {fmt(meal.protein)}{"  "}C: {fmt(meal.carbs)}{"  "}F: {fmt(meal.fat)}
                </span>
                <span style={{ fontWeight: 700, color: T.color.text, fontVariantNumeric: "tabular-nums" }}>
                  {fmtKcal(meal.calories)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

window.MealCard = MealCard;
