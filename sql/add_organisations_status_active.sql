-- Step 5: block unpaid/suspended tenants at routing layer.
-- Adds a canonical status column used by proxy.ts.

ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organisations'
      AND column_name = 'statut'
  ) THEN
    EXECUTE $sql$
      UPDATE public.organisations
      SET status = CASE
        WHEN lower(trim(coalesce(statut, ''))) IN ('suspendu', 'suspended', 'inactive', 'blocked', 'impaye', 'unpaid')
          THEN 'suspended'
        ELSE 'active'
      END
      WHERE status IS NULL OR status = '' OR status = 'active'
    $sql$;
  ELSE
    UPDATE public.organisations
    SET status = 'active'
    WHERE status IS NULL OR status = '';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organisations_status_check'
  ) THEN
    ALTER TABLE public.organisations
      ADD CONSTRAINT organisations_status_check
      CHECK (status IN ('active', 'suspended'));
  END IF;
END
$$;
