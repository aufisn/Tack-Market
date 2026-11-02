# Tack Market V3

A stock-trading simulator for learning how markets really behave, without risking real money.

You trade a market of 40 fictional companies and an index fund, one day at a time. The prices, news, earnings and dates are all generated on your device, built to behave like real equities statistically, but none of it is real market data. You pay realistic trading costs, follow risk rules you set, and compete against benchmark bots trading the identical market. At the end, a debrief shows what the market was really doing and how your own habits helped or hurt you.

It is a single, standalone HTML file. No install, no account, no server, and nothing is sent anywhere.

**Play:** open `index.html` in a browser, or visit the GitHub Pages site for this repository (see [Publishing on GitHub Pages](#publishing-on-github-pages)).

> Tack Market is an educational game. Nothing in it is investment advice, and results in the simulator say nothing about results in real markets.

---

## Features

**A realistic, fictional market**
- 40 companies in 8 sectors, plus TMXI, a cap-weighted total-return index fund that acts as the benchmark.
- Market regimes (bull, choppy, bear, crash, recovery) with volatility clustering, fat tails and a leverage effect.
- Market, sector and interest-rate factors: stocks correlate about 0.5 with the market, and more in crashes.
- Quarterly earnings with published dates and implied moves, dividends with ex-dates, macro releases (CPI, jobs, central-bank rate decisions) and company news, including takeover rumours.
- Small real edges, weak relative to noise: medium-term momentum, post-earnings drift, valuation mean-reversion and short-term reversal.
- Six scenarios: Random, Steady bull, and stylised 2008-, 2020-, 2022- and 2000-shaped markets.

**Realistic trading**
- Market, limit, stop and stop-limit orders, Day or GTC, and bracket orders (stop-loss plus take-profit, one cancels the other).
- Orders fill along each day's open, high, low and close, so overnight gaps can jump straight through stops.
- Commission, bid/ask spread (wider when volatility rises) and square-root market impact.
- Cash or margin accounts: 2x leverage, short selling with borrow fees, maintenance margin and forced liquidation, and interest on cash and margin loans.

**Built for learning**
- Pre-trade checks against your own risk rules (risk per trade, position size, daily loss limit, drawdown), with warn or block.
- A position-size calculator driven by your stop distance, plus ATR-based stop and 2R target suggestions.
- A trade journal with setup tags, thesis, R-multiples, MAE/MFE and lessons.
- Five bots on the same market and costs: index fund, equal-weight, momentum, value, and a random-entry "rules bot" that tests your exit rules on their own.
- Performance analytics: Sharpe, Sortino, beta, alpha, drawdown, win rate, profit factor, expectancy, turnover and cost drag.
- A behavioural coach that flags the disposition effect, holding losers, chasing, averaging down, moving stops, overtrading, concentration and margin calls.
- An end-of-session debrief that reveals the hidden market regimes.
- A searchable in-app Help guide covering every option, label and metric (about 270 entries), printable to PDF.

**Progression**
- **Practice:** choose the scenario, length (30–250 days), capital, account type, cost model and seed.
- **Career levels:**
  1. *Foundations* is about process: stops, sizing and small losses.
  2. *Funded Evaluation* is a prop-firm style challenge: +6% target, 3% daily loss limit, 8% maximum drawdown.
  3. *Portfolio Manager Mandate* runs $1M for 120 days and must beat the index on return and Sharpe ratio.
- **Daily challenge:** the same hidden market for everyone on a given date.
- **Seeds:** replay any exact market. Sessions save after every day and can be exported or imported as JSON. Trades export to CSV.

**Works on every screen**
- PC: a three-column board.
- Foldables and tablets (unfolded, about 600–1099px): the watchlist beside the chart and order ticket.
- Phones and foldable cover screens (under 600px): one panel at a time, with a bottom navigation bar.
- Touch support (drag to scrub the chart), light and dark themes, and reduced-motion support.

---

## Playing

1. Open `index.html` (or `TackMarket-V3.html`; they are identical) in Chrome, Edge, Firefox, Safari or Samsung Internet.
2. Start a **Practice** session, a **Career** level or the **Daily challenge**.
3. Each turn happens after the close. Queue orders in the ticket, then press **Next day** (or `N`). Market orders fill at the next open; limits and stops fill when that day's prices reach them.
4. Press any **?** button for help on that part of the screen.

**Saving:** the game saves in the browser's local storage after every day. Opening the file straight from a phone's file manager can block storage in some browsers. The home screen warns you if so, and you can use **Account & rules → Export save** to keep a session. Playing from GitHub Pages avoids the problem.

**On a phone:** open the GitHub Pages address, then use the browser menu's **Add to Home screen** for one-tap access.

---

## Project structure

```
index.html              Built game, served by GitHub Pages (do not edit by hand)
TackMarket-V3.html      Identical copy of index.html, convenient to download and open directly
build.sh                Combines src/ into the two HTML files above
src/
  shell.html            HTML skeleton with placeholders for the CSS and JS
  style.css             All styles, themes and responsive layouts
  engine.js             Synthetic market generator (deterministic from a seed)
  broker.js             Accounts, orders, fills, costs, dividends, interest, margin
  analytics.js          Performance metrics and the behavioural coach
  bots.js               Benchmark bots
  game.js               Sessions, career levels, rule enforcement, pass/fail
  help.js               Help guide content
  ui.js                 User interface (plain JavaScript, no framework)
tests/
  core-test.js          Headless tests: determinism, order fills, OCO brackets, accounting identity, bots
  calibrate.js          Statistical report on the generated market
.github/workflows/
  test.yml              Builds the game and runs the tests on every push
```

There are no dependencies and no package manager. The game uses only built-in browser features, and the tests need only Node.js.

---

## Developing

Edit files in `src/`, then rebuild:

```sh
sh build.sh
```

Commit the rebuilt `index.html` and `TackMarket-V3.html` together with your `src/` changes. The GitHub workflow fails if they are out of date.

Run the tests (Node.js 18 or later):

```sh
node tests/core-test.js
node tests/calibrate.js
```

`core-test.js` checks that worlds are deterministic, that OHLC data is consistent, that every order type fills correctly (including gaps and stop-limits), that bracket orders cancel each other, and that the account accounting balances to the cent across 60 random-trading sessions. It also reports how the bots perform. `calibrate.js` prints volatility, kurtosis, correlation and drawdown statistics for each scenario, so you can check the market still looks realistic after changing the engine.

To change help text, edit `src/help.js`. Each section is a list of `[term, definition]` pairs.

---

## Publishing on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose your main branch and the `/ (root)` folder, and save.
4. After a minute the game is live at `https://<your-username>.github.io/<repository-name>/`.

The `.nojekyll` file tells GitHub Pages to serve the files as they are.

---

## Data and privacy

- All companies, tickers, people, analysts, prices, headlines and dates are fictional. Any resemblance to real companies is coincidental.
- No real market data is used, and the game makes no network requests.
- Progress, saves and settings are stored only in your browser's local storage on your device.

## License

Choose a license before publishing (for example MIT for permissive reuse, or keep all rights reserved) and add it as a `LICENSE` file.
