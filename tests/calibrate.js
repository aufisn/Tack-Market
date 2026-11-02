// Statistical sanity check of the market engine: node tests/calibrate.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = {}; vm.createContext(ctx);
for (const f of ['engine.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), ctx);
const TM = vm.runInContext('TM', ctx);
const sd = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return [m, Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length)]; };
const kurt = (a) => { const [m, s] = sd(a); return a.reduce((t, x) => t + ((x - m) / s) ** 4, 0) / a.length; };
function run(scenario, days, games) {
  const mkt = [], stock = [], corr = [], yearly = [], zero = [0, 0], dd = [];
  const bySec = {};
  for (let g = 0; g < games; g++) {
    const w = TM.generateWorld({ seed: 1000 + g * 7919, scenario, sessionDays: days });
    const F = w.FUND, a = w.start, b = w.start + days;
    yearly.push(w.c[F][b] / w.c[F][a] - 1);
    let pk = 0, m = 0;
    for (let d = a; d <= b; d++) { pk = Math.max(pk, w.c[F][d]); m = Math.min(m, w.c[F][d] / pk - 1); }
    dd.push(m);
    const mr = [];
    for (let d = 1; d < w.T; d++) { const r = w.c[F][d] / w.c[F][d - 1] - 1; mkt.push(r); mr.push(r); }
    for (let i = 0; i < w.nStocks; i++) {
      const sr = [];
      for (let d = 1; d < w.T; d++) { const r = w.c[i][d] / w.c[i][d - 1] - 1; sr.push(r); stock.push(r); zero[0] += r === 0 ? 1 : 0; zero[1]++; }
      const [m1, s1] = sd(sr), [m2, s2] = sd(mr);
      let cv = 0; for (let k = 0; k < sr.length; k++) cv += (sr[k] - m1) * (mr[k] - m2);
      corr.push(cv / sr.length / s1 / s2);
      const sec = w.inst[i].sector; (bySec[sec] = bySec[sec] || []).push(s1 * Math.sqrt(252));
    }
  }
  const [mm, ms] = sd(mkt), [ym, ys] = sd(yearly);
  console.log(`\n${scenario} (${days}d x ${games})`);
  console.log(`  index: daily vol ${(ms * Math.sqrt(252) * 100).toFixed(1)}% ann, kurtosis ${kurt(mkt).toFixed(1)}, session return mean ${(ym * 100).toFixed(1)}% sd ${(ys * 100).toFixed(1)}%, avg max DD ${(sd(dd)[0] * 100).toFixed(1)}%`);
  console.log(`  stocks: kurtosis ${kurt(stock).toFixed(1)}, corr to index ${sd(corr)[0].toFixed(2)}, unchanged days ${(zero[0] / zero[1] * 100).toFixed(2)}%`);
  console.log('  ann vol by sector: ' + Object.entries(bySec).map(([k, v]) => `${k} ${(sd(v)[0] * 100).toFixed(0)}%`).join(', '));
}
run('random', 250, 60);
for (const s of ['bull', 'gfc', 'covid', 'rates', 'bubble']) run(s, 120, 20);
