// Local diagnostic helper; never print credentials loaded from the backend environment.
const fs = require('node:fs');
const { spawnSync, execFile } = require('node:child_process');
const dotenv = require('dotenv');
const config = dotenv.parse(fs.readFileSync(require('node:path').join(__dirname, '../.env')));
const env = { ...process.env };
for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION']) {
  if (config[key]) env[key] = config[key];
  else if (key === 'AWS_SESSION_TOKEN') delete env[key];
}
if (process.argv[2] === '--find-backend') {
  const regions = ['us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ca-central-1', 'sa-east-1'];
  Promise.all(regions.map(region => new Promise(resolve => {
    execFile('aws', ['elasticbeanstalk', 'describe-environments', '--region', region, '--query', 'Environments[].{Name:EnvironmentName,Status:Status,Health:Health,Version:VersionLabel}', '--output', 'json'], { env, encoding: 'utf8', windowsHide: true, timeout: 30000 }, (error, stdout) => {
      if (!error && stdout.trim() !== '[]') console.log(region, stdout);
      resolve();
    });
  }))).then(() => console.log('Region discovery complete.'));
} else {
  const result = spawnSync('aws', process.argv.slice(2), { env, encoding: 'utf8', windowsHide: true });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  process.exitCode = result.status ?? 1;
}
