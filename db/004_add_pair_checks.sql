ALTER TABLE sleep_logs
ADD CONSTRAINT sleep_logs_bedtime_pair_check
CHECK ((bedtime IS NULL AND bedtime_source IS NULL)
    OR (bedtime IS NOT NULL AND bedtime_source IS NOT NULL));


ALTER TABLE sleep_logs
ADD CONSTRAINT sleep_logs_wake_time_pair_check
CHECK ((wake_time IS NULL AND wake_time_source IS NULL)
    OR (wake_time IS NOT NULL AND wake_time_source IS NOT NULL));

