# Spreadsheet bulk upload transport

Updated October 13, 2026.

MCQ, programming-question and test-case workbooks now upload directly to the existing S3 bucket. The API receives a small signed ticket instead of a multipart workbook, avoiding the CloudFront WAF body-size rejection reported as a browser CORS error. Student imports retain their existing small JSON batches and durable job processing.

`POST /api/questions/bulk-upload/file` requires the same authenticated admin roles as question import. It validates the file extension, size (up to 10 MB), and import purpose, then issues a ten-minute S3 PUT URL and a fifteen-minute ticket. The ticket binds the object key, byte length, admin account, purpose, and expiry. Import controllers verify the ticket, read at most the signed byte count, and delete the temporary object after retrieval. Existing multipart clients remain compatible. Workbook parsing and row validation are unchanged.

Validation: 66 backend tests pass, including signature tampering, wrong account/purpose, expiry, size bounds, cleanup and legacy multipart support. The production S3 OPTIONS request returned HTTP 200 and allowed PUT from `https://practice.campuszen.in` with `content-type`. No AWS configuration was changed. UI import tests use a synthetic workbook and mocked responses; no production questions or test cases were created during QA.

A live storage-only integration check uploaded a synthetic 16,001-byte XLSX object with the new presigned URL, read matching bytes through the signed ticket, and verified deletion afterward (PUT 200). It did not create production database records.
