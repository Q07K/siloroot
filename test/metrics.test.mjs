import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeConfig, updateConfig, pluginVersion } from '../lib/config.mjs';
import { clean, readMetrics } from '../lib/metrics.mjs';
import { splitTurns } from '../lib/transcript.mjs';
import { costOf } from '../lib/pricing.mjs';
import { aggregate, render } from '../scripts/metrics.mjs';
import { makeProject, write } from './fixtures.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = path.join(ROOT, 'scripts', 'metrics-turn.mjs');
const REPORT = path.join(ROOT, 'scripts', 'metrics.mjs');
// 기록에 절대 나오면 안 되는 글자. 프롬프트, 경로, 도구 입력, 도구 결과, 스킬 인자 곳곳에 심는다.
const MARK = 'PRIVATE-마커-7f3a';

// ---------- 가짜 대화 기록 ----------
const T = (s) => new Date(Date.UTC(2026, 10, 24, 1, 0, 0) + s * 1000).toISOString();
const base = { sessionId: 's-1', cwd: 'C:\\Users\\' + MARK, gitBranch: MARK };
const prompt = (s, content) => ({ ...base, type: 'user', timestamp: T(s), message: { role: 'user', content } });
const meta = (s) => ({ ...base, type: 'user', isMeta: true, timestamp: T(s), message: { role: 'user', content: [{ type: 'text', text: '스킬 본문 ' + MARK }] } });
const usage = (i, o, r, w) => ({ input_tokens: i, output_tokens: o, cache_read_input_tokens: r, cache_creation_input_tokens: w });
const asst = (s, id, u, content) => ({ ...base, type: 'assistant', timestamp: T(s), message: { id, model: 'claude-opus-5-5', role: 'assistant', usage: u, content } });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const result = (s, id) => ({ ...base, type: 'user', timestamp: T(s), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: MARK }] } });
const text = (t) => ({ type: 'text', text: t + ' ' + MARK });

// 턴 1: /siloroot:note 명령. 응답 m1이 두 줄로 나뉘어 있다(usage가 되풀이된다).
const turn1 = [
  prompt(0, `<command-message>siloroot:note</command-message>\n<command-name>/siloroot:note</command-name>\n<command-args>${MARK}</command-args>`),
  meta(0.1),
  asst(1, 'm1', usage(10, 20, 1000, 300), [{ type: 'thinking', thinking: MARK }]),
  asst(1.2, 'm1', usage(10, 20, 1000, 300), [use('u1', 'Read', { file_path: `C:\\p\\.siloroot\\02-study\\${MARK}.md` })]),
  result(1.7, 'u1'),
  asst(3, 'm2', usage(5, 50, 1300, 10), [text('답')]),
];
// 턴 2: 평범한 메시지인데 모델이 Skill 도구로 siloroot:feedback을 부른다. 다른 플러그인 스킬은 이름을 남기지 않는다.
const turn2 = [
  prompt(10, MARK + ' 처리해 줘'),
  asst(11, 'm3', usage(3, 30, 2000, 100), [use('u2', 'Skill', { skill: 'siloroot:feedback', args: MARK }), use('u3', 'Skill', { skill: 'other:thing' })]),
  result(11.5, 'u2'),
  result(11.6, 'u3'),
  asst(12, 'm4', usage(2, 40, 2100, 50), [text('끝')]),
];
// 턴 3: SiloRoot와 상관없는 작업. MCP 도구 이름은 하나로 묶는다.
const turn3 = [
  prompt(20, [{ type: 'text', text: MARK }]),
  asst(21, 'm5', usage(1, 5, 3000, 0), [use('u4', 'Bash', { command: 'ls ' + MARK }), use('u5', 'mcp__abc-123__secret_tool', {})]),
  result(22, 'u4'),
  result(22, 'u5'),
];
// 턴 4: 스킬 없이 .siloroot/ 파일을 고친다.
const turn4 = [
  prompt(30, '고쳐 줘'),
  asst(31, 'm6', usage(1, 9, 3100, 0), [use('u6', 'Edit', { file_path: '.siloroot/01-log/changelog.md', old_string: MARK })]),
  result(31.4, 'u6'),
];

const jsonl = (entries) => entries.map((e) => JSON.stringify(e)).join('\n') + '\n';

function setup(name) {
  const root = makeProject(name);
  writeConfig(root, { port: 4180, layout: 'wrapped' });
  const tp = path.join(path.dirname(root), 'transcripts', 's-1.jsonl');
  fs.mkdirSync(path.dirname(tp), { recursive: true });
  return { root, tp };
}

const runHook = (root, input) => spawnSync(process.execPath, [HOOK], {
  input: typeof input === 'string' ? input : JSON.stringify(input),
  encoding: 'utf8',
  env: { ...process.env, CLAUDE_PROJECT_DIR: root, SILOROOT_METRICS: '' },
});
const stopInput = (root, tp) => ({ session_id: 's-1', transcript_path: tp, cwd: root, hook_event_name: 'Stop', stop_hook_active: false });
const metricsText = (root) => { try { return fs.readFileSync(path.join(root, '.siloroot', 'state', 'metrics.jsonl'), 'utf8'); } catch { return ''; } };
const turnsOf = (root) => readMetrics(path.join(root, '.siloroot', 'state')).filter((r) => r.kind === 'turn');

// ---------- 턴 나누기 ----------
test('턴 나누기: 사용자 메시지마다 턴을 나누고, 같은 응답은 한 번만 세고, 단계를 스킬과 .siloroot 접근으로 정한다', () => {
  const turns = splitTurns([...turn1, ...turn2, ...turn3, ...turn4]);
  assert.deepEqual(turns.map((t) => t.stage), ['turn:siloroot:note', 'turn:siloroot:feedback', 'turn:other', 'turn:siloroot-docs']);
  // 값(Opus 5.5, 마이크로달러): m1 = 10×4 + 20×20 + 300×5(5분 캐시 쓰기) + 1000×0.2 = 2140, m2 = 5×4 + 50×20 + 10×5 + 1300×0.2 = 1330
  const { microUsd, microUsdRead, ...counts } = turns[0].tokens;
  assert.deepEqual(counts, { input: 15, output: 70, cacheRead: 2300, cacheWrite: 310, calls: 2, unpriced: 0 });
  assert.equal(Math.round(microUsd), 3470);
  assert.equal(Math.round(microUsdRead), 460);
  assert.equal(turns[0].ms, 3000);
  assert.deepEqual(turns[0].tools, { Read: 1 });
  assert.equal(turns[0].toolMs.Read, 500);
  assert.equal(turns[0].touched, true);
  assert.deepEqual(turns[1].skills, ['siloroot:feedback']);
  assert.deepEqual(turns[2].tools, { Bash: 1, mcp: 1 });
  assert.equal(turns[2].touched, false);
});

test('턴 나누기: 도구 결과가 들여온 글자 수를 도구별로 세고, .siloroot를 다룬 호출의 몫은 따로 센다', () => {
  const big = { ...result(1.7, 'u1'), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'u1', content: [{ type: 'text', text: 'abcde' }, { type: 'image', source: {} }] }] } };
  const turns = splitTurns([turn1[0], turn1[1], turn1[2], turn1[3], big, turn1[5], ...turn2, ...turn3, ...turn4]);
  assert.deepEqual(turns[0].resultChars, { Read: 5 });
  assert.equal(turns[0].docChars, 5);
  assert.deepEqual(turns[1].resultChars, { Skill: MARK.length * 2 });
  assert.equal(turns[1].docChars, 0);
  assert.deepEqual(turns[2].resultChars, { Bash: MARK.length, mcp: MARK.length });
  assert.equal(turns[2].docChars, 0);
  assert.equal(turns[3].docChars, MARK.length);
});

// ---------- 훅 ----------
test('Stop 훅: 끝난 턴마다 한 줄씩 남기고, 다시 실행하면 이미 센 턴은 다시 세지 않는다', () => {
  const { root, tp } = setup('훅 기본');
  fs.writeFileSync(tp, jsonl([...turn1, ...turn2]));
  const r1 = runHook(root, stopInput(root, tp));
  assert.equal(r1.status, 0);
  assert.equal(r1.stdout, '');
  let turns = turnsOf(root);
  assert.deepEqual(turns.map((t) => t.stage), ['turn:siloroot:note', 'turn:siloroot:feedback']);
  assert.equal(turns[0].tokens.cacheRead, 2300);
  assert.equal(turns[0].session, 's-1');
  assert.ok(turns[0].start && turns[0].end && turns[0].ms === 3000);

  runHook(root, stopInput(root, tp));
  assert.equal(turnsOf(root).length, 2);

  fs.appendFileSync(tp, jsonl(turn3));
  runHook(root, stopInput(root, tp));
  turns = turnsOf(root);
  assert.deepEqual(turns.map((t) => t.stage), ['turn:siloroot:note', 'turn:siloroot:feedback', 'turn:other']);
  const hooks = readMetrics(path.join(root, '.siloroot', 'state')).filter((r) => r.stage === 'hook:metrics-turn');
  assert.equal(hooks.length, 3);
});

test('Stop 훅: 다 쓰이지 않은 마지막 줄은 다음 실행에 읽고, 늦게 쓰인 꼬리는 앞 턴에 이어 붙인다', () => {
  const { root, tp } = setup('훅 꼬리');
  const line = JSON.stringify(asst(32, 'm7', usage(4, 6, 100, 0), [text('늦은 줄')]));
  fs.writeFileSync(tp, jsonl(turn4) + line.slice(0, 20));
  runHook(root, stopInput(root, tp));
  assert.deepEqual(turnsOf(root).map((t) => t.stage), ['turn:siloroot-docs']);

  fs.appendFileSync(tp, line.slice(20) + '\n');
  runHook(root, stopInput(root, tp));
  const turns = turnsOf(root);
  assert.equal(turns.length, 2);
  assert.equal(turns[1].cont, true);
  assert.equal(turns[1].stage, 'turn:siloroot-docs');
  assert.equal(turns[1].turns, 0);
  assert.equal(turns[1].tokens.output, 6);
});

test('Stop 훅: 위치 파일을 잃어 같은 턴을 다시 남겨도 요약은 한 번만 센다', () => {
  const { root, tp } = setup('훅 위치 잃음');
  fs.writeFileSync(tp, jsonl([...turn1, ...turn2]));
  runHook(root, stopInput(root, tp));
  fs.rmSync(path.join(root, '.siloroot', 'state', 'metrics-cursor'), { recursive: true });
  runHook(root, stopInput(root, tp));
  assert.equal(turnsOf(root).length, 4);
  const agg = aggregate(readMetrics(path.join(root, '.siloroot', 'state')));
  assert.equal(agg.turns.reduce((n, x) => n + x.count, 0), 2);
  assert.equal(agg.turns.find((x) => x.stage === 'turn:siloroot:note').workTokens, 15 + 70 + 310);
});

test('Stop 훅: 스킬을 부른 뒤 .siloroot/를 다룬 턴은 실행이 나뉘어도 어느 스킬 뒤인지 남긴다', () => {
  const { root, tp } = setup('훅 스킬 이어짐');
  fs.writeFileSync(tp, jsonl(turn1));
  runHook(root, stopInput(root, tp));
  fs.appendFileSync(tp, jsonl([...turn3, ...turn4]));
  runHook(root, stopInput(root, tp));
  const turns = turnsOf(root);
  assert.deepEqual(turns.map((x) => [x.stage, x.after]), [['turn:siloroot:note', undefined], ['turn:other', undefined], ['turn:siloroot-docs', 'siloroot:note']]);
  const agg = aggregate(readMetrics(path.join(root, '.siloroot', 'state')));
  assert.ok(agg.turns.find((x) => x.stage === 'turn:siloroot-docs (siloroot:note 뒤)'));
});

test('Stop 훅: 서브에이전트 기록의 토큰을 그 턴에 따로 더한다', () => {
  const { root, tp } = setup('훅 서브에이전트');
  fs.writeFileSync(tp, jsonl(turn1));
  write(tp.replace(/\.jsonl$/, ''), 'subagents/agent-x.jsonl', jsonl([
    { ...asst(2, 'sa1', usage(7, 70, 700, 77), [text('서브')]), isSidechain: true },
    { ...asst(2.1, 'sa1', usage(7, 70, 700, 77), [text('서브')]), isSidechain: true },
    { ...asst(99, 'sa2', usage(1, 1, 1, 1), [text('턴 밖')]), isSidechain: true },
  ]));
  runHook(root, stopInput(root, tp));
  const [t] = turnsOf(root);
  assert.deepEqual(t.sub, { input: 7, output: 70, cacheRead: 700, cacheWrite: 77, calls: 1, microUsd: 7 * 4 + 70 * 20 + 77 * 5 + 700 * 0.2, microUsdRead: 140, unpriced: 0 });
});

test('Stop 훅: 기록에는 문서 내용, 경로, 프롬프트, 다른 스킬 이름이 남지 않는다', () => {
  const { root, tp } = setup('훅 개인 정보');
  fs.writeFileSync(tp, jsonl([...turn1, ...turn2, ...turn3, ...turn4]));
  runHook(root, stopInput(root, tp));
  const all = metricsText(root) + fs.readFileSync(path.join(root, '.siloroot', 'state', 'metrics-cursor', 's-1.json'), 'utf8');
  assert.ok(all.length > 0);
  assert.ok(!all.includes(MARK), '마커가 기록에 남았다');
  assert.ok(!all.includes('Users'), '폴더 경로가 기록에 남았다');
  assert.ok(!all.includes('other:thing'));
  assert.ok(!all.includes('secret_tool'));
});

test('Stop 훅: SiloRoot 폴더가 아니거나 기록을 껐으면 아무것도 만들지 않는다', () => {
  const plain = makeProject('그냥 폴더');
  const tp = path.join(path.dirname(plain), 's-1.jsonl');
  fs.writeFileSync(tp, jsonl(turn1));
  const r = runHook(plain, stopInput(plain, tp));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.deepEqual(fs.readdirSync(plain), []);

  const off = makeProject('기록 끔');
  write(off, '.siloroot/config.json', JSON.stringify({ version: 1, port: 4180, layout: 'wrapped', metrics: false }));
  runHook(off, stopInput(off, tp));
  assert.ok(!fs.existsSync(path.join(off, '.siloroot', 'state')));

  const env = makeProject('환경 변수로 끔');
  writeConfig(env, { port: 4180, layout: 'wrapped' });
  spawnSync(process.execPath, [HOOK], { input: JSON.stringify(stopInput(env, tp)), env: { ...process.env, CLAUDE_PROJECT_DIR: env, SILOROOT_METRICS: '0' } });
  assert.ok(!fs.existsSync(path.join(env, '.siloroot', 'state')));
});

test('Stop 훅: 입력이 깨졌거나 기록 파일이 없거나 쓸 수 없어도 출력 없이 0으로 끝난다', () => {
  const { root, tp } = setup('훅 실패');
  for (const input of ['이건 JSON이 아님', { session_id: 's-1', transcript_path: tp + '.없음' }, { session_id: '../../x', transcript_path: tp }]) {
    const r = runHook(root, input);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  }
  fs.writeFileSync(tp, jsonl(turn1));
  fs.mkdirSync(path.join(root, '.siloroot', 'state', 'metrics.jsonl'), { recursive: true }); // 기록 파일 자리에 폴더가 있다
  const r = runHook(root, stopInput(root, tp));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

// ---------- 스크립트 시간 ----------
test('빌드와 알림 훅이 걸린 시간을 남기고, 기록을 못 남겨도 빌드는 성공한다', () => {
  const root = makeProject('스크립트 시간');
  // 업데이트 알림이 붙지 않는 작업 공간(모양 2에 머물기로 함, 알림 글자 수 0을 본다)
  writeConfig(root, { port: 4180, layout: 'wrapped', plugin: pluginVersion() });
  updateConfig(root, { hold: 3 });
  write(root, '.siloroot/CLAUDE.md', '# 규칙\n');
  write(root, '.siloroot/02-study/a.md', '---\ntype: study\nstatus: 이해함\n---\n\n# ' + MARK + '\n');
  const env = { ...process.env, CLAUDE_PROJECT_DIR: root, SILOROOT_METRICS: '' };
  execFileSync(process.execPath, [path.join(ROOT, 'viewer', 'build.mjs'), root], { env, stdio: 'ignore' });
  execFileSync(process.execPath, [path.join(ROOT, 'viewer', 'build.mjs'), root, '--data-only'], { env, stdio: 'ignore' });
  execFileSync(process.execPath, [path.join(ROOT, 'viewer', 'notify.mjs'), '--session'], { env, stdio: 'ignore' });
  const recs = readMetrics(path.join(root, '.siloroot', 'state'));
  const build = recs.find((r) => r.stage === 'script:build');
  assert.ok(build && build.ok === true && build.ms >= 0 && build.docs >= 1);
  assert.ok(recs.find((r) => r.stage === 'script:build:data-only'));
  assert.ok(recs.find((r) => r.stage === 'hook:notify-session' && r.chars === 0));
  assert.ok(recs.find((r) => r.kind === 'context' && r.chars >= 5));
  assert.ok(!metricsText(root).includes(MARK));

  const broken = makeProject('기록 실패');
  writeConfig(broken, { port: 4180, layout: 'wrapped' });
  fs.mkdirSync(path.join(broken, '.siloroot', 'state', 'metrics.jsonl'), { recursive: true });
  const r = spawnSync(process.execPath, [path.join(ROOT, 'viewer', 'build.mjs'), broken], { encoding: 'utf8', env: { ...env, CLAUDE_PROJECT_DIR: broken } });
  assert.equal(r.status, 0);
  assert.ok(fs.existsSync(path.join(broken, '.siloroot', 'state', 'viewer-private.html')));
});

// ---------- 값 환산 ----------
test('값 환산: 1시간 캐시 쓰기는 2배, fast는 2배, 표에 없는 모델은 값을 매기지 않는다', () => {
  const u = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 10000, cache_creation_input_tokens: 500, cache_creation: { ephemeral_1h_input_tokens: 200 } };
  // Sonnet 5.5: 입력 2, 출력 10, 5분 쓰기 2.5, 1시간 쓰기 4, 읽기 0.1
  assert.deepEqual(costOf('claude-sonnet-5-5', u), { micro: 1000 * 2 + 100 * 10 + 300 * 2.5 + 200 * 4 + 10000 * 0.1, microRead: 1000 });
  assert.equal(costOf('claude-sonnet-5-5', { ...u, speed: 'fast' }).micro, 2 * (1000 * 2 + 100 * 10 + 300 * 2.5 + 200 * 4 + 10000 * 0.1));
  assert.equal(costOf('claude-haiku-4-5', { cache_read_input_tokens: 1000 }).microRead, 100);
  assert.equal(costOf('some-other-model', u), null);
  const t = splitTurns([prompt(0, 'x'), { ...asst(1, 'z1', usage(1, 1, 1, 1), [text('a')]), message: { id: 'z1', model: 'other', usage: usage(1, 1, 1, 1), content: [] } }]);
  assert.equal(t[0].tokens.unpriced, 1);
  assert.equal(t[0].tokens.microUsd, 0);
});

// ---------- 허용 칸 ----------
test('clean: 허용한 칸과 모양만 남긴다', () => {
  const o = clean({ kind: 'turn', stage: 'turn:other', cwd: 'C:\\x', prompt: 'y', session: 'a/b', start: 'not a date',
    skills: ['siloroot:note', 'superpowers:x', MARK], tools: { Read: 1, 'C:\\a': 2 }, tokens: { input: 1, text: 2 }, resultChars: { Read: 9, [MARK]: 3 }, docChars: 4 });
  assert.deepEqual(o, { v: 1, kind: 'turn', stage: 'turn:other', docChars: 4, skills: ['siloroot:note'], tools: { Read: 1 }, tokens: { input: 1 }, resultChars: { Read: 9 } });
  assert.equal(clean({ kind: 'turn', stage: MARK }), null);
  assert.equal(clean({ kind: 'nope', stage: 'x' }), null);
});

// ---------- 요약 ----------
test('요약: 단계별로 모아 시간과 토큰을 가장 많이 쓴 단계를 보여 준다', () => {
  const { root, tp } = setup('요약');
  fs.writeFileSync(tp, jsonl([...turn1, ...turn2, ...turn3, ...turn4]));
  runHook(root, stopInput(root, tp));
  const agg = aggregate(readMetrics(path.join(root, '.siloroot', 'state')));
  assert.equal(agg.top.tokens, 'turn:siloroot:note');
  const note = agg.turns.find((x) => x.stage === 'turn:siloroot:note');
  assert.equal(note.count, 1);
  assert.equal(note.workTokens, 15 + 70 + 310);
  assert.equal(note.totalResultChars, MARK.length);
  assert.equal(note.docChars, MARK.length);
  const text = render(agg);
  assert.match(text, /결과 글자 상위/);
  assert.match(text, /비용을 가장 많이 쓴 단계: turn:siloroot:note \(전체 \$0\.\d+ .*캐시 읽기 \d+%\)/);
  assert.ok(Math.abs(note.usd - 0.00347) < 1e-6);
  assert.equal(agg.turns[0].stage, 'turn:siloroot:note');
  assert.match(text, /토큰을 가장 많이 쓴 단계: turn:siloroot:note/);
  assert.match(text, /hook:metrics-turn/);

  const json = JSON.parse(execFileSync(process.execPath, [REPORT, root, '--json'], { encoding: 'utf8' }));
  assert.equal(json.turns.length, 4);
  assert.match(execFileSync(process.execPath, [REPORT, root, '--days', '1'], { encoding: 'utf8' }), /아직 쌓인 사용 기록이 없습니다|SiloRoot 사용 기록/);

  const plain = makeProject('요약 아님');
  const r = spawnSync(process.execPath, [REPORT, plain], { encoding: 'utf8' });
  assert.equal(r.status, 1);
});
