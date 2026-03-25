// src/TopUp.jsx
// The "buy Thoughts" screen and the email/balance check flow.
// Import these into App.jsx.

import { useState } from "react";
import { BUNDLES, getBalance, purchaseBundle } from "./thoughts.js";
import { supabase } from "./supabase.js";

// ── BALANCE CHECK SCREEN ──────────────────────────────────────────────────────
// Shown before the ask form. User enters email, we check their balance.

export function BalanceCheck({ onHasBalance, onNeedsTopUp, CSS, Cur, Nav, hot, setHot }) {
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    if (!email.includes("@")) { setError("Please enter a valid email."); return; }
    setChecking(true);
    setError("");
    const balance = await getBalance(supabase, email);
    setChecking(false);
    if (balance > 0) {
      onHasBalance(email, balance);
    } else {
      onNeedsTopUp(email);
    }
  };

  return (
    <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif",background:"#ece8de",minHeight:"100vh",color:"#18140f" }}>
      <style>{CSS}</style>
      <Cur />
      <Nav />
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:"calc(100vh - 65px)" }}>
        <div style={{ padding:"80px 52px",borderRight:"1px solid rgba(24,20,15,.09)",background:"rgba(24,20,15,.018)",display:"flex",flexDirection:"column",justifyContent:"center" }}>
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".35em",color:"rgba(24,20,15,.28)",marginBottom:"24px" }}>RETURNING?</p>
          <h2 style={{ fontSize:"clamp(30px,4vw,48px)",fontWeight:700,letterSpacing:"-.04em",lineHeight:"1.0",marginBottom:"20px" }}>
            Enter your email<br/>
            <em style={{ fontWeight:400,color:"rgba(24,20,15,.36)" }}>to check your balance.</em>
          </h2>
          <p style={{ fontSize:"15px",lineHeight:"1.9",color:"rgba(24,20,15,.5)",fontStyle:"italic" }}>
            No account. No password. Just your email and however many Thoughts you have left.
          </p>
        </div>
        <div style={{ padding:"80px 52px",display:"flex",flexDirection:"column",justifyContent:"center" }}>
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".2em",color:"rgba(24,20,15,.28)",marginBottom:"10px" }}>YOUR EMAIL</p>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCheck()}
            placeholder="you@"
            autoFocus
            style={{ width:"100%",border:"none",borderBottom:"1px solid rgba(24,20,15,.2)",background:"transparent",padding:"12px 0",fontSize:"20px",color:"#18140f",fontFamily:"'Libre Baskerville',serif",marginBottom:"8px" }}
            onFocus={e => e.target.style.borderBottomColor="#18140f"}
            onBlur={e => e.target.style.borderBottomColor="rgba(24,20,15,.2)"}
          />
          {error && <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"rgba(200,50,50,.8)",marginBottom:"16px",letterSpacing:".08em" }}>{error}</p>}
          <div style={{ marginTop:"32px",display:"flex",flexDirection:"column",gap:"12px" }}>
            <button className="btn"
              onClick={handleCheck}
              onMouseEnter={() => setHot(true)}
              onMouseLeave={() => setHot(false)}
              disabled={checking || !email.includes("@")}
              style={{ alignSelf:"flex-start",background:"#18140f",color:"#ece8de",border:"none",padding:"16px 40px",fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:".2em" }}>
              {checking ? "CHECKING..." : "CONTINUE"}
            </button>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".1em",color:"rgba(24,20,15,.25)" }}>
              FIRST TIME? YOU'LL BE PROMPTED TO BUY THOUGHTS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TOP UP SCREEN ─────────────────────────────────────────────────────────────
// Shown when someone's balance is zero. Buy a bundle to continue.

export function TopUpScreen({ email, onBack, CSS, Cur, Nav, hot, setHot }) {
  const [selected, setSelected] = useState("five");
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    const bundle = BUNDLES.find(b => b.id === selected);
    if (!bundle) return;
    setLoading(true);
    await purchaseBundle(bundle, email);
    // Stripe redirects away — loading stays true until redirect
  };

  return (
    <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif",background:"#ece8de",minHeight:"100vh",color:"#18140f" }}>
      <style>{CSS}</style>
      <Cur />
      <Nav />
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:"calc(100vh - 65px)" }}>

        {/* LEFT */}
        <div style={{ padding:"80px 52px",borderRight:"1px solid rgba(24,20,15,.09)",background:"rgba(24,20,15,.018)",display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
          <div>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".35em",color:"rgba(24,20,15,.28)",marginBottom:"24px" }}>GET THOUGHTS</p>
            <h2 style={{ fontSize:"clamp(30px,4vw,48px)",fontWeight:700,letterSpacing:"-.04em",lineHeight:"1.0",marginBottom:"24px" }}>
              A Thought is<br/>
              <em style={{ fontWeight:400,color:"rgba(24,20,15,.36)" }}>one question.</em>
            </h2>
            <p style={{ fontSize:"15px",lineHeight:"1.9",color:"rgba(24,20,15,.55)",marginBottom:"16px" }}>
              You buy Thoughts in advance. Each question costs one. No subscription, no auto-renew, no tricks.
            </p>
            <p style={{ fontSize:"15px",lineHeight:"1.9",color:"rgba(24,20,15,.55)" }}>
              They don't expire. Use them whenever something comes up.
            </p>
          </div>
          <div>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".1em",color:"rgba(24,20,15,.22)",lineHeight:"1.9" }}>
              NOT A SUBSCRIPTION · NO AUTO-RENEW<br/>
              THOUGHTS DON'T EXPIRE · JUST AN EMAIL AND A CARD
            </p>
          </div>
        </div>

        {/* RIGHT — bundle selection */}
        <div style={{ padding:"80px 52px",display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
          <div>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".25em",color:"rgba(24,20,15,.28)",marginBottom:"20px" }}>
              PURCHASING FOR: <span style={{ color:"rgba(24,20,15,.55)" }}>{email}</span>
            </p>

            <div style={{ display:"flex",flexDirection:"column",border:"1px solid rgba(24,20,15,.1)",marginBottom:"32px" }}>
              {BUNDLES.map((bundle, i) => (
                <div
                  key={bundle.id}
                  className="row"
                  onClick={() => setSelected(bundle.id)}
                  style={{
                    display:"grid", gridTemplateColumns:"1fr auto",
                    padding:"24px 28px",
                    borderBottom: i < BUNDLES.length - 1 ? "1px solid rgba(24,20,15,.08)" : "none",
                    borderLeft: selected === bundle.id ? "3px solid #18140f" : "3px solid transparent",
                    background: selected === bundle.id ? "rgba(24,20,15,.04)" : "transparent",
                    alignItems:"center", gap:"16px",
                  }}>
                  <div>
                    <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"11px",letterSpacing:".08em",color:"#18140f",marginBottom:"4px" }}>
                      {bundle.label}
                    </p>
                    <p style={{ fontSize:"14px",fontStyle:"italic",color:"rgba(24,20,15,.55)",lineHeight:"1.5",marginBottom: bundle.perThought ? "6px" : "0" }}>
                      {bundle.description}
                    </p>
                    {bundle.perThought && (
                      <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"rgba(24,20,15,.3)",letterSpacing:".08em" }}>
                        {bundle.perThought}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0 }}>
                    <p style={{ fontSize:"28px",fontWeight:700,letterSpacing:"-.03em" }}>{bundle.price}</p>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn"
              onClick={handlePurchase}
              onMouseEnter={() => setHot(true)}
              onMouseLeave={() => setHot(false)}
              disabled={loading}
              style={{ width:"100%",padding:"18px",background:"#18140f",color:"#ece8de",border:"none",fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:".2em" }}>
              {loading ? "REDIRECTING TO STRIPE..." : `GET ${BUNDLES.find(b=>b.id===selected)?.label.toUpperCase()} · ${BUNDLES.find(b=>b.id===selected)?.price}`}
            </button>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"8px",letterSpacing:".08em",color:"rgba(24,20,15,.2)",textAlign:"center",marginTop:"12px",lineHeight:"2" }}>
              SECURE PAYMENT VIA STRIPE · NO AUTO-RENEW · THOUGHTS DON'T EXPIRE
            </p>
          </div>

          <button className="ghost" onClick={onBack}
            onMouseEnter={() => setHot(true)}
            onMouseLeave={() => setHot(false)}
            style={{ background:"transparent",color:"#18140f",border:"1px solid rgba(24,20,15,.15)",padding:"12px 24px",fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".15em",alignSelf:"flex-start",marginTop:"16px" }}>
            ← BACK
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BALANCE BADGE ─────────────────────────────────────────────────────────────
// Small display shown in the ask form when a user has a balance

export function BalanceBadge({ balance }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:"10px",padding:"10px 16px",border:"1px solid rgba(24,20,15,.1)",background:"rgba(24,20,15,.015)",marginBottom:"24px" }}>
      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:"22px",fontWeight:700,color:"#18140f",lineHeight:1 }}>{balance}</div>
      <div>
        <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".15em",color:"rgba(24,20,15,.4)" }}>
          {balance === 1 ? "THOUGHT REMAINING" : "THOUGHTS REMAINING"}
        </p>
        <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"8px",letterSpacing:".08em",color:"rgba(24,20,15,.25)" }}>
          THIS QUESTION COSTS ONE
        </p>
      </div>
    </div>
  );
}
