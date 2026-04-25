import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

// ─── Firebase Config ──────────────────────────────────────────────────────────
// Replace each value below with the matching value from your Firebase console
const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_apiKey",
  authDomain: "REPLACE_WITH_YOUR_authDomain",
  databaseURL: "REPLACE_WITH_YOUR_databaseURL",
  projectId: "REPLACE_WITH_YOUR_projectId",
  storageBucket: "REPLACE_WITH_YOUR_storageBucket",
  messagingSenderId: "REPLACE_WITH_YOUR_messagingSenderId",
  appId: "REPLACE_WITH_YOUR_appId",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ─── Data ─────────────────────────────────────────────────────────────────────

const INITIAL_MARKETS = {
  games: [
    { id: "lsf1", type: "game", title: "Sea Serpents vs Melonheads", subtitle: "Lunar League · Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "lsf1_ss", label: "Aruba Sea Serpents", odds: -225 }, { id: "lsf1_mel", label: "Melonheads", odds: +180 }] },
    { id: "lsf2", type: "game", title: "Outbreak vs McDophers", subtitle: "Lunar League · Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "lsf2_out", label: "Outbreak", odds: -110 }, { id: "lsf2_mcd", label: "Sopher McDophers", odds: -111 }] },
    { id: "gsf1", type: "game", title: "Gorillas vs Slayers", subtitle: "Galactic League · Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "gsf1_gor", label: "Gorillas", odds: -200 }, { id: "gsf1_sla", label: "Slayers", odds: +161 }] },
    { id: "gsf2", type: "game", title: "Grizzlies vs Ancients", subtitle: "Galactic League · Semifinal", status: "open", winner: null, maxBet: null,
      options: [{ id: "gsf2_gri", label: "Grizzlies", odds: -101 }, { id: "gsf2_anc", label: "Ancients", odds: -121 }] },
  ],
  futures: [
    { id: "lunar_champ", type: "future", title: "Lunar League Champion", subtitle: "Season Future", status: "open", winner: null, maxBet: null,
      options: [{ id: "lc_ss", label: "Aruba Sea Serpents", odds: +165 }, { id: "lc_mcd", label: "Sopher McDophers", odds: +273 }, { id: "lc_out", label: "Outbreak", odds: +274 }, { id: "lc_mel", label: "Melonheads", odds: +631 }] },
    { id: "galactic_champ", type: "future", title: "Galactic League Champion", subtitle: "Season Future", status: "open", winner: null, maxBet: null,
      options: [{ id: "gc_gor", label: "Gorillas", odds: +178 }, { id: "gc_anc", label: "Ancients", odds: +251 }, { id: "gc_gri", label: "Grizzlies", odds: +298 }, { id: "gc_sla", label: "Slayers", odds: +549 }] },
    { id: "toos", type: "future", title: "ToOS Winner", subtitle: "Championship Future", status: "open", winner: null, maxBet: null,
      options: [{ id: "toos_ss", label: "Aruba Sea Serpents", odds: +340 }, { id: "toos_gor", label: "Gorillas", odds: +476 }, { id: "toos_mcd", label: "Sopher McDophers", odds: +571 }, { id: "toos_out", label: "Outbreak", odds: +573 }, { id: "toos_anc", label: "Ancients", odds: +674 }, { id: "toos_gri", label: "Grizzlies", odds: +820 }, { id: "toos_mel", label: "Melonheads", odds: +1570 }, { id: "toos_sla", label: "Slayers", odds: +1753 }] },
  ],
};

const STARTING_BALANCE = 1000;
const ADMIN_PIN = "543211";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (subtitle.toLowerCase().includes("lunar")) return { tag: "LUNAR", color: "#58a6ff", bg: "rgba(88,166,255,0.08)" };
  if (subtitle.toLowerCase().includes("galactic")) return { tag: "GALACTIC", color: "#bc8cff", bg: "rgba(188,140,255,0.08)" };
  if (subtitle.toLowerCase().includes("toos") || subtitle.toLowerCase().includes("championship")) return { tag: "ToOS", color: "#d4a843", bg: "rgba(212,168,67,0.08)" };
  return { tag: "FUTURE", color: "#888", bg: "transparent" };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function parseFirebase(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return val; } }
  // Firebase converts arrays to objects — convert back
  if (typeof val === "object" && !Array.isArray(val)) {
    const keys = Object.keys(val);
    const isArray = keys.every(k => !isNaN(k));
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

// ─── PIN Pad Component ────────────────────────────────────────────────────────

function PinPad({ value, onChange, label, sublabel, error }) {
  const dots = [0, 1, 2, 3];
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  function press(k) {
    if (k === "⌫") { onChange(value.slice(0, -1)); return; }
    if (k === "") return;
    if (value.length < 4) onChange(value + k);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "#8a9ab0", textAlign: "center", letterSpacing: 0.5 }}>{label}</p>
        {sublabel && <p style={{ margin: 0, fontSize: 11, color: "#2e3a4e", textAlign: "center" }}>{sublabel}</p>}
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {dots.map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: "50%",
            background: i < value.length ? "#d4a843" : "transparent",
            border: `2px solid ${i < value.length ? "#d4a843" : error ? "#ef4444" : "#2e3a4e"}`,
            transition: "all 0.15s"
          }} />
        ))}
      </div>
      {error && <p style={{ margin: "-10px 0 -6px", fontSize: 11, color: "#ef4444", textAlign: "center" }}>{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: 200 }}>
        {keys.map((k, i) => (
          <button key={i} onClick={() => press(k)}
            style={{
              height: 54, background: k === "" ? "transparent" : "#0e1318",
              border: k === "" ? "none" : "1px solid #1e2530",
              borderRadius: 12, color: k === "⌫" ? "#8a9ab0" : "#e2e8f0",
              fontSize: k === "⌫" ? 18 : 20, fontWeight: 600,
              cursor: k === "" ? "default" : "pointer",
              fontFamily: "monospace",
              transition: "background 0.1s",
              pointerEvents: k === "" ? "none" : "auto",
            }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Core state ──
  const [screen, setScreen] = useState("login");
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState({});
  const [markets, setMarkets] = useState(INITIAL_MARKETS);
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // ── Login flow state ──
  const [inputName, setInputName] = useState("");
  // loginStep: "name" | "pin_login" | "pin_wrong" | "pin_create" | "pin_confirm"
  const [loginStep, setLoginStep] = useState("name");
  const [pinInput, setPinInput] = useState("");
  const [pendingPin, setPendingPin] = useState("");   // stores first entry during confirm
  const [pinError, setPinError] = useState("");

  // ── Lobby state ──
  const [betSlip, setBetSlip] = useState({});
  const [slipMode, setSlipMode] = useState("straight");
  const [parlayStake, setParlayStake] = useState("");
  const [activeTab, setActiveTab] = useState("games");

  // ── Admin state ──
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

  // Load data on mount, then keep in sync with real-time listeners
  useEffect(() => {
    // Step 1: initial load with get() — reliable, same as before
    (async () => {
      const [u, m, b] = await Promise.all([
        storageGet("mln_users"),
        storageGet("mln_markets"),
        storageGet("mln_bets"),
      ]);
      if (u) setUsers(u);
      if (m) setMarkets(m);
      setBets(Array.isArray(b) ? b : []);
      setLoading(false);
    })();

    // Step 2: real-time listeners for live updates (pauses, odds changes, etc.)
    const u1 = onValue(ref(db, "mln_users"), snap => {
      if (snap.exists()) { const v = parseFirebase(snap.val()); if (v) setUsers(v); }
    }, () => {});
    const u2 = onValue(ref(db, "mln_markets"), snap => {
      if (snap.exists()) { const v = parseFirebase(snap.val()); if (v) setMarkets(v); }
    }, () => {});
    const u3 = onValue(ref(db, "mln_bets"), snap => {
      const v = snap.exists() ? parseFirebase(snap.val()) : [];
      setBets(Array.isArray(v) ? v : []);
    }, () => {});

    return () => { u1(); u2(); u3(); };
  }, []);

  // 30-minute inactivity timeout — kicks back to login so users get fresh data
  useEffect(() => {
    if (screen !== "lobby") return;
    const TIMEOUT = 30 * 60 * 1000;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setBetSlip({}); setScreen("login"); setUsername("");
      }, TIMEOUT);
    };
    reset();
    window.addEventListener("click", reset);
    window.addEventListener("keypress", reset);
    window.addEventListener("touchstart", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", reset);
      window.removeEventListener("keypress", reset);
      window.removeEventListener("touchstart", reset);
    };
  }, [screen]);

  // Auto-advance PIN when 4 digits entered
  useEffect(() => {
    if (pinInput.length < 4) return;
    const timer = setTimeout(() => handlePinComplete(pinInput), 150);
    return () => clearTimeout(timer);
  }, [pinInput, loginStep]);

  function notify(msg, type = "success") {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3200);
  }

  async function saveUsers(u) { setUsers(u); await storageSet("mln_users", u); }
  async function saveMarkets(m) { setMarkets(m); await storageSet("mln_markets", m); }
  async function saveBets(b) { setBets(b); await storageSet("mln_bets", b); }

  // ── Login flow ─────────────────────────────────────────────────────────────

  function handleNameSubmit() {
    const name = inputName.trim();
    if (!name) return;
    setPinInput(""); setPinError("");
    if (users[name]) {
      setLoginStep("pin_login");
    } else {
      setLoginStep("pin_create");
    }
  }

  async function handlePinComplete(pin) {
    const name = inputName.trim();

    if (loginStep === "pin_login") {
      if (pin === users[name]?.pin) {
        setUsername(name); setScreen("lobby");
        setInputName(""); setLoginStep("name"); setPinInput(""); setPinError("");
      } else {
        setPinError("Incorrect PIN — try again");
        setPinInput("");
      }
      return;
    }

    if (loginStep === "pin_create") {
      setPendingPin(pin);
      setPinInput("");
      setPinError("");
      setLoginStep("pin_confirm");
      return;
    }

    if (loginStep === "pin_confirm") {
      if (pin === pendingPin) {
        const newUsers = { ...users, [name]: { balance: STARTING_BALANCE, pin } };
        await saveUsers(newUsers);
        setUsername(name); setScreen("lobby");
        setInputName(""); setLoginStep("name"); setPinInput(""); setPinError(""); setPendingPin("");
      } else {
        setPinError("PINs don't match — start over");
        setPinInput("");
        setTimeout(() => { setLoginStep("pin_create"); setPinError(""); }, 800);
      }
      return;
    }
  }

  function resetLoginToName() {
    setLoginStep("name"); setPinInput(""); setPinError(""); setPendingPin("");
  }

  // ── Bet slip ───────────────────────────────────────────────────────────────

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

  function togglePick(marketId, optionId) {
    if (betSlip[optionId]) { const c = { ...betSlip }; delete c[optionId]; setBetSlip(c); return; }
    const c = {};
    for (const [k, v] of slipEntries) { if (v.marketId !== marketId) c[k] = v; }
    c[optionId] = { marketId, stake: "" };
    setBetSlip(c);
    // If adding a future pick while in parlay mode, reset to straight
    const market = allMarkets.find(m => m.id === marketId);
    if (market?.type === "future" && slipMode === "parlay") setSlipMode("straight");
  }

  function setStake(optionId, val) { setBetSlip(p => ({ ...p, [optionId]: { ...p[optionId], stake: val } })); }

  const balance = users[username]?.balance ?? STARTING_BALANCE;
  const userBets = bets.filter(b => b.username === username);
  const leaderboard = Object.entries(users).sort((a, b) => b[1].balance - a[1].balance);
  const displayMarkets = activeTab === "games" ? markets.games : markets.futures;

  // ── Place bets ─────────────────────────────────────────────────────────────

  async function placeBets() {
    if (slipEntries.length === 0) return;
    // Re-check market status at placement time (catches paused markets on stale sessions)
    for (const [, v] of slipEntries) {
      const market = allMarkets.find(m => m.id === v.marketId);
      if (market?.status === "paused") { notify(`${market.title} is currently paused`, "error"); return; }
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

  // ── Admin: settle ──────────────────────────────────────────────────────────

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
    notify(newStatus === "paused" ? "⏸ Market paused — no new bets accepted" : "▶️ Market reopened — bets accepted");
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

  async function applyBalanceAdjust(name) {
    const delta = parseFloat(adjustAmt);
    if (isNaN(delta)) { notify("Enter a number", "error"); return; }
    await saveUsers({ ...users, [name]: { ...users[name], balance: Math.max(0, (users[name]?.balance || 0) + delta) } });
    setAdjustingUser(null); setAdjustAmt("");
    notify(`Balance adjusted by ${delta >= 0 ? "+" : ""}$${delta.toFixed(2)}`);
  }

  async function resetAll() {
    await saveMarkets({ ...INITIAL_MARKETS }); await saveBets([]);
    const r = {};
    for (const u of Object.keys(users)) r[u] = { ...users[u], balance: STARTING_BALANCE };
    await saveUsers(r); notify("Everything reset!");
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return <div style={S.center}><div style={S.loadDot} /></div>;

  // ── Login ──────────────────────────────────────────────────────────────────

  if (screen === "login") {
    const name = inputName.trim();
    const isExisting = !!users[name];

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

          {/* STEP 1: Name */}
          {loginStep === "name" && (
            <>
              <label style={S.loginLabel}>PLAYER NAME</label>
              <input style={S.input} placeholder="Enter your name…" value={inputName}
                onChange={e => setInputName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && inputName.trim() && handleNameSubmit()} />
              <button style={{ ...S.btnPrimary, opacity: inputName.trim() ? 1 : 0.4 }} onClick={handleNameSubmit} disabled={!inputName.trim()}>
                Continue →
              </button>
              <button style={S.btnGhost} onClick={() => setScreen("admin")}>Admin Panel</button>
            </>
          )}

          {/* STEP 2a: PIN login */}
          {loginStep === "pin_login" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#8a9ab0" }}>Welcome back, </span>
                <span style={{ fontSize: 12, color: "#d4a843", fontWeight: 700 }}>{name}</span>
              </div>
              <PinPad value={pinInput} onChange={p => { setPinInput(p); if (pinError) setPinError(""); }}
                label="Enter your PIN" error={pinError} />
              <button style={S.btnGhost} onClick={resetLoginToName}>← Back</button>
            </>
          )}

          {/* STEP 2b: Create PIN */}
          {loginStep === "pin_create" && (
            <>
              <div style={{ background: "#0e1c10", border: "1px solid #166534", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#4ade80", fontWeight: 700 }}>Account not found</p>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#8a9ab0" }}>No account for <strong style={{ color: "#e2e8f0" }}>{name}</strong>. Double-check your spelling — names are case sensitive.</p>
                <p style={{ margin: 0, fontSize: 11, color: "#4ade80" }}>If this is your first time, create an account below.</p>
              </div>
              <PinPad value={pinInput} onChange={setPinInput}
                label="Choose a 4-digit PIN" sublabel="You'll use this every time you log in" />
              <button style={S.btnGhost} onClick={resetLoginToName}>← Back</button>
            </>
          )}

          {/* STEP 2c: Confirm PIN */}
          {loginStep === "pin_confirm" && (
            <>
              <PinPad value={pinInput} onChange={p => { setPinInput(p); if (pinError) setPinError(""); }}
                label="Confirm your PIN" sublabel="Enter it again to confirm" error={pinError} />
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
            {[["settle","⚖️ Settle"],["add","➕ Add"],["edit","✏️ Edit"],["bets","📋 Bets"],["danger","⚠️ Danger"]].map(([key, label]) => (
              <button key={key} style={{ ...S.adminTab, ...(adminTab === key ? S.adminTabActive : {}) }} onClick={() => { setAdminTab(key); setEditingMarket(null); }}>{label}</button>
            ))}
          </div>
          <div style={S.adminContent}>

            {adminTab === "settle" && (
              <>
                <div style={S.adminSection}>
                  <p style={S.sectionHead}>LEADERBOARD</p>
                  {leaderboard.length === 0 && <p style={S.emptyText}>No players yet</p>}
                  {leaderboard.map(([name, u], i) => (
                    <div key={name}>
                      <div style={S.leaderRow}>
                        <span style={S.leaderRank}>#{i + 1}</span>
                        <span style={S.leaderName}>{name}</span>
                        <span style={S.leaderBal}>${u.balance.toFixed(2)}</span>
                        <button style={{ ...S.adjustBtn, fontSize: 10, padding: "4px 8px" }}
                          onClick={() => notify(`${name}'s PIN: ${u.pin || "none"}`, "success")}>PIN</button>
                        <button style={S.adjustBtn} onClick={() => { setAdjustingUser(adjustingUser === name ? null : name); setAdjustAmt(""); }}>±</button>
                      </div>
                      {adjustingUser === name && (
                        <div style={S.adjustRow}>
                          <input style={{ ...S.input, flex: 1 }} type="number" placeholder="+100 or -50" value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)} />
                          <button style={S.btnCreate} onClick={() => applyBalanceAdjust(name)}>Apply</button>
                          <button style={S.btnRetry} onClick={() => setAdjustingUser(null)}>Cancel</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={S.adminSection}>
                  <p style={S.sectionHead}>SETTLE MARKETS</p>
                  {allMarkets.map(market => (
                    <div key={market.id} style={S.settleCard}>
                      <div style={S.settleTitle}>
                        <span>{market.title}</span>
                        {market.status === "settled" && <span style={S.settledBadge}>SETTLED</span>}
                        {market.status === "paused" && <span style={S.pausedBadge}>⏸ PAUSED</span>}
                      </div>
                      {(market.status === "open" || market.status === "paused") && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                          <button
                            style={{ ...S.settleBtn, background: market.status === "paused" ? "#0a1a0e" : "#1c1200", borderColor: market.status === "paused" ? "#166534" : "#92400e", color: market.status === "paused" ? "#4ade80" : "#f59e0b", fontSize: 11 }}
                            onClick={() => togglePauseMarket(market.id)}>
                            {market.status === "paused" ? "▶ Open Betting" : "⏸ Pause Betting"}
                          </button>
                        </div>
                      )}
                      {market.status === "open" || market.status === "paused" ? (
                        <div style={S.settleOptions}>
                          {market.options.map(opt => <button key={opt.id} style={S.settleBtn} onClick={() => settleMarket(market.id, opt.id)}>✓ {opt.label}</button>)}
                        </div>
                      ) : <p style={S.winnerText}>🏆 {market.options.find(o => o.id === market.winner)?.label}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {adminTab === "add" && (
              <div style={S.adminSection}>
                <p style={S.sectionHead}>ADD NEW MARKET</p>
                <div style={S.formRow}><label style={S.formLabel}>TYPE</label><div style={S.toggleRow}><button style={{ ...S.toggleBtn, ...(addType === "game" ? S.toggleBtnActive : {}) }} onClick={() => setAddType("game")}>Game</button><button style={{ ...S.toggleBtn, ...(addType === "future" ? S.toggleBtnActive : {}) }} onClick={() => setAddType("future")}>Future</button></div></div>
                <div style={S.formRow}><label style={S.formLabel}>TITLE</label><input style={S.input} placeholder="e.g. Sea Serpents vs Outbreak" value={addTitle} onChange={e => setAddTitle(e.target.value)} /></div>
                <div style={S.formRow}><label style={S.formLabel}>SUBTITLE <span style={{ color: "#333" }}>(optional)</span></label><input style={S.input} placeholder="e.g. Lunar League · Final" value={addSubtitle} onChange={e => setAddSubtitle(e.target.value)} /></div>
                <div style={S.formRow}><label style={S.formLabel}>MAX BET <span style={{ color: "#333" }}>(optional)</span></label><input style={S.input} placeholder="e.g. 200" value={addMaxBet} onChange={e => setAddMaxBet(e.target.value)} /></div>
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

            {adminTab === "edit" && !editingMarket && (
              <div style={S.adminSection}>
                <p style={S.sectionHead}>EDIT / PAUSE / REMOVE MARKETS</p>
                {allMarkets.length === 0 && <p style={S.emptyText}>No markets</p>}
                {allMarkets.map(market => (
                  <div key={market.id} style={S.settleCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{market.title}</div>
                        <div style={{ fontSize: 10, color: market.status === "paused" ? "#f59e0b" : "#2e3a4e" }}>
                          {market.status === "paused" ? "⏸ Paused — bets locked" : market.subtitle}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {(market.status === "open" || market.status === "paused") && (
                          <button style={S.settleBtn} onClick={() => startEdit(market)}>Edit</button>
                        )}
                        {(market.status === "open" || market.status === "paused") && (
                          <button style={{ ...S.settleBtn, background: market.status === "paused" ? "#0a1a0e" : "#1a1408", borderColor: market.status === "paused" ? "#166534" : "#92400e", color: market.status === "paused" ? "#4ade80" : "#fbbf24" }}
                            onClick={() => togglePauseMarket(market.id)}>
                            {market.status === "paused" ? "▶️ Open" : "⏸ Pause"}
                          </button>
                        )}
                        {market.status !== "settled" && (
                          <button style={{ ...S.settleBtn, background: "#2a0808", borderColor: "#7f1d1d", color: "#f87171" }} onClick={() => voidMarket(market.id)}>Void</button>
                        )}
                        {market.status === "settled" && <span style={S.settledBadge}>SETTLED</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === "edit" && editingMarket && (
              <div style={S.adminSection}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <p style={{ ...S.sectionHead, margin: 0 }}>EDITING MARKET</p>
                    {editingMarket.status === "paused" && <p style={{ margin: "4px 0 0", fontSize: 10, color: "#f59e0b" }}>⏸ Currently paused — odds update takes effect when reopened</p>}
                  </div>
                  <button style={S.btnRetry} onClick={() => setEditingMarket(null)}>Cancel</button>
                </div>
                <div style={S.formRow}><label style={S.formLabel}>TITLE</label><input style={S.input} value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
                <div style={S.formRow}><label style={S.formLabel}>SUBTITLE</label><input style={S.input} value={editSubtitle} onChange={e => setEditSubtitle(e.target.value)} /></div>
                <div style={S.formRow}><label style={S.formLabel}>MAX BET <span style={{ color: "#333" }}>(blank = none)</span></label><input style={S.input} placeholder="e.g. 200" value={editMaxBet} onChange={e => setEditMaxBet(e.target.value)} /></div>
                <label style={S.formLabel}>OPTIONS</label>
                {editOptions.map((opt, i) => (<div key={opt.id} style={{ ...S.oddsRow, marginBottom: 8 }}><input style={{ ...S.input, flex: 2 }} value={opt.label} onChange={e => setEditOptions(p => p.map((o, idx) => idx === i ? { ...o, label: e.target.value } : o))} /><input style={{ ...S.input, flex: 1 }} value={opt.odds} onChange={e => setEditOptions(p => p.map((o, idx) => idx === i ? { ...o, odds: e.target.value } : o))} /></div>))}
                <button style={{ ...S.btnPrimary, marginTop: 14, width: "100%" }} onClick={saveEdit}>Save Changes →</button>
              </div>
            )}

            {adminTab === "bets" && (
              <div style={S.adminSection}>
                <p style={S.sectionHead}>ALL BETS ({bets.length})</p>
                {bets.length === 0 && <p style={S.emptyText}>No bets placed yet</p>}
                {[...bets].reverse().map(b => (
                  <div key={b.id} style={S.betRow}>
                    <div style={S.betRowTop}><span style={S.betRowUser}>{b.username}</span><span style={{ fontSize: 11, fontWeight: 700, color: b.status === "won" ? "#4ade80" : b.status === "lost" ? "#f87171" : b.status === "voided" ? "#888" : "#fbbf24" }}>{b.status === "won" ? "✓ WON" : b.status === "lost" ? "✗ LOST" : b.status === "voided" ? "↩ VOID" : "⏳ PENDING"}</span></div>
                    {b.betType === "parlay" ? (<><div style={{ fontSize: 10, color: "#58a6ff", marginBottom: 4, letterSpacing: 1 }}>PARLAY · {fmt(b.combinedOdds)}</div>{b.legs.map((l, i) => (<div key={i} style={{ fontSize: 12, color: "#8a9ab0", marginBottom: 2 }}>{l.optionLabel} <span style={{ color: "#d4a843" }}>{fmt(l.odds)}</span><span style={{ marginLeft: 6, fontSize: 10, color: l.status === "won" ? "#4ade80" : l.status === "lost" ? "#f87171" : "#555" }}>{l.status === "won" ? "✓" : l.status === "lost" ? "✗" : "⏳"}</span></div>))}</>) : (<><div style={S.betRowMarket}>{b.marketTitle}</div><div style={S.betRowPick}>{b.optionLabel} <span style={{ color: "#d4a843" }}>{fmt(b.odds)}</span></div></>)}
                    <div style={S.betRowAmounts}><span>Stake <strong>${b.stake.toFixed(2)}</strong></span><span>Payout <strong>${b.payout.toFixed(2)}</strong></span><span style={{ marginLeft: "auto", color: "#444" }}>{fmtTime(b.placedAt)}</span></div>
                  </div>
                ))}
              </div>
            )}

            {adminTab === "danger" && (
              <div style={S.adminSection}>
                <p style={S.sectionHead}>DANGER ZONE</p>
                <p style={{ color: "#555", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>Resets all balances to ${STARTING_BALANCE.toLocaleString()}, clears all bets, and restores default markets. PINs are preserved.</p>
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

      <div style={S.tabs}>
        {[["games","🏟 Games"],["futures","🔮 Futures"],["leaderboard","🏅 Standings"],["mybets",`My Bets${userBets.length ? ` (${userBets.length})` : ""}`]].map(([key, label]) => (
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
                    const slip = betSlip[opt.id];
                    const stake = parseFloat(slip.stake) || 0;
                    const win = stake > 0 ? toWin(stake, opt.odds) : 0;
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
                    <div style={{ fontSize: 10, color: "#2e3a4e", letterSpacing: 1, marginBottom: 6 }}>{slipEntries.length}-LEG PARLAY · {fmt(parlayOdds)}</div>
                    {slipLegs.map((l, i) => <div key={i} style={{ fontSize: 11, color: "#8a9ab0", marginBottom: 3 }}><span style={{ color: "#d4a843", marginRight: 6 }}>{fmt(l.odds)}</span>{l.optionLabel}</div>)}
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
                    <div style={S.slipSummaryRow}><span style={S.slipSummaryLabel}>Total potential payout</span><span style={{ ...S.slipSummaryVal, color: "#4ade80" }}>${straightPayout.toFixed(2)}</span></div>
                  </div>
                )}
                <button style={S.placeBetBtn} onClick={placeBets}>{slipMode === "parlay" ? "Place Parlay →" : `Place ${slipEntries.length} Bet${slipEntries.length > 1 ? "s" : ""} →`}</button>
              </div>
            )}
          </>
        )}

        {activeTab === "leaderboard" && (
          <div style={S.marketCard}>
            <h3 style={S.marketTitle}>Standings</h3>
            <p style={S.marketSub}>Starting balance ${STARTING_BALANCE.toLocaleString()}</p>
            {leaderboard.length === 0 && <p style={S.emptyText}>No players yet</p>}
            {leaderboard.map(([name, u], i) => {
              const diff = u.balance - STARTING_BALANCE;
              return (
                <div key={name} style={{ ...S.boardRow, borderBottom: i < leaderboard.length - 1 ? "1px solid #1a1a24" : "none" }}>
                  <div style={S.boardLeft}><span style={S.boardRank}>#{i + 1}</span><span style={{ ...S.boardName, color: name === username ? "#d4a843" : "#d0d0d0" }}>{name}{name === username ? " · you" : ""}</span></div>
                  <div style={S.boardRight}><span style={S.boardBal}>${u.balance.toFixed(2)}</span><span style={{ fontSize: 11, color: diff >= 0 ? "#4ade80" : "#f87171" }}>{diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(2)}</span></div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "mybets" && (
          <>
            {userBets.length === 0 && <div style={S.empty}><p style={S.emptyText}>No bets yet.</p></div>}
            {[...userBets].reverse().map(b => (
              <div key={b.id} style={{ ...S.betCard, ...(b.status === "won" ? S.betCardWon : b.status === "lost" ? S.betCardLost : b.status === "voided" ? { opacity: 0.5 } : {}) }}>
                <div style={S.betCardTop}>
                  <span style={S.betMarket}>{b.betType === "parlay" ? <span style={{ color: "#58a6ff" }}>PARLAY · {fmt(b.combinedOdds)}</span> : b.marketTitle}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: b.status === "won" ? "#22c55e" : b.status === "lost" ? "#ef4444" : b.status === "voided" ? "#666" : "#f59e0b" }}>{b.status === "won" ? "✓ WON" : b.status === "lost" ? "✗ LOST" : b.status === "voided" ? "↩ VOID" : "⏳ PENDING"}</span>
                </div>
                {b.betType === "parlay" ? b.legs.map((l, i) => <div key={i} style={{ fontSize: 12, color: "#8a9ab0", marginBottom: 3, paddingLeft: 4 }}><span style={{ color: "#d4a843", marginRight: 6 }}>{fmt(l.odds)}</span>{l.optionLabel}<span style={{ marginLeft: 6, fontSize: 10, color: l.status === "won" ? "#4ade80" : l.status === "lost" ? "#f87171" : "#555" }}>{l.status === "won" ? "✓" : l.status === "lost" ? "✗" : ""}</span></div>) : <div style={S.betPick}>{b.optionLabel} <span style={{ color: "#d4a843" }}>{fmt(b.odds)}</span></div>}
                <div style={S.betAmounts}><span>Stake <strong>${b.stake.toFixed(2)}</strong></span><span>Payout <strong>${b.payout.toFixed(2)}</strong></span></div>
                <div style={{ fontSize: 10, color: "#333", marginTop: 6 }}>{fmtTime(b.placedAt)}</div>
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
  return <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: n.type === "error" ? "#7f1d1d" : "#14532d", border: `1px solid ${n.type === "error" ? "#991b1b" : "#166534"}`, color: n.type === "error" ? "#fca5a5" : "#86efac", borderRadius: 50, padding: "12px 28px", fontFamily: "monospace", fontSize: 13, fontWeight: 700, zIndex: 100, whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>{n.msg}</div>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  wrap: { minHeight: "100vh", background: "#080b10", color: "#e2e8f0", fontFamily: "'IBM Plex Mono','Courier New',monospace", paddingBottom: 140 },
  center: { minHeight: "100vh", background: "#080b10", display: "flex", alignItems: "center", justifyContent: "center" },
  loadDot: { width: 10, height: 10, borderRadius: "50%", background: "#d4a843" },
  loginWrap: { minHeight: "100vh", background: "#080b10", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative" },
  loginBg: { position: "fixed", inset: 0, background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(212,168,67,0.07) 0%, transparent 70%)", pointerEvents: "none" },
  loginCard: { background: "#0e1318", border: "1px solid #1e2530", borderRadius: 20, padding: "36px 28px", maxWidth: 360, width: "100%", display: "flex", flexDirection: "column", gap: 16, position: "relative", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" },
  loginLogoRow: { display: "flex", alignItems: "center", gap: 14, marginBottom: 4 },
  loginLogoIcon: { fontSize: 36 },
  loginLogoTitle: { fontSize: 22, fontWeight: 700, letterSpacing: 5, color: "#d4a843", lineHeight: 1.2 },
  loginLogoSub: { fontSize: 10, color: "#3a4050", letterSpacing: 1.5, marginTop: 2 },
  loginDivider: { height: 1, background: "#1a2030", margin: "0" },
  loginLabel: { fontSize: 10, color: "#3a4050", letterSpacing: 2 },
  notFoundBox: { background: "#12080a", border: "1px solid #3f1215", borderRadius: 12, padding: 14 },
  notFoundText: { margin: "0 0 4px", fontSize: 13, color: "#fca5a5" },
  notFoundSub: { margin: "0 0 12px", fontSize: 11, color: "#555" },
  notFoundActions: { display: "flex", gap: 8 },
  btnCreate: { flex: 1, background: "#d4a843", color: "#080b10", border: "none", borderRadius: 8, padding: "10px 8px", fontFamily: "monospace", fontWeight: 700, fontSize: 12, cursor: "pointer" },
  btnRetry: { background: "transparent", color: "#555", border: "1px solid #1e2530", borderRadius: 8, padding: "10px 12px", fontFamily: "monospace", fontSize: 12, cursor: "pointer" },
  input: { background: "#080b10", border: "1px solid #1e2530", borderRadius: 10, padding: "13px 16px", color: "#e2e8f0", fontFamily: "monospace", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" },
  btnPrimary: { background: "#d4a843", color: "#080b10", border: "none", borderRadius: 10, padding: "14px 24px", fontFamily: "monospace", fontWeight: 700, fontSize: 14, cursor: "pointer", letterSpacing: 1 },
  btnGhost: { background: "transparent", color: "#2a3040", border: "1px solid #1a2030", borderRadius: 10, padding: "12px 24px", fontFamily: "monospace", fontSize: 12, cursor: "pointer" },
  btnDanger: { background: "#2a0808", color: "#fca5a5", border: "1px solid #7f1d1d", borderRadius: 10, padding: "12px 20px", fontFamily: "monospace", fontSize: 13, cursor: "pointer", width: "100%" },
  header: { background: "#080b10", borderBottom: "1px solid #141820", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  headerIcon: { fontSize: 18 },
  headerLogo: { fontWeight: 700, fontSize: 14, letterSpacing: 4, color: "#d4a843" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  balancePill: { background: "#0d1a10", border: "1px solid #1a3020", borderRadius: 20, padding: "5px 14px", display: "flex", alignItems: "baseline", gap: 2 },
  balanceDollar: { fontSize: 11, color: "#4ade80" },
  balanceAmt: { fontSize: 14, fontWeight: 700, color: "#4ade80" },
  avatarBtn: { background: "#d4a843", color: "#080b10", border: "none", borderRadius: "50%", width: 32, height: 32, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", fontSize: 13 },
  tabs: { display: "flex", borderBottom: "1px solid #141820", background: "#080b10", position: "sticky", top: 57, zIndex: 9, overflowX: "auto" },
  tab: { flex: "1 0 auto", background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "#2e3a4e", padding: "13px 10px", fontFamily: "monospace", fontSize: 11, letterSpacing: 0.5, cursor: "pointer", whiteSpace: "nowrap" },
  tabActive: { color: "#d4a843", borderBottom: "2px solid #d4a843" },
  content: { padding: "16px 14px 120px" },
  marketCard: { background: "#0e1318", border: "1px solid #1a2030", borderRadius: 14, padding: 18, marginBottom: 12 },
  marketTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  leagueTag: { fontSize: 9, fontWeight: 700, letterSpacing: 2.5, borderRadius: 4, padding: "3px 8px" },
  settledTag: { fontSize: 9, background: "#0d2a14", color: "#4ade80", borderRadius: 4, padding: "3px 8px", letterSpacing: 1 },
  pausedTag: { fontSize: 9, background: "#1c1200", color: "#f59e0b", borderRadius: 4, padding: "3px 8px", letterSpacing: 1, border: "1px solid #92400e" },
  pausedBadge: { fontSize: 9, background: "#1c1200", color: "#f59e0b", borderRadius: 4, padding: "2px 8px", letterSpacing: 1, border: "1px solid #92400e" },
  pausedNotice: { margin: "0 0 12px", fontSize: 12, color: "#92400e", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "8px 12px" },
  maxBetTag: { fontSize: 9, background: "#1a1408", color: "#d4a843", borderRadius: 4, padding: "3px 8px" },
  actionTag: { fontSize: 9, color: "#3a4a5a" },
  marketTitle: { margin: "0 0 3px", fontSize: 16, fontWeight: 700, lineHeight: 1.3 },
  marketSub: { margin: "0 0 14px", fontSize: 10, color: "#2e3a4e" },
  winnerAnnounce: { margin: "0 0 12px", fontSize: 13, color: "#d4a843", fontWeight: 700, background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.15)", borderRadius: 8, padding: "8px 12px" },
  optionGrid: { display: "flex", flexDirection: "column", gap: 7 },
  optionBtn: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#080b10", border: "1px solid #1a2030", borderRadius: 10, padding: "12px 16px", cursor: "pointer", width: "100%" },
  optionBtnSelected: { background: "#0a1a0e", border: "1px solid #166534" },
  optionBtnDisabled: { opacity: 0.35, cursor: "not-allowed" },
  optionLabel: { fontSize: 13, color: "#c8d0dc", fontFamily: "monospace", textAlign: "left" },
  optionOdds: { fontSize: 14, fontWeight: 700, color: "#d4a843" },
  optionOddsSelected: { color: "#4ade80" },
  optionMoney: { fontSize: 9, color: "#2e3a4e" },
  moneyBar: { height: 3, background: "#1a2030", borderRadius: 2, marginTop: 3, marginBottom: 4, overflow: "hidden" },
  moneyBarFill: { height: "100%", borderRadius: 2, transition: "width 0.4s ease", opacity: 0.5 },
  stakeRow: { marginTop: 8, background: "#080b10", border: "1px solid #166534", borderRadius: 10, padding: "10px 14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 },
  stakeTeam: { fontSize: 10, color: "#4ade80", flex: "1 1 100%", marginBottom: 2 },
  stakeInputWrap: { display: "flex", alignItems: "center", gap: 4 },
  stakeDollar: { color: "#4ade80", fontSize: 14, fontWeight: 700 },
  stakeInput: { background: "transparent", border: "none", borderBottom: "1px solid #166534", color: "#e2e8f0", fontFamily: "monospace", fontSize: 14, width: 90, outline: "none", padding: "2px 4px" },
  toWin: { fontSize: 12, color: "#22c55e", marginLeft: "auto" },
  slipFooter: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#0e1318", borderTop: "1px solid #1e2530", padding: "14px 16px", zIndex: 20, boxShadow: "0 -8px 32px rgba(0,0,0,0.5)" },
  slipModeRow: { display: "flex", gap: 6, marginBottom: 12 },
  slipModeBtn: { flex: 1, background: "#080b10", border: "1px solid #1e2530", color: "#3a4a5a", borderRadius: 8, padding: "8px 12px", fontFamily: "monospace", fontSize: 11, cursor: "pointer" },
  slipModeBtnActive: { background: "#1a2010", border: "1px solid #166534", color: "#4ade80", fontWeight: 700 },
  slipSummary: { background: "#080b10", border: "1px solid #1e2530", borderRadius: 10, padding: "10px 14px", marginBottom: 10 },
  slipSummaryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  slipSummaryLabel: { fontSize: 10, color: "#2e3a4e" },
  slipSummaryVal: { fontSize: 13, fontWeight: 700 },
  placeBetBtn: { width: "100%", background: "#d4a843", color: "#080b10", border: "none", borderRadius: 10, padding: "14px", fontFamily: "monospace", fontWeight: 700, fontSize: 14, cursor: "pointer", letterSpacing: 1 },
  betCard: { background: "#0e1318", border: "1px solid #1a2030", borderRadius: 12, padding: 16, marginBottom: 10 },
  betCardWon: { border: "1px solid #14532d", background: "#060e08" },
  betCardLost: { border: "1px solid #7f1d1d", background: "#0e0608" },
  betCardTop: { display: "flex", justifyContent: "space-between", marginBottom: 8 },
  betMarket: { fontSize: 10, color: "#2e3a4e" },
  betPick: { fontSize: 15, fontWeight: 700, marginBottom: 8 },
  betAmounts: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#3a4a5a", marginTop: 8 },
  empty: { textAlign: "center", padding: "60px 20px" },
  emptyText: { color: "#2e3a4e", fontSize: 13, margin: 0 },
  boardRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" },
  boardLeft: { display: "flex", alignItems: "center", gap: 10 },
  boardRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 },
  boardRank: { fontSize: 10, color: "#2e3a4e", width: 24 },
  boardName: { fontSize: 14, fontWeight: 600 },
  boardBal: { fontSize: 15, fontWeight: 700, color: "#4ade80" },
  adminWrap: { minHeight: "100vh", background: "#080b10", color: "#e2e8f0", fontFamily: "monospace", padding: "20px 16px" },
  adminHeader: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  backBtn: { background: "transparent", border: "1px solid #1a2030", color: "#3a4a5a", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: "monospace", fontSize: 12 },
  adminTitleRow: { display: "flex", flexDirection: "column" },
  adminTitle: { fontSize: 16, letterSpacing: 5, color: "#d4a843", fontWeight: 700, lineHeight: 1 },
  adminTitleSub: { fontSize: 10, color: "#2e3a4e", letterSpacing: 2, marginTop: 3 },
  pinWrap: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 300 },
  pinLabel: { color: "#3a4a5a", fontSize: 13, margin: 0 },
  adminTabRow: { display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" },
  adminTab: { background: "#0e1318", border: "1px solid #1a2030", color: "#3a4a5a", borderRadius: 8, padding: "8px 14px", fontFamily: "monospace", fontSize: 12, cursor: "pointer" },
  adminTabActive: { background: "#d4a843", color: "#080b10", border: "1px solid #d4a843", fontWeight: 700 },
  adminContent: { display: "flex", flexDirection: "column", gap: 14 },
  adminSection: { background: "#0e1318", border: "1px solid #1a2030", borderRadius: 14, padding: 18 },
  sectionHead: { margin: "0 0 14px", fontSize: 10, letterSpacing: 2.5, color: "#2e3a4e", fontWeight: 700 },
  leaderRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #141820" },
  leaderRank: { fontSize: 10, color: "#2e3a4e", width: 22 },
  leaderName: { flex: 1, fontSize: 14 },
  leaderBal: { fontSize: 14, fontWeight: 700, color: "#4ade80" },
  adjustBtn: { background: "#1a2030", border: "1px solid #2a3040", color: "#3a4a5a", borderRadius: 6, padding: "4px 10px", fontFamily: "monospace", fontSize: 12, cursor: "pointer" },
  adjustRow: { display: "flex", gap: 8, alignItems: "center", padding: "8px 0 12px", borderBottom: "1px solid #141820" },
  settleCard: { background: "#080b10", border: "1px solid #1a2030", borderRadius: 10, padding: 14, marginBottom: 10 },
  settleTitle: { fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 },
  settledBadge: { fontSize: 9, background: "#0d2a14", color: "#4ade80", borderRadius: 4, padding: "2px 8px", letterSpacing: 1 },
  settleOptions: { display: "flex", flexDirection: "column", gap: 6 },
  settleBtn: { background: "#0a1a0e", border: "1px solid #14532d", color: "#4ade80", borderRadius: 8, padding: "9px 14px", fontFamily: "monospace", fontSize: 12, cursor: "pointer", textAlign: "left" },
  winnerText: { margin: 0, fontSize: 13, color: "#d4a843" },
  formRow: { marginBottom: 14 },
  formLabel: { display: "block", fontSize: 10, color: "#2e3a4e", letterSpacing: 2, marginBottom: 6, fontWeight: 700 },
  toggleRow: { display: "flex", gap: 8 },
  toggleBtn: { flex: 1, background: "#080b10", border: "1px solid #1a2030", color: "#3a4a5a", borderRadius: 8, padding: 10, fontFamily: "monospace", fontSize: 13, cursor: "pointer" },
  toggleBtnActive: { background: "#d4a843", color: "#080b10", border: "1px solid #d4a843", fontWeight: 700 },
  oddsRow: { display: "flex", gap: 8 },
  removeBtn: { background: "#2a0808", color: "#fca5a5", border: "none", borderRadius: 6, width: 36, height: 44, cursor: "pointer", flexShrink: 0, fontSize: 12 },
  addOptionBtn: { background: "transparent", border: "1px dashed #1a2030", color: "#2e3a4e", borderRadius: 8, padding: 10, fontFamily: "monospace", fontSize: 12, cursor: "pointer", width: "100%", marginTop: 4 },
  betRow: { background: "#080b10", border: "1px solid #1a2030", borderRadius: 10, padding: 12, marginBottom: 8 },
  betRowTop: { display: "flex", justifyContent: "space-between", marginBottom: 4 },
  betRowUser: { fontSize: 13, fontWeight: 700, color: "#d4a843" },
  betRowStatus: { fontSize: 11, fontWeight: 700 },
  betRowMarket: { fontSize: 10, color: "#2e3a4e", marginBottom: 3 },
  betRowPick: { fontSize: 13, fontWeight: 700, marginBottom: 6 },
  betRowAmounts: { display: "flex", gap: 12, fontSize: 11, color: "#3a4a5a", flexWrap: "wrap" },
};
