import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

//  Fonts 
if (typeof document !== "undefined" && !document.getElementById("mln-f")) {
  const l = document.createElement("link"); l.id = "mln-f"; l.rel = "stylesheet";
  const b = "https://fonts.googleapis.com/css2";
  const q = "?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap";
  l.href = b + q; document.head.appendChild(l);
}

//  Icons (pure ASCII unicode escapes) 
const I = {
  ball:    "\u26BE", home:    "\uD83C\uDFE0", stadium: "\uD83C\uDFDF",
  trophy:  "\uD83C\uDFC6", medal:   "\uD83C\uDFC5", crystal: "\uD83D\uDD2E",
  eye:     "\uD83D\uDC41",  noSee:   "\uD83D\uDE48", money:   "\uD83D\uDCB0",
  scales:  "\u2696\uFE0F",  people:  "\uD83D\uDC65", clipboard:"\uD83D\uDCCB",
  pencil:  "\u270F\uFE0F",  plus:    "\u2795",        warn:    "\u26A0\uFE0F",
  pause:   "\u23F8\uFE0F",  play:    "\u25B6\uFE0F",  ok:      "\u2705",
  check:   "\u2713",        cross:   "\u2717",         undo:    "\u21A9",
  pending: "\u23F3",        back:    "\u232B",
};

//  Firebase 
const fbCfg = {
  apiKey: "AIzaSyClIKmR4FTthxNXtYJZS8Ef6U6RvcvBKGg",
  authDomain: "mln-betting.firebaseapp.com",
  databaseURL: "https://mln-betting-default-rtdb.firebaseio.com",
  projectId: "mln-betting",
  storageBucket: "mln-betting.firebasestorage.app",
  messagingSenderId: "444211874873",
  appId: "1:444211874873:web:599bcdeb815bbcd04d91e8",
};
const fbApp = initializeApp(fbCfg);
const db = getDatabase(fbApp);

//  Constants 
const START_BAL = 1000;
const ADMIN_PIN = "543211";
const BANNED = ["fuck","shit","ass","bitch","cunt","dick","cock","pussy","prick",
  "bastard","asshole","motherfucker","fucker","bullshit","jackass","dumbass",
  "twat","slut","whore","fag","faggot","retard","nigger","nigga","spic",
  "chink","kike","tranny","dyke","tits","titties","boobs","penis","vagina",
  "balls","testicle","scrotum","boner","dildo","butthole","anus","rectum",
  "cum","jizz","sperm","wank","wanker","piss","poop","crap","turd","douche",
  "dipshit","goddamn","damnit"];

const INIT_MARKETS = {
  games: [
    { id:"lsf1",type:"game",title:"Aruba Sea Serpents vs Humongous Melonheads",subtitle:"Lunar League - Semifinal",status:"open",winner:null,maxBet:null,options:[{id:"lsf1_ss",label:"Aruba Sea Serpents",odds:-225},{id:"lsf1_mel",label:"Humongous Melonheads",odds:180}]},
    { id:"lsf2",type:"game",title:"Raccoon City Outbreak vs Sopher McDophers",subtitle:"Lunar League - Semifinal",status:"open",winner:null,maxBet:null,options:[{id:"lsf2_out",label:"Raccoon City Outbreak",odds:-110},{id:"lsf2_mcd",label:"Sopher McDophers",odds:-111}]},
    { id:"gsf1",type:"game",title:"Gas House Gorillas vs Sunnydale Slayers",subtitle:"Galactic League - Semifinal",status:"open",winner:null,maxBet:null,options:[{id:"gsf1_gor",label:"Gas House Gorillas",odds:-200},{id:"gsf1_sla",label:"Sunnydale Slayers",odds:161}]},
    { id:"gsf2",type:"game",title:"Ursa Major Grizzlies vs R'lyeh Ancients",subtitle:"Galactic League - Semifinal",status:"open",winner:null,maxBet:null,options:[{id:"gsf2_gri",label:"Ursa Major Grizzlies",odds:-101},{id:"gsf2_anc",label:"R'lyeh Ancients",odds:-121}]},
  ],
  futures: [
    { id:"lunar_champ",type:"future",title:"Lunar League Champion",subtitle:"Season Future",status:"open",winner:null,maxBet:null,options:[{id:"lc_ss",label:"Aruba Sea Serpents",odds:165},{id:"lc_mcd",label:"Sopher McDophers",odds:273},{id:"lc_out",label:"Raccoon City Outbreak",odds:274},{id:"lc_mel",label:"Humongous Melonheads",odds:631}]},
    { id:"galactic_champ",type:"future",title:"Galactic League Champion",subtitle:"Season Future",status:"open",winner:null,maxBet:null,options:[{id:"gc_gor",label:"Gas House Gorillas",odds:178},{id:"gc_anc",label:"R'lyeh Ancients",odds:251},{id:"gc_gri",label:"Ursa Major Grizzlies",odds:298},{id:"gc_sla",label:"Sunnydale Slayers",odds:549}]},
    { id:"toos",type:"future",title:"ToOS Winner",subtitle:"Championship Future",status:"open",winner:null,maxBet:null,options:[{id:"toos_ss",label:"Aruba Sea Serpents",odds:340},{id:"toos_gor",label:"Gas House Gorillas",odds:476},{id:"toos_mcd",label:"Sopher McDophers",odds:571},{id:"toos_out",label:"Raccoon City Outbreak",odds:573},{id:"toos_anc",label:"R'lyeh Ancients",odds:674},{id:"toos_gri",label:"Ursa Major Grizzlies",odds:820},{id:"toos_mel",label:"Humongous Melonheads",odds:1570},{id:"toos_sla",label:"Sunnydale Slayers",odds:1753}]},
  ],
};

//  Helpers 
const fmt = o => o > 0 ? `+${o}` : `${o}`;
const toWin = (s,o) => o > 0 ? s*o/100 : s*100/Math.abs(o);
const calcPay = (s,o) => s + toWin(s,o);
const uid = () => Math.random().toString(36).slice(2,9);
const fmtDate = ts => new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric"});
const toDecimal = o => o > 0 ? o/100+1 : 100/Math.abs(o)+1;
const combineOdds = legs => {
  const d = legs.reduce((a,l)=>a*toDecimal(l.odds),1);
  return d>=2 ? Math.round((d-1)*100) : Math.round(-100/(d-1));
};
const hasBanned = str => {
  const n = str.toLowerCase().replace(/[^a-z]/g,"");
  return BANNED.some(w => n.includes(w));
};
const findUser = (users, name) =>
  Object.keys(users).find(k=>k.toLowerCase()===name.trim().toLowerCase())||null;
const leagueMeta = sub => {
  const s = (sub||"").toLowerCase();
  if (s.includes("lunar")) return {tag:"LUNAR",color:"#60a5fa",bg:"rgba(96,165,250,0.1)"};
  if (s.includes("galactic")) return {tag:"GALACTIC",color:"#a78bfa",bg:"rgba(167,139,250,0.1)"};
  if (s.includes("toos")||s.includes("championship")) return {tag:"ToOS",color:"#fbbf24",bg:"rgba(251,191,36,0.1)"};
  return {tag:"FUTURE",color:"#6b7280",bg:"rgba(107,114,128,0.1)"};
};
const getBase = title => title.replace(/ - Spread$/,"").replace(/ - O\/U [\d.]+$/,"");

//  Firebase storage 
function fbParse(v) {
  if (v===null||v===undefined) return null;
  if (typeof v==="string") { try { return JSON.parse(v); } catch { return v; } }
  if (typeof v==="object"&&!Array.isArray(v)) {
    const ks=Object.keys(v);
    return ks.length>0&&ks.every(k=>!isNaN(k)) ? ks.map(k=>v[k]) : v;
  }
  return v;
}
const fbGet = async key => { try { const s=await get(ref(db,key)); return s.exists()?fbParse(s.val()):null; } catch { return null; } };
const fbSet = async (key,val) => { try { await set(ref(db,key),JSON.stringify(val)); } catch {} };

//  PinPad 
function PinPad({ value, onChange, label, sublabel, error }) {
  const KEYS = ["1","2","3","4","5","6","7","8","9","","0",I.back];
  const press = k => {
    if (k===I.back) { onChange(value.slice(0,-1)); return; }
    if (k===""||value.length>=4) return;
    onChange(value+k);
  };
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:13,color:"#9ca3af",marginBottom:3}}>{label}</div>
        {sublabel&&<div style={{fontSize:11,color:"#4b5563"}}>{sublabel}</div>}
      </div>
      <div style={{display:"flex",gap:14}}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{width:13,height:13,borderRadius:"50%",
            background:i<value.length?"#60a5fa":"transparent",
            border:`2px solid ${i<value.length?"#60a5fa":error?"#ef4444":"#374151"}`,
            transition:"all 0.15s"}}/>
        ))}
      </div>
      {error&&<div style={{fontSize:11,color:"#ef4444",marginTop:-8}}>{error}</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,width:195}}>
        {KEYS.map((k,i)=>(
          <button key={i} onMouseDown={e=>{e.preventDefault();press(k);}}
            style={{height:52,background:k===""?"transparent":"#1f2937",
              border:k===""?"none":"1px solid #374151",borderRadius:10,
              color:"#f9fafb",fontSize:k===I.back?16:19,fontWeight:600,
              cursor:k===""?"default":"pointer",fontFamily:"inherit",
              pointerEvents:k===""?"none":"auto"}}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

//  Combobox 
function Combo({ value, onChange, options, placeholder, style }) {
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const ref2=useRef(null);
  useEffect(()=>{
    const h=e=>{ if(ref2.current&&!ref2.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);
  const filtered=options.filter(o=>o.toLowerCase().includes(q.toLowerCase())).slice(0,8);
  return (
    <div ref={ref2} style={{position:"relative",...style}}>
      <input value={open?q:value}
        onChange={e=>{setQ(e.target.value);onChange("");setOpen(true);}}
        onFocus={()=>{setQ("");setOpen(true);}}
        placeholder={placeholder} style={S.inp} autoComplete="off"/>
      {open&&filtered.length>0&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
          background:"#1f2937",border:"1px solid #374151",borderRadius:10,
          boxShadow:"0 8px 24px rgba(0,0,0,0.4)",zIndex:100,overflow:"hidden"}}>
          {filtered.map(o=>(
            <div key={o} onMouseDown={()=>{onChange(o);setQ("");setOpen(false);}}
              style={{padding:"9px 14px",fontSize:13,cursor:"pointer",color:"#f9fafb",
                background:o===value?"#1d4ed8":"transparent",fontWeight:o===value?600:400}}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

//  Toast 
function Toast({ n }) {
  return (
    <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",
      background:n.type==="error"?"#7f1d1d":"#14532d",
      border:`1px solid ${n.type==="error"?"#991b1b":"#166534"}`,
      color:n.type==="error"?"#fca5a5":"#86efac",
      borderRadius:50,padding:"11px 26px",fontSize:13,fontWeight:700,
      zIndex:200,whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
      {n.msg}
    </div>
  );
}

//  App 
export default function App() {
  const [loading,setLoading]=useState(true);
  const [screen,setScreen]=useState("login");  // login | lobby | admin
  const [notif,setNotif]=useState(null);

  // Firebase state
  const [users,setUsers]=useState({});
  const [markets,setMarkets]=useState(INIT_MARKETS);
  const [bets,setBets]=useState([]);
  const [lbVisible,setLbVisible]=useState(true);
  const [headerMsg,setHeaderMsg]=useState("");
  const [siteMax,setSiteMax]=useState(null);

  // Login
  const [inputName,setInputName]=useState("");
  const [loginStep,setLoginStep]=useState("name");
  const [pinVal,setPinVal]=useState("");
  const [pendingPin,setPendingPin]=useState("");
  const [pinErr,setPinErr]=useState("");
  const [username,setUsername]=useState("");

  // Lobby
  const [tab,setTab]=useState("games");
  const [slip,setSlip]=useState({});
  const [slipMode,setSlipMode]=useState("straight");
  const [parlayStake,setParlayStake]=useState("");

  // Admin
  const [adminTab,setAdminTab]=useState("settle");
  const [adminPin,setAdminPin]=useState("");
  const [adminOk,setAdminOk]=useState(false);
  const [expandedPnl,setExpandedPnl]=useState(null);
  const [adjUser,setAdjUser]=useState(null);
  const [adjAmt,setAdjAmt]=useState("");
  const [editingMkt,setEditingMkt]=useState(null);
  const [editTitle,setEditTitle]=useState("");
  const [editSub,setEditSub]=useState("");
  const [editOpts,setEditOpts]=useState([]);
  const [editMax,setEditMax]=useState("");
  const [addType,setAddType]=useState("game");
  const [aTitle,setATitle]=useState(""); const [aSub,setASub]=useState("");
  const [aA,setAA]=useState(""); const [aOddsA,setAOddsA]=useState("");
  const [aB,setAB]=useState(""); const [aOddsB,setAOddsB]=useState("");
  const [aSpread,setASpread]=useState(""); const [aSpOddsA,setASpOddsA]=useState("-110"); const [aSpOddsB,setASpOddsB]=useState("-110");
  const [aOU,setAOU]=useState(""); const [aOvOdds,setAOvOdds]=useState("-110"); const [aUnOdds,setAUnOdds]=useState("-110");
  const [aMax,setAMax]=useState("");
  const [futOpts,setFutOpts]=useState([{label:"",odds:""},{label:"",odds:""}]);
  const [bannerDraft,setBannerDraft]=useState("");
  const [siteMaxDraft,setSiteMaxDraft]=useState("");

  const notify = (msg,type="success") => { setNotif({msg,type}); setTimeout(()=>setNotif(null),3200); };
  const saveUsers = async u => { setUsers(u); await fbSet("mln_users",u); };
  const saveMarkets = async m => { setMarkets(m); await fbSet("mln_markets",m); };
  const saveBets = async b => { setBets(b); await fbSet("mln_bets",b); };

  //  Load + real-time 
  useEffect(()=>{
    (async()=>{
      const [u,m,b,lv,hm,sm]=await Promise.all([
        fbGet("mln_users"),fbGet("mln_markets"),fbGet("mln_bets"),
        fbGet("mln_leaderboard_visible"),fbGet("mln_header_msg"),fbGet("mln_site_max_bet"),
      ]);
      if(u)setUsers(u); if(m)setMarkets(m);
      setBets(Array.isArray(b)?b:[]);
      if(lv!==null)setLbVisible(lv);
      if(hm)setHeaderMsg(hm);
      setBannerDraft(hm||"");
      if(sm!==null){setSiteMax(sm);setSiteMaxDraft(String(sm));}
      setLoading(false);
    })();
    const u1=onValue(ref(db,"mln_users"),s=>{if(s.exists()){const v=fbParse(s.val());if(v)setUsers(v);}},()=>{});
    const u2=onValue(ref(db,"mln_markets"),s=>{if(s.exists()){const v=fbParse(s.val());if(v)setMarkets(v);}},()=>{});
    const u3=onValue(ref(db,"mln_bets"),s=>{const v=s.exists()?fbParse(s.val()):[];setBets(Array.isArray(v)?v:[]);},()=>{});
    const u4=onValue(ref(db,"mln_leaderboard_visible"),s=>{if(s.exists())setLbVisible(fbParse(s.val()));},()=>{});
    const u5=onValue(ref(db,"mln_header_msg"),s=>{const v=s.exists()?fbParse(s.val()):"";setHeaderMsg(v||"");},()=>{});
    const u6=onValue(ref(db,"mln_site_max_bet"),s=>{if(s.exists())setSiteMax(fbParse(s.val()));},()=>{});
    return()=>{u1();u2();u3();u4();u5();u6();};
  },[]);

  // 30-min inactivity timeout
  useEffect(()=>{
    if(screen!=="lobby")return;
    let t;
    const reset=()=>{clearTimeout(t);t=setTimeout(()=>{setSlip({});setScreen("login");setUsername("");},30*60*1000);};
    reset();
    window.addEventListener("click",reset);window.addEventListener("keypress",reset);window.addEventListener("touchstart",reset);
    return()=>{clearTimeout(t);window.removeEventListener("click",reset);window.removeEventListener("keypress",reset);window.removeEventListener("touchstart",reset);};
  },[screen]);

  // Auto-advance PIN
  useEffect(()=>{
    if(pinVal.length<4)return;
    const t=setTimeout(()=>handlePin(pinVal),150);
    return()=>clearTimeout(t);
  },[pinVal,loginStep]);

  // Hide leaderboard redirect
  useEffect(()=>{if(!lbVisible&&tab==="leaderboard")setTab("games");},[lbVisible]);

  //  Login 
  function submitName() {
    const raw=inputName.trim(); if(!raw)return;
    const key=findUser(users,raw);
    setPinVal(""); setPinErr("");
    if(key){setInputName(key);setLoginStep("pin_login");}
    else{
      if(hasBanned(raw)){notify("That name isn't allowed. Please choose another.","error");return;}
      setLoginStep("pin_create");
    }
  }

  async function handlePin(pin) {
    const name=inputName.trim();
    if(loginStep==="pin_login"){
      const key=findUser(users,name)||name;
      if(pin===users[key]?.pin){setUsername(key);setScreen("lobby");setLoginStep("name");setInputName("");setPinVal("");setPinErr("");}
      else{setPinErr("Incorrect PIN");setPinVal("");}
      return;
    }
    if(loginStep==="pin_create"){setPendingPin(pin);setPinVal("");setPinErr("");setLoginStep("pin_confirm");return;}
    if(loginStep==="pin_confirm"){
      if(pin===pendingPin){
        await saveUsers({...users,[name]:{balance:START_BAL,pin,createdAt:Date.now()}});
        setUsername(name);setScreen("lobby");setLoginStep("name");setInputName("");setPinVal("");setPinErr("");setPendingPin("");
      }else{setPinErr("PINs don't match");setPinVal("");setTimeout(()=>{setLoginStep("pin_create");setPinErr("");},600);}
    }
  }

  //  Derived 
  const allMkts = [...markets.games,...markets.futures];
  const slipEntries = Object.entries(slip);
  const slipLegs = slipEntries.map(([optId,v])=>{
    const m=allMkts.find(x=>x.id===v.mktId);
    const o=m?.options.find(x=>x.id===optId);
    return {optionId:optId,mktId:v.mktId,mktTitle:m?.title,optLabel:o?.label,odds:o?.odds,stake:v.stake};
  });
  const hasFuture = slipLegs.some(l=>allMkts.find(m=>m.id===l.mktId)?.type==="future");
  const slipBases = slipLegs.map(l=>{const m=allMkts.find(x=>x.id===l.mktId);return m?getBase(m.title):null;});
  const sameGameConflict = slipBases.some((b,i)=>slipBases.some((c,j)=>i!==j&&b&&c&&b===c));
  const multiMkt = new Set(slipEntries.map(([,v])=>v.mktId)).size>1;
  const parlayOk = multiMkt&&!hasFuture&&!sameGameConflict;
  const parlayOdds = slipLegs.length>1?combineOdds(slipLegs):null;
  const parlayPay = parlayStake>0&&parlayOdds!=null?calcPay(parseFloat(parlayStake),parlayOdds):0;
  const straightTotal = slipLegs.reduce((a,l)=>a+(parseFloat(l.stake)||0),0);
  const straightPay = slipLegs.reduce((a,l)=>a+(parseFloat(l.stake)>0?calcPay(parseFloat(l.stake),l.odds):0),0);

  const optTotals={};
  for(const b of bets){
    if(b.betType==="straight")optTotals[b.optionId]=(optTotals[b.optionId]||0)+b.stake;
    else if(b.betType==="parlay")for(const l of b.legs)optTotals[l.optionId]=(optTotals[l.optionId]||0)+b.stake;
  }

  const bal = users[username]?.balance??START_BAL;
  const myBets = bets.filter(b=>b.username===username);

  const lbRaw = Object.entries(users).map(([name,u])=>{
    const pending=bets.filter(b=>b.username===name&&b.status==="pending").reduce((s,b)=>s+b.stake,0);
    return {name,u,pending,total:(u.balance||0)+pending};
  }).sort((a,b)=>{
    if(b.total!==a.total)return b.total-a.total;
    if(b.pending!==a.pending)return b.pending-a.pending;
    return a.name.localeCompare(b.name);
  });
  const lb = lbRaw.reduce((acc,e,i)=>{
    const rank=i===0?1:(e.total===acc[i-1].total?acc[i-1].rank:i+1);
    acc.push({...e,rank}); return acc;
  },[]);
  const lbActive = lb.filter(p=>bets.some(b=>b.username===p.name));
  const lbInactive = lb.filter(p=>!bets.some(b=>b.username===p.name));

  //  Bet actions 
  function togglePick(mktId, optId) {
    if(slip[optId]){const c={...slip};delete c[optId];setSlip(c);return;}
    const c={};
    for(const [k,v] of slipEntries){if(v.mktId!==mktId)c[k]=v;}
    c[optId]={mktId,stake:""};
    setSlip(c);
    const m=allMkts.find(x=>x.id===mktId);
    if(m?.type==="future"&&slipMode==="parlay")setSlipMode("straight");
  }
  const setStake=(optId,val)=>setSlip(p=>({...p,[optId]:{...p[optId],stake:val}}));

  async function placeBets() {
    if(!slipEntries.length)return;
    for(const [,v] of slipEntries){
      const m=allMkts.find(x=>x.id===v.mktId);
      if(m?.status==="paused"){notify(`${m.title} is paused`,"error");return;}
      if(m?.status==="settled"){notify(`${m.title} is already settled`,"error");return;}
    }
    if(slipMode==="parlay"){
      if(hasFuture){notify("Futures can't be in parlays","error");setSlipMode("straight");return;}
      if(sameGameConflict){notify("Can't parlay moneyline + spread from the same game","error");return;}
      const stake=parseFloat(parlayStake);
      if(!stake||stake<=0){notify("Enter a valid stake","error");return;}
      if(stake>bal){notify("Not enough balance","error");return;}
      if(siteMax&&stake>siteMax){notify(`Max bet is $${siteMax}`,"error");return;}
      const co=combineOdds(slipLegs);
      const newBet={id:uid(),username,betType:"parlay",
        legs:slipLegs.map(l=>({mktId:l.mktId,mktTitle:l.mktTitle,optionId:l.optionId,optionLabel:l.optLabel,odds:l.odds,status:"pending"})),
        combinedOdds:co,stake,payout:calcPay(stake,co),status:"pending",placedAt:Date.now()};
      await saveUsers({...users,[username]:{...users[username],balance:bal-stake}});
      await saveBets([...bets,newBet]);
      setSlip({});setParlayStake("");
      notify(`Parlay placed! ${fmt(co)}`);
    } else {
      let total=0;
      for(const [,v] of slipEntries){const a=parseFloat(v.stake);if(!a||a<=0){notify("Enter a valid stake for each bet","error");return;}total+=a;}
      if(total>bal){notify("Not enough balance","error");return;}
      for(const [,v] of slipEntries){
        const m=allMkts.find(x=>x.id===v.mktId);const a=parseFloat(v.stake);
        if(m?.maxBet&&a>m.maxBet){notify(`Max bet on this market is $${m.maxBet}`,"error");return;}
        if(siteMax&&a>siteMax){notify(`Max bet is $${siteMax}`,"error");return;}
      }
      const newBets=[...bets];
      for(const [optId,v] of slipEntries){
        const m=allMkts.find(x=>x.id===v.mktId);const o=m.options.find(x=>x.id===optId);const stake=parseFloat(v.stake);
        newBets.push({id:uid(),username,betType:"straight",
          marketId:v.mktId,marketTitle:m.title,optionId:optId,optionLabel:o.label,
          odds:o.odds,stake,payout:calcPay(stake,o.odds),status:"pending",placedAt:Date.now()});
      }
      await saveUsers({...users,[username]:{...users[username],balance:bal-total}});
      await saveBets(newBets);setSlip({});
      notify(`${slipEntries.length} bet${slipEntries.length>1?"s":""} placed!`);
    }
  }

  //  Admin actions 
  async function settleMarket(mktId,winOptId){
    const settle=m=>m.id===mktId?{...m,status:"settled",winner:winOptId}:m;
    const nm={games:markets.games.map(settle),futures:markets.futures.map(settle)};
    const nu={...users};
    const nb=bets.map(b=>{
      if(b.status!=="pending")return b;
      if(b.betType==="straight"){
        if(b.marketId!==mktId)return b;
        const won=b.optionId===winOptId;
        if(won)nu[b.username]={...nu[b.username],balance:(nu[b.username]?.balance||0)+b.payout};
        return {...b,status:won?"won":"lost"};
      }
      if(b.betType==="parlay"){
        const leg=b.legs.find(l=>l.mktId===mktId||l.marketId===mktId);if(!leg)return b;
        const nl=b.legs.map(l=>(l.mktId===mktId||l.marketId===mktId)?{...l,status:l.optionId===winOptId?"won":"lost"}:l);
        const lost=nl.some(l=>l.status==="lost");
        const won2=nl.every(l=>l.status==="won");
        if(won2)nu[b.username]={...nu[b.username],balance:(nu[b.username]?.balance||0)+b.payout};
        return {...b,legs:nl,status:lost?"lost":won2?"won":b.status};
      }
      return b;
    });
    await saveUsers(nu);await saveMarkets(nm);await saveBets(nb);
    notify(`Settled! ${I.money}`);
  }

  async function unsettleMarket(mktId){
    const nu={...users};
    const nb=bets.map(b=>{
      if(b.betType==="straight"){
        if(b.marketId!==mktId)return b;
        if(b.status==="won")nu[b.username]={...nu[b.username],balance:Math.max(0,(nu[b.username]?.balance||0)-b.payout)};
        return(b.status==="won"||b.status==="lost")?{...b,status:"pending"}:b;
      }
      if(b.betType==="parlay"){
        const hasLeg=b.legs.some(l=>l.mktId===mktId||l.marketId===mktId);if(!hasLeg)return b;
        if(b.status==="won")nu[b.username]={...nu[b.username],balance:Math.max(0,(nu[b.username]?.balance||0)-b.payout)};
        const nl=b.legs.map(l=>(l.mktId===mktId||l.marketId===mktId)?{...l,status:"pending"}:l);
        return {...b,legs:nl,status:nl.some(l=>l.status==="lost")?"lost":"pending"};
      }
      return b;
    });
    const reopen=m=>m.id===mktId?{...m,status:"open",winner:null}:m;
    await saveUsers(nu);await saveMarkets({games:markets.games.map(reopen),futures:markets.futures.map(reopen)});await saveBets(nb);
    notify(`${I.undo} Market reopened, payouts reversed`);
  }

  async function eliminateOption(mktId,optId){
    const nb=bets.map(b=>{
      if(b.status!=="pending")return b;
      if(b.betType==="straight"&&b.marketId===mktId&&b.optionId===optId)return {...b,status:"lost"};
      if(b.betType==="parlay"){
        const leg=b.legs.find(l=>(l.mktId===mktId||l.marketId===mktId)&&l.optionId===optId);if(!leg)return b;
        const nl=b.legs.map(l=>(l.mktId===mktId||l.marketId===mktId)&&l.optionId===optId?{...l,status:"lost"}:l);
        return {...b,legs:nl,status:"lost"};
      }
      return b;
    });
    const mark=m=>m.id===mktId?{...m,eliminated:[...(m.eliminated||[]),optId]}:m;
    await saveMarkets({games:markets.games.map(mark),futures:markets.futures.map(mark)});
    await saveBets(nb);
    const opt=allMkts.find(m=>m.id===mktId)?.options.find(o=>o.id===optId);
    notify(`${opt?.label} eliminated`);
  }

  async function togglePauseMkt(mktId){
    const m=allMkts.find(x=>x.id===mktId);
    const ns=m.status==="paused"?"open":"paused";
    const tog=x=>x.id===mktId?{...x,status:ns}:x;
    await saveMarkets({games:markets.games.map(tog),futures:markets.futures.map(tog)});
    notify(ns==="paused"?`${I.pause} Paused`:`${I.play} Opened`);
  }

  async function pauseAll(){
    await saveMarkets({games:markets.games.map(m=>m.status==="open"?{...m,status:"paused"}:m),futures:markets.futures.map(m=>m.status==="open"?{...m,status:"paused"}:m)});
    notify(`${I.pause} All markets paused`);
  }
  async function openAll(){
    await saveMarkets({games:markets.games.map(m=>m.status==="paused"?{...m,status:"open"}:m),futures:markets.futures.map(m=>m.status==="paused"?{...m,status:"open"}:m)});
    notify(`${I.play} All markets opened`);
  }

  async function voidMkt(mktId){
    const nu={...users};
    const nb=bets.map(b=>{
      if(b.status!=="pending")return b;
      const isMatch=(b.betType==="straight"&&b.marketId===mktId)||(b.betType==="parlay"&&b.legs.some(l=>l.mktId===mktId||l.marketId===mktId));
      if(!isMatch)return b;
      nu[b.username]={...nu[b.username],balance:(nu[b.username]?.balance||0)+b.stake};
      return {...b,status:"voided"};
    });
    const rm=m=>m.id!==mktId;
    await saveUsers(nu);await saveMarkets({games:markets.games.filter(rm),futures:markets.futures.filter(rm)});await saveBets(nb);
    notify("Market voided, bets refunded");
  }

  async function deleteUser(name){
    const nu={...users};delete nu[name];
    await saveUsers(nu);await saveBets(bets.filter(b=>b.username!==name));
    if(adjUser===name)setAdjUser(null);
    notify(`${name} deleted`);
  }

  async function applyAdj(name){
    const d=parseFloat(adjAmt);if(isNaN(d)){notify("Enter a number","error");return;}
    await saveUsers({...users,[name]:{...users[name],balance:Math.max(0,(users[name]?.balance||0)+d)}});
    setAdjUser(null);setAdjAmt("");notify(`Balance adjusted by ${d>=0?"+":""}$${d.toFixed(2)}`);
  }

  async function handleAddMkt(){
    if(!aTitle.trim()){notify("Title required","error");return;}
    const newId=`g_${uid()}`;const toAdd=[];
    if(addType==="game"){
      if(!aA.trim()||!aB.trim()||!aOddsA||!aOddsB){notify("Fill all fields","error");return;}
      const oA=parseInt(aOddsA),oB=parseInt(aOddsB);
      toAdd.push({id:newId,type:"game",title:aTitle.trim(),subtitle:aSub.trim()||"Custom Market",status:"open",winner:null,maxBet:aMax?parseFloat(aMax):null,
        options:[{id:`${newId}_a`,label:aA.trim(),odds:oA},{id:`${newId}_b`,label:aB.trim(),odds:oB}]});
      if(aSpread){
        const sp=parseFloat(aSpread),spA=parseInt(aSpOddsA),spB=parseInt(aSpOddsB);
        if(!isNaN(sp)&&!isNaN(spA)&&!isNaN(spB)){
          const sid=`${newId}_sp`;
          toAdd.push({id:sid,type:"game",title:`${aTitle.trim()} - Spread`,subtitle:(aSub.trim()||"Custom Market")+" - Spread",status:"open",winner:null,maxBet:aMax?parseFloat(aMax):null,
            options:[{id:`${sid}_a`,label:`${aA.trim()} ${sp>0?"+":""}${sp}`,odds:spA},{id:`${sid}_b`,label:`${aB.trim()} ${-sp>0?"+":""}${-sp}`,odds:spB}]});
        }
      }
      if(aOU){
        const ou=parseFloat(aOU),ovO=parseInt(aOvOdds),unO=parseInt(aUnOdds);
        if(!isNaN(ou)&&!isNaN(ovO)&&!isNaN(unO)){
          const oid=`${newId}_ou`;
          toAdd.push({id:oid,type:"game",title:`${aTitle.trim()} - O/U ${ou}`,subtitle:(aSub.trim()||"Custom Market")+" - O/U",status:"open",winner:null,maxBet:aMax?parseFloat(aMax):null,
            options:[{id:`${oid}_ov`,label:`Over ${ou}`,odds:ovO},{id:`${oid}_un`,label:`Under ${ou}`,odds:unO}]});
        }
      }
    } else {
      const valid=futOpts.filter(o=>o.label.trim()&&o.odds);
      if(valid.length<2){notify("At least 2 options required","error");return;}
      const fid=`f_${uid()}`;
      toAdd.push({id:fid,type:"future",title:aTitle.trim(),subtitle:aSub.trim()||"Future",status:"open",winner:null,maxBet:aMax?parseFloat(aMax):null,
        options:valid.map((o,i)=>({id:`${fid}_${i}`,label:o.label.trim(),odds:parseInt(o.odds)}))});
    }
    await saveMarkets({games:addType==="game"?[...markets.games,...toAdd]:markets.games,futures:addType==="future"?[...markets.futures,...toAdd]:markets.futures});
    setATitle("");setASub("");setAA("");setAOddsA("");setAB("");setAOddsB("");setAMax("");
    setASpread("");setASpOddsA("-110");setASpOddsB("-110");setAOU("");setAOvOdds("-110");setAUnOdds("-110");
    setFutOpts([{label:"",odds:""},{label:"",odds:""}]);
    notify(`${toAdd.length} market${toAdd.length>1?"s":""} added! ${I.ok}`);
  }

  async function saveEdit(){
    if(!editTitle.trim()){notify("Title required","error");return;}
    const upd={...editingMkt,title:editTitle.trim(),subtitle:editSub.trim(),options:editOpts.map(o=>({...o,odds:parseInt(o.odds)})),maxBet:editMax?parseFloat(editMax):null};
    const apply=m=>m.id===upd.id?upd:m;
    await saveMarkets({games:markets.games.map(apply),futures:markets.futures.map(apply)});
    setEditingMkt(null);notify(`Market updated ${I.ok}`);
  }

  // House P&L
  const getMktPnl = mktId => {
    const rel=bets.filter(b=>(b.betType==="straight"&&b.marketId===mktId||b.betType==="parlay"&&b.legs.some(l=>l.mktId===mktId||l.marketId===mktId))&&(b.status==="won"||b.status==="lost"));
    const staked=rel.reduce((s,b)=>s+b.stake,0);
    const paid=rel.filter(b=>b.status==="won").reduce((s,b)=>s+b.payout,0);
    return {staked,paid,net:staked-paid,count:rel.length};
  };
  const getOptProj = (mktId,winOptId) => {
    const straight=bets.filter(b=>b.status==="pending"&&b.betType==="straight"&&b.marketId===mktId);
    const staked=straight.reduce((s,b)=>s+b.stake,0);
    const paid=straight.filter(b=>b.optionId===winOptId).reduce((s,b)=>s+b.payout,0);
    const busted=bets.filter(b=>b.status==="pending"&&b.betType==="parlay"&&b.legs.some(l=>(l.mktId===mktId||l.marketId===mktId)&&l.optionId!==winOptId)).reduce((s,b)=>s+b.stake,0);
    return {net:(staked+busted)-paid};
  };
  const houseTotalNet=allMkts.filter(m=>m.status==="settled").reduce((s,m)=>s+getMktPnl(m.id).net,0);

  const getLifePnl = name => {
    const res=bets.filter(b=>b.username===name&&(b.status==="won"||b.status==="lost"));
    const staked=res.reduce((s,b)=>s+b.stake,0);
    const ret=res.filter(b=>b.status==="won").reduce((s,b)=>s+b.payout,0);
    return ret-staked;
  };

  //  Render helpers 
  const statusBadge = status => {
    if(status==="paused") return <span style={B.pauseBadge}>{I.pause} Paused</span>;
    if(status==="settled") return <span style={B.settledBadge}>Settled</span>;
    return null;
  };

  //  Group game markets for sportsbook layout 
  const groupGames = mkts => {
    const groups=[],used=new Set();
    for(const m of mkts){
      if(used.has(m.id))continue;
      const base=getBase(m.title);
      if(m.title!==base)continue;
      const sp=mkts.find(x=>x.title===`${base} - Spread`);
      const ou=mkts.find(x=>x.title.startsWith(`${base} - O/U`));
      [m.id,sp?.id,ou?.id].filter(Boolean).forEach(id=>used.add(id));
      groups.push({ml:m,sp:sp||null,ou:ou||null});
    }
    for(const m of mkts){if(!used.has(m.id)){groups.push({ml:m,sp:null,ou:null});used.add(m.id);}}
    return groups;
  };

  //  Loading 
  if(loading) return(
    <div style={{minHeight:"100vh",background:"#0a0f1a",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:10,height:10,borderRadius:"50%",background:"#3b82f6"}}/>
    </div>
  );

  //  Login 
  if(screen==="login") return(
    <div style={{minHeight:"100vh",background:"#0a0f1a",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:20,padding:"40px 32px",maxWidth:380,width:"100%",display:"flex",flexDirection:"column",gap:16,boxShadow:"0 24px 80px rgba(0,0,0,0.5)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
          <span style={{fontSize:36}}>{I.ball}</span>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,letterSpacing:3,color:"#f9fafb",lineHeight:1}}>MLN BETTING</div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>Fake Money - Real Bragging Rights</div>
          </div>
        </div>
        <div style={{height:1,background:"#1f2937"}}/>

        {loginStep==="name"&&<>
          <label style={S.lbl}>PLAYER NAME</label>
          <input style={S.inp} placeholder="Enter your name..." value={inputName}
            onChange={e=>setInputName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&inputName.trim()&&submitName()}/>
          <button style={{...S.btnPrimary,opacity:inputName.trim()?1:0.4}} onClick={submitName} disabled={!inputName.trim()}>Continue</button>
          <button style={S.btnGhost} onClick={()=>setScreen("admin")}>Admin Panel</button>
        </>}

        {loginStep==="pin_login"&&<>
          <div style={{textAlign:"center",fontSize:12,color:"#9ca3af"}}>Welcome back, <span style={{color:"#60a5fa",fontWeight:700}}>{inputName}</span></div>
          <PinPad value={pinVal} onChange={p=>{setPinVal(p);if(pinErr)setPinErr("");}} label="Enter your PIN" error={pinErr}/>
          <button style={S.btnGhost} onClick={()=>{setLoginStep("name");setPinVal("");setPinErr("");}}>Back</button>
        </>}

        {loginStep==="pin_create"&&<>
          <div style={{background:"#052e16",border:"1px solid #166534",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:13,color:"#4ade80",fontWeight:700,marginBottom:4}}>Account not found</div>
            <div style={{fontSize:12,color:"#9ca3af",marginBottom:6}}><strong style={{color:"#f9fafb"}}>{inputName}</strong> - Names are case-sensitive. Double-check spelling.</div>
            <div style={{fontSize:11,color:"#4ade80"}}>First time? Create an account below.</div>
          </div>
          <PinPad value={pinVal} onChange={setPinVal} label="Choose a 4-digit PIN" sublabel="You'll use this to log in"/>
          <button style={S.btnGhost} onClick={()=>{setLoginStep("name");setPinVal("");setPinErr("");}}>Back</button>
        </>}

        {loginStep==="pin_confirm"&&<>
          <PinPad value={pinVal} onChange={p=>{setPinVal(p);if(pinErr)setPinErr("");}} label="Confirm your PIN" error={pinErr}/>
          <button style={S.btnGhost} onClick={()=>{setLoginStep("pin_create");setPinVal("");setPinErr("");}}>Back</button>
        </>}
      </div>
      {notif&&<Toast n={notif}/>}
    </div>
  );

  //  Admin 
  if(screen==="admin") return(
    <div style={{minHeight:"100vh",background:"#0a0f1a",color:"#f9fafb",fontFamily:"'Inter',sans-serif",padding:"20px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24}}>
        <button style={S.btnGhost} onClick={()=>{setAdminOk(false);setAdminPin("");setScreen("login");}}>Back</button>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,letterSpacing:3,color:"#f9fafb"}}>ADMIN</div>
          <div style={{fontSize:11,color:"#6b7280"}}>MLN Betting</div>
        </div>
      </div>

      {!adminOk?(
        <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:300}}>
          <div style={{fontSize:13,color:"#9ca3af"}}>Enter admin PIN</div>
          <input style={S.inp} type="password" placeholder="PIN" value={adminPin}
            onChange={e=>setAdminPin(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&(adminPin===ADMIN_PIN?setAdminOk(true):notify("Wrong PIN","error"))}/>
          <button style={S.btnPrimary} onClick={()=>adminPin===ADMIN_PIN?setAdminOk(true):notify("Wrong PIN","error")}>Unlock</button>
        </div>
      ):(
        <>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
            {[[`${I.scales} Settle`,"settle"],[`${I.people} Players`,"players"],[`${I.plus} Add`,"add"],[`${I.pencil} Edit`,"edit"],[`${I.clipboard} Bets`,"bets"],[`${I.warn} Danger`,"danger"]].map(([l,k])=>(
              <button key={k} style={{...S.adminTab,...(adminTab===k?{background:"#3b82f6",color:"#f9fafb",borderColor:"#3b82f6"}:{})}}
                onClick={()=>{setAdminTab(k);setEditingMkt(null);}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {adminTab==="settle"&&<>
              {/* House P&L */}
              <div style={{...S.card,background:houseTotalNet>=0?"#052e16":"#1c0a0a",border:`1px solid ${houseTotalNet>=0?"#166534":"#7f1d1d"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={S.sHead}>HOUSE TAKE (ALL TIME)</div>
                  <div style={{fontSize:24,fontWeight:800,color:houseTotalNet>=0?"#4ade80":"#f87171",fontFamily:"'Barlow Condensed',sans-serif"}}>
                    {houseTotalNet>=0?"+":""}${houseTotalNet.toFixed(2)}
                  </div>
                </div>
                <div style={{fontSize:11,color:"#4b5563",marginTop:4}}>{allMkts.filter(m=>m.status==="settled").length} settled markets</div>
              </div>

              {/* Pause all */}
              <div style={{display:"flex",gap:8}}>
                <button style={{...S.btnWarn,flex:1}} onClick={pauseAll}>{I.pause} Pause All</button>
                <button style={{...S.settleBtn,flex:1,textAlign:"center"}} onClick={openAll}>{I.play} Open All</button>
              </div>

              {/* Markets */}
              <div style={S.card}>
                <div style={S.sHead}>SETTLE MARKETS</div>
                {allMkts.map(m=>{
                  const pnl=m.status==="settled"?getMktPnl(m.id):null;
                  const mTotal=m.options.reduce((s,o)=>s+(optTotals[o.id]||0),0);
                  return(
                    <div key={m.id} style={{background:"#0a0f1a",border:"1px solid #1f2937",borderRadius:10,padding:14,marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#f9fafb",flex:1,paddingRight:8}}>{m.title}</div>
                        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                          {statusBadge(m.status)}
                        </div>
                      </div>

                      {/* Money distribution */}
                      {mTotal>0&&m.status!=="settled"&&(
                        <div style={{marginBottom:10}}>
                          {m.options.map(opt=>{
                            const amt=optTotals[opt.id]||0;const pct=mTotal>0?amt/mTotal:0;
                            const proj=getOptProj(m.id,opt.id);
                            return(
                              <div key={opt.id} style={{background:"#111827",borderRadius:6,padding:"7px 10px",marginBottom:6}}>
                                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                                  <span style={{fontWeight:600,color:"#e5e7eb"}}>{opt.label} <span style={{color:"#60a5fa"}}>{fmt(opt.odds)}</span></span>
                                  <span style={{color:proj.net>=0?"#4ade80":"#f87171",fontWeight:700}}>
                                    If wins: {proj.net>=0?"+":""}${proj.net.toFixed(2)} house
                                  </span>
                                </div>
                                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#6b7280",marginBottom:5}}>
                                  <span>${amt.toFixed(0)} action ({Math.round(pct*100)}%)</span>
                                </div>
                                <div style={{height:3,background:"#1f2937",borderRadius:2,overflow:"hidden"}}>
                                  <div style={{height:"100%",width:`${pct*100}%`,background:"#3b82f6",borderRadius:2,opacity:0.7}}/>
                                </div>
                              </div>
                            );
                          })}
                          <div style={{fontSize:10,color:"#4b5563",marginTop:2}}>Total action: ${mTotal.toFixed(0)}</div>
                        </div>
                      )}

                      {/* Pause toggle */}
                      {(m.status==="open"||m.status==="paused")&&(
                        <div style={{marginBottom:8,display:"flex",justifyContent:"flex-end"}}>
                          <button style={m.status==="paused"?S.settleBtn:S.btnWarnSm} onClick={()=>togglePauseMkt(m.id)}>
                            {m.status==="paused"?`${I.play} Open`:`${I.pause} Pause`}
                          </button>
                        </div>
                      )}

                      {/* Settle/Unsettle */}
                      {(m.status==="open"||m.status==="paused")?(
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {m.options.map(opt=>{
                            const isElim=(m.eliminated||[]).includes(opt.id);
                            if(isElim)return(
                              <div key={opt.id} style={{padding:"8px 12px",background:"#1c0a0a",border:"1px solid #7f1d1d",borderRadius:8,fontSize:12,color:"#f87171",opacity:0.6}}>
                                {I.cross} {opt.label} — Eliminated
                              </div>
                            );
                            return(
                              <div key={opt.id} style={{display:"flex",gap:6}}>
                                <button style={{...S.settleBtn,flex:1}} onClick={()=>settleMarket(m.id,opt.id)}>
                                  {I.check} {opt.label}
                                </button>
                                {m.type==="future"&&(
                                  <button style={{...S.btnDangerSm}} onClick={()=>{if(window.confirm(`Eliminate ${opt.label}?`))eliminateOption(m.id,opt.id);}}>
                                    {I.cross} Out
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ):(
                        <>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <span style={{fontSize:13,color:"#60a5fa",fontWeight:700}}>{I.trophy} {m.options.find(o=>o.id===m.winner)?.label}</span>
                            <button style={{...S.btnDangerSm,borderColor:"#7e22ce",color:"#a855f7",background:"rgba(168,85,247,0.1)"}}
                              onClick={()=>{if(window.confirm(`Unsettle "${m.title}"? This reverses all payouts.`))unsettleMarket(m.id);}}>
                              {I.undo} Unsettle
                            </button>
                          </div>
                          {pnl&&(
                            <div style={{cursor:"pointer",borderRadius:6,padding:"6px 8px",background:"#111827"}}
                              onClick={()=>setExpandedPnl(expandedPnl===m.id?null:m.id)}>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                                <span style={{color:"#6b7280"}}>{expandedPnl===m.id?"Hide":"Show"} house P&L</span>
                                <span style={{fontWeight:700,color:pnl.net>=0?"#4ade80":"#f87171"}}>{pnl.net>=0?"+":""}${pnl.net.toFixed(2)}</span>
                              </div>
                              {expandedPnl===m.id&&(
                                <div style={{marginTop:8,fontSize:11,color:"#9ca3af",display:"flex",flexDirection:"column",gap:3}}>
                                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Total staked</span><span>${pnl.staked.toFixed(2)}</span></div>
                                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Total paid out</span><span>${pnl.paid.toFixed(2)}</span></div>
                                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Bets resolved</span><span>{pnl.count}</span></div>
                                  <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,color:pnl.net>=0?"#4ade80":"#f87171",borderTop:"1px solid #1f2937",paddingTop:4,marginTop:2}}>
                                    <span>Net house {pnl.net>=0?"take":"loss"}</span>
                                    <span>{pnl.net>=0?"+":""}${pnl.net.toFixed(2)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>}

            {adminTab==="players"&&(
              <div style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={S.sHead}>PLAYERS ({lb.length})</div>
                  <button style={{...S.adminTab,...(lbVisible?{color:"#4ade80",borderColor:"#166534",background:"#052e16"}:{color:"#fbbf24",borderColor:"#92400e",background:"#1c1200"})}}
                    onClick={async()=>{const v=!lbVisible;setLbVisible(v);await fbSet("mln_leaderboard_visible",v);notify(v?"Standings visible":"Standings hidden");}}>
                    {lbVisible?`${I.eye} Standings ON`:`${I.noSee} Standings OFF`}
                  </button>
                </div>
                {lb.map(({name,u,pending,total,rank})=>{
                  const isTied=lb.filter(p=>p.rank===rank).length>1;
                  const pnl=getLifePnl(name);
                  const joined=u.createdAt?fmtDate(u.createdAt):"?";
                  return(
                    <div key={name}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:8,padding:"10px 0",borderBottom:"1px solid #1f2937",flexWrap:"wrap"}}>
                        <span style={{fontSize:15,fontWeight:700,color:"#f9fafb",width:36,flexShrink:0,paddingTop:2}}>{isTied?`T${rank}`:`#${rank}`}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:600,color:"#f9fafb",marginBottom:2}}>{name}</div>
                          <div style={{fontSize:10,color:"#6b7280"}}>Joined {joined}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,marginRight:8}}>
                          <span style={{fontSize:15,fontWeight:700,color:"#f9fafb"}}>${total.toFixed(2)}</span>
                          <div style={{display:"flex",gap:6}}>
                            <span style={{fontSize:10,color:"#4ade80"}}>${u.balance.toFixed(0)} cash</span>
                            {pending>0&&<span style={{fontSize:10,color:"#fbbf24"}}>${pending.toFixed(0)} bets</span>}
                          </div>
                          <span style={{fontSize:11,fontWeight:700,color:pnl>=0?"#4ade80":"#f87171"}}>{pnl>=0?"Up":"Down"} ${Math.abs(pnl).toFixed(2)} lifetime</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          <button style={S.adjBtn} onClick={()=>notify(`${name}'s PIN: ${u.pin||"none"}`)}>PIN</button>
                          <button style={S.adjBtn} onClick={()=>{setAdjUser(adjUser===name?null:name);setAdjAmt("");}}>+/-</button>
                          <button style={{...S.adjBtn,color:"#f87171",borderColor:"#7f1d1d"}} onClick={()=>{if(window.confirm(`Delete ${name}?`))deleteUser(name);}}>Del</button>
                        </div>
                      </div>
                      {adjUser===name&&(
                        <div style={{display:"flex",gap:8,padding:"8px 0 12px",borderBottom:"1px solid #1f2937"}}>
                          <input style={{...S.inp,flex:1}} type="number" placeholder="+100 or -50" value={adjAmt} onChange={e=>setAdjAmt(e.target.value)}/>
                          <button style={S.btnPrimary} onClick={()=>applyAdj(name)}>Apply</button>
                          <button style={S.btnGhost} onClick={()=>setAdjUser(null)}>Cancel</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {adminTab==="add"&&(
              <div style={S.card}>
                <div style={S.sHead}>ADD MARKET</div>
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  {["game","future"].map(t=><button key={t} style={{...S.adminTab,...(addType===t?{background:"#3b82f6",color:"#f9fafb",borderColor:"#3b82f6"}:{})}} onClick={()=>setAddType(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div><label style={S.lbl}>TITLE</label><input style={S.inp} placeholder="Game or market name" value={aTitle} onChange={e=>setATitle(e.target.value)}/></div>
                  <div><label style={S.lbl}>SUBTITLE</label><input style={S.inp} placeholder="League, round, etc." value={aSub} onChange={e=>setASub(e.target.value)}/></div>
                  <div><label style={S.lbl}>MAX BET (optional)</label><input style={S.inp} placeholder="e.g. 200" value={aMax} onChange={e=>setAMax(e.target.value)}/></div>
                  {addType==="game"?(
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div><label style={S.lbl}>TEAM A</label><input style={S.inp} placeholder="Name" value={aA} onChange={e=>setAA(e.target.value)}/></div>
                        <div><label style={S.lbl}>TEAM A ODDS</label><input style={S.inp} placeholder="-110" value={aOddsA} onChange={e=>setAOddsA(e.target.value)}/></div>
                        <div><label style={S.lbl}>TEAM B</label><input style={S.inp} placeholder="Name" value={aB} onChange={e=>setAB(e.target.value)}/></div>
                        <div><label style={S.lbl}>TEAM B ODDS</label><input style={S.inp} placeholder="+110" value={aOddsB} onChange={e=>setAOddsB(e.target.value)}/></div>
                      </div>
                      <div>
                        <label style={S.lbl}>SPREAD (optional)</label>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                          <input style={S.inp} placeholder="-3.5" value={aSpread} onChange={e=>setASpread(e.target.value)}/>
                          <input style={S.inp} placeholder="A odds" value={aSpOddsA} onChange={e=>setASpOddsA(e.target.value)}/>
                          <input style={S.inp} placeholder="B odds" value={aSpOddsB} onChange={e=>setASpOddsB(e.target.value)}/>
                        </div>
                      </div>
                      <div>
                        <label style={S.lbl}>OVER/UNDER (optional)</label>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                          <input style={S.inp} placeholder="7.5" value={aOU} onChange={e=>setAOU(e.target.value)}/>
                          <input style={S.inp} placeholder="Over odds" value={aOvOdds} onChange={e=>setAOvOdds(e.target.value)}/>
                          <input style={S.inp} placeholder="Under odds" value={aUnOdds} onChange={e=>setAUnOdds(e.target.value)}/>
                        </div>
                      </div>
                    </>
                  ):(
                    <>
                      <label style={S.lbl}>OPTIONS</label>
                      {futOpts.map((o,i)=>(
                        <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
                          <input style={{...S.inp,flex:2}} placeholder={`Option ${i+1}`} value={o.label} onChange={e=>setFutOpts(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/>
                          <input style={{...S.inp,flex:1}} placeholder="+350" value={o.odds} onChange={e=>setFutOpts(p=>p.map((x,j)=>j===i?{...x,odds:e.target.value}:x))}/>
                          {futOpts.length>2&&<button style={{background:"rgba(239,68,68,0.1)",color:"#ef4444",border:"none",borderRadius:6,width:36,cursor:"pointer",fontSize:12}} onClick={()=>setFutOpts(p=>p.filter((_,j)=>j!==i))}>X</button>}
                        </div>
                      ))}
                      <button style={{background:"transparent",border:"1px dashed #374151",color:"#6b7280",borderRadius:8,padding:10,cursor:"pointer",fontFamily:"inherit",fontSize:12}} onClick={()=>setFutOpts(p=>[...p,{label:"",odds:""}])}>+ Add Option</button>
                    </>
                  )}
                  <button style={{...S.btnPrimary,marginTop:6}} onClick={handleAddMkt}>Add Market</button>
                </div>
              </div>
            )}

            {adminTab==="edit"&&!editingMkt&&(
              <>
                <div style={S.card}>
                  <div style={S.sHead}>SITE-WIDE MAX BET</div>
                  <div style={{fontSize:12,color:"#9ca3af",marginBottom:10}}>Applies to every bet sitewide. Leave blank to remove limit. Current: {siteMax?`$${siteMax}`:"none"}</div>
                  <div style={{display:"flex",gap:8}}>
                    <input style={{...S.inp,flex:1}} type="number" placeholder="e.g. 200" value={siteMaxDraft} onChange={e=>setSiteMaxDraft(e.target.value)}/>
                    <button style={S.btnPrimary} onClick={async()=>{const v=siteMaxDraft.trim()?parseFloat(siteMaxDraft):null;setSiteMax(v);await fbSet("mln_site_max_bet",v);notify(v?`Max bet: $${v}`:"Max bet removed");}}>
                      {siteMaxDraft.trim()?"Set Limit":"Remove Limit"}
                    </button>
                  </div>
                </div>
                <div style={S.card}>
                  <div style={S.sHead}>LOBBY BANNER</div>
                  <div style={{fontSize:12,color:"#9ca3af",marginBottom:10}}>Shown to all logged-in players. Leave blank to hide.</div>
                  <textarea style={{...S.inp,minHeight:70,resize:"vertical"}} placeholder="e.g. Semifinals are LIVE! Place your bets before 7pm" value={bannerDraft} onChange={e=>setBannerDraft(e.target.value)}/>
                  <button style={{...S.btnPrimary,marginTop:10,width:"100%"}} onClick={async()=>{await fbSet("mln_header_msg",bannerDraft.trim());notify(bannerDraft.trim()?"Banner saved":"Banner cleared");}}>
                    {bannerDraft.trim()?"Save Banner":"Clear Banner"}
                  </button>
                </div>
                <div style={S.card}>
                  <div style={S.sHead}>EDIT / PAUSE / REMOVE MARKETS</div>
                  {allMkts.map(m=>(
                    <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1f2937",gap:8,flexWrap:"wrap"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>{m.title}</div>
                        <div style={{fontSize:10,color:m.status==="paused"?"#fbbf24":"#6b7280"}}>{m.status==="paused"?`${I.pause} Paused`:m.subtitle}</div>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {(m.status==="open"||m.status==="paused")&&<button style={S.settleBtn} onClick={()=>{setEditingMkt(m);setEditTitle(m.title);setEditSub(m.subtitle);setEditOpts(m.options.map(o=>({...o})));setEditMax(m.maxBet!=null?String(m.maxBet):"");}}>Edit</button>}
                        {(m.status==="open"||m.status==="paused")&&<button style={m.status==="paused"?S.settleBtn:S.btnWarnSm} onClick={()=>togglePauseMkt(m.id)}>{m.status==="paused"?`${I.play} Open`:`${I.pause} Pause`}</button>}
                        {m.status!=="settled"&&<button style={S.btnDangerSm} onClick={()=>voidMkt(m.id)}>Void</button>}
                        {m.status==="settled"&&<span style={B.settledBadge}>Settled</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {adminTab==="edit"&&editingMkt&&(
              <div style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div style={S.sHead}>EDITING MARKET</div>
                  <button style={S.btnGhost} onClick={()=>setEditingMkt(null)}>Cancel</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div><label style={S.lbl}>TITLE</label><input style={S.inp} value={editTitle} onChange={e=>setEditTitle(e.target.value)}/></div>
                  <div><label style={S.lbl}>SUBTITLE</label><input style={S.inp} value={editSub} onChange={e=>setEditSub(e.target.value)}/></div>
                  <div><label style={S.lbl}>MAX BET</label><input style={S.inp} placeholder="blank = none" value={editMax} onChange={e=>setEditMax(e.target.value)}/></div>
                  <label style={S.lbl}>OPTIONS</label>
                  {editOpts.map((o,i)=>(
                    <div key={o.id} style={{display:"flex",gap:8}}>
                      <input style={{...S.inp,flex:2}} value={o.label} onChange={e=>setEditOpts(p=>p.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/>
                      <input style={{...S.inp,flex:1}} value={o.odds} onChange={e=>setEditOpts(p=>p.map((x,j)=>j===i?{...x,odds:e.target.value}:x))}/>
                    </div>
                  ))}
                  <button style={{...S.btnPrimary,marginTop:6}} onClick={saveEdit}>Save Changes</button>
                </div>
              </div>
            )}

            {adminTab==="bets"&&(
              <div style={S.card}>
                <div style={S.sHead}>ALL BETS ({bets.length})</div>
                {[...bets].reverse().map(b=>(
                  <div key={b.id} style={{background:"#0a0f1a",border:"1px solid #1f2937",borderRadius:10,padding:12,marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700,color:"#60a5fa"}}>{b.username}</span>
                      <span style={{fontSize:11,fontWeight:700,color:b.status==="won"?"#4ade80":b.status==="lost"?"#f87171":b.status==="voided"?"#9ca3af":"#fbbf24"}}>
                        {b.status==="won"?`${I.check} WON`:b.status==="lost"?`${I.cross} LOST`:b.status==="voided"?`${I.undo} VOID`:`${I.pending} PENDING`}
                      </span>
                    </div>
                    {b.betType==="parlay"?(
                      <>
                        <div style={{fontSize:10,color:"#60a5fa",marginBottom:4,letterSpacing:1}}>PARLAY - {fmt(b.combinedOdds)}</div>
                        {b.legs.map((l,i)=><div key={i} style={{fontSize:12,color:"#9ca3af",marginBottom:2}}>{l.optionLabel} <span style={{color:"#fbbf24"}}>{fmt(l.odds)}</span></div>)}
                      </>
                    ):(
                      <><div style={{fontSize:11,color:"#6b7280",marginBottom:2}}>{b.marketTitle}</div>
                      <div style={{fontSize:13,fontWeight:600,color:"#f9fafb"}}>{b.optionLabel} <span style={{color:"#fbbf24"}}>{fmt(b.odds)}</span></div></>
                    )}
                    <div style={{display:"flex",gap:12,fontSize:11,color:"#6b7280",marginTop:6}}>
                      <span>Stake <strong>${b.stake.toFixed(2)}</strong></span>
                      <span>Payout <strong>${b.payout.toFixed(2)}</strong></span>
                      <span style={{marginLeft:"auto"}}>{b.placedAt?fmtDate(b.placedAt):""}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {adminTab==="danger"&&(
              <div style={S.card}>
                <div style={S.sHead}>DANGER ZONE</div>
                <p style={{color:"#9ca3af",fontSize:13,marginBottom:16}}>Resets all balances to ${START_BAL}, clears all bets, and restores default markets. PINs preserved.</p>
                <button style={{background:"rgba(239,68,68,0.1)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"12px 20px",fontFamily:"inherit",fontSize:13,cursor:"pointer",width:"100%",fontWeight:700}}
                  onClick={async()=>{
                    await saveMarkets({...INIT_MARKETS});await saveBets([]);
                    const r={};for(const u of Object.keys(users))r[u]={...users[u],balance:START_BAL};
                    await saveUsers(r);notify("Everything reset!");
                  }}>Reset Everything</button>
              </div>
            )}
          </div>
        </>
      )}
      {notif&&<Toast n={notif}/>}
    </div>
  );

  //  Lobby 
  const displayMkts = tab==="games"?markets.games:markets.futures;

  return(
    <div style={{minHeight:"100vh",background:"#0a0f1a",color:"#f9fafb",fontFamily:"'Inter',sans-serif",paddingBottom:160}}>
      {/* Header */}
      <div style={{background:"#0d1520",borderBottom:"1px solid #1f2937",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10,boxShadow:"0 2px 20px rgba(0,0,0,0.4)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>{I.ball}</span>
          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,letterSpacing:3,color:"#f9fafb"}}>MLN BETTING</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:20,padding:"5px 14px",display:"flex",alignItems:"baseline",gap:3}}>
            <span style={{fontSize:12,color:"#22c55e"}}>$</span>
            <span style={{fontSize:15,fontWeight:700,color:"#22c55e"}}>{bal.toFixed(2)}</span>
          </div>
          <button style={{background:"#3b82f6",color:"#f9fafb",border:"none",borderRadius:"50%",width:32,height:32,fontWeight:800,cursor:"pointer",fontFamily:"inherit",fontSize:13}}
            onClick={()=>{setSlip({});setScreen("login");}}>
            {username[0]?.toUpperCase()}
          </button>
        </div>
      </div>

      {/* Banner */}
      {headerMsg&&<div style={{background:"rgba(251,191,36,0.08)",borderBottom:"1px solid rgba(251,191,36,0.15)",padding:"9px 16px",fontSize:13,color:"#fbbf24",textAlign:"center",fontWeight:500}}>{headerMsg}</div>}

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1px solid #1f2937",background:"#0d1520",position:"sticky",top:57,zIndex:9,overflowX:"auto"}}>
        {[[`${I.stadium} Games`,"games"],[`${I.crystal} Futures`,"futures"],
          ...(lbVisible?[[`${I.medal} Standings`,"leaderboard"]]:[]),
          [`My Bets${myBets.length?` (${myBets.length})`:""}`, "mybets"]
        ].map(([label,key])=>(
          <button key={key} style={{flex:"1 0 auto",background:"transparent",border:"none",
            borderBottom:`2px solid ${tab===key?"#3b82f6":"transparent"}`,
            color:tab===key?"#3b82f6":"#6b7280",padding:"13px 12px",fontFamily:"inherit",
            fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}
            onClick={()=>setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{padding:"12px 12px 160px"}}>

        {/* ── GAMES TAB ── */}
        {tab==="games"&&(()=>{
          const groups=groupGames(displayMkts);
          if(!groups.length)return <div style={{textAlign:"center",padding:"60px 20px",color:"#6b7280"}}>No markets yet</div>;
          return groups.map(({ml,sp,ou})=>{
            const meta=leagueMeta(ml.subtitle);
            const allM=[ml,sp,ou].filter(Boolean);
            const anyPaused=allM.some(m=>m.status==="paused");
            const anyActive=allM.some(m=>m.status==="open"||m.status==="paused");
            const allSettled=allM.every(m=>m.status==="settled");
            const totalAction=allM.reduce((s,m)=>s+m.options.reduce((ss,o)=>ss+(optTotals[o.id]||0),0),0);
            const tA=ml.options[0]?.label||"";
            const tB=ml.options[1]?.label||"";
            const groupBase=getBase(ml.title);
            const slipFromGroup=slipLegs.filter(l=>{const m=allMkts.find(x=>x.id===l.mktId);return m&&getBase(m.title)===groupBase;});

            // Render one cell
            const cell=(opt,mkt,colType)=>{
              if(!opt)return <div key="e" style={{flex:1}}/>;
              const sel=!!slip[opt.id];
              const isElim=(mkt.eliminated||[]).includes(opt.id);
              const dis=mkt.status==="settled"||mkt.status==="paused"||isElim;
              const optAmt=optTotals[opt.id]||0;
              const colTotal=mkt.options.reduce((s,o)=>s+(optTotals[o.id]||0),0);
              const pct=colTotal>0?optAmt/colTotal:0;
              const conflict=slipMode==="parlay"&&slipFromGroup.length>0&&!slipFromGroup.some(l=>l.optionId===opt.id)&&!sel;
              const settledWin=mkt.status==="settled"&&mkt.winner===opt.id;
              return(
                <div key={opt.id} style={{flex:1}}>
                  <button disabled={dis} onClick={()=>!dis&&togglePick(mkt.id,opt.id)}
                    style={{width:"100%",background:sel?"rgba(34,197,94,0.1)":settledWin?"rgba(34,197,94,0.07)":"#111827",
                      border:`1.5px solid ${sel?"#22c55e":settledWin?"rgba(34,197,94,0.4)":"#1f2937"}`,
                      borderRadius:8,padding:"9px 6px",cursor:dis?"not-allowed":"pointer",
                      textAlign:"center",transition:"all 0.12s",
                      opacity:dis&&!settledWin?0.35:conflict?0.45:1}}>
                    {colType!=="ml"&&<div style={{fontSize:12,fontWeight:700,color:"#e5e7eb",marginBottom:2,lineHeight:1.2}}>{opt.label}</div>}
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:800,color:sel?"#22c55e":"#60a5fa",letterSpacing:0.5}}>{fmt(opt.odds)}</div>
                    {colTotal>0&&<div style={{fontSize:9,color:"#6b7280",marginTop:2}}>${optAmt.toFixed(0)} ({Math.round(pct*100)}%)</div>}
                  </button>
                  {colTotal>0&&<div style={{height:2,background:"#1f2937",borderRadius:1,marginTop:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct*100}%`,background:sel?"#22c55e":"#3b82f6",opacity:0.6}}/></div>}
                </div>
              );
            };

            // Selected opts from this group
            const groupSel=allM.flatMap(m=>m.options.filter(o=>!!slip[o.id]).map(o=>({o,m})));

            return(
              <div key={ml.id} style={{background:"#0d1520",border:"1px solid #1f2937",borderRadius:12,padding:"12px 14px",marginBottom:10}}>
                {/* Card top */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:1.5,color:meta.color,textTransform:"uppercase"}}>{meta.tag}</span>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    {totalAction>0&&<span style={{fontSize:10,color:"#4b5563"}}>${totalAction.toFixed(0)} action</span>}
                    {ml.maxBet&&<span style={{fontSize:10,color:"#fbbf24",background:"rgba(251,191,36,0.1)",borderRadius:4,padding:"1px 6px"}}>Max ${ml.maxBet}</span>}
                    {anyPaused&&!allSettled&&<span style={{fontSize:10,color:"#fbbf24",background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:4,padding:"1px 6px"}}>{I.pause} Paused</span>}
                    {allSettled&&<span style={{fontSize:10,color:"#22c55e",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:4,padding:"1px 6px"}}>Settled</span>}
                  </div>
                </div>

                {anyPaused&&!allSettled&&<div style={{fontSize:12,color:"#92400e",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.12)",borderRadius:6,padding:"7px 10px",marginBottom:10}}>Betting is paused. Your existing bets are safe.</div>}

                {/* Main layout: teams left, buttons right */}
                <div style={{display:"flex",gap:10,alignItems:"stretch"}}>
                  {/* Teams */}
                  <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"space-around",minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,paddingBottom:8}}>
                      {allSettled&&ml.winner===ml.options[0]?.id&&<div style={{width:5,height:5,borderRadius:"50%",background:"#22c55e",flexShrink:0}}/>}
                      <span style={{fontSize:14,fontWeight:allSettled&&ml.winner===ml.options[0]?.id?700:500,color:allSettled&&ml.winner===ml.options[0]?.id?"#f9fafb":"#9ca3af",lineHeight:1.3}}>{tA}</span>
                    </div>
                    <div style={{height:1,background:"#1f2937"}}/>
                    <div style={{display:"flex",alignItems:"center",gap:6,paddingTop:8}}>
                      {allSettled&&ml.winner===ml.options[1]?.id&&<div style={{width:5,height:5,borderRadius:"50%",background:"#22c55e",flexShrink:0}}/>}
                      <span style={{fontSize:14,fontWeight:allSettled&&ml.winner===ml.options[1]?.id?700:500,color:allSettled&&ml.winner===ml.options[1]?.id?"#f9fafb":"#9ca3af",lineHeight:1.3}}>{tB}</span>
                    </div>
                  </div>

                  {/* Bet columns */}
                  <div style={{display:"flex",flexDirection:"column",gap:0,flexShrink:0}}>
                    {/* Column headers */}
                    <div style={{display:"flex",gap:4,marginBottom:5}}>
                      {sp&&<div style={{flex:1,minWidth:70,fontSize:9,fontWeight:700,letterSpacing:1,color:"#6b7280",textAlign:"center",textTransform:"uppercase"}}>Spread</div>}
                      {ou&&<div style={{flex:1,minWidth:70,fontSize:9,fontWeight:700,letterSpacing:1,color:"#6b7280",textAlign:"center",textTransform:"uppercase"}}>O/U</div>}
                      <div style={{flex:1,minWidth:70,fontSize:9,fontWeight:700,letterSpacing:1,color:"#6b7280",textAlign:"center",textTransform:"uppercase"}}>Moneyline</div>
                    </div>
                    {/* Row A */}
                    <div style={{display:"flex",gap:4,marginBottom:4}}>
                      {sp&&cell(sp.options[0],sp,"spread")}
                      {ou&&cell(ou.options[0],ou,"ou")}
                      {cell(ml.options[0],ml,"ml")}
                    </div>
                    {/* Row B */}
                    <div style={{display:"flex",gap:4}}>
                      {sp&&cell(sp.options[1],sp,"spread")}
                      {ou&&cell(ou.options[1],ou,"ou")}
                      {cell(ml.options[1],ml,"ml")}
                    </div>
                  </div>
                </div>

                {/* Winner */}
                {allSettled&&<div style={{fontSize:13,color:"#22c55e",fontWeight:700,marginTop:8,paddingTop:8,borderTop:"1px solid #1f2937"}}>{I.trophy} {ml.options.find(o=>o.id===ml.winner)?.label} wins</div>}

                {/* Stake inputs */}
                {slipMode==="straight"&&groupSel.map(({o,m})=>{
                  const s=slip[o.id];const stake=parseFloat(s?.stake)||0;const win=stake>0?toWin(stake,o.odds):0;
                  const colLbl=m.id===ml.id?"ML":m.id===sp?.id?"Spread":"O/U";
                  return(
                    <div key={o.id} style={{background:"rgba(34,197,94,0.05)",border:"1.5px solid rgba(34,197,94,0.3)",borderRadius:8,padding:"10px 12px",marginTop:8,display:"flex",alignItems:"center",gap:10}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,color:"#6b7280",marginBottom:2}}>{colLbl}</div>
                        <div style={{fontSize:13,fontWeight:600}}>{o.label} <span style={{color:"#22c55e"}}>{fmt(o.odds)}</span></div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{display:"flex",alignItems:"center",background:"#111827",borderRadius:6,padding:"4px 10px"}}>
                          <span style={{color:"#22c55e",fontWeight:700,marginRight:2}}>$</span>
                          <input style={{background:"transparent",border:"none",color:"#f9fafb",fontFamily:"inherit",fontSize:15,width:80,outline:"none",fontWeight:700}}
                            type="number" placeholder="0" value={s?.stake||""} onChange={e=>setStake(o.id,e.target.value)} min="1"/>
                        </div>
                        {win>0&&<span style={{fontSize:12,color:"#22c55e",whiteSpace:"nowrap"}}>win ${win.toFixed(2)}</span>}
                      </div>
                    </div>
                  );
                })}

                {/* Conflict warning */}
                {slipMode==="parlay"&&sameGameConflict&&slipFromGroup.length>1&&(
                  <div style={{fontSize:11,color:"#f59e0b",padding:"6px 10px",background:"rgba(245,158,11,0.08)",borderRadius:6,marginTop:8}}>
                    Cannot parlay moneyline + spread from the same game
                  </div>
                )}
              </div>
            );
          });
        })()}

        {/* ── FUTURES TAB ── */}
        {tab==="futures"&&(()=>{
          if(!displayMkts.length)return <div style={{textAlign:"center",padding:"60px 20px",color:"#6b7280"}}>No futures yet</div>;
          return displayMkts.map(m=>{
            const meta=leagueMeta(m.subtitle);
            const mTotal=m.options.reduce((s,o)=>s+(optTotals[o.id]||0),0);
            return(
              <div key={m.id} style={{background:"#0d1520",border:"1px solid #1f2937",borderRadius:12,padding:"14px 16px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:9,fontWeight:700,letterSpacing:1.5,color:meta.color,textTransform:"uppercase"}}>{meta.tag}</span>
                  <div style={{display:"flex",gap:6}}>{statusBadge(m.status)}</div>
                </div>
                <div style={{fontSize:16,fontWeight:700,marginBottom:3,color:"#f9fafb"}}>{m.title}</div>
                <div style={{fontSize:11,color:"#6b7280",marginBottom:12}}>{m.subtitle}</div>
                {m.status==="paused"&&<div style={{fontSize:12,color:"#92400e",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.12)",borderRadius:6,padding:"7px 10px",marginBottom:10}}>Betting is paused. Your existing bets are safe.</div>}
                {m.status==="settled"&&<div style={{fontSize:14,color:"#22c55e",fontWeight:700,marginBottom:12,background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.15)",borderRadius:8,padding:"8px 12px"}}>{I.trophy} {m.options.find(o=>o.id===m.winner)?.label}</div>}
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {m.options.map(opt=>{
                    const sel=!!slip[opt.id];const isElim=(m.eliminated||[]).includes(opt.id);
                    const dis=m.status==="settled"||m.status==="paused"||isElim;
                    const optAmt=optTotals[opt.id]||0;const pct=mTotal>0?optAmt/mTotal:0;
                    return(
                      <div key={opt.id}>
                        <button disabled={dis} onClick={()=>!dis&&togglePick(m.id,opt.id)}
                          style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                            background:sel?"rgba(34,197,94,0.08)":"#111827",border:`1.5px solid ${sel?"#22c55e":"#1f2937"}`,
                            borderRadius:9,padding:"11px 14px",cursor:dis?"not-allowed":"pointer",
                            width:"100%",opacity:dis?0.35:1,transition:"all 0.12s"}}>
                          <span style={{fontSize:13,fontWeight:500,color:"#e5e7eb",textAlign:"left"}}>
                            {opt.label}
                            {isElim&&<span style={{fontSize:11,color:"#ef4444",marginLeft:8,fontWeight:600}}>OUT</span>}
                          </span>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,color:sel?"#22c55e":"#60a5fa"}}>{fmt(opt.odds)}</span>
                            {mTotal>0&&<span style={{fontSize:9,color:"#6b7280"}}>${optAmt.toFixed(0)} - {Math.round(pct*100)}%</span>}
                          </div>
                        </button>
                        {mTotal>0&&<div style={{height:2,background:"#1f2937",borderRadius:1,marginTop:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct*100}%`,background:sel?"#22c55e":meta.color,opacity:0.6}}/></div>}
                        {slipMode==="straight"&&slip[opt.id]&&(()=>{
                          const s=slip[opt.id];const stake=parseFloat(s.stake)||0;const win=stake>0?toWin(stake,opt.odds):0;
                          return(
                            <div style={{background:"rgba(34,197,94,0.05)",border:"1.5px solid rgba(34,197,94,0.3)",borderRadius:8,padding:"10px 12px",marginTop:6,display:"flex",alignItems:"center",gap:10}}>
                              <span style={{fontSize:12,color:"#22c55e",flex:1,fontWeight:600}}>{opt.label}</span>
                              <div style={{display:"flex",alignItems:"center",background:"#111827",borderRadius:6,padding:"4px 10px"}}>
                                <span style={{color:"#22c55e",fontWeight:700,marginRight:2}}>$</span>
                                <input style={{background:"transparent",border:"none",color:"#f9fafb",fontFamily:"inherit",fontSize:15,width:80,outline:"none",fontWeight:700}}
                                  type="number" placeholder="0" value={s.stake} onChange={e=>setStake(opt.id,e.target.value)} min="1"/>
                              </div>
                              {win>0&&<span style={{fontSize:12,color:"#22c55e",whiteSpace:"nowrap"}}>win ${win.toFixed(2)}</span>}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}

        {/* ── STANDINGS TAB ── */}
        {tab==="leaderboard"&&(
          <>
            <div style={{background:"#0d1520",border:"1px solid #1f2937",borderRadius:12,padding:"14px 16px",marginBottom:10}}>
              <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Standings</div>
              <div style={{fontSize:11,color:"#6b7280",marginBottom:14}}>Starting balance ${START_BAL.toLocaleString()}</div>
              {lbActive.length===0&&<div style={{color:"#6b7280",fontSize:13}}>No bets placed yet</div>}
              {lbActive.map(({name,u,pending,total,rank},i)=>{
                const diff=total-START_BAL;
                const isTied=lbActive.filter(p=>p.rank===rank).length>1;
                return(
                  <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<lbActive.length-1?"1px solid #1f2937":"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:16,fontWeight:700,color:"#f9fafb",width:34}}>{isTied?`T${rank}`:`#${rank}`}</span>
                      <span style={{fontSize:14,fontWeight:600,color:name===username?"#60a5fa":"#f9fafb"}}>{name}{name===username?" - you":""}</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                      <span style={{fontSize:16,fontWeight:700,color:"#22c55e"}}>${total.toFixed(2)}</span>
                      <div style={{display:"flex",gap:8}}>
                        <span style={{fontSize:10,color:"#4ade80"}}>${u.balance.toFixed(0)} cash</span>
                        {pending>0&&<span style={{fontSize:10,color:"#fbbf24"}}>${pending.toFixed(0)} in Open Bets</span>}
                      </div>
                      <span style={{fontSize:11,color:diff>=0?"#4ade80":"#f87171"}}>{diff>=0?"Up":"Down"} ${Math.abs(diff).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {lbInactive.length>0&&(
              <div style={{background:"#0d1520",border:"1px solid #1f2937",borderRadius:12,padding:"14px 16px",opacity:0.6}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:2,color:"#6b7280",textTransform:"uppercase",marginBottom:10}}>PLAYERS WHO HAVE NOT MADE BETS</div>
                {lbInactive.map(({name,u},i)=>(
                  <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<lbInactive.length-1?"1px solid #1f2937":"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:14,color:"#6b7280",width:34}}>-</span>
                      <span style={{fontSize:14,color:name===username?"#60a5fa":"#6b7280"}}>{name}</span>
                    </div>
                    <span style={{fontSize:14,fontWeight:700,color:"#6b7280"}}>${u.balance.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── MY BETS TAB ── */}
        {tab==="mybets"&&(
          <>
            {myBets.length===0&&<div style={{textAlign:"center",padding:"60px 20px",color:"#6b7280"}}>No bets yet</div>}
            {[...myBets].reverse().map(b=>(
              <div key={b.id} style={{background:b.status==="won"?"rgba(34,197,94,0.05)":b.status==="lost"?"rgba(239,68,68,0.03)":"#0d1520",border:`1px solid ${b.status==="won"?"rgba(34,197,94,0.2)":b.status==="lost"?"rgba(239,68,68,0.15)":"#1f2937"}`,borderRadius:12,padding:14,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                  <span style={{fontSize:11,color:"#6b7280"}}>{b.betType==="parlay"?<span style={{color:"#60a5fa",fontWeight:600}}>PARLAY - {fmt(b.combinedOdds)}</span>:b.marketTitle}</span>
                  <span style={{fontSize:11,fontWeight:700,color:b.status==="won"?"#22c55e":b.status==="lost"?"#ef4444":b.status==="voided"?"#9ca3af":"#fbbf24"}}>
                    {b.status==="won"?`${I.check} WON`:b.status==="lost"?`${I.cross} LOST`:b.status==="voided"?`${I.undo} VOID`:`${I.pending} PENDING`}
                  </span>
                </div>
                {b.betType==="parlay"?b.legs.map((l,i)=>(
                  <div key={i} style={{fontSize:12,color:"#9ca3af",marginBottom:3,paddingLeft:4}}>
                    <span style={{color:"#fbbf24",marginRight:6}}>{fmt(l.odds)}</span>{l.optionLabel}
                    <span style={{marginLeft:6,fontSize:10,color:l.status==="won"?"#22c55e":l.status==="lost"?"#ef4444":"#6b7280"}}>{l.status==="won"?I.check:l.status==="lost"?I.cross:""}</span>
                  </div>
                )):<div style={{fontSize:15,fontWeight:700,marginBottom:7}}>{b.optionLabel} <span style={{color:"#fbbf24"}}>{fmt(b.odds)}</span></div>}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#6b7280",marginTop:8}}>
                  <span>Stake <strong>${b.stake.toFixed(2)}</strong></span>
                  <span>Payout <strong>${b.payout.toFixed(2)}</strong></span>
                </div>
                {b.placedAt&&<div style={{fontSize:10,color:"#374151",marginTop:5}}>{fmtDate(b.placedAt)}</div>}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── BET SLIP FOOTER ── */}
      {slipEntries.length>0&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0d1520",borderTop:"1px solid #1f2937",padding:"12px 14px",zIndex:20,boxShadow:"0 -8px 40px rgba(0,0,0,0.6)"}}>
          {parlayOk&&(
            <div style={{display:"flex",gap:6,marginBottom:10}}>
              <button style={{flex:1,background:slipMode==="straight"?"rgba(34,197,94,0.1)":"#111827",border:`1.5px solid ${slipMode==="straight"?"#22c55e":"#1f2937"}`,color:slipMode==="straight"?"#22c55e":"#6b7280",borderRadius:8,padding:"8px 12px",fontFamily:"inherit",fontSize:12,cursor:"pointer",fontWeight:600}}
                onClick={()=>setSlipMode("straight")}>Straight</button>
              <button style={{flex:1,background:slipMode==="parlay"?"rgba(34,197,94,0.1)":"#111827",border:`1.5px solid ${slipMode==="parlay"?"#22c55e":"#1f2937"}`,color:slipMode==="parlay"?"#22c55e":"#6b7280",borderRadius:8,padding:"8px 12px",fontFamily:"inherit",fontSize:12,cursor:"pointer",fontWeight:600}}
                onClick={()=>setSlipMode("parlay")}>Parlay {parlayOdds!=null?fmt(parlayOdds):""}</button>
            </div>
          )}
          {slipMode==="parlay"&&parlayOk&&(
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:"#9ca3af",letterSpacing:1,marginBottom:6}}>{slipEntries.length}-LEG PARLAY - {fmt(parlayOdds)}</div>
              {slipLegs.map((l,i)=><div key={i} style={{fontSize:11,color:"#9ca3af",marginBottom:3}}><span style={{color:"#fbbf24",marginRight:6}}>{fmt(l.odds)}</span>{l.optLabel}</div>)}
              <div style={{background:"rgba(34,197,94,0.05)",border:"1.5px solid rgba(34,197,94,0.3)",borderRadius:8,padding:"10px 12px",marginTop:8,display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:11,color:"#22c55e",fontWeight:600}}>PARLAY STAKE</span>
                <div style={{display:"flex",alignItems:"center",background:"#111827",borderRadius:6,padding:"4px 10px"}}>
                  <span style={{color:"#22c55e",fontWeight:700,marginRight:2}}>$</span>
                  <input style={{background:"transparent",border:"none",color:"#f9fafb",fontFamily:"inherit",fontSize:15,width:80,outline:"none",fontWeight:700}}
                    type="number" placeholder="0" value={parlayStake} onChange={e=>setParlayStake(e.target.value)} min="1"/>
                </div>
                {parlayPay>0&&<span style={{fontSize:12,color:"#22c55e",whiteSpace:"nowrap"}}>win ${parlayPay.toFixed(2)}</span>}
              </div>
            </div>
          )}
          {slipMode==="straight"&&(
            <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:9,padding:"9px 12px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:"#6b7280"}}>Total stake</span><span style={{fontSize:13,fontWeight:700}}>${straightTotal.toFixed(2)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:"#6b7280"}}>Potential payout</span><span style={{fontSize:13,fontWeight:700,color:"#22c55e"}}>${straightPay.toFixed(2)}</span></div>
            </div>
          )}
          <button style={{width:"100%",background:"#3b82f6",color:"#f9fafb",border:"none",borderRadius:10,padding:"14px",fontFamily:"inherit",fontWeight:800,fontSize:14,cursor:"pointer"}}
            onClick={placeBets}>
            {slipMode==="parlay"?"Place Parlay":"Place "+slipEntries.length+" Bet"+(slipEntries.length>1?"s":"")}
          </button>
        </div>
      )}
      {notif&&<Toast n={notif}/>}
    </div>
  );
}

//  Shared styles 
const S = {
  inp: { background:"#1f2937",border:"1px solid #374151",borderRadius:8,padding:"11px 14px",color:"#f9fafb",fontFamily:"'Inter',sans-serif",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box" },
  lbl: { display:"block",fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:1,marginBottom:6,textTransform:"uppercase" },
  btnPrimary: { background:"#3b82f6",color:"#f9fafb",border:"none",borderRadius:9,padding:"12px 20px",fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer" },
  btnGhost: { background:"transparent",color:"#6b7280",border:"1px solid #374151",borderRadius:9,padding:"11px 20px",fontFamily:"'Inter',sans-serif",fontSize:12,cursor:"pointer" },
  adminTab: { background:"#111827",border:"1px solid #374151",color:"#9ca3af",borderRadius:7,padding:"8px 13px",fontFamily:"'Inter',sans-serif",fontSize:12,cursor:"pointer",fontWeight:600 },
  card: { background:"#111827",border:"1px solid #1f2937",borderRadius:13,padding:18 },
  sHead: { fontSize:10,fontWeight:700,letterSpacing:2,color:"#6b7280",textTransform:"uppercase",marginBottom:12 },
  settleBtn: { background:"rgba(34,197,94,0.07)",border:"1px solid rgba(34,197,94,0.2)",color:"#22c55e",borderRadius:7,padding:"8px 13px",fontFamily:"'Inter',sans-serif",fontSize:12,cursor:"pointer",fontWeight:600 },
  btnWarn: { background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",color:"#fbbf24",borderRadius:7,padding:"9px 13px",fontFamily:"'Inter',sans-serif",fontSize:13,cursor:"pointer",fontWeight:600 },
  btnWarnSm: { background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",color:"#fbbf24",borderRadius:7,padding:"7px 11px",fontFamily:"'Inter',sans-serif",fontSize:11,cursor:"pointer",fontWeight:600 },
  btnDangerSm: { background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#f87171",borderRadius:7,padding:"7px 11px",fontFamily:"'Inter',sans-serif",fontSize:11,cursor:"pointer",fontWeight:600 },
  adjBtn: { background:"#1f2937",border:"1px solid #374151",color:"#9ca3af",borderRadius:6,padding:"4px 9px",fontFamily:"'Inter',sans-serif",fontSize:11,cursor:"pointer" },
};
const B = {
  settledBadge: { fontSize:9,background:"rgba(34,197,94,0.1)",color:"#22c55e",borderRadius:4,padding:"2px 7px",border:"1px solid rgba(34,197,94,0.2)",fontWeight:700 },
  pauseBadge: { fontSize:9,background:"rgba(251,191,36,0.08)",color:"#fbbf24",borderRadius:4,padding:"2px 7px",border:"1px solid rgba(251,191,36,0.2)",fontWeight:700 },
};
