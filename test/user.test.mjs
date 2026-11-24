import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeProject, write } from './fixtures.mjs';
import { userDir, userFile, readUser, setHome, registerProject, workspaceRoot, importPath, usedPorts, WS_REF } from '../lib/user.mjs';
import { addAdditionalDirectory } from '../lib/claude-settings.mjs';
import { writeConfig } from '../lib/config.mjs';

beforeEach(() => fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true }));
const slash = (p) => p.split(path.sep).join('/');

test('fixtures는 사용자 폴더를 임시 폴더로 바꾼다', () => {
  assert.ok(userDir().startsWith(os.tmpdir()));
  assert.equal(userFile(), path.join(userDir(), '.siloroot', 'user.json'));
});

test('user.json이 없으면 빈 값', () => {
  assert.deepEqual(readUser(), { version: 1, home: null, projects: [] });
  assert.equal(workspaceRoot('home'), null);
});

test('registerProject는 같은 경로를 다시 등록하지 않고 이름이 겹치면 -2', () => {
  const a = makeProject('앱'), b = path.join(makeProject('x'), '..', '앱'); fs.mkdirSync(b, { recursive: true });
  assert.equal(registerProject(a), '앱'); assert.equal(registerProject(a), '앱'); assert.equal(registerProject(b), '앱-2');
  assert.equal(workspaceRoot('앱-2'), slash(path.resolve(b)));
  assert.equal(registerProject(makeProject('테스트 폴더 A')), '테스트-폴더-A');
  assert.equal(registerProject(makeProject('home')), 'home-2');
  assert.equal(readUser().projects.length, 4);
});

test('Windows에서는 대소문자만 다른 같은 경로를 같은 프로젝트로 본다', { skip: process.platform !== 'win32' }, () => {
  const a = makeProject('앱');
  assert.equal(registerProject(a), '앱'); assert.equal(registerProject(a.toUpperCase()), '앱');
});

test('setHome 뒤 workspaceRoot("home")이 홈을 준다', () => {
  const h = makeProject('홈');
  setHome(h);
  assert.equal(workspaceRoot('home'), slash(path.resolve(h)));
  assert.equal(readUser().home, slash(path.resolve(h)));
});

test('user.json이 깨졌으면 읽기는 빈 값, 쓰기는 멈춘다', () => {
  write(userDir(), '.siloroot/user.json', '{ 깨짐');
  assert.equal(readUser().invalid, true); assert.equal(readUser().home, null);
  assert.throws(() => setHome('x'), /user-json-invalid/);
  assert.throws(() => registerProject(makeProject()), /user-json-invalid/);
  assert.equal(fs.readFileSync(userFile(), 'utf8'), '{ 깨짐');
});

test('importPath는 사용자 폴더 아래를 ~/로 적어 공백 든 사용자 이름을 피한다', () => {
  assert.equal(importPath(path.join(userDir(), 'siloroot-home', 'profile.md')), '~/siloroot-home/profile.md');
  const out = path.join(os.tmpdir(), 'elsewhere', 'p.md');
  assert.equal(importPath(out), slash(out));
});

test('usedPorts는 홈과 등록 프로젝트의 포트를 모으고 읽지 못하는 것은 뺀다', () => {
  const h = makeProject('홈'); writeConfig(h, { port: 4181, schema: 3, mode: 'home' }); setHome(h);
  const p = makeProject('앱'); writeConfig(p, { port: 4185, layout: 'wrapped', schema: 3 }); registerProject(p);
  registerProject(makeProject('설정 없음'));
  assert.deepEqual([...usedPorts()].sort(), [4181, 4185]);
});

test('addAdditionalDirectory는 다른 설정을 지키고 두 번째는 present', () => {
  const r = makeProject(); write(r, '.claude/settings.local.json', JSON.stringify({ permissions: { allow: ['Bash(ls)'] }, model: 'x' }));
  assert.equal(addAdditionalDirectory(r, 'C:\\h'), 'added'); assert.equal(addAdditionalDirectory(r, 'C:/h'), 'present');
  const j = JSON.parse(fs.readFileSync(path.join(r, '.claude/settings.local.json'), 'utf8'));
  assert.deepEqual(j, { permissions: { allow: ['Bash(ls)'], additionalDirectories: ['C:/h'] }, model: 'x' });
});

test('settings.local.json이 없으면 만든다', () => {
  const r = makeProject();
  assert.equal(addAdditionalDirectory(r, 'C:/h'), 'added');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(r, '.claude/settings.local.json'), 'utf8')), { permissions: { additionalDirectories: ['C:/h'] } });
});

test('settings.local.json이 JSON이 아니면 건드리지 않는다', () => {
  const r = makeProject(); const f = write(r, '.claude/settings.local.json', '// 주석\n{');
  assert.equal(addAdditionalDirectory(r, 'C:/h'), 'invalid');
  assert.equal(fs.readFileSync(f, 'utf8'), '// 주석\n{');
});

test('등록한 이름은 모두 다른 문서에서 <이름>: 꼴로 가리킬 수 있다', () => {
  const names = ['a', '_work', 'C++', 'app(old)', '테스트 폴더 A', '.hidden', 'x y', '앱'].map((n) => registerProject(makeProject(n)));
  for (const n of names) assert.match(n + ':shared/a.md', WS_REF, n);
  assert.deepEqual(names, ['a-project', 'work', 'C-project', 'app-old', '테스트-폴더-A', 'hidden', 'x-y', '앱']);
  assert.doesNotMatch('C:/x.md', WS_REF);
});
