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

No score or predictive model is implemented in the current app.
