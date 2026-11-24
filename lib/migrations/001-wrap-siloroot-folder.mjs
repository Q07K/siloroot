// 001: 예전 배치(flat, 모양 1) → 감싼 배치(wrapped, 모양 2)
// 예전 배치는 SiloRoot 문서가 프로젝트 맨 위에 바로 있다(01-log/~05-profile/, metadata-guide.md, writing-guide.md, 맨 위 CLAUDE.md의 관리 블록).
// 이것을 .siloroot/ 안으로 옮기고, 감싼 배치에 필요한 것(CLAUDE.local.md 블록, .ignore, git 제외 목록)을 init과 같은 방식으로 더한다.
// 문서 안 경로는 문서 뿌리 기준이라 뿌리째 옮기면 바꿀 필요가 없다.
// 팀 파일(맨 위 CLAUDE.md의 블록 밖, 맨 위 .gitignore)과 git 기록은 사람이 고른 답(decisions)대로만 바꾼다.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { updateConfig } from '../config.mjs';
import { VOCAB } from '../vocab.mjs';
import { START, END, FILES, gitExcludeFile, applyRefresh } from '../workspace-sync.mjs';

const TPL_GITIGNORE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'gitignore');
const GUIDES = ['metadata-guide.md', 'writing-guide.md'];
const SKIP_DIRS = new Set(['node_modules']);

const norm = (s) => s.replace(/^﻿/, '').replace(/\r\n/g, '\n').trim();
const typeOf = (text) => {
  const fm = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const t = fm && fm[1].match(/^type\s*:\s*(.+)$/m);
  return t ? t[1].trim().replace(/^["']|["']$/g, '') : null;
};

// 폴더 안의 마크다운(숨은 폴더와 node_modules는 뺀다)
function mdFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...mdFiles(full));
    else if (e.name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out;
}

// 관리 블록을 떼어 낸 나머지. 남은 부분의 줄바꿈은 그대로 둔다. 표시가 짝이 안 맞으면 null.
function stripBlock(raw) {
  const starts = raw.split(START).length - 1, ends = raw.split(END).length - 1;
  const a = raw.indexOf(START), b = raw.indexOf(END);
  if (starts !== 1 || ends !== 1 || b < a) return null;
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const before = raw.slice(0, a).replace(/(\r?\n)+$/, '');
  const after = raw.slice(b + END.length).replace(/^(\r?\n)+/, '');
  if (!before) return after;
  if (!after) return before + eol;
  return before + eol + eol + after;
}

// 예전 init이 만든 뼈대(프론트매터와 "# 작업 규칙")를 뺀 사용자 내용
function userContent(text) {
  return text.replace(/^﻿/, '').replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, '')
    .split(/\r?\n/).filter((l) => l.trim() !== '# 작업 규칙').join('\n').trim();
}

function gitTracked(root, rels) {
  if (!rels.length) return [];
  try {
    return execFileSync('git', ['ls-files', '-z', '--', ...rels], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

function survey({ root, cfg }) {
  const exists = (rel) => fs.existsSync(path.join(root, rel));
  const known = [...new Set(Object.values(cfg.dirs))].concat(GUIDES);
  const moves = [], notes = [], decisions = [], edits = [];

  for (const name of known) {
    if (!exists(name)) continue;
    if (exists('.siloroot/' + name)) notes.push(`${name}: .siloroot/${name}가 이미 있어 옮기지 않습니다. 두 곳을 견주어 직접 합치세요.`);
    else moves.push({ from: name, to: '.siloroot/' + name });
  }

  // 사용자가 직접 만든 SiloRoot 폴더: 안의 마크다운이 모두 정해진 type을 가진 맨 위 폴더
  const candidates = [];
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.') || SKIP_DIRS.has(e.name) || known.includes(e.name)) continue;
    const md = mdFiles(path.join(root, e.name));
    if (md.length && md.every((f) => VOCAB[typeOf(fs.readFileSync(f, 'utf8'))])) candidates.push(e.name);
  }
  for (const name of candidates) {
    if (exists('.siloroot/' + name)) { notes.push(`${name}: .siloroot/${name}가 이미 있어 옮기지 않습니다.`); continue; }
    decisions.push({
      id: 'move-folder:' + name,
      question: `맨 위 ${name}/ 폴더의 문서가 모두 SiloRoot 속성을 가졌습니다. .siloroot/ 안으로 같이 옮길까요?`,
      why: '직접 더한 SiloRoot 폴더일 수 있습니다. 옮기지 않으면 뷰어에서 빠지고, 옮긴 문서에서 이 폴더를 가리키는 연결이 끊어집니다.',
      options: ['move', 'stay'], default: 'stay',
    });
  }

  // 맨 위에 남는 것을 가리키는 연결은 바꾸지 않는다
  const loose = fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md') && !['CLAUDE.md', 'CLAUDE.local.md'].includes(e.name)).map((e) => e.name);
  const left = loose.concat(candidates.map((c) => c + '/'));
  if (left.length) notes.push(`맨 위에 남는 ${left.join(', ')}는 옮기지 않습니다(폴더는 답에 따라). 옮긴 문서에서 이것을 가리키는 related와 백틱 경로는 끊어지고, 뷰어에서도 빠집니다.`);

  // 맨 위 CLAUDE.md의 관리 블록
  let rootClaude = null;
  if (exists('CLAUDE.md')) {
    const raw = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    const rest = raw.includes(START) || raw.includes(END) ? stripBlock(raw) : undefined;
    if (rest === null) notes.push(`맨 위 CLAUDE.md의 SiloRoot 표시(${START}, ${END})가 짝이 맞지 않아 블록을 떼지 않습니다. 직접 지우세요.`);
    else if (rest !== undefined) {
      rootClaude = { rest, user: userContent(rest) };
      edits.push({ file: 'CLAUDE.md', what: 'SiloRoot 관리 블록을 떼어 냄(.siloroot/CLAUDE.md에 감싼 배치용 블록을 둠)' });
      if (!rootClaude.user) decisions.push({
        id: 'root-claude-skeleton',
        question: '블록을 떼면 맨 위 CLAUDE.md에는 예전 init이 만든 뼈대(속성과 "# 작업 규칙" 제목)만 남습니다. 이 파일을 지울까요?',
        why: '규칙은 .siloroot/CLAUDE.md로 옮겨지고 CLAUDE.local.md가 불러옵니다. 남은 뼈대는 쓰이지 않습니다.',
        options: ['delete', 'keep'], default: 'delete',
      });
      else decisions.push({
        id: 'root-claude-outside',
        question: '맨 위 CLAUDE.md의 블록 밖에 직접 쓴 내용이 있습니다. .siloroot/CLAUDE.md의 블록 뒤로 옮길까요?',
        why: '그 안의 경로는 문서 뿌리 기준이라 옮겨야 맞는 경우가 많습니다. 다만 팀이 같이 쓰는 내용이면 그대로 두어야 합니다. 옮기면 맨 위 CLAUDE.md는 지웁니다.',
        options: ['move', 'keep'], default: 'keep',
      });
    }
  }

  // 맨 위 .gitignore
  if (exists('.gitignore')) {
    if (norm(fs.readFileSync(path.join(root, '.gitignore'), 'utf8')) === norm(fs.readFileSync(TPL_GITIGNORE, 'utf8'))) decisions.push({
      id: 'root-gitignore',
      question: '맨 위 .gitignore가 예전 SiloRoot init이 만든 것과 똑같습니다. 지울까요?',
      why: '감싼 배치에서는 .siloroot/.gitignore가 같은 일을 합니다. 다만 팀이 이 파일을 커밋해 쓰고 있다면 그대로 두세요.',
      options: ['delete', 'keep'], default: 'keep',
    });
    else notes.push('맨 위 .gitignore는 팀 파일일 수 있어 손대지 않습니다.');
  }

  // 바깥 git
  const exclude = gitExcludeFile(root);
  let tracked = [];
  if (!exclude) notes.push('git 저장소가 아니어서 git 제외 목록은 쓰지 않습니다.');
  else {
    tracked = gitTracked(root, moves.map((m) => m.from).concat(candidates));
    if (tracked.length) {
      decisions.push({
        id: 'git-tracked',
        question: `옮길 문서 중 ${tracked.length}개가 바깥 git에 커밋돼 있습니다. 계속 git에 올릴까요, 개인 작업 공간으로 뺄까요?`,
        why: 'keep-tracked: git mv로 옮겨 기록을 잇고 .siloroot/를 git 제외 목록에 넣지 않습니다. make-private: .siloroot/를 제외 목록에 넣습니다. 이때 다음 커밋에는 이 문서들이 지워진 것으로 보입니다.',
        options: ['keep-tracked', 'make-private'], default: 'keep-tracked',
      });
      notes.push('옮길 문서 일부가 바깥 git에 올라가 있어 git으로도 되돌릴 수 있습니다.');
    }
  }
  edits.push({ file: '.siloroot/config.json', what: 'layout을 wrapped로, schema를 2로' });

  const rel = (full) => path.relative(root, full).split(path.sep).join('/');
  const touches = {
    files: moves.map((m) => m.from).concat(candidates, ['CLAUDE.md', '.gitignore', 'CLAUDE.local.md', '.ignore', '.siloroot/config.json'], exclude ? [rel(exclude)] : []),
    creates: moves.map((m) => m.to).concat(candidates.map((c) => '.siloroot/' + c), ['.siloroot/CLAUDE.md', '.siloroot/.gitignore'], FILES.map(([, d]) => '.siloroot/' + d)),
  };
  return { moves, edits, decisions, notes, touches, candidates, rootClaude, tracked };
}

export default {
  id: '001-wrap-siloroot-folder',
  from: 1,
  to: 2,
  title: '문서를 .siloroot/ 안으로 감싼다',

  plan(ctx) {
    const { moves, edits, decisions, notes, touches } = survey(ctx);
    return { moves, edits, decisions, notes, touches };
  },

  apply(ctx, answers = {}) {
    const root = path.resolve(ctx.root);
    const s = survey({ ...ctx, root });
    const missing = s.decisions.filter((d) => !d.options.includes(answers[d.id])).map((d) => d.id);
    if (missing.length) throw Object.assign(new Error('missing-decisions: ' + missing.join(', ')), { code: 'missing-decisions', ids: missing });

    const moved = [], edited = [], created = [], notes = [];
    const keepTracked = answers['git-tracked'] === 'keep-tracked';
    const trackedTop = new Set(s.tracked.map((f) => f.split('/')[0]));
    const moves = s.moves.concat(s.candidates.filter((c) => answers['move-folder:' + c] === 'move').map((c) => ({ from: c, to: '.siloroot/' + c })));
    fs.mkdirSync(path.join(root, '.siloroot'), { recursive: true });
    for (const m of moves) {
      const src = path.join(root, m.from), dest = path.join(root, m.to);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (keepTracked && trackedTop.has(m.from)) execFileSync('git', ['mv', '--', m.from, m.to], { cwd: root, stdio: 'ignore', windowsHide: true });
      else fs.renameSync(src, dest);
      moved.push(m.from);
    }

    // 순서: 새 자리를 먼저 다 만들고, 옛 자리를 지우는 일과 설정 바꾸기는 맨 뒤에 한다.
    // 중간에 실패해도 사용자 내용이 한쪽에는 남고, 설정은 예전 모양(schema 1) 그대로라 다시 돌리면 이어진다.
    const r = applyRefresh(root, { layout: 'wrapped', tracked: keepTracked });
    created.push(...r.created);
    edited.push(...r.updated);
    notes.push(...r.notes, ...r.warnings.filter((w) => !w.includes('새 템플릿의 표 항목')));

    if (s.rootClaude && answers['root-claude-outside'] === 'move') {
      const inner = path.join(root, '.siloroot', 'CLAUDE.md');
      const raw = fs.readFileSync(inner, 'utf8');
      const text = s.rootClaude.user.replace(/\r\n/g, '\n');
      if (!raw.includes(text)) fs.writeFileSync(inner, raw.replace(/(\r?\n)*$/, '') + '\n\n' + text + '\n'); // 다시 돌릴 때 두 번 붙이지 않는다
      if (!edited.includes('.siloroot/CLAUDE.md')) edited.push('.siloroot/CLAUDE.md');
    }
    if (s.rootClaude) {
      const top = path.join(root, 'CLAUDE.md');
      if (answers['root-claude-skeleton'] === 'delete' || answers['root-claude-outside'] === 'move') fs.rmSync(top);
      else fs.writeFileSync(top, s.rootClaude.rest);
      edited.push('CLAUDE.md');
    }
    if (answers['root-gitignore'] === 'delete') { fs.rmSync(path.join(root, '.gitignore')); edited.push('.gitignore'); }

    if (answers['git-tracked'] === 'make-private') notes.push('옮긴 문서는 바깥 git의 다음 커밋에서 지워진 것으로 보입니다. 파일은 .siloroot/ 안에 그대로 있습니다.');
    updateConfig(root, { layout: 'wrapped', schema: 2, tracked: keepTracked ? true : null });
    edited.push('.siloroot/config.json');
    return { moved, edited, created, notes };
  },
};
