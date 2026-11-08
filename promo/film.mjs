import '../mute-auto.mjs'   // ブラウザでは絶対に音を出さない。音は ffmpeg で後から重ねる
// SNS 用の縦長動画（1080x1920・約16秒・H.264）。ゲームの実際の画面を、止めた時間で1コマずつ進めて撮る。node promo/film.mjs
// 流れ: 爆音ライブの横で上司の電話 → 視線の隙にひそひそ → サビで叫ぶ → 振りかぶっても叫び続ける → 曲が止まって一発退場の大ゴマ → 投げ出される → セットリスト＋題名
import { chromium } from 'playwright'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
const ROOT = new URL('..', import.meta.url).pathname, OUT = ROOT + 'promo/'
const TMP = process.env.FRAMES || tmpdir() + '/busker-shush-frames-' + Date.now()
mkdirSync(TMP, { recursive: true })
const PORT = 7128, FPS = 30
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, locale: 'ja-JP' })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}/?notut&seed=21`); await p.waitForFunction(() => window.__bsReady); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
await p.evaluate(() => {
  const d = bs.dbg, G = d.G
  d.startPlay(); d.pause(true)
  // 台本どおりに進めるため、区間を差し替える（静かな曲 → サビ → 振りかぶり → 止まる）
  G.queue = [d.sec('loud', 3.4), d.sec('wind', 1.3), d.sec('stop', 4)]; G.cur.dur = 3.9
  G.gz.a = G.gz.to = -50; G.gz.dwell = 2.6; G.gz.pre = 0; G.gz.hw = 13; G.gz.hwTo = 13; G.gz.tgt = 'mom'
  d.sayPat('おい、今どこにおる？'); d.sayMus('君の笑顔は〜俺の電気代〜', 'lyric')
  window.__fs = { f: 0, ev: [] }
})
let n = 0
for (;;) {
  const done = await p.evaluate(() => {
    const d = bs.dbg, G = d.G, S = window.__fs, t = S.f / 30
    // 台本の操作（自分の指）
    if (G.mode === 'play' && !G.over) {
      if (t >= 0.8 && t < 2.5) G.hold = true
      if (t >= 2.5 && t < 3.9) G.hold = false
      if (t >= 2.1 && G.gz.tgt === 'mom' && G.cur.type === 'quiet') { G.gz.tgt = 'you'; G.gz.to = bs.state.youA; G.gz.spd = 60; G.gz.pre = 0.6; G.gz.dwell = 5 }
      if (G.cur.type !== 'quiet') G.hold = true   // サビから叫び続け、止まるまで離さない
    }
    if (G.over && !S.outAt) { S.outAt = S.f; S.ev.push(['out', t]) }
    if (G.cur && G.cur.type !== S.last) { S.ev.push([G.cur.type, t]); S.last = G.cur.type }
    if (G.mode === 'result' && !S.resAt) { S.resAt = S.f; S.ev.push(['result', t]) }
    d.step(2); S.f++
    if (S.resAt && S.f === S.resAt + 8) {
      const c = document.createElement('div'); c.id = 'promoCap'; c.textContent = '路上ライブは私語厳禁'
      c.style.cssText = 'position:fixed;left:0;right:0;top:83%;z-index:50;text-align:center;font:400 46px "Reggae One";color:#fff;-webkit-text-stroke:2.5px #141414;paint-order:stroke;text-shadow:4px 4px 0 #c42a1e;transform:rotate(-3deg);pointer-events:none'
      document.body.appendChild(c)
    }
    return S.resAt && S.f >= S.resAt + 56
  })
  await p.screenshot({ path: `${TMP}/f${String(n).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 })
  n++
  if (done || n > FPS * 20) break
}
const ev = await p.evaluate(() => window.__fs.ev)
await b.close(); server.kill()
const at = k => (ev.find(e => e[0] === k) || [0, 0])[1]
const tLoud = at('loud'), tStop = at('stop'), tOut = at('out'), tRes = at('result'), dur = n / FPS
// 音: 街の環境音 → 静かな曲 → サビ（爆音）→ ジャーン → 静寂 → ドン（大ゴマ）→ ひゅっ・ドン（投げ出し）→ ジングル
const S = f => ROOT + 'snd/' + f + '.mp3'
const tPanel = tOut + 1.1, tFly = tOut + 3.0
const parts = [
  [S('amb_city'), 0, 0.5, dur], [S('verse'), 0, 0.55, tLoud], [S('chorus'), tLoud, 1.0, tStop - tLoud], [S('ringback'), 0, 0.35, 1.0],
  [S('chord'), tStop, 1.0, 3], [S('thud1'), tPanel, 1.0, 1.5], [S('swish1'), tFly, 0.9, 1], [S('thud2'), tFly + 0.85, 0.8, 1], [S('j_bad'), tRes, 0.7, 3],
]
const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${TMP}/f%04d.jpg`]
for (const [f] of parts) args.push('-i', f)
const fl = parts.map(([, st, vol, len], i) => `[${i + 1}:a]atrim=0:${len.toFixed(2)},afade=t=out:st=${Math.max(0, len - 0.12).toFixed(2)}:d=0.12,volume=${vol},adelay=${Math.round(st * 1000)}|${Math.round(st * 1000)}[a${i}]`)
fl.push(parts.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${parts.length}:normalize=0,atrim=0:${dur.toFixed(2)},alimiter=limit=0.9[aud]`)
fl.push(`[0:v]scale=1080:1920,setsar=1,fps=${FPS},format=yuv420p[v]`)
const out = OUT + 'busker-shush-promo-1080x1920.mp4'
args.push('-filter_complex', fl.join(';'), '-map', '[v]', '-map', '[aud]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-movflags', '+faststart', '-shortest', out)
execFileSync('ffmpeg', args)
writeFileSync(OUT + 'film-log.json', JSON.stringify({ frames: n, sec: dur, ev, errs, frames_dir: TMP }, null, 1))
console.log(JSON.stringify({ frames: n, sec: dur.toFixed(2), ev, errs, out, TMP }))
