import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initProject } from '../scripts/init.mjs';
import { writeConfig, loadConfig } from '../lib/config.mjs';
import { readMetrics } from '../lib/metrics.mjs';
import { userDir } from '../lib/user.mjs';
import { makeProject, write } from './fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(REPO, 'scripts', 'conventions.mjs');
const HOME = () => path.join(userDir(), 'siloroot-home');

// 훅처럼 돌린다. Claude Code는 CLAUDE_PROJECT_DIR을, Codex는 세션 폴더(cwd)를 준다
const run = (root, { args = [], input = '', viaCwd = false } = {}) => {
  const env = { ...process.env };
  if (viaCwd) delete env.CLAUDE_PROJECT_DIR; else env.CLAUDE_PROJECT_DIR = root;
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', input, env, cwd: root });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
const ctxOf = (out) => {
  const j = JSON.parse(out);
  assert.equal(j.hookSpecificOutput.hookEventName, 'SessionStart');
  return j.hookSpecificOutput.additionalContext;
};

const conv = (status, title, body) => `---\ntype: convention\nstatus: ${status}\ncreated: 2026-11-27\nrelated: [shared/conventions/README.md]\n---\n\n# ${title}\n\n${body}\n`;

async function v4Project() {
  fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
  fs.rmSync(HOME(), { recursive: true, force: true });
  const root = makeProject();
  await initProject(root, { home: HOME() });
  return root;
}

test('SiloRoot 폴더가 아니면 아무것도 출력하지 않고 아무것도 만들지 않는다', () => {
  const root = makeProject('그냥 폴더');
  write(root, 'shared/conventions/a.md', conv('사용 중', '약속', '- 하나'));
  const before = fs.readdirSync(root, { recursive: true }).sort();
  assert.equal(run(root), '');
  assert.deepEqual(fs.readdirSync(root, { recursive: true }).sort(), before);
});

test('컨벤션 문서의 본문을 경로와 함께 맥락에 넣는다', async () => {
  const root = await v4Project();
  const dir = '.siloroot/shared/conventions/';
  write(root, dir + 'branch-rule.md', conv('사용 중', '브랜치 약속', '- 작업 하나에 브랜치 하나'));
  write(root, dir + 'draft-rule.md', conv('제안', '시안 약속', '- 시안은 실제 화면으로'));
  write(root, dir + 'old-rule.md', conv('폐기', '옛 약속', '- 버린 약속'));
  write(root, dir + 'moved-rule.md', conv('바뀜', '바뀐 약속', '- 바뀐 약속'));
  const ctx = ctxOf(run(root));
  assert.match(ctx, /^\[SiloRoot\] 이 프로젝트의 컨벤션입니다\(\.siloroot\/shared\/conventions\/, 문서 2개\)/);
  assert.ok(ctx.includes('=== .siloroot/shared/conventions/branch-rule.md\n\n# 브랜치 약속\n\n- 작업 하나에 브랜치 하나'), ctx);
  assert.ok(ctx.includes('=== .siloroot/shared/conventions/draft-rule.md (제안)'), ctx);
  // 폐기, 바뀜 상태와 폴더 안내(README.md), 속성은 넣지 않는다
  assert.doesNotMatch(ctx, /옛 약속|바뀐 약속|README\.md|type: convention|related:/);
});

test('대화를 압축한 뒤에도 같은 내용을 다시 넣는다', async () => {
  const root = await v4Project();
  write(root, '.siloroot/shared/conventions/a.md', conv('사용 중', '약속', '- 하나'));
  const first = run(root, { input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup' }) });
  const again = run(root, { input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'compact' }) });
  assert.notEqual(first, '');
  assert.equal(again, first);
});

test('Codex처럼 CLAUDE_PROJECT_DIR 없이 세션 폴더에서 돌아도 넣는다', async () => {
  const root = await v4Project();
  write(root, '.siloroot/shared/conventions/a.md', conv('사용 중', '약속', '- 하나'));
  assert.match(ctxOf(run(root, { viaCwd: true })), /=== \.siloroot\/shared\/conventions\/a\.md/);
});

test('글자 수를 넘으면 본문 대신 모든 문서의 목록과 경로를 넣는다', async () => {
  const root = await v4Project();
  const long = '- 긴 약속 줄입니다. '.repeat(1000);
  write(root, '.siloroot/shared/conventions/a-long.md', conv('사용 중', '긴 약속', long));
  write(root, '.siloroot/shared/conventions/b-short.md', conv('제안', '짧은 약속', '- 하나'));
  const ctx = ctxOf(run(root));
  assert.ok(ctx.length <= 9000, String(ctx.length));
  assert.match(ctx, /컨벤션이 길어\(\d+자\) 내용 대신 목록을 넣습니다\. 일을 시작하기 전에 아래 문서를 모두 읽고 따릅니다\./);
  assert.ok(ctx.includes('- `.siloroot/shared/conventions/a-long.md`: 긴 약속'), ctx);
  assert.ok(ctx.includes('- `.siloroot/shared/conventions/b-short.md`: 짧은 약속 (제안)'), ctx);
  assert.doesNotMatch(ctx, /긴 약속 줄입니다/);
  // --max-chars로 한도를 낮출 수 있다(Codex 훅)
  const small = ctxOf(run(root, { args: ['--max-chars', '200'] }));
  assert.ok(small.length <= 200, small);
  assert.match(small, /문서 \d+개: `\.siloroot\/shared\/conventions\/`/);
});

test('넣을 컨벤션이 없으면 아무것도 출력하지 않는다', async () => {
  const root = await v4Project();
  // 초기화가 만든 폴더 안내(README.md)만 있다
  assert.equal(run(root), '');
});

test('컨벤션 자리가 없는 작업 공간(모양 1, 홈)은 아무것도 출력하지 않는다', async () => {
  const flat = makeProject();
  writeConfig(flat, { port: 4180 });
  write(flat, 'shared/conventions/a.md', conv('사용 중', '약속', '- 하나'));
  assert.equal(run(flat), '');
  await v4Project();
  assert.equal(loadConfig(HOME()).mode, 'home');
  write(HOME(), 'conventions/a.md', conv('사용 중', '약속', '- 하나'));
  assert.equal(run(HOME()), '');
});

test('넣은 글자 수를 사용 기록에 남긴다', async () => {
  const root = await v4Project();
  write(root, '.siloroot/shared/conventions/a.md', conv('사용 중', '약속', '- 하나'));
  const ctx = ctxOf(run(root));
  const rec = readMetrics(loadConfig(root).stateDir).filter((r) => r.stage === 'hook:conventions');
  assert.equal(rec.length, 1);
  assert.equal(rec[0].chars, ctx.length);
});

test('Claude Code와 Codex 훅 모두 세션 시작에 컨벤션 훅을 matcher 없이 건다', () => {
  for (const f of ['hooks.json', 'codex-hooks.json']) {
    const j = JSON.parse(fs.readFileSync(path.join(REPO, 'hooks', f), 'utf8'));
    const entries = j.hooks.SessionStart.filter((e) => e.hooks.some((h) => JSON.stringify(h).includes('conventions.mjs')));
    assert.equal(entries.length, 1, f);
    // matcher가 없어야 startup, resume, clear, compact, fork에서 모두 돈다
    assert.equal(entries[0].matcher, undefined, f);
  }
});
