/* Tack Market V3 · game layer
   Sessions, career levels, risk-rule enforcement and pass/fail evaluation. */
var TM = typeof TM !== 'undefined' ? TM : {};
(function (TM) {
  'use strict';

  const PRACTICE_RULES = { maxRiskPct: 1, maxPosPct: 25, dailyLossPct: 5, maxDDPct: 20, requireStop: false, requireJournal: false, enforce: 'warn', hard: false };
  const LEVELS = [
    {
      id: 1, name: 'Foundations', days: 60, margin: false, capital: 100000,
      pitch: 'Learn the process: plan every trade, size it from the stop, keep losses small. Profit is not required to pass.',
      rules: { maxRiskPct: 1, maxPosPct: 20, dailyLossPct: 4, maxDDPct: 15, requireStop: true, requireJournal: true, enforce: 'warn', hard: false },
      goals: ['Close at least 6 trades', 'Plan a stop on at least 80% of new positions', 'Keep maximum drawdown under 15%', 'No single trade loses more than 2.5% of starting capital']
    },
    {
      id: 2, name: 'Funded Evaluation', days: 60, margin: true, capital: 100000,
      pitch: 'A prop-firm style challenge on a margin account. Hit the profit target without breaking a risk rule. One breach and you fail.',
      rules: { maxRiskPct: 2, maxPosPct: 30, dailyLossPct: 3, maxDDPct: 8, requireStop: true, requireJournal: false, enforce: 'block', hard: true },
      goals: ['Reach +6% profit at any close within 60 days', 'Never lose 3% or more in a single day', 'Never fall 8% below your equity peak']
    },
    {
      id: 3, name: 'Portfolio Manager Mandate', days: 120, margin: true, capital: 1000000,
      pitch: 'Run $1M for 120 days in an unknown market against the index. Beat it on return and on risk-adjusted return.',
      rules: { maxRiskPct: 2, maxPosPct: 15, dailyLossPct: 5, maxDDPct: 20, requireStop: false, requireJournal: false, enforce: 'warn', hard: false },
      goals: ['Beat the index fund total return', 'Achieve a higher Sharpe ratio than the index fund', 'Keep maximum drawdown under 20%', 'Stay invested: average gross exposure of at least 50%']
    }
  ];

  function randomSeed() {
    try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; } catch (e) { return (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0; }
  }
  function hiddenScenario(seed) {
    const u = TM.makeRng(seed ^ 0x51ed27).u();
    if (u < 0.5) return 'random';
    return ['bull', 'gfc', 'covid', 'rates', 'bubble'][Math.min(4, Math.floor((u - 0.5) / 0.1))];
  }
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // cfg: { mode: 'practice'|'level'|'daily', level, scenario, days, capital, margin, costModel, seed, rules, name }
  function createGame(cfg) {
    const lv = cfg.mode === 'level' ? LEVELS.find((l) => l.id === cfg.level) : null;
    const daily = cfg.mode === 'daily' ? (cfg.daily || todayKey()) : null;
    const seed = daily ? TM.hashSeed('daily:' + daily) : cfg.seed != null && cfg.seed !== '' ? (Number(cfg.seed) >>> 0) : randomSeed();
    const days = lv ? lv.days : daily ? 60 : Number(cfg.days) || 60;
    const pick = lv || daily ? 'hidden' : (cfg.scenario || 'random');
    const scenario = pick === 'hidden' ? hiddenScenario(seed) : pick;
    const capital = lv ? lv.capital : daily ? 100000 : Number(cfg.capital) || 100000;
    const margin = lv ? lv.margin : daily ? true : !!cfg.margin;
    const costModel = lv || daily ? 'retail' : (cfg.costModel || 'retail');
    const rules = Object.assign({}, lv ? lv.rules : daily ? PRACTICE_RULES : (cfg.rules || PRACTICE_RULES));
    const world = TM.generateWorld({ seed, scenario, sessionDays: days });
    const player = TM.newAccount('you', cfg.name || 'You', capital, { margin, costModel, track: true, rules });
    const bots = {};
    for (const b of TM.BOT_DEFS) bots[b.id] = TM.newAccount(b.id, b.label, capital, { margin: false, costModel });
    const game = {
      v: 3, seed, scenario, hidden: pick === 'hidden', mode: lv ? 'level' : daily ? 'daily' : 'practice',
      level: lv ? lv.id : null, daily, days, capital, margin, costModel, t: world.start,
      player, bots, botCfg: Object.assign({}, TM.DEFAULT_RULES_BOT),
      status: 'active', result: null, unranked: !!cfg.unranked, created: Date.now(), ddWarned: false
    };
    TM.recordEquity(world, player, world.start);
    for (const id in bots) TM.recordEquity(world, bots[id], world.start);
    TM.runBots(world, game, world.start);
    return { game, world };
  }
  function worldFor(game) {
    return TM.generateWorld({ seed: game.seed, scenario: game.scenario, sessionDays: game.days });
  }
  function sessionLabel(game) {
    if (game.mode === 'level') return `Level ${game.level} · ${LEVELS.find((l) => l.id === game.level).name}`;
    if (game.mode === 'daily') return `Daily challenge · ${game.daily}`;
    return `Practice · ${TM.SCENARIOS[game.scenario].label}`;
  }

  function advanceDay(world, game) {
    if (game.status !== 'active') return null;
    const d = game.t + 1;
    const eqBefore = game.player.equity[game.player.equity.length - 1].eq;
    const sum = TM.processDay(world, game.player, d);
    for (const id in game.bots) TM.processDay(world, game.bots[id], d);
    game.t = d;
    sum.dayPnl = game.player.equity[game.player.equity.length - 1].eq - eqBefore;
    sum.alerts = checkRules(world, game);
    if (game.status === 'active') {
      if (d >= world.start + game.days) finish(world, game);
      else TM.runBots(world, game, d);
    }
    return sum;
  }

  const pct = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
  function checkRules(world, game) {
    const a = game.player, r = a.rules || {}, E = a.equity;
    const last = E[E.length - 1], prev = E[E.length - 2];
    const alerts = [];
    const dayRet = last.eq / prev.eq - 1, dd = last.eq / a.peak - 1;
    if (r.dailyLossPct && dayRet <= -r.dailyLossPct / 100) {
      if (r.hard) { finish(world, game, 'failed', `Daily loss limit breached: ${pct(dayRet)} in one day (limit -${r.dailyLossPct}%).`); return alerts; }
      a.lockoutT = game.t;
      alerts.push({ tone: 'bad', text: `Daily loss limit hit (${pct(dayRet)}). Cool-off: you cannot open new positions for tomorrow's session.` });
    }
    if (r.maxDDPct && dd <= -r.maxDDPct / 100) {
      if (r.hard) { finish(world, game, 'failed', `Maximum drawdown breached: ${pct(dd)} from your peak (limit -${r.maxDDPct}%).`); return alerts; }
      if (!game.ddWarned) { game.ddWarned = true; alerts.push({ tone: 'bad', text: `Drawdown alert: you are ${pct(dd)} below your peak, past your ${r.maxDDPct}% limit. Professionals cut risk here.` }); }
    } else if (r.maxDDPct && dd > -r.maxDDPct / 200) game.ddWarned = false;
    if (game.level === 2 && last.eq >= a.startCash * 1.06) finish(world, game, 'passed', 'Profit target of +6% reached without breaking a risk rule.');
    return alerts;
  }

  function evaluate(world, game) {
    const a = game.player, m = TM.metrics(world, a);
    const checks = [];
    if (game.level === 1) {
      const planned = a.beh.opens ? (a.beh.opens - a.beh.noStop) / a.beh.opens : 0;
      checks.push({ label: 'Closed trades', value: String(m.trades), ok: m.trades >= 6, need: 'at least 6' });
      checks.push({ label: 'Positions with a planned stop', value: (planned * 100).toFixed(0) + '%', ok: a.beh.opens > 0 && planned >= 0.8, need: '80% or more' });
      checks.push({ label: 'Maximum drawdown', value: (m.maxDD * 100).toFixed(1) + '%', ok: m.maxDD > -0.15, need: 'better than -15%' });
      checks.push({ label: 'Worst single trade', value: (m.worstTradePct * 100).toFixed(2) + '%', ok: m.worstTradePct > -0.025, need: 'better than -2.5%' });
    } else if (game.level === 2) {
      checks.push({ label: 'Best equity vs start', value: pct(a.peak / a.startCash - 1), ok: a.peak >= a.startCash * 1.06, need: '+6.0%' });
    } else if (game.level === 3) {
      const b = TM.metrics(world, game.bots.index);
      checks.push({ label: 'Return vs index fund', value: `${pct(m.total)} vs ${pct(b.total)}`, ok: m.total > b.total, need: 'beat the index' });
      checks.push({ label: 'Sharpe vs index fund', value: `${fmtN(m.sharpe)} vs ${fmtN(b.sharpe)}`, ok: m.sharpe != null && (b.sharpe == null || m.sharpe > b.sharpe), need: 'higher than the index' });
      checks.push({ label: 'Maximum drawdown', value: (m.maxDD * 100).toFixed(1) + '%', ok: m.maxDD > -0.2, need: 'better than -20%' });
      checks.push({ label: 'Average gross exposure', value: (m.gross * 100).toFixed(0) + '%', ok: m.gross >= 0.5, need: '50% or more' });
    }
    return { checks, passed: checks.length ? checks.every((c) => c.ok) : null };
  }
  const fmtN = (x) => x == null ? 'n/a' : x.toFixed(2);

  function finish(world, game, forced, reason) {
    if (game.status !== 'active') return;
    game.status = 'ended';
    const ev = evaluate(world, game);
    let status = 'complete';
    if (game.mode === 'level') status = forced || (ev.passed ? 'passed' : 'failed');
    if (game.level === 2 && !forced && !ev.passed) reason = 'The +6% target was not reached within 60 days.';
    game.result = { status, reason: reason || null, checks: ev.checks, endT: game.t };
    for (const a of [game.player].concat(Object.values(game.bots))) {
      for (const o of a.orders) if (o.status === 'open' || o.status === 'pending') { o.status = 'cancelled'; o.reason = 'Session ended'; }
    }
  }
  function endEarly(world, game) {
    finish(world, game, game.mode === 'level' ? 'failed' : null, 'Session ended early by the player.');
  }

  Object.assign(TM, { LEVELS, PRACTICE_RULES, createGame, worldFor, advanceDay, finish, endEarly, evaluate, sessionLabel, hiddenScenario, todayKey, randomSeed });
})(TM);
