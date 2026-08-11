# Nexso — Go-Live Runbook: Test, Clean, Launch, Recover

Covers the four things you asked about: testing in production, cleaning up
afterwards, going live, and getting back if something breaks.

**Golden rule: never run a cleanup without a fresh, *verified* backup.**
`npm run db:backup` verifies the archive is readable and records row counts, so
"the backup ran" and "the backup works" are the same statement.

---

## 0. One-time setup

```bash
cd backend
npm run db:backup -- --label smoke-test     # confirm pg_dump is reachable
```

If you get `pg_dump not found on PATH`:

| Where | Fix |
|---|---|
| Windows (local) | Add `C:\Program Files\PostgreSQL\18\bin` to PATH |
| Linux host | `apt-get install postgresql-client-18` |
| Docker image | Add `postgresql-client` to the image |

The client version must be **>= the server version**. Yours are both 18.4.

Set these on the machine that runs backups:

```bash
BACKUP_DIR=/var/backups/nexso   # NOT inside the app directory — see §5
BACKUP_RETAIN=14                # keep the newest 14 dumps
```

---

## 1. Testing in production

Do this **before** any real society is onboarded.

```bash
npm run db:backup -- --label pre-prod-test     # baseline you can always return to
```

Then run your tests through the UI. Give every test society an obvious,
greppable code so cleanup is unambiguous later:

> Use codes like `TEST1`, `TEST2`, `DEMO`. **Never** reuse a code you intend to
> use for a real society.

Test data that is *not* attached to a society also accumulates and must be
cleared separately (see `--purge-global`):

- `whatsapp_messages`, `whatsapp_outbound_messages`, `whatsapp_sessions`
- `otp_tokens`
- `users` rows orphaned when their society is deleted (`society_id` is
  `ON DELETE SET NULL`, not `CASCADE`)

Also delete test **vendors** by hand — vendors are global, not per-society, so
no society deletion will remove them.

---

## 2. Cleanup

```bash
cd backend

# 1. See exactly what exists
npm run db:cleanup -- --list

# 2. Back up first. Always.
npm run db:backup -- --label pre-cleanup

# 3. Dry run — this is the DEFAULT, nothing is deleted
npm run db:cleanup -- --society TEST1,DEMO --purge-global

# 4. Read the row counts. If they look right, apply.
npm run db:cleanup -- --society TEST1,DEMO --purge-global --apply
```

Safety properties, all verified:

- **Dry run is the default.** `--apply` is required to change anything.
- **A typo aborts everything.** If any code doesn't match a society, nothing is
  deleted — you get an error listing the unmatched entries.
- **One transaction.** Any failure rolls the whole thing back.
- **Post-delete audit.** It re-checks for rows still pointing at the deleted
  societies and exits non-zero if it finds any.
- **Never drops tables**, so schema objects and foreign keys survive intact.

### Do NOT use `reset-db.js` for this

`reset-db.js` drops *every table* and rebuilds from scratch. It's a dev tool. It
now refuses to run when `NODE_ENV=production`.

> It was also silently broken until now: its hand-written drop list had drifted
> seven tables behind the schema, so `outbound_broadcasts`, `society_events`,
> `event_rsvps`, `polls`, `poll_votes`, `society_expenses` and
> `society_other_income` survived the "wipe" with their rows intact **while
> `CASCADE` removed their foreign keys**. Because `societies.id` restarts at 1,
> those orphans would silently re-attach to your first real society. It now
> enumerates tables from `pg_tables` instead.

---

## 3. Go live

```bash
# 1. Verified snapshot of the clean state
npm run db:backup -- --label golive-clean

# 2. Rehearse the restore — a backup you have never restored is a guess
npm run db:restore -- --file nexso-golive-clean-<stamp>.dump --into nexso_restore_test
# expect: "✓ All row counts match"

# 3. Drop the rehearsal DB
psql -c 'DROP DATABASE nexso_restore_test;'
```

Pre-flight, from the earlier review:

- [ ] `JWT_SECRET` set to a real 32+ char value (server refuses to boot without it when `NODE_ENV=production`)
- [ ] `NODE_ENV=production` actually set on the backend host — **without it the secret check never runs**
- [ ] `WHATSAPP_APP_SECRET` set, or webhooks are unauthenticated
- [ ] `VITE_API_BASE` set in Vercel **before** the build, or the bundle ships pointing at localhost
- [ ] `TRUST_PROXY=true` if behind a proxy, or rate limiting collapses to one bucket
- [ ] `BACKEND_PUBLIC_URL` set, or pay links and bill PDFs can't be generated
- [ ] `CORS_ORIGIN` locked to the frontend domain

---

## 4. Recovery

### Something's wrong, roll back

```bash
# ALWAYS snapshot the broken state first — you may need it to diagnose
npm run db:backup -- --label incident-$(date +%s)

# Rehearse into a scratch DB and confirm the data is what you expect
npm run db:restore -- --file <good-backup>.dump --into nexso_verify
psql -d nexso_verify -c 'SELECT count(*) FROM residents;'

# Only then, restore over live
npm run db:restore -- --file <good-backup>.dump --target-url "$DATABASE_URL" --confirm
```

`--confirm` is mandatory for the destructive path. The restore verifies every
table's row count against the dump's manifest and exits non-zero on mismatch —
so a partial restore fails loudly instead of looking successful.

### Accidental deletion of one society

Restore the backup `--into` a scratch database, then copy just that society's
rows across. Don't restore over live — you'd lose everything written since.

---

## 5. Scheduled backups

Filesystems on PaaS hosts are **ephemeral** — a redeploy wipes them. A backup
stored next to the app is not a backup.

**Best option:** use your provider's managed Postgres with point-in-time
recovery (Neon, Supabase, RDS, Railway all offer it). That covers the "restore
to 10 minutes ago" case these scripts cannot.

**In addition**, a nightly logical dump pushed off-box:

```cron
0 2 * * *  cd /app/backend && BACKUP_DIR=/var/backups/nexso npm run db:backup -- --label nightly >> /var/log/nexso-backup.log 2>&1
```

Then sync `/var/backups/nexso` to object storage (S3/R2/B2) — the dump is
useless if it dies with the server.

**Monthly:** actually restore last night's backup into a scratch DB. An
unrehearsed backup strategy fails exactly when you need it.

---

## 6. Known gaps

| Gap | Impact | Suggested |
|---|---|---|
| No migration system | `ensureSchema()` is additive-only; it can't rename or drop a column | Adopt `node-pg-migrate` before the schema needs to change under real data |
| `bills/` on ephemeral disk | WhatsApp bill-PDF links 404 after a redeploy | Move to object storage, or regenerate on demand |
| No PITR from these scripts | Can only restore to the last dump | Use managed Postgres PITR |
| Backups unencrypted | Dumps contain resident PII and phone numbers | `gpg`/`age` encrypt before off-box sync |
