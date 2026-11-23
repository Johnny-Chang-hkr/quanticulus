import axios from 'axios';
import { config } from '../config/env';
import { cached, cachedValue } from './cache';
import { query } from './database';
import { waitForProviderSlot } from './providerThrottle';

function requireFinnhubKey() {
  if (!config.finnhub.apiKey) throw new Error('Finnhub is not configured. Add FINNHUB_API_KEY to the root .env file.');
  return config.finnhub.apiKey;
}

const client = axios.create({ baseURL: config.finnhub.baseUrl, timeout: 12000 });

async function storeCandles(symbol: string, candles: Candle[]) {
  if (!candles.length) return;
  await query(
    `INSERT INTO candle_observations
       (symbol, observation_date, close, high, low, open, volume)
     SELECT $1, item.date, item.close, item.high, item.low, item.open, item.volume
     FROM jsonb_to_recordset($2::jsonb)
       AS item(date DATE, close NUMERIC, high NUMERIC, low NUMERIC, open NUMERIC, volume BIGINT)
     ON CONFLICT (symbol, observation_date)
     DO UPDATE SET close = EXCLUDED.close, high = EXCLUDED.high,
                   low = EXCLUDED.low, open = EXCLUDED.open,
                   volume = EXCLUDED.volume, fetched_at = NOW()`,
    [symbol, JSON.stringify(candles)],
  );
}

export type Candle = {
  date: string;
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
};

export async function getQuote(symbol: string) {
  return cached(`finnhub:quote:${symbol}`, 60_000, async () => {
    await waitForProviderSlot('Finnhub');
    const { data } = await client.get('/quote', {
      params: { symbol },
      headers: { 'X-Finnhub-Token': requireFinnhubKey() },
    });
    if (!data || typeof data.c !== 'number' || data.t === 0) {
      throw new Error(`No quote is available for ${symbol}.`);
    }
    return {
      symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: data.t,
    };
  });
}

export function getQuotes(symbols: string[]) {
  const key = symbols.join(',');
  return cachedValue(`finnhub:quotes:${key}`, 60_000, () => Promise.all(symbols.map(getQuote)));
}

async function getStoredCandles(symbol: string, from: number, to: number) {
  const result = await query<{
    date: string;
    close: string;
    high: string;
    low: string;
    open: string;
    volume: string;
    fetched_at: Date;
  }>(
    `SELECT observation_date::text AS date, close, high, low, open, volume,
            MAX(fetched_at) OVER () AS fetched_at
     FROM candle_observations
     WHERE symbol = $1 AND observation_date BETWEEN $2 AND $3
     ORDER BY observation_date`,
    [
      symbol,
      new Date(from * 1000).toISOString().slice(0, 10),
      new Date(to * 1000).toISOString().slice(0, 10),
    ],
  );
  return {
    candles: result?.rows.map((row) => ({
      date: row.date,
      close: Number(row.close),
      high: Number(row.high),
      low: Number(row.low),
      open: Number(row.open),
      volume: Number(row.volume),
    })) ?? [],
    updatedAt: result?.rows[0]?.fetched_at.toISOString() ?? null,
  };
}

export function getCandles(symbol: string, from: number, to: number) {
  const fromDate = new Date(from * 1000).toISOString().slice(0, 10);
  const toDate = new Date(to * 1000).toISOString().slice(0, 10);
  return cachedValue(`finnhub:candles:${symbol}:${fromDate}:${toDate}`, 15 * 60 * 1000, async () => {
    let candles: Candle[];
    try {
      await waitForProviderSlot('Finnhub');
      const { data } = await client.get('/stock/candle', {
        params: { symbol, resolution: 'D', from, to },
        headers: { 'X-Finnhub-Token': requireFinnhubKey() },
      });
      if (data.s !== 'ok') throw new Error(`Historical prices are unavailable for ${symbol}.`);
      candles = (data.t as number[]).map((timestamp, index) => ({
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        close: data.c[index] as number,
        high: data.h[index] as number,
        low: data.l[index] as number,
        open: data.o[index] as number,
        volume: data.v[index] as number,
      }));
    } catch (error) {
        const saved = await getStoredCandles(symbol, from, to);
        if (!saved.candles.length) throw error;
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'provider_fallback',
        provider: 'Finnhub',
        endpoint: 'candles',
        symbol,
        observationCount: saved.candles.length,
        message: error instanceof Error ? error.message : 'Provider request failed',
      }));
      return {
        candles: saved.candles,
        source: 'PostgreSQL' as const,
        stale: true,
        updatedAt: saved.updatedAt ?? new Date().toISOString(),
      };
    }
    await storeCandles(symbol, candles);
    return { candles, source: 'Finnhub' as const, stale: false, updatedAt: new Date().toISOString() };
  });
}

export function getCompanyProfile(symbol: string) {
  return cached(`finnhub:profile:${symbol}`, 24 * 60 * 60 * 1000, async () => {
    await waitForProviderSlot('Finnhub');
    const { data } = await client.get('/stock/profile2', {
      params: { symbol },
      headers: { 'X-Finnhub-Token': requireFinnhubKey() },
    });
    if (!data.name) throw new Error(`No company profile is available for ${symbol}.`);
    return data;
  });
}

export function getMarketNews() {
  return cachedValue('finnhub:news', 5 * 60 * 1000, async () => {
    await waitForProviderSlot('Finnhub');
    const { data } = await client.get('/news', {
      params: { category: 'general' },
      headers: { 'X-Finnhub-Token': requireFinnhubKey() },
    });
    return (data as Array<Record<string, unknown>>).slice(0, 8).map((item) => ({
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      datetime: item.datetime,
      image: item.image,
    }));
  });
}
