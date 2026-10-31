# M11.3 — Multi-Instance Rate Limiting

## Current implementation

- In-memory, process-local rate limiter.

## Assessment

- Suitable for single-instance deployment only.
- Not suitable for horizontally scaled production without a shared store.

## Decision

- Release 1 staging is restricted to a single API instance.
- A shared rate-limit store is a production deployment requirement.
  EOF
