const { spawnSync } = require('node:child_process');
const path = require('node:path');

const args = process.argv.slice(2);
let cwd = process.cwd();
const cleaned = [];

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--cwd') {
    const next = args[i + 1];
    if (!next) {
      process.stderr.write('Missing value for --cwd\n');
      process.exit(1);
    }
    cwd = path.resolve(process.cwd(), next);
    i += 1;
    continue;
  }
  cleaned.push(args[i]);
}

if (cleaned.length === 0) {
  process.stderr.write('Usage: node scripts/run-gradle-wrapper.js [--cwd <dir>] <gradle-args...>\n');
  process.exit(1);
}

const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const result = spawnSync(wrapper, cleaned, {
  cwd,
  stdio: 'inherit',
  shell: true
});

process.exit(result.status ?? 1);
