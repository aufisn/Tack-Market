/* Tack Market V3 · Market Trader bot
   A discretionary-style professional process, written as explicit rules so every decision can be explained.
   It sees only what the player sees after each close (prices up to today, moving averages, volatility,
   P/E, growth, analyst targets, earnings history and dates, dividends, headlines). It never reads the
   hidden regime, fair values or any future data. It trades through the same broker, costs, account type
   and risk rules as the player, and writes a reasoning entry for every action into game.traderLog. */
var TM = typeof TM !== 'undefined' ? TM : {};
(function (TM) {
  'use strict';

  const SQ = Math.sqrt(252);
  const W_TREND = 0.30, W_MOM = 0.25, W_VALUE = 0.25, W_EARN = 0.20;
  const STOP_ATR = 2.5;          // initial stop distance in ATRs
  const TRAIL_ATR = 3;           // trailing stop distance once a trade is +2R
  const SECTOR_CAP = 0.35;       // max share of equity in one sector
  const ADV_CAP = 0.02;          // never more than 2% of average daily volume
  const REGIME = {
    'Risk-on': { gross: 0.95, maxPos: 10, entries: 2, note: 'trend and breadth support being fully invested' },
    'Caution': { gross: 0.65, maxPos: 8, entries: 1, note: 'mixed signals, so exposure is trimmed and only the best set-ups are taken' },
    'Risk-off': { gross: 0.35, maxPos: 5, entries: 1, note: 'the market is in a downtrend or unusually volatile, so capital is protected first' }
  };

  // Styles: which exemptions from the player's rules the trader is given (measured in testing).
  const STYLES = {
    conservative: { label: 'Conservative', margin: null, posCap: 15, riskPct: null, lossRules: true, earningsOk: false,
      summary: 'Plays by exactly your rules: your account type, your risk per trade, your loss limits, and positions capped at 15% (or your own limit if lower).' },
    balanced: { label: 'Balanced', margin: true, posCap: 25, riskPct: null, lossRules: true, earningsOk: false,
      summary: 'Two freedoms: a margin account (so it can hedge and short) and positions of up to 25% in its best ideas. Your risk per trade and loss limits still apply.' },
    aggressive: { label: 'Aggressive', margin: true, posCap: 25, riskPct: 2, lossRules: false, earningsOk: true,
      summary: 'Every freedom: margin account, positions up to 25%, 2% risk per trade, no daily-loss or drawdown limits, and it may buy just before earnings.' }
  };
  const styleOf = (game) => STYLES[game.traderStyle] || STYLES.conservative;

  const pct = (x, dp) => (x >= 0 ? '+' : '') + (x * 100).toFixed(dp == null ? 1 : dp) + '%';
  const pp = (x, dp) => (x * 100).toFixed(dp == null ? 1 : dp) + '%';
  const usd = (x) => '$' + x.toFixed(2);
  const money = (x) => (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('en-US', { maximumFractionDigits: 0 });

  function atr(w, i, t, n) {
    let s = 0;
    for (let d = t - n + 1; d <= t; d++) s += Math.max(w.h[i][d] - w.l[i][d], Math.abs(w.h[i][d] - w.c[i][d - 1]), Math.abs(w.l[i][d] - w.c[i][d - 1]));
    return s / n;
  }
  function median(a) { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; }
  function zscores(vals) {
    const m = TM.mean(vals), s = TM.stdev(vals) || 1;
    return vals.map((v) => Math.max(-2.5, Math.min(2.5, (v - m) / s)));
  }

  // ---------- what the trader reads each evening ----------
  function readMarket(w, t) {
    const F = w.FUND, c = w.c[F];
    const s50 = TM.sma(c, t, 50), s200 = TM.sma(c, t, 200), s50ago = TM.sma(c, t - 10, 50);
    let above50 = 0;
    for (let i = 0; i < w.nStocks; i++) if (w.c[i][t] > TM.sma(w.c[i], t, 50)) above50++;
    const breadth = above50 / w.nStocks;
    const vol = w.rv20[F][t + 1 < w.T ? t + 1 : t] * SQ;
    const hist = [];
    for (let d = t - 249; d <= t; d++) hist.push(w.rv20[F][d + 1 < w.T ? d + 1 : d] * SQ);
    const volNormal = median(hist);
    let hi = 0;
    for (let d = t - 249; d <= t; d++) hi = Math.max(hi, c[d]);
    const dd = c[t] / hi - 1;
    let score = 0;
    score += c[t] > s200 ? 1 : -1;
    score += c[t] > s50 ? 0.5 : -0.5;
    score += s50 > s50ago ? 0.5 : -0.5;
    score += breadth > 0.55 ? 0.5 : breadth < 0.4 ? -0.5 : 0;
    score += vol > volNormal * 1.6 ? -1 : vol > volNormal * 1.25 ? -0.5 : 0;
    score += dd < -0.15 ? -0.5 : 0;
    const regime = score >= 1.5 ? 'Risk-on' : score >= -0.5 ? 'Caution' : 'Risk-off';
    return { regime, score, px: c[t], s50, s200, rising: s50 > s50ago, breadth, vol, volNormal, dd, rate: w.policy[t] };
  }

  function scoreStocks(w, t) {
    const N = w.nStocks;
    const raw = { trend: [], mom: [], value: [], earn: [] };
    const info = [];
    const peBySector = {};
    for (let i = 0; i < N; i++) {
      const pe = w.c[i][t] / w.eps[i][t];
      (peBySector[w.inst[i].sector] = peBySector[w.inst[i].sector] || []).push(pe > 0 ? pe : 99);
    }
    const secMedPE = {};
    for (const k in peBySector) secMedPE[k] = median(peBySector[k]);
    for (let i = 0; i < N; i++) {
      const s = w.inst[i], c = w.c[i], px = c[t];
      const s50 = TM.sma(c, t, 50), s200 = TM.sma(c, t, 200), s50ago = TM.sma(c, t - 10, 50);
      const slope = s50 / s50ago - 1;
      const mom = c[t - 5] / c[t - 126] - 1;
      const pe = px / w.eps[i][t];
      const upside = w.tgt[i][t] / px - 1;
      const peRel = pe > 0 ? pe / secMedPE[s.sector] - 1 : 1;
      let lastE = null;
      for (const d of w.earnDays[i]) { if (d > t) break; lastE = d; }
      const implied = s.earnSd * 0.75;
      const age = lastE != null ? t - lastE : 999;
      const reaction = lastE != null && lastE >= 1 ? c[lastE] / c[lastE - 1] - 1 : 0;
      const earnSignal = age <= 45 && implied > 0 ? (reaction / implied) * (1 - age / 45) : 0;
      raw.trend.push((px / s50 - 1) + 0.5 * (px / s200 - 1) + 2 * slope);
      raw.mom.push(mom);
      raw.value.push(upside - 0.5 * peRel);
      raw.earn.push(earnSignal);
      const ne = TM.nextEarnings(w, i, t);
      const news = [];
      for (let d = Math.max(1, t - 2); d <= t; d++) for (const e of w.events[d]) if (e.sym === s.sym && e.type === 'news') news.push({ d, text: e.text, tone: e.tone });
      info.push({
        i, sym: s.sym, name: s.name, sector: s.sector, px, s50, s200, slope, mom, pe, secPE: secMedPE[s.sector], g: s.g, upside, tgt: w.tgt[i][t],
        lastE, age, reaction, implied, nextE: ne, daysToE: ne != null ? ne - t : 999, atr: atr(w, i, t, 14), vol: w.rv20[i][Math.min(t + 1, w.T - 1)] * SQ,
        r5: px / c[t - 5] - 1, adv: w.adv20[i][Math.min(t + 1, w.T - 1)], htb: s.hardToBorrow, borrow: s.borrowFee, news
      });
    }
    const z = { trend: zscores(raw.trend), mom: zscores(raw.mom), value: zscores(raw.value), earn: zscores(raw.earn) };
    info.forEach((x, k) => {
      x.z = { trend: z.trend[k], mom: z.mom[k], value: z.value[k], earn: z.earn[k] };
      x.score = W_TREND * x.z.trend + W_MOM * x.z.mom + W_VALUE * x.z.value + W_EARN * x.z.earn;
    });
    const ranked = info.slice().sort((a, b) => b.score - a.score);
    ranked.forEach((x, k) => { x.rank = k + 1; });
    const momRank = info.slice().sort((a, b) => b.mom - a.mom);
    momRank.forEach((x, k) => { x.momRank = k + 1; });
    return { info, ranked, bySym: Object.fromEntries(info.map((x) => [x.sym, x])) };
  }

  // ---------- explanation helpers ----------
  function factorLines(x, N) {
    const tr = x.px > x.s50 && x.px > x.s200 ? `price ${usd(x.px)} is above its 50-day (${usd(x.s50)}) and 200-day (${usd(x.s200)}) averages` :
      x.px < x.s50 && x.px < x.s200 ? `price ${usd(x.px)} is below its 50-day (${usd(x.s50)}) and 200-day (${usd(x.s200)}) averages` :
        `price ${usd(x.px)} is between its 50-day (${usd(x.s50)}) and 200-day (${usd(x.s200)}) averages`;
    const earn = x.lastE == null || x.age > 45 ? 'no recent earnings signal' :
      `last report ${x.age} trading days ago moved the stock ${pct(x.reaction)} against an implied ±${pp(x.implied)}${Math.abs(x.reaction) > x.implied ? ', a genuine surprise' : ''}`;
    return [
      `Trend: ${tr}, and the 50-day average is ${x.slope > 0 ? 'rising' : 'falling'} (${pct(x.slope)} over 10 days).`,
      `Momentum: ${pct(x.mom)} over the last six months excluding the latest week (rank ${x.momRank} of ${N}).`,
      `Valuation: analyst target ${usd(x.tgt)} is ${pct(x.upside, 0)} from here; P/E ${x.pe > 0 ? x.pe.toFixed(1) : 'n/m'} vs a ${x.sector} median of ${x.secPE.toFixed(1)}, with expected EPS growth of ${pp(x.g)}.`,
      `Earnings: ${earn}; next report in ${x.daysToE < 900 ? x.daysToE + ' trading days' : 'n/a'}.`
    ];
  }
  // The strongest argument against a trade, stated openly (dir 1 = long, -1 = short).
  function againstLine(x, dir) {
    const names = { trend: 'the trend', mom: 'momentum', value: 'valuation', earn: 'the earnings signal' };
    const k = Object.keys(names).sort((p, q) => dir * x.z[p] - dir * x.z[q])[0];
    if (dir * x.z[k] > -0.5) return [];
    const detail = k === 'value' ? (dir > 0 ? `the analyst target is ${pct(x.upside, 0)} from here and the P/E is ${x.pe > 0 ? x.pe.toFixed(1) : 'n/m'} vs ${x.secPE.toFixed(1)} for the sector` : `the stock already looks cheap (target ${pct(x.upside, 0)} away)`)
      : k === 'earn' ? `the last earnings reaction was ${pct(x.reaction)}` : k === 'mom' ? `six-month momentum is ${pct(x.mom)}` : `the price trend is ${dir > 0 ? 'weak' : 'still firm'}`;
    return [`Against the trade: ${names[k]} points the other way (${detail}). The other factors outweigh it, and the stop and position size limit the damage if it turns out to matter.`];
  }
  function factorData(x) {
    return [
      ['Composite score', `${x.score.toFixed(2)} (rank ${x.rank}/40)`],
      ['Trend z', x.z.trend.toFixed(2)], ['Momentum z', x.z.mom.toFixed(2)], ['Value z', x.z.value.toFixed(2)], ['Earnings z', x.z.earn.toFixed(2)],
      ['Price', usd(x.px)], ['50 / 200-day', `${usd(x.s50)} / ${usd(x.s200)}`], ['6-month return', pct(x.mom)], ['5-day return', pct(x.r5)],
      ['P/E vs sector', `${x.pe > 0 ? x.pe.toFixed(1) : 'n/m'} vs ${x.secPE.toFixed(1)}`], ['Analyst upside', pct(x.upside, 0)],
      ['ATR (14d)', usd(x.atr)], ['Volatility (20d)', pp(x.vol, 0)], ['Next earnings', x.daysToE < 900 ? `${x.daysToE} days` : 'n/a']
    ];
  }
  function marketData(mk) {
    return [
      ['Regime read', mk.regime], ['Index vs 50-day', `${usd(mk.px)} vs ${usd(mk.s50)} (${mk.rising ? 'rising' : 'falling'})`], ['Index vs 200-day', usd(mk.s200)],
      ['Breadth', `${pp(mk.breadth, 0)} of stocks above their 50-day`], ['Index volatility', `${pp(mk.vol, 0)} vs normal ${pp(mk.volNormal, 0)}`],
      ['From 52-week high', pct(mk.dd)], ['Policy rate', `${mk.rate.toFixed(2)}%`]
    ];
  }

  // ---------- the evening routine ----------
  function marketTrader(w, game, t) {
    const a = game.bots.trader;
    if (!a) return;
    const log = game.traderLog || (game.traderLog = []);
    const st = game.traderState || (game.traderState = { regime: null, pos: {}, passed: {} });
    st.passed = st.passed || {};
    for (const s in st.pos) if (!a.pos[s]) delete st.pos[s];
    const rules = game.player.rules || TM.PRACTICE_RULES;
    const E = a.equity, eq = E[E.length - 1].eq;
    const day = t - w.start;
    const add = (entry) => { entry.t = t; entry.day = day; log.push(entry); return entry; };
    const mk = readMarket(w, t);
    if (st.regime && mk.regime !== st.regime) {
      const severe = mk.regime === 'Risk-off' && mk.score <= -2;
      if (!severe && st.pendingRegime !== mk.regime) { st.pendingRegime = mk.regime; mk.regime = st.regime; }
      else st.pendingRegime = null;
    } else st.pendingRegime = null;
    const sc = scoreStocks(w, t);
    const R = REGIME[mk.regime];
    const ex = TM.exposures(w, a, t);

    // risk rules from the player's own settings
    const style = styleOf(game);
    if (!st.styleLogged) {
      st.styleLogged = true;
      add({ kind: 'view', action: 'STYLE', title: `Trading style: ${style.label}`, why: [style.summary,
        style.margin ? 'It uses a margin account even if yours is a cash account.' : `It uses the same ${a.margin ? 'margin' : 'cash'} account type as you.`],
        data: [['Account', a.margin ? 'Margin' : 'Cash'], ['Risk per trade', style.riskPct ? `${style.riskPct}% (exempt from your rule)` : `${Math.min(Math.max(rules.maxRiskPct || 1, 0.25), 2)}% (your rule)`],
          ['Position cap', style.margin ? `${style.posCap}% (exempt from your rule)` : `${Math.min(rules.maxPosPct || 25, style.posCap)}%`], ['Loss limits', style.lossRules ? 'yours apply' : 'none'], ['Buying before earnings', style.earningsOk ? 'allowed' : 'avoided']] });
    }
    const riskPct = (style.riskPct || Math.min(Math.max(rules.maxRiskPct || 1, 0.25), 2)) / 100;
    const maxPosPct = (style.margin ? style.posCap : Math.min(rules.maxPosPct || 25, style.posCap)) / 100;
    const dayRet = E.length > 1 ? eq / E[E.length - 2].eq - 1 : 0;
    const ddNow = eq / a.peak - 1;
    let riskScale = 1, blockNew = false;
    const ruleNotes = [];
    if (style.lossRules && rules.dailyLossPct && dayRet <= -rules.dailyLossPct / 100) {
      blockNew = true;
      ruleNotes.push(`Lost ${pct(dayRet)} today, beyond the ${rules.dailyLossPct}% daily loss limit: no new positions tomorrow (cool-off).`);
    }
    if (style.lossRules && rules.maxDDPct && ddNow <= -rules.maxDDPct / 100) {
      blockNew = true;
      ruleNotes.push(`Drawdown ${pct(ddNow)} breaches the ${rules.maxDDPct}% limit: no new risk until the account recovers.`);
    } else if (style.lossRules && rules.maxDDPct && ddNow <= -rules.maxDDPct * 0.6 / 100) {
      riskScale = 0.5;
      ruleNotes.push(`Drawdown ${pct(ddNow)} is past 60% of the ${rules.maxDDPct}% limit: risk per trade halved.`);
    }
    const ruleKey = (blockNew ? 'block' : '') + (riskScale < 1 ? 'half' : '');
    if (ruleNotes.length && ruleKey !== st.ruleKey) add({ kind: 'risk', action: 'RULES', title: 'Risk rules applied', why: ruleNotes, data: [['Equity', money(eq)], ['Today', pct(dayRet)], ['From peak', pct(ddNow)]] });
    if (!ruleNotes.length && st.ruleKey) add({ kind: 'risk', action: 'RULES', title: 'Risk rules back to normal', why: ['The account is back within its loss and drawdown limits, so normal position sizes resume.'], data: [['Equity', money(eq)], ['From peak', pct(ddNow)]] });
    st.ruleKey = ruleNotes.length ? ruleKey : '';

    if (st.regime !== mk.regime) {
      add({
        kind: 'view', action: 'MARKET VIEW', regime: mk.regime, title: `${st.regime ? 'Regime change: ' + st.regime + ' → ' : 'Starting view: '}${mk.regime}`,
        why: [
          `The index is ${mk.px > mk.s200 ? 'above' : 'below'} its 200-day average and ${mk.px > mk.s50 ? 'above' : 'below'} its ${mk.rising ? 'rising' : 'falling'} 50-day average.`,
          `${pp(mk.breadth, 0)} of stocks are above their own 50-day average, so the move is ${mk.breadth > 0.55 ? 'broad-based' : mk.breadth < 0.4 ? 'narrow and weak' : 'mixed'}.`,
          `Index volatility is ${pp(mk.vol, 0)} against a normal ${pp(mk.volNormal, 0)}${mk.vol > mk.volNormal * 1.25 ? ': elevated, so positions must be smaller' : ''}.`,
          `Conclusion: ${R.note}. Target long exposure about ${pp(R.gross, 0)} of equity, at most ${R.maxPos} positions${a.margin && mk.regime === 'Risk-off' ? ', with an index hedge' : ''}.`
        ],
        data: marketData(mk)
      });
      st.regime = mk.regime;
    }

    const working = (sym) => a.orders.filter((o) => o.sym === sym && (o.status === 'open' || o.status === 'pending'));
    const stopOrder = (sym) => a.orders.find((o) => o.sym === sym && o.status === 'open' && o.reduceOnly && o.role === 'stop');
    const exitAll = (sym, why, action, data, kind) => {
      const p = a.pos[sym];
      for (const o of working(sym)) TM.cancelOrder(a, o.id, 'Replaced by exit');
      const res = TM.placeOrder(w, a, { sym, side: p.qty > 0 ? 'sell' : 'buy', qty: Math.abs(p.qty), type: 'market', source: 'bot' }, t);
      if (res.ok) add({ kind: kind || 'exit', action, sym, qty: Math.abs(p.qty), px: w.c[w.bySym[sym]][t], orderId: res.order.id, title: `${action} ${Math.abs(p.qty)} ${sym}`, why, data });
      delete st.pos[sym];
    };

    // 1. manage open positions
    let longValue = ex.long;
    for (const sym of Object.keys(a.pos)) {
      const p = a.pos[sym], i = w.bySym[sym], px = w.c[i][t], tr = a.openTrades[sym];
      if (sym === 'TMXI') continue;
      const x = sc.bySym[sym];
      const dir = p.qty > 0 ? 1 : -1;
      const s = st.pos[sym] || (st.pos[sym] = { hi: px, lo: px, partial: false, be: false });
      s.hi = Math.max(s.hi, px); s.lo = Math.min(s.lo, px);
      const so = stopOrder(sym);
      const initStop = tr && tr.plannedStop ? tr.plannedStop : p.avg - dir * STOP_ATR * x.atr;
      const Rps = Math.abs(p.avg - initStop) || x.atr * STOP_ATR;
      const gainR = dir * (px - p.avg) / Rps;
      const pData = [['Entry', usd(p.avg)], ['Now', usd(px)], ['Open P&L', `${money(dir * (px - p.avg) * Math.abs(p.qty))} (${gainR.toFixed(2)}R)`], ['1R per share', usd(Rps)], ['Current stop', so ? usd(so.stop) : 'none'], ['Score rank', `${x.rank}/40`]];

      // thesis checks
      const broken = dir > 0 ? (px < x.s50 && x.rank > 20) || x.rank > 30 : (px > x.s50 && x.rank < 21) || x.rank < 11;
      if (broken) {
        const why = dir > 0
          ? [px < x.s50 ? `Price ${usd(px)} closed below the 50-day average ${usd(x.s50)}: the uptrend that justified the trade has broken.` : 'Trend still intact, but the overall case has deteriorated sharply.',
            `Composite score fell to rank ${x.rank} of 40 (it needs to be in the top half to keep a long).`,
            `Selling now at ${gainR.toFixed(2)}R rather than waiting for the stop: a broken thesis is a reason to exit, not a reason to hope.`]
          : [`The stock has ${px > x.s50 ? 'recovered above its 50-day average' : 'improved'}; its score rank rose to ${x.rank}, so the case for the short is gone.`, `Covering at ${gainR.toFixed(2)}R.`];
        exitAll(sym, why, dir > 0 ? 'SELL' : 'COVER', pData.concat(factorData(x).slice(0, 5)));
        if (dir > 0) longValue -= p.qty * px;
        continue;
      }
      // event risk: trim before earnings unless the trade already has a cushion
      if (x.daysToE === 1 && gainR < 1 && Math.abs(p.qty) * px / eq > 0.05 && Math.abs(p.qty) >= 2) {
        const q = Math.floor(Math.abs(p.qty) / 2);
        if (so) TM.modifyOrder(w, a, so.id, { qty: Math.abs(p.qty) - q }, t);
        const res = TM.placeOrder(w, a, { sym, side: dir > 0 ? 'sell' : 'buy', qty: q, type: 'market', source: 'bot' }, t);
        if (res.ok) add({ kind: 'risk', action: 'TRIM', sym, qty: q, px, orderId: res.order.id, title: `TRIM ${q} ${sym} before earnings`,
          why: [`${sym} reports at tomorrow's open; the implied move is ±${pp(x.implied)}, larger than ${(x.implied * px / Rps).toFixed(1)}R of normal noise allows for.`,
            `The trade is only ${gainR.toFixed(2)}R in profit, so there is no cushion against a gap through the stop.`,
            'Halving the position keeps exposure to the result without letting one report decide the account.'], data: pData });
        if (dir > 0) longValue -= q * px;
        continue;
      }
      // profit management
      if (!s.partial && gainR >= 3 && Math.abs(p.qty) >= 3) {
        const q = Math.floor(Math.abs(p.qty) / 3);
        if (so) TM.modifyOrder(w, a, so.id, { qty: Math.abs(p.qty) - q }, t);
        const res = TM.placeOrder(w, a, { sym, side: dir > 0 ? 'sell' : 'buy', qty: q, type: 'market', source: 'bot' }, t);
        if (res.ok) { s.partial = true; add({ kind: 'exit', action: 'TAKE PROFIT', sym, qty: q, px, orderId: res.order.id, title: `Bank a third of ${sym} at +${gainR.toFixed(1)}R`,
          why: ['The trade has made three times its initial risk. Banking a third locks in a real gain.', 'The rest stays on with a trailing stop, so a continued trend can still pay.'], data: pData }); }
      }
      if (so) {
        let ns = so.stop, reason = null;
        if (gainR >= 1 && dir * (p.avg - so.stop) > 0) { ns = TM.r2(p.avg); reason = `The trade reached +${gainR.toFixed(2)}R, so the stop moves to the entry price ${usd(p.avg)}: from here the worst case is roughly breakeven.`; }
        if (gainR >= 2) {
          const trail = TM.r2(dir > 0 ? s.hi - TRAIL_ATR * x.atr : s.lo + TRAIL_ATR * x.atr);
          if (dir * (trail - ns) > 0) { ns = trail; reason = `At +${gainR.toFixed(2)}R the stop trails ${TRAIL_ATR} ATRs behind the best close (${usd(dir > 0 ? s.hi : s.lo)}), protecting most of the gain while giving the trend room.`; }
        }
        if (reason && dir * (ns - so.stop) >= 0.5 * Rps) {
          const old = so.stop;
          TM.modifyOrder(w, a, so.id, { stop: ns }, t);
          add({ kind: 'risk', action: 'RAISE STOP', sym, px, title: `${dir > 0 ? 'Raise' : 'Lower'} stop on ${sym}: ${usd(old)} → ${usd(ns)}`, why: [reason, 'Stops only ever move in the direction of the trade, never away from it.'], data: pData });
        }
      }
    }

    // 2. de-risk if long exposure is above what the regime allows (the index core goes first)
    const grossTarget = R.gross * (riskScale < 1 ? 0.75 : 1);
    const F = w.FUND, fpx = w.c[F][t];
    const coreQty = () => (a.pos.TMXI && a.pos.TMXI.qty > 0 ? a.pos.TMXI.qty : 0);
    const coreSelling = () => a.orders.filter((o) => o.sym === 'TMXI' && o.status === 'open' && o.side === 'sell' && !o.reduceOnly).reduce((n, o) => n + o.qty, 0);
    const sellCore = (qty, why) => {
      qty = Math.min(qty, coreQty() - coreSelling());
      if (qty < 1) return 0;
      const res = TM.placeOrder(w, a, { sym: 'TMXI', side: 'sell', qty, type: 'market', source: 'bot' }, t);
      if (res.ok) add({ kind: 'risk', action: 'REDUCE CORE', sym: 'TMXI', qty, px: fpx, orderId: res.order.id, title: `Sell ${qty} TMXI from the index core`, why, data: marketData(mk) });
      return res.ok ? qty : 0;
    };
    if (longValue / eq > grossTarget + 0.1 && coreQty()) {
      const excess = longValue - grossTarget * eq;
      const sold = sellCore(Math.ceil(excess / fpx), [`Long exposure is ${pp(longValue / eq, 0)} of equity, above the ${pp(grossTarget, 0)} a ${mk.regime} market allows.`,
        'The index core is the first thing to go: it was only there to keep idle cash invested, while the stock positions each have their own case.']);
      longValue -= sold * fpx;
    }
    if (longValue / eq > grossTarget + 0.1) {
      const longs = Object.keys(a.pos).filter((s) => s !== 'TMXI' && a.pos[s].qty > 0 && !a.orders.some((o) => o.sym === s && o.status === 'open' && !o.reduceOnly && o.side === 'sell'));
      longs.sort((x, y) => sc.bySym[y].rank - sc.bySym[x].rank);
      for (const sym of longs) {
        if (longValue / eq <= grossTarget + 0.02) break;
        const p = a.pos[sym], px = w.c[w.bySym[sym]][t];
        exitAll(sym, [`Long exposure is ${pp(longValue / eq, 0)} of equity, above the ${pp(grossTarget, 0)} the ${mk.regime} regime allows.`,
          `${sym} is the weakest holding (score rank ${sc.bySym[sym].rank}), so it goes first.`, 'Reducing exposure early in a deteriorating market is cheaper than being forced out later.'],
        'SELL', [['Long exposure', pp(longValue / eq, 0)], ['Target', pp(grossTarget, 0)], ['Score rank', `${sc.bySym[sym].rank}/40`]], 'risk');
        longValue -= p.qty * px;
      }
    }

    if (mk.regime === 'Risk-off' && coreQty()) {
      const sold = sellCore(coreQty(), ['The market read has turned Risk-off, so the index core (held only to keep idle cash working) is sold in full.', 'Stock positions stay only while their own trend and stop allow.']);
      longValue -= sold * fpx;
    }
    // 3. hedge with the index fund on a margin account in a risk-off market
    if (a.margin) {
      const hedge = a.pos.TMXI && a.pos.TMXI.qty < 0 ? -a.pos.TMXI.qty : 0;
      if (mk.regime === 'Risk-off' && !hedge && !coreQty() && longValue / eq > 0.15) {
        const qty = Math.floor((longValue - 0.15 * eq) * 0.6 / fpx);
        if (qty > 0) {
          const res = TM.placeOrder(w, a, { sym: 'TMXI', side: 'sell', qty, type: 'market', source: 'bot', bracket: { stop: TM.r2(fpx * 1.08) } }, t);
          if (res.ok) add({ kind: 'risk', action: 'HEDGE', sym: 'TMXI', qty, px: fpx, orderId: res.order.id, title: `HEDGE: short ${qty} TMXI`,
            why: [`The market read is Risk-off, but the book still holds ${money(longValue)} of stocks.`, `Shorting ${money(qty * fpx)} of the index fund offsets roughly 60% of the market risk above a 15% net exposure, so a further market fall hurts far less.`,
              'The hedge keeps the stock-specific bets (which stocks beat the market) while removing much of the bet on the market itself.', 'A stop 8% above protects against a sharp rally.'], data: marketData(mk) });
        }
      } else if (hedge && mk.regime !== 'Risk-off') {
        for (const o of working('TMXI')) TM.cancelOrder(a, o.id, 'Hedge lifted');
        const res = TM.placeOrder(w, a, { sym: 'TMXI', side: 'buy', qty: hedge, type: 'market', source: 'bot' }, t);
        if (res.ok) add({ kind: 'risk', action: 'UNHEDGE', sym: 'TMXI', qty: hedge, px: fpx, orderId: res.order.id, title: `Lift hedge: cover ${hedge} TMXI`,
          why: [`The market read has improved to ${mk.regime}.`, 'Keeping the hedge would cancel out the market’s recovery, so it is removed.'], data: marketData(mk) });
      }
    }

    // 4. new stock positions (the index core can be sold to fund them)
    const holdings = Object.keys(a.pos).filter((s) => s !== 'TMXI').length + a.orders.filter((o) => o.status === 'open' && !o.reduceOnly && o.source === 'bot' && o.sym !== 'TMXI' && TM.orderEffect(a, o.sym, o.side, o.qty).opening).length;
    let room = blockNew ? 0 : Math.min(R.maxPos - holdings, R.entries);
    const sectorVal = {};
    for (const s in a.pos) if (s !== 'TMXI') { const sec = w.inst[w.bySym[s]].sector; sectorVal[sec] = (sectorVal[sec] || 0) + Math.abs(a.pos[s].qty) * w.c[w.bySym[s]][t]; }
    let bp = TM.buyingPower(w, a, t);
    // On a cash account, tonight's market sell orders fill at the open before tomorrow's buys, so their proceeds can be counted.
    // Protective stops (reduce-only) are excluded: they normally do not fill.
    if (!a.margin) for (const o of a.orders) if (o.status === 'open' && o.side === 'sell' && o.source === 'bot' && o.type === 'market' && o.placedT === t) bp += o.qty * w.c[w.bySym[o.sym]][t] * 0.98;
    const minScore = mk.regime === 'Risk-on' ? 0.35 : mk.regime === 'Caution' ? 0.6 : 0.9;
    let stockLong = longValue - coreQty() * fpx;
    let longRoom = Math.max(0, grossTarget * eq - stockLong);
    const skipped = [];
    for (const x of sc.ranked) {
      if (room <= 0) break;
      if (x.score < minScore) break;
      if (a.pos[x.sym] || working(x.sym).length) continue;
      const fail = x.px < x.s50 || x.slope <= 0 ? 'the score is high but the price is not in an uptrend (below or flattening 50-day average), and buying against the trend is avoided'
        : x.daysToE <= 3 && !style.earningsOk ? `earnings are due in ${x.daysToE} trading days; entering just before a ±${pp(x.implied)} event turns a planned trade into a coin toss`
          : x.r5 > 0.08 ? `it is up ${pct(x.r5)} in five days; the bot waits for a pullback rather than chase`
            : (sectorVal[x.sector] || 0) / eq > SECTOR_CAP - 0.05 ? `${x.sector} already takes ${pp((sectorVal[x.sector] || 0) / eq, 0)} of equity (cap ${pp(SECTOR_CAP, 0)})`
              : x.news.some((n) => n.tone < 0) ? 'there was negative company news in the last three days' : null;
      if (fail) { if (skipped.length < 2) skipped.push({ x, fail }); continue; }
      const stopDist = STOP_ATR * x.atr;
      const riskBudget = eq * riskPct * riskScale * (mk.regime === 'Risk-off' ? 0.5 : 1);
      const coreFree = (coreQty() - coreSelling()) * fpx * 0.99;
      let qty = Math.floor(riskBudget / stopDist);
      const caps = [['risk budget', qty], ['position limit', Math.floor(eq * maxPosPct / x.px)], ['2% of daily volume', Math.floor(x.adv * ADV_CAP)],
        ['buying power', Math.floor((bp + (a.margin ? 0 : coreFree)) * 0.97 / x.px)], ['regime exposure room', Math.floor(longRoom / x.px)], ['sector cap', Math.floor(Math.max(0, SECTOR_CAP * eq - (sectorVal[x.sector] || 0)) / x.px)]];
      const binding = caps.reduce((m, c) => (c[1] < m[1] ? c : m));
      qty = binding[1];
      if (qty < 1 || qty * x.px < eq * 0.01) continue;
      const needCash = qty * x.px * 1.01 - bp;
      let funded = '';
      if (needCash > 0 && coreQty()) {
        const sold = sellCore(Math.ceil(needCash / fpx), [`Raising ${money(needCash)} to buy ${x.sym}: a specific opportunity with its own stop beats holding the whole market.`]);
        bp += sold * fpx * 0.99;
        if (sold) funded = ` Funded partly by selling ${sold} TMXI from the index core.`;
      }
      const stop = TM.r2(x.px - stopDist);
      const res = TM.placeOrder(w, a, { sym: x.sym, side: 'buy', qty, type: 'market', source: 'bot', tag: 'Trend following', bracket: { stop } }, t);
      if (!res.ok) continue;
      const riskUsd = qty * stopDist;
      add({
        kind: 'entry', action: 'BUY', sym: x.sym, qty, px: x.px, orderId: res.order.id, riskPct: riskUsd / eq, posPct: qty * x.px / eq,
        title: `BUY ${qty} ${x.sym} (${x.name}, ${x.sector})`,
        why: [`Ranked ${x.rank} of 40 on the combined score (${x.score.toFixed(2)}), in a ${mk.regime} market.`].concat(factorLines(x, w.nStocks), againstLine(x, 1)),
        plan: `Stop ${usd(stop)}, which is ${STOP_ATR} × ATR (${usd(x.atr)}) below today's close. Risk ${money(riskUsd)} = ${pp(riskUsd / eq, 2)} of equity (1R). Size ${qty} shares = ${pp(qty * x.px / eq, 1)} of equity, limited by ${binding[0]}. Move the stop to breakeven at +1R, trail it at +2R, bank a third at +3R, exit early if the trend breaks.${funded}`,
        data: factorData(x)
      });
      sectorVal[x.sector] = (sectorVal[x.sector] || 0) + qty * x.px;
      bp -= qty * x.px; longRoom -= qty * x.px; stockLong += qty * x.px; room--;
    }
    if (!blockNew) for (const s of skipped) {
      const prev = st.passed[s.x.sym];
      if (prev != null && t - prev < 10) continue;
      st.passed[s.x.sym] = t;
      add({ kind: 'skip', action: 'PASS', sym: s.x.sym, px: s.x.px, title: `Considered ${s.x.sym} (rank ${s.x.rank}) but passed`, why: [`Not bought because ${s.fail}.`], data: factorData(s.x).slice(0, 6) });
      break;
    }

    // 4b. keep idle cash invested in the index fund (core) when the market read allows it
    if (!blockNew && mk.regime !== 'Risk-off' && !(a.pos.TMXI && a.pos.TMXI.qty < 0) && !working('TMXI').some((o) => !o.reduceOnly)) {
      const coreVal = coreQty() * fpx;
      const gap = grossTarget * eq - stockLong - coreVal;
      if (gap > 0.15 * eq) {
        const qty = Math.floor(Math.min(gap - 0.05 * eq, Math.max(0, bp) * 0.97) / fpx);
        if (qty * fpx > 0.05 * eq) {
          const res = TM.placeOrder(w, a, { sym: 'TMXI', side: 'buy', qty, type: 'market', source: 'bot', tag: 'Core / index' }, t);
          if (res.ok) add({ kind: 'entry', action: 'CORE', sym: 'TMXI', qty, px: fpx, orderId: res.order.id, riskPct: 0, posPct: qty * fpx / eq, title: `Invest idle cash: buy ${qty} TMXI as an index core`,
            why: [`The market read is ${mk.regime}, which supports about ${pp(grossTarget, 0)} long exposure, but individual stock positions only use ${pp(stockLong / eq, 0)}.`,
              'Rather than sit in cash waiting for set-ups, the gap is held in the index fund (a "core and satellite" approach): the market’s drift is captured while stock ideas are found.',
              'The core is sold first whenever the market read worsens or a strong stock set-up needs the cash.'], data: marketData(mk) });
        }
      }
    }

    // 5. short the weakest stocks on a margin account in a risk-off market
    if (a.margin && mk.regime === 'Risk-off') {
      const shorts = Object.keys(a.pos).filter((s) => s !== 'TMXI' && a.pos[s].qty < 0).length;
      for (const x of sc.ranked.slice().reverse()) {
        if (shorts >= 2 || room <= 0) break;
        if (a.pos[x.sym] || working(x.sym).length || x.score > -0.6) continue;
        if (!(x.px < x.s50 && x.s50 < x.s200) || x.htb || x.daysToE <= 3 || x.r5 < -0.08) continue;
        const stopDist = STOP_ATR * x.atr;
        const qty = Math.min(Math.floor(eq * riskPct * riskScale * 0.5 / stopDist), Math.floor(eq * maxPosPct * 0.5 / x.px), Math.floor(x.adv * ADV_CAP), Math.floor(TM.buyingPower(w, a, t) * 0.9 / x.px));
        if (qty < 1) continue;
        const stop = TM.r2(x.px + stopDist);
        const res = TM.placeOrder(w, a, { sym: x.sym, side: 'sell', qty, type: 'market', source: 'bot', tag: 'Trend following', bracket: { stop } }, t);
        if (!res.ok) continue;
        add({ kind: 'entry', action: 'SHORT', sym: x.sym, qty, px: x.px, orderId: res.order.id, riskPct: qty * stopDist / eq, posPct: qty * x.px / eq, title: `SHORT ${qty} ${x.sym} (${x.name}, ${x.sector})`,
          why: [`Ranked ${x.rank} of 40, one of the weakest stocks, in a Risk-off market: falling price, falling averages, weak momentum.`].concat(factorLines(x, w.nStocks), againstLine(x, -1)).concat([`Borrow cost ${pp(x.borrow, 2)} a year; not hard to borrow.`]),
          plan: `Stop ${usd(stop)}, ${STOP_ATR} × ATR above the close. Half-size because shorts have unlimited upside risk. Risk ${money(qty * stopDist)} = ${pp(qty * stopDist / eq, 2)} of equity.`,
          data: factorData(x) });
        room--;
      }
    }
  }

  Object.assign(TM, { marketTrader, traderReadMarket: readMarket, traderScore: scoreStocks, TRADER_STYLES: STYLES, traderStyleOf: styleOf });
})(TM);
