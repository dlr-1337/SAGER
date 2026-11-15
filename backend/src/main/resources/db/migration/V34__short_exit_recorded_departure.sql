-- A saída curta dura até 3 horas a partir da partida registrada; antes dela, conta da partida pedida.
ALTER TABLE sager_short_exit DROP CONSTRAINT sager_short_exit_duration_valid;
ALTER TABLE sager_short_exit ADD CONSTRAINT sager_short_exit_duration_valid CHECK (
    expected_return_at > requested_departure_at
    AND expected_return_at <= COALESCE(actual_departure_at, requested_departure_at) + INTERVAL '3 hours'
);
