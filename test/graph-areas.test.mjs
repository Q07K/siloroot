// 연결 그래프의 영역 계산(viewer/template.html의 @areas-start ~ @areas-end 구역)을 Node에서 돌려 본다.
// 브라우저 코드라 따로 불러올 수 없어서, 표시한 구역만 잘라 vm으로 돌린다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const TEMPLATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'viewer', 'template.html');

function areas(mode, externals = []) {
  const src = fs.readFileSync(TEMPLATE, 'utf8');
  const a = src.indexOf('// @areas-start'), b = src.indexOf('// @areas-end');
  assert.ok(a > 0 && b > a, 'template.html에 @areas-start, @areas-end 표시가 있어야 한다');
  const ctx = vm.createContext({
    window: { matchMedia: () => ({ matches: false }) },
    document: { querySelector: () => null },
    D: { mode, docs: [], externals },
    folders: [],
  });
  return vm.runInContext(src.slice(a, b) + '\n;({ areaCalc, areaOf, areaMemo, EXTF, shownFolder, rootless, AREA_KEYS, AREA_C, AREA_ICON, AREA_NAME, isProjArea, areaLabel, registerProjArea, color, foreignArea, areaViewerUrl, xpClamp, panelLayout, graphSig, freeRects })', ctx);
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

test('다른 작업 공간 영역: 프로젝트 뷰어는 home, 홈 뷰어는 프로젝트 영역', () => {
  const P = areas('project', [{ id: '@home', name: 'home', label: '홈', url: 'http://127.0.0.1:4181' }]);
  assert.equal(P.foreignArea('home'), true);
  assert.equal(P.foreignArea('shared'), false);
  assert.equal(P.foreignArea('private'), false);
  assert.equal(P.areaViewerUrl('home'), 'http://127.0.0.1:4181');
  const H = areas('home', [{ id: '@siloroot', name: 'siloroot', label: 'siloroot', url: 'http://127.0.0.1:4180' }]);
  assert.equal(H.foreignArea('home'), false);
  assert.equal(H.foreignArea('p:siloroot'), true);
  assert.equal(H.areaViewerUrl('p:siloroot'), 'http://127.0.0.1:4180');
  assert.equal(H.areaViewerUrl('p:없는-프로젝트'), null);
});

test('옆 패널 너비는 320px 이상, 그래프 판의 80% 이하', () => {
  const A = areas('project');
  assert.equal(A.xpClamp(100, 1000), 320);
  assert.equal(A.xpClamp(900, 1000), 800);
  assert.equal(A.xpClamp(500, 1000), 500);
  assert.equal(A.xpClamp(500.4, 1000), 500);
  assert.equal(A.xpClamp(500, 300), 320);
});

test('옆 패널 자리는 판 크기로 옆, 아래, 판 전체 중에 고른다', () => {
  const A = areas('project');
  assert.equal(A.panelLayout(1149, 793, 440), 'side');
  assert.equal(A.panelLayout(989, 613, 440), 'side');
  assert.equal(A.panelLayout(669, 933, 440), 'bottom');
  assert.equal(A.panelLayout(598, 758, 440), 'bottom');
  assert.equal(A.panelLayout(669, 413, 440), 'full');
  assert.equal(A.panelLayout(800, 640, 440), 'side');
  assert.equal(A.panelLayout(799, 640, 440), 'bottom');
  assert.equal(A.panelLayout(799, 639, 440), 'full');
});

test('바깥 연결만 바뀌어도 그래프 지문이 바뀐다(실시간 반영이 다시 그린다)', () => {
  const A = areas('home');
  const base = { docs: [{ path: 'study/a.md', title: 'a', folder: 'study', fm: {} }], edges: [], extEdges: [{ from: 'study/a.md', to: '@siloroot', target: 'siloroot:shared/x.md', kind: 'code' }] };
  const noRef = Object.assign({}, base, { extEdges: [] });
  const other = Object.assign({}, base, { extEdges: [{ from: 'study/a.md', to: '@siloroot', target: 'siloroot:shared/y.md', kind: 'code' }] });
  assert.notEqual(A.graphSig(base), A.graphSig(noRef));
  assert.notEqual(A.graphSig(base), A.graphSig(other));
  assert.equal(A.graphSig(base), A.graphSig(JSON.parse(JSON.stringify(base))));
});

test('빈 곳 조각: 판에서 장애물을 피한 위·아래·왼쪽·오른쪽 조각', () => {
  const A = areas('project');
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
  assert.deepEqual(plain(A.freeRects(1000, 800, [], 80)), [{ x0: 0, y0: 0, x1: 1000, y1: 800 }]);
  const panel = { x0: 600, y0: 0, x1: 1000, y1: 800 };
  const side = plain(A.freeRects(1000, 800, [panel], 80));
  assert.ok(side.some((c) => c.x0 === 0 && c.y0 === 0 && c.x1 === 600 && c.y1 === 800), JSON.stringify(side));
  assert.ok(!side.some((c) => c.x1 > 600), JSON.stringify(side));
  const legend = { x0: 0, y0: 0, x1: 200, y1: 400 };
  const both = plain(A.freeRects(1000, 800, [legend, panel], 80));
  assert.ok(both.length > 0);
  for (const c of both) assert.ok(!hit(c, legend) && !hit(c, panel), JSON.stringify(c));
  assert.deepEqual(plain(A.freeRects(1000, 800, [{ x0: -10, y0: -10, x1: 1010, y1: 810 }], 80)), [{ x0: 0, y0: 0, x1: 1000, y1: 800 }]);
});
