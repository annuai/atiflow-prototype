# ADR 0001: a front end that talks to services through ports

**Status:** accepted (phase 0 and 1 done, phase 2 next)

**Context.** Ati Flow is a front-end prototype with no backend. We want code the cloud team can deploy and wire to real systems (Fleet Manager APIs, the Deployment Manager that builds fleets and maps, SSO) without rewriting the application.

**Decision.** The app depends on small typed service interfaces ("ports"), one per domain (auth and users, fleets and robots, telemetry and orders, maps, workflows, requests and bookings, materials, notifications, settings). Each port has a dummy implementation built from typed fixtures (what exists today, moved behind the port) and, later, an HTTP implementation. A single composition root picks the implementation from the runtime configuration (`dataMode`). Vendor payloads are mapped to our types inside the adapters. Persisted and fetched documents are validated with zod schemas, which double as the contract documentation.

**Consequences.** Business rules stay pure and reusable (they already are). Stores shrink to client state on top of a port. Dummy data lives in one place. Moving to real APIs is writing adapters, not changing screens. The cost is a one-time refactor of every store, done domain by domain with the existing tests as the safety net and the lint and import baselines preventing new debt.
