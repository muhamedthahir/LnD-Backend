-- Remove duplicate enrollments: same (student_id, administration_id) should appear only once.
-- 1) Delete Expired enrollments when the same pair has a non-Expired row (keep the active one).
-- 2) For pairs with only Expired rows, keep one and delete the rest.

-- Step 1: Delete Expired rows where another row exists for same (student_id, administration_id) that is not Expired
DELETE e FROM enrollments e
WHERE e.administration_id IS NOT NULL
  AND e.status = 'Expired'
  AND EXISTS (
    SELECT 1 FROM enrollments e2
    WHERE e2.student_id = e.student_id
      AND e2.administration_id = e.administration_id
      AND e2.status != 'Expired'
  );

-- Step 2: For (student_id, administration_id) with multiple Expired rows only, keep one (min id) and delete the rest
DELETE e FROM enrollments e
INNER JOIN (
  SELECT student_id, administration_id, MIN(id) AS keep_id
  FROM enrollments
  WHERE administration_id IS NOT NULL AND status = 'Expired'
  GROUP BY student_id, administration_id
  HAVING COUNT(*) > 1
) dup ON e.student_id = dup.student_id AND e.administration_id = dup.administration_id
WHERE e.administration_id IS NOT NULL AND e.status = 'Expired' AND e.id != dup.keep_id;
