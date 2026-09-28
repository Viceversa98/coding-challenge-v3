-- Seeded chargebacks have no deduction. 0 is never issued by deduction_id BIGSERIAL.
UPDATE vendor.expense_events
SET deduction_id = 0
WHERE deduction_id IS NULL;

ALTER TABLE vendor.expense_events
  ALTER COLUMN deduction_id SET DEFAULT 0;

ALTER TABLE vendor.expense_events
  ALTER COLUMN deduction_id SET NOT NULL;

-- The previous key omitted deduction_id, so two SELL_OUT deductions with the
-- same type, product, and day overwrote one row. expense_date stays in the key
-- because this table is a hypertable partitioned on that column.
ALTER TABLE vendor.expense_events
  DROP CONSTRAINT expense_events_pkey;

ALTER TABLE vendor.expense_events
  ADD CONSTRAINT expense_events_pkey
  PRIMARY KEY (
    store_id,
    source_system_id,
    expense_date,
    expense_type,
    expense_subtype,
    deduction_id
  );
