import type { Candle } from './finnhubService';
import type { FredObservation } from './fredService';

export type AnalysisWeights = {
  trend: number;
  momentum: number;
  volatility: number;
};

const defaultWeights: AnalysisWeights = { trend: 40, momentum: 35, volatility: 25 };

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function movingAverage(values: number[], window: number, index: number) {
  if (index + 1 < window) return null;
  return average(values.slice(index + 1 - window, index + 1));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateAnalysis(candles: Candle[], weights = defaultWeights) {
  const closes = candles.map((candle) => candle.close);
  const rows = candles.map((candle, index) => {
    const dailyReturn = index === 0 || closes[index - 1] === 0
      ? null
      : (candle.close / closes[index - 1] - 1) * 100;
    const firstReturnIndex = Math.max(1, index - 19);
    const recentReturns = candles
      .slice(firstReturnIndex, index + 1)
      .map((item, offset) => {
        const previous = candles[firstReturnIndex + offset - 1]?.close;
        return previous ? (item.close / previous - 1) * 100 : null;
      })
      .filter((value): value is number => value !== null);
    const volatility = recentReturns.length === 20
      ? standardDeviation(recentReturns) * Math.sqrt(252)
      : null;
    return {
      date: candle.date,
      close: candle.close,
      dailyReturn,
      movingAverage20: movingAverage(closes, 20, index),
      movingAverage50: movingAverage(closes, 50, index),
      annualizedVolatility20: volatility,
    };
  });

  const latest = rows[rows.length - 1];
  if (!latest) return { observations: [], latest: null, condition: null };
  const recent20 = closes.length >= 21 ? (closes[closes.length - 1] / closes[closes.length - 21] - 1) * 100 : null;
  const trend = latest.movingAverage50 === null
    ? null
    : clamp(50 + ((latest.close / latest.movingAverage50 - 1) * 500), 0, 100);
  const momentum = recent20 === null ? null : clamp(50 + recent20 * 5, 0, 100);
  const volatility = latest.annualizedVolatility20 === null
    ? null
    : clamp(100 - latest.annualizedVolatility20 * 2, 0, 100);
  const components = { trend, momentum, volatility };
  const available = Object.entries(components).filter(
    (entry): entry is [keyof AnalysisWeights, number] => entry[1] !== null,
  );
  const weightTotal = available.reduce((total, [key]) => total + weights[key], 0);
  const score = weightTotal
    ? available.reduce((total, [key, value]) => total + value * weights[key], 0) / weightTotal
    : null;

  return {
    observations: rows,
    latest: { ...latest, return20d: recent20 },
    condition: {
      score,
      components,
      weights,
      methodology: 'Trend compares close to its 50-observation average; momentum is the trailing 20-observation return; volatility is 20-observation annualized daily volatility. Each component is bounded from 0 to 100 and combined by its selected weight.',
    },
  };
}

function quantile(sorted: number[], probability: number) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function fiveDayReturns(closes: number[], maxEndIndex: number) {
  const returns: number[] = [];
  for (let end = 5; end <= maxEndIndex; end += 1) {
    returns.push((closes[end] / closes[end - 5] - 1) * 100);
  }
  return returns;
}

type ForecastResult =
  | { available: false; reason: string; horizonTradingDays: 5 }
  | {
    available: true;
    symbol: string;
    horizonTradingDays: 5;
    asOf: string;
    estimatePercent: number;
    intervalPercent: { lower: number; upper: number; confidenceLevel: 90 };
    trainingObservations: number;
    evaluation: {
      method: string;
      observations: number;
      historicalPeriod: { start: string; end: string } | null;
      empiricalMedian: { meanAbsoluteError: number; rootMeanSquaredError: number };
      zeroReturnBaseline: { meanAbsoluteError: number; rootMeanSquaredError: number };
    };
    assumptions: string[];
  };

export function calculateForecast(candles: Candle[], symbol = 'SPY'): ForecastResult {
  const closes = candles.map((candle) => candle.close);
  if (closes.length < 80) {
    return {
      available: false,
      reason: 'At least 80 daily observations are required for the five-day walk-forward baseline.',
      horizonTradingDays: 5,
    };
  }

  const backtestActuals: number[] = [];
  const modelPredictions: number[] = [];
  const baselinePredictions: number[] = [];
  const firstOrigin = Math.max(65, closes.length - 252 - 5);
  for (let origin = firstOrigin; origin + 5 < closes.length; origin += 1) {
    const trainingReturns = fiveDayReturns(closes, origin);
    if (trainingReturns.length < 60) continue;
    const sorted = trainingReturns.sort((a, b) => a - b);
    const actual = (closes[origin + 5] / closes[origin] - 1) * 100;
    backtestActuals.push(actual);
    modelPredictions.push(quantile(sorted, 0.5) ?? 0);
    baselinePredictions.push(0);
  }

  const training = fiveDayReturns(closes, closes.length - 1).sort((a, b) => a - b);
  const latestLower = quantile(training, 0.05);
  const latestMedian = quantile(training, 0.5);
  const latestUpper = quantile(training, 0.95);
  if (latestLower === null || latestMedian === null || latestUpper === null) {
    return {
      available: false,
      reason: 'Historical returns are insufficient for a forecast interval.',
      horizonTradingDays: 5,
    };
  }

  const errorMetrics = (predictions: number[]) => {
    const errors = predictions.map((prediction, index) => prediction - backtestActuals[index]);
    return {
      meanAbsoluteError: average(errors.map(Math.abs)),
      rootMeanSquaredError: Math.sqrt(average(errors.map((error) => error ** 2))),
    };
  };

  return {
    available: true,
    symbol,
    horizonTradingDays: 5,
    asOf: candles[candles.length - 1].date,
    estimatePercent: latestMedian,
    intervalPercent: { lower: latestLower, upper: latestUpper, confidenceLevel: 90 },
    trainingObservations: training.length,
    evaluation: {
      method: 'Expanding-window walk-forward evaluation; each five-day horizon is predicted only from returns fully observed before its forecast origin.',
      observations: backtestActuals.length,
      historicalPeriod: backtestActuals.length
        ? { start: candles[firstOrigin].date, end: candles[candles.length - 1].date }
        : null,
      empiricalMedian: errorMetrics(modelPredictions),
      zeroReturnBaseline: errorMetrics(baselinePredictions),
    },
    assumptions: [
      'Uses unadjusted daily close observations returned by the market-data provider.',
      'The estimate is the median of prior five-trading-day simple returns; the interval is the empirical 5th–95th percentile.',
      'No macroeconomic inputs or transaction costs are modeled.',
      'This experimental estimate is not investment advice and does not guarantee future results.',
    ],
  };
}

function periodKey(date: string, frequency: 'monthly' | 'quarterly') {
  const [yearText, monthText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  return frequency === 'monthly'
    ? `${year}-${String(month).padStart(2, '0')}`
    : `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

function periodIndex(key: string, frequency: 'monthly' | 'quarterly') {
  const [yearText, periodText] = key.split(frequency === 'monthly' ? '-' : '-Q');
  const period = Number(periodText) - 1;
  return Number(yearText) * (frequency === 'monthly' ? 12 : 4) + period;
}

export function calculateCorrelation(
  candles: Candle[],
  observations: FredObservation[],
  frequency: 'monthly' | 'quarterly',
  unit: string,
) {
  const periodCloses = new Map<string, number>();
  for (const candle of candles) {
    periodCloses.set(periodKey(candle.date, frequency), candle.close);
  }
  const aligned: Array<{ period: string; economicChange: number; assetReturn: number }> = [];
  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1];
    const current = observations[index];
    const previousPeriod = periodKey(previous.date, frequency);
    const currentPeriod = periodKey(current.date, frequency);
    if (periodIndex(currentPeriod, frequency) - periodIndex(previousPeriod, frequency) !== 1) continue;
    const previousClose = periodCloses.get(previousPeriod);
    const currentClose = periodCloses.get(currentPeriod);
    const priorValue = Number(previous.value);
    const currentValue = Number(current.value);
    if (
      previousClose === undefined
      || currentClose === undefined
      || !Number.isFinite(priorValue)
      || !Number.isFinite(currentValue)
      || priorValue === 0
    ) continue;
    const economicChange = unit === 'Percent'
      ? currentValue - priorValue
      : (currentValue / priorValue - 1) * 100;
    aligned.push({
      period: currentPeriod,
      economicChange,
      assetReturn: (currentClose / previousClose - 1) * 100,
    });
  }
  if (aligned.length < 2) {
    return {
      correlation: null,
      sampleCount: aligned.length,
      frequency,
      observations: aligned,
      method: 'Pearson correlation of consecutive aligned period changes; percent-unit series use percentage-point changes and other series use percentage changes.',
    };
  }
  const economicValues = aligned.map((item) => item.economicChange);
  const assetValues = aligned.map((item) => item.assetReturn);
  const meanEconomic = average(economicValues);
  const meanAsset = average(assetValues);
  const covariance = aligned.reduce(
    (sum, _item, index) => sum + (economicValues[index] - meanEconomic) * (assetValues[index] - meanAsset),
    0,
  );
  const denominator = Math.sqrt(
    economicValues.reduce((sum, value) => sum + (value - meanEconomic) ** 2, 0)
    * assetValues.reduce((sum, value) => sum + (value - meanAsset) ** 2, 0),
  );
  return {
    correlation: denominator === 0 ? null : covariance / denominator,
    sampleCount: aligned.length,
    frequency,
    observations: aligned,
    method: 'Pearson correlation of consecutive aligned period changes; percent-unit series use percentage-point changes and other series use percentage changes.',
  };
}
