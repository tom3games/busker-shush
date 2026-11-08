import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る（2026-11-02 live.mjs に名前が文字で入ったまま5本公開していた）
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = 'https://tom3games.com/play/busker-shush/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__bsReady, null, { timeout: 15000 })
  // 遊びの通し: 始める → 話すボタンを押す → 追い出しの大ゴマ → 結果
  const sb = await p.$('#bStart'), bb = await sb.boundingBox()
  if (opts.hasTouch) await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await p.click('#bStart')
  await p.waitForTimeout(500)
  const c = await p.evaluate(() => bs.talkXY()); if (opts.hasTouch) await p.touchscreen.tap(c.x, c.y); else await p.mouse.click(c.x, c.y)
  await p.evaluate(() => { bs.dbg.G.strikes = 2; bs.dbg.caught() })
  await p.waitForFunction(() => !document.getElementById('outPanel').hidden, null, { timeout: 20000 })
  await p.waitForFunction(() => !document.getElementById('vResult').hidden && window.__lastResult, null, { timeout: 20000 })
  const mute = await p.evaluate(() => window.__muteOk ? window.__muteOk() : 'n/a')
  if (mute !== true) errs.push('mute ' + mute)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/busker-shush', 'https://github.com/tom3games/busker-shush/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
