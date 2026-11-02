// Headless tests for engine, broker, bots, analytics and game layer: node tests/core-test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console, crypto: require('crypto').webcrypto }; vm.createContext(ctx);
for (const f of ['engine.js', 'broker.js', 'analytics.js', 'bots.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), ctx, { filename: f });
const TM = vm.runInContext('TM', ctx);
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } };

// 1. determinism
const w1 = TM.generateWorld({ seed: 42, scenario: 'random', sessionDays: 60 });
const w2 = TM.generateWorld({ seed: 42, scenario: 'random', sessionDays: 60 });
ok(w1.c[3][w1.T - 1] === w2.c[3][w2.T - 1] && w1.c[w1.FUND][w1.T - 1] === w2.c[w2.FUND][w2.T - 1], 'world deterministic');
let ohlcBad = 0;
for (let i = 0; i < w1.N; i++) for (let d = 0; d < w1.T; d++) { const o = w1.o[i][d], h = w1.h[i][d], l = w1.l[i][d], c = w1.c[i][d]; if (!(h >= o && h >= c && l <= o && l <= c && l > 0) || !isFinite(o + h + l + c)) ohlcBad++; }
ok(ohlcBad === 0, 'OHLC consistent: ' + ohlcBad);

// 2. order evaluation on synthetic paths
const E = (o, pts) => TM.evalOrder(o, pts, [0, 1, 2, 3]);
let r = E({ side: 'sell', type: 'stop', stop: 95 }, [90, 92, 88, 91]); ok(r && r.px === 90 && r.gapped, 'stop gaps through at open');
r = E({ side: 'sell', type: 'stop', stop: 95 }, [100, 101, 94, 96]); ok(r && r.px === 95 && r.k === 1.5, 'stop triggers intraday at stop');
r = E({ side: 'buy', type: 'limit', limit: 98 }, [100, 101, 97, 99]); ok(r && r.px === 98 && !r.taker, 'limit buy passive fill');
r = E({ side: 'buy', type: 'limit', limit: 98 }, [95, 101, 97, 99]); ok(r && r.px === 95 && r.taker, 'limit buy gaps below: fills at open');
r = E({ side: 'sell', type: 'stoplimit', stop: 95, limit: 94 }, [90, 92, 88, 91]); ok(r && r.triggeredOnly, 'stop-limit gapped below limit does not fill');
r = E({ side: 'sell', type: 'stoplimit', stop: 95, limit: 94 }, [90, 96, 88, 91]); ok(r && r.px === 94, 'stop-limit fills on rebound to limit');
r = E({ side: 'buy', type: 'limit', limit: 90 }, [100, 101, 97, 99]); ok(r === null, 'limit not reached');

// 3. bracket + OCO on a real world
{
  const { game, world } = TM.createGame({ mode: 'practice', seed: 7, days: 60, margin: true });
  const a = game.player, t = game.t, sym = 'NBSF', i = world.bySym[sym], px = world.c[i][t];
  const res = TM.placeOrder(world, a, { sym, side: 'buy', qty: 100, type: 'market', bracket: { stop: TM.r2(px * 0.97), target: TM.r2(px * 1.03) } }, t);
  ok(res.ok && res.children.length === 2, 'bracket placed');
  let closed = false;
  for (let k = 0; k < 40 && !closed; k++) { TM.advanceDay(world, game); closed = a.trades.length > 0; }
  const kids = a.orders.filter((o) => o.parentId === res.order.id);
  ok(closed && kids.filter((o) => o.status === 'filled').length === 1 && kids.filter((o) => o.status === 'cancelled').length === 1, 'OCO: one child filled, other cancelled');
  ok(!a.pos[sym], 'position flat after bracket exit');
}
// 4. cash account cannot short; lockout
{
  const { game, world } = TM.createGame({ mode: 'practice', seed: 9, days: 30, margin: false });
  const res = TM.placeOrder(world, game.player, { sym: 'ARWV', side: 'sell', qty: 10, type: 'market' }, game.t);
  ok(!res.ok, 'cash account short rejected');
}
// 5. random trader: accounting identity, no NaN, margin & shorts
let idBad = 0, nan = 0, calls = 0;
const botRet = {}, scen = {};
for (let g = 0; g < 60; g++) {
  const scenario = ['random', 'bull', 'gfc', 'covid', 'rates', 'bubble'][g % 6];
  const { game, world } = TM.createGame({ mode: 'practice', seed: 500 + g, scenario, days: 120, margin: true, capital: 100000 });
  const a = game.player, rng = TM.makeRng(g);
  while (game.status === 'active') {
    const t = game.t;
    if (rng.chance(0.3)) {
      const i = rng.int(0, world.N - 1), sym = world.inst[i].sym, px = world.c[i][t];
      const side = rng.chance(0.5) ? 'buy' : 'sell';
      const types = ['market', 'limit', 'stop', 'stoplimit'], type = rng.pick(types);
      const qty = Math.floor(rng.range(0.05, 0.6) * TM.equityAt(world, a, t) / px);
      const off = side === 'buy' ? -1 : 1;
      TM.placeOrder(world, a, { sym, side, qty, type, limit: TM.r2(px * (1 + off * 0.01)), stop: TM.r2(px * (1 - off * 0.01)), tif: rng.chance(0.5) ? 'gtc' : 'day',
        bracket: rng.chance(0.5) ? { stop: TM.r2(px * (side === 'buy' ? 0.93 : 1.07)), target: TM.r2(px * (side === 'buy' ? 1.1 : 0.9)) } : null }, t);
    }
    TM.advanceDay(world, game);
  }
  const t = game.t, ex = TM.exposures(world, a, t);
  let unreal = 0; for (const s in a.pos) unreal += (world.c[world.bySym[s]][t] - a.pos[s].avg) * a.pos[s].qty;
  const c = a.costs, lhs = ex.equity - a.startCash, rhs = a.realized + unreal + c.dividends + c.interest - c.commission - c.borrow;
  if (Math.abs(lhs - rhs) > 0.5) idBad++;
  if (!isFinite(ex.equity)) nan++;
  calls += a.beh.marginCalls;
  for (const id in game.bots) { const m = TM.metrics(world, game.bots[id]); (botRet[id] = botRet[id] || []).push(m.total); (scen[scenario + ':' + id] = scen[scenario + ':' + id] || []).push(m.total); }
  TM.coach(world, a, TM.metrics(world, a));
}
ok(idBad === 0, 'accounting identity holds (bad: ' + idBad + ')');
ok(nan === 0, 'no NaN equity');
console.log('random-trader margin calls across 60 games:', calls);
console.log('\nBot mean 120-day return over 60 games (all scenarios):');
for (const id in botRet) console.log('  ' + id.padEnd(9), (TM.mean(botRet[id]) * 100).toFixed(2) + '%', ' sd', (TM.stdev(botRet[id]) * 100).toFixed(1) + '%');
// 6. edges in the random scenario: momentum/value vs index, long sample
const edge = { index: [], momentum: [], value: [], equal: [] };
for (let g = 0; g < 40; g++) {
  const { game, world } = TM.createGame({ mode: 'practice', seed: 9000 + g, scenario: 'random', days: 250 });
  while (game.status === 'active') TM.advanceDay(world, game);
  for (const id in edge) edge[id].push(TM.metrics(world, game.bots[id]).total);
}
console.log('\n250-day random scenario, 40 games, mean return:');
for (const id in edge) console.log('  ' + id.padEnd(9), (TM.mean(edge[id]) * 100).toFixed(2) + '%');
// 7. level 2 hard fail path works
{
  const { game, world } = TM.createGame({ mode: 'level', level: 2, seed: 3 });
  const a = game.player, t = game.t;
  const sym = 'HLVD', i = world.bySym[sym];
  TM.placeOrder(world, a, { sym, side: 'buy', qty: Math.floor(190000 / world.c[i][t]), type: 'market', plannedStop: 1 }, t);
  while (game.status === 'active') TM.advanceDay(world, game);
  console.log('\nlevel 2 leveraged gamble result:', game.result.status, '-', game.result.reason);
}
const t0 = Date.now(); for (let k = 0; k < 10; k++) TM.generateWorld({ seed: k, scenario: 'random', sessionDays: 250 });
console.log('world generation (250d):', ((Date.now() - t0) / 10).toFixed(0) + 'ms');
console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exitCode = fails ? 1 : 0;
