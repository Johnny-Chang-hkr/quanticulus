import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAnalysis, calculateCorrelation, calculateForecast } from './analysisService';
import type { Candle } from './finnhubService';

function risingCandles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 * (1.001 ** index);
    return {
      date: new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10),
      close,
      open: close,
      high: close,
      low: close,
      volume: 1000,
    };
  });
}

test('descriptive metrics use trading observations and expose weighted components', () => {
  const candles = risingCandles(80);
  const result = calculateAnalysis(candles);

  assert.equal(result.observations.length, 80);
  assert.equal(result.observations[18].movingAverage20, null);
  assert.ok(result.observations[19].movingAverage20);
  assert.equal(result.observations[48].movingAverage50, null);
  assert.ok(result.observations[49].movingAverage50);
  assert.ok((result.latest?.return20d ?? 0) > 0);
  assert.equal(result.condition?.weights.trend, 40);
  assert.ok((result.condition?.score ?? 0) > 50);
});

test('five-day forecast requires enough history and reports a walk-forward comparison', () => {
  const shortHistory = calculateForecast(risingCandles(79));
  assert.equal(shortHistory.available, false);

  const forecast = calculateForecast(risingCandles(180));
  assert.equal(forecast.available, true);
  if (!forecast.available) return;
  assert.equal(forecast.horizonTradingDays, 5);
  assert.ok(forecast.intervalPercent.lower <= forecast.estimatePercent);
  assert.ok(forecast.estimatePercent <= forecast.intervalPercent.upper);
  assert.ok(forecast.evaluation.observations > 0);
  assert.ok(forecast.trainingObservations > 60);
});

test('period alignment reports the matched sample count and Pearson correlation', () => {
  const candles: Candle[] = [
    { date: '2024-01-31', close: 100, open: 100, high: 100, low: 100, volume: 1000 },
    { date: '2024-02-29', close: 110, open: 110, high: 110, low: 110, volume: 1000 },
    { date: '2024-03-29', close: 121, open: 121, high: 121, low: 121, volume: 1000 },
    { date: '2024-04-30', close: 121, open: 121, high: 121, low: 121, volume: 1000 },
  ];
  const observations = [
    { date: '2024-01-01', value: '100' },
    { date: '2024-02-01', value: '110' },
    { date: '2024-03-01', value: '121' },
    { date: '2024-04-01', value: '121' },
  ];
  const result = calculateCorrelation(candles, observations, 'monthly', 'Index');

  assert.equal(result.sampleCount, 3);
  assert.equal(result.correlation, 1);
  assert.deepEqual(result.observations.map((item) => item.period), ['2024-02', '2024-03', '2024-04']);
});
