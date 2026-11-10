-- Row count and content fingerprint of every table that a backup holds.
-- Run inside the backup's snapshot on the live database, and again on the
-- database the backup was restored into: the two outputs must be identical.
-- Prints one line per table: schema.table|rows|md5 of the rows (order-free).
-- Output settings are fixed so the same row prints the same text on both.
SET TimeZone = 'UTC';
SET DateStyle = 'ISO, YMD';
SET IntervalStyle = 'postgres';
SET extra_float_digits = 1;
SET bytea_output = 'hex';
\pset format unaligned
\pset tuples_only on
\pset footer off
SELECT format(
         $q$SELECT %L || '|' || count(*) || '|' || md5(coalesce(string_agg(h, '' ORDER BY h), '')) FROM (SELECT md5(t::text) AS h FROM %I.%I t) s$q$,
         schemaname || '.' || tablename, schemaname, tablename)
  FROM pg_tables
 WHERE schemaname = ANY (string_to_array(:'schemas', ','))
   AND (:'tables' = '' OR schemaname || '.' || tablename = ANY (string_to_array(:'tables', ',')))
 ORDER BY schemaname, tablename
\gexec
