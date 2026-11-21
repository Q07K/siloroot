#!/usr/bin/env node
// SiloRoot 작업 공간 초기화. /siloroot:init 스킬이 실행한다.
// - 없는 파일만 만든다. 이미 있는 파일은 건드리지 않는다 (CLAUDE.md는 표시 블록만 넣거나 바꾼다).
// - 두 번 실행해도 결과가 같다.
// 실행: node scripts/init.mjs <프로젝트 폴더>  →  표준 출력에 { created, skipped, port, url } JSON

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig, writeConfig, findFreePort } from '../lib/config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const TPL = path.join(here, '..', 'templates');
const BUILD = path.join(here, '..', 'viewer', 'build.mjs');
const START = '<!-- siloroot:start -->';
const END = '<!-- siloroot:end -->';

// 템플릿 → 프로젝트 안 경로
const FILES = [
  ['metadata-guide.md', 'metadata-guide.md'],
  ['writing-guide.md', 'writing-guide.md'],
  ['01-log/changelog.md', '01-log/changelog.md'],
  ['01-log/open-questions.md', '01-log/open-questions.md'],
  ['02-study/README.md', '02-study/README.md'],
  ['03-ideas/README.md', '03-ideas/README.md'],
  ['04-feedback/README.md', '04-feedback/README.md'],
  ['gitignore', '.gitignore'],
];

function today() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

const readTpl = (rel) => fs.readFileSync(path.join(TPL, rel), 'utf8').replace(/\r\n/g, '\n').split('{{date}}').join(today());

// CLAUDE.md: 없으면 새로, 있으면 표시 블록만 넣거나 바꾼다. 바뀐 것이 없으면 쓰지 않는다.
function ensureClaudeMd(root) {
  const file = path.join(root, 'CLAUDE.md');
  const block = readTpl('CLAUDE.block.md').trimEnd();
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `---\ntype: guide\nstatus: 사용 중\ncreated: ${today()}\n---\n\n# 작업 규칙\n\n${block}\n`);
    return 'created';
  }
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const blockEol = block.split('\n').join(eol);
  const a = raw.indexOf(START), b = raw.indexOf(END);
  let next;
  if (a >= 0 && b > a) next = raw.slice(0, a) + blockEol + raw.slice(b + END.length);
  else next = raw + (raw.endsWith('\n') || raw === '' ? '' : eol) + eol + blockEol + eol;
  if (next === raw) return 'skipped';
  fs.writeFileSync(file, next);
  return 'updated';
}

export async function initProject(rootArg) {
  const root = path.resolve(rootArg);
  fs.mkdirSync(root, { recursive: true });
  const created = [], skipped = [];

  const md = ensureClaudeMd(root);
  (md === 'created' ? created : skipped).push('CLAUDE.md');

  for (const [tpl, dest] of FILES) {
    const full = path.join(root, dest);
    if (fs.existsSync(full)) { skipped.push(dest); continue; }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, readTpl(tpl));
    created.push(dest);
  }

  let cfg = loadConfig(root);
  if (!cfg) {
    writeConfig(root, { port: await findFreePort() });
    cfg = loadConfig(root);
    created.push('.siloroot/config.json');
  } else {
    skipped.push('.siloroot/config.json');
  }

  execFileSync(process.execPath, [BUILD, root], { stdio: 'ignore' });
  return { created, skipped, port: cfg.port, url: 'http://127.0.0.1:' + cfg.port };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const target = process.argv[2] || process.cwd();
  initProject(target).then(
    (res) => console.log(JSON.stringify(res, null, 2)),
    (e) => { console.error('초기화하지 못했습니다: ' + e.message); process.exit(1); },
  );
}
