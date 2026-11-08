import '../mute-auto.mjs'
// 撮影用。node tools/shot.mjs <名前> <幅> <高さ> [台本...]
// 台本: title / how / tut / play / gaze / loud / wind / stop / tako / mc / cd / police / brk / date / out / outshout / fly / result / resultout / resultzero
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = new URL('..', import.meta.url).pathname
const PORT = 7121
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const [name = 'x', w = 390, h = 844, ...scenes] = process.argv.slice(2)
const B = process.env.WK ? webkit : chromium
const b = await B.launch(), ctx = await b.newContext({ locale: process.env.EN ? 'en-US' : 'ja-JP', viewport: { width: +w, height: +h }, deviceScaleFactor: 2 })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) }); p.on('requestfailed', r => errs.push('fail ' + r.url()))
await p.goto(`http://localhost:${PORT}/?notut&seed=${process.env.SEED || 5}`); await p.waitForFunction(() => window.__bsReady); await p.waitForTimeout(1200)
for (const sc of (scenes.length ? scenes : ['title'])) {
  if (sc === 'title') {}
  else if (sc === 'how') await p.click('#bHow')
  else {
    await p.evaluate(sc => {
      const d = bs.dbg, G = d.G; document.querySelector('#vHow').hidden = true
      d.startPlay(sc === 'tut'); d.pause(true)
      const toScene = i => { d.startScene(i); d.step(30) }
      if (sc === 'tut') d.step(60 * 1.5)
      if (sc === 'play') { d.step(60 * 2.5); G.hold = true; G.wi = 2; G.wp = 0.4; d.step(2) }
      if (sc === 'gaze') { d.step(60 * 1.5); G.gz.to = G.gz.a = 17.5; G.gz.dwell = 5; G.hold = true; d.step(6) }
      if (sc === 'loud') { toScene(1); d.step(60 * 1.2); G.hold = true; G.wi = 1; G.wp = 0.5; d.step(4) }
      if (sc === 'wind') { toScene(1); d.goto('wind', { dur: 1.3 }); d.step(2); G.cur.loud = true; d.step(10) }
      if (sc === 'stop') { toScene(0); d.goto('stop', { dur: 3 }); d.step(30) }
      if (sc === 'tako') { toScene(1); d.goto('quiet', { dur: 8 }); d.step(60 * 2); G.hold = true; G.wi = 2; G.wp = 0.3; d.step(3) }
      if (sc === 'mc') { toScene(2); d.goto('mc', { dur: 5 }); d.step(60 * 1.2) }
      if (sc === 'cd') { toScene(2); d.goto('cd', { dur: 5 }); d.step(60 * 1.6) }
      if (sc === 'police') { toScene(3); d.goto('police', { dur: 7 }); d.step(60 * 2.6) }
      if (sc === 'brk') { toScene(3); d.goto('brk', { dur: 1 }); d.step(10) }
      if (sc === 'date') { toScene(3); d.step(60 * 1.0); G.hold = true; G.wi = 2; G.wp = 0.5; d.step(2) }
      if (sc === 'out') { toScene(1); d.step(30); G.strikes = 2; d.caught(); d.step(60 * 0.9) }
      if (sc === 'outshout') { toScene(3); G.wi = 2; d.step(10); d.out('shout'); d.step(60 * 0.6) }
      if (sc === 'fly') { toScene(0); d.out('caught'); d.step(60 * 3.4) }
      if (sc === 'result') { for (let i = 0; i < 4; i++) G.res.push({ id: d.BS.SCENES[i].id, ok: i !== 2, t: 18 + i * 3.3, left: 12, pat: 36, shouted: i === 3 ? 1 : 0, words: 4 }); G.over = 'end'; G.strikes = 1; d.showResult() }
      if (sc === 'resultout') { G.res.push({ id: 'boss', ok: true, t: 21.4, left: 18, pat: 40, shouted: 0, words: 5 }); G.sc = 1; G.over = 'out'; G.outKind = 'shout'; G.outWord = 'マヨ抜きで'; G.strikes = 1; d.showResult() }
      if (sc === 'resultzero') { for (let i = 0; i < 4; i++) G.res.push({ id: d.BS.SCENES[i].id, ok: false, t: 36, left: 0, pat: 36, shouted: 0, words: 0 }); G.over = 'end'; d.showResult() }
    }, sc)
    await p.waitForTimeout(sc.startsWith('result') ? 1800 : 500)
  }
  await p.screenshot({ path: `${ROOT}shots/${name}-${sc}.png` })
}
if (errs.length) console.log(errs)
await b.close(); server.kill()
