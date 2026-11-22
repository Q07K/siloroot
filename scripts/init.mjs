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
  ['05-profile/profile.md', '05-profile/profile.md'],
  ['gitignore', '.gitignore'],
];

// 이미 있으면 덮어쓰지 않지만, 새 버전의 type이나 폴더 규칙이 빠졌는지 보는 안내 파일
const STALE_CHECK = ['metadata-guide.md', '04-feedback/README.md'];

// 표 줄(|로 시작)의 백틱 항목 가운데 템플릿에는 있고 지금 파일에는 없는 것
function missingTableItems(tplText, curText) {
  const items = (t) => new Set(t.split(/\r?\n/).filter((l) => l.trimStart().startsWith('|')).flatMap((l) => [...l.matchAll(/`([^`]+)`/g)].map((m) => m[1])));
  const cur = items(curText);
  return [...items(tplText)].filter((x) => !cur.has(x));
}

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
  const starts = raw.split(START).length - 1, ends = raw.split(END).length - 1;
  const a = raw.indexOf(START), b = raw.indexOf(END);
  let next;
  if (starts === 0 && ends === 0) next = raw + (raw.endsWith('\n') || raw === '' ? '' : eol) + eol + blockEol + eol;
  else if (starts === 1 && ends === 1 && b > a) next = raw.slice(0, a) + blockEol + raw.slice(b + END.length);
  else return 'conflict'; // 표시가 짝이 안 맞으면 사용자가 손댄 것이라 보고 건드리지 않는다
  if (next === raw) return 'skipped';
  fs.writeFileSync(file, next);
  return 'updated';
}

export async function initProject(rootArg) {
  const root = path.resolve(rootArg);
  fs.mkdirSync(root, { recursive: true });
  const created = [], skipped = [], warnings = [];

  const md = ensureClaudeMd(root);
  (md === 'created' ? created : skipped).push('CLAUDE.md');
  if (md === 'conflict') warnings.push(`CLAUDE.md의 SiloRoot 표시(${START}, ${END})가 짝이 맞지 않아 건드리지 않았습니다. 두 표시를 한 번씩만 남기거나 모두 지운 뒤 다시 실행하세요.`);

  for (const [tpl, dest] of FILES) {
    const full = path.join(root, dest);
    if (fs.existsSync(full)) {
      skipped.push(dest);
      const missing = STALE_CHECK.includes(dest) ? missingTableItems(readTpl(tpl), fs.readFileSync(full, 'utf8')) : [];
      if (missing.length) warnings.push(`${dest}는 이미 있어서 그대로 두었는데, 새 템플릿의 표 항목 ${missing.map((m) => '`' + m + '`').join(', ')}이(가) 없습니다. 템플릿(templates/${tpl})과 비교해 빠진 줄을 더할지 사용자에게 물어보세요.`);
      continue;
    }
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

  execFileSync(process.execPath, [BUILD, root], { stdio: 'ignore', windowsHide: true });
  return { created, skipped, warnings, port: cfg.port, url: 'http://127.0.0.1:' + cfg.port };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const target = process.argv[2] || process.cwd();
  initProject(target).then(
    (res) => console.log(JSON.stringify(res, null, 2)),
    (e) => { console.error('초기화하지 못했습니다: ' + e.message); process.exit(1); },
  );
}
