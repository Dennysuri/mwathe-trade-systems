# Scalability and security readiness

## Changes in this branch

- Adds shared Upstash Redis fixed-window rate limiting to the AutoD AI password endpoint and OAuth token-exchange endpoint. The counter is shared across Vercel serverless instances; it is not an in-memory per-instance limit.
- Rejects requests from origins that are not explicitly allowed.
- Restricts OAuth redirect URIs to the requesting application's exact origin and `/callback` path.
- Validates OAuth payload types and PKCE verifier format, adds an outbound timeout, and returns generic upstream errors.
- Removes OAuth authorization-code logging and strips callback query parameters from the visible browser URL before exchanging the code.
- Adds browser security headers, including HSTS, anti-framing, MIME sniffing protection, a restrictive base URI, and disabled object embeds.

## Required Vercel environment variables

Configure these for **Production, Preview, and Development** as appropriate, then redeploy:

| Variable | Required | Purpose |
| --- | --- | --- |
| `AUTOD_AI_PASSWORD` | Yes | AutoD AI password, stored only on the server |
| `UPSTASH_REDIS_REST_URL` | Yes | HTTPS REST URL for a shared Upstash Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash REST access token; never expose with a `VITE_` prefix |
| `APP_ORIGINS` | Recommended | Comma-separated exact HTTPS origins for the production app and any custom domain |
| `DERIV_CLIENT_ID` | Optional | Deriv OAuth app ID; falls back to the existing public app ID |

The production Vercel origin currently known to this project is
`https://mwathe-trade-systems-gamma.vercel.app`. It is included as a default allowed origin.
Add any other production/custom domain to `APP_ORIGINS`, without a trailing slash.
The OAuth callback registered with Deriv must remain `<allowed-origin>/callback`.

**Fail-closed behaviour:** the two API endpoints return HTTP 503 if Upstash rate limiting is not configured or unavailable. Configure both Upstash variables before deploying this branch.

## Current architecture and 100+ user capacity

The application is a Vite/React frontend deployed on Vercel. Authenticated Deriv market-data and trading WebSockets are opened from each user's browser. This means Vercel does not proxy every tick or trade, and each user's Deriv account token remains associated with that user's browser session.

AutoD AI currently subscribes to the configured volatility-index symbol list from each active browser session. If 100 users run it at once, that can mean roughly 1,300 market subscriptions before counting Analysis Tool and other bots. The actual safe limit depends on Deriv's current per-app/per-connection limits, user devices and network quality; this repository does not contain a measured 100-user load test.

Do not claim a verified 100-user capacity based only on a successful Vercel build. Before public launch:

1. Confirm Deriv's current WebSocket, subscription and request limits for this app ID and account types.
2. Load-test the Vercel API routes and static delivery at 100, 150 and 200 virtual users. Use a dedicated staging deployment and test credentials; never submit live buy requests from a load test.
3. Measure browser memory, CPU, reconnect rate, message throughput and UI responsiveness with representative low-end Android devices.
4. Test 100 simultaneous independent demo accounts and record Deriv disconnects, throttling errors, dropped ticks and order latency.
5. If market-data subscriptions become the bottleneck, introduce a dedicated market-data fan-out service for **public tick data only**. Keep each user's authenticated account, proposal, buy and open-contract monitoring isolated; never share account tokens or trade state between users.
6. Add persistent per-user trade/session state and idempotency before moving trade execution to a server-side worker. A serverless function must not be treated as a long-running trading process.

## Security limitations to address before a broad launch

- Deriv access tokens are currently stored in browser `localStorage`. This is exposed to successful same-origin script injection. The callback no longer logs OAuth codes, but a stronger long-term design is a backend-for-frontend session with HttpOnly, Secure, SameSite cookies and server-side token storage. This requires a deliberate migration because the current trading engines use the token directly in browser WebSockets.
- AutoD AI's password is currently a UI access gate, not a complete per-user authorization system for a server-side trading API. Do not reuse the password for other services.
- Keep GitHub/Vercel secrets out of source code and never use `VITE_*` for secrets.
- Enable GitHub secret scanning and Dependabot alerts; rotate any credential ever committed to repository history.
- Enable Vercel deployment protection for Preview environments and restrict who can change Production environment variables.
- Review Vercel logs and remove any future logging of tokens, authorization codes, passwords, account IDs or full request bodies.

## Rate limits introduced

- AutoD AI password attempts: 8 requests per client IP per 15 minutes.
- OAuth code exchange: 150 requests per client IP per 10 minutes.
- Limits are enforced by a shared Upstash counter, not by browser state.
- If the shared rate-limit service is unavailable, authentication and OAuth exchange fail closed rather than silently disabling protection.
