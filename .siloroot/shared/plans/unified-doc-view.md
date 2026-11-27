---
type: plan
status: 완료
created: 2026-11-26
related: [shared/design/unified-doc-view.md, shared/requirements/unified-doc-view.md, shared/ideas/own-node-side-panel.md, shared/conventions/viewer-responsive.md, shared/conventions/reuse-existing-implementation.md]
---

# 한 문서 뷰 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문서 화면과 연결 그래프 옆 패널이 같은 문서 뷰 함수로 문서를 그리고, 내 노드와 바깥 노드 모두 누르면 옆 패널에 그 문서 뷰가 열리며, 패널과 흔적 상자가 분할 화면 크기에 맞게 자리를 바꾼다.

**Architecture:** `viewDoc`이 `#view`에 직접 쓰던 것을 `renderDocView(host, p, opts)`로 바꿔 문서 화면과 패널이 함께 부른다. 0.8.6 옆 패널 틀(`#xpanel`, 너비 손잡이, 너비 기억)은 그대로 쓰고 내용만 문서 뷰로 바꾼다. 정보 상자(`#ginfo`, `select`)는 없앤다. 크기·자리 판정과 빈 곳 계산은 DOM 없는 함수로 `@areas` 구역에 두어 Node에서 시험한다.

**Tech Stack:** Node 표준 라이브러리, `node:test`, 브라우저 바닐라 JS(한 파일 템플릿 `viewer/template.html`).

**Spec:** `shared/design/unified-doc-view.md`(승인 2026-11-26). 시안: `shared/ideas/own-node-side-panel-mockup-h-960x1040.jpg`(패널 자리만), `shared/ideas/own-node-side-panel-mockup-h-640x1040.jpg`, `shared/ideas/own-node-side-panel-mockup-j.jpg`. 시안 코드(참고만): 스크래치패드 `tools/make-mock.mjs`의 `mockReveal`, `RESP_JS`, `__mockTrail`.

경로 메모: 이 문서와 설계는 `C:\Users\<나>\github\q07k\siloroot\.siloroot\` 아래에 있다. 저장소 파일 경로는 저장소 맨 위 기준이다. 줄 번호는 0.8.6 `main` 기준이라 앞 작업으로 밀릴 수 있다. 함수 이름으로 찾는다.

## Global Constraints

- 일을 시작하기 전에 `.siloroot/shared/conventions/`를 모두 읽는다(특히 `reuse-existing-implementation.md`, `viewer-responsive.md`, `web-mockup-real-screen.md`).
- 최신 `main`에서 `feat/unified-doc-view` 브랜치를 딴다. `main`에 바로 커밋하지 않는다.
- 문서 화면(`#doc/...`)의 지금 동작은 그대로: 편집, 댓글, 목차, 실시간 반영, 저장·댓글·취소 뒤 페이지 새로 고침.
- 옆 패널 너비: 처음 440px, 최소 320px, 최대 그래프 판(`.gwrap`) 너비의 80%(`xpClamp`). 끌기, 두 번 누르면 440px, 화살표 24px. 저장 키 `fv-xpanel-w`.
- 패널 자리: 패널 옆에 그래프가 360px 이상 남으면 오른쪽, 아니고 판 높이 640px 이상이면 아래(판 아래 58%), 둘 다 아니면 판 전체. 아래와 판 전체에서는 너비 손잡이를 숨긴다.
- 흔적 단추에 화살표나 숫자를 달지 않는다. 단추는 지금처럼 켜고 끄기(`GS.trail`).
- 흔적 상자 자리: 패널 닫힘이면 흔적 단추 바로 아래(판 오른쪽 위), 오른쪽 패널이면 패널 왼쪽 위, 아래·판 전체 패널이면 열린 동안 숨김. 숨긴 동안에도 흔적 선과 번호는 보인다.
- 흔적 상자(`#gtrailbox`)는 지금 `class="ginfo"`를 같이 쓴다. 정보 상자를 없앨 때 흔적 상자 모양이 바뀌지 않게 CSS를 옮긴다.
- 바깥 문서는 읽기만 한다. 편집, 댓글, 피드백 칸, "이 문서가 가리키는 문서", 수정 시각을 그리지 않는다.
- 확인할 화면 크기: 1920×1040, 1280×720, 960×1040, 960×520, 640×1040(`viewer-responsive.md`).
- `SCHEMA`와 버전은 그대로. `CHANGELOG.md` "다음" 절에 줄을 더한다. README 두 벌을 함께 고친다.
- 커밋, PR 본문에 실명, 회사, 고객사 이름을 쓰지 않는다.

## Review Focus

- 패널에서 본문을 고치는 중에 AI가 같은 문서를 바꿈: 끼어들지 않고 미뤘다가 쓰기가 끝나면 반영. 저장은 지금처럼 `hash`가 다르면 오류를 보이고 쓴 글은 남는다. → Task 7 화면 확인
- 패널에 연 문서가 디스크에서 지워짐: 실시간 반영 뒤 패널이 닫히고 강조가 풀린다. → Task 5 화면 확인
- 패널 안 링크가 필터로 숨긴 문서를 가리킴: 패널만 바뀌고 강조는 비운다. 필터를 다시 켜면 강조가 돌아온다. → Task 5 화면 확인
- 패널을 연 채 창 크기를 바꿔 기준(360, 640)을 넘나듦: 패널 자리와 흔적 상자 자리가 다시 정해진다. → Task 4 테스트(`panelLayout`), Task 6 테스트(`trailSpot`), 화면 확인
- 본문을 못 읽은 바깥 문서(`extTexts` 값 `null`): "본문을 읽지 못했습니다."만, 속성 칩 없음, 오류 없음. → Task 1 테스트(`extFms` null), Task 3 화면 확인

---

### Task 1: 빌드가 바깥 문서 속성을 싣는다

**Files:**
- Modify: `viewer/build.mjs:243-256`(바깥 문서 제목·본문 읽기), `viewer/build.mjs:543`(data)
- Test: `test/build.test.mjs`(`extTexts` 테스트 옆)

**Interfaces:**
- Produces: `D.extFms: { [target: string]: object | null }`. 키는 `extTitles`와 같다. 값은 `parseFrontmatter(text)`가 내는 내 문서 `d.fm`과 같은 모양, 못 읽었거나 속성이 없으면 `null`.

- [ ] **Step 1: 실패하는 테스트**: `test('바깥 문서 속성은 가리킨 문서만 싣고, 없는 문서는 null', ...)`. `extTexts` 테스트와 같은 준비에서 `const f = dataOf(root).extFms;` 뒤 `assert.equal(f['home:study/a.md'].type, <준비한 a.md의 type 값>)`, `assert.equal(f['home:study/b.md'], null)`, `assert.ok(!('home:study/c.md' in f))`. 준비한 `a.md`에 속성이 없으면 `type: note`, `status: 사용 중`을 더한다.
- [ ] **Step 2: 실행해 실패 확인**: `node --test test/build.test.mjs` → `extFms` undefined로 실패.
- [ ] **Step 3: 구현**: `extTitles`를 채우는 반복에서 `extFms[e.target]`를 처음 `null`, 읽으면 `parseFrontmatter(text)`(빈 객체면 `null`). `data`에 `extFms`를 더한다.
- [ ] **Step 4: 실행해 통과 확인**: `node --test test/build.test.mjs` → 모두 통과.
- [ ] **Step 5: 커밋**: `feat: 뷰어 데이터에 바깥 문서 속성을 싣는다`

### Task 2: 문서 뷰 함수 하나

**Files:**
- Modify: `viewer/template.html` `viewDoc`(`:912-951`), `wireDocTools`(`:1149-1180`)

**Interfaces:**
- Produces(전역):
  - `renderDocView(host: Element, p: string, opts: { mode: 'page' | 'panel', onSaved?: () => void, onCancel?: () => void, onCommented?: () => void }): boolean`. `host`의 내용을 문서 뷰로 바꾼다. 문서를 못 찾으면 지금 문구("문서를 찾지 못했습니다: …")를 그리고 `false`.
  - `viewDoc(p)` = `renderDocView($('#view'), p, { mode: 'page' })`. `page` 모드의 `onSaved`, `onCancel`, `onCommented`는 지금처럼 `location.reload()`(댓글은 600ms, 저장은 500ms 뒤).
  - `wireDocTools(host: Element, d, opts)`: 요소를 `host.querySelector`로 찾는다. id(`#art`, `#ctext`, `#etext`, `#csend`, `#btnEdit`, `#esave`, `#ecancel`, `#cmsg`, `#emsg`, `#cquote`, `#toc`)는 그대로 둔다. 문서 화면과 패널은 같은 화면에 함께 있지 않아서 id가 겹치지 않고, `busy()`와 `flashChanges`가 지금 id를 그대로 쓸 수 있다.
  - 목차 연결도 `host.querySelectorAll('.md h1, .md h2, .md h3')`.

- [ ] **Step 1: 구현**: 위 Interfaces대로 나눈다. 그리는 HTML은 한 글자도 바꾸지 않는다(이 작업은 자리만 옮김).
- [ ] **Step 2: 화면 확인**: `.claude/launch.json`의 `repo-project-viewer`(이 저장소 코드로 프로젝트 작업 공간, 4199)를 띄운다. 문서 화면에서 목차 누르기, 문장 골라 댓글 칸에 들어가기, 편집 열고 취소(새로 고침), 저장(새로 고침, 내용은 그대로 둔 채 "바뀐 내용이 없습니다"), 다른 창에서 그 문서를 바꿔 실시간 반영과 칠하기. 1280×720과 640×1040에서 오른쪽 칸이 본문 아래로 내려가는지.
- [ ] **Step 3: `npm test`** → 원래 실패(4180 포트를 쓰는 중이면 `serve` 테스트 하나) 말고 새 실패 없음.
- [ ] **Step 4: 커밋**: `refactor: 문서 화면을 받은 그릇에 그리는 문서 뷰 함수로 나눈다`

### Task 3: 바깥 문서도 같은 문서 뷰로

**Files:**
- Modify: `viewer/template.html` `renderDocView`(Task 2)

**Interfaces:**
- Consumes: `D.extTitles`, `D.extTexts`, `D.extFms`(Task 1), `renderDocView`(Task 2)
- Produces: `renderDocView(host, p, opts)`가 `p`에 `:`가 있고(예: `'home:study/a.md'`, `<프로젝트>:shared/...`) `D.extTexts`에 키가 있으면 바깥 문서로 그린다. `opts.mates: string[]`(이 작업 공간에서 그 문서를 가리키는 내 문서 경로)를 더 받는다.

- [ ] **Step 1: 구현**: 바깥 문서일 때 그리는 것
  - 경로 줄: 작업 공간 이름(`home`이면 "홈", 아니면 그 이름)과 그 작업 공간 기준 경로. 수정 시각 없음
  - 편집·댓글 줄 없음
  - 속성 칩: `D.extFms[p]`가 있으면 내 문서와 같은 `.pills` 모양. `related` 값은 링크 없이 글자로
  - 본문: `md(D.extTexts[p], {}, '')`, 값이 `null`이면 `<p class="note">본문을 읽지 못했습니다.</p>`
  - 오른쪽 칸: "이 문서를 가리키는 문서 N"(`opts.mates`를 `docLink`로), 목차. 댓글, 피드백, "이 문서가 가리키는 문서" 칸 없음
- [ ] **Step 2: 화면 확인**: Task 4 뒤에 함께 본다(바깥 문서는 패널에서만 열림). 여기서는 콘솔에서 `renderDocView(document.querySelector('#view'), '<extTexts의 키 하나>', { mode: 'panel', mates: [] })`로 그려 보고, 값이 `null`인 키도 그려 본다.
- [ ] **Step 3: 커밋**: `feat: 바깥 문서도 같은 문서 뷰로 그린다`

### Task 4: 옆 패널 틀이 문서 뷰를 담는다

**Files:**
- Modify: `viewer/template.html` `@areas` 구역(`:600-681`), 옆 패널 부분(`openXPanel`, `closeXPanel`, `XP`, Esc·resize 처리, `:1270-1318`), 패널 CSS(`.xpanel`, `:195` 근처)
- Test: `test/graph-areas.test.mjs`

**Interfaces:**
- Consumes: `renderDocView`(Task 2, 3), `xpClamp`, `xpWidth`, `xpSetWidth`, `openExternal`
- Produces:
  - `@areas` 구역: `panelLayout(boardW: number, boardH: number, panelW: number): 'side' | 'bottom' | 'full'` = `boardW - xpClamp(panelW, boardW) >= 360 ? 'side' : boardH >= 640 ? 'bottom' : 'full'`
  - 전역 `XP = { path: string | null, ext: boolean, mates: string[] }`(노드 번호를 두지 않는다)
  - `openDocPanel(p: string, o?: { ext?: boolean, mates?: string[], url?: string, href?: string, title?: string }): void`: `.gwrap` 안 `#xpanel`(없으면 만들고, 있으면 몸통만 바꿈)에 머리와 몸통을 그린다. 몸통은 `renderDocView(body, p, { mode: 'panel', mates, ... })`. `XP.path = p`
  - `closeDocPanel(): void`(지금 `closeXPanel`을 이름 바꿈. 부르는 곳을 모두 바꾼다)
  - `xpLayout(box): void`: `panelLayout(.gwrap 너비, 높이, xpWidth())`로 `box`에 `xp-bottom`, `xp-full` 클래스를 켜고 끈다. `xpSetWidth` 끝과 창 `resize`에서 부른다

- [ ] **Step 1: 실패하는 테스트**: `graph-areas.test.mjs`의 반환 목록에 `panelLayout`을 더하고:
  - `panelLayout(1149, 793, 440) === 'side'`(1440×900 전체 화면)
  - `panelLayout(989, 613, 440) === 'side'`(QHD 4분할)
  - `panelLayout(669, 933, 440) === 'bottom'`(FHD 2분할)
  - `panelLayout(598, 758, 440) === 'bottom'`(FHD 3분할)
  - `panelLayout(669, 413, 440) === 'full'`(FHD 4분할)
  - `panelLayout(800, 640, 440) === 'side'`, `panelLayout(799, 640, 440) === 'bottom'`, `panelLayout(799, 639, 440) === 'full'`(경계)
- [ ] **Step 2: 실패 확인**: `node --test test/graph-areas.test.mjs`
- [ ] **Step 3: `panelLayout` 구현, 통과 확인**
- [ ] **Step 4: 구현(패널)**:
  - 머리: 닫기(X, `ICON.x`)와 화면 이동 단추 하나. 내 문서는 "문서 화면으로" → `location.hash = 'doc/' + encodeURIComponent(p)`. 바깥 문서는 "<작업 공간> 뷰어에서 열기" → `openExternal({ d: { title }, url, href })`(지금 `#xopen`과 같은 값). 제목, 경로, 속성은 머리에 그리지 않는다(문서 뷰가 그림)
  - 0.8.6 패널이 따로 그리던 `.xh`의 제목·작업 공간 표시, `.xb` 본문, `.xf`의 "가리키는 내 문서 N개"는 지운다
  - 너비 손잡이, 끌기, 두 번 누르기, 화살표는 그대로
  - 패널 안 링크: 몸통에서 `a[href^="#doc/"]` 누르기를 가로채 `preventDefault()` 뒤 `openDocPanel(그 경로)`. 다른 작업 공간 링크는 지금 그대로
  - CSS: `.xpanel.xp-bottom{top:auto;left:12px;right:12px;width:auto;height:58%}`, `.xpanel.xp-full{left:12px;width:auto}`, 둘 다 `.xgrip{display:none}`. 패널 몸통은 세로로 스크롤
  - Esc: `XP.path`가 있고 초점이 `INPUT`, `TEXTAREA`, `SELECT`가 아닐 때만 닫는다
  - 지금 `openXPanel`, `closeXPanel`, `XP.id`, `XP.n`을 쓰는 곳(`pick`, `viewGraph`의 다시 열기 `:2579`, 범례 칩 `:3150`, `route`)을 이 작업에서 새 이름으로 바꿔 둔다. `pick`과 다시 열기는 바깥 노드만 `openDocPanel(nodes[k].d.path, { ext: true, ... })`로 여는 지금 동작을 유지하고, 내 노드로 바꾸는 것은 Task 5
- [ ] **Step 5: 화면 확인**: 아직 노드 누르기는 바깥 노드만 패널을 연다(Task 5 전). 바깥 노드를 눌러 바깥 문서 뷰가 패널에 그려지는지(Task 3), 패널 안 "이 문서를 가리키는 문서" 링크를 누르면 내 문서가 패널에 열리는지, "문서 화면으로", X, Esc, 너비 손잡이. 창을 960×1040, 960×520으로 바꿔 아래, 판 전체가 되는지.
- [ ] **Step 6: 커밋**: `feat: 옆 패널이 문서 뷰를 담고 판 크기에 따라 자리를 바꾼다`

### Task 5: 노드를 누르면 패널, 정보 상자 없애기

**Files:**
- Modify: `viewer/template.html` `@areas` 구역, `viewGraph`의 그래프 HTML(`#ginfo`, `:2575`), 패널 다시 열기(`:2579`), `select`·`pick`(`:3029-3052`), `pointerup`(`:3078-3088`), `fitView`(`:3106-3140`), `refresh`·`relayout`·범례 칩(`:3145-3153`), 흔적 줄 누르기(`trailBuild` 안 `:3259-3263`), `placeTrailBox`의 정보 상자 처리(`:3270-3287`), 정보 상자 CSS(`.ginfo`, `:183-218`)
- Test: `test/graph-areas.test.mjs`

**Interfaces:**
- Consumes: `openDocPanel`, `closeDocPanel`, `XP`(Task 4)
- Produces:
  - `@areas` 구역: `freeRects(w: number, h: number, obstacles: {x0,y0,x1,y1}[], min: number): {x0,y0,x1,y1}[]`. 판(0,0,w,h)에서 장애물마다 위·아래·왼쪽·오른쪽 조각으로 나눈 빈 곳 목록. 가로나 세로가 `min` 이하인 조각은 버리고, 다 버려지면 판 전체 하나. 지금 `fitView` 안 계산을 옮긴 것이고 `fitView`도 이것을 부른다
  - `viewGraph` 안 `pick(k)`: `GS.sel = k`, `paint()`, 내 노드면 `openDocPanel(nodes[k].id)`, 바깥 노드면 `openDocPanel(nodes[k].d.path, { ext: true, mates: 이웃 중 ext 아닌 노드 id, url, href, title })`. 그다음 `revealSel(k)`
  - `viewGraph` 안 `revealSel(k)`: 누른 노드와 이웃의 화면 상자가 빈 곳(`freeRects`, 장애물: `#gf`, `#gpanel`, `#gtrailbox`, `#xpanel`) 하나에 다 들어가면 그대로, 아니면 가장 크게 들어가는 조각에 맞춰 `GS.x`, `GS.y`, `GS.k`를 360ms 동안 옮긴다(줄이기만, 키우지 않음, 최소 배율 0.25). 아래 패널이면 패널 위쪽, 판 전체 패널이면 옮기지 않는다. 시안 `mockReveal`을 참고하되 빈 곳 계산은 `freeRects`로
  - `syncSel()`: `XP.path`가 그래프에 보이는 노드면 `GS.sel`을 그 노드로, 아니면 `null`. `paint()`

- [ ] **Step 1: 실패하는 테스트**: `freeRects`
  - 장애물 없음: `freeRects(1000, 800, [], 80)`이 `[{x0:0,y0:0,x1:1000,y1:800}]`
  - 오른쪽 패널(`{x0:600,y0:0,x1:1000,y1:800}`): 결과에 `{x0:0,y0:0,x1:600,y1:800}`이 있고 `x1 > 600`인 조각이 없다
  - 왼쪽 위 범례(`{x0:0,y0:0,x1:200,y1:400}`)와 오른쪽 패널을 함께: 모든 조각이 두 장애물과 겹치지 않는다
  - 판을 다 덮는 장애물: 판 전체 하나
- [ ] **Step 2: 실패 확인**: `node --test test/graph-areas.test.mjs`
- [ ] **Step 3: `freeRects` 구현, `fitView`가 이것을 쓰게 바꿈, 통과 확인**. `fitView` 장애물 목록에서 `#ginfo`를 빼고 `#xpanel`을 더한다
- [ ] **Step 4: 구현(누르기)**:
  - `#ginfo` HTML, `select`, 정보 상자 CSS(`.ginfo .gstats`, `.gopen`, `.gnb` 등 정보 상자에만 쓰던 것)를 지운다. 흔적 상자가 쓰는 `.ginfo` 공통 모양은 `#gtrailbox`로 옮기거나 남긴다(흔적 상자 모양 그대로)
  - 빈 곳 누르기(`d.pan`): `closeDocPanel()`, `GS.sel = null`, `paint()`. 영토 덩어리 누르기도 같음
  - X, Esc로 닫으면 강조도 푼다(`closeDocPanel` 안에서 `GS.sel = null` 뒤 다시 칠하는 콜백, 또는 `viewGraph`가 등록한 `onPanelClose`)
  - 노드 두 번 누르기로 문서 화면 가기는 그대로
  - 패널 안 링크로 연 문서: `syncSel()`
  - 범례 칩으로 폴더를 꺼서 패널 문서가 숨으면 패널은 두고 `syncSel()`(지금은 패널을 닫음). 켜면 `syncSel()`
  - `relayout`: `GS.sel = null`을 지우고, 다시 그린 뒤 `syncSel()`
  - 흔적 줄이 그래프에 안 보이는 문서면 `location.hash`를 바꾸지 않고 `openDocPanel(p)` 뒤 `syncSel()`
  - 다시 그릴 때(`:2579`): `XP.path`가 있으면 내 문서는 `byPath`에, 바깥 문서는 `D.extTexts`에 아직 있을 때 `openDocPanel`로 다시 열고 `syncSel()`, 없으면 `closeDocPanel()`
  - 연결이 그대로인 수정: `applyLiveData`는 `graphSig`가 같으면 그래프를 다시 그리지 않고 돌아간다(`if (same) return;`). 이때도 `XP.path`가 바뀐 문서면 패널을 다시 그린다(`applyLiveData` 끝, 또는 `graphLiveUpdate`에서 적용 뒤). 바뀐 문서를 알 수 없으면 `XP.path`의 본문이 달라졌는지(`byPath` 전후 `hash`)로 본다
  - 연결 화면을 떠나면 닫는 것(`route`)은 그대로
- [ ] **Step 5: 화면 확인**(1440×900, 960×1040, 960×520, 640×1040):
  - 내 노드와 바깥 노드를 누르면 패널에 문서 뷰가 열리고, 그 노드와 이웃이 강조된 채 남는지
  - 오른쪽 패널에서 "영토가 끊어지거나 찢어진다"(이웃 6개)를 누르면 이웃이 모두 패널, 범례 밖에 보이는지
  - 아래 패널에서 이웃이 위쪽에 모이는지
  - 다른 노드, 패널 안 링크, 흔적 줄로 바꾸기
  - 빈 곳, X, Esc로 닫기
  - 필터로 패널 문서의 폴더를 끄고 켜기, 줄 종류를 바꿔 다시 배치하기
  - 패널을 연 채 그 문서 파일을 잠깐 지웠다 되살리기(사라지면 닫힘)
  - 패널을 연 채 다른 창에서 그 문서의 글만 고치기(링크 그대로) → 패널 본문이 바뀜
- [ ] **Step 6: `npm test`** → 새 실패 없음.
- [ ] **Step 7: 커밋**: `feat: 연결 그래프에서 노드를 누르면 옆 패널에 문서 뷰를 연다`

### Task 6: 흔적 상자를 흔적 단추 아래로

**Files:**
- Modify: `viewer/template.html` `@areas` 구역, `placeTrailBox`(`:3269`), 흔적 상자 CSS(`#gtrailbox`)
- Test: `test/graph-areas.test.mjs`

**Interfaces:**
- Consumes: `XP`, `xpLayout`이 켠 `xp-bottom`·`xp-full`(Task 4)
- Produces: `@areas` 구역 `trailSpot(lay: 'side' | 'bottom' | 'full' | null): 'under' | 'left' | 'hidden'` = 패널 없음(`null`) `'under'`, `'side'` `'left'`, 나머지 `'hidden'`

- [ ] **Step 1: 실패하는 테스트**: `trailSpot(null)==='under'`, `trailSpot('side')==='left'`, `trailSpot('bottom')==='hidden'`, `trailSpot('full')==='hidden'`
- [ ] **Step 2: 실패 확인 → 구현 → 통과 확인**: `node --test test/graph-areas.test.mjs`
- [ ] **Step 3: 구현(자리)**: `placeTrailBox`를 다시 쓴다. 상자 `top`은 판 위 8px(흔적 단추 바로 아래), `right`는 `'under'`면 12px, `'left'`면 패널 너비 + 24px, `'hidden'`이면 상자를 숨긴다(흔적 선과 번호, `GS.trail`은 그대로). 알림 상자와 범례를 피하던 `bottom` 계산과 정보 상자 높이 줄이기는 지운다. 패널을 열고 닫을 때, 너비를 바꿀 때, `xpLayout`이 자리를 바꿀 때 `placeTrailBox`를 부른다. 상자가 판보다 길면 목록(`ul`)이 스크롤되게 최대 높이를 판 높이 안으로
- [ ] **Step 4: 화면 확인**: 흔적이 있는 상태(Claude에게 문서 몇 개를 읽게 한 뒤)로 1440×900 패널 닫힘·오른쪽, 960×1040 아래, 960×520 판 전체, 640×1040. 흔적 단추로 끄고 켜기, 상자 줄 누르기. 시안 `own-node-side-panel-mockup-j.jpg`와 견준다.
- [ ] **Step 5: 커밋**: `feat: 흔적 상자를 흔적 단추 아래에 두고 패널 자리에 따라 비킨다`

### Task 7: 패널에서 편집과 댓글

**Files:**
- Modify: `viewer/template.html` `openDocPanel`(Task 4), `busy`·`onFilesChanged`·`graphLiveUpdate`(`:3417-3460`), `closeDocPanel`, `pick`

**Interfaces:**
- Consumes: `renderDocView`의 `onSaved`, `onCancel`, `onCommented`(Task 2), `graphLiveUpdate`, `graphWaiting`
- Produces:
  - `panelDirty(): boolean` = 패널 안에 `#etext`가 있거나 `#ctext` 값이 비어 있지 않음
  - `leavePanelOk(): boolean` = `!panelDirty() || confirm('쓰던 내용이 사라집니다. 계속할까요?')`

- [ ] **Step 1: 구현(저장 뒤)**: 패널 모드의 `onSaved`, `onCommented`는 새로 고치지 않는다. 먼저 패널을 읽기 화면으로 다시 그리고 댓글 칸을 비운다(편집 칸이나 쓴 댓글이 남아 있으면 `busy()`가 참이라 `graphLiveUpdate`가 반영하지 않는다). 그다음 `graphLiveUpdate()`를 부른다. 받은 데이터가 그래프를 다시 그리거나(Task 5 다시 열기) 연결이 그대로여도(Task 5 연결이 그대로인 수정) 패널이 새 내용으로 그려진다. 패널 머리 옆에 `toast`로 "저장했어요"·"남겼어요"를 잠깐 띄운다. `onCancel`은 `openDocPanel(XP.path)`로 패널만 다시 그린다
- [ ] **Step 2: 구현(쓰던 내용 지키기)**: 다른 노드 누르기, 빈 곳 누르기, 흔적 줄, 패널 안 링크, "문서 화면으로", X, Esc 모두 바꾸거나 닫기 전에 `leavePanelOk()`. 거절하면 아무것도 하지 않는다(강조도 그대로)
- [ ] **Step 3: 구현(실시간 반영 미루기)**: 연결 화면에서 `busy()`일 때 `onFilesChanged`가 "새로 고침" 알림을 띄우지 않고 `graphWaiting = true`로 미룬다. 저장, 댓글, 취소, 패널 닫기 뒤 `graphWaiting`이면 `graphLiveUpdate()`. 문서 화면의 지금 동작(알림)은 그대로
- [ ] **Step 4: 화면 확인**:
  - 패널에서 편집 → 한 줄 고쳐 저장 → 그래프 배치, 확대, 패널이 그대로이고 본문이 바뀌었는지
  - 댓글 → 남긴 뒤 "이 문서의 피드백"이 하나 늘었는지
  - 편집 중 다른 노드 누르기 → 확인 창, 취소하면 그대로
  - 편집 중 Esc → 닫히지 않음
  - 편집 중 다른 창에서 그 문서를 바꿈 → 알림 없이 미뤘다가 취소하면 반영. 같은 상태에서 저장하면 지금처럼 "다른 곳에서 바뀌었다" 오류가 보이고 쓴 글이 남는지
- [ ] **Step 5: 커밋**: `feat: 옆 패널에서 편집하고 댓글을 남겨도 그래프와 패널이 그대로 남는다`

### Task 8: 문서와 마무리

**Files:**
- Modify: `CHANGELOG.md`("다음" 절), `README.md`, `README.ko.md`(연결 그래프 설명, 지금 옆 패널 항목 근처)

- [ ] **Step 1: 문서**: `CHANGELOG.md` "다음" 절에 세 줄: 노드를 누르면 옆 패널에 문서 화면과 같은 문서 뷰(내 노드, 바깥 노드), 패널과 흔적 상자가 분할 화면 크기에 맞게 자리를 바꿈, 패널에서 편집과 댓글. README 두 벌의 옆 패널 설명을 같은 뜻으로 고친다(정보 상자 설명이 있으면 지운다)
- [ ] **Step 2: 확인**: `npm test`, `claude plugin validate .`. 실패가 있으면 이번 변경 때문인지 원래 있던 것인지 가린다
- [ ] **Step 3: 커밋**: `docs: 한 문서 뷰와 옆 패널을 README와 바뀐 것에 적는다`
- [ ] **Step 4: PR**: 저장소 `CLAUDE.md` 흐름대로. `git remote -v` 확인, 푸시 전 `gh api --hostname github.com user --jq .login`이 `Q07K`인지 확인. 본문에 바꾼 것, 확인한 것(화면 크기별), 확인하지 못한 것, 버전 안 올림, `SCHEMA` 그대로

## 실행 기록

- 2026-11-26: 단계마다 구현 에이전트와 검토 에이전트로 8단계를 마침(커밋 `07c808b`..`3c25ae8`). 브랜치 전체 최종 검토에서 셋(패널을 넓히면 아래에 갇힘, 위 메뉴로 떠나면 쓴 글이 사라짐, 저장 뒤 댓글 초안이 사라짐)과 작은 것 일곱을 한 번에 고침(`88818b4`). PR https://github.com/Q07K/siloroot/pull/43, `main`에 머지(`c5af42c`)
- 계획과 다르게 정한 것: 패널 자리 판정을 패널 최소 너비(320px)로 함(판 너비 680px 이상이면 오른쪽, 보이는 너비는 저장 너비와 "판 너비 - 360" 가운데 작은 것). 설계 "좁은 화면"에 반영

## 마친 뒤

- 요구사항 `shared/requirements/unified-doc-view.md`의 "거쳐 온 길"과 결과, 로드맵 칸, 결정 `shared/decisions/unify-doc-view.md`의 "반영"을 고친다
- 2단계(문서 뷰 디자인 개선)는 실제 화면 시안으로 따로 설계한다
