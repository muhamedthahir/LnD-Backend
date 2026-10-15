# Performance and group password resets

## Group reset

In **Users → Bulk reset passwords**, search for a group, select it, enter and confirm the new password, and submit. The modal shows the affected member count and the API returns the number actually updated. Passwords are kept only in component memory and the request body; they are not returned, logged, emailed, or persisted in browser storage.

- `GET /api/admin/users/bulk-reset/groups?search=&limit=50&offset=0` supplies a paginated, institution-scoped picker.
- `POST /api/admin/users/bulk-reset-password` accepts `{ "groupId": 123, "password": "admin-selected-value" }`.
- Primary and CampusZen admins can manage all groups. College admins can manage only their own institution's groups and students; an unassigned college admin is rejected.
- Groups contain students. A group containing a privileged account or an out-of-scope member is rejected in full, without partially resetting its members.
- A transaction locks the group and its current members, resets the password, marks accounts activated, clears OTP/reset codes, and revokes stored refresh tokens. Updates use batches of at most 500 users and one bcrypt hash for the shared password. A failed update or token revocation rolls back the entire reset.
- Existing access JWTs remain valid until their configured expiry; this feature revokes refresh tokens, not already-issued access JWTs. The member set is resolved at submission time, so the final count may differ from a previously loaded picker count.
- Password rules match the existing six-character minimum and additionally reject more than 72 UTF-8 bytes to avoid bcrypt truncation.

## Query improvements

## Bulk student upload fix

AWS WAF sampled requests confirmed that `AWSManagedRulesCommonRuleSet/SizeRestrictions_BODY` blocked the upload POSTs on September 30 at 04:38:58, 04:40:10, and 04:47:47 UTC. These requests never reached Express, and WAF returned an HTML 403 that the old frontend could not parse as JSON.

The Users page now reads the Excel workbook locally and sends authenticated JSON batches no larger than 7,000 UTF-8 bytes. The existing WAF rule remains enabled. The backend validates and accumulates the batches; it queues the import only after receiving every row. Duplicate acknowledged batches do not add students twice. The upload supports 5,000 students and 10 MB per workbook and gives readable spreadsheet/HTTP errors.

Accepted jobs use a new `bulk_student_uploads` table created by the application. A background worker creates students and records each row's progress in the same transaction, then sends the invitation. It resumes after a restart, uses a database advisory lock across instances, and reports duplicate/invalid rows and invitation warnings. Repeated department/degree values are resolved once per workbook. Incomplete transfers expire after a day; completed/failed jobs discard the workbook payload. Pending invitations can be retried after a crash, so delivery is at least once. Progress is limited to the submitting admin and institution. The browser persists only the opaque job ID in session storage and resumes polling after a refresh.

`GET /api/admin/users/bulk/uploads/:jobId` returns progress. The existing upload endpoint accepts `{ college_name, total, offset, rows, jobId? }` batches and returns HTTP 202. Its legacy multipart form remains supported but large multipart requests may still be rejected by WAF; the updated Users page uses the batch protocol.

## Query improvements

- Question lists: two page/count reads plus one bulk tag read instead of a tag query per question; unused joins removed from the count query.
- User lists: independent count/page reads run concurrently, pagination has a stable tie-breaker, obsolete frontend requests are cancelled, and edit-form catalogs load on demand.
- Administration lists: removed the double enrollment join that multiplied N members into N×N intermediate rows. Counts and institution checks use independent indexed subqueries. Dashboard summaries no longer request an unused total count or join all enrollments for global status counts.
- Group name filtering runs in SQL, before results are transferred; member counts no longer require grouping wide joined rows.
- Password and assessment schema compatibility checks share one promise per process and schema definition. Existing columns no longer generate repeated failing `ALTER TABLE` statements. Real schema errors propagate and are retryable.
- Earlier course-progress bulk reads and concurrent course/segment reads remain included in the working tree.

## Database indexes

Run from `LnD-Backend` with the intended database environment:

```sh
npm run db:performance
```

This read-only audit reports covered, missing, and unavailable indexes for user/group lists, questions, course progress, enrollments, and assessments. It checks existing index prefixes to avoid duplicate indexes. Review the plan and workload before applying:

```sh
npm run db:performance -- --apply
```

Application uses `ALGORITHM=INPLACE, LOCK=NONE` and a five-second metadata-lock wait limit; it fails instead of falling back to a blocking table-copy operation. Each DDL statement commits independently, so a partial index run should be rerun rather than assumed rolled back. Existing installations need the reset-token columns from `database/migrations/add_user_reset_password_columns.sql`; the cached compatibility check can add missing columns if the app database user has ALTER permission.

The RDS audit could not connect from this workstation (ETIMEDOUT on September 30, 2026). No live index DDL or real password reset was performed. Live query plans and latency improvements still need measurement from a host with database access; unit query counts are not a substitute for production timing.

## Validation

```sh
# Backend
npm test
# Frontend
npm test
npm run build
```

Backend tests exercise scope restrictions, invalid passwords, empty groups, rollback, 1,201-member batching, constant query counts, and concurrent schema checks. The frontend tests cover password validation and configuration loading. With the Vite dev server running, `/scripts/bulk-reset-preview.html` provides a synthetic UI fixture for success, empty groups, permissions errors, search, and pagination without touching real users. Vite's production entry does not include the fixture.
