# Quanticulus roadmap

## Product direction

Quanticulus combines macroeconomic releases and market data to help users explore market conditions. The product should make data dates and sources visible, explain how derived metrics are calculated, and present any forecasts as uncertain scenarios rather than promises.

## Phase 1 — Foundation (in progress)

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
- [ ] Add a small set of API and UI smoke checks.

## Phase 2 — Data quality and usability

- [x] Add interactive symbol lookup with company profile and quote.
- [ ] Add a stock detail page with historical prices when Finnhub candle access is available.
- [ ] Add economic indicator detail views with selectable date ranges and release frequencies.
- [ ] Show source observation dates, units, and last refresh times consistently.
- [ ] Add server-side caching and request throttling that respect FRED and Finnhub plan limits.
- [ ] Add PostgreSQL schema and persistence only after defining retention and refresh requirements.

## Phase 3 — Descriptive analysis

- [ ] Calculate returns, rolling volatility, and moving averages from price history.
- [ ] Align economic series and asset prices by date and documented frequency rules.
- [ ] Add correlation views with sample windows and observation counts.
- [ ] Build a transparent market-condition score with documented components and sensitivity controls.

## Phase 4 — Forecast experiments

- [ ] Establish simple baselines before fitting more complex models.
- [ ] Create time-aware train, validation, and test periods to avoid look-ahead leakage.
- [ ] Evaluate against baselines with suitable error and classification metrics.
- [ ] Display forecast ranges, assumptions, and historical evaluation results.
- [ ] Keep prediction outputs labeled as estimates with uncertainty.

## Phase 5 — Operational readiness

- [ ] Add automated checks, structured logs, and health/provider status reporting.
- [ ] Add secure deployment configuration and secret management.
- [ ] Review data-provider terms, limits, and attribution requirements for the intended deployment.
- [ ] Add accessibility and responsive layout review.

## Current working slice

The current slice is a live-data dashboard. The configured credentials returned all seven FRED indicators, quotes for SPY, QQQ, and DIA, and company profile and quote data for AAPL. Finnhub returned HTTP 403 for candle history and the general news request timed out during the current check. The dashboard reports those endpoint failures instead of inventing data. API responses are requested by the backend so provider keys are not sent to the browser.



