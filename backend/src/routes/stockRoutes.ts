import axios from 'axios';
import { Router, type Response } from 'express';
import { calculateAnalysis, calculateCorrelation, calculateForecast, type AnalysisWeights } from '../services/analysisService';
import { getCandles, getCompanyProfile, getMarketNews, getQuote, getQuotes } from '../services/finnhubService';
import { fredSeries, getEconomicSeries } from '../services/fredService';

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
  if (message.startsWith('Use a valid') || message.startsWith('Choose') || message.startsWith('Trend,')) status = 400;
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

function dateRange(range: unknown) {
  const ranges = { '1m': 31, '6m': 183, '1y': 365, '5y': 1826 } as const;
  if (typeof range !== 'string' || !Object.prototype.hasOwnProperty.call(ranges, range)) {
    throw new Error('Choose a supported history range: 1m, 6m, 1y, or 5y.');
  }
  const to = Math.floor(Date.now() / 1000);
  return { from: to - ranges[range as keyof typeof ranges] * 24 * 60 * 60, to };
}

function analysisWeights(query: Record<string, unknown>): AnalysisWeights {
  const defaults: AnalysisWeights = { trend: 40, momentum: 35, volatility: 25 };
  const keys = ['trendWeight', 'momentumWeight', 'volatilityWeight'] as const;
  const values = keys.map((key) => query[key]);
  if (values.every((value) => value === undefined)) return defaults;
  const parsed = values.map((value) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN);
  if (parsed.some((value) => !Number.isInteger(value) || value < 0 || value > 100)
    || parsed.reduce((sum, value) => sum + value, 0) !== 100) {
    throw new Error('Trend, momentum, and volatility weights must be integers from 0 to 100 and sum to 100.');
  }
  return { trend: parsed[0], momentum: parsed[1], volatility: parsed[2] };
}

router.get('/quotes', async (req, res) => {
  try {
    const symbols = String(req.query.symbols ?? 'SPY,QQQ,DIA').split(',').slice(0, 8)
      .map((value) => symbolFromParam(value.trim()));
    const result = await getQuotes(symbols);
    res.json({ quotes: result.value, updatedAt: result.updatedAt });
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
    const range = typeof req.query.range === 'string' ? req.query.range : '1y';
    const { from, to } = dateRange(range);
    const result = await getCandles(symbol, from, to);
    res.json({
      symbol,
      candles: result.value.candles,
      source: result.value.source,
      stale: result.value.stale,
      updatedAt: result.value.updatedAt,
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/analysis/:symbol', async (req, res) => {
  try {
    const symbol = symbolFromParam(req.params.symbol);
    const range = typeof req.query.range === 'string' ? req.query.range : '5y';
    const weights = analysisWeights(req.query);
    const { from, to } = dateRange(range);
    const result = await getCandles(symbol, from, to);
    res.json({
      symbol,
      candles: result.value.candles,
      source: result.value.source,
      stale: result.value.stale,
      analysis: calculateAnalysis(result.value.candles, weights),
      updatedAt: result.value.updatedAt,
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/forecast/:symbol', async (req, res) => {
  try {
    const symbol = symbolFromParam(req.params.symbol);
    const { from, to } = dateRange('5y');
    const result = await getCandles(symbol, from, to);
    res.json({
      ...calculateForecast(result.value.candles, symbol),
      source: result.value.source,
      stale: result.value.stale,
      updatedAt: result.value.updatedAt,
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/correlation/:symbol', async (req, res) => {
  try {
    const symbol = symbolFromParam(req.params.symbol);
    const seriesId = typeof req.query.seriesId === 'string' ? req.query.seriesId : 'UNRATE';
    const series = fredSeries.find((item) => item.id === seriesId);
    if (!series) throw new Error('Choose a supported economic series.');
    const range = typeof req.query.range === 'string' ? req.query.range : '5y';
    const { from, to } = dateRange(range);
    const startDate = new Date(from * 1000).toISOString().slice(0, 10);
    const endDate = new Date(to * 1000).toISOString().slice(0, 10);
    const frequency = series.id === 'GDP' ? 'quarterly' : 'monthly';
    const fredFrequency = series.id === 'GDP' ? 'native' : 'm';
    const [economic, priceHistory] = await Promise.all([
      getEconomicSeries(seriesId, startDate, endDate, fredFrequency),
      getCandles(symbol, from, to),
    ]);
    const correlation = calculateCorrelation(
      priceHistory.value.candles,
      economic.observations.map((observation) => ({
        date: observation.date,
        value: String(observation.value),
      })),
      frequency,
      series.unit,
    );
    res.json({
      symbol,
      series: { id: series.id, name: series.name, unit: series.unit },
      correlation,
      source: { prices: priceHistory.value.source, economics: 'FRED' },
      stale: priceHistory.value.stale,
      updatedAt: { prices: priceHistory.value.updatedAt, economics: economic.updatedAt },
    });
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
    const result = await getMarketNews();
    res.json({ articles: result.value, updatedAt: result.updatedAt });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;



