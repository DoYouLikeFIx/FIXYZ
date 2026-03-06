# DMZ Trusted Proxy Sources

## Source of Truth

- `EDGE_TRUSTED_PROXY_CIDR_1`
- `EDGE_TRUSTED_PROXY_CIDR_2`
- Configured in `docker-compose.dmz.yml` for `edge-gateway`.
- Default-safe values are loopback only (`127.0.0.1/32`, `::1/128`).

## Rules

1. Only requests arriving from trusted proxy CIDRs may use `X-Forwarded-For` for client identity.
2. Requests from non-trusted sources must use `remote_addr`.
3. Any trusted CIDR change requires:
   - pull request review by `SEC`
   - update to DMZ drill evidence notes
4. Broad ranges (for example `/8`) are prohibited unless explicitly approved in risk acceptance.
