import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const modelSql = path.join(projectRoot, 'src', 'lib', 'db', 'model.sql');
const standaloneModelSql = path.join(
  standaloneDir,
  'src',
  'lib',
  'db',
  'model.sql',
);

function removePnpmPackages(pattern) {
  const pnpmDir = path.join(standaloneDir, 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpmDir)) {
    return;
  }

  for (const name of fs.readdirSync(pnpmDir)) {
    if (pattern.test(name)) {
      fs.rmSync(path.join(pnpmDir, name), { recursive: true, force: true });
    }
  }
}

if (fs.existsSync(standaloneDir)) {
  for (const name of fs.readdirSync(standaloneDir)) {
    if (name === '.env' || name.startsWith('.env.')) {
      fs.rmSync(path.join(standaloneDir, name), { force: true });
    }
  }

  fs.rmSync(path.join(standaloneDir, 'data'), {
    recursive: true,
    force: true,
  });
  fs.rmSync(path.join(standaloneDir, 'node_modules', 'typescript'), {
    recursive: true,
    force: true,
  });
  removePnpmPackages(/^typescript@/);

  fs.mkdirSync(path.dirname(standaloneModelSql), { recursive: true });
  fs.copyFileSync(modelSql, standaloneModelSql);
}
