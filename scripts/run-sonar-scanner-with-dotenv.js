const cp = require('child_process');

try { process.loadEnvFile(); }
catch (err) { if (err.code !== 'ENOENT') throw err; }

const result = cp.spawnSync('npx sonarqube-scanner', {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
