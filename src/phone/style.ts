// The phone controller's look. Plain CSS in a string, injected once.
export const PHONE_CSS = `
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
`;
