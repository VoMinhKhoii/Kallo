/* eslint-disable */
/** Heatmap — adherence grid used in the dashboard "Consistency" section.
    Mirrors components/dashboard/progress/adherence-heatmap.tsx (simplified).
    Days are columns; weekdays are rows. Color scale is the 5-step diverging
    warm scale lifted from heatmap-colors.ts. */
function Heatmap({ data, weekdays = ["M","T","W","T","F","S","S"] }) {
  const T = window.KalloTokens;
  // data: 2D array [weekIndex][weekday] of 0..4 step or null for empty
  return (
    <div style={{ display: "flex", gap: 6, height: "100%", padding: 4 }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", paddingTop: 4 }}>
        {weekdays.map((w, i) => (
          <span key={i} style={{ fontFamily: T.font.sans, fontSize: 9, color: T.color.stone, fontWeight: 600, height: 14 }}>{w}</span>
        ))}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${data.length}, 1fr)`, gridTemplateRows: "repeat(7, 1fr)", gap: 3, gridAutoFlow: "column" }}>
        {data.flatMap((week, wi) => week.map((step, di) => (
          <div
            key={`${wi}-${di}`}
            title={`${step == null ? "Not logged" : labelFor(step)}`}
            style={{
              borderRadius: 3,
              background: step == null ? T.color.track : T.color.heat[step],
              opacity: step == null ? 0.6 : 1,
            }}
          />
        )))}
      </div>
    </div>
  );
}

function labelFor(step) {
  return ["On target", "Close", "Slightly off", "Moderately off", "Far off"][step] || "—";
}

/** Generate fake-but-plausible adherence data. */
function genHeatmap(weeks = 30) {
  const out = [];
  for (let w = 0; w < weeks; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const r = Math.random();
      if (w === weeks - 1 && d > 3) week.push(null);
      else if (r < 0.1) week.push(null);
      else if (r < 0.5) week.push(0);
      else if (r < 0.75) week.push(1);
      else if (r < 0.9) week.push(2);
      else if (r < 0.97) week.push(3);
      else week.push(4);
    }
    out.push(week);
  }
  return out;
}

window.Heatmap = Heatmap;
window.genHeatmap = genHeatmap;
