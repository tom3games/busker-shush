import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 路上ライブは私語厳禁 の検証。node verify.mjs（音は出さない。押す操作は page.mouse・CDP の本物のタッチ・touchscreen）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = 7123
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}, q = '') {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  if (!opts.keepStore) await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('k')) { localStorage.clear(); sessionStorage.setItem('k', '1') } } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__bsReady, null, { timeout: 12000 })
  await p.waitForTimeout(300)
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *, #outPanel:not([hidden]) p')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    if (el.classList.contains('bubble') || el.closest('.tape')) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button,main:not([hidden]) a,main:not([hidden]) canvas,main:not([hidden]) h1,main:not([hidden]) #words,#outPanel:not([hidden]) p')) { if (!el.offsetParent && el.id !== 'card') continue; const r = el.getBoundingClientRect(); if (!r.height) continue; if (r.bottom > H + 1 || r.top < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  return { H, over: over.slice(0, 6) }
})
const variance = (p, sel) => p.evaluate(sel => {
  const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 13) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
}, sel)
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'big']]
const st = p => p.evaluate(() => bs.state)
// 視線を自分から外す / 自分に向ける（遊びを止めて置く）
const gazeAway = p => p.evaluate(() => { const G = bs.dbg.G; bs.dbg.pause(true); bs.dbg.goto('quiet', { dur: 30 }); bs.dbg.tick(1); G.gz.a = G.gz.to = -55; G.gz.dwell = 99; G.gz.pre = 0; G.gz.hw = 13; G.gz.hwTo = 13; G.immune = 0; G.pat = 40; bs.dbg.render() })
const gazeOn = p => p.evaluate(() => { const G = bs.dbg.G; bs.dbg.pause(true); bs.dbg.goto('quiet', { dur: 30 }); bs.dbg.tick(1); G.gz.a = G.gz.to = bs.state.youA; G.gz.dwell = 99; G.gz.pre = 0; G.gz.hw = 13; G.gz.hwTo = 13; G.immune = 0; G.pat = 40; bs.dbg.render() })
const run = (p, sec) => p.evaluate(sec => { bs.dbg.step(Math.round(sec * 60)) }, sec)
const talkXY = p => p.evaluate(() => bs.talkXY())

const browser = await chromium.launch(MUTE_LAUNCH)
const p = await open(browser, {}, '?seed=7')
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r)); return r
})
await t('OGP 一式と canonical・github.io からの転送がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]'), /tom3games\.com\/play\/busker-shush\/$/.test(document.querySelector('link[rel=canonical]').href), /tom3games\.com\/play\/busker-shush\//.test(document.getElementById('ghMove').textContent)))
  expect(r.every(Boolean), JSON.stringify(r))
})
await t('ロード画面が消えている・タイトルが出ている', async () => { const r = await p.evaluate(() => ({ boot: document.getElementById('boot').classList.contains('gone'), title: !document.getElementById('vTitle').hidden })); expect(r.boot && r.title, JSON.stringify(r)) })
await t('画面に AI・画像生成の語が無い', async () => { const r = await p.evaluate(() => document.body.innerText + JSON.stringify(window.BS)); const m = r.match(/\bAI\b|画像生成|ChatGPT|生成/); expect(!m, 'AI の語がある ' + (m && m[0])) })
// ---- 初めての1回
await t('初めての1回: 「広場に入る」を本物のクリックで押すと始まり、話し方の一文が出る', async () => {
  await p.click('#bStart'); await p.waitForTimeout(900)
  const r = await p.evaluate(() => ({ mode: bs.state.mode, learn: !!bs.state.learn, hint: document.getElementById('t_hint').hidden ? '' : document.getElementById('t_hint').textContent }))
  expect(r.mode === 'play' && r.learn && /押している間/.test(r.hint), JSON.stringify(r)); return r
})
await t('音を鳴らす操作の後も実際は無音（Chromium）', async () => { const r = await p.evaluate(() => ({ ok: window.__muteOk(), st: Snd.ctx && Snd.ctx.state, calls: Object.keys(Snd.played).length })); expect(r.ok && r.st !== 'running' && r.calls > 0, JSON.stringify(r)); return r })
await t('本物のマウスで長押し → 視線の外なら一言ずつ届く', async () => {
  await gazeAway(p); const a = await st(p), xy = await talkXY(p)
  await p.mouse.move(xy.x, xy.y); await p.mouse.down(); await run(p, 2.2)
  const mid = await st(p); await p.mouse.up(); await run(p, 0.1); const b = await st(p)
  expect(mid.hold && b.wi >= a.wi + 1 && !b.hold && b.strikes === 0, JSON.stringify({ a: a.wi, mid: mid.hold, b: b.wi, hold: b.hold, s: b.strikes })); return { words: b.wi - a.wi }
})
await t('途中で離すと、その言葉は言い直し（進みが0に戻る）', async () => {
  await gazeAway(p); const xy = await talkXY(p)
  await p.mouse.move(xy.x, xy.y); await p.mouse.down(); await run(p, 0.45); const mid = await st(p); await p.mouse.up(); await run(p, 0.05); const b = await st(p)
  expect(mid.wp > 0.2 && b.wp === 0 && b.wi === mid.wi, JSON.stringify({ mid: mid.wp, b: b.wp })); return { before: Math.round(mid.wp * 100) / 100 }
})
await t('視線の中で喋ると見つかる（1回目はにらまれるだけ、言葉はやり直し）', async () => {
  await gazeOn(p); const xy = await talkXY(p)
  await p.mouse.move(xy.x, xy.y); await p.mouse.down(); await run(p, 0.6); const b = await st(p); await p.mouse.up(); await run(p, 0.1)
  const tx = await p.evaluate(() => bs.texts())
  expect(b.strikes === 1 && b.wp === 0 && !b.over && tx.some(x => /いい所/.test(x)), JSON.stringify({ s: b.strikes, tx })); return { tx }
})
await t('見つかった後は、押しっぱなしでも話せない（一度離すまで）', async () => {
  await gazeOn(p); const xy = await talkXY(p)
  await p.evaluate(() => { bs.dbg.G.strikes = 0 })
  await p.mouse.move(xy.x, xy.y); await p.mouse.down(); await run(p, 0.5)
  await p.evaluate(() => { const G = bs.dbg.G; G.gz.a = G.gz.to = -55 }); const a = await st(p); await run(p, 1.0); const b = await st(p); await p.mouse.up(); await run(p, 0.05)
  expect(a.lock && b.wp === 0, JSON.stringify({ lock: a.lock, wp: b.wp })); return true
})
// ---- 指示と違う操作で固まらない（初めての1回のまま）
await t('指示と違う操作でも固まらない（画面を連打・ボタンを連打・押して指をずらす・2本指・タイトル外を叩く）', async () => {
  await p.evaluate(() => { bs.dbg.pause(false); bs.dbg.G.strikes = 0 })
  const a = await st(p), xy = await talkXY(p)
  for (let i = 0; i < 12; i++) await p.mouse.click(60 + i * 20, 300 + (i % 3) * 80)
  for (let i = 0; i < 10; i++) await p.mouse.click(xy.x, xy.y, { delay: 20 })
  await p.mouse.move(xy.x, xy.y); await p.mouse.down(); await p.mouse.move(20, 200, { steps: 6 }); await p.waitForTimeout(150); await p.mouse.up()
  const cdp = await p.context().newCDPSession(p)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: xy.x, y: xy.y, id: 1 }, { x: 100, y: 300, id: 2 }] })
  await p.waitForTimeout(200)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.waitForTimeout(600)
  const b = await st(p)
  expect(b.mode === 'play' && b.t > a.t + 0.5 && !b.hold && p.errs.length === 0, JSON.stringify({ a: a.t, b: b.t, mode: b.mode, hold: b.hold, e: p.errs })); return { t: Math.round(b.t * 10) / 10 }
})
await t('本物のタッチ（CDP）で長押し → 話せる・離すと止まる', async () => {
  await gazeAway(p); const xy = await talkXY(p), cdp = await p.context().newCDPSession(p), a = await st(p)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: xy.x, y: xy.y, id: 3 }] })
  await run(p, 1.6); const mid = await st(p)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await run(p, 0.05); const b = await st(p)
  expect(mid.hold && (b.wi > a.wi || mid.wp > 0.5) && !b.hold, JSON.stringify({ mid, b: b.hold })); return { wi: b.wi }
})
await t('タブを離れたら（blur）押しっぱなしが解ける', async () => {
  await gazeAway(p); const xy = await talkXY(p)
  await p.mouse.move(xy.x, xy.y); await p.mouse.down(); await run(p, 0.2)
  await p.evaluate(() => window.dispatchEvent(new Event('blur'))); const b = await st(p); await p.mouse.up()
  expect(!b.hold, JSON.stringify(b.hold))
})
// ---- 爆音・振りかぶり・曲が止まる
await t('サビの爆音中は、視線に関係なく叫べる（ボタンが「叫べる」に変わる）', async () => {
  await p.evaluate(() => { bs.dbg.pause(true); bs.dbg.goto('loud', { dur: 20 }); bs.dbg.tick(2); bs.dbg.G.strikes = 0; bs.dbg.render() })
  const xy = await talkXY(p), a = await st(p)
  await p.mouse.move(xy.x, xy.y); await p.mouse.down(); await run(p, 2.4); const b = await st(p); await p.mouse.up(); await run(p, 0.05)
  const lbl = await p.evaluate(() => document.getElementById('talkL').textContent)
  expect(b.shout && b.strikes === 0 && (b.wi > a.wi || b.wp > 0.5) && lbl === '叫べる', JSON.stringify({ shout: b.shout, s: b.strikes, wi: [a.wi, b.wi], lbl })); return { lbl }
})
await t('振りかぶった後、曲が止まった瞬間に叫んでいたら一発で追い出し（大ゴマは叫んだ原因の一言）', async () => {
  await p.evaluate(() => { const d = bs.dbg; d.pause(true); d.goto('loud', { dur: 3 }); d.tick(2); d.G.queue.unshift(d.sec('wind', 0.5), d.sec('stop', 3)); d.G.cur.dur = d.G.cur.t + 0.05; d.G.strikes = 0 })
  const xy = await talkXY(p)
  await p.mouse.move(xy.x, xy.y); await p.mouse.down(); await run(p, 1.0); const b = await st(p)
  await run(p, 1.3); await p.mouse.up()
  const r = await p.evaluate(() => ({ panel: !document.getElementById('outPanel').hidden, line: document.getElementById('outLine').textContent, sub: document.getElementById('outSub').textContent }))
  await p.screenshot({ path: ROOT + '/shots/v-out.png' })
  expect(b.over === 'out' && b.outKind === 'shout' && r.panel && /目立つな|俺のもん/.test(r.line) && r.sub, JSON.stringify({ over: b.over, k: b.outKind, r })); return r
})
await t('追い出し → 投げ出されて結果へ（判子は「出禁」・最後の一言が出る）', async () => {
  await run(p, 5); await p.evaluate(() => bs.dbg.pause(false)); await p.waitForTimeout(1600)
  const r = await p.evaluate(() => ({ mode: bs.state.mode, res: window.__lastResult && { out: window.__lastResult.out, title: window.__lastResult.title }, panel: document.getElementById('outPanel').hidden }))
  const v = await variance(p, '#card')
  await p.screenshot({ path: ROOT + '/shots/v-resultout.png' })
  expect(r.mode === 'result' && r.res.out && r.res.title === '出禁の人' && r.panel && v > 500, JSON.stringify({ r, v })); return { v }
})
await t('結果: Xでポスト（公開URL入り）・画像保存・支援・横丁へ戻る', async () => {
  const r = await p.evaluate(() => ({ post: document.getElementById('bPost').href, save: !!document.getElementById('bSave'), sup: !!document.getElementById('tmSupport'), home: (document.getElementById('tmHome') || {}).href }))
  expect(/x\.com\/intent\/post/.test(r.post) && /tom3games\.com%2Fplay%2Fbusker-shush/.test(r.post) && r.save && r.sup && /tom3games\.com/.test(r.home), JSON.stringify(r)); return true
})
await t('もう一回: 追い出しの後でも、ピックと大ゴマが戻って普通に始まる', async () => {
  await p.click('#bAgain'); await p.waitForTimeout(600)
  const r = await p.evaluate(() => ({ mode: bs.state.mode, s: bs.state.strikes, over: bs.state.over, panel: document.getElementById('outPanel').hidden, lost: document.querySelectorAll('#picks i.lost').length, sc: bs.state.sc }))
  expect(r.mode === 'play' && r.s === 0 && !r.over && r.panel && r.lost === 0 && r.sc === 0, JSON.stringify(r)); return r
})
await t('3回見つかると追い出し（2回目は演奏を止めて説教）', async () => {
  await p.evaluate(() => bs.dbg.pause(true))
  const xy = await talkXY(p), seen = []
  for (let i = 0; i < 3; i++) {
    await gazeOn(p); await p.mouse.move(xy.x, xy.y); await p.mouse.down(); await run(p, 0.6); await p.mouse.up(); await run(p, 0.05)
    const s = await st(p); seen.push([s.strikes, s.sec, s.over])
    if (s.over) break
    await run(p, 0.2)
  }
  expect(seen[1][1] === 'lecture' && seen[2][2] === 'out', JSON.stringify(seen)); return seen
})
await t('見つかった原因ごとに説教と追い出しの大ゴマが変わり、結果のセットリストに原因が書かれる', async () => {
  const xy = await talkXY(p), got = {}
  for (const [sc, id] of [[0, 'boss'], [1, 'tako'], [2, 'friend'], [3, 'date']]) {
    await p.evaluate(sc => { bs.dbg.startPlay(); bs.dbg.pause(true); bs.dbg.startScene(sc); bs.dbg.tick(30) }, sc)
    const seen = []
    for (let i = 0; i < 3; i++) {
      await gazeOn(p); await p.mouse.move(xy.x, xy.y); await p.mouse.down(); await run(p, 0.6); await p.mouse.up(); await run(p, 0.05)
      seen.push(await p.evaluate(() => bs.texts().join('/')))
      if ((await st(p)).over) break
      await run(p, 0.2)
    }
    await run(p, 0.6)
    const line = await p.evaluate(() => document.getElementById('outLine').textContent.replace(/\n/g, ''))
    await p.evaluate(() => bs.dbg.pause(false)); await p.waitForFunction(() => bs.state.mode === 'result', null, { timeout: 12000 }); await p.waitForTimeout(400)
    const r = await p.evaluate(() => window.__lastResult)
    got[id] = { lecture: seen[1], line, cause: r.outCause }
    if (id === 'date') await p.screenshot({ path: ROOT + '/shots/v-result-date.png' })
  }
  const BS = await p.evaluate(() => window.BS.LINES)
  const ok = Object.entries(got).every(([id, g]) => g.cause === id && BS.outBy[id].some(x => x[0].replace(/\n/g, '') === g.line) && BS.lecture[id].some(x => g.lecture.includes(x[0])))
  expect(ok, JSON.stringify(got)); return Object.fromEntries(Object.entries(got).map(([k, v]) => [k, v.line]))
})
// ---- もうひと工夫: いたずら・なすりつけ（本物のクリックで輪を押す）
const toTrickScene = (p, sc) => p.evaluate(sc => { const d = bs.dbg, G = d.G; d.startPlay(); d.pause(true); d.startScene(sc); d.goto('quiet', { dur: 30 }); d.tick(2); G.gz.a = G.gz.to = -55; G.gz.dwell = 99; G.gz.pre = 0; G.gz.hw = 13; G.gz.hwTo = 13; G.pat = 40; d.render() }, sc)
await t('いたずら: 見ていない隙に歌詞カードを本物のクリック → 変な歌詞のあと動揺して長い隙（視線が届かない）', async () => {
  await toTrickScene(p, 1); const xy = await p.evaluate(() => bs.trickXY('lyric'))
  await p.mouse.click(xy.x, xy.y); await run(p, 0.1); const a = await st(p)
  let panic = null; for (let i = 0; i < 12 && !panic; i++) { await run(p, 0.5); const s = await st(p); if (s.sec === 'panic') panic = s }
  expect(a.tricks === 1 && a.sus === 1 && panic && panic.gazeLen < panic.youD, JSON.stringify({ tricks: a.tricks, sus: a.sus, panic: panic && panic.sec })); return { sus: a.sus }
})
await t('いたずら: ケーブルを抜くと曲が止まり、声が1.4倍届く。2.6秒後に顔を上げて全員を見る', async () => {
  await toTrickScene(p, 1); const xy = await p.evaluate(() => bs.trickXY('cable'))
  await p.mouse.click(xy.x, xy.y); await run(p, 0.2); const a = await st(p); await run(p, 2.6); const b = await st(p)
  expect(a.sec === 'unplug' && !a.inGaze && b.sec === 'unplug' && b.inGaze, JSON.stringify({ a: [a.sec, a.inGaze], b: [b.sec, b.inGaze] })); return true
})
await t('いたずら: アンプのつまみを下げるとサビでも声が届き、あとで犯人探しが始まる', async () => {
  await toTrickScene(p, 1); const xy = await p.evaluate(() => bs.trickXY('amp'))
  await p.mouse.click(xy.x, xy.y); await run(p, 0.1); const a = await st(p)
  let found = false; for (let i = 0; i < 24 && !found; i++) { await run(p, 0.5); found = (await st(p)).sec === 'search' }
  expect(a.ampLow && found, JSON.stringify({ low: a.ampLow, found })); return true
})
await t('いたずら: 見られている時に触ると一発退場（大ゴマは機材の一言、結果に「いたずらで」）', async () => {
  await toTrickScene(p, 1); await p.evaluate(() => { const G = bs.dbg.G; G.gz.a = G.gz.to = bs.state.youA })
  const xy = await p.evaluate(() => bs.trickXY('amp')); await p.mouse.click(xy.x, xy.y); await run(p, 0.6)
  const line = await p.evaluate(() => document.getElementById('outLine').textContent.replace(/\n/g, ''))
  await p.evaluate(() => bs.dbg.pause(false)); await p.waitForFunction(() => bs.state.mode === 'result', null, { timeout: 12000 })
  const r = await p.evaluate(() => window.__lastResult)
  expect(r.outCause === 'prank' && /機材/.test(line), JSON.stringify({ c: r.outCause, line })); return { line }
})
await t('いたずら: やりすぎ（疑い3つ）で次に触ると捕まる', async () => {
  await toTrickScene(p, 1)
  const r = await p.evaluate(() => { const out = []; for (const k of ['lyric', 'cable', 'amp']) { out.push(bs.trick(k)); bs.dbg.G.cur.dur = 99; bs.dbg.goto('quiet', { dur: 30 }); bs.dbg.tick(2) } bs.dbg.startScene(2); bs.dbg.goto('quiet', { dur: 30 }); bs.dbg.tick(2); const G = bs.dbg.G; G.gz.a = G.gz.to = -55; G.gz.dwell = 99; out.push(bs.trick('lyric')); return { out, over: bs.state.over, cause: G.outCause } })
  expect(r.out.slice(0, 3).every(x => x === 'ok') && r.out[3] === 'caught' && r.cause === 'prank', JSON.stringify(r)); return r
})
await t('なすりつけ: しゃべっている通行人を本物のクリック → 視線がそっちへ、通行人がつまみ出される', async () => {
  await toTrickScene(p, 2); await p.evaluate(() => { const G = bs.dbg.G; G.npc.t = 1; G.npc.talk = true; G.npc.ph = 0; G.gz.a = G.gz.to = bs.state.youA; bs.dbg.render() })
  const xy = await p.evaluate(() => bs.trickXY('npc')); await p.mouse.click(xy.x, xy.y); await run(p, 0.5)
  const s = await st(p)
  expect(s.blames === 1 && !s.inGaze && !s.over, JSON.stringify({ b: s.blames, g: s.inGaze, o: s.over })); return true
})
await t('なすりつけ: 黙っている通行人を指すと二人まとめて退場（結果に「なすりつけで」）', async () => {
  await toTrickScene(p, 2); await p.evaluate(() => { const G = bs.dbg.G; G.npc.t = 1; G.npc.talk = false; G.npc.ph = 0; bs.dbg.render() })
  const xy = await p.evaluate(() => bs.trickXY('npc')); await p.mouse.click(xy.x, xy.y); await run(p, 0.6)
  const line = await p.evaluate(() => document.getElementById('outLine').textContent.replace(/\n/g, ''))
  const s = await st(p); await p.evaluate(() => bs.dbg.pause(false)); await p.waitForFunction(() => bs.state.mode === 'result', null, { timeout: 12000 })
  const card = await p.evaluate(() => window.__lastResult.outCause)
  expect(s.over === 'out' && card === 'blame' && /人のせい|二人まとめて/.test(line), JSON.stringify({ o: s.over, card, line })); return { line }
})
await t('いたずらを使う bot の方が得をし、使いすぎる bot は捕まる', async () => {
  const r = await p.evaluate(() => { const avg = (b, f) => { let s = 0; for (let i = 1; i <= 8; i++) s += f(bs.sim(b, i * 53)); return s / 8 }; return { good: avg('good', r => r.points), trick: avg('trick', r => r.points), greedy: avg('greedy', r => r.points), greedyOut: avg('greedy', r => r.outCause === 'prank' ? 1 : 0) } })
  expect(r.trick > r.good + 30 && r.greedy < r.trick && r.greedyOut >= 0.5, JSON.stringify(r)); return r
})
await t('用事を全部言い切ると次の用事へ（相手・時刻・屋台が変わる）', async () => {
  await p.evaluate(() => { bs.dbg.startPlay(); bs.dbg.pause(true) })
  await gazeAway(p)
  const r = await p.evaluate(() => { const G = bs.dbg.G; G.hold = true; for (let i = 0; i < 60 * 14 && G.sc === 0; i++) { G.gz.a = G.gz.to = -55; G.gz.pre = 0; G.gz.dwell = 99; bs.dbg.tick(1) } G.hold = false; for (let i = 0; i < 60 * 5 && G.sc === 0; i++) bs.dbg.tick(1); bs.dbg.render(); return { sc: G.sc, res: G.res.map(r => r.ok), who: document.getElementById('whoName').textContent, time: document.getElementById('whoTime').textContent } })
  expect(r.sc === 1 && r.res[0] === true && r.who === 'たこ焼き屋' && r.time === '18:15', JSON.stringify(r)); return r
})
await t('同時に出る文字は2つまで（遊びの通し・1秒ごと）', async () => {
  await p.evaluate(() => { bs.dbg.startPlay(true); bs.dbg.G.bot = (api, st, dt) => {}; bs.dbg.pause(true) })
  let max = 0, at = ''
  for (let i = 0; i < 70; i++) { await run(p, 1); const n = await p.evaluate(() => ['t_hint', 't_pat', 't_mus'].filter(k => !document.getElementById(k).hidden).length); if (n > max) { max = n; at = i } }
  expect(max <= 2, 'max ' + max + ' at ' + at); return { max }
})
await t('何もしない通しは最低の判定（0点・「広場の銅像」・どの bot より下）', async () => {
  const r = await p.evaluate(() => { const one = b => { let s = 0; const n = 6; for (let i = 1; i <= n; i++) s += bs.sim(b, i * 37).points; return s / n }; const idle = bs.sim('idle', 5); return { idle: idle.points, title: idle.title, key: idle.titleKey, good: one('good'), normal: one('normal'), loud: one('loudonly'), chatty: one('chatty') } })
  expect(r.idle === 0 && r.key === 'zero' && r.good > r.loud && r.normal > r.loud && r.good > r.chatty && r.loud > 0, JSON.stringify(r)); return r
})
await t('同じ種なら同じ結果（確率でなく見た物で決まる）', async () => {
  const r = await p.evaluate(() => [bs.sim('good', 77).points, bs.sim('good', 77).points, bs.sim('normal', 78).points, bs.sim('normal', 78).points])
  expect(r[0] === r[1] && r[2] === r[3], JSON.stringify(r)); return r
})
// ---- 3サイズ × 全画面
for (const [w, h, nm] of SIZES) {
  await t(`${nm} ${w}x${h}: タイトル・遊び方・遊び中・大ゴマ・結果が一画面に収まり、はみ出さない`, async () => {
    const q = await open(browser, { viewport: { width: w, height: h } }, '?notut&seed=3')
    const bad = []
    const chk = async tag => { const f = await fit(q), o = await overflow(q); if (f.over.length) bad.push(tag + ' fit ' + f.over.join(',')); if (o.bad.length || o.sw > o.W) bad.push(tag + ' over ' + o.bad.join(',') + ' sw' + o.sw); await q.screenshot({ path: `${ROOT}/shots/v-${nm}-${tag}.png` }) }
    await chk('title')
    await q.click('#bHow'); await q.waitForTimeout(250); await chk('how'); await q.click('#bHowClose')
    await q.click('#bStart'); await q.waitForTimeout(400)
    await q.evaluate(() => { bs.dbg.pause(true); bs.dbg.step(60 * 1.5) }); await chk('play')
    const tb = await q.evaluate(() => { const r = document.getElementById('talk').getBoundingClientRect(); return { b: r.bottom, h: innerHeight, w: r.width } })
    if (tb.b > tb.h || tb.w < 80) bad.push('talk ' + JSON.stringify(tb))
    await q.evaluate(() => { bs.dbg.startScene(3); bs.dbg.goto('police', { dur: 7 }); bs.dbg.step(60 * 2.5) }); await chk('police')
    await q.evaluate(() => { bs.dbg.out('caught'); bs.dbg.step(60 * 1.2) }); await q.waitForTimeout(800); await chk('out')
    await q.evaluate(() => { bs.dbg.pause(false) }); await q.waitForTimeout(6200); await chk('result')
    await q.context().close()
    expect(!bad.length, bad.join(' | ')); return true
  })
}
await t('English: タイトル・遊び方・遊び中・結果が英語になり、はみ出さない', async () => {
  const q = await open(browser, { locale: 'en-US', viewport: { width: 360, height: 640 } }, '?notut&seed=4')
  const bad = []
  const r1 = await q.evaluate(() => ({ t2: document.getElementById('t2').textContent, start: document.getElementById('bStart').textContent, lang: document.documentElement.lang }))
  let o = await overflow(q); if (o.bad.length) bad.push('title ' + o.bad)
  await q.click('#bHow'); await q.waitForTimeout(200); o = await overflow(q); let f = await fit(q); if (o.bad.length || f.over.length) bad.push('how ' + o.bad + f.over); await q.screenshot({ path: ROOT + '/shots/v-en-how.png' }); await q.click('#bHowClose')
  await q.click('#bStart'); await q.evaluate(() => { bs.dbg.pause(true); bs.dbg.startScene(1); bs.dbg.step(60 * 2) })
  const r2 = await q.evaluate(() => ({ who: document.getElementById('whoName').textContent, words: document.getElementById('words').textContent, talk: document.getElementById('talkL').textContent }))
  o = await overflow(q); f = await fit(q); if (o.bad.length || f.over.length) bad.push('play ' + o.bad + f.over); await q.screenshot({ path: ROOT + '/shots/v-en-play.png' })
  const ja = /[ぁ-んァ-ン一-龥]/
  expect(/Busking Zone/.test(r1.t2) && r1.lang === 'en' && !ja.test(r2.who + r2.words + r2.talk + r1.start) && !bad.length, JSON.stringify({ r1, r2, bad }))
  await q.context().close(); return r2
})
await t('Chromium 全体でエラーが出ていない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await browser.close()

// ---- WebKit（iPhone の Safari 相当）
const wb = await webkit.launch()
const wq = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, '?notut&seed=9')
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wq.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, 'not prevented')
})
await t('WebKit: タッチで「広場に入る」→ 遊びが始まる', async () => {
  const b = await wq.$('#bStart'), bb = await b.boundingBox(); await wq.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await wq.waitForTimeout(500)
  const s = await wq.evaluate(() => bs.state.mode); expect(s === 'play', s)
})
await t('WebKit: 話すボタンをタッチで叩いても固まらない・実際には無音', async () => {
  const xy = await wq.evaluate(() => bs.talkXY())
  for (let i = 0; i < 6; i++) await wq.touchscreen.tap(xy.x, xy.y)
  await wq.waitForTimeout(500)
  const r = await wq.evaluate(() => ({ ok: window.__muteOk(), st: Snd.ctx && Snd.ctx.state, mode: bs.state.mode, hold: bs.state.hold }))
  expect(r.ok && r.st !== 'running' && r.mode === 'play' && !r.hold, JSON.stringify(r)); return r
})
const wm = await open(wb, {}, '?notut&seed=9')
await t('WebKit: マウスの長押しで話せる・離すと止まる', async () => {
  await wm.click('#bStart'); await wm.waitForTimeout(300); await gazeAway(wm)
  const xy = await talkXY(wm), a = await st(wm)
  await wm.mouse.move(xy.x, xy.y); await wm.mouse.down(); await run(wm, 2.0); const mid = await st(wm); await wm.mouse.up(); await run(wm, 0.05); const b = await st(wm)
  expect(mid.hold && b.wi > a.wi && !b.hold, JSON.stringify({ a: a.wi, b: b.wi, mid: mid.hold })); return { words: b.wi - a.wi }
})
await t('WebKit: 追い出しから結果まで通る', async () => {
  await wm.evaluate(() => { bs.dbg.out('caught'); bs.dbg.pause(false) }); await wm.waitForTimeout(6600)
  const r = await wm.evaluate(() => ({ mode: bs.state.mode })); await wm.screenshot({ path: ROOT + '/shots/v-webkit-result.png' })
  expect(r.mode === 'result', JSON.stringify(r))
})
await t('WebKit: エラーが出ない', async () => { const e = wq.errs.concat(wm.errs); expect(e.length === 0, e.join('|')) })
// ---- ページを離れた時の音（2026-11-11 横丁へ移っても BGM が鳴り続けた不具合の再発防止）
await t('WebKit: 裏に回ると BGM と環境音が止まり suspend。戻っても触るまで鳴らない（bfcache の pageshow でも）', async () => {
  const r = await wq.evaluate(async () => {
    if (!Snd.ctx) Snd.init()
    const url = Object.values(Snd.files).flat()[0]; Snd.loop('vtest', url, 0.2)
    for (let i = 0; i < 30 && !Snd.playing().includes('vtest'); i++) await new Promise(r => setTimeout(r, 100))
    const c = Snd.ctx; let sus = 0; const os = c.suspend.bind(c); c.suspend = () => { sus++; return os() }
    const before = Snd.playing().length, wake0 = Snd.life.wake
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'))
    const hid = { away: Snd.away, playing: Snd.playing().length, sus, gain: Snd.master.gain.value }
    const name = Object.keys(Snd.files)[0], src = Snd.play(name); Snd.loop('vtest2', url, 0.2);    // 裏にいる間の音は鳴らさない
    await new Promise(r => setTimeout(r, 400)); const quiet = Snd.playing().length
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    await new Promise(r => setTimeout(r, 400)); const back = { away: Snd.away, playing: Snd.playing().length, gain: Snd.master.gain.value }
    Snd.loop('vtest2', null)
    return { before, wake0, hid, src: src === null, quiet, back }
  })
  // ボタンでない所を1回タップ（触ったら鳴らし直す）
  const pt = await wq.evaluate(() => { for (let y = 0.5; y < 0.98; y += 0.06) for (let x = 0.08; x < 0.95; x += 0.12) { const X = innerWidth * x, Y = innerHeight * y, e = document.elementFromPoint(X, Y); if (e && !e.closest('button,a,input,select,textarea,label,[onclick],[role=button],[tabindex]')) return { x: X, y: Y } } return null })
  if (pt) await wq.touchscreen.tap(pt.x, pt.y); else await wq.keyboard.press('Shift')
  await wq.waitForTimeout(700)
  const after = await wq.evaluate(() => ({ away: Snd.away, playing: Snd.playing().length, wake: Snd.life.wake, mute: window.__muteOk() }))
  await wq.evaluate(() => Snd.loop('vtest', null))
  expect(r.before >= 1 && r.hid.away && r.hid.playing === 0 && r.hid.sus === 1 && r.hid.gain === 0 && r.src && r.quiet === 0 && r.back.away && r.back.playing === 0 && r.back.gain === 0 && !after.away && after.playing >= r.before && after.wake === r.wake0 + 1 && after.mute, JSON.stringify({ r, after, pt })); return { before: r.before, after: after.playing }
})
await t('WebKit: 別のページへ移る（pagehide）と止まり、戻るで戻っても鳴っていない・エラーなし', async () => {
  await wq.evaluate(() => addEventListener('pagehide', () => { try { sessionStorage.setItem('vHide', JSON.stringify({ away: Snd.away, playing: Snd.playing().length, hide: Snd.life.hide })) } catch (e) {} }))
  await wq.evaluate(() => { if (!Snd.ctx) Snd.init(); Snd.loop('vtest', Object.values(Snd.files).flat()[0], 0.2) }); await wq.waitForTimeout(500)
  const pre = await wq.evaluate(() => Snd.playing().length)
  await wq.goto(URL0 + 'privacy.html'); await wq.waitForTimeout(300)
  const hid = await wq.evaluate(() => sessionStorage.getItem('vHide'))
  await wq.goBack(); await wq.waitForFunction(() => window.__bsReady, null, { timeout: 15000 }); await wq.waitForTimeout(800)
  const back = await wq.evaluate(() => ({ playing: typeof Snd === 'undefined' ? 0 : Snd.playing().length, mute: window.__muteOk() }))
  const h = JSON.parse(hid || '{}')
  expect(pre >= 1 && h.away && h.playing === 0 && back.playing === 0 && back.mute && wq.errs.length === 0, JSON.stringify({ pre, h, back, e: wq.errs })); return { pre, h, back }
})
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} ok / ${fail} fail`)
process.exit(fail ? 1 : 0)
