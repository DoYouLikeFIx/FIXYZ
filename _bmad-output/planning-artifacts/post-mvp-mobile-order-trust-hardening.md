# Post-MVP Mobile Order Trust Hardening

Date: 2026-03-15  
Status: Deferred post-MVP design record  
Scope: Mobile order authorization continuity, transaction confirmation hardening, and rollout strategy

## Purpose

This document captures the mobile order security and UX discussions that were intentionally deferred beyond the current MVP.

The current MVP remains on the shared backend authorization model:

- FE and MOB consume the same server-owned order-session authorization decision
- Auto-authorization currently uses the trusted auth-session window plus shared login IP and user-agent continuity
- Order-session extend is treated as an active-session continuity action, not a fresh authorization decision
- Mobile-specific trusted device continuity, mobile-specific soft-signal handling, local transaction confirmation, and device-keystore/FIDO-backed assertions are not active MVP requirements

This record exists so the team can preserve the design discussion without accidentally promoting these ideas into the active MVP contract.

## Why This Is Deferred

The proposed mobile-specific hardening direction improves real-world mobile ergonomics, but it also introduces meaningful new platform and backend complexity:

- New server-owned trust identifiers and persistence rules
- Clear invalidation semantics for reinstall, secure-storage wipe, and trust revocation
- New mobile-only execution confirmation rules
- Expanded QA matrix for lifecycle, reinstall, and recovery edge cases
- Potential native security integrations such as device keystore usage or FIDO-like assertions

Because the current MVP already has a working shared authorization model, the team decided to preserve current implementation behavior and carry this design forward as a post-MVP hardening lane.

## Discussion Summary

### Problem Observed

The shared continuity model is technically workable across web and mobile, but it can feel harsh on mobile because normal mobile behavior is noisier than browser behavior.

Examples discussed:

- `Wi-Fi -> LTE/5G` network changes
- short background and resume cycles
- token refresh or reconnect events
- mobile runtime conditions where transport metadata changes even though the user still perceives the same phone, same app, same account, same task

The concern was that mobile users may experience additional OTP prompts in situations they perceive as ordinary rather than suspicious.

### Financial-Services Direction Reviewed

The team re-examined this against common mobile-finance patterns and concluded that a more realistic post-MVP direction would be:

- Trust device/app continuity more than transport continuity on mobile
- Treat network change and background/resume as soft signals, not hard OTP triggers by themselves
- Keep hard triggers for genuinely meaningful trust-boundary changes
- Potentially require a local transaction confirmation at mobile Step C even when Step B OTP is skipped

### Important Product Decision

The team did **not** adopt this as an active MVP rule set.

Instead:

- The ideas are captured here as future hardening work
- Current MVP implementation remains unchanged
- Current stories should continue to implement against the shared backend authorization model

## Post-MVP Policy Direction

### Guiding Principle

For mobile order authorization, continuity should eventually rely more on trusted device/app state than on raw network continuity.

### Proposed Mobile Auto-Authorization Direction

A future mobile order-session create may auto-authorize only when all of the following are true:

- The order is low-risk
- The trusted auth-session window is still valid
- Trusted device/app continuity is valid
- No recent high-risk security event exists
- The server has not invalidated the mobile trust context

### Low-Risk Order Conditions

The discussed baseline low-risk shape remains:

- `LIMIT` order
- `price` present
- `qty * price <= 500000`
- No extra server-side risk flags

### Proposed Trusted Device/App Continuity Definition

Trusted device/app continuity would eventually mean all of the following:

- Same authenticated member context
- Same app installation context
- Same server-recognized trust binding for that installation
- Same authenticated session family lineage
- No explicit trust invalidation
- No recent high-risk security event

Suggested server-owned inputs:

- `deviceInstallationId`
- `deviceTrustBindingId`
- `sessionFamilyId`

### Suggested Server Truth Priority

The discussion converged on this trust priority:

1. `deviceTrustBindingId`
2. `deviceInstallationId`
3. `sessionFamilyId`

Rationale:

- `deviceTrustBindingId` is the most policy-friendly server-controlled trust object
- `deviceInstallationId` identifies the installation context
- `sessionFamilyId` helps prove authenticated continuity but is not sufficient alone to represent trusted device state

## Signal Classification

### Hard Triggers

These were discussed as future hard invalidation or step-up triggers:

- Missing `deviceInstallationId`
- Missing `deviceTrustBindingId`
- Missing `sessionFamilyId`
- Mismatch with server-stored trust state
- Secure-storage wipe or trust-record loss
- App reinstall
- Trust revoke or rotate
- Session-family mismatch
- `ACCOUNT_LOCKED`
- `MFA_RECOVERY_PROOF_ISSUED`
- `MFA_REBIND_INITIATED`
- `MFA_REBIND_COMPLETED`
- `MFA_REBIND_FAILED`
- Explicit server-side trust or session invalidation

### Soft Signals

These were discussed as future mobile soft signals that should not, by themselves, force Step B OTP:

- Public IP change
- `Wi-Fi <-> LTE/5G`
- Temporary reconnect
- Background and resume
- Access-token refresh
- Mobile runtime reconnect noise

## Order Session Extend Policy

The discussion reaffirmed one important rule that already aligns with current MVP behavior:

- `extend` is a continuity action, not a new authorization decision
- On-time extend requests should not be rejected solely because recent MFA freshness is outside the trusted auth-session window

Future mobile hardening should preserve that principle.

Future extend gates should continue to be centered on:

- owner match
- session still active
- extendable state such as `PENDING_NEW` or `AUTHED`

and not on re-running mobile transport continuity checks.

## Future Mobile Step C Confirmation

One major post-MVP idea was to separate:

- Step B OTP as a risk-based step-up mechanism
- Step C local confirmation as a transaction-confirm action

### Proposed Step C Behavior

For mobile only, a future design may require a local transaction confirmation at Step C:

- Primary path: local biometric prompt
- Fallback path: app PIN confirmation
- Canceling local confirmation preserves the order draft and session state
- Local confirmation would be required immediately before execute, not during session creation

This would let the product reduce unnecessary Step B OTP prompts while still requiring an explicit transaction confirmation before order execution.

## Device-Keystore / FIDO Hardening Option

The discussion also explored stronger post-MVP hardening beyond plain metadata checks.

### Simple Metadata Model

The easier model is:

- Mobile app sends confirmation metadata such as method and confirmation time
- Backend validates freshness and trust binding

Pros:

- Easier to implement
- Lower cross-platform complexity

Cons:

- Backend is largely trusting app-reported confirmation metadata

### Device-Keystore Signing Model

A stronger model would use device-keystore-backed signing:

- Device private key stays inside Secure Enclave / Android Keystore
- App signs a server challenge or transaction payload
- Backend verifies the signature using a registered public key

Pros:

- Stronger proof that the confirmation came from the trusted device
- Better fit for high-value transaction confirmation

Cons:

- Requires native security integration, key registration, rotation, and recovery handling

### FIDO-Like Direction

The most advanced option discussed was a FIDO-like or standards-aligned transaction assertion path.

This was explicitly considered post-MVP only because it would require:

- Native platform integration
- Registration and recovery flows
- Public-key lifecycle handling
- Expanded QA coverage
- Stronger UX design for fallback paths

## Rollout Strategy Discussed

The team did not want a hard one-step flip.

Preferred rollout direction:

1. Add telemetry for mobile continuity signals
2. Implement server-side understanding of trusted device/app inputs
3. Shadow-evaluate the future mobile policy without enforcing it
4. Compare OTP prompt rates and suspicious-event catch rates
5. Gradually soften mobile network and resume signals
6. Introduce local Step C confirmation behind a flag

## Resume Grace Window Discussion

One useful hardening detail discussed was a short mobile resume grace window.

Suggested future behavior:

- When the app returns to foreground, allow a short `2-5s` rehydrate window
- Re-read secure storage and recover session-family or trust state
- Avoid forcing Step B immediately on transient resume races

This was discussed as a guard against false OTP prompts caused by ordinary mobile lifecycle timing.

## QA Matrix for Future Mobile Hardening

| Scenario | Trusted Window | Trusted Device Continuity | Soft Signal Only | High-Risk Event | Low-Risk Order | Expected Result |
|---|---:|---:|---:|---:|---:|---|
| Same phone, same app, same account | Y | Y | N | N | Y | Auto-auth |
| Same phone, `Wi-Fi -> LTE` | Y | Y | Y | N | Y | Auto-auth |
| Same phone, background/resume | Y | Y | Y | N | Y | Auto-auth |
| Same phone, background/resume + secure-storage wipe | Y | N | Y | N | Y | Step B OTP |
| Same phone, trusted window expired | N | Y | N | N | Y | Step B OTP |
| Same phone, high-notional order | Y | Y | N | N | N | Step B OTP |
| Same phone, recent recovery or rebind event | Y | Y | N | Y | Y | Step B OTP |
| App reinstall | Y | N | N | N | Y | Step B OTP |
| New device | Y | N | N | N | Y | Step B OTP |
| Active session extend before expiry | N okay | Y | Y okay | N | Any | Extend allowed |
| Expired session extend | Any | Any | Any | Any | Any | Fail and restart |

## Explicit Non-Goals for Current MVP

The following are **not** current MVP requirements:

- Mobile-specific continuity policy enforcement
- Mobile-specific soft-signal reweighting
- Mobile Step C biometric or app-PIN confirmation
- Device-keystore-backed transaction signing
- FIDO-backed transaction assertions

## Recommended Post-MVP Story Candidates

- Mobile trusted-device continuity contract
- Mobile trust invalidation and lifecycle recovery
- Mobile Step C local confirmation UX
- Mobile transaction-confirm backend contract
- Device-keystore-backed confirmation prototype
- FIDO/passkey-aligned transaction assertion feasibility study

## Relationship to Current MVP Specs

This document does not override the active MVP contract.

Active MVP behavior still lives in:

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/channels/api-spec.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/ux-design-specification.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/architecture.md`

This document is a preserved post-MVP discussion record and future hardening reference only.
