import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveControlDir } from '../lib/compat.js';
import { loadManifest, rootPayloadDirs } from '../lib/manifest.js';
import { copyOhPayload, copyRootPayload, assertDestInTarget, type CopyReport } from '../lib/vendor.js';

export { assertDestInTarget };

export interface UpdateIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export interface UpdateOptions {
  targetDir: string;
  fromDir: string;
  force?: boolean;
  dryRun?: boolean;
}

function parseVersion(v: string): [number, number, number] {
  const parts = v.split('.');
  while (parts.length < 3) {
    parts.push('0');
  }
  const seg = (s: string): number => {
    const base = (s ?? '').split(/[-+]/)[0];
    const n = parseInt(base, 10);
    return Number.isNaN(n) ? 0 : n;
  };
  return [seg(parts[0]), seg(parts[1]), seg(parts[2])];
}

function compareVersions(a: string, b: string): number {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (av[i] < bv[i]) return -1;
    if (av[i] > bv[i]) return 1;
  }
  return 0;
}

function readCliVersion(ohDir: string): string {
  const pkgPath = path.resolve(ohDir, 'cli', 'package.json');
  try {
    const parsed = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (parsed && typeof parsed.version === 'string') {
      return parsed.version;
    }
  } catch {
  }
  return '0.0.0';
}

export async function runUpdate(opts: UpdateOptions, io: UpdateIO): Promise<number> {
  const { targetDir, fromDir, force, dryRun } = opts;
  const dryPrefix = dryRun ? '[dry-run] ' : '';

  const source = resolveControlDir(fromDir);
  if (source.kind === 'absent') {
    io.stderr(
      'oh update: update source not found at ' +
        source.agroPath +
        ' or ' +
        source.legacyPath +
        '. Pass --from <built-OpenHarness-checkout> or --from-remote [--ref <ref>].\n',
    );
    return 1;
  }
  const fromOh = source.path;
  const controlName = path.basename(fromOh);

  const target = resolveControlDir(targetDir);
  const targetOh = target.kind === 'absent' ? path.resolve(targetDir, controlName) : target.path;
  const targetName = path.basename(targetOh);

  if (fromOh === targetOh) {
    io.stderr('oh update: source and target are the same ' + targetName + '; nothing to update.\n');
    return 1;
  }

  const available = readCliVersion(fromOh);
  const current = readCliVersion(targetOh);
  const cmp = compareVersions(available, current);

  if (cmp > 0) {
    io.stdout(dryPrefix + 'updating ' + targetName + ': ' + current + ' -> ' + available + '\n');
  } else if (cmp === 0) {
    if (!force) {
      io.stdout(dryPrefix + 'oh update: already up to date (v' + current + ')\n');
      return 0;
    }
    io.stdout(dryPrefix + 'oh update: re-overlay (v' + current + ', --force)\n');
  } else {
    if (!force) {
      io.stderr(
        'oh update: refusing downgrade (current v' +
          current +
          ' > source v' +
          available +
          '); pass --force to override\n',
      );
      return 1;
    }
    io.stdout(
      dryPrefix + 'oh update: downgrading ' + targetName + ': ' + current + ' -> ' + available + ' (--force)\n',
    );
  }

  const manifest = loadManifest(fromOh);
  if (manifest === null) {
    io.stdout(
      dryPrefix +
        'oh update: no ' + controlName + '/manifest.json in source; overlaying all of ' + controlName + '/ (legacy mode)\n',
    );
  }

  let created = 0;
  let overwritten = 0;

  const report: CopyReport = (action, rel) => {
    switch (action) {
      case 'create':
        io.stdout(dryPrefix + 'create ' + rel + '\n');
        created++;
        break;
      case 'overwrite':
        io.stdout(dryPrefix + 'overwrite ' + rel + '\n');
        overwritten++;
        break;
      case 'skip-volatile':
        io.stdout(dryPrefix + 'skip ' + rel + ' (volatile)\n');
        break;
      case 'skip-not-in-payload':
        io.stdout(dryPrefix + 'skip ' + rel + ' (not in payload)\n');
        break;
      case 'skip-exists':
        io.stdout(dryPrefix + 'skip ' + rel + ' (exists)\n');
        break;
    }
  };

  const { skipped } = copyOhPayload(fromOh, targetOh, manifest, { force, dryRun }, report);

  const rootResult = copyRootPayload(
    path.resolve(fromDir),
    path.resolve(targetDir),
    manifest,
    { force, dryRun },
    report,
  );

  for (const dir of rootPayloadDirs(manifest ?? { include: [], exclude: [] })) {
    const stranded = path.join(targetOh, dir);
    if (existsSync(stranded)) {
      io.stdout(
        dryPrefix +
          'oh update: ' +
          path.join(targetName, dir) +
          ' still exists from a pre-move install and is no longer read; move any local edits into ' +
          dir +
          '/ and delete it\n',
      );
    }
  }

  io.stdout(
    dryPrefix +
      'oh update: ' +
      created +
      ' created, ' +
      overwritten +
      ' overwritten, ' +
      (skipped + rootResult.skipped) +
      ' skipped\n',
  );

  return 0;
}
