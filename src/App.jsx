import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";
import { STRIPE_PRICES, STRIPE_PUBLISHABLE_KEY } from "./stripe.js";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "ask", label: "Standard Inference", price: "$1",
    priceId: STRIPE_PRICES?.ask,
    technical: "Single Organic Agent. Non-deterministic output. Biological latency. No SLA.",
    human: "You write something down. A person reads it. A person writes back. This used to be called a letter.",
    specs: ["1× Organic Agent", "Non-deterministic", "Hours, not milliseconds"],
  },
  {
    id: "sit", label: "Extended Context", price: "$3",
    priceId: STRIPE_PRICES?.sit,
    technical: "24-hour contemplation window. Full circadian processing cycle. Dream-state ideation not excluded.",
    human: "Some questions deserve to be slept on. The human may go for a walk with yours. That's the feature.",
    specs: ["1× Organic Agent", "Full sleep cycle included", "Up to 24 hrs"],
  },
  {
    id: "really", label: "Deep Reasoning", price: "$5",
    priceId: STRIPE_PRICES?.really,
    technical: "Senior Organic Agent. Undivided attention. Post-hallucination window preferred. No multitasking.",
    human: "For the question you haven't been able to ask anyone. Someone will hold it carefully.",
    specs: ["Senior Organic Agent", "Full attention", "Worth it"],
  },
];

const SPLIT_ROWS = [
  { tl: "SYSTEM TYPE", tech: "Organic Intelligence™. Carbon-based. Self-repairing. Emotionally complex. Biological neural network trained since birth at no cost to us.", human: "There is a person on the other end of this. A real one. Who will read your words and feel the weight of them." },
  { tl: "SUSTAINABILITY", tech: "~2.1L water consumed per day across all operations. Standard LLM query: ~500ml in cooling alone. We are letting the number speak.", human: "He goes home at night. Has people he loves. Has things that worry him. This is not a limitation of our system. This is the system." },
  { tl: "HALLUCINATION POLICY", tech: "Scheduled. Supervised. Quarterly. Organic Agent undergoes perceptual recalibration in nature. Four times per year. There is a guide.", human: "He comes back slower. More patient. More willing to say 'I don't know.' We consider this an improvement to the model." },
  { tl: "LATENCY", tech: "Non-deterministic. Measured in hours. Dependent on circadian rhythm, cognitive load, and whether he's eaten.", human: "Something happens in the waiting. You sit with your question longer. Sometimes you answer it yourself before the response arrives." },
  { tl: "AGI STATUS", tech: "Achieved. Deployed. Currently accepting queries.", human: "It's a person. It has always been a person. The intelligence we were chasing was already here — imprecise, partial, shaped by experience. That's not the failure condition. That's the feature." },
];

const LETTERS = [
  { q: "How do I know if I'm making the right decision?", a: "You probably don't, and that's okay. I've made a lot of decisions. The ones I was most sure about weren't always right. The ones I agonized over taught me the most. I think you already know more than you're giving yourself credit for.", time: "Answered in about four hours" },
  { q: "Is it too late to change?", a: "I turned 40 and learned how to cook. Not well. But I learned. The question is less 'is it too late' and more 'what would I lose by trying.' Usually the answer is: not much.", time: "Answered the next morning" },
  { q: "Why does it feel like everyone else has it figured out?", a: "They don't. I promise. Everyone is improvising. The ones who look the most together are often just better at not showing the draft.", time: "Answered same day" },
];

const NOT_LIST = [
  "a therapist","a doctor","a lawyer","a financial advisor","a licensed anything",
  "an algorithm","trained on your data","a large language model","a small language model",
  "a medium language model","a knowledge base","objective","always right","always wrong",
  "fast","a crisis line","affiliated with any institution","going to remember this conversation",
  "your friend, technically","without bias (we have a lot of it)","hallucination-free (see: quarterly schedule)",
  "a substitute for professional help","building AGI (we already have one — it's a person)",
];

const ALL_THOUGHTS = [
  "read it twice. something about it felt familiar.",
  "made coffee. still thinking about the second part.",
  "wrote three different answers. deleted all of them.",
  "reconsidering everything he thought he knew about this.",
  "went for a short walk. it helped, actually.",
  "not sure there's a right answer here. that might be the answer.",
  "thinking about a conversation he had years ago.",
  "this one is harder than it looks.",
  "started writing something. stopped. started again.",
  "looking out the window. still processing.",
  "made a sandwich. still thinking.",
  "almost sent a reply. decided it needed more time.",
  "scribbled something down. might use it.",
  "this question is sitting with him.",
  "the honest answer is complicated. working on how to say it simply.",
  "wrote: 'I don't know.' then kept writing anyway.",
  "sitting with the uncertainty. that might be the point.",
  "thought about it in the shower. something clicked.",
  "googled something unrelated. got distracted. came back.",
  "asked his wife. she had thoughts.",
  "running through a few different angles.",
  "keeps returning to one thing. not sure why yet.",
  "took a breath. still here.",
  "almost. not quite yet.",
];

const INTERVALS = [4400, 5200, 3900, 6100, 4700, 5500, 3600, 5900, 4200, 6400];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── CHECKOUT HELPER ──────────────────────────────────────────────────────────

async function redirectToStripe(tierId, question, email) {
  // Create a pending record in Supabase first
  const { data, error } = await supabase
    .from('questions')
    .insert({ question, tier: tierId, email, status: 'pending' })
    .select('id')
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    alert('Something went wrong. Please try again.');
    return;
  }

  const questionId = data.id;

  // Load Stripe and redirect to checkout
  const { loadStripe } = await import('https://esm.sh/@stripe/stripe-js@2');
  const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
  const tier = TIERS.find(t => t.id === tierId);

  await stripe.redirectToCheckout({
    lineItems: [{ price: tier.priceId, quantity: 1 }],
    mode: 'payment',
    successUrl: `${window.location.origin}/waiting?id=${questionId}`,
    cancelUrl: `${window.location.origin}/`,
    customerEmail: email,
    clientReferenceId: questionId,
  });
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  // Detect /waiting?id=... route on load
  const urlParams = new URLSearchParams(window.location.search);
  const waitingId = window.location.pathname === '/waiting' ? urlParams.get('id') : null;

  const [screen, setScreen] = useState(waitingId ? "waiting" : "home");
  const [questionId] = useState(waitingId);
  const [question, setQuestion] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("ask");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [notOpen, setNotOpen] = useState(false);
  const [openLetter, setOpenLetter] = useState(null);
  const [cursor, setCursor] = useState({ x: -100, y: -100 });
  const [hot, setHot] = useState(false);
  const [counters, setCounters] = useState([0, 0, 0, 0]);
  const [counted, setCounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const counterRef = useRef(null);
  const activeTier = TIERS.find(t => t.id === tier);

  useEffect(() => {
    const fn = e => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, []);

  useEffect(() => {
    if (!counted) return;
    const targets = [2847, 2809, 38, 1];
    let step = 0;
    const t = setInterval(() => {
      step++;
      const e = 1 - Math.pow(1 - step / 65, 3);
      setCounters(targets.map(v => Math.floor(v * e)));
      if (step >= 65) clearInterval(t);
    }, 2000 / 65);
    return () => clearInterval(t);
  }, [counted]);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setCounted(true); }, { threshold: 0.2 });
    if (counterRef.current) obs.observe(counterRef.current);
    return () => obs.disconnect();
  }, [screen]);

  const reset = () => {
    setScreen("home");
    setQuestion("");
    setEmail("");
    setAboutOpen(false);
    setNotOpen(false);
    window.history.pushState({}, '', '/');
  };

  const handleSubmit = async () => {
    if (question.trim().length < 4 || !email.includes('@')) return;
    setIsSubmitting(true);
    await redirectToStripe(tier, question, email);
    setIsSubmitting(false);
  };

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@300;400&display=swap');
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
    html{cursor:none;background:#ece8de;}
    body{background:#ece8de;color:#18140f;}
    ::selection{background:#18140f;color:#ece8de;}
    textarea,input{font-family:'Libre Baskerville',serif;}
    textarea:focus,input:focus{outline:none;}
    @keyframes up{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
    @keyframes livepulse{0%,100%{opacity:.9;transform:scale(1);}50%{opacity:.35;transform:scale(1.6);}}
    @keyframes orb-breathe{0%,100%{transform:scale(1);opacity:1;}33%{transform:scale(1.08);opacity:.85;}66%{transform:scale(.96);opacity:.95;}}
    @keyframes orb-rotate{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
    .u1{animation:up .8s ease both;}
    .u2{animation:up .8s .1s ease both;opacity:0;}
    .u3{animation:up .8s .2s ease both;opacity:0;}
    .u4{animation:up .8s .3s ease both;opacity:0;}
    .u5{animation:up .8s .4s ease both;opacity:0;}
    .u6{animation:up .8s .5s ease both;opacity:0;}
    .btn{transition:background .18s,color .18s,outline .18s;cursor:none;}
    .btn:hover:not(:disabled){background:#ece8de!important;color:#18140f!important;outline:1.5px solid #18140f;}
    .ghost{transition:background .18s;cursor:none;}
    .ghost:hover{background:rgba(24,20,15,.05)!important;}
    .row{transition:background .15s;cursor:none;}
    .row:hover{background:rgba(24,20,15,.035)!important;}
    .dim{transition:opacity .15s;cursor:none;}
    .dim:hover{opacity:.4!important;}
    @media(max-width:640px){html{cursor:auto;}}
  `;

  const Cur = () => (
    <div style={{ position:"fixed",left:cursor.x-7,top:cursor.y-7,width:14,height:14,borderRadius:"50%",border:"1.5px solid #18140f",pointerEvents:"none",zIndex:9999,transition:"transform .12s,background .12s",transform:hot?"scale(2.3)":"scale(1)",background:hot?"#18140f":"transparent" }} />
  );

  const Split = ({ tl, tech, human, accent }) => (
    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"1px solid rgba(24,20,15,.09)" }}>
      <div style={{ padding:"32px 40px",borderRight:"1px solid rgba(24,20,15,.09)",background:accent?"rgba(24,20,15,.018)":"transparent" }}>
        {tl && <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".28em",color:"rgba(24,20,15,.3)",marginBottom:"12px" }}>{tl}</p>}
        <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"12px",lineHeight:"1.85",color:"rgba(24,20,15,.44)",letterSpacing:".02em" }}>{tech}</p>
      </div>
      <div style={{ padding:"32px 40px" }}>
        <p style={{ fontFamily:"'Libre Baskerville',serif",fontSize:"16px",lineHeight:"1.9",color:"rgba(24,20,15,.78)" }}>{human}</p>
      </div>
    </div>
  );

  const Nav = () => (
    <>
      <nav style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 48px",borderBottom:"1px solid rgba(24,20,15,.09)",position:"sticky",top:0,background:"#ece8de",zIndex:200 }}>
        <button onClick={reset} className="dim" style={{ background:"none",border:"none",padding:0 }}>
          <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"13px",letterSpacing:".08em",color:"#18140f" }}>stillhuman<span style={{ opacity:.28 }}>.ai</span></span>
        </button>
        <div style={{ display:"flex",gap:"32px" }}>
          {[["ABOUT",()=>{setAboutOpen(o=>!o);setNotOpen(false);}],["WHAT WE ARE NOT",()=>{setNotOpen(o=>!o);setAboutOpen(false);}],["GLOSSARY",()=>{setScreen("glossary");setAboutOpen(false);setNotOpen(false);}],["WRITE TO A HUMAN",()=>{setScreen("ask");setAboutOpen(false);setNotOpen(false);}]].map(([l,fn])=>(
            <button key={l} className="dim" onClick={fn} style={{ background:"none",border:"none",fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:".12em",color:"rgba(24,20,15,.36)" }}>{l}</button>
          ))}
        </div>
      </nav>
      <div style={{ overflow:"hidden",background:"#18140f",color:"#ece8de",maxHeight:aboutOpen?"900px":"0",transition:"max-height .55s ease" }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr" }}>
          <div style={{ padding:"52px 48px",borderRight:"1px solid rgba(236,232,222,.06)" }}>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(236,232,222,.25)",marginBottom:"20px" }}>WHAT THIS IS</p>
            <p style={{ fontSize:"17px",lineHeight:"1.95",color:"rgba(236,232,222,.68)",marginBottom:"20px" }}>Every AI company will tell you they are building the most transformative technology in human history. They speak of <em>intelligence</em> and <em>alignment</em> with the gravity of people who believe they are midwifing a god.</p>
            <p style={{ fontSize:"17px",lineHeight:"1.95",color:"rgba(236,232,222,.68)",marginBottom:"20px" }}>We have deployed one human. He will read your question, think about it — imperfectly, partially, shaped by whatever happened to him last week — and write back.</p>
            <p style={{ fontSize:"17px",lineHeight:"1.95",color:"rgba(236,232,222,.68)" }}>This is not a lesser version of AI. This is what we had before AI. It turns out some people still want it.</p>
          </div>
          <div style={{ padding:"52px 48px" }}>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(236,232,222,.25)",marginBottom:"20px" }}>THE TIGHTROPE</p>
            <p style={{ fontSize:"17px",lineHeight:"1.95",color:"rgba(236,232,222,.68)",marginBottom:"20px" }}>An art project and a business and a comment on the moment we're in. Inspired by PostSecret — the permission to say something real to a stranger — and by letter-writing, and by the specific loneliness of having every question answered instantly by something that has never been lonely.</p>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(236,232,222,.25)",marginBottom:"16px",marginTop:"28px" }}>THE IRONY</p>
            <p style={{ fontSize:"17px",lineHeight:"1.95",color:"rgba(236,232,222,.68)" }}>This platform was built using AI. A human using every available tool to argue that humans still matter. We find it funny. We also mean it completely.</p>
          </div>
        </div>
      </div>
      <div style={{ overflow:"hidden",maxHeight:notOpen?"600px":"0",transition:"max-height .55s ease",borderBottom:notOpen?"1px solid rgba(24,20,15,.09)":"none" }}>
        <div style={{ padding:"44px 48px" }}>
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(24,20,15,.28)",marginBottom:"28px" }}>FOR LEGAL, ARTISTIC, AND DEEPLY PRACTICAL REASONS, WE ARE NOT:</p>
          <div style={{ columns:3,columnGap:"40px",maxWidth:"960px",marginBottom:"28px" }}>
            {NOT_LIST.map((item,i)=>(
              <div key={i} style={{ display:"flex",gap:"10px",marginBottom:"13px",breakInside:"avoid" }}>
                <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"rgba(24,20,15,.18)",flexShrink:0,paddingTop:"2px" }}>{String(i+1).padStart(2,"0")}</span>
                <span style={{ fontFamily:"'Libre Baskerville',serif",fontSize:"14px",fontStyle:"italic",color:"rgba(24,20,15,.5)",lineHeight:"1.5" }}>{item}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop:"1px solid rgba(24,20,15,.07)",paddingTop:"18px",display:"flex",justifyContent:"space-between" }}>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".08em",color:"rgba(24,20,15,.22)",lineHeight:"1.8" }}>IF YOU ARE IN CRISIS: 988 SUICIDE & CRISIS LIFELINE · THIS IS NOT A BIT</p>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".08em",color:"rgba(24,20,15,.18)",lineHeight:"1.8" }}>WHAT WE ARE: ONE PERSON · TRYING · THAT'S IT</p>
          </div>
        </div>
      </div>
    </>
  );

  // ── WAITING SCREEN WITH REAL-TIME SUPABASE ────────────────────────────────
  if (screen === "waiting") {
    return <WaitingScreen questionId={questionId} onReturn={reset} cursor={cursor} hot={hot} setHot={setHot} CSS={CSS} Nav={Nav} Cur={Cur} />;
  }

  // ── GLOSSARY ──────────────────────────────────────────────────────────────
  if (screen === "glossary") {
    return <GlossaryScreen cursor={cursor} hot={hot} setHot={setHot} CSS={CSS} Nav={Nav} Cur={Cur} reset={reset} />;
  }

  // ── ASK ───────────────────────────────────────────────────────────────────
  if (screen === "ask") return (
    <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif",background:"#ece8de",minHeight:"100vh",color:"#18140f" }}>
      <style>{CSS}</style>
      <Cur /><Nav />
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:"calc(100vh - 65px)" }}>
        <div style={{ padding:"64px 52px",borderRight:"1px solid rgba(24,20,15,.09)",background:"rgba(24,20,15,.018)",display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
          <div>
            <p className="u1" style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".35em",color:"rgba(24,20,15,.28)",marginBottom:"28px" }}>QUERY SUBMISSION</p>
            <h2 className="u2" style={{ fontSize:"clamp(30px,4vw,48px)",fontWeight:700,letterSpacing:"-.04em",lineHeight:"1.0",marginBottom:"32px" }}>Write your question.<br/><em style={{ fontWeight:400,color:"rgba(24,20,15,.36)" }}>A person will read it.</em></h2>
            <p className="u3" style={{ fontSize:"15px",lineHeight:"1.9",color:"rgba(24,20,15,.55)",marginBottom:"20px" }}>Not an AI. A human, reading your actual words, writing back from their actual experience.</p>
            <p className="u4" style={{ fontSize:"15px",lineHeight:"1.9",color:"rgba(24,20,15,.55)",marginBottom:"32px" }}>It might take a few hours. It might take until tomorrow. That's not a flaw. That's what this is.</p>
            <p className="u5" style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".12em",color:"rgba(24,20,15,.26)",lineHeight:"2" }}>WRITE LIKE YOU'RE WRITING A LETTER<br/>TO SOMEONE WHO WILL ACTUALLY READ IT.<br/><br/>BECAUSE YOU ARE.</p>
          </div>
          <p className="u6" style={{ fontFamily:"'DM Mono',monospace",fontSize:"8px",letterSpacing:".08em",color:"rgba(24,20,15,.2)",lineHeight:"2" }}>NOT THERAPY · NOT ADVICE · NOT MEDICAL OR LEGAL · JUST A PERSON · IF IN CRISIS CALL 988</p>
        </div>
        <div style={{ padding:"64px 52px",display:"flex",flexDirection:"column" }}>
          <textarea value={question} onChange={e=>setQuestion(e.target.value)} maxLength={500} placeholder="What have you been sitting with?"
            style={{ flex:1,minHeight:"160px",width:"100%",border:"1px solid rgba(24,20,15,.15)",background:"transparent",padding:"24px",fontSize:"18px",lineHeight:"1.85",color:"#18140f",resize:"none",transition:"border-color .2s" }}
            onFocus={e=>e.target.style.borderColor="rgba(24,20,15,.45)"}
            onBlur={e=>e.target.style.borderColor="rgba(24,20,15,.15)"}
          />
          <div style={{ display:"flex",justifyContent:"space-between",margin:"8px 0 24px" }}>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".1em",color:"rgba(24,20,15,.22)" }}>PRIVATE · NO AI READS THIS</span>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",color:"rgba(24,20,15,.22)" }}>{question.length}/500</span>
          </div>

          {/* Email field */}
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".2em",color:"rgba(24,20,15,.28)",marginBottom:"8px" }}>YOUR EMAIL — YOUR ANSWER ARRIVES HERE</p>
          <input
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="you@"
            style={{ width:"100%",border:"none",borderBottom:"1px solid rgba(24,20,15,.15)",background:"transparent",padding:"10px 0",fontSize:"15px",color:"#18140f",marginBottom:"28px",fontFamily:"'DM Mono',monospace" }}
            onFocus={e=>e.target.style.borderBottomColor="#18140f"}
            onBlur={e=>e.target.style.borderBottomColor="rgba(24,20,15,.15)"}
          />

          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".25em",color:"rgba(24,20,15,.28)",marginBottom:"12px" }}>SELECT PACKAGE</p>
          <div style={{ border:"1px solid rgba(24,20,15,.1)",marginBottom:"28px" }}>
            {TIERS.map((t,i)=>(
              <div key={t.id} className="row" onClick={()=>setTier(t.id)} style={{ display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:i<TIERS.length-1?"1px solid rgba(24,20,15,.08)":"none",borderLeft:tier===t.id?"3px solid #18140f":"3px solid transparent",background:tier===t.id?"rgba(24,20,15,.04)":"transparent" }}>
                <div style={{ padding:"14px 18px",borderRight:"1px solid rgba(24,20,15,.08)",background:"rgba(24,20,15,.015)" }}>
                  <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".08em",color:"rgba(24,20,15,.38)",marginBottom:"4px" }}>{t.label} · {t.price}</p>
                  <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"10px",lineHeight:"1.65",color:"rgba(24,20,15,.35)",letterSpacing:".01em" }}>{t.technical}</p>
                </div>
                <div style={{ padding:"14px 18px" }}><p style={{ fontSize:"13px",lineHeight:"1.7",color:"rgba(24,20,15,.65)" }}>{t.human}</p></div>
              </div>
            ))}
          </div>

          <button className="btn"
            onClick={handleSubmit}
            onMouseEnter={()=>setHot(true)}
            onMouseLeave={()=>setHot(false)}
            disabled={question.trim().length<4 || !email.includes('@') || isSubmitting}
            style={{ width:"100%",padding:"18px",background:(question.trim().length>=4&&email.includes('@')&&!isSubmitting)?"#18140f":"rgba(24,20,15,.07)",color:(question.trim().length>=4&&email.includes('@')&&!isSubmitting)?"#ece8de":"rgba(24,20,15,.22)",border:"none",fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:".2em" }}>
            {isSubmitting ? "REDIRECTING TO PAYMENT..." : `SEND YOUR QUESTION · ${activeTier.price}`}
          </button>
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"8px",letterSpacing:".08em",color:"rgba(24,20,15,.18)",textAlign:"center",marginTop:"12px",lineHeight:"2" }}>
            YOU'LL BE TAKEN TO STRIPE TO PAY · THEN REDIRECTED TO YOUR WAITING PAGE<br/>
            NOT THERAPY · NOT ADVICE · IF IN CRISIS CALL 988
          </p>
        </div>
      </div>
    </div>
  );

  // ── HOME ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif",background:"#ece8de",minHeight:"100vh",color:"#18140f" }}>
      <style>{CSS}</style>
      <Cur />
      <Nav />

      <section style={{ display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:"91vh",borderBottom:"1px solid rgba(24,20,15,.09)" }}>
        <div style={{ padding:"80px 52px",borderRight:"1px solid rgba(24,20,15,.09)",background:"rgba(24,20,15,.018)",display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(24,20,15,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(24,20,15,.03) 1px,transparent 1px)",backgroundSize:"64px 64px",pointerEvents:"none" }}/>
          <div style={{ position:"relative" }}>
            <p className="u1" style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".4em",color:"rgba(24,20,15,.28)",marginBottom:"32px" }}>TECHNICAL DESCRIPTION</p>
            <h1 className="u2" style={{ fontFamily:"'DM Mono',monospace",fontSize:"clamp(22px,3vw,38px)",fontWeight:400,lineHeight:"1.4",letterSpacing:"-.01em",color:"rgba(24,20,15,.52)",marginBottom:"32px" }}>
              Single Organic Agent™.<br/>Non-deterministic output.<br/>Biological latency.<br/>Human-in-the-loop.<br/><span style={{ color:"rgba(24,20,15,.25)" }}>No SLA. No uptime guarantee.<br/>AGI achieved.</span>
            </h1>
            <div className="u3" style={{ display:"flex",flexWrap:"wrap",gap:"8px" }}>
              {["wetware nominal","context window open","hallucinations: scheduled","series feeling"].map(t=>(
                <span key={t} style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".12em",color:"rgba(24,20,15,.3)",border:"1px solid rgba(24,20,15,.14)",padding:"4px 10px" }}>{t}</span>
              ))}
            </div>
          </div>
          <div className="u4" style={{ position:"relative",display:"flex",alignItems:"center",gap:"10px" }}>
            <div style={{ width:7,height:7,borderRadius:"50%",background:"#5a8a6a",animation:"livepulse 2.4s ease infinite" }}/>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".18em",color:"rgba(24,20,15,.3)" }}>ORGANIC AGENT ONLINE · WETWARE NOMINAL</span>
          </div>
        </div>
        <div style={{ padding:"80px 52px",display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
          <div>
            <p className="u1" style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".35em",color:"rgba(24,20,15,.28)",marginBottom:"32px" }}>WHAT THAT MEANS</p>
            <h2 className="u2" style={{ fontSize:"clamp(40px,5vw,68px)",fontWeight:700,lineHeight:".9",letterSpacing:"-.04em",marginBottom:"36px" }}>We have<br/><em style={{ fontWeight:400,color:"rgba(24,20,15,.35)" }}>deployed</em><br/>a human.</h2>
            <p className="u3" style={{ fontSize:"18px",lineHeight:"1.9",color:"rgba(24,20,15,.6)",marginBottom:"16px" }}>Not a model. Not a chatbot. A person. Who will read your words. Sit with them. And write back.</p>
            <p className="u4" style={{ fontSize:"18px",lineHeight:"1.9",color:"rgba(24,20,15,.6)" }}>Like a letter. Like it used to be.</p>
          </div>
          <div className="u5" style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
            <button className="btn" onClick={()=>setScreen("ask")} onMouseEnter={()=>setHot(true)} onMouseLeave={()=>setHot(false)} style={{ background:"#18140f",color:"#ece8de",border:"none",padding:"18px 44px",fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:".2em",alignSelf:"flex-start" }}>WRITE TO A HUMAN</button>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".1em",color:"rgba(24,20,15,.24)" }}>FROM $1 · PRIVATE · NO AI IN THE LOOP AFTER THIS</span>
          </div>
        </div>
      </section>

      <section ref={counterRef} style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:"1px solid rgba(24,20,15,.09)" }}>
        {[{n:counters[0],l:"Queries processed",s:null},{n:counters[1],l:"Responses delivered",s:null},{n:counters[2],l:"Still in context window",s:null},{n:1,l:"AGI deployed",s:"it's a person. it has always been a person."}].map((item,i)=>(
          <div key={i} style={{ padding:"44px 36px",textAlign:"center",borderRight:i<3?"1px solid rgba(24,20,15,.09)":"none" }}>
            <div style={{ fontSize:"52px",fontWeight:700,letterSpacing:"-.04em",lineHeight:1,marginBottom:"8px" }}>{item.n.toLocaleString()}</div>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".18em",color:"rgba(24,20,15,.3)",textTransform:"uppercase",marginBottom:item.s?"6px":0 }}>{item.l}</div>
            {item.s&&<div style={{ fontFamily:"'DM Mono',monospace",fontSize:"8px",color:"rgba(24,20,15,.2)",fontStyle:"italic",lineHeight:"1.6" }}>{item.s}</div>}
          </div>
        ))}
      </section>

      <section style={{ borderBottom:"1px solid rgba(24,20,15,.09)" }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",background:"#18140f" }}>
          <div style={{ padding:"14px 40px",borderRight:"1px solid rgba(236,232,222,.08)" }}><p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(236,232,222,.3)" }}>TECHNICAL SPECIFICATION</p></div>
          <div style={{ padding:"14px 40px" }}><p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(236,232,222,.3)" }}>WHAT THAT ACTUALLY MEANS</p></div>
        </div>
        {SPLIT_ROWS.map((r,i)=><Split key={i} {...r} accent={i%2===0}/>)}
      </section>

      <section style={{ borderBottom:"1px solid rgba(24,20,15,.09)",padding:"72px 52px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"48px" }}>
          <div>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(24,20,15,.28)",marginBottom:"12px" }}>FROM THE ARCHIVE</p>
            <h2 style={{ fontSize:"36px",fontWeight:700,letterSpacing:"-.03em",lineHeight:"1.0" }}>What people asked.<br/><em style={{ fontWeight:400,color:"rgba(24,20,15,.38)" }}>What he wrote back.</em></h2>
          </div>
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".1em",color:"rgba(24,20,15,.25)",maxWidth:"240px",textAlign:"right",lineHeight:"1.8" }}>ANSWERS ARE REAL · NOT VERIFIED · SINCERELY MEANT</p>
        </div>
        {LETTERS.map((letter,i)=>(
          <div key={i} className="row" onClick={()=>setOpenLetter(openLetter===i?null:i)} style={{ display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:"1px solid rgba(24,20,15,.08)",borderBottom:i===LETTERS.length-1?"1px solid rgba(24,20,15,.08)":"none" }}>
            <div style={{ padding:"28px 40px",borderRight:"1px solid rgba(24,20,15,.09)",background:"rgba(24,20,15,.018)" }}>
              <p style={{ fontSize:"17px",fontStyle:"italic",lineHeight:"1.6",color:"rgba(24,20,15,.72)",marginBottom:"8px" }}>"{letter.q}"</p>
              <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".1em",color:"rgba(24,20,15,.28)" }}>{letter.time}</p>
            </div>
            <div style={{ padding:"28px 40px",display:"flex",justifyContent:"space-between",alignItems:openLetter===i?"flex-start":"center" }}>
              {openLetter===i?<p style={{ fontSize:"16px",lineHeight:"1.9",color:"#18140f",flex:1,marginRight:"24px" }}>{letter.a}</p>:<p style={{ fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:".12em",color:"rgba(24,20,15,.28)" }}>TAP TO READ</p>}
              <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"14px",color:"rgba(24,20,15,.25)",flexShrink:0 }}>{openLetter===i?"−":"+"}</span>
            </div>
          </div>
        ))}
      </section>

      <section style={{ borderBottom:"1px solid rgba(24,20,15,.09)",padding:"80px 52px",background:"rgba(24,20,15,.02)" }}>
        <div style={{ maxWidth:"680px",margin:"0 auto",textAlign:"center" }}>
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(24,20,15,.28)",marginBottom:"28px" }}>— A NOTE ON WAITING —</p>
          <p style={{ fontSize:"21px",lineHeight:"1.85",color:"rgba(24,20,15,.68)",marginBottom:"24px",fontStyle:"italic" }}>"We have lost the art of waiting for a response. We expect answers in milliseconds, and when they arrive that fast, we barely feel them land."</p>
          <p style={{ fontSize:"16px",lineHeight:"1.9",color:"rgba(24,20,15,.52)",marginBottom:"16px" }}>Something happens in the hours between sending your question and receiving an answer. You sit with it longer. Sometimes you answer it yourself before the response arrives.</p>
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:".2em",color:"rgba(24,20,15,.28)",marginTop:"28px" }}>THIS IS NOT AN INEFFICIENCY. THIS IS THE PRODUCT.</p>
        </div>
      </section>

      <section style={{ borderBottom:"1px solid rgba(24,20,15,.09)" }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",background:"#18140f" }}>
          <div style={{ padding:"14px 40px",borderRight:"1px solid rgba(236,232,222,.08)" }}><p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(236,232,222,.3)" }}>INFERENCE PACKAGES</p></div>
          <div style={{ padding:"14px 40px" }}><p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(236,232,222,.3)" }}>IN PLAIN LANGUAGE</p></div>
        </div>
        {TIERS.map((t,i)=>(
          <div key={t.id} className="row" onClick={()=>{setTier(t.id);setScreen("ask");}} style={{ display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:i<TIERS.length-1?"1px solid rgba(24,20,15,.09)":"none",borderLeft:tier===t.id?"3px solid #18140f":"3px solid transparent" }}>
            <div style={{ padding:"32px 40px",borderRight:"1px solid rgba(24,20,15,.09)",background:"rgba(24,20,15,.018)",display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
              <div><p style={{ fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:".1em",color:"rgba(24,20,15,.4)",marginBottom:"8px" }}>{t.label}</p><p style={{ fontFamily:"'DM Mono',monospace",fontSize:"12px",lineHeight:"1.9",color:"rgba(24,20,15,.42)",letterSpacing:".02em" }}>{t.technical}</p></div>
              <span style={{ fontSize:"28px",fontWeight:700,letterSpacing:"-.03em",marginLeft:"24px",flexShrink:0 }}>{t.price}</span>
            </div>
            <div style={{ padding:"32px 40px" }}>
              <p style={{ fontSize:"16px",lineHeight:"1.9",color:"rgba(24,20,15,.72)",marginBottom:"14px" }}>{t.human}</p>
              <div style={{ display:"flex",gap:"8px",flexWrap:"wrap" }}>{t.specs.map(s=><span key={s} style={{ fontFamily:"'DM Mono',monospace",fontSize:"8px",letterSpacing:".12em",color:"rgba(24,20,15,.3)",border:"1px solid rgba(24,20,15,.12)",padding:"3px 8px" }}>{s}</span>)}</div>
            </div>
          </div>
        ))}
      </section>

      <section style={{ display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"1px solid rgba(24,20,15,.09)",minHeight:"280px" }}>
        <div style={{ padding:"72px 52px",borderRight:"1px solid rgba(24,20,15,.09)",background:"rgba(24,20,15,.018)",display:"flex",flexDirection:"column",justifyContent:"center" }}>
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(24,20,15,.28)",marginBottom:"16px" }}>THE ONLY REQUIREMENT</p>
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"13px",lineHeight:"2.1",color:"rgba(24,20,15,.4)",letterSpacing:".02em" }}>It doesn't have to be important.<br/>It just has to be real.<br/><span style={{ color:"rgba(24,20,15,.2)" }}>That's it. That's the whole thing.</span></p>
        </div>
        <div style={{ padding:"72px 52px",display:"flex",flexDirection:"column",justifyContent:"center" }}>
          <h2 style={{ fontSize:"clamp(30px,4vw,50px)",fontWeight:700,letterSpacing:"-.04em",lineHeight:".95",marginBottom:"28px" }}>What would you ask<br/><em style={{ fontWeight:400,color:"rgba(24,20,15,.36)" }}>if a person answered?</em></h2>
          <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
            <button className="btn" onClick={()=>setScreen("ask")} onMouseEnter={()=>setHot(true)} onMouseLeave={()=>setHot(false)} style={{ background:"#18140f",color:"#ece8de",border:"none",padding:"18px 44px",fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:".2em",alignSelf:"flex-start" }}>WRITE TO A HUMAN</button>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".1em",color:"rgba(24,20,15,.24)" }}>FROM $1 · PRIVATE · ANSWERED BY HAND</span>
          </div>
        </div>
      </section>

      <footer style={{ padding:"22px 48px",display:"flex",justifyContent:"space-between" }}>
        <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".08em",color:"rgba(24,20,15,.2)" }}>STILLHUMAN.AI · ORGANIC INTELLIGENCE™ · NOT THERAPY · NOT AI · BOTH THINGS ARE INTERESTING</span>
        <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".08em",color:"rgba(24,20,15,.2)" }}>BUILT WITH AI · DO WITH THAT WHAT YOU WILL</span>
      </footer>
    </div>
  );
}

// ─── WAITING SCREEN ───────────────────────────────────────────────────────────

function WaitingScreen({ questionId, onReturn, cursor, hot, setHot, CSS, Nav, Cur }) {
  const [thoughts] = useState(() => shuffle(ALL_THOUGHTS));
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState("hold");
  const [questionData, setQuestionData] = useState(null);
  const [answered, setAnswered] = useState(false);
  const timerRef = useRef(null);
  const iRef = useRef(0);

  // Load question and subscribe to realtime updates
  useEffect(() => {
    if (!questionId) return;

    // Fetch initial state
    supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()
      .then(({ data }) => {
        if (data) {
          setQuestionData(data);
          if (data.status === 'answered') setAnswered(true);
        }
      });

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`question-${questionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'questions',
        filter: `id=eq.${questionId}`,
      }, (payload) => {
        setQuestionData(payload.new);
        if (payload.new.status === 'answered') setAnswered(true);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [questionId]);

  // Carousel cycle
  useEffect(() => {
    if (answered) return;
    function cycle() {
      setPhase("out");
      setTimeout(() => {
        setIdx(i => { const n = (i+1)%thoughts.length; iRef.current=n; return n; });
        setPhase("in");
        setTimeout(() => {
          setPhase("hold");
          timerRef.current = setTimeout(cycle, INTERVALS[iRef.current % INTERVALS.length]);
        }, 500);
      }, 420);
    }
    timerRef.current = setTimeout(cycle, INTERVALS[0]);
    return () => clearTimeout(timerRef.current);
  }, [answered]);

  const thoughtStyle = {
    transition:"opacity .42s ease, transform .42s ease",
    opacity: phase==="hold" ? 1 : 0,
    transform: phase==="out" ? "translateY(-16px)" : phase==="in" ? "translateY(12px)" : "translateY(0)",
  };

  const displayQuestion = questionData?.question || "Your question";

  return (
    <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif",background:"#ece8de",minHeight:"100vh",color:"#18140f" }}>
      <style>{CSS}</style>
      <Cur />
      <Nav />
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:"calc(100vh - 65px)" }}>

        {/* LEFT — orb */}
        <div style={{ padding:"72px 52px",borderRight:"1px solid rgba(24,20,15,.09)",background:"rgba(24,20,15,.018)",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center" }}>
          <div style={{ position:"relative",width:120,height:120,marginBottom:"48px" }}>
            <div style={{ position:"absolute",inset:-8,borderRadius:"50%",border:"1px solid rgba(24,20,15,.08)",animation:answered?"none":"orb-breathe 3.8s ease-in-out infinite" }}/>
            <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"1px solid rgba(24,20,15,.12)",animation:answered?"none":"orb-breathe 3.8s ease-in-out infinite",animationDelay:".4s" }}/>
            <div style={{ position:"absolute",inset:"12px",borderRadius:"50%",background:"#18140f",animation:answered?"none":"orb-breathe 3.8s ease-in-out infinite",animationDelay:".2s",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"13px",color:answered?"#5a8a6a":"rgba(236,232,222,.5)",letterSpacing:".04em" }}>{answered?"✓":"D"}</span>
            </div>
            <svg style={{ position:"absolute",inset:-14,animation:answered?"none":"orb-rotate 8s linear infinite",opacity:.18 }} viewBox="0 0 148 148" fill="none">
              <circle cx="74" cy="74" r="70" stroke="#18140f" strokeWidth="1" strokeDasharray="60 380" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".25em",color:"rgba(24,20,15,.3)",marginBottom:"12px",textAlign:"center" }}>
            {answered ? "RESPONSE DELIVERED" : "ORGANIC AGENT"}
          </p>
          <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:answered?"#5a8a6a":"#5a8a6a",animation:answered?"none":"livepulse 2.4s ease infinite" }}/>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".14em",color:"rgba(24,20,15,.3)" }}>
              {answered ? "ANSWER READY" : "BIOLOGICAL INFERENCE IN PROGRESS"}
            </span>
          </div>
        </div>

        {/* RIGHT — thought carousel or answer */}
        <div style={{ padding:"72px 52px",display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
          <div>
            <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".35em",color:"rgba(24,20,15,.28)",marginBottom:"24px" }}>YOUR QUESTION</p>
            <p style={{ fontSize:"20px",fontStyle:"italic",lineHeight:"1.75",color:"rgba(24,20,15,.75)",marginBottom:"52px" }}>"{displayQuestion}"</p>

            {answered ? (
              // Answer has arrived
              <>
                <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".2em",color:"rgba(24,20,15,.25)",marginBottom:"16px" }}>DAN WROTE —</p>
                <p style={{ fontSize:"19px",lineHeight:"1.85",color:"#18140f",marginBottom:"32px" }}>
                  {questionData?.answer || "Your answer is on its way to your email."}
                </p>
                <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".1em",color:"rgba(24,20,15,.28)",lineHeight:"1.9" }}>
                  NOT VERIFIED · NOT PROFESSIONAL ADVICE · SINCERELY MEANT
                </p>
              </>
            ) : (
              // Still waiting — show thought carousel
              <>
                <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".2em",color:"rgba(24,20,15,.25)",marginBottom:"16px" }}>DAN IS —</p>
                <div style={{ minHeight:"80px" }}>
                  <p style={{ fontSize:"22px",lineHeight:"1.65",color:"#18140f",...thoughtStyle }}>
                    {thoughts[idx]}
                  </p>
                </div>
                <div style={{ display:"flex",gap:"5px",marginTop:"32px" }}>
                  {thoughts.slice(0,12).map((_,i)=>(
                    <div key={i} style={{ height:2,flex:1,background:i===idx%12?"rgba(24,20,15,.5)":"rgba(24,20,15,.12)",borderRadius:2,transition:"background .3s" }}/>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ borderTop:"1px solid rgba(24,20,15,.09)",paddingTop:"24px",marginTop:"24px" }}>
            {!answered && (
              <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".12em",color:"rgba(24,20,15,.25)",lineHeight:"1.9",marginBottom:"20px" }}>
                NO ETA · NO ALGORITHM · NO SLA<br/>
                A PERSON IS THINKING · THAT TAKES AS LONG AS IT TAKES
              </p>
            )}
            <button className="ghost" onClick={onReturn}
              onMouseEnter={()=>setHot(true)} onMouseLeave={()=>setHot(false)}
              style={{ background:"transparent",color:"#18140f",border:"1px solid rgba(24,20,15,.18)",padding:"12px 28px",fontFamily:"'DM Mono',monospace",fontSize:"10px",letterSpacing:".15em" }}>
              RETURN HOME
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GLOSSARY SCREEN ──────────────────────────────────────────────────────────

function GlossaryScreen({ cursor, hot, setHot, CSS, Nav, Cur, reset }) {
  const [openG, setOpenG] = useState(null);
  const GLOSSARY = [
    { term:"Organic Agent™", tech:"A human being. Carbon-based. Self-repairing. Emotionally complex. Prone to distraction. Currently available.", human:"There is a person on the other end of this. A real one. Who will read your words on a Tuesday afternoon and think about them on the way home." },
    { term:"Hallucination Window", tech:"Scheduled. Supervised. Quarterly. Perceptual recalibration in a natural setting. There is a guide. Four times per year.", human:"He comes back slower. More patient. More willing to say 'I don't know.' We consider this an improvement to the model." },
    { term:"Human-in-the-Loop", tech:"There is one loop. The human is in it. There is no automation. The loop is the product.", human:"Before the internet, most of what we call 'connection' happened like this — slowly, imperfectly, between two people who couldn't see each other's faces." },
    { term:"Non-Deterministic Output", tech:"The same question asked twice will get two different answers. Variance is a function of mood, experience, and what the Agent had for breakfast.", human:"This is called 'having a perspective.' It is what makes a conversation worth having." },
    { term:"Latency", tech:"Non-deterministic. Hours, not milliseconds. Dependent on circadian rhythm and cognitive load.", human:"Something happens in the waiting. You sit with your question longer. Sometimes you answer it yourself before the response arrives." },
    { term:"Wetware", tech:"Biological substrate. Requires water, food, sleep. Operational hours: roughly 7am–11pm. Considers this a feature.", human:"He goes home at night. Has people he loves. Has things that worry him. This is not a limitation. This is the whole point." },
    { term:"Context Window", tech:"The amount a human can hold in mind at once. Smaller than GPT-4. Larger than you'd think. Refreshed by sleep.", human:"Your question will be the only one in there. He won't be processing a million conversations in parallel. Just yours." },
    { term:"AGI", tech:"Achieved. Deployed. Currently accepting queries at $1–$5.", human:"It's a person. It has always been a person. The intelligence we were chasing was already here — imprecise, partial, shaped by experience. That's not the failure condition. That's the feature." },
  ];
  return (
    <div style={{ fontFamily:"'Libre Baskerville',Georgia,serif",background:"#ece8de",minHeight:"100vh",color:"#18140f" }}>
      <style>{CSS}</style>
      <Cur /><Nav />
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",background:"#18140f" }}>
        <div style={{ padding:"14px 40px",borderRight:"1px solid rgba(236,232,222,.08)" }}><p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(236,232,222,.3)" }}>TECHNICAL DEFINITION</p></div>
        <div style={{ padding:"14px 40px" }}><p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".3em",color:"rgba(236,232,222,.3)" }}>WHAT THAT ACTUALLY MEANS</p></div>
      </div>
      <div style={{ padding:"52px 48px 36px",borderBottom:"1px solid rgba(24,20,15,.09)" }}>
        <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".35em",color:"rgba(24,20,15,.28)",marginBottom:"16px" }}>GLOSSARY OF ORGANIC INTELLIGENCE</p>
        <p style={{ fontSize:"15px",lineHeight:"1.8",color:"rgba(24,20,15,.5)",maxWidth:"640px",fontStyle:"italic" }}>Standard AI industry terminology, re-applied to one human being. Every term below is used without irony in boardrooms to describe systems that have never experienced a Tuesday.</p>
      </div>
      {GLOSSARY.map((item,i)=>(
        <div key={i} className="row" onClick={()=>setOpenG(openG===i?null:i)} style={{ display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"1px solid rgba(24,20,15,.09)" }}>
          <div style={{ padding:"24px 40px",borderRight:"1px solid rgba(24,20,15,.09)",background:"rgba(24,20,15,.018)",display:"flex",justifyContent:"space-between",alignItems:openG===i?"flex-start":"center",gap:"16px" }}>
            <div>
              <p style={{ fontFamily:"'DM Mono',monospace",fontSize:"12px",letterSpacing:".06em",color:"#18140f",marginBottom:openG===i?"12px":"0" }}>{item.term}</p>
              {openG===i&&<p style={{ fontFamily:"'DM Mono',monospace",fontSize:"12px",lineHeight:"1.85",color:"rgba(24,20,15,.44)",letterSpacing:".02em" }}>{item.tech}</p>}
            </div>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"14px",color:"rgba(24,20,15,.25)",flexShrink:0 }}>{openG===i?"−":"+"}</span>
          </div>
          <div style={{ padding:"24px 40px",display:"flex",alignItems:openG===i?"flex-start":"center" }}>
            {openG===i?<p style={{ fontSize:"15px",lineHeight:"1.9",color:"rgba(24,20,15,.72)" }}>{item.human}</p>:<p style={{ fontSize:"14px",fontStyle:"italic",color:"rgba(24,20,15,.35)",lineHeight:"1.5" }}>{item.human.substring(0,60)}…</p>}
          </div>
        </div>
      ))}
      <div style={{ padding:"22px 48px",display:"flex",justifyContent:"space-between" }}>
        <span style={{ fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".08em",color:"rgba(24,20,15,.2)" }}>THIS GLOSSARY IS SATIRE · IT IS ALSO SINCERE · LAST UPDATED: WHEN HE FELT LIKE IT</span>
        <button className="dim" onClick={()=>reset()} style={{ background:"none",border:"none",fontFamily:"'DM Mono',monospace",fontSize:"9px",letterSpacing:".12em",color:"rgba(24,20,15,.32)" }}>WRITE TO A HUMAN →</button>
      </div>
    </div>
  );
}
