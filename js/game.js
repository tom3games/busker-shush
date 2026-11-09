// 路上ライブは私語厳禁 本体
// 遊び: 駅前広場。真ん中で路上ミュージシャンが爆音ライブ中。押している間だけ話して、用事の言葉を一言ずつ相手に届ける。
// 静かな曲の間は視線（地面の光）に入ると見つかる。サビは叫べるが、曲が止まった瞬間に叫んでいたら一発で追い出し。
// 仕様の正本は ~/Desktop/claudecode/ideas/busker-shush.md。文言は data.js
import * as THREE from 'three'
import { setupLook, surfaceTex, addBlobShadow, look, createFx } from './look.js?v=1'
window.__jsUp = true
const BS = window.BS
const $ = id => document.getElementById(id)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, k) => a + (b - a) * k
const store = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } }
let lang = store.get('bs_lang') || ((navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en')
const L = p => p ? p[lang === 'en' ? 1 : 0] : ''
const T = k => L(BS.T[k])
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const params = new URLSearchParams(location.search)
const DEG = Math.PI / 180
let SIM = false

// ============================================================ 音（全部録音素材。CREDITS.md）
const S_ = n => 'snd/' + n + '.mp3'
Snd.def({
  chord: S_('chord'), chord_soft: S_('chord_soft'), applause: S_('applause'), clap: S_('clap_few'), coin: S_('coin'),
  ring: S_('ringback'), pop: [S_('pop1'), S_('pop2'), S_('pop3')], swish: [S_('swish1'), S_('swish2')], thud: [S_('thud1'), S_('thud2')],
  j_good: S_('j_good'), j_bad: S_('j_bad'), j_mid: S_('j_mid'), click: S_('click'),
})
const AUD = { quiet: S_('verse'), loud: S_('chorus'), intro: S_('intro') }
let muted = store.get('bs_mute') === '1'
Snd.setMute(muted)
function sfx(name, o) { if (!SIM) Snd.play(name, o) }
function music(kind, vol, fade) { if (SIM) return; if (!kind) Snd.loop('mus', null, 0, fade ?? 0.05); else Snd.loop('mus', AUD[kind], vol, fade ?? 0.35) }

// ============================================================ 3D の駅前広場（夕方→夜）
const canvas = $('view')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1))
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 80)
const LK = setupLook(renderer, scene, { exposure: 1.0, sun: 1.5, sunColor: 0xffb070, sunPos: [-6, 4, -8], target: [0, 0, -3], hemi: 0.75, sky: 0xffd9b0, ground: 0x4a3a40, fill: 0.4, fillColor: 0x8aa0ff })
const fx = createFx(scene, camera, renderer)
const texLoader = new THREE.TextureLoader()
const TEX = {}, PAPERS = []
function tex(name) {
  if (TEX[name]) return TEX[name]
  const t = texLoader.load('img/' + name + '.webp', tt => { tt.userData.ok = true; for (const m of PAPERS) if (m.userData.tex === name) fitPaper(m) })
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; TEX[name] = t; return t
}
// 切り絵（足元が原点。高さ h、縦横比は画像から。カメラの方を向く）
function paper(name, h, o = {}) {
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0)
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex(name), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, toneMapped: false }))
  m.userData = { tex: name, h, flip: false, face: o.face !== false }; PAPERS.push(m); fitPaper(m); (o.parent || scene).add(m); return m
}
function fitPaper(m) { const t = TEX[m.userData.tex], img = t && t.image; const a = img && img.width ? img.width / img.height : 0.55; m.scale.set(m.userData.h * a * (m.userData.flip ? -1 : 1), m.userData.h, 1) }
function setPaper(m, name, h, flip) { if (h) m.userData.h = h; if (flip != null) m.userData.flip = flip; if (m.userData.tex !== name) { m.userData.tex = name; m.material.map = tex(name); m.material.needsUpdate = true } fitPaper(m) }
function plane(w, h, mat, pos, rot, parent = scene) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); parent.add(m); return m }
function box(w, h, d, mat, pos, parent = scene) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(...pos); parent.add(m); return m }
function cyl(rt, rb, h, mat, pos, seg = 20, parent = scene) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(...pos); parent.add(m); return m }
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.85, metalness: o.m ?? 0, ...(o.e ? { emissive: o.e, emissiveIntensity: o.ei ?? 1 } : {}), ...(o.map ? { map: o.map } : {}) })
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.c = c; return t }

// 空（夕焼けから夜へ。時刻で2枚を混ぜる）
const skyDusk = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3b4a86'); g.addColorStop(0.45, '#c9708a'); g.addColorStop(0.75, '#f5a25e'); g.addColorStop(1, '#ffd08a'); x.fillStyle = g; x.fillRect(0, 0, w, h) })
const skyNight = canvasTex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d1230'); g.addColorStop(0.6, '#262b5c'); g.addColorStop(1, '#5a4a78'); x.fillStyle = g; x.fillRect(0, 0, w, h) })
const skyA = plane(80, 30, new THREE.MeshBasicMaterial({ map: skyDusk, toneMapped: false, depthWrite: false }), [0, 12, -30])
const skyB = plane(80, 30, new THREE.MeshBasicMaterial({ map: skyNight, toneMapped: false, transparent: true, opacity: 0, depthWrite: false }), [0, 12, -29.9])
scene.background = new THREE.Color('#2a2440')
// 地面: 駅前の石畳（大きいタイルと小さいタイルが混ざる）
const floorTex = surfaceTex({ w: 512, h: 512, base: '#b9ab9a', repeat: [7, 7], grime: 0.07, noise: 0.06, draw(x, w, h, r) {
  x.strokeStyle = 'rgba(70,58,50,.55)'; x.lineWidth = 3
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke() }
  for (let j = 0; j < 4; j++) for (let i = 0; i <= 3; i++) { const off = j % 2 ? w / 6 : 0; x.beginPath(); x.moveTo(off + i * w / 3, j * h / 4); x.lineTo(off + i * w / 3, (j + 1) * h / 4); x.stroke() }
  for (let k = 0; k < 18; k++) { x.fillStyle = r() < 0.5 ? 'rgba(160,140,120,.35)' : 'rgba(210,200,185,.3)'; x.fillRect(Math.floor(r() * 3) * w / 3 + 2, Math.floor(r() * 4) * h / 4 + 2, w / 3 - 4, h / 4 - 4) }
} })
const ground = plane(60, 60, std('#ffffff', { map: floorTex, r: 0.95 }), [0, 0, -6], [-Math.PI / 2, 0, 0])
// 点字ブロックの線（駅の入口へ）
const tactile = canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#e9c13a'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(150,110,20,.6)'; for (let i = 0; i < 4; i++) x.fillRect(4 + i * 15, 0, 6, h) })
tactile.wrapS = tactile.wrapT = THREE.RepeatWrapping; tactile.repeat.set(1, 18)
plane(0.3, 12, std('#ffffff', { map: tactile, r: 0.8 }), [-3.4, 0.006, -6], [-Math.PI / 2, 0, 0])
// 駅舎（奥）: 窓に灯り・入口・大屋根
const stTex = canvasTex(1024, 384, (x, w, h) => {
  x.fillStyle = '#8f8a86'; x.fillRect(0, 0, w, h); x.fillStyle = '#6f6a68'; x.fillRect(0, h * 0.62, w, h * 0.38)
  const r = mulberry(11)
  for (let i = 0; i < 16; i++) for (let j = 0; j < 3; j++) { const lit = r() < 0.7; x.fillStyle = lit ? (r() < 0.5 ? '#ffe2a8' : '#fff1cf') : '#3c4150'; x.fillRect(20 + i * 63, 22 + j * 68, 44, 46); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(20 + i * 63, 22 + j * 68 + 40, 44, 6) }
  // 入口（明るい改札）
  x.fillStyle = '#fff4d8'; x.fillRect(360, h * 0.66, 300, h * 0.34); x.fillStyle = '#4a4e5a'; for (let i = 0; i < 6; i++) x.fillRect(372 + i * 50, h * 0.8, 18, h * 0.2)
  x.fillStyle = '#2f3542'; x.fillRect(330, h * 0.6, 360, 18)
  x.fillStyle = '#1d3a6e'; x.fillRect(430, h * 0.5, 160, 34); x.fillStyle = '#fff'; x.font = '700 26px sans-serif'; x.textAlign = 'center'; x.fillText('EKIMAE', 510, h * 0.5 + 26)
})
const station = plane(26, 9.75, new THREE.MeshStandardMaterial({ map: stTex, emissive: '#ffffff', emissiveMap: stTex, emissiveIntensity: 0.25, roughness: 0.9 }), [0, 4.875, -13])
box(28, 0.5, 3, std('#4a4e58', { r: 0.7 }), [0, 4.2, -11.6])   // 大屋根のひさし
// 時計の柱（「時計の下のベンチ」）
const clockC = document.createElement('canvas'); clockC.width = clockC.height = 128
const clockT = new THREE.CanvasTexture(clockC); clockT.colorSpace = THREE.SRGBColorSpace
cyl(0.07, 0.09, 3.2, std('#5b5f68', { m: 0.5, r: 0.4 }), [3.0, 1.6, -3.0])
const clockFace = cyl(0.42, 0.42, 0.12, new THREE.MeshStandardMaterial({ map: clockT, emissive: '#ffffff', emissiveMap: clockT, emissiveIntensity: 0.5 }), [3.0, 3.3, -3.0], 32); clockFace.rotation.x = Math.PI / 2
function drawClock(mins) {
  const x = clockC.getContext('2d'), c = 64
  x.fillStyle = '#f6f1e4'; x.beginPath(); x.arc(c, c, 62, 0, 7); x.fill(); x.strokeStyle = '#2b2b30'; x.lineWidth = 7; x.stroke()
  x.fillStyle = '#2b2b30'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.fillRect(c + Math.sin(a) * 48 - 3, c - Math.cos(a) * 48 - 3, 6, 6) }
  const ha = (mins / 60 % 12) / 12 * Math.PI * 2, ma = (mins % 60) / 60 * Math.PI * 2
  x.lineCap = 'round'; x.lineWidth = 7; x.beginPath(); x.moveTo(c, c); x.lineTo(c + Math.sin(ha) * 28, c - Math.cos(ha) * 28); x.stroke()
  x.lineWidth = 4; x.beginPath(); x.moveTo(c, c); x.lineTo(c + Math.sin(ma) * 44, c - Math.cos(ma) * 44); x.stroke()
  clockT.needsUpdate = true
}
drawClock(18 * 60)
// ベンチ（時計の下）
const benchM = std('#8a5a3a', { r: 0.7 })
box(1.5, 0.06, 0.42, benchM, [3.0, 0.45, -2.4]); box(1.5, 0.36, 0.05, benchM, [3.0, 0.68, -2.62])
for (const dx of [-0.65, 0.65]) box(0.06, 0.45, 0.4, std('#3a3a40'), [3.0 + dx, 0.22, -2.4])
// 街灯（暖色）と植え込み・自販機（大きさをばらす）
const lampMat = std('#fff3d0', { e: '#ffd890', ei: 0 })
const lamps = []
for (const [lx, lz, lh] of [[-4.2, -5.5, 3.6], [4.6, -7.5, 3.9], [-1.2, -9.5, 3.3]]) {
  cyl(0.05, 0.07, lh, std('#3f434c', { m: 0.4, r: 0.5 }), [lx, lh / 2, lz])
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), lampMat); b.position.set(lx, lh + 0.1, lz); scene.add(b)
  const pl = new THREE.PointLight('#ffcf8a', 0, 9, 1.6); pl.position.set(lx, lh, lz); scene.add(pl); lamps.push(pl)
}
const leafM = std('#3f5e3a', { r: 0.95 }), potM = std('#7c6f66', { r: 0.9 })
for (const [px, pz, s] of [[-5.2, -7.8, 1.2], [5.6, -4.4, 0.9], [-4.6, -10.5, 1.5], [6.8, -10, 1.1]]) {
  box(1.3 * s, 0.45, 1.3 * s, potM, [px, 0.225, pz])
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s * (0.8 + i * 0.12), 12, 8), leafM); b.position.set(px + (i - 1) * 0.3 * s, 0.7 + i * 0.25 * s, pz + (i % 2) * 0.2); scene.add(b) }
}
const vend = box(0.9, 1.8, 0.7, std('#c8382f', { r: 0.5 }), [-5.4, 0.9, -3.6])
plane(0.7, 0.9, new THREE.MeshBasicMaterial({ color: '#fff7e0', toneMapped: false }), [-5.4, 1.15, -3.24])
const vendL = new THREE.PointLight('#fff2d0', 0, 3, 2); vendL.position.set(-5.4, 1.2, -2.8); scene.add(vendL)
// 通りすぎる人の影（奥を歩く。大きさと速さをばらす）
const walkers = []
{
  const r = mulberry(5)
  for (let i = 0; i < 6; i++) {
    const h = 1.45 + r() * 0.4, kind = i % 3
    const t = canvasTex(64, 160, (x, w, hh) => {
      x.fillStyle = 'rgba(30,26,40,.92)'; x.beginPath(); x.arc(32, 22, 14, 0, 7); x.fill()
      x.beginPath(); x.moveTo(14, 40); x.lineTo(50, 40); x.lineTo(kind === 1 ? 56 : 46, 110); x.lineTo(kind === 1 ? 8 : 18, 110); x.fill()
      x.fillRect(20, 108, 9, 50); x.fillRect(35, 108, 9, 50)
      if (kind === 2) { x.fillRect(48, 70, 12, 22) }   // 鞄
    })
    const m = plane(h * 0.4, h, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }), [0, h / 2, -8 - r() * 2.5])
    walkers.push({ m, v: (0.6 + r() * 0.7) * (r() < 0.5 ? 1 : -1), x0: -9 + r() * 18 })
  }
}

// ---- ミュージシャンの持ち場: アンプ・マイクスタンド・ギターケース（投げ銭）・段ボールの看板
const M = new THREE.Vector3(0, 0, -2.6)
const ampTex = canvasTex(128, 160, (x, w, h) => {
  x.fillStyle = '#1e1e22'; x.fillRect(0, 0, w, h); x.fillStyle = '#2c2c32'; x.fillRect(8, 30, w - 16, h - 40)
  x.fillStyle = '#111'; x.beginPath(); x.arc(64, 100, 44, 0, 7); x.fill(); x.fillStyle = '#3a3a42'; x.beginPath(); x.arc(64, 100, 16, 0, 7); x.fill()
  x.strokeStyle = 'rgba(255,255,255,.08)'; for (let i = 12; i < w; i += 6) { x.beginPath(); x.moveTo(i, 32); x.lineTo(i, h - 10); x.stroke() }
  x.fillStyle = '#c9b48a'; x.fillRect(10, 8, w - 20, 14); x.fillStyle = '#e04a3a'; x.beginPath(); x.arc(110, 15, 4, 0, 7); x.fill()
})
const ampMats = [std('#1e1e22'), std('#1e1e22'), std('#2a2a30'), std('#1e1e22'), std('#ffffff', { map: ampTex, r: 0.8 }), std('#1e1e22')]
const amp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.34), ampMats); amp.position.set(0.95, 0.31, -2.75); amp.rotation.y = -0.35; scene.add(amp)
const ampLed = new THREE.PointLight('#ff6a3a', 0, 1.2, 2); ampLed.position.set(0.9, 0.6, -2.45); scene.add(ampLed)
cyl(0.012, 0.012, 1.5, std('#222', { m: 0.6, r: 0.3 }), [0.5, 0.75, -2.2])
cyl(0.18, 0.18, 0.02, std('#222', { m: 0.6, r: 0.3 }), [0.5, 0.01, -2.2])
const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), std('#3a3a3a', { m: 0.7, r: 0.3 })); micHead.position.set(0.5, 1.52, -2.17); scene.add(micHead)
const caseG = new THREE.Group(); caseG.position.set(-0.22, 0, -1.9); caseG.rotation.y = -0.25; scene.add(caseG)
box(0.95, 0.08, 0.36, std('#2a2420'), [0, 0.04, 0], caseG)
box(0.88, 0.02, 0.3, std('#6a1f2a', { r: 1 }), [0, 0.085, 0], caseG)   // 内張りの赤
const coins = []
for (let i = 0; i < 9; i++) { const c = cyl(0.025, 0.025, 0.006, std('#d8c27a', { m: 0.8, r: 0.3 }), [(i % 5) * 0.1 - 0.25, 0.1, (Math.floor(i / 5) - 0.5) * 0.09], 10, caseG); c.visible = i < 3; coins.push(c) }
const signTex = canvasTex(256, 200, (x, w, h) => signDraw(x, w, h))
const sign = plane(0.62, 0.48, std('#ffffff', { map: signTex, r: 1 }), [0.98, 0.86, -2.55], [-0.12, -0.35, 0])

// ---- いたずらの的: 譜面台の歌詞カード・アンプのつまみ・足元のケーブル
const standM = std('#2a2a2e', { m: 0.5, r: 0.4 })
cyl(0.012, 0.012, 1.0, standM, [0.3, 0.5, -1.62]); cyl(0.16, 0.16, 0.015, standM, [0.3, 0.008, -1.62])
const lyricTex = canvasTex(128, 96, (x, w, h) => { x.fillStyle = '#f7f3e6'; x.fillRect(0, 0, w, h); x.strokeStyle = '#555'; x.lineWidth = 2; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(10, 14 + i * 11); x.lineTo(10 + 60 + (i * 37 % 45), 14 + i * 11); x.stroke() } x.fillStyle = '#c42a1e'; x.beginPath(); x.arc(108, 16, 7, 0, 7); x.fill() })
const lyric = plane(0.36, 0.27, std('#ffffff', { map: lyricTex, r: 1 }), [0.3, 1.08, -1.59], [-0.5, -0.15, 0]); lyric.material.side = THREE.DoubleSide
const cableCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.82, 0.03, -2.62), new THREE.Vector3(1.1, 0.02, -1.9), new THREE.Vector3(0.95, 0.02, -1.4), new THREE.Vector3(0.5, 0.02, -1.5), new THREE.Vector3(0.12, 0.02, -1.95), new THREE.Vector3(0.05, 0.02, -2.45)])
const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 40, 0.018, 6), std('#111', { r: 0.6 })); scene.add(cable)
const plug = box(0.06, 0.04, 0.1, std('#c9b48a', { m: 0.6, r: 0.3 }), [0.95, 0.03, -1.4])
const TRICK = { amp: new THREE.Vector3(0.95, 0.66, -2.75), lyric: new THREE.Vector3(0.3, 1.1, -1.59), cable: new THREE.Vector3(0.95, 0.03, -1.4) }

// ---- 人（切り絵）
const mus = paper('m_play', 2.0); mus.position.copy(M)
addBlobShadow(mus, 0.9, { opacity: 0.45 })
const mom = paper('mom', 1.12); mom.position.set(-0.68, 0, -2.0)
addBlobShadow(mom, 0.7, { opacity: 0.4 })
const you = paper('y_phone', 1.72); you.position.set(1.1, 0, 0.35)
addBlobShadow(you, 0.8, { opacity: 0.45 })
const date = paper('date', 1.6); date.position.set(0.7, 0, -0.95); date.visible = false
addBlobShadow(date, 0.6, { opacity: 0.35 })
// しゃべる通行人（なすりつけの身代わり。3つめの用事から）
const NPC_IMG = ['n_aunt', 'n_stream', 'n_suit'], NPC_FLY = ['n_aunt_f', 'n_stream_f', 'n_suit_f']
const npc = paper('n_aunt', 1.5); npc.position.set(-1.05, 0, -1.15); npc.visible = false
addBlobShadow(npc, 0.6, { opacity: 0.35 })
const police = paper('police', 1.78); police.position.set(-4.5, 0, -1.4); police.visible = false
addBlobShadow(police, 0.7, { opacity: 0.4 })
// たこ焼きの屋台（2つめの用事から。左手前）
const stall = new THREE.Group(); stall.position.set(-1.15, 0, -0.75); stall.rotation.y = 0.45; stall.visible = false; scene.add(stall)
box(0.85, 0.95, 0.5, std('#8a5a32', { r: 0.8 }), [0, 0.475, 0], stall)
box(0.95, 0.06, 0.6, std('#5a3a22'), [0, 0.98, 0], stall)
const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.32), std('#3a3a3a', { m: 0.6, r: 0.4 })); plate.position.set(-0.25, 1.02, 0.05); stall.add(plate)
for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 6), std('#c98a3a', { r: 0.6 })); b.position.set(-0.45 + (i % 3) * 0.1, 1.07, -0.05 + Math.floor(i / 3) * 0.1); stall.add(b) }
for (const dx of [-0.44, 0.44]) box(0.05, 1.3, 0.05, std('#5a3a22'), [dx, 1.6, -0.25], stall)
const norenTex = canvasTex(256, 96, (x, w, h) => norenDraw(x, w, h))
const noren = plane(0.92, 0.36, std('#ffffff', { map: norenTex, r: 1 }), [0, 2.0, -0.24], null, stall); noren.material.side = THREE.DoubleSide
const tako = paper('tako', 0.95); tako.position.set(-1.15, 0.6, -1.12); tako.visible = false
const stallLight = new THREE.PointLight('#ffb070', 0, 3, 1.8); stallLight.position.set(-0.9, 1.8, -0.2); scene.add(stallLight)

// ---- 視線（地面の光の扇）。静かな曲の間だけ見える
const fanTex = canvasTex(256, 256, (x, w, h) => { const g = x.createRadialGradient(128, 128, 6, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.75, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h) })
const fanMat = new THREE.MeshBasicMaterial({ map: fanTex, color: '#ffe7a0', transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
const fanG = new THREE.Group(); fanG.position.set(M.x, 0.02, M.z); scene.add(fanG)
let fanMesh = null, fanHW = -1, fanLen = -1
function setFan(hw, len) {
  if (Math.abs(hw - fanHW) < 0.4 && Math.abs(len - fanLen) < 0.05) return
  fanHW = hw; fanLen = len
  if (fanMesh) { fanMesh.geometry.dispose(); fanG.remove(fanMesh) }
  if (hw < 0.5) { fanMesh = null; return }
  const g = new THREE.CircleGeometry(len, 28, (-90 - hw) * DEG, 2 * hw * DEG); g.rotateX(-Math.PI / 2)
  fanMesh = new THREE.Mesh(g, fanMat); fanMesh.renderOrder = 2; fanG.add(fanMesh)
}
const angTo = p => Math.atan2(p.x - M.x, p.z - M.z) / DEG
const distTo = p => Math.hypot(p.x - M.x, p.z - M.z)

// ---- カメラ（自分の斜め後ろ・少し高め）
const CAM = { p: new THREE.Vector3(0.35, 1.72, 2.55), t: new THREE.Vector3(0.12, 1.05, -2.6) }
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h
  renderer.setSize(w, h, false); camera.aspect = a
  const hf = 54 * DEG
  camera.fov = clamp(2 * Math.atan(Math.tan(hf / 2) / a) / DEG, 46, 92)
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize); resize()

// ============================================================ 遊びの状態（sim でも同じ処理を回す）
const TUT_KEY = 'bs_tut1'
const SEEN = 0.3          // 視線の中で喋って見つかるまでの秒数
const SHOUT_TYPES = { loud: 1, intro: 1 }
const WIDE_TYPES = { stop: 1, clap: 1, brk: 1 }
const G = { mode: 'boot', t: 0, clock: 0, texts: { mus: null, pat: null, hint: null }, paused: false, speed: 1, playNo: 0, hold: false, events: [], news: [], gz: { a: -40, to: -40, spd: 70, dwell: 1, hw: 0, hwTo: 13, len: 7.5, tgt: 'mom' }, rare: {} }
let rng = mulberry(1)
const rnd = (a, b) => a + (b - a) * rng()
const pick = a => a[Math.floor(rng() * a.length)]

// 場面ごとの曲の流れ（区間の並び）。区間が尽きたら repeat を回す
function sec(type, dur, o = {}) { return { type, dur, ...o } }
function plan(i) {
  const q = (d, o) => sec('quiet', d, o), loud = (d, o) => sec('loud', d, o), wind = (o) => sec('wind', 1.3, o), stop = (o) => sec('stop', 2.6, o)
  if (i === 0) return { first: [q(rnd(9.5, 11)), wind(), stop(), q(rnd(8, 10), { string: G.rare.string })], repeat: () => [wind(), stop(), q(rnd(8, 10))] }
  if (i === 1) return { first: [sec('intro', 5), q(rnd(6.5, 7.5), { coin: true }), loud(rnd(6, 7)), wind(), stop(), q(rnd(6, 7), { momLoud: G.rare.momLoud })], repeat: () => [loud(rnd(5.5, 6.5)), wind(), stop(), q(rnd(6, 7), { coin: rng() < 0.5 })] }
  if (i === 2) return { first: [q(rnd(5.5, 6.5), { chira: true }), sec('mc', 5.5), sec('clap', 2.8), q(rnd(5, 6), { chira: true }), sec('cd', 4.6), loud(rnd(5.5, 6.5)), wind(), stop()], repeat: () => [q(rnd(5.5, 6.5), { chira: true, coin: rng() < 0.4 }), loud(rnd(5.5, 6.5)), wind(), stop(), sec('mc', 4.5)] }
  return { first: [q(rnd(5.5, 6.5), { chira: true }), sec('police', 7, { fan: G.rare.fan }), loud(5.5, { last: true }), wind(), sec('brk', 1.0), loud(4.5, { rate: 1.06 }), wind(), stop()], repeat: () => [q(rnd(5.5, 6.5), { chira: true }), loud(rnd(5, 6)), wind(), stop()] }
}

function newGame(seed, learn = false) {
  G.seed = seed; rng = mulberry(seed)
  G.t = 0; G.mode = 'play'; G.over = null; G.endT = 0; G.done = false
  G.e1 = G.e2 = G.e3 = G.e4 = false; G.outCause = null; G.outLine = null; G.outKind = null
  G.rare = { string: rng() < 0.35, momLoud: rng() < 0.5, fan: rng() < 0.3, outLine: rng() < 0.5 ? 0 : 1 }
  G.strikes = 0; G.immune = 0; G.seenT = 0; G.lock = false; G.hold = false; G.res = []; G.events = []; G.news = []; G.firsts = {}
  G.learn = learn ? { shown: '', talked: 0 } : null
  G.sc = -1; G.gz = { a: -40, to: -40, spd: 70, dwell: 1, hw: 0, hwTo: 0, len: 7, tgt: 'mom', pre: 0 }
  G.musX = 0; G.musOver = null; G.musOverT = 0; G.policeT = -1
  G.sus = 0; G.tricks = 0; G.blames = 0; G.used = {}; G.ampT = -1; G.lyricSwap = false; G.npc = null; G.npcN = 0
  startScene(0)
}
function startScene(i) {
  G.sc = i; const S = BS.SCENES[i]
  G.S = S; G.wi = 0; G.wp = 0; G.wshout = false; G.shouted = 0; G.scT = 0; G.pat = S.pat; G.nag = 0
  G.inter = 0; G.interKind = null
  const p = plan(i); G.queue = p.first.slice(); G.repeat = p.repeat
  G.cur = null; nextSec()
  newThing('scene' + i)
  if (S.phone) sfx('ring', { vol: 0.5, jitter: 0 })
  if (!SIM) setTimeout(() => sayPat(L(S.open)), 600)
  stall.visible = tako.visible = i === 1
  G.used = {}; G.ampT = -1; G.lyricSwap = false
  if (i >= 1 && !G.firsts.tricks) { G.firsts.tricks = 1; newThing('tricks'); if (!SIM && !store.get('bs_tut2')) { store.set('bs_tut2', '1'); setTimeout0(2.5, () => say('hint', L(BS.HINT.trick), '', 3.2)) } }
  if (i >= 2) spawnNpc(i === 2 ? 3 : 1.5); else G.npc = null
  date.visible = i === 3; if (i === 3) setPaper(date, 'date', 1.6)
  ev('scene ' + S.id)
}
function nextSec() {
  const prev = G.cur
  if (!G.queue.length) G.queue = G.repeat()
  const s = G.queue.shift(); s.t = 0; G.cur = s
  // 曲が止まった瞬間に叫んでいたら一発で追い出し
  if (prev && (s.type === 'stop' || s.type === 'brk') && G.hold && !G.lock && prev.type === 'wind' && prev.loud) { G.cur = s; enterSec(s, prev); return out('shout') }
  enterSec(s, prev)
}
function enterSec(s, prev) {
  const ty = s.type
  if (ty === 'wind') s.loud = prev ? !!(SHOUT_TYPES[prev.type]) : false
  if (!G.firsts[ty]) { G.firsts[ty] = 1; newThing(ty) }
  if (s.chira && !G.firsts.chira) { G.firsts.chira = 1; newThing('chira') }
  ev('sec ' + ty)
  const gz = G.gz
  if (ty === 'quiet') {
    music('quiet', G.ampT >= 0 ? 0.2 : 0.42); gz.hwTo = 13; gz.len = 7.5; gz.dwell = 0.4
    if (G.lyricSwap) { G.lyricSwap = false; sayMus(L(pick(BS.LYRIC.swapped)), 'lyric', 2.4); setTimeout0(1.6, () => sayAt('mom', L(pick(BS.LINES.momLaugh)))); setTimeout0(2.4, () => { G.queue.unshift(sec('panic', 5), sec('quiet', rnd(3, 4))); if (G.cur === s) s.dur = s.t }) }
    else if (rng() < 0.75) sayMus(L(pick(BS.LYRIC.quiet)), 'lyric')
    s.coinAt = s.coin ? rnd(1.5, Math.max(2, s.dur - 3)) : -1
    s.momAt = s.momLoud ? rnd(1.2, 2.5) : -1
    s.strAt = s.string ? rnd(2.5, 4) : -1
  } else if (ty === 'loud' || ty === 'intro') {
    music(ty === 'intro' ? 'intro' : 'loud', G.ampT >= 0 ? 0.4 : 0.95, 0.06); gz.hwTo = 0
    sayMus(L(s.last ? pick(BS.LINES.last) : pick(BS.LYRIC.loud)), 'loud')
    if (prev && prev.type === 'brk') sayMus(L(pick(BS.LINES.brk)), 'loud')
    fx.shake(0.05, 0.3)
  } else if (ty === 'wind') {
    gz.hwTo = 0
  } else if (WIDE_TYPES[ty]) {
    music(null); sfx(prev && prev.loud ? 'chord' : 'chord_soft', { vol: prev && prev.loud ? 0.9 : 0.6, jitter: 0 })
    gz.to = 0; gz.spd = 200; gz.hwTo = 62; gz.len = 8
    if (ty !== 'brk') { sayMus(L(pick(BS.LINES.clap)), ''); if (rng() < 0.6) setTimeout0(0.6, () => sfx('clap', { vol: 0.7 })) }
    if (ty === 'stop' && rng() < 0.35) setTimeout0(0.9, () => sayAt('mom', L(pick(BS.LINES.mom))))
  } else if (ty === 'mc') {
    music('quiet', 0.12); gz.hwTo = 13; gz.len = 7.5
    sayMus(L(pick(BS.LINES.mc)), '')
  } else if (ty === 'cd') {
    music('quiet', 0.15); gz.hwTo = 14; gz.len = 7.5; gz.pre = 0.8
    sayMus(L(pick(BS.LINES.cd)), '')
  } else if (ty === 'police') {
    music('quiet', 0.06, 0.2); gz.hwTo = 12; gz.len = 7.5; G.policeT = 0
    police.visible = true
    sayMus(L(pick(BS.LINES.police)), '')
    setTimeout0(2.2, () => sayAt('police', L(pick(BS.LINES.policeQ))))
    setTimeout0(4.2, () => sayMus(L(pick(BS.LINES.policeA)), ''))
    if (s.fan) setTimeout0(5.6, () => sayAt('police', L(pick(BS.LINES.fan))))
  } else if (ty === 'lecture') {
    music(null); sfx('chord_soft', { vol: 0.6, jitter: 0 }); gz.hwTo = 14; gz.len = 7.5
    sayMus(L(pick(BS.LINES.lecture[G.S.id] || BS.LINES.strike2)), 'angry', 3.4)
  } else if (ty === 'panic') {
    music(null); gz.hwTo = 13; gz.len = 1.2; gz.to = -26; gz.spd = 150; gz.pre = 0
    sayMus(L(pick(BS.LINES.panic)), 'angry', 3)
  } else if (ty === 'unplug') {
    music(null); sfx('chord_soft', { vol: 0.7, jitter: 0, rate: 0.45 }); gz.hwTo = 13; gz.len = 1.3; gz.to = 95; gz.spd = 260; gz.pre = 0
    sayMus(L(pick(BS.LINES.unplug)), '', 2.4)
  } else if (ty === 'search') {
    music(null); gz.hwTo = 16; gz.len = 7.5; gz.pre = 0
    sayMus(L(pick(BS.LINES.search)), 'angry', 3)
  } else if (ty === 'tune') {
    music(null); sfx('chord_soft', { vol: 0.5, jitter: 0, rate: 0.7 }); gz.hwTo = 13; gz.len = 1.3; gz.to = -16; gz.spd = 120
    sayMus(L(pick(BS.LINES.string)), '')
  }
}
function newThing(k) { G.news.push([Math.round(G.t * 10) / 10, k]) }
function ev(e) { if (G.events.length < 600) G.events.push([Math.round(G.t * 10) / 10, e]) }
function setTimeout0(sec, f) { (G.later = G.later || []).push({ at: G.t + sec, f }) }

// 視線の行き先（静かな曲の間）
const SPOT = () => ({ you: angTo(you.position), mom: angTo(mom.position), tako: angTo(new THREE.Vector3(-1.15, 0, -1.12)), left: -22, center: -4, far: 44, police: angTo(new THREE.Vector3(-1.2, 0, -1.4)) })
function pickGaze(chira) {
  const s = SPOT(), gz = G.gz, sc = G.sc
  if (chira && rng() < 0.32) { gz.tgt = 'chira'; gz.back = gz.a; gz.to = s.you + rnd(-3, 3); gz.spd = 230; gz.dwell = rnd(0.45, 0.6); gz.pre = 0.6; return }
  const w = [['mom', 0.24], ['left', 0.18], ['center', 0.16], ['you', 0.27 + sc * 0.02], ['far', 0.08], ['tako', sc >= 1 ? 0.1 : 0]]
  let tot = w.reduce((a, b) => a + b[1], 0), r = rng() * tot, k = 'mom'
  for (const [n, p] of w) { r -= p; if (r <= 0) { k = n; break } }
  if (k === gz.tgt) k = k === 'you' ? 'mom' : 'center'
  gz.tgt = k; gz.to = s[k] + rnd(-4, 4); gz.spd = rnd(50, 72) + sc * 5; gz.dwell = k === 'you' ? rnd(1.2, 2.2) : rnd(1.0, 2.4)
  gz.pre = sc === 0 ? 0.75 : 0.6
}
function stepGaze(dt) {
  const gz = G.gz, s = G.cur, ty = s ? s.type : 'quiet', S = SPOT()
  if (G.inter > 0 || G.over) gz.hwTo = 0
  else if (ty === 'quiet' || ty === 'tune') {
    if (ty === 'quiet') {
      if (s.coinAt >= 0 && s.t >= s.coinAt) { s.coinAt = -1; gz.tgt = 'down'; gz.to = -16; gz.spd = 150; gz.pre = 0; gz.dwell = 2.0; gz.len = 1.3; coinIn() }
      if (s.momAt >= 0 && s.t >= s.momAt) { s.momAt = -1; gz.tgt = 'momL'; gz.to = S.mom; gz.spd = 160; gz.dwell = 2.4; gz.len = 7.5; sayAt('mom', L(pick(BS.LINES.momLoud))); newThing('momLoud'); music('quiet', 0.2) }
      if (s.strAt >= 0 && s.t >= s.strAt) { s.strAt = -1; G.queue.unshift(sec('tune', 4), sec('quiet', Math.max(2.5, s.dur - s.t - 1))); s.dur = s.t; newThing('string') }
    }
    if (gz.pre > 0) { gz.pre -= dt; const d = gz.to - gz.a; gz.a += Math.sign(d) * Math.min(Math.abs(d), 7 * dt); gz.hw = lerp(gz.hw, gz.hwTo, Math.min(1, dt * 10)); return }
    if (Math.abs(gz.to - gz.a) < 0.5) {
      gz.dwell -= dt
      if (gz.tgt === 'npc') {}
      else if (gz.dwell <= 0 && ty === 'quiet') { if (gz.tgt === 'chira') { gz.tgt = 'back'; gz.to = gz.back; gz.spd = 230; gz.dwell = 0.3 } else { gz.len = 7.5; pickGaze(s.chira) } }
    }
  } else if (ty === 'mc') {
    gz.to = -44 + 76 * (0.5 - 0.5 * Math.cos(s.t * 2 * Math.PI / 3.6)); gz.spd = 400
  } else if (ty === 'cd' || ty === 'lecture') { gz.to = S.you; gz.spd = 240; if (gz.pre > 0) { gz.pre -= dt; gz.spd = 0 } }
  else if (ty === 'police') { gz.to = S.police; gz.spd = 200 }
  else if (ty === 'panic' || ty === 'unplug') { if (ty === 'unplug' && s.t > 2.6) { gz.to = 0; gz.spd = 220; gz.hwTo = 62; gz.len = 8 } }
  else if (ty === 'search') { gz.to = -50 + 100 * (0.5 - 0.5 * Math.cos(s.t * 2 * Math.PI / 3.4)); gz.spd = 300 }
  if (gz.tgt === 'npc') { gz.npcT -= dt; if (gz.npcT <= 0) { gz.tgt = 'center'; gz.dwell = 0.3 } else if (!SHOUT_TYPES[ty] && ty !== 'wind' && !WIDE_TYPES[ty]) { gz.to = gz.npcA; gz.spd = 240; gz.hwTo = 13; gz.len = 7.5; gz.pre = 0 } }
  else if (WIDE_TYPES[ty]) { gz.to = 0; gz.spd = 200 }
  // 回す
  const d = gz.to - gz.a, mv = gz.spd * dt
  gz.a = Math.abs(d) <= mv ? gz.to : gz.a + Math.sign(d) * mv
  gz.hw = lerp(gz.hw, gz.hwTo, Math.min(1, dt * (gz.hwTo > gz.hw ? 10 : 14)))
  if (gz.hwTo === 0 && gz.hw < 0.6) gz.hw = 0
}
const youAng = () => angTo(you.position)
function inGaze() { const gz = G.gz; return gz.hw > 1 && gz.len >= distTo(you.position) - 0.3 && Math.abs(gz.a - youAng()) < gz.hw + 2.5 }
function shoutMode() { const s = G.cur; return !!s && (SHOUT_TYPES[s.type] || (s.type === 'wind' && s.loud)) }
function canTalk() { return G.mode === 'play' && !G.over && G.inter <= 0 && G.cur && G.cur.type !== 'lecture' }
function coinIn() { const c = coins.find(c => !c.visible); if (c) c.visible = true; sfx('coin', { vol: 0.7 }); sayMus(L(pick(BS.LINES.coin)), ''); if (!G.firsts.coin) { G.firsts.coin = 1; newThing('coin') } }

// ============================================================ もうひと工夫: 見ていない隙に、機材にいたずら・通行人になすりつけ
// いたずら（2つめの用事から。各1回）: 歌詞カードのすり替え＝次の静かな曲で変な歌詞→動揺して長い隙／ケーブルを抜く＝曲が止まる（声が届きやすいが、すぐ顔を上げる）／
// アンプのつまみを下げる＝しばらくサビでも声が届く（あとで犯人探し）。見られている時・切れ目・説教中に触ると一発退場。続けると疑われ、疑い3つで手を出したら捕まる
function trickOk(k) { return G.mode === 'play' && !G.over && G.inter <= 0 && G.sc >= 1 && !G.used[k] && G.cur && !['lecture', 'search', 'panic', 'unplug', 'tune'].includes(G.cur.type) }
function trick(k) {
  if (!trickOk(k)) return 'off'
  const ty = G.cur.type
  if (inGaze() || WIDE_TYPES[ty] || ty === 'cd' || G.sus >= 3) { ev('trick caught ' + k); return out('prank'), 'caught' }
  G.used[k] = 1; G.sus++; G.tricks++; ev('trick ' + k); if (!G.firsts['t_' + k]) { G.firsts['t_' + k] = 1; newThing('t_' + k) }
  sfx('click', { vol: 0.4 })
  if (k === 'lyric') { G.lyricSwap = true; if (G.cur.type === 'quiet' && G.cur.dur - G.cur.t > 2) { G.queue.unshift(sec('quiet', rnd(4, 5))); G.cur.dur = G.cur.t } }
  else if (k === 'cable') {
    if (shoutMode() && G.hold && !G.lock) { G.queue.unshift(sec('unplug', 4)); G.cur.dur = G.cur.t; return out('shout'), 'shout' }
    G.queue.unshift(sec('unplug', 4), sec('quiet', rnd(4, 5))); G.cur.dur = G.cur.t
  } else if (k === 'amp') { G.ampT = 9; if (shoutMode()) music('loud', 0.4, 0.3); else music('quiet', 0.2, 0.3) }
  return 'ok'
}
function spawnNpc(after) { G.npc = { k: G.npcN++ % 3, t: -after, talk: false, ph: 0, fly: -1 }; npc.visible = false }
function stepNpc(dt) {
  const n = G.npc; if (!n) return
  n.t += dt
  if (n.fly >= 0) { n.fly += dt; if (n.fly > 1.2) spawnNpc(6); return }
  if (n.t < 0) return
  n.ph += dt; const cyc = n.talk ? 2.6 : 1.8
  if (n.ph >= cyc) { n.ph = 0; n.talk = !n.talk; if (n.talk && !G.firsts.npc) { G.firsts.npc = 1; newThing('npc') } }
}
function npcOk() { const n = G.npc; return !!n && n.t >= 0 && n.fly < 0 && G.mode === 'play' && !G.over && G.inter <= 0 }
function blame() {
  if (!npcOk()) return 'off'
  const n = G.npc
  if (!n.talk || ['lecture', 'search'].includes(G.cur.type)) { ev('blame fail'); return out('blame'), 'fail' }
  G.blames++; G.seenT = 0; G.immune = 1.0; ev('blame ok'); if (!G.firsts.blame) { G.firsts.blame = 1; newThing('blame') }
  const gz = G.gz; gz.tgt = 'npc'; gz.pre = 0; gz.dwell = 2.6; gz.spd = 240; gz.npcT = 2.6; gz.npcA = angTo(npc.position)
  sayMus(L(pick(BS.LINES.blameHit)), 'angry', 2.2); sfx('thud', { vol: 0.6 })
  n.fly = 0; setTimeout0(0.9, () => sfx('swish', { vol: 0.6 }))
  return 'ok'
}

// 話す（押している間）
function setHold(v) {
  v = !!v
  if (v === G.hold) return
  G.hold = v
  if (!v) {
    if (G.lock) { G.lock = false; return }
    if (G.wp > 0.3 && canTalk()) { if (rng() < 0.6) sayPat(L(G.S.eh)); ev('redo') }
    G.wp = 0; G.wshout = false
  } else if (G.learn) G.learn.talked++
}
function caught() {
  G.strikes++; G.immune = 1.4; G.seenT = 0; G.wp = 0; G.wshout = false; G.lock = G.hold
  ev('caught ' + G.strikes + ' ' + (G.cur && G.cur.type) + ' ' + G.gz.tgt); newThing('strike' + G.strikes)
  if (G.strikes >= 3) return out('caught')
  fx.shake(0.04, 0.25); sfx('thud', { vol: 0.5 })
  if (G.strikes === 1) { G.musOver = 'm_look'; G.musOverT = 1.6; sayMus(L(pick(BS.LINES.strike1)), 'angry') }
  else { G.queue.unshift(sec('lecture', 3.4), sec('quiet', rnd(5, 6))); G.cur.dur = G.cur.t; }
}
function out(kind) {
  if (G.over) return
  G.over = 'out'; G.outKind = kind; G.endT = 0; G.lock = true
  G.outCause = kind === 'shout' || kind === 'prank' || kind === 'blame' ? kind : (G.S ? G.S.id : 'boss'); G.outLine = pick(BS.LINES.outBy[G.outCause])
  G.outWord = G.S ? L(G.S.words[Math.min(G.wi, G.S.words.length - 1)]) : ''
  ev('out ' + kind)
  music(null); G.gz.hwTo = kind === 'shout' ? 62 : G.gz.hwTo
}
function sceneEnd(ok) {
  const S = G.S
  G.res.push({ id: S.id, ok, t: Math.round(G.scT * 10) / 10, left: Math.max(0, G.pat), pat: S.pat, shouted: G.shouted, words: G.wi })
  ev((ok ? 'done ' : 'fail ') + S.id)
  G.inter = G.sc === 3 ? 4.6 : 4.2; G.interKind = ok ? 'ok' : 'ng'; G.hold && (G.lock = true); G.wp = 0
  if (ok) { sfx('j_good', { vol: 0.45 }); say('pat', L(G.shouted ? S.okLoud : S.ok), 'done', 1.9, 'pat') } else { sfx('j_bad', { vol: 0.45 }); say('pat', L(S.ng), 'ng', 1.9, 'pat') }
  G.texts.mus = null; G.texts.hint = null
  if (G.sc === 3) {
    if (ok) { setPaper(date, G.shouted ? 'd_shock' : 'd_yes', 1.6); setTimeout0(1.6, () => { sayMus(L(pick(BS.LINES.finale)), 'loud'); music('loud', 0.95, 0.06); G.musOver = 'm_shout'; G.musOverT = 3; sfx('applause', { vol: 0.6 }) }) }
    else { setPaper(date, 'd_bye', 1.6); setTimeout0(1.4, () => sayMus(L(pick(BS.LINES.lonely)), '')) }
  } else music('quiet', 0.25)
  newThing('end' + G.sc)
}

function stepGame(dt) {
  if (G.mode !== 'play') return
  if (G.over) { G.endT += dt; return }
  G.t += dt
  if (G.later) for (let i = G.later.length - 1; i >= 0; i--) if (G.t >= G.later[i].at) { const f = G.later[i].f; G.later.splice(i, 1); f() }
  // 場面の切り替え（相手の返事を見せてから次へ）
  if (G.inter > 0) {
    G.inter -= dt; G.gz.hwTo = 0; stepGaze(dt)
    if (G.inter <= 0) { if (G.sc >= 3) { G.over = 'end'; G.endT = 0; return } startScene(G.sc + 1) }
    return
  }
  const s = G.cur; s.t += dt; G.scT += dt
  if (s.t >= s.dur) { nextSec(); if (G.over) return }
  stepGaze(dt)
  if (G.policeT >= 0) G.policeT += dt
  if (G.ampT >= 0) { G.ampT -= dt; if (G.ampT < 0 && !['search', 'lecture', 'cd'].includes(G.cur.type)) { G.queue.unshift(sec('search', 3.6), sec('quiet', rnd(4, 5))); G.cur.dur = G.cur.t; newThing('search') } }
  stepNpc(dt)
  if (G.musOverT > 0) { G.musOverT -= dt; if (G.musOverT <= 0) G.musOver = null }
  if (G.immune > 0) G.immune -= dt
  // 相手の我慢
  G.pat -= dt
  const k = 1 - G.pat / G.S.pat
  if (G.nag < 3 && k > [0.3, 0.55, 0.8][G.nag]) { sayPat(L(G.S.wait[G.nag])); G.nag++ }
  if (G.pat <= 0) return sceneEnd(false)
  // 話す
  if (G.hold && !G.lock && canTalk()) {
    const sh = shoutMode()
    if (!sh && inGaze() && G.immune <= 0) { G.seenT += dt; if (G.seenT >= SEEN) return caught() } else G.seenT = Math.max(0, G.seenT - dt * 2)
    const w = G.S.words[G.wi]
    const rate = sh ? (G.ampT >= 0 ? 1.0 : 0.6) : G.cur.type === 'unplug' ? 1.4 : 1
    G.wp += dt / w[2] * rate; if (sh) G.wshout = true
    if (G.wp >= 1) {
      G.wi++; G.wp = 0; if (G.wshout) G.shouted++; G.wshout = false
      sfx('pop', { vol: 0.5 }); ev('word ' + G.wi)
      if (G.wi >= G.S.words.length) return sceneEnd(true)
    }
  } else G.seenT = 0
  if (G.learn) learnStep()
}

function result() {
  const done = G.res.filter(r => r.ok).length
  let pts = 0
  for (const r of G.res) if (r.ok) pts += 100 + Math.round(50 * r.left / r.pat) - 6 * r.shouted
  pts = Math.max(0, pts - 15 * G.strikes + 20 * (G.tricks || 0) + 25 * (G.blames || 0))
  const isOut = G.over === 'out'
  const ti = isOut ? 'out' : done === 4 ? (G.strikes === 0 && pts >= 500 ? 'perfect' : 'all') : ['zero', 'one', 'two', 'three'][done]
  return { points: pts, done, out: isOut, outKind: G.outKind || null, outCause: isOut ? G.outCause : null, outLine: isOut && G.outLine ? L(G.outLine).replace(/\n/g, '') : null, outScene: isOut ? G.sc : null, strikes: G.strikes, tricks: G.tricks || 0, blames: G.blames || 0, scenes: G.res.map(r => ({ ...r })), title: L(BS.TITLES[ti]), titleKey: ti, sec: Math.round(G.t * 10) / 10 }
}

// ============================================================ 初めての1回: 遊びの中で、その時に合わせて教える
function learnStep() {
  const l = G.learn, s = G.cur
  if (G.sc >= 2 || G.t > 80) { G.learn = null; store.set(TUT_KEY, '1'); unsay('hint'); return }
  const gz = G.gz, near = gz.hw > 1 && gz.len > 3 && (gz.pre > 0 || Math.abs(gz.a - youAng()) < gz.hw + 14) && Math.abs(gz.to - youAng()) < gz.hw + 6
  let k = null
  if (s.type === 'wind' && s.loud) k = 'wind'
  else if (SHOUT_TYPES[s.type]) k = 'loud'
  else if (WIDE_TYPES[s.type]) k = 'stop'
  else if (near && s.type === 'quiet') k = 'gaze'
  else if (l.talked < 1) k = 'talk'
  if (!k || G.texts.hint) return
  l.n = l.n || {}
  if ((l.n[k] || 0) >= (k === 'talk' ? 3 : 2)) return
  l.n[k] = (l.n[k] || 0) + 1; l.shown = k
  if (!SIM) say('hint', L(BS.HINT[k]), '', k === 'talk' ? 3.2 : 2.4)
}

// ============================================================ 文字（同時に2つまで）
function say(slot, text, cls = '', sec, at) { if (SIM) return; G.texts[slot] = { text, cls, until: G.clock + (sec || Math.max(1.6, 1.0 + text.length * 0.1)), at } }
const sayMus = (text, cls, sec) => say('mus', text, cls, sec, 'mus')
const sayAt = (who, text) => say('mus', text, '', null, who)
const sayPat = (text, cls) => say('pat', text, cls || '', null, 'pat')
function unsay(slot) { G.texts[slot] = null }
function flash(a = 0.8) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = String(a); requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = '0' })) }

// ============================================================ 画面（DOM）
const VIEWS = ['vTitle', 'vHow', 'vPlay', 'vResult']
function show(id) { for (const v of VIEWS) $(v).hidden = v !== id; $('bMute').hidden = id === 'vResult' }
const v3 = new THREE.Vector3()
function toScreen(p) { v3.copy(p).project(camera); return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight } }
const HEAD = { mus: () => new THREE.Vector3(mus.position.x, 2.15, mus.position.z), mom: () => new THREE.Vector3(mom.position.x, 1.2, mom.position.z), police: () => new THREE.Vector3(police.position.x, 1.9, police.position.z), you: () => new THREE.Vector3(you.position.x - 0.1, 1.8, you.position.z), date: () => new THREE.Vector3(date.position.x, 1.7, date.position.z), tako: () => new THREE.Vector3(tako.position.x, 1.55, tako.position.z) }
function anchorXY(at) {
  if (at === 'pat') {
    const S = G.S
    if (S && !S.phone) return toScreen(HEAD[S.id === 'tako' ? 'tako' : 'date']())
    const r = $('who').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.bottom + 46, under: true }
  }
  return toScreen((HEAD[at] || HEAD.mus)())
}
function textsDom() {
  const now = G.clock
  for (const k in G.texts) { const v = G.texts[k]; if (v && now > v.until) G.texts[k] = null }
  // 同時に2つまで: 教える一文 > 相手 > ミュージシャン
  const mt = G.texts.mus, urgent = mt && /angry|yell/.test(mt.cls || '')
  const on = (urgent ? ['hint', 'mus', 'pat'] : ['hint', 'pat', 'mus']).filter(k => G.texts[k]).slice(0, 2), placed = {}
  for (const k of ['hint', 'pat', 'mus']) {
    const v = on.includes(k) ? G.texts[k] : null, e = $('t_' + k)
    if (!v) { if (!e.hidden) e.hidden = true; continue }
    if (e.dataset.t !== v.text || e.hidden) { e.dataset.t = v.text; e.textContent = v.text; e.className = (k === 'hint' ? 'hint ' : 'bubble ') + (v.cls || '') + (k === 'pat' ? ' pat' : ''); e.hidden = false }
    if (k === 'hint') continue
    const p = anchorXY(v.at), W = innerWidth, H = innerHeight, w = e.offsetWidth, h = e.offsetHeight
    const top = p.under ? p.y - 30 : clamp(p.y - h - 18, 96, H - h - 200)
    const left = clamp(p.x - w / 2, 8, W - w - 8)
    let tp = top
    const q = placed[k === 'mus' ? 'pat' : 'mus']; if (q) { if (left < q.r && left + w > q.l && tp < q.b && tp + h > q.t) tp = q.t - h - 8 < 90 ? q.b + 8 : q.t - h - 8 }
    e.style.left = Math.round(left) + 'px'; e.style.top = Math.round(tp) + 'px'
    placed[k] = { l: left, r: left + w, t: tp, b: tp + h }
    e.style.setProperty('--tail', clamp(p.x - left, 16, w - 16) + 'px'); e.classList.toggle('up', !!p.under)
  }
}
// 相手（左上）: 顔・名前・時刻・我慢の輪
function whoDom() {
  const S = G.S; if (!S) return
  const e = $('who')
  if (e.dataset.id !== S.id || e.dataset.l !== lang) {
    e.dataset.id = S.id; e.dataset.l = lang
    $('whoImg').src = 'img/' + S.face + '.webp'; $('whoName').textContent = L(S.who); $('whoTime').textContent = S.time
    $('whoTitle').textContent = L(S.title); e.classList.toggle('phone', S.phone)
  }
  const k = clamp(G.pat / S.pat, 0, 1), C = 2 * Math.PI * 30
  $('whoRing').setAttribute('stroke-dasharray', (C * k).toFixed(1) + ' ' + C.toFixed(1))
  $('whoRing').setAttribute('stroke', k > 0.45 ? '#f2d16a' : k > 0.2 ? '#f08a3a' : '#e0402c')
  e.classList.toggle('angry', k < 0.2)
}
function picksDom() {
  const n = G.strikes || 0
  ;[...$('picks').children].forEach((p, i) => p.classList.toggle('lost', i < n))
}
function wordsDom() {
  const S = G.S, box = $('words'); if (!S) return
  if (box.dataset.id !== S.id + lang) {
    box.dataset.id = S.id + lang; box.innerHTML = ''
    S.words.forEach(w => { const s = document.createElement('span'); s.textContent = L(w); s.appendChild(document.createElement('i')); box.appendChild(s) })
  }
  ;[...box.children].forEach((s, i) => {
    s.className = i < G.wi ? 'said' : i === G.wi ? 'now' : ''
    const fill = i === G.wi ? G.wp : i < G.wi ? 1 : 0; s.lastChild.style.transform = `scaleX(${fill.toFixed(3)})`
  })
  box.classList.toggle('loud', shoutMode() && canTalk())
}
function talkDom() {
  const b = $('talk'), sh = shoutMode() && canTalk()
  const wind = canTalk() && G.cur && G.cur.type === 'wind'
  const lbl = wind ? T('stopping') : sh ? T('shout') : T('talk')
  if ($('talkL').textContent !== lbl) $('talkL').textContent = lbl
  b.classList.toggle('loud', sh && !wind); b.classList.toggle('wind', wind); b.classList.toggle('down', G.hold && !G.lock); b.classList.toggle('off', !canTalk())
  b.classList.toggle('danger', !sh && canTalk() && inGaze())
}
function eyeDom() {
  const e = $('eye'), gz = G.gz, on = canTalk() && !shoutMode()
  const hit = on && inGaze(), near = on && !hit && gz.hw > 1 && gz.len > 3 && Math.abs(gz.to - youAng()) < gz.hw + 4 && (gz.pre > 0 || Math.abs(gz.a - gz.to) > 1)
  const k = hit ? 'hit' : near ? 'near' : ''
  if (e.dataset.k !== k) { e.dataset.k = k; e.hidden = !k }
  if (!k) return
  const p = toScreen(new THREE.Vector3(you.position.x - 0.2, 1.78, you.position.z))
  e.style.left = Math.round(clamp(p.x, 40, innerWidth - 40)) + 'px'; e.style.top = Math.round(p.y) + 'px'
}
function trickDom() {
  const box = $('tmarks'), list = []
  for (const k of ['amp', 'lyric', 'cable']) if (trickOk(k)) list.push([k, toScreen(TRICK[k])])
  if (npcOk() && G.sc >= 2) list.push(['npc', toScreen(new THREE.Vector3(npc.position.x, 1.0, npc.position.z)), G.npc.talk])
  while (box.children.length < list.length) box.appendChild(document.createElement('i'))
  ;[...box.children].forEach((e, i) => { const it = list[i]; if (!it) { e.hidden = true; return } e.hidden = false; e.dataset.k = it[0]; e.className = it[0] === 'npc' ? (it[2] ? 'npc talk' : 'npc') : ''; e.style.left = Math.round(it[1].x) + 'px'; e.style.top = Math.round(it[1].y) + 'px' })
  const q = $('sus'), n = G.sus || 0
  if (q.dataset.n != n) { q.dataset.n = n; q.textContent = '？'.repeat(n); q.hidden = !n }
  if (n) { const p = toScreen(new THREE.Vector3(mus.position.x + 0.5, 1.55, mus.position.z)); q.style.left = Math.round(p.x) + 'px'; q.style.top = Math.round(p.y) + 'px' }
  const t = $('chat'), on = npcOk() && G.npc.talk
  if (t.hidden === on) t.hidden = !on
  if (on) { const p = toScreen(new THREE.Vector3(npc.position.x + 0.15, 1.75, npc.position.z)); t.style.left = Math.round(p.x) + 'px'; t.style.top = Math.round(p.y) + 'px' }
}
function hitTrick(x, y) {
  let best = null, bd = 1e9; const r = Math.max(44, innerWidth * 0.12)
  for (const e of $('tmarks').children) { if (e.hidden) continue; const ex = parseFloat(e.style.left), ey = parseFloat(e.style.top), d = Math.hypot(ex - x, ey - y); if (d < r && d < bd) { bd = d; best = e.dataset.k } }
  return best
}
function interDom() {
  const c = $('card2'), on = G.mode === 'play' && !G.over && G.inter > 0 && G.inter < 2.2 && G.sc < 3
  if (on) { const N = BS.SCENES[G.sc + 1]; if (c.dataset.id !== N.id + lang) { c.dataset.id = N.id + lang; $('c2Time').textContent = N.time; $('c2Title').textContent = L(N.title) } }
  if (c.hidden === on) c.hidden = !on
}

// ============================================================ 毎フレームの見た目
let musBob = 0
function castLook(dt) {
  const s = G.cur, ty = G.mode === 'play' && s ? s.type : 'quiet', gz = G.gz, playing = G.mode === 'play'
  // ミュージシャンの絵
  let img = 'm_play', flip = false
  if (G.over === 'out') img = 'm_out'
  else if (G.musOver) img = G.musOver
  else if (playing && G.inter > 0) img = 'm_play'
  else if (ty === 'loud' || ty === 'intro') img = 'm_shout'
  else if (ty === 'wind') img = 'm_wind'
  else if (ty === 'stop' || ty === 'brk') img = 'm_look'
  else if (ty === 'clap') img = 'm_clap'
  else if (ty === 'mc' || ty === 'lecture') img = 'm_mic'
  else if (ty === 'cd') img = 'm_cd'
  else if (ty === 'police' || ty === 'panic') img = 'm_bow'
  else if (ty === 'search' || ty === 'unplug') img = ty === 'unplug' && G.cur.t < 2.0 ? 'm_play' : 'm_look'
  else if (gz.hw > 1 && Math.abs(gz.a - youAng()) < gz.hw + 2.5 && gz.len > 3) img = 'm_look'
  else flip = gz.a > 4
  setPaper(mus, img, img === 'm_out' ? 2.5 : 2.0, flip)
  // 揺れ（サビは跳ねる）
  const loud = ty === 'loud' || ty === 'intro'
  musBob += dt * (loud ? 9 : 3)
  const tgtX = ty === 'cd' ? lerp(0, 0.7, Math.min(1, s.t / 1.2) * Math.min(1, (s.dur - s.t) / 1.0)) : 0
  G.musX = lerp(G.musX || 0, tgtX, Math.min(1, dt * 6))
  const tz = ty === 'cd' ? lerp(-2.6, -1.2, Math.min(1, s.t / 1.2) * Math.min(1, (s.dur - s.t) / 1.0)) : -2.6
  mus.position.set(G.musX, loud ? Math.abs(Math.sin(musBob)) * 0.06 : 0, lerp(mus.position.z, tz, Math.min(1, dt * 6)))
  mus.rotation.z = loud ? Math.sin(musBob * 0.5) * 0.05 : Math.sin(musBob) * 0.015
  // アンプ: 音の大きさで膨らむ
  const vol = loud ? 1 : ty === 'quiet' ? 0.35 : 0.1
  const pulse = 1 + vol * 0.05 * Math.abs(Math.sin(G.clock * (loud ? 22 : 8)))
  amp.scale.set(pulse, pulse, pulse); ampLed.intensity = loud ? 1.6 : 0.4
  // 視線の扇
  const shown = gz.hw > 0.6
  setFan(shown ? gz.hw : 0, gz.len)
  fanG.rotation.y = gz.a * DEG
  const onYou = playing && shown && inGaze()
  fanMat.color.set(onYou ? (G.hold && !G.lock && !shoutMode() ? '#ff3b2a' : '#ff8a4a') : '#ffe7a0')
  fanMat.opacity = WIDE_TYPES[ty] ? 0.42 : (gz.pre > 0 && ty === 'quiet') || (ty === 'unplug' && s.t > 2.0 && s.t < 2.6) ? 0.38 + 0.4 * (Math.sin(G.clock * 40) > 0 ? 1 : 0) : 0.5; if (WIDE_TYPES[ty] && !onYou) fanMat.color.set('#ffc070')
  // 自分の絵
  const S = G.S, phone = !S || S.phone || G.mode !== 'play'
  let yimg = phone ? 'y_phone' : 'y_wait'
  const talking = playing && G.hold && !G.lock && canTalk()
  if (talking) yimg = shoutMode() ? (phone ? 'y_pshout' : 'y_shout') : (phone ? 'y_phone' : 'y_whis')
  if (G.over === 'out' && G.endT > 3.0) yimg = 'y_fly'
  setPaper(you, yimg, yimg === 'y_fly' ? 1.4 : 1.72, !!(S && S.id === 'tako' && G.mode === 'play' && yimg !== 'y_fly'))
  if (G.over === 'out' && G.endT > 3.0) { const k = Math.min(1, (G.endT - 3.0) / 0.9); you.position.set(1.1 + k * 3.5, 0.2 + Math.sin(k * Math.PI) * 1.6, 0.35 + k * 0.8); you.rotation.z = -k * 5 }
  else { you.position.set(1.1, talking && shoutMode() ? 0.03 : 0, 0.35); you.rotation.z = 0 }
  // 警察
  if (police.visible) {
    // 来て、立ち止まって、去る（まれに残って1曲聴いていく）
    const t = G.policeT, stay = G.rare && G.rare.fan
    const px = t < 0 ? -4.5 : t < 1.6 ? lerp(-3.6, -1.2, t / 1.6) : (t < 7 || stay) ? -1.2 : lerp(-1.2, -4.5, Math.min(1, (t - 7) / 1.8))
    police.position.set(px, 0, -1.4)
    if (t > 9 && !stay) police.visible = false
  }
  // しゃべる通行人
  const n = G.npc
  if (n && n.t >= 0 && G.mode === 'play') {
    npc.visible = true
    if (n.fly >= 0) { const k = Math.min(1, n.fly / 1.0); setPaper(npc, NPC_FLY[n.k], 1.3); npc.position.set(-1.05 - k * 3.2, 0.3 + Math.sin(k * Math.PI) * 1.4, -1.15 + k * 0.6); npc.rotation.z = k * 5 }
    else { setPaper(npc, NPC_IMG[n.k], 1.5); npc.position.set(-1.05, n.talk ? Math.abs(Math.sin(G.clock * 14)) * 0.02 : 0, -1.15); npc.rotation.z = 0 }
  } else npc.visible = false
  lyric.rotation.z = G.lyricSwap ? 0.12 : 0
  plug.visible = !(G.cur && G.cur.type === 'unplug')
  // 屋台の人
  tako.position.y = 0.62 + Math.sin(G.clock * 2.3) * 0.01
  // 夕方から夜へ
  const night = G.mode === 'play' ? clamp((G.sc + Math.min(1, (G.scT || 0) / 40)) / 4, 0, 1) : 0.15
  skyB.material.opacity = night
  LK.sun.intensity = lerp(1.5, 0.25, night); LK.hemi.intensity = lerp(0.75, 0.45, night)
  for (const l of lamps) l.intensity = lerp(1.5, 7, night)
  lampMat.emissiveIntensity = lerp(0.3, 2.2, night); vendL.intensity = lerp(0.4, 2.2, night); stallLight.intensity = stall.visible ? lerp(0.8, 3, night) : 0
  station.material.emissiveIntensity = lerp(0.2, 0.75, night)
  const mins = 18 * 60 + Math.round(night * 60); if (mins !== castLook.m) { castLook.m = mins; drawClock(mins) }
  for (const w of walkers) { w.x0 += w.v * dt; if (w.x0 > 10) w.x0 = -10; if (w.x0 < -10) w.x0 = 10; w.m.position.x = w.x0; w.m.position.y = w.m.geometry.parameters.height / 2 + Math.abs(Math.sin(G.clock * 6 + w.x0)) * 0.03 }
}

// ============================================================ 遊びの開始・終わり
function firstTouch() {
  Snd.init()
  if (!Snd.loops.amb && !SIM) { Snd.loop('amb', S_('amb_city'), 0.3); Snd.loop('crowd', S_('amb_crowd'), 0.07); if (G.mode !== 'play') music('quiet', 0.18) }
}
let resultShown = false
function startPlay(learn = false) {
  const seed = params.has('seed') ? +params.get('seed') : (Date.now() % 100000) + G.playNo * 7
  G.texts = { mus: null, pat: null, hint: null }; resultShown = false; G.later = []
  for (const c of coins) c.visible = false; coins.slice(0, 3).forEach(c => c.visible = true)
  police.visible = false; G.policeT = -1
  newGame(seed, learn); G.mode = 'play'
  $('outPanel').hidden = true; $('outPanel').className = ''
  if (window.TM) TM.start()
  show('vPlay')
}
function begin() { firstTouch(); sfx('click', { vol: 0.6 }); G.playNo++; startPlay(!store.get(TUT_KEY) && !params.has('notut')) }
// 終わりの演出
function stepEnd() {
  if (!G.over || G.mode !== 'play') return
  const t = G.endT
  if (G.over === 'out') {
    if (!G.e1) { G.e1 = true; if (!SIM) { sfx('chord', { vol: 1, jitter: 0 }); fx.shake(0.07, 0.4); if (G.outKind === 'shout') say('mus', G.outWord + (lang === 'en' ? '!!!' : 'ぁぁぁ！'), 'yell', 1.3, 'you') } }
    const at = G.outKind === 'shout' ? 1.1 : 0.35
    if (t > at && !G.e2) { G.e2 = true; if (!SIM) { G.texts.mus = null; G.texts.pat = null; showOut(); fx.shake(0.1, 0.6); flash(0.7); sfx('thud', { vol: 0.9 }) } }
    if (t > at + 1.9 && !G.e3) { G.e3 = true; if (!SIM) { $('outPanel').classList.add('away'); sfx('swish', { vol: 0.8 }) } }
    if (t > 3.0 + 0.85 && !G.e4) { G.e4 = true; if (!SIM) { $('outPanel').hidden = true; sfx('thud', { vol: 0.7 }); sayMus(L(BS.LINES.outAfter[G.rare.outLine]), '') ; if (G.rare.outLine === 1) G.texts.mus.at = 'mom'; music('quiet', 0.35) } }
    if (t > 5.8 && !resultShown) { resultShown = true; showResult() }
  } else if (G.over === 'end') {
    if (t > 0.3 && !resultShown) { resultShown = true; showResult() }
  }
}
function showOut() {
  const p = $('outPanel'); $('outImg').src = 'img/m_out.webp'
  $('outLine').textContent = L(G.outLine || BS.LINES.out); $('outSub').textContent = G.outKind === 'shout' ? L(BS.LINES.shoutSolo) : ''
  p.className = ''; p.hidden = false; void p.offsetWidth; p.classList.add('on')
}
async function showResult() {
  const r = result()
  G.mode = 'result'; show('vResult')
  if (window.TM) TM.end(r.points, !r.out && r.done === 4)
  await drawCard(r)
  fitCard()
  $('outPanel').hidden = true
  const ja = r.out ? `路上ライブの横で「${G.outWord}」と言ったら「${r.outLine}」で追い出された。用事${r.done}/4、${r.points}点 #路上ライブは私語厳禁` : `爆音の路上ライブの横で用事を${r.done}/4済ませた。${r.points}点「${r.title}」 #路上ライブは私語厳禁`
  const en = r.out ? `Got kicked out of a street gig for saying "${G.outWord}". Errands ${r.done}/4, ${r.points} pts. #BuskingZoneNoTalking` : `Got ${r.done}/4 errands done next to a deafening street gig. ${r.points} pts "${r.title}" #BuskingZoneNoTalking`
  $('bPost').href = 'https://x.com/intent/post?text=' + encodeURIComponent(lang === 'en' ? en : ja) + '&url=' + encodeURIComponent('https://tom3games.com/play/busker-shush/')
  sfx(r.out ? 'j_bad' : r.done >= 3 ? 'j_good' : 'j_mid', { vol: 0.5 })
  window.__lastResult = r
}
function fitCard() {
  const box = $('cardBox'), c = $('card'), bw = box.clientWidth, bh = box.clientHeight
  const s = Math.min(bw / 720, bh / 1000); c.style.width = Math.floor(720 * s) + 'px'; c.style.height = Math.floor(1000 * s) + 'px'
}
addEventListener('resize', () => { if (!$('vResult').hidden) fitCard() })
if (window.ResizeObserver) new ResizeObserver(() => { if (!$('vResult').hidden) fitCard() }).observe($('cardBox'))
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src }) }
// 結果: ミュージシャンの手書きセットリスト（段ボールに貼った紙）に、赤ペンで自分の用事の結果
async function drawCard(r) {
  const c = $('card'), x = c.getContext('2d'), W = 720, H = 1000
  try { await Promise.all([document.fonts.load('40px "Yusei Magic"'), document.fonts.load('40px "Reggae One"')]) } catch (e) {}
  const pen = '"Yusei Magic", "Hiragino Maru Gothic ProN", sans-serif', big = '"Reggae One", "Hiragino Sans", sans-serif'
  // 段ボール
  x.fillStyle = '#b98b55'; x.fillRect(0, 0, W, H)
  x.strokeStyle = 'rgba(90,60,30,.22)'; x.lineWidth = 2; for (let i = 0; i < W; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke() }
  // 紙
  x.save(); x.translate(W / 2, 470); x.rotate(-0.012)
  x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(-300 + 8, -420 + 10, 600, 860)
  x.fillStyle = '#fbf8ef'; x.fillRect(-300, -420, 600, 860)
  x.fillStyle = 'rgba(230,220,190,.85)'; x.fillRect(-70, -436, 140, 34)
  x.restore()
  x.fillStyle = '#1d1d1d'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'
  x.font = `700 44px ${pen}`; x.fillText(lang === 'en' ? 'TONIGHT’S SETLIST' : '本日のセットリスト', W / 2, 120)
  x.font = `700 22px ${pen}`; x.fillStyle = '#555'; x.fillText(lang === 'en' ? 'Station square street gig' : '駅前・路上ライブ', W / 2, 154)
  const songs = lang === 'en' ? ['A Flower on the Asphalt', 'The Gate Is My Stage', 'Mom, Are You Watching', 'Final Chorus at the Station'] : ['アスファルトに咲く俺', '改札は俺のステージ', 'ママ見てるか', '駅前ラストサビ']
  for (let i = 0; i < 4; i++) {
    const y = 226 + i * 104, sc = BS.SCENES[i], rr = r.scenes[i]
    x.textAlign = 'left'; x.fillStyle = '#1d1d1d'; x.font = `700 30px ${pen}`; x.fillText((i + 1) + '. ' + songs[i], 92, y)
    x.font = `700 23px ${pen}`; x.fillStyle = '#b3241c'
    const res = rr ? (rr.ok ? (lang === 'en' ? `done in ${rr.t}s` : `${rr.t}秒で済んだ`) : (lang === 'en' ? 'gave up' : '相手が帰った')) : (r.out && i === r.outScene ? (lang === 'en' ? 'kicked out for ' + L(BS.LINES.why[r.outCause]) : L(BS.LINES.why[r.outCause]) + '追い出された') : '')
    x.fillText(sc.time + '  ' + L(sc.title) + (res ? '  ' + res : ''), 110, y + 38)
    // 赤ペンの丸・バツ
    x.strokeStyle = '#c42a1e'; x.lineWidth = 5; x.beginPath()
    if (rr && rr.ok) x.arc(640, y + 8, 26, 0, 7)
    else if (rr || (r.out && i === r.outScene)) { x.moveTo(616, y - 16); x.lineTo(664, y + 32); x.moveTo(664, y - 16); x.lineTo(616, y + 32) }
    x.stroke()
  }
  // 写真（テープ留め）
  const photo = r.out ? 'm_out' : r.done === 4 ? (r.scenes[3] && r.scenes[3].shouted ? 'd_shock' : 'd_yes') : r.done === 0 ? 'm_shout' : 'm_clap'
  const ph = await loadImg('img/' + photo + '.webp')
  const px0 = 96, py0 = 640, pw = 250, phh = 280
  x.save(); x.translate(px0 + pw / 2, py0 + phh / 2); x.rotate(r.out ? -0.05 : 0.04)
  x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(-pw / 2 + 6, -phh / 2 + 8, pw, phh)
  x.fillStyle = '#fff'; x.fillRect(-pw / 2, -phh / 2, pw, phh)
  x.fillStyle = r.out ? '#f3d9c6' : '#e7eef6'; x.fillRect(-pw / 2 + 10, -phh / 2 + 10, pw - 20, phh - 20)
  if (r.out) { x.save(); x.beginPath(); x.rect(-pw / 2 + 10, -phh / 2 + 10, pw - 20, phh - 20); x.clip(); x.fillStyle = 'rgba(40,20,10,.5)'; for (let a = 0; a < Math.PI * 2; a += 0.12) { x.beginPath(); x.moveTo(0, -10); x.lineTo(Math.cos(a) * 400, Math.sin(a) * 400 - 10); x.lineTo(Math.cos(a + 0.03) * 400, Math.sin(a + 0.03) * 400 - 10); x.fill() } x.restore() }
  if (ph) { const h = phh - 28, w = Math.min(pw - 24, ph.width / ph.height * h), hh = w / (ph.width / ph.height); x.drawImage(ph, -w / 2, -phh / 2 + 14 + (h - hh), w, hh) }
  x.fillStyle = 'rgba(240,230,200,.85)'; x.fillRect(-50, -phh / 2 - 12, 100, 26)
  x.restore()
  // 判子（出禁 / 済）と点・称号
  x.save(); x.translate(520, 720); x.rotate(-0.18)
  x.strokeStyle = '#c42a1e'; x.fillStyle = '#c42a1e'; x.lineWidth = 7
  if (r.out) { x.strokeRect(-110, -62, 220, 124); x.font = `400 76px ${big}`; x.textAlign = 'center'; x.fillText(lang === 'en' ? 'BANNED' : '出禁', 0, 28) }
  else { x.beginPath(); x.arc(0, 0, 82, 0, 7); x.stroke(); x.font = `400 ${r.done === 4 ? 64 : 54}px ${big}`; x.textAlign = 'center'; x.fillText(r.done + '/4', 0, 22) }
  x.restore()
  x.textAlign = 'center'; x.fillStyle = '#1d1d1d'
  x.font = `700 40px ${pen}`; let fs = 40; while (x.measureText(r.title).width > 300 && fs > 24) { fs -= 2; x.font = `700 ${fs}px ${pen}` }
  x.fillText(r.title, 520, 852)
  x.font = `700 30px ${pen}`; x.fillText(r.points + (lang === 'en' ? ' pts' : '点'), 520, 896)
  if (r.out) { x.font = `700 22px ${pen}`; x.fillStyle = '#b3241c'; const q = lang === 'en' ? `Last word: "${G.outWord}"` : `最後の一言「${G.outWord}」`; x.fillText(q, W / 2, 958) }
  else { x.font = `700 24px ${pen}`; x.fillStyle = '#222'; x.fillText(lang === 'en' ? `Strikes ${r.strikes} / Pranks ${r.tricks} / Blamed others ${r.blames}` : `見つかった ${r.strikes}　いたずら ${r.tricks}　なすりつけ ${r.blames}`, W / 2, 958) }
  x.font = `700 20px ${pen}`; x.fillStyle = '#2a1c10'; x.textAlign = 'right'; x.fillText(lang === 'en' ? 'Busking Zone: No Talking' : '路上ライブは私語厳禁', W - 22, 990)
}

// ============================================================ ボタン
function applyLang() {
  document.documentElement.lang = lang
  $('t1').textContent = T('title1'); $('t2').textContent = T('title2'); $('tSub').textContent = T('sub')
  $('bStart').textContent = T('start'); $('bHow').textContent = T('how'); $('bLang').textContent = T('lang')
  $('howH').textContent = T('how'); $('howWarn').textContent = L(BS.HOWTO.warn); $('howUi').textContent = L(BS.HOWTO.ui); $('bHowClose').textContent = T('close'); $('lPrivacy').textContent = T('privacy')
  $('howCredit').textContent = lang === 'en' ? 'Music: Jason Shaw (Audionautix, CC BY 3.0 US), Antti Luode (CC BY 3.0). Sounds: Mcrfobrockr (CC BY 3.0), Kenney and other CC0 / public domain recordings' : '曲: Jason Shaw（Audionautix, CC BY 3.0 US）、Antti Luode（CC BY 3.0）　音: Mcrfobrockr（CC BY 3.0）ほか CC0・パブリックドメインの録音'
  const ruleImg = ['img/y_phone.webp', 'img/m_look.webp', 'img/m_bow.webp', 'img/m_wind.webp']
  $('howRules').innerHTML = ''
  BS.HOWTO.rules.forEach(([a, b], i) => {
    const li = document.createElement('li')
    const pic = Object.assign(document.createElement('img'), { src: ruleImg[i], alt: '' })
    const t = document.createElement('div'); t.innerHTML = '<b></b><span></span>'; t.querySelector('b').textContent = L(a); t.querySelector('span').textContent = L(b)
    li.append(pic, t); $('howRules').append(li)
  })
  $('bAgain').textContent = T('again'); $('bSave').textContent = T('save'); $('bPost').textContent = T('post')
  $('who').dataset.l = ''; $('words').dataset.id = ''
}
$('bStart').onclick = begin
$('bAgain').onclick = begin
$('bHow').onclick = () => { firstTouch(); show('vHow') }
$('bHowClose').onclick = () => show('vTitle')
$('bLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('bs_lang', lang); applyLang() }
$('bMute').onclick = () => { muted = !muted; store.set('bs_mute', muted ? '1' : '0'); Snd.setMute(muted); $('bMute').classList.toggle('off', muted) }
$('bMute').classList.toggle('off', muted)
$('bSave').onclick = () => { if (window.TM) TM.share('save'); $('card').toBlob(b => { if (!b) return; const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = 'busker-shush.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000) }) }
$('bPost').onclick = () => { if (window.TM) TM.share('x') }
// 画面をタップ: 輪の付いた機材・しゃべっている通行人
canvas.addEventListener('pointerdown', e => {
  if (G.mode !== 'play' || G.over) return
  const k = hitTrick(e.clientX, e.clientY); if (!k) return
  e.preventDefault(); firstTouch()
  if (k === 'npc') blame(); else trick(k)
})
// 話すボタン（押している間）。指が外にずれても離したことにする
const talk = $('talk')
const downs = new Set()
talk.addEventListener('pointerdown', e => { e.preventDefault(); downs.add(e.pointerId); try { talk.setPointerCapture(e.pointerId) } catch (er) {} ; if (G.mode === 'play') { firstTouch(); setHold(true) } })
for (const n of ['pointerup', 'pointercancel', 'lostpointercapture']) talk.addEventListener(n, e => { downs.delete(e.pointerId); if (!downs.size) setHold(false) })
talk.addEventListener('contextmenu', e => e.preventDefault())
addEventListener('keydown', e => { if (e.code === 'Space' && G.mode === 'play' && !e.repeat) { e.preventDefault(); setHold(true) } })
addEventListener('keyup', e => { if (e.code === 'Space') setHold(false) })
addEventListener('blur', () => { downs.clear(); setHold(false) })
document.addEventListener('visibilitychange', () => { if (document.hidden) { downs.clear(); setHold(false) } })

// ============================================================ ループ
const STEP = 1 / 60
let last = performance.now(), acc = 0
function logic(dt) {
  G.clock += dt
  if (G.mode === 'play') {
    if (G.bot && !SIM && !G.over) G.bot(api, G.botSt || (G.botSt = { r: mulberry(5) }), dt)
    stepGame(dt); stepEnd()
  } else {
    // タイトルの裏: 静かな曲で視線を回している
    if (!G.cur || G.cur.type !== 'quiet') { G.cur = sec('quiet', 1e9); G.cur.t = 0; G.gz.hwTo = 13; G.gz.len = 7.5 }
    G.cur.t += dt; stepGaze(dt)
  }
}
function render(dtR) {
  const vdt = fx.update(dtR)
  castLook(vdt)
  for (const m of PAPERS) { if (!m.visible || !m.userData.face) continue; m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z) }
  camera.position.copy(CAM.p); camera.lookAt(CAM.t)
  look.update(); fx.applyCamera()
  renderer.render(scene, camera)
  if (G.mode === 'play') { textsDom(); whoDom(); picksDom(); wordsDom(); talkDom(); interDom(); eyeDom(); trickDom() }
  else { for (const k of ['hint', 'pat', 'mus']) $('t_' + k).hidden = true; $('card2').hidden = true; $('eye').hidden = true; $('tmarks').innerHTML = ''; $('sus').hidden = true; $('chat').hidden = true }
}
function loop(now) {
  requestAnimationFrame(loop)
  let dt = (now - last) / 1000; last = now
  if (dt > 0.25) dt = 0.25
  if (!G.paused) { acc += dt * (G.speed || 1); let n = 0; while (acc >= STEP && n < 240) { logic(STEP); acc -= STEP; n++ } }
  render(G.paused ? 0 : dt)
}

// ============================================================ 検証用の窓口と bot
const api = {
  get state() {
    const s = G.cur || {}, gz = G.gz || {}
    return { mode: G.mode, t: G.t, sc: G.sc, sec: s.type, secT: s.t, secDur: s.dur, loudWind: s.type === 'wind' && !!s.loud, gazeA: gz.a, gazeTo: gz.to, gazeSpd: gz.spd, gazeHW: gz.hw, gazeLen: gz.len, gazePre: gz.pre || 0, youA: youAng(), youD: distTo(you.position), inGaze: inGaze(), shout: shoutMode(), can: canTalk(), hold: G.hold, lock: G.lock, wi: G.wi, wp: G.wp, wordDur: G.S && G.S.words[G.wi] ? G.S.words[G.wi][2] : 0, pat: G.pat, strikes: G.strikes, sus: G.sus || 0, tricks: G.tricks || 0, blames: G.blames || 0, avail: ['amp', 'lyric', 'cable'].filter(trickOk), npcTalk: npcOk() && G.npc.talk, npcOn: npcOk(), ampLow: G.ampT >= 0, inter: G.inter, over: G.over, outKind: G.outKind, news: G.news.slice(), learn: G.learn && { ...G.learn } }
  },
  hold: setHold, result, trick, blame,
  trickXY(k) { const p = k === 'npc' ? toScreen(new THREE.Vector3(npc.position.x, 1.0, npc.position.z)) : toScreen(TRICK[k]); return p },
  talkXY() { const r = $('talk').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } },
  texts: () => ['hint', 'pat', 'mus'].filter(k => !$('t_' + k).hidden).map(k => $('t_' + k).textContent),
  events: () => G.events.slice(),
  sim(botName, seed, o = {}) {
    SIM = true; const keepMode = G.mode
    newGame(seed); G.mode = 'play'
    const bot = BOTS[botName], st = { r: mulberry(seed * 13 + 3), ...o }
    let n = 0
    while (!G.over && n < 60 * 400) { bot(api, st, STEP); stepGame(STEP); n++ }
    const r = result(); r.news = G.news.slice(); if (o.events) r.events = G.events.slice()
    SIM = false; G.mode = keepMode === 'play' ? 'title' : keepMode; G.over = null; G.cur = null; G.S = null
    return r
  },
  dbg: {
    pause(v = true) { G.paused = v; if (!v) last = performance.now() },
    step(n = 1) { for (let i = 0; i < n; i++) logic(STEP); render(0) },
    tick(n = 1) { for (let i = 0; i < n; i++) logic(STEP) },
    speed(k) { G.speed = k },
    render() { render(0) },
    G, newGame, startPlay, showResult, out, caught, nextSec, startScene, sceneEnd, sec,
    set(o) { Object.assign(G, o) },
    camera, scene, CAM, say, sayMus, sayPat, BS,
    useBot(n) { G.bot = n ? BOTS[n] : null; G.botSt = null },
    goto(type, o = {}) { G.queue.unshift(sec(type, o.dur || 6, o)); G.cur.dur = G.cur.t },
  },
}
window.bs = api
// bot: 人間の速さで動く（react 秒遅れて気づく）
function danger(s, st) {
  // 視線が自分に届くまでの秒数（届かないなら大きい数）
  if (s.shout) return 99
  if (s.sec === 'wind') return 0
  if (s.sec === 'unplug') return s.secT < 2.6 ? 2.6 - s.secT : 0
  if (s.sec === 'panic') return 99
  const hw = s.sec === 'stop' || s.sec === 'clap' || s.sec === 'brk' ? 62 : s.gazeHW
  if (hw < 1 && !(s.sec === 'quiet' || s.sec === 'mc' || s.sec === 'cd' || s.sec === 'police' || s.sec === 'lecture' || s.sec === 'tune')) return 99
  const w = Math.max(hw, 12)
  if (s.gazeLen < s.youD - 0.3) return 99
  const gap = Math.abs(s.gazeA - s.youA) - w - 2.5
  if (gap <= 0) return 0
  const toward = Math.sign(s.gazeTo - s.gazeA) === Math.sign(s.youA - s.gazeA) && Math.abs(s.gazeTo - s.youA) < Math.abs(s.gazeA - s.youA) + w
  if (s.sec === 'mc' || s.sec === 'search') return gap / 120
  if (!toward) return 99
  return (s.gazePre || 0) + gap / Math.max(30, s.gazeSpd)
}
const BOTS = {
  idle() {},
  chatty(api) { const s = api.state; api.hold(!s.lock || !s.hold) },
  // 爆音の間だけ叫ぶ（振りかぶったら離す）
  loudonly(api, st, dt) {
    const s = api.state; st.w = s.loudWind ? (st.w || 0) + dt : 0
    api.hold(s.shout && !(s.loudWind && st.w >= (st.react ?? 0.45)) && s.can)
  },
  spam(api, st, dt) { if (st.r() < dt * 2) api.hold(!api.state.hold) },
  // 上手い / 普通: 視線の動きを見て、言い切れる間だけ話す。サビは叫び、振りかぶったら離す
  good(api, st, dt) {
    const s = api.state
    if (!s.can) { api.hold(false); st.see = 0; return }
    const react = st.react ?? 0.45
    if (s.shout) {
      st.w = s.loudWind ? (st.w || 0) + dt : 0
      if (s.loudWind && st.w >= react) return api.hold(false)
      if (!s.loudWind && s.sec !== 'wind' && s.secDur - s.secT < (st.careless ? 0.3 : 1.2) + react) return api.hold(false)
      return api.hold(true)
    }
    // もうひと工夫: いたずら（見ていない隙に機材）となすりつけ（視線が来そうな時、しゃべっている通行人）
    if (st.tricks && !s.hold) {
      const d0 = (st.hist && st.hist[0]) ?? 99
      st.tcool = (st.tcool || 0) - dt
      if (st.tcool <= 0 && s.avail.length && d0 > (st.greedy ? 0.15 : 1.5) && (st.greedy || s.sus < 3) && s.sec !== 'wind') {
        const k = ['lyric', 'cable', 'amp'].find(x => s.avail.includes(x) && (x !== 'cable' || s.sec === 'quiet' || st.greedy)); if (k) { api.trick(k); st.tcool = st.greedy ? 0.1 : 1.5; return }
      }
    }
    if (st.blame && s.npcTalk && !s.shout) { const d0 = (st.hist && st.hist[0]) ?? 99; if (d0 < 0.7) { api.blame(); return } }
    st.w = s.sec === 'wind' ? (st.w || 0) + dt : 0
    if (s.sec === 'wind' && st.w >= react) return api.hold(false)
    // 見えてから判断するまで react 秒（視線の状態を遅れて読む）
    st.hist = st.hist || []; st.hist.push(danger(s, st)); if (st.hist.length > Math.round(react * 60)) st.hist.shift()
    const d = st.hist[0], rem = (1 - s.wp) * s.wordDur
    if (s.hold) { if (d < rem + 0.05) api.hold(false) }
    else if (d > rem + (st.margin ?? 0.35)) { if (!st.miss || st.r() > st.miss * dt * 60) api.hold(true) }
    if (st.sloppy && !s.hold && st.r() < st.sloppy * dt) api.hold(true)
  },
}
BOTS.trick = (api, st, dt) => { st.tricks = true; st.blame = true; BOTS.good(api, st, dt) }
BOTS.trickN = (api, st, dt) => { st.tricks = true; st.blame = true; BOTS.normal(api, st, dt) }
BOTS.greedy = (api, st, dt) => { st.tricks = true; st.greedy = true; BOTS.good(api, st, dt) }
BOTS.normal = (api, st, dt) => { st.react = st.react ?? 0.7; st.margin = st.margin ?? 0.45; st.sloppy = st.sloppy ?? 0.04; st.miss = st.miss ?? 0.02; BOTS.good(api, st, dt) }
BOTS.slow = (api, st, dt) => { st.react = st.react ?? 0.95; st.margin = st.margin ?? 0.55; st.sloppy = st.sloppy ?? 0.06; BOTS.good(api, st, dt) }

// ============================================================ 起動
applyLang()
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { applyLang(); const c = signTex.userData.c, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); signDraw(x, c.width, c.height); signTex.needsUpdate = true; const n = norenTex.userData.c; norenDraw(n.getContext('2d'), n.width, n.height); norenTex.needsUpdate = true })
function signDraw(x, w, h) {
  x.fillStyle = '#b98b55'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(90,60,30,.35)'; for (let i = 0; i < w; i += 9) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke() }
  x.fillStyle = '#1b1b1b'; x.font = '40px "Yusei Magic", sans-serif'; x.textAlign = 'center'
  x.fillText(lang === 'en' ? 'LIVE' : '路上ライブ', w / 2, 52); x.font = '28px "Yusei Magic", sans-serif'; x.fillText(lang === 'en' ? 'till 7 PM' : '本日19時まで', w / 2, 98)
  x.fillStyle = '#b3241c'; x.font = '34px "Yusei Magic", sans-serif'; x.fillText(lang === 'en' ? 'CD $10' : 'CD 1000円', w / 2, 150)
  x.fillStyle = '#1b1b1b'; x.font = '19px "Yusei Magic", sans-serif'; x.fillText(lang === 'en' ? 'Photos OK. No talking' : '写真OK・私語NG', w / 2, 184)
}
function norenDraw(x, w, h) { x.fillStyle = '#b8261c'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff6e6'; x.font = '56px "Yusei Magic", sans-serif'; x.textAlign = 'center'; x.fillText(lang === 'en' ? 'TAKO' : 'たこ焼', w / 2, 66); x.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = 64; i < w; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke() } }
const PRE = ['m_play', 'mom', 'y_phone']
const LATER = ['n_aunt', 'n_stream', 'n_suit', 'n_aunt_f', 'n_stream_f', 'n_suit_f', 'm_look', 'm_shout', 'm_wind', 'm_mic', 'm_bow', 'm_out', 'm_cd', 'm_clap', 'y_pshout', 'y_fly', 'y_wait', 'y_whis', 'y_shout', 'police', 'tako', 'boss', 'friend', 'date', 'd_yes', 'd_bye', 'd_shock']
let readyDone = false
function ready() {
  if (readyDone) return; readyDone = true
  for (const n of LATER) tex(n)
  for (const n of ['m_out', 'boss', 'friend', 'tako', 'date']) { const i = new Image(); i.src = 'img/' + n + '.webp' }
  window.__bootDone = true; $('boot').classList.add('gone')
  G.mode = 'title'; show('vTitle')
  window.__bsReady = true
}
let pending = PRE.length
for (const n of PRE) { const t = tex(n); const chk = () => { if (t.image && t.image.complete !== false && t.image.width) { if (window.__bootStep) __bootStep(); if (--pending <= 0) ready() } else setTimeout(chk, 50) }; chk() }
setTimeout(ready, 9000)
requestAnimationFrame(t => { last = t; loop(t) })
