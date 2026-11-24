import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placesOf, localPlace, folderRules, groupOf, ROLE_LABELS } from '../lib/layout.mjs';
import { DEFAULT_DIRS } from '../lib/config.mjs';
import { VOCAB } from '../lib/vocab.mjs';

const P3 = { schema: 3, mode: 'project', dirs: {} };
const H3 = { schema: 3, mode: 'home', dirs: {} };
const P2 = { schema: 2, mode: 'project', dirs: { ...DEFAULT_DIRS } };

test('모양 2 작업 공간의 자리는 dirs에서 온다', () => {
  const p = placesOf(P2);
  assert.equal(p.study, '02-study'); assert.equal(p.decisions, '03-ideas'); assert.equal(p.profile, '05-profile/profile.md'); assert.equal(p.issues, null);
  assert.equal(p.candidates, '04-feedback'); assert.equal(p.writingGuide, 'writing-guide.md');
});

test('모양 3 프로젝트는 공부와 사용자 정보를 홈에서 찾는다', () => {
  const p = placesOf(P3);
  assert.equal(p.study, 'home:study'); assert.equal(p.candidates, 'home:feedback'); assert.equal(p.log, 'private/log');
  assert.equal(p.issues, 'shared/issues'); assert.equal(p.personalIdeas, 'home:ideas'); assert.equal(p.profile, 'home:profile.md');
  assert.equal(localPlace(p.study), null); assert.equal(localPlace(p.log), 'private/log'); assert.equal(localPlace(null), null);
});

test('모양 3 홈에는 프로젝트 자리가 없다', () => {
  const p = placesOf(H3);
  assert.equal(p.study, 'study'); assert.equal(p.personalIdeas, 'ideas'); assert.equal(p.candidates, 'feedback');
  assert.equal(p.ideas, null); assert.equal(p.issues, null); assert.equal(p.notes, null);
});

test('자리표의 역할은 ROLE_LABELS와 같다', () => {
  for (const cfg of [P2, P3, H3]) assert.deepEqual(Object.keys(placesOf(cfg)).sort(), Object.keys(ROLE_LABELS).sort());
});

test('모양 3 홈의 ideas는 결정, 설계, 로드맵도 받는다', () => {
  const r = folderRules(H3).find((x) => x.prefix === 'ideas/');
  assert.deepEqual([...r.types].sort(), ['decision', 'design', 'idea', 'roadmap']);
});

test('모양 2 folderRules는 지금 뷰어 규칙과 같다', () => {
  assert.deepEqual(folderRules(P2), [
    { prefix: '03-ideas/', types: ['idea', 'decision'] },
    { prefix: '02-study/', types: ['study'] },
    { prefix: '04-feedback/', types: ['feedback', 'rule', 'trait'] },
  ]);
});

test('groupOf는 모양 3 프로젝트에서 앞 두 마디로 묶는다', () => {
  assert.equal(groupOf('shared/ideas/a.md', P3), 'shared/ideas'); assert.equal(groupOf('shared/README.md', P3), 'shared'); assert.equal(groupOf('CLAUDE.md', P3), '(맨 위)');
  assert.equal(groupOf('03-ideas/a.md', P2), '03-ideas');
  assert.equal(groupOf('shared/ideas/a.md', P2), 'shared');
  assert.equal(groupOf('study/x/a.md', H3), 'study');
});

test('folderRules의 type은 모두 VOCAB에 있다', () => {
  for (const cfg of [P2, P3, H3]) for (const r of folderRules(cfg)) for (const t of r.types) assert.ok(VOCAB[t], `${r.prefix} ${t}`);
});
