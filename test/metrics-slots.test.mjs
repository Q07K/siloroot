// 사용 기록의 자리별 문서 읽기·쓰기 세기 (shared/decisions/metrics-count-by-slot.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeProject, write } from './fixtures.mjs';
import { loadConfig, writeConfig } from '../lib/config.mjs';
import { setHome } from '../lib/user.mjs';
import { slotOf, SLOT_KEYS } from '../lib/layout.mjs';
import { clean } from '../lib/metrics.mjs';
import { splitTurns } from '../lib/transcript.mjs';
import { aggregate, render } from '../scripts/metrics.mjs';

const MARK = 'PRIVATE-마커-9b1c';

function v4() {
  const root = makeProject();
  const home = makeProject('홈 B');
  writeConfig(root, { port: 4260, layout: 'wrapped', schema: 4, mode: 'project' });
  setHome(home);
  return { root, home, cfg: loadConfig(root) };
}

test('slotOf는 문서 경로를 정해진 자리 이름으로 바꾼다', () => {
  const { cfg } = v4();
  const cases = {
    'shared/decisions/a.md': 'decisions',
    'shared/conventions/glossary.md': 'glossary',
    'shared/conventions/x.md': 'conventions',
    'shared/roadmap.md': 'roadmap',
    'shared/architecture.md': 'architecture',
    'private/open-questions.md': 'openQuestions',
    'private/worklog/2026-11-26.md': 'worklog',
    'shared/ideas/README.md': 'index',
    'CLAUDE.md': 'rules',
    'metadata-guide.md': 'rules',
    [`private/${MARK}/x.md`]: 'other',
    'home:study/a.md': 'home:study',
    'home:worklog/2026-11-26.md': 'home:worklog',
    'home:profile.md': 'home:profile',
    [`home:${MARK}.md`]: 'home:other',
  };
  for (const [doc, want] of Object.entries(cases)) {
    assert.equal(slotOf(cfg, doc), want, doc);
    assert.ok(SLOT_KEYS.has(want), want);
  }
});

const T = (s) => new Date(Date.UTC(2026, 10, 26, 1, 0, 0) + s * 1000).toISOString();
const prompt = (s, cwd) => ({ type: 'user', cwd, timestamp: T(s), message: { role: 'user', content: '해 줘 ' + MARK } });
const asst = (s, id, cwd, content) => ({ type: 'assistant', cwd, timestamp: T(s), message: { id, model: 'claude-opus-5-5', role: 'assistant', usage: { input_tokens: 1, output_tokens: 1 }, content } });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const result = (s, id, cwd) => ({ type: 'user', cwd, timestamp: T(s), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'abc' }] } });

test('splitTurns는 cfg가 있으면 자리별 참고 읽기, 고친 문서, 코드 수정을 센다', () => {
  const { root, home, cfg } = v4();
  const S = (rel) => path.join(root, '.siloroot', rel);
  const dec = write(root, '.siloroot/shared/decisions/a.md', '# a\n');
  const wl = write(root, '.siloroot/private/worklog/2026-11-26.md', '# w\n');
  const note = write(home, 'study/n.md', '# n\n');
  const entries = [
    // 턴 1: 결정을 두 번 읽고, 작업 일지를 읽은 뒤 고치고, 코드를 고치고, 상태 파일을 읽는다
    prompt(0, root),
    asst(1, 'a1', root, [
      use('t1', 'Read', { file_path: dec }), use('t2', 'Read', { file_path: dec }),
      use('t3', 'Read', { file_path: wl }), use('t4', 'Edit', { file_path: wl }),
      use('t5', 'Edit', { file_path: path.join(root, 'src', 'a.js') }),
      use('t6', 'Read', { file_path: S('state/metrics.jsonl') }),
    ]),
    ...['t1', 't2', 't3', 't4', 't5', 't6'].map((id, i) => result(2 + i * 0.1, id, root)),
    // 턴 2: 상태 파일만 읽는다 → 문서 턴이 아니다
    prompt(10, root),
    asst(11, 'a2', root, [use('t7', 'Read', { file_path: S('config.json') })]),
    result(11.5, 't7', root),
    // 턴 3: 홈 공부 노트를 읽는다 → 문서 턴
    prompt(20, root),
    asst(21, 'a3', root, [use('t8', 'Read', { file_path: note })]),
    result(21.5, 't8', root),
    // 턴 4: 스크립트로 문서를 다룬다(명령에 .md 경로가 없다)
    prompt(30, root),
    asst(31, 'a4', root, [use('t9', 'Bash', { command: 'cd .siloroot && node -e "fix(\'shared\')"' })]),
    result(31.5, 't9', root),
  ];
  const [t1, t2, t3, t4] = splitTurns(entries, { cfg });
  assert.deepEqual(t1.docReads, { decisions: 1 });
  assert.deepEqual(t1.docEdits, { worklog: 1 });
  assert.equal(t1.codeEdits, 1);
  assert.equal(t1.docScripts, 0);
  assert.equal(t1.touched, true);
  assert.equal(t1.stage, 'turn:siloroot-docs');
  assert.equal(t1.docChars, 'abc'.length * 4);

  assert.equal(t2.touched, false);
  assert.equal(t2.stage, 'turn:other');
  assert.equal(t2.docChars, 0);

  assert.deepEqual(t3.docReads, { 'home:study': 1 });
  assert.equal(t3.touched, true);

  assert.equal(t4.docScripts, 1);
  assert.deepEqual(t4.docReads, {});
  assert.equal(t4.touched, true);
});

test('clean은 자리 이름표에 있는 이름만 남기고 경로를 남기지 않는다', () => {
  const o = clean({ kind: 'turn', stage: 'turn:other', docReads: { decisions: 2, [MARK]: 1, 'C:\\x': 1 }, docEdits: { 'home:study': 1 }, codeEdits: 0, docScripts: 3 });
  assert.deepEqual(o.docReads, { decisions: 2 });
  assert.deepEqual(o.docEdits, { 'home:study': 1 });
  assert.equal(o.codeEdits, 0);
  assert.equal(o.docScripts, 3);
  assert.ok(!JSON.stringify(o).includes(MARK));
});

test('요약은 새 턴 기록을 활용, 코드만, 문서 일, 기록만으로 나누고 옛 기록은 따로 센다', () => {
  const t = (s, extra, session = 's') => ({ v: 1, kind: 'turn', stage: 'turn:siloroot-docs', session, start: T(s), end: T(s + 1), ms: 1000, turns: 1, ...extra });
  const records = [
    t(0, { docReads: { decisions: 1 }, codeEdits: 2 }), // 활용
    t(10, { codeEdits: 1, docReads: { worklog: 1 } }), // 코드만(작업 일지는 참고가 아니다)
    t(20, { docReads: { roadmap: 1 }, codeEdits: 0 }), // 문서 일
    t(30, { docEdits: { worklog: 1 }, codeEdits: 0 }), // 기록만
    t(40, { codeEdits: 0, docScripts: 1 }), // 스크립트
    t(50, { codeEdits: 0 }), // 안 건드림
    // 위치를 잃고 이어진 같은 턴(cont)은 앞 턴에 더한다: 턴 50이 코드만이 된다
    { ...t(50.5, { codeEdits: 1, turns: 0 }), cont: true },
    t(60, {}), // 옛 기록
  ];
  const agg = aggregate(records);
  assert.deepEqual(agg.use, { use: 1, codeOnly: 2, docWork: 1, recordOnly: 1, script: 1, none: 0, old: 1 });
  assert.equal(agg.slots.decisions.read, 1);
  assert.equal(agg.slots.worklog.read, 1);
  assert.equal(agg.slots.worklog.edit, 1);
  const out = render(agg);
  assert.match(out, /턴 나눔/);
  assert.match(out, /활용/);
  assert.match(out, /자리별/);
});
