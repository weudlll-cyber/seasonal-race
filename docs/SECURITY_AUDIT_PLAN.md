# Security Audit Plan

## Security Objectives

- Protect admin capabilities and race configuration integrity.
- Prevent injection and malformed payload abuse.
- Control asset upload and plugin extension risks.

## Controls

1. Input validation and sanitization

- Validate all external input using schemas.
- Reject unknown properties where possible.

2. Authentication and authorization

- Require authentication for admin endpoints.
- Enforce role checks per action.

3. Abuse and rate protection

- Rate limit API endpoints.
- Restrict payload sizes.

4. Asset safety

- Restrict upload MIME types and size.
- Serve through controlled storage paths.

5. Supply chain security

- Dependency scanning in CI full gate.
- Pin critical tooling versions.

6. Secure coding constraints

- No `eval`-style execution.
- No unsafe dynamic plugin loading in production.

## Audit Checklist

- Threat model reviewed
- Endpoint validation coverage reviewed
- Authn/authz tests pass
- Dependency scan clean or accepted with documented risk
- Security findings tracked with remediation owners
