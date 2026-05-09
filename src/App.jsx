import { useState, useEffect } from "react"; 
import { initializeApp } from "firebase/app"; 
import { getDatabase, ref, set, get, onValue } from "firebase/database"; 
// ─── Font injection ────────────────────────────────────────────────────────── if (typeof document !== "undefined" && !document.getElementById("mln-fonts")) {  const link = document.createElement("link"); 
 link.id = "mln-fonts"; 
 link.rel = "stylesheet"; 
 link.href = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display document.head.appendChild(link); 
} 
// ─── Firebase Config ─────────────────────────────────────────────────────── const firebaseConfig = { 
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
 { id: "lsf1", type: "game", title: "Aruba Sea Serpents vs Humongous Melonheads", subtitl options: [{ id: "lsf1_ss", label: "Aruba Sea Serpents", odds: -225 }, { id: "lsf1_mel", { id: "lsf2", type: "game", title: "Raccoon City Outbreak vs Sopher McDophers", subtitle: options: [{ id: "lsf2_out", label: "Raccoon City Outbreak", odds: -110 }, { id: "lsf2_ { id: "gsf1", type: "game", title: "Gas House Gorillas vs Sunnydale Slayers", subtitle:  options: [{ id: "gsf1_gor", label: "Gas House Gorillas", odds: -200 }, { id: "gsf1_sla { id: "gsf2", type: "game", title: "Ursa Major Grizzlies vs R'lyeh Ancients", subtitle:  options: [{ id: "gsf2_gri", label: "Ursa Major Grizzlies", odds: -101 }, { id: "gsf2_a ], 
 futures: [ 
 { id: "lunar_champ", type: "future", title: "Lunar League Champion", subtitle: "Season F options: [{ id: "lc_ss", label: "Aruba Sea Serpents", odds: +165 }, { id: "lc_mcd", la { id: "galactic_champ", type: "future", title: "Galactic League Champion", subtitle: "Se options: [{ id: "gc_gor", label: "Gas House Gorillas", odds: +178 }, { id: "gc_anc", l
 { id: "toos", type: "future", title: "ToOS Winner", subtitle: "Championship Future", sta options: [{ id: "toos_ss", label: "Aruba Sea Serpents", odds: +340 }, { id: "toos_gor", ], 
}; 
const STARTING_BALANCE = 1000; 
const ADMIN_PIN = "543211"; 
// ─── Banned words ────────────────────────────────────────────────────────── const BANNED_WORDS = [ 
 "fuck","shit","ass","bitch","cunt","dick","cock","pussy","prick","bastard",  "asshole","motherfucker","fucker","bullshit","horseshit","jackass","dumbass",  "fatass","smartass","badass","arsehole","arse","twat","slut","whore","fag",  "faggot","retard","nigger","nigga","spic","chink","kike","wetback","tranny",  "dyke","tits","titties","boobs","boob","nipple","penis","vagina","vulva",  "balls","testicle","scrotum","boner","erection","dildo","butthole","anus",  "rectum","cum","jizz","sperm","pubic","nutsack","wank","wanker","tosser",  "piss","pissed","poop","crap","turd","douchebag","douche","twatwaffle",  "shithead","dipshit","goddamn","goddammit","damnit","hell","damned", ]; 
function containsBannedWord(str) { 
 const normalized = str.toLowerCase().replace(/[^a-z]/g, ""); 
 return BANNED_WORDS.some(w => normalized.includes(w)); 
} 
// Case-insensitive user lookup — finds the canonical stored key for any casing function findUserKey(users, inputName) { 
 const lower = inputName.trim().toLowerCase(); 
 return Object.keys(users).find(k => k.toLowerCase() === lower) || null; } 
// ─── Helpers ─────────────────────────────────────────────────────────────── 
const fmt = o => o > 0 ? `+${o}` : `${o}`; 
const toDecimal = o => o > 0 ? o / 100 + 1 : 100 / Math.abs(o) + 1; 
const toWin = (stake, odds) => odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds); const calcPayout = (stake, odds) => stake + toWin(stake, odds); 
const uid = () => Math.random().toString(36).slice(2, 9); 
const fmtTime = ts => { 
 const d = new Date(ts); 
 return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " - " +  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }; 
function combinedAmericanOdds(legs) { 
 const dec = legs.reduce((acc, l) => acc * toDecimal(l.odds), 1); 
 return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
} 
function leagueMeta(subtitle = "") { 
 if (subtitle.toLowerCase().includes("lunar")) return { tag: "LUNAR", color: "#3b82f6", bg: if (subtitle.toLowerCase().includes("galactic")) return { tag: "GALACTIC", color: "#8b5cf6 if (subtitle.toLowerCase().includes("toos") || subtitle.toLowerCase().includes("championsh return { tag: "FUTURE", color: "#94a3b8", bg: "transparent" }; 
} 
// ─── Storage ─────────────────────────────────────────────────────────────── 
function parseFirebase(val) { 
 if (val === null || val === undefined) return null; 
 if (typeof val === "string") { try { return JSON.parse(val); } catch { return val; } }  if (typeof val === "object" && !Array.isArray(val)) { 
 const keys = Object.keys(val); 
 const isArray = keys.length > 0 && keys.every(k => !isNaN(k)); 
 return isArray ? keys.map(k => val[k]) : val; 
 } 
 return val; 
} 
async function storageGet(key) { 
 try { const snap = await get(ref(db, key)); return snap.exists() ? parseFirebase(snap.val()} 
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
 <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}  <div> 
 <p style={{ margin: "0 0 4px", fontSize: 14.0, color: "#64748b", textAlign: "center" {sublabel && <p style={{ margin: 0, fontSize: 12.0, color: "#94a3b8", textAlign: "ce </div> 
 <div style={{ display: "flex", gap: 16 }}> 
 {[0,1,2,3].map(i => ( 
 <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i <  ))} 
 </div>
 {error && <p style={{ margin: "-10px 0 -6px", fontSize: 12.0, color: "#ef4444", textAl <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width:  {keys.map((k, i) => ( 
 <button key={i} onClick={() => press(k)} style={{ height: 54, background: k === "" {k} 
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
 const [futureOptions, setFutureOptions] = useState([{ label: "", odds: "" }, { label: "",  const [headerDraft, setHeaderDraft] = useState(""); 
 const [expandedSettled, setExpandedSettled] = useState(null); 
 const [siteMaxBet, setSiteMaxBet] = useState(null); 
 const [siteMaxBetDraft, setSiteMaxBetDraft] = useState(""); 
 // Add game form extras 
 const [addSpread, setAddSpread] = useState(""); 
 const [addSpreadOddsA, setAddSpreadOddsA] = useState("-110"); 
 const [addSpreadOddsB, setAddSpreadOddsB] = useState("-110"); 
 const [addOU, setAddOU] = useState(""); 
 const [addOverOdds, setAddOverOdds] = useState("-110"); 
 const [addUnderOdds, setAddUnderOdds] = useState("-110"); 
 // Load data + real-time listeners 
 useEffect(() => { 
 (async () => { 
 const [u, m, b, lv, hm, smb] = await Promise.all([ 
 storageGet("mln_users"), storageGet("mln_markets"), storageGet("mln_bets"),  storageGet("mln_leaderboard_visible"), storageGet("mln_header_msg"), storageGet("mln ]); 
 if (u) setUsers(u); 
 if (m) setMarkets(m); 
 setBets(Array.isArray(b) ? b : []); 
 if (lv !== null) setLeaderboardVisible(lv); 
 if (hm !== null) setHeaderMsg(hm); 
 setHeaderDraft(hm || ""); 
 if (smb !== null) { setSiteMaxBet(smb); setSiteMaxBetDraft(String(smb)); }  setLoading(false); 
 })(); 
 const u1 = onValue(ref(db, "mln_users"), snap => { if (snap.exists()) { const v = parseF const u2 = onValue(ref(db, "mln_markets"), snap => { if (snap.exists()) { const v = pars const u3 = onValue(ref(db, "mln_bets"), snap => { const v = snap.exists() ? parseFirebas const u4 = onValue(ref(db, "mln_leaderboard_visible"), snap => { if (snap.exists()) setL const u5 = onValue(ref(db, "mln_header_msg"), snap => { const v = snap.exists() ? parseF const u6 = onValue(ref(db, "mln_site_max_bet"), snap => { if (snap.exists()) { const v = return () => { u1(); u2(); u3(); u4(); u5(); u6(); }; 
 }, []);
 // 30-min inactivity timeout 
 useEffect(() => { 
 if (screen !== "lobby") return; 
 let timer; 
 const reset = () => { clearTimeout(timer); timer = setTimeout(() => { setBetSlip({}); se reset(); 
 window.addEventListener("click", reset); window.addEventListener("keypress", reset); win return () => { clearTimeout(timer); window.removeEventListener("click", reset); window.r }, [screen]); 
 // Auto-advance PIN 
 useEffect(() => { 
 if (pinInput.length < 4) return; 
 const t = setTimeout(() => handlePinComplete(pinInput), 150); 
 return () => clearTimeout(t); 
 }, [pinInput, loginStep]); 
 // Redirect off hidden leaderboard 
 useEffect(() => { if (!leaderboardVisible && activeTab === "leaderboard") setActiveTab("ga
 function notify(msg, type = "success") { setNotification({ msg, type }); setTimeout(() =>  async function saveUsers(u) { setUsers(u); await storageSet("mln_users", u); }  async function saveMarkets(m) { setMarkets(m); await storageSet("mln_markets", m); }  async function saveBets(b) { setBets(b); await storageSet("mln_bets", b); } 
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
 notify("That name contains a word that isn't allowed. Please choose a different name. return; 
 } 
 setLoginStep("pin_create"); 
 } 
 }
 async function handlePinComplete(pin) { 
 const name = inputName.trim(); 
 if (loginStep === "pin_login") { 
 const key = findUserKey(users, name) || name; 
 if (pin === users[key]?.pin) { setUsername(key); setScreen("lobby"); setInputName(""); else { setPinError("Incorrect PIN — try again"); setPinInput(""); }  return; 
 } 
 if (loginStep === "pin_create") { setPendingPin(pin); setPinInput(""); setPinError("");  if (loginStep === "pin_confirm") { 
 if (pin === pendingPin) { 
 const newUsers = { ...users, [name]: { balance: STARTING_BALANCE, pin, createdAt: Da await saveUsers(newUsers); 
 setUsername(name); setScreen("lobby"); setInputName(""); setLoginStep("name"); setPi } else { setPinError("PINs don't match — start over"); setPinInput(""); setTimeout(()  return; 
 } 
 } 
 function resetLoginToName() { setLoginStep("name"); setPinInput(""); setPinError(""); setP // ── Derived ────────────────────────────────────────────────────────────── 
 const allMarkets = [...markets.games, ...markets.futures]; 
 const slipEntries = Object.entries(betSlip); 
 const slipLegs = slipEntries.map(([optId, v]) => { 
 const market = allMarkets.find(m => m.id === v.marketId); 
 const option = market?.options.find(o => o.id === optId); 
 return { optionId: optId, marketId: v.marketId, marketTitle: market?.title, optionLabel: }); 
 const multiMarket = new Set(slipEntries.map(([, v]) => v.marketId)).size > 1;  const slipHasFuture = slipLegs.some(l => allMarkets.find(m => m.id === l.marketId)?.type = const parlayEligible = multiMarket && !slipHasFuture; 
 const parlayOdds = slipLegs.length > 1 ? combinedAmericanOdds(slipLegs) : null;  const parlayPayout = parlayStake > 0 && parlayOdds != null ? calcPayout(parseFloat(parlayS const straightTotal = slipLegs.reduce((acc, l) => acc + (parseFloat(l.stake) || 0), 0);  const straightPayout = slipLegs.reduce((acc, l) => acc + (parseFloat(l.stake) > 0 ? calcPa
 const optionTotals = {}; 
 for (const b of bets) { 
 if (b.betType === "straight") optionTotals[b.optionId] = (optionTotals[b.optionId] || 0) else if (b.betType === "parlay") for (const leg of b.legs) optionTotals[leg.optionId] =  } 
 const balance = users[username]?.balance ?? STARTING_BALANCE; 
 const userBets = bets.filter(b => b.username === username);
 // Leaderboard sorted by total (balance + pending stakes) 
 const leaderboardRaw = Object.entries(users).map(([name, u]) => { 
 const pendingAmt = bets.filter(b => b.username === name && b.status === "pending").reduc return { name, u, pendingAmt, total: (u.balance || 0) + pendingAmt };  }).sort((a, b) => { 
 if (b.total !== a.total) return b.total - a.total; // 1. highest total first  if (b.pendingAmt !== a.pendingAmt) return b.pendingAmt - a.pendingAmt; // 2. most open b return a.name.localeCompare(b.name); // 3. alphabetical  }); 
 // Assign rank numbers — tied players share the same rank 
 const leaderboard = leaderboardRaw.reduce((acc, entry, i) => { 
 const rank = i === 0 ? 1 : (entry.total === acc[i-1].total ? acc[i-1]._rank : i + 1);  acc.push({ ...entry, _rank: rank }); 
 return acc; 
 }, []); 
 // Split into active bettors vs no-bets-yet 
 const activePlayers = leaderboard.filter(p => bets.some(b => b.username === p.name));  const inactivePlayers = leaderboard.filter(p => !bets.some(b => b.username === p.name)); 
 const displayMarkets = activeTab === "games" ? markets.games : markets.futures; 
 // ── House P&L ─────────────────────────────────────────────────────────────  // For each settled market: house_take = total_staked - total_paid_out  function getMarketPnl(marketId) { 
 const relevant = bets.filter(b => { 
 if (b.betType === "straight") return b.marketId === marketId && (b.status === "won" || if (b.betType === "parlay") return b.legs.some(l => l.marketId === marketId) && (b.sta return false; 
 }); 
 const totalStaked = relevant.reduce((s, b) => s + b.stake, 0); 
 const totalPaid = relevant.filter(b => b.status === "won").reduce((s, b) => s + b.payout, const betCount = relevant.length; 
 return { totalStaked, totalPaid, net: totalStaked - totalPaid, betCount };  } 
 function getPlayerLifetimePnl(playerName) { 
 const resolved = bets.filter(b => b.username === playerName && (b.status === "won" || b. const staked = resolved.reduce((s, b) => s + b.stake, 0); 
 const returned = resolved.filter(b => b.status === "won").reduce((s, b) => s + b.payout, return returned - staked; // positive = player up, negative = player down  } 
 // Project house P&L if a specific option wins — honors original bet odds  // Straight bets only — parlays excluded because their multi-leg payouts  // can't be attributed to a single market outcome cleanly.
 // Formula: house net = total staked on market - payout owed to winners of this option  // e.g. $1359 on GHG (-200) + $1225 on Slayers: if GHG wins, payout = $1359 * 1.5 = $2038. // house net = $2584 - $2038.50 = +$545.50 
 function getOptionProjection(marketId, winningOptionId) { 
 // Straight bets on this market 
 const straightBets = bets.filter(b => 
 b.status === "pending" && 
 b.betType === "straight" && 
 b.marketId === marketId 
 ); 
 const straightStaked = straightBets.reduce((s, b) => s + b.stake, 0);  const straightPayout = straightBets 
 .filter(b => b.optionId === winningOptionId) 
 .reduce((s, b) => s + b.payout, 0); 
 // Parlay bets: count stakes from parlays that would BUST if this market's  // losing options lose (i.e. parlays betting on any option OTHER than the winner).  // We add these to totalStaked — house keeps them. 
 // We do NOT subtract parlay payouts when winner wins (too complex, skipped as agreed).  const parlayBustedStakes = bets 
 .filter(b => 
 b.status === "pending" && 
 b.betType === "parlay" 
 ) 
 .filter(b => { 
 const leg = b.legs.find(l => l.marketId === marketId); 
 // This parlay has a leg on this market, and it's on the LOSING option  return leg && leg.optionId !== winningOptionId; 
 }) 
 .reduce((s, b) => s + b.stake, 0); 
 const totalStaked = straightStaked + parlayBustedStakes; 
 return { totalStaked, totalPayout: straightPayout, net: totalStaked - straightPayout };  } 
 const houseTotalNet = allMarkets 
 .filter(m => m.status === "settled") 
 .reduce((sum, m) => sum + getMarketPnl(m.id).net, 0); 
 // ── Bet slip actions ────────────────────────────────────────────────────── 
 function togglePick(marketId, optionId) { 
 if (betSlip[optionId]) { const c = { ...betSlip }; delete c[optionId]; setBetSlip(c); re const c = {}; 
 for (const [k, v] of slipEntries) { if (v.marketId !== marketId) c[k] = v; }  c[optionId] = { marketId, stake: "" }; 
 setBetSlip(c);
 const market = allMarkets.find(m => m.id === marketId); 
 if (market?.type === "future" && slipMode === "parlay") setSlipMode("straight");  } 
 function setStake(optionId, val) { setBetSlip(p => ({ ...p, [optionId]: { ...p[optionId], 
 async function placeBets() { 
 if (slipEntries.length === 0) return; 
 for (const [, v] of slipEntries) { 
 const market = allMarkets.find(m => m.id === v.marketId); 
 if (market?.status === "paused") { notify(`${market.title} is paused`, "error"); retur if (market?.status === "settled") { notify(`${market.title} is already settled`, "erro } 
 if (slipMode === "parlay") { 
 if (slipHasFuture) { notify("Futures can't be included in parlays", "error"); setSlipM const stake = parseFloat(parlayStake); 
 if (!stake || stake <= 0) { notify("Enter a valid parlay stake", "error"); return; }  if (stake > balance) { notify("Not enough balance!", "error"); return; }  for (const leg of slipLegs) { 
 const market = allMarkets.find(m => m.id === leg.marketId); 
 if (market?.maxBet && stake > market.maxBet) { notify(`Max bet on ${market.title} is } 
 if (siteMaxBet && stake > siteMaxBet) { notify(`Site maximum bet is $${siteMaxBet}`, " const combo = combinedAmericanOdds(slipLegs); 
 const payout = calcPayout(stake, combo); 
 const newBet = { id: uid(), username, betType: "parlay", legs: slipLegs.map(l => ({ ma await saveUsers({ ...users, [username]: { ...users[username], balance: balance - stake await saveBets([...bets, newBet]); 
 setBetSlip({}); setParlayStake(""); 
 notify(`Parlay placed! ${fmt(combo)} - $${payout.toFixed(2)} to win`);  } else { 
 let total = 0; 
 for (const [, v] of slipEntries) { const amt = parseFloat(v.stake); if (!amt || amt <= if (total > balance) { notify("Not enough balance!", "error"); return; }  for (const [, v] of slipEntries) { 
 const market = allMarkets.find(m => m.id === v.marketId); const amt = parseFloat(v.s if (market?.maxBet && amt > market.maxBet) { notify(`Max bet on ${market.title} is $ if (siteMaxBet && amt > siteMaxBet) { notify(`Site maximum bet is $${siteMaxBet}`, " } 
 const newBets = [...bets]; 
 for (const [optionId, v] of slipEntries) { 
 const market = allMarkets.find(m => m.id === v.marketId); const option = market.opti newBets.push({ id: uid(), username, betType: "straight", marketId: v.marketId, marke } 
 await saveUsers({ ...users, [username]: { ...users[username], balance: balance - total await saveBets(newBets); setBetSlip({}); 
 notify(`${slipEntries.length} bet${slipEntries.length > 1 ? "s" : ""} placed!`);  }
 } 
 // ── Admin actions ───────────────────────────────────────────────────────── 
 async function settleMarket(marketId, winningOptionId) { 
 const settle = m => m.id === marketId ? { ...m, status: "settled", winner: winningOption const newMarkets = { games: markets.games.map(settle), futures: markets.futures.map(sett const newUsers = { ...users }; 
 const newBets = bets.map(b => { 
 if (b.status !== "pending") return b; 
 if (b.betType === "straight") { 
 if (b.marketId !== marketId) return b; 
 const won = b.optionId === winningOptionId; 
 if (won) newUsers[b.username] = { ...newUsers[b.username], balance: (newUsers[b.user return { ...b, status: won ? "won" : "lost" }; 
 } 
 if (b.betType === "parlay") { 
 const hasLeg = b.legs.some(l => l.marketId === marketId); 
 if (!hasLeg) return b; 
 const newLegs = b.legs.map(l => l.marketId === marketId ? { ...l, status: l.optionId const anyLost = newLegs.some(l => l.status === "lost"); 
 const allWon = newLegs.every(l => l.status === "won"); 
 let newStatus = b.status; 
 if (anyLost) newStatus = "lost"; 
 else if (allWon) { newStatus = "won"; newUsers[b.username] = { ...newUsers[b.usernam return { ...b, legs: newLegs, status: newStatus }; 
 } 
 return b; 
 }); 
 await saveUsers(newUsers); await saveMarkets(newMarkets); await saveBets(newBets);  notify("Market settled — winners paid! "); 
 } 
 async function unsettleMarket(marketId) { 
 const newUsers = { ...users }; 
 const newBets = bets.map(b => { 
 if (b.betType === "straight") { 
 if (b.marketId !== marketId) return b; 
 if (b.status === "won") newUsers[b.username] = { ...newUsers[b.username], balance: M if (b.status === "won" || b.status === "lost") return { ...b, status: "pending" };  return b; 
 } 
 if (b.betType === "parlay") { 
 const hasLeg = b.legs.some(l => l.marketId === marketId); 
 if (!hasLeg) return b; 
 if (b.status === "won") newUsers[b.username] = { ...newUsers[b.username], balance: M const newLegs = b.legs.map(l => l.marketId === marketId ? { ...l, status: "pending" }
 const anyLost = newLegs.some(l => l.status === "lost"); 
 return { ...b, legs: newLegs, status: anyLost ? "lost" : "pending" };  } 
 return b; 
 }); 
 const reopen = m => m.id === marketId ? { ...m, status: "open", winner: null } : m;  const newMarkets = { games: markets.games.map(reopen), futures: markets.futures.map(reop await saveUsers(newUsers); await saveMarkets(newMarkets); await saveBets(newBets);  notify("Market reopened — payouts reversed ↩"); 
 } 
 async function eliminateOption(marketId, losingOptionId) { 
 // Mark bets on this option as lost, refund nothing — market stays open for remaining op const newUsers = { ...users }; 
 const newBets = bets.map(b => { 
 if (b.status !== "pending") return b; 
 if (b.betType === "straight" && b.marketId === marketId && b.optionId === losingOption return { ...b, status: "lost" }; 
 } 
 if (b.betType === "parlay") { 
 const leg = b.legs.find(l => l.marketId === marketId && l.optionId === losingOptionI if (!leg) return b; 
 const newLegs = b.legs.map(l => 
 l.marketId === marketId && l.optionId === losingOptionId ? { ...l, status: "lost" } ); 
 // Parlay busts — already lost 
 return { ...b, legs: newLegs, status: "lost" }; 
 } 
 return b; 
 }); 
 // Mark the option as eliminated on the market object 
 const markElim = m => m.id === marketId 
 ? { ...m, eliminated: [...(m.eliminated || []), losingOptionId] }  : m; 
 const newMarkets = { games: markets.games.map(markElim), futures: markets.futures.map(ma await saveUsers(newUsers); await saveMarkets(newMarkets); await saveBets(newBets);  const opt = allMarkets.find(m => m.id === marketId)?.options.find(o => o.id === losingOp notify(`${opt?.label} eliminated — bets resolved as losses`); 
 } 
 async function voidMarket(marketId) { 
 const newUsers = { ...users }; 
 const newBets = bets.map(b => { 
 if (b.status !== "pending") return b; 
 if ((b.betType === "straight" && b.marketId === marketId) || (b.betType === "parlay" & newUsers[b.username] = { ...newUsers[b.username], balance: (newUsers[b.username]?.ba return { ...b, status: "voided" };
 } 
 return b; 
 }); 
 const rm = m => m.id !== marketId; 
 await saveUsers(newUsers); await saveMarkets({ games: markets.games.filter(rm), futures: notify("Market voided & bets refunded"); 
 } 
 async function togglePauseMarket(marketId) { 
 const market = allMarkets.find(m => m.id === marketId); 
 const newStatus = market.status === "paused" ? "open" : "paused"; 
 const toggle = m => m.id === marketId ? { ...m, status: newStatus } : m;  await saveMarkets({ games: markets.games.map(toggle), futures: markets.futures.map(toggl notify(newStatus === "paused" ? " Market paused" : " Market reopened");  } 
 async function pauseAllMarkets() { 
 const pauseAll = m => m.status === "open" ? { ...m, status: "paused" } : m;  const newMarkets = { games: markets.games.map(pauseAll), futures: markets.futures.map(pa await saveMarkets(newMarkets); 
 notify(" All open markets paused"); 
 } 
 async function unpauseAllMarkets() { 
 const openAll = m => m.status === "paused" ? { ...m, status: "open" } : m;  const newMarkets = { games: markets.games.map(openAll), futures: markets.futures.map(ope await saveMarkets(newMarkets); 
 notify(" All markets reopened"); 
 } 
 function startEdit(market) { setEditingMarket(market); setEditTitle(market.title); setEdit
 async function saveEdit() { 
 if (!editTitle.trim()) { notify("Title required", "error"); return; }  const updated = { ...editingMarket, title: editTitle.trim(), subtitle: editSubtitle.trim const upd = m => m.id === updated.id ? updated : m; 
 await saveMarkets({ games: markets.games.map(upd), futures: markets.futures.map(upd) });  setEditingMarket(null); notify("Market updated! "); 
 } 
 async function handleAddMarket() { 
 if (!addTitle.trim()) { notify("Title required", "error"); return; }  const newId = addType === "game" ? `g_${uid()}` : `f_${uid()}`; 
 let newMarketsToAdd = []; 
 if (addType === "game") { 
 if (!addTeamA.trim() || !addTeamB.trim() || !addOddsA || !addOddsB) { notify("Fill in  const oA = parseInt(addOddsA), oB = parseInt(addOddsB);
 if (isNaN(oA) || isNaN(oB)) { notify("Odds must be numbers like +150 or -110", "error") const moneyline = { id: newId, type: "game", title: addTitle.trim(), subtitle: addSubt options: [{ id: `${newId}_a`, label: addTeamA.trim(), odds: oA }, { id: `${newId}_b`, newMarketsToAdd.push(moneyline); 
 // Optional spread 
 if (addSpread) { 
 const sp = parseFloat(addSpread), spOA = parseInt(addSpreadOddsA), spOB = parseInt(a if (!isNaN(sp) && !isNaN(spOA) && !isNaN(spOB)) { 
 const spId = `${newId}_sp`; 
 newMarketsToAdd.push({ id: spId, type: "game", title: `${addTitle.trim()} — Spread` options: [{ id: `${spId}_a`, label: `${addTeamA.trim()} ${sp > 0 ? "+" : ""}${sp} } 
 } 
 // Optional O/U 
 if (addOU) { 
 const ou = parseFloat(addOU), ovO = parseInt(addOverOdds), unO = parseInt(addUnderOd if (!isNaN(ou) && !isNaN(ovO) && !isNaN(unO)) { 
 const ouId = `${newId}_ou`; 
 newMarketsToAdd.push({ id: ouId, type: "game", title: `${addTitle.trim()} — O/U ${ options: [{ id: `${ouId}_ov`, label: `Over ${ou}`, odds: ovO }, { id: `${ouId}_u } 
 } 
 } else { 
 const valid = futureOptions.filter(o => o.label.trim() && o.odds);  if (valid.length < 2) { notify("At least 2 options required", "error"); return; }  const opts = valid.map((o, i) => ({ id: `${newId}_${i}`, label: o.label.trim(), odds:  newMarketsToAdd.push({ id: newId, type: "future", title: addTitle.trim(), subtitle: ad } 
 await saveMarkets({ games: addType === "game" ? [...markets.games, ...newMarketsToAdd] : setAddTitle(""); setAddSubtitle(""); setAddTeamA(""); setAddOddsA(""); setAddTeamB("");  setAddSpread(""); setAddSpreadOddsA("-110"); setAddSpreadOddsB("-110");  setAddOU(""); setAddOverOdds("-110"); setAddUnderOdds("-110"); 
 setFutureOptions([{ label: "", odds: "" }, { label: "", odds: "" }]);  notify(`${newMarketsToAdd.length} market${newMarketsToAdd.length > 1 ? "s" : ""} added!  } 
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
 await saveUsers({ ...users, [name]: { ...users[name], balance: Math.max(0, (users[name]?. setAdjustingUser(null); setAdjustAmt(""); 
 notify(`Balance adjusted by ${delta >= 0 ? "+" : ""}$${delta.toFixed(2)}`);  } 
 async function saveSiteMaxBet() { 
 const val = siteMaxBetDraft.trim() ? parseFloat(siteMaxBetDraft) : null;  setSiteMaxBet(val); 
 await storageSet("mln_site_max_bet", val); 
 notify(val ? `Site max bet set to $${val}` : "Site max bet removed");  } 
 async function toggleLeaderboard() { 
 const newVal = !leaderboardVisible; 
 setLeaderboardVisible(newVal); 
 await storageSet("mln_leaderboard_visible", newVal); 
 notify(newVal ? "Leaderboard visible to players" : "Leaderboard hidden from players");  } 
 async function saveHeaderMsg() { 
 await storageSet("mln_header_msg", headerDraft.trim()); 
 notify(headerDraft.trim() ? "Banner saved!" : "Banner cleared"); 
 } 
 async function resetAll() { 
 await saveMarkets({ ...INITIAL_MARKETS }); await saveBets([]); 
 const r = {}; 
 for (const u of Object.keys(users)) r[u] = { ...users[u], balance: STARTING_BALANCE };  await saveUsers(r); notify("Everything reset!"); 
 } 
 // ── Loading ───────────────────────────────────────────────────────────────  if (loading) return <div style={S.center}><div style={S.loadDot} /></div>;  // ── Login ───────────────────────────────────────────────────────────────── 
 if (screen === "login") { 
 const name = inputName.trim(); 
 return ( 
 <div style={S.loginWrap}> 
 <div style={S.loginBg} /> 
 <div style={S.loginCard}> 
 <div style={S.loginLogoRow}> 
 <span style={S.loginLogoIcon}> </span> 
 <div> 
 <div style={S.loginLogoTitle}>MLN BETTING</div>
 <div style={S.loginLogoSub}>Fake Money - Real Bragging Rights</div>  </div> 
 </div> 
 <div style={S.loginDivider} /> 
 {loginStep === "name" && ( 
 <> 
 <label style={S.loginLabel}>PLAYER NAME</label> 
 <input style={S.input} placeholder="Enter your name…" value={inputName}  onChange={e => setInputName(e.target.value)} 
 onKeyDown={e => e.key === "Enter" && inputName.trim() && handleNameSubmit()} <button style={{ ...S.btnPrimary, opacity: inputName.trim() ? 1 : 0.4 }} onCli <button style={S.btnGhost} onClick={() => setScreen("admin")}>Admin Panel</but </> 
 )} 
 {loginStep === "pin_login" && ( 
 <> 
 <div style={{ textAlign: "center", marginBottom: 4 }}> 
 <span style={{ fontSize: 13.0, color: "#64748b" }}>Welcome back, </span>  <span style={{ fontSize: 13.0, color: "#6366f1", fontWeight: 700 }}>{name}</ </div> 
 <PinPad value={pinInput} onChange={p => { setPinInput(p); if (pinError) setPin <button style={S.btnGhost} onClick={resetLoginToName}>← Back</button>  </> 
 )} 
 {loginStep === "pin_create" && ( 
 <> 
 <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: <p style={{ margin: "0 0 4px", fontSize: 14.0, color: "#16a34a", fontWeight: <p style={{ margin: "0 0 8px", fontSize: 13.0, color: "#64748b" }}>No accoun <p style={{ margin: 0, fontSize: 12.0, color: "#16a34a" }}>If this is your f </div> 
 <PinPad value={pinInput} onChange={setPinInput} label="Choose a 4-digit PIN" s <button style={S.btnGhost} onClick={resetLoginToName}>← Back</button>  </> 
 )} 
 {loginStep === "pin_confirm" && ( 
 <> 
 <PinPad value={pinInput} onChange={p => { setPinInput(p); if (pinError) setPin <button style={S.btnGhost} onClick={() => { setLoginStep("pin_create"); setPin </> 
 )} 
 </div> 
 </div>
 ); 
 } 
 // ── Admin ────────────────────────────────────────────────────────────────── 
 if (screen === "admin") return ( 
 <div style={S.adminWrap}> 
 <div style={S.adminHeader}> 
 <button style={S.backBtn} onClick={() => { setAdminUnlocked(false); setAdminPin(""); <div style={S.adminTitleRow}> 
 <span style={S.adminTitle}>ADMIN</span> 
 <span style={S.adminTitleSub}>MLN Betting</span> 
 </div> 
 </div> 
 {!adminUnlocked ? ( 
 <div style={S.pinWrap}> 
 <p style={S.pinLabel}>Enter admin PIN to unlock</p> 
 <input style={S.input} type="password" placeholder="PIN" value={adminPin}  onChange={e => setAdminPin(e.target.value)} 
 onKeyDown={e => e.key === "Enter" && (adminPin === ADMIN_PIN ? setAdminUnlocked( <button style={S.btnPrimary} onClick={() => adminPin === ADMIN_PIN ? setAdminUnloc </div> 
 ) : ( 
 <> 
 <div style={S.adminTabRow}> 
 {[["settle"," Settle"],["players"," Players"],["add"," Add"],["edit"," E <button key={key} style={{ ...S.adminTab, ...(adminTab === key ? S.adminTabAct ))} 
 </div> 
 <div style={S.adminContent}> 
 {/* ── SETTLE TAB ── */} 
 {adminTab === "settle" && ( 
 <> 
 {/* House P&L summary */} 
 <div style={{ ...S.adminSection, background: houseTotalNet >= 0 ? "#f0fdf4" : <div style={{ display: "flex", justifyContent: "space-between", alignItems: <p style={{ ...S.sectionHead, margin: 0 }}>HOUSE TAKE (ALL TIME)</p>  <span style={{ fontSize: 23.0, fontWeight: 700, color: houseTotalNet >=  {houseTotalNet >= 0 ? "+" : ""}${houseTotalNet.toFixed(2)}  </span> 
 </div> 
 <p style={{ margin: "6px 0 0", fontSize: 11.0, color: "#94a3b8" }}>  Across {allMarkets.filter(m => m.status === "settled").length} settled m </p> 
 </div>
 {/* Pause all */} 
 <div style={{ display: "flex", gap: 8 }}> 
 <button style={{ ...S.settleBtn, flex: 1, textAlign: "center", background: <button style={{ ...S.settleBtn, flex: 1, textAlign: "center" }} onClick={ </div> 
 {/* Settle markets */} 
 <div style={S.adminSection}> 
 <p style={S.sectionHead}>SETTLE MARKETS</p> 
 {allMarkets.map(market => { 
 const pnl = market.status === "settled" ? getMarketPnl(market.id) : null;  const mTotal = market.options.reduce((s, o) => s + (optionTotals[o.id] || return ( 
 <div key={market.id} style={S.settleCard}> 
 <div style={S.settleTitle}> 
 <span>{market.title}</span> 
 <div style={{ display: "flex", gap: 6, alignItems: "center" }}>  {market.status === "settled" && <span style={S.settledBadge}>SET {market.status === "paused" && <span style={S.pausedBadge}> PA </div> 
 </div> 
 {/* Money distribution in admin */} 
 {mTotal > 0 && market.status !== "settled" && (  <div style={{ marginBottom: 10 }}> 
 {market.options.map(opt => { 
 const amt = optionTotals[opt.id] || 0; 
 const pct = mTotal > 0 ? amt / mTotal : 0;  const proj = getOptionProjection(market.id, opt.id);  const projNet = proj.net; 
 return ( 
 <div key={opt.id} style={{ marginBottom: 8, background: "#f8 <div style={{ display: "flex", justifyContent: "space-betw <span style={{ fontWeight: 700, color: "#374151" }}>{opt. <span style={{ color: "#6366f1" }}>{fmt(opt.odds)}</span  </div> 
 <div style={{ display: "flex", justifyContent: "space-betw <span>Action: ${amt.toFixed(0)} ({Math.round(pct * 100)} <span style={{ fontWeight: 700, color: projNet >= 0 ? "# If wins: {projNet >= 0 ? "+" : ""}${projNet.toFixed(2)}
 </span> 
 </div> 
 <div style={S.moneyBar}><div style={{ ...S.moneyBarFill, w </div> 
 ); 
 })}
 <div style={{ fontSize: 11.0, color: "#94a3b8", marginTop: 2 }}> </div> 
 )} 
 {/* Pause/open toggle for open/paused markets */}  {(market.status === "open" || market.status === "paused") && (  <div style={{ display: "flex", justifyContent: "flex-end", marginB <button style={{ ...S.settleBtn, background: market.status === " {market.status === "paused" ? "▶ Open Betting" : " Pause Bet </button> 
 </div> 
 )} 
 {market.status === "open" || market.status === "paused" ? (  <div style={S.settleOptions}> 
 {market.options.map(opt => { 
 const isElim = (market.eliminated || []).includes(opt.id);  if (isElim) { 
 return ( 
 <div key={opt.id} style={{ display: "flex", alignItems: "c <span style={{ fontSize: 13.0, color: "#ef4444", fontWei <span style={{ fontSize: 11.0, color: "#ef4444", marginL </div> 
 ); 
 } 
 return ( 
 <div key={opt.id} style={{ display: "flex", gap: 6 }}>  <button style={{ ...S.settleBtn, flex: 1 }} onClick={() => {market.type === "future" && ( 
 <button 
 style={{ ...S.settleBtn, background: "#fff1f2", border onClick={() => { if (window.confirm(`Eliminate ${opt.l ✗ Out 
 </button> 
 )} 
 </div> 
 ); 
 })} 
 </div> 
 ) : ( 
 <> 
 <div style={{ display: "flex", justifyContent: "space-between",  <p style={S.winnerText}> {market.options.find(o => o.id ===  <button style={{ ...S.settleBtn, background: "#faf5ff", border onClick={() => { if (window.confirm(`Unsettle "${market.titl ↩ Unsettle 
 </button>
 </div> 
 {/* P&L for settled market */} 
 <div 
 style={{ cursor: "pointer", background: expandedSettled === ma onClick={() => setExpandedSettled(expandedSettled === market.i <div style={{ display: "flex", justifyContent: "space-between", <span style={{ fontSize: 11.0, color: "#94a3b8" }}>{expanded {pnl && <span style={{ fontSize: 13.0, fontWeight: 700, colo </div> 
 {expandedSettled === market.id && pnl && (  <div style={{ marginTop: 8, fontSize: 12.0, color: "#64748b", <div style={{ display: "flex", justifyContent: "space-betw <div style={{ display: "flex", justifyContent: "space-betw <div style={{ display: "flex", justifyContent: "space-betw <div style={{ display: "flex", justifyContent: "space-betw <span>Net house {pnl.net >= 0 ? "take" : "loss"}</span>  <span>{pnl.net >= 0 ? "+" : ""}${pnl.net.toFixed(2)}</sp </div> 
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
 <div style={{ display: "flex", justifyContent: "space-between", alignItems:  <p style={{ ...S.sectionHead, margin: 0 }}>PLAYERS ({leaderboard.length})< <button onClick={toggleLeaderboard} style={{ ...S.adjustBtn, fontSize: 11. {leaderboardVisible ? " Standings ON" : " Standings OFF"} 
 </button> 
 </div> 
 {leaderboard.length === 0 && <p style={S.emptyText}>No players yet</p>}  {leaderboard.map(({ name, u, pendingAmt, total, _rank }) => {  const pnl = getPlayerLifetimePnl(name); 
 const isTied = leaderboard.filter(p => p._rank === _rank).length > 1;  const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString("en- return ( 
 <div key={name}> 
 <div style={{ ...S.leaderRow, alignItems: "flex-start", paddingTop: 10,
 {/* Rank */} 
 <span style={{ fontSize: 16.0, fontWeight: 700, color: "#ffffff", wi {isTied ? `T${_rank}` : `#${_rank}`} 
 </span> 
 {/* Name + joined */} 
 <div style={{ flex: 1, minWidth: 0 }}> 
 <div style={{ fontSize: 15.0, fontWeight: 600, color: "#1e293b", m <div style={{ fontSize: 11.0, color: "#94a3b8" }}>Joined {joined}< </div> 
 {/* Balances */} 
 <div style={{ display: "flex", flexDirection: "column", alignItems:  <span style={{ fontSize: 15.0, fontWeight: 700, color: "#ffffff" }} <div style={{ display: "flex", gap: 6 }}> 
 <span style={{ fontSize: 11.0, color: "#16a34a" }}>${u.balance.t {pendingAmt > 0 && <span style={{ fontSize: 11.0, color: "#d9770 </div> 
 <span style={{ fontSize: 12.0, fontWeight: 700, color: pnl >= 0 ?  {pnl >= 0 ? "▲" : "▼"} ${Math.abs(pnl).toFixed(2)} lifetime  </span> 
 </div> 
 {/* Actions */} 
 <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>  <button style={{ ...S.adjustBtn, fontSize: 11.0, padding: "3px 8px <button style={S.adjustBtn} onClick={() => { setAdjustingUser(adju <button style={{ ...S.adjustBtn, fontSize: 11.0, padding: "3px 8px </div> 
 </div> 
 {adjustingUser === name && ( 
 <div style={S.adjustRow}> 
 <input style={{ ...S.input, flex: 1 }} type="number" placeholder=" <button style={S.btnCreate} onClick={() => applyBalanceAdjust(name) <button style={S.btnRetry} onClick={() => setAdjustingUser(null)}> </div> 
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
 <div style={S.formRow}><label style={S.formLabel}>TYPE</label><div style={S. <div style={S.formRow}><label style={S.formLabel}>TITLE</label><input style={ <div style={S.formRow}><label style={S.formLabel}>SUBTITLE <span style={{ co
 <div style={S.formRow}><label style={S.formLabel}>MAX BET <span style={{ col {addType === "game" ? ( 
 <><div style={S.formRow}><label style={S.formLabel}>MONEYLINE</label>  {[["TEAM A", addTeamA, setAddTeamA, addOddsA, setAddOddsA],["TEAM B", ad <div key={lbl} style={{ ...S.oddsRow, marginBottom: 8 }}><input style={ ))}</div> 
 <div style={S.formRow}> 
 <label style={S.formLabel}>SPREAD <span style={{ color: "#94a3b8", fontW <div style={S.oddsRow}> 
 <input style={{ ...S.input, flex: 1 }} placeholder="e.g. -3.5 (favors  <input style={{ ...S.input, flex: 1 }} placeholder="Team A odds" value <input style={{ ...S.input, flex: 1 }} placeholder="Team B odds" value </div> 
 </div> 
 <div style={S.formRow}> 
 <label style={S.formLabel}>OVER / UNDER <span style={{ color: "#94a3b8", <div style={S.oddsRow}> 
 <input style={{ ...S.input, flex: 1 }} placeholder="Total line e.g. 7. <input style={{ ...S.input, flex: 1 }} placeholder="Over odds" value={ <input style={{ ...S.input, flex: 1 }} placeholder="Under odds" value={ </div> 
 </div></> 
 ) : ( 
 <><label style={S.formLabel}>OPTIONS</label>{futureOptions.map((opt, i) => )} 
 <button style={{ ...S.btnPrimary, marginTop: 18, width: "100%" }} onClick={h </div> 
 )} 
 {/* ── EDIT TAB ── */} 
 {adminTab === "edit" && !editingMarket && ( 
 <> 
 {/* Site-wide max bet */} 
 <div style={S.adminSection}> 
 <p style={S.sectionHead}>SITE-WIDE MAX BET</p> 
 <p style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>  Applies to every bet placed by any player — overrides per-market limits  {siteMaxBet ? <strong style={{ color: "#6366f1" }}> Currently: ${siteMax </p> 
 <div style={{ display: "flex", gap: 10 }}> 
 <input style={{ ...S.input, flex: 1 }} type="number" placeholder="e.g. 2 <button style={{ ...S.btnPrimary, flexShrink: 0 }} onClick={saveSiteMaxB {siteMaxBetDraft.trim() ? "Set Limit →" : "Remove Limit"}  </button> 
 </div> 
 </div>
 {/* Header message editor */} 
 <div style={S.adminSection}> 
 <p style={S.sectionHead}>LOBBY BANNER MESSAGE</p> 
 <p style={{ fontSize: 12.0, color: "#94a3b8", marginBottom: 10 }}>Shown to <textarea style={{ ...S.input, minHeight: 70, resize: "vertical", lineHeig <button style={{ ...S.btnPrimary, marginTop: 10, width: "100%" }} onClick={ {headerDraft.trim() ? "Save Banner →" : "Clear Banner"}  </button> 
 </div> 
 <div style={S.adminSection}> 
 <p style={S.sectionHead}>EDIT / PAUSE / REMOVE MARKETS</p>  {allMarkets.length === 0 && <p style={S.emptyText}>No markets</p>}  {allMarkets.map(market => ( 
 <div key={market.id} style={S.settleCard}> 
 <div style={{ display: "flex", justifyContent: "space-between", alignI <div><div style={{ fontSize: 14.0, fontWeight: 700, marginBottom: 2 } <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyCont {(market.status === "open" || market.status === "paused") && <butt {(market.status === "open" || market.status === "paused") && (  <button style={{ ...S.settleBtn, background: market.status === " {market.status === "paused" ? " Open" : " Pause"}  </button> 
 )} 
 {market.status !== "settled" && <button style={{ ...S.settleBtn, b {market.status === "settled" && <span style={S.settledBadge}>SETTL </div> 
 </div> 
 </div> 
 ))} 
 </div> 
 </> 
 )} 
 {adminTab === "edit" && editingMarket && ( 
 <div style={S.adminSection}> 
 <div style={{ display: "flex", justifyContent: "space-between", alignItems:  <div> 
 <p style={{ ...S.sectionHead, margin: 0 }}>EDITING MARKET</p>  {editingMarket.status === "paused" && <p style={{ margin: "4px 0 0", fon </div> 
 <button style={S.btnRetry} onClick={() => setEditingMarket(null)}>Cancel</ </div> 
 <div style={S.formRow}><label style={S.formLabel}>TITLE</label><input style={ <div style={S.formRow}><label style={S.formLabel}>SUBTITLE</label><input sty <div style={S.formRow}><label style={S.formLabel}>MAX BET <span style={{ col <label style={S.formLabel}>OPTIONS</label> 
 {editOptions.map((opt, i) => (<div key={opt.id} style={{ ...S.oddsRow, margi
 <button style={{ ...S.btnPrimary, marginTop: 14, width: "100%" }} onClick={s </div> 
 )} 
 {/* ── BETS TAB ── */} 
 {adminTab === "bets" && ( 
 <div style={S.adminSection}> 
 <p style={S.sectionHead}>ALL BETS ({bets.length})</p> 
 {bets.length === 0 && <p style={S.emptyText}>No bets placed yet</p>}  {[...bets].reverse().map(b => ( 
 <div key={b.id} style={S.betRow}> 
 <div style={S.betRowTop}><span style={S.betRowUser}>{b.username}</span>< {b.betType === "parlay" ? (<><div style={{ fontSize: 11.0, color: "#3b82 <div style={S.betRowAmounts}><span>Stake <strong>${b.stake.toFixed(2)}</ </div> 
 ))} 
 </div> 
 )} 
 {/* ── DANGER TAB ── */} 
 {adminTab === "danger" && ( 
 <div style={S.adminSection}> 
 <p style={S.sectionHead}>DANGER ZONE</p> 
 <p style={{ color: "#64748b", fontSize: 14.0, marginBottom: 16, lineHeight:  <button style={S.btnDanger} onClick={resetAll}>Reset Everything</button>  </div> 
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
 <div style={S.headerLeft}><span style={S.headerIcon}> </span><span style={S.headerL <div style={S.headerRight}> 
 <div style={S.balancePill}><span style={S.balanceDollar}>$</span><span style={S.ba <button style={S.avatarBtn} title={username} onClick={() => { setBetSlip({}); setS </div> 
 </div> 
 {/* Header banner */}
 {headerMsg && ( 
 <div style={S.headerBanner}>{headerMsg}</div> 
 )} 
 <div style={S.tabs}> 
 {[["games"," Games"],["futures"," Futures"],["leaderboard"," Standings"],["myb .filter(([key]) => key !== "leaderboard" || leaderboardVisible)  .map(([key, label]) => ( 
 <button key={key} style={{ ...S.tab, ...(activeTab === key ? S.tabActive : {}) }} ))} 
 </div> 
 <div style={S.content}> 
 {(activeTab === "games" || activeTab === "futures") && ( 
 <> 
 {displayMarkets.length === 0 && <div style={S.empty}><p style={S.emptyText}>No m {activeTab === "futures" && displayMarkets.map(market => {  const meta = leagueMeta(market.subtitle); 
 const marketBetTotal = market.options.reduce((sum, o) => sum + (optionTotals[o. return ( 
 <div key={market.id} style={S.marketCard}> 
 <div style={S.marketTop}> 
 <span style={{ ...S.leagueTag, color: meta.color, background: meta.bg }} <div style={{ display: "flex", alignItems: "center", gap: 8 }}>  {market.maxBet && <span style={S.maxBetTag}>Max ${market.maxBet}</span {marketBetTotal > 0 && <span style={S.actionTag}>${marketBetTotal.toFi {market.status === "paused" && <span style={S.pausedTag}> PAUSED</sp {market.status === "settled" && <span style={S.settledTag}>SETTLED</sp </div> 
 </div> 
 <h3 style={S.marketTitle}>{market.title}</h3> 
 <p style={S.marketSub}>{market.subtitle}</p> 
 {market.status === "paused" && <div style={S.pausedNotice}>Betting is paus {market.status === "settled" && <div style={S.winnerAnnounce}> {market.o <div style={S.optionGrid}> 
 {market.options.map(opt => { 
 const selected = !!betSlip[opt.id]; 
 const isElim = (market.eliminated || []).includes(opt.id);  const disabled = market.status === "settled" || market.status === "pau const optTotal = optionTotals[opt.id] || 0; 
 const pct = marketBetTotal > 0 ? optTotal / marketBetTotal : 0;  return ( 
 <div key={opt.id}> 
 <button disabled={disabled} style={{ ...S.optionBtn, ...(selected  <span style={S.optionLabel}>{opt.label}{isElim && <span style={{ <div style={{ display: "flex", flexDirection: "column", alignIte <span style={{ ...S.optionOdds, ...(selected ? S.optionOddsSel
 {marketBetTotal > 0 && <span style={S.optionMoney}>${optTotal. </div> 
 </button> 
 {marketBetTotal > 0 && <div style={S.moneyBar}><div style={{ ...S. </div> 
 ); 
 })} 
 </div> 
 {slipMode === "straight" && market.options.map(opt => {  if (!betSlip[opt.id]) return null; 
 const slip = betSlip[opt.id]; const stake = parseFloat(slip.stake) || 0; return ( 
 <div key={opt.id} style={S.stakeRow}> 
 <span style={S.stakeTeam}>{opt.label}</span> 
 <div style={S.stakeInputWrap}><span style={S.stakeDollar}>$</span><i {win > 0 && <span style={S.toWin}>to win ${win.toFixed(2)}</span>}  </div> 
 ); 
 })} 
 </div> 
 ); 
 })} 
 {activeTab === "games" && (()=>{ 
 // Group game markets: moneyline is base, spread/OU are companions  const grouped = []; 
 const used = new Set(); 
 for (const m of displayMarkets) { 
 if (used.has(m.id)) continue; 
 const baseTitle = m.title.replace(/ — Spread$/, '').replace(/ — O\/U [\d.]+$ const isBase = m.title === baseTitle; 
 if (!isBase) continue; // skip companions — they get picked up by their base  const spread = displayMarkets.find(x => x.title === `${baseTitle} — Spread`);  const ou = displayMarkets.find(x => x.title.startsWith(`${baseTitle} — O/U`))
 [m.id, spread?.id, ou?.id].filter(Boolean).forEach(id => used.add(id));  grouped.push({ moneyline: m, spread: spread || null, ou: ou || null });  } 
 // Any markets that weren't grouped (don't follow naming convention) go as sta for (const m of displayMarkets) { 
 if (!used.has(m.id)) { grouped.push({ moneyline: m, spread: null, ou: null }) } 
 return grouped.map(({ moneyline: ml, spread: sp, ou }) => {  const meta = leagueMeta(ml.subtitle); 
 const hasColumns = sp || ou; 
 const allMarketsList = [ml, sp, ou].filter(Boolean); 
 const anyPaused = allMarketsList.some(m => m.status === "paused");  const allSettled = allMarketsList.every(m => m.status === "settled");
 const totalAction = allMarketsList.reduce((s,m) => s + m.options.reduce((ss, // Teams: options[0] = team A, options[1] = team B for all market types  const teamA = ml.options[0], teamB = ml.options[1]; 
 if (!hasColumns) { 
 // No spread/OU — render standard card 
 const marketBetTotal = ml.options.reduce((sum,o)=>sum+(optionTotals[o.id]|| return ( 
 <div key={ml.id} style={S.marketCard}> 
 <div style={S.marketTop}> 
 <span style={{ ...S.leagueTag, color: meta.color, background: meta.b <div style={{ display:"flex",alignItems:"center",gap:8 }}>  {ml.maxBet && <span style={S.maxBetTag}>Max ${ml.maxBet}</span>}  {marketBetTotal > 0 && <span style={S.actionTag}>${marketBetTotal. {ml.status === "paused" && <span style={S.pausedTag}> PAUSED</sp {ml.status === "settled" && <span style={S.settledTag}>SETTLED</sp </div> 
 </div> 
 <h3 style={S.marketTitle}>{ml.title}</h3> 
 <p style={S.marketSub}>{ml.subtitle}</p> 
 {ml.status === "paused" && <div style={S.pausedNotice}>Betting is paus {ml.status === "settled" && <div style={S.winnerAnnounce}> {ml.optio <div style={S.optionGrid}> 
 {ml.options.map(opt=>{ 
 const selected=!!betSlip[opt.id],isElim=(ml.eliminated||[]).includ const disabled=ml.status==="settled"||ml.status==="paused"||isElim;  const optTotal=optionTotals[opt.id]||0,pct=marketBetTotal>0?optTot return(<div key={opt.id}> 
 <button disabled={disabled} style={{...S.optionBtn,...(selected? <span style={S.optionLabel}>{opt.label}{isElim&&<span style={{ <div style={{display:"flex",flexDirection:"column",alignItems: <span style={{...S.optionOdds,...(selected?S.optionOddsSelec {marketBetTotal>0&&<span style={S.optionMoney}>${optTotal.to </div> 
 </button> 
 {marketBetTotal>0&&<div style={S.moneyBar}><div style={{...S.mon </div>); 
 })} 
 </div> 
 {slipMode==="straight"&&ml.options.map(opt=>{ 
 if(!betSlip[opt.id])return null; 
 const slip=betSlip[opt.id],stake=parseFloat(slip.stake)||0,win=stake return(<div key={opt.id} style={S.stakeRow}> 
 <span style={S.stakeTeam}>{opt.label}</span>  <div style={S.stakeInputWrap}><span style={S.stakeDollar}>$</span> {win>0&&<span style={S.toWin}>to win ${win.toFixed(2)}</span>}  </div>);
 })} 
 </div> 
 ); 
 } 
 // ── Sportsbook-style grouped card ──────────────────────────  const columns = [ 
 sp ? { market: sp, label: "SPREAD", optA: sp.options[0], optB: sp.options[ ou ? { market: ou, label: "O/U", optA: ou.options[0], optB: ou.options[1] } { market: ml, label: "MONEYLINE", optA: ml.options[0], optB: ml.options[1] ].filter(Boolean); 
 // All selected options across all markets in this group for stake inputs  const groupSelectedOpts = columns.flatMap(col => 
 [col.optA, col.optB].filter(opt => betSlip[opt?.id])  .map(opt => ({ opt, market: col.market, colLabel: col.label }))  ); 
 return ( 
 <div key={ml.id} style={S.marketCard}> 
 {/* Card header */} 
 <div style={S.marketTop}> 
 <span style={{ ...S.leagueTag, color: meta.color, background: meta.bg } <div style={{ display:"flex",alignItems:"center",gap:8 }}>  {totalAction > 0 && <span style={S.actionTag}>${totalAction.toFixed( {anyPaused && <span style={S.pausedTag}> PAUSED</span>}  {allSettled && <span style={S.settledTag}>SETTLED</span>}  </div> 
 </div> 
 <h3 style={S.marketTitle}>{ml.title}</h3> 
 <p style={S.marketSub}>{ml.subtitle}</p> 
 {anyPaused && <div style={S.pausedNotice}>Betting is paused — your exist
 {/* Column headers */} 
 <div style={{ display:"grid", gridTemplateColumns:`repeat(${columns.leng {columns.map(col => ( 
 <div key={col.label} style={{ textAlign:"center", fontSize:10, fontW {col.label} 
 {col.market.status==="paused" && <span style={{color:"#d97706",mar {col.market.status==="settled" && <span style={{color:"#16a34a",ma </div> 
 ))} 
 </div> 
 {/* Team rows */} 
 {[0, 1].map(rowIdx => { 
 const teamLabel = rowIdx === 0 ? teamA?.label : teamB?.label;
 return ( 
 <div key={rowIdx} style={{ display:"grid", gridTemplateColumns:`repe {columns.map(col => { 
 const opt = rowIdx === 0 ? col.optA : col.optB;  if (!opt) return <div key={col.label} />; 
 const selected = !!betSlip[opt.id]; 
 const disabled = col.market.status==="settled" || col.market.sta const optTotal = optionTotals[opt.id] || 0;  const colTotal = (optionTotals[col.optA?.id]||0) + (optionTotals[ const pct = colTotal > 0 ? optTotal/colTotal : 0;  const isML = col.label === "MONEYLINE"; 
 const isSettledWinner = col.market.status==="settled" && col.mar return ( 
 <div key={col.label}> 
 <button disabled={disabled} onClick={() => !disabled && togg style={{ width:"100%", background:selected?"#f0fdf4":isSet border:`1.5px solid ${selected?"#16a34a":isSettledWinner borderRadius:10, padding:"10px 8px", cursor:disabled?"no opacity:disabled&&!isSettledWinner?0.45:1, textAlign:"ce {/* Spread/OU: show line on top, odds below. ML: show just {isML ? ( 
 <div style={{ fontSize:18, fontWeight:700, color:selecte ) : ( 
 <> 
 <div style={{ fontSize:13, fontWeight:700, color:"#1e2 <div style={{ fontSize:14, fontWeight:700, color:selec </> 
 )} 
 {colTotal > 0 && <div style={{ fontSize:9, color:"#94a3b8", </button> 
 {colTotal > 0 && <div style={S.moneyBar}><div style={{...S.m </div> 
 ); 
 })} 
 </div> 
 ); 
 })} 
 {/* Team name labels on left side (below buttons) */}  <div style={{ display:"grid", gridTemplateColumns:`repeat(${columns.leng {columns.map((col, ci) => ( 
 <div key={col.label} style={{ fontSize:10, color:"#94a3b8", textAlig {ci===0 ? <><span style={{color:"#1e293b",fontWeight:600}}>{teamA?. </div> 
 ))} 
 </div>
 {/* Stake inputs for selected options */} 
 {slipMode==="straight" && groupSelectedOpts.map(({opt, market, colLabel}) const slip=betSlip[opt.id],stake=parseFloat(slip?.stake)||0,win=stake> return(<div key={opt.id} style={S.stakeRow}> 
 <span style={S.stakeTeam}>{colLabel}: {opt.label} {fmt(opt.odds)}</s <div style={S.stakeInputWrap}><span style={S.stakeDollar}>$</span><i {win>0&&<span style={S.toWin}>to win ${win.toFixed(2)}</span>}  </div>); 
 })} 
 </div> 
 ); 
 }); 
 })()} 
 {slipEntries.length > 0 && ( 
 <div style={S.slipFooter}> 
 {parlayEligible && ( 
 <div style={S.slipModeRow}> 
 <button style={{ ...S.slipModeBtn, ...(slipMode === "straight" ? S.slipM <button style={{ ...S.slipModeBtn, ...(slipMode === "parlay" ? S.slipMod </div> 
 )} 
 {slipMode === "parlay" && parlayEligible && ( 
 <div style={{ marginBottom: 10 }}> 
 <div style={{ fontSize: 11.0, color: "#94a3b8", letterSpacing: 1, margin {slipLegs.map((l, i) => <div key={i} style={{ fontSize: 12.0, color: "#6 <div style={{ ...S.stakeRow, marginTop: 10 }}> 
 <span style={S.stakeTeam}>PARLAY STAKE</span> 
 <div style={S.stakeInputWrap}><span style={S.stakeDollar}>$</span><inp {parlayPayout > 0 && <span style={S.toWin}>to win ${parlayPayout.toFix </div> 
 </div> 
 )} 
 {slipMode === "straight" && ( 
 <div style={S.slipSummary}> 
 <div style={S.slipSummaryRow}><span style={S.slipSummaryLabel}>Total sta <div style={S.slipSummaryRow}><span style={S.slipSummaryLabel}>Total pot </div> 
 )} 
 <button style={S.placeBetBtn} onClick={placeBets}>{slipMode === "parlay" ? " </div> 
 )} 
 </> 
 )} 
 {activeTab === "leaderboard" && ( 
 <>
 <div style={S.marketCard}> 
 <h3 style={S.marketTitle}>Standings</h3> 
 <p style={S.marketSub}>Starting balance ${STARTING_BALANCE.toLocaleString()}</ {activePlayers.length === 0 && <p style={S.emptyText}>No bets placed yet.</p>}  {activePlayers.map(({ name, u, pendingAmt, total, _rank }, i) => {  const diff = total - STARTING_BALANCE; 
 const isLast = i === activePlayers.length - 1; 
 const prevTied = i > 0 && activePlayers[i-1]._rank === _rank;  const nextTied = !isLast && activePlayers[i+1]._rank === _rank;  const isTied = prevTied || nextTied; 
 return ( 
 <div key={name} style={{ ...S.boardRow, borderBottom: !isLast ? "1px solid <div style={S.boardLeft}> 
 <span style={{ ...S.boardRank, fontSize: 16.0, color: "#1e293b", width: {isTied ? `T${_rank}` : `#${_rank}`} 
 </span> 
 <span style={{ ...S.boardName, color: name === username ? "#6366f1" :  </div> 
 <div style={S.boardRight}> 
 <span style={S.boardBal}>${total.toFixed(2)}</span>  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>  <span style={{ fontSize: 11.0, color: "#16a34a" }}>${u.balance.toFix {pendingAmt > 0 && <span style={{ fontSize: 11.0, color: "#d97706" }} </div> 
 <span style={{ fontSize: 12.0, color: diff >= 0 ? "#16a34a" : "#ef4444 </div> 
 </div> 
 ); 
 })} 
 </div> 
 {inactivePlayers.length > 0 && ( 
 <div style={{ ...S.marketCard, opacity: 0.6 }}> 
 <p style={{ fontSize: 10.0, letterSpacing: 2, color: "#64748b", fontWeight:  {inactivePlayers.map(({ name, u }, i) => ( 
 <div key={name} style={{ ...S.boardRow, borderBottom: i < inactivePlayers. <div style={S.boardLeft}> 
 <span style={{ ...S.boardRank, fontSize: 16.0, color: "#64748b", width: <span style={{ ...S.boardName, color: name === username ? "#6366f1" :  </div> 
 <div style={S.boardRight}> 
 <span style={{ ...S.boardBal, color: "#64748b" }}>${u.balance.toFixed( </div> 
 </div> 
 ))} 
 </div> 
 )}
 </> 
 )} 
 {activeTab === "mybets" && ( 
 <> 
 {userBets.length === 0 && <div style={S.empty}><p style={S.emptyText}>No bets ye {[...userBets].reverse().map(b => ( 
 <div key={b.id} style={{ ...S.betCard, ...(b.status === "won" ? S.betCardWon : <div style={S.betCardTop}> 
 <span style={S.betMarket}>{b.betType === "parlay" ? <span style={{ color:  <span style={{ fontSize: 12.0, fontWeight: 700, color: b.status === "won"  </div> 
 {b.betType === "parlay" ? b.legs.map((l, i) => <div key={i} style={{ fontSiz <div style={S.betAmounts}><span>Stake <strong>${b.stake.toFixed(2)}</strong> <div style={{ fontSize: 11.0, color: "#64748b", marginTop: 6 }}>{fmtTime(b.p </div> 
 ))} 
 </> 
 )} 
 </div> 
 {notification && <Toast n={notification} />} 
 </div> 
 ); 
} 
function Toast({ n }) { 
 return <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-5} 
// ─── Styles ──────────────────────────────────────────────────────────────── 
const FONT = "'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"; const S = { 
 wrap: { minHeight: "100vh", background: "#f8fafc", color: "#1e293b", fontFamily: FONT, pad center: { minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", loadDot: { width: 10, height: 10, borderRadius: "50%", background: "#6366f1" }, 
 // Login 
 loginWrap: { minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "cent loginBg: { position: "fixed", inset: 0, background: "radial-gradient(ellipse 70% 50% at 50 loginCard: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 20, padding: loginLogoRow: { display: "flex", alignItems: "center", gap: 14, marginBottom: 4 },  loginLogoIcon: { fontSize: 37 }, 
 loginLogoTitle: { fontSize: 23, fontWeight: 700, letterSpacing: 1, color: "#1e293b", lineH loginLogoSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 }, 
 loginDivider: { height: 1, background: "#f1f5f9" }, 
 loginLabel: { fontSize: 11, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase"
 input: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "1 btnPrimary: { background: "#6366f1", color: "#ffffff", border: "none", borderRadius: 10, p btnGhost: { background: "transparent", color: "#94a3b8", border: "1px solid #e2e8f0", bord btnDanger: { background: "#fff1f2", color: "#ef4444", border: "1px solid #fecaca", borderR btnCreate: { flex: 1, background: "#6366f1", color: "#ffffff", border: "none", borderRadiu btnRetry: { background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", bord
 // Header 
 header: { background: "#ffffff", borderBottom: "1px solid #f1f5f9", padding: "14px 20px",  headerLeft: { display: "flex", alignItems: "center", gap: 10 }, 
 headerIcon: { fontSize: 19 }, 
 headerLogo: { fontWeight: 700, fontSize: 15, letterSpacing: 0.5, color: "#1e293b" },  headerRight: { display: "flex", alignItems: "center", gap: 10 }, 
 balancePill: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, paddi balanceDollar: { fontSize: 12, color: "#16a34a" }, 
 balanceAmt: { fontSize: 15, fontWeight: 700, color: "#16a34a" }, 
 avatarBtn: { background: "#6366f1", color: "#ffffff", border: "none", borderRadius: "50%", headerBanner: { background: "#fffbeb", borderBottom: "1px solid #fde68a", padding: "10px 2
 // Tabs 
 tabs: { display: "flex", borderBottom: "1px solid #f1f5f9", background: "#ffffff", positio tab: { flex: "1 0 auto", background: "transparent", border: "none", borderBottom: "2px sol tabActive: { color: "#6366f1", borderBottom: "2px solid #6366f1", fontWeight: 600 },  content: { padding: "16px 16px 120px" }, 
 // Market cards 
 marketCard: { background: "#ffffff", border: "1px solid #e8edf2", borderRadius: 14, paddin marketTop: { display: "flex", justifyContent: "space-between", alignItems: "center", margi leagueTag: { fontSize: 10, fontWeight: 600, letterSpacing: 1, borderRadius: 5, padding: "3 settledTag: { fontSize: 10, background: "#f0fdf4", color: "#16a34a", borderRadius: 5, padd pausedTag: { fontSize: 10, background: "#fffbeb", color: "#d97706", borderRadius: 5, paddi pausedBadge: { fontSize: 10, background: "#fffbeb", color: "#d97706", borderRadius: 5, pad pausedNotice: { margin: "0 0 12px", fontSize: 13, color: "#92400e", background: "#fffbeb", maxBetTag: { fontSize: 10, background: "#eef2ff", color: "#6366f1", borderRadius: 5, paddi actionTag: { fontSize: 10, color: "#94a3b8" }, 
 marketTitle: { margin: "0 0 3px", fontSize: 17, fontWeight: 700, lineHeight: 1.3, color: " marketSub: { margin: "0 0 14px", fontSize: 11, color: "#94a3b8", fontWeight: 400 },  winnerAnnounce: { margin: "0 0 12px", fontSize: 14, color: "#16a34a", fontWeight: 700, bac optionGrid: { display: "flex", flexDirection: "column", gap: 8 }, 
 optionBtn: { display: "flex", justifyContent: "space-between", alignItems: "center", backg optionBtnSelected: { background: "#f0fdf4", border: "1.5px solid #16a34a" },  optionBtnDisabled: { opacity: 0.45, cursor: "not-allowed" }, 
 optionLabel: { fontSize: 14, color: "#374151", fontFamily: FONT, textAlign: "left", fontWe optionOdds: { fontSize: 15, fontWeight: 700, color: "#6366f1" }, 
 optionOddsSelected: { color: "#16a34a" }, 
 optionMoney: { fontSize: 10, color: "#94a3b8" }, 
 moneyBar: { height: 3, background: "#f1f5f9", borderRadius: 2, marginTop: 3, marginBottom:
 moneyBarFill: { height: "100%", borderRadius: 2, transition: "width 0.4s ease", opacity: 0. stakeRow: { marginTop: 9, background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadi stakeTeam: { fontSize: 11, color: "#16a34a", flex: "1 1 100%", marginBottom: 2, fontWeight: stakeInputWrap: { display: "flex", alignItems: "center", gap: 4 }, 
 stakeDollar: { color: "#16a34a", fontSize: 15, fontWeight: 700 }, 
 stakeInput: { background: "transparent", border: "none", borderBottom: "1.5px solid #bbf7d toWin: { fontSize: 13, color: "#16a34a", marginLeft: "auto", fontWeight: 600 },  slipFooter: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#ffffff", bord slipModeRow: { display: "flex", gap: 6, marginBottom: 12 }, 
 slipModeBtn: { flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748 slipModeBtnActive: { background: "#f0fdf4", border: "1.5px solid #16a34a", color: "#16a34a slipSummary: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, paddi slipSummaryRow: { display: "flex", justifyContent: "space-between", alignItems: "center",  slipSummaryLabel: { fontSize: 11, color: "#94a3b8" }, 
 slipSummaryVal: { fontSize: 14, fontWeight: 700, color: "#1e293b" },  placeBetBtn: { width: "100%", background: "#6366f1", color: "#ffffff", border: "none", bor
 // Bet cards 
 betCard: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding:  betCardWon: { border: "1px solid #bbf7d0", background: "#f0fdf4" }, 
 betCardLost: { border: "1px solid #fecaca", background: "#fff1f2" },  betCardTop: { display: "flex", justifyContent: "space-between", marginBottom: 9 },  betMarket: { fontSize: 11, color: "#94a3b8" }, 
 betPick: { fontSize: 16, fontWeight: 700, marginBottom: 9, color: "#1e293b" },  betAmounts: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#647
 // Leaderboard 
 empty: { textAlign: "center", padding: "60px 20px" }, 
 emptyText: { color: "#94a3b8", fontSize: 14, margin: 0 }, 
 boardRow: { display: "flex", justifyContent: "space-between", alignItems: "center", paddin boardLeft: { display: "flex", alignItems: "center", gap: 12 }, 
 boardRight: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 },  boardRank: { fontSize: 16, color: "#1e293b", width: 32, fontWeight: 700 },  boardName: { fontSize: 15, fontWeight: 600 }, 
 boardBal: { fontSize: 16, fontWeight: 700, color: "#16a34a" }, 
 // Admin 
 adminWrap: { minHeight: "100vh", background: "#f8fafc", color: "#1e293b", fontFamily: FONT, adminHeader: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },  backBtn: { background: "transparent", border: "1px solid #e2e8f0", color: "#64748b", borde adminTitleRow: { display: "flex", flexDirection: "column" }, 
 adminTitle: { fontSize: 17, letterSpacing: 1, color: "#1e293b", fontWeight: 700, lineHeigh adminTitleSub: { fontSize: 11, color: "#94a3b8", marginTop: 3 }, 
 pinWrap: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 300 },  pinLabel: { color: "#64748b", fontSize: 14, margin: 0 }, 
 adminTabRow: { display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" },  adminTab: { background: "#ffffff", border: "1px solid #e2e8f0", color: "#64748b", borderRa
 adminTabActive: { background: "#6366f1", color: "#ffffff", border: "1px solid #6366f1", fo adminContent: { display: "flex", flexDirection: "column", gap: 14 },  adminSection: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padd sectionHead: { margin: "0 0 14px", fontSize: 11, letterSpacing: 1.5, color: "#94a3b8", fon leaderRow: { display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: leaderRank: { fontSize: 11, color: "#94a3b8", width: 22 }, 
 leaderName: { flex: 1, fontSize: 15, fontWeight: 500, minWidth: 80, color: "#1e293b" },  leaderBal: { fontSize: 15, fontWeight: 700, color: "#16a34a" }, 
 adjustBtn: { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", borderR adjustRow: { display: "flex", gap: 8, alignItems: "center", padding: "8px 0 12px", borderB settleCard: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, paddin settleTitle: { fontSize: 14, fontWeight: 700, marginBottom: 10, display: "flex", alignItem settledBadge: { fontSize: 10, background: "#f0fdf4", color: "#16a34a", borderRadius: 5, pa settleOptions: { display: "flex", flexDirection: "column", gap: 7 }, 
 settleBtn: { background: "#ffffff", border: "1px solid #bbf7d0", color: "#16a34a", borderR winnerText: { margin: 0, fontSize: 14, color: "#6366f1", fontWeight: 700 },  formRow: { marginBottom: 15 }, 
 formLabel: { display: "block", fontSize: 11, color: "#94a3b8", letterSpacing: 1, marginBot toggleRow: { display: "flex", gap: 8 }, 
 toggleBtn: { flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", toggleBtnActive: { background: "#6366f1", color: "#ffffff", border: "1px solid #6366f1", f oddsRow: { display: "flex", gap: 8 }, 
 removeBtn: { background: "#fff1f2", color: "#ef4444", border: "none", borderRadius: 6, wid addOptionBtn: { background: "transparent", border: "1px dashed #e2e8f0", color: "#94a3b8", betRow: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 1 betRowTop: { display: "flex", justifyContent: "space-between", marginBottom: 4 }, 
 betRowUser: { fontSize: 14, fontWeight: 700, color: "#6366f1" }, 
 betRowMarket: { fontSize: 11, color: "#94a3b8", marginBottom: 3 }, 
 betRowPick: { fontSize: 14, fontWeight: 600, marginBottom: 7, color: "#1e293b" },  betRowAmounts: { display: "flex", gap: 12, fontSize: 12, color: "#64748b", flexWrap: "wrap};
