// 작업 공간을 지금 플러그인 템플릿에 맞추는 "안전한 부분". init과 업데이트(scripts/update.mjs)가 같이 쓴다.
// - 관리 블록(START~END)을 새 템플릿으로 바꾼다. 블록 밖은 건드리지 않는다.
// - 없는 파일만 만든다. 이미 있는 안내 문서는 덮어쓰지 않고, 새 템플릿의 표 항목이 빠졌으면 알리기만 한다.
// - 감싼 배치(wrapped)면 맨 위 CLAUDE.local.md 블록, .ignore와 git 제외 목록의 빠진 줄을 더한다.
// 경로는 모두 프로젝트 맨 위 기준이고 /로 잇는다.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TPL = path.join(here, '..', 'templates');
export const START = '<!-- siloroot:start -->';
export const END = '<!-- siloroot:end -->';

// 템플릿 → 문서 뿌리(docsRoot) 안 경로
export const FILES = [
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
export const LOCAL_BLOCK = `${START}\nSiloRoot 작업 공간 규칙(\`.siloroot/CLAUDE.md\`)을 불러온다. 이 블록은 \`/siloroot:init\`이 관리한다.\n\n@.siloroot/CLAUDE.md\n${END}`;
// .ignore: git은 .siloroot/를 무시해도 검색 도구(ripgrep)는 다시 찾게 한다. 뷰어 생성물과 감싼 폴더의 git 기록은 계속 뺀다.
export const IGNORE_HEAD = '# SiloRoot: git은 .siloroot/를 무시하지만 검색은 찾게 한다';
export const IGNORE_LINES = ['!.siloroot/', '.siloroot/state/', '.siloroot/.git/'];
// git 제외 목록(.git/info/exclude): 팀의 .gitignore를 고치지 않고 이 PC의 이 저장소에서만 뺀다.
export const EXCLUDE_HEAD = '# SiloRoot (커밋하지 않는 개인 작업 공간)';
export const EXCLUDE_LINES = ['.siloroot/', '.ignore', 'CLAUDE.local.md'];

// 이미 있으면 덮어쓰지 않지만, 새 버전의 type이나 폴더 규칙이 빠졌는지 보는 안내 파일
export const STALE_CHECK = ['metadata-guide.md', '04-feedback/README.md'];

// 표 줄(|로 시작)의 백틱 항목 가운데 템플릿에는 있고 지금 파일에는 없는 것
export function missingTableItems(tplText, curText) {
  const items = (t) => new Set(t.split(/\r?\n/).filter((l) => l.trimStart().startsWith('|')).flatMap((l) => [...l.matchAll(/`([^`]+)`/g)].map((m) => m[1])));
  const cur = items(curText);
  return [...items(tplText)].filter((x) => !cur.has(x));
}

export function today() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export const readTpl = (rel) => fs.readFileSync(path.join(TPL, rel), 'utf8').replace(/\r\n/g, '\n').split('{{date}}').join(today());

// CLAUDE.md 블록: 배치에 따라 경로 안내와 설정 줄이 다르다.
export function claudeBlock(layout) {
  const wrapped = layout === 'wrapped';
  return readTpl('CLAUDE.block.md')
    .split('{{layout}}').join(wrapped ? readTpl('layout-wrapped.md') : '') // 템플릿의 {{layout}} 줄은 flat이면 빈 줄로 남는다
    .split('{{config-row}}').join(wrapped
      ? '| `config.json`, `state/` | 설정과 뷰어 생성물. 직접 고치지 않는다 |'
      : '| `.siloroot/` | 설정(`config.json`)과 뷰어 생성물. 직접 고치지 않는다 |')
    .trimEnd();
}

// 문서 뿌리의 CLAUDE.md가 없을 때 만드는 뼈대
export const claudeSkeleton = (block) => `---\ntype: guide\nstatus: 사용 중\ncreated: ${today()}\n---\n\n# 작업 규칙\n\n${block}\n`;

// 블록을 넣거나 바꾼 뒤의 내용. 쓰지 않는다. 파일이 없으면 state 'created'.
function nextBlock(file, block, fresh) {
  if (!fs.existsSync(file)) return { state: 'created', next: fresh(block) };
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const blockEol = block.split('\n').join(eol);
  const starts = raw.split(START).length - 1, ends = raw.split(END).length - 1;
  const a = raw.indexOf(START), b = raw.indexOf(END);
  let next;
  if (starts === 0 && ends === 0) next = raw + (raw.endsWith('\n') || raw === '' ? '' : eol) + eol + blockEol + eol;
  else if (starts === 1 && ends === 1 && b > a) next = raw.slice(0, a) + blockEol + raw.slice(b + END.length);
  else return { state: 'conflict' }; // 표시가 짝이 안 맞으면 사용자가 손댄 것이라 보고 건드리지 않는다
  return next === raw ? { state: 'skipped' } : { state: 'updated', next };
}

// 쓰지 않고 판정만 한다.
export function blockState(file, block) {
  return nextBlock(file, block, (b) => b).state;
}

// 표시 블록(START~END)을 넣거나 바꾼다. 파일이 없으면 fresh(block)로 새로 만든다. 바뀐 것이 없으면 쓰지 않는다.
export function ensureBlock(file, block, fresh) {
  const { state, next } = nextBlock(file, block, fresh);
  if (state === 'created' || state === 'updated') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, next);
  }
  return state;
}

// 목록 파일에 빠진 줄
function missingOf(file, lines) {
  const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const have = new Set(raw.split(/\r?\n/).map((l) => l.trim()));
  return lines.filter((l) => !have.has(l));
}

// 한 줄에 하나인 목록 파일에 빠진 줄만 더한다. 파일이 없으면 만든다.
export function ensureLines(file, head, lines) {
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
export function gitExcludeFile(root) {
  try {
    const out = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
    return out ? path.resolve(root, out) : null;
  } catch {
    return null;
  }
}

// 맞출 대상 목록. cfg는 { layout }만 쓴다.
function targets(root, layout) {
  const docsRoot = layout === 'wrapped' ? path.join(root, '.siloroot') : root;
  const blocks = [{ file: path.join(docsRoot, 'CLAUDE.md'), block: claudeBlock(layout), fresh: claudeSkeleton }];
  const files = FILES.concat([layout === 'wrapped' ? ['gitignore.wrapped', '.gitignore'] : ['gitignore', '.gitignore']])
    .map(([tpl, dest]) => ({ tpl, dest, file: path.join(docsRoot, dest) }));
  const lists = [];
  let noGit = false;
  if (layout === 'wrapped') {
    blocks.push({ file: path.join(root, 'CLAUDE.local.md'), block: LOCAL_BLOCK, fresh: (b) => b + '\n' });
    lists.push({ file: path.join(root, '.ignore'), head: IGNORE_HEAD, lines: IGNORE_LINES });
    const exclude = gitExcludeFile(root);
    if (exclude) lists.push({ file: exclude, head: EXCLUDE_HEAD, lines: EXCLUDE_LINES });
    else noGit = true;
  }
  return { blocks, files, lists, noGit };
}

const relOf = (root) => (full) => path.relative(root, full).split(path.sep).join('/');

// 안내 문서에 빠진 표 항목. declined({ <file>: [items] })에 있는 것은 뺀다.
function gapsOf(root, files, declined) {
  const rel = relOf(root);
  const out = [];
  for (const { tpl, dest, file } of files) {
    if (!STALE_CHECK.includes(dest) || !fs.existsSync(file)) continue;
    const skip = new Set(declined[rel(file)] || []);
    const items = missingTableItems(readTpl(tpl), fs.readFileSync(file, 'utf8')).filter((x) => !skip.has(x));
    if (items.length) out.push({ file: rel(file), tpl, items });
  }
  return out;
}

// 무엇을 맞출지 알린다. 파일을 바꾸지 않는다.
export function planRefresh(rootArg, cfg, { declined = {} } = {}) {
  const root = path.resolve(rootArg);
  const rel = relOf(root);
  const t = targets(root, cfg.layout);
  return {
    blocks: t.blocks.map((b) => ({ file: rel(b.file), state: blockState(b.file, b.block) })),
    missingFiles: t.files.filter((f) => !fs.existsSync(f.file)).map((f) => rel(f.file)),
    missingLines: t.lists.map((l) => ({ file: rel(l.file), lines: missingOf(l.file, l.lines) })).filter((l) => l.lines.length),
    guideGaps: gapsOf(root, t.files, declined),
  };
}

// 맞춘다. 안내 문서 줄은 더하지 않고 warnings로 알린다(사람 답을 받아 스킬이 더한다).
export function applyRefresh(rootArg, cfg, { declined = {} } = {}) {
  const root = path.resolve(rootArg);
  const rel = relOf(root);
  const created = [], updated = [], skipped = [], warnings = [], notes = [];
  const record = (state, full) => ({ created, updated, skipped, conflict: skipped })[state].push(rel(full));
  const t = targets(root, cfg.layout);

  for (const b of t.blocks) {
    const st = ensureBlock(b.file, b.block, b.fresh);
    record(st, b.file);
    if (st !== 'conflict') continue;
    if (path.basename(b.file) === 'CLAUDE.local.md') warnings.push(`CLAUDE.local.md의 SiloRoot 표시가 짝이 맞지 않아 건드리지 않았습니다. 이 파일에 \`@.siloroot/CLAUDE.md\` 줄이 없으면 Claude가 SiloRoot 규칙을 읽지 못합니다.`);
    else warnings.push(`${rel(b.file)}의 SiloRoot 표시(${START}, ${END})가 짝이 맞지 않아 건드리지 않았습니다. 두 표시를 한 번씩만 남기거나 모두 지운 뒤 다시 실행하세요.`);
  }

  const gaps = new Map(gapsOf(root, t.files, declined).map((g) => [g.file, g]));
  for (const { tpl, file } of t.files) {
    if (fs.existsSync(file)) {
      skipped.push(rel(file));
      const g = gaps.get(rel(file));
      if (g) warnings.push(`${rel(file)}는 이미 있어서 그대로 두었는데, 새 템플릿의 표 항목 ${g.items.map((m) => '`' + m + '`').join(', ')}이(가) 없습니다. 템플릿(templates/${tpl})과 비교해 빠진 줄을 더할지 사용자에게 물어보세요.`);
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, readTpl(tpl));
    created.push(rel(file));
  }

  for (const l of t.lists) record(ensureLines(l.file, l.head, l.lines), l.file);
  if (t.noGit) notes.push('git 저장소가 아니어서 git 제외 목록은 쓰지 않았습니다.');
  return { created, updated, skipped, warnings, notes };
}
