# AWS S3 Configuration Guide

This guide explains how to configure AWS S3 for file storage in the Learning & Development application.

## Overview

The application uses AWS S3 to store and serve course materials including:
- Video files
- Audio files
- Documents (PDF, Word, Excel, PowerPoint)
- Images and other media files

## Prerequisites

- An AWS account (sign up at https://aws.amazon.com/)
- AWS CLI installed (optional, for testing)

## Step 1: Create an S3 Bucket

1. **Log in to AWS Console**
   - Go to https://console.aws.amazon.com/
   - Sign in with your AWS account

2. **Navigate to S3**
   - In the AWS Console, search for "S3" or go to Services → Storage → S3

3. **Create a New Bucket**
   - Click "Create bucket"
   - **Bucket name**: Choose a unique name (e.g., `lnd-course-materials` or `your-app-name-uploads`)
     - Bucket names must be globally unique across all AWS accounts
     - Use lowercase letters, numbers, hyphens, and periods only
     - Must be 3-63 characters long
   - **AWS Region**: Choose a region close to your users (e.g., `us-east-1`, `ap-south-1`)
     - Note: Remember this region for the `AWS_REGION` environment variable
   - **Object Ownership**: Select "ACLs disabled (recommended)"
   - **Block Public Access**: Keep all settings checked for security
   - **Bucket Versioning**: Disable (unless you need versioning)
   - **Encryption**: Enable (recommended)
     - Choose "SSE-S3" (server-side encryption with Amazon S3 managed keys)
   - Click "Create bucket"

## Step 2: Create an IAM User with S3 Permissions

1. **Navigate to IAM**
   - In AWS Console, search for "IAM" or go to Services → Security, Identity, & Compliance → IAM

2. **Create a New User**
   - Click "Users" in the left sidebar
   - Click "Add users"
   - **User name**: Enter a name (e.g., `lnd-s3-user`)
   - **Access type**: Select "Programmatic access" (for API access)
   - Click "Next: Permissions"

3. **Attach Policies**
   - Click "Attach policies directly"
   - Search for and select the following policies:
     - `AmazonS3FullAccess` (for full S3 access) OR
     - Create a custom policy with minimal permissions (see Custom Policy below)
   - Click "Next: Tags" (optional)
   - Click "Next: Review"
   - Click "Create user"

4. **Save Access Keys**
   - **IMPORTANT**: Copy both the **Access Key ID** and **Secret Access Key**
   - You will not be able to see the Secret Access Key again after this step
   - Save them securely (you'll need them for environment variables)

### Custom IAM Policy (Optional - More Secure)

If you prefer minimal permissions, create a custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    }
  ]
}
```

Replace `YOUR_BUCKET_NAME` with your actual bucket name.

### Presigned browser uploads (PUT)

Direct browser uploads use presigned `PutObject` URLs. The IAM user in `AWS_ACCESS_KEY_ID` must allow:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME"
    }
  ]
}
```

If `PutObject` is missing, S3 returns **403 AccessDenied** with XML like:

`User ... is not authorized to perform: s3:PutObject on resource: "arn:aws:s3:::YOUR_BUCKET_NAME/..."`

The backend now logs bucket, region, key, contentType, and a redacted presigned URL when generating upload URLs.

**AWS SDK v3 note:** `@aws-sdk/client-s3` v3.729+ may add checksum query params to presigned PUT URLs. Browser uploads cannot satisfy those checksum headers, which can also cause 403 signature errors. The backend presign client sets `requestChecksumCalculation: 'WHEN_REQUIRED'` to avoid that for browser uploads.

## Step 3: Configure Environment Variables

Add the following environment variables to your `.env` file in the `LnD-Backend` directory:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name-here
```

### Where to Find These Values:

- **AWS_ACCESS_KEY_ID**: From Step 2.4 (the Access Key ID you saved)
- **AWS_SECRET_ACCESS_KEY**: From Step 2.4 (the Secret Access Key you saved)
- **AWS_REGION**: The region you selected when creating the bucket (e.g., `us-east-1`, `ap-south-1`, `eu-west-1`)
- **S3_BUCKET_NAME**: The bucket name you created in Step 1.3

### Example `.env` File:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=lnd_db

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
S3_BUCKET_NAME=lnd-course-materials
```

## Step 4: Verify Configuration

1. **Restart your backend server** after adding environment variables

2. **Check the logs** - You should no longer see:
   - `Error: S3_BUCKET_NAME environment variable is not set`
   - `Error: Resolved credential object is not valid`

3. **Test file upload** - Try uploading a file through the application

## Optional: Using AWS Credentials File

Instead of environment variables, you can use AWS credentials file (useful for local development):

1. **Create credentials file** (if it doesn't exist):
   - Windows: `C:\Users\YourUsername\.aws\credentials`
   - Linux/Mac: `~/.aws/credentials`

2. **Add credentials**:
   ```ini
   [default]
   aws_access_key_id = your_access_key_id_here
   aws_secret_access_key = your_secret_access_key_here
   region = us-east-1
   ```

3. **Update s3Service.js** (optional):
   If you want to use the credentials file, you can modify `getS3Client()` to not require explicit credentials (AWS SDK will automatically use the credentials file):

   ```javascript
   const getS3Client = () => {
     return new S3Client({
       region: process.env.AWS_REGION || 'us-east-1'
       // Credentials will be loaded from ~/.aws/credentials automatically
     });
   };
   ```

   However, you still need `S3_BUCKET_NAME` and `AWS_REGION` environment variables.

## Troubleshooting

### Error: "S3_BUCKET_NAME environment variable is not set"
- **Solution**: Add `S3_BUCKET_NAME` to your `.env` file
- Make sure the backend server is restarted after adding the variable

### Error: "Resolved credential object is not valid"
- **Solution**: Check that `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correctly set
- Make sure there are no extra spaces or quotes around the values
- Verify the credentials in AWS IAM console (you may need to create new keys)

### Error: "Access Denied" when uploading files
- **Solution**: Check IAM user permissions
- Ensure the user has `s3:PutObject` permission for the bucket
- Verify the bucket name matches `S3_BUCKET_NAME` environment variable

### Files upload but can't be accessed
- **Solution**: Check bucket policy and CORS configuration
- Ensure `Block Public Access` settings allow your use case
- For public access, you may need to configure bucket policies

## Security Best Practices

1. **Never commit `.env` file to version control**
   - Add `.env` to `.gitignore`

2. **Use IAM roles** in production (AWS EC2/ECS/Lambda)
   - More secure than access keys
   - No credentials to manage

3. **Rotate access keys regularly**
   - Set reminders to rotate keys every 90 days

4. **Use least privilege principle**
   - Grant only necessary permissions to IAM user

5. **Enable bucket encryption**
   - Use S3-managed encryption or KMS keys

6. **Set up CloudTrail** for audit logging
   - Track all S3 API calls

## Cost Considerations

- **Storage**: Pay for storage used (first 50 GB is typically free for new accounts)
- **Requests**: Pay per request (PUT, GET, DELETE)
- **Data Transfer**: Free within same region, charges apply for cross-region transfer
- **Use S3 Lifecycle Policies** to automatically move old files to cheaper storage classes

## Alternative: Local Development Without S3

If you don't want to use S3 for local development:

1. **Don't set S3 environment variables** - The application will work but file uploads will fail gracefully
2. **Use embedded URLs** for course content instead of file uploads
3. **Consider using local file storage** for development (would require code modifications)

## Next Steps

After configuring S3:

1. Test file upload through the admin interface
2. Verify files appear in your S3 bucket
3. Check that documents/videos can be viewed in the user interface
4. Set up CloudFront (optional) for better performance and CDN capabilities

## Support

For AWS-specific issues:
- AWS Documentation: https://docs.aws.amazon.com/s3/
- AWS Support: https://aws.amazon.com/support/

For application-specific issues:
- Check application logs
- Verify environment variables are loaded correctly
- Test S3 connectivity using AWS CLI: `aws s3 ls s3://your-bucket-name`


