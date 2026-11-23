# Analytics approach

The `analytics/` folder is reserved for reproducible research. The dependencies currently listed are NumPy, pandas, and scikit-learn. The backend may later expose validated analysis results to the dashboard.

## Descriptive metrics to implement first

- Simple and logarithmic returns with clear frequency and adjustment assumptions.
- Moving averages over trading observations, not calendar days.
- Rolling volatility with an explicitly stated annualization convention.
- Correlations after aligning dates, documenting release timing and missing-value handling.

## Market-condition score

A score should be decomposable into named components, use documented inputs and weights, and expose its observation window. It should be evaluated for stability and sensitivity before it is treated as informative. Avoid presenting an unexplained score as an objective market state.

## Forecasting discipline

Use time-ordered validation, avoid using revised or not-yet-published observations as if they were known at the time, compare with simple baselines, and show uncertainty intervals and evaluation history. Forecasts are estimates and must not be represented as guaranteed outcomes or personal investment advice.

## Implemented price-only condition score

The stock analysis API exposes a decomposable 0–100 score from three bounded components: trend (close relative to the 50-observation moving average), momentum (20-observation simple return), and volatility (20-observation standard deviation of daily returns, annualized by √252). Default component weights are 40/35/25 percent. The API accepts alternative integer weights totaling 100; the interface exposes trend and momentum controls and assigns the remainder to volatility. Missing-history components are excluded and the remaining weights are renormalized. This descriptive score is not a forecast or investment recommendation.

## Implemented macro/market correlation

The correlation view aligns consecutive monthly FRED observations with monthly close-to-close asset returns. GDP remains quarterly and is aligned with quarterly asset returns. Percent-unit FRED series use percentage-point changes; other series use percentage changes. The view reports Pearson correlation, frequency, and sample count. FRED observation dates are not necessarily publication/release timestamps, so these correlations describe same-period relationships and are not suitable as predictive features without vintage/release-time data.

## Implemented forecast experiment

The SPY five-trading-day baseline uses historical five-observation simple returns. The point estimate is their median; the uncertainty interval is the empirical 5th–95th percentile. A minimum history requirement prevents results from being presented without enough prior observations. The displayed evaluation is an expanding-window walk-forward comparison: every forecast uses only five-day outcomes fully known before its origin. Mean absolute and root-mean-squared errors are compared with a zero-return baseline. These results are an experiment, not evidence that the estimate will outperform in the future.

All calculations use the daily closes returned by Finnhub, which may be unadjusted; the data source and this assumption are displayed/documented. Provider restrictions can prevent live evaluation.
