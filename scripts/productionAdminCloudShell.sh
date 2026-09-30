#!/bin/bash
# Run in AWS CloudShell while signed in as admin to account 966273136559.
# Production API: https://api.campuszen.in
# EB environment: Backend-env (application: backend)

set -euo pipefail

REGION="ap-south-1"
APP="backend"
ENV="Backend-env"

echo "==> Updating Piston URL for code execution..."
aws elasticbeanstalk update-environment \
  --environment-name "$ENV" \
  --region "$REGION" \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=PISTON_URL,Value=http://13.202.132.234 \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=PISTON_PORT,Value=2000

echo "==> Updating SES email environment variables..."
aws elasticbeanstalk update-environment \
  --environment-name "$ENV" \
  --region "$REGION" \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=AWS_SES_REGION,Value=ap-south-1 \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=SES_DEFAULT_FROM,Value=noreply@campuszen.in \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=PLATFORM_NAME,Value=CampusZen \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=FRONTEND_URL,Value=https://practice.campuszen.in

echo "==> Restarting Elastic Beanstalk app servers..."
aws elasticbeanstalk restart-app-server \
  --environment-name "$ENV" \
  --region "$REGION"

echo "==> Current S3/AWS environment options..."
aws elasticbeanstalk describe-configuration-settings \
  --application-name "$APP" \
  --environment-name "$ENV" \
  --region "$REGION" \
  --query "ConfigurationSettings[0].OptionSettings[?contains(Namespace, 'application:environment') && (OptionName=='AWS_ACCESS_KEY_ID' || OptionName=='AWS_REGION' || OptionName=='S3_BUCKET_NAME' || OptionName=='USE_SSL' || OptionName=='SSL_CA_PATH')].[OptionName,Value]" \
  --output table

echo "==> Environment health..."
aws elasticbeanstalk describe-environments \
  --environment-names "$ENV" \
  --region "$REGION" \
  --query "Environments[0].[EnvironmentName,Status,Health,HealthStatus,CNAME]" \
  --output table

echo "Done. Verify: curl https://api.campuszen.in/health"
