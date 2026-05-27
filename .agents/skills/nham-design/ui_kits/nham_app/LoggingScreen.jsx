/* eslint-disable */
/** LoggingScreen — timeline sidebar + feed area + meal input.
    Mirrors components/logging/logging-shell.tsx structure.
    Simplifications:
      - timeline-sidebar is a static list of last 7 days (clickable)
      - the streaming pipeline is faked with a 1.6s delay
*/
function LoggingScreen({ meals, addMeal }) {
  const T = window.NhamTokens;
  const today = new Date();
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - i);
    return d;
  });
  const [selectedDateIdx, setSelectedDateIdx] = React.useState(0);

  const [draft, setDraft] = React.useState("");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [phase, setPhase] = React.useState("");

  const handleSubmit = () => {
    const text = draft.trim();
    if (!text) return;
    setAnalyzing(true);
    const phases = ["Connecting…", "Breaking down your meal…", "Matching ingredients…", "Estimating nutrition…", "Putting it all together…"];
    let i = 0;
    setPhase(phases[0]);
    const tick = setInterval(() => {
      i++;
      if (i >= phases.length) { clearInterval(tick); return; }
      setPhase(phases[i]);
    }, 320);
    setTimeout(() => {
      clearInterval(tick);
      addMeal(text);
      setDraft("");
      setAnalyzing(false);
      setPhase("");
    }, 1700);
  };

  const handleCancel = () => { setAnalyzing(false); setPhase(""); };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, padding: "12px 12px 12px 0", gap: 12 }}>
      {/* Timeline sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        borderRadius: T.radius.xl,
        border: "1px solid rgba(232,213,181,0.6)",
        background: T.color.elev,
        padding: 14,
        display: "flex", flexDirection: "column", gap: 10,
        boxShadow: T.shadow.xs,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: 11, letterSpacing: "0.15em", color: T.color.textMuted, textTransform: "uppercase" }}>Week 20</span>
          <button style={{ border: "none", background: "transparent", color: T.color.textMuted, cursor: "pointer", padding: 4 }}>
            <Icon name="search" size={14} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {dates.map((d, i) => <DateRow key={i} date={d} active={i === selectedDateIdx} hasMeals={i < 4} onClick={() => setSelectedDateIdx(i)} />)}
        </div>
      </aside>

      {/* Feed */}
      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <header>
          <Eyebrow>{selectedDateIdx === 0 ? "Today" : selectedDateIdx === 1 ? "Yesterday" : dates[selectedDateIdx].toLocaleDateString("en-US", { weekday: "long" })}</Eyebrow>
          <h2 style={{ margin: "4px 0 0", fontFamily: T.font.serif, fontWeight: 400, fontSize: 28, color: T.color.text, letterSpacing: "-0.02em" }}>
            {dates[selectedDateIdx].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </h2>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingLeft: 48, paddingRight: 8 }}>
          {meals.length === 0 ? (
            <EmptyState onPick={(s) => setDraft(s)} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 16 }}>
              {meals.map((m, i) => <MealCard key={i} meal={m} defaultExpanded={i === 0} />)}
            </div>
          )}
        </div>

        {/* Input + streaming banner */}
        <div style={{ paddingLeft: 48, paddingRight: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {analyzing && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: T.radius.xl, background: "rgba(201,168,124,0.08)", border: "1px solid rgba(201,168,124,0.2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: T.color.accent, animation: "nham-pulse 1.4s ease-in-out infinite" }} />
              <span style={{ fontFamily: T.font.sans, fontSize: 12, color: T.color.textMuted, fontWeight: 500 }}>{phase}</span>
            </div>
          )}
          <MealInput
            value={draft}
            onChange={setDraft}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            disabled={analyzing}
          />
        </div>
      </section>
    </div>
  );
}

function DateRow({ date, active, hasMeals, onClick }) {
  const T = window.NhamTokens;
  const [hover, setHover] = React.useState(false);
  const isToday = date.toDateString() === new Date().toDateString();
  return (
    <button
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", borderRadius: T.radius.lg,
        border: "none", textAlign: "left", width: "100%",
        background: active ? "rgba(201,168,124,0.12)" : (hover ? "rgba(240,234,224,0.6)" : "transparent"),
        cursor: "pointer", transition: "background .15s",
        fontFamily: T.font.sans,
      }}>
      <div style={{ width: 32, textAlign: "center" }}>
        <div style={{ fontSize: 9, color: T.color.stone, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {date.toLocaleDateString("en-US", { weekday: "short" })}
        </div>
        <div style={{ fontFamily: T.font.serif, fontSize: 18, color: active ? T.color.accent : T.color.text, fontWeight: 500, lineHeight: 1 }}>
          {date.getDate()}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: active ? T.color.text : T.color.textMuted, fontWeight: 500 }}>
          {isToday ? "Today" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
        {hasMeals && (
          <div style={{ fontSize: 10, color: T.color.stone, marginTop: 2 }}>
            {Math.floor(Math.random() * 4) + 1} meals
          </div>
        )}
      </div>
      {hasMeals && <span style={{ width: 4, height: 4, borderRadius: 999, background: T.color.accent }} />}
    </button>
  );
}

function EmptyState({ onPick }) {
  const T = window.NhamTokens;
  const suggestions = ["2 mực kho + cơm", "Phở bò tái", "Bún chả Hà Nội"];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "40px 20px" }}>
      <div style={{ width: 40, height: 40, borderRadius: T.radius.xl, background: "rgba(232,213,181,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="utensils-crossed" size={20} color={T.color.textMuted} />
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ margin: 0, fontFamily: T.font.serif, fontWeight: 400, fontSize: 22, color: T.color.text, letterSpacing: "-0.01em" }}>What did you eat?</h2>
        <p style={{ margin: "4px 0 0", fontFamily: T.font.sans, fontSize: 13, color: T.color.textMuted }}>
          Describe your meal and get a macro breakdown.
        </p>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => onPick(s)} style={{
            border: "1px solid rgba(232,213,181,0.6)",
            background: "rgba(255,255,255,0.8)",
            borderRadius: 999, padding: "5px 14px",
            fontFamily: T.font.sans, fontSize: 12, color: T.color.textMuted, fontWeight: 500,
            cursor: "pointer", transition: "all .15s",
          }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

window.LoggingScreen = LoggingScreen;
