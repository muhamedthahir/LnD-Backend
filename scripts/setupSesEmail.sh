#!/bin/bash
# AWS SES setup for CampusZen production (account 966273136559, region ap-south-1)
# Run in AWS CloudShell or locally with AWS CLI configured as admin.
#
# Prerequisites you must confirm in AWS Console:
# 1. Verify sender email or domain in SES (ap-south-1)
# 2. Attach config/ses-iam-policy.json to IAM user used by EB (s3-accessor-campuszen)
# 3. If SES is in sandbox, verify recipient emails or request production access
#
# Usage:
#   bash scripts/setupSesEmail.sh verify-sender noreply@campuszen.in
#   bash scripts/setupSesEmail.sh update-eb-env
#   bash scripts/setupSesEmail.sh status

set -euo pipefail

REGION="${AWS_SES_REGION:-ap-south-1}"
APP="backend"
ENV="Backend-env"
FROM_EMAIL="${SES_DEFAULT_FROM:-noreply@campuszen.in}"
FRONTEND_URL="${FRONTEND_URL:-https://practice.campuszen.in}"
PLATFORM_NAME="${PLATFORM_NAME:-CampusZen}"

cmd="${1:-status}"

case "$cmd" in
  verify-sender)
    EMAIL="${2:-$FROM_EMAIL}"
    echo "==> Requesting SES verification email for: $EMAIL (region: $REGION)"
    aws ses verify-email-identity --email-address "$EMAIL" --region "$REGION"
    echo "Check the inbox for $EMAIL and click the verification link."
    ;;

  verify-domain)
    DOMAIN="${2:-campuszen.in}"
    echo "==> Requesting SES domain verification for: $DOMAIN (region: $REGION)"
    aws ses verify-domain-identity --domain "$DOMAIN" --region "$REGION"
    echo "Add the returned TXT record to your DNS, then wait for verification."
    ;;

  update-eb-env)
    echo "==> Updating Elastic Beanstalk SES environment variables..."
    aws elasticbeanstalk update-environment \
      --environment-name "$ENV" \
      --region "$REGION" \
      --option-settings \
        Namespace=aws:elasticbeanstalk:application:environment,OptionName=AWS_SES_REGION,Value="$REGION" \
        Namespace=aws:elasticbeanstalk:application:environment,OptionName=SES_DEFAULT_FROM,Value="$FROM_EMAIL" \
        Namespace=aws:elasticbeanstalk:application:environment,OptionName=PLATFORM_NAME,Value="$PLATFORM_NAME" \
        Namespace=aws:elasticbeanstalk:application:environment,OptionName=FRONTEND_URL,Value="$FRONTEND_URL"

    echo "==> Restarting app servers..."
    aws elasticbeanstalk restart-app-server \
      --environment-name "$ENV" \
      --region "$REGION"
    ;;

  status)
    echo "==> SES identities in $REGION"
    aws ses list-identities --region "$REGION" --output table || true
    echo ""
    echo "==> EB email-related env vars"
    aws elasticbeanstalk describe-configuration-settings \
      --application-name "$APP" \
      --environment-name "$ENV" \
      --region "$REGION" \
      --query "ConfigurationSettings[0].OptionSettings[?contains(Namespace, 'application:environment') && (OptionName=='AWS_SES_REGION' || OptionName=='SES_DEFAULT_FROM' || OptionName=='PLATFORM_NAME' || OptionName=='FRONTEND_URL')].[OptionName,Value]" \
      --output table || true
    echo ""
    echo "Verify API: curl https://api.campuszen.in/health/email"
    ;;

  *)
    echo "Usage: $0 {verify-sender|verify-domain|update-eb-env|status}"
    exit 1
    ;;
esac

echo "Done."
