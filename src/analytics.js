/* Tack Market V3 · analytics and coaching
   Risk-adjusted performance metrics, trade statistics and a behavioural debrief. */
var TM = typeof TM !== 'undefined' ? TM : {};
(function (TM) {
  'use strict';

  const SQ = Math.sqrt(252);
  const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const stdev = (a) => {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
  };

  function drawdown(values) {
    let peak = -Infinity, maxDD = 0, under = 0, maxUnder = 0;
    const series = values.map((v) => {
      if (v >= peak) { peak = v; under = 0; } else { under++; maxUnder = Math.max(maxUnder, under); }
      const dd = v / peak - 1;
      maxDD = Math.min(maxDD, dd);
      return dd;
    });
    return { maxDD, maxUnder, series };
  }

  function metrics(world, acct) {
    const E = acct.equity;
    const n = E.length - 1;
    const last = E.length ? E[E.length - 1].eq : acct.startCash;
    const total = last / acct.startCash - 1;
    const rets = [], bench = [];
    let rfSum = 0;
    for (let j = 1; j < E.length; j++) {
      rets.push(E[j].eq / E[j - 1].eq - 1);
      bench.push(world.c[world.FUND][E[j].d] / world.c[world.FUND][E[j - 1].d] - 1);
      rfSum += Math.max(0, world.policy[E[j].d] / 100 - 0.005) / 252;
    }
    const rf = n ? rfSum / n : 0;
    const sd = stdev(rets), mu = mean(rets);
    const down = Math.sqrt(mean(rets.map((r) => Math.min(0, r - rf) ** 2)));
    const mb = mean(bench), vb = stdev(bench) ** 2;
    let cov = 0;
    for (let k = 0; k < rets.length; k++) cov += (rets[k] - mu) * (bench[k] - mb);
    cov = rets.length > 1 ? cov / (rets.length - 1) : 0;
    const beta = vb > 0 ? cov / vb : 0;
    const corr = sd > 0 && vb > 0 ? cov / (sd * Math.sqrt(vb)) : 0;
    const dd = drawdown(E.map((e) => e.eq));
    const benchTotal = E.length ? world.c[world.FUND][E[E.length - 1].d] / world.c[world.FUND][E[0].d] - 1 : 0;

    const trades = acct.trades;
    const wins = trades.filter((t) => t.net > 0), losses = trades.filter((t) => t.net <= 0);
    const sumW = wins.reduce((s, t) => s + t.net, 0), sumL = losses.reduce((s, t) => s + t.net, 0);
    const withR = trades.filter((t) => t.r != null);
    const holdOf = (t) => t.closeDay - t.openDay;
    const c = acct.costs;
    const frictions = c.commission + c.spread + c.impact + c.borrow;
    const avgEq = E.length ? mean(E.map((e) => e.eq)) : acct.startCash;
    const gross = E.length ? mean(E.map((e) => (e.long + e.short) / Math.max(1, e.eq))) : 0;
    const net = E.length ? mean(E.map((e) => (e.long - e.short) / Math.max(1, e.eq))) : 0;
    return {
      days: n, equity: last, total, benchTotal, excess: total - benchTotal,
      annual: n >= 20 ? Math.pow(1 + total, 252 / n) - 1 : null,
      vol: sd * SQ,
      sharpe: n >= 10 && sd > 0 ? (mu - rf) / sd * SQ : null,
      sortino: n >= 10 && down > 0 ? (mu - rf) / down * SQ : null,
      beta, corr, alpha: n >= 10 ? ((mu - rf) - beta * (mb - rf)) * 252 : null,
      maxDD: dd.maxDD, maxUnder: dd.maxUnder, ddSeries: dd.series,
      currentDD: E.length ? last / acct.peak - 1 : 0,
      trades: trades.length, openTrades: Object.keys(acct.openTrades).length,
      winRate: trades.length ? wins.length / trades.length : null,
      avgWin: wins.length ? sumW / wins.length : null,
      avgLoss: losses.length ? sumL / losses.length : null,
      profitFactor: sumL < 0 ? sumW / -sumL : (sumW > 0 ? Infinity : null),
      expectancy: trades.length ? (sumW + sumL) / trades.length : null,
      avgR: withR.length ? mean(withR.map((t) => t.r)) : null,
      holdWin: wins.length ? mean(wins.map(holdOf)) : null,
      holdLoss: losses.length ? mean(losses.map(holdOf)) : null,
      worstTradePct: trades.length ? Math.min(...trades.map((t) => t.net)) / acct.startCash : 0,
      frictions, costDrag: frictions / acct.startCash,
      turnoverAnn: n ? acct.turnover / avgEq * 252 / n : 0,
      gross, net, maxW: E.length ? Math.max(...E.map((e) => e.maxW || 0)) : 0,
      costs: c
    };
  }

  const pct = (x, dp) => (x * 100).toFixed(dp == null ? 1 : dp) + '%';
  const money = (x) => (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('en-US', { maximumFractionDigits: 0 });

  // Returns a list of { tone: 'good'|'warn'|'bad'|'info', title, detail } observations.
  function coach(world, acct, m) {
    const out = [];
    const b = acct.beh;
    const add = (tone, title, detail) => out.push({ tone, title, detail });

    if (m.excess < 0) add('info', `The index fund beat you by ${pct(-m.excess)}`, `Holding TMXI would have returned ${pct(m.benchTotal)} vs your ${pct(m.total)}. Over many sessions, if you can't beat the index after costs, a low-cost index fund is the better choice.`);
    else if (m.days >= 20) add('good', `You beat the index fund by ${pct(m.excess)}`, 'Check the Sharpe ratio and drawdown too: beating the index by taking far more risk is not the same as skill.');

    if (b.rg + b.rl >= 4 && b.rg + b.pg > 0 && b.rl + b.pl > 0) {
      const pgr = b.rg / (b.rg + b.pg), plr = b.rl / (b.rl + b.pl);
      if (pgr - plr > 0.1) add('bad', 'Disposition effect: you sell winners and keep losers', `On days you sold, you took ${pct(pgr, 0)} of the gains available but only ${pct(plr, 0)} of the losses. This is the most common retail mistake. Decide your exit before entry and let stops cut the losers.`);
      else if (plr >= pgr) add('good', 'You cut losers at least as readily as winners', `Realised ${pct(plr, 0)} of available losses vs ${pct(pgr, 0)} of gains. That is professional behaviour.`);
    }
    if (m.holdLoss != null && m.holdWin != null && m.trades >= 5 && m.holdLoss > m.holdWin * 1.5)
      add('warn', 'You hold losing trades much longer than winners', `Average hold: losers ${m.holdLoss.toFixed(1)} days, winners ${m.holdWin.toFixed(1)} days. Hoping a loser comes back is how small losses become large ones.`);
    if (m.avgWin != null && m.avgLoss != null && m.trades >= 5) {
      const payoff = m.avgWin / -m.avgLoss;
      if (payoff < 1 && m.winRate < 0.6) add('bad', 'Your average loss is bigger than your average win', `Payoff ratio ${payoff.toFixed(2)} with a ${pct(m.winRate, 0)} win rate. You need either bigger wins or a much higher hit rate.`);
      else if (payoff >= 1.5) add('good', `Wins are ${payoff.toFixed(1)}x the size of losses`, 'A good payoff ratio means you can be wrong more often than right and still make money.');
    }
    if (b.opens >= 3 && b.noStop / b.opens > 0.4) add('bad', `${pct(b.noStop / b.opens, 0)} of your positions had no planned stop`, 'Without a stop you cannot size a position or know your risk. Set the stop first, then size the trade from it.');
    else if (b.opens >= 3 && b.noStop / b.opens <= 0.1) add('good', 'Nearly every position had a planned stop', 'Defining risk before entry is the foundation of position sizing.');
    if (b.stopWiden > 0) add('bad', `You moved a stop further away ${b.stopWiden} time${b.stopWiden > 1 ? 's' : ''}`, 'Widening a stop after entry turns a planned small loss into an unplanned large one. Tighten stops, never loosen them.');
    if (b.buys >= 5 && b.chase / b.buys > 0.35) add('warn', `${pct(b.chase / b.buys, 0)} of your buys came after a sharp run-up`, 'Buying after a big move can work (momentum) but often means chasing. Be explicit about the setup and where you are wrong.');
    if (b.avgDown >= 2) add('warn', `You averaged down into losing positions ${b.avgDown} times`, 'Adding to a loser increases risk exactly when the market is telling you that you are wrong.');
    if (m.costDrag > 0.01) add('bad', `Trading costs took ${pct(m.costDrag, 2)} of your capital`, `Commission, spread, impact and borrow cost ${money(m.frictions)}. Annualised turnover was ${pct(m.turnoverAnn, 0)}. Fewer, better trades usually win.`);
    else if (m.trades >= 3) add('good', `Costs were contained at ${pct(m.costDrag, 2)} of capital`, 'You are not giving your edge away to the broker.');
    if (m.maxW > 0.3) add('warn', `At one point a single position was ${pct(m.maxW, 0)} of your account`, 'Concentration magnifies single-stock surprises like earnings, downgrades and probes. Many professionals cap single positions at 5-10%.');
    if (b.marginCalls > 0) add('bad', `You received ${b.marginCalls} margin call${b.marginCalls > 1 ? 's' : ''}`, 'Forced liquidation sells at the worst time and price. Leverage magnifies losses as much as gains.');
    if (m.maxDD < -0.2) add('bad', `Maximum drawdown of ${pct(m.maxDD)}`, `A ${pct(-m.maxDD, 0)} loss needs a ${pct(1 / (1 + m.maxDD) - 1, 0)} gain to recover. Most professional mandates would have stopped you out.`);
    if (m.days >= 30 && m.gross < 0.4 && m.benchTotal > 0.03) add('info', `You were mostly in cash (average exposure ${pct(m.gross, 0)})`, 'Cash is a position. In a rising market it has an opportunity cost, which is why the index is hard to beat.');
    const earnHits = acct.trades.filter((t) => {
      const i = world.bySym[t.sym];
      return t.retPct < -0.05 && world.earnDays[i].some((d) => d > t.openDay && d <= t.closeDay);
    }).length;
    if (earnHits >= 2) add('warn', `${earnHits} losing trades were held through an earnings report`, 'Earnings dates and implied moves are published in advance. Holding through them is a deliberate bet on the result, so size it that way.');
    if (m.avgR != null && acct.trades.filter((t) => t.r != null && t.r < 0).length >= 3) {
      const lossR = mean(acct.trades.filter((t) => t.r != null && t.r < 0).map((t) => t.r));
      if (lossR > -1.3) add('good', `Average losing trade was ${lossR.toFixed(2)}R`, 'You lost about what you planned to risk. Gaps through stops will sometimes cost more than 1R.');
      else add('warn', `Average losing trade was ${lossR.toFixed(2)}R`, 'Losses ran well beyond the planned risk. Check for gaps, widened stops or missing stop orders.');
    }
    if (!out.length) add('info', 'Not enough activity to judge yet', 'Trade a few more days, then check back.');
    const order = { bad: 0, warn: 1, info: 2, good: 3 };
    return out.sort((a, b2) => order[a.tone] - order[b2.tone]);
  }

  function tagStats(acct) {
    const by = {};
    for (const t of acct.trades) {
      const k = t.tag || 'Untagged';
      const s = by[k] || (by[k] = { tag: k, n: 0, wins: 0, net: 0, rs: [] });
      s.n++; if (t.net > 0) s.wins++; s.net += t.net; if (t.r != null) s.rs.push(t.r);
    }
    return Object.values(by).map((s) => ({ tag: s.tag, n: s.n, winRate: s.wins / s.n, net: s.net, avgR: s.rs.length ? mean(s.rs) : null })).sort((a, b) => b.net - a.net);
  }

  Object.assign(TM, { metrics, coach, tagStats, drawdown, mean, stdev });
})(TM);
