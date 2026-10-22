/** Validate the declared lockfile and npm's installed tree without installing anything. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')) as {
  packages: Record<string, Record<string, unknown>>;
};
const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
for (const directory of [
  '',
  ...['apps', 'packages'].flatMap((parent) =>
    fs
      .readdirSync(path.join(root, parent))
      .filter((name) => fs.existsSync(path.join(root, parent, name, 'package.json')))
      .map((name) => `${parent}/${name}`),
  ),
]) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, directory, 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
  for (const section of sections) {
    const canonical = (value: unknown) =>
      JSON.stringify(Object.entries((value ?? {}) as Record<string, unknown>).sort());
    if (canonical(manifest[section]) !== canonical(lock.packages[directory]?.[section])) {
      throw new Error(
        `${directory || '.'}/package.json ${section} differs from package-lock.json. Update the owning workspace and commit both files.`,
      );
    }
  }
}
const npmCli = process.env['npm_execpath'];
const result = npmCli
  ? spawnSync(process.execPath, [npmCli, 'ls', '--all', '--json'], { cwd: root, encoding: 'utf8' })
  : spawnSync('npm', ['ls', '--all', '--json'], {
      cwd: root,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
if (result.error || result.status !== 0) {
  process.stderr.write(
    result.stderr || result.error?.message || 'npm could not validate the installed tree.\n',
  );
  process.stderr.write(
    'Stop this checkout’s dev stack, run npm ci in this checkout, then restart. Never share node_modules between worktrees or operating systems.\n',
  );
  process.exit(1);
}
console.log(
  'Workspace manifests match the lockfile; npm reports a complete installed dependency tree.',
);
