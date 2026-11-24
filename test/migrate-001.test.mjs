import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, writeConfig } from '../lib/config.mjs';
import { claudeBlock, LOCAL_BLOCK, IGNORE_LINES, START } from '../lib/workspace-sync.mjs';
import { MIGRATIONS, pendingMigrations } from '../lib/migrations/index.mjs';
import { makeProject, write } from './fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const m001 = MIGRATIONS.find((m) => m.id === '001-wrap-siloroot-folder');
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const listAll = (root) => fs.readdirSync(root, { recursive: true }).map(String).sort();
const git = (root, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'core.quotePath=false', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const ctxOf = (root) => ({ root, cfg: loadConfig(root) });
const A_MD = '---\ntype: study\nstatus: 검증 전\ntags: [x]\n---\n\n# a\n\n본문 그대로\n';
const TEAM = '# 팀 규칙\n\n팀이 쓰는 내용.\n';

// 예전 배치(flat)로 초기화된 프로젝트: 문서가 맨 위에, 맨 위 CLAUDE.md에 팀 내용과 SiloRoot 블록
function flatProject({ eol = '\n', team = TEAM } = {}) {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '01-log/changelog.md', '---\ntype: log\nstatus: 사용 중\n---\n\n# 작업 기록\n');
  write(root, '02-study/a.md', A_MD);
  write(root, '03-ideas/README.md', '---\ntype: index\nstatus: 사용 중\n---\n\n# 아이디어\n');
  write(root, '04-feedback/README.md', '---\ntype: index\nstatus: 사용 중\n---\n\n# 피드백\n');
  write(root, '05-profile/profile.md', '---\ntype: guide\nstatus: 사용 중\n---\n\n# 사용자 정보\n');
  write(root, 'metadata-guide.md', fs.readFileSync(path.join(REPO, 'templates', 'metadata-guide.md'), 'utf8'));
  write(root, 'writing-guide.md', fs.readFileSync(path.join(REPO, 'templates', 'writing-guide.md'), 'utf8'));
  const body = team + '\n' + claudeBlock('flat') + '\n';
  write(root, 'CLAUDE.md', body.split('\n').join(eol));
  write(root, '.gitignore', fs.readFileSync(path.join(REPO, 'templates', 'gitignore'), 'utf8'));
  return root;
}

const DEFAULTS = (plan) => Object.fromEntries(plan.decisions.map((d) => [d.id, d.default]));

test('pendingMigrations는 모양 1에서 2로 001을 낸다', () => {
  assert.deepEqual(pendingMigrations(1, 2).map((m) => m.id), ['001-wrap-siloroot-folder']);
  assert.deepEqual(pendingMigrations(2, 2), []);
});

test('plan은 파일을 바꾸지 않는다', () => {
  const root = flatProject();
  const before = listAll(root);
  const p = m001.plan(ctxOf(root));
  assert.deepEqual(listAll(root), before);
  assert.ok(p.moves.some((m) => m.from === '02-study' && m.to === '.siloroot/02-study'));
  assert.ok(p.moves.some((m) => m.from === 'metadata-guide.md'));
  assert.ok(p.touches.files.includes('CLAUDE.md'));
  assert.ok(p.touches.creates.includes('.siloroot/02-study'));
  assert.ok(p.decisions.some((d) => d.id === 'root-gitignore' && d.default === 'keep'));
});

test('apply 뒤 모양이 새로 init한 감싼 작업 공간과 같고 문서 내용은 바이트까지 같다', () => {
  const root = flatProject();
  const p = m001.plan(ctxOf(root));
  const res = m001.apply(ctxOf(root), DEFAULTS(p));
  assert.ok(res.moved.includes('02-study'));
  assert.equal(read(root, '.siloroot/02-study/a.md'), A_MD);
  assert.ok(!exists(root, '02-study'));
  assert.ok(read(root, '.siloroot/CLAUDE.md').includes(claudeBlock('wrapped')));
  assert.ok(read(root, 'CLAUDE.local.md').includes(LOCAL_BLOCK));
  for (const l of IGNORE_LINES) assert.ok(read(root, '.ignore').split('\n').includes(l));
  const cfg = loadConfig(root);
  assert.equal(cfg.layout, 'wrapped');
  assert.equal(cfg.schema, 2);
  const top = read(root, 'CLAUDE.md');
  assert.ok(top.includes(TEAM.trim()), '팀 내용은 그대로');
  assert.ok(!top.includes(START), '블록은 뗐다');
  assert.ok(exists(root, '.gitignore'), '기본값은 .gitignore를 그대로 둔다');
});

test('CRLF CLAUDE.md에서 블록을 떼도 남은 줄바꿈이 CRLF', () => {
  const root = flatProject({ eol: '\r\n' });
  const p = m001.plan(ctxOf(root));
  m001.apply(ctxOf(root), DEFAULTS(p));
  const top = read(root, 'CLAUDE.md');
  assert.ok(!top.includes(START));
  assert.ok(top.includes('# 팀 규칙\r\n\r\n팀이 쓰는 내용.\r\n'));
  assert.ok(!/[^\r]\n/.test(top), 'LF만 있는 줄이 없다');
});

test('블록 밖이 init 뼈대뿐이면 root-claude-skeleton을 묻고 기본값이면 맨 위 CLAUDE.md를 지운다', () => {
  const root = flatProject({ team: '---\ntype: guide\nstatus: 사용 중\ncreated: 2026-01-01\n---\n\n# 작업 규칙\n' });
  const p = m001.plan(ctxOf(root));
  const d = p.decisions.find((x) => x.id === 'root-claude-skeleton');
  assert.equal(d.default, 'delete');
  assert.ok(!p.decisions.some((x) => x.id === 'root-claude-outside'));
  m001.apply(ctxOf(root), DEFAULTS(p));
  assert.ok(!exists(root, 'CLAUDE.md'));
});

test('블록 밖 사용자 내용을 move로 답하면 .siloroot/CLAUDE.md 블록 뒤로 옮긴다', () => {
  const root = flatProject();
  const p = m001.plan(ctxOf(root));
  assert.equal(p.decisions.find((x) => x.id === 'root-claude-outside').default, 'keep');
  m001.apply(ctxOf(root), { ...DEFAULTS(p), 'root-claude-outside': 'move' });
  const inner = read(root, '.siloroot/CLAUDE.md');
  assert.ok(inner.indexOf('팀이 쓰는 내용.') > inner.indexOf('<!-- siloroot:end -->'));
  assert.ok(!exists(root, 'CLAUDE.md'));
});

test('git 저장소가 아니면 제외 목록을 건너뛰고 notes로 알린다', () => {
  const root = flatProject();
  const p = m001.plan(ctxOf(root));
  assert.ok(p.notes.some((n) => n.includes('git 저장소가 아니')));
  assert.ok(!p.decisions.some((d) => d.id === 'git-tracked'));
  const res = m001.apply(ctxOf(root), DEFAULTS(p));
  assert.ok(res.notes.some((n) => n.includes('git 저장소가 아니')));
});

test('커밋된 문서가 있으면 git-tracked를 묻고 keep-tracked면 git mv로 옮긴다', () => {
  const root = flatProject();
  git(root, ['init', '-q']);
  git(root, ['add', '02-study', 'metadata-guide.md', 'CLAUDE.md', '.gitignore']);
  git(root, ['commit', '-q', '-m', 'flat']);
  const p = m001.plan(ctxOf(root));
  const d = p.decisions.find((x) => x.id === 'git-tracked');
  assert.equal(d.default, 'keep-tracked');
  assert.ok(p.notes.some((n) => n.includes('git으로도 되돌릴')));
  m001.apply(ctxOf(root), DEFAULTS(p));
  const st = git(root, ['status', '--porcelain']);
  assert.match(st, /^R {2}02-study\/a\.md -> \.siloroot\/02-study\/a\.md$/m);
  const exclude = read(root, '.git/info/exclude');
  assert.ok(!exclude.split(/\r?\n/).includes('.siloroot/'), '계속 git에 올리면 .siloroot/를 빼지 않는다');
  assert.ok(exclude.split(/\r?\n/).includes('CLAUDE.local.md'));
  assert.equal(loadConfig(root).tracked, true);
});

test('make-private면 제외 목록에 .siloroot/를 넣는다', () => {
  const root = flatProject();
  git(root, ['init', '-q']);
  git(root, ['add', '02-study']);
  git(root, ['commit', '-q', '-m', 'flat']);
  const p = m001.plan(ctxOf(root));
  const res = m001.apply(ctxOf(root), { ...DEFAULTS(p), 'git-tracked': 'make-private' });
  assert.ok(read(root, '.git/info/exclude').split(/\r?\n/).includes('.siloroot/'));
  assert.ok(res.notes.some((n) => n.includes('지워진 것으로')));
  assert.equal(loadConfig(root).tracked, false);
});

test('VOCAB type만 든 사용자 폴더는 move-folder로 묻고 stay면 그대로', () => {
  const root = flatProject();
  write(root, 'research/x.md', '---\ntype: note\nstatus: 사용 중\n---\n\n# x\n');
  write(root, 'src/readme.md', '# 코드 설명\n');
  const p = m001.plan(ctxOf(root));
  const d = p.decisions.find((x) => x.id === 'move-folder:research');
  assert.equal(d.default, 'stay');
  assert.ok(!p.decisions.some((x) => x.id === 'move-folder:src'));
  m001.apply(ctxOf(root), DEFAULTS(p));
  assert.ok(exists(root, 'research/x.md'));
  const root2 = flatProject();
  write(root2, 'research/x.md', '---\ntype: note\nstatus: 사용 중\n---\n\n# x\n');
  const p2 = m001.plan(ctxOf(root2));
  m001.apply(ctxOf(root2), { ...DEFAULTS(p2), 'move-folder:research': 'move' });
  assert.ok(exists(root2, '.siloroot/research/x.md'));
});

test('맨 위 .gitignore가 템플릿과 같고 delete로 답하면 지운다', () => {
  const root = flatProject();
  const p = m001.plan(ctxOf(root));
  m001.apply(ctxOf(root), { ...DEFAULTS(p), 'root-gitignore': 'delete' });
  assert.ok(!exists(root, '.gitignore'));
});

test('답이 빠지면 apply가 아무것도 바꾸지 않고 멈춘다', () => {
  const root = flatProject();
  const before = listAll(root);
  assert.throws(() => m001.apply(ctxOf(root), {}), /missing-decisions/);
  assert.deepEqual(listAll(root), before);
});
