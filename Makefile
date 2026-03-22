SHELL := /bin/bash

EXTERNAL_DEV_ENV_FILE ?= .env.external-dev
EXTERNAL_DEV_COMPOSE_FILE ?= docker-compose.vault-external-dev.yml
EXTERNAL_DEV_CONTAINER_NAME ?= vault-external-dev
EXTERNAL_DEV_INIT_CONTAINER_NAME ?= vault-external-dev-init

.PHONY: \
	vault-external-dev-init-env \
	vault-external-dev-up \
	vault-external-dev-status \
	vault-external-dev-logs \
	vault-external-dev-exports \
	vault-external-dev-secret \
	vault-external-dev-planning-review \
	vault-external-dev-live

vault-external-dev-init-env:
	@if [[ -f "$(EXTERNAL_DEV_ENV_FILE)" ]]; then \
		echo "$(EXTERNAL_DEV_ENV_FILE) already exists; refusing to overwrite"; \
		exit 1; \
	fi
	cp docs/ops/vault-external-dev.env.template "$(EXTERNAL_DEV_ENV_FILE)"
	chmod 600 "$(EXTERNAL_DEV_ENV_FILE)"
	@echo "Created $(EXTERNAL_DEV_ENV_FILE). Replace INTERNAL_SECRET_BOOTSTRAP before bring-up."

vault-external-dev-up:
	bash ./scripts/vault/bootstrap-external-dev-server.sh "$(EXTERNAL_DEV_ENV_FILE)"

vault-external-dev-status:
	docker exec "$(EXTERNAL_DEV_CONTAINER_NAME)" env VAULT_ADDR=http://127.0.0.1:8200 vault status

vault-external-dev-logs:
	docker logs "$(EXTERNAL_DEV_INIT_CONTAINER_NAME)"

vault-external-dev-exports:
	@printf 'export VAULT_ADDR=http://localhost:8200\n'
	@printf "export VAULT_RUNTIME_ROLE_ID='%s'\n" "$$(docker exec "$(EXTERNAL_DEV_CONTAINER_NAME)" cat /vault/file/runtime-role-id)"
	@printf "export VAULT_RUNTIME_SECRET_ID='%s'\n" "$$(docker exec "$(EXTERNAL_DEV_CONTAINER_NAME)" cat /vault/file/runtime-secret-id)"
	@printf "export VAULT_ROTATION_ROLE_ID='%s'\n" "$$(docker exec "$(EXTERNAL_DEV_CONTAINER_NAME)" cat /vault/file/rotation-role-id)"
	@printf "export VAULT_ROTATION_SECRET_ID='%s'\n" "$$(docker exec "$(EXTERNAL_DEV_CONTAINER_NAME)" cat /vault/file/rotation-secret-id)"

vault-external-dev-secret:
	@VAULT_ADDR=http://localhost:8200 \
	VAULT_RUNTIME_ROLE_ID="$$(docker exec "$(EXTERNAL_DEV_CONTAINER_NAME)" cat /vault/file/runtime-role-id)" \
	VAULT_RUNTIME_SECRET_ID="$$(docker exec "$(EXTERNAL_DEV_CONTAINER_NAME)" cat /vault/file/runtime-secret-id)" \
	./docker/vault/scripts/read-internal-secret.sh

vault-external-dev-planning-review:
	@RUN_ID="$${VAULT_EXTERNAL_REHEARSAL_RUN_ID:-$$(date -u +%Y%m%dT%H%M%SZ)}"; \
	OUTPUT_DATE="$${VAULT_EXTERNAL_REHEARSAL_OUTPUT_DATE:-$$(date +%Y%m%d)}"; \
	VAULT_EXTERNAL_REHEARSAL_RUN_ID="$$RUN_ID" \
	VAULT_EXTERNAL_REHEARSAL_MODE=planning-review \
	VAULT_EXTERNAL_REHEARSAL_OUTPUT_DIR="docs/ops/evidence/vault-external/$$OUTPUT_DATE" \
	VAULT_EXTERNAL_REHEARSAL_OPERATOR="$${VAULT_EXTERNAL_REHEARSAL_OPERATOR:-platform-ops}" \
	VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT="$${VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT:-dev-docker-single-node}" \
	VAULT_EXTERNAL_REHEARSAL_CHANGE_REF="$${VAULT_EXTERNAL_REHEARSAL_CHANGE_REF:-CRQ-014}" \
	VAULT_EXTERNAL_REHEARSAL_ROLLBACK_OWNER="$${VAULT_EXTERNAL_REHEARSAL_ROLLBACK_OWNER:-vault-oncall}" \
	VAULT_EXTERNAL_REHEARSAL_CA_DISTRIBUTION_PATH="$${VAULT_EXTERNAL_REHEARSAL_CA_DISTRIBUTION_PATH:-not-applicable-http-dev-server}" \
	VAULT_EXTERNAL_REHEARSAL_TRUSTSTORE_PATH="$${VAULT_EXTERNAL_REHEARSAL_TRUSTSTORE_PATH:-not-applicable-http-dev-server}" \
	VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS="$${VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS:-docker://$(EXTERNAL_DEV_CONTAINER_NAME)/vault/file/audit.log}" \
	VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE="$${VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE:-planning-review-only}" \
	VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF="$${VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF:-docs://ops/evidence/vault-external/dev-prep}" \
	./scripts/vault/run-external-cutover-rehearsal.sh

vault-external-dev-live:
	@RUN_ID="$${VAULT_EXTERNAL_REHEARSAL_RUN_ID:-$$(date -u +%Y%m%dT%H%M%SZ)}"; \
	OUTPUT_DATE="$${VAULT_EXTERNAL_REHEARSAL_OUTPUT_DATE:-$$(date +%Y%m%d)}"; \
	VAULT_EXTERNAL_REHEARSAL_RUN_ID="$$RUN_ID" \
	VAULT_EXTERNAL_REHEARSAL_MODE=live-external \
	VAULT_EXTERNAL_REHEARSAL_CONFIRM_LIVE="$${VAULT_EXTERNAL_REHEARSAL_CONFIRM_LIVE:-1}" \
	VAULT_EXTERNAL_REHEARSAL_OUTPUT_DIR="docs/ops/evidence/vault-external/$$OUTPUT_DATE" \
	VAULT_EXTERNAL_REHEARSAL_OPERATOR="$${VAULT_EXTERNAL_REHEARSAL_OPERATOR:-platform-ops}" \
	VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT="$${VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT:-dev-docker-single-node}" \
	VAULT_EXTERNAL_REHEARSAL_CHANGE_REF="$${VAULT_EXTERNAL_REHEARSAL_CHANGE_REF:-CRQ-014}" \
	VAULT_EXTERNAL_REHEARSAL_ROLLBACK_OWNER="$${VAULT_EXTERNAL_REHEARSAL_ROLLBACK_OWNER:-vault-oncall}" \
	VAULT_EXTERNAL_REHEARSAL_CA_DISTRIBUTION_PATH="$${VAULT_EXTERNAL_REHEARSAL_CA_DISTRIBUTION_PATH:-not-applicable-http-dev-server}" \
	VAULT_EXTERNAL_REHEARSAL_TRUSTSTORE_PATH="$${VAULT_EXTERNAL_REHEARSAL_TRUSTSTORE_PATH:-not-applicable-http-dev-server}" \
	VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS="$${VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS:-docker://$(EXTERNAL_DEV_CONTAINER_NAME)/vault/file/audit.log?run_id=$$RUN_ID}" \
	VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE="$${VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE:-docker-volume-retained}" \
	VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF="$${VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF:-docker://$(EXTERNAL_DEV_CONTAINER_NAME)-data/vault-external/$$RUN_ID}" \
	VAULT_EXTERNAL_REHEARSAL_HOSTNAME_VERIFICATION_RESULT="$${VAULT_EXTERNAL_REHEARSAL_HOSTNAME_VERIFICATION_RESULT:-not-applicable-http-dev-server}" \
	VAULT_EXTERNAL_REHEARSAL_SAN_VERIFICATION_RESULT="$${VAULT_EXTERNAL_REHEARSAL_SAN_VERIFICATION_RESULT:-not-applicable-http-dev-server}" \
	VAULT_EXTERNAL_REHEARSAL_VERIFICATION_REFERENCE="$${VAULT_EXTERNAL_REHEARSAL_VERIFICATION_REFERENCE:-docker-http-exception # run_id=$$RUN_ID}" \
	./scripts/vault/run-external-cutover-rehearsal.sh
