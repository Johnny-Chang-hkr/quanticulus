# Quanticulus

Economic and stock market intelligence platform combining macroeconomic indicators from FRED with market data from Finnhub.

## Project layout

- `frontend/` — React, TypeScript, Vite, Tailwind CSS, and Recharts dashboard.
- `backend/` — Express API in TypeScript; provider API keys remain server-side.
- `analytics/` — Future Python notebooks and model code.

## Getting started

1. Install Node.js (18 or newer) and copy `.env.example` to `.env`.
2. Add your FRED and Finnhub API keys to the root `.env` file.
3. Install dependencies in `backend/` and `frontend/` (`npm install` in each folder).
4. Start the API with `npm run dev` from `backend/` and the UI with `npm run dev` from `frontend/`.

The frontend expects the backend at `http://localhost:5000`; the Vite development server proxies `/api` requests there. The backend loads configuration from the root `.env` file. Never commit `.env`.

## Initial data sources

FRED series to start with: `CPIAUCSL`, `CPILFESL`, `UNRATE`, `GDP`, `FEDFUNDS`, `DGS10`, and `DGS2`. Finnhub integration can cover quotes, historical candles, company profiles, financials, and news.

Market analysis and any future predictions are exploratory estimates and should communicate uncertainty; they are not guarantees.

## Requirements and installation

Install Node.js 18 or newer (npm is included) and Python 3.10 or newer for analytics. PostgreSQL is only needed when database-backed features are added; set `DATABASE_URL` in `.env` when it is running.

Install the frontend and backend packages from their respective directories:

```powershell
cd frontend
npm install
cd ../backend
npm install
```

Install the Python analytics packages from the project root:

```powershell
python -m pip install -r analytics/requirements.txt
```

Frontend dependencies (React, Recharts, Vite, TypeScript, Tailwind CSS) are declared in `frontend/package.json`. Backend dependencies (Express, Axios, dotenv, CORS, TypeScript tooling) are declared in `backend/package.json`. Python analytics dependencies are listed in `analytics/requirements.txt`.

Run the frontend and backend in separate terminals with `npm run dev` from each respective directory.

## Free hosted deployment

Render and Neon are sufficient for a hosted deployment:

- Use Neon for `DATABASE_URL`.
- Deploy the backend as a Render Docker web service.
- Deploy the frontend as a Render static site.
- Set `FRONTEND_URL` on the backend to the exact frontend URL, with no trailing slash.
- Set `VITE_API_URL` on the frontend to the exact backend URL, with no trailing slash.
- Set `FRED_API_KEY` and `FINNHUB_API_KEY` only in Render environment variables; never prefix provider keys with `VITE_`.

The repository includes [render.yaml](render.yaml) as a Render Blueprint starting point. After creating the services, enter the Neon connection string and the public service URLs in the Render environment settings.

## Project documentation

See [`DOC/README.md`](DOC/README.md) for the project documents and [the roadmap](DOC/roadmap.md) for implementation milestones.

## Docker Compose

Copy `.env.example` to `.env`, replace the sample password, and run `docker compose up --build`. Open `http://localhost:8080`. The local stack includes PostgreSQL and is bound to loopback for one authorized personal user; do not expose it publicly or redistribute Finnhub data. See [deployment and provider terms](DOC/provider-terms.md) and [the development guide](DOC/development.md).
