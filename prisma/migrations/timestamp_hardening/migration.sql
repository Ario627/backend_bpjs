CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION jaga_current_tenant() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE
AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "users" ADD CONSTRAINT "users_failed_login_nonnegative" CHECK ("failed_login_count" >= 0);
ALTER TABLE "users" ADD CONSTRAINT "users_email_length" CHECK (char_length("email") BETWEEN 5 AND 320);

ALTER TABLE "patients" ADD CONSTRAINT "patients_sex_valid" CHECK ("sex" IS NULL OR "sex" IN ('M', 'F', 'U'));
ALTER TABLE "patients" ADD CONSTRAINT "patients_age_band_valid" CHECK ("age_band" IS NULL OR "age_band" IN ('0-4', '5-14', '15-24', '25-44', '45-64', '65+'));

ALTER TABLE "claims" ADD CONSTRAINT "claims_period_valid" CHECK ("discharge_date" >= "admission_date");
ALTER TABLE "claims" ADD CONSTRAINT "claims_los_valid" CHECK ("los_days" >= 0 AND "los_days" <= 365);
ALTER TABLE "claims" ADD CONSTRAINT "claims_total_cost_nonnegative" CHECK ("total_cost" >= 0);
ALTER TABLE "claims" ADD CONSTRAINT "claims_risk_score_range" CHECK ("risk_score" IS NULL OR ("risk_score" >= 0 AND "risk_score" <= 100));
ALTER TABLE "claims" ADD CONSTRAINT "claims_primary_diagnosis_format" CHECK ("primary_diagnosis" ~ '^[A-Z][0-9]{2}([.][0-9A-Z]{1,4})?$');
ALTER TABLE "claims" ADD CONSTRAINT "claims_class_valid" CHECK ("class" IS NULL OR "class" IN ('1', '2', '3', 'KRIS'));
ALTER TABLE "claims" ADD CONSTRAINT "claims_version_positive" CHECK ("version" >= 1);

ALTER TABLE "claim_items" ADD CONSTRAINT "claim_items_item_type_valid" CHECK ("item_type" IN ('ROOM', 'DRUG', 'DEVICE', 'PROCEDURE', 'LAB', 'OTHER'));
ALTER TABLE "claim_items" ADD CONSTRAINT "claim_items_quantity_nonnegative" CHECK ("quantity" >= 0);
ALTER TABLE "claim_items" ADD CONSTRAINT "claim_items_unit_price_nonnegative" CHECK ("unit_price" >= 0);
ALTER TABLE "claim_items" ADD CONSTRAINT "claim_items_total_price_nonnegative" CHECK ("total_price" >= 0);

ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_size_nonnegative" CHECK ("size_bytes" >= 0);
ALTER TABLE "claim_documents" ADD CONSTRAINT "claim_documents_sha256_format" CHECK ("sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "claim_evaluations" ADD CONSTRAINT "claim_evaluations_rule_score_range" CHECK ("rule_score" >= 0 AND "rule_score" <= 100);
ALTER TABLE "claim_evaluations" ADD CONSTRAINT "claim_evaluations_final_score_range" CHECK ("final_score" >= 0 AND "final_score" <= 100);
ALTER TABLE "claim_evaluations" ADD CONSTRAINT "claim_evaluations_ml_score_range" CHECK ("ml_score" IS NULL OR ("ml_score" >= 0 AND "ml_score" <= 1));
ALTER TABLE "claim_evaluations" ADD CONSTRAINT "claim_evaluations_data_quality_range" CHECK ("data_quality" >= 0 AND "data_quality" <= 1);
ALTER TABLE "claim_evaluations" ADD CONSTRAINT "claim_evaluations_ml_status_valid" CHECK ("ml_status" IN ('OK', 'TIMEOUT', 'UNAVAILABLE', 'INVALID_INPUT'));
ALTER TABLE "claim_evaluations" ADD CONSTRAINT "claim_evaluations_latency_nonnegative" CHECK ("latency_ms" IS NULL OR "latency_ms" >= 0);

ALTER TABLE "decisions" ADD CONSTRAINT "decisions_rationale_min_length" CHECK (char_length("rationale") >= 20);

ALTER TABLE "rulepacks" ADD CONSTRAINT "rulepacks_checksum_format" CHECK ("checksum" ~ '^sha256:[0-9a-f]{64}$');
ALTER TABLE "rule_definitions" ADD CONSTRAINT "rule_definitions_weight_range" CHECK ("weight" >= 0 AND "weight" <= 100);

ALTER TABLE "reports" ADD CONSTRAINT "reports_tracking_hash_format" CHECK ("tracking_code_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "reports" ADD CONSTRAINT "reports_priority_valid" CHECK ("priority" IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'));
ALTER TABLE "reports" ADD CONSTRAINT "reports_category_length" CHECK (char_length("category") BETWEEN 3 AND 32);

ALTER TABLE "report_tracking" ADD CONSTRAINT "report_tracking_hash_format" CHECK ("tracking_code_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_entry_hash_format" CHECK ("entry_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_prev_hash_format" CHECK ("prev_hash" IS NULL OR "prev_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_resource_type_length" CHECK (char_length("resource_type") BETWEEN 2 AND 32);

ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_key_length" CHECK (char_length("key") BETWEEN 8 AND 128);
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_path_format" CHECK ("path" LIKE '/%');

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['tenants', 'users', 'refresh_tokens', 'patients', 'claims', 'claim_items', 'claim_documents', 'rulepacks', 'rule_definitions', 'claim_evaluations', 'decisions', 'reports', 'report_events', 'audit_log', 'outbox_events', 'model_versions', 'lkpp_prices'] LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT uuidv7()', target);
  END LOOP;
END;
$$;

ALTER TABLE "tenants" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "patients" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "claims" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "reports" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "report_tracking" ALTER COLUMN "updated_at" SET DEFAULT now();

CREATE INDEX "idx_claims_primary_diagnosis_trgm" ON "claims" USING gin ("primary_diagnosis" gin_trgm_ops);
CREATE INDEX "idx_claims_procedures_gin" ON "claims" USING gin ("procedures");
CREATE INDEX "idx_claims_claim_ref_prefix" ON "claims" ("claim_ref" varchar_pattern_ops);
CREATE INDEX "idx_claims_sep_ref" ON "claims" ("sep_ref") WHERE "sep_ref" IS NOT NULL;
CREATE INDEX "idx_reports_tracking_hash" ON "reports" ("tracking_code_hash");
CREATE INDEX "idx_audit_actor" ON "audit_log" ("actor_id", "created_at" DESC) WHERE "actor_id" IS NOT NULL;

CREATE UNIQUE INDEX "rulepacks_single_active" ON "rulepacks" ("rulepack_id") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "model_versions_single_active" ON "model_versions" ("model_name") WHERE "status" = 'ACTIVE';

CREATE FUNCTION enforce_reference_tenant() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_id uuid;
  expected_tenant uuid;
BEGIN
  parent_id := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;

  IF parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT tenant_id FROM %I WHERE id = $1', TG_ARGV[0])
    INTO expected_tenant
    USING parent_id;

  IF expected_tenant IS NULL OR NEW.tenant_id IS DISTINCT FROM expected_tenant THEN
    RAISE EXCEPTION 'tenant mismatch pada %', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "claims_patient_tenant_guard" BEFORE INSERT OR UPDATE ON "claims"
FOR EACH ROW EXECUTE FUNCTION enforce_reference_tenant('patients', 'patient_id');

CREATE TRIGGER "claim_items_tenant_guard" BEFORE INSERT OR UPDATE ON "claim_items"
FOR EACH ROW EXECUTE FUNCTION enforce_reference_tenant('claims', 'claim_id');

CREATE TRIGGER "claim_documents_tenant_guard" BEFORE INSERT OR UPDATE ON "claim_documents"
FOR EACH ROW EXECUTE FUNCTION enforce_reference_tenant('claims', 'claim_id');

CREATE TRIGGER "claim_documents_uploader_tenant_guard" BEFORE INSERT OR UPDATE ON "claim_documents"
FOR EACH ROW EXECUTE FUNCTION enforce_reference_tenant('users', 'uploaded_by');

CREATE TRIGGER "claim_evaluations_tenant_guard" BEFORE INSERT OR UPDATE ON "claim_evaluations"
FOR EACH ROW EXECUTE FUNCTION enforce_reference_tenant('claims', 'claim_id');

CREATE TRIGGER "decisions_claim_tenant_guard" BEFORE INSERT OR UPDATE ON "decisions"
FOR EACH ROW EXECUTE FUNCTION enforce_reference_tenant('claims', 'claim_id');

CREATE TRIGGER "decisions_actor_tenant_guard" BEFORE INSERT OR UPDATE ON "decisions"
FOR EACH ROW EXECUTE FUNCTION enforce_reference_tenant('users', 'actor_id');

CREATE TRIGGER "reports_claim_tenant_guard" BEFORE INSERT OR UPDATE ON "reports"
FOR EACH ROW EXECUTE FUNCTION enforce_reference_tenant('claims', 'claim_id');

CREATE TRIGGER "reports_assignee_tenant_guard" BEFORE INSERT OR UPDATE ON "reports"
FOR EACH ROW EXECUTE FUNCTION enforce_reference_tenant('users', 'assigned_to');

CREATE TRIGGER "report_events_tenant_guard" BEFORE INSERT OR UPDATE ON "report_events"
FOR EACH ROW EXECUTE FUNCTION enforce_reference_tenant('reports', 'report_id');

CREATE FUNCTION sync_report_tracking() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "report_tracking" ("report_id", "tracking_code_hash", "status", "created_at", "updated_at")
    VALUES (NEW."id", NEW."tracking_code_hash", NEW."status", NEW."created_at", NEW."updated_at")
    ON CONFLICT ("report_id") DO NOTHING;
    RETURN NEW;
  END IF;

  UPDATE "report_tracking"
     SET "status" = NEW."status",
         "updated_at" = now()
   WHERE "report_id" = NEW."id";

  RETURN NEW;
END;
$$;

CREATE TRIGGER "reports_sync_tracking" AFTER INSERT OR UPDATE OF "status" ON "reports"
FOR EACH ROW EXECUTE FUNCTION sync_report_tracking();

CREATE FUNCTION audit_log_block_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log bersifat append-only' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "audit_log_no_update" BEFORE UPDATE ON "audit_log"
FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

CREATE TRIGGER "audit_log_no_delete" BEFORE DELETE ON "audit_log"
FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();

CREATE TRIGGER "audit_log_no_truncate" BEFORE TRUNCATE ON "audit_log"
FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_mutation();

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['patients', 'claims', 'claim_items', 'claim_documents', 'claim_evaluations', 'decisions', 'reports', 'report_events', 'audit_log', 'idempotency_keys'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target);
    EXECUTE format('CREATE POLICY %I ON %I USING (tenant_id = jaga_current_tenant()) WITH CHECK (tenant_id = jaga_current_tenant())', target || '_tenant_isolation', target);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jaga_app') THEN
    CREATE ROLE jaga_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO jaga_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO jaga_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_log" FROM jaga_app;
GRANT SELECT, INSERT ON "audit_log" TO jaga_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO jaga_app;
GRANT EXECUTE ON FUNCTION jaga_current_tenant() TO jaga_app;
GRANT EXECUTE ON FUNCTION enforce_reference_tenant() TO jaga_app;
GRANT EXECUTE ON FUNCTION sync_report_tracking() TO jaga_app;
GRANT EXECUTE ON FUNCTION audit_log_block_mutation() TO jaga_app;