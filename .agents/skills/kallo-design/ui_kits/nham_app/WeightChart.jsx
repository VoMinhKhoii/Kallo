/* eslint-disable */
/** WeightChart — sparkline placeholder. The real component uses Recharts
    with a tooltip and a projected-trend line. */
function WeightChart({ data, target }) {
  const T = window.NhamTokens;
  const W = 620, H = 180, PAD = 24;
  const xs = data.map((_, i) => PAD + i * ((W - 2*PAD) / (data.length - 1)));
  const ys = data.map(d => {
    const min = Math.min(...data.map(p => p.weight)) - 0.5;
    const max = Math.max(...data.map(p => p.weight)) + 0.5;
    const t = (d.weight - min) / (max - min);
    return H - PAD - t * (H - 2*PAD);
  });
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${path} L${xs[xs.length-1]},${H - PAD} L${xs[0]},${H - PAD} Z`;

  const latest = data[data.length - 1];
  const first  = data[0];
  const delta  = latest.weight - first.weight;

  return (
    <div style={{
      height: "100%", padding: 16,
      borderRadius: T.radius["3xl"],
      border: "1px solid rgba(232,213,181,0.6)",
      background: T.color.elev,
      boxShadow: T.shadow.sm,
      display: "flex", flexDirection: "column", gap: 8, minHeight: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <Eyebrow>Weight trend</Eyebrow>
          <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: T.font.serif, fontWeight: 600, fontSize: 32, color: T.color.text, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
              {latest.weight.toFixed(1)}
            </span>
            <span style={{ fontFamily: T.font.serif, fontStyle: "italic", color: T.color.textMuted, fontSize: 16 }}>kg</span>
            <span style={{ fontFamily: T.font.sans, fontSize: 12, color: delta < 0 ? T.color.success : T.color.danger, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {delta >= 0 ? "+" : ""}{delta.toFixed(1)} this month
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <Eyebrow>On pace</Eyebrow>
          <p style={{ margin: "4px 0 0", fontFamily: T.font.sans, fontSize: 11, color: T.color.textMuted, maxWidth: 200 }}>
            Your current pace is matching the plan.
          </p>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", flex: 1, minHeight: 120 }}>
        <defs>
          <linearGradient id="wcfade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.color.accent} stopOpacity="0.25" />
            <stop offset="100%" stopColor={T.color.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#wcfade)" />
        <path d={path} fill="none" stroke={T.color.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 4 : 2.5}
            fill="#fff" stroke={T.color.accent} strokeWidth={i === xs.length - 1 ? 2 : 1.5} />
        ))}
      </svg>
    </div>
  );
}

function genWeightData() {
  const data = []; let w = 68.5;
  for (let i = 0; i < 30; i++) {
    w += (Math.random() - 0.55) * 0.4;
    data.push({ day: i, weight: Math.round(w * 10) / 10 });
  }
  return data;
}

window.WeightChart = WeightChart;
window.genWeightData = genWeightData;
