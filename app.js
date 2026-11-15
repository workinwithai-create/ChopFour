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

const SAMPLE_RATE = 48000;

async function exportWav() {
  if (!ctx || Object.keys(buffers).length < 5) { alert("Load samples first"); return; }
  const bars = TOTAL;
  const stepDur = 60 / state.bpm / 4;
  const totalSteps = bars * STEPS;
  const exactSamples = Math.round(bars * 4 * 60 / state.bpm * SAMPLE_RATE);
  const offline = new OfflineAudioContext(2, exactSamples + SAMPLE_RATE, SAMPLE_RATE);
  const offBuffers = {};
  for (const [k, ab] of Object.entries(rawBuffers)) {
    offBuffers[k] = await offline.decodeAudioData(ab.slice(0));
  }
  function playOff(name, when, rate=1, gain=0.4, duration) {
    const b = offBuffers[name]; if (!b) return;
    const src = offline.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = offline.createGain(); g.gain.setValueAtTime(gain, when); g.gain.linearRampToValueAtTime(0, when + (duration || 0.05));
    src.connect(g); g.connect(offline.destination);
    src.start(when);
    if (duration) src.stop(when + duration);
  }
  for (let s = 0; s < totalSteps; s++) {
    const time = s * stepDur;
    const barIndex = Math.floor(s / STEPS) % TOTAL;
    const stepIn = s % STEPS;
    const ch = chordAt(barIndex);
    const onChop = barIndex >= POCKET;
    const rec = state.recipe.id;
    if (stepIn % 2 === 0) playOff("hat", time, 1, 0.06, 0.05);
    if (stepIn === 0) playOff("kick", time, 1, 0.65, 0.15);
    if (stepIn === 8) playOff("snare", time, 1, 0.4, 0.12);
    if (stepIn === 0) {
      playOff("pC4", time, rateFromMidi(ch.piano[2]||60, 60), 0.25, 0.4);
      playOff("pA3", time, rateFromMidi(ch.piano[1]||57, 57), 0.2, 0.4);
      playOff("bA1", time, rateFromMidi(ch.bass, 33), 0.4, 0.5);
    }
    if (onChop) {
      if (rec === "and-chop" && stepIn % 2 === 1) playOff("gA2", time, rateFromMidi(ch.guitar[0]||45, 45), 0.28, 0.12);
      if (rec === "backbeat-chop" && (stepIn === 4 || stepIn === 12)) playOff("gA2", time, rateFromMidi(ch.guitar[1]||48, 45), 0.3, 0.15);
      if (rec === "sparse-chop" && stepIn === 4) playOff("gE3", time, rateFromMidi(ch.guitar[2]||52, 52), 0.32, 0.2);
      if (rec === "climb-chop" && barIndex === POCKET + 1 && stepIn === 8) playOff("gE3", time, rateFromMidi((ch.guitar[2]||52)+3, 52), 0.3, 0.18);
      if (rec === "mute-chop" && stepIn % 4 === 2) playOff("gA2", time, rateFromMidi(ch.guitar[0]||45, 45), 0.25, 0.1);
    }
  }
  const rendered = await offline.startRendering();
  const tailSamples = Math.floor(0.5 * SAMPLE_RATE);
  const ch0 = rendered.getChannelData(0);
  const ch1 = rendered.getChannelData(1);
  for (let i = 0; i < tailSamples && i < exactSamples; i++) {
    const tIdx = exactSamples + i;
    if (tIdx < ch0.length) {
      ch0[i] += ch0[tIdx] * 0.5;
      ch1[i] += ch1[tIdx] * 0.5;
    }
  }
  let peak = 0;
  for (let i = 0; i < exactSamples; i++) {
    peak = Math.max(peak, Math.abs(ch0[i]), Math.abs(ch1[i]));
  }
  const scale = peak > 0 ? Math.pow(10, -1/20) / peak : 1;
  for (let i = 0; i < exactSamples; i++) {
    ch0[i] *= scale;
    ch1[i] *= scale;
  }
  const wav = encodeWav(rendered, exactSamples);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([wav], {type:"audio/wav"}));
  a.download = `chopfour-${state.recipe.id}-${state.bpm}bpm-${state.key.replace(/\s+/g,"")}.wav`;
  a.click();
}

function encodeWav(audioBuffer, lengthSamples) {
  const numChannels = 2;
  const sampleRate = SAMPLE_RATE;
  const bitDepth = 24;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = lengthSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = audioBuffer.getChannelData(1);
  for (let i = 0; i < lengthSamples; i++) {
    const s0 = Math.max(-1, Math.min(1, ch0[i] || 0));
    const s1 = Math.max(-1, Math.min(1, ch1[i] || 0));
    const i0 = Math.round(s0 * 0x7FFFFF);
    const i1 = Math.round(s1 * 0x7FFFFF);
    view.setUint8(offset, i0 & 0xFF); view.setUint8(offset+1, (i0>>8)&0xFF); view.setUint8(offset+2, (i0>>16)&0xFF);
    view.setUint8(offset+3, i1 & 0xFF); view.setUint8(offset+4, (i1>>8)&0xFF); view.setUint8(offset+5, (i1>>16)&0xFF);
    offset += 6;
  }
  return buffer;
}
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

function exportMid() {
  const bpm = state.bpm;
  const ticksPerBeat = 480;
  const stepTicks = ticksPerBeat / 4;
  const bars = TOTAL;
  const tracks = [[], [], [], []];
  for (let s = 0; s < bars * STEPS; s++) {
    const time = s * stepTicks;
    const barIndex = Math.floor(s / STEPS) % TOTAL;
    const stepIn = s % STEPS;
    const ch = chordAt(barIndex);
    const onChop = barIndex >= POCKET;
    const rec = state.recipe.id;
    if (stepIn % 2 === 0) tracks[0].push({time, note:42, dur:stepTicks/2, vel:40});
    if (stepIn === 0) tracks[0].push({time, note:36, dur:stepTicks, vel:100});
    if (stepIn === 8) tracks[0].push({time, note:38, dur:stepTicks, vel:80});
    if (stepIn === 0) {
      (ch.piano || []).forEach(n => tracks[1].push({time, note:n, dur:stepTicks*4, vel:70}));
      tracks[2].push({time, note:ch.bass, dur:stepTicks*4, vel:80});
    }
    if (onChop && rec === "and-chop" && stepIn % 2 === 1) tracks[3].push({time, note:ch.guitar[0]||45, dur:stepTicks, vel:60});
  }
  const midi = buildMidi(tracks, bpm, ticksPerBeat);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([midi], {type:"audio/midi"}));
  a.download = `chopfour-${state.recipe.id}-${state.bpm}bpm-${state.key.replace(/\s+/g,"")}.mid`;
  a.click();
}

function buildMidi(tracks, bpm, tpb) {
  const header = [0x4D,0x54,0x68,0x64, 0,0,0,6, 0,1, 0,tracks.length, (tpb>>8)&0xFF, tpb&0xFF];
  const trackData = tracks.map(notes => {
    const events = [];
    const us = Math.round(60000000 / bpm);
    events.push(...vlq(0), 0xFF, 0x51, 3, (us>>16)&0xFF, (us>>8)&0xFF, us&0xFF);
    events.push(...vlq(0), 0xFF, 0x58, 4, 4, 2, 24, 8);
    notes.sort((a,b)=>a.time-b.time);
    let last = 0;
    notes.forEach(n => {
      const delta = n.time - last;
      events.push(...vlq(delta), 0x90, n.note, n.vel);
      events.push(...vlq(n.dur), 0x80, n.note, 0);
      last = n.time + n.dur;
    });
    events.push(...vlq(0), 0xFF, 0x2F, 0);
    const len = events.length;
    return [0x4D,0x54,0x72,0x6B, (len>>24)&0xFF, (len>>16)&0xFF, (len>>8)&0xFF, len&0xFF, ...events];
  });
  return new Uint8Array([...header, ...trackData.flat()]);
}
function vlq(n) {
  const bytes = [];
  do {
    bytes.unshift(n & 0x7F);
    n >>= 7;
  } while (n);
  for (let i=0; i<bytes.length-1; i++) bytes[i] |= 0x80;
  return bytes;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});

render();
load();
