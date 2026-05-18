import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

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
  const s = (subtitle || "").toLowerCase();
  if (s.includes("lunar")) return { tag: "LUNAR", color: "#1E5FFF", bg: "rgba(30,95,255,0.08)" };
  if (s.includes("galactic")) return { tag: "GALACTIC", color: "#C93DD9", bg: "rgba(201,61,217,0.08)" };
  if (s.includes("toos") || s.includes("championship")) return { tag: "ToOS", color: "#FFB800", bg: "rgba(255,184,0,0.10)" };
  return { tag: "FUTURE", color: "#6571A0", bg: "rgba(101,113,160,0.08)" };
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
  const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', system-ui, sans-serif";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "#2A3970", textAlign: "center", fontWeight: 500, fontFamily: SANS }}>{label}</p>
        {sublabel && <p style={{ margin: 0, fontSize: 11, color: "#6571A0", textAlign: "center", fontFamily: SANS }}>{sublabel}</p>}
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: i < value.length ? "#0A1747" : "transparent", border: `1.5px solid ${i < value.length ? "#0A1747" : error ? "#E0254E" : "#DDE0EE"}`, transition: "all 0.15s" }} />
        ))}
      </div>
      {error && <p style={{ margin: "-8px 0 -4px", fontSize: 13, color: "#E0254E", textAlign: "center", fontFamily: SANS, fontWeight: 500 }}>{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, width: 200 }}>
        {keys.map((k, i) => (
          <button key={i} onClick={() => press(k)} style={{ height: 52, background: k === "" ? "transparent" : "#FFFFFF", border: k === "" ? "none" : "1px solid #DDE0EE", borderRadius: 4, color: k === "\u232B" ? "#6571A0" : "#0A1747", fontSize: k === "\u232B" ? 16 : 18, fontWeight: 700, cursor: k === "" ? "default" : "pointer", fontFamily: SANS, fontVariantNumeric: "tabular-nums", pointerEvents: k === "" ? "none" : "auto" }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}


// ── Design tokens (BOOKD) ────────────────────────────────────────────────
const C = {
  bg: "#FBFAFF", rail: "#EEF0FA", tile: "#FFFFFF",
  tileHot: "#FFE9EB", tilePos: "#E2F7E9",
  line: "#DDE0EE", lineAccent: "#F3A5A5", linePos: "#A3D8B3",
  ink: "#0A1747", ink2: "#2A3970", sub: "#6571A0",
  accent: "#E0254E", pos: "#15A35A", gold: "#FFB800",
  activeNav: "#E2E7FB",
  catSports: "#1E5FFF", catPolitics: "#15A35A", catPop: "#C93DD9",
  catPersonal: "#FF6A1F", catMadeup: "#FFB800",
};
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', system-ui, sans-serif";
const TAB = { fontVariantNumeric: "tabular-nums" };

// ── Icon set (text glyphs only — system fonts, no Google Font) ──
const I = {
  check: "\u2713", cross: "\u2717", undo: "\u21BA",
  pending: "\u00B7\u00B7\u00B7", arrow: "\u2192",
  pause: "\u275A\u275A", play: "\u25B6",
  plus: "+", dot: "\u25CF", bullet: "\u00B7",
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
  const [screen, setScreen] = useState("login");
  const [username, setUsername] = useState("");
  const [loginStep, setLoginStep] = useState("name");
  const [inputName, setInputName] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingPin, setPendingPin] = useState("");
  const [notification, setNotification] = useState("");

  // ── Lobby state ─────────
  const [activeTab, setActiveTab] = useState("games");
  const [gamesFilter, setGamesFilter] = useState("open");
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

  useEffect(() => {
    if (screen !== "lobby") return;
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => { setScreen("login"); setUsername(""); setBetSlip({}); }, 30 * 60 * 1000); };
    reset();
    ["mousemove", "keydown", "click", "touchstart"].forEach(e => window.addEventListener(e, reset));
    return () => { clearTimeout(timer); ["mousemove", "keydown", "click", "touchstart"].forEach(e => window.removeEventListener(e, reset)); };
  }, [screen]);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(""), 3000);
    return () => clearTimeout(t);
  }, [notification]);

  useEffect(() => { if (!leaderboardVisible && activeTab === "leaderboard") setActiveTab("games"); }, [leaderboardVisible]);

  function notify(msg) { setNotification(msg); }

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
      } else { setPinError("PINs do not match"); setPinInput(""); setLoginStep("pin_create"); setPendingPin(""); }
    }
  }

  function resetLoginToName() { setLoginStep("name"); setPinInput(""); setPinError(""); setPendingPin(""); }

  // ── Derived state ─────────
  const allMarkets = [...(markets.games || []), ...(markets.futures || [])];
  const balance = users[username]?.balance ?? STARTING_BALANCE;
  const userBets = bets.filter(b => b.username === username);

  const slipEntries = Object.entries(betSlip);
  const slipLegs = slipEntries.map(([optId, v]) => {
    const market = allMarkets.find(m => m.id === v.marketId);
    const option = (market?.options || []).find(o => o.id === optId);
    return { optionId: optId, marketId: v.marketId, marketTitle: market?.title, optionLabel: option?.label, odds: option?.odds, stake: v.stake };
  });
  const multiMarket = new Set(slipEntries.map(([, v]) => v.marketId)).size > 1;
  const slipHasFuture = slipLegs.some(l => allMarkets.find(m => m.id === l.marketId)?.type === "future");

  const getBaseTitle = (title) => (title || "").replace(/ - Spread$/, "").replace(/ - O\/U [\d.]+$/, "");

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

  const optionTotals = {};
  for (const b of bets) {
    if (b.betType === "straight") optionTotals[b.optionId] = (optionTotals[b.optionId] || 0) + b.stake;
    else if (b.betType === "parlay") for (const leg of (b.legs || [])) optionTotals[leg.optionId] = (optionTotals[leg.optionId] || 0) + b.stake;
  }

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

  const rawGames = markets.games || [];
  const rawFutures = markets.futures || [];
  const displayMarkets = activeTab === "games"
    ? (gamesFilter === "open"
        ? rawGames.filter(m => m.status === "open" || m.status === "paused")
        : rawGames.filter(m => m.status === "settled"))
    : (gamesFilter === "open"
        ? rawFutures.filter(m => m.status === "open" || m.status === "paused")
        : rawFutures.filter(m => m.status === "settled"));

  function getHouseLifetimePnL() {
    let total = 0;
    for (const b of bets) {
      if (b.status === "won") total -= (b.payout - b.stake);
      else if (b.status === "lost") total += b.stake;
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
  function getMarketPnL(marketId) {
    const relevant = bets.filter(b => {
      if (b.betType === "straight") return b.marketId === marketId && (b.status === "won" || b.status === "lost" || b.status === "pushed");
      if (b.betType === "parlay") return (b.legs || []).some(l => l.marketId === marketId) && (b.status === "won" || b.status === "lost" || b.status === "pushed");
      return false;
    });
    let staked = 0, paid = 0;
    for (const b of relevant) {
      staked += b.stake;
      if (b.status === "won") paid += b.payout;
      if (b.status === "pushed") paid += b.stake;
    }
    return staked - paid;
  }

  // ── Action handlers ──
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
    notify(`Parlay placed: $${stake} ${I.arrow} $${payout.toFixed(2)}`);
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

  // ── Render helpers (plain functions, NOT components-in-map) ──
  function renderCell(opt, market, label) {
    if (!opt) return <div style={GS.cellEmpty} />;
    const isElim = (market.eliminated || []).includes(opt.id);
    if (isElim) return <div style={{ ...GS.cell, opacity: 0.4, cursor: "not-allowed" }}><div style={GS.cellLabel}>OUT</div><div style={GS.cellOdds}>—</div></div>;
    const selected = !!betSlip[opt.id];
    const disabled = market.status !== "open";
    const userHasBet = bets.some(b => b.username === username && (
      (b.betType === "straight" && b.optionId === opt.id) ||
      (b.betType === "parlay" && (b.legs || []).some(l => l.optionId === opt.id))
    ));
    const totalOnOpt = optionTotals[opt.id] || 0;
    const totalOnMkt = (market.options || []).reduce((s, o) => s + (optionTotals[o.id] || 0), 0);
    const pct = totalOnMkt > 0 ? (totalOnOpt / totalOnMkt) * 100 : 0;
    // "Hot" = >70% of mkt action and >2x other side
    const others = (market.options || []).filter(o => o.id !== opt.id).reduce((s, o) => s + (optionTotals[o.id] || 0), 0);
    const isHot = totalOnOpt > others * 2 && totalOnMkt > 50;

    const style = {
      ...GS.cell,
      ...(userHasBet ? { background: C.tilePos, borderColor: C.linePos } : {}),
      ...(isHot && !userHasBet ? { background: C.tileHot, borderColor: C.lineAccent } : {}),
      ...(selected ? { background: C.ink, borderColor: C.ink, color: "#fff" } : {}),
      ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}),
    };
    const oddsColor = selected ? "#fff"
      : userHasBet ? C.pos
      : isHot ? C.accent
      : opt.odds > 0 ? C.pos
      : C.ink;
    return (
      <div style={style} onClick={() => !disabled && toggleSlip(opt, market.id, market)}>
        <div style={{ ...GS.cellLabel, color: selected ? "rgba(255,255,255,0.7)" : C.sub }}>{label || opt.label}</div>
        <div style={{ ...GS.cellOdds, color: oddsColor }}>{fmt(opt.odds)}</div>
        {totalOnMkt > 0 && <div style={GS.cellBar}><div style={{ ...GS.cellBarFill, width: `${pct}%`, background: selected ? "rgba(255,255,255,0.4)" : isHot ? C.accent : C.ink2 }} /></div>}
      </div>
    );
  }

  // Team chip: takes label, returns 22x22 colored block with 3-letter code
  function teamChip(label, color) {
    const code = (label || "")
      .replace(/[^A-Za-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "—";
    return (
      <div style={{ width: 22, height: 22, borderRadius: 4, background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", letterSpacing: 0.3, fontFamily: SANS }}>{code}</span>
      </div>
    );
  }

  // ── LOGIN SCREEN ──
  if (screen === "login") {
    const name = inputName.trim();
    return (
      <div style={S.loginWrap}>
        <div style={S.loginCard}>
          <div style={S.loginLogoRow}>
            <div style={S.loginLogoBlock} />
            <div>
              <div style={S.loginLogoTitle}>BOOKD</div>
              <div style={S.loginLogoSub}>Custom bets between friends</div>
            </div>
          </div>
          {loginStep === "name" && (<>
            <label style={S.loginLabel}>PLAYER NAME</label>
            <input style={S.input} placeholder="your name..." value={inputName}
              onChange={e => setInputName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && inputName.trim() && handleNameSubmit()} autoFocus />
            {pinError && <p style={{ margin: "-6px 0 0", fontSize: 13, color: C.accent, fontWeight: 500 }}>{pinError}</p>}
            <button style={{ ...S.btnPrimary, opacity: inputName.trim() ? 1 : 0.4 }} onClick={handleNameSubmit} disabled={!inputName.trim()}>CONTINUE</button>
            <button style={S.btnGhost} onClick={() => setScreen("admin")}>admin panel</button>
          </>)}
          {loginStep === "pin_login" && (<>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 2 }}>welcome back,</div>
              <div style={{ fontSize: 18, color: C.ink, fontWeight: 800, letterSpacing: -0.3 }}>{name}</div>
            </div>
            <PinPad value={pinInput} onChange={p => { setPinInput(p); if (pinError) setPinError(""); }} label="Enter your PIN" error={pinError} />
            <button style={S.btnGhost} onClick={resetLoginToName}>back</button>
          </>)}
          {loginStep === "pin_create" && (<>
            <div style={{ background: C.tilePos, border: `1px solid ${C.linePos}`, borderRadius: 6, padding: "12px 14px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 14, color: C.pos, fontWeight: 700, letterSpacing: -0.2 }}>New account</p>
              <p style={{ margin: 0, fontSize: 13, color: C.ink2 }}>No account for <strong style={{ color: C.ink }}>{name}</strong>. Pick a PIN to create one.</p>
            </div>
            <PinPad value={pinInput} onChange={setPinInput} label="Choose a 4-digit PIN" sublabel="You will use this to log in" />
            <button style={S.btnGhost} onClick={resetLoginToName}>back</button>
          </>)}
          {loginStep === "pin_confirm" && (<>
            <PinPad value={pinInput} onChange={p => { setPinInput(p); if (pinError) setPinError(""); }} label="Confirm your PIN" sublabel="Enter it again" error={pinError} />
            <button style={S.btnGhost} onClick={() => { setLoginStep("pin_create"); setPinInput(""); setPinError(""); }}>back</button>
          </>)}
        </div>
      </div>
    );
  }

  // ── ADMIN ──
  if (screen === "admin") {
    if (!adminUnlocked) {
      return (
        <div style={S.loginWrap}>
          <div style={S.loginCard}>
            <div style={S.loginLogoRow}>
              <div style={{ ...S.loginLogoBlock, background: `linear-gradient(135deg, ${C.ink} 0%, ${C.ink2} 100%)` }} />
              <div>
                <div style={S.loginLogoTitle}>ADMIN</div>
                <div style={S.loginLogoSub}>Restricted access</div>
              </div>
            </div>
            <label style={S.loginLabel}>ADMIN CODE</label>
            <input type="password" style={S.input} placeholder="Enter admin code"
              value={adminPin}
              onChange={e => setAdminPin(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  if (adminPin === ADMIN_PIN) { setAdminUnlocked(true); setAdminPin(""); }
                  else { setAdminPin(""); notify("Incorrect code"); }
                }
              }}
              autoFocus />
            <button style={{ ...S.btnPrimary, opacity: adminPin ? 1 : 0.4 }}
              onClick={() => {
                if (adminPin === ADMIN_PIN) { setAdminUnlocked(true); setAdminPin(""); }
                else { setAdminPin(""); notify("Incorrect code"); }
              }}
              disabled={!adminPin}>UNLOCK</button>
            <button style={S.btnGhost} onClick={() => { setAdminPin(""); setScreen("login"); }}>back to login</button>
          </div>
        </div>
      );
    }

    return (
      <div style={S.adminWrap}>
        <div style={S.adminHeader}>
          <button style={S.btnSecondary} onClick={() => { setAdminUnlocked(false); setAdminPin(""); setScreen("login"); }}>BACK</button>
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
                <button style={{ ...S.btnGold, flex: 1 }} onClick={pauseAllMarkets}>{I.pause} PAUSE ALL</button>
                <button style={{ ...S.btnPrimary, flex: 1 }} onClick={unpauseAllMarkets}>{I.play} OPEN ALL</button>
              </div>
              <div style={S.statBox}>
                <span style={{ ...S.eyebrow, color: C.sub }}>LIFETIME HOUSE P&L</span>
                <span style={{ ...TAB, color: getHouseLifetimePnL() >= 0 ? C.pos : C.accent, fontWeight: 800, fontSize: 18, marginLeft: 12, letterSpacing: -0.4 }}>
                  ${getHouseLifetimePnL().toFixed(2)}
                </span>
              </div>
              {allMarkets.map(market => {
                const meta = leagueMeta(market.subtitle);
                const totalAction = (market.options || []).reduce((s, o) => s + (optionTotals[o.id] || 0), 0);
                return (
                  <div key={market.id} style={S.adminCard}>
                    <div style={{ height: 4, background: meta.color, marginLeft: -16, marginRight: -16, marginTop: -16, marginBottom: 12 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ ...S.catBadge, background: meta.color }}>{meta.tag}</span>
                        <p style={S.adminCardTitle}>{market.title}</p>
                        <p style={S.adminCardSub}>{market.subtitle}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ ...TAB, fontSize: 13, color: C.sub, fontWeight: 500 }}>${totalAction.toFixed(0)} action</span>
                        <button style={S.btnGold} onClick={() => togglePauseMarket(market.id)}>
                          {market.status === "paused" ? `${I.play} OPEN` : `${I.pause} PAUSE`}
                        </button>
                      </div>
                    </div>

                    {market.status !== "settled" && (market.options || []).map(opt => {
                      const onOpt = optionTotals[opt.id] || 0;
                      return (
                        <div key={opt.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.sub, padding: "3px 0", fontWeight: 500 }}>
                          <span>{opt.label} ({fmt(opt.odds)})</span>
                          <span style={TAB}>${onOpt.toFixed(0)}</span>
                        </div>
                      );
                    })}

                    {(market.status === "open" || market.status === "paused") ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                        {(market.options || []).map(opt => {
                          const isElim = (market.eliminated || []).includes(opt.id);
                          if (isElim) return (
                            <div key={opt.id} style={{ padding: "8px 12px", background: C.tileHot, border: `1px solid ${C.lineAccent}`, borderRadius: 4, fontSize: 13, color: C.accent, opacity: 0.7, fontWeight: 500 }}>
                              {I.cross} {opt.label} — Eliminated
                            </div>
                          );
                          return (
                            <div key={opt.id} style={{ display: "flex", gap: 6 }}>
                              <button style={{ ...S.btnPos, flex: 1 }} onClick={() => { if (window.confirm(`Settle ${opt.label} as winner?`)) settleMarket(market.id, opt.id); }}>
                                {I.check} {opt.label}
                              </button>
                              {market.type === "future" && (
                                <button style={{ ...S.btnAccent, flex: "0 0 auto" }}
                                  onClick={() => { if (window.confirm(`Eliminate ${opt.label}? Pending bets become losses. Historical bets preserved.`)) eliminateOption(market.id, opt.id); }}>
                                  {I.cross} OUT
                                </button>
                              )}
                            </div>
                          );
                        })}
                        <button style={{ ...S.btnGold }}
                          onClick={() => { if (window.confirm(`Push "${market.title}"? Pending bets get stake refunded. Parlay legs are removed.`)) pushMarket(market.id); }}>
                          {I.undo} PUSH / TIE (REFUND ALL)
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <p style={{ fontSize: 14, color: C.pos, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>
                            {market.winner === "push" ? `${I.undo} Push — bets refunded` : `${I.check} ${(market.options || []).find(o => o.id === market.winner)?.label || "Unknown"}`}
                          </p>
                          <button style={{ ...S.btnSecondary, fontSize: 11, padding: "4px 10px" }}
                            onClick={() => { if (window.confirm("Unsettle this market? Reverses payouts.")) unsettleMarket(market.id); }}>
                            UNSETTLE
                          </button>
                        </div>
                        <div style={{ fontSize: 13, color: C.sub, ...TAB }}>House P&L: ${getMarketPnL(market.id).toFixed(2)}</div>
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
              {leaderboard.map(p => {
                const lifetime = getUserLifetimePnL(p.name);
                const pin = users[p.name]?.pin || "";
                const shown = revealPin[p.name];
                return (
                  <div key={p.name} style={S.adminCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ ...S.eyebrow, color: C.gold }}>#{p._rank}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: -0.2 }}>{p.name}</span>
                      <span style={{ ...TAB, fontSize: 13, color: C.sub, fontWeight: 500 }}>${(p.u.balance || 0).toFixed(0)} cash + ${p.pendingAmt.toFixed(0)} pending</span>
                      <span style={{ ...TAB, fontSize: 13, color: lifetime >= 0 ? C.pos : C.accent, fontWeight: 700 }}>
                        {lifetime >= 0 ? "+" : ""}${lifetime.toFixed(0)} lifetime
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <button style={S.btnSecondary} onClick={() => setRevealPin({ ...revealPin, [p.name]: !shown })}>
                        {shown ? `PIN: ${pin}` : "SHOW PIN"}
                      </button>
                      <input style={{ ...S.input, width: 80, padding: "6px 10px", fontSize: 13 }}
                        type="number" placeholder="+/-"
                        value={adjustAmt[p.name] || ""}
                        onChange={e => setAdjustAmt({ ...adjustAmt, [p.name]: e.target.value })} />
                      <button style={S.btnSecondary} onClick={() => {
                        const a = parseFloat(adjustAmt[p.name]);
                        if (!isNaN(a)) { adjustBalance(p.name, a); setAdjustAmt({ ...adjustAmt, [p.name]: "" }); }
                      }}>ADJUST</button>
                      <button style={S.btnAccent}
                        onClick={() => { if (window.confirm(`Delete ${p.name}?`)) deleteUser(p.name); }}>DELETE</button>
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
                    <button key={t} style={{ ...S.btnSecondary, ...(addType === t ? { background: C.ink, color: "#fff", borderColor: C.ink } : {}) }}
                      onClick={() => setAddType(t)}>{t.toUpperCase()}</button>
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
                    {addOpts.length > 2 && <button style={S.btnSecondary} onClick={() => setAddOpts(addOpts.filter((_, j) => j !== i))}>X</button>}
                  </div>
                ))}
                <button style={S.btnSecondary} onClick={() => setAddOpts([...addOpts, { label: "", odds: "" }])}>+ ADD OPTION</button>
              </div>

              {addType === "game" && (<>
                <div style={S.formRow}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.ink, fontWeight: 700 }}>
                    <input type="checkbox" checked={addSpread.enabled} onChange={e => setAddSpread({ ...addSpread, enabled: e.target.checked })} />
                    Add Spread Market
                  </label>
                  {addSpread.enabled && (
                    <div style={{ marginTop: 8, padding: 12, background: C.rail, borderRadius: 6 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <select style={S.input} value={addSpread.favorite} onChange={e => setAddSpread({ ...addSpread, favorite: parseInt(e.target.value) })}>
                          <option value="0">{addOpts[0]?.label || "Option 1"} is favorite</option>
                          <option value="1">{addOpts[1]?.label || "Option 2"} is favorite</option>
                        </select>
                        <input style={{ ...S.input, width: 80 }} placeholder="7.5" type="number" step="0.5" value={addSpread.line}
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
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.ink, fontWeight: 700 }}>
                    <input type="checkbox" checked={addOU.enabled} onChange={e => setAddOU({ ...addOU, enabled: e.target.checked })} />
                    Add Over/Under Market
                  </label>
                  {addOU.enabled && (
                    <div style={{ marginTop: 8, padding: 12, background: C.rail, borderRadius: 6 }}>
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
              <button style={{ ...S.btnPrimary, width: "100%" }} onClick={handleAddMarket}>+ CREATE EVENT</button>

              <div style={{ marginTop: 24, padding: 16, background: C.rail, borderRadius: 6 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: 13, color: C.ink, fontWeight: 800, letterSpacing: -0.2 }}>Site Settings</h4>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input style={S.input} type="number" placeholder="Site-wide max bet" value={siteMaxInput} onChange={e => setSiteMaxInput(e.target.value)} />
                  <button style={S.btnSecondary} onClick={async () => {
                    const v = parseFloat(siteMaxInput);
                    await storageSet("mln_site_max_bet", isNaN(v) ? null : v);
                    setSiteMaxBet(isNaN(v) ? null : v); setSiteMaxInput("");
                    notify("Site max bet updated");
                  }}>SET</button>
                  <button style={S.btnSecondary} onClick={async () => {
                    await storageSet("mln_site_max_bet", null); setSiteMaxBet(null); notify("Cleared");
                  }}>CLEAR</button>
                </div>
                <div style={{ fontSize: 13, color: C.sub, marginBottom: 10, ...TAB }}>Current: {siteMaxBet ? `$${siteMaxBet}` : "none"}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <input style={S.input} placeholder="Lobby banner message" value={headerInput} onChange={e => setHeaderInput(e.target.value)} />
                  <button style={S.btnSecondary} onClick={async () => { await storageSet("mln_header_msg", headerInput); setHeaderMsg(headerInput); setHeaderInput(""); notify("Banner updated"); }}>SET</button>
                  <button style={S.btnSecondary} onClick={async () => { await storageSet("mln_header_msg", ""); setHeaderMsg(""); notify("Cleared"); }}>CLEAR</button>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.ink2, fontWeight: 500 }}>
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
                <div key={m.id} style={S.adminCard}>
                  <p style={S.adminCardTitle}>{m.title}</p>
                  <p style={S.adminCardSub}>{m.subtitle} — <span style={{ color: m.status === "open" ? C.pos : m.status === "paused" ? C.gold : C.sub, fontWeight: 700 }}>{m.status}</span></p>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <input style={{ ...S.input, width: 110 }} type="number" placeholder="Max bet"
                      value={editMaxBets[m.id] !== undefined ? editMaxBets[m.id] : (m.maxBet || "")}
                      onChange={e => setEditMaxBets({ ...editMaxBets, [m.id]: e.target.value })} />
                    <button style={S.btnSecondary} onClick={() => {
                      const v = parseFloat(editMaxBets[m.id]);
                      updateMarketMaxBet(m.id, isNaN(v) ? null : v);
                      const ne = { ...editMaxBets }; delete ne[m.id]; setEditMaxBets(ne);
                    }}>SET MAX</button>
                    <button style={S.btnSecondary} onClick={() => togglePauseMarket(m.id)}>
                      {m.status === "paused" ? "REOPEN" : "PAUSE"}
                    </button>
                  </div>
                  <div>
                    {(m.options || []).map(o => (
                      <div key={o.id} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                        <span style={{ flex: 1, fontSize: 13, color: C.ink2 }}>{o.label}</span>
                        <input style={{ ...S.input, width: 90 }} type="number"
                          value={editOdds[o.id] !== undefined ? editOdds[o.id] : o.odds}
                          onChange={e => setEditOdds({ ...editOdds, [o.id]: e.target.value })} />
                        <button style={S.btnSecondary} onClick={() => {
                          const v = parseInt(editOdds[o.id]);
                          if (!isNaN(v)) { updateOptionOdds(m.id, o.id, v); const ne = { ...editOdds }; delete ne[o.id]; setEditOdds(ne); }
                        }}>SET</button>
                      </div>
                    ))}
                  </div>
                  <button style={{ ...S.btnAccent, marginTop: 8 }}
                    onClick={() => { if (window.confirm(`Delete "${m.title}"? Pending stakes refunded.`)) deleteMarket(m.id); }}>
                    DELETE MARKET
                  </button>
                </div>
              ))}
            </div>
          )}

          {adminTab === "bets" && (
            <div>
              <h3 style={S.adminH3}>All Bets ({bets.length})</h3>
              {[...bets].reverse().map(b => (
                <div key={b.id} style={S.adminCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: C.ink, letterSpacing: -0.2 }}>{b.username}</span>
                    <span style={{ ...S.eyebrow, color: b.status === "won" ? C.pos : b.status === "lost" ? C.accent : b.status === "pushed" ? C.catSports : C.gold }}>
                      {b.status === "won" ? `${I.check} WON` : b.status === "lost" ? `${I.cross} LOST` : b.status === "pushed" ? `${I.undo} PUSH` : `${I.pending} PENDING`}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: C.ink2 }}>
                    {b.betType === "straight"
                      ? `${b.optionLabel} (${fmt(b.odds)}) on ${b.marketTitle}`
                      : `${(b.legs || []).length}-leg parlay (${fmt(b.combinedOdds)})`}
                  </div>
                  <div style={{ ...TAB, fontSize: 13, color: C.sub, marginTop: 4 }}>
                    ${b.stake.toFixed(2)} {I.arrow} ${b.payout?.toFixed(2)} {I.bullet} {fmtTime(b.placedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {adminTab === "danger" && (
            <div>
              <h3 style={S.adminH3}>Danger Zone</h3>
              <button style={{ ...S.btnAccent, width: "100%", padding: "14px 18px", fontSize: 13 }} onClick={async () => {
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
  const lifetime = getUserLifetimePnL(username);

  const navItems = [
    { k: "games", l: "Games", dot: C.catSports, n: rawGames.filter(m => m.status === "open" || m.status === "paused").length },
    { k: "futures", l: "Futures", dot: C.catMadeup, n: rawFutures.filter(m => m.status === "open" || m.status === "paused").length },
    leaderboardVisible ? { k: "leaderboard", l: "Standings", dot: C.gold } : null,
    { k: "mybets", l: "My Bets", dot: C.accent, n: userBets.length },
  ].filter(Boolean);

  return (
    <div style={S.lobbyWrap}>
      {/* SIDEBAR */}
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.brandBlock} />
          <div style={S.brandText}>BOOKD</div>
        </div>

        <div style={{ ...S.eyebrow, padding: "16px 16px 6px" }}>YOUR BETS</div>
        {navItems.map(item => (
          <button key={item.k} style={{ ...S.navItem, ...(activeTab === item.k ? S.navItemActive : {}) }}
            onClick={() => setActiveTab(item.k)}>
            <span style={{ ...S.navDot, background: activeTab === item.k ? item.dot : C.sub }} />
            <span style={S.navLabel}>{item.l}</span>
            {item.n > 0 && <span style={S.navCount}>{item.n}</span>}
          </button>
        ))}

        <div style={{ ...S.eyebrow, padding: "20px 16px 6px" }}>CATEGORIES</div>
        {[["Lunar", C.catSports], ["Galactic", C.catPop], ["ToOS", C.catMadeup]].map(([l, c]) => (
          <div key={l} style={S.navItem}>
            <span style={{ ...S.catSquare, background: c }} />
            <span style={S.navLabel}>{l}</span>
          </div>
        ))}

        <div style={S.sidebarSpacer} />

        <div style={S.balanceCard}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.accent}, ${C.gold})`, marginLeft: -14, marginRight: -14, marginTop: -12, marginBottom: 10 }} />
          <div style={S.balanceLabel}>BALANCE</div>
          <div style={S.balanceAmt}>${balance.toFixed(2)}</div>
          {lifetime !== 0 && (
            <div style={{ fontSize: 11, color: lifetime >= 0 ? C.pos : C.accent, fontWeight: 600, ...TAB, marginTop: 2 }}>
              {lifetime >= 0 ? "↑ +" : "↓ "}${Math.abs(lifetime).toFixed(0)} lifetime
            </div>
          )}
          <button style={{ ...S.btnGhost, fontSize: 11, padding: "8px 0 0", display: "block" }} onClick={() => { setBetSlip({}); setScreen("login"); }}>
            sign out · {username}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={S.main}>
        {/* TOPBAR */}
        <div style={S.topbar}>
          <div style={S.topbarLeft}>
            {headerMsg && <div style={S.bannerChip}>{I.dot} {headerMsg}</div>}
          </div>
          <div style={S.topbarRight}>
            {(activeTab === "games" || activeTab === "futures") && (
              <div style={S.segmented}>
                {[["open", "Open"], ["resolved", "Resolved"]].map(([k, l]) => {
                  const src = activeTab === "games" ? rawGames : rawFutures;
                  const cnt = k === "open" ? src.filter(m => m.status === "open" || m.status === "paused").length : src.filter(m => m.status === "settled").length;
                  return (
                    <button key={k} style={{ ...S.segBtn, ...(gamesFilter === k ? S.segBtnActive : {}) }} onClick={() => setGamesFilter(k)}>
                      {l}{cnt > 0 ? ` · ${cnt}` : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {notification && <div style={S.notify}>{notification}</div>}

        {/* CONTENT */}
        <div style={S.content}>

          {(activeTab === "games" || activeTab === "futures") && (
            <>
              {displayMarkets.length === 0 && (
                <div style={S.empty}>
                  <div style={{ fontSize: 16, color: C.ink2, fontWeight: 700, marginBottom: 4, letterSpacing: -0.3 }}>No {gamesFilter} markets</div>
                  <div style={{ fontSize: 13, color: C.sub }}>{gamesFilter === "open" ? "Check back soon for new events." : "Settled markets will appear here."}</div>
                </div>
              )}

              {/* FUTURES */}
              {activeTab === "futures" && displayMarkets.map(market => {
                const meta = leagueMeta(market.subtitle);
                const totalMkt = (market.options || []).reduce((s, o) => s + (optionTotals[o.id] || 0), 0);
                return (
                  <div key={market.id} style={S.eventCard}>
                    <div style={{ height: 4, background: meta.color, marginLeft: -16, marginRight: -16, marginTop: -16, marginBottom: 12 }} />
                    <div style={S.eventTop}>
                      <span style={{ ...S.catBadge, background: meta.color }}>{meta.tag}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {market.maxBet && <span style={S.metaChip}>max ${market.maxBet}</span>}
                        {market.status === "paused" && <span style={{ ...S.metaChip, color: C.gold, background: "rgba(255,184,0,0.10)" }}>PAUSED</span>}
                        {market.status === "settled" && <span style={{ ...S.metaChip, color: C.pos, background: "rgba(21,163,90,0.10)" }}>SETTLED</span>}
                      </div>
                    </div>
                    <h3 style={S.eventTitle}>{market.title}</h3>
                    <p style={S.eventSub}>{market.subtitle}{totalMkt > 0 && <> {I.bullet} <span style={TAB}>${totalMkt.toFixed(0)}</span> in</>}</p>
                    {market.status === "settled" && (
                      <div style={S.winnerBar}>
                        {market.winner === "push" ? `${I.undo} Push — bets refunded` : `${I.check} ${(market.options || []).find(o => o.id === market.winner)?.label || "Unknown"} wins`}
                      </div>
                    )}
                    <div style={S.futureGrid}>
                      {(market.options || []).map(opt => {
                        const isElim = (market.eliminated || []).includes(opt.id);
                        const sel = !!betSlip[opt.id];
                        const dis = market.status !== "open" || isElim;
                        const userHasBet = bets.some(b => b.username === username && (
                          (b.betType === "straight" && b.optionId === opt.id) ||
                          (b.betType === "parlay" && (b.legs || []).some(l => l.optionId === opt.id))
                        ));
                        const totalOnOpt = optionTotals[opt.id] || 0;
                        const pct = totalMkt > 0 ? (totalOnOpt / totalMkt) * 100 : 0;
                        const isHot = totalMkt > 0 && totalOnOpt / totalMkt > 0.5;
                        return (
                          <div key={opt.id} style={{
                            ...S.futOpt,
                            ...(userHasBet ? { background: C.tilePos, borderColor: C.linePos } : {}),
                            ...(isHot && !userHasBet && !sel ? { background: C.tileHot, borderColor: C.lineAccent } : {}),
                            ...(sel ? { background: C.ink, borderColor: C.ink } : {}),
                            ...(dis ? { opacity: 0.4, cursor: "not-allowed" } : {}),
                          }} onClick={() => !dis && toggleSlip(opt, market.id, market)}>
                            <span style={{ ...S.futOptLabel, color: sel ? "rgba(255,255,255,0.7)" : C.sub }}>{isElim ? `OUT — ${opt.label}` : opt.label}</span>
                            <span style={{ ...S.futOptOdds, color: sel ? "#fff" : isHot && !userHasBet ? C.accent : userHasBet ? C.pos : opt.odds > 0 ? C.pos : C.ink }}>{fmt(opt.odds)}</span>
                            {totalMkt > 0 && <div style={S.futOptBar}><div style={{ ...S.futOptBarFill, width: `${pct}%`, background: sel ? "rgba(255,255,255,0.4)" : isHot ? C.accent : C.ink2 }} /></div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* GAMES — grouped event rows */}
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
                  const opts = ml.options || [];

                  return (
                    <div key={ml.id} style={S.eventCard}>
                      <div style={{ height: 4, background: meta.color, marginLeft: -16, marginRight: -16, marginTop: -16, marginBottom: 12 }} />
                      <div style={S.eventTop}>
                        <span style={{ ...S.catBadge, background: meta.color }}>{meta.tag}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {ml.maxBet && <span style={S.metaChip}>max ${ml.maxBet}</span>}
                          {anyPaused && <span style={{ ...S.metaChip, color: C.gold, background: "rgba(255,184,0,0.10)" }}>PAUSED</span>}
                          {allSettled && <span style={{ ...S.metaChip, color: C.pos, background: "rgba(21,163,90,0.10)" }}>SETTLED</span>}
                        </div>
                      </div>

                      <h3 style={S.eventTitle}>{ml.title}</h3>
                      <p style={S.eventSub}>{ml.subtitle}{totalAction > 0 && <> {I.bullet} <span style={TAB}>${totalAction.toFixed(0)}</span> in</>}</p>

                      {/* Team chips */}
                      <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
                        {opts[0] && <div style={S.teamRow}>{teamChip(opts[0].label, meta.color)}<span style={S.teamName}>{opts[0].label}</span></div>}
                        {opts[1] && <div style={S.teamRow}>{teamChip(opts[1].label, C.ink2)}<span style={S.teamName}>{opts[1].label}</span></div>}
                      </div>

                      {ml.status === "settled" && (
                        <div style={S.winnerBar}>
                          {ml.winner === "push" ? `${I.undo} Push — bets refunded` : `${I.check} ${(opts).find(o => o.id === ml.winner)?.label || "Unknown"} wins`}
                        </div>
                      )}

                      {/* Tile grid: ML | Spread | O/U */}
                      <div style={GS.gridWrap}>
                        <div style={GS.headerRow}>
                          <div style={GS.colHeader}>MONEYLINE</div>
                          {hasSpread && <div style={GS.colHeader}>SPREAD</div>}
                          {hasOU && <div style={GS.colHeader}>O/U</div>}
                        </div>
                        <div style={GS.row}>
                          {renderCell(opts[0], ml)}
                          {hasSpread && renderCell((sp.options || [])[0], sp)}
                          {hasOU && renderCell((ou.options || [])[0], ou)}
                        </div>
                        <div style={GS.row}>
                          {renderCell(opts[1], ml)}
                          {hasSpread && renderCell((sp.options || [])[1], sp)}
                          {hasOU && renderCell((ou.options || [])[1], ou)}
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
              <div style={S.sectionHeader}>STANDINGS</div>
              {leaderboard.map(p => {
                const lf = getUserLifetimePnL(p.name);
                return (
                  <div key={p.name} style={{ ...S.boardRow, ...(p.name === username ? S.boardRowMe : {}) }}>
                    <span style={S.boardRank}>#{p._rank}</span>
                    <span style={S.boardName}>{p.name}{p.name === username && " (you)"}</span>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                      <span style={S.boardTotal}>${p.total.toFixed(0)}</span>
                      <span style={{ fontSize: 11, color: lf >= 0 ? C.pos : C.accent, fontWeight: 600, ...TAB }}>
                        {lf >= 0 ? "+" : ""}${lf.toFixed(0)} lifetime
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
              <div style={S.sectionHeader}>MY BETS</div>
              {userBets.length === 0 && (
                <div style={S.empty}>
                  <div style={{ fontSize: 16, color: C.ink2, fontWeight: 700, marginBottom: 4, letterSpacing: -0.3 }}>No bets yet</div>
                  <div style={{ fontSize: 13, color: C.sub }}>Tap any odds tile to start a slip.</div>
                </div>
              )}
              {[...userBets].reverse().map(b => (
                <div key={b.id} style={S.betCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ ...S.eyebrow, color: b.betType === "parlay" ? C.catPop : C.catSports }}>
                      {b.betType === "parlay" ? `${(b.legs || []).length}-LEG PARLAY` : "STRAIGHT"}
                    </span>
                    <span style={{ ...S.eyebrow, color: b.status === "won" ? C.pos : b.status === "lost" ? C.accent : b.status === "pushed" ? C.catSports : C.gold }}>
                      {b.status === "won" ? `${I.check} WON` : b.status === "lost" ? `${I.cross} LOST` : b.status === "pushed" ? `${I.undo} PUSH` : `${I.pending} PENDING`}
                    </span>
                  </div>
                  {b.betType === "straight" ? (
                    <>
                      <p style={S.betLine}><strong>{b.optionLabel}</strong> <span style={TAB}>({fmt(b.odds)})</span></p>
                      <p style={S.betMarket}>{b.marketTitle}</p>
                    </>
                  ) : (
                    <div>
                      {(b.legs || []).map((l, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: l.status === "won" ? C.pos : l.status === "lost" ? C.accent : l.status === "pushed" ? C.catSports : C.ink2, fontWeight: 500 }}>
                          <span>{l.optionLabel} <span style={{ ...TAB, color: C.sub }}>({fmt(l.odds)})</span></span>
                          <span>{l.status === "won" ? I.check : l.status === "lost" ? I.cross : l.status === "pushed" ? I.undo : I.pending}</span>
                        </div>
                      ))}
                      <p style={{ ...S.betMarket, marginTop: 6 }}>Combined: <span style={{ ...TAB, color: C.ink, fontWeight: 700 }}>{fmt(b.combinedOdds)}</span></p>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: C.ink2, ...TAB }}>${b.stake.toFixed(2)} stake</span>
                    <span style={{ color: b.status === "won" ? C.pos : C.ink2, ...TAB }}>
                      {b.status === "won" ? "Paid: " : "to win: "}${b.payout?.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{fmtTime(b.placedAt)}</div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>

      {/* BET SLIP — floating bottom-right */}
      {slipLegs.length > 0 && (
        <div style={S.slip}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.accent}, ${C.gold})` }} />
          <div style={S.slipInner}>
            <div style={S.slipHeader}>
              <span style={{ ...S.eyebrow, color: C.ink }}>SLIP {I.bullet} {slipLegs.length}</span>
              <button style={S.btnGhost} onClick={() => { setBetSlip({}); setParlayStake(""); }}>clear</button>
            </div>
            {slipLegs.map(l => (
              <div key={l.optionId} style={S.slipLeg}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.2 }}>{l.optionLabel}</div>
                  <div style={{ fontSize: 11, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={TAB}>{fmt(l.odds)}</span> {I.bullet} {l.marketTitle}</div>
                </div>
                <input type="number" placeholder="$" style={S.slipStake}
                  value={l.stake} onChange={e => setSlipStake(l.optionId, e.target.value)} />
                <button style={S.slipX} onClick={() => { const ns = { ...betSlip }; delete ns[l.optionId]; setBetSlip(ns); }}>×</button>
              </div>
            ))}
            {hasSameGameConflict && (
              <div style={S.slipWarn}>Cannot parlay Moneyline + Spread from the same game</div>
            )}
            {slipLegs.length === 1 && (
              <button style={{ ...S.btnPrimary, width: "100%", marginTop: 8 }} onClick={() => { const l = slipLegs[0]; placeStraight(l.optionId, parseFloat(l.stake)); }}
                disabled={!(parseFloat(slipLegs[0]?.stake) > 0)}>
                <span style={TAB}>PLACE ${parseFloat(slipLegs[0]?.stake || 0).toFixed(2)} {I.arrow} ${straightPayout.toFixed(2)}</span>
              </button>
            )}
            {slipLegs.length > 1 && (
              <div style={{ marginTop: 8 }}>
                {straightTotal > 0 && (
                  <button style={{ ...S.btnSecondary, width: "100%", marginBottom: 6, padding: "10px 14px" }} onClick={placeAllStraights}>
                    <span style={TAB}>PLACE {slipLegs.filter(l => parseFloat(l.stake) > 0).length} STRAIGHTS · ${straightTotal.toFixed(2)}</span>
                  </button>
                )}
                {parlayEligible ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="number" placeholder="$ parlay" style={{ ...S.slipStake, flex: 1, width: "auto", height: 36 }}
                      value={parlayStake} onChange={e => setParlayStake(e.target.value)} />
                    <button style={{ ...S.btnPrimary, flex: 2 }} onClick={placeParlay}
                      disabled={!(parseFloat(parlayStake) > 0)}>
                      <span style={TAB}>PARLAY {parlayOdds && fmt(parlayOdds)} {I.arrow} ${parlayPayout.toFixed(2)}</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.sub, textAlign: "center", padding: 8, fontWeight: 500 }}>
                    {slipHasFuture ? "Futures cannot be parlayed" : "Add legs from different games to parlay"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles (BOOKD) ──────────────────────────────────────────────────────
const S = {
  // Login
  loginWrap: { minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: SANS },
  loginCard: { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 8, padding: 28, maxWidth: 400, width: "100%", display: "flex", flexDirection: "column", gap: 14 },
  loginLogoRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 4 },
  loginLogoBlock: { width: 36, height: 36, borderRadius: 4, background: `linear-gradient(135deg, ${C.accent} 0%, ${C.catSports} 100%)`, flexShrink: 0 },
  loginLogoTitle: { fontFamily: SANS, fontSize: 22, fontWeight: 800, letterSpacing: -0.6, color: C.ink, lineHeight: 1 },
  loginLogoSub: { fontSize: 13, color: C.sub, fontFamily: SANS, fontWeight: 500, marginTop: 2 },
  loginLabel: { fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: C.sub, fontFamily: SANS, textTransform: "uppercase" },
  input: { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 4, padding: "11px 14px", fontFamily: SANS, fontSize: 14, color: C.ink, outline: "none", width: "100%", boxSizing: "border-box", fontWeight: 500, ...TAB },

  // Buttons (BOOKD)
  btnPrimary: { background: C.ink, color: "#fff", border: "none", borderRadius: 4, padding: "11px 16px", fontFamily: SANS, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.4, textTransform: "uppercase" },
  btnAccent: { background: C.accent, color: "#fff", border: "none", borderRadius: 4, padding: "8px 14px", fontFamily: SANS, fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 0.4, textTransform: "uppercase" },
  btnGold: { background: C.gold, color: C.ink, border: "none", borderRadius: 4, padding: "8px 14px", fontFamily: SANS, fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 0.4, textTransform: "uppercase" },
  btnPos: { background: C.pos, color: "#fff", border: "none", borderRadius: 4, padding: "8px 14px", fontFamily: SANS, fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3, textAlign: "left" },
  btnSecondary: { background: "transparent", color: C.ink, border: `1px solid ${C.line}`, borderRadius: 4, padding: "7px 12px", fontFamily: SANS, fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3, textTransform: "uppercase" },
  btnGhost: { background: "transparent", color: C.sub, border: "none", padding: "6px 4px", fontFamily: SANS, fontSize: 13, cursor: "pointer", fontWeight: 500 },

  // Eyebrow / utility
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: C.sub, fontFamily: SANS, textTransform: "uppercase" },
  sectionHeader: { fontSize: 13, fontWeight: 800, letterSpacing: 1.2, color: C.sub, fontFamily: SANS, textTransform: "uppercase", marginBottom: 12 },

  // Lobby layout
  lobbyWrap: { minHeight: "100vh", background: C.bg, fontFamily: SANS, color: C.ink, display: "flex" },
  sidebar: { width: 200, background: C.rail, borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", padding: "16px 0", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
  brandRow: { display: "flex", alignItems: "center", gap: 10, padding: "0 16px 16px", borderBottom: `1px solid ${C.line}`, marginBottom: 4 },
  brandBlock: { width: 24, height: 24, borderRadius: 4, background: `linear-gradient(135deg, ${C.accent} 0%, ${C.catSports} 100%)`, flexShrink: 0 },
  brandText: { fontFamily: SANS, fontSize: 15, fontWeight: 800, letterSpacing: -0.4, color: C.ink },

  navItem: { display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", margin: "0 8px 1px", borderRadius: 4, background: "transparent", border: "none", cursor: "pointer", fontFamily: SANS, width: "calc(100% - 16px)", textAlign: "left" },
  navItemActive: { background: C.activeNav },
  navDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  navLabel: { fontSize: 13, fontWeight: 600, color: C.ink, flex: 1, fontFamily: SANS },
  navCount: { fontSize: 11, fontWeight: 700, color: C.sub, ...TAB },
  catSquare: { width: 14, height: 14, borderRadius: 3, flexShrink: 0 },

  sidebarSpacer: { flex: 1 },
  balanceCard: { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 6, padding: 12, margin: 12, overflow: "hidden" },
  balanceLabel: { fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: C.sub, fontFamily: SANS, textTransform: "uppercase" },
  balanceAmt: { fontFamily: SANS, fontSize: 22, fontWeight: 800, color: C.pos, ...TAB, letterSpacing: -0.6, marginTop: 2 },

  main: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  topbar: { height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderBottom: `1px solid ${C.line}`, background: C.bg, position: "sticky", top: 0, zIndex: 40, gap: 12 },
  topbarLeft: { flex: 1, minWidth: 0, display: "flex", alignItems: "center" },
  topbarRight: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  bannerChip: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.gold, fontWeight: 700, padding: "6px 12px", background: "rgba(255,184,0,0.10)", border: `1px solid ${C.gold}`, borderRadius: 4 },

  segmented: { display: "flex", border: `1px solid ${C.line}`, borderRadius: 4, background: C.tile, overflow: "hidden" },
  segBtn: { background: "transparent", border: "none", padding: "8px 14px", fontFamily: SANS, fontSize: 13, color: C.sub, fontWeight: 600, cursor: "pointer", letterSpacing: 0.2 },
  segBtnActive: { background: C.ink, color: "#fff" },

  notify: { position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", padding: "10px 16px", background: C.ink, color: "#fff", borderRadius: 4, fontSize: 13, fontWeight: 600, zIndex: 200, boxShadow: "0 8px 24px rgba(20,30,80,.14)", fontFamily: SANS },

  content: { padding: 16, flex: 1, paddingBottom: 280 },
  empty: { padding: "60px 20px", textAlign: "center", background: C.tile, border: `1px solid ${C.line}`, borderRadius: 8 },

  // Event card
  eventCard: { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 8, padding: 16, marginBottom: 12, overflow: "hidden" },
  eventTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8, flexWrap: "wrap" },
  catBadge: { fontSize: 9, fontWeight: 800, letterSpacing: 0.8, padding: "2px 6px", borderRadius: 3, color: "#fff", textTransform: "uppercase", fontFamily: SANS, lineHeight: 1.4 },
  metaChip: { fontSize: 11, fontWeight: 700, color: C.sub, background: C.rail, padding: "3px 8px", borderRadius: 4, fontFamily: SANS, ...TAB },
  eventTitle: { fontFamily: SANS, fontSize: 18, fontWeight: 800, color: C.ink, margin: "0 0 4px", letterSpacing: -0.4 },
  eventSub: { fontSize: 13, color: C.sub, margin: "0 0 12px", fontWeight: 500 },

  teamRow: { display: "flex", alignItems: "center", gap: 8 },
  teamName: { fontSize: 13, color: C.ink2, fontWeight: 600 },

  winnerBar: { padding: "8px 12px", background: C.tilePos, border: `1px solid ${C.linePos}`, borderRadius: 4, fontSize: 13, color: C.pos, marginBottom: 12, fontWeight: 700, letterSpacing: -0.2 },

  // Future grid (multiple options)
  futureGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 },
  futOpt: { display: "flex", flexDirection: "column", padding: "10px 12px", background: C.tile, border: `1px solid ${C.line}`, borderRadius: 6, cursor: "pointer", position: "relative", overflow: "hidden", minHeight: 56, justifyContent: "center" },
  futOptLabel: { fontSize: 11, color: C.sub, fontWeight: 500, marginBottom: 2 },
  futOptOdds: { fontFamily: SANS, fontSize: 14, fontWeight: 700, ...TAB, letterSpacing: -0.2 },
  futOptBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: C.rail },
  futOptBarFill: { height: "100%", background: C.ink2 },

  // Bet slip (floating bottom-right)
  slip: { position: "fixed", bottom: 16, right: 16, width: 280, background: C.tile, border: `1.5px solid ${C.accent}`, borderRadius: 6, zIndex: 100, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 8px 24px rgba(20,30,80,.14)", overflow: "hidden" },
  slipInner: { padding: 12 },
  slipHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  slipLeg: { display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: C.rail, borderRadius: 4, marginBottom: 6 },
  slipStake: { width: 60, height: 28, padding: "4px 8px", background: C.tile, border: `1px solid ${C.line}`, color: C.ink, borderRadius: 4, fontFamily: SANS, fontSize: 13, textAlign: "center", outline: "none", boxSizing: "border-box", ...TAB, fontWeight: 600 },
  slipX: { background: "transparent", border: "none", color: C.sub, cursor: "pointer", fontSize: 16, padding: "0 4px", lineHeight: 1, fontWeight: 700 },
  slipWarn: { padding: "8px 10px", background: C.tileHot, border: `1px solid ${C.lineAccent}`, color: C.accent, fontSize: 12, textAlign: "center", borderRadius: 4, marginBottom: 6, fontWeight: 600 },

  // My bets
  betCard: { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 8, padding: 14, marginBottom: 10 },
  betLine: { fontSize: 14, color: C.ink, margin: "0 0 2px", fontWeight: 600, letterSpacing: -0.2 },
  betMarket: { fontSize: 13, color: C.sub, margin: 0, fontWeight: 500 },

  // Leaderboard
  boardRow: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.tile, border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 6 },
  boardRowMe: { borderColor: C.ink, background: C.activeNav },
  boardRank: { fontFamily: SANS, fontSize: 14, fontWeight: 800, color: C.gold, width: 32, ...TAB, letterSpacing: -0.2 },
  boardName: { flex: 1, fontSize: 14, fontWeight: 700, color: C.ink, letterSpacing: -0.2 },
  boardTotal: { fontFamily: SANS, fontSize: 18, fontWeight: 800, color: C.pos, ...TAB, letterSpacing: -0.4 },

  // Admin
  adminWrap: { minHeight: "100vh", background: C.bg, fontFamily: SANS, color: C.ink },
  adminHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: C.tile, borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 50 },
  adminTitle: { fontFamily: SANS, fontSize: 15, fontWeight: 800, letterSpacing: -0.4, color: C.ink },
  adminTabs: { display: "flex", background: C.tile, borderBottom: `1px solid ${C.line}`, padding: "0 8px", overflowX: "auto", position: "sticky", top: 49, zIndex: 49 },
  adminTab: { background: "transparent", border: "none", borderBottom: "2px solid transparent", color: C.sub, padding: "10px 14px", fontFamily: SANS, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", letterSpacing: 0.3 },
  adminTabActive: { color: C.ink, borderBottom: `2px solid ${C.accent}` },
  adminContent: { padding: 16, maxWidth: 920, margin: "0 auto" },
  adminH3: { margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: C.ink, letterSpacing: -0.3 },
  adminCard: { background: C.tile, border: `1px solid ${C.line}`, borderRadius: 8, padding: 16, marginBottom: 10, overflow: "hidden" },
  adminCardTitle: { fontSize: 14, fontWeight: 800, color: C.ink, margin: "0 0 2px", letterSpacing: -0.3 },
  adminCardSub: { fontSize: 13, color: C.sub, margin: 0, fontWeight: 500 },
  statBox: { display: "flex", alignItems: "center", padding: "12px 14px", background: C.tile, border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 16 },
  formRow: { marginBottom: 14 },
  formLabel: { display: "block", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: C.sub, marginBottom: 5, textTransform: "uppercase", fontFamily: SANS },
};

// Tile-grid styles (event row: ML | Spread | O/U)
const GS = {
  gridWrap: { display: "flex", flexDirection: "column", gap: 4 },
  headerRow: { display: "flex", gap: 8, padding: "0 2px" },
  colHeader: { flex: 1, fontSize: 9, fontWeight: 800, letterSpacing: 0.8, color: C.sub, textAlign: "center", padding: "0 2px", textTransform: "uppercase", fontFamily: SANS },
  row: { display: "flex", gap: 8 },
  cell: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 8px", background: C.tile, border: `1px solid ${C.line}`, borderRadius: 6, cursor: "pointer", minHeight: 56, position: "relative", overflow: "hidden", fontFamily: SANS },
  cellEmpty: { flex: 1, minHeight: 56 },
  cellLabel: { fontSize: 10, color: C.sub, fontWeight: 500, marginBottom: 4, textAlign: "center", lineHeight: 1.2, fontFamily: SANS },
  cellOdds: { fontFamily: SANS, fontSize: 13, fontWeight: 700, ...TAB, letterSpacing: -0.2 },
  cellBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: C.rail },
  cellBarFill: { height: "100%", background: C.ink2 },
};
