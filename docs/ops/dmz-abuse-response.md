# DMZ Abuse Response Procedure

## Trigger

Apply this procedure when the same source identity triggers 5 or more rate-limit violations within 5 minutes.

## Source Identity

- Use trusted client identity derived by edge policy:
  - `X-Forwarded-For` only when source proxy is trusted
  - otherwise `remote_addr`

## Temporary Deny Action

1. Record incident with request id samples and timestamp window.
2. Apply temporary deny entry (10 minutes) from the edge container:
   - `docker exec edge-gateway /usr/local/bin/dmz-temp-denylist.sh apply <source_ip_literal> 600 dmz_rate_limit_abuse <ticket_id>`
3. Emit security event with:
   - actor (`SEC` automation or operator id)
   - action (`DMZ_TEMP_DENY_APPLY`)
   - target (`<source_ip>`)
   - timestamp (UTC)
   - source identity
   - reason (`dmz_rate_limit_abuse`)
   - ticket-id
   - correlation-id
4. Confirm deny entry is present:
   - `docker exec edge-gateway /usr/local/bin/dmz-temp-denylist.sh list`
5. Deny entry expires automatically at TTL and the script triggers sweep/reload at expiry (entrypoint sweep also cleans expired entries after restart).

## Evidence

- Store procedure evidence under `docs/ops/evidence/dmz/<YYYYMMDD>/`.
- Include denylist action JSON (`dmz-abuse-deny-<YYYYMMDDTHHMMSSZ>.json`) and `summary-index.json` updates.
