/* Tack Market V3 · market engine
   Builds a synthetic but statistically realistic market from a seed. Nothing here is real data:
   the companies, prices, news and calendar are all generated.
   Model: regime-switching market factor (GARCH volatility, fat tails, leverage effect), sector and
   interest-rate factors, per-stock momentum, valuation mean-reversion, short-term reversal,
   scheduled earnings (with post-earnings drift), dividends, macro releases and company news.
   The whole path is fixed by (seed, scenario, sessionDays), so reloading can never re-roll a day. */
var TM = typeof TM !== 'undefined' ? TM : {};
(function (TM) {
  'use strict';

  // ---------- random numbers ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }
  function makeRng(seed) {
    const u = mulberry32(seed >>> 0);
    let spare = null;
    const rng = {
      u,
      n() {
        if (spare !== null) { const s = spare; spare = null; return s; }
        let a, b, r;
        do { a = u() * 2 - 1; b = u() * 2 - 1; r = a * a + b * b; } while (r >= 1 || r === 0);
        const m = Math.sqrt(-2 * Math.log(r) / r);
        spare = b * m;
        return a * m;
      },
      // Student-t with 4 degrees of freedom, scaled to unit variance: fat tails like real returns.
      t4() {
        const z = rng.n();
        let c = 0;
        for (let k = 0; k < 4; k++) { const g = rng.n(); c += g * g; }
        return z / Math.sqrt(c / 4) * Math.SQRT1_2;
      },
      range(a, b) { return a + (b - a) * u(); },
      int(a, b) { return a + Math.floor(u() * (b - a + 1)); },
      pick(arr) { return arr[Math.floor(u() * arr.length)]; },
      chance(p) { return u() < p; },
      logn(sd) { return Math.exp(rng.n() * sd - sd * sd / 2); }
    };
    return rng;
  }
  const clip = (x, lim) => x > lim ? lim : x < -lim ? -lim : x;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const r2 = (x) => Math.round(x * 100) / 100;

  // ---------- universe ----------
  // beta: market sensitivity; idio/vol: annual stock-specific and sector volatility; div: yield range;
  // pe/g: P/E and EPS-growth ranges (fair P/E rises with growth); earn: earnings-move multiplier;
  // rate: sensitivity to the interest-rate factor (negative = hurt when yields rise).
  const SECTORS = {
    Technology:  { beta: 1.25, idio: 0.27, vol: 0.13, div: [0, 0.012],     pe: [24, 42], g: [0.10, 0.24], earn: 1.30, rate: -1.4 },
    Healthcare:  { beta: 0.85, idio: 0.24, vol: 0.09, div: [0.005, 0.025], pe: [16, 30], g: [0.05, 0.13], earn: 1.15, rate: -0.4 },
    Financials:  { beta: 1.10, idio: 0.19, vol: 0.12, div: [0.02, 0.04],   pe: [9, 15],  g: [0.04, 0.09], earn: 0.85, rate: 0.7 },
    Energy:      { beta: 1.00, idio: 0.25, vol: 0.20, div: [0.03, 0.06],   pe: [7, 14],  g: [0.00, 0.08], earn: 0.90, rate: 0.3 },
    Consumer:    { beta: 1.00, idio: 0.22, vol: 0.09, div: [0.01, 0.03],   pe: [16, 28], g: [0.04, 0.11], earn: 1.10, rate: -0.5 },
    Industrials: { beta: 1.05, idio: 0.19, vol: 0.10, div: [0.015, 0.03],  pe: [14, 22], g: [0.04, 0.09], earn: 0.90, rate: -0.3 },
    Utilities:   { beta: 0.50, idio: 0.13, vol: 0.08, div: [0.03, 0.05],   pe: [14, 20], g: [0.02, 0.04], earn: 0.50, rate: -1.0 },
    Materials:   { beta: 1.10, idio: 0.25, vol: 0.14, div: [0.02, 0.04],   pe: [10, 18], g: [0.02, 0.08], earn: 0.95, rate: 0.0 }
  };
  const COMPANIES = [
    ['NBSF', 'Nimbusoft', 'Technology', 'Enterprise cloud software and data platforms.'],
    ['ARWV', 'Arcwave Semiconductor', 'Technology', 'Designs power-efficient chips for data centres.'],
    ['QLON', 'Quillon Systems', 'Technology', 'Cybersecurity and network infrastructure.'],
    ['HXND', 'Helixon Data', 'Technology', 'Analytics and AI tooling for mid-sized businesses.'],
    ['VNTC', 'Vantor Communications', 'Technology', 'Consumer devices and wireless components.'],
    ['CRVB', 'Corvane Biosciences', 'Healthcare', 'Clinical-stage oncology drug developer.'],
    ['MDRH', 'Medira Health', 'Healthcare', 'Operates hospitals and outpatient clinics.'],
    ['SLVT', 'Solvia Therapeutics', 'Healthcare', 'Rare-disease treatments with two approved drugs.'],
    ['OSTL', 'Ostrel Medical', 'Healthcare', 'Surgical robotics and orthopaedic implants.'],
    ['PLCD', 'Pellucid Labs', 'Healthcare', 'Diagnostics and laboratory testing services.'],
    ['GRMB', 'Granmoor Bancorp', 'Financials', 'Regional retail and commercial bank.'],
    ['LDGL', 'Ledgerline Capital', 'Financials', 'Asset management and online brokerage.'],
    ['FHVI', 'Fairhaven Insurance', 'Financials', 'Property and casualty insurer.'],
    ['CMKT', 'Crestmark Trust', 'Financials', 'Custody, payments and wealth services.'],
    ['TLPY', 'Tolland Payments', 'Financials', 'Card processing and merchant payments.'],
    ['BRKW', 'Brackwater Petroleum', 'Energy', 'Integrated oil producer and refiner.'],
    ['RDGB', 'Ridgeback Gas', 'Energy', 'Natural gas exploration and pipelines.'],
    ['HLVD', 'Halvern Drilling', 'Energy', 'Offshore drilling contractor.'],
    ['KSTR', 'Kestrel Refining', 'Energy', 'Independent fuel refiner.'],
    ['SNVP', 'Sunvale Renewables', 'Energy', 'Solar and wind power developer.'],
    ['MRLF', 'Marlow & Finch', 'Consumer', 'Premium department stores and e-commerce.'],
    ['BRCT', 'Brightcart', 'Consumer', 'Online grocery and delivery marketplace.'],
    ['OUVA', 'Ouvra Apparel', 'Consumer', 'Athletic footwear and apparel brand.'],
    ['HOLF', 'Hollin Foods', 'Consumer', 'Packaged foods and snacks.'],
    ['VLRO', 'Velloro Motors', 'Consumer', 'Electric scooters and compact cars.'],
    ['STRA', 'Strand Aerospace', 'Industrials', 'Aircraft components and defence systems.'],
    ['KLNW', 'Kilnworth Machinery', 'Industrials', 'Construction and mining equipment.'],
    ['TRWL', 'Tarrow Logistics', 'Industrials', 'Freight, warehousing and parcel delivery.'],
    ['BXRL', 'Bexley Rail', 'Industrials', 'Freight railroad operator.'],
    ['ORCN', 'Orrin Construction', 'Industrials', 'Infrastructure engineering and construction.'],
    ['NMEL', 'Northmere Electric', 'Utilities', 'Regulated electricity utility.'],
    ['CLDW', 'Calder Water', 'Utilities', 'Water and wastewater services.'],
    ['GRFU', 'Greyfield Utilities', 'Utilities', 'Gas and electric distribution.'],
    ['AVGR', 'Avonlea Grid', 'Utilities', 'High-voltage transmission networks.'],
    ['PCPW', 'Pinecrest Power', 'Utilities', 'Power generation and retail energy.'],
    ['FRVS', 'Ferrovane Steel', 'Materials', 'Steel producer and recycler.'],
    ['CPLM', 'Copperline Mining', 'Materials', 'Copper and gold mining.'],
    ['SMCH', 'Saltmarsh Chemicals', 'Materials', 'Specialty and industrial chemicals.'],
    ['GVMT', 'Graniteview Materials', 'Materials', 'Cement, aggregates and building materials.'],
    ['ALPK', 'Alder Packaging', 'Materials', 'Paper and plastic packaging.']
  ];

  // ---------- regimes & scenarios ----------
  // mu/vol are annualised market drift and volatility; idio scales stock-specific volatility.
  const REGIMES = {
    bull:     { mu: 0.16,  vol: 0.11, idio: 0.95, label: 'Bull market' },
    chop:     { mu: 0.02,  vol: 0.15, idio: 1.0,  label: 'Choppy, range-bound' },
    bear:     { mu: -0.25, vol: 0.26, idio: 1.15, label: 'Bear market' },
    crash:    { mu: -1.6,  vol: 0.55, idio: 1.5,  label: 'Crash' },
    recovery: { mu: 0.6,   vol: 0.28, idio: 1.2,  label: 'Recovery rally' }
  };
  // Daily switching probabilities for the "random" scenario.
  const TRANSITIONS = {
    bull:     { chop: 1 / 120, bear: 1 / 450, crash: 1 / 1500 },
    chop:     { bull: 1 / 55, bear: 1 / 130 },
    bear:     { chop: 1 / 45, crash: 1 / 160, bull: 1 / 220 },
    crash:    { recovery: 1 / 7, bear: 1 / 25 },
    recovery: { bull: 1 / 28, chop: 1 / 45 }
  };
  // Scripted scenarios: [fraction of session, regime, overrides]. Shapes are stylised, not replays.
  const SCENARIOS = {
    random: { label: 'Random', blurb: 'Regimes switch at random, like an unknown future. Long-run drift is positive.' },
    bull: { label: 'Steady bull', blurb: 'A rising market with one choppy patch. Can you beat simply holding the index?',
      segments: [[0.45, 'bull'], [0.15, 'chop'], [0.4, 'bull']] },
    gfc: { label: '2008-shape: slow-burn crash', blurb: 'Choppy top, grinding bear led by banks, a crash, then a sharp recovery.',
      segments: [[0.15, 'chop'], [0.3, 'bear', { sectorDrift: { Financials: -0.45 } }], [0.1, 'crash', { mu: -2.2, sectorDrift: { Financials: -0.8 } }],
        [0.2, 'bear'], [0.25, 'recovery', { mu: 0.45 }]] },
    covid: { label: '2020-shape: V-shaped shock', blurb: 'Calm bull, a violent crash in a few weeks, then an equally fast rebound.',
      segments: [[0.3, 'bull'], [0.12, 'crash', { mu: -3.5, vol: 0.7, sectorDrift: { Energy: -0.8, Technology: 0.3 } }],
        [0.33, 'recovery', { mu: 0.9, sectorDrift: { Technology: 0.3 } }], [0.25, 'bull']] },
    rates: { label: '2022-shape: rate-shock grind', blurb: 'Inflation forces rate hikes. Long-duration growth stocks bleed; energy and banks hold up.',
      segments: [[0.15, 'chop', { rateMu: 0.0006 }], [0.6, 'bear', { mu: -0.2, vol: 0.22, rateMu: 0.0012, sectorDrift: { Energy: 0.35 } }],
        [0.25, 'chop', { rateMu: 0.0004 }]] },
    bubble: { label: '2000-shape: bubble then bust', blurb: 'Tech mania lifts everything, then the bubble deflates and tech leads the way down.',
      segments: [[0.4, 'bull', { mu: 0.25, sectorDrift: { Technology: 0.9 } }], [0.1, 'chop', { sectorDrift: { Technology: 0.2 } }],
        [0.5, 'bear', { mu: -0.3, sectorDrift: { Technology: -1.0, Utilities: 0.15, Healthcare: 0.1 } }]] }
  };

  const BROKERS = ['Halberd Securities', 'Northgate Research', 'Pemberton & Co.', 'Ironbridge Capital Markets', 'Cobalt Street Partners'];
  const ACQUIRERS = ['a large private-equity firm', 'a strategic rival', 'a sovereign wealth fund', 'an overseas competitor'];
  // Company news: sign of the move and its size as a multiple of the stock's daily idiosyncratic volatility.
  const NEWS = [
    { k: 'upgrade', w: 3, sign: 1, mult: [1.2, 2.5], text: (s, r) => `${r.pick(BROKERS)} upgrades ${s.name} (${s.sym}) to Buy` },
    { k: 'downgrade', w: 3, sign: -1, mult: [1.2, 2.5], text: (s, r) => `${r.pick(BROKERS)} downgrades ${s.name} (${s.sym}) to Sell` },
    { k: 'guideUp', w: 1.5, sign: 1, mult: [2, 4], text: (s) => `${s.name} (${s.sym}) raises its full-year outlook` },
    { k: 'guideDown', w: 1.5, sign: -1, mult: [2.5, 5], text: (s) => `${s.name} (${s.sym}) cuts its full-year outlook` },
    { k: 'contract', w: 2, sign: 1, mult: [1, 2.5], text: (s) => `${s.name} (${s.sym}) wins a multi-year contract` },
    { k: 'probe', w: 1, sign: -1, mult: [3, 6], text: (s) => `Regulators open a probe into ${s.name} (${s.sym})` },
    { k: 'ceo', w: 1, sign: -1, mult: [1.5, 3.5], text: (s) => `${s.name} (${s.sym}) CEO departs unexpectedly` },
    { k: 'buyback', w: 1.5, sign: 1, mult: [1, 2], text: (s, r) => `${s.name} (${s.sym}) announces a $${(s.capB * r.range(0.03, 0.08)).toFixed(1)}bn share buyback` },
    { k: 'offering', w: 1, sign: -1, mult: [1.5, 3], text: (s) => `${s.name} (${s.sym}) sells new shares at a discount` },
    { k: 'mna', w: 0.6, sign: 1, mult: [4, 8], text: (s, r) => `Takeover rumour: reports say ${r.pick(ACQUIRERS)} is exploring a bid for ${s.name} (${s.sym})` }
  ];
  const NEWS_TOTAL = NEWS.reduce((a, b) => a + b.w, 0);

  const WARMUP = 250;
  const DAY_MS = 86400000;
  const EARN_CYCLE = 63;

  function scenarioAt(key, s, S) {
    const sc = SCENARIOS[key];
    if (!sc || !sc.segments) return null;
    const f = (s + 0.5) / S;
    let acc = 0;
    for (const seg of sc.segments) {
      acc += seg[0];
      if (f <= acc + 1e-9) return Object.assign({ regime: seg[1] }, seg[2] || {});
    }
    const last = sc.segments[sc.segments.length - 1];
    return Object.assign({ regime: last[1] }, last[2] || {});
  }
  function stepRegime(rng, cur) {
    const tr = TRANSITIONS[cur];
    let u = rng.u();
    for (const k in tr) { if (u < tr[k]) return k; u -= tr[k]; }
    return cur;
  }
  // Macro calendar is fixed and public, so traders can see it coming.
  function macroKind(d) {
    if (d % 42 === 12) return 'rates';
    if (d % 21 === 6) return 'cpi';
    if (d % 21 === 1) return 'jobs';
    return null;
  }
  const MACRO_LABEL = { rates: 'Central bank rate decision', cpi: 'Inflation (CPI) report', jobs: 'Jobs report' };

  function generateWorld(opts) {
    const seed = opts.seed >>> 0;
    const scenario = SCENARIOS[opts.scenario] ? opts.scenario : 'random';
    const S = Math.max(5, opts.sessionDays | 0 || 60);
    const T = WARMUP + S + 1, start = WARMUP;
    const rng = makeRng(seed);
    const sq = Math.sqrt(252);

    const year = 2031 + rng.int(0, 8);
    const dates = [];
    for (let ms = Date.UTC(year - 1, 0, 2); dates.length < T + 140; ms += DAY_MS) {
      const wd = new Date(ms).getUTCDay();
      if (wd !== 0 && wd !== 6) dates.push(ms);
    }

    const secNames = Object.keys(SECTORS);
    const inst = COMPANIES.map((row, i) => {
      const [sym, name, sector, blurb] = row;
      const sp = SECTORS[sector];
      const g = rng.range(sp.g[0], sp.g[1]);
      const gq = (g - sp.g[0]) / (sp.g[1] - sp.g[0] || 1);
      const fairPE = sp.pe[0] + (sp.pe[1] - sp.pe[0]) * gq;
      const capB = Math.exp(rng.range(Math.log(3), Math.log(400)));
      const price0 = Math.exp(rng.range(Math.log(18), Math.log(240)));
      const beta = clamp(sp.beta * rng.logn(0.18), 0.3, 2.2);
      const idio = sp.idio * rng.logn(0.2);
      const divYield = sector === 'Technology' && rng.chance(0.4) ? 0 : rng.range(sp.div[0], sp.div[1]);
      const baseVol = Math.sqrt((beta * 0.16 / sq) ** 2 + (sp.vol / sq) ** 2 + (idio / sq) ** 2);
      const shares = capB * 1e9 / price0;
      const turnover = rng.range(0.003, 0.009);
      const hardToBorrow = rng.chance(0.08);
      return {
        i, sym, name, sector, blurb, secIdx: secNames.indexOf(sector), isFund: false,
        beta, idio, g, fairPE, capB, price0, shares, divYield, baseVol,
        misp: rng.logn(0.18),
        analystBias: rng.logn(0.2),
        adv: Math.round(shares * turnover),
        spreadBps: clamp(1.5 + 30 / Math.sqrt(capB), 1.5, 30),
        borrowFee: hardToBorrow ? rng.range(0.08, 0.25) : capB > 50 ? 0.0025 : rng.range(0.004, 0.03),
        hardToBorrow,
        earnOff: rng.int(1, EARN_CYCLE),
        earnSd: idio / sq * 3.2 * sp.earn
      };
    });
    const N = inst.length;
    const FUND = N;
    const mk = () => Array.from({ length: N + 1 }, () => new Float64Array(T));
    const o = mk(), h = mk(), l = mk(), c = mk(), v = mk(), eps = mk(), tgt = mk(), divAmt = mk();
    const lowFirst = Array.from({ length: N + 1 }, () => new Uint8Array(T));
    const events = Array.from({ length: T }, () => []);
    const macro = new Array(T).fill(null);
    const regime = new Array(T);
    const policy = new Float64Array(T);
    const divDays = inst.map(() => []);

    const fair = new Float64Array(N), epsN = new Float64Array(N), alpha = new Float64Array(N);
    const hI = new Float64Array(N), eI = new Float64Array(N), tgtCur = new Float64Array(N);
    const nextDiv = new Array(N).fill(null);
    const deal = new Array(N).fill(null);
    const followUps = {};
    for (const s of inst) {
      const i = s.i;
      o[i][0] = h[i][0] = l[i][0] = c[i][0] = r2(s.price0);
      fair[i] = s.price0 / s.misp;
      epsN[i] = fair[i] / s.fairPE;
      eps[i][0] = epsN[i];
      tgtCur[i] = fair[i] * s.analystBias * rng.logn(0.06);
      tgt[i][0] = tgtCur[i];
      hI[i] = (s.idio / sq) ** 2;
      alpha[i] = rng.n() * 0.10 / 252;
      v[i][0] = s.adv;
      if (s.divYield > 0 && s.earnOff - 42 >= 1) {
        nextDiv[i] = { d: s.earnOff - 42, amt: r2(s.price0 * s.divYield / 4), decl: 0 };
        divDays[i].push(nextDiv[i]);
      }
    }
    const secA = new Float64Array(secNames.length);
    const rs = new Float64Array(secNames.length);
    let reg = rng.chance(0.7) ? 'bull' : 'chop';
    let hm = (REGIMES[reg].vol / sq) ** 2, lastM = 0;
    let rate = Math.round(rng.range(2.5, 4.5) * 4) / 4;
    let cpiCons = rng.range(2.2, 3.6);
    regime[0] = reg; policy[0] = rate;

    for (let d = 1; d < T; d++) {
      const ex = d > start ? scenarioAt(scenario, d - start - 1, S) : null;
      const prevReg = reg;
      reg = ex ? ex.regime : stepRegime(rng, reg);
      regime[d] = reg;
      const R = REGIMES[reg];
      const mu = ex && ex.mu != null ? ex.mu : R.mu;
      const volT = ex && ex.vol != null ? ex.vol : R.vol;
      const tv = (volT / sq) ** 2;
      if (reg !== prevReg && tv > hm) hm = 0.5 * (hm + tv);
      hm = 0.05 * tv + (lastM < 0 ? 0.14 : 0.04) * lastM * lastM + 0.86 * hm;
      const rateMu = ex && ex.rateMu || 0;

      // macro releases
      let mShock = 0, rShock = 0, volBoost = 1;
      const kind = macroKind(d);
      if (kind === 'cpi') {
        const z = rng.n();
        cpiCons = clamp(cpiCons + rng.n() * 0.12 + (rateMu > 0 ? 0.15 : 0), 0.5, 9);
        const actual = cpiCons + 0.2 * z;
        mShock = -0.006 * z; rShock = 0.003 * z; volBoost = 1.3;
        macro[d] = { kind, tone: z > 0.8 ? -1 : z < -0.8 ? 1 : 0,
          text: `Inflation: CPI ${actual.toFixed(1)}% y/y vs ${cpiCons.toFixed(1)}% expected${z > 0.8 ? ', hotter than forecast' : z < -0.8 ? ', cooler than forecast' : ''}` };
      } else if (kind === 'jobs') {
        const z = rng.n();
        const expJobs = Math.round(rng.range(90, 220));
        const act = Math.round(expJobs + z * 70);
        mShock = 0.004 * z * (reg === 'bear' || reg === 'crash' ? 1 : 0.6); rShock = 0.0015 * z;
        macro[d] = { kind, tone: z > 0.8 ? 1 : z < -0.8 ? -1 : 0, text: `Jobs report: ${act}k payrolls added vs ${expJobs}k expected` };
      } else if (kind === 'rates') {
        let expMove = 0;
        if (rateMu > 0) expMove = 0.5;
        else if (reg === 'crash') expMove = -0.5;
        else if (reg === 'bear') expMove = -0.25;
        else if (reg === 'bull' && rate < 5) expMove = rng.chance(0.4) ? 0.25 : 0;
        const u = rng.u();
        let act = expMove;
        if (u < 0.15) act += 0.25; else if (u < 0.3) act -= 0.25;
        act = Math.max(act, 0.25 - rate);
        const surprise = act - expMove;
        rate += act;
        mShock = -0.012 * surprise / 0.25; rShock = 0.004 * surprise / 0.25;
        const verb = act > 0 ? `raises rates ${act.toFixed(2)}% to ${rate.toFixed(2)}%` : act < 0 ? `cuts rates ${Math.abs(act).toFixed(2)}% to ${rate.toFixed(2)}%` : `holds rates at ${rate.toFixed(2)}%`;
        const expTxt = expMove > 0 ? `a ${expMove.toFixed(2)}% hike` : expMove < 0 ? `a ${Math.abs(expMove).toFixed(2)}% cut` : 'no change';
        macro[d] = { kind, tone: surprise < 0 ? 1 : surprise > 0 ? -1 : 0, text: `Central bank ${verb}${surprise ? ` (markets expected ${expTxt})` : ', as expected'}` };
      }
      policy[d] = rate;

      const zM = Math.sqrt(hm) * clip(rng.t4(), 7) * volBoost;
      const rm = mu / 252 + zM + mShock;
      lastM = zM + mShock;
      const fr = rateMu + 0.0025 * rng.n() + rShock;

      for (let k = 0; k < secNames.length; k++) {
        const sp = SECTORS[secNames[k]];
        secA[k] = 0.99 * secA[k] + (0.07 / 252) * 0.141 * rng.n();
        const drift = ex && ex.sectorDrift && ex.sectorDrift[secNames[k]] || 0;
        rs[k] = sp.rate * fr + secA[k] + drift / 252 + sp.vol / sq * Math.sqrt(R.idio) * clip(rng.t4(), 7);
      }

      for (let i = 0; i < N; i++) {
        const s = inst[i], pc = c[i][d - 1];
        const pending = deal[i] && deal[i].kind === 'pending';
        alpha[i] = 0.992 * alpha[i] + (0.16 / 252) * 0.126 * rng.n();
        const tI = (s.idio / sq * R.idio * (pending ? 0.15 : 1)) ** 2;
        hI[i] = 0.05 * tI + 0.06 * eI[i] * eI[i] + 0.89 * hI[i];
        const e = Math.sqrt(hI[i]) * clip(rng.t4(), 7);
        const beta = pending ? 0.1 : s.beta;
        let rc = beta * rm + (pending ? 0.1 : 1) * rs[s.secIdx] + e - 0.05 * eI[i];
        rc += pending ? 0.05 * Math.log(deal[i].px / pc) : alpha[i] + (0.25 / 252) * Math.log(fair[i] / pc);
        eI[i] = e;

        let jr = 0, isEarn = false, isNews = false;
        if ((d - s.earnOff) % EARN_CYCLE === 0) {
          isEarn = true;
          const bias = reg === 'bull' || reg === 'recovery' ? 0.15 : reg === 'bear' || reg === 'crash' ? -0.25 : 0;
          const z = clip(rng.t4(), 6) + bias;
          jr = pending ? 0 : z * s.earnSd;
          if (!pending) alpha[i] += jr * 0.004;
          const qEst = epsN[i] / 4;
          const qAct = qEst * (1 + z * 0.05);
          epsN[i] *= 1 + 0.8 * jr;
          if (!pending) fair[i] *= 1 + 0.8 * jr;
          tgtCur[i] = pending ? deal[i].px : fair[i] * s.analystBias * rng.logn(0.06);
          const m = new Date(dates[d]).getUTCMonth();
          const q = ((Math.floor(m / 3) + 3) % 4) + 1;
          const verdict = z > 1.2 ? 'Beats and raises guidance.' : z < -1.2 ? 'Misses and cuts guidance.' : z > 0.4 ? 'Beat.' : z < -0.4 ? 'Miss.' : 'In line.';
          events[d].push({ type: 'earnings', i, sym: s.sym, tone: Math.abs(z) > 0.4 ? Math.sign(z) : 0,
            text: `${s.name} (${s.sym}) Q${q} results: EPS $${qAct.toFixed(2)} vs $${qEst.toFixed(2)} expected. ${verdict}` });
          if (s.divYield > 0) {
            nextDiv[i] = { d: d + 21, amt: r2(pc * s.divYield / 4), decl: d };
            divDays[i].push(nextDiv[i]);
          }
        } else if (followUps[d] && followUps[d].includes(i) && deal[i] && deal[i].kind === 'rumor') {
          isNews = true;
          if (rng.chance(0.4)) {
            const px = r2(deal[i].pre * rng.range(1.25, 1.38));
            jr = px / pc - 1 - rc;
            deal[i] = { kind: 'pending', px };
            fair[i] = px; tgtCur[i] = px;
            events[d].push({ type: 'news', i, sym: s.sym, tone: 1, text: `${s.name} (${s.sym}) agrees to be acquired for $${px.toFixed(2)} a share in cash` });
          } else {
            jr = -Math.abs(deal[i].jump) * rng.range(0.6, 0.9);
            deal[i] = null;
            events[d].push({ type: 'news', i, sym: s.sym, tone: -1, text: `${s.name} (${s.sym}) says it is not in sale talks; takeover premium evaporates` });
          }
        } else if (!pending && !deal[i] && rng.chance(1 / 75)) {
          isNews = true;
          let u = rng.u() * NEWS_TOTAL, def = NEWS[0];
          for (const nd of NEWS) { u -= nd.w; if (u <= 0) { def = nd; break; } }
          jr = def.sign * rng.range(def.mult[0], def.mult[1]) * s.idio / sq;
          if (def.k === 'guideUp' || def.k === 'guideDown') { fair[i] *= 1 + 0.5 * jr; epsN[i] *= 1 + 0.5 * jr; alpha[i] += jr * 0.003; }
          if (def.k === 'mna') {
            deal[i] = { kind: 'rumor', pre: pc, jump: jr };
            const fd = d + rng.int(4, 12);
            (followUps[fd] = followUps[fd] || []).push(i);
          }
          events[d].push({ type: 'news', i, sym: s.sym, tone: def.sign, text: def.text(s, rng) });
        }

        let div = 0;
        if (nextDiv[i] && nextDiv[i].d === d) { div = nextDiv[i].amt; divAmt[i][d] = div; }

        const r = Math.max(rc + jr, -0.75);
        const close = Math.max(pc * (1 + r) - div, 0.25);
        const open = Math.max(pc * (1 + jr + 0.3 * rc) - div, 0.25);
        const sig = Math.sqrt(beta * beta * hm + (SECTORS[s.sector].vol / sq) ** 2 * R.idio + hI[i]);
        const hi = Math.max(open, close) * (1 + Math.abs(rng.n()) * sig * 0.55);
        const lo = Math.min(open, close) * (1 - Math.min(0.4, Math.abs(rng.n()) * sig * 0.55));
        o[i][d] = r2(open); c[i][d] = r2(close);
        h[i][d] = Math.max(r2(hi), o[i][d], c[i][d]);
        l[i][d] = Math.max(0.01, Math.min(r2(lo), o[i][d], c[i][d]));
        lowFirst[i][d] = (close >= open) !== rng.chance(0.25) ? 1 : 0;
        v[i][d] = Math.round(s.adv * rng.logn(0.3) * (1 + 1.6 * Math.abs(r) / s.baseVol) * (isEarn ? 2.5 : 1) * (isNews ? 2 : 1) * (kind ? 1.15 : 1) * R.idio);

        if (!pending) { fair[i] *= 1 + s.g / 252; epsN[i] *= 1 + s.g / 252; }
        eps[i][d] = epsN[i];
        tgt[i][d] = tgtCur[i];
      }
    }

    // Cap-weighted index (price) and a tradable total-return index fund.
    const fundInst = {
      i: FUND, sym: 'TMXI', name: 'Tack Market Index Fund', sector: 'Index', isFund: true,
      blurb: 'Holds all 40 listed companies, weighted by market value, with dividends reinvested. The passive benchmark.',
      beta: 1, idio: 0, g: 0, fairPE: 0, capB: inst.reduce((a, s) => a + s.capB, 0), divYield: 0,
      baseVol: 0.16 / sq, adv: 6e6, spreadBps: 1, borrowFee: 0.0025, hardToBorrow: false, earnOff: null, earnSd: 0
    };
    inst.push(fundInst);
    const tmx = new Float64Array(T);
    const secIdx = {};
    for (const nm of secNames) { secIdx[nm] = new Float64Array(T); secIdx[nm][0] = 1000; }
    tmx[0] = 4000;
    o[FUND][0] = h[FUND][0] = l[FUND][0] = c[FUND][0] = 100;
    v[FUND][0] = fundInst.adv;
    const frng = makeRng(seed ^ 0x9e3779b9);
    for (let d = 1; d < T; d++) {
      let tot = 0;
      const secTot = {}, secRet = {};
      for (let i = 0; i < N; i++) {
        const cap = inst[i].shares * c[i][d - 1];
        tot += cap;
        secTot[inst[i].sector] = (secTot[inst[i].sector] || 0) + cap;
      }
      let rP = 0, rT = 0, rO = 0, rH = 0, rL = 0;
      for (let i = 0; i < N; i++) {
        const pc = c[i][d - 1], w = inst[i].shares * pc / tot, dv = divAmt[i][d];
        rP += w * (c[i][d] / pc - 1);
        rT += w * ((c[i][d] + dv) / pc - 1);
        rO += w * ((o[i][d] + dv) / pc - 1);
        rH += w * ((h[i][d] + dv) / pc - 1);
        rL += w * ((l[i][d] + dv) / pc - 1);
        const sw = inst[i].shares * pc / secTot[inst[i].sector];
        secRet[inst[i].sector] = (secRet[inst[i].sector] || 0) + sw * (c[i][d] / pc - 1);
      }
      tmx[d] = tmx[d - 1] * (1 + rP);
      for (const nm of secNames) secIdx[nm][d] = secIdx[nm][d - 1] * (1 + secRet[nm]);
      const pc = c[FUND][d - 1];
      const cl = pc * (1 + rT), op = pc * (1 + rO);
      const top = Math.max(op, cl), bot = Math.min(op, cl);
      c[FUND][d] = r2(cl); o[FUND][d] = r2(op);
      h[FUND][d] = Math.max(r2(top + 0.6 * Math.max(0, pc * (1 + rH) - top)), o[FUND][d], c[FUND][d]);
      l[FUND][d] = Math.min(r2(bot - 0.6 * Math.max(0, bot - pc * (1 + rL))), o[FUND][d], c[FUND][d]);
      lowFirst[FUND][d] = cl >= op ? 1 : 0;
      v[FUND][d] = Math.round(fundInst.adv * frng.logn(0.25) * (1 + 1.6 * Math.abs(rT) / fundInst.baseVol));
    }

    // Trailing 20-day realised volatility and average volume, using only data before day d.
    const rv20 = mk(), adv20 = mk();
    for (let i = 0; i <= N; i++) {
      for (let d = 0; d < T; d++) {
        if (d < 21) { rv20[i][d] = inst[i].baseVol; adv20[i][d] = inst[i].adv; continue; }
        let s1 = 0, s2 = 0, vs = 0;
        for (let j = d - 20; j < d; j++) {
          const x = Math.log(c[i][j] / c[i][j - 1]);
          s1 += x; s2 += x * x; vs += v[i][j];
        }
        rv20[i][d] = Math.sqrt(Math.max(0, s2 / 20 - (s1 / 20) ** 2));
        adv20[i][d] = vs / 20;
      }
    }

    const earnDays = inst.map((s) => {
      if (s.earnOff == null) return [];
      const out = [];
      for (let d = s.earnOff; d < T + 130; d += EARN_CYCLE) out.push(d);
      return out;
    });
    divDays.push([]);
    const bySym = {};
    inst.forEach((s) => { bySym[s.sym] = s.i; });
    return {
      seed, scenario, S, W: WARMUP, T, start, dates, inst, N: N + 1, nStocks: N, FUND, bySym, secNames,
      o, h, l, c, v, eps, tgt, divAmt, divDays, earnDays, lowFirst, events, macro, regime, policy, tmx, secIdx, rv20, adv20
    };
  }

  // ---------- read helpers (UI and bots must only look at days <= t) ----------
  function spreadBps(world, i, d) {
    const s = world.inst[i];
    const dd = Math.min(d, world.T - 1);
    return s.spreadBps * clamp(world.rv20[i][dd] / s.baseVol, 0.8, 3);
  }
  function nextEarnings(world, i, t) {
    for (const d of world.earnDays[i]) if (d > t) return d;
    return null;
  }
  function nextExDiv(world, i, t) {
    for (const x of world.divDays[i]) if (x.d > t && x.decl <= t) return x;
    return null;
  }
  function upcomingMacro(world, t, n) {
    const out = [];
    for (let d = t + 1; out.length < n && d < t + 200; d++) {
      const k = macroKind(d);
      if (k) out.push({ d, kind: k, label: MACRO_LABEL[k] });
    }
    return out;
  }
  function dateOf(world, d) {
    return world.dates[Math.min(d, world.dates.length - 1)];
  }
  function fmtDate(ms, style) {
    const dt = new Date(ms);
    if (style === 'short') return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    if (style === 'month') return dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  function sma(arr, d, n) {
    if (d - n + 1 < 0) return null;
    let s = 0;
    for (let j = d - n + 1; j <= d; j++) s += arr[j];
    return s / n;
  }

  Object.assign(TM, {
    mulberry32, hashSeed, makeRng, clamp, r2, SECTORS, COMPANIES, REGIMES, SCENARIOS, MACRO_LABEL,
    generateWorld, spreadBps, nextEarnings, nextExDiv, upcomingMacro, macroKind, dateOf, fmtDate, sma
  });
})(TM);
