/* Tack Market V3 · help guide content
   Every option, label and metric in the game, explained. Each section: { id, title, intro, items: [[term, definition]] }.
   Definitions may contain simple inline HTML (<b>, <i>, <code>). */
var TM = typeof TM !== 'undefined' ? TM : {};
(function (TM) {
  'use strict';

  TM.HELP = [
    {
      id: 'start', title: 'How a trading day works',
      intro: 'Tack Market is turn-based and works the same way in Practice, Career levels and the Daily challenge. Each turn is one trading day, and <b>whenever you are looking at the screen the market is closed</b>: you always act after the close, like a swing trader planning the next morning in the evening. The market is only \u201copen\u201d inside the <b>Next day</b> step, when the game plays a whole trading day in one go and your orders execute.<table class="cycle"><thead><tr><th>Phase</th><th>What happens</th><th>Who acts</th></tr></thead><tbody><tr><td><b>After the close</b><br><span class="faint">the screen you see</span></td><td>Today\u2019s trading is over. Prices, news and positions are final.</td><td><b>You</b>: study, place, edit or cancel orders</td></tr><tr><td><b>Next day</b><br><span class="faint">button pressed</span></td><td>The next trading day plays out: the <b>open</b>, the moves during the day, then the <b>close</b>. Orders fill along the way.</td><td><b>The market</b></td></tr><tr><td><b>After the next close</b></td><td>You are back on the screen, one day later, with the results.</td><td><b>You</b> again</td></tr></tbody></table>',
      items: [
        ['Is the market ever open?', 'Not while you are on the screen. Nothing trades in real time, so there is no rush and you cannot react to tomorrow\u2019s prices before committing. You make every decision with the information you would really have at the close.'],
        ['Day 0 of 60', 'The session has not started. You are looking at the close of the last day of the one-year warm-up history, and nothing you can trade has happened yet. Press <b>Next day</b> once and you are at the close of Day 1. The session ends at the close of the final day (Day 60 here).'],
        ['Same in every mode', 'Practice, the three Career levels and the Daily challenge all use this day cycle. They differ only in settings, rules and how you are graded.'],
        ['After the close', 'You see every price up to and including today’s close. Nothing you do can change today. Decide what to do tomorrow.'],
        ['Queue orders', 'Build an order in the <b>Trade</b> ticket and press <b>Queue order</b>. It does not execute yet: it waits for tomorrow.'],
        ['Next day', 'Reveals tomorrow. Market orders fill at the <b>open</b>; limit and stop orders fill if and when that day’s price path reaches them. Dividends, interest, fees and margin checks are applied, and every bot trades the same day.'],
        ['+5 days', 'Advances five days in a row. Your working orders keep running. Useful when you are holding and have nothing to change.'],
        ['Overnight gap', 'The difference between yesterday’s close and today’s open. Earnings, company news and macro data arrive overnight, so the open can be far from the close. Market orders and stops fill at the open, gap included.'],
        ['Session', 'A fixed number of trading days (30, 60, 120 or 250). At the end you get a debrief comparing you with the index and four bots on the identical market.'],
        ['Warm-up history', 'Every session starts with one year (250 days) of price history already generated, so you can study charts and trends before your first trade.'],
        ['Fictional data', 'All companies, prices, news, dates and analysts are invented and generated on your device. They are designed to behave like real stocks statistically, but none of it is real market data.'],
        ['Saving', 'The game saves in your browser after every day and after every order. Because the whole market is fixed by its seed, closing or refreshing the page can never change what happens next.']
      ]
    },
    {
      id: 'practice', title: 'Practice settings',
      intro: 'Choices on the home screen before starting a Practice session.',
      items: [
        ['Market scenario', 'The overall shape of the market during your session. The one-year warm-up history is always random; the scenario controls the session days only. Individual stocks still move in their own way inside the scenario.'],
        ['Scenario: Random', 'Market regimes switch at random, as in an unknown future: long calm bull runs, choppy patches, occasional bear markets and rare crashes. Over long periods the market drifts upward (about +8% a year on average) but any single session can go either way.'],
        ['Scenario: Steady bull', 'A rising market with one choppy patch in the middle. Tests whether active trading can beat simply holding the index when the trend is your friend. Most people find it surprisingly hard.'],
        ['Scenario: 2008-shape (slow-burn crash)', 'A choppy top, then a grinding bear market led by banks (Financials fall hardest), a short crash, more weakness, and finally a sharp recovery. Teaches patience, sector risk and not bottom-picking too early. The shape is stylised, not a replay of real 2008 prices.'],
        ['Scenario: 2020-shape (V-shaped shock)', 'A calm bull market, then a violent crash over a few weeks (Energy is hit hardest, Technology holds up best), then an equally fast rebound. Teaches the cost of panic selling and of missing the recovery.'],
        ['Scenario: 2022-shape (rate-shock grind)', 'Inflation runs hot and the central bank keeps raising rates. Long-duration growth stocks (Technology, Utilities) bleed while Energy and banks hold up. No crash, just a long, frustrating decline. Teaches interest-rate sensitivity and sector rotation.'],
        ['Scenario: 2000-shape (bubble then bust)', 'A tech mania lifts the whole market for the first part of the session, then the bubble deflates and Technology leads a long bear market while defensive sectors (Utilities, Healthcare) hold up better. Teaches the danger of chasing hot sectors.'],
        ['Session length', 'Number of trading days to play: 30 (a month and a half), 60 (about a quarter), 120 (about six months) or 250 (about a year). Longer sessions give a fairer test of a strategy because luck averages out.'],
        ['Starting capital', '$10,000, $100,000 or $1,000,000. Larger accounts can diversify more finely; very large orders in small stocks start to move the price against you (market impact).'],
        ['Account: Cash', 'You can only buy with the cash you have. No borrowing and no short selling. The safest choice for beginners.'],
        ['Account: Margin', 'You can borrow up to 2x your equity and sell short. Magnifies gains and losses, charges interest on borrowed money, and can trigger forced liquidation (a margin call). See <b>Margin and shorting</b>.'],
        ['Trading costs: Retail broker', 'A realistic online broker: $0.005 per share commission ($1 minimum, never more than 1% of the trade), plus the bid/ask spread and market impact on every aggressive fill. The default and the one used in all graded modes.'],
        ['Trading costs: Zero-commission app', 'No commission, but the effective spread is 1.6x wider, because such apps are paid by routing your orders to market makers (payment for order flow). Often cheaper for small trades, more expensive for large or frequent ones.'],
        ['Trading costs: Frictionless (unrealistic)', 'No costs at all. Not realistic. Use it only to measure how much costs hurt you: play the same seed with and without costs and compare.'],
        ['Seed', 'A number that fixes the entire market: every price, headline and date. Leave it blank for a new random market. Enter a seed (shown in the debrief and the Account tab) to replay exactly the same market and try a different approach.'],
        ['Your name', 'Shown on the leaderboard as your account name. Stored only in this browser.']
      ]
    },
    {
      id: 'career', title: 'Career levels and daily challenge',
      intro: 'Graded modes with fixed settings. The market type is hidden: half the time it is the Random scenario, otherwise one of the five scripted shapes, and you only find out in the debrief.',
      items: [
        ['Level 1 · Foundations', '60 days, $100,000, cash account. Passing is about <b>process, not profit</b>: close at least 6 trades, plan a stop on at least 80% of new positions, keep the maximum drawdown better than -15%, and never lose more than 2.5% of starting capital on one trade. Rules warn but do not block.'],
        ['Level 2 · Funded Evaluation', 'Modelled on a prop-trading firm’s challenge. 60 days, $100,000, margin account. Reach +6% profit at any close and you pass immediately. Lose 3% or more in one day, or fall 8% below your equity peak, and you fail on the spot. Orders that break the 2% risk-per-trade or 30% position limits are blocked, and every new position needs a stop.'],
        ['Level 3 · Portfolio Manager Mandate', '120 days with $1,000,000, margin account. Pass by beating the index fund’s total return <b>and</b> its Sharpe ratio, keeping maximum drawdown better than -20%, and staying invested (average gross exposure of at least 50%: hiding in cash is not allowed).'],
        ['Locked / unlocked', 'Pass a level to unlock the next. Each attempt generates a brand new hidden market, so you cannot memorise it.'],
        ['Attempts', 'How many times you have started a level. Ending an attempt early counts as a fail.'],
        ['Daily challenge', 'One 60-day market per calendar day, the same for everyone who plays that day: $100,000, margin account, retail costs, hidden market type, practice-style rules. Your first finished attempt is recorded; replays are unranked.'],
        ['Unranked', 'A session that does not count towards level passes or your daily result: daily-challenge replays and any imported save file.'],
        ['Recent sessions', 'Your last 25 finished sessions on the home screen: result, your return, the index fund return, Sharpe ratio and maximum drawdown. <b>Reset progress</b> clears this list and your level passes.']
      ]
    },
    {
      id: 'topbar', title: 'Top bar',
      items: [
        ['Date and Day X of Y', 'The fictional calendar date of the last close, and how far through the session you are.'],
        ['TMX index', 'The Tack Market Index: all 40 stocks weighted by market value (bigger companies count more), like a real broad-market index. The percentage is today’s move. It is a price index; the tradable fund TMXI also includes dividends.'],
        ['Equity', 'What your account is worth right now: cash plus the value of long positions minus the value of short positions, at today\u2019s close. It changes even with no positions, because uninvested cash earns interest every day (see <b>Interest on cash</b> under Trading costs).'],
        ['Day P&L', 'Profit and loss for the most recent trading day, in dollars. After +5 days, the summary banner shows the total for all five days.'],
        ['Return vs index', 'Your total return since the start of the session, and below it the difference from the index fund (positive means you are ahead).'],
        ['Drawdown', 'How far your equity is below its highest point so far. 0% means you are at a new high.'],
        ['◐ (theme)', 'Switches between dark and light mode.'],
        ['? (help)', 'Opens this guide at the section that matches where you are.'],
        ['TACK', 'Tap the logo to go to the home screen. Your session keeps running in the background: use <b>Continue session</b> at the top of the home screen to return, or <b>End now</b> there to finish it and see the debrief.'],
        ['End', 'Finishes the session early and goes to the debrief. In a Career level this counts as a failed attempt. The same option is in Account & rules.'],
      ]
    },
    {
      id: 'watchlist', title: 'Market list (watchlist)',
      intro: 'All 40 fictional stocks plus the index fund. On a folded phone this is the <b>Market</b> tab.',
      items: [
        ['Coloured dot', 'The stock’s sector. Eight sectors: Technology, Healthcare, Financials, Energy, Consumer, Industrials, Utilities, Materials. Stocks in the same sector tend to move together.'],
        ['TMXI', 'The Tack Market Index Fund, a tradable fund that holds all 40 stocks by market value with dividends reinvested. Buying and holding it is the passive benchmark you are measured against.'],
        ['Tag L / S', 'You hold this stock long (L) or short (S).'],
        ['Tag E', 'An earnings report is due within 5 trading days. Expect a big overnight gap.'],
        ['Tag D', 'The stock goes ex-dividend within 5 trading days.'],
        ['Tag N', 'There was company news today.'],
        ['Sort: Sector', 'Groups stocks by sector, in the default order.'],
        ['Sort: Day change', 'Biggest gainers today at the top, biggest losers at the bottom.'],
        ['Sort: Volume vs avg', 'Today’s trading volume divided by its 20-day average, shown as e.g. <code>2.4x vol</code>. Unusual volume often means news or institutional buying or selling.'],
        ['Sort: Analyst upside', 'Distance from today’s price to the analyst target, shown as e.g. <code>+18% tgt</code>. Analysts are often wrong, but on average cheap stocks drift towards fair value slowly.'],
        ['Sort: Ticker', 'Alphabetical by symbol.'],
        ['Sector filters', 'Show only one sector. The index fund always stays at the top.']
      ]
    },
    {
      id: 'chart', title: 'Price chart',
      items: [
        ['Candlestick', 'Each bar is one day. The thick body runs from the open to the close: green if it closed higher than it opened, red if lower. The thin wick shows the day’s high and low.'],
        ['3M / 6M / 1Y', 'Show the last 63, 126 or 250 trading days.'],
        ['SMA20', 'Simple moving average of the last 20 closes (about a month). A common short-term trend line.'],
        ['SMA50', 'Simple moving average of the last 50 closes (about ten weeks). Price above a rising SMA50 is a classic sign of an uptrend; below a falling one, a downtrend.'],
        ['Vol', 'Shows daily trading volume as bars at the bottom, coloured like the candle.'],
        ['E marker', 'A day when the company reported earnings.'],
        ['D marker', 'An ex-dividend day. The price drops by about the dividend that morning.'],
        ['News dot', 'A company headline that day: green for good news, red for bad news, placed above the day’s high.'],
        ['avg line (dashed)', 'Your average cost if you hold the stock.'],
        ['lmt / tgt line', 'Price of a working limit order or bracket take-profit (target).'],
        ['stp line', 'Price of a working stop or bracket stop-loss.'],
        ['Price tag on the right', 'Today’s close, green if up on the day, red if down.'],
        ['Readout (top line)', 'Date, open (O), high (H), low (L), close (C), daily change and volume of the day under your pointer. Hover with a mouse or drag a finger across the chart to move through the days.']
      ]
    },
    {
      id: 'profile', title: 'Company profile',
      intro: 'The facts under the chart. All are known at today’s close; none of them reveals the future.',
      items: [
        ['Sector', 'The industry group. Sectors respond differently to the economy and to interest rates.'],
        ['Market cap', 'Share price times number of shares: the market value of the whole company. Large caps are more liquid and cheaper to trade; small caps have wider spreads and higher borrow fees.'],
        ['Beta (1y)', 'How much the stock tends to move when the market moves, measured over the last year. 1.0 moves with the market; 1.5 moves about 50% more; 0.5 about half as much. High beta amplifies both rallies and crashes.'],
        ['20-day volatility', 'How much the price has been swinging over the last 20 days, annualised. 20% is calm for a stock; 50%+ is wild. Volatility clusters: calm periods and stormy periods tend to persist.'],
        ['P/E (trailing)', 'Price divided by the last 12 months’ earnings per share. How many years of current profit you pay for. High P/E usually means investors expect fast growth; low P/E means low expectations or a cheap stock. "n/m" means not meaningful.'],
        ['EPS growth est.', 'The expected annual growth rate of earnings per share. Fast-growing companies justify higher P/E ratios.'],
        ['Dividend yield', 'Annual dividend as a percentage of the share price. Paid quarterly.'],
        ['Analyst target', 'The consensus price target from (fictional) analysts, and the upside or downside from today’s price. Targets are noisy and some analysts are persistently too optimistic or pessimistic about a stock, but on average prices drift slowly towards fair value. Targets update at each earnings report.'],
        ['52-week range', 'The lowest and highest prices of the past year.'],
        ['Avg volume (20d)', 'Average number of shares traded per day over the last 20 days. Orders above about 5% of this will move the price noticeably.'],
        ['Spread', 'Today’s typical gap between the buy (ask) and sell (bid) price, in basis points (1 bp = 0.01%). You pay half of it each time you trade aggressively. It widens when volatility rises.'],
        ['Borrow fee', 'Annual cost of borrowing shares to sell short, charged daily on the value of the short. About 0.25% for big companies, up to 3% for smaller ones.'],
        ['HTB (hard to borrow)', 'Few shares are available to borrow, so shorting costs 8–25% a year. Crowded shorts can also rise sharply.'],
        ['Next earnings', 'Date of the next quarterly report, trading days away, and the <b>implied move</b>.'],
        ['Implied move', 'The typical size of the stock’s earnings-day move, in either direction (what an options market would price). It tells you how big the gap might be, not which way it will go. Holding through earnings is a deliberate bet on the result.'],
        ['Next ex-dividend', 'The ex-dividend date and amount per share, announced at the previous earnings report. "Not yet declared" means the amount is not announced yet.'],
        ['Index fund: Holdings', 'TMXI holds all 40 stocks by market value. One trade gives you the whole market.'],
        ['Index fund: Dividends reinvested', 'TMXI does not pay dividends out; they are added to its price (a total-return fund), so it is a fair benchmark against stock pickers who collect dividends.']
      ]
    },
    {
      id: 'ticket', title: 'Order ticket',
      intro: 'Where you build an order. On a folded phone this is the <b>Trade</b> tab.',
      items: [
        ['Buy', 'Buy shares. If you are short, this is shown as <b>Buy to cover</b> and reduces or closes the short.'],
        ['Sell / Sell short', 'Sell shares you own. On a margin account with no long position this becomes <b>Sell short</b>: you sell borrowed shares, hoping to buy them back cheaper later.'],
        ['Order type: Market', 'Fills at the next open at whatever the price is, plus half the spread and market impact. Certain to fill, uncertain price.'],
        ['Order type: Limit', 'A buy limit fills only at your price or lower; a sell limit at your price or higher. Certain price (or better), uncertain fill. Limit fills that wait for the price to come to you are <b>passive</b> and avoid the spread and impact.'],
        ['Order type: Stop', 'Dormant until the price trades through your stop, then becomes a market order. Used to cut losses (sell stop below the price) or to enter breakouts (buy stop above it). A stop is not a guaranteed price: if the stock gaps through it, you are filled at the open.'],
        ['Order type: Stop-limit', 'Triggers like a stop, but then only fills at your limit or better. Protects you from a terrible fill, but in a big gap it may not fill at all and leave you holding the position.'],
        ['Quantity / max', 'Number of shares (whole shares only). <b>max</b> fills in the most you can afford with your buying power, or your full position when closing.'],
        ['Stop price', 'The trigger price for a stop or stop-limit order.'],
        ['Limit price', 'The worst price you accept for a limit or stop-limit order.'],
        ['Time in force: Day', 'The order is cancelled if it has not filled by the end of tomorrow.'],
        ['Time in force: GTC (60d)', 'Good-till-cancelled: keeps working day after day until it fills, you cancel it, or 60 trading days pass.'],
        ['Attach bracket', 'Adds two exit orders that activate when your entry fills: a <b>stop-loss</b> (stop order) and a <b>take-profit</b> (limit order). They are <b>OCO</b>, one cancels the other: when one fills, the other is cancelled. Bracket exits are GTC.'],
        ['Stop-loss', 'Price where you admit the trade is wrong and get out. Below the entry for a long, above it for a short.'],
        ['Take-profit', 'Price where you bank the gain. Optional.'],
        ['2 ATR (button)', 'Suggests a stop two Average True Ranges away from today’s close: far enough that normal daily noise should not hit it.'],
        ['2R (button)', 'Sets the take-profit at twice your risk: if the stop is $3 away, the target is $6 away (reward:risk of 2:1).'],
        ['Exits on a short trade', 'A short profits when the price falls, so everything is mirrored compared with a buy: the stop-loss goes <b>above</b> the entry and the take-profit <b>below</b> it. Example: short at $93.09 with an ATR of $1.53. The 2 ATR stop is 93.09 + 3.06 = $96.15 (1R of risk), and the 2R target is 93.09 − 6.12 = $86.97. The labels next to each field say which side of the entry it belongs on.'],
        ['Closing orders', 'If you already hold the stock, Sell closes or reduces the position (and Buy to cover does the same for a short). A bracket and planned stop only apply to new positions, so the ticket hides them for closing orders. To protect a position you already hold, place a <b>Stop</b> order, or use <b>Stop</b> on the Positions tab.'],
        ['Planned stop', 'If you do not attach a bracket, record where you would exit anyway. It is not an order, but it lets the game size the trade, measure it in R, and check your discipline.'],
        ['Risk % of equity', 'How much of your account you are willing to lose if the stop is hit. 0.5–1% per trade is a common professional range.'],
        ['Size from stop', 'Calculates the quantity: <code>equity × risk% ÷ distance to stop</code>. Example: $100,000 × 1% = $1,000; entry $50, stop $47, so $3 risk per share, so 333 shares. It is reduced automatically if that would break your position limit or buying power.'],
        ['ATR (14d)', 'Average True Range over 14 days: the typical daily price range in dollars, including gaps. A practical yardstick for stop distances.'],
        ['Setup', 'A label for why you are trading, used to show which setups make or lose you money in the Journal.'],
        ['Setup: Breakout', 'Buying as price breaks above a range or prior high (or shorting a breakdown).'],
        ['Setup: Pullback in trend', 'Buying a dip within an established uptrend, often near a moving average.'],
        ['Setup: Trend following', 'Riding an existing trend without trying to time entries precisely.'],
        ['Setup: Mean reversion', 'Betting that an unusually sharp move will partly reverse.'],
        ['Setup: Value', 'Buying because the stock looks cheap against earnings or the analyst target.'],
        ['Setup: Earnings play', 'A position taken specifically to hold through, or trade after, an earnings report.'],
        ['Setup: News reaction', 'Trading in response to a headline.'],
        ['Setup: Hedge', 'A position meant to reduce risk elsewhere, e.g. a protective stop or shorting the index fund against your longs.'],
        ['Setup: Core / index', 'A long-term holding such as the index fund.'],
        ['Setup: Other', 'Anything else.'],
        ['Thesis', 'One or two sentences on why this trade and why now. Writing it down is the single best habit for learning from your trades.'],
        ['Buying power', 'How much you can spend on new positions. Cash account: cash minus cash reserved by working buy orders. Margin account: up to 2x your equity minus what you already hold.'],
        ['Queue order', 'Sends the order. It starts working at tomorrow’s open. You can edit or cancel it in the Orders tab until then.'],
        ['Several orders per day', 'You can queue as many orders as you like before pressing <b>Next day</b>, on the same stock or on different ones. They are all worked during the next day in the order the price reaches them.'],
        ['Reserved by queued orders', 'Queuing an order sets money aside so you cannot spend it twice. On a cash account, each queued buy holds its value plus estimated costs (commission, spread and impact). On a margin account, each queued order that opens or adds to a position holds that much of your 2x buying power, and its estimated costs. The amount is released if you cancel the order or it expires. Your equity does not change: only your buying power does. The ticket shows the total reserved.'],
        ['Shares committed to queued orders', 'Shares you have already promised to a queued sell (or buy-to-cover) cannot be sold again by another order. On a cash account a second sell of the same shares is refused. On a margin account it is allowed, but the ticket warns you that the extra shares would open a short position (or a long one when covering). Bracket stop-losses and take-profits are protective exits and do not count: they cancel each other and never sell more than you hold.'],
        ['Why the fill can differ from the reservation', 'Reservations use today\u2019s close (or your limit or stop price) and estimated costs. Market orders fill at tomorrow\u2019s open, so a gap up can make a buy cost more than was reserved. If you then lack the cash or margin, the order is rejected at the open and shown in the day summary and Activity.'],
      ]
    },
    {
      id: 'preview', title: 'Order preview and warnings',
      intro: 'The box under the ticket updates as you type.',
      items: [
        ['Reference price', 'The price used for estimates: today’s close for market orders, your limit or stop price otherwise. The real fill can differ, especially after a gap.'],
        ['Notional', 'Quantity times reference price, and what share of your equity the trade is.'],
        ['Est. costs', 'Commission plus estimated spread and market impact, in dollars and in basis points of the trade value.'],
        ['commission · spread · impact', 'The three parts of the cost estimate. See <b>Trading costs explained</b>.'],
        ['Risk to stop', 'How much you lose if the stop is hit: quantity × distance to stop. Compare it with your risk limit.'],
        ['Reward : risk', 'Distance to the take-profit divided by distance to the stop. Below 1:1 you need to be right more often than you are wrong.'],
        ['✕ (red)', 'A blocking problem: the order cannot be sent until you fix it.'],
        ['! (amber)', 'A warning: a rule is broken or there is a risk you should know about. In graded modes set to "block", rule warnings become blocking.'],
        ['i (grey)', 'Information worth knowing.'],
        ['Warning: up X% in 5 days', 'You are buying after a sharp run-up (more than 8% in five days). It could be momentum, or it could be chasing. The coach counts these.'],
        ['Warning: averaging down', 'You are adding to a position that is already more than 3% against you.'],
        ['Warning: earnings in N days', 'An earnings gap is coming within 7 trading days. Size accordingly.'],
        ['Warning: ex-dividend (shorts)', 'If you are short on the ex-dividend date, you pay the dividend.'],
        ['Warning: % of average daily volume', 'Your order is more than 5% of a typical day’s volume, so market impact will be significant.'],
        ['Warning: limit through the price', 'A buy limit above (or sell limit below) today’s close will almost certainly fill at the open, like a market order.'],
        ['Warning: stop through the price', 'The stop is already on the wrong side of today’s close and will trigger at the open.'],
        ['Cool-off', 'After you hit your daily loss limit, new positions are blocked for the next day. You can still close or reduce positions.']
      ]
    },
    {
      id: 'fills', title: 'How orders fill',
      items: [
        ['Daily price path', 'Each day the price moves from the open to the high and low (in a realistic order: on most up days the low comes first) and then to the close. Limits and stops are checked along this path in time order, so a stop-loss and a take-profit on the same day fill in the order the price reaches them.'],
        ['Aggressive (taker) fill', 'Market orders, stops and limits that are already marketable at the open. They pay half the spread plus market impact.'],
        ['Passive (maker) fill', 'A limit order that waited for the price to come to it. It fills at exactly your limit with no spread or impact cost.'],
        ['Gapped through stop', 'The stock opened beyond your stop, so the stop filled at the open, worse than the stop price. This is why losses can exceed 1R.'],
        ['Reduce-only', 'Bracket exits can only shrink a position, never reverse it. If the position is already closed they are cancelled automatically.'],
        ['Rejected', 'The broker refused the order at execution time: insufficient cash, insufficient buying power on margin, or a short in a cash account.'],
        ['Expired', 'A Day order that did not fill tomorrow, or a GTC order older than 60 trading days.']
      ]
    },
    {
      id: 'costs', title: 'Trading costs explained',
      intro: 'Costs are certain while profits are not. Small costs repeated many times are one of the main reasons active traders underperform the index.',
      items: [
        ['Commission', 'The broker’s fee per trade. Retail model: $0.005 per share, $1 minimum, never more than 1% of the trade value. Charged on every fill, entry and exit.'],
        ['Bid/ask spread', 'Buyers pay the ask and sellers receive the bid; the gap between them is the spread. Every aggressive trade gives up half of it. Large, calm stocks have spreads of 1–3 bp; small or volatile ones 10–30 bp or more.'],
        ['Spread widening', 'When a stock’s recent volatility rises, its spread widens (up to 3x normal), just like real markets in a sell-off: trading is most expensive exactly when you most want to trade.'],
        ['Market impact', 'Big orders push the price against you. Estimated by the square-root law used by professional desks: <code>impact ≈ 0.7 × daily volatility × √(shares ÷ average daily volume)</code>. Doubling the size raises impact per share by about 40%.'],
        ['Basis point (bp)', 'One hundredth of a percent (0.01%). 25 bp on a $10,000 trade is $25.'],
        ['Short borrow fee', 'Annual percentage charged daily on the value of shares you have borrowed to short.'],
        ['Margin interest', 'If your cash goes negative on a margin account you are borrowing from the broker and pay the policy rate plus 2.5% a year, charged daily.'],
        ['Interest on cash', 'Positive cash earns the policy rate minus 0.5% a year, credited after every close, just as a real broker pays interest on idle cash. Example: $100,000 at a 3.75% policy rate earns 3.25% a year, about $12.90 per trading day. That is why your equity rises slowly even with no positions. The daily amount appears in the day summary and the running total in Positions. Proceeds from short sales do not earn interest. Cash is not a zero-return position: it is the risk-free benchmark used in the Sharpe ratio.'],
        ['Policy rate', 'The central bank’s interest rate, changed at the rate decisions shown in the calendar. It sets what cash earns and what borrowing costs.'],
        ['Trading costs (metric)', 'Commission + spread + impact + borrow fees, in dollars and as a percentage of starting capital. Interest and dividends are shown separately because they can be positive.']
      ]
    },
    {
      id: 'margin', title: 'Margin and shorting',
      items: [
        ['Long', 'You own the shares and profit if the price rises. The most you can lose is what you paid.'],
        ['Short', 'You sold borrowed shares and profit if the price falls. The loss is unlimited, because the price can keep rising. You pay a borrow fee and any dividends.'],
        ['Leverage', 'Holding positions worth more than your equity by borrowing. 2x leverage doubles both your gains and your losses.'],
        ['Initial margin (50%)', 'On a margin account, new positions can bring your total long plus short exposure up to 2x your equity.'],
        ['Maintenance margin', 'The minimum equity the broker requires: 25% of the value of your longs plus 30% of your shorts. Checked at every close.'],
        ['Margin call', 'If equity falls below maintenance, the broker sells your largest positions at the close without asking, until you are safely back above the requirement. Forced selling happens at the worst time, and the coach flags it.'],
        ['Cash (margin loan)', 'A negative cash balance means you are borrowing from the broker.'],
        ['Gross exposure', '(Long value + short value) ÷ equity. 100% means fully invested with no leverage; 150% means leveraged.'],
        ['Net exposure', '(Long value − short value) ÷ equity: your overall bet on the market’s direction.']
      ]
    },
    {
      id: 'portfolio', title: 'Portfolio tabs',
      intro: 'Under the chart (on a folded phone: the <b>Portfolio</b> tab).',
      items: [
        ['Positions: summary', 'Equity, cash, total long and short value, gross exposure and buying power.'],
        ['Qty', 'Shares held, L for long or S for short.'],
        ['Avg cost', 'Average price paid per share, including spread and impact but excluding commission.'],
        ['Value', 'Shares × today’s close (negative for shorts).'],
        ['Weight', 'Position value as a percentage of your equity. Large weights mean concentrated risk.'],
        ['Unrealised', 'Profit or loss on the open position at today’s close, in dollars and percent. It becomes realised when you close.'],
        ['Today', 'How much this position made or lost on the last day.'],
        ['Stop', 'The working stop order protecting the position, your planned stop (not an order) if there is none, or <b>none</b> in red.'],
        ['Held', 'Trading days since you opened the position.'],
        ['Earnings', 'Trading days until the next earnings report.'],
        ['Stop (button)', 'Prefills the ticket with a protective GTC stop order two ATRs away for the full position.'],
        ['Close (button)', 'Cancels the position’s exit orders and queues a market order to close it at the next open.'],
        ['Orders: Working', 'Orders waiting to fill. <b>Pending</b> ("waits for entry") is a bracket exit that activates once its entry fills. <b>Triggered</b> is a stop-limit whose stop was hit but whose limit has not filled yet. Edit changes quantity or price; Cancel removes it.'],
        ['Orders: Recent', 'Filled, cancelled, expired and rejected orders, with the reason.'],
        ['Activity', 'A diary of everything the broker did: fills, dividends received or paid, expiries, rejections and margin calls.'],
        ['News & calendar', 'Headlines from the last 30 days and the schedule for the next 15 trading days. MACRO marks market-wide events; E is earnings with its implied move; D is ex-dividend. "My positions only" filters to stocks you hold.'],
        ['Macro: Inflation (CPI) report', 'Monthly consumer-price inflation versus expectations. Hotter than expected pushes interest rates up and the market down, hitting rate-sensitive sectors hardest.'],
        ['Macro: Jobs report', 'Monthly payrolls versus expectations. A strong report usually helps stocks, especially in weak markets, but also pushes rates up.'],
        ['Macro: Central bank rate decision', 'Every 42 trading days the central bank hikes, cuts or holds. Markets move on the <b>surprise</b> compared with what was expected, not on the decision itself.']
      ]
    },
    {
      id: 'performance', title: 'Performance metrics',
      intro: 'Shown in the Performance tab and the debrief. Most need at least 10 trading days to be meaningful.',
      items: [
        ['Equity chart', 'Your return over the session against the bots you switch on. Same market, same costs: the fairest comparison possible.'],
        ['Drawdown chart', 'How far below its previous peak each account was on every day, you versus the index fund.'],
        ['Total return', 'Percentage change in equity since the start of the session.'],
        ['Index fund', 'The total return of buying TMXI on day one and holding (before its tiny one-off trading cost).'],
        ['Excess return', 'Your return minus the index fund’s. The value you added (or lost) by trading.'],
        ['Volatility (ann.)', 'Standard deviation of your daily returns, annualised (× √252). How bumpy the ride was.'],
        ['Sharpe ratio', 'Return above the risk-free rate (cash interest) per unit of volatility, annualised. The standard measure of risk-adjusted performance. Above 0.5 is decent, above 1 is good, above 2 over a long period is exceptional.'],
        ['Sortino ratio', 'Like Sharpe, but only counts downside volatility, so it does not penalise big up days.'],
        ['Max drawdown', 'The largest fall from a peak to a later low. A −50% drawdown needs +100% to recover.'],
        ['Beta to index', 'How sensitive your daily returns were to the index. Beta 1 is market-like; 0 is unrelated to the market; negative means you were net short.'],
        ['Alpha (ann.)', 'Return not explained by your beta: what you earned beyond the market exposure you took. The skill part, if it lasts.'],
        ['Closed trades', 'Round trips from opening a position to fully closing it.'],
        ['Win rate', 'Share of closed trades with a positive net result (after commission, borrow fees and dividends).'],
        ['Profit factor', 'Total of winning trades ÷ total of losing trades. Above 1 means you made money overall; 1.5+ is solid.'],
        ['Expectancy / trade', 'Average net dollars per closed trade. What each new trade is worth to you on average.'],
        ['Average R', 'Average trade result measured in R (see Journal). Only trades with a planned stop count.'],
        ['Avg hold win / loss', 'Average days held for winners versus losers. Holding losers much longer is a classic warning sign.'],
        ['Gross exposure (avg)', 'Average (long + short) ÷ equity over the session. Low means you sat mostly in cash.'],
        ['Turnover (ann.)', 'Total value traded ÷ average equity, annualised. 100% means you replaced the portfolio once a year; 2,000% is very active, and costly.'],
        ['Realised P&L (after spread)', 'Profit or loss locked in by closing positions. Spread and impact are already included in the prices.'],
        ['Commission / Spread + impact / Borrow / Interest / Dividends', 'Where the money went, line by line.']
      ]
    },
    {
      id: 'bots', title: 'Leaderboard and bots',
      intro: 'Five automated accounts trade the same market as you, with the same starting capital and costs, using cash accounts. They show what simple, disciplined approaches achieve.',
      items: [
        ['Index fund', 'Buys TMXI on day one and never trades again. If you cannot beat it over many sessions, a low-cost index fund is the better choice in real life too.'],
        ['Equal-weight', 'Buys all 40 stocks in equal dollar amounts on day one and holds. Gives small companies as much weight as large ones.'],
        ['Momentum bot', 'Every 21 trading days holds the 8 stocks with the best 6-month return, skipping the most recent week (a classic academic momentum rule). Works in trending markets, suffers in sharp reversals.'],
        ['Value bot', 'Every 21 trading days holds the 8 stocks with the most upside to their analyst target. Value pays off slowly and unevenly.'],
        ['Rules bot', 'Buys a random stock every day (up to its maximum positions) and exits only through your rules. Because entries are random, its result shows what your <b>exit and sizing rules</b> are worth on their own.'],
        ['Rules bot: Stop-loss %', 'Exit if the price falls this far below the entry. Default 8%.'],
        ['Rules bot: Take-profit %', 'Exit if the price rises this far above the entry. 0 means no target. Default 16%.'],
        ['Rules bot: Trailing stop %', 'Moves the stop up behind the highest close since entry, this far below it, so gains are protected as the price rises. 0 turns it off.'],
        ['Rules bot: Max hold days', 'Sell at the next open after this many days regardless. 0 means no limit. Default 20.'],
        ['Rules bot: Position size %', 'Each new position’s size as a percentage of equity. Default 10%.'],
        ['Rules bot: Max positions', 'Most positions held at once. Default 8.'],
        ['Leaderboard columns', 'Return, volatility, Sharpe ratio, maximum drawdown, number of fills and total trading costs for each account.']
      ]
    },
    {
      id: 'journal', title: 'Journal',
      items: [
        ['By setup', 'Your results grouped by the setup tag: number of trades, win rate, average R and net P&L. Shows which kinds of trades actually work for you.'],
        ['Open trades', 'Current positions with their setup, planned stop and thesis.'],
        ['R-multiple', 'Trade result divided by the risk you planned (entry to stop × shares). +2R means you made twice what you risked; −1R means you lost exactly what you planned. It lets you compare trades of any size.'],
        ['MAE', 'Maximum adverse excursion: the worst point the trade reached against you, in percent. A large MAE on winners means your stops may be too tight, or you got lucky.'],
        ['MFE', 'Maximum favourable excursion: the best point the trade reached in your favour. A large MFE on a losing trade means you gave back a profit.'],
        ['Exit reason', '<b>manual</b> (your order), <b>stop</b> (a stop or stop-loss), <b>target</b> (take-profit) or <b>margin call</b> (forced by the broker).'],
        ['Lesson', 'A free-text note you add after the trade. It is saved and included in the CSV export.']
      ]
    },
    {
      id: 'account', title: 'Account and rules',
      items: [
        ['Max risk per trade', 'The most you allow yourself to lose on one trade if the stop is hit, as a percentage of equity. The ticket checks it whenever you set a stop.'],
        ['Max position size', 'The largest single position as a percentage of equity.'],
        ['Daily loss limit', 'If your equity falls this much in one day, new positions are blocked for the next day (a cool-off). In the Level 2 evaluation, hitting it is an immediate fail.'],
        ['Max drawdown alert', 'Warns you when equity falls this far below its peak. In Level 2 it is a hard limit that ends the evaluation.'],
        ['Require a planned stop', 'Flags (or blocks) new positions without a bracket stop-loss or planned stop.'],
        ['Require a setup tag', 'Flags (or blocks) new positions without a setup label.'],
        ['Warn me / Block the order', 'Whether a broken rule just shows an amber warning or stops the order being sent. Only editable in Practice; graded modes have fixed rules.'],
        ['Hard rules', 'In Level 2, breaking the daily loss or drawdown limit ends the attempt as a fail, exactly like a prop-firm evaluation.'],
        ['Market seed', 'The number that fixes this market. Hidden during graded sessions, shown afterwards.'],
        ['Export save', 'Downloads the full session as a .json file. Use it as a backup or to move a session between devices; import it from the home screen. Imported sessions are unranked.'],
        ['Export trades (CSV)', 'Downloads all closed trades with dates, prices, P&L, R, setup, thesis and lesson, for Excel or Google Sheets.'],
        ['End session now', 'Stops the session and shows the debrief. In a level this counts as a fail.']
      ]
    },
    {
      id: 'debrief', title: 'Debrief',
      intro: 'Shown when a session ends.',
      items: [
        ['Result', 'PASSED or FAILED for levels, with the reason, and a check-by-check list of the goals. Practice and daily sessions show your return.'],
        ['What the market was really doing', 'The hidden truth: the scenario and the sequence of market regimes, each with its length and the index return during it. Compare it with how you traded.'],
        ['Regime: Bull market', 'Steadily rising prices with low volatility (index drift about +16% a year, volatility about 11%).'],
        ['Regime: Choppy, range-bound', 'Little net progress, moderate volatility. Trend-following struggles; patience pays.'],
        ['Regime: Bear market', 'Falling prices (about −25% a year) and high volatility. Rallies are often sharp but short-lived.'],
        ['Regime: Crash', 'A rapid, violent fall with extreme volatility. Correlations jump, so almost everything falls together and diversification helps least.'],
        ['Regime: Recovery rally', 'A fast rebound after a crash. Missing the first days of a recovery is very costly.'],
        ['Your coach', 'Observations from your actual trades. Red is a damaging habit, amber a warning, blue information and green a strength.'],
        ['Disposition effect', 'The tendency to sell winners too early and hold losers too long. Measured the way academic researchers do: on days you sold, what share of your available gains you took versus what share of your available losses.'],
        ['Best / worst trades', 'Your three best and three worst closed trades, with their R-multiple, holding period, exit reason and thesis.'],
        ['Review board', 'Go back to the final day’s board to inspect charts, orders and the journal. Trading is disabled.']
      ]
    },
    {
      id: 'model', title: 'How this market behaves',
      intro: 'Knowing the rules of the simulation helps you learn the right lessons. The behaviours below are modelled on well-documented features of real stock markets.',
      items: [
        ['Positive drift', 'Over long periods stocks rise, because investors demand a reward for risk. Time in the market matters.'],
        ['Regimes', 'The market switches between bull, choppy, bear, crash and recovery phases. Each has a different drift and volatility.'],
        ['Volatility clustering', 'Big moves tend to follow big moves. Falls raise volatility more than rises do (the leverage effect).'],
        ['Fat tails', 'Extreme days happen far more often than a normal bell curve would suggest.'],
        ['Market, sector and rate factors', 'Each stock moves partly with the market (its beta), partly with its sector, partly with interest rates (growth stocks and utilities fall when yields rise; banks and energy less so), and partly on its own.'],
        ['Momentum', 'Stocks that have done well over recent months tend to keep doing slightly better for a while. A real but weak edge.'],
        ['Post-earnings drift', 'After a big earnings surprise, the price tends to keep drifting in the same direction for weeks.'],
        ['Valuation mean-reversion', 'Prices are pulled slowly towards fair value. Cheap stocks tend to catch up, but over months, not days.'],
        ['Short-term reversal', 'Yesterday’s stock-specific move tends to reverse very slightly the next day.'],
        ['Takeover rumours', 'A rumoured bid lifts a stock. Later it is either confirmed (the price jumps to the deal price and then barely moves) or denied (much of the premium disappears).'],
        ['Edges versus noise', 'All these edges are small compared with day-to-day randomness, and trading costs can easily eat them. Just like real markets: consistent outperformance is hard, and risk control is what keeps you in the game.']
      ]
    },
    {
      id: 'glossary', title: 'General glossary',
      items: [
        ['Benchmark', 'What you compare your results with, here the index fund. Beating the market only counts if it is measured against a fair benchmark.'],
        ['Diversification', 'Spreading money across many positions so that no single surprise hurts much. It removes stock-specific risk, not market risk.'],
        ['Correlation', 'How closely two things move together, from −1 (opposite) to +1 (identical). Stocks here have a correlation of about 0.5 with the market, rising in crashes.'],
        ['Liquidity', 'How easily you can trade without moving the price. High volume and tight spreads mean good liquidity.'],
        ['Volume', 'Number of shares traded in a day.'],
        ['Earnings (EPS)', 'Earnings per share: company profit divided by the number of shares. Reported every quarter (every 63 trading days here).'],
        ['Earnings surprise', 'The difference between reported and expected EPS. Prices react to surprises, not to the earnings level itself.'],
        ['Guidance', 'A company’s own forecast. Raising or cutting it often moves the price more than the quarter’s results.'],
        ['Dividend', 'Cash a company pays shareholders, usually quarterly.'],
        ['Ex-dividend date', 'The first day a buyer no longer receives the next dividend. The price drops by about the dividend at that open. Whoever held at the previous close gets paid.'],
        ['Upgrade / downgrade', 'An analyst raising or lowering their rating. Usually moves the price modestly on the day.'],
        ['Share buyback', 'A company buying its own shares, which supports the price and raises earnings per share.'],
        ['Secondary offering', 'A company selling new shares, which dilutes existing holders and usually lowers the price.'],
        ['Realised / unrealised P&L', 'Realised profit is locked in by closing a position; unrealised profit is on paper and can still disappear.'],
        ['Position sizing', 'Deciding how many shares to trade. Professionals size from the stop distance and a fixed percentage of capital, not from how confident they feel.'],
        ['Risk-free rate', 'What cash earns with no risk, here the policy rate minus 0.5%. Used in the Sharpe ratio.'],
        ['Annualised', 'Converted to a yearly figure so periods of different lengths can be compared. 252 trading days make a year.']
      ]
    }
  ];

  // Which help section to open from each place in the app.
  TM.HELP_CONTEXT = {
    home: 'practice', game: 'start', end: 'debrief', ticket: 'ticket', watch: 'watchlist', chart: 'chart',
    positions: 'portfolio', orders: 'portfolio', activity: 'portfolio', news: 'portfolio', performance: 'performance',
    leaderboard: 'bots', journal: 'journal', learn: 'model', account: 'account'
  };
})(TM);
