# Backend optimization — October 12, 2026

The repository-wide review builds on the committed course, question, user, administration, progress, and bulk-import optimizations. This pass changes read paths and compatibility checks while preserving response shapes, scoring, member ordering, and institution filters.

| Path | Previous cost | Change |
| --- | --- | --- |
| Question banks | Count + page + one tag read per bank | Concurrent page/count + one tag read for the whole page; at most three reads |
| Practice MCQs | One question read + one option read per question | One question read + one option read for the whole segment; retains correctness flags and option order |
| Assessment detail | Three detail/question reads per segment after the segment list | Four total reads for nonempty assessments; scores and per-segment question order preserved |
| Administration progress export | Two question reads per practice segment | Two total question reads; retains supplied segment order and programming-before-MCQ order |
| Assessments and configurations | Sequential page/count; counts join display tables | Concurrent page/count; counts keep only joins needed for filters |
| Mail status, mailer templates, institutions | Sequential count/page; some counts include sorting | Concurrent reads; bounded numeric pagination and deterministic ID tie-breakers; no count sorting |
| Programming/MCQ submission compatibility | Repeated status/nullability/index ALTERs per submission | One shared, retryable metadata check per table/process; ready schemas run zero ALTERs |
| Institution compatibility | Failing ALTER attempts and races, errors marked ready | Shared column inspection; only missing columns migrate; real failures propagate and retry |
| Proctoring updates | Repeated ALTER for allow_segment_switch | Shared column check |

## Database verification

The configured database was reachable on October 12. The online index script added 23 missing indexes with `ALGORITHM=INPLACE, LOCK=NONE` and a five-second metadata lock wait. The follow-up audit verified 31 covered index patterns. The institution-status candidate was skipped because its required table/column was unavailable. No table copies, student imports, password resets, or data deletions were performed by the index audit.

`node scripts/performanceIndexes.js` is the read-only index verification. `node scripts/performanceQueryPlans.cjs` prints EXPLAIN metadata without student records. These results concern the database configured in this checkout; do not infer that a separate deployment database was migrated. Query-count reductions and chosen indexes do not establish a production latency percentage.

## Validation

`npm test` passes all 62 tests after the final code changes. Coverage includes existing behavior plus constant query counts, concurrent page/count reads, tag/option grouping, export ordering, migration sharing, and retry after a failed schema check. Syntax and diff checks pass. Read-only EXPLAIN results select the report, assessment-list, and mail-status indexes; the practice-option plan still sorts its small selected result.

## Remaining operational work

Measure real endpoint latency and pool pressure under a representative workload before declaring the whole backend performance-complete. Scoring, enrollment mutations, invitation sending, and assessment duplication contain ordered writes; replacing these indiscriminately with parallel work can change correctness or overwhelm the pool. Export memory and long-running external execution need representative-load measurements. Automated code inspection is not an execution profile.

The student importer already avoids the confirmed WAF size restriction with small JSON batches and durable background jobs. Programming-question and test-case multipart import still need the same upload-boundary review: changing Express CORS cannot fix a WAF response generated before Express. The UI rebuild must retain import progress and error handling and include these upload flows in integration acceptance.
