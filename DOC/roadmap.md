# Quanticulus roadmap

## Product direction

Quanticulus combines macroeconomic releases and market data to help users explore market conditions. The product should make data dates and sources visible, explain how derived metrics are calculated, and present any forecasts as uncertain scenarios rather than promises.

## Phase 1 — Foundation

- [x] Create React, TypeScript, and Vite frontend.
- [x] Create Express and TypeScript backend.
- [x] Keep provider credentials in the root `.env` and out of Git.
- [x] Add a health endpoint and API proxy for local development.
- [x] Add server-side FRED economic overview integration.
- [x] Add server-side Finnhub quote, candle, profile, and news integration.
- [x] Build a dashboard with ETF quotes, economic indicators, company lookup, history and news panels with provider error feedback.
- [x] Document architecture, providers, development, analytics, and roadmap.
- [x] Confirm local credentials work for FRED series, Finnhub quotes, and company profiles.
- [ ] Resolve Finnhub candle access (currently denied) and news endpoint timeout for the configured account.
- [x] Add loading, empty, and provider error states for individual data panels.
- [x] Add a small set of API and UI smoke checks.

## Phase 2 — Data quality and usability

- [x] Add interactive symbol lookup with company profile and quote.
- [x] Add a stock detail page with historical prices and a saved-history fallback (live provider access still requires entitlement).
- [x] Add economic indicator detail views with selectable date ranges and provider-supported frequencies.
- [x] Show source observation dates, units, and last refresh times consistently.
- [x] Add server-side caching and request throttling within provider plan limits.
- [x] Add PostgreSQL schema and persistence (five-year retention; provider-specific refresh/cache windows documented).

## Phase 3 — Descriptive analysis

- [x] Calculate returns, rolling volatility, and moving averages from price history.
- [x] Align economic series and asset prices by date and documented frequency rules.
- [x] Add correlation views with sample windows and observation counts.
- [x] Build a transparent market-condition score with documented components and sensitivity controls.

## Phase 4 — Forecast experiments

- [x] Establish a simple five-trading-day SPY baseline.
- [x] Create time-aware walk-forward evaluation to avoid look-ahead leakage.
- [x] Evaluate against a zero-return baseline with error metrics.
- [x] Display forecast ranges, assumptions, and historical evaluation results.
- [x] Keep prediction outputs labeled as estimates with uncertainty.

## Phase 5 — Operational readiness

- [x] Add CI checks, structured logs, API rate limiting, and health/provider status reporting.
- [x] Add secure local Docker deployment configuration and runtime secret injection.
- [x] Review data-provider terms, limits, deletion obligations, and required FRED attribution for personal local deployment.
- [x] Add accessible controls and responsive layout smoke coverage.

## Current working slice

The project now includes historical and economic detail views, descriptive metrics, a walk-forward baseline, five-year PostgreSQL persistence, provider caching/throttling, and a loopback-only Docker Compose deployment. The configured Finnhub account previously returned HTTP 403 for candle history and timed out on general news; live endpoint access remains an external account entitlement/availability blocker. See [provider terms](provider-terms.md) before changing the local single-user deployment boundary.



