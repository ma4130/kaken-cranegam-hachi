// はっちー専用Firebaseでスマホ操作できる3Dクレーンゲーム。
import * as THREE from 'three';
import { connectRoom } from './net.js';
import { installControlSwitch } from './controls.js';


const qs = new URLSearchParams(location.search);
const TEST = qs.has('test');
const PRIZE_COUNT = 12;
const $ = (id) => document.getElementById(id);

// ---------- 3D シーン ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
scene.background = canvasTex(16, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#fff5dc'); gr.addColorStop(.55, '#f6e3b7'); gr.addColorStop(1, '#d7b787');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

scene.add(new THREE.HemisphereLight(0xffffff, 0xbfa776, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 14, 7); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
scene.add(sun);
const pl1 = new THREE.PointLight(0xffda74, 30, 20); pl1.position.set(-4, 6.5, 3); scene.add(pl1);
const pl2 = new THREE.PointLight(0xfff2cd, 30, 20); pl2.position.set(4, 6.5, -2); scene.add(pl2);

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...o });
function box(w, h, d, m, x, y, z, parent = scene) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; parent.add(b); return b;
}

// 床・筐体
const FX = 5, FZ = 4;                                  // 床の半分の大きさ
const CHUTE = { x1: -FX, x2: -2.6, z1: 1.6, z2: FZ };   // 景品のおとし口（手前の左）
const HOME = { x: -3.8, z: 2.8 };
const LIM = { x: 4.3, z: -3.3 };
const TOP_Y = 6, GRAB_Y = 1.9, CARRY = 1.9, SPEED = 2.2;

const floorTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#fff8e5'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f3dfae'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(5, 4);
box(FX * 2, .4, FZ * 2, mat(0xffffff, { map: floorTex }), 0, -.2, 0);
const hole = new THREE.Mesh(new THREE.PlaneGeometry(CHUTE.x2 - CHUTE.x1, CHUTE.z2 - CHUTE.z1), new THREE.MeshBasicMaterial({ color: 0x1a0a33 }));
hole.rotation.x = -Math.PI / 2; hole.position.set((CHUTE.x1 + CHUTE.x2) / 2, .01, (CHUTE.z1 + CHUTE.z2) / 2); scene.add(hole);
const fenceM = mat(0x8b3033, { transparent: true, opacity: .55 });
box(.12, .8, CHUTE.z2 - CHUTE.z1, fenceM, CHUTE.x2, .4, (CHUTE.z1 + CHUTE.z2) / 2);
box(CHUTE.x2 - CHUTE.x1, .8, .12, fenceM, (CHUTE.x1 + CHUTE.x2) / 2, .4, CHUTE.z1);
const arrowTex = canvasTex(256, 128, (g) => {
  g.fillStyle = '#ffd93b'; g.font = 'bold 80px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GET!', 128, 68);
});
const getLabel = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true }));
getLabel.rotation.x = -Math.PI / 2; getLabel.position.set(-3.8, .02, 2.8); scene.add(getLabel);

// 台（外枠・柱・看板はなし。床と うすい土台だけ）
box(FX * 2 + .5, .5, FZ * 2 + .5, mat(0x8b3033), 0, -.66, 0);
box(FX * 2 + .7, .22, FZ * 2 + .7, mat(0xffd93b), 0, -.5, 0);

// クレーン
const steelM = mat(0xd8dcec, { metalness: .8, roughness: .25 });
box(FX * 2 + .4, .2, .2, steelM, 0, 7.5, -FZ - .1); box(FX * 2 + .4, .2, .2, steelM, 0, 7.5, FZ + .1);
const beam = box(.3, .22, FZ * 2 + .4, steelM, 0, 7.5, 0);
const trolley = box(.9, .5, .9, mat(0xffd93b), 0, 7.2, 0);
const cable = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1, 8), mat(0x555566)); scene.add(cable);
const claw = new THREE.Group(); scene.add(claw);
const hub = new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, .5, 20), mat(0x8b3033, { metalness: .3 }));
hub.castShadow = true; claw.add(hub);
const hinges = [];
for (let i = 0; i < 3; i++) {
  const finger = new THREE.Group(); finger.rotation.y = i * Math.PI * 2 / 3 + Math.PI / 2; claw.add(finger);
  const hinge = new THREE.Group(); hinge.position.y = -.15; finger.add(hinge);
  box(.12, 1, .22, steelM, 0, -.5, 0, hinge);
  const elbow = new THREE.Group(); elbow.position.y = -1; elbow.rotation.z = -.7; hinge.add(elbow);
  box(.12, .8, .22, steelM, 0, -.4, 0, elbow);
  hinges.push(hinge);
}
const marker = new THREE.Mesh(new THREE.RingGeometry(.55, .72, 32), new THREE.MeshBasicMaterial({ color: 0xc2613b, transparent: true, opacity: .8 }));
marker.rotation.x = -Math.PI / 2; marker.position.y = .03; scene.add(marker);

const crane = { x: HOME.x, z: HOME.z, y: TOP_Y, open: 0 };   // open: 0=とじる 1=ひらく
function placeCrane() {
  beam.position.x = crane.x; trolley.position.set(crane.x, 7.2, crane.z);
  claw.position.set(crane.x, crane.y, crane.z);
  const len = 7.0 - crane.y; cable.scale.y = len; cable.position.set(crane.x, crane.y + len / 2, crane.z);
  hinges.forEach((h) => { h.rotation.z = .35 + crane.open * .5; });
  marker.position.x = crane.x; marker.position.z = crane.z;
}

// ---------- 景品 ----------
const PRIZES = [
  {name:'電気科', key:'電気科', mark:'電', color:'#a84739', emoji:'電気科', s:.9},
  {name:'機械科', key:'機械科', mark:'機', color:'#567f83', emoji:'機械科', s:.9},
  {name:'環境化学コース', key:'環境化学', mark:'化', color:'#76824a', emoji:'環境化学', s:.9},
  {name:'電力管理コース', key:'電力管理', mark:'力', color:'#ad8438', emoji:'電力管理', s:.9},
];
const caught = new Set();
const localImages = new Map();
function badgeTexture(d) {
  return canvasTex(256,320,(g,w,h)=>{
    g.fillStyle='#fff8e9';g.beginPath();g.roundRect(15,12,226,296,45);g.fill();
    g.strokeStyle=d.color;g.lineWidth=9;g.stroke();
    g.fillStyle=d.color;g.beginPath();g.moveTo(128,38);g.lineTo(211,83);g.lineTo(211,182);g.lineTo(128,227);g.lineTo(45,182);g.lineTo(45,83);g.closePath();g.fill();
    g.textAlign='center';g.fillStyle='#fff5cd';g.font='900 88px sans-serif';g.fillText(d.mark,128,167);
    g.fillStyle=d.color;g.font='bold 21px sans-serif';g.fillText('HACCHI',128,273);
  });
}
PRIZES.forEach(d=>{ d.texture=badgeTexture(d); });
function renderCollection(){
  $('collection-count').textContent=`${caught.size} / 4`;
  $('collection').replaceChildren(...PRIZES.map(d=>{
    const card=document.createElement('div');card.className='prize-card'+(caught.has(d.key)?' caught':'');
    if(localImages.has(d.key)){const img=document.createElement('img');img.src=localImages.get(d.key);img.alt=d.name+'のはっちー';card.append(img);}
    else {const badge=document.createElement('div');badge.className='badge';badge.style.setProperty('--badge',d.color);badge.textContent=d.mark;card.append(badge);}
    const label=document.createElement('span');label.textContent=d.name;card.append(label);return card;
  }));
}
function sizeSprite(sprite,texture){
  const ratio=texture.image.width/texture.image.height;
  const height=Math.min(2.25,1.9/ratio);sprite.scale.set(height*ratio,height,1);
}
function buildPrize(d) {
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.63,.7,.18,32),mat(0xfff4dc));base.position.y=.09;base.castShadow=true;g.add(base);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:d.texture,transparent:true,depthWrite:false}));
  sprite.position.y=1.22;sizeSprite(sprite,d.texture);g.add(sprite);
  g.userData={r:.65,h:2.4,sprite};return g;
}
$('image-files').addEventListener('change',async(e)=>{
  let count=0;const errors=[];
  for(const file of e.target.files){
    const d=PRIZES.find(d=>file.name.includes(d.key));if(!d)continue;
    if(file.size>10*1024*1024){errors.push(file.name+' は10MB以下にしてください');continue;}
    const url=URL.createObjectURL(file);
    try {
      const texture=await new THREE.TextureLoader().loadAsync(url);texture.colorSpace=THREE.SRGBColorSpace;
      const old=d.texture;d.texture=texture;
      for(const p of prizes.filter(p=>p.def===d)){p.mesh.userData.sprite.material.map=texture;p.mesh.userData.sprite.material.needsUpdate=true;sizeSprite(p.mesh.userData.sprite,texture);}
      old.dispose();const oldUrl=localImages.get(d.key);if(oldUrl)URL.revokeObjectURL(oldUrl);localImages.set(d.key,url);count++;
    }catch{URL.revokeObjectURL(url);errors.push(file.name+' を読み込めませんでした');}
  }
  renderCollection();$('image-status').textContent=`${localImages.size} / 4 種類を設定済み。`+(count?' この画面だけで使用中。':' ファイル名を確認してください。')+errors.join(' / ');
});
renderCollection();

let prizes = [];   // {def, mesh, x, z, r}
const inChute = (x, z, pad = 0) => x < CHUTE.x2 + pad && z > CHUTE.z1 - pad;
function freeSpot(r) {
  for (let i = 0; i < 300; i++) {
    const x = -4.2 + Math.random() * 8.4, z = -3.3 + Math.random() * 6.6;
    if (inChute(x, z, r + .3)) continue;
    if (prizes.every((p) => Math.hypot(p.x - x, p.z - z) > (p.r + r) * (i < 200 ? 1 : .7))) return { x, z };
  }
  return { x: 2, z: -2 };
}
function spawnPrize(def, animate) {
  const mesh = buildPrize(def); const r = mesh.userData.r; const { x, z } = freeSpot(r);
  mesh.position.set(x, animate ? 9 + Math.random() * 3 : 0, z); mesh.rotation.y = (Math.random() - .5) * 1.2;
  scene.add(mesh);
  const p = { def, mesh, x, z, r }; prizes.push(p);
  const y0 = mesh.position.y;
  if (animate) tween(.7 + Math.random() * .4, (k) => { mesh.position.y = (1 - k * k) * y0; });
  return p;
}
function fillPrizes(animate) {
  while(prizes.length<PRIZE_COUNT) spawnPrize(PRIZES[prizes.length%4],animate);
}

// ---------- アニメーション ----------
const tweens = [];
const tween = (dur, fn) => new Promise((res) => tweens.push({ t: 0, dur, fn, res }));
const wait = (d) => tween(d, () => {});
const ease = (k) => k * k * (3 - 2 * k);

// ---------- 音 ----------
let ac = null, hum = null;
function beep(f, d = .12, type = 'square', v = .08, when = 0) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + when;
  o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02);
}
function setHum(on) {
  if (!ac) return;
  if (on && !hum) {
    const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
    o.type = 'triangle'; o.frequency.value = 330; g.gain.value = .05; l.frequency.value = 8; lg.gain.value = 40;
    l.connect(lg).connect(o.frequency); o.connect(g).connect(ac.destination); o.start(); l.start(); hum = { o, l };
  } else if (!on && hum) { hum.o.stop(); hum.l.stop(); hum = null; }
}
const fanfare = () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => beep(f, .22, 'square', .09, i * .11));
const sad = () => [392, 330, 262, 196].forEach((f, i) => beep(f, .3, 'triangle', .1, i * .2));

// ---------- 画面の表示 ----------
let bannerTimer = 0;
function banner(html, ms = 1800) {
  const b = $('banner'); b.innerHTML = html; b.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
}
function confetti() {
  const chars = ['🎉', '⭐', '🎊', '✨', '💖'];
  for (let i = 0; i < 36; i++) {
    const s = document.createElement('span'); s.className = 'confetti'; s.textContent = chars[i % chars.length];
    s.style.left = Math.random() * 74 + 'vw'; s.style.animationDuration = 1.6 + Math.random() * 1.6 + 's'; s.style.animationDelay = Math.random() * .5 + 's';
    document.body.appendChild(s); setTimeout(() => s.remove(), 4200);
  }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const GUIDE = {
  idle: '「あそぶ」でチャレンジ！',
  x: '① 右へ動かして、よい位置で離そう',
  z: '② 奥へ動かして、よい位置で離そう',
  auto: 'つかめるかな…？',
};
const gets = [];
function renderHud() {
  $('guide').textContent = GUIDE[phase];
  $('now').textContent = cur ? `${cur.name} さん` : 'スタンバイ';
  $('left').textContent = cur ? `のこり ${cur.left} かい` : '何回でもチャレンジ！';
  $('gets').textContent = gets.length ? `これまで ${gets.length} 個ゲット！` : '';
  $('play').disabled = phase !== 'idle' || queue.length > 0;
  $('move-x').disabled = phase !== 'x' || cur?.id !== 'kbd';
  $('move-z').disabled = phase !== 'z' || cur?.id !== 'kbd';
  $('play').textContent = gets.length ? 'もう一度 ▶' : 'あそぶ ▶';
  controls?.sync();
  $('queue-count').textContent=queue.length+' 人';
  $('queue').replaceChildren(...queue.slice(0,8).map((id,index)=>{
    const li=document.createElement('li'),b=document.createElement('b');b.textContent=index+1;
    li.append(b,known[id].name+' さん');return li;
  }));
  if(!queue.length){const li=document.createElement('li');li.textContent='待っている人はいません';$('queue').append(li);}


}

// ---------- ゲームの進行 ----------
const known = {};
let cur=null,phase='idle',last=null,lastN=0,ax=null,phaseT=0,now=0;
let net=null,queue=[],turn='',turnN=0,connecting=false,controls=null;
const epoch=crypto.randomUUID();
function roomState(){return {epoch,phase,turn,cur,queue:queue.map(id=>({id,name:known[id].name})),last,t:Date.now()};}
function networkError(e){console.error(e);$('network-status').textContent='スマホ接続が止まっています。通信を確認して画面を読み込み直してください。';}
function publish(){renderHud();net?.setRoom(roomState()).catch(networkError);}
function nextTurn(){
  if(cur||phase!=='idle')return;
  const previous=queue.length;
  queue=queue.filter(id=>{if(known[id]&&Date.now()-known[id].ping<180000)return true;if(known[id])known[id].state='done';return false;});
  if(!queue.length){if(previous)publish();else renderHud();return;}
  const id=queue.shift();known[id].state='play';cur={id,name:known[id].name,left:2};startPlay(true);
}
function onPlayers(players){
  let changed=false;
  for(const [id,p] of Object.entries(players)){
    if(p.epoch!==epoch){net.removePlayer(id).catch(networkError);continue;}
    let k=known[id];
    if(!k){
      if(queue.length>=100){net.removePlayer(id).catch(networkError);continue;}
      k=known[id]={name:String(p.name).slice(0,8),n:p.ev.n,join:p.join,ping:p.ping,state:'queue'};queue.push(id);changed=true;
    }else{
      k.ping=p.ping;
      if(k.state==='done'&&p.join>k.join){Object.assign(k,{name:String(p.name).slice(0,8),join:p.join,n:p.ev.n,state:'queue'});queue.push(id);changed=true;}
      if(p.ev.n>k.n){k.n=p.ev.n;if(cur?.id===id&&p.ev.turn===turn)input(p.ev.k,p.ev.down,p.ev.dur);}
    }
  }
  const previous=queue.length;queue=queue.filter(id=>{if(players[id])return true;known[id].state='done';return false;});if(queue.length!==previous)changed=true;
  if(cur && cur.id!=='kbd' && !players[cur.id] && phase!=='auto'){
    const x=crane.x,z=crane.z;phase='auto';ax=null;setHum(false);publish();
    tween(.8,k=>{crane.x=x+(HOME.x-x)*k;crane.z=z+(HOME.z-z)*k;}).then(endTurn);
    return;
  }
  if(changed){publish();nextTurn();}
}

function startPlay(first) {
  turn=epoch+':'+(++turnN);
  crane.x=HOME.x;crane.z=HOME.z;
  phase = 'x'; ax = { state: 'wait' }; phaseT = now;
  banner(first ? `${esc(cur.name)} さんの ばん！<small>① 右へ動かそう</small>` : `もう いっかい！<small>のこり ${cur.left} かい</small>`, 1700);
  beep(660, .1); beep(880, .15, 'square', .08, .12);
  publish();
}
function endTurn() {
  if (cur && known[cur.id]) known[cur.id].state = 'done';
  cur = null; phase = 'idle'; ax = null; setHum(false);
  publish(); nextTurn();
}

// スマホ（またはキーボード）からの入力。down=おした / up=はなした（dur=おしていたミリ秒）
function input(k, down, dur) {
  if (!cur || phase !== k || !ax) return;
  const pos = k === 'x' ? crane.x : crane.z;
  if (down) {
    if (ax.state === 'wait') { ax.state = 'hold'; ax.start = pos; ax.t0 = now; setHum(true); }
  } else if (ax.state === 'wait' || ax.state === 'hold') {
    if (ax.state === 'wait') { ax.start = pos; ax.t0 = now; }
    const sec = dur != null ? Math.min(dur, 10000) / 1000 : now - ax.t0;
    ax.target = k === 'x' ? Math.min(LIM.x, ax.start + SPEED * sec) : Math.max(LIM.z, ax.start - SPEED * sec);
    ax.state = 'settle';
  }
}

function stepAxis(dt) {
  if (phase !== 'x' && phase !== 'z') return;
  const k = phase, dir = k === 'x' ? 1 : -1, lim = LIM[k];
  let pos = k === 'x' ? crane.x : crane.z;
  if (ax.state === 'wait') {
    const limit = k === 'x' ? 25 : 15;
    if (now - phaseT > limit) {
      if (k === 'x') { banner('じかんぎれ…<small>つぎの人へ</small>', 1600); endTurn(); return; }
      ax.target = pos; ax.state = 'settle';
    }
  } else if (ax.state === 'hold') {
    pos += dir * SPEED * dt; pos = dir > 0 ? Math.min(lim, pos) : Math.max(lim, pos);
    if (now - ax.t0 > 9) { ax.target = pos; ax.state = 'settle'; }       // はなした合図が来ないとき
  }
  if (ax.state === 'settle') {
    const d = ax.target - pos, step = SPEED * 1.5 * dt;
    pos = Math.abs(d) <= step ? ax.target : pos + Math.sign(d) * step;
    if (pos === ax.target) {
      setHum(false); beep(520, .08);
      if (k === 'x') { crane.x = pos; phase = 'z'; ax = { state: 'wait' }; phaseT = now; publish(); return; }
      crane.z = pos; phase = 'auto'; ax = null; publish(); runAuto(); return;
    }
  }
  if (k === 'x') crane.x = pos; else crane.z = pos;
}

async function dropPrize(p) {
  const win = inChute(p.x, p.z);
  const y0 = p.mesh.position.y, y1 = win ? -2.5 : 0;
  await tween(Math.sqrt(Math.max(.1, y0 - y1)) * .28, (k) => {
    p.mesh.position.y = y0 + (y1 - y0) * k * k;
    if (win && p.mesh.position.y < 0) p.mesh.scale.multiplyScalar(.9);
  });
  if (win) { scene.remove(p.mesh); prizes = prizes.filter((q) => q !== p); return true; }
  beep(180, .12, 'triangle', .12);
  // ほかの景品と かさならないように すこし ずらす
  for (let it = 0; it < 8; it++) for (const q of prizes) {
    if (q === p) continue;
    const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz) || .01, min = (p.r + q.r) * .85;
    if (d < min) { p.x += dx / d * (min - d); p.z += dz / d * (min - d); }
  }
  p.x = Math.max(-4.3, Math.min(4.3, p.x)); p.z = Math.max(-3.4, Math.min(3.4, p.z));
  if (inChute(p.x, p.z, p.r)) { p.x = Math.max(p.x, CHUTE.x2 + p.r); }
  const fx = p.mesh.position.x, fz = p.mesh.position.z;
  await tween(.25, (k) => { p.mesh.position.x = fx + (p.x - fx) * k; p.mesh.position.z = fz + (p.z - fz) * k; });
  return false;
}

async function runAuto() {
  const player = cur;
  await tween(.4, (k) => { crane.open = k; });
  beep(300, 1.2, 'sawtooth', .03);
  await tween(1.3, (k) => { crane.y = TOP_Y + (GRAB_Y - TOP_Y) * ease(k); });
  // いちばん近い景品をさがす
  let target = null, best = 1e9;
  for (const p of prizes) { const d = Math.hypot(p.x - crane.x, p.z - crane.z); if (d < best) { best = d; target = p; } }
  let q = target ? 1 - best / (target.r + .3) : 0;      // つかみぐあい 0〜1
  if (target?.def.rare) q -= .12;                        // レアは ちょっと むずかしい
  if (q <= 0) target = null;
  await tween(.5, (k) => { crane.open = 1 - k * (target ? .55 : 1); });
  beep(700, .08);
  let held = target, dropping = null;
  const carry = () => { if (held) { held.x = crane.x; held.z = crane.z; held.mesh.position.set(crane.x, crane.y - CARRY, crane.z); } };
  const release = () => { if (!held) return; const p = held; held = null; dropping = dropPrize(p); tween(.3, (k) => { crane.open = .45 + .55 * k; }); };
  if (held) await tween(.25, (k) => { held.mesh.position.x += (crane.x - held.mesh.position.x) * k; held.mesh.position.z += (crane.z - held.mesh.position.z) * k; });
  const weak = q < .15, secure = q >= .55;
  await tween(1.3, (k) => { crane.y = GRAB_Y + (TOP_Y - GRAB_Y) * ease(k); carry(); if (weak && k > .3) release(); });
  // おとし口へ もどる（つかみが あさいと とちゅうで おちる）
  const slipAt = secure ? 2 : (q - .15) / .4 * .9;
  const dz = HOME.z - crane.z, dx = HOME.x - crane.x, total = Math.abs(dz) + Math.abs(dx) || 1;
  const z0 = crane.z, x0 = crane.x;
  setHum(true);
  await tween(Math.max(.2, total / 3.2), (k) => {
    const d = k * total;
    if (d <= Math.abs(dz)) crane.z = z0 + Math.sign(dz) * d; else { crane.z = HOME.z; crane.x = x0 + Math.sign(dx) * (d - Math.abs(dz)); }
    carry(); if (k >= slipAt) release();
  });
  setHum(false);
  await wait(.25);
  release();
  await tween(.3, (k) => { crane.open = Math.max(crane.open, k); });
  const won = dropping ? await dropping : false;
  await tween(.3, (k) => { crane.open = 1 - k; });

  const prize = won && target ? { name: target.def.name, emoji: target.def.emoji, rare: !!target.def.rare } : null;
  last = { id: player.id, n: ++lastN, prize };
  if (prize) {
    gets.push(prize.emoji); caught.add(target.def.key); renderCollection(); fanfare(); confetti();
    banner(`<span class="big">${prize.emoji}</span>${prize.rare ? 'レア！ ' : ''}${esc(prize.name)} ゲット！<small>${esc(player.name)} さん おめでとう！</small>`, 3000);
  } else {
    sad(); banner(target ? 'おしい！<small>もうちょっと まんなかを ねらおう</small>' : 'ざんねん…<small>かげの わっかを けいひんに あわせよう</small>', 2400);
  }
  player.left--;
  publish();
  await wait(prize ? 3.2 : 2.6);
  if (prizes.length < 6) { fillPrizes(true); banner('けいひんを ほじゅう！', 1400); await wait(1.5); }
  if (cur !== player) return;
  if (player.left > 0) startPlay(false); else endTurn();
}

// キーボードでも遊べる（→ と ↑）。だれも いないときは「キーボード」さんとして始まる
const KEYS = { ArrowRight: 'x', ArrowUp: 'z' };
addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); return; }
  const k = KEYS[e.key]; if (!k || e.repeat) return;
  e.preventDefault(); press(k);
});
addEventListener('keyup', (e) => { const k = KEYS[e.key]; if (k&&cur?.id==='kbd') input(k, false, null); });
function press(k) {
  if (!cur && phase === 'idle' && !queue.length && k === 'x') {
    known.kbd = { name: 'プレイヤー', n: 0, join: 0, state: 'play' };
    cur = { id: 'kbd', name: 'プレイヤー', left: 1 }; startPlay(true);
  }
  if(cur?.id==='kbd')input(k, true);
}

// ---------- ループ ----------
function resize() {
  const w=$('stage').clientWidth,h=$('stage').clientHeight;
  renderer.setSize(w,h,false);camera.clearViewOffset();camera.aspect=w/h;camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let prev = performance.now(), manual = false;
function update(dt) {
  now += dt;
  stepAxis(dt);
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
  placeCrane();
}
function frame(t) {
  const dt = Math.min(.05, (t - prev) / 1000); prev = t;
  if (!manual) update(dt);
  const sway = phase === 'idle' ? .35 : 0;
  const narrow = camera.aspect < 1.2; camera.position.set(Math.sin(now*.25)*sway, narrow?12:9.7, narrow?23:18.7);camera.lookAt(0,3,0);
  marker.material.opacity = .55 + .35 * Math.sin(now * 6);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

fillPrizes(false);
renderHud();
requestAnimationFrame(frame);

$('welcome').showModal();
$('start').addEventListener('click',()=>{$('welcome').close();});
let muted=true;
$('sound').addEventListener('click',async()=>{
  try{
    if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();
    muted=!muted;await(muted?ac.suspend():ac.resume());
    $('sound').textContent=muted?'音 OFF':'音 ON';$('sound').setAttribute('aria-pressed',String(!muted));beep(660);
  }catch{$('sound').textContent='音を使えません';}
});
$('fullscreen').addEventListener('click',async()=>{try{await(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen());}catch{}});
$('play').addEventListener('click',()=>{
  if(phase!=='idle'||queue.length)return;
  known.kbd={name:'プレイヤー',n:0,join:0,state:'play'};
  cur={id:'kbd',name:'プレイヤー',left:1};startPlay(true);
});
for(const [id,k] of [['move-x','x'],['move-z','z']]){
  const button=$(id);let held=false;
  button.addEventListener('pointerdown',e=>{if(button.disabled)return;e.preventDefault();button.setPointerCapture(e.pointerId);held=true;press(k);});
  const release=()=>{if(!held)return;held=false;input(k,false,null);};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();held=true;press(k);}});
  button.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();release();}});
}
addEventListener('blur',()=>{if(cur?.id==='kbd'&&(phase==='x'||phase==='z'))input(phase,false,null);setHum(false);});
controls=installControlSwitch({mount:$('screen-controls'),buttons:[$('move-x'),$('move-z')],
  getState:()=>({phase,enabled:cur?.id==='kbd'&&(phase==='x'||phase==='z')}),
  onDown:k=>{if(cur?.id!=='kbd'||phase!==k)return false;press(k);return true;},
  onUp:k=>{if(cur?.id==='kbd')input(k,false,null);},
});
$('open-room').addEventListener('click',async()=>{
  if(connecting||net)return;
  connecting=true;$('open-room').disabled=true;$('network-status').textContent='参加用の部屋を準備しています…';
  try{
    const bytes=crypto.getRandomValues(new Uint8Array(8));
    const room=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
    const connection=await connectRoom(room,'screen',networkError);
    await connection.create(roomState());net=connection;net.onPlayers(onPlayers);
    const url=new URL('controller.html',location.href);url.searchParams.set('room',room);
    $('controller-link').href=url.href;$('room-code').textContent='ROOM '+room;
    const {default:qrcode}=await import('./vendor/qrcode.js');
    const qr=qrcode(0,'M');qr.addData(url.href);qr.make();$('qr').innerHTML=qr.createSvgTag({cellSize:4,margin:0,scalable:true});
    $('room-info').hidden=false;$('queue-card').hidden=false;$('open-room').hidden=true;
    $('network-status').textContent='受付中 · QRからスマホで参加できます';
    $('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url.href);$('copy-link').textContent='コピーしました ✓';}catch{$('network-status').textContent='参加リンクを長押ししてコピーしてください';}});
    setInterval(()=>{if(net)publish();},60000);
    addEventListener('offline',()=>{$('network-status').textContent='通信が切れています。接続が戻るまでお待ちください。';});
    addEventListener('online',()=>{$('network-status').textContent='受付中 · QRからスマホで参加できます';publish();});
  }catch(e){networkError(e);$('open-room').disabled=false;}
  finally{connecting=false;}
});

if (TEST) window.__crane = {
  get state() { return { phase, cur, crane: { ...crane }, last, prizes: prizes.map((p) => ({ name: p.def.name, x: +p.x.toFixed(2), z: +p.z.toFixed(2), r: p.r })) }; },
  press, release: (k, dur) => input(k, false, dur ?? null),
  moveTo(x, z) { crane.x = x; crane.z = z; },
  // テスト用：描画を待たずに ゲームの時間を sec 秒すすめる
  async tick(sec) { manual = true; for (let t = 0; t < sec; t += 1 / 30) { update(1 / 30); await new Promise((r) => setTimeout(r, 0)); } },
  auto() { manual = false; },
};
