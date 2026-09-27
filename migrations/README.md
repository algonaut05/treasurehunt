# Firestore to PostgreSQL migration prep

The app defaults to Firestore. The PostgreSQL adapter is opt-in and should be trialed only against the isolated `engquest_migration` database until the complete workflow has been verified.

## Snapshot and verify

Run from the project root while `.env.local` contains the Firestore project ID and service-account path:

```powershell
npm run db:backup:firestore
node scripts/verify-firestore-backup.mjs local-data/migration-backups/<timestamp>
```

The snapshot contains every Firestore document and copies both local photo directories. Team documents contain passwords and member details, so keep the backup private, do not commit it, and retain a second protected copy before cutover. `local-data/` is ignored by Git.

## Import into the Docker PostgreSQL container

This repository has PostgreSQL available in Docker on `127.0.0.1:5432`. The helper reads the container's PostgreSQL credentials without displaying them and creates/uses only a separate database named `engquest_migration`; it does not alter `poster_new`, `poster_rag`, or `postgres`.

```powershell
npm run db:import:postgres -- local-data/migration-backups/<timestamp>/firestore-backup.json
npm run db:import:docker -- local-data/migration-backups/<timestamp>/firestore-backup.json
```

The first command is a dry run. The second creates the schema and imports into an empty migration database. It refuses to overwrite existing migration data. The importer validates references and commits in one transaction; a failed import rolls back. Photo files remain in the local photo directories; the database holds their metadata.

## Trial the application backend

After reviewing the imported data, configure private `.env.local` with `DATABASE_BACKEND=postgres` and a `DATABASE_URL` for `engquest_migration`, then start the API with `npm run server`. To return to Firestore, set `DATABASE_BACKEND=firestore` or remove the variable and restart.

The trial adapter supports the document and transaction operations used by the current API. Verify registration, team login, each round's progress, photo upload/review, organizer actions, and restart behavior against a disposable clone before pointing real players at PostgreSQL. Never run a trial or import against any of the poster app databases.

The current container publishes PostgreSQL on all network interfaces (`0.0.0.0:5432`). The imported team records include plaintext team passwords. Restrict host firewall/port access before any production use; keep this staging data local and private.

## Cutover and rollback

Do not cut over until imported row counts and team fields are reconciled with the snapshot, concurrent registration and progress transactions have been checked, and photo review has been exercised end to end. Keep Firestore and the verified snapshot intact during a trial period. If a cutover fails, restart the API with Firestore selected; avoid reverse writes from an unverified PostgreSQL database.
