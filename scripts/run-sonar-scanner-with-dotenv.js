const fs = require('fs');
const cp = require('child_process');

const env = { ...process.env };

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    continue;
  }

  const idx = line.indexOf('=');
  if (idx < 0) {
    continue;
  }

  const key = line.slice(0, idx).trim();
  let value = line.slice(idx + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  if (key) {
    env[key] = value;
  }
}

const result = cp.spawnSync('npx sonarqube-scanner', {
  stdio: 'inherit',
  env,
  shell: true,
});

process.exit(result.status ?? 1);
