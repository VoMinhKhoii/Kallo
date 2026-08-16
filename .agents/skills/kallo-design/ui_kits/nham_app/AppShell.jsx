/* eslint-disable */
/** AppShell — sidebar + main column for authenticated screens.
    Mirrors components/app/app-shell.tsx layout. */
function AppShell({ current, onNavigate, onExitApp, children }) {
  const T = window.NhamTokens;
  const [collapsed, setCollapsed] = React.useState(false);
  useLucide();

  return (
    <div style={{
      display: "flex", gap: 12, padding: 12,
      minHeight: "100vh", maxHeight: "100vh",
      background: T.color.surface, color: T.color.text,
      fontFamily: T.font.sans, overflow: "hidden",
    }}>
      <Sidebar
        current={current}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderRadius: 14, background: "rgba(254,251,246,0.5)", overflow: "hidden" }}>
        <TopBar onExit={onExitApp} />
        {children}
      </div>
    </div>
  );
}

function TopBar({ onExit }) {
  const T = window.NhamTokens;
  return (
    <header style={{
      flexShrink: 0, padding: "12px 24px",
      display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12,
    }}>
      <button onClick={onExit} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        border: "1px solid rgba(232,213,181,0.6)", background: "rgba(255,255,255,0.6)",
        padding: "6px 12px", borderRadius: 999, cursor: "pointer",
        fontFamily: T.font.sans, fontSize: 11, color: T.color.textMuted, fontWeight: 500,
      }}>
        <Icon name="arrow-right" size={12} style={{ transform: "rotate(180deg)" }} />
        Back to landing
      </button>
    </header>
  );
}

window.AppShell = AppShell;
