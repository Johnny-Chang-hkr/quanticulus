# Architecture

## Components

- **Frontend:** React and TypeScript, served by Vite during development. Tailwind CSS provides layout and Recharts renders the SPY close-price history.
- **Backend:** Express and TypeScript. It loads configuration from the project-root `.env`, applies API rate limiting and provider request spacing, caches provider calls, persists daily observations to PostgreSQL when configured, and returns normalized JSON under `/api`.
- **Persistence:** PostgreSQL stores daily candle and economic observations, with an index on observation dates and automatic retention of five years. Local development can run without a database; Docker Compose provisions PostgreSQL.
- **Providers:** FRED for macroeconomic observations and Finnhub for quotes, candles, company profiles, and news.
- **Analytics:** Python dependencies and folders are prepared for future analysis. No predictive model or database integration is implemented yet.

## Request flow

```text
Browser (React)
   ¦ /api/*
   ?
Vite development proxy --? Express API
                               +--? FRED
                               +--? Finnhub
```

The browser only calls the local API. FRED and Finnhub credentials stay in the backend environment and are never included in frontend build variables.

## API layout

- `GET /api/health` — API process status.
- `GET /api/economy/overview` — latest available values for the configured FRED series.
- `GET /api/economy/series/:seriesId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&frequency=native|d|w|m|q|a` ï¿½ range-limited FRED observations and optional provider-supported aggregation.
- `GET /api/stocks/quotes?symbols=SPY,QQQ,DIA` — current quote snapshots.
- `GET /api/stocks/quote/:symbol` — one quote.
- `GET /api/stocks/candles/:symbol?range=1m|6m|1y|5y` ï¿½ daily candles; previously saved candles are identified as stale fallback when the provider is unavailable.
- `GET /api/stocks/analysis/:symbol?range=1m|6m|1y|5y&trendWeight=...&momentumWeight=...&volatilityWeight=...` ï¿½ price-history metrics and a weighted market-condition score.
- `GET /api/stocks/correlation/:symbol?seriesId=...&range=...` ï¿½ period-aligned FRED and market returns with Pearson correlation and sample count.
- `GET /api/stocks/forecast/:symbol` ï¿½ five-trading-day empirical baseline and walk-forward evaluation.
- `GET /api/stocks/profile/:symbol` — company profile.
- `GET /api/stocks/news` — latest general market headlines.

## Current limitations

The deployment is a single-user local Docker Compose setup, not a public service. API availability depends on provider credentials, network access, symbol coverage, plan permissions, and rate limits. Failures should be treated as unavailable data, not as a zero value. See [provider terms](./provider-terms.md) before changing the deployment boundary.
