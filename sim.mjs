import './mute-auto.mjs'
// bot の分布と単調さ。node sim.mjs [回数=12]
// 単調さ = 新しいこと（場面の切り替え・初めての区間・コイン・MC・物販・警察・ブレイク・まれな出来事）が何も起きずに続いた最長秒数
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const PORT = 7122
const server = spawn(process.execPath, [import.meta.dirname + '/server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const N = +(process.argv[2] || 12)
const BOTS = (process.env.BOTS || 'good,trick,normal,trickN,greedy,slow,loudonly,chatty,spam,idle').split(',')
const b = await chromium.launch(), p = await b.newPage()
await p.goto(`http://localhost:${PORT}/?notut`); await p.waitForFunction(() => window.__bsReady)
const out = await p.evaluate(([N, BOTS]) => {
  const mono = r => { const ts = r.news.map(n => n[0]).concat([0, r.sec]).sort((a, b) => a - b); let g = 0; for (let i = 1; i < ts.length; i++) g = Math.max(g, ts[i] - ts[i - 1]); return g }
  const res = {}
  for (const bot of BOTS) {
    const rs = []; for (let s = 1; s <= N; s++) rs.push(bs.sim(bot, s * 101))
    const avg = f => Math.round(rs.reduce((a, r) => a + f(r), 0) / N * 10) / 10
    const pts = rs.map(r => r.points)
    const outs = rs.filter(r => r.out)
    res[bot] = { avg: avg(r => r.points), min: Math.min(...pts), max: Math.max(...pts), done: avg(r => r.done), all4: rs.filter(r => r.done === 4).length + '/' + N, out: outs.length, outShout: outs.filter(r => r.outKind === 'shout').length, strikes: avg(r => r.strikes), tricks: avg(r => r.tricks), blames: avg(r => r.blames), causes: [...new Set(outs.map(r => r.outCause))].join(','), sec: avg(r => r.sec), titles: [...new Set(rs.map(r => r.titleKey))].join(','), mono: avg(mono), monoMax: Math.max(...rs.map(mono)) }
  }
  return res
}, [N, BOTS])
for (const k in out) console.log(k.padEnd(9), JSON.stringify(out[k]))
await b.close(); server.kill()
