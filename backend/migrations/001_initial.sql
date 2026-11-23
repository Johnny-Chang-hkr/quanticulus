CREATE TABLE IF NOT EXISTS candle_observations (
  symbol TEXT NOT NULL,
  observation_date DATE NOT NULL,
  close NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  open NUMERIC NOT NULL,
  volume BIGINT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (symbol, observation_date)
);

CREATE INDEX IF NOT EXISTS candle_observations_date_idx
  ON candle_observations (observation_date);

CREATE TABLE IF NOT EXISTS economic_observations (
  series_id TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'native',
  observation_date DATE NOT NULL,
  value NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (series_id, frequency, observation_date)
);

CREATE INDEX IF NOT EXISTS economic_observations_date_idx
  ON economic_observations (series_id, frequency, observation_date);
CREATE INDEX IF NOT EXISTS economic_observations_retention_idx
  ON economic_observations (observation_date);
