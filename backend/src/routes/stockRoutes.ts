import axios from 'axios';
import { Router, type Response } from 'express';
import { getCandles, getCompanyProfile, getMarketNews, getQuote } from '../services/finnhubService';

const router = Router();
const validSymbol = /^[A-Z0-9.-]{1,12}$/;
function symbolFromParam(value: string) {
  const symbol = value.toUpperCase();
  if (!validSymbol.test(symbol)) throw new Error('Use a valid ticker symbol.');
  return symbol;
}
function sendError(res: Response, error: unknown) {
  let status = 502;
  let message = error instanceof Error ? error.message : 'Market data is unavailable.';
  if (message.startsWith('Use a valid')) status = 400;
  if (axios.isAxiosError(error)) {
    const providerStatus = error.response?.status;
    if (providerStatus === 401) {
      status = 502;
      message = 'Finnhub rejected the configured credentials.';
    } else if (providerStatus === 403) {
      status = 403;
      message = 'Finnhub denied this endpoint. Check access for this endpoint on the configured API plan.';
    } else if (providerStatus === 429) {
      status = 429;
      message = 'Finnhub request limit reached. Try again later.';
    } else if (error.code === 'ECONNABORTED') {
      status = 504;
      message = 'Finnhub did not respond in time. Try again later.';
    }
  }
  res.status(status).json({ error: message });
}

router.get('/quotes', async (req, res) => {
  const symbols = String(req.query.symbols ?? 'SPY,QQQ,DIA').split(',').slice(0, 8);
  try {
    const quotes = await Promise.all(symbols.map((value) => getQuote(symbolFromParam(value.trim()))));
    res.json({ quotes, updatedAt: new Date().toISOString() });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/quote/:symbol', async (req, res) => {
  try {
    res.json(await getQuote(symbolFromParam(req.params.symbol)));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/candles/:symbol', async (req, res) => {
  try {
    const symbol = symbolFromParam(req.params.symbol);
    const to = Math.floor(Date.now() / 1000);
    const from = to - 365 * 24 * 60 * 60;
    res.json({ symbol, candles: await getCandles(symbol, from, to) });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/profile/:symbol', async (req, res) => {
  try {
    res.json(await getCompanyProfile(symbolFromParam(req.params.symbol)));
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/news', async (_req, res) => {
  try {
    res.json({ articles: await getMarketNews() });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;



