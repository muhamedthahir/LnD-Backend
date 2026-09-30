/**
 * Grant s3:PutObject to s3-accessor-campuszen on bucket skillvantix.
 * Requires IAM admin credentials for AWS account 966273136559.
 *
 * Usage:
 *   $env:ADMIN_AWS_ACCESS_KEY_ID='AKIA...'
 *   $env:ADMIN_AWS_SECRET_ACCESS_KEY='...'
 *   npm run grant-s3-upload-access
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ override: true });

const APP_AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const APP_AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const TARGET_ACCOUNT = '966273136559';
const IAM_USER = 's3-accessor-campuszen';
const POLICY_NAME = 'SkillvantixUploadAccess';
const BUCKET = process.env.S3_BUCKET_NAME || 'skillvantix';
const REGION = process.env.AWS_REGION || 'ap-south-1';

const POLICY_DOCUMENT = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'SkillvantixObjectAccess',
      Effect: 'Allow',
      Action: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
      Resource: `arn:aws:s3:::${BUCKET}/*`
    },
    {
      Sid: 'SkillvantixListBucket',
      Effect: 'Allow',
      Action: 's3:ListBucket',
      Resource: `arn:aws:s3:::${BUCKET}`
    }
  ]
};

function adminEnv() {
  const accessKeyId = process.env.ADMIN_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.ADMIN_AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Set ADMIN_AWS_ACCESS_KEY_ID and ADMIN_AWS_SECRET_ACCESS_KEY to an IAM admin user in account 966273136559.'
    );
  }

  return {
    ...process.env,
    AWS_ACCESS_KEY_ID: accessKeyId,
    AWS_SECRET_ACCESS_KEY: secretAccessKey,
    AWS_DEFAULT_REGION: REGION,
    AWS_REGION: REGION
  };
}

function awsCli(args, env) {
  return execFileSync('aws', args, {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function verifyUpload() {
  process.env.AWS_ACCESS_KEY_ID = APP_AWS_ACCESS_KEY_ID;
  process.env.AWS_SECRET_ACCESS_KEY = APP_AWS_SECRET_ACCESS_KEY;

  const svc = require('../services/s3Service');
  const key = `debug/grant-access-verify-${Date.now()}.txt`;
  const contentType = 'text/plain';
  const result = await svc.generatePresignedUploadUrl(key, contentType, 300);
  const response = await fetch(result.presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: 'grant-access-ok'
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Upload verify failed (${response.status}): ${body.slice(0, 500)}`);
  }

  await svc.deleteFile(key);
  console.log('Upload verification succeeded.');
}

async function main() {
  const env = adminEnv();
  const identity = JSON.parse(awsCli(['sts', 'get-caller-identity', '--output', 'json'], env));

  console.log('Admin identity:', identity.Arn);
  console.log('Target account:', TARGET_ACCOUNT);
  console.log('IAM user:', IAM_USER);
  console.log('Bucket:', BUCKET);

  if (identity.Account !== TARGET_ACCOUNT) {
    throw new Error(
      `Admin credentials are for account ${identity.Account}, expected ${TARGET_ACCOUNT}.`
    );
  }

  if (String(identity.Arn).includes(`user/${IAM_USER}`)) {
    throw new Error(
      `${IAM_USER} cannot grant permissions to itself. Use an IAM admin access key.`
    );
  }

  const policyFile = path.join(os.tmpdir(), `skillvantix-upload-policy-${Date.now()}.json`);
  fs.writeFileSync(policyFile, JSON.stringify(POLICY_DOCUMENT));

  try {
    awsCli(
      [
        'iam',
        'put-user-policy',
        '--user-name',
        IAM_USER,
        '--policy-name',
        POLICY_NAME,
        '--policy-document',
        `file://${policyFile.replace(/\\/g, '/')}`
      ],
      env
    );

    const policy = JSON.parse(
      awsCli(
        ['iam', 'get-user-policy', '--user-name', IAM_USER, '--policy-name', POLICY_NAME, '--output', 'json'],
        env
      )
    );

    console.log(`Attached inline policy "${POLICY_NAME}" to ${IAM_USER}.`);
    console.log('Policy document:', decodeURIComponent(policy.PolicyDocument));
  } finally {
    fs.unlinkSync(policyFile);
  }

  await verifyUpload();
  console.log('Done. S3 presigned uploads should work with your app credentials.');
}

main().catch((error) => {
  const stderr = error.stderr ? String(error.stderr) : '';
  console.error('\nFailed:', error.message);
  if (stderr) console.error(stderr.trim());

  console.error(`
Run this in AWS CloudShell (account ${TARGET_ACCOUNT}) while signed in as admin:

aws iam put-user-policy \\
  --user-name ${IAM_USER} \\
  --policy-name ${POLICY_NAME} \\
  --policy-document '${JSON.stringify(POLICY_DOCUMENT)}'
`);
  process.exit(1);
});
