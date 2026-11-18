# Strategy Intelligence: implementation and validation plan

## Scope in this change
- Adds a shared contract-specific research engine for digit, directional, barrier, accumulator, vanilla, multiplier and turbo contract families.
- Runs the applicable strategy evaluators concurrently with `Promise.all`.
- Reports sample sizes, baseline comparisons, Wilson intervals, conditional digit transitions, momentum, mean-reversion context, volatility regime and contract-specific risk diagnostics.
- Adds payout-adjusted expected-value and entry freshness helpers.
- Analysis Tool scans fresh markets concurrently and publishes research diagnostics rather than forwarding an uncalibrated heuristic as an executable signal.

## Important safety boundary
All strategies are marked `research-only` and `calibrated: false`. The engine intentionally returns `tradable: false`. It does not claim an edge, train a machine-learning model, guarantee profitability, or place orders. A model may be promoted only after a versioned, unseen-outcome validation process demonstrates calibrated probabilities and positive payout-adjusted expected value after costs.

## Contract-specific requirements
- Digits: Over/Under, Matches/Differs and Even/Odd each compare observed outcomes with their contract baseline. Conditional transitions and distribution drift are diagnostics, not proof of predictability.
- Rise/Fall: directional return forecasts must be calibrated at the selected expiry horizon.
- Higher/Lower: the actual barrier distance and expiry distribution are required.
- Touch/No Touch: first-passage / barrier-survival modelling is required; terminal direction alone is insufficient.
- Turbos: exact contract knock-out and barrier terms are required.
- Accumulators: growth rate, permitted range and tick-by-tick breach rules are required.
- Vanillas: option quotes, expiry and volatility inputs are required before Greeks or fair value can be estimated.
- Multipliers: leverage, stop, take-profit and cancellation terms are required for exposure modelling.

## Parallelism and latency
Market snapshots are shared by the strategy evaluators; evaluators do not open their own market-data sockets. A single scan uses concurrent Promise jobs, with a guard against overlapping scan cycles. Entry freshness must be checked again immediately before a buy request. Tick-duration contracts must not be treated as wall-clock expiry timers.

## Validation gates before live strategy promotion
1. Replay historical data with strictly chronological train/validation/test partitions.
2. Use walk-forward validation and purge overlapping labels where applicable.
3. Compare each model with the theoretical contract baseline and simple benchmark.
4. Calibrate probability estimates and report confidence intervals.
5. Compute expected value using actual proposal payouts, stake basis and loss exposure.
6. Test each market, subtype, option and duration independently.
7. Run demo-only forward tests and record entry latency, stale-signal rejection, quote latency, buy confirmation and settlement.
8. Keep strategy disabled if sample size, calibration, stability or payout-aware expected value fails.

## Test command
Run `npm test` from `frontend`.
