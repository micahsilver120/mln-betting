import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

// ─── Font injection ──────────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mln-fonts")) {
  const link = document.createElement("link");
  link.id = "mln-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

// ─── Firebase Config ───────────────────────────────────────────────────────
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

// ─── Data ──────────────────────────────────────────────────────────────────

const INITIAL_MARKETS = {
  games: [
    { id: "lsf1", type: "game", title: "Aruba Sea Serpents vs Humongous Melonheads", subtitle: "Lunar League · Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "lsf1_ss", label: "Aruba Sea Serpents", odds: -225 }, { id: "lsf1_mel", label: "Humongous Melonheads", odds: +180 }] },
    { id: "lsf2", type: "game", title: "Raccoon City Outbreak vs Sopher McDophers", subtitle: "Lunar League · Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "lsf2_out", label: "Raccoon City Outbreak", odds: -110 }, { id: "lsf2_mcd", label: "Sopher McDophers", odds: -111 }] },
    { id: "gsf1", type: "game", title: "Gas House Gorillas vs Sunnydale Slayers", subtitle: "Galactic League · Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "gsf1_gor", label: "Gas House Gorillas", odds: -200 }, { id: "gsf1_sla", label: "Sunnydale Slayers", odds: +161 }] },
    { id: "gsf2", type: "game", title: "Ursa Major Grizzlies vs R'lyeh Ancients", subtitle: "Galactic League · Semifinal", status: "open", winner: null, maxBet: null,
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

// ─── Banned words ──────────────────────────────────────────────────────────
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

// Case-insensitive user lookup — finds the canonical stored key for any casing
function findUserKey(users, inputName) {
  const lower = inputName.trim().toLowerCase();
  return Object.keys(users).find(k => k.toLowerCase() === lower) || null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmt = o => o > 0 ? `+${o}` : `${o}`;
const toDecimal = o => o > 0 ? o / 100 + 1 : 100 / Math.abs(o) + 1;
const toWin = (stake, odds) => odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds);
const calcPayout = (stake, odds) => stake + toWin(stake, odds);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtTime = ts => {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
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

// ─── Storage ───────────────────────────────────────────────────────────────

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

// ─── PIN Pad ───────────────────────────────────────────────────────────────

function PinPad({ value, onChange, label, sublabel, error }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  function press(k) {
    if (k === "⌫") { onChange(value.slice(0, -1)); return; }
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
          <button key={i} onClick={() => press(k)} style={{ height: 54, background: k === "" ? "transparent" : "#ffffff", border: k === "" ? "none" : "1px solid #e2e8f0", borderRadius: 12, color: k === "⌫" ? "#94a3b8" : "#1e293b", fontSize: k === "⌫" ? 18 : 20, fontWeight: 600, cursor: k === "" ? "default" : "pointer", fontFamily: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", pointerEvents: k === "" ? "none" : "auto" }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("login");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState({});
  const [markets, setMarkets] = useState(INITIAL_MARKETS);
  const [bets, setBets] = useState([]);
  const [headerMsg, setHeaderMsg] = useState("");
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Login
  const [inputName, setInputName] = useState("");
  const [loginStep, setLoginStep] = useState("name");
  const [pinInput, setPinInput] = useState("");
  const [pendingPin, setPendingPin] = useState("");
  const [pinError, setPinError] = useState("");

  // Lobby
  const [betSlip, setBetSlip] = useState({});
  const [slipMode, setSlipMode] = useState("straight");
  const [parlayStake, setParlayStake] = useState("");
  const [activeTab, setActiveTab] = useState("games");

  // Admin
  const [adminTab, setAdminTab] = useState("settle");
  const [adminPin, setAdminPin] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [editingMarket, setEditingMarket] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editOptions, setEditOptions] = useState([]);
  const [editMaxBet, setEditMaxBet] = useState("");
  const [adjustingUser, setAdjustingUser] = useState(null);
  const [adjustAmt, setAdjustAmt] = useState("");
  const [addType, setAddType] = useState("game");
  const [addTitle, setAddTitle] = useState("");
  const [addSubtitle, setAddSubtitle] = useState("");
  const [addTeamA, setAddTeamA] = useState("");
  const [addOddsA, setAddOddsA] = useState("");
  const [addTeamB, setAddTeamB] = useState("");
  const [addOddsB, setAddOddsB] = useState("");
  const [addMaxBet, setAddMaxBet] = useState("");
  const [futureOptions, setFutureOptions] = useState([{ label: "", odds: "" }, { label: "", odds: "" }]);
  const [headerDraft, setHeaderDraft] = useState("");
  const [expandedSettled, setExpandedSettled] = useState(null);

  // Load data + real-time listeners
  useEffect(() => {
    (async () => {
      const [u, m, b, lv, hm] = await Promise.all([
        storageGet("mln_users"), storageGet("mln_markets"), storageGet("mln_bets"),
        storageGet("mln_leaderboard_visible"), storageGet("mln_header_msg"),
      ]);
      if (u) setUsers(u);
      if (m) setMarkets(m);
      setBets(Array.isArray(b) ? b : []);
      if (lv !== null) setLeaderboardVisible(lv);
      if (hm !== null) setHeaderMsg(hm);
      setHeaderDraft(hm || "");
      setLoading(false);
    })();
    const u1 = onValue(ref(db, "mln_users"), snap => { if (snap.exists()) { const v = parseFirebase(snap.val()); if (v) setUsers(v); } }, () => {});
    const u2 = onValue(ref(db, "mln_markets"), snap => { if (snap.exists()) { const v = parseFirebase(snap.val()); if (v) setMarkets(v); } }, () => {});
    const u3 = onValue(ref(db, "mln_bets"), snap => { const v = snap.exists() ? parseFirebase(snap.val()) : []; setBets(Array.isArray(v) ? v : []); }, () => {});
    const u4 = onValue(ref(db, "mln_leaderboard_visible"), snap => { if (snap.exists()) setLeaderboardVisible(parseFirebase(snap.val())); }, () => {});
    const u5 = onValue(ref(db, "mln_header_msg"), snap => { const v = snap.exists() ? parseFirebase(snap.val()) : ""; setHeaderMsg(v || ""); }, () => {});
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  // 30-min inactivity timeout
  useEffect(() => {
    if (screen !== "lobby") return;
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => { setBetSlip({}); setScreen("login"); setUsername(""); }, 30 * 60 * 1000); };
    reset();
    window.addEventListener("click", reset); window.addEventListener("keypress", reset); window.addEventListener("touchstart", reset);
    return () => { clearTimeout(timer); window.removeEventListener("click", reset); window.removeEventListener("keypress", reset); window.removeEventListener("touchstart", reset); };
  }, [screen]);

  // Auto-advance PIN
  useEffect(() => {
    if (pinInput.length < 4) return;
    const t = setTimeout(() => handlePinComplete(pinInput), 150);
    return () => clearTimeout(t);
  }, [pinInput, loginStep]);

  // Redirect off hidden leaderboard
  useEffect(() => { if (!leaderboardVisible && activeTab === "leaderboard") setActiveTab("games"); }, [leaderboardVisible]);

  function notify(msg, type = "success") { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3200); }
  async function saveUsers(u) { setUsers(u); await storageSet("mln_users", u); }
  async function saveMarkets(m) { setMarkets(m); await storageSet("mln_markets", m); }
  async function saveBets(b) { setBets(b); await storageSet("mln_bets", b); }

  // ── Login ────────────────────────────────────────────────────────────────

  function handleNameSubmit() {
    const raw = inputName.trim(); if (!raw) return;
    setPinInput(""); setPinError("");
    const existingKey = findUserKey(users, raw);
    if (existingKey) {
      // Found existing account — update display to canonical casing
      setInputName(existingKey);
      setLoginStep("pin_login");
    } else {
      // New account — check banned words
      if (containsBannedWord(raw)) {
        setPinError(""); 
        notify("That name contains a word that isn't allowed. Please choose a different name.", "error");
        return;
      }
      setLoginStep("pin_create");
    }
  }

  async function handlePinComplete(pin) {
    const name = inputName.trim();
    if (loginStep === "pin_login") {
      const key = findUserKey(users, name) || name;
      if (pin === users[key]?.pin) { setUsername(key); setScreen("lobby"); setInputName(""); setLoginStep("name"); setPinInput(""); setPinError(""); }
      else { setPinError("Incorrect PIN — try again"); setPinInput(""); }
      return;
    }
    if (loginStep === "pin_create") { setPendingPin(pin); setPinInput(""); setPinError(""); setLoginStep("pin_confirm"); return; }
    if (loginStep === "pin_confirm") {
      if (pin === pendingPin) {
        const newUsers = { ...users, [name]: { balance: STARTING_BALANCE, pin, createdAt: Date.now() } };
        await saveUsers(newUsers);
        setUsername(name); setScreen("lobby"); setInputName(""); setLoginStep("name"); setPinInput(""); setPinError(""); setPendingPin("");
      } else { setPinError("PINs don't match — start over"); setPinInput(""); setTimeout(() => { setLoginStep("pin_create"); setPinError(""); }, 800); }
      return;
    }
  }

  function resetLoginToName() { setLoginStep("name"); setPinInput(""); setPinError(""); setPendingPin(""); }

  // ── Derived ──────────────────────────────────────────────────────────────

  const allMarkets = [...markets.games, ...markets.futures];
  const slipEntries = Object.entries(betSlip);
  const slipLegs = slipEntries.map(([optId, v]) => {
    const market = allMarkets.find(m => m.id === v.marketId);
    const option = market?.options.find(o => o.id === optId);
    return { optionId: optId, marketId: v.marketId, marketTitle: market?.title, optionLabel: option?.label, odds: option?.odds, stake: v.stake };
  });
  const multiMarket = new Set(slipEntries.map(([, v]) => v.marketId)).size > 1;
  const slipHasFuture = slipLegs.some(l => allMarkets.find(m => m.id === l.marketId)?.type === "future");
  const parlayEligible = multiMarket && !slipHasFuture;
  const parlayOdds = slipLegs.length > 1 ? combinedAmericanOdds(slipLegs) : null;
  const parlayPayout = parlayStake > 0 && parlayOdds != null ? calcPayout(parseFloat(parlayStake), parlayOdds) : 0;
  const straightTotal = slipLegs.reduce((acc, l) => acc + (parseFloat(l.stake) || 0), 0);
  const straightPayout = slipLegs.reduce((acc, l) => acc + (parseFloat(l.stake) > 0 ? calcPayout(parseFloat(l.stake), l.odds) : 0), 0);

  const optionTotals = {};
  for (const b of bets) {
    if (b.betType === "straight") optionTotals[b.optionId] = (optionTotals[b.optionId] || 0) + b.stake;
    else if (b.betType === "parlay") for (const leg of b.legs) optionTotals[leg.optionId] = (optionTotals[leg.optionId] || 0) + b.stake;
  }

  const balance = users[username]?.balance ?? STARTING_BALANCE;
  const userBets = bets.filter(b => b.username === username);

  // Leaderboard sorted by total (balance + pending stakes)
  const leaderboardRaw = Object.entries(users).map(([name, u]) => {
    const pendingAmt = bets.filter(b => b.username === name && b.status === "pending").reduce((s, b) => s + b.stake, 0);
    return { name, u, pendingAmt, total: (u.balance || 0) + pendingAmt };
  }).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;           // 1. highest total first
    if (b.pendingAmt !== a.pendingAmt) return b.pendingAmt - a.pendingAmt; // 2. most open bets
    return a.name.localeCompare(b.name);                          // 3. alphabetical
  });

  // Assign rank numbers — tied players share the same rank
  const leaderboard = leaderboardRaw.reduce((acc, entry, i) => {
    const rank = i === 0 ? 1 : (entry.total === acc[i-1].total ? acc[i-1]._rank : i + 1);
    acc.push({ ...entry, _rank: rank });
    return acc;
  }, []);

  // Split into active bettors vs no-bets-yet
  const activePlayers = leaderboard.filter(p => bets.some(b => b.username === p.name));
  const inactivePlayers = leaderboard.filter(p => !bets.some(b => b.username === p.name));

  const displayMarkets = activeTab === "games" ? markets.games : markets.futures;

  // ── House P&L ─────────────────────────────────────────────────────────────
  // For each settled market: house_take = total_staked - total_paid_out
  function getMarketPnl(marketId) {
    const relevant = bets.filter(b => {
      if (b.betType === "straight") return b.marketId === marketId && (b.status === "won" || b.status === "lost");
      if (b.betType === "parlay") return b.legs.some(l => l.marketId === marketId) && (b.status === "won" || b.status === "lost");
      return false;
    });
    const totalStaked = relevant.reduce((s, b) => s + b.stake, 0);
    const totalPaid = relevant.filter(b => b.status === "won").reduce((s, b) => s + b.payout, 0);
    const betCount = relevant.length;
    return { totalStaked, totalPaid, net: totalStaked - totalPaid, betCount };
  }

  function getPlayerLifetimePnl(playerName) {
    const resolved = bets.filter(b => b.username === playerName && (b.status === "won" || b.status === "lost"));
    const staked = resolved.reduce((s, b) => s + b.stake, 0);
    const returned = resolved.filter(b => b.status === "won").reduce((s, b) => s + b.payout, 0);
    return returned - staked; // positive = player up, negative = player down
  }

  // Project house P&L if a specific option wins — honors original bet odds
  // Straight bets only — parlays excluded because their multi-leg payouts
  // can't be attributed to a single market outcome cleanly.
  // Formula: house net = total staked on market - payout owed to winners of this option
  // e.g. $1359 on GHG (-200) + $1225 on Slayers: if GHG wins, payout = $1359 * 1.5 = $2038.50
  // house net = $2584 - $2038.50 = +$545.50
  function getOptionProjection(marketId, winningOptionId) {
    const straightBets = bets.filter(b =>
      b.status === "pending" &&
      b.betType === "straight" &&
      b.marketId === marketId
    );
    const totalStaked = straightBets.reduce((s, b) => s + b.stake, 0);
    const totalPayout = straightBets
      .filter(b => b.optionId === winningOptionId)
      .reduce((s, b) => s + b.payout, 0); // payout = stake + winnings at locked-in odds
    return { totalStaked, totalPayout, net: totalStaked - totalPayout };
  }

  const houseTotalNet = allMarkets
    .filter(m => m.status === "settled")
    .reduce((sum, m) => sum + getMarketPnl(m.id).net, 0);

  // ── Bet slip actions ──────────────────────────────────────────────────────

  function togglePick(marketId, optionId) {
    if (betSlip[optionId]) { const c = { ...betSlip }; delete c[optionId]; setBetSlip(c); return; }
    const c = {};
    for (const [k, v] of slipEntries) { if (v.marketId !== marketId) c[k] = v; }
    c[optionId] = { marketId, stake: "" };
    setBetSlip(c);
    const market = allMarkets.find(m => m.id === marketId);
    if (market?.type === "future" && slipMode === "parlay") setSlipMode("straight");
  }
  function setStake(optionId, val) { setBetSlip(p => ({ ...p, [optionId]: { ...p[optionId], stake: val } })); }

  async function placeBets() {
    if (slipEntries.length === 0) return;
    for (const [, v] of slipEntries) {
      const market = allMarkets.find(m => m.id === v.marketId);
      if (market?.status === "paused") { notify(`${market.title} is paused`, "error"); return; }
      if (market?.status === "settled") { notify(`${market.title} is already settled`, "error"); return; }
    }
    if (slipMode === "parlay") {
      if (slipHasFuture) { notify("Futures can't be included in parlays", "error"); setSlipMode("straight"); return; }
      const stake = parseFloat(parlayStake);
      if (!stake || stake <= 0) { notify("Enter a valid parlay stake", "error"); return; }
      if (stake > balance) { notify("Not enough balance!", "error"); return; }
      for (const leg of slipLegs) {
        const market = allMarkets.find(m => m.id === leg.marketId);
        if (market?.maxBet && stake > market.maxBet) { notify(`Max bet on ${market.title} is $${market.maxBet}`, "error"); return; }
      }
      const combo = combinedAmericanOdds(slipLegs);
      const payout = calcPayout(stake, combo);
      const newBet = { id: uid(), username, betType: "parlay", legs: slipLegs.map(l => ({ marketId: l.marketId, marketTitle: l.marketTitle, optionId: l.optionId, optionLabel: l.optionLabel, odds: l.odds, status: "pending" })), combinedOdds: combo, stake, payout, status: "pending", placedAt: Date.now() };
      await saveUsers({ ...users, [username]: { ...users[username], balance: balance - stake } });
      await saveBets([...bets, newBet]);
      setBetSlip({}); setParlayStake("");
      notify(`Parlay placed! ${fmt(combo)} · $${payout.toFixed(2)} to win`);
    } else {
      let total = 0;
      for (const [, v] of slipEntries) { const amt = parseFloat(v.stake); if (!amt || amt <= 0) { notify("Enter a valid stake for each bet", "error"); return; } total += amt; }
      if (total > balance) { notify("Not enough balance!", "error"); return; }
      for (const [, v] of slipEntries) { const market = allMarkets.find(m => m.id === v.marketId); const amt = parseFloat(v.stake); if (market?.maxBet && amt > market.maxBet) { notify(`Max bet on ${market.title} is $${market.maxBet}`, "error"); return; } }
      const newBets = [...bets];
      for (const [optionId, v] of slipEntries) {
        const market = allMarkets.find(m => m.id === v.marketId); const option = market.options.find(o => o.id === optionId); const stake = parseFloat(v.stake);
        newBets.push({ id: uid(), username, betType: "straight", marketId: v.marketId, marketTitle: market.title, optionId, optionLabel: option.label, odds: option.odds, stake, payout: calcPayout(stake, option.odds), status: "pending", placedAt: Date.now() });
      }
      await saveUsers({ ...users, [username]: { ...users[username], balance: balance - total } });
      await saveBets(newBets); setBetSlip({});
      notify(`${slipEntries.length} bet${slipEntries.length > 1 ? "s" : ""} placed!`);
    }
  }

  // ── Admin actions ─────────────────────────────────────────────────────────

  async function settleMarket(marketId, winningOptionId) {
    const settle = m => m.id === marketId ? { ...m, status: "settled", winner: winningOptionId } : m;
    const newMarkets = { games: markets.games.map(settle), futures: markets.futures.map(settle) };
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
        const hasLeg = b.legs.some(l => l.marketId === marketId);
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
    notify("Market settled — winners paid! 💰");
  }

  async function unsettleMarket(marketId) {
    const newUsers = { ...users };
    const newBets = bets.map(b => {
      if (b.betType === "straight") {
        if (b.marketId !== marketId) return b;
        if (b.status === "won") newUsers[b.username] = { ...newUsers[b.username], balance: Math.max(0, (newUsers[b.username]?.balance || 0) - b.payout) };
        if (b.status === "won" || b.status === "lost") return { ...b, status: "pending" };
        return b;
      }
      if (b.betType === "parlay") {
        const hasLeg = b.legs.some(l => l.marketId === marketId);
        if (!hasLeg) return b;
        if (b.status === "won") newUsers[b.username] = { ...newUsers[b.username], balance: Math.max(0, (newUsers[b.username]?.balance || 0) - b.payout) };
        const newLegs = b.legs.map(l => l.marketId === marketId ? { ...l, status: "pending" } : l);
        const anyLost = newLegs.some(l => l.status === "lost");
        return { ...b, legs: newLegs, status: anyLost ? "lost" : "pending" };
      }
      return b;
    });
    const reopen = m => m.id === marketId ? { ...m, status: "open", winner: null } : m;
    const newMarkets = { games: markets.games.map(reopen), futures: markets.futures.map(reopen) };
    await saveUsers(newUsers); await saveMarkets(newMarkets); await saveBets(newBets);
    notify("Market reopened — payouts reversed ↩");
  }

  async function voidMarket(marketId) {
    const newUsers = { ...users };
    const newBets = bets.map(b => {
      if (b.status !== "pending") return b;
      if ((b.betType === "straight" && b.marketId === marketId) || (b.betType === "parlay" && b.legs.some(l => l.marketId === marketId))) {
        newUsers[b.username] = { ...newUsers[b.username], balance: (newUsers[b.username]?.balance || 0) + b.stake };
        return { ...b, status: "voided" };
      }
      return b;
    });
    const rm = m => m.id !== marketId;
    await saveUsers(newUsers); await saveMarkets({ games: markets.games.filter(rm), futures: markets.futures.filter(rm) }); await saveBets(newBets);
    notify("Market voided & bets refunded");
  }

  async function togglePauseMarket(marketId) {
    const market = allMarkets.find(m => m.id === marketId);
    const newStatus = market.status === "paused" ? "open" : "paused";
    const toggle = m => m.id === marketId ? { ...m, status: newStatus } : m;
    await saveMarkets({ games: markets.games.map(toggle), futures: markets.futures.map(toggle) });
    notify(newStatus === "paused" ? "⏸ Market paused" : "▶️ Market reopened");
  }

  async function pauseAllMarkets() {
    const pauseAll = m => m.status === "open" ? { ...m, status: "paused" } : m;
    const newMarkets = { games: markets.games.map(pauseAll), futures: markets.futures.map(pauseAll) };
    await saveMarkets(newMarkets);
    notify("⏸ All open markets paused");
  }

  async function unpauseAllMarkets() {
    const openAll = m => m.status === "paused" ? { ...m, status: "open" } : m;
    const newMarkets = { games: markets.games.map(openAll), futures: markets.futures.map(openAll) };
    await saveMarkets(newMarkets);
    notify("▶️ All markets reopened");
  }

  function startEdit(market) { setEditingMarket(market); setEditTitle(market.title); setEditSubtitle(market.subtitle); setEditOptions(market.options.map(o => ({ ...o }))); setEditMaxBet(market.maxBet ?? ""); }

  async function saveEdit() {
    if (!editTitle.trim()) { notify("Title required", "error"); return; }
    const updated = { ...editingMarket, title: editTitle.trim(), subtitle: editSubtitle.trim(), options: editOptions.map(o => ({ ...o, odds: parseInt(o.odds) })), maxBet: editMaxBet ? parseFloat(editMaxBet) : null };
    const upd = m => m.id === updated.id ? updated : m;
    await saveMarkets({ games: markets.games.map(upd), futures: markets.futures.map(upd) });
    setEditingMarket(null); notify("Market updated! ✅");
  }

  async function handleAddMarket() {
    if (!addTitle.trim()) { notify("Title required", "error"); return; }
    const newId = addType === "game" ? `g_${uid()}` : `f_${uid()}`;
    let options = [];
    if (addType === "game") {
      if (!addTeamA.trim() || !addTeamB.trim() || !addOddsA || !addOddsB) { notify("Fill in both teams and odds", "error"); return; }
      const oA = parseInt(addOddsA), oB = parseInt(addOddsB);
      if (isNaN(oA) || isNaN(oB)) { notify("Odds must be numbers like +150 or -110", "error"); return; }
      options = [{ id: `${newId}_a`, label: addTeamA.trim(), odds: oA }, { id: `${newId}_b`, label: addTeamB.trim(), odds: oB }];
    } else {
      const valid = futureOptions.filter(o => o.label.trim() && o.odds);
      if (valid.length < 2) { notify("At least 2 options required", "error"); return; }
      options = valid.map((o, i) => ({ id: `${newId}_${i}`, label: o.label.trim(), odds: parseInt(o.odds) }));
    }
    const newMarket = { id: newId, type: addType, title: addTitle.trim(), subtitle: addSubtitle.trim() || "Custom Market", status: "open", winner: null, maxBet: addMaxBet ? parseFloat(addMaxBet) : null, options };
    await saveMarkets({ games: addType === "game" ? [...markets.games, newMarket] : markets.games, futures: addType === "future" ? [...markets.futures, newMarket] : markets.futures });
    setAddTitle(""); setAddSubtitle(""); setAddTeamA(""); setAddOddsA(""); setAddTeamB(""); setAddOddsB(""); setAddMaxBet("");
    setFutureOptions([{ label: "", odds: "" }, { label: "", odds: "" }]);
    notify("Market added! ✅");
  }

  async function deleteUser(name) {
    const newUsers = { ...users }; delete newUsers[name];
    await saveUsers(newUsers);
    await saveBets(bets.filter(b => b.username !== name));
    if (adjustingUser === name) setAdjustingUser(null);
    notify(`${name} deleted`);
  }

  async function applyBalanceAdjust(name) {
    const delta = parseFloat(adjustAmt);
    if (isNaN(delta)) { notify("Enter a number", "error"); return; }
    await saveUsers({ ...users, [name]: { ...users[name], balance: Math.max(0, (users[name]?.balance || 0) + delta) } });
    setAdjustingUser(null); setAdjustAmt("");
    notify(`Balance adjusted by ${delta >= 0 ? "+" : ""}$${delta.toFixed(2)}`);
  }

  async function toggleLeaderboard() {
    const newVal = !leaderboardVisible;
    setLeaderboardVisible(newVal);
    await storageSet("mln_leaderboard_visible", newVal);
    notify(newVal ? "Leaderboard visible to players" : "Leaderboard hidden from players");
  }

  async function saveHeaderMsg() {
    await storageSet("mln_header_msg", headerDraft.trim());
    notify(headerDraft.trim() ? "Banner saved!" : "Banner cleared");
  }

  async function resetAll() {
    await saveMarkets({ ...INITIAL_MARKETS }); await saveBets([]);
    const r = {};
    for (const u of Object.keys(users)) r[u] = { ...users[u], balance: STARTING_BALANCE };
    await saveUsers(r); notify("Everything reset!");
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return <div style={S.center}><div style={S.loadDot} /></div>;

  // ── Login ─────────────────────────────────────────────────────────────────

  if (screen === "login") {
    const name = inputName.trim();
    return (
      <div style={S.loginWrap}>
        <div style={S.loginBg} />
        <div style={S.loginCard}>
          <div style={S.loginLogoRow}>
            <span style={S.loginLogoIcon}>⚾</span>
            <div>
              <div style={S.loginLogoTitle}>MLN BETTING</div>
              <div style={S.loginLogoSub}>Fake Money · Real Bragging Rights</div>
            </div>
          </div>
          <div style={S.loginDivider} />

          {loginStep === "name" && (
            <>
              <label style={S.loginLabel}>PLAYER NAME</label>
              <input style={S.input} placeholder="Enter your name…" value={inputName}
                onChange={e => setInputName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && inputName.trim() && handleNameSubmit()} />
              <button style={{ ...S.btnPrimary, opacity: inputName.trim() ? 1 : 0.4 }} onClick={handleNameSubmit} disabled={!inputName.trim()}>Continue →</button>
              <button style={S.btnGhost} onClick={() => setScreen("admin")}>Admin Panel</button>
            </>
          )}

          {loginStep === "pin_login" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 13.0, color: "#64748b" }}>Welcome back, </span>
                <span style={{ fontSize: 13.0, color: "#6366f1", fontWeight: 700 }}>{name}</span>
              </div>
              <PinPad value={pinInput} onChange={p => { setPinInput(p); if (pinError) setPinError(""); }} label="Enter your PIN" error={pinError} />
              <button style={S.btnGhost} onClick={resetLoginToName}>← Back</button>
            </>
          )}

          {loginStep === "pin_create" && (
            <>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ margin: "0 0 4px", fontSize: 14.0, color: "#16a34a", fontWeight: 700 }}>Account not found</p>
                <p style={{ margin: "0 0 8px", fontSize: 13.0, color: "#64748b" }}>No account for <strong style={{ color: "#1e293b" }}>{name}</strong>. Names are case-sensitive — double-check your spelling.</p>
                <p style={{ margin: 0, fontSize: 12.0, color: "#16a34a" }}>If this is your first time, create an account below.</p>
              </div>
              <PinPad value={pinInput} onChange={setPinInput} label="Choose a 4-digit PIN" sublabel="You'll use this every time you log in" />
              <button style={S.btnGhost} onClick={resetLoginToName}>← Back</button>
            </>
          )}

          {loginStep === "pin_confirm" && (
            <>
              <PinPad value={pinInput} onChange={p => { setPinInput(p); if (pinError) setPinError(""); }} label="Confirm your PIN" sublabel="Enter it again to confirm" error={pinError} />
              <button style={S.btnGhost} onClick={() => { setLoginStep("pin_create"); setPinInput(""); setPinError(""); }}>← Back</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  if (screen === "admin") return (
    <div style={S.adminWrap}>
      <div style={S.adminHeader}>
        <button style={S.backBtn} onClick={() => { setAdminUnlocked(false); setAdminPin(""); setScreen("login"); }}>← Back</button>
        <div style={S.adminTitleRow}>
          <span style={S.adminTitle}>ADMIN</span>
          <span style={S.adminTitleSub}>MLN Betting</span>
        </div>
      </div>

      {!adminUnlocked ? (
        <div style={S.pinWrap}>
          <p style={S.pinLabel}>Enter admin PIN to unlock</p>
          <input style={S.input} type="password" placeholder="PIN" value={adminPin}
            onChange={e => setAdminPin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (adminPin === ADMIN_PIN ? setAdminUnlocked(true) : notify("Wrong PIN", "error"))} />
          <button style={S.btnPrimary} onClick={() => adminPin === ADMIN_PIN ? setAdminUnlocked(true) : notify("Wrong PIN", "error")}>Unlock →</button>
        </div>
      ) : (
        <>
          <div style={S.adminTabRow}>
            {[["settle","⚖️ Settle"],["players","👥 Players"],["add","➕ Add"],["edit","✏️ Edit"],["bets","📋 Bets"],["danger","⚠️ Danger"]].map(([key, label]) => (
              <button key={key} style={{ ...S.adminTab, ...(adminTab === key ? S.adminTabActive : {}) }} onClick={() => { setAdminTab(key); setEditingMarket(null); }}>{label}</button>
            ))}
          </div>
          <div style={S.adminContent}>

            {/* ── SETTLE TAB ── */}
            {adminTab === "settle" && (
              <>
                {/* House P&L summary */}
                <div style={{ ...S.adminSection, background: houseTotalNet >= 0 ? "#f0fdf4" : "#fff1f2", border: `1px solid ${houseTotalNet >= 0 ? "#bbf7d0" : "#fecaca"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ ...S.sectionHead, margin: 0 }}>HOUSE TAKE (ALL TIME)</p>
                    <span style={{ fontSize: 23.0, fontWeight: 700, color: houseTotalNet >= 0 ? "#16a34a" : "#ef4444" }}>
                      {houseTotalNet >= 0 ? "+" : ""}${houseTotalNet.toFixed(2)}
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 11.0, color: "#94a3b8" }}>
                    Across {allMarkets.filter(m => m.status === "settled").length} settled markets
                  </p>
                </div>

                {/* Pause all */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.settleBtn, flex: 1, textAlign: "center", background: "#fffbeb", borderColor: "#fde68a", color: "#d97706" }} onClick={pauseAllMarkets}>⏸ Pause All Markets</button>
                  <button style={{ ...S.settleBtn, flex: 1, textAlign: "center" }} onClick={unpauseAllMarkets}>▶️ Open All Markets</button>
                </div>

                {/* Settle markets */}
                <div style={S.adminSection}>
                  <p style={S.sectionHead}>SETTLE MARKETS</p>
                  {allMarkets.map(market => {
                    const pnl = market.status === "settled" ? getMarketPnl(market.id) : null;
                    const mTotal = market.options.reduce((s, o) => s + (optionTotals[o.id] || 0), 0);
                    return (
                      <div key={market.id} style={S.settleCard}>
                        <div style={S.settleTitle}>
                          <span>{market.title}</span>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {market.status === "settled" && <span style={S.settledBadge}>SETTLED</span>}
                            {market.status === "paused" && <span style={S.pausedBadge}>⏸ PAUSED</span>}
                          </div>
                        </div>

                        {/* Money distribution in admin */}
                        {mTotal > 0 && market.status !== "settled" && (
                          <div style={{ marginBottom: 10 }}>
                            {market.options.map(opt => {
                              const amt = optionTotals[opt.id] || 0;
                              const pct = mTotal > 0 ? amt / mTotal : 0;
                              const proj = getOptionProjection(market.id, opt.id);
                              const projNet = proj.net;
                              return (
                                <div key={opt.id} style={{ marginBottom: 8, background: "#f8fafc", borderRadius: 6, padding: "7px 10px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.0, color: "#64748b", marginBottom: 4 }}>
                                    <span style={{ fontWeight: 700, color: "#374151" }}>{opt.label}</span>
                                    <span style={{ color: "#6366f1" }}>{fmt(opt.odds)}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.0, color: "#64748b", marginBottom: 4 }}>
                                    <span>Action: ${amt.toFixed(0)} ({Math.round(pct * 100)}%)</span>
                                    <span style={{ fontWeight: 700, color: projNet >= 0 ? "#16a34a" : "#ef4444" }}>
                                      If wins: {projNet >= 0 ? "+" : ""}${projNet.toFixed(2)} house
                                    </span>
                                  </div>
                                  <div style={S.moneyBar}><div style={{ ...S.moneyBarFill, width: `${pct * 100}%`, background: "#58a6ff" }} /></div>
                                </div>
                              );
                            })}
                            <div style={{ fontSize: 11.0, color: "#94a3b8", marginTop: 2 }}>Total action: ${mTotal.toFixed(0)}</div>
                          </div>
                        )}

                        {/* Pause/open toggle for open/paused markets */}
                        {(market.status === "open" || market.status === "paused") && (
                          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                            <button style={{ ...S.settleBtn, background: market.status === "paused" ? "#0a1a0e" : "#1c1200", borderColor: market.status === "paused" ? "#166534" : "#92400e", color: market.status === "paused" ? "#4ade80" : "#f59e0b", fontSize: 12.0 }} onClick={() => togglePauseMarket(market.id)}>
                              {market.status === "paused" ? "▶ Open Betting" : "⏸ Pause Betting"}
                            </button>
                          </div>
                        )}

                        {market.status === "open" || market.status === "paused" ? (
                          <div style={S.settleOptions}>
                            {market.options.map(opt => <button key={opt.id} style={S.settleBtn} onClick={() => settleMarket(market.id, opt.id)}>✓ {opt.label}</button>)}
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <p style={S.winnerText}>🏆 {market.options.find(o => o.id === market.winner)?.label}</p>
                              <button style={{ ...S.settleBtn, background: "#faf5ff", borderColor: "#7f1d7f", color: "#9333ea", fontSize: 12.0, padding: "6px 12px" }}
                                onClick={() => { if (window.confirm(`Unsettle "${market.title}"? This reverses all payouts.`)) unsettleMarket(market.id); }}>
                                ↩ Unsettle
                              </button>
                            </div>
                            {/* P&L for settled market */}
                            <div
                              style={{ cursor: "pointer", background: expandedSettled === market.id ? "#f8fafc" : "transparent", borderRadius: 6, padding: expandedSettled === market.id ? "8px 10px" : "0" }}
                              onClick={() => setExpandedSettled(expandedSettled === market.id ? null : market.id)}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 11.0, color: "#94a3b8" }}>{expandedSettled === market.id ? "▲ hide" : "▼ house P&L"}</span>
                                {pnl && <span style={{ fontSize: 13.0, fontWeight: 700, color: pnl.net >= 0 ? "#16a34a" : "#ef4444" }}>{pnl.net >= 0 ? "+" : ""}${pnl.net.toFixed(2)}</span>}
                              </div>
                              {expandedSettled === market.id && pnl && (
                                <div style={{ marginTop: 8, fontSize: 12.0, color: "#64748b", display: "flex", flexDirection: "column", gap: 3 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total staked</span><span>${pnl.totalStaked.toFixed(2)}</span></div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total paid out</span><span>${pnl.totalPaid.toFixed(2)}</span></div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Bets resolved</span><span>{pnl.betCount}</span></div>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: pnl.net >= 0 ? "#16a34a" : "#ef4444", borderTop: "1px solid #f1f5f9", paddingTop: 4, marginTop: 2 }}>
                                    <span>Net house {pnl.net >= 0 ? "take" : "loss"}</span>
                                    <span>{pnl.net >= 0 ? "+" : ""}${pnl.net.toFixed(2)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── PLAYERS TAB ── */}
            {adminTab === "players" && (
              <div style={S.adminSection}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <p style={{ ...S.sectionHead, margin: 0 }}>PLAYERS ({leaderboard.length})</p>
                  <button onClick={toggleLeaderboard} style={{ ...S.adjustBtn, fontSize: 11.0, padding: "5px 12px", color: leaderboardVisible ? "#4ade80" : "#f59e0b", borderColor: leaderboardVisible ? "#166534" : "#92400e", background: leaderboardVisible ? "#0a1a0e" : "#1c1200" }}>
                    {leaderboardVisible ? "👁 Standings ON" : "🙈 Standings OFF"}
                  </button>
                </div>
                {leaderboard.length === 0 && <p style={S.emptyText}>No players yet</p>}
                {leaderboard.map(({ name, u, pendingAmt, total, _rank }) => {
                  const pnl = getPlayerLifetimePnl(name);
                  const isTied = leaderboard.filter(p => p._rank === _rank).length > 1;
                  const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unknown";
                  return (
                    <div key={name}>
                      <div style={{ ...S.leaderRow, alignItems: "flex-start", paddingTop: 10, paddingBottom: 10 }}>
                        {/* Rank */}
                        <span style={{ fontSize: 16.0, fontWeight: 700, color: "#ffffff", width: 34, flexShrink: 0, paddingTop: 2 }}>
                          {isTied ? `T${_rank}` : `#${_rank}`}
                        </span>
                        {/* Name + joined */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15.0, fontWeight: 600, color: "#1e293b", marginBottom: 2 }}>{name}</div>
                          <div style={{ fontSize: 11.0, color: "#94a3b8" }}>Joined {joined}</div>
                        </div>
                        {/* Balances */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, marginRight: 8 }}>
                          <span style={{ fontSize: 15.0, fontWeight: 700, color: "#ffffff" }}>${total.toFixed(2)}</span>
                          <div style={{ display: "flex", gap: 6 }}>
                            <span style={{ fontSize: 11.0, color: "#16a34a" }}>${u.balance.toFixed(0)} cash</span>
                            {pendingAmt > 0 && <span style={{ fontSize: 11.0, color: "#d97706" }}>${pendingAmt.toFixed(0)} bets</span>}
                          </div>
                          <span style={{ fontSize: 12.0, fontWeight: 700, color: pnl >= 0 ? "#16a34a" : "#ef4444" }}>
                            {pnl >= 0 ? "▲" : "▼"} ${Math.abs(pnl).toFixed(2)} lifetime
                          </span>
                        </div>
                        {/* Actions */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <button style={{ ...S.adjustBtn, fontSize: 11.0, padding: "3px 8px" }} onClick={() => notify(`${name}'s PIN: ${u.pin || "none"}`, "success")}>PIN</button>
                          <button style={S.adjustBtn} onClick={() => { setAdjustingUser(adjustingUser === name ? null : name); setAdjustAmt(""); }}>±</button>
                          <button style={{ ...S.adjustBtn, fontSize: 11.0, padding: "3px 8px", color: "#ef4444", borderColor: "#fecaca", background: "#fff1f2" }} onClick={() => { if (window.confirm(`Delete ${name}?`)) deleteUser(name); }}>✕</button>
                        </div>
                      </div>
                      {adjustingUser === name && (
                        <div style={S.adjustRow}>
                          <input style={{ ...S.input, flex: 1 }} type="number" placeholder="+100 or -50" value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)} />
                          <button style={S.btnCreate} onClick={() => applyBalanceAdjust(name)}>Apply</button>
                          <button style={S.btnRetry} onClick={() => setAdjustingUser(null)}>Cancel</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── ADD TAB ── */}
            {adminTab === "add" && (
              <div style={S.adminSection}>
                <p style={S.sectionHead}>ADD NEW MARKET</p>
                <div style={S.formRow}><label style={S.formLabel}>TYPE</label><div style={S.toggleRow}><button style={{ ...S.toggleBtn, ...(addType === "game" ? S.toggleBtnActive : {}) }} onClick={() => setAddType("game")}>Game</button><button style={{ ...S.toggleBtn, ...(addType === "future" ? S.toggleBtnActive : {}) }} onClick={() => setAddType("future")}>Future</button></div></div>
                <div style={S.formRow}><label style={S.formLabel}>TITLE</label><input style={S.input} placeholder="e.g. Aruba Sea Serpents vs Raccoon City Outbreak" value={addTitle} onChange={e => setAddTitle(e.target.value)} /></div>
                <div style={S.formRow}><label style={S.formLabel}>SUBTITLE <span style={{ color: "#64748b" }}>(optional)</span></label><input style={S.input} placeholder="e.g. Lunar League · Final" value={addSubtitle} onChange={e => setAddSubtitle(e.target.value)} /></div>
                <div style={S.formRow}><label style={S.formLabel}>MAX BET <span style={{ color: "#64748b" }}>(optional)</span></label><input style={S.input} placeholder="e.g. 200" value={addMaxBet} onChange={e => setAddMaxBet(e.target.value)} /></div>
                {addType === "game" ? (
                  [["TEAM A", addTeamA, setAddTeamA, addOddsA, setAddOddsA],["TEAM B", addTeamB, setAddTeamB, addOddsB, setAddOddsB]].map(([lbl, tn, stn, od, sod]) => (
                    <div key={lbl} style={S.formRow}><label style={S.formLabel}>{lbl}</label><div style={S.oddsRow}><input style={{ ...S.input, flex: 2 }} placeholder="Team name" value={tn} onChange={e => stn(e.target.value)} /><input style={{ ...S.input, flex: 1 }} placeholder="-110" value={od} onChange={e => sod(e.target.value)} /></div></div>
                  ))
                ) : (
                  <><label style={S.formLabel}>OPTIONS</label>{futureOptions.map((opt, i) => (<div key={i} style={{ ...S.oddsRow, marginBottom: 8, alignItems: "center" }}><input style={{ ...S.input, flex: 2 }} placeholder={`Option ${i + 1}`} value={opt.label} onChange={e => setFutureOptions(p => p.map((o, idx) => idx === i ? { ...o, label: e.target.value } : o))} /><input style={{ ...S.input, flex: 1 }} placeholder="+350" value={opt.odds} onChange={e => setFutureOptions(p => p.map((o, idx) => idx === i ? { ...o, odds: e.target.value } : o))} />{futureOptions.length > 2 && <button style={S.removeBtn} onClick={() => setFutureOptions(p => p.filter((_, idx) => idx !== i))}>✕</button>}</div>))}<button style={S.addOptionBtn} onClick={() => setFutureOptions(p => [...p, { label: "", odds: "" }])}>+ Add Option</button></>
                )}
                <button style={{ ...S.btnPrimary, marginTop: 18, width: "100%" }} onClick={handleAddMarket}>Add Market →</button>
              </div>
            )}

            {/* ── EDIT TAB ── */}
            {adminTab === "edit" && !editingMarket && (
              <>
                {/* Header message editor */}
                <div style={S.adminSection}>
                  <p style={S.sectionHead}>LOBBY BANNER MESSAGE</p>
                  <p style={{ fontSize: 12.0, color: "#94a3b8", marginBottom: 10 }}>Shown to all players when they log in. Leave blank to hide.</p>
                  <textarea style={{ ...S.input, minHeight: 70, resize: "vertical", lineHeight: 1.5 }} placeholder="e.g. 🏆 Semifinals are LIVE — place your bets before 7pm!" value={headerDraft} onChange={e => setHeaderDraft(e.target.value)} />
                  <button style={{ ...S.btnPrimary, marginTop: 10, width: "100%" }} onClick={saveHeaderMsg}>
                    {headerDraft.trim() ? "Save Banner →" : "Clear Banner"}
                  </button>
                </div>
                <div style={S.adminSection}>
                  <p style={S.sectionHead}>EDIT / PAUSE / REMOVE MARKETS</p>
                  {allMarkets.length === 0 && <p style={S.emptyText}>No markets</p>}
                  {allMarkets.map(market => (
                    <div key={market.id} style={S.settleCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><div style={{ fontSize: 14.0, fontWeight: 700, marginBottom: 2 }}>{market.title}</div><div style={{ fontSize: 11.0, color: market.status === "paused" ? "#f59e0b" : "#2e3a4e" }}>{market.status === "paused" ? "⏸ Paused" : market.subtitle}</div></div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {(market.status === "open" || market.status === "paused") && <button style={S.settleBtn} onClick={() => startEdit(market)}>Edit</button>}
                          {(market.status === "open" || market.status === "paused") && (
                            <button style={{ ...S.settleBtn, background: market.status === "paused" ? "#0a1a0e" : "#1a1408", borderColor: market.status === "paused" ? "#166534" : "#92400e", color: market.status === "paused" ? "#4ade80" : "#d97706" }} onClick={() => togglePauseMarket(market.id)}>
                              {market.status === "paused" ? "▶️ Open" : "⏸ Pause"}
                            </button>
                          )}
                          {market.status !== "settled" && <button style={{ ...S.settleBtn, background: "#fff1f2", borderColor: "#fecaca", color: "#ef4444" }} onClick={() => voidMarket(market.id)}>Void</button>}
                          {market.status === "settled" && <span style={S.settledBadge}>SETTLED</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {adminTab === "edit" && editingMarket && (
              <div style={S.adminSection}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <p style={{ ...S.sectionHead, margin: 0 }}>EDITING MARKET</p>
                    {editingMarket.status === "paused" && <p style={{ margin: "4px 0 0", fontSize: 11.0, color: "#d97706" }}>⏸ Currently paused</p>}
                  </div>
                  <button style={S.btnRetry} onClick={() => setEditingMarket(null)}>Cancel</button>
                </div>
                <div style={S.formRow}><label style={S.formLabel}>TITLE</label><input style={S.input} value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
                <div style={S.formRow}><label style={S.formLabel}>SUBTITLE</label><input style={S.input} value={editSubtitle} onChange={e => setEditSubtitle(e.target.value)} /></div>
                <div style={S.formRow}><label style={S.formLabel}>MAX BET <span style={{ color: "#64748b" }}>(blank = none)</span></label><input style={S.input} placeholder="e.g. 200" value={editMaxBet} onChange={e => setEditMaxBet(e.target.value)} /></div>
                <label style={S.formLabel}>OPTIONS</label>
                {editOptions.map((opt, i) => (<div key={opt.id} style={{ ...S.oddsRow, marginBottom: 8 }}><input style={{ ...S.input, flex: 2 }} value={opt.label} onChange={e => setEditOptions(p => p.map((o, idx) => idx === i ? { ...o, label: e.target.value } : o))} /><input style={{ ...S.input, flex: 1 }} value={opt.odds} onChange={e => setEditOptions(p => p.map((o, idx) => idx === i ? { ...o, odds: e.target.value } : o))} /></div>))}
                <button style={{ ...S.btnPrimary, marginTop: 14, width: "100%" }} onClick={saveEdit}>Save Changes →</button>
              </div>
            )}

            {/* ── BETS TAB ── */}
            {adminTab === "bets" && (
              <div style={S.adminSection}>
                <p style={S.sectionHead}>ALL BETS ({bets.length})</p>
                {bets.length === 0 && <p style={S.emptyText}>No bets placed yet</p>}
                {[...bets].reverse().map(b => (
                  <div key={b.id} style={S.betRow}>
                    <div style={S.betRowTop}><span style={S.betRowUser}>{b.username}</span><span style={{ fontSize: 12.0, fontWeight: 700, color: b.status === "won" ? "#16a34a" : b.status === "lost" ? "#ef4444" : b.status === "voided" ? "#94a3b8" : "#d97706" }}>{b.status === "won" ? "✓ WON" : b.status === "lost" ? "✗ LOST" : b.status === "voided" ? "↩ VOID" : "⏳ PENDING"}</span></div>
                    {b.betType === "parlay" ? (<><div style={{ fontSize: 11.0, color: "#3b82f6", marginBottom: 4, letterSpacing: 1 }}>PARLAY · {fmt(b.combinedOdds)}</div>{b.legs.map((l, i) => (<div key={i} style={{ fontSize: 13.0, color: "#64748b", marginBottom: 2 }}>{l.optionLabel} <span style={{ color: "#6366f1" }}>{fmt(l.odds)}</span><span style={{ marginLeft: 6, fontSize: 11.0, color: l.status === "won" ? "#16a34a" : l.status === "lost" ? "#ef4444" : "#94a3b8" }}>{l.status === "won" ? "✓" : l.status === "lost" ? "✗" : "⏳"}</span></div>))}</>) : (<><div style={S.betRowMarket}>{b.marketTitle}</div><div style={S.betRowPick}>{b.optionLabel} <span style={{ color: "#6366f1" }}>{fmt(b.odds)}</span></div></>)}
                    <div style={S.betRowAmounts}><span>Stake <strong>${b.stake.toFixed(2)}</strong></span><span>Payout <strong>${b.payout.toFixed(2)}</strong></span><span style={{ marginLeft: "auto", color: "#94a3b8" }}>{fmtTime(b.placedAt)}</span></div>
                  </div>
                ))}
              </div>
            )}

            {/* ── DANGER TAB ── */}
            {adminTab === "danger" && (
              <div style={S.adminSection}>
                <p style={S.sectionHead}>DANGER ZONE</p>
                <p style={{ color: "#64748b", fontSize: 14.0, marginBottom: 16, lineHeight: 1.6 }}>Resets all balances to ${STARTING_BALANCE.toLocaleString()}, clears all bets, and restores default markets. PINs are preserved.</p>
                <button style={S.btnDanger} onClick={resetAll}>Reset Everything</button>
              </div>
            )}
          </div>
        </>
      )}
      {notification && <Toast n={notification} />}
    </div>
  );

  // ── Lobby ──────────────────────────────────────────────────────────────────

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={S.headerLeft}><span style={S.headerIcon}>⚾</span><span style={S.headerLogo}>MLN BETTING</span></div>
        <div style={S.headerRight}>
          <div style={S.balancePill}><span style={S.balanceDollar}>$</span><span style={S.balanceAmt}>{balance.toFixed(2)}</span></div>
          <button style={S.avatarBtn} title={username} onClick={() => { setBetSlip({}); setScreen("login"); }}>{username[0]?.toUpperCase()}</button>
        </div>
      </div>

      {/* Header banner */}
      {headerMsg && (
        <div style={S.headerBanner}>{headerMsg}</div>
      )}

      <div style={S.tabs}>
        {[["games","🏟 Games"],["futures","🔮 Futures"],["leaderboard","🏅 Standings"],["mybets",`My Bets${userBets.length ? ` (${userBets.length})` : ""}`]]
          .filter(([key]) => key !== "leaderboard" || leaderboardVisible)
          .map(([key, label]) => (
            <button key={key} style={{ ...S.tab, ...(activeTab === key ? S.tabActive : {}) }} onClick={() => setActiveTab(key)}>{label}</button>
          ))}
      </div>

      <div style={S.content}>
        {(activeTab === "games" || activeTab === "futures") && (
          <>
            {displayMarkets.length === 0 && <div style={S.empty}><p style={S.emptyText}>No markets yet.</p></div>}
            {displayMarkets.map(market => {
              const meta = leagueMeta(market.subtitle);
              const marketBetTotal = market.options.reduce((sum, o) => sum + (optionTotals[o.id] || 0), 0);
              return (
                <div key={market.id} style={S.marketCard}>
                  <div style={S.marketTop}>
                    <span style={{ ...S.leagueTag, color: meta.color, background: meta.bg }}>{meta.tag}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {market.maxBet && <span style={S.maxBetTag}>Max ${market.maxBet}</span>}
                      {marketBetTotal > 0 && <span style={S.actionTag}>${marketBetTotal.toFixed(0)} action</span>}
                      {market.status === "paused" && <span style={S.pausedTag}>⏸ PAUSED</span>}
                      {market.status === "settled" && <span style={S.settledTag}>SETTLED</span>}
                    </div>
                  </div>
                  <h3 style={S.marketTitle}>{market.title}</h3>
                  <p style={S.marketSub}>{market.subtitle}</p>
                  {market.status === "paused" && <div style={S.pausedNotice}>Betting is paused — your existing bets are safe. Check back soon.</div>}
                  {market.status === "settled" && <div style={S.winnerAnnounce}>🏆 {market.options.find(o => o.id === market.winner)?.label}</div>}
                  <div style={S.optionGrid}>
                    {market.options.map(opt => {
                      const selected = !!betSlip[opt.id];
                      const disabled = market.status === "settled" || market.status === "paused";
                      const optTotal = optionTotals[opt.id] || 0;
                      const pct = marketBetTotal > 0 ? optTotal / marketBetTotal : 0;
                      return (
                        <div key={opt.id}>
                          <button disabled={disabled} style={{ ...S.optionBtn, ...(selected ? S.optionBtnSelected : {}), ...(disabled ? S.optionBtnDisabled : {}) }} onClick={() => !disabled && togglePick(market.id, opt.id)}>
                            <span style={S.optionLabel}>{opt.label}</span>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                              <span style={{ ...S.optionOdds, ...(selected ? S.optionOddsSelected : {}) }}>{fmt(opt.odds)}</span>
                              {marketBetTotal > 0 && <span style={S.optionMoney}>${optTotal.toFixed(0)} · {Math.round(pct * 100)}%</span>}
                            </div>
                          </button>
                          {marketBetTotal > 0 && <div style={S.moneyBar}><div style={{ ...S.moneyBarFill, width: `${pct * 100}%`, background: selected ? "#4ade80" : meta.color }} /></div>}
                        </div>
                      );
                    })}
                  </div>
                  {slipMode === "straight" && market.options.map(opt => {
                    if (!betSlip[opt.id]) return null;
                    const slip = betSlip[opt.id]; const stake = parseFloat(slip.stake) || 0; const win = stake > 0 ? toWin(stake, opt.odds) : 0;
                    return (
                      <div key={opt.id} style={S.stakeRow}>
                        <span style={S.stakeTeam}>{opt.label}</span>
                        <div style={S.stakeInputWrap}><span style={S.stakeDollar}>$</span><input style={S.stakeInput} type="number" placeholder="0" value={slip.stake} onChange={e => setStake(opt.id, e.target.value)} min="1" /></div>
                        {win > 0 && <span style={S.toWin}>to win ${win.toFixed(2)}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {slipEntries.length > 0 && (
              <div style={S.slipFooter}>
                {parlayEligible && (
                  <div style={S.slipModeRow}>
                    <button style={{ ...S.slipModeBtn, ...(slipMode === "straight" ? S.slipModeBtnActive : {}) }} onClick={() => setSlipMode("straight")}>Straight</button>
                    <button style={{ ...S.slipModeBtn, ...(slipMode === "parlay" ? S.slipModeBtnActive : {}) }} onClick={() => setSlipMode("parlay")}>Parlay {parlayOdds != null ? fmt(parlayOdds) : ""}</button>
                  </div>
                )}
                {slipMode === "parlay" && parlayEligible && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11.0, color: "#94a3b8", letterSpacing: 1, marginBottom: 6 }}>{slipEntries.length}-LEG PARLAY · {fmt(parlayOdds)}</div>
                    {slipLegs.map((l, i) => <div key={i} style={{ fontSize: 12.0, color: "#64748b", marginBottom: 3 }}><span style={{ color: "#6366f1", marginRight: 6 }}>{fmt(l.odds)}</span>{l.optionLabel}</div>)}
                    <div style={{ ...S.stakeRow, marginTop: 10 }}>
                      <span style={S.stakeTeam}>PARLAY STAKE</span>
                      <div style={S.stakeInputWrap}><span style={S.stakeDollar}>$</span><input style={S.stakeInput} type="number" placeholder="0" value={parlayStake} onChange={e => setParlayStake(e.target.value)} min="1" /></div>
                      {parlayPayout > 0 && <span style={S.toWin}>to win ${parlayPayout.toFixed(2)}</span>}
                    </div>
                  </div>
                )}
                {slipMode === "straight" && (
                  <div style={S.slipSummary}>
                    <div style={S.slipSummaryRow}><span style={S.slipSummaryLabel}>Total stake</span><span style={S.slipSummaryVal}>${straightTotal.toFixed(2)}</span></div>
                    <div style={S.slipSummaryRow}><span style={S.slipSummaryLabel}>Total potential payout</span><span style={{ ...S.slipSummaryVal, color: "#16a34a" }}>${straightPayout.toFixed(2)}</span></div>
                  </div>
                )}
                <button style={S.placeBetBtn} onClick={placeBets}>{slipMode === "parlay" ? "Place Parlay →" : `Place ${slipEntries.length} Bet${slipEntries.length > 1 ? "s" : ""} →`}</button>
              </div>
            )}
          </>
        )}

        {activeTab === "leaderboard" && (
          <>
            <div style={S.marketCard}>
              <h3 style={S.marketTitle}>Standings</h3>
              <p style={S.marketSub}>Starting balance ${STARTING_BALANCE.toLocaleString()}</p>
              {activePlayers.length === 0 && <p style={S.emptyText}>No bets placed yet.</p>}
              {activePlayers.map(({ name, u, pendingAmt, total, _rank }, i) => {
                const diff = total - STARTING_BALANCE;
                const isLast = i === activePlayers.length - 1;
                const prevTied = i > 0 && activePlayers[i-1]._rank === _rank;
                const nextTied = !isLast && activePlayers[i+1]._rank === _rank;
                const isTied = prevTied || nextTied;
                return (
                  <div key={name} style={{ ...S.boardRow, borderBottom: !isLast ? "1px solid #1a1a24" : "none" }}>
                    <div style={S.boardLeft}>
                      <span style={{ ...S.boardRank, fontSize: 16.0, color: "#1e293b", width: 32, fontWeight: 700 }}>
                        {isTied ? `T${_rank}` : `#${_rank}`}
                      </span>
                      <span style={{ ...S.boardName, color: name === username ? "#6366f1" : "#d0d0d0" }}>{name}{name === username ? " · you" : ""}</span>
                    </div>
                    <div style={S.boardRight}>
                      <span style={S.boardBal}>${total.toFixed(2)}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11.0, color: "#16a34a" }}>${u.balance.toFixed(0)} cash</span>
                        {pendingAmt > 0 && <span style={{ fontSize: 11.0, color: "#d97706" }}>${pendingAmt.toFixed(0)} in Open Bets</span>}
                      </div>
                      <span style={{ fontSize: 12.0, color: diff >= 0 ? "#16a34a" : "#ef4444" }}>{diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {inactivePlayers.length > 0 && (
              <div style={{ ...S.marketCard, opacity: 0.6 }}>
                <p style={{ fontSize: 10.0, letterSpacing: 2, color: "#64748b", fontWeight: 700, margin: "0 0 12px" }}>PLAYERS WHO HAVE NOT MADE BETS</p>
                {inactivePlayers.map(({ name, u }, i) => (
                  <div key={name} style={{ ...S.boardRow, borderBottom: i < inactivePlayers.length - 1 ? "1px solid #1a1a24" : "none" }}>
                    <div style={S.boardLeft}>
                      <span style={{ ...S.boardRank, fontSize: 16.0, color: "#64748b", width: 32 }}>—</span>
                      <span style={{ ...S.boardName, color: name === username ? "#6366f1" : "#555" }}>{name}{name === username ? " · you" : ""}</span>
                    </div>
                    <div style={S.boardRight}>
                      <span style={{ ...S.boardBal, color: "#64748b" }}>${u.balance.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "mybets" && (
          <>
            {userBets.length === 0 && <div style={S.empty}><p style={S.emptyText}>No bets yet.</p></div>}
            {[...userBets].reverse().map(b => (
              <div key={b.id} style={{ ...S.betCard, ...(b.status === "won" ? S.betCardWon : b.status === "lost" ? S.betCardLost : b.status === "voided" ? { opacity: 0.5 } : {}) }}>
                <div style={S.betCardTop}>
                  <span style={S.betMarket}>{b.betType === "parlay" ? <span style={{ color: "#3b82f6" }}>PARLAY · {fmt(b.combinedOdds)}</span> : b.marketTitle}</span>
                  <span style={{ fontSize: 12.0, fontWeight: 700, color: b.status === "won" ? "#16a34a" : b.status === "lost" ? "#ef4444" : b.status === "voided" ? "#94a3b8" : "#d97706" }}>{b.status === "won" ? "✓ WON" : b.status === "lost" ? "✗ LOST" : b.status === "voided" ? "↩ VOID" : "⏳ PENDING"}</span>
                </div>
                {b.betType === "parlay" ? b.legs.map((l, i) => <div key={i} style={{ fontSize: 13.0, color: "#64748b", marginBottom: 3, paddingLeft: 4 }}><span style={{ color: "#6366f1", marginRight: 6 }}>{fmt(l.odds)}</span>{l.optionLabel}<span style={{ marginLeft: 6, fontSize: 11.0, color: l.status === "won" ? "#16a34a" : l.status === "lost" ? "#ef4444" : "#94a3b8" }}>{l.status === "won" ? "✓" : l.status === "lost" ? "✗" : ""}</span></div>) : <div style={S.betPick}>{b.optionLabel} <span style={{ color: "#6366f1" }}>{fmt(b.odds)}</span></div>}
                <div style={S.betAmounts}><span>Stake <strong>${b.stake.toFixed(2)}</strong></span><span>Payout <strong>${b.payout.toFixed(2)}</strong></span></div>
                <div style={{ fontSize: 11.0, color: "#64748b", marginTop: 6 }}>{fmtTime(b.placedAt)}</div>
              </div>
            ))}
          </>
        )}
      </div>
      {notification && <Toast n={notification} />}
    </div>
  );
}

function Toast({ n }) {
  return <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: n.type === "error" ? "#ef4444" : "#16a34a", border: `1px solid ${n.type === "error" ? "#fca5a5" : "#bbf7d0"}`, color: "#ffffff", borderRadius: 50, padding: "12px 28px", fontFamily: "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 14.0, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>{n.msg}</div>;
}

// ─── Styles ────────────────────────────────────────────────────────────────

const FONT = "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const S = {
  wrap: { minHeight: "100vh", background: "#f8fafc", color: "#1e293b", fontFamily: FONT, paddingBottom: 140 },
  center: { minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" },
  loadDot: { width: 10, height: 10, borderRadius: "50%", background: "#6366f1" },

  // Login
  loginWrap: { minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative" },
  loginBg: { position: "fixed", inset: 0, background: "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(99,102,241,0.08) 0%, transparent 65%)", pointerEvents: "none" },
  loginCard: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 20, padding: "40px 32px", maxWidth: 380, width: "100%", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" },
  loginLogoRow: { display: "flex", alignItems: "center", gap: 14, marginBottom: 4 },
  loginLogoIcon: { fontSize: 37 },
  loginLogoTitle: { fontSize: 23, fontWeight: 700, letterSpacing: 1, color: "#1e293b", lineHeight: 1.2 },
  loginLogoSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  loginDivider: { height: 1, background: "#f1f5f9" },
  loginLabel: { fontSize: 11, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase" },
  input: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "13px 16px", color: "#1e293b", fontFamily: FONT, fontSize: 15, outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color 0.15s" },
  btnPrimary: { background: "#6366f1", color: "#ffffff", border: "none", borderRadius: 10, padding: "14px 24px", fontFamily: FONT, fontWeight: 600, fontSize: 15, cursor: "pointer", letterSpacing: 0.2 },
  btnGhost: { background: "transparent", color: "#94a3b8", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 24px", fontFamily: FONT, fontSize: 13, cursor: "pointer" },
  btnDanger: { background: "#fff1f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 20px", fontFamily: FONT, fontSize: 14, cursor: "pointer", width: "100%", fontWeight: 600 },
  btnCreate: { flex: 1, background: "#6366f1", color: "#ffffff", border: "none", borderRadius: 8, padding: "10px 8px", fontFamily: FONT, fontWeight: 600, fontSize: 13, cursor: "pointer" },
  btnRetry: { background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontFamily: FONT, fontSize: 13, cursor: "pointer" },

  // Header
  header: { background: "#ffffff", borderBottom: "1px solid #f1f5f9", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  headerIcon: { fontSize: 19 },
  headerLogo: { fontWeight: 700, fontSize: 15, letterSpacing: 0.5, color: "#1e293b" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  balancePill: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "5px 14px", display: "flex", alignItems: "baseline", gap: 2 },
  balanceDollar: { fontSize: 12, color: "#16a34a" },
  balanceAmt: { fontSize: 15, fontWeight: 700, color: "#16a34a" },
  avatarBtn: { background: "#6366f1", color: "#ffffff", border: "none", borderRadius: "50%", width: 33, height: 33, fontWeight: 700, cursor: "pointer", fontFamily: FONT, fontSize: 14 },
  headerBanner: { background: "#fffbeb", borderBottom: "1px solid #fde68a", padding: "10px 20px", fontSize: 14, color: "#92400e", textAlign: "center", lineHeight: 1.4, fontWeight: 500 },

  // Tabs
  tabs: { display: "flex", borderBottom: "1px solid #f1f5f9", background: "#ffffff", position: "sticky", top: 57, zIndex: 9, overflowX: "auto" },
  tab: { flex: "1 0 auto", background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "#94a3b8", padding: "13px 12px", fontFamily: FONT, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", letterSpacing: 0.2 },
  tabActive: { color: "#6366f1", borderBottom: "2px solid #6366f1", fontWeight: 600 },
  content: { padding: "16px 16px 120px" },

  // Market cards
  marketCard: { background: "#ffffff", border: "1px solid #e8edf2", borderRadius: 14, padding: 20, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  marketTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  leagueTag: { fontSize: 10, fontWeight: 600, letterSpacing: 1, borderRadius: 5, padding: "3px 9px" },
  settledTag: { fontSize: 10, background: "#f0fdf4", color: "#16a34a", borderRadius: 5, padding: "3px 9px", fontWeight: 600, border: "1px solid #bbf7d0" },
  pausedTag: { fontSize: 10, background: "#fffbeb", color: "#d97706", borderRadius: 5, padding: "3px 9px", fontWeight: 600, border: "1px solid #fde68a" },
  pausedBadge: { fontSize: 10, background: "#fffbeb", color: "#d97706", borderRadius: 5, padding: "3px 9px", fontWeight: 600, border: "1px solid #fde68a" },
  pausedNotice: { margin: "0 0 12px", fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "9px 13px", fontWeight: 500 },
  maxBetTag: { fontSize: 10, background: "#eef2ff", color: "#6366f1", borderRadius: 5, padding: "3px 9px", fontWeight: 600 },
  actionTag: { fontSize: 10, color: "#94a3b8" },
  marketTitle: { margin: "0 0 3px", fontSize: 17, fontWeight: 700, lineHeight: 1.3, color: "#1e293b" },
  marketSub: { margin: "0 0 14px", fontSize: 11, color: "#94a3b8", fontWeight: 400 },
  winnerAnnounce: { margin: "0 0 12px", fontSize: 14, color: "#16a34a", fontWeight: 700, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "9px 13px" },
  optionGrid: { display: "flex", flexDirection: "column", gap: 8 },
  optionBtn: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "13px 16px", cursor: "pointer", width: "100%", transition: "all 0.12s" },
  optionBtnSelected: { background: "#f0fdf4", border: "1.5px solid #16a34a" },
  optionBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
  optionLabel: { fontSize: 14, color: "#374151", fontFamily: FONT, textAlign: "left", fontWeight: 500 },
  optionOdds: { fontSize: 15, fontWeight: 700, color: "#6366f1" },
  optionOddsSelected: { color: "#16a34a" },
  optionMoney: { fontSize: 10, color: "#94a3b8" },
  moneyBar: { height: 3, background: "#f1f5f9", borderRadius: 2, marginTop: 3, marginBottom: 4, overflow: "hidden" },
  moneyBarFill: { height: "100%", borderRadius: 2, transition: "width 0.4s ease", opacity: 0.7 },
  stakeRow: { marginTop: 9, background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "11px 15px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 },
  stakeTeam: { fontSize: 11, color: "#16a34a", flex: "1 1 100%", marginBottom: 2, fontWeight: 600 },
  stakeInputWrap: { display: "flex", alignItems: "center", gap: 4 },
  stakeDollar: { color: "#16a34a", fontSize: 15, fontWeight: 700 },
  stakeInput: { background: "transparent", border: "none", borderBottom: "1.5px solid #bbf7d0", color: "#1e293b", fontFamily: FONT, fontSize: 15, width: 90, outline: "none", padding: "2px 4px" },
  toWin: { fontSize: 13, color: "#16a34a", marginLeft: "auto", fontWeight: 600 },
  slipFooter: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#ffffff", borderTop: "1px solid #e2e8f0", padding: "14px 16px", zIndex: 20, boxShadow: "0 -4px 20px rgba(0,0,0,0.07)" },
  slipModeRow: { display: "flex", gap: 6, marginBottom: 12 },
  slipModeBtn: { flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: 8, padding: "8px 12px", fontFamily: FONT, fontSize: 12, cursor: "pointer", fontWeight: 500 },
  slipModeBtnActive: { background: "#f0fdf4", border: "1.5px solid #16a34a", color: "#16a34a", fontWeight: 700 },
  slipSummary: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", marginBottom: 10 },
  slipSummaryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  slipSummaryLabel: { fontSize: 11, color: "#94a3b8" },
  slipSummaryVal: { fontSize: 14, fontWeight: 700, color: "#1e293b" },
  placeBetBtn: { width: "100%", background: "#6366f1", color: "#ffffff", border: "none", borderRadius: 10, padding: "14px", fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: "pointer", letterSpacing: 0.2 },

  // Bet cards
  betCard: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 17, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  betCardWon: { border: "1px solid #bbf7d0", background: "#f0fdf4" },
  betCardLost: { border: "1px solid #fecaca", background: "#fff1f2" },
  betCardTop: { display: "flex", justifyContent: "space-between", marginBottom: 9 },
  betMarket: { fontSize: 11, color: "#94a3b8" },
  betPick: { fontSize: 16, fontWeight: 700, marginBottom: 9, color: "#1e293b" },
  betAmounts: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#64748b", marginTop: 9 },

  // Leaderboard
  empty: { textAlign: "center", padding: "60px 20px" },
  emptyText: { color: "#94a3b8", fontSize: 14, margin: 0 },
  boardRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0" },
  boardLeft: { display: "flex", alignItems: "center", gap: 12 },
  boardRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 },
  boardRank: { fontSize: 16, color: "#1e293b", width: 32, fontWeight: 700 },
  boardName: { fontSize: 15, fontWeight: 600 },
  boardBal: { fontSize: 16, fontWeight: 700, color: "#16a34a" },

  // Admin
  adminWrap: { minHeight: "100vh", background: "#f8fafc", color: "#1e293b", fontFamily: FONT, padding: "20px 16px" },
  adminHeader: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  backBtn: { background: "transparent", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: FONT, fontSize: 13 },
  adminTitleRow: { display: "flex", flexDirection: "column" },
  adminTitle: { fontSize: 17, letterSpacing: 1, color: "#1e293b", fontWeight: 700, lineHeight: 1 },
  adminTitleSub: { fontSize: 11, color: "#94a3b8", marginTop: 3 },
  pinWrap: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 300 },
  pinLabel: { color: "#64748b", fontSize: 14, margin: 0 },
  adminTabRow: { display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" },
  adminTab: { background: "#ffffff", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: 8, padding: "8px 14px", fontFamily: FONT, fontSize: 13, cursor: "pointer", fontWeight: 500 },
  adminTabActive: { background: "#6366f1", color: "#ffffff", border: "1px solid #6366f1", fontWeight: 700 },
  adminContent: { display: "flex", flexDirection: "column", gap: 14 },
  adminSection: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  sectionHead: { margin: "0 0 14px", fontSize: 11, letterSpacing: 1.5, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" },
  leaderRow: { display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap" },
  leaderRank: { fontSize: 11, color: "#94a3b8", width: 22 },
  leaderName: { flex: 1, fontSize: 15, fontWeight: 500, minWidth: 80, color: "#1e293b" },
  leaderBal: { fontSize: 15, fontWeight: 700, color: "#16a34a" },
  adjustBtn: { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: 6, padding: "4px 10px", fontFamily: FONT, fontSize: 13, cursor: "pointer" },
  adjustRow: { display: "flex", gap: 8, alignItems: "center", padding: "8px 0 12px", borderBottom: "1px solid #f1f5f9" },
  settleCard: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 15, marginBottom: 10 },
  settleTitle: { fontSize: 14, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", color: "#1e293b" },
  settledBadge: { fontSize: 10, background: "#f0fdf4", color: "#16a34a", borderRadius: 5, padding: "2px 9px", fontWeight: 600, border: "1px solid #bbf7d0" },
  settleOptions: { display: "flex", flexDirection: "column", gap: 7 },
  settleBtn: { background: "#ffffff", border: "1px solid #bbf7d0", color: "#16a34a", borderRadius: 8, padding: "9px 14px", fontFamily: FONT, fontSize: 13, cursor: "pointer", textAlign: "left", fontWeight: 500 },
  winnerText: { margin: 0, fontSize: 14, color: "#6366f1", fontWeight: 700 },
  formRow: { marginBottom: 15 },
  formLabel: { display: "block", fontSize: 11, color: "#94a3b8", letterSpacing: 1, marginBottom: 7, fontWeight: 700, textTransform: "uppercase" },
  toggleRow: { display: "flex", gap: 8 },
  toggleBtn: { flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: 8, padding: 10, fontFamily: FONT, fontSize: 14, cursor: "pointer" },
  toggleBtnActive: { background: "#6366f1", color: "#ffffff", border: "1px solid #6366f1", fontWeight: 700 },
  oddsRow: { display: "flex", gap: 8 },
  removeBtn: { background: "#fff1f2", color: "#ef4444", border: "none", borderRadius: 6, width: 36, height: 44, cursor: "pointer", flexShrink: 0, fontSize: 13 },
  addOptionBtn: { background: "transparent", border: "1px dashed #e2e8f0", color: "#94a3b8", borderRadius: 8, padding: 10, fontFamily: FONT, fontSize: 13, cursor: "pointer", width: "100%", marginTop: 4 },
  betRow: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 13, marginBottom: 8 },
  betRowTop: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  betRowUser: { fontSize: 14, fontWeight: 700, color: "#6366f1" },
  betRowMarket: { fontSize: 11, color: "#94a3b8", marginBottom: 3 },
  betRowPick: { fontSize: 14, fontWeight: 600, marginBottom: 7, color: "#1e293b" },
  betRowAmounts: { display: "flex", gap: 12, fontSize: 12, color: "#64748b", flexWrap: "wrap" },
};
