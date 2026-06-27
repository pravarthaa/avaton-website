import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const C = {
  navy: "#05080F", navyMid: "#0B0F1C", navyCard: "#0F1525", navyCardHov: "#131929",
  border: "rgba(255,255,255,0.07)", borderHov: "rgba(77,140,255,0.35)",
  blue: "#4D8CFF", blueBright: "#6BA3FF", blueDark: "#2860CC", blueGlow: "rgba(77,140,255,0.22)",
  white: "#FFFFFF", whiteOff: "#E8ECF5", text: "#EEF0F8", muted: "#7B849A", dim: "#3A4155",
  ice: "#B8C8F0", red: "#FF5C6E", amber: "#FFBA3D", slate: "#5A6480", teal: "#38D9C0",
  purple: "#A78BFA", orange: "#FF8C42",
};

const STATUS = {
  available: { label: "Available", color: C.white, glow: "rgba(255,255,255,0.18)" },
  occupied:  { label: "Occupied",  color: C.red,   glow: "rgba(255,92,110,0.3)" },
  soon:      { label: "Starting Soon", color: C.amber, glow: "rgba(255,186,61,0.3)" },
};

const ROOM_DEFS = [
  { code:"A101", block:"A", floor:1, capacity:45 },
  { code:"B202", block:"A", floor:1, capacity:50 },
  { code:"C303", block:"A", floor:1, capacity:40 },
  { code:"D404", block:"A", floor:1, capacity:60 },
];

const SUBJECTS = ["Design Thinking","Mathematics","Chemistry","Kannada","Python","Engineering Graphics","Applied Mechanics","Engineering mechanics"];
const FACULTY = ["Adarsh Krishnamurthy","Rashmi","Bhargav","Mahitha","Subburamu","Manikanda","Ashwini","V.S Nayak","Venu","Abhilash","Ananth","Sagar","Kanaka","Pramod","Nidhi","Chandrashekar","Srikrishna","Praveen","Maya","Murugesh","Narasimhah","vishnuvardhana","Sreenivas","Manish","Preetham","Anita","Manish"];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const ACCOUNTS = [
  { id:"pravartha", name:"Pravartha", department:"Aerospace", email:"hod@avaton.edu",                  password:"pravartha5", role:"admin"   },
  { id:"adarsh",    name:"Adarsh Krishnamurthy", department:"Aerospace", email:"adarshkrishnamurthy@gmail.com", password:"12345", role:"faculty" },
  { id:"rashmi",    name:"Rashmi",    department:"Chemistry", email:"rashmi@gmail.com",                 password:"12345",      role:"faculty" },
  { id:"Harshith",  name:"Harshith", department:"Aerospace", email:"Harshith@gmail.com",               password:"12345",      role:"student" },
];

function uid() { return Math.random().toString(36).slice(2,10); }
function timeToMin(t) { if(!t)return null; const[h,m]=t.split(":").map(Number); return isNaN(h)||isNaN(m)?null:h*60+m; }
function fmtMin(m) { if(m==null)return""; if(m<60)return`${m}m`; return`${Math.floor(m/60)}h ${m%60?m%60+"m":""}`.trim(); }
function fmtClock(ms) { const d=new Date(ms); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
function todayAt(baseDate, hhmm) { const [h,m]=hhmm.split(":").map(Number); const d=new Date(baseDate); d.setHours(h,m,0,0); return d.getTime(); }
function getScanAction(room) {
  if (room.isAwaitingCheckIn) return "checkin-scheduled";
  if (room.status === "available") return "checkin-adhoc";
  return "checkout";
}

function buildTimetables() {
  const slots=[["08:30","10:10"],["10:40","11:30"],["11:30","12:20"],["14:00","14:50"],["14:50","15:40"],["16:00","16:50"],["16:50","17:40"]];
  const tt={};
  ROOM_DEFS.forEach((room,ri)=>{
    const entries=[];
    DAYS.forEach((day,di)=>{
      const count=2+(ri%3);
      for(let p=0;p<count;p++){
        const slot=slots[(ri+p+di)%slots.length];
        entries.push({id:uid(),day,start:slot[0],end:slot[1],subject:SUBJECTS[(ri*2+p+di)%SUBJECTS.length],faculty:FACULTY[(ri+di)%FACULTY.length]});
      }
    });
    tt[room.code]=entries;
  });
  return tt;
}

function computeRooms(timetables,now,overrides={},scannedRooms={}) {
  const jsDay=now.getDay();
  const dayName=jsDay===0?"Monday":DAYS[jsDay-1];
  const nm=now.getHours()*60+now.getMinutes();
  const nowMs=now.getTime();
  const isWeekend=jsDay===0;
  return ROOM_DEFS.map((room)=>{
    const ov=overrides[room.code];
    const entries=(timetables[room.code]||[]).filter(e=>e.day===dayName).sort((a,b)=>timeToMin(a.start)-timeToMin(b.start));
    const todaySchedule=entries.map(e=>({subject:e.subject,faculty:e.faculty,startTime:e.start,endTime:e.end}));
    const active=entries.find(e=>{const s=timeToMin(e.start),en=timeToMin(e.end);return s!=null&&en!=null&&s<=nm&&nm<en;});
    const justEnded=!active&&entries.find(e=>{const s=timeToMin(e.start),en=timeToMin(e.end);const scanKey=`${room.code}_${e.start}`;return s!=null&&en!=null&&nm>=en&&nm<en+60&&scannedRooms[scanKey]===true&&scannedRooms[`${room.code}_${e.start}_out`]!==true;});
    const next=entries.filter(e=>timeToMin(e.start)>nm).sort((a,b)=>timeToMin(a.start)-timeToMin(b.start))[0];
    if(ov&&ov.kind==="occupied"&&nowMs<ov.endMs){
      const ttSlot=active||next;
      const subject=ttSlot?ttSlot.subject:ov.subject;
      const faculty=ov.faculty;
      const endMs=ttSlot?todayAt(new Date(nowMs),ttSlot.end):ov.endMs;
      const endsInMin=Math.max(0,Math.round((endMs-nowMs)/60000));
      const startTime=ttSlot?ttSlot.start:fmtClock(ov.startMs);
      const endTime=ttSlot?ttSlot.end:fmtClock(ov.endMs);
      return {...room,status:"occupied",subject,faculty,startTime,endTime,endsInMin,isWalkIn:true,todaySchedule};
    }
    if(ov&&ov.kind==="available"&&(!ov.expiresAt||nowMs<ov.expiresAt)){
      return {...room,status:"available",todaySchedule};
    }
    if(!isWeekend&&active){
      const en=timeToMin(active.end);
      const startsInMin=next?timeToMin(next.start)-nm:null;
      const targetScanKey=`${room.code}_${active.start}`;
      const hasFacultyScannedIn=scannedRooms[targetScanKey]===true;
      if(!hasFacultyScannedIn) return {...room,status:"soon",subject:active.subject,faculty:active.faculty,startTime:active.start,endTime:active.end,startsInMin:0,isAwaitingCheckIn:true,todaySchedule};
      return {...room,status:"occupied",subject:active.subject,faculty:active.faculty,startTime:active.start,endTime:active.end,endsInMin:en-nm,startsInMin,todaySchedule};
    }
    if(!isWeekend&&justEnded){
      return {...room,status:"occupied",subject:justEnded.subject,faculty:justEnded.faculty,startTime:justEnded.start,endTime:justEnded.end,endsInMin:0,isEndingHeld:true,todaySchedule};
    }
    if(!isWeekend&&next){
      const sIn=timeToMin(next.start)-nm;
      if(sIn<=20){
        const upcomingScanKey=`${room.code}_${next.start}`;
        const hasFacultyScannedIn=scannedRooms[upcomingScanKey]===true;
        if(!hasFacultyScannedIn) return {...room,status:"soon",subject:next.subject,faculty:next.faculty,startTime:next.start,endTime:next.end,startsInMin:sIn,isAwaitingCheckIn:true,todaySchedule};
        return {...room,status:"soon",subject:next.subject,faculty:next.faculty,startTime:next.start,endTime:next.end,startsInMin:sIn,todaySchedule};
      }
      return {...room,status:"available",nextClass:{subject:next.subject,faculty:next.faculty,startTime:next.start,endTime:next.end,startsInMin:sIn},todaySchedule};
    }
    return {...room,status:"available",todaySchedule};
  });
}

/* ── Login Page ── */
function LoginPage({ role, onLogin, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const roleConfig = {
    admin:   { label: "Admin",   color: C.amber,  icon: "A", hint: "hod@avaton.edu / pravartha5" },
    faculty: { label: "Faculty", color: C.blue,   icon: "F", hint: "adarshkrishnamurthy@gmail.com / 12345" },
    student: { label: "Student", color: C.purple, icon: "S", hint: "Harshith@gmail.com / 12345" },
  };
  const rc = roleConfig[role];

  const handleSubmit = () => {
    const acc = ACCOUNTS.find(a => a.email === email.trim() && a.password === password && a.role === role);
    if (acc) { setError(""); onLogin(acc); }
    else setError("Invalid credentials. Please try again.");
  };

  const inp = { background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`, color:C.text, borderRadius:10, padding:"12px 14px", fontSize:14, fontFamily:"inherit", width:"100%", outline:"none", boxSizing:"border-box" };

  return (
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:C.navy}}>
      <Bg/>
      <Grid/>
      <div style={{position:"relative",zIndex:1,background:"rgba(10,14,26,0.97)",border:`1px solid ${rc.color}30`,borderRadius:28,padding:"36px 32px",maxWidth:420,width:"100%",boxShadow:`0 0 80px ${rc.color}18,0 30px 60px rgba(0,0,0,0.6)`}}>
        <div style={{position:"absolute",top:-60,right:-60,width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle,${rc.color}15 0%,transparent 70%)`,pointerEvents:"none"}}/>
        
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,fontFamily:"inherit",padding:0,marginBottom:24,display:"flex",alignItems:"center",gap:6}}>
          ← Back
        </button>

        <div style={{textAlign:"center",marginBottom:30}}>
          <div style={{width:60,height:60,borderRadius:18,background:`${rc.color}18`,border:`1px solid ${rc.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>{rc.icon}</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:rc.color,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>AVATON</div>
          <h2 style={{fontSize:24,fontWeight:800,color:C.text,margin:"0 0 6px",letterSpacing:"-0.02em"}}>{rc.label} Sign In</h2>
          <p style={{fontSize:12.5,color:C.muted,margin:0}}>Welcome back to AVATON Campus</p>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Email</div>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email" style={inp} onFocus={e=>e.target.style.borderColor=rc.color} onBlur={e=>e.target.style.borderColor=C.border}/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Password</div>
            <div style={{position:"relative"}}>
              <input value={password} onChange={e=>setPassword(e.target.value)} type={showPass?"text":"password"} placeholder="Enter your password" style={{...inp,paddingRight:44}} onFocus={e=>e.target.style.borderColor=rc.color} onBlur={e=>e.target.style.borderColor=C.border} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
              <button onClick={()=>setShowPass(!showPass)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit",letterSpacing:"0.03em"}}>{showPass?"HIDE":"SHOW"}</button>
            </div>
          </div>

          {error && <div style={{fontSize:12.5,color:C.red,background:"rgba(255,92,110,0.08)",border:"1px solid rgba(255,92,110,0.2)",borderRadius:9,padding:"9px 13px"}}>{error}</div>}

          <button onClick={handleSubmit} style={{background:`linear-gradient(135deg,${rc.color},${rc.color}cc)`,border:"none",color:"#fff",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:4,boxShadow:`0 4px 20px ${rc.color}30`}}>
            Sign In as {rc.label}
          </button>
        </div>

        <div style={{marginTop:22,padding:"12px 14px",background:"rgba(255,255,255,0.02)",border:`1px solid ${C.border}`,borderRadius:10}}>
          <div style={{fontSize:10.5,color:C.dim,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Demo credentials</div>
          <div style={{fontSize:12,color:C.muted,fontFamily:"'JetBrains Mono',monospace"}}>{rc.hint}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Landing / Welcome Page ── */
function LandingPage({ onSelectRole }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const features = [
    { icon: "⚡", label: "Live Room Status", desc: "See every classroom — occupied, free, or starting soon — updated in real time." },
    { icon: "📍", label: "Campus Explorer", desc: "Navigate block by block and find an open room before you even leave your seat." },
    { icon: "🗓", label: "Timetable Control", desc: "Faculty and admins can manage scheduled classes directly from the dashboard." },
    { icon: "📷", label: "QR Check-in", desc: "Scan a room QR to mark it occupied or release it instantly." },
  ];

  return (
    <div style={{ background: C.navy, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif", overflowX: "hidden" }}>
      <Bg /><Grid />

      {/* Top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 32px", height: 58, display: "flex", alignItems: "center", background: "rgba(5,8,15,0.75)", backdropFilter: "blur(22px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg,${C.blue},${C.blueDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>A</div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>AVATON</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: C.blue, background: "rgba(77,140,255,0.12)", border: "1px solid rgba(77,140,255,0.25)", padding: "2px 7px", borderRadius: 999, marginLeft: 2 }}>LIVE</span>
        </div>
      </div>

      {/* Hero */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 28px 60px", position: "relative", zIndex: 10, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, color: C.blue, background: "rgba(77,140,255,0.09)", border: "1px solid rgba(77,140,255,0.22)", padding: "6px 14px", borderRadius: 999, marginBottom: 32, letterSpacing: "0.04em" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.blue, display: "inline-block", animation: "pulse 2s ease infinite" }} />
          LIVE · {timeStr}
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}} @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}} @keyframes shimmer{0%{background-position:0% center}100%{background-position:200% center}} @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <h1 style={{ fontSize: "clamp(44px,8.5vw,92px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.93, margin: "0 0 22px", animation: "fadeUp 0.7s ease both" }}>
          Know every<br />
          <span style={{ background: `linear-gradient(120deg,${C.white} 0%,${C.blueBright} 40%,${C.ice} 100%)`, backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 5s linear infinite" }}>classroom.</span>
        </h1>
        <p style={{ fontSize: 17, color: C.muted, maxWidth: 520, margin: "0 auto 48px", lineHeight: 1.7, animation: "fadeUp 0.7s 0.1s ease both" }}>
          AVATON tracks every room across campus — occupied, free, or moments from changing. Know before you walk.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", animation: "fadeUp 0.7s 0.2s ease both" }}>
          <button onClick={() => onSelectRole("select")} style={{ background: `linear-gradient(135deg,${C.blue},${C.blueDark})`, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, padding: "14px 32px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 8px 28px ${C.blueGlow}`, letterSpacing: "-0.01em" }}>
            Get Started →
          </button>
        </div>
        <div style={{ marginTop: 60, animation: "bob 1.8s ease infinite", color: C.dim, fontSize: 22 }}>↓</div>
      </section>


    </div>
  );
}

/* ── Role Selector (Landing Login) ── */
function RoleSelector({ onSelect }) {
  const roles = [
    { key:"admin",   label:"Admin",   sub:"Full system access",    color:C.amber,  icon:"A" },
    { key:"faculty", label:"Faculty", sub:"Manage your classes",   color:C.blue,   icon:"F" },
    { key:"student", label:"Student", sub:"View room availability",color:C.purple, icon:"S" },
  ];
  return (
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:C.navy}}>
      <Bg/>
      <Grid/>
      <div style={{position:"relative",zIndex:1,maxWidth:480,width:"100%",textAlign:"center"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:32}}>
          <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${C.blue},${C.blueDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff"}}>A</div>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:800,color:C.text,letterSpacing:"-0.01em"}}>AVATON</span>
        </div>
        <h2 style={{fontSize:28,fontWeight:800,color:C.text,margin:"0 0 8px",letterSpacing:"-0.02em"}}>Welcome back</h2>
        <p style={{fontSize:14,color:C.muted,margin:"0 0 32px",lineHeight:1.6}}>Select your role to continue</p>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {roles.map(r=>(
            <button key={r.key} onClick={()=>onSelect(r.key)}
              style={{display:"flex",alignItems:"center",gap:16,background:"rgba(10,14,26,0.9)",border:`1px solid ${r.color}25`,borderRadius:16,padding:"18px 22px",cursor:"pointer",textAlign:"left",transition:"all 0.2s",width:"100%"}}
              onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${r.color}55`;e.currentTarget.style.background=`${r.color}08`;e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${r.color}25`;e.currentTarget.style.background="rgba(10,14,26,0.9)";e.currentTarget.style.transform="none";}}>
              <div style={{width:48,height:48,borderRadius:14,background:`${r.color}15`,border:`1px solid ${r.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{r.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:700,color:r.color,marginBottom:2}}>{r.label}</div>
                <div style={{fontSize:12.5,color:C.muted}}>{r.sub}</div>
              </div>
              <div style={{color:C.dim,fontSize:18}}>→</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Camera Scanner ── */
function CameraScanner({ room, onClose, onScanSuccess, currentUser }) {
  const videoRef=useRef(null), streamRef=useRef(null);
  const [error,setError]=useState(""), [scanning,setScanning]=useState(false), [accessDenied,setAccessDenied]=useState(false);
  const hasPermission=currentUser&&(currentUser.role==="faculty"||currentUser.role==="admin");
  const action=getScanAction(room);
  const actionCopy=action==="checkout"?"This will free up the room.":"This will check the room in as occupied.";
  useEffect(()=>{
    async function startCamera(){
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
        streamRef.current=stream;
        if(videoRef.current) videoRef.current.srcObject=stream;
      }catch(err){setError("Camera access simulated or denied permissions.");}
    }
    startCamera();
    return()=>{if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());};
  },[]);
  const handleSimulatedScan=()=>{
    setScanning(true); setAccessDenied(false);
    setTimeout(()=>{
      if(hasPermission){onScanSuccess(room);onClose();}
      else{setScanning(false);setAccessDenied(true);}
    },1500);
  };
  return(
    <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{position:"absolute",inset:0,background:"rgba(3,5,12,0.92)",backdropFilter:"blur(12px)"}} onClick={onClose}/>
      <div style={{position:"relative",zIndex:1,background:C.navyCard,border:`1px solid ${C.border}`,borderRadius:24,padding:28,maxWidth:420,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:4}}>Scan Room {room.code}</div>
        <div style={{fontSize:12.5,color:C.muted,marginBottom:6}}>{currentUser?`${currentUser.name} · ${currentUser.role}`:"Not signed in"}</div>
        <div style={{fontSize:11.5,color:C.blueBright,marginBottom:16}}>{actionCopy}</div>
        <div style={{position:"relative",width:"100%",paddingBottom:"75%",background:"#000",borderRadius:14,overflow:"hidden",marginBottom:16}}>
          {error&&!videoRef.current?<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",padding:20,color:C.red,fontSize:13}}>{error}</div>:(
            <>
              <video ref={videoRef} autoPlay playsInline style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",objectFit:"cover"}}/>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"58%",height:"58%",border:`2px solid ${accessDenied?C.red:scanning?C.blue:C.ice}`,boxShadow:"0 0 0 400px rgba(0,0,0,0.5)",borderRadius:10,pointerEvents:"none"}}>
                <div style={{position:"absolute",top:0,left:0,width:"100%",height:2,background:accessDenied?C.red:C.blue,animation:"scanLine 2s linear infinite"}}/>
              </div>
              {scanning&&<div style={{position:"absolute",inset:0,background:"rgba(77,140,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:C.white}}>Validating…</div>}
              {accessDenied&&<div style={{position:"absolute",inset:0,background:"rgba(255,92,110,0.9)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,color:"#fff"}}>
                <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>Access Denied</div>
                <div style={{fontSize:12,opacity:0.9,maxWidth:260}}>Students cannot activate room sessions.</div>
              </div>}
            </>
          )}
        </div>
        <style>{`@keyframes scanLine{0%{top:0%}50%{top:100%}100%{top:0%}}`}</style>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button onClick={handleSimulatedScan} disabled={scanning} style={{background:hasPermission?C.blue:C.slate,border:"none",color:C.white,borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            {scanning?"Verifying…":"Simulate QR Scan"}
          </button>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,color:C.text,borderRadius:10,padding:"10px 20px",fontSize:13,cursor:"pointer"}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Bg() {
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current; if(!c)return;
    const ctx=c.getContext("2d");
    let w,h,t=0,raf;
    const resize=()=>{w=c.width=window.innerWidth;h=c.height=Math.max(window.innerHeight,900);};
    resize(); window.addEventListener("resize",resize);
    const tick=()=>{
      t+=0.002; ctx.clearRect(0,0,w,h);
      ctx.fillStyle=C.navy; ctx.fillRect(0,0,w,h);
      [[w*0.15+Math.sin(t)*w*0.06,h*0.12,w*0.38,"rgba(30,70,180,"],[w*0.82+Math.cos(t*0.9)*w*0.05,h*0.22,w*0.28,"rgba(50,100,220,"],[w*0.5+Math.sin(t*1.2)*w*0.1,h*0.6,w*0.32,"rgba(20,50,140,"]].forEach(([x,y,r,col])=>{
        const g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,col+"0.09)"); g.addColorStop(0.5,col+"0.04)"); g.addColorStop(1,col+"0)");
        ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      });
      if(!ref._st) ref._st=Array.from({length:90},()=>({x:Math.random()*3000,y:Math.random()*2000,r:Math.random()*0.9+0.2,a:Math.random()}));
      ref._st.forEach(s=>{
        const p=0.2+0.5*Math.abs(Math.sin(t*0.6+s.a*8));
        ctx.beginPath(); ctx.arc(s.x%w,s.y%h,s.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(180,210,255,${p*0.5})`; ctx.fill();
      });
      raf=requestAnimationFrame(tick);
    };
    tick();
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);};
  },[]);
  return <canvas ref={ref} style={{position:"fixed",inset:0,width:"100%",height:"100%",zIndex:0,pointerEvents:"none"}}/>;
}

function Grid(){
  return <div style={{position:"fixed",inset:0,zIndex:1,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(77,140,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(77,140,255,0.025) 1px,transparent 1px)",backgroundSize:"60px 60px"}}/>;
}

function Pill({status,sm,isPending}){
  const s=STATUS[status]||STATUS.available;
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:sm?10:11,fontWeight:600,color:s.color,background:`${s.color}12`,border:`1px solid ${s.color}35`,padding:sm?"3px 8px":"5px 10px",borderRadius:999,whiteSpace:"nowrap",letterSpacing:"0.01em"}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:s.color,flexShrink:0}}/>
      {isPending?"Awaiting Check-in":s.label}
    </span>
  );
}

function RoomCard({room,onOpen,idx}){
  const [hov,setHov]=useState(false);
  const s=STATUS[room.status]||STATUS.available;
  const displayClass=room.subject?{subject:room.subject,faculty:room.faculty,startTime:room.startTime,endTime:room.endTime}
    :room.nextClass?room.nextClass
    :room.todaySchedule&&room.todaySchedule.length>0?room.todaySchedule[0]
    :null;
  return(
    <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={()=>onOpen(room)}
      style={{display:"block",width:"100%",textAlign:"left",background:hov?C.navyCardHov:C.navyCard,border:hov?`1px solid ${s.color}40`:`1px solid ${C.border}`,borderRadius:16,padding:"16px 15px",cursor:"pointer",transition:"all 0.2s ease",boxShadow:hov?`0 8px 32px ${s.glow}`:"none",transform:hov?"translateY(-2px)":"none",animation:"cardIn 0.45s ease both",animationDelay:`${Math.min(idx*25,400)}ms`}}>
      <style>{`@keyframes cardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:700,color:C.text,letterSpacing:"-0.01em"}}>{room.code}</span>
        <Pill status={room.status} sm isPending={room.isAwaitingCheckIn}/>
      </div>
      {displayClass?<>
        <div style={{fontSize:12.5,fontWeight:600,color:room.subject?C.whiteOff:C.ice,marginBottom:2}}>{displayClass.subject}</div>
        <div style={{fontSize:11.5,color:C.muted}}>{displayClass.faculty}</div>
        {!room.subject&&<div style={{fontSize:10.5,color:C.dim,marginTop:2}}>Open · {room.capacity} seats</div>}
      </>:<div style={{fontSize:12,color:C.muted}}>Open · {room.capacity} seats</div>}
      {displayClass&&displayClass.startTime&&displayClass.endTime&&<div style={{fontSize:11,color:C.dim,marginTop:5,fontFamily:"'JetBrains Mono',monospace"}}>{displayClass.startTime} – {displayClass.endTime}</div>}
      <div style={{borderTop:`1px solid ${C.border}`,marginTop:11,paddingTop:9}}>
        {room.isAwaitingCheckIn&&<span style={{fontSize:11,color:C.amber}}>⏳ Check-in pending</span>}
        {!room.isAwaitingCheckIn&&room.status==="occupied"&&!room.isEndingHeld&&<span style={{fontSize:11,color:C.muted}}>{room.endsInMin!=null?`Ends in ${fmtMin(room.endsInMin)}`:"In progress"}</span>}
        {room.isEndingHeld&&<span style={{fontSize:11,color:C.orange}}>🔔 Class ended · scan to free</span>}
        {!room.isAwaitingCheckIn&&room.status==="soon"&&<span style={{fontSize:11,color:C.amber}}>▲ Starting in {fmtMin(room.startsInMin)}</span>}
        {room.status==="available"&&!room.nextClass&&<span style={{fontSize:11,color:C.blue,fontWeight:600}}>● Ready now</span>}
        {room.status==="available"&&room.nextClass&&<span style={{fontSize:11,color:C.blue,fontWeight:600}}>● Free · next in {fmtMin(room.nextClass.startsInMin)}</span>}
      </div>
    </button>
  );
}

function useCount(to){
  const [v,setV]=useState(0);
  useEffect(()=>{let start=null; const step=ts=>{if(!start)start=ts;const p=Math.min(1,(ts-start)/700);setV(Math.round(to*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(step);}; requestAnimationFrame(step);},[to]);
  return v;
}

function StatCard({value,label,color,icon}){
  const n=useCount(value);
  return(
    <div style={{background:C.navyCard,border:`1px solid ${color}22`,borderRadius:18,padding:"20px 16px",textAlign:"center",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:"-20%",background:`radial-gradient(ellipse at center,${color}14 0%,transparent 65%)`,pointerEvents:"none"}}/>
      <div style={{fontSize:10,fontWeight:700,color,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6,position:"relative"}}>{icon} {label}</div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:38,fontWeight:800,color,letterSpacing:"-0.02em",lineHeight:1,position:"relative"}}>{n}</div>
    </div>
  );
}

function RoomModal({room,onClose,onOpenScanner}){
  if(!room)return null;
  const s=STATUS[room.status]||STATUS.available;
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(3,5,12,0.78)",backdropFilter:"blur(14px)"}}/>
      <div style={{position:"relative",zIndex:1,background:"rgba(10,14,26,0.98)",border:`1px solid ${s.color}35`,borderRadius:26,padding:30,maxWidth:460,width:"100%",maxHeight:"85vh",overflowY:"auto",boxShadow:`0 0 60px ${s.glow},0 30px 60px rgba(0,0,0,0.6)`}} onClick={e=>e.stopPropagation()}>
        <div style={{position:"absolute",top:-50,right:-50,width:180,height:180,borderRadius:"50%",background:`radial-gradient(circle,${s.color}18 0%,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:22}}>
          <div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:30,fontWeight:800,color:C.text,letterSpacing:"-0.02em"}}>{room.code}</div>
          <div style={{fontSize:12.5,color:C.muted,marginTop:2}}>Block {room.block} · Floor {room.floor} · {room.capacity} seats</div></div>
          <Pill status={room.status} isPending={room.isAwaitingCheckIn}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:22}}>
          {[room.subject&&["Subject",room.subject],room.faculty&&["Faculty",room.faculty],room.startTime&&["Start",room.startTime],room.endTime&&["End",room.endTime],room.endsInMin!=null&&!room.isAwaitingCheckIn&&["Time Left",fmtMin(room.endsInMin)],room.isAwaitingCheckIn&&["Status","Awaiting Faculty Scan"],room.nextClass&&["Next Class",room.nextClass.subject],room.nextClass&&["Next Faculty",room.nextClass.faculty],room.nextClass&&["Next Slot",`${room.nextClass.startTime}–${room.nextClass.endTime}`],["Capacity",`${room.capacity} seats`]].filter(Boolean).map(([k,v])=>(
            <div key={k} style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 13px"}}>
              <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{k}</div>
              <div style={{fontSize:13.5,fontWeight:600,color:C.text}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{background:`${s.color}07`,border:`1px solid ${s.color}22`,borderRadius:14,padding:"13px 15px",marginBottom:18,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:40,height:40,borderRadius:9,background:`${s.color}12`,border:`1px solid ${s.color}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>▣</div>
            <div><div style={{fontSize:12,fontWeight:600,color:C.text}}>Room QR</div><div style={{fontSize:11,color:C.muted}}>avaton.edu/room/{room.code.toLowerCase()}</div></div>
          </div>
          <button onClick={()=>onOpenScanner(room)} style={{background:C.blue,border:"none",color:C.white,borderRadius:9,padding:"8px 13px",fontSize:11.5,fontWeight:600,cursor:"pointer"}}>
            {room.isAwaitingCheckIn?"Scan to Start":room.status==="available"?"Check In":"Scan to Free"}
          </button>
        </div>
        <button onClick={onClose} style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,color:C.muted,borderRadius:12,padding:"12px",fontWeight:600,fontSize:13.5,cursor:"pointer",fontFamily:"inherit"}}
          onMouseEnter={e=>e.target.style.color=C.text} onMouseLeave={e=>e.target.style.color=C.muted}>Close</button>
      </div>
    </div>
  );
}

function Nav({page,setPage,user,onShowLogin,onLogout}){
  const canEditTimetable=user&&(user.role==="admin"||user.role==="faculty");
  const pages=canEditTimetable?["dashboard","explorer","timetable"]:["dashboard","explorer"];
  const roleColor = user ? (user.role==="admin"?C.amber:user.role==="student"?C.purple:C.blue) : C.blue;
  return(
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"0 28px",height:58,display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(5,8,15,0.75)",backdropFilter:"blur(22px)",borderBottom:`1px solid ${C.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:26,height:26,borderRadius:7,background:`linear-gradient(135deg,${C.blue},${C.blueDark})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>A</div>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:800,color:C.text,letterSpacing:"-0.01em"}}>AVATON</span>
        <span style={{fontSize:9.5,fontWeight:700,color:C.blue,background:"rgba(77,140,255,0.12)",border:"1px solid rgba(77,140,255,0.25)",padding:"2px 7px",borderRadius:999,marginLeft:2}}>LIVE</span>
      </div>
      <div style={{display:"flex",gap:3}}>
        {pages.map(p=>(
          <button key={p} onClick={()=>setPage(p)} style={{background:page===p?"rgba(77,140,255,0.12)":"transparent",border:page===p?`1px solid rgba(77,140,255,0.3)`:"1px solid transparent",color:page===p?C.blue:C.muted,fontSize:12,fontWeight:600,padding:"6px 14px",borderRadius:999,cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize",transition:"all 0.18s"}}>{p}</button>
        ))}
      </div>
      <div>
        {user ? (
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",border:`1px solid ${roleColor}30`,borderRadius:999,padding:"5px 12px 5px 7px"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:user.role==="admin"?`linear-gradient(135deg,${C.amber},${C.orange})`:user.role==="student"?`linear-gradient(135deg,${C.purple},${C.blue})`:`linear-gradient(135deg,${C.blue},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>
                {user.name[0].toUpperCase()}
              </div>
              <span style={{fontSize:12,fontWeight:600,color:C.text}}>{user.name.split(" ")[0]}</span>
              <span style={{fontSize:10,fontWeight:700,color:roleColor,textTransform:"uppercase"}}>{user.role}</span>
            </div>
            <button onClick={onLogout} style={{background:"rgba(255,92,110,0.08)",border:"1px solid rgba(255,92,110,0.2)",color:C.red,fontSize:12,fontWeight:600,padding:"6px 12px",borderRadius:999,cursor:"pointer",fontFamily:"inherit"}}>Sign out</button>
          </div>
        ) : (
          <button onClick={onShowLogin} style={{background:`linear-gradient(135deg,${C.blue},${C.blueDark})`,border:"none",color:"#fff",fontSize:12,fontWeight:700,padding:"7px 16px",borderRadius:999,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 14px ${C.blueGlow}`}}>Sign in</button>
        )}
      </div>
    </nav>
  );
}

function Hero({counts,onScrollDown}){
  const [tick,setTick]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setTick(x=>x+1),1000);return()=>clearInterval(t);},[]);
  const now=new Date();
  const timeStr=now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  return(
    <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"100px 28px 60px",position:"relative",zIndex:10}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:11.5,fontWeight:700,color:C.blue,background:"rgba(77,140,255,0.09)",border:"1px solid rgba(77,140,255,0.22)",padding:"6px 14px",borderRadius:999,marginBottom:32,letterSpacing:"0.04em"}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:C.blue,display:"inline-block",animation:"pulse 2s ease infinite"}}/>
        LIVE · {timeStr}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}} @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}} @keyframes shimmer{0%{background-position:0% center}100%{background-position:200% center}}`}</style>
      <h1 style={{fontSize:"clamp(44px,8.5vw,92px)",fontWeight:900,letterSpacing:"-0.04em",lineHeight:0.93,margin:"0 0 22px",textAlign:"center",maxWidth:860}}>
        Every Classroom.<br/>
        <span style={{background:`linear-gradient(120deg,${C.white} 0%,${C.blueBright} 40%,${C.ice} 100%)`,backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 5s linear infinite"}}>Live.</span>
      </h1>
      <p style={{fontSize:17,color:C.muted,maxWidth:520,margin:"0 auto 42px",lineHeight:1.7,textAlign:"center"}}>AVATON tracks every room across campus — occupied, free, or moments from changing. Know before you walk.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:860,width:"100%",marginBottom:40}}>
        <StatCard value={counts.available} label="Available"     color={C.white} icon="●"/>
        <StatCard value={counts.occupied}  label="Occupied"      color={C.red}    icon="●"/>
        <StatCard value={counts.soon}      label="Starting Soon" color={C.amber}  icon="▲"/>
      </div>
      <button onClick={onScrollDown} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:12,fontFamily:"inherit"}}>
        <span>Explore rooms</span>
        <span style={{fontSize:19,animation:"bob 1.8s ease infinite"}}>↓</span>
      </button>
    </section>
  );
}

function Dashboard({rooms,onOpen}){
  const [q,setQ]=useState(""), [filter,setFilter]=useState("all");
  const filtered=useMemo(()=>rooms.filter(r=>{
    if(filter!=="all"&&r.status!==filter)return false;
    if(!q.trim())return true;
    const s=q.toLowerCase();
    return r.code.toLowerCase().includes(s)||(r.subject&&r.subject.toLowerCase().includes(s))||(r.faculty&&r.faculty.toLowerCase().includes(s));
  }),[rooms,filter,q]);
  return(
    <section id="dashboard" style={{maxWidth:1200,margin:"0 auto",padding:"0 28px 80px",position:"relative",zIndex:10}}>
      <div style={{marginBottom:26}}>
        <div style={{fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:7}}>Live Feed</div>
        <h2 style={{fontSize:30,fontWeight:800,letterSpacing:"-0.03em",margin:0,color:C.text}}>Every room, right now</h2>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,background:C.navyCard,border:`1px solid ${C.border}`,borderRadius:13,padding:"11px 15px",marginBottom:13}}>
        <span style={{color:C.dim,fontSize:15}}>⌕</span>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search room, subject, or faculty…" style={{flex:1,background:"none",border:"none",outline:"none",color:C.text,fontSize:14,fontFamily:"inherit"}}/>
        {q&&<button style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}} onClick={()=>setQ("")}>×</button>}
      </div>
      <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:4,marginBottom:22}}>
        {[{key:"all",label:"All Rooms",color:C.text},...Object.entries(STATUS).map(([k,v])=>({key:k,label:v.label,color:v.color}))].map(o=>(
          <button key={o.key} onClick={()=>setFilter(o.key)} style={{flexShrink:0,fontSize:12,fontWeight:600,color:filter===o.key?o.color:C.muted,background:filter===o.key?`${o.color}10`:"rgba(255,255,255,0.025)",border:filter===o.key?`1px solid ${o.color}35`:`1px solid ${C.border}`,padding:"7px 13px",borderRadius:999,cursor:"pointer",fontFamily:"inherit",transition:"all 0.18s",display:"flex",alignItems:"center",gap:5}}>
            {o.color&&o.key!=="all"&&<span style={{width:4.5,height:4.5,borderRadius:"50%",background:o.color}}/>}
            {o.label}
          </button>
        ))}
      </div>
      {filtered.length===0?<div style={{textAlign:"center",padding:"70px 20px",color:C.muted}}>No rooms match</div>
        :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(205px,1fr))",gap:10}}>
          {filtered.map((r,i)=><RoomCard key={r.code} room={r} onOpen={onOpen} idx={i}/>)}
        </div>}
    </section>
  );
}

function Explorer({rooms,onOpen}){
  const [block,setBlock]=useState("A");
  const here=useMemo(()=>rooms.filter(r=>r.block===block),[rooms,block]);
  const avail=rooms.filter(r=>r.status==="available").length;
  return(
    <section style={{maxWidth:1200,margin:"0 auto",padding:"80px 28px",position:"relative",zIndex:10}}>
      <div style={{marginBottom:26}}>
        <div style={{fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:7}}>Campus Map</div>
        <h2 style={{fontSize:30,fontWeight:800,letterSpacing:"-0.03em",margin:"0 0 7px",color:C.text}}>Walk the building</h2>
        <p style={{fontSize:13.5,color:C.muted,margin:0}}><span style={{color:C.white,fontWeight:700}}>{avail}</span> of {rooms.length} rooms open right now</p>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:26,flexWrap:"wrap"}}>
        {["A","B","C","D"].map(b=>(
          <button key={b} onClick={()=>setBlock(b)} style={{background:block===b?`rgba(77,140,255,0.14)`:"rgba(255,255,255,0.03)",border:block===b?`1px solid rgba(77,140,255,0.4)`:`1px solid ${C.border}`,color:block===b?C.blue:C.muted,fontSize:13.5,fontWeight:700,padding:"10px 22px",borderRadius:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",transition:"all 0.18s"}}>
            Block {b}
          </button>
        ))}
      </div>
      <div style={{background:C.navyCard,border:`1px solid ${C.border}`,borderRadius:22,padding:22,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(77,140,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(77,140,255,0.02) 1px,transparent 1px)",backgroundSize:"22px 22px",pointerEvents:"none"}}/>
        <div style={{fontSize:10.5,fontWeight:700,color:C.dim,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:15,position:"relative"}}>Block {block} · Floor 1</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:9,position:"relative"}}>
          {here.map(r=>{
            const s=STATUS[r.status]||STATUS.available;
            return(
              <button key={r.code} onClick={()=>onOpen(r)} style={{background:`${s.color}09`,border:`1px solid ${s.color}35`,borderRadius:12,padding:"15px 13px",cursor:"pointer",textAlign:"left",transition:"all 0.18s"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.02)";e.currentTarget.style.boxShadow=`0 8px 24px ${s.glow}`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="none";}}>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13.5,fontWeight:700,color:s.color,marginBottom:5}}>{r.code}</div>
                <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{r.status==="available"?`${r.capacity} seats free`:r.subject||s.label}</div>
                <div style={{width:"100%",height:2.5,borderRadius:999,background:`${s.color}18`,marginTop:5}}>
                  <div style={{width:r.status==="available"?"100%":"40%",height:"100%",background:s.color,borderRadius:999}}/>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TimetableEditor({ timetables, onUpdateEntry, onDeleteEntry, onAddEntry, currentUser }) {
  const [roomCode, setRoomCode] = useState(ROOM_DEFS[0].code);
  const [day, setDay] = useState(DAYS[0]);
  const [draft, setDraft] = useState({ start: "09:00", end: "09:50", subject: SUBJECTS[0], faculty: FACULTY[0] });
  const [draftError, setDraftError] = useState("");
  const canEdit = currentUser && (currentUser.role === "admin" || currentUser.role === "faculty");
  const entries = useMemo(() => (timetables[roomCode] || []).filter(e => e.day === day).sort((a, b) => timeToMin(a.start) - timeToMin(b.start)), [timetables, roomCode, day]);
  if (!canEdit) return (
    <section style={{ maxWidth: 640, margin: "0 auto", padding: "100px 28px 80px", position: "relative", zIndex: 10, textAlign: "center" }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: "0 0 10px" }}>Sign in to edit the timetable</h2>
      <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>Only faculty and admin accounts can manage scheduled classes.</p>
    </section>
  );
  const selStyle = { background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, color: C.text, borderRadius: 9, padding: "8px 10px", fontSize: 12.5, fontFamily: "inherit", width: "100%" };
  const inpStyle = { ...selStyle, fontFamily: "'JetBrains Mono',monospace" };
  const handleAdd = () => {
    const s = timeToMin(draft.start), e = timeToMin(draft.end);
    if (s == null || e == null) { setDraftError("Use HH:MM, e.g. 09:00"); return; }
    if (e <= s) { setDraftError("End time must be after start time"); return; }
    setDraftError("");
    onAddEntry(roomCode, { day, start: draft.start, end: draft.end, subject: draft.subject, faculty: draft.faculty });
    setDraft({ start: "09:00", end: "09:50", subject: SUBJECTS[0], faculty: FACULTY[0] });
  };
  return (
    <section style={{ maxWidth: 1000, margin: "0 auto", padding: "80px 28px 90px", position: "relative", zIndex: 10 }}>
      <div style={{ marginBottom: 26 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7 }}>Schedule Control</div>
        <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 7px", color: C.text }}>Edit timetable</h2>
        <p style={{ fontSize: 13.5, color: C.muted, margin: 0 }}>Signed in as <span style={{ color: C.text, fontWeight: 600 }}>{currentUser.name}</span> · <span style={{ textTransform: "capitalize" }}>{currentUser.role}</span></p>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={roomCode} onChange={e => setRoomCode(e.target.value)} style={{ ...selStyle, width: "auto", minWidth: 120 }}>
          {ROOM_DEFS.map(r => <option key={r.code} value={r.code}>{r.code}</option>)}
        </select>
        <select value={day} onChange={e => setDay(e.target.value)} style={{ ...selStyle, width: "auto", minWidth: 130 }}>
          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div style={{ background: C.navyCard, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "80px 80px 1fr 1fr 36px", gap: 8, fontSize: 10.5, color: C.dim, textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 4px 8px" }}>
          <span>Start</span><span>End</span><span>Subject</span><span>Faculty</span><span/>
        </div>
        {entries.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "10px 4px" }}>No classes scheduled for {roomCode} on {day}.</div>}
        {entries.map(e => (
          <div key={e.id} style={{ display: "grid", gridTemplateColumns: "80px 80px 1fr 1fr 36px", gap: 8, alignItems: "center", padding: "7px 4px", borderTop: `1px solid ${C.border}` }}>
            <input value={e.start} onChange={ev => onUpdateEntry(roomCode, e.id, { start: ev.target.value })} style={inpStyle} />
            <input value={e.end} onChange={ev => onUpdateEntry(roomCode, e.id, { end: ev.target.value })} style={inpStyle} />
            <select value={e.subject} onChange={ev => onUpdateEntry(roomCode, e.id, { subject: ev.target.value })} style={selStyle}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={e.faculty} onChange={ev => onUpdateEntry(roomCode, e.id, { faculty: ev.target.value })} style={selStyle}>
              {FACULTY.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <button onClick={() => onDeleteEntry(roomCode, e.id)} style={{ background: "rgba(255,92,110,0.1)", border: `1px solid rgba(255,92,110,0.3)`, color: C.red, borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 15 }}>×</button>
          </div>
        ))}
      </div>
      <div style={{ background: C.navyCard, border: `1px dashed ${C.border}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Add a class · {roomCode} · {day}</div>
        <div style={{ display: "grid", gridTemplateColumns: "80px 80px 1fr 1fr auto", gap: 8, alignItems: "center" }}>
          <input value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} placeholder="08:30" style={inpStyle} />
          <input value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} placeholder="09:20" style={inpStyle} />
          <select value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} style={selStyle}>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={draft.faculty} onChange={e => setDraft({ ...draft, faculty: e.target.value })} style={selStyle}>
            {FACULTY.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <button onClick={handleAdd} style={{ background: C.blue, border: "none", color: C.white, borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
        </div>
        {draftError && <div style={{ fontSize: 11.5, color: C.red, marginTop: 10 }}>{draftError}</div>}
      </div>
    </section>
  );
}

/* ── Main App ── */
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [currentUser, setCurrentUser] = useState(null);
  const [loginFlow, setLoginFlow] = useState(null); // null | "select" | "admin" | "faculty" | "student"
  const [overrides, setOverrides] = useState({});
  const [scannedRooms, setScannedRooms] = useState({});
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [scannerConfig, setScannerConfig] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timetables, setTimetables] = useState(() => buildTimetables());

  const canEditTimetable = currentUser && (currentUser.role === "admin" || currentUser.role === "faculty");

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    setOverrides((prev) => {
      const nowMs = currentTime.getTime(); let changed = false; const next = {};
      Object.entries(prev).forEach(([code, ov]) => {
        const expired = (ov.kind === "occupied" && nowMs >= ov.endMs) || (ov.kind === "available" && ov.expiresAt && nowMs >= ov.expiresAt);
        if (expired) { changed = true; return; }
        next[code] = ov;
      });
      return changed ? next : prev;
    });
  }, [currentTime]);

  useEffect(() => { if (page === "timetable" && !canEditTimetable) setPage("dashboard"); }, [page, canEditTimetable]);

  const currentRoomsState = useMemo(() => computeRooms(timetables, currentTime, overrides, scannedRooms), [timetables, currentTime, overrides, scannedRooms]);
  const liveCounts = useMemo(() => {
    const counts = { available: 0, occupied: 0, soon: 0 };
    currentRoomsState.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });
    return counts;
  }, [currentRoomsState]);

  const handleLogin = (acc) => { setCurrentUser(acc); setLoginFlow(null); };
  const handleLogout = () => { setCurrentUser(null); setPage("dashboard"); };

  const handleScanSuccess = (room) => {
    const action = getScanAction(room);
    if (action === "checkin-scheduled") {
      setScannedRooms((prev) => ({ ...prev, [`${room.code}_${room.startTime}`]: true }));
    } else if (action === "checkin-adhoc") {
      const startMs = currentTime.getTime();
      const jsDay = currentTime.getDay();
      const dayName = jsDay === 0 ? "Monday" : ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][jsDay - 1];
      const nm = currentTime.getHours() * 60 + currentTime.getMinutes();
      const todayEntries = (timetables[room.code] || []).filter(e => e.day === dayName);
      // Always prefer the active timetable slot first, then next upcoming — never fall back to 50min if a slot exists
      const activeSlot = todayEntries.find(e => { const s = timeToMin(e.start), en = timeToMin(e.end); return s != null && en != null && s <= nm && nm < en; });
      const nextSlot = todayEntries.filter(e => timeToMin(e.start) > nm).sort((a,b) => timeToMin(a.start) - timeToMin(b.start))[0];
      const ttSlot = activeSlot || nextSlot;
      // Use exact timetable end time so "Ends in" always counts down to the scheduled end regardless of who scanned in
      const endMs = ttSlot ? todayAt(currentTime, ttSlot.end) : null;
      if (!endMs) return; // no timetable slot found, don't create an override
      setOverrides((prev) => ({ ...prev, [room.code]: { kind: "occupied", subject: ttSlot ? ttSlot.subject : "Walk-in Booking", faculty: currentUser ? currentUser.name : "Staff", startMs, endMs } }));
    } else {
      if (room.isEndingHeld) { setScannedRooms((prev) => ({ ...prev, [`${room.code}_${room.startTime}_out`]: true })); }
      else { setOverrides((prev) => ({ ...prev, [room.code]: { kind: "available", expiresAt: room.endTime ? todayAt(currentTime, room.endTime) : currentTime.getTime() + 30 * 60000 } })); }
    }
    if (selectedRoom && selectedRoom.code === room.code) setSelectedRoom(null);
  };

  const handleUpdateEntry = (roomCode, entryId, patch) => setTimetables((prev) => ({ ...prev, [roomCode]: (prev[roomCode] || []).map((e) => (e.id === entryId ? { ...e, ...patch } : e)) }));
  const handleDeleteEntry = (roomCode, entryId) => setTimetables((prev) => ({ ...prev, [roomCode]: (prev[roomCode] || []).filter((e) => e.id !== entryId) }));
  const handleAddEntry = (roomCode, entry) => setTimetables((prev) => ({ ...prev, [roomCode]: [...(prev[roomCode] || []), { id: uid(), ...entry }] }));

  // Login flow overlays
  if (!currentUser && loginFlow === null) return <LandingPage onSelectRole={role => setLoginFlow(role === "select" ? "select" : role)} />;
  if (loginFlow === "select") return <RoleSelector onSelect={role => setLoginFlow(role)} />;
  if (loginFlow === "admin" || loginFlow === "faculty" || loginFlow === "student") {
    return <LoginPage role={loginFlow} onLogin={handleLogin} onBack={() => setLoginFlow("select")} />;
  }

  return (
    <div style={{ background: C.navy, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif" }}>
      <Bg />
      <Grid />
      <Nav page={page} setPage={setPage} user={currentUser} onShowLogin={() => setLoginFlow("select")} onLogout={() => { handleLogout(); setLoginFlow(null); }} />
      <Hero counts={liveCounts} onScrollDown={() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" })} />
      {page === "dashboard" && <Dashboard rooms={currentRoomsState} onOpen={setSelectedRoom} />}
      {page === "explorer" && <Explorer rooms={currentRoomsState} onOpen={setSelectedRoom} />}
      {page === "timetable" && <TimetableEditor timetables={timetables} onUpdateEntry={handleUpdateEntry} onDeleteEntry={handleDeleteEntry} onAddEntry={handleAddEntry} currentUser={currentUser} />}
      {selectedRoom && <RoomModal room={currentRoomsState.find((r) => r.code === selectedRoom.code)} onClose={() => setSelectedRoom(null)} onOpenScanner={(room) => setScannerConfig(room)} />}
      {scannerConfig && <CameraScanner room={currentRoomsState.find((r) => r.code === scannerConfig.code) || scannerConfig} currentUser={currentUser} onClose={() => setScannerConfig(null)} onScanSuccess={handleScanSuccess} />}
    </div>
  );
}
