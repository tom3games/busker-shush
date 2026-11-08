import './mute-auto.mjs'
// SNS 用の画像（1200x630）。一番笑える瞬間: 告白中に見つかって爆音ミュージシャンにつまみ出される大ゴマ＋題名「路上ライブは私語厳禁」。node og.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname
const PORT = 7124
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
await p.goto(`http://localhost:${PORT}/?notut&seed=11`); await p.waitForFunction(() => window.__bsReady); await p.waitForTimeout(800)
await p.evaluate(async () => {
  const d = bs.dbg; d.startPlay(); d.pause(true); d.startScene(3); d.step(20); d.G.strikes = 2; d.caught(); d.step(60 * 1.4)
  const st = document.createElement('style'); st.textContent = `
    #vPlay{display:none!important}#bMute{display:none!important}
    #outPanel{flex-direction:row;justify-content:flex-start;padding-left:40px;gap:10px;background:#f5e9d0}
    #outPanel .lines{background:repeating-conic-gradient(from 0deg at 30% 46%,#141414 0 1.3deg,transparent 1.3deg 4.2deg);animation:none}
    #outImg{height:640px;max-width:none;margin-top:60px;animation:none!important}
    #outLine{position:absolute;right:44px;top:205px;font-size:84px;max-width:none;margin:0;animation:none!important;transform:rotate(-5deg);-webkit-text-stroke:6px #141414;text-shadow:9px 9px 0 #c42a1e}
    #outSub{position:absolute;right:70px;bottom:62px;font-size:30px;padding:6px 16px;border-width:3px}
    #ogT{position:fixed;right:40px;top:30px;z-index:20;transform:rotate(2deg);background:#c09160;padding:10px 26px 14px;background-image:repeating-linear-gradient(90deg,rgba(110,70,30,.16) 0 2px,transparent 2px 9px);box-shadow:0 6px 14px rgba(0,0,0,.35);font:400 66px "Reggae One";color:#141414;line-height:1.1}
    #fly{position:fixed;left:415px;top:415px;z-index:20;height:150px;transform:rotate(-18deg)}`
  document.head.appendChild(st)
  document.getElementById('outSub').textContent = '自分は爆音なのに、客には静かにしろ'; document.getElementById('outLine').textContent = '愛を語るなら\nワンマンでやれ！'
  const t = document.createElement('div'); t.id = 'ogT'; t.textContent = '路上ライブは私語厳禁'; document.getElementById('outPanel').appendChild(t)
  const f = document.createElement('img'); f.id = 'fly'; f.src = 'img/y_fly.webp'; document.getElementById('outPanel').appendChild(f)
  await new Promise(r => setTimeout(r, 400)); await document.fonts.ready
})
await p.waitForTimeout(600)
await p.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
