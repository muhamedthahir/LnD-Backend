"""Read-only AWS diagnostics. Output only upload timings and known error signals."""
import collections
import json
import re
import subprocess
import time
import urllib.request
import io
import zipfile


def aws(*args):
    output = subprocess.check_output(['aws', *args, '--output', 'json'], text=True)
    return json.loads(output) if output.strip() else {}


distributions = aws('cloudfront', 'list-distributions').get('DistributionList', {}).get('Items', [])
for distribution in distributions:
    if distribution['DomainName'] != 'd3hxnknkhl8llf.cloudfront.net':
        continue
    config = aws('cloudfront', 'get-distribution-config', '--id', distribution['Id'])['DistributionConfig']
    def behavior(value):
        return {key: value.get(key) for key in ['PathPattern', 'AllowedMethods', 'CachePolicyId', 'OriginRequestPolicyId', 'TargetOriginId']}
    print('API CloudFront:', {'Id': distribution['Id'], 'WebACLId': config.get('WebACLId'), 'Origins': [{'Id': origin['Id'], 'DomainName': origin['DomainName'], 'CustomOriginConfig': origin.get('CustomOriginConfig')} for origin in config['Origins']['Items']], 'DefaultCacheBehavior': behavior(config['DefaultCacheBehavior']), 'CacheBehaviors': [behavior(value) for value in config.get('CacheBehaviors', {}).get('Items', [])]})
    acl_id = config.get('WebACLId')
    if acl_id and ':wafv2:' in acl_id:
        name, identifier = acl_id.rsplit('/', 2)[-2:]
        acl = aws('wafv2', 'get-web-acl', '--name', name, '--id', identifier, '--scope', 'CLOUDFRONT', '--region', 'us-east-1')['WebACL']
        print('API WAF rules:', [{'Name': rule['Name'], 'Priority': rule['Priority'], 'Action': rule.get('Action'), 'ManagedRuleGroup': rule['Statement'].get('ManagedRuleGroupStatement')} for rule in acl['Rules']])
        try:
            logging = aws('wafv2', 'get-logging-configuration', '--resource-arn', acl_id, '--region', 'us-east-1')
            print('WAF log destinations:', logging.get('LoggingConfiguration', {}).get('LogDestinationConfigs'))
        except subprocess.CalledProcessError:
            print('WAF logging configuration unavailable')
environments = aws('elasticbeanstalk', 'describe-environments', '--environment-names', 'Backend-env')
print('Backend environments:', [{key: env.get(key) for key in ['EnvironmentName', 'Status', 'Health', 'VersionLabel']} for env in environments['Environments']])
aws('elasticbeanstalk', 'request-environment-info', '--environment-name', 'Backend-env', '--info-type', 'bundle')
time.sleep(20)
info = aws('elasticbeanstalk', 'retrieve-environment-info', '--environment-name', 'Backend-env', '--info-type', 'bundle')
signals = collections.Counter()
patterns = [r'ER_[A-Z_]+', r'Unknown column [\x27\x22][a-zA-Z0-9_.]+[\x27\x22]', r'Column [\x27\x22][a-zA-Z0-9_.]+[\x27\x22] cannot be null', r'upstream timed out', r'client intended to send too large body', r'(?:Type|Syntax|Multer|Reference)Error', r'AccessDenied', r'MessageRejected', r'Throttling', r'Upload bulk users error', r'failed to parse', r'ECONNRESET', r'ETIMEDOUT']
for entry in info['EnvironmentInfo']:
    with urllib.request.urlopen(entry['Message'], timeout=30) as response:
        archive = zipfile.ZipFile(io.BytesIO(response.read()))
        content = '\n'.join(archive.read(name).decode('utf-8', errors='replace') for name in archive.namelist() if ('nginx' in name or 'web.stdout' in name) and not name.endswith('/') and not name.endswith('.gz'))
    for line in content.splitlines():
        found = [match.group(0) for pattern in patterns for match in re.finditer(pattern, line, re.I)]
        for signal in found:
            signals[signal] += 1
        if '/api/admin/users/bulk/upload' in line:
            method_status = re.search(r'"(POST|OPTIONS) /api/admin/users/bulk/upload[^\"]*"\s+(\d{3})\s+(\d+)', line)
            timestamp = re.search(r'\[([^\]]+)\]', line)
            timing = re.findall(r'(?:rt|urt|request_time|upstream_response_time)[=:]([\d.]+)', line)
            print('Upload request:', {'time': timestamp.group(1) if timestamp else None, 'method_status_bytes': method_status.groups() if method_status else None, 'timing': timing, 'signals': found})
print('Error signals:', dict(signals))
print('No raw logs, credentials, OTPs, student names, or email addresses are printed.')
