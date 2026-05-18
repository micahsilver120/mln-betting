import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

//  Font injection 
if (typeof document !== "undefined" && !document.getElementById("mln-fonts")) {
  const link = document.createElement("link");
  const fontBase = "https://fonts.googleapis.com/css2";
  const fontQuery = "?family=Barlow+Condensed:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap";
  link.id = "mln-fonts";
  link.rel = "stylesheet";
  link.href = fontBase + fontQuery;
  document.head.appendChild(link);
}

//  Firebase Config 
const firebaseConfig = {
  apiKey: "AIzaSyClIKmR4FTthxNXtYJZS8Ef6U6RvcvBKGg",
  authDomain: "mln-betting.firebaseapp.com",
  databaseURL: "https://mln-betting-default-rtdb.firebaseio.com",
  projectId: "mln-betting",
  storageBucket: "mln-betting.firebasestorage.app",
  messagingSenderId: "444211874873",
  appId: "1:444211874873:web:599bcdeb815bbcd04d91e8",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

//  Data 

const INITIAL_MARKETS = {
  games: [
    { id: "lsf1", type: "game", title: "Aruba Sea Serpents vs Humongous Melonheads", subtitle: "Lunar League - Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "lsf1_ss", label: "Aruba Sea Serpents", odds: -225 }, { id: "lsf1_mel", label: "Humongous Melonheads", odds: +180 }] },
    { id: "lsf2", type: "game", title: "Raccoon City Outbreak vs Sopher McDophers", subtitle: "Lunar League - Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "lsf2_out", label: "Raccoon City Outbreak", odds: -110 }, { id: "lsf2_mcd", label: "Sopher McDophers", odds: -111 }] },
    { id: "gsf1", type: "game", title: "Gas House Gorillas vs Sunnydale Slayers", subtitle: "Galactic League - Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "gsf1_gor", label: "Gas House Gorillas", odds: -200 }, { id: "gsf1_sla", label: "Sunnydale Slayers", odds: +161 }] },
    { id: "gsf2", type: "game", title: "Ursa Major Grizzlies vs R'lyeh Ancients", subtitle: "Galactic League - Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "gsf2_gri", label: "Ursa Major Grizzlies", odds: -101 }, { id: "gsf2_anc", label: "R'lyeh Ancients", odds: -121 }] },
  ],
  futures: [
    { id: "lunar_champ", type: "future", title: "Lunar League Champion", subtitle: "Season Future", status: "open", winner: null, maxBet: null,
      options: [{ id: "lc_ss", label: "Aruba Sea Serpents", odds: +165 }, { id: "lc_mcd", label: "Sopher McDophers", odds: +273 }, { id: "lc_out", label: "Raccoon City Outbreak", odds: +274 }, { id: "lc_mel", label: "Humongous Melonheads", odds: +631 }] },
    { id: "galactic_champ", type: "future", title: "Galactic League Champion", subtitle: "Season Future", status: "open", winner: null, maxBet: null,
      options: [{ id: "gc_gor", label: "Gas House Gorillas", odds: +178 }, { id: "gc_anc", label: "R'lyeh Ancients", odds: +251 }, { id: "gc_gri", label: "Ursa Major Grizzlies", odds: +298 }, { id: "gc_sla", label: "Sunnydale Slayers", odds: +549 }] },
    { id: "toos", type: "future", title: "ToOS Winner", subtitle: "Championship Future", status: "open", winner: null, maxBet: null,
      options: [{ id: "toos_ss", label: "Aruba Sea Serpents", odds: +340 }, { id: "toos_gor", label: "Gas House Gorillas", odds: +476 }, { id: "toos_mcd", label: "Sopher McDophers", odds: +571 }, { id: "toos_out", label: "Raccoon City Outbreak", odds: +573 }, { id: "toos_anc", label: "R'lyeh Ancients", odds: +674 }, { id: "toos_gri", label: "Ursa Major Grizzlies", odds: +820 }, { id: "toos_mel", label: "Humongous Melonheads", odds: +1570 }, { id: "toos_sla", label: "Sunnydale Slayers", odds: +1753 }] },
  ],
};

const STARTING_BALANCE = 1000;
const ADMIN_PIN = "543211";

//  Banned words 
const BANNED_WORDS = [
  "fuck","shit","ass","bitch","cunt","dick","cock","pussy","prick","bastard",
  "asshole","motherfucker","fucker","bullshit","horseshit","jackass","dumbass",
  "fatass","smartass","badass","arsehole","arse","twat","slut","whore","fag",
  "faggot","retard","nigger","nigga","spic","chink","kike","wetback","tranny",
  "dyke","tits","titties","boobs","boob","nipple","penis","vagina","vulva",
  "balls","testicle","scrotum","boner","erection","dildo","butthole","anus",
  "rectum","cum","jizz","sperm","pubic","nutsack","wank","wanker","tosser",
  "piss","pissed","poop","crap","turd","douchebag","douche","twatwaffle",
  "shithead","dipshit","goddamn","goddammit","damnit","hell","damned",
];

function containsBannedWord(str) {
  const normalized = str.toLowerCase().replace(/[^a-z]/g, "");
  return BANNED_WORDS.some(w => normalized.includes(w));
}

// Case-insensitive user lookup  finds the canonical stored key for any casing
function findUserKey(users, inputName) {
  const lower = inputName.trim().toLowerCase();
  return Object.keys(users).find(k => k.toLowerCase() === lower) || null;
}

//  Helpers 

const fmt = o => o > 0 ? `+${o}` : `${o}`;
const toDecimal = o => o > 0 ? o / 100 + 1 : 100 / Math.abs(o) + 1;
const toWin = (stake, odds) => odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds);
const calcPayout = (stake, odds) => stake + toWin(stake, odds);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtTime = ts => {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " - " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
function combinedAmericanOdds(legs) {
  const dec = legs.reduce((acc, l) => acc * toDecimal(l.odds), 1);
  return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
}
function leagueMeta(subtitle = "") {
  if (subtitle.toLowerCase().includes("lunar")) return { tag: "LUNAR", color: "#3b82f6", bg: "rgba(88,166,255,0.08)" };
  if (subtitle.toLowerCase().includes("galactic")) return { tag: "GALACTIC", color: "#8b5cf6", bg: "rgba(188,140,255,0.08)" };
  if (subtitle.toLowerCase().includes("toos") || subtitle.toLowerCase().includes("championship")) return { tag: "ToOS", color: "#6366f1", bg: "rgba(212,168,67,0.08)" };
  return { tag: "FUTURE", color: "#94a3b8", bg: "transparent" };
}

//  Storage 

function parseFirebase(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return val; } }
  if (typeof val === "object" && !Array.isArray(val)) {
    const keys = Object.keys(val);
    const isArray = keys.length > 0 && keys.every(k => !isNaN(k));
    return isArray ? keys.map(k => val[k]) : val;
  }
  return val;
}
async function storageGet(key) {
  try { const snap = await get(ref(db, key)); return snap.exists() ? parseFirebase(snap.val()) : null; } catch { return null; }
}
async function storageSet(key, value) {
  try { await set(ref(db, key), JSON.stringify(value)); } catch {}
}

//  PIN Pad 

function PinPad({ value, onChange, label, sublabel, error }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","\u232B"];
  function press(k) {
    if (k === "\u232B") { onChange(value.slice(0, -1)); return; }
    if (k === "" || value.length >= 4) return;
    onChange(value + k);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: 14.0, color: "#64748b", textAlign: "center" }}>{label}</p>
        {sublabel && <p style={{ margin: 0, fontSize: 12.0, color: "#94a3b8", textAlign: "center" }}>{sublabel}</p>}
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i < value.length ? "#6366f1" : "transparent", border: `2px solid ${i < value.length ? "#6366f1" : error ? "#ef4444" : "#e2e8f0"}`, transition: "all 0.15s" }} />
        ))}
      </div>
      {error && <p style={{ margin: "-10px 0 -6px", fontSize: 12.0, color: "#ef4444", textAlign: "center" }}>{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: 200 }}>
        {keys.map((k, i) => (
          <button key={i} onClick={() => press(k)} style={{ height: 54, background: k === "" ? "transparent" : "#ffffff", border: k === "" ? "none" : "1px solid #e2e8f0", borderRadius: 12, color: k === "\u232B" ? "#94a3b8" : "#1e293b", fontSize: k === "\u232B" ? 18 : 20, fontWeight: 600, cursor: k === "" ? "default" : "pointer", fontFamily: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", pointerEvents: k === "" ? "none" : "auto" }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Icon constants (avoids multi-byte unicode in JSX text) ──
const I = {
  baseball:  "\u26BE",
  trophy:    "\uD83C\uDFC6",
  stadium:   "\uD83C\uDFDF\uFE0F",
  crystal:   "\uD83D\uDD2E",
  medal:     "\uD83C\uDF96\uFE0F",
  check:     "\u2713",
  cross:     "\u2717",
  pending:   "\u23F3",
  pause:     "\u23F8",
  play:      "\u25B6",
  undo:      "\u21BA",
  dollar:    "$",
  bullet:    "\u00B7",
  arrow:     "\u2192",
  fire:      "\uD83D\uDD25",
};

// ── App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Persistent state from Firebase ─────────
  const [users, setUsers] = useState({});
  const [markets, setMarkets] = useState({ games: [], futures: [] });
  const [bets, setBets] = useState([]);
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);
  const [headerMsg, setHeaderMsg] = useState("");
  const [siteMaxBet, setSiteMaxBet] = useState(null);

  // ── Session state ─────────
  const [screen, setScreen] = useState("login"); // login | lobby | admin
  const [username, setUsername] = useState("");
  const [loginStep, setLoginStep] = useState("name"); // name | pin_login | pin_create | pin_confirm
  const [inputName, setInputName] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingPin, setPendingPin] = useState("");
  const [notification, setNotification] = useState("");

  // ── Lobby state ─────────
  const [activeTab, setActiveTab] = useState("games");
  const [gamesFilter, setGamesFilter] = useState("open"); // open | resolved
  const [betSlip, setBetSlip] = useState({});
  const [parlayStake, setParlayStake] = useState("");

  // ── Admin state ─────────
  const [adminPin, setAdminPin] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminTab, setAdminTab] = useState("settle");
  const [revealPin, setRevealPin] = useState({});
  const [adjustAmt, setAdjustAmt] = useState({});
  const [addType, setAddType] = useState("game");
  const [addTitle, setAddTitle] = useState("");
  const [addSubtitle, setAddSubtitle] = useState("");
  const [addOpts, setAddOpts] = useState([{ label: "", odds: "" }, { label: "", odds: "" }]);
  const [addSpread, setAddSpread] = useState({ enabled: false, line: "", favoriteOdds: -110, underdogOdds: -110, favorite: 0 });
  const [addOU, setAddOU] = useState({ enabled: false, line: "", overOdds: -110, underOdds: -110 });
  const [addMaxBet, setAddMaxBet] = useState("");
  const [siteMaxInput, setSiteMaxInput] = useState("");
  const [headerInput, setHeaderInput] = useState("");
  const [editMaxBets, setEditMaxBets] = useState({});
  const [editOdds, setEditOdds] = useState({});

  // ── Storage helpers ─────────
  async function saveUsers(u) { setUsers(u); await storageSet("mln_users", u); }
  async function saveMarkets(m) { setMarkets(m); await storageSet("mln_markets", m); }
  async function saveBets(b) { setBets(b); await storageSet("mln_bets", b); }

  // ── Load from Firebase on mount + subscribe ─────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      const u = await storageGet("mln_users");
      const m = await storageGet("mln_markets");
      const b = await storageGet("mln_bets");
      const lv = await storageGet("mln_leaderboard_visible");
      const hm = await storageGet("mln_header_msg");
      const sm = await storageGet("mln_site_max_bet");
      if (!mounted) return;
      setUsers(u || {});
      if (m && m.games) setMarkets(m); else { setMarkets(INITIAL_MARKETS); await storageSet("mln_markets", INITIAL_MARKETS); }
      setBets(b || []);
      setLeaderboardVisible(lv !== false);
      setHeaderMsg(hm || "");
      setSiteMaxBet(sm || null);
    })();
    // Subscribe to live updates
    const unsubs = [
      onValue(ref(db, "mln_users"), s => { if (s.exists()) setUsers(parseFirebase(s.val()) || {}); }),
      onValue(ref(db, "mln_markets"), s => { if (s.exists()) { const v = parseFirebase(s.val()); if (v && v.games) setMarkets(v); } }),
      onValue(ref(db, "mln_bets"), s => { if (s.exists()) setBets(parseFirebase(s.val()) || []); }),
      onValue(ref(db, "mln_leaderboard_visible"), s => { if (s.exists()) setLeaderboardVisible(parseFirebase(s.val()) !== false); }),
      onValue(ref(db, "mln_header_msg"), s => { if (s.exists()) setHeaderMsg(parseFirebase(s.val()) || ""); }),
      onValue(ref(db, "mln_site_max_bet"), s => { if (s.exists()) setSiteMaxBet(parseFirebase(s.val()) || null); }),
    ];
    return () => { mounted = false; unsubs.forEach(u => u()); };
  }, []);

  // ── Inactivity timeout (30 min) ─────────
  useEffect(() => {
    if (screen !== "lobby") return;
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => { setScreen("login"); setUsername(""); setBetSlip({}); }, 30 * 60 * 1000); };
    reset();
    ["mousemove", "keydown", "click", "touchstart"].forEach(e => window.addEventListener(e, reset));
    return () => { clearTimeout(timer); ["mousemove", "keydown", "click", "touchstart"].forEach(e => window.removeEventListener(e, reset)); };
  }, [screen]);

  // ── Notification timer ─────────
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(""), 3000);
    return () => clearTimeout(t);
  }, [notification]);

  useEffect(() => { if (!leaderboardVisible && activeTab === "leaderboard") setActiveTab("games"); }, [leaderboardVisible]);

  function notify(msg) { setNotification(msg); }

  // ── PIN-pad auto-submit ─────────
  useEffect(() => {
    if (loginStep !== "pin_login" || pinInput.length !== 4) return;
    const t = setTimeout(() => handlePinComplete(pinInput), 150);
    return () => clearTimeout(t);
  }, [pinInput, loginStep]);

  useEffect(() => {
    if (loginStep !== "pin_create" || pinInput.length !== 4) return;
    const t = setTimeout(() => { setPendingPin(pinInput); setLoginStep("pin_confirm"); setPinInput(""); }, 150);
    return () => clearTimeout(t);
  }, [pinInput, loginStep]);

  useEffect(() => {
    if (loginStep !== "pin_confirm" || pinInput.length !== 4) return;
    const t = setTimeout(() => handlePinComplete(pinInput), 150);
    return () => clearTimeout(t);
  }, [pinInput, loginStep]);

  function handleNameSubmit() {
    const name = inputName.trim();
    if (!name) return;
    if (containsBannedWord(name)) { setPinError("Please choose a different name."); return; }
    const existingKey = findUserKey(users, name);
    if (existingKey) { setInputName(existingKey); setLoginStep("pin_login"); setPinInput(""); setPinError(""); }
    else { setLoginStep("pin_create"); setPinInput(""); setPinError(""); }
  }

  async function handlePinComplete(pin) {
    const name = inputName.trim();
    if (loginStep === "pin_login") {
      const key = findUserKey(users, name);
      if (pin === users[key]?.pin) { setUsername(key); setScreen("lobby"); setInputName(""); setLoginStep("name"); setPinInput(""); setPinError(""); }
      else { setPinError("Incorrect PIN"); setPinInput(""); }
    } else if (loginStep === "pin_confirm") {
      if (pin === pendingPin) {
        const newUsers = { ...users, [name]: { balance: STARTING_BALANCE, pin: pendingPin, createdAt: Date.now() } };
        await saveUsers(newUsers);
        setUsername(name); setScreen("lobby"); setInputName(""); setLoginStep("name"); setPinInput(""); setPinError(""); setPendingPin("");
      } else { setPinError("PINs don't match"); setPinInput(""); setLoginStep("pin_create"); setPendingPin(""); }
    }
  }

  function resetLoginToName() { setLoginStep("name"); setPinInput(""); setPinError(""); setPendingPin(""); }

  // ── Derived state (safely guarded against bad Firebase shapes) ─────────
  const allMarkets = [...(markets.games || []), ...(markets.futures || [])];
  const balance = users[username]?.balance ?? STARTING_BALANCE;
  const userBets = bets.filter(b => b.username === username);

  // Bet slip leg info
  const slipEntries = Object.entries(betSlip);
  const slipLegs = slipEntries.map(([optId, v]) => {
    const market = allMarkets.find(m => m.id === v.marketId);
    const option = (market?.options || []).find(o => o.id === optId);
    return { optionId: optId, marketId: v.marketId, marketTitle: market?.title, optionLabel: option?.label, odds: option?.odds, stake: v.stake };
  });
  const multiMarket = new Set(slipEntries.map(([, v]) => v.marketId)).size > 1;
  const slipHasFuture = slipLegs.some(l => allMarkets.find(m => m.id === l.marketId)?.type === "future");

  // Base game title — strip " - Spread" and " - O/U 7.5"
  const getBaseTitle = (title) => (title || "").replace(/ - Spread$/, "").replace(/ - O\/U [\d.]+$/, "");

  // Parlay conflict: block ML+Spread same game. ML+OU and Spread+OU OK.
  const hasSameGameConflict = (() => {
    const info = slipLegs.map(l => {
      const m = allMarkets.find(x => x.id === l.marketId);
      if (!m) return null;
      const title = m.title || "";
      return { base: getBaseTitle(title), isSpread: title.endsWith(" - Spread"), isML: !title.includes(" - Spread") && !title.includes(" - O/U") };
    }).filter(Boolean);
    for (let i = 0; i < info.length; i++) {
      for (let j = i + 1; j < info.length; j++) {
        if (info[i].base !== info[j].base) continue;
        if ((info[i].isML && info[j].isSpread) || (info[i].isSpread && info[j].isML)) return true;
      }
    }
    return false;
  })();
  const parlayEligible = multiMarket && !slipHasFuture && !hasSameGameConflict;
  const parlayOdds = slipLegs.length > 1 ? combinedAmericanOdds(slipLegs) : null;
  const parlayPayout = parlayStake > 0 && parlayOdds != null ? calcPayout(parseFloat(parlayStake), parlayOdds) : 0;
  const straightTotal = slipLegs.reduce((acc, l) => acc + (parseFloat(l.stake) || 0), 0);
  const straightPayout = slipLegs.reduce((acc, l) => acc + (parseFloat(l.stake) > 0 ? calcPayout(parseFloat(l.stake), l.odds) : 0), 0);

  // Option totals (money on each option)
  const optionTotals = {};
  for (const b of bets) {
    if (b.betType === "straight") optionTotals[b.optionId] = (optionTotals[b.optionId] || 0) + b.stake;
    else if (b.betType === "parlay") for (const leg of (b.legs || [])) optionTotals[leg.optionId] = (optionTotals[leg.optionId] || 0) + b.stake;
  }

  // Leaderboard
  const leaderboardRaw = Object.entries(users).map(([name, u]) => {
    const pendingAmt = bets.filter(b => b.username === name && b.status === "pending").reduce((s, b) => s + b.stake, 0);
    return { name, u, pendingAmt, total: (u.balance || 0) + pendingAmt };
  }).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.pendingAmt !== a.pendingAmt) return b.pendingAmt - a.pendingAmt;
    return a.name.localeCompare(b.name);
  });
  const leaderboard = leaderboardRaw.reduce((acc, entry, i) => {
    const rank = i === 0 ? 1 : (entry.total === acc[i - 1].total ? acc[i - 1]._rank : i + 1);
    acc.push({ ...entry, _rank: rank });
    return acc;
  }, []);

  // Markets filtered by Open/Resolved
  const rawGames = markets.games || [];
  const rawFutures = markets.futures || [];
  const displayMarkets = activeTab === "games"
    ? (gamesFilter === "open"
        ? rawGames.filter(m => m.status === "open" || m.status === "paused")
        : rawGames.filter(m => m.status === "settled"))
    : (gamesFilter === "open"
        ? rawFutures.filter(m => m.status === "open" || m.status === "paused")
        : rawFutures.filter(m => m.status === "settled"));

  // ── House P&L per market ──
  function getMarketPnL(marketId) {
    const relevant = bets.filter(b => {
      if (b.betType === "straight") return b.marketId === marketId && (b.status === "won" || b.status === "lost" || b.status === "pushed");
      if (b.betType === "parlay") return (b.legs || []).some(l => l.marketId === marketId) && (b.status === "won" || b.status === "lost" || b.status === "pushed");
      return false;
    });
    let staked = 0, paid = 0;
    for (const b of relevant) {
      if (b.betType === "straight") {
        staked += b.stake;
        if (b.status === "won") paid += b.payout;
        if (b.status === "pushed") paid += b.stake;
      } else if (b.betType === "parlay") {
        staked += b.stake;
        if (b.status === "won") paid += b.payout;
        if (b.status === "pushed") paid += b.stake;
      }
    }
    return staked - paid;
  }
  function getHouseLifetimePnL() {
    let total = 0;
    for (const b of bets) {
      if (b.status === "won") total -= (b.payout - b.stake);
      else if (b.status === "lost") total += b.stake;
      // pushes are wash
    }
    return total;
  }
  function getUserLifetimePnL(name) {
    let pnl = 0;
    for (const b of bets) {
      if (b.username !== name) continue;
      if (b.status === "won") pnl += (b.payout - b.stake);
      else if (b.status === "lost") pnl -= b.stake;
    }
    return pnl;
  }

  // ── Bet placement ──
  async function placeStraight(optionId, stake) {
    const v = betSlip[optionId];
    if (!v || !stake || stake <= 0) return;
    const market = allMarkets.find(m => m.id === v.marketId);
    const option = (market?.options || []).find(o => o.id === optionId);
    if (!market || !option || market.status !== "open") return;
    if (stake > balance) { notify("Insufficient balance"); return; }
    const effectiveMax = market.maxBet || siteMaxBet;
    if (effectiveMax && stake > effectiveMax) { notify(`Max bet $${effectiveMax}`); return; }
    const newBet = { id: uid(), username, betType: "straight", marketId: v.marketId, marketTitle: market.title, optionId, optionLabel: option.label, odds: option.odds, stake, payout: calcPayout(stake, option.odds), status: "pending", placedAt: Date.now() };
    await saveUsers({ ...users, [username]: { ...users[username], balance: balance - stake } });
    await saveBets([...bets, newBet]);
    const newSlip = { ...betSlip }; delete newSlip[optionId]; setBetSlip(newSlip);
    notify(`Bet placed: $${stake} on ${option.label}`);
  }

  async function placeAllStraights() {
    const valid = slipLegs.filter(l => parseFloat(l.stake) > 0);
    if (!valid.length) return;
    const total = valid.reduce((a, l) => a + parseFloat(l.stake), 0);
    if (total > balance) { notify("Insufficient balance"); return; }
    for (const l of valid) {
      const m = allMarkets.find(x => x.id === l.marketId);
      const eff = m?.maxBet || siteMaxBet;
      if (eff && parseFloat(l.stake) > eff) { notify(`Max bet $${eff}`); return; }
    }
    const newBets = valid.map(l => ({ id: uid(), username, betType: "straight", marketId: l.marketId, marketTitle: l.marketTitle, optionId: l.optionId, optionLabel: l.optionLabel, odds: l.odds, stake: parseFloat(l.stake), payout: calcPayout(parseFloat(l.stake), l.odds), status: "pending", placedAt: Date.now() }));
    await saveUsers({ ...users, [username]: { ...users[username], balance: balance - total } });
    await saveBets([...bets, ...newBets]);
    setBetSlip({});
    notify(`${newBets.length} bets placed`);
  }

  async function placeParlay() {
    const stake = parseFloat(parlayStake);
    if (!stake || stake <= 0 || !parlayEligible || slipLegs.length < 2) return;
    if (stake > balance) { notify("Insufficient balance"); return; }
    const effMax = siteMaxBet;
    if (effMax && stake > effMax) { notify(`Max bet $${effMax}`); return; }
    const combo = combinedAmericanOdds(slipLegs);
    const payout = calcPayout(stake, combo);
    const newBet = { id: uid(), username, betType: "parlay", legs: slipLegs.map(l => ({ marketId: l.marketId, marketTitle: l.marketTitle, optionId: l.optionId, optionLabel: l.optionLabel, odds: l.odds, status: "pending" })), combinedOdds: combo, stake, payout, status: "pending", placedAt: Date.now() };
    await saveUsers({ ...users, [username]: { ...users[username], balance: balance - stake } });
    await saveBets([...bets, newBet]);
    setBetSlip({}); setParlayStake("");
    notify(`Parlay placed: $${stake} -> $${payout.toFixed(2)}`);
  }

  function toggleSlip(option, marketId, market) {
    if (market.status !== "open") { notify("Market not open"); return; }
    if (betSlip[option.id]) {
      const ns = { ...betSlip }; delete ns[option.id]; setBetSlip(ns);
    } else {
      setBetSlip({ ...betSlip, [option.id]: { marketId, stake: "" } });
    }
  }
  function setSlipStake(optId, val) { setBetSlip({ ...betSlip, [optId]: { ...betSlip[optId], stake: val } }); }

  // ── Admin actions ──
  async function settleMarket(marketId, winningOptionId) {
    const settle = m => m.id === marketId ? { ...m, status: "settled", winner: winningOptionId } : m;
    const newMarkets = { games: (markets.games || []).map(settle), futures: (markets.futures || []).map(settle) };
    const newUsers = { ...users };
    const newBets = bets.map(b => {
      if (b.status !== "pending") return b;
      if (b.betType === "straight") {
        if (b.marketId !== marketId) return b;
        const won = b.optionId === winningOptionId;
        if (won) newUsers[b.username] = { ...newUsers[b.username], balance: (newUsers[b.username]?.balance || 0) + b.payout };
        return { ...b, status: won ? "won" : "lost" };
      }
      if (b.betType === "parlay") {
        const hasLeg = (b.legs || []).some(l => l.marketId === marketId);
        if (!hasLeg) return b;
        const newLegs = b.legs.map(l => l.marketId === marketId ? { ...l, status: l.optionId === winningOptionId ? "won" : "lost" } : l);
        const anyLost = newLegs.some(l => l.status === "lost");
        const allWon = newLegs.every(l => l.status === "won");
        let newStatus = b.status;
        if (anyLost) newStatus = "lost";
        else if (allWon) { newStatus = "won"; newUsers[b.username] = { ...newUsers[b.username], balance: (newUsers[b.username]?.balance || 0) + b.payout }; }
        return { ...b, legs: newLegs, status: newStatus };
      }
      return b;
    });
    await saveUsers(newUsers); await saveMarkets(newMarkets); await saveBets(newBets);
    notify("Market settled");
  }

  async function pushMarket(marketId) {
    const newUsers = { ...users };
    const newBets = bets.map(b => {
      if (b.status !== "pending") return b;
      if (b.betType === "straight") {
        if (b.marketId !== marketId) return b;
        newUsers[b.username] = { ...newUsers[b.username], balance: (newUsers[b.username]?.balance || 0) + b.stake };
        return { ...b, status: "pushed" };
      }
      if (b.betType === "parlay") {
        const legs = b.legs || [];
        const hasLeg = legs.some(l => l.marketId === marketId);
        if (!hasLeg) return b;
        const newLegs = legs.map(l => l.marketId === marketId ? { ...l, status: "pushed" } : l);
        const remaining = newLegs.filter(l => l.status !== "pushed");
        if (remaining.length === 0) {
          newUsers[b.username] = { ...newUsers[b.username], balance: (newUsers[b.username]?.balance || 0) + b.stake };
          return { ...b, legs: newLegs, status: "pushed" };
        }
        if (remaining.length === 1) {
          const leg = remaining[0];
          return { ...b, legs: newLegs, combinedOdds: leg.odds, payout: calcPayout(b.stake, leg.odds) };
        }
        const newOdds = combinedAmericanOdds(remaining);
        return { ...b, legs: newLegs, combinedOdds: newOdds, payout: calcPayout(b.stake, newOdds) };
      }
      return b;
    });
    const settle = m => m.id === marketId ? { ...m, status: "settled", winner: "push" } : m;
    const newMarkets = { games: (markets.games || []).map(settle), futures: (markets.futures || []).map(settle) };
    await saveUsers(newUsers); await saveMarkets(newMarkets); await saveBets(newBets);
    notify("Market pushed - bets refunded");
  }

  async function unsettleMarket(marketId) {
    const newUsers = { ...users };
    const newBets = bets.map(b => {
      if (b.betType === "straight") {
        if (b.marketId !== marketId) return b;
        if (b.status === "won") newUsers[b.username] = { ...newUsers[b.username], balance: Math.max(0, (newUsers[b.username]?.balance || 0) - b.payout) };
        if (b.status === "pushed") newUsers[b.username] = { ...newUsers[b.username], balance: Math.max(0, (newUsers[b.username]?.balance || 0) - b.stake) };
        if (b.status === "won" || b.status === "lost" || b.status === "pushed") return { ...b, status: "pending" };
        return b;
      }
      if (b.betType === "parlay") {
        const legs = b.legs || [];
        const hasLeg = legs.some(l => l.marketId === marketId);
        if (!hasLeg) return b;
        if (b.status === "won") newUsers[b.username] = { ...newUsers[b.username], balance: Math.max(0, (newUsers[b.username]?.balance || 0) - b.payout) };
        if (b.status === "pushed") newUsers[b.username] = { ...newUsers[b.username], balance: Math.max(0, (newUsers[b.username]?.balance || 0) - b.stake) };
        const newLegs = legs.map(l => l.marketId === marketId ? { ...l, status: "pending" } : l);
        const anyLost = newLegs.some(l => l.status === "lost");
        return { ...b, legs: newLegs, status: anyLost ? "lost" : "pending" };
      }
      return b;
    });
    const reopen = m => m.id === marketId ? { ...m, status: "open", winner: null } : m;
    const newMarkets = { games: (markets.games || []).map(reopen), futures: (markets.futures || []).map(reopen) };
    await saveUsers(newUsers); await saveMarkets(newMarkets); await saveBets(newBets);
    notify("Market reopened");
  }

  async function eliminateOption(marketId, optId) {
    const market = allMarkets.find(m => m.id === marketId);
    if (!market) return;
    const newUsers = { ...users };
    const newBets = bets.map(b => {
      if (b.status !== "pending") return b;
      if (b.betType === "straight") {
        if (b.marketId !== marketId || b.optionId !== optId) return b;
        return { ...b, status: "lost" };
      }
      if (b.betType === "parlay") {
        const legs = b.legs || [];
        if (!legs.some(l => l.marketId === marketId && l.optionId === optId)) return b;
        const newLegs = legs.map(l => l.marketId === marketId && l.optionId === optId ? { ...l, status: "lost" } : l);
        return { ...b, legs: newLegs, status: "lost" };
      }
      return b;
    });
    const elim = m => m.id === marketId ? { ...m, eliminated: [...(m.eliminated || []), optId] } : m;
    const newMarkets = { games: (markets.games || []).map(elim), futures: (markets.futures || []).map(elim) };
    await saveUsers(newUsers); await saveMarkets(newMarkets); await saveBets(newBets);
    notify("Option eliminated");
  }

  async function adjustBalance(name, amount) {
    const newUsers = { ...users, [name]: { ...users[name], balance: Math.max(0, (users[name]?.balance || 0) + amount) } };
    await saveUsers(newUsers);
    notify(`${name} adjusted by ${amount > 0 ? "+" : ""}${amount}`);
  }
  async function deleteUser(name) {
    const newUsers = { ...users }; delete newUsers[name];
    await saveUsers(newUsers);
    notify(`${name} deleted`);
  }

  async function togglePauseMarket(marketId) {
    const m = allMarkets.find(x => x.id === marketId);
    if (!m) return;
    const newStatus = m.status === "paused" ? "open" : "paused";
    const upd = mm => mm.id === marketId ? { ...mm, status: newStatus } : mm;
    await saveMarkets({ games: (markets.games || []).map(upd), futures: (markets.futures || []).map(upd) });
  }
  async function pauseAllMarkets() {
    const pauseFn = m => m.status === "open" ? { ...m, status: "paused" } : m;
    await saveMarkets({ games: (markets.games || []).map(pauseFn), futures: (markets.futures || []).map(pauseFn) });
    notify("All markets paused");
  }
  async function unpauseAllMarkets() {
    const unpFn = m => m.status === "paused" ? { ...m, status: "open" } : m;
    await saveMarkets({ games: (markets.games || []).map(unpFn), futures: (markets.futures || []).map(unpFn) });
    notify("All markets opened");
  }
  async function deleteMarket(marketId) {
    const newBets = bets.filter(b => b.marketId !== marketId && !(b.legs || []).some(l => l.marketId === marketId));
    const newUsers = { ...users };
    for (const b of bets) {
      if (b.status !== "pending") continue;
      if (b.marketId === marketId || (b.legs || []).some(l => l.marketId === marketId)) {
        newUsers[b.username] = { ...newUsers[b.username], balance: (newUsers[b.username]?.balance || 0) + b.stake };
      }
    }
    const rm = m => m.id !== marketId;
    await saveUsers(newUsers); await saveMarkets({ games: (markets.games || []).filter(rm), futures: (markets.futures || []).filter(rm) }); await saveBets(newBets);
    notify("Market deleted, stakes refunded");
  }

  async function handleAddMarket() {
    if (!addTitle.trim()) { notify("Title required"); return; }
    const validOpts = addOpts.filter(o => o.label.trim() && o.odds !== "");
    if (validOpts.length < 2) { notify("Need at least 2 options"); return; }
    const baseId = uid();
    const mainMarket = {
      id: baseId, type: addType,
      title: addTitle.trim(), subtitle: addSubtitle.trim() || "Custom Market",
      status: "open", winner: null,
      maxBet: addMaxBet ? parseFloat(addMaxBet) : null,
      options: validOpts.map(o => ({ id: `${baseId}_${uid()}`, label: o.label.trim(), odds: parseInt(o.odds) })),
    };
    const toAdd = [mainMarket];
    if (addType === "game" && addSpread.enabled && addSpread.line !== "" && validOpts.length === 2) {
      const fav = parseInt(addSpread.favorite);
      const dog = fav === 0 ? 1 : 0;
      const line = parseFloat(addSpread.line);
      const spreadId = uid();
      toAdd.push({
        id: spreadId, type: "game", title: `${addTitle.trim()} - Spread`, subtitle: addSubtitle.trim() || "Custom Market",
        status: "open", winner: null, maxBet: addMaxBet ? parseFloat(addMaxBet) : null,
        options: [
          { id: `${spreadId}_fav`, label: `${validOpts[fav].label.trim()} -${line}`, odds: parseInt(addSpread.favoriteOdds) },
          { id: `${spreadId}_dog`, label: `${validOpts[dog].label.trim()} +${line}`, odds: parseInt(addSpread.underdogOdds) },
        ],
      });
    }
    if (addType === "game" && addOU.enabled && addOU.line !== "") {
      const ouLine = parseFloat(addOU.line);
      const ouId = uid();
      toAdd.push({
        id: ouId, type: "game", title: `${addTitle.trim()} - O/U ${ouLine}`, subtitle: addSubtitle.trim() || "Custom Market",
        status: "open", winner: null, maxBet: addMaxBet ? parseFloat(addMaxBet) : null,
        options: [
          { id: `${ouId}_o`, label: `Over ${ouLine}`, odds: parseInt(addOU.overOdds) },
          { id: `${ouId}_u`, label: `Under ${ouLine}`, odds: parseInt(addOU.underOdds) },
        ],
      });
    }
    const newMarkets = {
      games: addType === "game" ? [...(markets.games || []), ...toAdd] : (markets.games || []),
      futures: addType === "future" ? [...(markets.futures || []), ...toAdd] : (markets.futures || []),
    };
    await saveMarkets(newMarkets);
    setAddTitle(""); setAddSubtitle(""); setAddOpts([{ label: "", odds: "" }, { label: "", odds: "" }]);
    setAddSpread({ enabled: false, line: "", favoriteOdds: -110, underdogOdds: -110, favorite: 0 });
    setAddOU({ enabled: false, line: "", overOdds: -110, underOdds: -110 });
    setAddMaxBet("");
    notify("Market added");
  }

  async function updateMarketMaxBet(marketId, max) {
    const upd = m => m.id === marketId ? { ...m, maxBet: max } : m;
    await saveMarkets({ games: (markets.games || []).map(upd), futures: (markets.futures || []).map(upd) });
  }
  async function updateOptionOdds(marketId, optId, newOdds) {
    const upd = m => m.id !== marketId ? m : { ...m, options: (m.options || []).map(o => o.id === optId ? { ...o, odds: newOdds } : o) };
    await saveMarkets({ games: (markets.games || []).map(upd), futures: (markets.futures || []).map(upd) });
  }
  async function updateMarketTitle(marketId, newTitle) {
    const upd = m => m.id === marketId ? { ...m, title: newTitle } : m;
    await saveMarkets({ games: (markets.games || []).map(upd), futures: (markets.futures || []).map(upd) });
  }

  // ── Bet slip render helper (plain function, NOT a React component) ──
  function renderCell(opt, market, colType) {
    if (!opt) return <div style={GS.cell} />;
    const isElim = (market.eliminated || []).includes(opt.id);
    if (isElim) return <div style={{ ...GS.cell, opacity: 0.4 }}><div style={GS.cellLabel}>OUT</div><div style={GS.cellOdds}>—</div></div>;
    const selected = !!betSlip[opt.id];
    const disabled = market.status !== "open";
    const totalOnOpt = optionTotals[opt.id] || 0;
    const totalOnMkt = (market.options || []).reduce((s, o) => s + (optionTotals[o.id] || 0), 0);
    const pct = totalOnMkt > 0 ? (totalOnOpt / totalOnMkt) * 100 : 0;
    return (
      <div style={{ ...GS.cell, ...(selected ? GS.cellSelected : {}), ...(disabled ? GS.cellDisabled : {}) }}
        onClick={() => !disabled && toggleSlip(opt, market.id, market)}>
        <div style={GS.cellLabel}>{opt.label}</div>
        <div style={{ ...GS.cellOdds, color: selected ? "#f8fafc" : opt.odds > 0 ? "#4ade80" : "#f8fafc" }}>{fmt(opt.odds)}</div>
        {totalOnMkt > 0 && <div style={GS.cellBar}><div style={{ ...GS.cellBarFill, width: `${pct}%` }} /></div>}
      </div>
    );
  }

  // ── Lobby render ──
  if (screen === "login") {
    const name = inputName.trim();
    return (
      <div style={S.loginWrap}>
        <div style={S.loginBg} />
        <div style={S.loginCard}>
          <div style={S.loginLogoRow}>
            <span style={S.loginLogoIcon}>{I.baseball}</span>
            <div>
              <div style={S.loginLogoTitle}>MLN BETTING</div>
              <div style={S.loginLogoSub}>Fake Money. Real Bragging Rights.</div>
            </div>
          </div>
          <div style={S.loginDivider} />
          {loginStep === "name" && (<>
            <label style={S.loginLabel}>PLAYER NAME</label>
            <input style={S.input} placeholder="Enter your name..." value={inputName}
              onChange={e => setInputName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && inputName.trim() && handleNameSubmit()} />
            {pinError && <p style={{ margin: "-6px 0 -2px", fontSize: 12, color: "#ef4444" }}>{pinError}</p>}
            <button style={{ ...S.btnPrimary, opacity: inputName.trim() ? 1 : 0.4 }} onClick={handleNameSubmit} disabled={!inputName.trim()}>Continue</button>
            <button style={S.btnGhost} onClick={() => setScreen("admin")}>Admin Panel</button>
          </>)}
          {loginStep === "pin_login" && (<>
            <div style={{ textAlign: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Welcome back, </span>
              <span style={{ fontSize: 13, color: "#6366f1", fontWeight: 700 }}>{name}</span>
            </div>
            <PinPad value={pinInput} onChange={p => { setPinInput(p); if (pinError) setPinError(""); }} label="Enter your PIN" error={pinError} />
            <button style={S.btnGhost} onClick={resetLoginToName}>Back</button>
          </>)}
          {loginStep === "pin_create" && (<>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 14, color: "#16a34a", fontWeight: 700 }}>Account not found</p>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#64748b" }}>No account for <strong style={{ color: "#1e293b" }}>{name}</strong>. Create one below.</p>
            </div>
            <PinPad value={pinInput} onChange={setPinInput} label="Choose a 4-digit PIN" sublabel="You will use this every time you log in" />
            <button style={S.btnGhost} onClick={resetLoginToName}>Back</button>
          </>)}
          {loginStep === "pin_confirm" && (<>
            <PinPad value={pinInput} onChange={p => { setPinInput(p); if (pinError) setPinError(""); }} label="Confirm your PIN" sublabel="Enter it again" error={pinError} />
            <button style={S.btnGhost} onClick={() => { setLoginStep("pin_create"); setPinInput(""); setPinError(""); }}>Back</button>
          </>)}
        </div>
      </div>
    );
  }

  // ── Admin screen ──
  if (screen === "admin") {
    if (!adminUnlocked) {
      return (
        <div style={S.loginWrap}>
          <div style={S.loginBg} />
          <div style={S.loginCard}>
            <div style={S.loginLogoRow}>
              <span style={S.loginLogoIcon}>{I.baseball}</span>
              <div>
                <div style={S.loginLogoTitle}>ADMIN</div>
                <div style={S.loginLogoSub}>Restricted Area</div>
              </div>
            </div>
            <div style={S.loginDivider} />
            <PinPad value={adminPin} onChange={p => {
              setAdminPin(p);
              if (p.length === 4) {
                setTimeout(() => {
                  if (p === ADMIN_PIN) { setAdminUnlocked(true); setAdminPin(""); }
                  else { setAdminPin(""); notify("Incorrect PIN"); }
                }, 150);
              }
            }} label="Admin PIN" sublabel="6-digit access code" />
            <button style={S.btnGhost} onClick={() => { setAdminPin(""); setScreen("login"); }}>Back to Login</button>
          </div>
        </div>
      );
    }

    return (
      <div style={S.adminWrap}>
        <div style={S.adminHeader}>
          <button style={S.backBtn} onClick={() => { setAdminUnlocked(false); setAdminPin(""); setScreen("login"); }}>Back</button>
          <div style={S.adminTitle}>ADMIN PANEL</div>
          <div style={{ width: 56 }} />
        </div>
        {notification && <div style={S.notify}>{notification}</div>}

        <div style={S.adminTabs}>
          {[["settle", "Settle"], ["players", "Players"], ["add", "Add"], ["edit", "Edit"], ["bets", "Bets"], ["danger", "Danger"]].map(([k, l]) => (
            <button key={k} style={{ ...S.adminTab, ...(adminTab === k ? S.adminTabActive : {}) }} onClick={() => setAdminTab(k)}>{l}</button>
          ))}
        </div>

        <div style={S.adminContent}>

          {adminTab === "settle" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button style={{ ...S.settleBtn, flex: 1, background: "#fffbeb", borderColor: "#fde68a", color: "#d97706" }} onClick={pauseAllMarkets}>{I.pause} Pause All</button>
                <button style={{ ...S.settleBtn, flex: 1 }} onClick={unpauseAllMarkets}>{I.play} Open All</button>
              </div>
              <div style={{ padding: "10px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 16, fontSize: 12 }}>
                <strong>Lifetime House P&L: </strong>
                <span style={{ color: getHouseLifetimePnL() >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                  ${getHouseLifetimePnL().toFixed(2)}
                </span>
              </div>
              {allMarkets.map(market => {
                const meta = leagueMeta(market.subtitle);
                const totalAction = (market.options || []).reduce((s, o) => s + (optionTotals[o.id] || 0), 0);
                return (
                  <div key={market.id} style={S.adminMarketCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ ...S.leagueTag, color: meta.color, background: meta.bg, display: "inline-block", marginBottom: 4 }}>{meta.tag}</span>
                        <p style={S.adminMarketTitle}>{market.title}</p>
                        <p style={S.adminMarketSubtitle}>{market.subtitle}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>${totalAction.toFixed(0)} action</span>
                        <button style={S.pauseBtn} onClick={() => togglePauseMarket(market.id)}>
                          {market.status === "paused" ? `${I.play} Open` : `${I.pause} Pause`}
                        </button>
                      </div>
                    </div>

                    {market.status !== "settled" && (market.options || []).map(opt => {
                      const onOpt = optionTotals[opt.id] || 0;
                      return (
                        <div key={opt.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", padding: "2px 0" }}>
                          <span>{opt.label} ({fmt(opt.odds)})</span>
                          <span>${onOpt.toFixed(0)} — if wins, house P&L: ${((onOpt > 0 ? totalAction - (market.options || []).reduce((s, o) => s + (optionTotals[o.id] || 0) * calcPayout(1, o.odds) * (o.id === opt.id ? 1 : 0), 0) : totalAction)).toFixed(0)}</span>
                        </div>
                      );
                    })}

                    {(market.status === "open" || market.status === "paused") ? (
                      <div style={S.settleOptions}>
                        {(market.options || []).map(opt => {
                          const isElim = (market.eliminated || []).includes(opt.id);
                          if (isElim) return (
                            <div key={opt.id} style={{ padding: "8px 12px", background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#ef4444", opacity: 0.6 }}>
                              {I.cross} {opt.label} - Eliminated
                            </div>
                          );
                          return (
                            <div key={opt.id} style={{ display: "flex", gap: 6 }}>
                              <button style={{ ...S.settleBtn, flex: 1 }} onClick={() => { if (window.confirm(`Settle ${opt.label} as winner?`)) settleMarket(market.id, opt.id); }}>
                                {I.check} {opt.label}
                              </button>
                              {market.type === "future" && (
                                <button style={{ ...S.settleBtn, background: "#fff1f2", borderColor: "#fecaca", color: "#ef4444", flex: "0 0 auto" }}
                                  onClick={() => { if (window.confirm(`Eliminate ${opt.label}? Pending bets become losses. Historical bets preserved.`)) eliminateOption(market.id, opt.id); }}>
                                  {I.cross} Out
                                </button>
                              )}
                            </div>
                          );
                        })}
                        <button style={{ ...S.settleBtn, background: "#fffbeb", borderColor: "#fde68a", color: "#d97706", marginTop: 4 }}
                          onClick={() => { if (window.confirm(`Push "${market.title}"? Pending bets get stake refunded. Parlay legs are removed.`)) pushMarket(market.id); }}>
                          {I.undo} Push / Tie (Refund All)
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <p style={S.winnerText}>
                            {market.winner === "push" ? `${I.undo} Push - bets refunded` : `${I.trophy} ${(market.options || []).find(o => o.id === market.winner)?.label || "Unknown"}`}
                          </p>
                          <button style={{ ...S.settleBtn, background: "#faf5ff", borderColor: "#e9d5ff", color: "#9333ea", fontSize: 11, padding: "5px 10px" }}
                            onClick={() => { if (window.confirm("Unsettle this market? Reverses payouts.")) unsettleMarket(market.id); }}>
                            {I.undo} Unsettle
                          </button>
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>House P&L: ${getMarketPnL(market.id).toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {adminTab === "players" && (
            <div>
              <h3 style={S.adminH3}>Players ({Object.keys(users).length})</h3>
              {leaderboard.map((p, i) => {
                const lifetime = getUserLifetimePnL(p.name);
                const pin = users[p.name]?.pin || "";
                const shown = revealPin[p.name];
                return (
                  <div key={p.name} style={S.playerRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={S.playerRank}>#{p._rank}</span>
                      <span style={S.playerName}>{p.name}</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>${(p.u.balance || 0).toFixed(0)} cash + ${p.pendingAmt.toFixed(0)} pending</span>
                      <span style={{ fontSize: 11, color: lifetime >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                        Lifetime: {lifetime >= 0 ? "+" : ""}${lifetime.toFixed(0)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                      <button style={S.miniBtn} onClick={() => setRevealPin({ ...revealPin, [p.name]: !shown })}>
                        {shown ? `PIN: ${pin}` : "Show PIN"}
                      </button>
                      <input style={{ ...S.input, width: 70, padding: "6px 8px", fontSize: 12 }}
                        type="number" placeholder="+/-"
                        value={adjustAmt[p.name] || ""}
                        onChange={e => setAdjustAmt({ ...adjustAmt, [p.name]: e.target.value })} />
                      <button style={S.miniBtn} onClick={() => {
                        const a = parseFloat(adjustAmt[p.name]);
                        if (!isNaN(a)) { adjustBalance(p.name, a); setAdjustAmt({ ...adjustAmt, [p.name]: "" }); }
                      }}>Adjust</button>
                      <button style={{ ...S.miniBtn, background: "#fff1f2", borderColor: "#fecaca", color: "#ef4444" }}
                        onClick={() => { if (window.confirm(`Delete ${p.name}?`)) deleteUser(p.name); }}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {adminTab === "add" && (
            <div>
              <h3 style={S.adminH3}>Add Market</h3>
              <div style={S.formRow}>
                <label style={S.formLabel}>TYPE</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["game", "future"].map(t => (
                    <button key={t} style={{ ...S.miniBtn, ...(addType === t ? { background: "#0f172a", color: "#f8fafc", borderColor: "#0f172a" } : {}) }}
                      onClick={() => setAddType(t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>TITLE</label>
                <input style={S.input} placeholder="e.g., Team A vs Team B" value={addTitle} onChange={e => setAddTitle(e.target.value)} />
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>SUBTITLE</label>
                <input style={S.input} placeholder="e.g., Lunar League - Semifinal" value={addSubtitle} onChange={e => setAddSubtitle(e.target.value)} />
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>OPTIONS</label>
                {addOpts.map((opt, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input style={{ ...S.input, flex: 2 }} placeholder={`Option ${i + 1} label`} value={opt.label}
                      onChange={e => { const a = [...addOpts]; a[i] = { ...a[i], label: e.target.value }; setAddOpts(a); }} />
                    <input style={{ ...S.input, flex: 1 }} placeholder="-110" type="number" value={opt.odds}
                      onChange={e => { const a = [...addOpts]; a[i] = { ...a[i], odds: e.target.value }; setAddOpts(a); }} />
                    {addOpts.length > 2 && <button style={S.miniBtn} onClick={() => setAddOpts(addOpts.filter((_, j) => j !== i))}>X</button>}
                  </div>
                ))}
                <button style={S.miniBtn} onClick={() => setAddOpts([...addOpts, { label: "", odds: "" }])}>+ Add Option</button>
              </div>

              {addType === "game" && (<>
                <div style={S.formRow}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={addSpread.enabled} onChange={e => setAddSpread({ ...addSpread, enabled: e.target.checked })} />
                    Add Spread Market
                  </label>
                  {addSpread.enabled && (
                    <div style={{ marginTop: 8, padding: 10, background: "#f8fafc", borderRadius: 8 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <select style={S.input} value={addSpread.favorite} onChange={e => setAddSpread({ ...addSpread, favorite: parseInt(e.target.value) })}>
                          <option value="0">{addOpts[0]?.label || "Option 1"} is favorite</option>
                          <option value="1">{addOpts[1]?.label || "Option 2"} is favorite</option>
                        </select>
                        <input style={{ ...S.input, width: 70 }} placeholder="7.5" type="number" step="0.5" value={addSpread.line}
                          onChange={e => setAddSpread({ ...addSpread, line: e.target.value })} />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input style={S.input} placeholder="Fav odds (-110)" type="number" value={addSpread.favoriteOdds}
                          onChange={e => setAddSpread({ ...addSpread, favoriteOdds: e.target.value })} />
                        <input style={S.input} placeholder="Dog odds (-110)" type="number" value={addSpread.underdogOdds}
                          onChange={e => setAddSpread({ ...addSpread, underdogOdds: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
                <div style={S.formRow}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={addOU.enabled} onChange={e => setAddOU({ ...addOU, enabled: e.target.checked })} />
                    Add Over/Under Market
                  </label>
                  {addOU.enabled && (
                    <div style={{ marginTop: 8, padding: 10, background: "#f8fafc", borderRadius: 8 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input style={S.input} placeholder="O/U line (7.5)" type="number" step="0.5" value={addOU.line}
                          onChange={e => setAddOU({ ...addOU, line: e.target.value })} />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input style={S.input} placeholder="Over odds (-110)" type="number" value={addOU.overOdds}
                          onChange={e => setAddOU({ ...addOU, overOdds: e.target.value })} />
                        <input style={S.input} placeholder="Under odds (-110)" type="number" value={addOU.underOdds}
                          onChange={e => setAddOU({ ...addOU, underOdds: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              </>)}

              <div style={S.formRow}>
                <label style={S.formLabel}>MAX BET (optional)</label>
                <input style={S.input} type="number" placeholder="e.g., 100" value={addMaxBet} onChange={e => setAddMaxBet(e.target.value)} />
              </div>
              <button style={{ ...S.btnPrimary, width: "100%" }} onClick={handleAddMarket}>Add Market</button>

              <div style={{ marginTop: 24, padding: 14, background: "#f8fafc", borderRadius: 10 }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>Site Settings</h4>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input style={S.input} type="number" placeholder="Site-wide max bet" value={siteMaxInput} onChange={e => setSiteMaxInput(e.target.value)} />
                  <button style={S.miniBtn} onClick={async () => {
                    const v = parseFloat(siteMaxInput);
                    await storageSet("mln_site_max_bet", isNaN(v) ? null : v);
                    setSiteMaxBet(isNaN(v) ? null : v); setSiteMaxInput("");
                    notify("Site max bet updated");
                  }}>Set</button>
                  <button style={S.miniBtn} onClick={async () => {
                    await storageSet("mln_site_max_bet", null); setSiteMaxBet(null); notify("Cleared");
                  }}>Clear</button>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Current: {siteMaxBet ? `$${siteMaxBet}` : "none"}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input style={S.input} placeholder="Lobby banner message" value={headerInput} onChange={e => setHeaderInput(e.target.value)} />
                  <button style={S.miniBtn} onClick={async () => { await storageSet("mln_header_msg", headerInput); setHeaderMsg(headerInput); setHeaderInput(""); notify("Banner updated"); }}>Set</button>
                  <button style={S.miniBtn} onClick={async () => { await storageSet("mln_header_msg", ""); setHeaderMsg(""); notify("Cleared"); }}>Clear</button>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                  <input type="checkbox" checked={leaderboardVisible} onChange={async e => {
                    setLeaderboardVisible(e.target.checked);
                    await storageSet("mln_leaderboard_visible", e.target.checked);
                  }} />
                  Show Standings tab to players
                </label>
              </div>
            </div>
          )}

          {adminTab === "edit" && (
            <div>
              <h3 style={S.adminH3}>Edit Markets</h3>
              {allMarkets.map(m => (
                <div key={m.id} style={S.adminMarketCard}>
                  <p style={S.adminMarketTitle}>{m.title}</p>
                  <p style={S.adminMarketSubtitle}>{m.subtitle} - <span style={{ color: m.status === "open" ? "#16a34a" : m.status === "paused" ? "#d97706" : "#94a3b8" }}>{m.status}</span></p>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <input style={{ ...S.input, width: 100 }} type="number" placeholder="Max bet"
                      value={editMaxBets[m.id] !== undefined ? editMaxBets[m.id] : (m.maxBet || "")}
                      onChange={e => setEditMaxBets({ ...editMaxBets, [m.id]: e.target.value })} />
                    <button style={S.miniBtn} onClick={() => {
                      const v = parseFloat(editMaxBets[m.id]);
                      updateMarketMaxBet(m.id, isNaN(v) ? null : v);
                      const ne = { ...editMaxBets }; delete ne[m.id]; setEditMaxBets(ne);
                    }}>Set Max</button>
                    <button style={S.miniBtn} onClick={() => togglePauseMarket(m.id)}>
                      {m.status === "paused" ? "Reopen" : "Pause"}
                    </button>
                  </div>
                  <div>
                    {(m.options || []).map(o => (
                      <div key={o.id} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                        <span style={{ flex: 1, fontSize: 12 }}>{o.label}</span>
                        <input style={{ ...S.input, width: 80 }} type="number"
                          value={editOdds[o.id] !== undefined ? editOdds[o.id] : o.odds}
                          onChange={e => setEditOdds({ ...editOdds, [o.id]: e.target.value })} />
                        <button style={S.miniBtn} onClick={() => {
                          const v = parseInt(editOdds[o.id]);
                          if (!isNaN(v)) { updateOptionOdds(m.id, o.id, v); const ne = { ...editOdds }; delete ne[o.id]; setEditOdds(ne); }
                        }}>Set</button>
                      </div>
                    ))}
                  </div>
                  <button style={{ ...S.miniBtn, marginTop: 6, background: "#fff1f2", borderColor: "#fecaca", color: "#ef4444" }}
                    onClick={() => { if (window.confirm(`Delete "${m.title}"? Pending stakes refunded.`)) deleteMarket(m.id); }}>
                    Delete Market
                  </button>
                </div>
              ))}
            </div>
          )}

          {adminTab === "bets" && (
            <div>
              <h3 style={S.adminH3}>All Bets ({bets.length})</h3>
              {[...bets].reverse().map(b => (
                <div key={b.id} style={{ padding: "10px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{b.username}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: b.status === "won" ? "#16a34a" : b.status === "lost" ? "#ef4444" : b.status === "pushed" ? "#3b82f6" : "#d97706" }}>
                      {b.status === "won" ? `${I.check} WON` : b.status === "lost" ? `${I.cross} LOST` : b.status === "pushed" ? `${I.undo} PUSH` : `${I.pending} PENDING`}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {b.betType === "straight"
                      ? `${b.optionLabel} (${fmt(b.odds)}) on ${b.marketTitle}`
                      : `${(b.legs || []).length}-leg parlay (${fmt(b.combinedOdds)})`}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    ${b.stake.toFixed(2)} {I.arrow} ${b.payout?.toFixed(2)} - {fmtTime(b.placedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {adminTab === "danger" && (
            <div>
              <h3 style={S.adminH3}>Danger Zone</h3>
              <button style={{ ...S.btnPrimary, background: "#dc2626", width: "100%" }} onClick={async () => {
                if (!window.confirm("Reset EVERYTHING? This deletes all users, markets, and bets.")) return;
                if (!window.confirm("Really? This cannot be undone.")) return;
                await storageSet("mln_users", {}); setUsers({});
                await storageSet("mln_markets", INITIAL_MARKETS); setMarkets(INITIAL_MARKETS);
                await storageSet("mln_bets", []); setBets([]);
                notify("Reset complete");
              }}>RESET ALL DATA</button>
            </div>
          )}

        </div>
      </div>
    );
  }

  // ── LOBBY ──
  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={S.headerLeft}><span style={S.headerIcon}>{I.baseball}</span><span style={S.headerLogo}>MLN BETTING</span></div>
        <div style={S.headerRight}>
          <div style={S.balancePill}><span style={S.balanceDollar}>$</span><span style={S.balanceAmt}>{balance.toFixed(2)}</span></div>
          <button style={S.avatarBtn} title={username} onClick={() => { setBetSlip({}); setScreen("login"); }}>{username[0]?.toUpperCase()}</button>
        </div>
      </div>

      {headerMsg && <div style={S.headerBanner}>{headerMsg}</div>}
      {notification && <div style={S.notify}>{notification}</div>}

      <div style={S.tabs}>
        {[["games", `${I.stadium} Games`], ["futures", `${I.crystal} Futures`], ["leaderboard", `${I.medal} Standings`], ["mybets", `My Bets${userBets.length ? ` (${userBets.length})` : ""}`]]
          .filter(([k]) => k !== "leaderboard" || leaderboardVisible)
          .map(([k, l]) => (
            <button key={k} style={{ ...S.tab, ...(activeTab === k ? S.tabActive : {}) }} onClick={() => setActiveTab(k)}>{l}</button>
          ))}
      </div>

      {(activeTab === "games" || activeTab === "futures") && (
        <div style={S.subTabs}>
          {[["open", "Open"], ["resolved", "Resolved"]].map(([k, l]) => {
            const src = activeTab === "games" ? rawGames : rawFutures;
            const cnt = k === "open" ? src.filter(m => m.status === "open" || m.status === "paused").length : src.filter(m => m.status === "settled").length;
            return (
              <button key={k} style={{ ...S.subTab, ...(gamesFilter === k ? S.subTabActive : {}) }} onClick={() => setGamesFilter(k)}>
                {l}{cnt > 0 ? ` (${cnt})` : ""}
              </button>
            );
          })}
        </div>
      )}

      <div style={S.content}>

        {(activeTab === "games" || activeTab === "futures") && (
          <>
            {displayMarkets.length === 0 && <div style={S.empty}><p style={S.emptyText}>No {gamesFilter} markets.</p></div>}

            {/* FUTURES */}
            {activeTab === "futures" && displayMarkets.map(market => {
              const meta = leagueMeta(market.subtitle);
              const totalMkt = (market.options || []).reduce((s, o) => s + (optionTotals[o.id] || 0), 0);
              return (
                <div key={market.id} style={S.marketCard}>
                  <div style={S.marketTop}>
                    <span style={{ ...S.leagueTag, color: meta.color, background: meta.bg }}>{meta.tag}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {market.maxBet && <span style={S.maxBetTag}>Max ${market.maxBet}</span>}
                      {market.status === "paused" && <span style={{ ...S.maxBetTag, color: "#d97706", background: "#fffbeb" }}>PAUSED</span>}
                      {market.status === "settled" && <span style={{ ...S.maxBetTag, color: "#16a34a", background: "#f0fdf4" }}>SETTLED</span>}
                    </div>
                  </div>
                  <h3 style={S.marketTitle}>{market.title}</h3>
                  <p style={S.marketSubtitle}>{market.subtitle}</p>
                  {market.status === "settled" && (
                    <div style={S.winnerBar}>
                      {market.winner === "push" ? `${I.undo} Push - bets refunded` : `${I.trophy} ${(market.options || []).find(o => o.id === market.winner)?.label || "Unknown"} wins`}
                    </div>
                  )}
                  <div style={S.futureGrid}>
                    {(market.options || []).map(opt => {
                      const isElim = (market.eliminated || []).includes(opt.id);
                      const sel = !!betSlip[opt.id];
                      const dis = market.status !== "open" || isElim;
                      const totalOnOpt = optionTotals[opt.id] || 0;
                      const pct = totalMkt > 0 ? (totalOnOpt / totalMkt) * 100 : 0;
                      return (
                        <div key={opt.id} style={{ ...S.futOpt, ...(sel ? S.futOptSel : {}), ...(dis ? S.futOptDis : {}) }}
                          onClick={() => !dis && toggleSlip(opt, market.id, market)}>
                          <span style={S.futOptLabel}>{isElim ? `${I.cross} ${opt.label}` : opt.label}</span>
                          <span style={{ ...S.futOptOdds, color: sel ? "#f8fafc" : opt.odds > 0 ? "#4ade80" : "#f8fafc" }}>{fmt(opt.odds)}</span>
                          {totalMkt > 0 && <div style={S.futOptBar}><div style={{ ...S.futOptBarFill, width: `${pct}%` }} /></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* GAMES (grouped: ML + Spread + O/U) */}
            {activeTab === "games" && (() => {
              const grouped = [];
              const used = new Set();
              for (const m of displayMarkets) {
                if (used.has(m.id)) continue;
                const baseTitle = (m.title || "").replace(/ - Spread$/, "").replace(/ - O\/U [\d.]+$/, "");
                const isBase = m.title === baseTitle;
                if (!isBase) continue;
                const sp = displayMarkets.find(x => x.title === `${baseTitle} - Spread`);
                const ou = displayMarkets.find(x => (x.title || "").startsWith(`${baseTitle} - O/U`));
                [m.id, sp?.id, ou?.id].filter(Boolean).forEach(id => used.add(id));
                grouped.push({ ml: m, sp: sp || null, ou: ou || null });
              }
              for (const m of displayMarkets) {
                if (!used.has(m.id)) { grouped.push({ ml: m, sp: null, ou: null }); used.add(m.id); }
              }

              return grouped.map(({ ml, sp, ou }) => {
                const meta = leagueMeta(ml.subtitle);
                const allMkts = [ml, sp, ou].filter(Boolean);
                const anyPaused = allMkts.some(m => m.status === "paused");
                const allSettled = allMkts.every(m => m.status === "settled");
                const totalAction = allMkts.reduce((s, m) => s + (m.options || []).reduce((ss, o) => ss + (optionTotals[o.id] || 0), 0), 0);
                const hasSpread = !!sp, hasOU = !!ou;

                return (
                  <div key={ml.id} style={S.marketCard}>
                    <div style={S.marketTop}>
                      <span style={{ ...S.leagueTag, color: meta.color, background: meta.bg }}>{meta.tag}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {ml.maxBet && <span style={S.maxBetTag}>Max ${ml.maxBet}</span>}
                        {anyPaused && <span style={{ ...S.maxBetTag, color: "#d97706", background: "#fffbeb" }}>PAUSED</span>}
                        {allSettled && <span style={{ ...S.maxBetTag, color: "#16a34a", background: "#f0fdf4" }}>SETTLED</span>}
                      </div>
                    </div>
                    <h3 style={S.marketTitle}>{ml.title}</h3>
                    <p style={S.marketSubtitle}>{ml.subtitle}{totalAction > 0 && ` ${I.bullet} $${totalAction.toFixed(0)} action`}</p>
                    {ml.status === "settled" && (
                      <div style={GS.winnerBar}>
                        {ml.winner === "push" ? `${I.undo} Push - bets refunded` : `${I.trophy} ${(ml.options || []).find(o => o.id === ml.winner)?.label || "Unknown"} wins`}
                      </div>
                    )}

                    {/* Grouped grid: ML first, then Spread, then O/U */}
                    <div style={GS.gridWrap}>
                      <div style={GS.headerRow}>
                        <div style={GS.colHeader}>MONEYLINE</div>
                        {hasSpread && <div style={GS.colHeader}>SPREAD</div>}
                        {hasOU && <div style={GS.colHeader}>O/U</div>}
                      </div>
                      <div style={GS.row}>
                        {renderCell((ml.options || [])[0], ml, "ml")}
                        {hasSpread && renderCell((sp.options || [])[0], sp, "spread")}
                        {hasOU && renderCell((ou.options || [])[0], ou, "ou")}
                      </div>
                      <div style={GS.row}>
                        {renderCell((ml.options || [])[1], ml, "ml")}
                        {hasSpread && renderCell((sp.options || [])[1], sp, "spread")}
                        {hasOU && renderCell((ou.options || [])[1], ou, "ou")}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </>
        )}

        {/* STANDINGS */}
        {activeTab === "leaderboard" && leaderboardVisible && (
          <div>
            {leaderboard.map(p => {
              const lifetime = getUserLifetimePnL(p.name);
              return (
                <div key={p.name} style={{ ...S.boardRow, ...(p.name === username ? S.boardRowMe : {}) }}>
                  <span style={S.boardRank}>#{p._rank}</span>
                  <span style={S.boardName}>{p.name}{p.name === username && " (you)"}</span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={S.boardTotal}>${p.total.toFixed(0)}</span>
                    <span style={{ fontSize: 10, color: lifetime >= 0 ? "#4ade80" : "#f87171" }}>
                      {lifetime >= 0 ? "+" : ""}${lifetime.toFixed(0)} lifetime
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MY BETS */}
        {activeTab === "mybets" && (
          <div>
            {userBets.length === 0 && <div style={S.empty}><p style={S.emptyText}>No bets yet.</p></div>}
            {[...userBets].reverse().map(b => (
              <div key={b.id} style={S.betCard}>
                <div style={S.betCardTop}>
                  <span style={{ ...S.betType, color: b.betType === "parlay" ? "#a78bfa" : "#60a5fa" }}>
                    {b.betType === "parlay" ? `${(b.legs || []).length}-LEG PARLAY` : "STRAIGHT"}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: b.status === "won" ? "#4ade80" : b.status === "lost" ? "#f87171" : b.status === "pushed" ? "#60a5fa" : "#fbbf24" }}>
                    {b.status === "won" ? `${I.check} WON` : b.status === "lost" ? `${I.cross} LOST` : b.status === "pushed" ? `${I.undo} PUSH` : `${I.pending} PENDING`}
                  </span>
                </div>
                {b.betType === "straight" ? (
                  <>
                    <p style={S.betLine}><strong>{b.optionLabel}</strong> ({fmt(b.odds)})</p>
                    <p style={S.betMarket}>{b.marketTitle}</p>
                  </>
                ) : (
                  <div>
                    {(b.legs || []).map((l, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, color: l.status === "won" ? "#4ade80" : l.status === "lost" ? "#f87171" : l.status === "pushed" ? "#60a5fa" : "#cbd5e1" }}>
                        <span>{l.optionLabel} ({fmt(l.odds)})</span>
                        <span>{l.status === "won" ? I.check : l.status === "lost" ? I.cross : l.status === "pushed" ? I.undo : I.pending}</span>
                      </div>
                    ))}
                    <p style={{ ...S.betMarket, marginTop: 6 }}>Combined: {fmt(b.combinedOdds)}</p>
                  </div>
                )}
                <div style={S.betBottom}>
                  <span style={{ color: "#cbd5e1" }}>${b.stake.toFixed(2)} stake</span>
                  <span style={{ color: b.status === "won" ? "#4ade80" : "#cbd5e1" }}>
                    {b.status === "won" ? "Paid: " : "To win: "}${b.payout?.toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{fmtTime(b.placedAt)}</div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* BET SLIP */}
      {slipLegs.length > 0 && (
        <div style={S.slipBar}>
          <div style={S.slipHeader}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", letterSpacing: 0.5 }}>BET SLIP ({slipLegs.length})</span>
            <button style={S.slipClear} onClick={() => { setBetSlip({}); setParlayStake(""); }}>Clear</button>
          </div>
          {slipLegs.map(l => (
            <div key={l.optionId} style={S.slipLeg}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.optionLabel}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{fmt(l.odds)} - {l.marketTitle}</div>
              </div>
              <input type="number" placeholder="$" style={S.slipStake}
                value={l.stake} onChange={e => setSlipStake(l.optionId, e.target.value)} />
              <button style={S.slipX} onClick={() => { const ns = { ...betSlip }; delete ns[l.optionId]; setBetSlip(ns); }}>X</button>
            </div>
          ))}
          {hasSameGameConflict && (
            <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontSize: 11, textAlign: "center", borderRadius: 6, margin: "0 12px 8px" }}>
              Cannot parlay Moneyline + Spread from the same game
            </div>
          )}
          {slipLegs.length === 1 && (
            <div style={S.slipFooter}>
              <button style={S.placeBtn} onClick={() => { const l = slipLegs[0]; placeStraight(l.optionId, parseFloat(l.stake)); }}
                disabled={!(parseFloat(slipLegs[0]?.stake) > 0)}>
                Place ${parseFloat(slipLegs[0]?.stake || 0).toFixed(2)} {I.arrow} ${straightPayout.toFixed(2)}
              </button>
            </div>
          )}
          {slipLegs.length > 1 && (
            <div style={S.slipFooter}>
              {straightTotal > 0 && (
                <button style={{ ...S.placeBtn, background: "#0ea5e9", marginBottom: 6 }} onClick={placeAllStraights}>
                  Place {slipLegs.filter(l => parseFloat(l.stake) > 0).length} straights (${straightTotal.toFixed(2)})
                </button>
              )}
              {parlayEligible ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="number" placeholder="Parlay stake $" style={{ ...S.slipStake, flex: 1, width: "auto", height: 40 }}
                    value={parlayStake} onChange={e => setParlayStake(e.target.value)} />
                  <button style={{ ...S.placeBtn, flex: 2 }} onClick={placeParlay}
                    disabled={!(parseFloat(parlayStake) > 0)}>
                    Parlay {parlayOdds && fmt(parlayOdds)} {I.arrow} ${parlayPayout.toFixed(2)}
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: 6 }}>
                  {slipHasFuture ? "Futures cannot be parlayed" : "Add legs from different games to parlay"}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ──
const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const DISPLAY = "'Barlow Condensed', -apple-system, sans-serif";

const S = {
  // Login
  loginWrap: { minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT, position: "relative" },
  loginBg: { position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 20%, rgba(99,102,241,0.05), transparent 60%), radial-gradient(circle at 70% 80%, rgba(168,85,247,0.04), transparent 60%)", pointerEvents: "none" },
  loginCard: { position: "relative", background: "#ffffff", borderRadius: 20, padding: "32px 28px", maxWidth: 400, width: "100%", boxShadow: "0 10px 30px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", gap: 14 },
  loginLogoRow: { display: "flex", alignItems: "center", gap: 12 },
  loginLogoIcon: { fontSize: 28 },
  loginLogoTitle: { fontFamily: DISPLAY, fontSize: 22, fontWeight: 900, letterSpacing: 1, color: "#0f172a" },
  loginLogoSub: { fontSize: 12, color: "#64748b" },
  loginDivider: { height: 1, background: "#f1f5f9", margin: "4px 0" },
  loginLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#64748b" },
  input: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", fontFamily: FONT, fontSize: 14, color: "#0f172a", outline: "none", width: "100%", boxSizing: "border-box" },
  btnPrimary: { background: "#0f172a", color: "#f8fafc", border: "none", borderRadius: 10, padding: "12px 16px", fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3 },
  btnGhost: { background: "transparent", color: "#64748b", border: "none", padding: "8px", fontFamily: FONT, fontSize: 12, cursor: "pointer" },

  // Lobby
  wrap: { minHeight: "100vh", background: "#0a0f1a", fontFamily: FONT, color: "#f8fafc", paddingBottom: 120 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #1e293b", background: "#0a0f1a", position: "sticky", top: 0, zIndex: 50 },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  headerIcon: { fontSize: 22 },
  headerLogo: { fontFamily: DISPLAY, fontSize: 16, fontWeight: 900, letterSpacing: 1, color: "#f8fafc" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  balancePill: { display: "flex", alignItems: "center", gap: 2, background: "#1e293b", padding: "6px 12px", borderRadius: 20 },
  balanceDollar: { fontSize: 11, color: "#64748b" },
  balanceAmt: { fontFamily: DISPLAY, fontSize: 18, fontWeight: 800, color: "#fbbf24" },
  avatarBtn: { width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontFamily: DISPLAY, fontSize: 16, fontWeight: 800 },
  headerBanner: { padding: "10px 16px", background: "#1e293b", color: "#fbbf24", fontSize: 13, textAlign: "center", borderBottom: "1px solid #334155" },

  notify: { position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", padding: "10px 16px", background: "#1e293b", color: "#f8fafc", borderRadius: 10, fontSize: 13, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.3)", border: "1px solid #334155" },

  tabs: { display: "flex", background: "#0a0f1a", borderBottom: "1px solid #1e293b", padding: "0 8px", position: "sticky", top: 64, zIndex: 49, overflowX: "auto" },
  tab: { background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "#64748b", padding: "12px 14px", fontFamily: FONT, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", letterSpacing: 0.3 },
  tabActive: { color: "#f8fafc", borderBottom: "2px solid #6366f1" },

  subTabs: { display: "flex", borderBottom: "1px solid #1e2d3d", background: "#07111a", padding: "0 12px", position: "sticky", top: 105, zIndex: 48 },
  subTab: { background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "#4a6280", padding: "8px 14px", fontFamily: FONT, fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: 0.3 },
  subTabActive: { color: "#f8fafc", borderBottom: "2px solid #60a5fa" },

  content: { padding: 14 },
  empty: { padding: 40, textAlign: "center" },
  emptyText: { color: "#64748b", fontSize: 13 },

  marketCard: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 14, marginBottom: 12 },
  marketTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  leagueTag: { fontSize: 9, fontWeight: 800, letterSpacing: 1.5, padding: "2px 8px", borderRadius: 4 },
  maxBetTag: { fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "#1e293b", padding: "2px 8px", borderRadius: 4 },
  marketTitle: { fontFamily: DISPLAY, fontSize: 18, fontWeight: 800, color: "#f8fafc", margin: "0 0 4px", letterSpacing: 0.3 },
  marketSubtitle: { fontSize: 11, color: "#64748b", margin: "0 0 10px" },
  winnerBar: { padding: "8px 12px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, fontSize: 12, color: "#4ade80", textAlign: "center", marginBottom: 10, fontWeight: 600 },

  futureGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 },
  futOpt: { display: "flex", flexDirection: "column", padding: "10px 12px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, cursor: "pointer", position: "relative", overflow: "hidden" },
  futOptSel: { background: "#6366f1", borderColor: "#6366f1" },
  futOptDis: { opacity: 0.4, cursor: "not-allowed" },
  futOptLabel: { fontSize: 12, color: "#cbd5e1", fontWeight: 600, marginBottom: 2 },
  futOptOdds: { fontFamily: DISPLAY, fontSize: 16, fontWeight: 800, letterSpacing: 0.3 },
  futOptBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "#0a0f1a" },
  futOptBarFill: { height: "100%", background: "linear-gradient(90deg, #6366f1, #8b5cf6)" },

  // Bet slip
  slipBar: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#0f172a", borderTop: "1px solid #1e293b", padding: "10px 12px", zIndex: 100, maxHeight: "50vh", overflowY: "auto" },
  slipHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  slipClear: { background: "transparent", border: "1px solid #334155", color: "#94a3b8", padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: FONT },
  slipLeg: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#1e293b", borderRadius: 8, marginBottom: 6 },
  slipStake: { width: 70, height: 32, padding: "4px 8px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: 6, fontFamily: FONT, fontSize: 13, textAlign: "center", outline: "none", boxSizing: "border-box" },
  slipX: { background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: "0 4px" },
  slipFooter: { marginTop: 6 },
  placeBtn: { width: "100%", background: "#22c55e", color: "#0a0f1a", border: "none", borderRadius: 8, padding: "12px 16px", fontFamily: FONT, fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3 },

  // My bets
  betCard: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 12, marginBottom: 10 },
  betCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  betType: { fontSize: 10, fontWeight: 800, letterSpacing: 1.2 },
  betLine: { fontSize: 14, color: "#f8fafc", margin: "0 0 2px" },
  betMarket: { fontSize: 11, color: "#94a3b8", margin: 0 },
  betBottom: { display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, fontWeight: 600 },

  // Leaderboard
  boardRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, marginBottom: 6 },
  boardRowMe: { borderColor: "#6366f1", background: "rgba(99,102,241,0.05)" },
  boardRank: { fontFamily: DISPLAY, fontSize: 16, fontWeight: 800, color: "#fbbf24", width: 32 },
  boardName: { flex: 1, fontSize: 14, fontWeight: 600, color: "#f8fafc" },
  boardTotal: { fontFamily: DISPLAY, fontSize: 16, fontWeight: 800, color: "#4ade80" },

  // Admin
  adminWrap: { minHeight: "100vh", background: "#f8fafc", fontFamily: FONT, color: "#0f172a" },
  adminHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 50 },
  backBtn: { background: "transparent", border: "1px solid #e2e8f0", color: "#64748b", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: FONT, fontSize: 12 },
  adminTitle: { fontFamily: DISPLAY, fontSize: 16, fontWeight: 900, letterSpacing: 1.5 },
  adminTabs: { display: "flex", borderBottom: "1px solid #e2e8f0", background: "#ffffff", padding: "0 8px", overflowX: "auto", position: "sticky", top: 56, zIndex: 49 },
  adminTab: { background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "#64748b", padding: "10px 14px", fontFamily: FONT, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  adminTabActive: { color: "#0f172a", borderBottom: "2px solid #6366f1" },
  adminContent: { padding: 16 },
  adminH3: { margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#0f172a", letterSpacing: 0.5 },
  adminMarketCard: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 10 },
  adminMarketTitle: { fontSize: 14, fontWeight: 700, color: "#0f172a", margin: "0 0 2px" },
  adminMarketSubtitle: { fontSize: 11, color: "#64748b", margin: "0 0 8px" },
  settleOptions: { display: "flex", flexDirection: "column", gap: 6, marginTop: 8 },
  settleBtn: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", padding: "8px 12px", borderRadius: 8, fontFamily: FONT, fontSize: 12, cursor: "pointer", fontWeight: 600 },
  pauseBtn: { background: "#fffbeb", border: "1px solid #fde68a", color: "#d97706", padding: "5px 10px", borderRadius: 6, fontFamily: FONT, fontSize: 11, cursor: "pointer" },
  winnerText: { fontSize: 13, color: "#16a34a", fontWeight: 700, margin: 0 },
  playerRow: { padding: "10px 12px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 8 },
  playerRank: { fontFamily: DISPLAY, fontSize: 14, fontWeight: 800, color: "#fbbf24" },
  playerName: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
  miniBtn: { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a", padding: "6px 10px", borderRadius: 6, fontFamily: FONT, fontSize: 11, cursor: "pointer", fontWeight: 500 },
  formRow: { marginBottom: 12 },
  formLabel: { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#64748b", marginBottom: 5 },
};

// Grouped game card cell styles
const GS = {
  gridWrap: { display: "flex", flexDirection: "column", gap: 4 },
  headerRow: { display: "flex", gap: 6, padding: "0 2px" },
  colHeader: { flex: 1, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "#4a6280", textAlign: "center", padding: "0 2px", textTransform: "uppercase" },
  row: { display: "flex", gap: 6 },
  cell: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 8px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, cursor: "pointer", minHeight: 56, position: "relative", overflow: "hidden" },
  cellSelected: { background: "#6366f1", borderColor: "#6366f1" },
  cellDisabled: { opacity: 0.4, cursor: "not-allowed" },
  cellLabel: { fontSize: 11, color: "#cbd5e1", fontWeight: 500, marginBottom: 4, textAlign: "center", lineHeight: 1.2 },
  cellOdds: { fontFamily: DISPLAY, fontSize: 18, fontWeight: 800, letterSpacing: 0.3 },
  cellBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "#0a0f1a" },
  cellBarFill: { height: "100%", background: "linear-gradient(90deg, #6366f1, #8b5cf6)" },
  winnerBar: { padding: "6px 10px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, fontSize: 11, color: "#4ade80", textAlign: "center", marginBottom: 8, fontWeight: 600 },
};
