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

const here = path.dirname(fileURLToPath(import.meta.url));
const TPL = path.join(here, '..', 'templates');
const BUILD = path.join(here, '..', 'viewer', 'build.mjs');
const START = '<!-- siloroot:start -->';
const END = '<!-- siloroot:end -->';

// 템플릿 → 문서 뿌리(docsRoot) 안 경로
const FILES = [
  ['metadata-guide.md', 'metadata-guide.md'],
  ['writing-guide.md', 'writing-guide.md'],
  ['01-log/changelog.md', '01-log/changelog.md'],
  ['01-log/open-questions.md', '01-log/open-questions.md'],
  ['02-study/README.md', '02-study/README.md'],
  ['03-ideas/README.md', '03-ideas/README.md'],
  ['04-feedback/README.md', '04-feedback/README.md'],
  ['05-profile/profile.md', '05-profile/profile.md'],
];

// 감싼 배치에서 프로젝트 맨 위에 두는 것
const LOCAL_BLOCK = `${START}\nSiloRoot 작업 공간 규칙(\`.siloroot/CLAUDE.md\`)을 불러온다. 이 블록은 \`/siloroot:init\`이 관리한다.\n\n@.siloroot/CLAUDE.md\n${END}`;
// .ignore: git은 .siloroot/를 무시해도 검색 도구(ripgrep)는 다시 찾게 한다. 뷰어 생성물과 감싼 폴더의 git 기록은 계속 뺀다.
const IGNORE_HEAD = '# SiloRoot: git은 .siloroot/를 무시하지만 검색은 찾게 한다';
const IGNORE_LINES = ['!.siloroot/', '.siloroot/state/', '.siloroot/.git/'];
// git 제외 목록(.git/info/exclude): 팀의 .gitignore를 고치지 않고 이 PC의 이 저장소에서만 뺀다.
const EXCLUDE_HEAD = '# SiloRoot (커밋하지 않는 개인 작업 공간)';
const EXCLUDE_LINES = ['.siloroot/', '.ignore', 'CLAUDE.local.md'];

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

// CLAUDE.md 블록: 배치에 따라 경로 안내와 설정 줄이 다르다.
function claudeBlock(layout) {
  const wrapped = layout === 'wrapped';
  return readTpl('CLAUDE.block.md')
    .split('{{layout}}').join(wrapped ? readTpl('layout-wrapped.md') : '') // 템플릿의 {{layout}} 줄은 flat이면 빈 줄로 남는다
    .split('{{config-row}}').join(wrapped
      ? '| `config.json`, `state/` | 설정과 뷰어 생성물. 직접 고치지 않는다 |'
      : '| `.siloroot/` | 설정(`config.json`)과 뷰어 생성물. 직접 고치지 않는다 |')
    .trimEnd();
}

// 표시 블록(START~END)을 넣거나 바꾼다. 파일이 없으면 fresh(block)로 새로 만든다. 바뀐 것이 없으면 쓰지 않는다.
function ensureBlock(file, block, fresh) {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, fresh(block));
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

// 한 줄에 하나인 목록 파일에 빠진 줄만 더한다. 파일이 없으면 만든다.
function ensureLines(file, head, lines) {
  const exists = fs.existsSync(file);
  const raw = exists ? fs.readFileSync(file, 'utf8') : '';
  const have = new Set(raw.split(/\r?\n/).map((l) => l.trim()));
  const missing = lines.filter((l) => !have.has(l));
  if (!missing.length) return 'skipped';
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const add = (have.has(head) ? [] : [head]).concat(missing).join(eol) + eol;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, raw + (raw === '' || raw.endsWith('\n') ? '' : eol) + (raw === '' ? '' : eol) + add);
  return exists ? 'updated' : 'created';
}

// git 저장소면 이 저장소의 제외 목록 파일 경로, 아니면 null. 워크트리와 서브모듈에서는 .git이 파일이라 git에게 묻는다.
function gitExcludeFile(root) {
  try {
    const out = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
    return out ? path.resolve(root, out) : null;
  } catch {
    return null;
  }
}

export async function initProject(rootArg) {
  const root = path.resolve(rootArg);
  fs.mkdirSync(root, { recursive: true });
  const created = [], updated = [], skipped = [], warnings = [], notes = [];
  const rel = (full) => path.relative(root, full).split(path.sep).join('/');
  const record = (state, full) => ({ created, updated, skipped, conflict: skipped })[state].push(rel(full));

  const existing = loadConfig(root);
  const layout = existing ? existing.layout : 'wrapped';
  const docsRoot = layout === 'wrapped' ? path.join(root, '.siloroot') : root;

  const claudeMd = path.join(docsRoot, 'CLAUDE.md');
  const md = ensureBlock(claudeMd, claudeBlock(layout), (block) => `---\ntype: guide\nstatus: 사용 중\ncreated: ${today()}\n---\n\n# 작업 규칙\n\n${block}\n`);
  record(md, claudeMd);
  if (md === 'conflict') warnings.push(`${rel(claudeMd)}의 SiloRoot 표시(${START}, ${END})가 짝이 맞지 않아 건드리지 않았습니다. 두 표시를 한 번씩만 남기거나 모두 지운 뒤 다시 실행하세요.`);

  const files = FILES.concat([layout === 'wrapped' ? ['gitignore.wrapped', '.gitignore'] : ['gitignore', '.gitignore']]);
  for (const [tpl, dest] of files) {
    const full = path.join(docsRoot, dest);
    if (fs.existsSync(full)) {
      skipped.push(rel(full));
      const missing = STALE_CHECK.includes(dest) ? missingTableItems(readTpl(tpl), fs.readFileSync(full, 'utf8')) : [];
      if (missing.length) warnings.push(`${rel(full)}는 이미 있어서 그대로 두었는데, 새 템플릿의 표 항목 ${missing.map((m) => '`' + m + '`').join(', ')}이(가) 없습니다. 템플릿(templates/${tpl})과 비교해 빠진 줄을 더할지 사용자에게 물어보세요.`);
      continue;
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, readTpl(tpl));
    created.push(rel(full));
  }

  if (layout === 'wrapped') {
    const local = path.join(root, 'CLAUDE.local.md');
    const lm = ensureBlock(local, LOCAL_BLOCK, (block) => block + '\n');
    record(lm, local);
    if (lm === 'conflict') warnings.push(`CLAUDE.local.md의 SiloRoot 표시가 짝이 맞지 않아 건드리지 않았습니다. 이 파일에 \`@.siloroot/CLAUDE.md\` 줄이 없으면 Claude가 SiloRoot 규칙을 읽지 못합니다.`);

    const ignore = path.join(root, '.ignore');
    record(ensureLines(ignore, IGNORE_HEAD, IGNORE_LINES), ignore);

    const exclude = gitExcludeFile(root);
    if (exclude) record(ensureLines(exclude, EXCLUDE_HEAD, EXCLUDE_LINES), exclude);
    else notes.push('git 저장소가 아니어서 git 제외 목록은 쓰지 않았습니다.');
  }

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
