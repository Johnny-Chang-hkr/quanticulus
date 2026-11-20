import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  fred: {
    apiKey: process.env.FRED_API_KEY,
    baseUrl: process.env.FRED_BASE_URL ?? 'https://api.stlouisfed.org/fred',
  },
  finnhub: {
    apiKey: process.env.FINNHUB_API_KEY,
    baseUrl: process.env.FINNHUB_BASE_URL ?? 'https://finnhub.io/api/v1',
  },
  databaseUrl: process.env.DATABASE_URL,
};

