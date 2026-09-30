"""Read-only AWS diagnostics. Output only upload timings and known error signals."""
import collections
import json
import re
import subprocess
import time
import urllib.request


def aws(*args):
    return json.loads(subprocess.check_output(['aws', *args, '--output', 'json'], text=True))


environments = aws('elasticbeanstalk', 'describe-environments', '--environment-names', 'Backend-env')
print('Backend environments:', [{key: env.get(key) for key in ['EnvironmentName', 'Status', 'Health', 'VersionLabel']} for env in environments['Environments']])
aws('elasticbeanstalk', 'request-environment-info', '--environment-name', 'Backend-env', '--info-type', 'tail')
time.sleep(10)
info = aws('elasticbeanstalk', 'retrieve-environment-info', '--environment-name', 'Backend-env', '--info-type', 'tail')
signals = collections.Counter()
patterns = [r'ER_[A-Z_]+', r'Unknown column [\x27\x22][a-zA-Z0-9_.]+[\x27\x22]', r'Column [\x27\x22][a-zA-Z0-9_.]+[\x27\x22] cannot be null', r'upstream timed out', r'client intended to send too large body', r'(?:Type|Syntax|Multer|Reference)Error', r'AccessDenied', r'MessageRejected', r'Throttling', r'Upload bulk users error', r'failed to parse', r'ECONNRESET', r'ETIMEDOUT']
for entry in info['EnvironmentInfo']:
    with urllib.request.urlopen(entry['Message'], timeout=30) as response:
        content = response.read().decode('utf-8', errors='replace')
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
