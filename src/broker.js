/* Tack Market V3 · broker
   Accounts, order types, fills against the day's open/high/low/close path, trading costs,
   dividends, interest, short borrow, margin and forced liquidation. Players and bots use the
   same code, so every competitor pays the same frictions. */
var TM = typeof TM !== 'undefined' ? TM : {};
(function (TM) {
  'use strict';

  const COST_MODELS = {
    retail: { label: 'Retail broker', desc: '$0.005/share, $1 minimum, plus the bid/ask spread and market impact.', perShare: 0.005, min: 1, maxPct: 0.01, spread: 1, impact: 1 },
    zero: { label: 'Zero-commission app', desc: 'No commission, but order-flow routing gives you a wider effective spread.', perShare: 0, min: 0, maxPct: 0, spread: 1.6, impact: 1 },
    none: { label: 'Frictionless (unrealistic)', desc: 'No costs at all. Useful only to measure how much costs hurt you.', perShare: 0, min: 0, maxPct: 0, spread: 0, impact: 0 }
  };
  const MARGIN = { initial: 0.5, maintLong: 0.25, maintShort: 0.30 };
  const CASH_RATE_SPREAD = 0.005;   // cash earns the policy rate minus 0.5%
  const DEBIT_RATE_SPREAD = 0.025;  // margin loans cost the policy rate plus 2.5%
  const GTC_DAYS = 60;
  const IMPACT_Y = 0.7;             // square-root impact law coefficient

  const r2 = (x) => Math.round(x * 100) / 100;

  function newAccount(id, label, cash, opts) {
    opts = opts || {};
    return {
      id, label, startCash: cash, cash, margin: !!opts.margin, costModel: opts.costModel || 'retail', track: !!opts.track,
      pos: {}, orders: [], nextId: 1, fills: [], trades: [], openTrades: {}, nextTradeId: 1,
      equity: [], peak: cash, realized: 0, activity: [],
      costs: { commission: 0, spread: 0, impact: 0, borrow: 0, interest: 0, dividends: 0 },
      turnover: 0, rules: opts.rules || null, lockoutT: null,
      beh: { rg: 0, rl: 0, pg: 0, pl: 0, chase: 0, buys: 0, avgDown: 0, stopWiden: 0, marginCalls: 0, noStop: 0, opens: 0 }
    };
  }

  // ---------- valuation ----------
  function markPrice(world, sym, d) { return world.c[world.bySym[sym]][d]; }
  function exposures(world, acct, d, override) {
    let long = 0, short = 0;
    for (const sym in acct.pos) {
      const q = acct.pos[sym].qty;
      const px = override && override.sym === sym ? override.px : markPrice(world, sym, d);
      if (q > 0) long += q * px; else short += -q * px;
    }
    return { long, short, equity: acct.cash + long - short };
  }
  function equityAt(world, acct, d) { return exposures(world, acct, d).equity; }

  // Buying power for new opening trades, at last close prices.
  // Queued orders reserve buying power so the same money cannot be committed twice.
  // Cash account: queued buys hold their value plus estimated costs.
  // Margin account: queued opening orders (buys and shorts) hold exposure, and their costs hold equity.
  function reserved(world, acct, d) {
    const r = { cash: 0, exposure: 0, orders: 0 };
    for (const o of acct.orders) {
      if (o.status !== 'open' || o.reduceOnly) continue;
      const i = world.bySym[o.sym];
      const px = o.type === 'market' ? markPrice(world, o.sym, d) : o.type === 'limit' || o.type === 'stoplimit' ? o.limit : o.stop;
      const notional = o.qty * px;
      const cost = estimateCosts(world, acct, i, d + 1, o.qty, px, true).total;
      if (!acct.margin) { if (o.side === 'buy') { r.cash += notional + cost; r.orders++; } }
      else if (o.opening) { r.exposure += notional; r.cash += cost; r.orders++; }
    }
    return r;
  }
  function buyingPower(world, acct, d) {
    const ex = exposures(world, acct, d), res = reserved(world, acct, d);
    if (!acct.margin) return Math.max(0, acct.cash - res.cash);
    return Math.max(0, (ex.equity - res.cash) / MARGIN.initial - (ex.long + ex.short) - res.exposure);
  }
  // Shares already promised to other queued (non-protective) orders on the same side.
  function committedQty(acct, sym, side, excludeId) {
    let q = 0;
    for (const o of acct.orders) if (o.status === 'open' && !o.reduceOnly && o.sym === sym && o.side === side && o.id !== excludeId) q += o.qty;
    return q;
  }
  // How an order of qty shares relates to the position: room = shares it can close without reversing.
  function orderEffect(acct, sym, side, qty) {
    const held = acct.pos[sym] ? acct.pos[sym].qty : 0;
    const closable = side === 'sell' ? Math.max(0, held) : Math.max(0, -held);
    const committed = committedQty(acct, sym, side);
    const room = Math.max(0, closable - committed);
    return { held, closable, committed, room, excess: Math.max(0, qty - room), opening: closable === 0 || qty > room };
  }

  // ---------- costs ----------
  function commission(model, qty, px) {
    if (!model.perShare && !model.min) return 0;
    const c = Math.max(model.min, model.perShare * qty);
    return model.maxPct ? Math.min(c, qty * px * model.maxPct) : c;
  }
  // Per-share half-spread and impact for a liquidity-taking order executed on day d.
  function costParts(world, acct, i, d, qty, px) {
    const model = COST_MODELS[acct.costModel] || COST_MODELS.retail;
    const dd = Math.min(d, world.T - 1);
    const half = px * TM.spreadBps(world, i, dd) / 2 / 1e4 * model.spread;
    const impact = px * IMPACT_Y * world.rv20[i][dd] * Math.sqrt(qty / Math.max(1, world.adv20[i][dd])) * model.impact;
    return { half, impact, model };
  }
  function estimateCosts(world, acct, i, d, qty, px, taker) {
    const p = costParts(world, acct, i, d, qty, px);
    const comm = commission(p.model, qty, px);
    const slip = taker ? (p.half + p.impact) * qty : 0;
    return { commission: comm, spread: taker ? p.half * qty : 0, impact: taker ? p.impact * qty : 0, total: comm + slip,
      bps: qty * px > 0 ? (comm + slip) / (qty * px) * 1e4 : 0 };
  }

  // ---------- orders ----------
  function isOpening(acct, sym, side) {
    const q = acct.pos[sym] ? acct.pos[sym].qty : 0;
    return side === 'buy' ? q >= 0 : q <= 0;
  }
  // spec: { sym, side, qty, type, limit, stop, tif, bracket: {stop, target}, plannedStop, plannedTarget, tag, note, source }
  function placeOrder(world, acct, spec, t) {
    const errors = [];
    const qty = Math.floor(Number(spec.qty));
    if (!(world.bySym[spec.sym] >= 0)) errors.push('Unknown symbol.');
    if (!(qty > 0)) errors.push('Quantity must be a whole number above zero.');
    const type = spec.type || 'market';
    const limit = spec.limit != null && spec.limit !== '' ? Number(spec.limit) : null;
    const stop = spec.stop != null && spec.stop !== '' ? Number(spec.stop) : null;
    if ((type === 'limit' || type === 'stoplimit') && !(limit > 0)) errors.push('Enter a limit price.');
    if ((type === 'stop' || type === 'stoplimit') && !(stop > 0)) errors.push('Enter a stop price.');
    const eff = orderEffect(acct, spec.sym, spec.side, qty);
    const opening = eff.opening, held = eff.held;
    if (!acct.margin && spec.side === 'sell' && held > 0 && qty > eff.room) errors.push(`Only ${eff.room} of your ${held} shares are free: ${eff.committed} are already committed to queued sell orders.`);
    else if (!acct.margin && spec.side === 'sell' && qty > Math.max(0, held)) errors.push(held > 0 ? `You only hold ${held} shares. A cash account cannot go short.` : 'A cash account cannot sell short. Switch to a margin account to short.');
    if (opening && acct.lockoutT === t) errors.push('Cool-off: your daily loss limit was hit, so new positions are blocked until tomorrow.');
    if (spec.bracket) {
      const b = spec.bracket;
      if (b.stop != null && b.stop !== '' && !(Number(b.stop) > 0)) errors.push('Bracket stop must be a positive price.');
      if (b.target != null && b.target !== '' && !(Number(b.target) > 0)) errors.push('Bracket target must be a positive price.');
    }
    if (errors.length) return { ok: false, errors };

    const base = { sym: spec.sym, tif: spec.tif === 'gtc' ? 'gtc' : 'day', placedT: t, source: spec.source || 'manual' };
    const parent = Object.assign({}, base, {
      id: acct.nextId++, side: spec.side, qty, type, limit, stop, status: 'open', triggered: false,
      opening, tag: spec.tag || '', note: spec.note || '',
      plannedStop: spec.bracket && spec.bracket.stop ? Number(spec.bracket.stop) : (spec.plannedStop ? Number(spec.plannedStop) : null),
      plannedTarget: spec.bracket && spec.bracket.target ? Number(spec.bracket.target) : (spec.plannedTarget ? Number(spec.plannedTarget) : null),
      flags: spec.flags || {}
    });
    acct.orders.push(parent);
    const children = [];
    if (spec.bracket && (spec.bracket.stop || spec.bracket.target)) {
      const exitSide = spec.side === 'buy' ? 'sell' : 'buy';
      const group = 'oco' + parent.id;
      if (spec.bracket.stop) children.push(Object.assign({}, base, { id: acct.nextId++, side: exitSide, qty, type: 'stop', stop: Number(spec.bracket.stop), limit: null, status: 'pending', parentId: parent.id, oco: group, reduceOnly: true, tif: 'gtc', role: 'stop' }));
      if (spec.bracket.target) children.push(Object.assign({}, base, { id: acct.nextId++, side: exitSide, qty, type: 'limit', limit: Number(spec.bracket.target), stop: null, status: 'pending', parentId: parent.id, oco: group, reduceOnly: true, tif: 'gtc', role: 'target' }));
      children.forEach((ch) => acct.orders.push(ch));
    }
    if (acct.track && opening) {
      acct.beh.opens++;
      if (!parent.plannedStop) acct.beh.noStop++;
      if (spec.side === 'buy') {
        acct.beh.buys++;
        if (parent.flags.chase) acct.beh.chase++;
      }
      if (parent.flags.avgDown) acct.beh.avgDown++;
    }
    return { ok: true, order: parent, children };
  }
  function cancelOrder(acct, id, reason) {
    const o = acct.orders.find((x) => x.id === id);
    if (!o || (o.status !== 'open' && o.status !== 'pending')) return false;
    o.status = 'cancelled';
    o.reason = reason || 'Cancelled';
    for (const ch of acct.orders) if (ch.parentId === id && (ch.status === 'pending' || ch.status === 'open')) { ch.status = 'cancelled'; ch.reason = 'Parent cancelled'; }
    return true;
  }
  // Behaviour tracking: moving a protective stop further from the market is a classic mistake.
  function modifyOrder(world, acct, id, changes, t) {
    const o = acct.orders.find((x) => x.id === id);
    if (!o || (o.status !== 'open' && o.status !== 'pending')) return { ok: false, errors: ['Order is no longer working.'] };
    const qty = changes.qty != null ? Math.floor(Number(changes.qty)) : o.qty;
    if (!(qty > 0)) return { ok: false, errors: ['Quantity must be above zero.'] };
    if (changes.stop != null && o.stop != null) {
      const ns = Number(changes.stop);
      if (!(ns > 0)) return { ok: false, errors: ['Stop must be positive.'] };
      const widened = o.side === 'sell' ? ns < o.stop : ns > o.stop;
      if (acct.track && widened && o.reduceOnly) acct.beh.stopWiden++;
      o.stop = ns;
    }
    if (changes.limit != null && o.limit != null) {
      const nl = Number(changes.limit);
      if (!(nl > 0)) return { ok: false, errors: ['Limit must be positive.'] };
      o.limit = nl;
    }
    o.qty = qty;
    o.modifiedT = t;
    return { ok: true };
  }

  // ---------- intraday path ----------
  function dayPath(world, i, d) {
    const o = world.o[i][d], h = world.h[i][d], l = world.l[i][d], c = world.c[i][d];
    return world.lowFirst[i][d] ? [o, l, h, c] : [o, h, l, c];
  }
  // Positions: point j -> j, crossing inside segment (j-1, j) -> j - 0.5.
  function subPath(path, start) {
    if (!start) return { pts: path.slice(), pos: [0, 1, 2, 3] };
    const first = Number.isInteger(start.k) ? start.k + 1 : Math.ceil(start.k);
    const pts = [start.px], pos = [start.k];
    for (let j = first; j < path.length; j++) { pts.push(path[j]); pos.push(j); }
    return { pts, pos };
  }
  function evalOrder(o, pts, pos) {
    const buy = o.side === 'buy';
    let type = o.type;
    if (type === 'stoplimit' && o.triggered) type = 'limit';
    if (type === 'market') return { k: pos[0], px: pts[0], taker: true };
    if (type === 'limit') {
      const L = o.limit;
      if (buy ? pts[0] <= L : pts[0] >= L) return { k: pos[0], px: buy ? Math.min(pts[0], L) : Math.max(pts[0], L), taker: pos[0] === 0 };
      for (let m = 1; m < pts.length; m++) {
        if (buy ? Math.min(pts[m - 1], pts[m]) <= L : Math.max(pts[m - 1], pts[m]) >= L) return { k: (pos[m - 1] + pos[m]) / 2, px: L, taker: false };
      }
      return null;
    }
    const S = o.stop;
    let tk = null, tpx = null, tm = -1;
    if (buy ? pts[0] >= S : pts[0] <= S) { tk = pos[0]; tpx = pts[0]; tm = 0; }
    else {
      for (let m = 1; m < pts.length; m++) {
        if (buy ? Math.max(pts[m - 1], pts[m]) >= S : Math.min(pts[m - 1], pts[m]) <= S) { tk = (pos[m - 1] + pos[m]) / 2; tpx = S; tm = m; break; }
      }
    }
    if (tk === null) return null;
    if (type === 'stop') return { k: tk, px: tpx, taker: true, stopFill: true, gapped: tm === 0 && tpx !== S };
    const L = o.limit;
    if (buy ? tpx <= L : tpx >= L) return { k: tk, px: tpx, taker: true, stopFill: true };
    const rest = tm === 0 ? pts.slice(1) : pts.slice(tm), restPos = tm === 0 ? pos.slice(1) : pos.slice(tm);
    const rp = [tpx].concat(rest), rpos = [tk].concat(restPos);
    for (let m = 1; m < rp.length; m++) {
      if (buy ? Math.min(rp[m - 1], rp[m]) <= L : Math.max(rp[m - 1], rp[m]) >= L) return { k: (rpos[m - 1] + rpos[m]) / 2, px: L, taker: false };
    }
    return { k: tk, triggeredOnly: true };
  }

  // ---------- fills & positions ----------
  function openTrade(acct, sym, dir, d, px, order) {
    const tr = {
      id: acct.nextTradeId++, sym, dir, openDay: d, closeDay: null, entryPx: px, entryQty: 0, qtyMax: 0, realized: 0, fees: 0, divs: 0, borrow: 0,
      plannedStop: order && order.plannedStop || null, plannedTarget: order && order.plannedTarget || null,
      tag: order && order.tag || '', note: order && order.note || '', lesson: '', exits: [], adds: 0, mae: 0, mfe: 0,
      chase: !!(order && order.flags && order.flags.chase), exitReason: null
    };
    acct.openTrades[sym] = tr;
    return tr;
  }
  function closeTrade(acct, sym, d, reason) {
    const tr = acct.openTrades[sym];
    if (!tr) return;
    tr.closeDay = d;
    tr.exitReason = reason;
    tr.net = tr.realized + tr.divs - tr.fees - tr.borrow;
    const risk = tr.plannedStop ? Math.abs(tr.entryPx - tr.plannedStop) * tr.qtyMax : null;
    tr.r = risk ? tr.net / risk : null;
    tr.retPct = tr.net / (tr.entryPx * tr.qtyMax);
    acct.trades.push(tr);
    delete acct.openTrades[sym];
  }
  function applyFill(acct, sym, dq, px, d, comm, order, reason) {
    let p = acct.pos[sym];
    if (!p) p = acct.pos[sym] = { qty: 0, avg: 0, openDay: d };
    let rem = dq;
    if (p.qty !== 0 && Math.sign(dq) !== Math.sign(p.qty)) {
      const closeQty = Math.min(Math.abs(dq), Math.abs(p.qty));
      const pnl = (px - p.avg) * closeQty * Math.sign(p.qty);
      acct.realized += pnl;
      const tr = acct.openTrades[sym];
      if (tr) { tr.realized += pnl; tr.fees += comm; tr.exits.push({ d, qty: closeQty, px, reason }); }
      comm = 0;
      p.qty += Math.sign(dq) * closeQty;
      rem = dq - Math.sign(dq) * closeQty;
      if (p.qty === 0) { closeTrade(acct, sym, d, reason); p.avg = 0; }
    }
    if (rem !== 0) {
      let tr = acct.openTrades[sym];
      if (p.qty === 0) { p.avg = px; p.openDay = d; tr = openTrade(acct, sym, Math.sign(rem), d, px, order); }
      else {
        p.avg = (p.avg * Math.abs(p.qty) + px * Math.abs(rem)) / (Math.abs(p.qty) + Math.abs(rem));
        if (tr) { tr.adds++; if (order && order.plannedStop && !tr.plannedStop) tr.plannedStop = order.plannedStop; }
      }
      p.qty += rem;
      if (tr) { tr.entryQty += Math.abs(rem); tr.entryPx = p.avg; tr.qtyMax = Math.max(tr.qtyMax, Math.abs(p.qty)); tr.fees += comm; }
    }
    if (p.qty === 0) delete acct.pos[sym];
  }

  // Executes one order at a path price. Returns { qty, px } or { reject } / { cancel }.
  function execute(world, acct, o, d, hit) {
    const i = world.bySym[o.sym];
    const buy = o.side === 'buy';
    const held = acct.pos[o.sym] ? acct.pos[o.sym].qty : 0;
    let qty = o.qty;
    if (o.reduceOnly) {
      const room = buy ? Math.max(0, -held) : Math.max(0, held);
      qty = Math.min(qty, room);
      if (!qty) return { cancel: 'Position already closed' };
    }
    if (!acct.margin && !buy && qty > Math.max(0, held)) {
      if (held <= 0) return { reject: 'Cash account cannot short' };
      qty = held;
    }
    const parts = costParts(world, acct, i, d, qty, hit.px);
    let px = hit.px;
    if (hit.taker) px += (buy ? 1 : -1) * (parts.half + parts.impact);
    if (o.type === 'limit' || (o.type === 'stoplimit' && !hit.stopFill)) px = buy ? Math.min(px, o.limit) : Math.max(px, o.limit);
    px = Math.max(0.01, r2(px));
    const comm = commission(parts.model, qty, px);
    const dq = buy ? qty : -qty;
    const opening = buy ? held >= 0 : held <= 0;
    if (buy && !acct.margin && qty * px + comm > acct.cash + 1e-6) return { reject: 'Insufficient cash' };
    if (acct.margin && opening) {
      let long = 0, short = 0;
      for (const s in acct.pos) {
        const q = s === o.sym ? acct.pos[s].qty + dq : acct.pos[s].qty;
        const m = s === o.sym ? px : world.c[world.bySym[s]][d - 1];
        if (q > 0) long += q * m; else short += -q * m;
      }
      if (!acct.pos[o.sym]) { if (dq > 0) long += dq * px; else short += -dq * px; }
      const cashAfter = acct.cash - dq * px - comm;
      const eqAfter = cashAfter + long - short;
      if (eqAfter < MARGIN.initial * (long + short) - 1e-6) return { reject: 'Insufficient buying power' };
    }
    const mid = hit.px;
    acct.cash -= dq * px + comm;
    acct.costs.commission += comm;
    if (hit.taker) { acct.costs.spread += parts.half * qty; acct.costs.impact += parts.impact * qty; }
    acct.turnover += qty * px;
    const reason = o.role === 'stop' ? 'stop' : o.role === 'target' ? 'target' : o.source === 'margin' ? 'margin call' : o.type === 'stop' || o.type === 'stoplimit' ? 'stop' : 'manual';
    applyFill(acct, o.sym, dq, px, d, comm, o, reason);
    const fill = { d, id: o.id, sym: o.sym, side: o.side, qty, px, mid, type: o.type, role: o.role || null, comm,
      slip: hit.taker ? (parts.half + parts.impact) * qty : 0, gapped: !!hit.gapped, source: o.source };
    acct.fills.push(fill);
    return { qty, px, fill };
  }

  // Advances one account through day d (the bar of day d is now revealed).
  function processDay(world, acct, d) {
    const sum = { d, fills: [], rejects: [], expired: [], divs: 0, interest: 0, borrow: 0, marginCall: null, notes: [] };
    const startPos = {};
    for (const s in acct.pos) startPos[s] = { qty: acct.pos[s].qty, avg: acct.pos[s].avg };

    // 1. dividends go to whoever held at the previous close; shorts pay them
    for (const s in acct.pos) {
      const i = world.bySym[s], dv = world.divAmt[i][d];
      if (!dv) continue;
      const amt = acct.pos[s].qty * dv;
      acct.cash += amt;
      acct.costs.dividends += amt;
      if (acct.openTrades[s]) acct.openTrades[s].divs += amt;
      sum.divs += amt;
      acct.activity.push({ d, kind: 'div', text: `${amt >= 0 ? 'Received' : 'Paid'} dividend on ${s}: $${dv.toFixed(2)} x ${Math.abs(acct.pos[s].qty)} = ${amt >= 0 ? '' : '-'}$${Math.abs(amt).toFixed(2)}` });
    }

    // 2. orders, processed in the order they trigger along each stock's intraday path
    const paths = {};
    const pathOf = (sym) => paths[sym] || (paths[sym] = dayPath(world, world.bySym[sym], d));
    const done = new Set();
    for (let guard = 0; guard < 500; guard++) {
      let best = null;
      for (const o of acct.orders) {
        if (o.status !== 'open' || done.has(o.id) || o.placedT >= d) continue;
        const sp = subPath(pathOf(o.sym), o._start);
        const hit = evalOrder(o, sp.pts, sp.pos);
        if (!hit) continue;
        if (hit.triggeredOnly) { o.triggered = true; done.add(o.id); continue; }
        if (!best || hit.k < best.hit.k || (hit.k === best.hit.k && o.id < best.o.id)) best = { o, hit };
      }
      if (!best) break;
      const { o, hit } = best;
      done.add(o.id);
      const res = execute(world, acct, o, d, hit);
      if (res.cancel) { o.status = 'cancelled'; o.reason = res.cancel; continue; }
      if (res.reject) {
        o.status = 'rejected'; o.reason = res.reject;
        sum.rejects.push(o);
        acct.activity.push({ d, kind: 'reject', text: `Order #${o.id} ${o.side.toUpperCase()} ${o.qty} ${o.sym} rejected: ${res.reject}` });
        for (const ch of acct.orders) if (ch.parentId === o.id && ch.status === 'pending') { ch.status = 'cancelled'; ch.reason = 'Parent rejected'; }
        continue;
      }
      o.status = 'filled'; o.fillPx = res.px; o.fillQty = res.qty; o.fillDay = d;
      sum.fills.push(res.fill);
      for (const ch of acct.orders) {
        if (ch.parentId === o.id && ch.status === 'pending') { ch.status = 'open'; ch.qty = res.qty; ch._start = { k: hit.k, px: hit.px }; ch.placedT = d - 1; }
      }
      if (o.oco) for (const sib of acct.orders) if (sib.oco === o.oco && sib.id !== o.id && (sib.status === 'open' || sib.status === 'pending')) { sib.status = 'cancelled'; sib.reason = 'OCO: other side filled'; }
    }
    for (const o of acct.orders) delete o._start;

    // 3. expiry
    for (const o of acct.orders) {
      if (o.status !== 'open' || o.placedT >= d) continue;
      if (o.tif === 'day' || d - o.placedT >= GTC_DAYS) { o.status = 'expired'; o.reason = o.tif === 'day' ? 'Day order not filled' : 'GTC order expired'; sum.expired.push(o); }
    }
    // protective orders on a position that no longer exists are pointless
    for (const o of acct.orders) if (o.reduceOnly && o.status === 'open' && !acct.pos[o.sym]) { o.status = 'cancelled'; o.reason = 'Position closed'; }

    // 4. carry: interest on cash (excluding short proceeds), margin interest, borrow fees
    const rate = world.policy[d] / 100;
    const ex0 = exposures(world, acct, d);
    const base = acct.cash - ex0.short;
    const interest = base > 0 ? base * Math.max(0, rate - CASH_RATE_SPREAD) / 252 : base * (rate + DEBIT_RATE_SPREAD) / 252;
    acct.cash += interest;
    acct.costs.interest += interest;
    sum.interest = interest;
    for (const s in acct.pos) {
      if (acct.pos[s].qty >= 0) continue;
      const i = world.bySym[s];
      const fee = -acct.pos[s].qty * world.c[i][d] * world.inst[i].borrowFee / 252;
      acct.cash -= fee;
      acct.costs.borrow += fee;
      sum.borrow += fee;
      if (acct.openTrades[s]) acct.openTrades[s].borrow += fee;
    }

    // 5. excursions on open trades
    for (const s in acct.openTrades) {
      const tr = acct.openTrades[s], i = world.bySym[s], p = acct.pos[s];
      if (!p) continue;
      const adverse = tr.dir > 0 ? world.l[i][d] / p.avg - 1 : 1 - world.h[i][d] / p.avg;
      const favour = tr.dir > 0 ? world.h[i][d] / p.avg - 1 : 1 - world.l[i][d] / p.avg;
      tr.mae = Math.min(tr.mae, adverse);
      tr.mfe = Math.max(tr.mfe, favour);
    }

    // 6. maintenance margin: forced liquidation at the close, largest positions first
    if (acct.margin) {
      let ex = exposures(world, acct, d);
      let req = MARGIN.maintLong * ex.long + MARGIN.maintShort * ex.short;
      if (ex.equity < req && Object.keys(acct.pos).length) {
        acct.beh.marginCalls++;
        const liquidated = [];
        const syms = Object.keys(acct.pos).sort((a, b) => Math.abs(acct.pos[b].qty * markPrice(world, b, d)) - Math.abs(acct.pos[a].qty * markPrice(world, a, d)));
        for (const s of syms) {
          if (ex.equity >= req * 1.1) break;
          const q = acct.pos[s].qty;
          const o = { id: acct.nextId++, sym: s, side: q > 0 ? 'sell' : 'buy', qty: Math.abs(q), type: 'market', status: 'open', source: 'margin', tif: 'day', placedT: d - 1, reduceOnly: true };
          acct.orders.push(o);
          const res = execute(world, acct, o, d, { k: 3, px: world.c[world.bySym[s]][d], taker: true });
          o.status = res.fill ? 'filled' : 'cancelled';
          if (res.fill) { sum.fills.push(res.fill); liquidated.push(`${s} x${Math.abs(q)}`); }
          ex = exposures(world, acct, d);
          req = MARGIN.maintLong * ex.long + MARGIN.maintShort * ex.short;
        }
        for (const o of acct.orders) if (o.reduceOnly && o.status === 'open' && !acct.pos[o.sym]) { o.status = 'cancelled'; o.reason = 'Position closed'; }
        sum.marginCall = liquidated;
        acct.activity.push({ d, kind: 'margin', text: `MARGIN CALL: equity fell below maintenance. Broker liquidated ${liquidated.join(', ')} at the close.` });
      }
    }

    // 7. behaviour: disposition effect (Odean). On each day with a sale, count realised vs paper gains/losses.
    if (acct.track) {
      const soldToday = new Set(sum.fills.filter((f) => f.side === 'sell' && startPos[f.sym] && startPos[f.sym].qty > 0).map((f) => f.sym));
      if (soldToday.size) {
        for (const s in startPos) {
          if (startPos[s].qty <= 0) continue;
          const sp = startPos[s];
          if (soldToday.has(s)) {
            const f = sum.fills.find((x) => x.sym === s && x.side === 'sell');
            if (f.px >= sp.avg) acct.beh.rg++; else acct.beh.rl++;
          } else {
            if (markPrice(world, s, d) >= sp.avg) acct.beh.pg++; else acct.beh.pl++;
          }
        }
      }
    }

    for (const f of sum.fills) {
      const kind = f.source === 'margin' ? 'Forced' : f.role === 'stop' ? 'Stop hit' : f.role === 'target' ? 'Target hit' : 'Filled';
      acct.activity.push({ d, kind: 'fill', text: `${kind}: ${f.side.toUpperCase()} ${f.qty} ${f.sym} @ $${f.px.toFixed(2)}${f.gapped ? ' (gapped through stop)' : ''}${f.comm ? `, commission $${f.comm.toFixed(2)}` : ''}` });
    }
    for (const o of sum.expired) acct.activity.push({ d, kind: 'expire', text: `Order #${o.id} ${o.side.toUpperCase()} ${o.qty} ${o.sym} expired unfilled` });
    if (acct.activity.length > 400) acct.activity.splice(0, acct.activity.length - 400);
    if (acct.orders.length > 300) acct.orders = acct.orders.filter((o) => o.status === 'open' || o.status === 'pending' || o.placedT > d - 30);

    recordEquity(world, acct, d);
    return sum;
  }

  function recordEquity(world, acct, d) {
    const ex = exposures(world, acct, d);
    let maxW = 0;
    for (const sym in acct.pos) maxW = Math.max(maxW, Math.abs(acct.pos[sym].qty * markPrice(world, sym, d)) / Math.max(1, ex.equity));
    acct.equity.push({ d, eq: ex.equity, cash: acct.cash, long: ex.long, short: ex.short, maxW });
    acct.peak = Math.max(acct.peak, ex.equity);
    return ex;
  }

  Object.assign(TM, {
    COST_MODELS, MARGIN, newAccount, exposures, equityAt, buyingPower, reserved, committedQty, orderEffect, estimateCosts, costParts, commission,
    placeOrder, cancelOrder, modifyOrder, processDay, recordEquity, isOpening, dayPath, evalOrder
  });
})(TM);
