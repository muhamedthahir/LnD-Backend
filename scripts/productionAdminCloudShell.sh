#!/bin/bash
# Run in AWS CloudShell while signed in as admin to account 966273136559.
# Production API: https://api.campuszen.in
# EB environment: Backend-env (application: backend)

set -euo pipefail

REGION="ap-south-1"
APP="backend"
ENV="Backend-env"

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
