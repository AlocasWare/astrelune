-- Remove NewModel15, an unreferenced placeholder model not present in the approved Astrelune data contract.
-- Refuse to drop it if it contains records; inspect/export those records before retrying.
DO $$
DECLARE
  existing_rows BIGINT;
BEGIN
  IF to_regclass('public."NewModel15"') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public."NewModel15"' INTO existing_rows;
    IF existing_rows > 0 THEN
      RAISE EXCEPTION
        'Refusing to drop public."NewModel15": % row(s) exist. Back up and review the data, then rerun the migration.',
        existing_rows;
    END IF;

    DROP TABLE public."NewModel15";
  END IF;
END $$;
