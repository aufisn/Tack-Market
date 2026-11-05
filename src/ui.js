/* Tack Market V3 · user interface (vanilla JS, no dependencies) */
(function (TM) {
  'use strict';

  // ---------- helpers ----------
  const KEY = 'tackmarket-v3:';
  const store = {
    get(k) { try { const v = localStorage.getItem(KEY + k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(KEY + k); } catch (e) { /* storage unavailable */ } }
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const F = {
    money: (x, dp = 0) => (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }),
    smoney: (x, dp = 0) => (x > 0 ? '+' : '') + F.money(x, dp),
    px: (x) => x == null || !isFinite(x) ? '–' : x.toFixed(2),
    pct: (x, dp = 1) => x == null || !isFinite(x) ? '–' : (x * 100).toFixed(dp) + '%',
    spct: (x, dp = 1) => x == null || !isFinite(x) ? '–' : (x > 0 ? '+' : '') + (x * 100).toFixed(dp) + '%',
    num: (x, dp = 2) => x == null || !isFinite(x) ? '–' : x.toFixed(dp),
    big: (x) => {
      const a = Math.abs(x);
      if (a >= 1e12) return (x / 1e12).toFixed(2) + 'T';
      if (a >= 1e9) return (x / 1e9).toFixed(1) + 'B';
      if (a >= 1e6) return (x / 1e6).toFixed(1) + 'M';
      if (a >= 1e3) return (x / 1e3).toFixed(0) + 'k';
      return x.toFixed(0);
    },
    date: (d) => TM.fmtDate(TM.dateOf(App.world, d)),
    sdate: (d) => TM.fmtDate(TM.dateOf(App.world, d), 'short')
  };
  const cls = (x) => x > 1e-9 ? 'up' : x < -1e-9 ? 'down' : '';
  const SEC_COLOR = { Technology: '#5b8def', Healthcare: '#2bb3a3', Financials: '#8f7cf0', Energy: '#e5793b', Consumer: '#e0609a', Industrials: '#c9a23a', Utilities: '#4fb0d8', Materials: '#9aa35a', Index: '#f2b544' };
  const SETUPS = ['Breakout', 'Pullback in trend', 'Trend following', 'Mean reversion', 'Value', 'Earnings play', 'News reaction', 'Hedge', 'Core / index', 'Other'];
  const SERIES = [
    { id: 'you', label: 'You', v: '--accent' },
    { id: 'index', label: 'Index fund', v: '--s-index' },
    { id: 'equal', label: 'Equal-weight', v: '--s-equal' },
    { id: 'momentum', label: 'Momentum bot', v: '--s-momentum' },
    { id: 'value', label: 'Value bot', v: '--s-value' },
    { id: 'rules', label: 'Rules bot', v: '--s-rules' },
    { id: 'trader', label: 'Market Trader', v: '--s-trader' }
  ];
  const botDefs = (g) => TM.BOT_DEFS.filter((b) => g.bots[b.id]);
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const narrow = () => !!(window.matchMedia && matchMedia('(max-width: 599px)').matches);
  const paned = () => !!(window.matchMedia && matchMedia('(max-width: 1099px)').matches);
  const storageOK = (() => { try { localStorage.setItem(KEY + 'probe', '1'); localStorage.removeItem(KEY + 'probe'); return true; } catch (e) { return false; } })();

  function blankTicket() {
    return { side: 'buy', type: 'market', qty: '', limit: '', stop: '', tif: 'day', bracket: false, sl: '', tp: '', planStop: '', tag: '', note: '', riskPct: '1' };
  }
  function defaultProgress() {
    return { levels: { 1: { passed: false, attempts: 0 }, 2: { passed: false, attempts: 0 }, 3: { passed: false, attempts: 0 } }, daily: {}, history: [], name: 'You', theme: null };
  }
  const App = {
    screen: 'home', world: null, game: null, toastTimer: null, geom: null,
    progress: Object.assign(defaultProgress(), store.get('progress') || {}),
    ui: {
      sel: 'TMXI', tab: 'positions', pane: 'chart', helpQ: '', helpFrom: 'home', helpSec: null, range: 126, sma20: true, sma50: true, showVol: true, sector: 'All', sort: 'sector', hover: null,
      perf: { you: true, index: true, equal: false, momentum: false, value: false, rules: false, trader: true },
      endPerf: { you: true, index: true, equal: true, momentum: true, value: true, rules: true, trader: true },
      trFilter: 'all',
      newsMine: false, editOrder: null, edit: {}, ticket: blankTicket(), banner: null,
      practice: { scenario: 'random', days: 60, capital: 100000, margin: false, costModel: 'retail', seed: '', name: '' }
    }
  };
  TM.App = App;
  const saveProgress = () => store.set('progress', App.progress);
  function saveGame() {
    if (!App.game) return;
    if (!store.set('save', App.game) && !App.saveWarned) { App.saveWarned = true; toast('Could not save to this browser (storage full or blocked). Use Account > Export save.'); }
  }
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(App.toastTimer);
    App.toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3200);
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function applyTheme() {
    const th = App.progress.theme;
    if (th) document.documentElement.setAttribute('data-theme', th); else document.documentElement.removeAttribute('data-theme');
  }

  // ---------- market reads ----------
  const W = () => App.world, G = () => App.game;
  const idx = (sym) => W().bySym[sym];
  function atr(i, t, n) {
    const w = W();
    let s = 0, k = 0;
    for (let d = Math.max(1, t - n + 1); d <= t; d++) {
      s += Math.max(w.h[i][d] - w.l[i][d], Math.abs(w.h[i][d] - w.c[i][d - 1]), Math.abs(w.l[i][d] - w.c[i][d - 1]));
      k++;
    }
    return k ? s / k : 0;
  }
  function beta1y(i, t) {
    const w = W(), F0 = w.FUND, a = Math.max(1, t - 249);
    const x = [], y = [];
    for (let d = a; d <= t; d++) { x.push(w.c[F0][d] / w.c[F0][d - 1] - 1); y.push(w.c[i][d] / w.c[i][d - 1] - 1); }
    const mx = TM.mean(x), my = TM.mean(y);
    let cv = 0, vx = 0;
    for (let k = 0; k < x.length; k++) { cv += (x[k] - mx) * (y[k] - my); vx += (x[k] - mx) ** 2; }
    return vx ? cv / vx : 1;
  }
  function chg(i, t, n) { const w = W(); return t - n >= 0 ? w.c[i][t] / w.c[i][t - n] - 1 : 0; }
  function headlines(t, days, symFilter) {
    const w = W(), out = [];
    for (let d = t; d >= Math.max(1, t - days); d--) {
      if (w.macro[d] && !symFilter) out.push({ d, text: w.macro[d].text, tone: w.macro[d].tone, macro: true });
      for (const e of w.events[d]) if (!symFilter || symFilter.has(e.sym)) out.push({ d, text: e.text, tone: e.tone, sym: e.sym, type: e.type });
    }
    return out;
  }

  // ---------- pre-trade checks ----------
  function preTradeChecks() {
    const w = W(), g = G(), a = g.player, tk = App.ui.ticket, t = g.t;
    const i = idx(App.ui.sel), s = w.inst[i], last = w.c[i][t];
    const items = [], flags = {};
    const add = (lvl, text) => items.push({ lvl, text });
    const rules = a.rules || {};
    const enforce = rules.enforce === 'block' ? 'block' : 'warn';
    const qty = Math.floor(Number(tk.qty));
    const eq = TM.equityAt(w, a, t);
    const held = a.pos[s.sym] ? a.pos[s.sym].qty : 0;
    const eff = TM.orderEffect(a, s.sym, tk.side, qty > 0 ? qty : 0);
    const opening = eff.opening;
    const lim = Number(tk.limit), stp = Number(tk.stop);
    const ref = tk.type === 'market' ? last : tk.type === 'limit' ? (lim > 0 ? lim : last) : (stp > 0 ? stp : last);
    const taker = tk.type !== 'limit' || (tk.side === 'buy' ? lim >= last : lim <= last);
    const est = qty > 0 ? TM.estimateCosts(w, a, i, t + 1, qty, ref, taker) : null;
    const stop = tk.bracket ? Number(tk.sl) : Number(tk.planStop);
    const target = tk.bracket ? Number(tk.tp) : 0;
    let risk = null;
    if (g.status !== 'active') add('block', 'This session has ended.');
    if (!(qty > 0)) add('block', 'Enter a quantity.');
    if ((tk.type === 'limit' || tk.type === 'stoplimit') && !(lim > 0)) add('block', 'Enter a limit price.');
    if ((tk.type === 'stop' || tk.type === 'stoplimit') && !(stp > 0)) add('block', 'Enter a stop price.');
    if (!a.margin && tk.side === 'sell' && held > 0 && qty > eff.room && qty <= held) add('block', `Only ${eff.room} of your ${held} shares are free: ${eff.committed} are already committed to queued sell orders. Edit or cancel those first.`);
    if (a.margin && qty > 0 && eff.closable > 0 && eff.excess > 0) add('warn', `Only ${eff.room} of your ${eff.closable} shares are free (${eff.committed} committed to queued orders). The other ${eff.excess} would open a ${tk.side === 'sell' ? 'short' : 'long'} position.`);
    if (!a.margin && tk.side === 'sell' && qty > Math.max(0, held)) add('block', held > 0 ? `You hold ${held}. A cash account cannot go short.` : 'A cash account cannot sell short. Choose a margin account in Practice settings to short.');
    if (opening && a.lockoutT === t) add('block', 'Cool-off after hitting your daily loss limit: no new positions until tomorrow.');
    if (qty > 0) {
      const notional = qty * ref;
      if (opening) {
        const bp = TM.buyingPower(w, a, t);
        const need = notional + (est ? est.total : 0);
        if (need > bp * 1.0001) add('block', `Needs ${F.money(need)} including estimated costs, but buying power is ${F.money(bp)}${a.margin ? ' (50% initial margin)' : ''}.`);
        const newQty = held + (tk.side === 'buy' ? qty : -qty);
        const posW = Math.abs(newQty) * ref / eq;
        if (rules.maxPosPct && posW > rules.maxPosPct / 100) add(enforce, `Position would be ${F.pct(posW, 0)} of equity (your limit is ${rules.maxPosPct}%).`);
        if (stop > 0) {
          if (tk.side === 'buy' ? stop >= ref : stop <= ref) add('block', `Your stop must be ${tk.side === 'buy' ? 'below' : 'above'} the entry price.`);
          else {
            risk = qty * Math.abs(ref - stop);
            if (rules.maxRiskPct && risk / eq > rules.maxRiskPct / 100) add(enforce, `Risk ${F.money(risk)} is ${F.pct(risk / eq, 2)} of equity, above your ${rules.maxRiskPct}% per-trade limit.`);
          }
        } else if (rules.requireStop) add(enforce, 'No planned stop. Decide where you are wrong before you enter.');
        else add('info', 'No planned stop, so this trade cannot be measured in R.');
        if (target > 0 && (tk.side === 'buy' ? target <= ref : target >= ref)) add('block', `Your target must be ${tk.side === 'buy' ? 'above' : 'below'} the entry price.`);
        if (rules.requireJournal && !tk.tag) add(enforce, 'Pick a setup in the journal section.');
        if (tk.side === 'buy' && t >= 5) {
          const r5 = chg(i, t, 5);
          if (r5 > 0.08) { flags.chase = true; add('info', `Up ${F.pct(r5)} in 5 days. Is this a plan or fear of missing out?`); }
        }
        if (held > 0 && tk.side === 'buy' && last < a.pos[s.sym].avg * 0.97) { flags.avgDown = true; add('warn', 'Averaging down: adding to a losing position.'); }
        if (held < 0 && tk.side === 'sell' && last > a.pos[s.sym].avg * 1.03) { flags.avgDown = true; add('warn', 'Adding to a losing short.'); }
        if (!s.isFund) {
          const ne = TM.nextEarnings(w, i, t);
          if (ne != null && ne - t <= 7) add('warn', `Earnings ${ne - t === 1 ? 'at tomorrow’s open' : 'in ' + (ne - t) + ' trading days'} (${F.sdate(ne)}). Implied move ±${F.pct(s.earnSd * 0.75)}.`);
        }
        if (tk.side === 'sell') {
          const xd = TM.nextExDiv(w, i, t);
          if (xd && xd.d - t <= 10) add('info', `Ex-dividend on ${F.sdate(xd.d)}: shorts pay the $${xd.amt.toFixed(2)} dividend.`);
          if (s.hardToBorrow) add('warn', `Hard to borrow: shorting costs ${F.pct(s.borrowFee)} a year.`);
        }
      }
      const adv = w.adv20[i][Math.min(t + 1, w.T - 1)];
      if (qty > adv * 0.05) add('warn', `Order is ${F.pct(qty / adv)} of average daily volume: expect heavy market impact.`);
      if (tk.type === 'limit' && lim > 0 && (tk.side === 'buy' ? lim >= last : lim <= last)) add('info', 'Limit is through the current price, so it will probably fill at the open like a market order.');
      if ((tk.type === 'stop' || tk.type === 'stoplimit') && stp > 0 && (tk.side === 'buy' ? stp <= last : stp >= last)) add('warn', 'Stop is already through the current price: it will trigger at the open.');
    }
    return { items, blocking: items.some((x) => x.lvl === 'block'), est, ref, qty, opening, flags, eq, risk, stop, target };
  }

  // ---------- actions ----------
  function startGame(cfg) {
    if (App.game && App.game.status === 'active' && !confirm('This replaces your current unfinished session. Continue?')) return;
    const { game, world } = TM.createGame(Object.assign({ name: App.progress.name }, cfg));
    App.game = game; App.world = world;
    App.ui.sel = 'TMXI'; App.ui.ticket = blankTicket(); App.ui.tab = 'positions'; App.ui.banner = null; App.ui.editOrder = null;
    if (game.mode === 'level') App.progress.levels[game.level].attempts++;
    if (game.mode === 'daily' && App.progress.daily[game.daily]) game.unranked = true;
    saveProgress(); saveGame();
    App.screen = 'game';
    App.ui.banner = { intro: true };
    render();
    window.scrollTo(0, 0);
  }
  // A refresh returns to where the player was: the board of a running session, or the home screen.
  // A finished session never reopens on its own; its debrief is one tap away on the home screen.
  function loadSaved() {
    const g = store.get('save');
    if (!g || g.v !== 3) return false;
    try { App.world = TM.worldFor(g); App.game = g; } catch (e) { return false; }
    App.screen = g.status === 'active' && (App.progress.lastScreen || 'game') === 'game' ? 'game' : 'home';
    return true;
  }
  function onSessionEnd() {
    const g = G(), w = W(), m = TM.metrics(w, g.player);
    App.progress.history.unshift({ when: Date.now(), label: TM.sessionLabel(g), status: g.result.status, total: m.total, bench: m.benchTotal, sharpe: m.sharpe, maxDD: m.maxDD, unranked: g.unranked });
    App.progress.history = App.progress.history.slice(0, 25);
    if (g.mode === 'level' && g.result.status === 'passed' && !g.unranked) App.progress.levels[g.level].passed = true;
    if (g.mode === 'daily' && !g.unranked && !App.progress.daily[g.daily]) App.progress.daily[g.daily] = { total: m.total, excess: m.excess, sharpe: m.sharpe, maxDD: m.maxDD };
    saveProgress();
    App.screen = 'end';
  }
  function nextDays(n) {
    const g = G(), w = W();
    if (!g || g.status !== 'active') return;
    const agg = { fills: [], alerts: [], rejects: [], marginCall: null, dayPnl: 0, divs: 0, interest: 0, borrow: 0, startT: g.t };
    for (let k = 0; k < n && g.status === 'active'; k++) {
      const s = TM.advanceDay(w, g);
      agg.fills = agg.fills.concat(s.fills);
      agg.alerts = agg.alerts.concat(s.alerts || []);
      agg.rejects = agg.rejects.concat(s.rejects);
      agg.dayPnl += s.dayPnl; agg.divs += s.divs; agg.interest += s.interest; agg.borrow += s.borrow;
      if (s.marginCall) agg.marginCall = s.marginCall;
    }
    agg.endT = g.t;
    App.ui.banner = agg;
    App.ui.hover = null;
    App.ui.editOrder = null;
    if (g.status !== 'active') onSessionEnd();
    saveGame();
    render();
    if (paned()) window.scrollTo(0, 0);
  }
  function setBind(path, el) {
    const [root, key] = path.split('.');
    let val = el.type === 'checkbox' ? el.checked : el.value;
    const numeric = el.dataset.num === '1';
    if (numeric) val = val === '' ? null : Number(val);
    if (root === 'ticket') App.ui.ticket[key] = val;
    else if (root === 'edit') App.ui.edit[key] = val;
    else if (root === 'practice') App.ui.practice[key] = val;
    else if (root === 'ui') App.ui[key] = val;
    else if (root === 'botCfg' && G()) { G().botCfg[key] = Math.max(0, Number(val) || 0); saveGame(); }
    else if (root === 'rules' && G()) { G().player.rules[key] = el.type === 'checkbox' ? val : numeric ? (val == null ? 0 : val) : val; saveGame(); }
    else if (root === 'lesson' && G()) { const tr = G().player.trades.find((x) => x.id === Number(key)); if (tr) { tr.lesson = val; saveGame(); } }
    else if (root === 'name') { App.progress.name = String(val).slice(0, 24); saveProgress(); }
  }

  const ACTIONS = {
    home() {
      const wasActive = App.screen === 'game' && App.game && App.game.status === 'active';
      App.screen = 'home'; render(); window.scrollTo(0, 0);
      if (wasActive) toast('Your session is still running. Tap Continue session to return.');
    },
    endFromHome() {
      if (!App.game || App.game.status !== 'active') return;
      if (!confirm(App.game.mode === 'level' ? 'End this level attempt now? It will count as a fail.' : 'End this session now and see the debrief?')) return;
      TM.endEarly(W(), G()); onSessionEnd(); saveGame(); render(); window.scrollTo(0, 0);
    },
    theme() { const cur = App.progress.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); App.progress.theme = cur === 'dark' ? 'light' : 'dark'; saveProgress(); applyTheme(); render(); },
    resume() { if (App.game) { App.screen = App.game.status === 'active' ? 'game' : 'end'; render(); } },
    practice() { const p = App.ui.practice; startGame({ mode: 'practice', scenario: p.scenario, days: Number(p.days), capital: Number(p.capital), margin: p.margin === true || p.margin === 'true', costModel: p.costModel, seed: p.seed }); },
    level(arg) { startGame({ mode: 'level', level: Number(arg) }); },
    daily() { startGame({ mode: 'daily' }); },
    next() { nextDays(1); },
    next5() { nextDays(5); },
    closeBanner() { App.ui.banner = null; render(); },
    sel(sym) {
      App.ui.sel = sym; App.ui.hover = null;
      const tk = App.ui.ticket; tk.limit = tk.stop = tk.sl = tk.tp = tk.planStop = '';
      if (paned() && App.ui.pane !== 'ticket') { App.ui.pane = 'chart'; render(); window.scrollTo(0, 0); return; }
      render();
    },
    pane(arg) { App.ui.pane = arg; render(); window.scrollTo(0, 0); },
    sector(arg) { App.ui.sector = arg; render(); },
    range(arg) { App.ui.range = Number(arg); render(); },
    toggle(arg) { App.ui[arg] = !App.ui[arg]; render(); },
    tab(arg) { App.ui.tab = arg; App.ui.editOrder = null; render(); },
    side(arg) { App.ui.ticket.side = arg; render(); },
    otype(arg) { App.ui.ticket.type = arg; render(); },
    tif(arg) { App.ui.ticket.tif = arg; render(); },
    perf(arg) { App.ui.perf[arg] = !App.ui.perf[arg]; render(); },
    endPerf(arg) { App.ui.endPerf[arg] = !App.ui.endPerf[arg]; drawLines('endChart', App.ui.endPerf); document.querySelectorAll('[data-act="endPerf"]').forEach((b) => b.classList.toggle('on', !!App.ui.endPerf[b.dataset.arg])); },
    newsMine() { App.ui.newsMine = !App.ui.newsMine; render(); },
    maxQty() {
      const w = W(), g = G(), i = idx(App.ui.sel), tk = App.ui.ticket, t = g.t;
      const eff = TM.orderEffect(g.player, App.ui.sel, tk.side, 0);
      if (eff.closable > 0) tk.qty = String(eff.room);
      else tk.qty = String(Math.max(0, Math.floor(TM.buyingPower(w, g.player, t) * 0.98 / w.c[i][t])));
      render();
    },
    suggestStop() {
      const w = W(), g = G(), i = idx(App.ui.sel), tk = App.ui.ticket, last = w.c[i][g.t];
      const a2 = atr(i, g.t, 14) * 2;
      const v = TM.r2(tk.side === 'buy' ? last - a2 : last + a2).toFixed(2);
      if (tk.bracket) tk.sl = v; else tk.planStop = v;
      render();
    },
    suggestTarget() {
      const pc = preTradeChecks(), tk = App.ui.ticket;
      if (!(pc.stop > 0)) { toast('Set the stop first; the target is placed at 2R.'); return; }
      tk.tp = TM.r2(pc.ref + (pc.ref - pc.stop) * 2).toFixed(2);
      render();
    },
    sizeIt() {
      const w = W(), g = G(), a = g.player, tk = App.ui.ticket, pc = preTradeChecks();
      if (!(pc.stop > 0) || pc.stop === pc.ref) { toast('Set a stop first (bracket stop or planned stop). Position size comes from the distance to the stop.'); return; }
      const riskPct = Math.max(0.05, Number(tk.riskPct) || 1) / 100;
      let q = Math.floor(pc.eq * riskPct / Math.abs(pc.ref - pc.stop));
      const maxPos = a.rules && a.rules.maxPosPct ? Math.floor(pc.eq * a.rules.maxPosPct / 100 / pc.ref) : Infinity;
      const bp = Math.floor(TM.buyingPower(w, a, g.t) * 0.98 / pc.ref);
      const capped = Math.min(q, maxPos, bp);
      tk.qty = String(Math.max(0, capped));
      if (capped < q) toast(`Sized down from ${q} to ${capped} shares by your position limit or buying power.`);
      render();
    },
    submit() {
      const w = W(), g = G(), tk = App.ui.ticket, pc = preTradeChecks();
      if (pc.blocking) { toast(pc.items.find((x) => x.lvl === 'block').text); return; }
      const spec = {
        sym: App.ui.sel, side: tk.side, qty: pc.qty, type: tk.type, limit: tk.limit, stop: tk.stop, tif: tk.tif,
        bracket: pc.opening && tk.bracket && (tk.sl || tk.tp) ? { stop: tk.sl || null, target: tk.tp || null } : null,
        plannedStop: !pc.opening || tk.bracket ? null : tk.planStop || null, tag: tk.tag, note: tk.note, flags: pc.flags
      };
      const res = TM.placeOrder(w, g.player, spec, g.t);
      if (!res.ok) { toast(res.errors[0]); return; }
      const o = res.order;
      toast(`Queued #${o.id}: ${o.side.toUpperCase()} ${o.qty} ${o.sym} ${typeLabel(o)}${res.children.length ? ' with bracket' : ''}. It works from tomorrow's open.`);
      App.ui.ticket = Object.assign(blankTicket(), { side: tk.side, type: tk.type, tif: tk.tif, bracket: tk.bracket, riskPct: tk.riskPct });
      saveGame(); render();
    },
    cancel(arg) { if (TM.cancelOrder(G().player, Number(arg), 'Cancelled by you')) { toast('Order cancelled.'); saveGame(); render(); } },
    edit(arg) {
      const o = G().player.orders.find((x) => x.id === Number(arg));
      App.ui.editOrder = o.id;
      App.ui.edit = { qty: String(o.qty), limit: o.limit != null ? String(o.limit) : '', stop: o.stop != null ? String(o.stop) : '' };
      render();
    },
    editSave(arg) {
      const e = App.ui.edit;
      const res = TM.modifyOrder(W(), G().player, Number(arg), { qty: e.qty, limit: e.limit === '' ? null : e.limit, stop: e.stop === '' ? null : e.stop }, G().t);
      if (!res.ok) { toast(res.errors[0]); return; }
      App.ui.editOrder = null; saveGame(); render();
    },
    editCancel() { App.ui.editOrder = null; render(); },
    closePos(sym) {
      const g = G(), p = g.player.pos[sym];
      if (!p) return;
      for (const o of g.player.orders) if (o.sym === sym && o.reduceOnly && (o.status === 'open' || o.status === 'pending')) TM.cancelOrder(g.player, o.id, 'Replaced by close order');
      const res = TM.placeOrder(W(), g.player, { sym, side: p.qty > 0 ? 'sell' : 'buy', qty: Math.abs(p.qty), type: 'market', tif: 'day' }, g.t);
      if (res.ok) toast(`Close order queued for ${sym}: executes at tomorrow's open.`); else toast(res.errors[0]);
      saveGame(); render();
    },
    protect(sym) {
      const g = G(), p = g.player.pos[sym], i = idx(sym);
      App.ui.sel = sym;
      const a2 = atr(i, g.t, 14) * 2, last = W().c[i][g.t];
      App.ui.ticket = Object.assign(blankTicket(), { side: p.qty > 0 ? 'sell' : 'buy', type: 'stop', tif: 'gtc', qty: String(Math.abs(p.qty)), stop: TM.r2(p.qty > 0 ? last - a2 : last + a2).toFixed(2), tag: 'Hedge' });
      toast('Ticket prefilled with a protective GTC stop 2 ATR away. Adjust and queue it.');
      if (paned()) App.ui.pane = 'ticket';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    closeSession() { App.screen = 'home'; App.ui.banner = null; render(); window.scrollTo(0, 0); },
    endSession() {
      if (!confirm(G().mode === 'level' ? 'Exit this level attempt now? It will count as a fail. You will see the debrief, then can close it.' : 'Exit this session now? You will see the debrief, then can close it to return to the home screen.')) return;
      TM.endEarly(W(), G()); onSessionEnd(); saveGame(); render();
    },
    viewBoard() { App.screen = 'game'; App.ui.banner = null; render(); },
    exportSave() { download(`tackmarket-save-${G().seed}.json`, JSON.stringify(G())); },
    exportCsv() {
      const w = W(), g = G();
      const rows = [['trade', 'symbol', 'direction', 'opened', 'closed', 'days', 'avg_entry', 'max_qty', 'net_pnl', 'return_pct', 'r_multiple', 'planned_stop', 'setup', 'exit', 'thesis', 'lesson']];
      for (const t of g.player.trades) rows.push([t.id, t.sym, t.dir > 0 ? 'long' : 'short', F.date(t.openDay), F.date(t.closeDay), t.closeDay - t.openDay, t.entryPx.toFixed(2), t.qtyMax, t.net.toFixed(2), (t.retPct * 100).toFixed(2), t.r == null ? '' : t.r.toFixed(2), t.plannedStop || '', t.tag, t.exitReason, t.note, t.lesson]);
      download(`tackmarket-trades-${g.seed}.csv`, rows.map((r) => r.map((x) => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    },
    importSave() { document.getElementById('importFile').click(); },
    clearHistory() { if (confirm('Clear your session history and level progress?')) { App.progress = Object.assign(defaultProgress(), { name: App.progress.name, theme: App.progress.theme }); saveProgress(); render(); } }
  };
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const g = JSON.parse(reader.result);
        if (!g || g.v !== 3 || !g.player || g.seed == null || !TM.SCENARIOS[g.scenario]) throw new Error('bad');
        g.unranked = true;
        App.world = TM.worldFor(g); App.game = g;
        App.screen = g.status === 'active' ? 'game' : 'end';
        saveGame(); render();
        toast('Save imported. Imported sessions are unranked.');
      } catch (e) { toast('That file is not a Tack Market V3 save.'); }
    };
    reader.readAsText(file);
  }
  const typeLabel = (o) => o.type === 'market' ? 'at market' : o.type === 'limit' ? `limit $${F.px(o.limit)}` : o.type === 'stop' ? `stop $${F.px(o.stop)}` : `stop $${F.px(o.stop)} / limit $${F.px(o.limit)}`;

  // ---------- views: home ----------
  function viewHome() {
    const p = App.ui.practice, pr = App.progress;
    const saved = App.game || store.get('save');
    const active = saved && saved.status === 'active';
    const sc = TM.SCENARIOS[p.scenario];
    const today = TM.todayKey(), dailyDone = pr.daily[today];
    const levels = TM.LEVELS.map((lv) => {
      const st = pr.levels[lv.id] || {};
      const unlocked = lv.id === 1 || (pr.levels[lv.id - 1] && pr.levels[lv.id - 1].passed);
      return `<div class="level ${unlocked ? '' : 'locked'}">
        <div class="row"><b class="grow">Level ${lv.id} · ${esc(lv.name)}</b>${st.passed ? '<span class="badge pass">PASSED</span>' : unlocked ? '' : '<span class="badge lock">LOCKED</span>'}</div>
        <div class="small muted" style="margin-top:4px">${esc(lv.pitch)}</div>
        <ul>${lv.goals.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="row"><span class="tiny faint grow">${lv.days} days · ${F.money(lv.capital)} · ${lv.margin ? 'margin' : 'cash'} account · market type hidden${st.attempts ? ` · ${st.attempts} attempt${st.attempts > 1 ? 's' : ''}` : ''}</span>
        <button class="btn sm ${unlocked ? 'primary' : ''}" data-act="level" data-arg="${lv.id}" ${unlocked ? '' : 'disabled'}>Start</button></div>
      </div>`;
    }).join('');
    const hist = pr.history.length ? `<div class="tablewrap"><table><thead><tr><th>Session</th><th>Result</th><th class="num">You</th><th class="num">Index</th><th class="num">Sharpe</th><th class="num">Max DD</th></tr></thead><tbody>
      ${pr.history.map((h) => `<tr><td>${esc(h.label)}${h.unranked ? ' <span class="tiny faint">(unranked)</span>' : ''}<div class="tiny faint">${new Date(h.when).toLocaleDateString()}</div></td>
      <td>${h.status === 'passed' ? '<span class="badge pass">PASSED</span>' : h.status === 'failed' ? '<span class="badge fail">FAILED</span>' : '<span class="tiny muted">complete</span>'}</td>
      <td class="num ${cls(h.total)}">${F.spct(h.total)}</td><td class="num ${cls(h.bench)}">${F.spct(h.bench)}</td><td class="num">${F.num(h.sharpe)}</td><td class="num down">${F.pct(h.maxDD)}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No finished sessions yet.</div>';
    return `<div class="home">
      <div class="hero"><div><h1>TACK MARKET <small>V3</small></h1>
        <p>A trading simulator with realistic, fictional markets. Real-world frictions, risk rules and an honest debrief, so you can make your mistakes here instead of with real money.</p></div>
        <div class="row"><label class="small muted">Your name <input type="text" maxlength="24" value="${esc(pr.name)}" data-bind="name.x" style="width:140px;margin-left:6px"></label><button class="btn sm" data-act="help" data-arg="start">? Help guide</button><button class="btn ghost sm" data-act="theme" title="Toggle light/dark">◐ Theme</button></div></div>
      ${active ? `<div class="panel pad continue resume"><div><div class="label" style="color:var(--accent)">Session in progress</div><b style="font-size:16px">${esc(TM.sessionLabel(saved))}</b><div class="small muted">Day ${saved.t - 250} of ${saved.days} · equity ${F.money(saved.player.equity[saved.player.equity.length - 1].eq)}</div></div>
        <div class="row"><button class="btn sell" data-act="endFromHome">End now</button><button class="btn primary" data-act="resume">Continue session ▸</button></div></div>` : ''}
      ${saved && !active ? `<div class="panel pad continue"><div><div class="label">Last session finished</div><b>${esc(TM.sessionLabel(saved))}</b><div class="small muted">${saved.result && saved.result.status === 'passed' ? 'Passed · ' : saved.result && saved.result.status === 'failed' ? 'Failed · ' : ''}final equity ${F.money(saved.player.equity[saved.player.equity.length - 1].eq)}</div></div><button class="btn" data-act="resume">View debrief</button></div>` : ''}
      ${storageOK ? '' : '<div class="panel pad continue" style="border-color:var(--down)"><div><b>This browser is blocking storage</b><div class="small muted">Progress will not be kept between visits. Open the file in Chrome or Samsung Internet directly, or use Account &gt; Export save before closing.</div></div></div>'}
      <div class="cards">
        <section class="panel pad card"><h3>Practice ${q('practice', 'practice settings')}</h3><div class="sub">Pick the market type and account, then trade freely. Rules warn but don't block.</div>
          <label class="f"><span>Market scenario</span><select data-bind="practice.scenario" data-rerender="1">${Object.entries(TM.SCENARIOS).map(([k, v]) => `<option value="${k}" ${p.scenario === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
          <div class="tiny faint" style="margin-top:4px">${esc(sc.blurb)}</div>
          <div class="split"><label class="f"><span>Session length</span><select data-bind="practice.days">${[30, 60, 120, 250].map((d) => `<option value="${d}" ${Number(p.days) === d ? 'selected' : ''}>${d} trading days</option>`).join('')}</select></label>
          <label class="f"><span>Starting capital</span><select data-bind="practice.capital">${[10000, 100000, 1000000].map((d) => `<option value="${d}" ${Number(p.capital) === d ? 'selected' : ''}>${F.money(d)}</option>`).join('')}</select></label></div>
          <div class="split"><label class="f"><span>Account</span><select data-bind="practice.margin"><option value="false" ${String(p.margin) === 'false' ? 'selected' : ''}>Cash (no shorting)</option><option value="true" ${String(p.margin) === 'true' ? 'selected' : ''}>Margin (2x, shorting)</option></select></label>
          <label class="f"><span>Trading costs</span><select data-bind="practice.costModel">${Object.entries(TM.COST_MODELS).map(([k, v]) => `<option value="${k}" ${p.costModel === k ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label></div>
          <label class="f"><span>Seed (optional: replay an exact market)</span><input type="text" inputmode="numeric" placeholder="random" value="${esc(p.seed)}" data-bind="practice.seed"></label>
          <button class="btn primary" style="width:100%;margin-top:12px" data-act="practice">Start practice</button>
        </section>
        <section class="panel pad card"><h3>Career ${q('career', 'career levels')}</h3><div class="sub">Three graded evaluations. Pass one to unlock the next. Each attempt is a new, unknown market.</div>${levels}</section>
        <section class="panel pad card"><h3>Daily challenge ${q('career', 'daily challenge')}</h3><div class="sub">Everyone gets the same 60-day market today (${today}): margin account, retail costs, market type hidden. Your first finished attempt is ranked.</div>
          ${dailyDone ? `<div class="metrics" style="margin-bottom:10px"><div class="metric"><b class="${cls(dailyDone.total)}">${F.spct(dailyDone.total)}</b><span>your return</span></div><div class="metric"><b class="${cls(dailyDone.excess)}">${F.spct(dailyDone.excess)}</b><span>vs index</span></div></div>` : ''}
          <button class="btn ${dailyDone ? '' : 'primary'}" style="width:100%" data-act="daily">${dailyDone ? 'Play again (unranked)' : 'Start today’s challenge'}</button>
          <div class="section"><h3>Saves</h3><div class="row"><button class="btn sm" data-act="importSave">Import save file</button><input type="file" id="importFile" accept=".json,application/json" hidden></div>
          <div class="tiny faint" style="margin-top:6px">Your game saves automatically in this browser after every day.</div></div>
        </section>
      </div>
      <section class="panel pad section"><div class="row" style="margin-bottom:8px"><h3 class="grow">Recent sessions</h3>${pr.history.length ? '<button class="btn sm ghost" data-act="clearHistory">Reset progress</button>' : ''}</div>${hist}</section>
      <div class="footer">All companies, prices, news and dates are fictional and generated on your device. No real market data is used and nothing is sent anywhere.</div>
    </div>`;
  }

  // ---------- views: game ----------
  function viewTop() {
    const w = W(), g = G(), t = g.t, a = g.player;
    const m = TM.metrics(w, a);
    const eq = a.equity[a.equity.length - 1].eq, prev = a.equity.length > 1 ? a.equity[a.equity.length - 2].eq : a.startCash;
    const tmxCh = w.tmx[t] / w.tmx[t - 1] - 1;
    const active = g.status === 'active';
    return `<header class="topbar">
      <div class="brand" data-act="home" title="Home">TACK<small>V3</small></div>
      <div class="stat"><b>${F.date(t)}</b><span>Day ${t - w.start} of ${g.days} · ${active ? 'after the close' : 'session ended'}</span></div>
      <div class="stat hide-md hide-sm"><b>${esc(TM.sessionLabel(g))}</b><span>${g.margin ? 'margin' : 'cash'} account${g.hidden ? ' · market type hidden' : ''}</span></div>
      <div class="stat hide-md"><b>${w.tmx[t].toFixed(1)} <span class="${cls(tmxCh)}">${F.spct(tmxCh, 2)}</span></b><span>TMX index</span></div>
      <div class="spacer"></div>
      <div class="stat"><b>${F.money(eq)}</b><span>Equity</span></div>
      <div class="stat"><b class="${cls(eq - prev)}">${F.smoney(eq - prev)}</b><span>Day P&amp;L</span></div>
      <div class="stat"><b class="${cls(m.total)}">${F.spct(m.total)}</b><span>vs index <span class="${cls(m.excess)}">${F.spct(m.excess)}</span></span></div>
      <div class="stat hide-md"><b class="${m.currentDD < -0.001 ? 'down' : ''}">${F.pct(m.currentDD)}</b><span>Drawdown</span></div>
      <div class="row act-btns">${active ? `<button class="btn primary" data-act="next" title="Shortcut: N">Next day ▸</button><button class="btn blue" data-act="next5">+5 days</button>` : `<button class="btn primary" data-act="resume">View debrief</button>`}</div>
      ${active ? '<button class="btn sm exitbtn" data-act="endSession" title="Abort this session now and see the debrief">✕ Exit</button>' : '<button class="btn sm" data-act="closeSession" title="Close and return to the home screen">✕ Close</button>'}
      <button class="btn ghost sm qbtn" data-act="help" data-arg="start" title="Help guide" aria-label="Help guide">?</button>
      <button class="btn ghost sm" data-act="theme" title="Toggle light/dark">◐</button>
    </header>`;
  }
  const q = (sec, label) => `<button class="qbtn" data-act="help" data-arg="${sec}" title="Help: ${label || 'explain this'}" aria-label="Help: ${label || 'explain this'}">?</button>`;
  function viewBanner() {
    const b = App.ui.banner, w = W(), g = G();
    if (!b) return '';
    if (b.intro) {
      return `<div class="banner"><div><b>Welcome to ${esc(TM.sessionLabel(g))}.</b> It is after the close on ${F.date(g.t)}. You have a year of price history.
        Queue orders in the ticket, then press <b>Next day</b>: market orders fill at the next open (overnight gaps included), limits and stops fill when the day's price path reaches them.
        Every bot trades the same market with the same costs. ${g.mode === 'level' ? `<br><b>Goals:</b> ${TM.LEVELS.find((l) => l.id === g.level).goals.map(esc).join(' · ')}` : ''}</div>
        <button class="btn sm ghost x" data-act="closeBanner" aria-label="Dismiss">✕</button></div>`;
    }
    const held = new Set(Object.keys(g.player.pos).concat(b.fills.map((f) => f.sym)));
    const news = [];
    for (let d = b.startT + 1; d <= b.endT; d++) {
      if (w.macro[d]) news.push({ d, text: w.macro[d].text, tone: w.macro[d].tone });
      for (const e of w.events[d]) if (held.has(e.sym) || e.sym === App.ui.sel) news.push({ d, text: e.text, tone: e.tone });
    }
    const n = b.endT - b.startT;
    const tmx = w.tmx[b.endT] / w.tmx[b.startT] - 1;
    const bad = b.alerts.some((x) => x.tone === 'bad') || b.marginCall;
    return `<div class="banner ${bad ? 'alert-bad' : ''}"><div class="grow">
      <b>${n > 1 ? `${n} days to ${F.date(b.endT)}` : F.date(b.endT)}</b> · TMX <span class="${cls(tmx)}">${F.spct(tmx, 2)}</span> · You <span class="${cls(b.dayPnl)}">${F.smoney(b.dayPnl)}</span>${b.divs ? ` · dividends ${F.smoney(b.divs, 2)}` : ''}${Math.abs(b.interest) >= 0.005 ? ` · <span title="${b.interest >= 0 ? 'Interest earned on uninvested cash' : 'Interest paid on your margin loan'}">${b.interest >= 0 ? 'cash interest' : 'margin interest'} ${F.smoney(b.interest, 2)}</span>` : ''}${b.borrow ? ` · borrow fees ${F.smoney(-b.borrow, 2)}` : ''}
      ${b.alerts.length || b.marginCall ? `<ul>${b.alerts.map((x) => `<li class="down">${esc(x.text)}</li>`).join('')}${b.marginCall ? `<li class="down">Margin call: the broker sold ${esc(b.marginCall.join(', '))} at the close.</li>` : ''}</ul>` : ''}
      ${b.fills.length ? `<ul>${b.fills.slice(0, 6).map((f) => `<li>${f.role === 'stop' ? 'Stop hit' : f.role === 'target' ? 'Target hit' : f.source === 'margin' ? 'Forced sale' : 'Filled'}: ${f.side.toUpperCase()} ${f.qty} ${f.sym} @ $${F.px(f.px)}${f.gapped ? ' <span class="down">(gapped through stop)</span>' : ''}</li>`).join('')}${b.fills.length > 6 ? `<li class="faint">+${b.fills.length - 6} more in Activity</li>` : ''}</ul>` : ''}
      ${b.rejects.length ? `<ul>${b.rejects.map((o) => `<li class="down">Rejected: ${o.side.toUpperCase()} ${o.qty} ${o.sym}: ${esc(o.reason)}</li>`).join('')}</ul>` : ''}
      ${news.length ? `<ul>${news.slice(-5).map((x) => `<li class="${x.tone > 0 ? 'up' : x.tone < 0 ? 'down' : ''}">${esc(x.text)}</li>`).join('')}</ul>` : ''}
    </div><button class="btn sm ghost x" data-act="closeBanner" aria-label="Dismiss">✕</button></div>`;
  }
  function viewWatch() {
    const w = W(), g = G(), t = g.t, a = g.player;
    const rows = [];
    for (let i = 0; i < w.N; i++) {
      const s = w.inst[i];
      if (App.ui.sector !== 'All' && s.sector !== App.ui.sector && !s.isFund) continue;
      const ne = s.isFund ? null : TM.nextEarnings(w, i, t), xd = TM.nextExDiv(w, i, t);
      rows.push({ s, i, last: w.c[i][t], ch: chg(i, t, 1), vr: w.v[i][t] / w.adv20[i][t], up: w.tgt[i][t] / w.c[i][t] - 1, earn: ne != null && ne - t <= 5, div: xd && xd.d - t <= 5,
        news: w.events[t].some((e) => e.sym === s.sym), pos: a.pos[s.sym] ? a.pos[s.sym].qty : 0 });
    }
    const sort = App.ui.sort;
    const fund = rows.filter((r) => r.s.isFund), rest = rows.filter((r) => !r.s.isFund);
    if (sort === 'change') rest.sort((x, y) => y.ch - x.ch);
    else if (sort === 'volume') rest.sort((x, y) => y.vr - x.vr);
    else if (sort === 'upside') rest.sort((x, y) => y.up - x.up);
    else if (sort === 'name') rest.sort((x, y) => x.s.sym.localeCompare(y.s.sym));
    const list = fund.concat(rest).map((r) => `<div class="wrow ${App.ui.sel === r.s.sym ? 'on' : ''}" data-act="sel" data-arg="${r.s.sym}" role="button" tabindex="0">
      <span class="dot" style="background:${SEC_COLOR[r.s.sector]}"></span>
      <div><span class="sym">${r.s.sym}</span><span class="flags">${r.pos ? `<span class="tag ${r.pos > 0 ? 'l' : 's'}">${r.pos > 0 ? 'L' : 'S'}</span>` : ''}${r.earn ? '<span class="tag e" title="Earnings within 5 days">E</span>' : ''}${r.div ? '<span class="tag d" title="Ex-dividend within 5 days">D</span>' : ''}${r.news ? '<span class="tag" title="News today">N</span>' : ''}</span></div>
      <span class="px">${F.px(r.last)}</span>
      <span class="nm">${esc(r.s.name)}</span>
      <span class="ch ${cls(r.ch)}">${sort === 'volume' ? (r.vr).toFixed(1) + 'x vol' : sort === 'upside' ? F.spct(r.up, 0) + ' tgt' : F.spct(r.ch, 2)}</span>
    </div>`).join('');
    return `<div class="watch-head"><div class="row"><span class="label grow" title="40 stocks plus the TMXI index fund">Market ${q('watchlist', 'market list')}</span>
      <select data-bind="ui.sort" data-rerender="1" style="width:auto;padding:2px 4px;font-size:12px" aria-label="Sort">
        ${[['sector', 'Sector'], ['change', 'Day change'], ['volume', 'Volume vs avg'], ['upside', 'Analyst upside'], ['name', 'Ticker']].map(([k, v]) => `<option value="${k}" ${sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="filters">${['All'].concat(w.secNames).map((s) => `<button class="${App.ui.sector === s ? 'on' : ''}" data-act="sector" data-arg="${s}">${s === 'All' ? 'All' : `<span class="dot" style="background:${SEC_COLOR[s]};width:6px;height:6px"></span> ${s}`}</button>`).join('')}</div></div>
      <div class="watch-list" data-keep="watch">${list}</div>`;
  }
  function viewChart() {
    const w = W(), g = G(), t = g.t, i = idx(App.ui.sel), s = w.inst[i], last = w.c[i][t];
    const ch1 = chg(i, t, 1);
    const hi52 = Math.max(...Array.from(w.h[i].slice(Math.max(0, t - 249), t + 1))), lo52 = Math.min(...Array.from(w.l[i].slice(Math.max(0, t - 249), t + 1)));
    const vol20 = w.rv20[i][Math.min(t + 1, w.T - 1)] * Math.sqrt(252);
    let prof;
    if (s.isFund) {
      prof = [['Holdings', '40 stocks, cap-weighted'], ['1-year return', F.spct(chg(i, t, 250))], ['20-day volatility', F.pct(vol20, 0) + ' ann.'], ['52-week range', `${F.px(lo52)} – ${F.px(hi52)}`],
        ['Avg volume (20d)', F.big(w.adv20[i][t])], ['Spread', TM.spreadBps(w, i, t + 1).toFixed(1) + ' bps'], ['Dividends', 'reinvested (total return)'], ['Borrow fee', F.pct(s.borrowFee, 2) + ' / yr']];
    } else {
      const ne = TM.nextEarnings(w, i, t), xd = TM.nextExDiv(w, i, t);
      const pe = last / w.eps[i][t];
      prof = [['Sector', s.sector], ['Market cap', '$' + F.big(s.shares * last)], ['Beta (1y)', beta1y(i, t).toFixed(2)], ['20-day volatility', F.pct(vol20, 0) + ' ann.'],
        ['P/E (trailing)', pe > 0 ? pe.toFixed(1) : 'n/m'], ['EPS growth est.', F.pct(s.g, 1)], ['Dividend yield', s.divYield ? F.pct(s.divYield, 2) : 'none'],
        ['Analyst target', `$${F.px(w.tgt[i][t])} <span class="${cls(w.tgt[i][t] / last - 1)}">(${F.spct(w.tgt[i][t] / last - 1, 0)})</span>`],
        ['52-week range', `${F.px(lo52)} – ${F.px(hi52)}`], ['Avg volume (20d)', F.big(w.adv20[i][t])], ['Spread', TM.spreadBps(w, i, t + 1).toFixed(1) + ' bps'],
        ['Borrow fee', `${F.pct(s.borrowFee, 1)} / yr${s.hardToBorrow ? ' <span class="down">HTB</span>' : ''}`],
        ['Next earnings', ne != null ? `${F.sdate(ne)} <span class="faint">(${ne - t}d)</span> ±${F.pct(s.earnSd * 0.75)}` : '–'],
        ['Next ex-dividend', xd ? `${F.sdate(xd.d)} · $${xd.amt.toFixed(2)}` : s.divYield ? 'not yet declared' : '–']];
    }
    const news = headlines(t, 120, new Set([s.sym])).slice(0, 6);
    return `<div class="panel">
      <div class="chart-head"><span class="dot" style="background:${SEC_COLOR[s.sector]}"></span><h2 class="mono">${s.sym}</h2><span class="muted">${esc(s.name)}</span>
        <span class="big">${F.px(last)}</span><span class="mono ${cls(ch1)}">${F.smoney(last - w.c[i][t - 1], 2)} (${F.spct(ch1, 2)})</span>
        <button class="btn sm primary show-md" style="margin-left:auto" data-act="pane" data-arg="ticket">Trade ${s.sym}</button></div>
      <div class="chart-tools"><span class="small faint grow">${esc(s.blurb)}</span>
        <div class="seg">${[[63, '3M'], [126, '6M'], [250, '1Y']].map(([n, l]) => `<button class="${App.ui.range === n ? 'on' : ''}" data-act="range" data-arg="${n}">${l}</button>`).join('')}</div>
        ${q('chart', 'reading the chart')}<div class="seg"><button class="${App.ui.sma20 ? 'on' : ''}" data-act="toggle" data-arg="sma20">SMA20</button><button class="${App.ui.sma50 ? 'on' : ''}" data-act="toggle" data-arg="sma50">SMA50</button><button class="${App.ui.showVol ? 'on' : ''}" data-act="toggle" data-arg="showVol">Vol</button></div></div>
      <div class="canvas-wrap"><canvas id="priceChart" aria-label="Price chart for ${s.sym}" role="img"></canvas></div>
      <div class="row" style="padding:6px 14px;border-top:1px solid var(--border)"><span class="label grow">Profile</span>${q('profile', 'company profile')}</div>
      <div class="profile">${prof.map(([k, v]) => `<div><div class="label">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
      <div class="newsbox"><div class="label" style="margin-bottom:4px">${s.isFund ? 'Market news' : 'Company news'}</div>
        ${(s.isFund ? headlines(t, 15).filter((x) => x.macro).slice(0, 6) : news).map((x) => `<div class="news-item"><span class="when">${F.sdate(x.d)}</span><span class="tone-${x.tone || 0}">${esc(x.text)}</span></div>`).join('') || '<div class="faint small">No recent headlines.</div>'}
      </div></div>`;
  }
  function viewTicket() {
    const w = W(), g = G(), t = g.t, i = idx(App.ui.sel), s = w.inst[i], last = w.c[i][t], a = g.player, tk = App.ui.ticket;
    const p = a.pos[s.sym];
    const active = g.status === 'active';
    const typeHelp = { market: 'Fills at the next open, plus spread and impact. Overnight gaps can move it far from today’s close.', limit: 'Buy at or below / sell at or above your price. You may not get filled.', stop: 'Becomes a market order once price trades through the stop. Gaps can fill you well past it.', stoplimit: 'Triggers at the stop, then only fills at your limit or better. In a gap it may not fill at all.' };
    const sellLabel = a.margin ? (p && p.qty > 0 ? 'Sell' : 'Sell short') : 'Sell';
    const closing = TM.orderEffect(a, s.sym, tk.side, 0).closable > 0;
    const stopSide = tk.side === 'buy' ? 'below' : 'above', targetSide = tk.side === 'buy' ? 'above' : 'below';
    return `<div class="pad"><div class="row"><span class="label grow">Order ticket ${q('ticket', 'order ticket')}</span><span class="mono small">${s.sym} $${F.px(last)}</span></div>
      <div class="small muted" style="margin:6px 0 8px">${p ? `You are ${p.qty > 0 ? 'long' : 'short'} ${Math.abs(p.qty)} @ $${F.px(p.avg)} · <span class="${cls((last - p.avg) * p.qty)}">${F.smoney((last - p.avg) * p.qty)}</span>` : 'No position.'} Buying power ${F.money(TM.buyingPower(w, a, t))}${(() => { const r = TM.reserved(w, a, t); return r.orders ? ` <span class="faint">· ${F.money(a.margin ? r.exposure + r.cash : r.cash)} reserved by ${r.orders} queued order${r.orders > 1 ? 's' : ''}</span>` : ''; })()}${(() => { const e2 = TM.orderEffect(a, s.sym, 'sell', 0), e3 = TM.orderEffect(a, s.sym, 'buy', 0); const c = Math.max(e2.closable ? e2.committed : 0, e3.closable ? e3.committed : 0); return c ? ` <span class="faint">· ${c} shares committed to queued orders</span>` : ''; })()}</div>
      <div class="seg big"><button class="${tk.side === 'buy' ? 'on b' : ''}" data-act="side" data-arg="buy">${p && p.qty < 0 ? 'Buy to cover' : 'Buy'}</button><button class="${tk.side === 'sell' ? 'on s' : ''}" data-act="side" data-arg="sell">${sellLabel}</button></div>
      <label class="f"><span>Order type</span><div class="seg" style="display:flex">${[['market', 'Market'], ['limit', 'Limit'], ['stop', 'Stop'], ['stoplimit', 'Stop-limit']].map(([k, l]) => `<button style="flex:1" class="${tk.type === k ? 'on' : ''}" data-act="otype" data-arg="${k}">${l}</button>`).join('')}</div></label>
      <div class="tiny faint" style="margin-top:4px">${typeHelp[tk.type]}</div>
      <div class="split">
        <label class="f"><span>Quantity <button class="btn link tiny" data-act="maxQty">max</button></span><input type="number" min="1" step="1" inputmode="numeric" value="${esc(tk.qty)}" data-bind="ticket.qty" data-live="1"></label>
        ${tk.type === 'stop' || tk.type === 'stoplimit' ? `<label class="f"><span>Stop price</span><input type="number" step="0.01" value="${esc(tk.stop)}" placeholder="${F.px(last)}" data-bind="ticket.stop" data-live="1"></label>` : ''}
        ${tk.type === 'limit' || tk.type === 'stoplimit' ? `<label class="f"><span>Limit price</span><input type="number" step="0.01" value="${esc(tk.limit)}" placeholder="${F.px(last)}" data-bind="ticket.limit" data-live="1"></label>` : ''}
        ${tk.type === 'market' ? '<div></div>' : ''}
      </div>
      <div class="row" style="margin-top:8px"><span class="small muted grow">Time in force</span><div class="seg"><button class="${tk.tif === 'day' ? 'on' : ''}" data-act="tif" data-arg="day">Day</button><button class="${tk.tif === 'gtc' ? 'on' : ''}" data-act="tif" data-arg="gtc">GTC (60d)</button></div></div>
      ${closing ? `<div class="ticket-note">You are ${p.qty > 0 ? 'long' : 'short'} ${Math.abs(p.qty)} ${s.sym}, so this <b>${tk.side === 'sell' ? 'Sell' : 'Buy to cover'}</b> order closes or reduces that position. A bracket and planned stop only apply to <b>new</b> positions. To protect the position instead, choose a <b>Stop</b> order here, or use <b>Stop</b> on the Positions tab.</div>` : `
      ${tk.side === 'sell' && a.margin ? '<div class="ticket-note">Short trade: you profit if the price <b>falls</b>, so the stop-loss goes <b>above</b> your entry and the take-profit <b>below</b> it.</div>' : ''}
      <label class="check"><input type="checkbox" ${tk.bracket ? 'checked' : ''} data-bind="ticket.bracket" data-rerender="1"> Attach bracket: stop-loss + take-profit (one cancels the other)</label>
      ${tk.bracket ? `<div class="split"><label class="f"><span>Stop-loss <span class="faint">(${stopSide} entry)</span> <button class="btn link tiny" data-act="suggestStop">2 ATR</button></span><input type="number" step="0.01" value="${esc(tk.sl)}" data-bind="ticket.sl" data-live="1"></label>
        <label class="f"><span>Take-profit <span class="faint">(${targetSide} entry)</span> <button class="btn link tiny" data-act="suggestTarget">2R</button></span><input type="number" step="0.01" value="${esc(tk.tp)}" data-bind="ticket.tp" data-live="1"></label></div>`
        : `<label class="f"><span>Planned stop: where are you wrong? <span class="faint">(${stopSide} entry)</span> <button class="btn link tiny" data-act="suggestStop">2 ATR</button></span><input type="number" step="0.01" value="${esc(tk.planStop)}" placeholder="not set" data-bind="ticket.planStop" data-live="1"></label>`}
      <div class="row" style="margin-top:8px"><span class="small muted">Risk</span><input type="number" step="0.25" min="0.05" value="${esc(tk.riskPct)}" data-bind="ticket.riskPct" style="width:70px"><span class="small muted grow">% of equity</span><button class="btn sm" data-act="sizeIt">Size from stop</button></div>`}
      <div class="split"><label class="f"><span>Setup</span><select data-bind="ticket.tag" data-live="1"><option value="">–</option>${SETUPS.map((x) => `<option ${tk.tag === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="f"><span>ATR (14d)</span><input type="text" value="${F.px(atr(i, t, 14))}" disabled></label></div>
      <label class="f"><span>Thesis: why this trade, why now?</span><textarea data-bind="ticket.note" maxlength="400" placeholder="e.g. Pullback to 50-day average in an uptrend, earnings 3 weeks away">${esc(tk.note)}</textarea></label>
      <div class="row" style="margin-top:10px"><span class="label grow">Preview &amp; checks</span>${q('preview', 'preview and warnings')}</div>
      <div class="preview" id="preview" style="margin-top:4px"></div>
      <button class="btn ${tk.side === 'buy' ? 'buy' : 'sell'}" style="width:100%;margin-top:10px" data-act="submit" id="submitBtn" ${active ? '' : 'disabled'}>Queue ${tk.side === 'buy' ? 'buy' : 'sell'} order</button>
      <div class="hint">Nothing executes until you press <b>Next day</b>. Shortcut: <span class="kbd">N</span></div></div>`;
  }
  function updatePreview() {
    const el = document.getElementById('preview');
    if (!el || !G()) return;
    const pc = preTradeChecks();
    const rows = [];
    if (pc.qty > 0 && pc.est) {
      const eq = pc.eq;
      rows.push(['Reference price', '$' + F.px(pc.ref)]);
      rows.push(['Notional', `${F.money(pc.qty * pc.ref)} · ${F.pct(pc.qty * pc.ref / eq, 1)} of equity`]);
      rows.push(['Est. costs', `${F.money(pc.est.total, 2)} (${pc.est.bps.toFixed(1)} bps)`]);
      rows.push(['  commission · spread · impact', `${F.money(pc.est.commission, 2)} · ${F.money(pc.est.spread, 2)} · ${F.money(pc.est.impact, 2)}`]);
      if (pc.risk != null) rows.push(['Risk to stop', `${F.money(pc.risk)} · ${F.pct(pc.risk / eq, 2)} of equity`]);
      if (pc.risk != null && pc.target > 0) rows.push(['Reward : risk', (Math.abs(pc.target - pc.ref) / Math.abs(pc.ref - pc.stop)).toFixed(2) + ' : 1']);
    }
    el.innerHTML = rows.map(([k, v]) => `<div class="kv"><span class="muted">${k}</span><b>${v}</b></div>`).join('') +
      (pc.items.length ? `<ul>${pc.items.map((x) => `<li class="${x.lvl}">${esc(x.text)}</li>`).join('')}</ul>` : '');
    const btn = document.getElementById('submitBtn');
    if (btn) btn.disabled = G().status !== 'active' || pc.blocking;
  }

  // ---------- tabs ----------
  const TABS = [['positions', 'Positions'], ['orders', 'Orders'], ['activity', 'Activity'], ['news', 'News & calendar'], ['performance', 'Performance'], ['leaderboard', 'Leaderboard'], ['journal', 'Journal'], ['learn', 'Learn'], ['account', 'Account & rules']];
  function viewTabs() {
    const g = G();
    const open = g.player.orders.filter((o) => o.status === 'open' || o.status === 'pending').length;
    const npos = Object.keys(g.player.pos).length;
    const body = { positions: tabPositions, orders: tabOrders, activity: tabActivity, news: tabNews, performance: tabPerformance, leaderboard: tabLeaderboard, journal: tabJournal, learn: tabLearn, account: tabAccount }[App.ui.tab]();
    return `<div class="tabbar" role="tablist">${TABS.map(([k, l]) => `<button role="tab" class="${App.ui.tab === k ? 'on' : ''}" data-act="tab" data-arg="${k}">${l}${k === 'orders' && open ? ` (${open})` : ''}${k === 'positions' && npos ? ` (${npos})` : ''}</button>`).join('')}<button class="qbtn" style="margin:auto 4px auto auto;flex:0 0 auto" data-act="help" data-arg="${TM.HELP_CONTEXT[App.ui.tab]}" aria-label="Help for this tab">?</button></div>
      <div class="tabbody ${['learn', 'performance'].includes(App.ui.tab) ? '' : 'scroll'}" data-keep="tab-${App.ui.tab}">${body}</div>`;
  }
  function tabPositions() {
    const w = W(), g = G(), a = g.player, t = g.t;
    const ex = TM.exposures(w, a, t);
    const syms = Object.keys(a.pos);
    const rows = syms.map((sym) => {
      const p = a.pos[sym], i = idx(sym), last = w.c[i][t], mv = p.qty * last, pnl = (last - p.avg) * p.qty, day = (last - w.c[i][t - 1]) * p.qty;
      const tr = a.openTrades[sym], ne = w.inst[i].isFund ? null : TM.nextEarnings(w, i, t);
      const stopO = a.orders.find((o) => o.sym === sym && o.status === 'open' && o.reduceOnly && o.stop);
      return `<tr><td><button class="btn link mono" data-act="sel" data-arg="${sym}">${sym}</button></td><td class="num ${p.qty > 0 ? 'up' : 'down'}">${p.qty > 0 ? 'L' : 'S'} ${Math.abs(p.qty)}</td>
        <td class="num">${F.px(p.avg)}</td><td class="num">${F.px(last)}</td><td class="num">${F.money(mv)}</td><td class="num">${F.pct(Math.abs(mv) / ex.equity, 1)}</td>
        <td class="num ${cls(pnl)}">${F.smoney(pnl)}<div class="tiny">${F.spct((last / p.avg - 1) * Math.sign(p.qty))}</div></td><td class="num ${cls(day)}">${F.smoney(day)}</td>
        <td class="num">${stopO ? '$' + F.px(stopO.stop) : tr && tr.plannedStop ? `<span class="faint">plan $${F.px(tr.plannedStop)}</span>` : '<span class="down">none</span>'}</td>
        <td class="num">${t - p.openDay}d</td><td class="num">${ne != null ? `${ne - t}d` : '–'}</td>
        <td class="num"><button class="btn sm" data-act="protect" data-arg="${sym}">Stop</button> <button class="btn sm" data-act="closePos" data-arg="${sym}">Close</button></td></tr>`;
    }).join('');
    const summary = `<div class="metrics" style="margin-bottom:10px">
      <div class="metric"><b>${F.money(ex.equity)}</b><span>Equity</span></div><div class="metric"><b>${F.money(a.cash)}</b><span>Cash${a.cash < 0 ? ' (margin loan)' : ''}</span></div>
      <div class="metric"><b>${F.money(ex.long)}</b><span>Long value</span></div><div class="metric"><b>${F.money(ex.short)}</b><span>Short value</span></div>
      <div class="metric"><b>${F.pct((ex.long + ex.short) / ex.equity, 0)}</b><span>Gross exposure</span></div><div class="metric"><b>${F.money(TM.buyingPower(w, a, t))}</b><span>Buying power</span></div>
      <div class="metric"><b class="${cls(a.costs.interest)}">${F.smoney(a.costs.interest, 2)}</b><span>Interest so far (cash earns ${Math.max(0, w.policy[t] - 0.5).toFixed(2)}%/yr)</span></div></div>`;
    return summary + (rows ? `<div class="tablewrap"><table><thead><tr><th>Symbol</th><th class="num">Qty</th><th class="num">Avg cost</th><th class="num">Last</th><th class="num">Value</th><th class="num">Weight</th><th class="num">Unrealised</th><th class="num">Today</th><th class="num">Stop</th><th class="num">Held</th><th class="num">Earnings</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : '<div class="empty">No positions. Pick a stock, plan your stop, size the trade and queue an order.</div>');
  }
  function tabOrders() {
    const g = G(), a = g.player;
    const working = a.orders.filter((o) => o.status === 'open' || o.status === 'pending');
    const done = a.orders.filter((o) => !(o.status === 'open' || o.status === 'pending') && o.source !== 'margin').slice(-20).reverse();
    const wrows = working.map((o) => {
      if (App.ui.editOrder === o.id) {
        return `<tr><td class="mono">#${o.id}</td><td class="mono">${o.sym}</td><td>${o.side.toUpperCase()}</td><td>${o.type}${o.role ? ` (${o.role})` : ''}</td>
          <td><input type="number" value="${esc(App.ui.edit.qty)}" data-bind="edit.qty" style="width:80px"></td>
          <td>${o.limit != null ? `L <input type="number" step="0.01" value="${esc(App.ui.edit.limit)}" data-bind="edit.limit" style="width:90px">` : ''} ${o.stop != null ? `S <input type="number" step="0.01" value="${esc(App.ui.edit.stop)}" data-bind="edit.stop" style="width:90px">` : ''}</td>
          <td></td><td class="num"><button class="btn sm primary" data-act="editSave" data-arg="${o.id}">Save</button> <button class="btn sm" data-act="editCancel">Cancel</button></td></tr>`;
      }
      return `<tr><td class="mono">#${o.id}</td><td><button class="btn link mono" data-act="sel" data-arg="${o.sym}">${o.sym}</button></td><td class="${o.side === 'buy' ? 'up' : 'down'}">${o.side.toUpperCase()}</td>
        <td>${o.type}${o.role ? ` <span class="faint">(${o.role})</span>` : ''}${o.triggered ? ' <span class="faint">triggered</span>' : ''}</td><td class="num">${o.qty}</td><td class="mono">${typeLabel(o)}</td>
        <td>${o.status === 'pending' ? '<span class="faint">waits for entry</span>' : o.tif.toUpperCase()}</td>
        <td class="num"><button class="btn sm" data-act="edit" data-arg="${o.id}">Edit</button> <button class="btn sm" data-act="cancel" data-arg="${o.id}">Cancel</button></td></tr>`;
    }).join('');
    const drows = done.map((o) => `<tr><td class="mono">#${o.id}</td><td class="mono">${o.sym}</td><td>${o.side.toUpperCase()}</td><td>${o.type}${o.role ? ` (${o.role})` : ''}</td><td class="num">${o.fillQty || o.qty}</td>
      <td>${o.status === 'filled' ? `<span class="up">filled</span> $${F.px(o.fillPx)} on ${F.sdate(o.fillDay)}` : `<span class="${o.status === 'rejected' ? 'down' : 'faint'}">${o.status}</span> <span class="tiny faint">${esc(o.reason || '')}</span>`}</td></tr>`).join('');
    return `<div class="label" style="margin-bottom:6px">Working orders</div>${wrows ? `<div class="tablewrap"><table><thead><tr><th>#</th><th>Symbol</th><th>Side</th><th>Type</th><th class="num">Qty</th><th>Price</th><th>TIF</th><th></th></tr></thead><tbody>${wrows}</tbody></table></div>` : '<div class="empty">No working orders.</div>'}
      <div class="label" style="margin:14px 0 6px">Recent orders</div>${drows ? `<div class="tablewrap"><table><thead><tr><th>#</th><th>Symbol</th><th>Side</th><th>Type</th><th class="num">Qty</th><th>Result</th></tr></thead><tbody>${drows}</tbody></table></div>` : '<div class="empty">Nothing yet.</div>'}`;
  }
  function tabActivity() {
    const a = G().player;
    const items = a.activity.slice().reverse().slice(0, 150);
    return items.length ? items.map((x) => `<div class="news-item"><span class="when">${F.sdate(x.d)}</span><span class="${x.kind === 'margin' || x.kind === 'reject' ? 'down' : x.kind === 'div' ? 'up' : ''}">${esc(x.text)}</span></div>`).join('') : '<div class="empty">Fills, dividends, expiries and margin events appear here.</div>';
  }
  function tabNews() {
    const w = W(), g = G(), t = g.t;
    const mine = App.ui.newsMine ? new Set(Object.keys(g.player.pos)) : null;
    const hl = headlines(t, 30, mine).slice(0, 80);
    const cal = [];
    for (let i = 0; i < w.nStocks; i++) {
      const ne = TM.nextEarnings(w, i, t);
      if (ne != null && ne - t <= 15) cal.push({ d: ne, text: `${w.inst[i].sym} earnings (implied ±${F.pct(w.inst[i].earnSd * 0.75)})`, kind: 'E', sym: w.inst[i].sym });
      const xd = TM.nextExDiv(w, i, t);
      if (xd && xd.d - t <= 15) cal.push({ d: xd.d, text: `${w.inst[i].sym} ex-dividend $${xd.amt.toFixed(2)}`, kind: 'D', sym: w.inst[i].sym });
    }
    for (const m of TM.upcomingMacro(w, t, 4)) if (m.d - t <= 15) cal.push({ d: m.d, text: m.label, kind: 'M' });
    cal.sort((x, y) => x.d - y.d);
    const held = new Set(Object.keys(g.player.pos));
    return `<div class="cols2"><div><div class="row" style="margin-bottom:6px"><span class="label grow">Headlines (last 30 days)</span><label class="small muted"><input type="checkbox" ${App.ui.newsMine ? 'checked' : ''} data-act="newsMine"> my positions only</label></div>
      ${hl.map((x) => `<div class="news-item"><span class="when">${F.sdate(x.d)}</span><span class="tone-${x.tone || 0}">${x.sym ? `<button class="btn link mono" data-act="sel" data-arg="${x.sym}">${x.sym}</button> ` : '<b>MACRO</b> '}${esc(x.text.replace(/ \([A-Z]{4}\)/, ''))}</span></div>`).join('') || '<div class="empty">No headlines.</div>'}</div>
      <div><div class="label" style="margin-bottom:6px">Calendar · next 15 trading days</div>
      ${cal.map((x) => `<div class="news-item"><span class="when">${F.sdate(x.d)}</span><span><span class="tag ${x.kind === 'E' ? 'e' : x.kind === 'D' ? 'd' : ''}">${x.kind === 'M' ? 'MACRO' : x.kind}</span> ${x.sym ? `<button class="btn link mono" data-act="sel" data-arg="${x.sym}">${x.sym}</button>${held.has(x.sym) ? ' <span class="tag l">held</span>' : ''} ` : ''}${esc(x.sym ? x.text.slice(x.sym.length + 1) : x.text)}</span></div>`).join('') || '<div class="empty">Nothing scheduled.</div>'}
      <div class="tiny faint" style="margin-top:8px">Earnings and macro releases hit at the open. Implied move is what the options market would typically price: the average size of the move, not its direction.</div></div></div>`;
  }
  function metricCards(m) {
    const cards = [
      ['Total return', F.spct(m.total), cls(m.total)], ['Index fund', F.spct(m.benchTotal), cls(m.benchTotal)], ['Excess return', F.spct(m.excess), cls(m.excess)],
      ['Volatility (ann.)', F.pct(m.vol, 1), ''], ['Sharpe ratio', F.num(m.sharpe), ''], ['Sortino ratio', F.num(m.sortino), ''],
      ['Max drawdown', F.pct(m.maxDD), m.maxDD < 0 ? 'down' : ''], ['Beta to index', F.num(m.beta), ''], ['Alpha (ann.)', F.spct(m.alpha), cls(m.alpha)],
      ['Closed trades', String(m.trades), ''], ['Win rate', F.pct(m.winRate, 0), ''], ['Profit factor', m.profitFactor === Infinity ? '∞' : F.num(m.profitFactor), ''],
      ['Expectancy / trade', m.expectancy == null ? '–' : F.smoney(m.expectancy), cls(m.expectancy)], ['Average R', F.num(m.avgR), cls(m.avgR)],
      ['Avg hold win / loss', m.holdWin == null && m.holdLoss == null ? '–' : `${F.num(m.holdWin, 1)} / ${F.num(m.holdLoss, 1)}d`, ''],
      ['Gross exposure (avg)', F.pct(m.gross, 0), ''], ['Turnover (ann.)', F.pct(m.turnoverAnn, 0), ''], ['Trading costs', F.money(m.frictions) + ` (${F.pct(m.costDrag, 2)})`, m.frictions > 0 ? 'down' : '']
    ];
    return `<div class="metrics">${cards.map(([k, v, c]) => `<div class="metric"><b class="${c}">${v}</b><span>${k}</span></div>`).join('')}</div>`;
  }
  function legend(sel, act) {
    const g = G();
    return `<div class="legend">${SERIES.filter((s) => s.id === 'you' || (g && g.bots[s.id])).map((s) => `<button class="${sel[s.id] ? 'on' : ''}" data-act="${act || 'perf'}" data-arg="${s.id}" aria-pressed="${!!sel[s.id]}" title="Show or hide ${s.label}"><i style="background:var(${s.v})"></i>${s.label}</button>`).join('')}</div>`;
  }
  function tabPerformance() {
    const w = W(), g = G(), m = TM.metrics(w, g.player), c = g.player.costs;
    return `${legend(App.ui.perf)}<canvas id="perfChart" role="img" aria-label="Equity curves"></canvas>
      <div class="label" style="margin:8px 0 2px">Drawdown from peak: you vs index fund</div><canvas id="ddChart" role="img" aria-label="Drawdown chart"></canvas>
      <div class="section">${metricCards(m)}</div>
      <div class="section"><div class="label" style="margin-bottom:6px">Where the money went</div><div class="metrics">
        <div class="metric"><b class="${cls(g.player.realized)}">${F.smoney(g.player.realized)}</b><span>Realised P&amp;L (after spread)</span></div>
        <div class="metric"><b class="down">${F.money(-c.commission)}</b><span>Commission</span></div><div class="metric"><b class="down">${F.money(-(c.spread + c.impact))}</b><span>Spread + impact</span></div>
        <div class="metric"><b class="${c.borrow ? 'down' : ''}">${F.money(-c.borrow)}</b><span>Short borrow fees</span></div><div class="metric"><b class="${cls(c.interest)}">${F.smoney(c.interest)}</b><span>Interest</span></div>
        <div class="metric"><b class="${cls(c.dividends)}">${F.smoney(c.dividends)}</b><span>Dividends</span></div></div></div>`;
  }
  function tabLeaderboard() {
    const w = W(), g = G();
    const accts = [g.player].concat(botDefs(g).map((b) => g.bots[b.id]));
    const rows = accts.map((a) => ({ a, m: TM.metrics(w, a) })).sort((x, y) => y.m.total - x.m.total);
    const cfg = g.botCfg;
    const fld = (k, label, step) => `<label class="f"><span>${label}</span><input type="number" min="0" step="${step || 1}" value="${cfg[k]}" data-bind="botCfg.${k}" data-num="1"></label>`;
    return `<div class="tablewrap"><table><thead><tr><th>#</th><th>Account</th><th class="num">Return</th><th class="num">Volatility</th><th class="num">Sharpe</th><th class="num">Max DD</th><th class="num">Trades</th><th class="num">Costs</th></tr></thead><tbody>
      ${rows.map((r, k) => `<tr ${r.a.id === 'you' ? 'style="font-weight:700"' : ''}><td>${k + 1}</td><td>${esc(r.a.label)}${r.a.id !== 'you' ? `<div class="tiny faint" style="font-weight:400">${esc(TM.BOT_DEFS.find((b) => b.id === r.a.id).desc)}</div>` : ''}</td>
        <td class="num ${cls(r.m.total)}">${F.spct(r.m.total)}</td><td class="num">${F.pct(r.m.vol)}</td><td class="num">${F.num(r.m.sharpe)}</td><td class="num down">${F.pct(r.m.maxDD)}</td><td class="num">${r.a.fills.length}</td><td class="num">${F.money(r.m.frictions)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="section panel pad" style="box-shadow:none"><h3 style="font-size:14px">Rules bot settings</h3><div class="small muted">The rules bot buys a random stock each day (up to the max positions) and exits only through these rules, so it isolates the effect of your exit discipline. Changes apply from the next day.</div>
      <div class="split" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">${fld('stopPct', 'Stop-loss %', 0.5)}${fld('targetPct', 'Take-profit % (0 = none)', 0.5)}${fld('trailPct', 'Trailing stop % (0 = off)', 0.5)}${fld('maxHold', 'Max hold days (0 = none)')}${fld('posPct', 'Position size % of equity', 1)}${fld('maxPos', 'Max positions')}</div></div>`;
  }
  function tabJournal() {
    const g = G(), a = g.player;
    const ts = TM.tagStats(a);
    const trades = a.trades.slice().reverse();
    const open = Object.values(a.openTrades);
    return `${ts.length ? `<div class="label" style="margin-bottom:6px">By setup</div><div class="tablewrap"><table><thead><tr><th>Setup</th><th class="num">Trades</th><th class="num">Win rate</th><th class="num">Avg R</th><th class="num">Net P&amp;L</th></tr></thead><tbody>
      ${ts.map((s) => `<tr><td>${esc(s.tag)}</td><td class="num">${s.n}</td><td class="num">${F.pct(s.winRate, 0)}</td><td class="num ${cls(s.avgR)}">${F.num(s.avgR)}</td><td class="num ${cls(s.net)}">${F.smoney(s.net)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${open.length ? `<div class="label" style="margin:12px 0 6px">Open trades</div>${open.map((t) => `<div class="news-item"><span class="when">${F.sdate(t.openDay)}</span><span><b class="mono">${t.sym}</b> ${t.dir > 0 ? 'long' : 'short'} · ${esc(t.tag || 'no setup')} · stop ${t.plannedStop ? '$' + F.px(t.plannedStop) : '<span class="down">none</span>'}${t.note ? ` · <i>${esc(t.note)}</i>` : ''}</span></div>`).join('')}` : ''}
      <div class="label" style="margin:12px 0 6px">Closed trades</div>
      ${trades.length ? `<div class="tablewrap"><table><thead><tr><th>Trade</th><th>Setup &amp; thesis</th><th class="num">Net</th><th class="num">R</th><th class="num">MAE / MFE</th><th>Exit</th><th>Lesson</th></tr></thead><tbody>
      ${trades.map((t) => `<tr><td><b class="mono">${t.sym}</b> ${t.dir > 0 ? 'long' : 'short'}<div class="tiny faint">${F.sdate(t.openDay)} → ${F.sdate(t.closeDay)} · ${t.closeDay - t.openDay}d · ${t.qtyMax} @ $${F.px(t.entryPx)}</div></td>
        <td class="small">${esc(t.tag || '–')}${t.note ? `<div class="tiny faint">${esc(t.note)}</div>` : ''}</td>
        <td class="num ${cls(t.net)}">${F.smoney(t.net)}<div class="tiny">${F.spct(t.retPct)}</div></td><td class="num ${cls(t.r)}">${t.r == null ? '–' : t.r.toFixed(2)}</td>
        <td class="num tiny"><span class="down">${F.pct(t.mae)}</span> / <span class="up">${F.pct(t.mfe)}</span></td><td class="small">${esc(t.exitReason || '')}</td>
        <td><input type="text" placeholder="What did you learn?" value="${esc(t.lesson)}" data-bind="lesson.${t.id}" style="min-width:160px"></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">Closed trades appear here with your thesis, R-multiple and how far each trade went against you (MAE) and for you (MFE).</div>'}`;
  }
  function tabLearn() {
    const L = [
      ['How orders execute here', `<p>Each day you act after the close. Market orders fill at the next <b>open</b>, so overnight gaps from earnings, news and macro data move your fill away from today's close. Limits and stops are checked along the day's path: open, then high and low in a realistic order, then close.</p>`],
      ['Order types', `<ul><li><b>Market</b>: certain to fill, uncertain price.</li><li><b>Limit</b>: certain price, uncertain fill.</li><li><b>Stop</b>: becomes a market order when touched. It is not a guaranteed price.</li><li><b>Stop-limit</b>: never fills worse than the limit, so it may not fill at all in a gap.</li><li><b>Bracket</b>: an entry with a stop-loss and take-profit that cancel each other (OCO).</li><li><b>Day / GTC</b>: expires tonight, or keeps working for up to 60 days.</li></ul>`],
      ['Trading costs', `<p>You pay commission, half the <b>bid/ask spread</b> on each aggressive fill, and <b>market impact</b> of about <code>0.7 × daily volatility × √(shares ÷ average daily volume)</code>. Small, illiquid and volatile stocks cost more. Spreads widen when volatility rises. Passive limit fills avoid the spread.</p>`],
      ['Position sizing: the 1% rule', `<p>Size trades from the stop, not from conviction. With $100,000, risking 1% means $1,000 per trade. Entry $50 and stop $47 is $3 of risk per share, so the position is 1,000 ÷ 3 = <b>333 shares</b>. Use <b>Size from stop</b> in the ticket.</p>`],
      ['Stops and gaps', `<p>A stop at $95 on a stock that opens at $88 after bad earnings fills near $88, not $95. That is why losses can exceed 1R and why position size matters more than the stop level. Earnings dates and implied moves are on the calendar in advance.</p>`],
      ['Dividends and shorting', `<p>On the <b>ex-dividend</b> date the price drops by about the dividend. Holders receive the cash and short sellers pay it. Shorting also costs a <b>borrow fee</b>, which is much higher for hard-to-borrow stocks. A short's loss is unlimited, because a price can keep rising.</p>`],
      ['Margin', `<p>A margin account lets you borrow up to 2x your equity (50% initial margin) and sell short. If equity falls below maintenance (25% of longs, 30% of shorts), the broker <b>liquidates your largest positions at the close</b> without asking. Margin loans cost the policy rate plus 2.5%.</p>`],
      ['Diversification and beta', `<p>Most stocks move with the market (correlation here is about 0.5). <b>Beta</b> measures that sensitivity. Diversifying removes stock-specific risk but not market risk, and correlations jump in crashes, just when you need diversification most.</p>`],
      ['Drawdown arithmetic', `<p>Losses compound against you: −10% needs +11% to recover, −20% needs +25%, −33% needs +50% and −50% needs +100%. That is why professional mandates have hard drawdown limits, like the Level 2 evaluation.</p>`],
      ['Reading your performance', `<ul><li><b>Sharpe</b>: excess return per unit of volatility. Above 1 is good.</li><li><b>Sortino</b>: the same, counting only downside volatility.</li><li><b>Alpha</b>: return not explained by your beta to the index.</li><li><b>Profit factor</b>: gross wins ÷ gross losses.</li><li><b>Expectancy</b>: average net P&amp;L per trade.</li><li><b>R-multiple</b>: P&amp;L ÷ the risk you planned. +2R means you made twice what you risked.</li></ul>`],
      ['Behavioural traps', `<ul><li><b>Disposition effect</b>: selling winners early and holding losers.</li><li><b>Chasing</b>: buying after a big run because of fear of missing out.</li><li><b>Averaging down</b> into losers without a plan.</li><li><b>Moving stops</b> further away.</li><li><b>Revenge trading</b> after a loss day.</li><li><b>Overtrading</b>: costs compound against you.</li></ul><p>The debrief measures these from your actual trades.</p>`],
      ['How this market works', `<p>Everything is fictional but built to behave like real equities: positive long-run drift, regime changes (bull, choppy, bear, crash, recovery), volatility clustering and fat tails, sector and interest-rate factors, and scheduled earnings, dividends and macro releases. Small real edges exist: medium-term <b>momentum</b>, <b>post-earnings drift</b>, slow <b>valuation mean-reversion</b> toward fair value, and <b>short-term reversal</b>. They are weak compared with the noise, and costs can eat them, just like in reality.</p>`]
    ];
    return `<div class="learn">${L.map(([h, b]) => `<article><h4>${h}</h4>${b}</article>`).join('')}</div>`;
  }
  function tabAccount() {
    const g = G(), a = g.player, r = a.rules;
    const editable = g.mode === 'practice' && g.status === 'active';
    const num = (k, label, step) => `<label class="f"><span>${label}</span><input type="number" step="${step || 1}" min="0" value="${r[k] || 0}" data-bind="rules.${k}" data-num="1" ${editable ? '' : 'disabled'}></label>`;
    const cm = TM.COST_MODELS[a.costModel];
    return `<div class="cols2"><div><div class="label" style="margin-bottom:6px">Your risk rules</div>
      <div class="small muted">${editable ? 'Set the rules you want to trade by. The ticket checks every order against them.' : g.mode === 'practice' ? 'Session ended.' : 'Fixed by this evaluation.'} ${r.hard ? '<b class="down">Hard rules: a breach ends the evaluation.</b>' : ''}</div>
      <div class="split" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${num('maxRiskPct', 'Max risk per trade (% equity)', 0.25)}${num('maxPosPct', 'Max position size (% equity)')}${num('dailyLossPct', 'Daily loss limit (%)', 0.5)}${num('maxDDPct', 'Max drawdown alert (%)')}</div>
      <label class="check"><input type="checkbox" ${r.requireStop ? 'checked' : ''} data-bind="rules.requireStop" ${editable ? '' : 'disabled'}> Require a planned stop on new positions</label>
      <label class="check"><input type="checkbox" ${r.requireJournal ? 'checked' : ''} data-bind="rules.requireJournal" ${editable ? '' : 'disabled'}> Require a setup tag on new positions</label>
      <label class="f"><span>When a rule is broken</span><select data-bind="rules.enforce" ${editable ? '' : 'disabled'}><option value="warn" ${r.enforce !== 'block' ? 'selected' : ''}>Warn me</option><option value="block" ${r.enforce === 'block' ? 'selected' : ''}>Block the order</option></select></label>
      <div class="tiny faint" style="margin-top:6px">Hitting the daily loss limit always triggers a one-day cool-off on new positions.</div></div>
      <div><div class="label" style="margin-bottom:6px">Account</div>
      <div class="metrics"><div class="metric"><b>${a.margin ? 'Margin' : 'Cash'}</b><span>${a.margin ? '50% initial, 25%/30% maintenance' : 'no leverage, no shorting'}</span></div>
      <div class="metric"><b>${esc(cm.label)}</b><span>${esc(cm.desc)}</span></div>
      <div class="metric"><b>${(W().policy[g.t]).toFixed(2)}%</b><span>Policy rate · cash earns ${Math.max(0, W().policy[g.t] - 0.5).toFixed(2)}%</span></div>
      <div class="metric"><b class="mono">${g.mode === 'practice' || g.status !== 'active' ? g.seed : 'hidden'}</b><span>Market seed${g.unranked ? ' · unranked' : ''}</span></div></div>
      <div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="btn sm" data-act="exportSave">Export save</button><button class="btn sm" data-act="exportCsv">Export trades (CSV)</button>
      ${g.status === 'active' ? '<button class="btn sm sell" data-act="endSession">End session now</button>' : ''}</div></div></div>`;
  }

  function viewGame() {
    const g = G(), active = g.status === 'active', pane = App.ui.pane;
    const nav = [['watch', '☰', 'Market'], ['chart', '◔', 'Chart'], ['ticket', '⇅', 'Trade'], ['tabs', '▤', 'Portfolio']];
    return viewTop() + viewBanner() + `<div class="layout" data-pane="${pane}">
      <aside class="watch panel pane pane-watch">${viewWatch()}</aside>
      <section class="chartcol pane pane-chart">${viewChart()}</section>
      <aside class="ticket panel pane pane-ticket">${viewTicket()}</aside>
      <section class="tabs panel pane pane-tabs">${viewTabs()}</section></div>
      <nav class="mnav" aria-label="Sections">${nav.map(([k, ic, l]) => `<button class="nav nav-${k === 'watch' ? 'market' : k} ${pane === k || (k === 'chart' && pane === 'watch' && !narrow()) ? 'on' : ''}" data-act="pane" data-arg="${k}" aria-current="${pane === k}"><i aria-hidden="true">${ic}</i>${l}</button>`).join('')}
      ${active ? '<button class="btn primary" data-act="next">Next day ▸</button><button class="btn blue five" data-act="next5" title="Advance five days">+5</button>' : '<button class="btn primary" data-act="resume">Debrief</button>'}</nav>`;
  }

  // ---------- views: end / debrief ----------
  function regimeSegments() {
    const w = W(), g = G(), out = [];
    for (let d = w.start + 1; d <= g.t; d++) {
      const r = w.regime[d], last = out[out.length - 1];
      if (last && last.r === r) { last.to = d; } else out.push({ r, from: d, to: d });
    }
    return out.map((s) => Object.assign(s, { ret: w.c[w.FUND][s.to] / w.c[w.FUND][s.from - 1] - 1 }));
  }
  function viewEnd() {
    const w = W(), g = G(), a = g.player, m = TM.metrics(w, a), bm = TM.metrics(w, g.bots.index);
    const res = g.result || { status: 'complete', checks: [] };
    const coach = TM.coach(w, a, m);
    const head = res.status === 'passed' ? '<span class="badge pass" style="font-size:14px;padding:3px 10px">PASSED</span>' : res.status === 'failed' ? '<span class="badge fail" style="font-size:14px;padding:3px 10px">FAILED</span>' : '';
    const segs = regimeSegments();
    const trades = a.trades.slice().sort((x, y) => y.net - x.net);
    const tline = (t) => `<div class="news-item"><span class="when">${F.sdate(t.openDay)}</span><span><b class="mono">${t.sym}</b> ${t.dir > 0 ? 'long' : 'short'} · <span class="${cls(t.net)}">${F.smoney(t.net)}</span>${t.r != null ? ` · ${t.r.toFixed(2)}R` : ''} · ${t.closeDay - t.openDay}d · ${esc(t.exitReason)}${t.note ? ` · <i class="faint">${esc(t.note)}</i>` : ''}</span></div>`;
    const accts = [a].concat(botDefs(g).map((b) => g.bots[b.id])).map((x) => ({ x, m: TM.metrics(w, x) })).sort((p, q) => q.m.total - p.m.total);
    return `<header class="topbar"><div class="brand" data-act="home">TACK<small>V3</small></div><div class="stat"><b>${esc(TM.sessionLabel(g))}</b><span>${F.date(w.start)} → ${F.date(g.t)}</span></div><div class="spacer"></div>
      <button class="btn" data-act="viewBoard">Review board</button><button class="btn" data-act="exportCsv">Trades CSV</button><button class="btn ghost sm qbtn" data-act="help" data-arg="debrief" aria-label="Help guide">?</button><button class="btn primary" data-act="closeSession" title="Close the debrief and return to the home screen">✕ Close</button><button class="btn ghost sm" data-act="theme">◐</button></header>
      <div class="home">
      <div class="panel result"><div class="label">${g.mode === 'level' ? 'Evaluation result' : 'Session debrief'}</div><div class="big ${cls(m.total)}" style="margin:8px 0">${head} ${F.spct(m.total)}</div>
        <div class="muted">${res.reason ? esc(res.reason) + ' ' : ''}Index fund: ${F.spct(m.benchTotal)} · Excess: <span class="${cls(m.excess)}">${F.spct(m.excess)}</span> · Sharpe ${F.num(m.sharpe)} vs ${F.num(bm.sharpe)} · Max DD ${F.pct(m.maxDD)} vs ${F.pct(bm.maxDD)}</div>
        ${res.checks.length ? `<ul class="checks" style="max-width:560px;margin:12px auto 6px;text-align:left">${res.checks.map((c) => `<li><span>${c.ok ? '<span class="up">✓</span>' : '<span class="down">✕</span>'} ${esc(c.label)} <span class="faint tiny">(${esc(c.need)})</span></span><b class="mono">${esc(c.value)}</b></li>`).join('')}</ul>` : ''}
        ${g.unranked ? '<div class="tiny faint">Unranked session.</div>' : ''}</div>
      <div class="section panel pad"><h3>Equity: you vs every strategy on the same market</h3>${legend(App.ui.endPerf, 'endPerf')}<div class="tiny faint" style="margin:-2px 0 6px">Tap a name to show or hide its line.</div><canvas id="endChart" role="img" aria-label="Equity curves"></canvas>
        <div class="label" style="margin:10px 0 4px">What the market was really doing · ${esc(TM.SCENARIOS[g.scenario].label)}${g.hidden ? ' (it was hidden from you)' : ''}</div><canvas id="regimeChart" role="img" aria-label="Market regimes"></canvas>
        <div class="regimes">${segs.map((s) => `<span class="chip"><span class="dot" style="background:var(--reg-${s.r})"></span>${TM.REGIMES[s.r].label} · ${s.to - s.from + 1}d · <span class="${cls(s.ret)}">${F.spct(s.ret)}</span></span>`).join('')}</div>
        <div class="tiny faint" style="margin-top:6px">Market seed ${g.seed}. Enter it in Practice with the same scenario and length to replay this exact market.</div></div>
      ${viewTraderSection(w, g)}
      <div class="section panel pad"><h3>Your coach</h3><div class="coach">${coach.map((c) => `<div class="coach-item ${c.tone}"><b>${esc(c.title)}</b><p>${esc(c.detail)}</p></div>`).join('')}</div></div>
      <div class="section panel pad"><h3>Statistics</h3>${metricCards(m)}</div>
      <div class="section cards"><div class="panel pad"><h3 style="font-size:15px;margin-bottom:6px">Best trades</h3>${trades.slice(0, 3).map(tline).join('') || '<div class="faint">No closed trades.</div>'}</div>
        <div class="panel pad"><h3 style="font-size:15px;margin-bottom:6px">Worst trades</h3>${trades.slice(-3).reverse().filter((t) => t.net < 0).map(tline).join('') || '<div class="faint">No losing trades.</div>'}</div></div>
      <div class="section panel pad"><h3>Leaderboard</h3><div class="tablewrap"><table><thead><tr><th>#</th><th>Account</th><th class="num">Return</th><th class="num">Sharpe</th><th class="num">Max DD</th><th class="num">Costs</th></tr></thead><tbody>
        ${accts.map((r, k) => `<tr ${r.x.id === 'you' ? 'style="font-weight:700"' : ''}><td>${k + 1}</td><td>${esc(r.x.label)}</td><td class="num ${cls(r.m.total)}">${F.spct(r.m.total)}</td><td class="num">${F.num(r.m.sharpe)}</td><td class="num down">${F.pct(r.m.maxDD)}</td><td class="num">${F.money(r.m.frictions)}</td></tr>`).join('')}</tbody></table></div></div>
      </div>`;
  }


  // ---------- views: help guide ----------
  // One section at a time (with a sticky contents list) so nothing is ever a long scroll away.
  // Search looks across every section; printing renders the whole guide.
  const validItems = (sec) => sec.items.filter((it) => Array.isArray(it) && typeof it[0] === 'string' && typeof it[1] === 'string');
  function helpMatches() {
    const qv = App.ui.helpQ.trim().toLowerCase();
    const strip = (x) => x.replace(/<[^>]+>/g, '');
    return TM.HELP.map((sec) => {
      const inTitle = sec.title.toLowerCase().includes(qv);
      const items = validItems(sec).filter(([k, v]) => inTitle || k.toLowerCase().includes(qv) || strip(v).toLowerCase().includes(qv));
      return Object.assign({}, sec, { items });
    }).filter((sec) => sec.items.length);
  }
  const helpSection = (sec, opts) => `<section class="panel pad help-sec" id="h-${sec.id}">
    <div class="row"><h2 class="grow">${esc(sec.title)}</h2>${opts && opts.open ? `<button class="btn sm noprint" data-act="helpGo" data-arg="${sec.id}">Open section</button>` : ''}</div>
    ${sec.intro && !(opts && opts.open) ? `<div class="muted help-intro">${sec.intro}</div>` : ''}
    <dl class="glossary">${validItems(sec).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl></section>`;
  function viewHelpBody() {
    if (App.ui.helpPrintAll) return TM.HELP.map((sec) => helpSection(sec)).join('');
    if (App.ui.helpQ.trim()) {
      const secs = helpMatches();
      if (!secs.length) return `<div class="panel pad empty">No help entries match "${esc(App.ui.helpQ)}".</div>`;
      const n = secs.reduce((acc, sct) => acc + sct.items.length, 0);
      return `<div class="small muted" style="margin:0 2px 8px">${n} matching entr${n === 1 ? 'y' : 'ies'} in ${secs.length} section${secs.length === 1 ? '' : 's'}</div>` + secs.map((sec) => helpSection(sec, { open: true })).join('');
    }
    const k = Math.max(0, TM.HELP.findIndex((x) => x.id === App.ui.helpSec));
    const prev = TM.HELP[k - 1], next = TM.HELP[k + 1];
    return helpSection(TM.HELP[k]) + `<div class="help-pager noprint">
      ${prev ? `<button class="btn" data-act="helpGo" data-arg="${prev.id}">← ${esc(prev.title)}</button>` : '<span></span>'}
      ${next ? `<button class="btn" data-act="helpGo" data-arg="${next.id}">${esc(next.title)} →</button>` : '<span></span>'}</div>`;
  }
  function viewHelpToc() {
    const searching = !!App.ui.helpQ.trim();
    return TM.HELP.map((sec) => `<button class="${!searching && sec.id === App.ui.helpSec ? 'on' : ''}" data-act="helpGo" data-arg="${sec.id}">${esc(sec.title)}</button>`).join('');
  }
  function refreshHelp() {
    const b = document.getElementById('helpBody'), t = document.getElementById('helpToc');
    if (b) b.innerHTML = viewHelpBody();
    if (t) t.innerHTML = viewHelpToc();
  }
  function centreActiveChip() {
    const t = document.getElementById('helpToc'), on = t && t.querySelector('.on');
    if (on && t.scrollWidth > t.clientWidth) t.scrollLeft = on.offsetLeft - (t.clientWidth - on.offsetWidth) / 2;
  }
  function viewHelp() {
    const back = App.ui.helpFrom === 'game' ? 'Back to the board' : App.ui.helpFrom === 'end' ? 'Back to the debrief' : 'Back';
    return `<header class="topbar noprint"><div class="brand" data-act="home">TACK<small>V3</small></div><button class="btn sm" data-act="helpBack">← ${back}</button>
      <div class="stat hide-sm"><b>Help guide</b><span>every option, label and metric explained</span></div><div class="spacer"></div>
      <input type="search" id="helpQ" placeholder="Search, e.g. spread, margin, Sharpe" value="${esc(App.ui.helpQ)}" aria-label="Search the help guide" style="max-width:280px">
      <button class="btn sm hide-sm" data-act="print">Print / save PDF</button><button class="btn ghost sm" data-act="theme" aria-label="Toggle light/dark">◐</button></header>
      <div class="home help">
        <div class="printonly"><h1>Tack Market V3 · Help guide</h1><p>Every option, label and metric explained.</p></div>
        <div class="help-layout">
          <nav class="help-toc noprint" id="helpToc" aria-label="Help sections">${viewHelpToc()}</nav>
          <div id="helpBody">${viewHelpBody()}</div>
        </div>
        <div class="footer">All companies, prices and news in Tack Market are fictional. Nothing here is investment advice.</div>
      </div>
      <button class="totop noprint" id="toTop" data-act="toTop" aria-label="Back to top">↑ Top</button>`;
  }


  // ---------- Market Trader decision log (debrief) ----------
  const TR_GROUPS = { all: 'All', view: 'Market view', entry: 'Entries', exit: 'Exits', risk: 'Risk management', skip: 'Passed on' };
  const TR_BADGE = { BUY: 'up', SHORT: 'down', CORE: 'up', SELL: 'down', COVER: 'up', 'TAKE PROFIT': 'up', TRIM: 'warn', 'RAISE STOP': 'info', HEDGE: 'warn', UNHEDGE: 'info',
    'REDUCE CORE': 'warn', 'MARKET VIEW': 'info', RULES: 'warn', PASS: 'faint', 'STOP HIT': 'down', 'TARGET HIT': 'up' };
  function traderTimeline(w, g) {
    const a = g.bots.trader, log = (g.traderLog || []).slice();
    for (const f of a.fills) {
      if (f.source === 'margin') log.push({ t: f.d, during: true, kind: 'risk', action: 'MARGIN CALL', sym: f.sym, qty: f.qty, px: f.px, title: `Broker liquidated ${f.qty} ${f.sym}`, why: ['Equity fell below the maintenance requirement.'] });
      if (f.role !== 'stop' && f.role !== 'target') continue;
      const tr = a.trades.find((x) => x.exits.some((e) => e.orderId === f.id)) || a.openTrades[f.sym];
      log.push({ t: f.d, during: true, kind: 'exit', action: f.role === 'stop' ? 'STOP HIT' : 'TARGET HIT', sym: f.sym, qty: f.qty, px: f.px, fillId: f.id,
        title: `${f.role === 'stop' ? 'Stop hit' : 'Target hit'}: ${f.side === 'sell' ? 'sold' : 'bought back'} ${f.qty} ${f.sym} at $${F.px(f.px)}${f.gapped ? ' (gapped through the stop)' : ''}`,
        why: [f.role === 'stop' ? (f.gapped ? 'The stock opened beyond the stop, so the order filled at the open: the loss is larger than the planned 1R. Gaps are why position size matters more than the stop level.' : 'The protective stop placed at entry did its job: the trade was wrong or the trend ended, and the loss or locked-in gain was taken automatically without hesitation.') : 'The take-profit order filled.'],
        trade: tr });
    }
    log.sort((x, y) => x.t - y.t || (x.during ? -1 : 0) - (y.during ? -1 : 0));
    return log;
  }
  function traderOutcome(w, g, e) {
    const a = g.bots.trader;
    if (e.during) {
      const tr = e.trade;
      return tr && tr.closeDay != null ? { cls: cls(tr.net), text: `Trade closed: ${F.smoney(tr.net)}${tr.r != null ? ` (${tr.r.toFixed(2)}R)` : ''} after ${tr.closeDay - tr.openDay} days` } : null;
    }
    if (!e.orderId) return null;
    const o = a.orders.find((x) => x.id === e.orderId);
    const fill = a.fills.find((f) => f.id === e.orderId);
    if (!fill) return { cls: 'faint', text: o ? `Order ${o.status}${o.reason ? ': ' + o.reason : ''}` : 'Order not filled' };
    const head = `Filled ${fill.qty} at $${F.px(fill.px)} on ${F.sdate(fill.d)}`;
    if (e.kind === 'entry') {
      const tr = a.trades.find((x) => x.openOrderId === e.orderId);
      const why = (r) => r === 'manual' ? 'its own sell decision' : r === 'stop' ? 'its stop' : r === 'target' ? 'its target' : r;
      if (tr) return { cls: cls(tr.net), text: `${head} → closed ${F.sdate(tr.closeDay)} by ${why(tr.exitReason)}: ${F.smoney(tr.net)} (${F.spct(tr.retPct)}${tr.r != null ? `, ${tr.r.toFixed(2)}R` : ''})` };
      const op = a.openTrades[e.sym] && a.openTrades[e.sym].openOrderId === e.orderId ? a.pos[e.sym] : null;
      if (op) { const last = w.c[w.bySym[e.sym]][g.t], pnl = (last - op.avg) * op.qty; return { cls: cls(pnl), text: `${head} → still open at the end: ${F.smoney(pnl)} unrealised` }; }
      return { cls: '', text: head };
    }
    const tr = a.trades.find((x) => x.exits.some((ex) => ex.orderId === e.orderId));
    if (tr) return { cls: cls(tr.net), text: `${head} → whole trade ${F.smoney(tr.net)}${tr.r != null ? ` (${tr.r.toFixed(2)}R)` : ''} over ${tr.closeDay - tr.openDay} days` };
    return { cls: '', text: head };
  }
  function traderLessons(w, g, mY, mT) {
    const a = g.bots.trader, out = [];
    const entries = (g.traderLog || []).filter((e) => e.action === 'BUY' || e.action === 'SHORT');
    const maxRisk = entries.length ? Math.max(...entries.map((e) => e.riskPct || 0)) : 0;
    const views = (g.traderLog || []).filter((e) => e.action === 'MARKET VIEW');
    const passes = (g.traderLog || []).filter((e) => e.action === 'PASS').length;
    const stops = a.fills.filter((f) => f.role === 'stop').length;
    const youTraded = g.player.fills.length > 0;
    if (!youTraded) out.push(`You placed no trades, so your result is just interest on cash. Market Trader shows what taking measured risk in this market would have looked like, losses included.`);
    else if (mT.maxDD > mY.maxDD + 0.02) out.push(`Its worst drawdown was ${F.pct(mT.maxDD)} against your ${F.pct(mY.maxDD)}. Every position had a stop sized so that one loss cost about ${F.pct(maxRisk, 2)} of equity at most.`);
    else if (mY.maxDD > mT.maxDD + 0.02) out.push(`You kept drawdown lower (${F.pct(mY.maxDD)} vs ${F.pct(mT.maxDD)}). Good risk control on your part.`);
    const seq = views.map((v) => v.regime || v.title.split(' ').pop());
    if (views.length > 1) out.push(`It changed its market view ${views.length - 1} time${views.length > 2 ? 's' : ''} (${(seq.length > 6 ? ['…'].concat(seq.slice(-6)) : seq).join(' → ')}), adjusting total exposure each time rather than holding the same amount through every condition.`);
    out.push(`It let ${stops} stop${stops === 1 ? '' : 's'} do the selling, moved stops only in the direction of the trade, and passed on ${passes} high-scoring idea${passes === 1 ? '' : 's'} because the timing was wrong (earnings imminent, chasing a spike, or against the trend).`);
    if (mT.winRate != null) out.push(`Its win rate was ${F.pct(mT.winRate, 0)}${mY.winRate != null ? ` (yours ${F.pct(mY.winRate, 0)})` : ''}, with an average win of ${mT.avgWin != null ? F.money(mT.avgWin) : '–'} against an average loss of ${mT.avgLoss != null ? F.money(-mT.avgLoss) : '–'}. Professionals are often wrong more than half the time; they make money by keeping losses small and letting winners run.`);
    if (mT.excess < 0) out.push(`It did not beat the index this time (${F.spct(mT.excess)}). Disciplined risk control costs some return in strong rallies; the payoff shows in falling markets. Judge a process over many sessions, not one.`);
    return out;
  }
  function viewTraderSection(w, g) {
    const a = g.bots.trader;
    if (!a) return '';
    const mY = TM.metrics(w, g.player), mT = TM.metrics(w, a), mI = TM.metrics(w, g.bots.index);
    const row = (k, f) => `<tr><td>${k}</td>${[mY, mT, mI].map((m) => `<td class="num">${f(m)}</td>`).join('')}</tr>`;
    const tl = traderTimeline(w, g);
    const filt = App.ui.trFilter || 'all';
    const counts = {};
    for (const e of tl) counts[e.kind] = (counts[e.kind] || 0) + 1;
    const shown = tl.filter((e) => filt === 'all' || e.kind === filt);
    const item = (e) => {
      const out = traderOutcome(w, g, e);
      const when = e.during ? `During ${F.sdate(e.t)}` : `${F.sdate(e.t)} close`;
      return `<details class="tlog"><summary><span class="tlog-when">${when}</span><span class="tbadge ${TR_BADGE[e.action] || ''}">${esc(e.action)}</span><span class="tlog-title">${esc(e.title)}</span>${out ? `<span class="tlog-out ${out.cls}">${esc(out.text.split(' → ').pop())}</span>` : ''}</summary>
        <div class="tlog-body">${e.why && e.why.length ? `<div class="label">Reasoning</div><ol>${e.why.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        ${e.plan ? `<div class="label">Plan and sizing</div><p>${esc(e.plan)}</p>` : ''}
        ${e.data && e.data.length ? `<div class="label">Data it used</div><div class="tlog-data">${e.data.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
        ${out ? `<div class="label">What happened</div><p class="${out.cls}">${esc(out.text)}</p>` : ''}
        ${e.during ? '' : `<div class="tiny faint">Decided after the close on ${F.date(e.t)}; orders execute from the next open.</div>`}</div></details>`;
    };
    return `<div class="section panel pad" id="trader-log"><div class="row"><h3 class="grow">Market Trader: what a professional did with the same data</h3>${'<button class="qbtn" data-act="help" data-arg="trader" aria-label="Help: Market Trader">?</button>'}</div>
      <p class="small muted">Same market, same information, same ${a.margin ? 'margin' : 'cash'} account, same costs and your risk rules. It never saw the future: each decision below uses only what was visible at that evening's close, exactly as you saw it.</p>
      <div class="tablewrap"><table><thead><tr><th></th><th class="num">You</th><th class="num">Market Trader</th><th class="num">Index fund</th></tr></thead><tbody>
        ${row('Return', (m) => `<span class="${cls(m.total)}">${F.spct(m.total)}</span>`)}${row('Sharpe ratio', (m) => F.num(m.sharpe))}${row('Max drawdown', (m) => `<span class="down">${F.pct(m.maxDD)}</span>`)}
        ${row('Closed trades', (m) => String(m.trades))}${row('Win rate', (m) => F.pct(m.winRate, 0))}${row('Average R', (m) => F.num(m.avgR))}${row('Avg exposure', (m) => F.pct(m.gross, 0))}${row('Trading costs', (m) => F.money(m.frictions))}
      </tbody></table></div>
      <div class="label" style="margin:12px 0 4px">Lessons from the comparison</div><ul class="lessons">${traderLessons(w, g, mY, mT).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="row" style="margin:12px 0 6px;flex-wrap:wrap;gap:6px"><span class="label grow">Decision log · ${tl.length} entries</span>
        <button class="btn sm ghost" data-act="trExpand" data-arg="1">Expand all</button><button class="btn sm ghost" data-act="trExpand" data-arg="0">Collapse all</button></div>
      <div class="filters" style="margin-bottom:8px">${Object.entries(TR_GROUPS).map(([k, l]) => `<button class="${filt === k ? 'on' : ''}" data-act="trFilter" data-arg="${k}">${l}${k === 'all' ? ` (${tl.length})` : counts[k] ? ` (${counts[k]})` : ''}</button>`).join('')}</div>
      <div class="tlog-list">${shown.map(item).join('') || '<div class="empty">No entries of this type.</div>'}</div></div>`;
  }

  // ---------- charts ----------
  function prep(cv) {
    const dpr = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W: r.width, H: r.height };
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  function alpha(hex, a) {
    if (hex.startsWith('#') && hex.length === 7) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
    return hex;
  }
  function drawPrice() {
    const cv = document.getElementById('priceChart');
    if (!cv) return;
    const { ctx, W: Wd, H } = prep(cv);
    const w = W(), g = G(), sym = App.ui.sel, i = idx(sym), t = g.t;
    const n = Math.min(App.ui.range, t + 1), a0 = t - n + 1;
    const padL = 4, padR = 58, top = 22, bottom = 18;
    const volH = App.ui.showVol ? Math.round((H - top - bottom) * 0.17) : 0;
    const ph = H - top - bottom - volH - (volH ? 6 : 0);
    let lo = Infinity, hi = -Infinity;
    for (let d = a0; d <= t; d++) { lo = Math.min(lo, w.l[i][d]); hi = Math.max(hi, w.h[i][d]); }
    const accent = cssVar('--accent'), up = cssVar('--up'), dn = cssVar('--down'), info = cssVar('--info'), grid = cssVar('--grid'), faint = cssVar('--faint'), text = cssVar('--text'), panel = cssVar('--panel');
    const lines = [];
    const p = g.player.pos[sym];
    if (p) lines.push({ y: p.avg, label: 'avg', color: accent });
    for (const o of g.player.orders) {
      if (o.sym !== sym || (o.status !== 'open' && o.status !== 'pending')) continue;
      if (o.limit != null) lines.push({ y: o.limit, label: o.role === 'target' ? 'tgt' : 'lmt', color: info });
      if (o.stop != null) lines.push({ y: o.stop, label: 'stp', color: dn });
    }
    for (const L of lines) if (L.y > lo * 0.75 && L.y < hi * 1.3) { lo = Math.min(lo, L.y); hi = Math.max(hi, L.y); }
    const pad = (hi - lo) * 0.06 || 1;
    lo -= pad; hi += pad;
    const Y = (v) => top + (hi - v) / (hi - lo) * ph;
    const cw = (Wd - padL - padR) / n;
    const X = (d) => padL + (d - a0 + 0.5) * cw;
    App.geom = { a0, n, cw, padL, t };
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'middle';
    const step = niceStep((hi - lo) / 5);
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(Wd - padR, y); ctx.stroke();
      ctx.fillStyle = faint; ctx.fillText(v.toFixed(step < 1 ? 2 : 0), Wd - padR + 6, y);
    }
    let lastM = -1;
    ctx.textBaseline = 'alphabetic';
    for (let d = a0; d <= t; d++) {
      const m = new Date(w.dates[d]).getUTCMonth();
      if (m !== lastM) {
        if (d > a0 + 2) { ctx.fillStyle = faint; ctx.fillText(TM.fmtDate(w.dates[d], 'month'), X(d) - 8, H - 4); ctx.strokeStyle = grid; ctx.beginPath(); ctx.moveTo(Math.round(X(d)) + 0.5, top); ctx.lineTo(Math.round(X(d)) + 0.5, H - bottom); ctx.stroke(); }
        lastM = m;
      }
    }
    if (volH) {
      let vmax = 0;
      for (let d = a0; d <= t; d++) vmax = Math.max(vmax, w.v[i][d]);
      const vb = top + ph + 6 + volH;
      for (let d = a0; d <= t; d++) {
        const hgt = w.v[i][d] / vmax * volH;
        ctx.fillStyle = alpha(w.c[i][d] >= w.o[i][d] ? up : dn, 0.35);
        ctx.fillRect(X(d) - Math.max(0.5, cw * 0.35), vb - hgt, Math.max(1, cw * 0.7), hgt);
      }
    }
    const bw = Math.max(1, Math.min(9, cw * 0.66));
    for (let d = a0; d <= t; d++) {
      const o = w.o[i][d], h = w.h[i][d], l = w.l[i][d], c = w.c[i][d];
      const col = c >= o ? up : dn, x = Math.round(X(d)) + 0.5;
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, Y(h)); ctx.lineTo(x, Y(l)); ctx.stroke();
      const y1 = Y(Math.max(o, c)), y2 = Y(Math.min(o, c));
      ctx.fillStyle = col;
      ctx.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1));
    }
    const drawSma = (len, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      let started = false;
      for (let d = a0; d <= t; d++) {
        const v = TM.sma(w.c[i], d, len);
        if (v == null) continue;
        if (!started) { ctx.moveTo(X(d), Y(v)); started = true; } else ctx.lineTo(X(d), Y(v));
      }
      ctx.stroke();
    };
    if (App.ui.sma50) drawSma(50, cssVar('--sma50'));
    if (App.ui.sma20) drawSma(20, cssVar('--sma20'));
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    const earn = new Set(w.earnDays[i]);
    const divs = new Set(w.divDays[i].filter((x) => x.decl <= t).map((x) => x.d));
    for (let d = a0; d <= t; d++) {
      if (earn.has(d)) { ctx.fillStyle = cssVar('--warn'); ctx.fillText('E', X(d) - 3, top + ph - 2); }
      if (divs.has(d)) { ctx.fillStyle = info; ctx.fillText('D', X(d) - 3, top + ph - 12); }
      const ev = w.events[d].find((e) => e.sym === sym && e.type === 'news');
      if (ev) { ctx.fillStyle = ev.tone > 0 ? up : ev.tone < 0 ? dn : faint; ctx.beginPath(); ctx.arc(X(d), Y(w.h[i][d]) - 6, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'middle';
    const tag = (v, label, color, solid) => {
      if (v < lo || v > hi) return;
      const y = Y(v);
      ctx.strokeStyle = color; ctx.setLineDash(solid ? [] : [4, 3]); ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(Wd - padR, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.fillRect(Wd - padR + 1, y - 8, padR - 2, 16);
      ctx.fillStyle = panel; ctx.fillText(label, Wd - padR + 4, y);
    };
    for (const L of lines) tag(L.y, `${L.label} ${L.y.toFixed(2)}`, L.color, false);
    tag(w.c[i][t], w.c[i][t].toFixed(2), w.c[i][t] >= w.c[i][t - 1] ? up : dn, true);
    const hd = App.ui.hover != null && App.ui.hover >= a0 && App.ui.hover <= t ? App.ui.hover : t;
    if (App.ui.hover != null) {
      ctx.strokeStyle = faint; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(Math.round(X(hd)) + 0.5, top); ctx.lineTo(Math.round(X(hd)) + 0.5, H - bottom); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = text;
    ctx.textBaseline = 'top';
    const chd = hd > 0 ? w.c[i][hd] / w.c[i][hd - 1] - 1 : 0;
    const ohlc = `O ${w.o[i][hd].toFixed(2)}  H ${w.h[i][hd].toFixed(2)}  L ${w.l[i][hd].toFixed(2)}  C ${w.c[i][hd].toFixed(2)}`;
    let readout = `${TM.fmtDate(w.dates[hd])}  ${ohlc}  ${(chd * 100).toFixed(2)}%  Vol ${F.big(w.v[i][hd])}`;
    if (ctx.measureText(readout).width > Wd - padR) readout = `${TM.fmtDate(w.dates[hd], 'short')}  ${ohlc}  ${(chd * 100).toFixed(1)}%`;
    if (ctx.measureText(readout).width > Wd - padR) readout = `${TM.fmtDate(w.dates[hd], 'short')}  C ${w.c[i][hd].toFixed(2)}  ${(chd * 100).toFixed(1)}%  H ${w.h[i][hd].toFixed(2)}  L ${w.l[i][hd].toFixed(2)}`;
    ctx.fillText(readout, padL + 2, 4);
  }
  function drawLines(id, sel, opts) {
    const cv = document.getElementById(id);
    if (!cv) return;
    const { ctx, W: Wd, H } = prep(cv);
    const w = W(), g = G(), start = w.start, t = g.t;
    const accts = { you: g.player };
    for (const b of botDefs(g)) accts[b.id] = g.bots[b.id];
    const series = SERIES.filter((s) => sel[s.id] && accts[s.id]).map((s) => ({ color: cssVar(s.v), you: s.id === 'you', vals: (opts && opts.dd ? TM.drawdown(accts[s.id].equity.map((e) => e.eq)).series : accts[s.id].equity.map((e) => e.eq / accts[s.id].startCash - 1)) }));
    const padL = 6, padR = 52, top = 8, bottom = 18;
    let lo = 0, hi = 0;
    for (const s of series) for (const v of s.vals) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (hi - lo < 0.02) { hi += 0.01; lo -= 0.01; }
    const span = Math.max(1, t - start);
    const X = (k) => padL + k / span * (Wd - padL - padR);
    const Y = (v) => top + (hi - v) / (hi - lo) * (H - top - bottom);
    const grid = cssVar('--grid'), faint = cssVar('--faint');
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'middle';
    const step = niceStep((hi - lo) / 4);
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
      const y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = Math.abs(v) < 1e-9 ? faint : grid; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(Wd - padR, y); ctx.stroke();
      ctx.fillStyle = faint; ctx.fillText((v * 100).toFixed(step < 0.01 ? 1 : 0) + '%', Wd - padR + 6, y);
    }
    ctx.textBaseline = 'alphabetic';
    let lastM = -1;
    for (let d = start; d <= t; d++) {
      const m = new Date(w.dates[d]).getUTCMonth();
      if (m !== lastM) { if (d > start + 2) { ctx.fillStyle = faint; ctx.fillText(TM.fmtDate(w.dates[d], 'month'), X(d - start) - 8, H - 4); } lastM = m; }
    }
    for (const s of series.sort((x, y) => x.you - y.you)) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.you ? 2.5 : 1.5;
      ctx.beginPath();
      s.vals.forEach((v, k) => { if (k) ctx.lineTo(X(k), Y(v)); else ctx.moveTo(X(k), Y(v)); });
      ctx.stroke();
    }
  }
  function drawRegime(id) {
    const cv = document.getElementById(id);
    if (!cv) return;
    const { ctx, W: Wd, H } = prep(cv);
    const w = W(), g = G(), start = w.start, t = g.t, padL = 6, padR = 52;
    const span = Math.max(1, t - start), bw = (Wd - padL - padR) / span;
    for (let d = start + 1; d <= t; d++) { ctx.fillStyle = cssVar('--reg-' + w.regime[d]); ctx.fillRect(padL + (d - start - 1) * bw, 0, bw + 0.5, H); }
    let lo = Infinity, hi = -Infinity;
    for (let d = start; d <= t; d++) { lo = Math.min(lo, w.tmx[d]); hi = Math.max(hi, w.tmx[d]); }
    ctx.strokeStyle = cssVar('--text'); ctx.lineWidth = 1.5; ctx.beginPath();
    for (let d = start; d <= t; d++) { const x = padL + (d - start) * bw, y = 6 + (hi - w.tmx[d]) / (hi - lo || 1) * (H - 12); if (d === start) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = cssVar('--faint'); ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'; ctx.textBaseline = 'middle';
    ctx.fillText('TMX', Wd - padR + 6, H / 2);
  }
  function drawCharts() {
    if (App.screen === 'game') {
      drawPrice();
      if (App.ui.tab === 'performance') { drawLines('perfChart', App.ui.perf); drawLines('ddChart', { you: true, index: true }, { dd: true }); }
    } else if (App.screen === 'end') {
      drawLines('endChart', App.ui.endPerf); drawRegime('regimeChart');
    }
  }

  // ---------- render & events ----------
  function render() {
    const root = document.getElementById('app');
    const keep = {};
    root.querySelectorAll('[data-keep]').forEach((el) => { keep[el.dataset.keep] = el.scrollTop; });
    const ae = document.activeElement;
    const focusBind = ae && ae.dataset ? ae.dataset.bind : null;
    if (App.screen === 'game' && App.game) root.innerHTML = viewGame();
    else if (App.screen === 'end' && App.game) root.innerHTML = viewEnd();
    else if (App.screen === 'help') root.innerHTML = viewHelp();
    else { App.screen = 'home'; root.innerHTML = viewHome(); }
    const where = App.screen === 'game' && App.game && App.game.status === 'active' ? 'game' : App.screen === 'help' ? App.progress.lastScreen : 'home';
    if (where !== App.progress.lastScreen) { App.progress.lastScreen = where; saveProgress(); }
    root.querySelectorAll('[data-keep]').forEach((el) => { if (keep[el.dataset.keep] != null) el.scrollTop = keep[el.dataset.keep]; });
    if (focusBind) { const el = root.querySelector(`[data-bind="${focusBind}"]`); if (el && el.type !== 'checkbox' && el.tagName !== 'SELECT') el.focus(); }
    drawCharts();
    watchCanvases();
    setTopbarHeight();
    if (App.screen === 'game') updatePreview();
  }
  // Sticky elements sit just under the top bar, whose height changes with screen width.
  function setTopbarHeight() {
    const tb = document.querySelector('.topbar');
    document.documentElement.style.setProperty('--tb', (tb ? tb.offsetHeight : 0) + 'px');
  }
  // Redraw charts whenever their size changes: folding/unfolding a phone, rotating, or resizing a window.
  let ro = null;
  function watchCanvases() {
    if (!window.ResizeObserver) return;
    if (ro) ro.disconnect();
    let pending = false;
    const sizes = new WeakMap();
    ro = new ResizeObserver((entries) => {
      const changed = entries.some((en) => { const k = Math.round(en.contentRect.width) + 'x' + Math.round(en.contentRect.height); const prev = sizes.get(en.target); sizes.set(en.target, k); return prev !== undefined && prev !== k; });
      if (!changed || pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; drawCharts(); });
    });
    document.querySelectorAll('#app canvas').forEach((c) => ro.observe(c));
  }

  function init() {
    applyTheme();
    loadSaved();
    if (App.screen !== 'home' && App.game && App.game.status === 'active') App.ui.banner = null;
    render();
    document.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = ACTIONS[el.dataset.act];
      if (fn) { if (el.tagName !== 'INPUT') ev.preventDefault(); fn(el.dataset.arg, el, ev); }
    });
    document.addEventListener('keydown', (ev) => {
      const tag = ev.target.tagName;
      if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('wrow')) { ACTIONS.sel(ev.target.dataset.arg); return; }
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if ((ev.key === 'n' || ev.key === 'N') && App.screen === 'game') { ev.preventDefault(); nextDays(1); }
    });
    document.addEventListener('input', (ev) => {
      const el = ev.target;
      if (el.id === 'helpQ') { App.ui.helpQ = el.value; refreshHelp(); window.scrollTo(0, 0); return; }
      if (!el.dataset || !el.dataset.bind) return;
      setBind(el.dataset.bind, el);
      if (el.dataset.live) updatePreview();
    });
    document.addEventListener('change', (ev) => {
      const el = ev.target;
      if (el.id === 'importFile' && el.files && el.files[0]) { importFile(el.files[0]); el.value = ''; return; }
      if (!el.dataset || !el.dataset.bind) return;
      setBind(el.dataset.bind, el);
      if (el.dataset.rerender || el.dataset.bind.startsWith('rules.') || el.dataset.bind.startsWith('botCfg.')) render();
      else if (el.dataset.live) updatePreview();
    });
    const scrub = (ev) => {
      if (ev.target.id !== 'priceChart' || !App.geom) return;
      const r = ev.target.getBoundingClientRect();
      const d = Math.max(App.geom.a0, Math.min(App.geom.t, App.geom.a0 + Math.floor((ev.clientX - r.left - App.geom.padL) / App.geom.cw)));
      if (d !== App.ui.hover) { App.ui.hover = d; drawPrice(); }
    };
    document.addEventListener('pointermove', scrub);
    document.addEventListener('pointerdown', scrub);
    document.addEventListener('pointerout', (ev) => { if (ev.target.id === 'priceChart' && ev.pointerType === 'mouse' && App.ui.hover != null) { App.ui.hover = null; drawPrice(); } });
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { drawCharts(); setTopbarHeight(); }, 120); });
    window.addEventListener('scroll', () => { const b = document.getElementById('toTop'); if (b) b.classList.toggle('show', window.scrollY > 500); }, { passive: true });
    if (window.matchMedia) matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (!App.progress.theme) render(); });
  }
  ACTIONS.noop = () => {};
  ACTIONS.trFilter = (arg) => { App.ui.trFilter = arg; const el = document.getElementById('trader-log'); if (el) { el.outerHTML = viewTraderSection(W(), G()); } };
  ACTIONS.trExpand = (arg) => { document.querySelectorAll('#trader-log details.tlog').forEach((d) => { d.open = arg === '1'; }); };
  ACTIONS.help = (arg) => {
    if (App.screen !== 'help') App.ui.helpFrom = App.screen;
    App.ui.helpSec = arg || 'start';
    App.ui.helpQ = '';
    App.screen = 'help';
    render();
    window.scrollTo(0, 0);
    centreActiveChip();
  };
  ACTIONS.helpGo = (arg) => {
    App.ui.helpSec = arg;
    App.ui.helpQ = '';
    const qi = document.getElementById('helpQ');
    if (qi) qi.value = '';
    refreshHelp();
    window.scrollTo(0, 0);
    centreActiveChip();
  };
  ACTIONS.toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  ACTIONS.helpBack = () => { App.screen = App.ui.helpFrom === 'help' || !App.game && App.ui.helpFrom !== 'home' ? 'home' : App.ui.helpFrom; render(); window.scrollTo(0, 0); };
  ACTIONS.print = () => {
    App.ui.helpPrintAll = true;
    refreshHelp();
    const done = () => { App.ui.helpPrintAll = false; refreshHelp(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(TM);
