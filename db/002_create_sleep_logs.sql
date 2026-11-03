CREATE TABLE sleep_logs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, 
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    night_date date NOT NULL,
    bedtime timestamptz,
    wake_time timestamptz,
    bedtime_source text,
    wake_time_source text,
    UNIQUE (user_id, night_date)
);