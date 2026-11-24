#!/usr/bin/env node
// SiloRoot 작업 공간 초기화. /siloroot:init 스킬이 실행한다.
// - 없는 파일만 만든다. 이미 있는 파일은 건드리지 않는다 (CLAUDE.md, CLAUDE.local.md는 표시 블록만, .ignore와 git 제외 목록은 빠진 줄만 더한다).
// - 두 번 실행해도 결과가 같다.
// - 새 폴더는 문서를 모두 .siloroot/ 안에 감싼다(wrapped). 이미 예전 배치(flat)로 초기화된 폴더는 그 배치를 그대로 따른다.
// 실행: node scripts/init.mjs <프로젝트 폴더>  →  표준 출력에 { layout, created, updated, skipped, warnings, notes, port, url } JSON

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig, writeConfig, findFreePort } from '../lib/config.mjs';
import { timeScript } from '../lib/metrics.mjs';
import { applyRefresh } from '../lib/workspace-sync.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(here, '..', 'viewer', 'build.mjs');

export async function initProject(rootArg) {
  const root = path.resolve(rootArg);
  fs.mkdirSync(root, { recursive: true });
  const rel = (full) => path.relative(root, full).split(path.sep).join('/');

  const existing = loadConfig(root);
  const layout = existing ? existing.layout : 'wrapped';
  const { created, updated, skipped, warnings, notes } = applyRefresh(root, { layout });

  let cfg = existing;
  const cfgFile = path.join(root, '.siloroot', 'config.json');
  if (!cfg) {
    writeConfig(root, { port: await findFreePort(), layout });
    cfg = loadConfig(root);
    created.push(rel(cfgFile));
  } else {
    skipped.push(rel(cfgFile));
  }

  execFileSync(process.execPath, [BUILD, root], { stdio: 'ignore', windowsHide: true });
  return { layout, created, updated, skipped, warnings, notes, port: cfg.port, url: 'http://127.0.0.1:' + cfg.port };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const target = process.argv[2] || process.cwd();
  timeScript(target, 'script', 'script:init');
  initProject(target).then(
    (res) => console.log(JSON.stringify(res, null, 2)),
    (e) => { console.error('초기화하지 못했습니다: ' + e.message); process.exit(1); },
  );
}
