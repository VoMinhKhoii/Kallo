/* eslint-disable */
/** DashboardScreen — composes Today / Progress / Consistency.
    Mirrors components/dashboard/dashboard-shell.tsx structure: a 3-row
    vertical layout with eyebrow + content per row. */
function DashboardScreen({ nutrition, meals, weightData, heatmapData, onLogMeal }) {
  const T = window.NhamTokens;

  return (
    <main style={{
      flex: 1, minHeight: 0, padding: "20px 32px 80px",
      background: "rgba(254,251,246,0.3)",
      fontFamily: T.font.sans,
      overflowY: "auto",
    }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 20 }}>
        {/* Today */}
        <section>
          <SectionTitle title="Week of May 11 – May 17, 2026" />
          <TodayDock nutrition={nutrition} meals={meals} onLogMeal={onLogMeal} />
        </section>

        {/* Progress */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Eyebrow>Progress</Eyebrow>
            <span style={{ fontFamily: T.font.sans, fontWeight: 500, fontSize: 11, color: T.color.stone }}>30 days</span>
          </div>
          <WeightChart data={weightData} />
        </section>

        {/* Consistency */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Eyebrow>Consistency</Eyebrow>
            <span style={{ fontFamily: T.font.sans, fontWeight: 500, fontSize: 11, color: T.color.stone }}>30 days</span>
          </div>
          <div style={{
            minHeight: 200, padding: 16,
            borderRadius: T.radius["3xl"],
            border: "1px solid rgba(232,213,181,0.6)",
            background: T.color.elev,
            boxShadow: T.shadow.sm,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <p style={{ margin: 0, fontFamily: T.font.serif, fontSize: 18, color: T.color.text, lineHeight: 1.5 }}>
              You held steady on <span style={{ fontStyle: "italic", color: T.color.accent }}>calories and protein</span> for most of the month.
              <span style={{ color: T.color.textMuted }}> Fat and fiber have been thin.</span>
            </p>
            <Heatmap data={heatmapData} />
            <HeatmapLegend />
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({ title }) {
  const T = window.NhamTokens;
  return (
    <div style={{ marginBottom: 6 }}>
      <Eyebrow>{title}</Eyebrow>
    </div>
  );
}

function HeatmapLegend() {
  const T = window.NhamTokens;
  const steps = [
    { color: T.color.heat[0], label: "On target" },
    { color: T.color.heat[1], label: "Close" },
    { color: T.color.heat[2], label: "Slight" },
    { color: T.color.heat[3], label: "Moderate" },
    { color: T.color.heat[4], label: "Far" },
  ];
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, fontFamily: T.font.sans, fontSize: 10, color: T.color.stone }}>
      <span>Under-target</span>
      {steps.map((s, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2 }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

window.DashboardScreen = DashboardScreen;
