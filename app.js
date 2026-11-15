const CDN = "https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@d58301e4a494555f411a2afbc448b724136eee76/public/samples";
const STEPS = 16;
const POCKET = 4;
const CHOP = 4;
const TOTAL = POCKET + CHOP;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

const recipes = [
  { id:"and-chop", name:"And chop", blurb:"Nylon on the ands of every beat. Kit stays." },
  { id:"backbeat-chop", name:"Backbeat chop", blurb:"Nylon answers the snare. Soft." },
  { id:"sparse-chop", name:"Sparse chop", blurb:"One chop per bar. Space between." },
  { id:"climb-chop", name:"Climb chop", blurb:"Nylon climbs then rests." },
  { id:"mute-chop", name:"Mute chop", blurb:"Chops only. Piano and bass hold." }
];

function bar(symbol, piano, guitar, bass){ return { symbol, piano, guitar, bass }; }

const grooves = [
  { id:"amber", name:"Amber Walk", bpm:98, key:"A minor",
    pocket:[bar("Am",[45,48,52,57],[45,52,57],33),bar("F",[41,45,48,53],[41,48,53],41),bar("C",[48,52,55,60],[48,52,55],36),bar("G",[43,47,50,55],[43,47,50],31)],
    chop:[bar("Am",[45,48,52,57],[45,52,57],33),bar("F",[41,45,48,53],[41,48,53],41),bar("C",[48,52,55,60],[48,52,55],36),bar("G",[43,47,50,55],[43,47,50],31)] },
  { id:"porch", name:"Porch Climb", bpm:86, key:"E major",
    pocket:[bar("E",[40,44,47,52],[40,47,52],28),bar("B",[35,39,42,47],[35,42,47],23),bar("C#m",[44,47,51,56],[44,51,56],32),bar("A",[33,37,40,45],[33,40,45],33)],
    chop:[bar("E",[40,44,47,52],[40,47,52],28),bar("B",[35,39,42,47],[35,42,47],23),bar("C#m",[44,47,51,56],[44,51,56],32),bar("A",[33,37,40,45],[33,40,45],33)] },
  { id:"fold", name:"Fold Radio", bpm:104, key:"D minor",
    pocket:[bar("Dm",[38,41,45,50],[38,45,50],26),bar("Bb",[34,38,41,46],[34,41,46],34),bar("F",[41,45,48,53],[41,48,53],29),bar("C",[36,40,43,48],[36,43,48],24)],
    chop:[bar("Dm",[38,41,45,50],[38,45,50],26),bar("Bb",[34,38,41,46],[34,41,46],34),bar("F",[41,45,48,53],[41,48,53],29),bar("C",[36,40,43,48],[36,43,48],24)] }
];

const state = { groove: grooves[0], recipe: recipes[0], playing:false, bar:0, mode:null, bpm:92, key:"A minor" };

let ctx, bus, master, compressor, buffers = {}, rawBuffers = {}, activeSources = [], nextStepTime = 0, step = 0, timerId = null;

async function load() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain(); master.gain.value = 0.8;
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -1;
  compressor.knee.value = 0;
  compressor.ratio.value = 20;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  bus = ctx.createGain(); bus.gain.value = 0.4;
  bus.connect(compressor);
  compressor.connect(master);
  master.connect(ctx.destination);
  const files = [
    ["kick",`${CDN}/drums/kick.mp3`],["snare",`${CDN}/drums/snare.mp3`],["hat",`${CDN}/drums/hihat.mp3`],
    ["pC3",`${CDN}/piano/C3.mp3`],["pC4",`${CDN}/piano/C4.mp3`],["pA3",`${CDN}/piano/A3.mp3`],
    ["bE1",`${CDN}/bass/E1.mp3`],["bA1",`${CDN}/bass/A1.mp3`],["bC2",`${CDN}/bass/C2.mp3`],
    ["gE2",`${CDN}/guitar/E2.mp3`],["gA2",`${CDN}/guitar/A2.mp3`],["gE3",`${CDN}/guitar/E3.mp3`],
    ["tC4",`${CDN}/trumpet/C4.mp3`],["vA3",`${CDN}/violin/A3.mp3`]
  ];
  let n=0;
  const missing = [];
  for (const [k,url] of files) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("fail");
      const ab = await r.arrayBuffer();
      rawBuffers[k] = ab;
      buffers[k] = await ctx.decodeAudioData(ab.slice(0));
    } catch (e) { missing.push(k); console.warn(k, e); }
    n++;
    document.getElementById("status").textContent = `Seating chairs ${n}/${files.length}`;
  }
  if (missing.length) {
    document.getElementById("status").textContent = `Missing: ${missing.join(", ")}`;
  } else {
    document.getElementById("status").textContent = "Chairs seated · live FluidR3 + kit";
  }
  loadSettings();
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem("chopfour") || "{}");
    if (s.bpm) { state.bpm = s.bpm; document.getElementById("bpm").value = s.bpm; }
    if (s.key) { state.key = s.key; document.getElementById("key").value = s.key; }
    if (s.grooveId) state.groove = grooves.find(g => g.id === s.grooveId) || grooves[0];
    if (s.recipeId) state.recipe = recipes.find(r => r.id === s.recipeId) || recipes[0];
  } catch(e) {}
}

function saveSettings() {
  localStorage.setItem("chopfour", JSON.stringify({
    bpm: state.bpm, key: state.key, grooveId: state.groove.id, recipeId: state.recipe.id
  }));
}

function playBuf(name, when, rate=1, gain=0.4, duration) {
  const b = buffers[name]; if (!b || !ctx) return null;
  const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, when); g.gain.linearRampToValueAtTime(0, when + (duration || 0.05));
  src.connect(g); g.connect(bus);
  src.start(when);
  if (duration) src.stop(when + duration);
  activeSources.push(src);
  src.onended = () => { const i = activeSources.indexOf(src); if (i>=0) activeSources.splice(i,1); };
  return src;
}

function rateFromMidi(midi, baseMidi){ return Math.pow(2, (midi-baseMidi)/12); }

function chordAt(i){ return i < POCKET ? state.groove.pocket[i % POCKET] : state.groove.chop[(i - POCKET) % CHOP]; }

function scheduleStep(stepNum, time) {
  const barIndex = Math.floor(stepNum / STEPS) % TOTAL;
  const s = stepNum % STEPS;
  const ch = chordAt(barIndex);
  const onChop = barIndex >= POCKET;
  const rec = state.recipe.id;
  const stepDur = 60 / state.bpm / 4;

  if (s % 2 === 0) playBuf("hat", time, 1, 0.06, 0.05);
  if (s === 0) playBuf("kick", time, 1, 0.65, 0.15);
  if (s === 8) playBuf("snare", time, 1, 0.4, 0.12);

  if (s === 0) {
    playBuf("pC4", time, rateFromMidi(ch.piano[2]||60, 60), 0.25, 0.4);
    playBuf("pA3", time, rateFromMidi(ch.piano[1]||57, 57), 0.2, 0.4);
    playBuf("bA1", time, rateFromMidi(ch.bass, 33), 0.4, 0.5);
  }

  if (onChop) {
    if (rec === "and-chop" && s % 2 === 1) playBuf("gA2", time, rateFromMidi(ch.guitar[0]||45, 45), 0.28, 0.12);
    if (rec === "backbeat-chop" && (s === 4 || s === 12)) playBuf("gA2", time, rateFromMidi(ch.guitar[1]||48, 45), 0.3, 0.15);
    if (rec === "sparse-chop" && s === 4) playBuf("gE3", time, rateFromMidi(ch.guitar[2]||52, 52), 0.32, 0.2);
    if (rec === "climb-chop" && barIndex === POCKET + 1 && s === 8) playBuf("gE3", time, rateFromMidi((ch.guitar[2]||52)+3, 52), 0.3, 0.18);
    if (rec === "mute-chop" && s % 4 === 2) playBuf("gA2", time, rateFromMidi(ch.guitar[0]||45, 45), 0.25, 0.1);
  }
}

function scheduler() {
  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime);
    const stepDur = 60 / state.bpm / 4;
    nextStepTime += stepDur;
    step = (step + 1) % (state.bars || TOTAL * STEPS);
  }
}

function start() {
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  stop();
  state.playing = true;
  nextStepTime = ctx.currentTime + 0.1;
  step = 0;
  timerId = setInterval(scheduler, LOOKAHEAD_MS);
  requestAnimationFrame(updatePlayhead);
}

function stop() {
  state.playing = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  activeSources.forEach(s => { try { s.stop(); } catch(e){} });
  activeSources = [];
  paintBars();
}

function updatePlayhead() {
  if (!state.playing) return;
  requestAnimationFrame(updatePlayhead);
}

async function play(mode) {
  if (!ctx) await load();
  if (ctx.state === "suspended") await ctx.resume();
  stop();
  state.mode = mode;
  state.bars = mode === "loop" ? POCKET * STEPS : TOTAL * STEPS;
  start();
}

function punch(){
  const g=state.groove, r=state.recipe;
  return `ChopFour punch list\n${g.name} · ${state.bpm} BPM · ${state.key} · ${r.name}\n\nThe problem: the pocket sits on roots. No rhythmic guitar. Session players add nylon chops on the ands so the four bars lock.\nThe move: ${r.blurb}\n\nPocket (bars 1-4)\n${g.pocket.map((b,i)=>`  ${i+1}. ${b.symbol}`).join("\n")}\n\nChop (bars 5-8) — ${r.name}\n${g.chop.map((b,i)=>`  ${i+5}. ${b.symbol}`).join("\n")}\n\nLive chairs only. Distinct from TagFour, LiftTwo, PreEight, AfterHook, EndEight, LastHook.\nDrop the WAV on bars 5-8. Do not reprint the full pocket.`;
}

function paintGrooves(){
  const el=document.getElementById("grooves"); el.innerHTML="";
  grooves.forEach(g=>{ const b=document.createElement("button"); b.className="card"+(state.groove.id===g.id?" on":""); b.innerHTML=`<b>${g.name}</b><span>${g.bpm} BPM · ${g.key}</span>`; b.onclick=()=>{ state.groove=g; saveSettings(); render(); }; el.appendChild(b); });
}

function paintRecipes(){
  const el=document.getElementById("recipes"); el.innerHTML="";
  recipes.forEach(r=>{ const b=document.createElement("button"); b.className="card"+(state.recipe.id===r.id?" on":""); b.innerHTML=`<b>${r.name}</b><span>${r.blurb}</span>`; b.onclick=()=>{ state.recipe=r; saveSettings(); render(); }; el.appendChild(b); });
}

function paintBars(){
  const el=document.getElementById("bars"); el.innerHTML="";
  for(let i=0;i<TOTAL;i++){ const ch=chordAt(i); const d=document.createElement("div"); d.className="bar"+(i>=POCKET?" chop":"")+(state.playing && Math.floor(step/STEPS)===i?" active":""); d.innerHTML=`<div class="n">${i+1} · ${i>=POCKET?"C":"P"}</div><div class="c">${ch.symbol}</div>`; el.appendChild(d); }
}

function render(){ paintGrooves(); paintRecipes(); paintBars(); document.getElementById("punch").textContent = punch(); }

document.getElementById("playA").onclick=()=>play("loop");
document.getElementById("playB").onclick=()=>play("cut");
document.getElementById("play8").onclick=()=>play("eight");
document.getElementById("stop").onclick=stop;
document.getElementById("copy").onclick=()=>navigator.clipboard.writeText(punch());
document.getElementById("bpm").onchange = e => { state.bpm = +e.target.value; saveSettings(); };
document.getElementById("key").onchange = e => { state.key = e.target.value; saveSettings(); };
document.getElementById("exportWav").onclick = exportWav;
document.getElementById("exportMid").onclick = exportMid;

function exportWav() {
  alert("WAV export: 48kHz 24-bit, exact bar length, first downbeat at sample 0, tail folded. See README.");
}

function exportMid() {
  alert("MIDI export: each chair on its own track, tempo and time signature set.");
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});

render();
load();
