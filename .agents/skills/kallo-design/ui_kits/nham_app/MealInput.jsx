/* eslint-disable */
/** MealInput — the cream rounded textarea + 32×32 umber submit button.
    Mirrors components/logging/input/meal-input.tsx — submit on Enter,
    auto-resize, disabled-while-analyzing, optional Stop button. */
function MealInput({ value, onChange, onSubmit, onCancel, disabled, placeholder }) {
  const T = window.KalloTokens;
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "0px";
    const next = Math.max(32, Math.min(el.scrollHeight, 200));
    el.style.height = next + "px";
    el.style.overflowY = el.scrollHeight > 200 ? "auto" : "hidden";
  }, [value]);

  const canSubmit = value.trim().length > 0 && !disabled;
  const showStop = disabled && onCancel;

  const wrap = {
    display: "flex", alignItems: "flex-end", gap: 12,
    borderRadius: T.radius["2xl"],
    border: "1px solid rgba(232, 213, 181, 0.4)",
    background: T.color.elev,
    padding: 12,
    boxShadow: "0 4px 20px rgba(201, 168, 124, 0.06)",
    transition: "all .25s",
  };

  return (
    <div style={wrap}>
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSubmit) onSubmit(); }
        }}
        placeholder={placeholder || "Describe your meal in Vietnamese or English…"}
        disabled={disabled}
        style={{
          flex: 1, resize: "none", border: "none", outline: "none",
          background: "transparent", padding: "6px 0",
          fontFamily: T.font.sans, fontSize: 14, lineHeight: "20px",
          color: T.color.text,
          minHeight: 32, maxHeight: 200,
        }}
      />
      {showStop ? (
        <button onClick={onCancel} aria-label="Stop analyzing" style={submitBtn(T)}>
          <Icon name="square" size={14} color="#fff" />
        </button>
      ) : (
        <button onClick={onSubmit} disabled={!canSubmit} aria-label="Submit" style={{ ...submitBtn(T), opacity: canSubmit ? 1 : 0.3 }}>
          <Icon name="arrow-up" size={16} color="#fff" />
        </button>
      )}
    </div>
  );
}
function submitBtn(T) {
  return {
    width: 32, height: 32, borderRadius: T.radius.lg,
    background: T.color.btn, color: "#fff",
    border: "none", cursor: "pointer", flexShrink: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    transition: "background .2s",
  };
}

window.MealInput = MealInput;
