# DMZ Trusted Proxy Sources

## Status

This document defines the future governance contract for trusted client identity extraction. No Epic 12-specific trusted-proxy runtime configuration is currently active in this repository.

## Source of Truth

- If Epic 12 implementation resumes, the minimum reserved configuration names are:
  - `EDGE_TRUSTED_PROXY_CIDR_1`
  - `EDGE_TRUSTED_PROXY_CIDR_2`
- Future runtime may extend beyond two entries, but the owning implementation change must document the expansion contract and review path.
- Default-safe posture remains loopback only unless a reviewed deployment change says otherwise.

## Rules

1. Only requests arriving from trusted proxy CIDRs may use `X-Forwarded-For` for client identity.
2. Requests from non-trusted sources must use `remote_addr`.
3. Any trusted CIDR change requires:
   - security review by `SEC`
   - update to DMZ drill/governance documentation
   - update to trusted-proxy validation scenario evidence
   - explicit deployment note describing why the new proxy is trusted
4. Broad ranges (for example `/8`) are prohibited unless explicitly approved in risk acceptance.

## Client Identity Selection Algorithm

When the immediate source IP is trusted:

1. Parse `X-Forwarded-For` as a comma-separated hop list.
2. Trim whitespace around each hop and reject empty elements.
3. Validate each hop as an IP literal. If any hop is malformed, ignore the entire header and use normalized `remote_addr`.
4. Starting from the right-most hop, select the first address that is not itself in the trusted CIDR set.
5. If every hop is trusted, fall back to the left-most valid hop.
6. Normalize the selected address before downstream use:
   - IPv6 literals must use RFC 5952 canonical form.
   - IPv4-mapped IPv6 addresses must be collapsed to plain IPv4 form.
7. Persist both `source_identity` and `source_identity_origin` (`remote_addr` or `x_forwarded_for`) in audit evidence.

## Validation Expectations

- Future drill sets must include `trusted-proxy-untrusted-spoof-rejected` proving spoofed or malformed `X-Forwarded-For` headers cannot override client identity from an untrusted source.
- Future drill sets must include `trusted-proxy-malformed-chain-fallback` proving a trusted ingress with a malformed `X-Forwarded-For` chain falls back to normalized `remote_addr` rather than partially trusting the header.
- Future drill sets must include `trusted-proxy-rightmost-hop-selection` proving the right-most non-trusted hop selection rule on a trusted multi-hop chain.

## Documentation Requirements

- The future implementation change must record:
  - trusted CIDR list
  - ingress ownership
  - rollout window
  - rollback trigger
- If the final runtime uses a different configuration surface than environment variables, this document must be updated in the same change.
