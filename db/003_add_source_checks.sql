ALTER TABLE sleep_logs ADD CONSTRAINT sleep_logs_bedtime_source_check CHECK (bedtime_source IS NULL OR bedtime_source IN ('tapped', 'entered later'));

ALTER TABLE sleep_logs ADD CONSTRAINT sleep_logs_wake_time_source_check CHECK (wake_time_source IS NULL OR wake_time_source IN ('tapped', 'entered later'));