/* Tack Market V3 · benchmark bots
   Each bot trades the same market path as the player, through the same broker and costs. */
var TM = typeof TM !== 'undefined' ? TM : {};
(function (TM) {
  'use strict';

  const BOT_DEFS = [
    { id: 'index', label: 'Index fund', desc: 'Buys the TMXI index fund on day one and never trades again. The passive benchmark.' },
    { id: 'equal', label: 'Equal-weight', desc: 'Buys all 40 stocks in equal amounts on day one and holds.' },
    { id: 'momentum', label: 'Momentum bot', desc: 'Every 21 days holds the 8 stocks with the best 6-month return, skipping the last week.' },
    { id: 'value', label: 'Value bot', desc: 'Every 21 days holds the 8 stocks with the most upside to their analyst target price.' },
    { id: 'rules', label: 'Rules bot', desc: 'Buys random stocks and exits only by your rules: stop, target, trailing stop, time limit. It tests exits, not stock picking.' },
    { id: 'trader', label: 'Market Trader', desc: 'Trades like an experienced professional using only the data you can see, your account type and your risk rules. Its full reasoning is revealed in the debrief.' }
  ];
  const DEFAULT_RULES_BOT = { stopPct: 8, targetPct: 16, trailPct: 0, maxHold: 20, posPct: 10, maxPos: 8 };

  function rebalance(world, acct, t, weights) {
    const eq = TM.equityAt(world, acct, t);
    const syms = new Set(Object.keys(acct.pos).concat(Object.keys(weights)));
    const sells = [], buys = [];
    for (const s of syms) {
      const px = world.c[world.bySym[s]][t];
      const target = Math.floor(eq * (weights[s] || 0) * 0.985 / px);
      const cur = acct.pos[s] ? acct.pos[s].qty : 0;
      const diff = target - cur;
      if (!diff || (target && Math.abs(diff) * px < eq * 0.01)) continue;
      (diff < 0 ? sells : buys).push({ sym: s, side: diff < 0 ? 'sell' : 'buy', qty: Math.abs(diff), type: 'market', tif: 'day', source: 'bot' });
    }
    for (const o of sells.concat(buys)) TM.placeOrder(world, acct, o, t);
  }
  function topN(world, n, score) {
    const rows = [];
    for (let i = 0; i < world.nStocks; i++) rows.push({ sym: world.inst[i].sym, s: score(i) });
    rows.sort((a, b) => b.s - a.s);
    const w = {};
    rows.slice(0, n).forEach((r) => { w[r.sym] = 1 / n; });
    return w;
  }

  function rulesBot(world, a, t, cfg, seed) {
    for (const s of Object.keys(a.pos)) {
      const p = a.pos[s], i = world.bySym[s];
      if (cfg.maxHold && t - p.openDay >= cfg.maxHold) {
        for (const o of a.orders) if (o.sym === s && (o.status === 'open' || o.status === 'pending')) TM.cancelOrder(a, o.id, 'Time exit');
        TM.placeOrder(world, a, { sym: s, side: 'sell', qty: p.qty, type: 'market', source: 'bot' }, t);
        continue;
      }
      if (cfg.trailPct > 0) {
        let hi = 0;
        for (let d = p.openDay; d <= t; d++) hi = Math.max(hi, world.c[i][d]);
        const ns = TM.r2(hi * (1 - cfg.trailPct / 100));
        const so = a.orders.find((o) => o.sym === s && o.status === 'open' && o.role === 'stop');
        if (so && ns > so.stop) so.stop = ns;
      }
    }
    const working = a.orders.filter((o) => o.status === 'open' && !o.reduceOnly && o.side === 'buy').length;
    if (Object.keys(a.pos).length + working >= cfg.maxPos) return;
    const rng = TM.makeRng(TM.hashSeed(seed + ':rules:' + t));
    const cands = [];
    for (let i = 0; i < world.nStocks; i++) if (!a.pos[world.inst[i].sym]) cands.push(i);
    if (!cands.length) return;
    const i = rng.pick(cands), px = world.c[i][t];
    const eq = TM.equityAt(world, a, t);
    let qty = Math.floor(eq * cfg.posPct / 100 / px);
    if (qty * px * 1.01 > a.cash) qty = Math.floor(a.cash / (px * 1.01));
    if (qty < 1) return;
    const bracket = {};
    if (cfg.stopPct > 0) bracket.stop = TM.r2(px * (1 - cfg.stopPct / 100));
    if (cfg.targetPct > 0) bracket.target = TM.r2(px * (1 + cfg.targetPct / 100));
    TM.placeOrder(world, a, { sym: world.inst[i].sym, side: 'buy', qty, type: 'market', bracket, source: 'bot' }, t);
  }

  // Bots decide after the close of day t; their orders execute on day t + 1.
  function runBots(world, game, t) {
    const start = world.start;
    const reb = (t - start) % 21 === 0;
    for (const id in game.bots) {
      const a = game.bots[id];
      if (id === 'index' && t === start) rebalance(world, a, t, { TMXI: 1 });
      else if (id === 'equal' && t === start) {
        const w = {};
        for (let i = 0; i < world.nStocks; i++) w[world.inst[i].sym] = 1 / world.nStocks;
        rebalance(world, a, t, w);
      } else if (id === 'momentum' && reb) rebalance(world, a, t, topN(world, 8, (i) => world.c[i][t - 5] / world.c[i][t - 126] - 1));
      else if (id === 'value' && reb) rebalance(world, a, t, topN(world, 8, (i) => world.tgt[i][t] / world.c[i][t] - 1));
      else if (id === 'rules') rulesBot(world, a, t, game.botCfg || DEFAULT_RULES_BOT, game.seed);
      else if (id === 'trader') TM.marketTrader(world, game, t);
    }
  }

  Object.assign(TM, { BOT_DEFS, DEFAULT_RULES_BOT, runBots });
})(TM);
