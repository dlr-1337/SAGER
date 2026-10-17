CREATE FUNCTION sager_search_text(value TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
    SELECT lower(regexp_replace(trim(regexp_replace(normalize(coalesce(value,''), NFD),
        U&'[\0300-\036f]', '', 'g')), '\s+', ' ', 'g'));
$$;
