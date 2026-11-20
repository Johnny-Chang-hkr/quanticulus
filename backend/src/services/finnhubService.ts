import axios from 'axios';
import { config } from '../config/env';

function requireFinnhubKey() {
  if (!config.finnhub.apiKey) throw new Error('Finnhub is not configured. Add FINNHUB_API_KEY to the root .env file.');
  return config.finnhub.apiKey;
}

const client = axios.create({ baseURL: config.finnhub.baseUrl, timeout: 12000 });

export async function getQuote(symbol: string) {
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
}

export async function getCandles(symbol: string, from: number, to: number) {
  const { data } = await client.get('/stock/candle', {
    params: { symbol, resolution: 'D', from, to },
    headers: { 'X-Finnhub-Token': requireFinnhubKey() },
  });
  if (data.s !== 'ok') throw new Error(`Historical prices are unavailable for ${symbol}.`);
  return (data.t as number[]).map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    close: data.c[index] as number,
    high: data.h[index] as number,
    low: data.l[index] as number,
    open: data.o[index] as number,
    volume: data.v[index] as number,
  }));
}

export async function getCompanyProfile(symbol: string) {
  const { data } = await client.get('/stock/profile2', {
    params: { symbol },
    headers: { 'X-Finnhub-Token': requireFinnhubKey() },
  });
  if (!data.name) throw new Error(`No company profile is available for ${symbol}.`);
  return data;
}

export async function getMarketNews() {
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
}
