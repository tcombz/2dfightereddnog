import{c as Ce,a as Se,P as Te,h as se,I as Pe,r as ze,p as De,b as Me,f as He,e as Ue,d as Ye,g as _e,i as Be,v as Ge,j as Ve,q as Ke,m as qe,l as Fe,k as We,n as Xe,o as Je,s as Ze}from"./input-Bl6HnrWU.js";import"./index-CRe1wC1y.js";const Qe=`
:root {
  --night: #070912; --panel: #10142a; --edge: #2b3263; --ink: #f3f1ff; --muted: #9aa2c8;
  --gold: #ffc23d; --p1: #3d8bff; --p2: #ff6a3d; --me: #3d8bff; --seat: #3d8bff;
  --display: "Bungee", Impact, "Arial Black", sans-serif;
  --body: "Chakra Petch", "Trebuchet MS", system-ui, sans-serif;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; height: 100%; background: var(--night); color: var(--ink); overflow: hidden; overscroll-behavior: none; }
body { position: fixed; inset: 0; font: 600 16px var(--body); -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
#app { display: none; }
#phone { position: absolute; inset: 0; display: flex; flex-direction: column;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  background:
    radial-gradient(120% 80% at 0% 100%, color-mix(in srgb, var(--me) 26%, transparent), transparent 60%),
    radial-gradient(90% 70% at 100% 0%, rgba(138, 92, 255, 0.22), transparent 60%),
    repeating-linear-gradient(115deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 14px),
    var(--night); }
#phone.in-fight { background:
    radial-gradient(100% 90% at 0% 100%, color-mix(in srgb, var(--seat) 30%, transparent), transparent 60%),
    radial-gradient(100% 90% at 100% 100%, color-mix(in srgb, var(--seat) 18%, transparent), transparent 55%),
    var(--night); }
button { font: inherit; color: inherit; border: 0; background: none; padding: 0; cursor: pointer; touch-action: manipulation; }
input { font: 600 20px var(--body); }
.h1 { font: 400 clamp(22px, 7vw, 40px) var(--display); letter-spacing: 0.5px; line-height: 1.05;
  background: linear-gradient(#fff2b0, #ffc93d 55%, #ff9f1c); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 3px 0 #05060c); }
.h2 { font: 400 clamp(15px, 4.4vw, 22px) var(--display); }
.muted { color: var(--muted); }
.center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 18px; text-align: center; }
.card { background: rgba(16, 20, 42, 0.92); border: 2px solid var(--edge); border-radius: 16px; padding: 16px; width: min(420px, 100%); display: flex; flex-direction: column; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; text-align: left; }
.field label { font: 400 12px var(--display); color: var(--gold); letter-spacing: 1px; }
.field input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 2px solid var(--edge); background: #0b0e1c; color: var(--ink); outline: none; text-transform: uppercase; }
.field input:focus { border-color: var(--gold); }
.code-input { font: 400 34px var(--display) !important; letter-spacing: 10px; text-align: center; }
.big { width: 100%; padding: 16px; border-radius: 14px; font: 400 22px var(--display); color: #120c02;
  background: linear-gradient(#ffe27a, #ffc23d 60%, #ff9f1c); box-shadow: 0 5px 0 #a35a00, 0 0 24px rgba(255, 194, 61, 0.35); }
.big:active, .big.on { transform: translateY(3px); box-shadow: 0 2px 0 #a35a00; }
.big:disabled { filter: grayscale(1) brightness(0.6); }
.ghost { padding: 10px 14px; border-radius: 12px; border: 2px solid var(--edge); background: rgba(16, 20, 42, 0.8); font: 400 14px var(--display); }
.ghost:active, .ghost.on { border-color: var(--gold); }
.err { color: #ff8a6a; min-height: 1.2em; }
.link { color: var(--muted); text-decoration: underline; font-size: 14px; }
.chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 8px; border-radius: 999px; background: rgba(16, 20, 42, 0.92); border: 2px solid var(--edge); font: 400 14px var(--display); }
.dot { width: 14px; height: 14px; border-radius: 50%; background: var(--me); box-shadow: 0 0 10px var(--me); }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; min-height: 48px; }
.bar .say { flex: 1; text-align: center; font: 400 clamp(14px, 4.2vw, 20px) var(--display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.players { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 560px; }
.players .chip.off { opacity: 0.4; }
.starts { display: flex; flex-direction: column; gap: 10px; width: min(420px, 100%); }
.big.alt { background: linear-gradient(#2a3166, #1a1f45); color: var(--ink); box-shadow: 0 5px 0 #05060c; border: 2px solid var(--edge); font-size: 18px; }
.players .chip.me { border-color: var(--gold); }
.spin { width: 44px; height: 44px; border-radius: 50%; border: 5px solid var(--edge); border-top-color: var(--gold); animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.pop { animation: pop 0.25s cubic-bezier(0.2, 1.6, 0.4, 1); }
.overlay { position: absolute; inset: 0; background: rgba(5, 6, 12, 0.82); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 9; text-align: center; padding: 24px; }
.tip { font-size: 13px; color: var(--muted); }

/* ---------- character select ---------- */
.select { flex: 1; display: flex; gap: 12px; padding: 0 12px 10px; min-height: 0; }
.grid { flex: 1.6; display: grid; grid-template-columns: repeat(var(--cols, 5), 1fr); gap: 8px; align-content: center; min-height: 0; }
.tile { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; border: 3px solid #2b3263; background: #0b0e1c center 8% / cover no-repeat; transition: transform 0.08s; }
.tile .nm { position: absolute; left: 0; right: 0; bottom: 0; padding: 2px 0; font: 400 clamp(8px, 2.4vw, 12px) var(--display); background: linear-gradient(transparent, rgba(5, 6, 12, 0.95)); text-align: center; }
.tile.rand { display: flex; align-items: center; justify-content: center; font: 400 34px var(--display); color: var(--gold); }
.tile.hover { border-color: var(--seat); transform: scale(1.06); box-shadow: 0 0 0 3px #05060c, 0 0 18px var(--seat); z-index: 2; }
.tile.taken { filter: grayscale(0.7) brightness(0.55); }
.tile.taken::after { content: "✓"; position: absolute; top: 2px; right: 6px; font: 400 18px var(--display); color: var(--gold); }
.side { flex: 1; display: flex; flex-direction: column; gap: 10px; justify-content: center; min-width: 0; }
.slots { display: flex; gap: 8px; justify-content: center; margin-bottom: 18px; }
.slot { width: 64px; height: 64px; border-radius: 12px; border: 2px dashed var(--edge); background: #0b0e1c center 8% / cover no-repeat; position: relative; }
.slot.full { border: 3px solid var(--seat); }
.slot.next { border-color: #fff; animation: blink 0.9s ease-in-out infinite; }
.slot span { position: absolute; bottom: -16px; left: 0; right: 0; text-align: center; font: 600 10px var(--body); color: var(--muted); }
@keyframes blink { 50% { border-color: var(--seat); } }
.hero-name { font: 400 clamp(20px, 6vw, 30px) var(--display); text-align: center; line-height: 1; }
.hero-title { text-align: center; color: var(--gold); font-size: 13px; }
.row { display: flex; gap: 8px; }
.row > * { flex: 1; }

/* ---------- stage select ---------- */
.stages { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding: 0 12px; overflow-y: auto; align-content: start; touch-action: pan-y; }
.stage { border-radius: 12px; overflow: hidden; border: 3px solid var(--edge); aspect-ratio: 2.4; background: #0b0e1c center / cover no-repeat; position: relative; }
.stage span { position: absolute; left: 0; right: 0; bottom: 0; padding: 3px 6px; font: 400 12px var(--display); background: linear-gradient(transparent, rgba(5, 6, 12, 0.95)); }
.stage.hover { border-color: var(--gold); box-shadow: 0 0 16px rgba(255, 194, 61, 0.6); }
.foot { padding: 10px 12px; display: flex; gap: 10px; }
.foot .big { flex: 2; } .foot .ghost { flex: 1; }

/* ---------- remote ---------- */
.remote { flex: 1; display: flex; align-items: center; justify-content: space-around; gap: 16px; padding: 10px 16px 16px; flex-wrap: wrap; }
.cross { display: grid; grid-template-columns: repeat(3, var(--k)); grid-template-rows: repeat(3, var(--k)); gap: 6px; --k: min(19vw, 22vh, 84px); }
.cross button, .okback button { border-radius: 16px; background: linear-gradient(#1f2550, #141936); border: 2px solid var(--edge); font: 400 26px var(--display); box-shadow: 0 4px 0 #05060c; }
.cross button.on, .okback button.on { transform: translateY(3px); box-shadow: 0 1px 0 #05060c; border-color: var(--gold); }
.okback { display: grid; grid-template-columns: var(--k) var(--k); grid-template-rows: var(--k) var(--k); gap: 12px; --k: min(24vw, 26vh, 104px); }
.okback .ok { grid-column: 2; grid-row: 1 / span 2; background: linear-gradient(#ffe27a, #ffc23d 60%, #ff9f1c); color: #120c02; box-shadow: 0 5px 0 #a35a00; }
.okback .back { grid-column: 1; grid-row: 2; font-size: 16px; }
.okback .pause { grid-column: 1; grid-row: 1; font-size: 14px; }

/* ---------- fight pad ---------- */
.fight { flex: 1; display: flex; flex-direction: column; min-height: 0; touch-action: none; }
.fight .bar { min-height: 40px; padding: 4px 12px; }
.seat { font: 400 18px var(--display); padding: 2px 12px; border-radius: 8px; background: var(--seat); color: #05060c; }
.teamline { flex: 1; font: 400 13px var(--display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.pausebtn { padding: 6px 14px; border-radius: 10px; border: 2px solid var(--edge); background: rgba(16, 20, 42, 0.8); font: 400 13px var(--display); }
.pad { flex: 1; display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; padding: 0 max(14px, 3vw) max(14px, 4vh); min-height: 0; }
.dzone { flex: 1; align-self: stretch; display: flex; align-items: flex-end; justify-content: flex-start; min-width: 0; }
.dpad { --d: min(62vh, 40vw, 250px); width: var(--d); height: var(--d); border-radius: 50%; position: relative;
  background: radial-gradient(circle, #1a2048 0 30%, #10142a 31% 100%); border: 3px solid var(--edge); box-shadow: inset 0 0 30px rgba(0,0,0,0.6), 0 6px 0 #05060c; }
.dpad .arr { position: absolute; font: 400 calc(var(--d) * 0.13) var(--display); color: #4a5390; transform: translate(-50%, -50%); }
.dpad .arr.on { color: var(--seat); text-shadow: 0 0 12px var(--seat); }
.dpad .knob { position: absolute; left: 50%; top: 50%; width: 38%; height: 38%; border-radius: 50%; transform: translate(-50%, -50%);
  background: radial-gradient(circle at 40% 35%, #f3f1ff, color-mix(in srgb, var(--seat) 70%, #222) 60%, #05060c); box-shadow: 0 4px 10px rgba(0,0,0,0.6); transition: transform 0.04s; }
.dpad .lbl { position: absolute; left: 50%; top: -8px; transform: translate(-50%, -100%); font-size: 11px; color: var(--muted); white-space: nowrap; }
.bzone { display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
.smalls { display: flex; gap: 8px; }
.smalls button { min-width: calc(var(--b) * 0.72); padding: 0 8px; height: calc(var(--b) * 0.46); border-radius: 12px; font: 400 calc(var(--b) * 0.15) var(--display);
  background: linear-gradient(#1f2550, #141936); border: 2px solid var(--edge); box-shadow: 0 3px 0 #05060c; }
.btns { display: grid; grid-template-columns: repeat(3, var(--b)); grid-auto-rows: var(--b); gap: 10px; }
.bzone { --b: min(26vh, 15vw, 100px); }
.btn { border-radius: 50%; font: 400 calc(var(--b) * 0.17) var(--display); position: relative; color: #fff; text-shadow: 0 2px 0 rgba(0,0,0,0.5);
  background: radial-gradient(circle at 40% 30%, color-mix(in srgb, var(--c) 70%, #fff), var(--c) 45%, color-mix(in srgb, var(--c) 55%, #000));
  box-shadow: 0 5px 0 color-mix(in srgb, var(--c) 40%, #000), 0 0 0 3px #05060c; }
.btn.on, .smalls button.on { transform: translateY(4px) scale(0.96); filter: brightness(1.35); box-shadow: 0 1px 0 color-mix(in srgb, var(--c, #2b3263) 40%, #000), 0 0 22px var(--c, var(--gold)); }
.btn small { display: block; font: 600 calc(var(--b) * 0.1) var(--body); opacity: 0.8; }
.portrait-tip { display: none; }
.teamcard { display: none; }
.tc { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.tcimg { width: min(34vw, 150px); aspect-ratio: 1; border-radius: 16px; border: 3px solid var(--seat); background: #0b0e1c center 8% / cover no-repeat; box-shadow: 0 0 24px color-mix(in srgb, var(--seat) 50%, transparent); }
.tc + .tc .tcimg { width: min(24vw, 104px); border-width: 2px; opacity: 0.85; }
.tcname { font: 400 16px var(--display); }
.tcrole { font-size: 11px; color: var(--muted); }
/* A phone on its side: less room top to bottom. */
@media (max-height: 440px) {
  .center { gap: 8px; padding: 8px 18px; overflow-y: auto; justify-content: safe center; touch-action: pan-y; }
  .center .h1 { font-size: 26px; }
  .big { padding: 11px; font-size: 18px; }
  .center > .tip { display: none; }
}
@media (orientation: portrait) {
  .select { flex-direction: column; }
  .grid { --cols: 4; flex: none; }
  .pad { flex: none; flex-direction: column; align-items: stretch; justify-content: flex-end; gap: 18px; }
  .dzone { align-self: auto; flex: none; justify-content: center; }
  .dpad { --d: min(52vw, 34vh, 230px); }
  .bzone { --b: min(21vw, 13vh, 92px); align-items: center; }
  .portrait-tip { display: block; text-align: center; }
  .teamcard { display: flex; flex: 1; align-items: center; justify-content: center; gap: 18px; min-height: 0; overflow: hidden; }
  .remote { flex-direction: column; justify-content: center; }
}
`,et=Object.assign({"../../assets/heroes/chris/sheet_portrait.png":Ze,"../../assets/heroes/eddnog/sheet_portrait.png":Je,"../../assets/heroes/ignar/sheet_portrait.png":Xe,"../../assets/heroes/jetsetter/sheet_portrait.png":We,"../../assets/heroes/leader/sheet_portrait.png":Fe,"../../assets/heroes/malcolm/sheet_portrait.png":qe,"../../assets/heroes/quincy/sheet_portrait.png":Ke,"../../assets/heroes/rogue/sheet_portrait.png":Ve,"../../assets/heroes/vesper/sheet_portrait.png":Ge}),tt=Object.assign({"../../assets/stages/alley.png":Be,"../../assets/stages/concert.png":_e,"../../assets/stages/crown.png":Ye,"../../assets/stages/embassy.png":Ue,"../../assets/stages/fortress.png":He,"../../assets/stages/helipad.png":Me,"../../assets/stages/penthouse.png":De,"../../assets/stages/rooftop.png":ze}),ge=t=>et[`../../assets/heroes/${t}/sheet_portrait.png`]??"",nt=t=>tt[`../../assets/stages/${t}.png`]??"",at=t=>`#${t.toString(16).padStart(6,"0")}`,ue=["#3d8bff","#ff6a3d"],{Left:K,Right:q,Up:F,Down:W,Light:J,Heavy:Z,Special:Q,Block:ee}=Pe;function e(t,n={},...c){const i=document.createElement(t);for(const[r,l]of Object.entries(n))l==null||l===!1||(r==="class"?i.className=String(l):r==="style"?i.setAttribute("style",String(l)):r.startsWith("on")&&typeof l=="function"?i.addEventListener(r.slice(2),l):i.setAttribute(r,String(l)));for(const r of c)r!=null&&r!==!1&&i.append(r);return i}function te(t,n){try{return n!==void 0&&localStorage.setItem(t,n),localStorage.getItem(t)??""}catch{return n??""}}function ot(){const t=new URLSearchParams(location.search).get("pid");if(t)return t.slice(0,40);let n=te("afterhours.phoneId");return n||(n=te("afterhours.phoneId",`${Date.now().toString(36)}${Math.random().toString(36).slice(2,10)}`)),n}function le(t){var n;try{(n=navigator.vibrate)==null||n.call(navigator,t)}catch{}}const st=ot();let L=Ce(new URLSearchParams(location.search).get("pad")??""),m=te("afterhours.phoneName"),v=null,T=null,H=null,d="join",U="",ce=0,_=0,Y=0,re=0,xe=[],Ee=0,Ae=0;function de(t){v==null||v.send(t)}function Le(){Ee+=1,Ae=performance.now(),de({t:"in",q:Ee,b:Y,n:re,p:xe})}function be(t){if(t===Y)return;const n=t&~Y;Y=t,n&&(re+=1,xe=[...xe.slice(-5),[re,n]]),Le()}function he(t){de({t:"m",a:t}),le(8)}function j(t,n){de({t:"cmd",c:t,v:n}),le(8)}async function ie(){if(L.length!==4){U="Type the 4-letter code shown on the TV.",N();return}te("afterhours.phoneName",m),d!=="connecting"&&(U="",V=0),d="connecting",N(),ye(),V+=1;try{const t=await Se(L);if(d!=="connecting"){t.close();return}V=0,Ne(t);try{const n=new URL(location.href);n.searchParams.set("pad",L),history.replaceState(null,"",n.toString())}catch{}}catch(t){if(d!=="connecting")return;U=(t==null?void 0:t.message)??"Could not connect.",N(),window.clearTimeout(_),_=window.setTimeout(()=>{d==="connecting"&&ie()},2500)}}let V=0;function Ne(t){v=t,ce=performance.now(),t.onData(it),t.onClose(()=>{v===t&&(v=null,me())}),Ie(t),d="live",N()}const rt=Math.random().toString(36).slice(2,10);function Ie(t=v){t==null||t.send({t:"hi",v:Te,id:st,sid:rt,name:m,n:re})}function me(){d==="full"||d==="old"||d==="join"||(d="lost",Y=0,N(),window.clearTimeout(_),_=window.setTimeout(ve,1200))}async function ve(){if(d==="lost")try{Ne(await Se(L,8e3))}catch{_=window.setTimeout(ve,2500)}}function it(t){if(ce=performance.now(),t.t==="hello"){const n=t;if(n.v>Te){d="old",v==null||v.close(),N();return}T=n,m=n.name,document.documentElement.style.setProperty("--me",n.color),N()}else t.t==="view"?(H=t.v,N()):t.t==="buzz"?le(Number(t.ms)||30):t.t==="full"?(d="full",N()):t.t==="who"&&Ie()}window.setInterval(()=>{if(d!=="live"||!v)return;const t=performance.now(),n=(H==null?void 0:H.screen)==="fight";t-Ae>(n?100:900)&&Le(),t-ce>6e3&&(v.close(),v=null,me())},50);let fe=null;function ye(){const t=navigator;!t.wakeLock||fe||t.wakeLock.request("screen").then(n=>{var c;fe=n,(c=n.addEventListener)==null||c.call(n,"release",()=>fe=null)},()=>{})}document.addEventListener("visibilitychange",()=>{if(document.hidden){be(0);return}ye(),d==="live"&&performance.now()-ce>3e3?(v==null||v.close(),v=null,me()):d==="lost"&&(window.clearTimeout(_),ve())});const G=e("div",{id:"phone"});let w=null;function N(){var c,i;if(d!=="live"||!T||!H){(c=w==null?void 0:w.unmount)==null||c.call(w),w=null,G.className="",G.replaceChildren(d==="join"?lt():d==="connecting"||d==="live"&&(!T||!H)?ct():d==="lost"?dt():d==="full"?pt():ft());return}const t=H;document.documentElement.style.setProperty("--seat",ue[t.seat]??T.color);const n=t.screen;(!w||w.key!==n)&&((i=w==null?void 0:w.unmount)==null||i.call(w),G.replaceChildren(),G.className=n==="fight"?"in-fight":"",w=ut[n](G)),w.update(t)}function lt(){const t=e("input",{class:"code-input",maxlength:4,autocomplete:"off",autocapitalize:"characters",spellcheck:"false",placeholder:"CODE",value:L});t.addEventListener("input",()=>{L=Ce(t.value),t.value=L});const n=e("input",{maxlength:12,autocomplete:"nickname",placeholder:"YOUR NAME",value:m});n.addEventListener("input",()=>{m=n.value.toUpperCase().slice(0,12)});const c=e("button",{class:"big",onclick:()=>void ie()},"JOIN GAME");for(const r of[t,n])r.addEventListener("keydown",l=>l.key==="Enter"&&void ie());const i=L.length===4;return e("div",{class:"center"},e("div",{class:"h1"},"AFTER HOURS"),e("div",{class:"muted"},i?`Joining the game on the TV  ·  code ${L}`:"Use your phone as the controller for the game on the TV."),e("div",{class:"card"},!i&&e("div",{class:"field"},e("label",{},"CODE ON THE TV"),t),e("div",{class:"field"},e("label",{},"YOUR NAME"),n),c,e("div",{class:"err"},U)),e("a",{class:"link",href:`${location.pathname}?tv=1`},"Play on this screen instead"),e("div",{class:"tip"},"build 11210355"))}function ct(){const t=d==="live";return e("div",{class:"center"},e("div",{class:"spin"}),e("div",{class:"h2"},t?"CONNECTED":"CONNECTING TO THE TV"),e("div",{class:"muted"},`Code ${L}${!t&&V>1?`  ·  try ${V}, keeps trying by itself`:""}`),!t&&U&&e("div",{class:"err"},U),!t&&e("button",{class:"ghost",onclick:()=>{d="join",V=0,window.clearTimeout(_),N()}},"CHANGE CODE"),e("div",{class:"tip"},"build 11210355"))}function dt(){return e("div",{class:"center"},e("div",{class:"spin"}),e("div",{class:"h2"},"RECONNECTING…"),e("div",{class:"muted"},"Lost the TV for a moment. Keep this page open, you keep your spot."),e("button",{class:"ghost",onclick:()=>(d="join",U="",N())},"CHANGE CODE"))}function pt(){return e("div",{class:"center"},e("div",{class:"h2"},"THE GAME IS FULL"),e("div",{class:"muted"},"Twelve phones are already in. Ask the host to clear players who left."))}function ft(){return e("div",{class:"center"},e("div",{class:"h2"},"UPDATE NEEDED"),e("div",{class:"muted"},"The TV runs a newer version of the game than this page."),e("button",{class:"big",onclick:()=>location.replace(`${location.pathname}?pad=${L}&b=${Date.now().toString(36)}`)},"RELOAD"))}function X(){const t=e("div",{class:"say"}),n=e("span",{},m),c=e("button",{class:"chip",onclick:gt},e("span",{class:"dot"}),n);return{bar:e("div",{class:"bar"},c,t),say:t,chip:n}}function gt(){const t=window.prompt("Your name",m);if(t===null)return;const n=t.toUpperCase().replace(/[^A-Z0-9 .!?'_-]/g,"").trim().slice(0,12);n&&(m=n,te("afterhours.phoneName",m),de({t:"name",v:m}))}const ut={lobby(t){const{bar:n,say:c,chip:i}=X(),r=e("div",{class:"muted"}),l=e("div",{class:"players"}),f=e("div",{class:"starts"});return t.append(n,e("div",{class:"center"},e("div",{class:"h1 pop"},"YOU'RE IN!"),r,l,f,e("div",{class:"tip"},"Tip: turn your phone sideways for the fight. Tap your name to change it."))),{key:"lobby",update(b){c.textContent="",i.textContent=m,r.textContent=b.sub??b.say,l.replaceChildren(...(b.players??[]).map(o=>e("div",{class:`chip${o.on?"":" off"}${o.me?" me":""}`},e("span",{class:"dot",style:`background:${o.color};box-shadow:0 0 10px ${o.color}`}),o.name)));const C=b.starts??[],k=C.map(o=>`${o.id}:${o.label}`).join("|");f.dataset.key!==k&&(f.dataset.key=k,f.replaceChildren(...C.map((o,g)=>e("button",{class:g===0?"big":"big alt",onclick:()=>j("start",o.id)},o.label))))}}},wait(t){const{bar:n,chip:c}=X(),i=e("div",{class:"h1 pop"}),r=e("div",{class:"muted"}),l=e("div",{class:"tip"},"Your controller switches on when it is your turn.");return t.append(n,e("div",{class:"center"},i,r,l)),{key:"wait",update(f){c.textContent=m,i.textContent!==f.say&&(i.textContent=f.say,i.classList.remove("pop"),i.offsetWidth,i.classList.add("pop")),r.textContent=f.sub??"",l.style.display=["CHAMPION!","GG","KNOCKED OUT","WATCHING"].includes(f.say)?"none":""}}},remote(t){const{bar:n,say:c,chip:i}=X(),r=e("div",{class:"muted",style:"text-align:center;padding:0 12px"}),l=new Map,f=(o,g)=>{o.addEventListener("pointerdown",A=>{if(A.preventDefault(),o.classList.add("on"),he(g),["up","down","left","right"].includes(g)){let I=window.setTimeout(function s(){he(g),I=window.setTimeout(s,110),l.set(g,I)},380);l.set(g,I)}});const y=()=>{o.classList.remove("on"),window.clearTimeout(l.get(g))};o.addEventListener("pointerup",y),o.addEventListener("pointercancel",y),o.addEventListener("pointerleave",y)},b=(o,g,y="",A="")=>{const I=e("button",{class:y,style:A},o);return f(I,g),I},C=e("div",{class:"cross"},b("▲","up","","grid-column:2;grid-row:1"),b("◀","left","","grid-column:1;grid-row:2"),b("▶","right","","grid-column:3;grid-row:2"),b("▼","down","","grid-column:2;grid-row:3")),k=e("div",{class:"okback"},b("MENU","pause","pause"),b("BACK","back","back"),b("OK","confirm","ok"));return t.append(n,r,e("div",{class:"remote"},C,k)),{key:"remote",update(o){i.textContent=m,c.textContent=o.say,r.textContent=o.sub??""},unmount(){for(const o of l.values())window.clearTimeout(o)}}},select(t){const{bar:n,say:c,chip:i}=X(),r=(T==null?void 0:T.roster)??[],l=e("div",{class:"grid"});let f=null;const b=[...r,"?"].map((s,P)=>{const O=P>=r.length,z=O?null:se(s),S=e("button",{class:`tile${O?" rand":""}`,style:O?"":`background-image:url(${ge(s)})`},O?"?":e("div",{class:"nm"},(z==null?void 0:z.name)??s));return S.addEventListener("pointerdown",x=>{x.preventDefault(),!(!f||f.locked)&&(f.cursor===P?j("lock"):j("hero",P))}),l.append(S),S}),C=[0,1].map(s=>e("div",{class:"slot"},e("span",{},s===0?"POINT":"PARTNER"))),k=e("div",{class:"hero-name"}),o=e("div",{class:"hero-title"}),g=e("button",{class:"big",onclick:()=>j("lock")},"LOCK IN"),y=e("button",{class:"ghost",onclick:()=>j("back")},"BACK"),A=e("button",{class:"ghost",onclick:()=>j("simple")},""),I=e("div",{class:"side"},e("div",{class:"slots"},...C),k,o,g,e("div",{class:"row"},y,A));return t.append(n,e("div",{class:"select"},l,I)),{key:"select",update(s){f=s,i.textContent=m,c.textContent=s.say;const P=ue[s.side??s.seat]??ue[0];document.documentElement.style.setProperty("--seat",P),b.forEach((E,D)=>{E.classList.toggle("hover",s.cursor===D),E.classList.toggle("taken",s.first===D)});const O=s.team!==!1;C[1].style.display=O?"":"none";const z=O?[s.first??-1,s.locked?s.cursor??-1:-1]:[s.locked?s.cursor??-1:-1];C.forEach((E,D)=>{const $=z[D]??-1;E.classList.toggle("full",$>=0),E.classList.toggle("next",$<0&&!s.locked&&D===(O&&(s.first??-1)>=0?1:0)),E.style.backgroundImage=$>=0&&r[$]?`url(${ge(r[$])})`:""});const S=s.cursor??0,x=S<r.length?se(r[S]):null;k.textContent=x?x.name:"RANDOM",o.textContent=x?x.archetype:"Let fate pick",k.style.color=x?at(x.color):"",g.textContent=s.locked?"READY!":O&&(s.first??-1)<0?`PICK ${x?x.name:"RANDOM"}`:`LOCK IN ${x?x.name:"RANDOM"}`,g.disabled=!!s.locked,A.textContent=s.simple?"EASY MOVES: ON":"EASY MOVES: OFF",A.style.display=s.simple===void 0?"none":""}}},stage(t){const{bar:n,say:c,chip:i}=X(),r=(T==null?void 0:T.stages)??[],l=e("div",{class:"stages"}),f=r.map((o,g)=>{const y=e("button",{class:"stage",style:`background-image:url(${nt(o.id)})`},e("span",{},o.name));return y.addEventListener("click",()=>j("stage",g)),l.append(y),y}),b=e("button",{class:"big",onclick:()=>j("lock")},"FIGHT!"),C=e("button",{class:"ghost",onclick:()=>j("back")},"BACK");t.append(n,l,e("div",{class:"foot"},C,b));let k=-1;return{key:"stage",update(o){var g;i.textContent=m,c.textContent=o.say,f.forEach((y,A)=>y.classList.toggle("hover",o.stage===A)),o.stage!==void 0&&o.stage!==k&&(k=o.stage,(g=f[o.stage])==null||g.scrollIntoView({block:"nearest",behavior:"smooth"}))}}},fight:ht},xt=[{label:"HEAVY",bits:Z,color:"#ff5a3d"},{label:"SPECIAL",bits:Q,color:"#8a5cff"},{label:"SUPER",sub:"H + S",bits:Z|Q,color:"#e0a000"},{label:"LIGHT",bits:J,color:"#2f7bff"},{label:"BLOCK",bits:ee,color:"#56607f"},{label:"ASSIST",sub:"PARTNER",bits:ee|J,color:"#1fae7a"}],bt=[{label:"THROW",bits:J|Z,color:""},{label:"HEAT",bits:J|Q,color:""},{label:"LAUNCH",bits:ee|Z,color:""},{label:"TAG",bits:ee|Q,color:""}];function ht(t){const n=e("div",{class:"seat"}),c=e("div",{class:"teamline"}),i=e("button",{class:"pausebtn",onclick:()=>he("pause")},"PAUSE"),r=e("div",{class:"say",style:"flex:none"}),l=e("div",{class:"bar"},n,c,r,i),f=[["▲",F,50,15],["▼",W,50,85],["◀",K,15,50],["▶",q,85,50]],b=f.map(([a,,p,u])=>e("div",{class:"arr",style:`left:${p}%;top:${u}%`},a)),C=e("div",{class:"knob"}),k=e("div",{class:"dpad"},e("div",{class:"lbl"},"▲ JUMP   ▼ CROUCH"),...b,C),o=e("div",{class:"dzone"},k),g=(a,p)=>e("button",{class:p,"data-bits":a.bits,style:a.color?`--c:${a.color}`:""},a.label,a.sub?e("small",{},a.sub):null),y=e("div",{class:"smalls"},...bt.map(a=>g(a,""))),A=e("div",{class:"btns"},...xt.map(a=>g(a,"btn"))),I=e("div",{class:"bzone"},y,A),s=e("div",{class:"pad"},o,I),P=e("div",{class:"teamcard"}),O=e("div",{class:"fight"},l,P,s,e("div",{class:"tip portrait-tip"},"Turn sideways for bigger buttons"));let z="";t.append(O);let S=null,x=0;const E=new Map,D=(a,p)=>{const u=k.getBoundingClientRect(),h=u.left+u.width/2,B=u.top+u.height/2,R=a-h,M=p-B;if(Math.hypot(R,M)<u.width*.13)return 0;const ae=(Math.atan2(-M,R)*180/Math.PI+360)%360,oe=je=>Math.abs((ae-je+540)%360-180)<=25;return oe(0)?q:oe(90)?F:oe(180)?K:oe(270)?W:ae<90?F|q:ae<180?F|K:ae<270?W|K:W|q},$=a=>{f.forEach(([,B],R)=>b[R].classList.toggle("on",(a&B)!==0));const p=(a&q?1:0)-(a&K?1:0),u=(a&W?1:0)-(a&F?1:0),h=p!==0&&u!==0?.7:1;C.style.transform=`translate(calc(-50% + ${p*h*55}%), calc(-50% + ${u*h*55}%))`},ne=()=>{let a=x;const p=new Set;for(const h of E.values())h&&(a|=Number(h.dataset.bits)||0,p.add(h));for(const h of[...Array.from(y.children),...Array.from(A.children)])h.classList.toggle("on",p.has(h));const u=Y;be(a),Y&~u&(J|Z|Q|ee)&&le(10)},we=(a,p)=>{const u=document.elementFromPoint(a,p),h=u==null?void 0:u.closest("[data-bits]");return h&&I.contains(h)?h:null},Oe=a=>{a.target.closest(".pausebtn")||(a.preventDefault(),ye(),S===null&&o.contains(a.target)?(S=a.pointerId,x=D(a.clientX,a.clientY),$(x)):E.set(a.pointerId,we(a.clientX,a.clientY)),ne())},$e=a=>{if(a.pointerId===S){const p=D(a.clientX,a.clientY);p!==x&&(x=p,$(p),ne())}else if(E.has(a.pointerId)){const p=we(a.clientX,a.clientY);p!==E.get(a.pointerId)&&(E.set(a.pointerId,p),ne())}a.preventDefault()},ke=a=>{a.pointerId===S&&(S=null,x=0,$(0)),E.delete(a.pointerId),ne()};s.addEventListener("pointerdown",Oe),s.addEventListener("pointermove",$e),s.addEventListener("pointerup",ke),s.addEventListener("pointercancel",ke);const Re=a=>a.preventDefault();return s.addEventListener("contextmenu",Re),{key:"fight",update(a){var B;n.textContent=a.seat===1?"P2":"P1";const p=((B=a.teams)==null?void 0:B[a.seat===1?1:0])??[],u=(T==null?void 0:T.roster)??[];c.textContent=p.map(R=>{var M;return((M=se(u[R]??""))==null?void 0:M.name)??""}).filter(Boolean).join(" + ")||m,r.textContent=a.say;const h=p.join(",");h!==z&&(z=h,P.replaceChildren(...p.map((R,M)=>{var pe;return e("div",{class:"tc"},e("div",{class:"tcimg",style:`background-image:url(${ge(u[R]??"")})`}),e("div",{class:"tcname"},((pe=se(u[R]??""))==null?void 0:pe.name)??""),e("div",{class:"tcrole"},M===0?"POINT":"PARTNER"))})))},unmount(){S=null,x=0,E.clear(),be(0)}}}function wt(){const t=document.querySelector("meta[name=viewport]");t==null||t.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"),document.title="After Hours · Controller";const n=document.createElement("style");n.textContent=Qe,document.head.append(n),document.body.append(G),document.addEventListener("gesturestart",c=>c.preventDefault()),document.addEventListener("dblclick",c=>c.preventDefault()),N(),L.length===4&&m&&ie()}export{wt as startPhone};
