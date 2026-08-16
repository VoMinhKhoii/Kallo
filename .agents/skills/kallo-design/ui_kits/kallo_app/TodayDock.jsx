/* eslint-disable */
/** TodayDock — the "Today" card on the dashboard.
    Layout (xl):
       [ remaining-calories panel | calorie-ring + macro-bars ] | meal list
    Mirrors components/dashboard/today/today-dock.tsx
*/
function TodayDock({ nutrition, meals, onLogMeal }) {
  const T = window.KalloTokens;

  const remaining = Math.max(0, nutrition.calories.target - nutrition.calories.current);

  const macros = [
    { label: "Protein", current: nutrition.protein.current, target: nutrition.protein.target, color: T.color.macroProtein },
    { label: "Carbs",   current: nutrition.carbs.current,   target: nutrition.carbs.target,   color: T.color.macroCarbs },
    { label: "Fat",     current: nutrition.fat.current,     target: nutrition.fat.target,     color: T.color.macroFat },
  ];

  return (
    <section
      aria-label="Today"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 0.68fr) minmax(260px, 0.32fr)",
        gap: 12,
        padding: 16,
        borderRadius: T.radius["3xl"],
        border: "1px solid rgba(232,213,181,0.7)",
        background: "rgba(255,255,255,0.9)",
        boxShadow: T.shadow.md,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 0.34fr) minmax(0, 0.66fr)", gap: 12, minHeight: 0 }}>
        {/* Calories remaining */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 12, borderRadius: T.radius["2xl"], background: "rgba(254,251,246,0.8)" }}>
          <Eyebrow color={T.color.stone}>Calories remaining</Eyebrow>
          <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: T.font.serif, fontWeight: 600, fontSize: 48, lineHeight: 1, color: T.color.text, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em" }}>
              {remaining.toLocaleString()}
            </span>
            <span style={{ fontFamily: T.font.serif, fontStyle: "italic", color: T.color.textMuted, fontSize: 18 }}>
              / {nutrition.calories.target.toLocaleString()}
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontFamily: T.font.sans, fontSize: 12, color: T.color.stone }}>
            {nutrition.calories.current.toLocaleString()} kcal logged
          </p>
        </div>

        {/* Ring + macro bars */}
        <div style={{ display: "grid", gridTemplateRows: "minmax(0,1fr) auto", gap: 12, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: T.radius["2xl"], background: "rgba(254,251,246,0.6)" }}>
            <CalorieRing current={nutrition.calories.current} target={nutrition.calories.target} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {macros.map(m => <MacroBar key={m.label} {...m} />)}
            </div>
          </div>
          <button
            onClick={onLogMeal}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: T.radius["2xl"],
              border: "1px solid rgba(232,213,181,0.7)",
              background: T.color.elev, color: T.color.textMuted,
              fontFamily: T.font.sans, fontSize: 13, fontWeight: 500,
              cursor: "pointer", textAlign: "left",
              transition: "border-color .2s",
            }}>
            <span style={{ flex: 1, color: T.color.stone }}>Describe your meal…</span>
            <span style={{ width: 28, height: 28, borderRadius: T.radius.lg, background: T.color.btn, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="arrow-up" size={14} color="#fff" />
            </span>
          </button>
        </div>
      </div>

      {/* Meal list */}
      <div style={{ minHeight: 140, padding: 10, borderRadius: T.radius["2xl"], border: "1px solid rgba(232,213,181,0.6)", background: "rgba(254,251,246,0.6)" }}>
        <Eyebrow style={{ paddingLeft: 4 }}>Today</Eyebrow>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {meals.length === 0 ? (
            <p style={{ fontFamily: T.font.sans, fontSize: 13, color: T.color.stone, margin: 0, padding: "12px 4px" }}>
              Your meal receipts will show up here.
            </p>
          ) : meals.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 6px", borderRadius: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: T.font.sans, fontSize: 11, color: T.color.stone, fontWeight: 700, letterSpacing: "0.1em" }}>{m.time}</div>
                <div style={{ fontFamily: T.font.serif, fontSize: 13, color: T.color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.rawInput}</div>
              </div>
              <span style={{ fontFamily: T.font.sans, fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 12, color: T.color.text, marginLeft: 8 }}>
                {Math.round(m.calories)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CalorieRing({ current, target, size = 72, strokeWidth = 6 }) {
  const T = window.KalloTokens;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, current / target);
  const offset = circumference * (1 - progress);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={radius} stroke={T.color.track} strokeWidth={strokeWidth} fill="none" />
        <circle cx={size/2} cy={size/2} r={radius} stroke={T.color.accent} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .6s ease-out" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="flame" size={24} color={T.color.accent} />
      </div>
    </div>
  );
}

function MacroBar({ label, current, target, color }) {
  const T = window.KalloTokens;
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontFamily: T.font.sans, fontSize: 11, color: T.color.textMuted, fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: T.font.sans, fontSize: 11, color: T.color.text, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {Math.round(current)}<span style={{ color: T.color.stone, fontWeight: 400 }}>/{target}g</span>
        </span>
      </div>
      <div style={{ height: 4, background: T.color.track, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 999, transition: "width .6s ease-out" }} />
      </div>
    </div>
  );
}

window.TodayDock = TodayDock;
