// Market Trader tests: no look-ahead, rule compliance, behaviour across scenarios. node tests/trader-test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console, crypto: require('crypto').webcrypto }; vm.createContext(ctx);
for (const f of ['engine.js', 'broker.js', 'analytics.js', 'bots.js', 'trader.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), ctx, { filename: f });
const TM = vm.runInContext('TM', ctx);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const clone = (x) => JSON.parse(JSON.stringify(x));

// 1. No look-ahead: scramble every future value and check the decisions are identical.
function decisions(world, game, t) {
  const g = clone(game);
  g.bots.trader.orders = g.bots.trader.orders.map((o) => o);
  const before = g.traderLog.length, nextId = g.bots.trader.nextId;
  TM.marketTrader(world, g, t);
  return JSON.stringify({ log: g.traderLog.slice(before), orders: g.bots.trader.orders.filter((o) => o.id >= nextId), mods: g.bots.trader.orders.map((o) => [o.id, o.stop, o.qty]) });
}
for (const [seed, scenario, margin] of [[11, 'random', true], [12, 'gfc', true], [13, 'bubble', false], [14, 'covid', true]]) {
  const { game, world } = TM.createGame({ mode: 'practice', seed, scenario, days: 120, margin });
  let checked = 0;
  for (let k = 0; k < 120 && game.status === 'active'; k++) {
    if (k % 15 === 7) {
      const t = game.t;
      const real = decisions(world, game, t);
      const fake = TM.generateWorld({ seed, scenario, sessionDays: 120 });
      const rng = TM.makeRng(999 + k);
      for (let i = 0; i < fake.N; i++) for (let d = t + 1; d < fake.T; d++) {
        for (const arr of [fake.o, fake.h, fake.l, fake.c]) arr[i][d] = 1 + rng.u() * 500;
        fake.v[i][d] = rng.u() * 1e7; fake.eps[i][d] = rng.u() * 9; fake.tgt[i][d] = rng.u() * 900;
        if (d > t + 1) { fake.rv20[i][d] = rng.u(); fake.adv20[i][d] = rng.u() * 1e7; }
      }
      for (let d = t + 1; d < fake.T; d++) { fake.events[d] = [{ type: 'news', sym: 'NBSF', tone: 1, text: 'future' }]; fake.macro[d] = null; fake.regime[d] = 'crash'; }
      const poisoned = decisions(fake, game, t);
      ok(real === poisoned, `no look-ahead: ${scenario} day ${k}`);
      checked++;
    }
    TM.advanceDay(world, game);
  }
  ok(checked >= 7, 'look-ahead checks ran: ' + checked);
}

// 2. Behaviour and rule compliance across scenarios
const rows = [];
let maxRisk = 0, maxPos = 0, nan = 0, entries = 0, logSizes = [];
const actions = {};
const scen = ['random', 'random', 'bull', 'gfc', 'covid', 'rates', 'bubble'];
for (let g = 0; g < 42; g++) {
  const scenario = scen[g % scen.length], margin = g % 2 === 0;
  const { game, world } = TM.createGame({ mode: 'practice', seed: 3000 + g, scenario, days: 120, margin });
  while (game.status === 'active') TM.advanceDay(world, game);
  const mT = TM.metrics(world, game.bots.trader), mI = TM.metrics(world, game.bots.index);
  if (!isFinite(mT.equity)) nan++;
  for (const e of game.traderLog) { actions[e.action] = (actions[e.action] || 0) + 1; if (e.action === 'BUY' || e.action === 'SHORT') { entries++; maxRisk = Math.max(maxRisk, e.riskPct); maxPos = Math.max(maxPos, e.posPct); } }
  logSizes.push(game.traderLog.length);
  rows.push({ scenario, margin, t: mT.total, i: mI.total, ddT: mT.maxDD, ddI: mI.maxDD, sT: mT.sharpe, sI: mI.sharpe, trades: mT.trades, win: mT.winRate });
}
ok(nan === 0, 'no NaN equity');
ok(maxRisk <= 0.01 + 1e-9, 'entries never risk more than the 1% rule: max ' + (maxRisk * 100).toFixed(2) + '%');
ok(maxPos <= 0.15 + 1e-9, 'single-stock entries never exceed 15% of equity: max ' + (maxPos * 100).toFixed(1) + '%');
const by = {};
for (const r of rows) (by[r.scenario] = by[r.scenario] || []).push(r);
console.log('\nMarket Trader vs index fund, 120-day sessions (6 per scenario, half cash / half margin):');
console.log('scenario   trader   index   traderDD  indexDD  traderSharpe indexSharpe trades win%');
const m = (a, k) => TM.mean(a.map((r) => r[k] == null ? 0 : r[k]));
for (const k in by) {
  const a = by[k];
  console.log(`${k.padEnd(9)} ${(m(a, 't') * 100).toFixed(1).padStart(6)}% ${(m(a, 'i') * 100).toFixed(1).padStart(6)}% ${(m(a, 'ddT') * 100).toFixed(1).padStart(8)}% ${(m(a, 'ddI') * 100).toFixed(1).padStart(7)}% ${m(a, 'sT').toFixed(2).padStart(12)} ${m(a, 'sI').toFixed(2).padStart(11)} ${m(a, 'trades').toFixed(0).padStart(6)} ${(m(a, 'win') * 100).toFixed(0).padStart(4)}`);
}
console.log(`all       ${(m(rows, 't') * 100).toFixed(1).padStart(6)}% ${(m(rows, 'i') * 100).toFixed(1).padStart(6)}% ${(m(rows, 'ddT') * 100).toFixed(1).padStart(8)}% ${(m(rows, 'ddI') * 100).toFixed(1).padStart(7)}%`);
console.log('actions per 42 sessions:', JSON.stringify(actions));
console.log('stock entries', entries, '| log entries per session: avg', TM.mean(logSizes).toFixed(0), 'max', Math.max(...logSizes));
console.log(fails ? `\n${fails} FAILED` : '\nall trader checks passed');
process.exitCode = fails ? 1 : 0;
