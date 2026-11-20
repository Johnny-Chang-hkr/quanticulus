# Architecture

## Components

- **Frontend:** React and TypeScript, served by Vite during development. Tailwind CSS provides layout and Recharts renders the SPY close-price history.
- **Backend:** Express and TypeScript. It loads configuration from the project-root `.env`, calls external providers, and returns normalized JSON under `/api`.
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
- `GET /api/stocks/quotes?symbols=SPY,QQQ,DIA` — current quote snapshots.
- `GET /api/stocks/quote/:symbol` — one quote.
- `GET /api/stocks/candles/:symbol` — up to one year of daily candles.
- `GET /api/stocks/profile/:symbol` — company profile.
- `GET /api/stocks/news` — latest general market headlines.

## Current limitations

There is no persistence, scheduled collection, cache, authentication, or prediction model yet. API availability depends on provider credentials, network access, symbol coverage, plan permissions, and rate limits. Failures should be treated as unavailable data, not as a zero value.
