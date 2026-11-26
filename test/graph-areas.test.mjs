// 연결 그래프의 영역 계산(viewer/template.html의 @areas-start ~ @areas-end 구역)을 Node에서 돌려 본다.
// 브라우저 코드라 따로 불러올 수 없어서, 표시한 구역만 잘라 vm으로 돌린다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'viewer', 'template.html');

function areas(mode) {
  const src = fs.readFileSync(TEMPLATE, 'utf8');
  const a = src.indexOf('// @areas-start'), b = src.indexOf('// @areas-end');
  assert.ok(a > 0 && b > a, 'template.html에 @areas-start, @areas-end 표시가 있어야 한다');
  const ctx = vm.createContext({
    window: { matchMedia: () => ({ matches: false }) },
    document: { querySelector: () => null },
    D: { mode, docs: [], externals: [] },
    folders: [],
  });
  return vm.runInContext(src.slice(a, b) + '\n;({ areaCalc, areaOf, areaMemo, EXTF, shownFolder, rootless, AREA_KEYS, AREA_C, AREA_ICON, AREA_NAME, isProjArea, areaLabel, registerProjArea, color })', ctx);
}
const addExt = (A, f) => { A.EXTF.add(f); A.areaMemo.clear(); };

test('프로젝트 모드의 영역 계산은 그대로다', () => {
  const A = areas('project');
  assert.equal(A.areaCalc('shared/ideas'), 'shared');
  assert.equal(A.areaCalc('private/notes'), 'private');
  assert.equal(A.areaCalc('(맨 위)'), 'private');
  assert.equal(A.areaCalc('home/study'), 'home');
  assert.equal(A.shownFolder('(맨 위)'), '.siloroot');
  assert.equal(A.rootless('(맨 위)'), false);
  assert.equal(A.rootless('shared'), true);
  assert.deepEqual([...A.AREA_KEYS], ['shared', 'private', 'home']);
});

test('홈 모드는 홈 문서를 home 영역, 바깥 문서를 프로젝트 영역으로 나눈다', () => {
  const A = areas('home');
  assert.equal(A.areaCalc('study'), 'home');
  assert.equal(A.areaCalc('(맨 위)'), 'home');
  addExt(A, 'siloroot');
  assert.equal(A.areaOf('siloroot'), 'p:siloroot');
  assert.equal(A.shownFolder('(맨 위)'), 'home');
  assert.equal(A.rootless('(맨 위)'), true);
  assert.equal(A.color('(맨 위)'), A.AREA_C.home);
});

test('프로젝트 영역은 한 번만 등록되고 이름표와 색을 갖는다', () => {
  const A = areas('home');
  A.registerProjArea('siloroot');
  A.registerProjArea('siloroot');
  assert.equal([...A.AREA_KEYS].filter((a) => a === 'p:siloroot').length, 1);
  assert.equal(A.AREA_C['p:siloroot'], '#6B7785');
  assert.equal(A.AREA_NAME['p:siloroot'], 'siloroot 프로젝트');
  assert.ok(A.AREA_ICON['p:siloroot']);
  assert.equal(A.isProjArea('p:siloroot'), true);
  assert.equal(A.isProjArea('home'), false);
  assert.equal(A.areaLabel('p:siloroot'), 'siloroot');
  assert.equal(A.areaLabel('shared'), 'shared');
});
