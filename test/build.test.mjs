import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeConfig, loadConfig } from '../lib/config.mjs';
import { userDir } from '../lib/user.mjs';
import { initProject } from '../scripts/init.mjs';
import { makeProject, write } from './fixtures.mjs';

const BUILD = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'viewer', 'build.mjs');
const build = (root) => execFileSync(process.execPath, [BUILD, root], { encoding: 'utf8' });
const dataOf = (root) => {
  const html = fs.readFileSync(path.join(root, '.siloroot', 'state', 'viewer-private.html'), 'utf8');
  const m = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  return JSON.parse(m[1]);
};

test('설정의 study 폴더에서 공부 노트와 이해도를 읽는다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180, dirs: { study: '02-study' } });
  write(root, '02-study/radius.md', '---\ntype: study\nstatus: 통과\ncreated: 2026-11-22\n---\n\n# radius\n');
  write(root, '02-study/README.md', '---\ntype: index\nstatus: 사용 중\n---\n\n# 공부\n\n| 주제 | 처음 본 날 | 이해도 | 관련 |\n| --- | --- | --- | --- |\n| [radius](radius.md) | 2026-11-22 | 통과 | 없음 |\n');
  build(root);
  const d = dataOf(root);
  assert.equal(d.objects.study.length, 1);
  assert.equal(d.objects.study[0].level, '통과');
});

test('ideas 폴더 문서의 type이 idea나 decision이 아니면 경고', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '03-ideas/a.md', '---\ntype: study\nstatus: 통과\n---\n\n# a\n');
  const out = build(root);
  assert.match(out, /이 폴더의 type은 idea 또는 decision여야 함/);
});

test('ideas 폴더의 decision 문서는 경고 없이 아이디어 목록에서 빠진다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '03-ideas/app.md', '---\ntype: idea\nstatus: 진행 중\nrelated: [03-ideas/app-decision-db.md]\n---\n\n# 앱\n');
  write(root, '03-ideas/app-decision-db.md', '---\ntype: decision\nstatus: 확정\nrelated: [03-ideas/app.md]\n---\n\n# DB 고르기\n');
  const out = build(root);
  assert.match(out, /속성 점검: 경고 0개/);
  const d = dataOf(root);
  assert.deepEqual(d.objects.ideas.map((i) => i.doc), ['03-ideas/app.md']);
});

test('결과물은 .siloroot/state에 쓰고 _viewer는 만들지 않는다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  build(root);
  assert.ok(fs.existsSync(path.join(root, '.siloroot', 'state', 'viewer-private.html')));
  assert.ok(!fs.existsSync(path.join(root, '_viewer')));
});

test('빈 폴더도 경고 0개로 만들고 장부 주장은 비어 있다', () => {
  const root = makeProject();
  const out = build(root);
  assert.match(out, /속성 점검: 경고 0개/);
  assert.deepEqual(dataOf(root).objects.claims, []);
});

test('--seen-path는 그 문서 하나만 비교 기준을 새로 잡는다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '02-study/a.md', '---\ntype: study\nstatus: 검증 전\n---\n\n# a\n');
  write(root, '02-study/b.md', '---\ntype: study\nstatus: 검증 전\n---\n\n# b\n');
  execFileSync(process.execPath, [BUILD, root, '--seen']);
  write(root, '02-study/a.md', '---\ntype: study\nstatus: 검증 전\n---\n\n# a\n\n한 줄 더\n');
  write(root, '02-study/b.md', '---\ntype: study\nstatus: 검증 전\n---\n\n# b\n\n한 줄 더\n');
  write(root, '02-study/c.md', '---\ntype: study\nstatus: 검증 전\n---\n\n# c\n');
  execFileSync(process.execPath, [BUILD, root, '--seen-path', '02-study/a.md']);
  execFileSync(process.execPath, [BUILD, root, '--seen-path', '02-study/c.md']);
  const ch = dataOf(root).changes;
  assert.deepEqual(ch.modified.map((m) => m.path), ['02-study/b.md']);
  assert.deepEqual(ch.added, []);
});

test('feedback 폴더의 trait 문서는 경고 없이 읽는다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '04-feedback/trait-2026-11-22-001.md', '---\ntype: trait\nstatus: 제안\ncreated: 2026-11-22\n---\n\n# 사용자 정보 후보: 결론부터\n');
  assert.match(build(root), /속성 점검: 경고 0개/);
});

test('나 화면 데이터: 승인된 profile 행, 기다리는 후보, 거절한 후보, 쓰지 않는 표현을 모은다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '04-feedback/trait-2026-11-22-001.md', '---\ntype: trait\nstatus: 반영\ncreated: 2026-11-22\n---\n\n# 사용자 정보 후보: 결론부터\n\n## 제안하는 항목\n\n| 구분 | 항목 | 내용 |\n| --- | --- | --- |\n| 소통 | 결론부터 | 결론을 먼저 말한다 |\n\n## 근거\n\n- 2026-11-22, 대화: "짧게"\n- 2026-11-23, 대화: "결론만"\n\n## 메모\n');
  write(root, '04-feedback/trait-2026-11-22-002.md', '---\ntype: trait\nstatus: 제안\ncreated: 2026-11-22\n---\n\n# 사용자 정보 후보: 표로 정리\n\n## 제안하는 항목\n\n| 구분 | 항목 | 내용 |\n| --- | --- | --- |\n| 작업 방식 | 표로 정리 | 비교는 표로 |\n\n## 근거\n\n- 2026-11-22, 대화: "표로"\n');
  write(root, '04-feedback/trait-2026-11-22-003.md', '---\ntype: trait\nstatus: 거절\ncreated: 2026-11-22\n---\n\n# 사용자 정보 후보: 영어로\n\n## 제안하는 항목\n\n| 구분 | 항목 | 내용 |\n| --- | --- | --- |\n| 소통 | 영어로 | 영어로 답한다 |\n\n## 근거\n\n- 2026-11-22, 대화: "영어"\n\n## 메모\n\n- 2026-11-22 사용자: "아니"\n');
  write(root, '05-profile/profile.md', '---\ntype: ledger\nstatus: 사용 중\n---\n\n# 사용자 정보\n\n## 작업 방식\n\n| 항목 | 내용 | 근거 | 승인 |\n| --- | --- | --- | --- |\n\n## 소통\n\n| 항목 | 내용 | 근거 | 승인 |\n| --- | --- | --- | --- |\n| 결론부터 | 결론을 먼저 말한다 | `04-feedback/trait-2026-11-22-001.md` | 2026-11-22 |\n');
  write(root, 'writing-guide.md', '---\ntype: guide\nstatus: 사용 중\n---\n\n# 글쓰기\n\n## 1. 쓰지 않는 표현\n\n| 쓰지 않는 것 | 바꿔 쓰는 법 | 출처 |\n| --- | --- | --- |\n| 대시 | 문장을 나눈다 | 본인 |\n');
  assert.match(build(root), /속성 점검: 경고 0개/);
  const me = dataOf(root).objects.me;
  assert.deepEqual(me.groups, ['작업 방식', '소통']);
  assert.equal(me.approved.length, 1);
  assert.equal(me.approved[0].group, '소통');
  assert.equal(me.approved[0].source, '04-feedback/trait-2026-11-22-001.md');
  assert.equal(me.approved[0].evidence.length, 2);
  assert.deepEqual(me.pending.map((t) => t.item), ['표로 정리']);
  assert.deepEqual(me.rejected.map((r) => r.title), ['영어로']);
  assert.deepEqual(me.writing.banned.map((w) => w.name), ['대시']);
  assert.equal(me.writing.principles.length, 0);
});

test('profile 행의 근거 후보 파일이 없거나 반영 상태가 아니면 경고', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '04-feedback/trait-2026-11-22-001.md', '---\ntype: trait\nstatus: 제안\n---\n\n# 사용자 정보 후보: 가\n');
  write(root, '05-profile/profile.md', '---\ntype: ledger\nstatus: 사용 중\n---\n\n# 사용자 정보\n\n## 작업 방식\n\n| 항목 | 내용 | 근거 | 승인 |\n| --- | --- | --- | --- |\n| 가 | 가 | `04-feedback/trait-2026-11-22-001.md` | 2026-11-22 |\n| 나 | 나 | `04-feedback/trait-없음.md` | 2026-11-22 |\n');
  const out = build(root);
  assert.match(out, /속성 점검: 경고 2개/);
  assert.match(out, /"가"의 근거 .*status가 "반영"이 아님/);
  assert.match(out, /"나"의 근거 "04-feedback\/trait-없음\.md" 후보 파일을 찾지 못함/);
});

test('나 화면은 설정의 profile, feedback 폴더 이름을 따른다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180, dirs: { feedback: 'fb', profile: 'me' } });
  write(root, 'fb/trait-2026-11-22-001.md', '---\ntype: trait\nstatus: 반영\n---\n\n# 사용자 정보 후보: 가\n');
  write(root, 'me/profile.md', '---\ntype: ledger\nstatus: 사용 중\n---\n\n# 사용자 정보\n\n## 공부\n\n| 항목 | 내용 | 근거 | 승인 |\n| --- | --- | --- | --- |\n| 가 | 가 | `fb/trait-2026-11-22-001.md` | 2026-11-22 |\n');
  build(root);
  const me = dataOf(root).objects.me;
  assert.equal(me.profile, 'me/profile.md');
  assert.equal(me.approved.length, 1);
});

test('공부 노트에 tags(분야)가 없으면 경고', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '02-study/a.md', '---\ntype: study\nstatus: 검증 전\n---\n\n# a\n');
  assert.match(build(root), /tags에 분야가 없음/);
});

test('나 화면 레이더: 다섯 축, 계산식, 하루 한 줄 추이, 코멘트 자리', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '02-study/a.md', '---\ntype: study\nstatus: 통과\ntags: [백엔드]\n---\n\n# a\n');
  write(root, '02-study/b.md', '---\ntype: study\nstatus: 부분\ntags: [AI 검색, RAG]\n---\n\n# b\n');
  write(root, '03-ideas/x.md', '---\ntype: idea\nstatus: 완료\n---\n\n# x\n');
  write(root, '03-ideas/y.md', '---\ntype: idea\nstatus: 진행 중\n---\n\n# y\n');
  assert.doesNotMatch(build(root), /tags에 분야가 없음/);
  build(root);   // 같은 날 다시 만들어도 추이는 한 줄
  const me = dataOf(root).objects.me;
  assert.deepEqual(me.radar.axes.map((a) => a.key), ['depth', 'breadth', 'finish', 'steady', 'taming']);
  const ax = Object.fromEntries(me.radar.axes.map((a) => [a.key, a.value]));
  assert.equal(ax.depth, 75);      // (통과 1 + 0.5 x 부분 1) / 2
  assert.equal(ax.breadth, 33);    // 분야 2 / 목표 6
  assert.equal(ax.finish, 25);     // (질문 0 + 아이디어 1/2) / 2
  assert.ok(me.radar.axes.every((a) => a.formula && a.target));
  assert.equal(me.comment.doc, '05-profile/ai-comment.md');
  assert.equal(me.comment.mtime, 0);
  const lines = fs.readFileSync(path.join(root, '.siloroot', 'state', 'me-history.jsonl'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).v.depth, 75);
});

test('뷰어 탭 제목 앞에 프로젝트 폴더 이름을 둔다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, 'a.md', '---\ntype: note\nstatus: 사용 중\n---\n\n# a\n');
  build(root);
  const html = fs.readFileSync(path.join(root, '.siloroot', 'state', 'viewer-private.html'), 'utf8');
  assert.ok(html.includes('<title>' + path.basename(root) + ' · SiloRoot</title>'));
  assert.ok(!html.includes('__PAGE_TITLE__'));
});

// ---- 모양 3: 자리표, 바깥 점, 방향 경고 ----
const HOME = () => path.join(userDir(), 'siloroot-home');
const freshV3 = async (name) => {
  fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
  fs.rmSync(HOME(), { recursive: true, force: true });
  const root = makeProject(name);
  await initProject(root, { home: HOME() });
  return root;
};
const issuesOf = (d, doc) => d.objects.issues.filter((x) => !doc || x.doc === doc);

test('모양 3 프로젝트의 폴더 묶음은 앞 두 마디', async () => {
  const root = await freshV3();
  write(root, '.siloroot/shared/ideas/a.md', '---\ntype: idea\nstatus: 아이디어\n---\n\n# a\n');
  build(root);
  const d = dataOf(root);
  assert.equal(d.docs.find((x) => x.path === 'shared/ideas/a.md').folder, 'shared/ideas');
  assert.equal(d.docs.find((x) => x.path === 'CLAUDE.md').folder, '(맨 위)');
  assert.equal(d.mode, 'project'); assert.equal(d.schema, 3);
  assert.deepEqual(d.objects.ideas.map((x) => x.doc), ['shared/ideas/a.md']);
});

test('home: 연결은 바깥 점 하나로 모이고 문서 연결에는 섞이지 않는다', async () => {
  const root = await freshV3();
  write(root, '.siloroot/private/notes/n.md', '---\ntype: note\nstatus: 사용 중\nrelated: [home:study/a.md]\n---\n\n# n\n\n`home:study/b.md`\n');
  build(root);
  const d = dataOf(root);
  // 규칙 블록(CLAUDE.md)도 home: 경로를 적어서 홈 점에 이어진다. 여기서는 노트의 연결만 본다
  assert.deepEqual(d.externals.map((x) => x.id), ['@home']); assert.equal(d.externals[0].label, '홈');
  assert.equal(d.externals[0].url, 'http://127.0.0.1:' + loadConfig(HOME()).port);
  const mine = d.extEdges.filter((e) => e.from === 'private/notes/n.md');
  assert.equal(mine.length, 2); assert.ok(!d.edges.some((e) => e.to.startsWith('@')));
  assert.deepEqual(mine.map((e) => e.target).sort(), ['home:study/a.md', 'home:study/b.md']);
  assert.ok(mine.every((e) => e.to === '@home'));
  assert.ok(!d.objects.issues.some((x) => x.msg.includes('찾지 못함')));
});

test('등록 안 된 이름은 related에서만 경고하고 C:/와 https://는 경로로 읽지 않는다', async () => {
  const root = await freshV3();
  write(root, '.siloroot/private/notes/n.md', '---\ntype: note\nstatus: 사용 중\nrelated: [foo:a.md]\n---\n\n# n\n\n`C:/x.md` `https://a.md` `foo:b.md`\n');
  build(root);
  const d = dataOf(root);
  const w = issuesOf(d, 'private/notes/n.md');
  assert.equal(w.length, 1); assert.match(w[0].msg, /related의 "foo:a\.md": 작업 공간 "foo"를 user\.json에서 찾지 못함/);
  assert.deepEqual(d.extEdges.filter((e) => e.from === 'private/notes/n.md'), []);
  assert.ok(!d.externals.some((x) => x.name === 'foo' || x.name === 'https'));
});

test('한글 이름 프로젝트를 가리키는 연결도 바깥 점이 된다', async () => {
  const root = await freshV3('앱');
  const other = makeProject('테스트 폴더 A'); await initProject(other);
  write(root, '.siloroot/private/notes/n.md', '---\ntype: note\nstatus: 사용 중\n---\n\n# n\n\n`테스트-폴더-A:shared/issues/x.md`\n');
  build(root);
  const d = dataOf(root);
  const ext = d.externals.find((x) => x.id === '@테스트-폴더-A');
  assert.ok(ext); assert.equal(ext.label, '테스트-폴더-A');
  assert.equal(ext.url, 'http://127.0.0.1:' + loadConfig(other).port);
  assert.ok(d.extEdges.some((e) => e.from === 'private/notes/n.md' && e.to === '@테스트-폴더-A'));
});

test('shared 문서가 private나 홈을 가리키면 경고한다', async () => {
  const root = await freshV3();
  write(root, '.siloroot/private/notes/n.md', '---\ntype: note\nstatus: 사용 중\n---\n\n# n\n');
  write(root, '.siloroot/shared/ideas/i.md', '---\ntype: idea\nstatus: 아이디어\nrelated: [private/notes/n.md, home:study/a.md]\n---\n\n# i\n\n`private/notes/n.md`\n');
  build(root);
  const w = issuesOf(dataOf(root), 'shared/ideas/i.md');
  assert.equal(w.length, 2);
  assert.ok(w.every((x) => x.msg.startsWith('공유 문서가 팀원이 볼 수 없는 ')));
});

test('모양 3 프로젝트는 "나" 데이터가 없고 홈 주소를 싣는다', async () => {
  const root = await freshV3();
  build(root);
  const d = dataOf(root);
  assert.equal(d.objects.me, null);
  assert.deepEqual(d.home, { label: '홈', url: 'http://127.0.0.1:' + loadConfig(HOME()).port });
});

test('홈 빌드는 "나" 데이터를 홈의 profile과 feedback에서 읽는다', async () => {
  await freshV3();
  const home = HOME();
  write(home, 'feedback/trait-2026-11-24-001.md', '---\ntype: trait\nstatus: 반영\ncreated: 2026-11-24\n---\n\n# 사용자 정보 후보: 짧게\n\n## 제안하는 항목\n\n| 구분 | 항목 | 내용 |\n| --- | --- | --- |\n| 소통 | 길이 | 짧게 |\n');
  const profile = fs.readFileSync(path.join(home, 'profile.md'), 'utf8').replace('## 소통\n\n| 항목 | 내용 | 근거 | 승인 |\n| --- | --- | --- | --- |\n', '## 소통\n\n| 항목 | 내용 | 근거 | 승인 |\n| --- | --- | --- | --- |\n| 길이 | 짧게 | `feedback/trait-2026-11-24-001.md` | 2026-11-24 |\n');
  fs.writeFileSync(path.join(home, 'profile.md'), profile);
  const out = build(home);
  const d = dataOf(home);
  assert.equal(d.objects.me.approved.length, 1); assert.equal(d.objects.me.profile, 'profile.md');
  assert.equal(d.home, null); assert.equal(d.mode, 'home');
  assert.match(out, /속성 점검: 경고 0개/);
});

test('새 type은 자기 폴더에서 경고 없이, 다른 폴더에서는 경고', async () => {
  const root = await freshV3();
  write(root, '.siloroot/shared/issues/x.md', '---\ntype: issue\nstatus: 열림\n---\n\n# x\n');
  write(root, '.siloroot/shared/ideas/y.md', '---\ntype: issue\nstatus: 열림\n---\n\n# y\n');
  build(root);
  const d = dataOf(root);
  assert.equal(issuesOf(d, 'shared/issues/x.md').length, 0);
  assert.match(issuesOf(d, 'shared/ideas/y.md')[0].msg, /이 폴더의 type은 idea여야 함/);
});

test('모양 2 빌드에는 바깥 점과 홈 주소가 없다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180, layout: 'wrapped' });
  write(root, '.siloroot/01-log/n.md', '---\ntype: log\nstatus: 사용 중\n---\n\n# n\n\n`home:study/a.md`\n');
  build(root);
  const d = dataOf(root);
  assert.deepEqual(d.externals, []); assert.deepEqual(d.extEdges, []); assert.equal(d.home, null);
  assert.ok(d.objects.me);
});
