# Sprint 1 operations

## Start and verify

Start PostgreSQL 16 and Redis with Compose, apply migrations, then start the API and frontends. `/health` confirms the process is serving. `/ready` also checks database and Redis connectivity. Redis rate-limit failures fail the request closed. Use only a trusted reverse proxy; the API does not trust arbitrary forwarded client-IP headers.

Production must terminate TLS, inject secrets from a secret manager, use a least-privilege application database role and retain migration permissions separately. Restrict API network access to the trusted proxy. Add edge rate limits and CDN image delivery. Configure uptime/5xx alerting before staging acceptance; centralized metrics/alerts and OpenTelemetry are not self-certified by this branch.

## Failed or uncertain order

Keep the guest cart and retry. Never create a new order identifier until the previous attempt has a confirmed response. The API returns the original order for repeated business payloads. A changed quote returns PRICE_CHANGED before writing; ask the guest to review the total. Use the authenticated ticket API or database history to investigate using order id and request id. Do not log authorization, QR URLs, PINs or request bodies.

## QR compromise

Manager rotates the specific table QR, downloads and prints replacement stickers, then scans the old and new stickers. Rotation changes future scan validity; it does not revoke an existing table session token. Session closure and guest revocation UX are later-sprint scope. If an active session is compromised, restrict access operationally and investigate before service continues.

## Images

Back up UPLOAD_DIR alongside the database for a single-node staging deployment. Images are immutable UUID files; original uploads are discarded after conversion. Run a controlled orphan-file retention process before production. Multiple API nodes require a shared object store, currently an explicit gap.

## Migration and rollback

Migration 0001 is an initial schema, not a reversible production upgrade. Never drop a production schema to roll back application code. Snapshot before applying migrations. Migrations 0002–0004 are additive nullable columns/indexes and older code can remain deployed during rollback. A transaction failure rolls back that migration. The CI PostgreSQL check creates a fresh random schema inside a database explicitly named *_test and verifies transaction rollback; its disposable service owns cleanup. No supplied database schema is dropped.

## Release gates

Before staging: review dependency audit, generate/review lockfile, run PostgreSQL checks, configure storage and alerts, scan printed QR sheets. Before pilot: PO acceptance, peer review/merge through green CI, physical Android/iOS matrix, network measurements, backups/restore drill and the source-document legal/tax/aggregator decisions. No payment provider is configured in Sprint 1.
