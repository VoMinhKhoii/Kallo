/* eslint-disable */
/** Sidebar — desktop expanded/collapsed rail.
    Mirrors components/app/desktop-sidebar.tsx with simplifications:
    - no hover-peek mode (manual toggle only)
    - no onboarding nudge / user menu interactivity
    Width animates between 260 ↔ 68 over 220ms.
*/
function Sidebar({ current, onNavigate, collapsed, onToggle }) {
  const T = window.NhamTokens;
  useLucide();

  const items = [
    { id: "dashboard", label: "Dashboard", icon: "layout-dashboard" },
    { id: "nutrition", label: "Nutrition", icon: "activity" },
    { id: "logging",   label: "Logging",   icon: "utensils-crossed" },
  ];

  return (
    <aside style={{
      position: "sticky", top: 12,
      height: "calc(100vh - 24px)",
      width: collapsed ? 68 : 260,
      flexShrink: 0,
      display: "flex", flexDirection: "column",
      borderRadius: T.radius.xl,
      border: "1px solid rgba(232,213,181,0.6)",
      background: T.color.elev,
      boxShadow: T.shadow.xs,
      transition: "width 220ms ease-out",
      overflow: "hidden",
    }}>
      {/* Header — pin/unpin */}
      <div style={{ display: "flex", padding: "12px 12px 0", justifyContent: collapsed ? "center" : "space-between", alignItems: "center" }}>
        {!collapsed && (
          <div style={{ fontFamily: T.font.serif, fontWeight: 500, fontSize: 22, color: T.color.text, letterSpacing: "-0.01em", paddingLeft: 4, display: "flex", alignItems: "baseline", gap: 2 }}>
            Kallo<span style={{ color: T.color.accent }}>.</span>
          </div>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            border: "none", background: "transparent",
            width: 28, height: 28, borderRadius: 6,
            color: T.color.textMuted, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
          <Icon name={collapsed ? "panel-left-open" : "panel-left-close"} size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20, padding: 12, overflowY: "auto" }}>
        <div>
          <SectionHeader collapsed={collapsed} label="Main" />
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map(item => (
              <li key={item.id}>
                <NavRow item={item} collapsed={collapsed} active={current === item.id} onClick={() => onNavigate(item.id)} />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionHeader collapsed={collapsed} label="Settings" />
          <NavRow
            item={{ id: "settings", label: "Settings", icon: "settings" }}
            collapsed={collapsed}
            active={current === "settings"}
            onClick={() => onNavigate("settings")}
          />
        </div>
      </nav>

      {/* Footer user-tile */}
      <div style={{ flexShrink: 0, padding: 10, borderTop: "1px solid rgba(232,213,181,0.4)", background: "rgba(255,255,255,0.4)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: 6, borderRadius: T.radius.lg,
          cursor: "pointer", transition: "background .2s",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 999,
            background: T.color.btn, color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontFamily: T.font.serif, fontWeight: 500, fontSize: 14,
            flexShrink: 0,
          }}>K</div>
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: T.font.sans, fontSize: 13, fontWeight: 500, color: T.color.text, lineHeight: 1.2 }}>Khôi Võ</div>
              <div style={{ fontFamily: T.font.sans, fontSize: 11, color: T.color.textMuted }}>khoi@nham.app</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function SectionHeader({ collapsed, label }) {
  const T = window.NhamTokens;
  return (
    <div style={{ height: 20, display: "flex", alignItems: "center", padding: "0 12px", marginBottom: 8, position: "relative" }}>
      {collapsed ? (
        <div aria-hidden style={{ position: "absolute", left: 6, right: 6, top: "50%", height: 1, background: "linear-gradient(to right, transparent, rgba(232,213,181,0.6), transparent)" }} />
      ) : (
        <span style={{ fontFamily: T.font.sans, fontWeight: 500, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: T.color.textMuted, whiteSpace: "nowrap" }}>{label}</span>
      )}
    </div>
  );
}

function NavRow({ item, collapsed, active, onClick }) {
  const T = window.NhamTokens;
  const [hover, setHover] = React.useState(false);
  const style = {
    display: "flex", alignItems: "center",
    padding: "8px 12px", borderRadius: T.radius.lg,
    border: "none", background: "transparent", width: "100%", textAlign: "left",
    cursor: "pointer",
    transition: "background .2s, color .2s",
    color: active ? "#fff" : (hover ? T.color.text : T.color.textMuted),
    background: active ? T.color.btn : (hover ? "rgba(240, 234, 224, 0.6)" : "transparent"),
    boxShadow: active ? "0 1px 2px rgba(105,94,78,0.2)" : "none",
  };
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={style} aria-current={active ? "page" : undefined}>
      <span style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", margin: collapsed ? "0 auto" : 0 }}>
        <Icon name={item.icon} size={20} />
      </span>
      {!collapsed && (
        <span style={{ marginLeft: 12, fontFamily: T.font.sans, fontWeight: 500, fontSize: 13, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{item.label}</span>
      )}
    </button>
  );
}

window.Sidebar = Sidebar;
