import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getJson } from './api';

type Range = '1m' | '6m' | '1y' | '5y';
type Candle = { date: string; close: number };
type Analysis = {
  observations: Array<{
    date: string;
    close: number;
    dailyReturn: number | null;
    movingAverage20: number | null;
    movingAverage50: number | null;
    annualizedVolatility20: number | null;
  }>;
  latest: {
    date: string;
    close: number;
    return20d: number | null;
    movingAverage20: number | null;
    movingAverage50: number | null;
    annualizedVolatility20: number | null;
  } | null;
  condition: {
    score: number | null;
    components: { trend: number | null; momentum: number | null; volatility: number | null };
    weights: { trend: number; momentum: number; volatility: number };
    methodology: string;
  } | null;
};
type StockAnalysisResponse = {
  symbol: string;
  candles: Candle[];
  source: string;
  stale: boolean;
  analysis: Analysis;
};
type CorrelationResponse = {
  series: { id: string; name: string; unit: string };
  correlation: {
    correlation: number | null;
    sampleCount: number;
    frequency: 'monthly' | 'quarterly';
    observations: Array<{ period: string; economicChange: number; assetReturn: number }>;
    method: string;
  };
  source: { prices: string; economics: string };
  stale: boolean;
};
type EconomicSeriesResponse = {
  id: string;
  name: string;
  unit: string;
  frequency: string;
  observations: Array<{ date: string; value: number }>;
  updatedAt: string;
};
type ForecastResponse = {
  available: boolean;
  reason?: string;
  symbol?: string;
  asOf?: string;
  horizonTradingDays: number;
  estimatePercent?: number;
  intervalPercent?: { lower: number; upper: number; confidenceLevel: number };
  trainingObservations?: number;
  evaluation?: {
    method: string;
    observations: number;
    historicalPeriod: { start: string; end: string } | null;
    empiricalMedian: { meanAbsoluteError: number; rootMeanSquaredError: number };
    zeroReturnBaseline: { meanAbsoluteError: number; rootMeanSquaredError: number };
  };
  assumptions?: string[];
  source?: string;
  stale?: boolean;
};

const seriesOptions = [
  { id: 'CPIAUCSL', name: 'Consumer Price Index', unit: 'Index (1982-84=100)', native: 'Monthly', frequencies: ['native', 'q', 'a'] },
  { id: 'CPILFESL', name: 'Core CPI', unit: 'Index (1982-84=100)', native: 'Monthly', frequencies: ['native', 'q', 'a'] },
  { id: 'UNRATE', name: 'Unemployment Rate', unit: 'Percent', native: 'Monthly', frequencies: ['native', 'q', 'a'] },
  { id: 'GDP', name: 'Gross Domestic Product', unit: 'Billions of dollars', native: 'Quarterly', frequencies: ['native', 'a'] },
  { id: 'FEDFUNDS', name: 'Federal Funds Rate', unit: 'Percent', native: 'Monthly', frequencies: ['native', 'q', 'a'] },
  { id: 'DGS10', name: '10-Year Treasury Yield', unit: 'Percent', native: 'Daily', frequencies: ['native', 'w', 'm', 'q', 'a'] },
  { id: 'DGS2', name: '2-Year Treasury Yield', unit: 'Percent', native: 'Daily', frequencies: ['native', 'w', 'm', 'q', 'a'] },
] as const;

const ranges: Range[] = ['1m', '6m', '1y', '5y'];
const seriesRangeYears = { '1y': 1, '5y': 5 } as const;
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function rangeStart(range: keyof typeof seriesRangeYears) {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - seriesRangeYears[range]);
  return date.toISOString().slice(0, 10);
}

function Chart({ data, valueKey = 'close', formatValue }: {
  data: Array<Record<string, string | number | null>>;
  valueKey?: string;
  formatValue: (value: number) => string;
}) {
  return <div className="h-[300px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 5" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={42} />
        <YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatValue(value)} />
        <Tooltip
          contentStyle={{ background: '#101827', border: '1px solid #263449', borderRadius: 10 }}
          labelStyle={{ color: '#cbd5e1' }}
          formatter={(value: number) => [formatValue(value), 'Value']}
        />
        <Line type="monotone" dataKey={valueKey} stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

function ErrorPanel({ error }: { error: string }) {
  return <p role="alert" className="mt-4 rounded-lg border border-amber-400/20 bg-amber-300/5 p-4 text-sm text-amber-100">{error}</p>;
}

export function StockDetailPage() {
  const [symbol, setSymbol] = useState('SPY');
  const [tickerInput, setTickerInput] = useState('SPY');
  const [range, setRange] = useState<Range>('1y');
  const [trendWeight, setTrendWeight] = useState(40);
  const [momentumWeight, setMomentumWeight] = useState(35);
  const [result, setResult] = useState<StockAnalysisResponse | null>(null);
  const [correlationSeries, setCorrelationSeries] = useState<(typeof seriesOptions)[number]['id']>('UNRATE');
  const [correlation, setCorrelation] = useState<CorrelationResponse | null>(null);
  const [correlationError, setCorrelationError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const weights = `trendWeight=${trendWeight}&momentumWeight=${momentumWeight}&volatilityWeight=${100 - trendWeight - momentumWeight}`;
    setLoading(true);
    setError('');
    setResult(null);
    getJson<StockAnalysisResponse>(`/api/stocks/analysis/${encodeURIComponent(symbol)}?range=${range}&${weights}`)
      .then((value) => { if (active) setResult(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load price history.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [symbol, range, trendWeight, momentumWeight]);

  useEffect(() => {
    let active = true;
    setCorrelation(null);
    setCorrelationError('');
    getJson<CorrelationResponse>(
      `/api/stocks/correlation/${encodeURIComponent(symbol)}?seriesId=${correlationSeries}&range=${range}`,
    )
      .then((value) => { if (active) setCorrelation(value); })
      .catch((reason: unknown) => { if (active) setCorrelationError(reason instanceof Error ? reason.message : 'Unable to align the selected series.'); });
    return () => { active = false; };
  }, [symbol, range, correlationSeries]);

  const latest = result?.analysis.latest;
  const condition = result?.analysis.condition;
  const displayedWeights = [
    { key: 'trend', label: 'Trend', value: trendWeight, max: 100 - momentumWeight, update: setTrendWeight },
    { key: 'momentum', label: 'Momentum', value: momentumWeight, max: 100 - trendWeight, update: setMomentumWeight },
  ];

  return <section aria-labelledby="stock-detail-heading" className="mt-8 space-y-5">
    <header className="panel flex flex-wrap items-end justify-between gap-4">
      <div><p className="section-kicker">Descriptive analysis</p><h2 id="stock-detail-heading" className="section-title">Stock detail</h2></div>
      <div className="flex flex-wrap gap-3">
        <form className="flex items-end gap-2" onSubmit={(event) => {
          event.preventDefault();
          const nextSymbol = tickerInput.trim().toUpperCase();
          if (!/^[A-Z0-9.-]{1,12}$/.test(nextSymbol)) {
            setError('Use a valid ticker symbol.');
            return;
          }
          setError('');
          setSymbol(nextSymbol);
        }}>
          <label className="grid gap-1 text-xs text-slate-400">Symbol
            <input value={tickerInput} onChange={(event) => setTickerInput(event.target.value.toUpperCase())} maxLength={12} className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <button type="submit" className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950">Load</button>
        </form>
        <label className="grid gap-1 text-xs text-slate-400">History
          <select value={range} onChange={(event) => setRange(event.target.value as Range)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            {ranges.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
    </header>
    {error && <ErrorPanel error={error} />}
    {loading && <p role="status" className="text-sm text-slate-400">Loading historical prices and analysis…</p>}
    {result && <>
      {result.stale && <p className="text-sm text-amber-200">Provider history is unavailable; showing saved {result.source} observations.</p>}
      {result.candles.length > 0 && <article className="panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><p className="section-kicker">{result.symbol} · {range} daily closes</p><h3 className="section-title">Historical prices</h3></div>
          <p className="text-xs text-slate-400">Source: {result.source} · Observation: {result.candles[result.candles.length - 1].date}</p>
        </div>
        <Chart data={result.candles} formatValue={(value) => money.format(value)} />
      </article>}
      {latest && condition && <article className="panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="section-kicker">Transparent market-condition score</p><h3 className="section-title">{condition.score === null ? 'Insufficient history' : `${number.format(condition.score)} / 100`}</h3><p className="mt-1 text-xs text-slate-400">As of {latest.date} · Close {money.format(latest.close)}</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(condition.components).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-900 px-3 py-2 text-sm">
              <p className="capitalize text-slate-400">{key} · {condition.weights[key as keyof typeof condition.weights]}%</p>
              <p className="mt-1 font-medium">{value === null ? 'Need more history' : `${number.format(value)} / 100`}</p>
            </div>)}
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {displayedWeights.map((weight) => <label key={weight.key} className="grid gap-1 text-sm text-slate-300">
            <span>{weight.label} weight: {weight.value}%</span>
            <input type="range" min="0" max={weight.max} value={weight.value} onChange={(event) => weight.update(Number(event.target.value))} aria-label={`${weight.label} score weight`} />
          </label>)}
          <p className="self-center text-xs text-slate-400">Volatility weight: {100 - trendWeight - momentumWeight}% (adjusted to keep total weight at 100%)</p>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-400">{condition.methodology}</p>
        <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-4">
          <p>20-observation return: {latest.return20d === null ? '—' : `${number.format(latest.return20d)}%`}</p>
          <p>20-day average: {latest.movingAverage20 === null ? '—' : money.format(latest.movingAverage20)}</p>
          <p>50-day average: {latest.movingAverage50 === null ? '—' : money.format(latest.movingAverage50)}</p>
          <p>20-day annualized volatility: {latest.annualizedVolatility20 === null ? '—' : `${number.format(latest.annualizedVolatility20)}%`}</p>
        </div>
      </article>}
    </>}
    <article className="panel">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><p className="section-kicker">Descriptive alignment</p><h3 className="section-title">Economic/market correlation</h3></div>
        <label className="grid gap-1 text-xs text-slate-400">Economic series
          <select value={correlationSeries} onChange={(event) => setCorrelationSeries(event.target.value as typeof correlationSeries)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            {seriesOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>
      {correlationError && <ErrorPanel error={correlationError} />}
      {correlation && <>
        {correlation.stale && <p className="mb-3 text-xs text-amber-200">Using saved market observations.</p>}
        <p className="mb-3 text-sm text-slate-300">
          Pearson r: {correlation.correlation.correlation === null ? 'not available' : number.format(correlation.correlation.correlation)}
          {' · '}{correlation.correlation.sampleCount} aligned {correlation.correlation.frequency} observations
          {' · '}{correlation.series.name} · Sample window: {range}
        </p>
        {correlation.correlation.observations.length > 1 ? <div role="img" aria-label={`${correlation.series.name} change versus ${symbol} return scatter plot`} className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 12, left: 0 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 5" />
              <XAxis type="number" dataKey="economicChange" name="Economic change" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="number" dataKey="assetReturn" name={`${symbol} return`} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#101827', border: '1px solid #263449', borderRadius: 10 }} />
              <Scatter data={correlation.correlation.observations} fill="#22d3ee" />
            </ScatterChart>
          </ResponsiveContainer>
        </div> : <p className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">At least two aligned periods are required to calculate correlation.</p>}
        <p className="mt-3 text-xs leading-relaxed text-slate-400">{correlation.correlation.method} Macro observations use period dates (not release timestamps), so this historical descriptive comparison is not suitable for leakage-free forecasting. Sources: FRED and {correlation.source.prices}.</p>
      </>}
    </article>
    <p className="text-xs text-slate-500">Returns use consecutive trading observations; moving averages use trading observations, and volatility is the sample standard deviation of daily returns annualized by √252. Descriptive statistics are not investment advice.</p>
  </section>;
}

export function EconomicDetailPage() {
  const [seriesId, setSeriesId] = useState<(typeof seriesOptions)[number]['id']>('UNRATE');
  const [range, setRange] = useState<keyof typeof seriesRangeYears>('5y');
  const [frequency, setFrequency] = useState<string>('native');
  const [result, setResult] = useState<EconomicSeriesResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const selectedSeries = seriesOptions.find((series) => series.id === seriesId) ?? seriesOptions[0];

  useEffect(() => {
    if (!selectedSeries.frequencies.some((item) => item === frequency)) setFrequency('native');
  }, [selectedSeries, frequency]);

  useEffect(() => {
    let active = true;
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = rangeStart(range);
    setLoading(true);
    setError('');
    getJson<EconomicSeriesResponse>(
      `/api/economy/series/${seriesId}?startDate=${startDate}&endDate=${endDate}&frequency=${frequency}`,
    )
      .then((value) => { if (active) setResult(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load economic observations.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [seriesId, range, frequency]);

  return <section aria-labelledby="economy-detail-heading" className="mt-8 space-y-5">
    <header className="panel flex flex-wrap items-end justify-between gap-4">
      <div><p className="section-kicker">FRED · Date-range analysis</p><h2 id="economy-detail-heading" className="section-title">Economic indicator details</h2></div>
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-xs text-slate-400">Indicator
          <select value={seriesId} onChange={(event) => setSeriesId(event.target.value as typeof seriesId)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            {seriesOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-slate-400">Date range
          <select value={range} onChange={(event) => setRange(event.target.value as typeof range)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            <option value="1y">1 year</option><option value="5y">5 years</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-slate-400">Frequency
          <select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
            {selectedSeries.frequencies.map((item) => <option key={item} value={item}>{item === 'native' ? `Native (${selectedSeries.native})` : ({ w: 'Weekly', m: 'Monthly', q: 'Quarterly', a: 'Annual' } as Record<string, string>)[item]}</option>)}
          </select>
        </label>
      </div>
    </header>
    {error && <ErrorPanel error={error} />}
    {loading && <p role="status" className="text-sm text-slate-400">Loading economic observations…</p>}
    {result && <article className="panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div><p className="section-kicker">{result.id} · {result.unit}</p><h3 className="section-title">{result.name}</h3></div>
        <p className="text-xs text-slate-400">Backend refresh: {new Date(result.updatedAt).toLocaleString()}</p>
      </div>
      {result.observations.length
        ? <Chart data={result.observations} valueKey="value" formatValue={(value) => `${number.format(value)}${result.unit === 'Percent' ? '%' : ''}`} />
        : <p className="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">No observations are available for this range.</p>}
      <p className="mt-3 text-xs text-slate-400">{result.observations.length} observations · {frequency === 'native' ? `Provider native ${selectedSeries.native.toLowerCase()} frequency` : `FRED ${frequency} frequency using average aggregation`}. Series may be revised after publication.</p>
    </article>}
  </section>;
}

export function ForecastPage() {
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getJson<ForecastResponse>('/api/stocks/forecast/SPY')
      .then((value) => { if (active) setResult(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load forecast evaluation.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <section aria-labelledby="forecast-heading" className="mt-8 space-y-5">
    <header className="panel"><p className="section-kicker">Forecast experiment · SPY</p><h2 id="forecast-heading" className="section-title">Five-trading-day return baseline</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">An experimental, historical-distribution baseline—not a promise or a personalized recommendation.</p></header>
    {loading && <p role="status" className="text-sm text-slate-400">Evaluating historical forecasts…</p>}
    {error && <ErrorPanel error={error} />}
    {result && !result.available && <ErrorPanel error={result.reason ?? 'The forecast is unavailable.'} />}
    {result?.available && result.intervalPercent && result.evaluation && <article className="panel space-y-5">
      {result.stale && <p className="text-sm text-amber-200">Using saved {result.source} observations because the provider is unavailable.</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Median historical estimate" value={`${number.format(result.estimatePercent ?? 0)}%`} />
        <Metric label={`${result.intervalPercent.confidenceLevel}% empirical interval`} value={`${number.format(result.intervalPercent.lower)}% to ${number.format(result.intervalPercent.upper)}%`} />
        <Metric label="As of / training outcomes" value={`${result.asOf} / ${result.trainingObservations}`} />
      </div>
      <div>
        <h3 className="font-medium">Walk-forward evaluation</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{result.evaluation.method}</p>
        <p className="mt-2 text-sm text-slate-300">{result.evaluation.observations} out-of-sample observations · {result.evaluation.historicalPeriod?.start ?? '—'} to {result.evaluation.historicalPeriod?.end ?? '—'}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Metric label="Median forecast MAE / RMSE" value={`${number.format(result.evaluation.empiricalMedian.meanAbsoluteError)}% / ${number.format(result.evaluation.empiricalMedian.rootMeanSquaredError)}%`} />
          <Metric label="Zero-return baseline MAE / RMSE" value={`${number.format(result.evaluation.zeroReturnBaseline.meanAbsoluteError)}% / ${number.format(result.evaluation.zeroReturnBaseline.rootMeanSquaredError)}%`} />
        </div>
      </div>
      <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-slate-400">
        {result.assumptions?.map((assumption) => <li key={assumption}>{assumption}</li>)}
      </ul>
    </article>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-900 p-4">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="mt-2 text-lg font-semibold text-slate-100">{value}</p>
  </div>;
}
