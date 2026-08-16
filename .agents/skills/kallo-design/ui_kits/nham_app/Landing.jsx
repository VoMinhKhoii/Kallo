/* eslint-disable */
/** Landing — header + hero (with typing animation + phone mockup) + CTA + footer.
    Mirrors components/landing-page/{header,hero,cta-section,footer}.tsx
    Compressed into a single file for the kit. */
function Landing({ onEnterApp }) {
  const T = window.NhamTokens;
  useLucide();

  return (
    <div style={{ background: T.color.surface, minHeight: "100vh", overflowX: "clip" }}>
      <LandingHeader onSignIn={onEnterApp} onGetStarted={onEnterApp} />
      <LandingHero onCTA={onEnterApp} />
      <LandingCTA onCTA={onEnterApp} />
      <LandingFooter />
    </div>
  );
}

function LandingHeader({ onSignIn, onGetStarted }) {
  const T = window.NhamTokens;
  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(254,251,246,0.8)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(232,213,181,0.3)",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: T.font.serif, fontWeight: 500, fontSize: 24, color: T.color.text, display: "flex", alignItems: "baseline", gap: 2 }}>
          Kallo<span style={{ color: T.color.accent }}>.</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {["Features", "How it works", "Pricing"].map(l => (
            <a key={l} href="#" style={{ fontFamily: T.font.sans, fontSize: 14, color: T.color.textSoft, textDecoration: "none", transition: "color .2s" }}>{l}</a>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onSignIn} style={{ border: "none", background: "transparent", color: T.color.textSoft, fontFamily: T.font.sans, fontSize: 14, cursor: "pointer", padding: "8px 4px" }}>Sign in</button>
          <button onClick={onGetStarted} style={{
            border: "none", background: T.color.accent, color: "#fff",
            fontFamily: T.font.sans, fontWeight: 500, fontSize: 14,
            padding: "10px 20px", borderRadius: T.radius.lg, cursor: "pointer",
            transition: "background .2s",
          }}>Get started</button>
        </div>
      </div>
    </header>
  );
}

function LandingHero({ onCTA }) {
  const T = window.NhamTokens;
  const fullText = "2 mực kho mặn + 50gr nạc dăm luộc + 1 chén cơm + canh chua";
  const [typed, setTyped] = React.useState("");
  const [showResult, setShowResult] = React.useState(false);
  const [isTyping, setIsTyping] = React.useState(true);

  React.useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i <= fullText.length) { setTyped(fullText.slice(0, i)); i++; }
      else { clearInterval(id); setIsTyping(false); setTimeout(() => setShowResult(true), 700); }
    }, 50);
    return () => clearInterval(id);
  }, []);

  return (
    <section style={{
      position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", overflow: "hidden", background: T.color.surface,
      padding: "120px 24px 80px",
    }}>
      {/* blurred ambient blobs */}
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-5%", width: 600, height: 600, borderRadius: 999, background: "rgba(232,213,181,0.2)", filter: "blur(120px)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-10%", width: 500, height: 500, borderRadius: 999, background: "rgba(201,168,124,0.1)", filter: "blur(100px)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: 1400, width: "100%", margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 3fr", gap: 80, alignItems: "center" }}>
        {/* Copy */}
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 999,
            background: "rgba(255,255,255,0.8)", border: "1px solid #e8d5b5",
            marginBottom: 32, boxShadow: T.shadow.xs, backdropFilter: "blur(4px)",
          }}>
            <Icon name="sparkles" size={14} color={T.color.accent} />
            <span style={{ fontFamily: T.font.sans, fontWeight: 600, fontSize: 11, color: T.color.textMuted, textTransform: "uppercase", letterSpacing: "0.15em" }}>Built for Vietnamese meals</span>
          </div>

          <h1 style={{ margin: "0 0 32px", fontFamily: T.font.serif, fontWeight: 400, fontSize: 72, lineHeight: 1.05, letterSpacing: "-0.03em", color: T.color.text }}>
            Track Vietnamese meals<br />
            <span style={{ fontStyle: "italic", fontWeight: 300, color: T.color.accent }}>without the guesswork</span>
          </h1>

          <p style={{ margin: "0 0 40px", maxWidth: 460, fontFamily: T.font.sans, fontWeight: 300, fontSize: 18, lineHeight: 1.6, color: T.color.textSoft }}>
            Snap a photo or describe your meal in Vietnamese. Our AI knows phở, bánh mì, and 500+ Vietnamese dishes — and calculates real nutrition from lab-verified data.
          </p>

          <div style={{ display: "flex", gap: 16, marginBottom: 48, flexWrap: "wrap" }}>
            <button onClick={onCTA} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: T.color.text, color: T.color.surface,
              border: "none", borderRadius: T.radius.xl,
              padding: "14px 28px", fontFamily: T.font.sans, fontSize: 16, fontWeight: 500, letterSpacing: "0.01em",
              cursor: "pointer", boxShadow: T.shadow.md, transition: "all .2s",
            }}>
              Get Started
              <Icon name="arrow-right" size={16} color={T.color.surface} />
            </button>
            <button style={{
              background: "transparent", color: T.color.textSoft,
              border: "1px solid #e8d5b5", borderRadius: T.radius.xl,
              padding: "14px 28px", fontFamily: T.font.sans, fontSize: 16, fontWeight: 500,
              cursor: "pointer", transition: "all .2s",
            }}>See How It Works</button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, color: T.color.textMuted, fontSize: 14 }}>
            <div style={{ display: "flex" }}>
              {["A","B","C","D"].map((l, i) => (
                <div key={l} style={{
                  width: 36, height: 36, marginLeft: i === 0 ? 0 : -12,
                  borderRadius: 999, background: "#e0d8cc",
                  border: "3px solid #fefbf6", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 10, color: "#6b5d4f", opacity: 0.5, fontFamily: T.font.sans,
                  boxShadow: T.shadow.xs,
                }}>{l}</div>
              ))}
            </div>
            <div style={{ width: 1, height: 32, background: T.color.border }} />
            <p style={{ margin: 0, fontFamily: T.font.sans, fontWeight: 500 }}>Loved by early Vietnamese beta users</p>
          </div>
        </div>

        {/* Phone */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{
            position: "relative", width: 380, height: 660,
            borderRadius: 48, border: "8px solid #fff", background: "#fff",
            boxShadow: T.shadow.hero + ", inset 0 0 0 1px rgba(232,213,181,0.5)",
            overflow: "hidden",
          }}>
            {/* Status bar */}
            <div style={{ position: "absolute", inset: "0 0 auto 0", height: 56, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", zIndex: 20 }}>
              <span style={{ fontFamily: T.font.sans, fontWeight: 600, fontSize: 12, color: T.color.text, letterSpacing: "0.05em" }}>9:41</span>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, background: T.color.text }} />
                <span style={{ width: 14, height: 14, borderRadius: 999, border: "1px solid " + T.color.text }} />
              </div>
            </div>

            {/* Main app content */}
            <div style={{ position: "absolute", inset: 0, padding: "64px 20px 96px", background: "#faf9f7", display: "flex", flexDirection: "column" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontFamily: T.font.sans, fontWeight: 500, fontSize: 11, color: T.color.textMuted, textTransform: "uppercase", letterSpacing: "0.2em" }}>Today</p>
                <h3 style={{ margin: "4px 0 0", fontFamily: T.font.serif, fontSize: 22, color: T.color.text, fontWeight: 400 }}>Meal log</h3>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12, minHeight: 0 }}>
                {/* User bubble */}
                <div style={{ maxWidth: "82%", alignSelf: "flex-end" }}>
                  <div style={{
                    background: "rgba(232,213,181,0.2)", border: "1px solid rgba(232,213,181,0.2)",
                    borderRadius: 24, borderBottomRightRadius: 4,
                    padding: "12px 16px", color: T.color.text, boxShadow: T.shadow.xs,
                  }}>
                    <p style={{ margin: 0, fontFamily: T.font.serif, fontSize: 14, lineHeight: 1.45, wordBreak: "break-word" }}>
                      {typed}
                      {isTyping && <span style={{ display: "inline-block", width: 2, height: 16, background: T.color.accent, marginLeft: 2, verticalAlign: "middle", animation: "kallo-blink 1s ease-in-out infinite" }} />}
                    </p>
                  </div>
                  <p style={{ margin: "6px 4px 0 0", fontFamily: T.font.sans, fontSize: 10, color: T.color.textMuted, opacity: 0.6, textAlign: "right" }}>Just now</p>
                </div>

                {showResult && (
                  <div style={{
                    width: "100%",
                    animation: "kallo-spring 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}>
                    <div style={{ background: "#fff", border: "1px solid rgba(232,213,181,0.3)", borderRadius: 18, borderBottomLeftRadius: 4, padding: 16, boxShadow: "0 10px 30px rgba(201,168,124,0.08)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid #f0eae0", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 999, background: T.color.text, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon name="sparkles" size={10} color={T.color.accent} />
                          </div>
                          <span style={{ fontFamily: T.font.sans, fontWeight: 700, fontSize: 10, color: T.color.text, letterSpacing: "0.06em", textTransform: "uppercase" }}>AI nutrition analysis</span>
                        </div>
                        <span style={{ fontFamily: T.font.sans, background: "rgba(201,168,124,0.1)", color: T.color.accent, padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 500 }}>High confidence</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {[
                          { name: "Mực kho (2 pcs)", cal: 180 },
                          { name: "Nạc dăm (50g)", cal: 145 },
                          { name: "Cơm trắng (1 chén)", cal: 200 },
                          { name: "Canh chua", cal: 60 },
                        ].map((it, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span style={{ fontFamily: T.font.sans, color: T.color.textSoft }}>{it.name}</span>
                            <span style={{ fontFamily: T.font.mono, fontWeight: 600, color: T.color.text, fontSize: 12 }}>{it.cal}</span>
                          </div>
                        ))}
                        <div style={{ marginTop: 4, paddingTop: 8, borderTop: "1px solid #f0eae0", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontFamily: T.font.serif, fontWeight: 500, fontSize: 13, color: T.color.text }}>Total calories</span>
                          <span style={{ fontFamily: T.font.mono, fontWeight: 700, color: T.color.accent, fontSize: 18 }}>585</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fake input bar */}
            <div style={{ position: "absolute", left: 16, right: 16, bottom: 22, zIndex: 20 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                height: 52, padding: "0 6px 0 20px",
                borderRadius: 999,
                border: "1px solid rgba(232,213,181,0.3)",
                background: "#fff", boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
              }}>
                <span style={{ fontFamily: T.font.sans, fontSize: 14, color: "#b0a695" }}>Describe your meal…</span>
                <div style={{ width: 38, height: 38, borderRadius: 999, background: T.color.text, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="arrow-right" size={14} color="#fff" />
                </div>
              </div>
            </div>

            {/* Bottom fade */}
            <div style={{ position: "absolute", inset: "auto 0 0 0", height: 96, background: "linear-gradient(to top, #faf9f7, transparent)", pointerEvents: "none", zIndex: 10 }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingCTA({ onCTA }) {
  const T = window.NhamTokens;
  return (
    <section style={{ background: "#fff", padding: "120px 24px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 24px", fontFamily: T.font.serif, fontWeight: 400, fontSize: 56, color: T.color.text, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
          Ready to <span style={{ fontStyle: "italic", color: T.color.accent, fontWeight: 300 }}>track smarter?</span>
        </h2>
        <p style={{ margin: "0 auto 48px", maxWidth: 540, fontFamily: T.font.sans, fontWeight: 300, fontSize: 20, color: T.color.textSoft, lineHeight: 1.6 }}>
          Join the beta and start tracking Vietnamese meals with real accuracy.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 48 }}>
          <button onClick={onCTA} style={{
            border: "none", background: T.color.accent, color: "#fff",
            fontFamily: T.font.sans, fontWeight: 500, fontSize: 16,
            padding: "14px 36px", borderRadius: T.radius.xl, cursor: "pointer",
            transition: "background .2s",
          }}>Get Started Free</button>
          <button style={{
            border: "1px solid " + T.color.border, background: "transparent", color: T.color.textSoft,
            fontFamily: T.font.sans, fontWeight: 500, fontSize: 16,
            padding: "14px 36px", borderRadius: T.radius.xl, cursor: "pointer",
          }}>See a sample analysis</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap", fontFamily: T.font.sans, fontSize: 14, color: T.color.textMuted, marginBottom: 64 }}>
          {["Vietnamese-first database", "AI understands cooking context", "Bounded nutrition estimates"].map(f => (
            <div key={f} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon name="check" size={16} color={T.color.accent} />
              {f}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(232,213,181,0.3)", paddingTop: 48 }}>
          <p style={{ margin: "0 0 32px", fontFamily: T.font.sans, fontSize: 14, color: T.color.textMuted }}>
            Trusted by early testers who were tired of guessing
          </p>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 48 }}>
            {[["4.9", "App Store rating"], ["10k+", "beta users"], ["2M+", "meals tracked"]].map(([num, label], i) => (
              <React.Fragment key={i}>
                {i > 0 && <div style={{ width: 1, height: 48, background: T.color.border }} />}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: T.font.serif, fontWeight: 500, fontSize: 32, color: T.color.text, lineHeight: 1 }}>{num}</div>
                  <div style={{ fontFamily: T.font.sans, fontSize: 12, color: T.color.textMuted, marginTop: 4 }}>{label}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  const T = window.NhamTokens;
  return (
    <footer style={{ background: T.color.surface, borderTop: "1px solid rgba(232,213,181,0.3)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ fontFamily: T.font.serif, fontWeight: 500, fontSize: 24, color: T.color.text, marginBottom: 16, display: "flex", alignItems: "baseline", gap: 2 }}>
              Kallo<span style={{ color: T.color.accent }}>.</span>
            </div>
            <p style={{ margin: 0, maxWidth: 360, fontFamily: T.font.sans, color: T.color.textSoft, lineHeight: 1.6 }}>
              Vietnamese meal tracking, powered by AI.
            </p>
          </div>
          <FooterCol title="Product" links={["Features", "How it works", "Pricing", "FAQ"]} />
          <FooterCol title="Company" links={["About", "Blog", "Contact", "Privacy"]} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 32, borderTop: "1px solid rgba(232,213,181,0.3)", fontFamily: T.font.sans, fontSize: 13, color: T.color.textMuted }}>
          <span>© {new Date().getFullYear()} Kallo. All rights reserved.</span>
          <div style={{ display: "flex", gap: 24 }}>
            <a href="#" style={{ color: T.color.textMuted, textDecoration: "none" }}>Terms</a>
            <a href="#" style={{ color: T.color.textMuted, textDecoration: "none" }}>Privacy policy</a>
            <a href="#" style={{ color: T.color.textMuted, textDecoration: "none" }}>Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  const T = window.NhamTokens;
  return (
    <div>
      <h4 style={{ margin: "0 0 16px", fontFamily: T.font.sans, fontWeight: 500, fontSize: 14, color: T.color.text }}>{title}</h4>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {links.map(l => (
          <li key={l}><a href="#" style={{ fontFamily: T.font.sans, fontSize: 13, color: T.color.textSoft, textDecoration: "none" }}>{l}</a></li>
        ))}
      </ul>
    </div>
  );
}

window.Landing = Landing;
