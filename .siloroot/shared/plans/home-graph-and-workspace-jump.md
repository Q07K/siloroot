---
type: plan
status: 완료
created: 2026-11-26
related: [shared/design/home-graph-and-workspace-jump.md, shared/requirements/home-graph-and-workspace-jump.md]
---

# 홈 그래프 영토와 작업 공간 오가기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 홈 뷰어 그래프를 홈 영토와 프로젝트별 영토(A′)로 그리고, 두 뷰어 모두에서 다른 작업 공간 영토 제목은 그 뷰어로, 그 문서 점은 너비를 바꾸는 옆 패널로 연다.

**Architecture:** 빌드가 바깥 문서 본문(`extTexts`)을 싣는다. 뷰어(`viewer/template.html`)는 `D.mode === 'home'`일 때만 영역 계산을 바꾸고, 프로젝트 영역(`p:<이름>`)을 그래프 데이터를 만들 때 등록한다. 옆 패널은 그래프 화면 바깥(전역)에 상태를 두어 다시 그려도 이어진다.

**Tech Stack:** Node 표준 라이브러리, `node:test`, 브라우저 바닐라 JS(한 파일 템플릿).

**Spec:** `shared/design/home-graph-and-workspace-jump.md`. 시안: `shared/ideas/home-graph-projects-mockup.jpg`, `shared/ideas/cross-workspace-jump-mockup.jpg`. 시안 코드(참고만): 스크래치패드 `home-graph-mock/make.mjs`, `popup.js`.

경로 메모: 이 문서와 설계는 `C:\Users\<나>\github\q07k\siloroot\.siloroot\` 아래에 있다. 저장소 파일 경로는 저장소 맨 위 기준이다.

## Global Constraints

- 프로젝트 모드(`D.mode !== 'home'`)의 영역 계산, 색, 배치, 범례는 한 글자도 바뀌지 않는다.
- 폴더 이름(`d.folder`, `'(맨 위)'` 포함)은 바꾸지 않는다. 범례 숨김 저장값 `fv-graph3`이 이어져야 한다.
- 옆 패널 너비: 처음 440px, 최소 320px, 최대 그래프 판(`.gwrap`) 너비의 80%. 끌기, 두 번 누르면 440px, 화살표 24px. 저장 키 `fv-xpanel-w`(try/catch).
- 옆 패널은 그래프를 밀지 않고 덮는다. 읽기만 한다.
- 내 영토 제목(shared, private, 홈 모드의 home)은 동작을 더하지 않는다.
- `SCHEMA`와 버전은 그대로. `CHANGELOG.md` "다음" 절에 줄을 더한다. README 두 벌을 함께 고친다.
- 커밋, PR 본문에 실명, 회사, 고객사 이름을 쓰지 않는다.

## Review Focus

- 바깥 문서 파일이 없거나 못 읽음: 패널에 "본문을 읽지 못했습니다"와 열기 단추만. → Task 1 테스트(null), Task 4 확인
- 상대 뷰어가 꺼진 채 영토 제목이나 "뷰어에서 열기"를 누름: 지금 알림("… 뷰어가 꺼져 있습니다")을 그대로. → Task 3, 4 확인
- 패널을 연 채 실시간 반영으로 그 점이 사라짐: 패널이 닫힘. 남아 있으면 그대로. → Task 5 확인
- 범례에서 프로젝트를 끔: 그 프로젝트 영토와 점이 함께 사라지고, 켜면 돌아옴(0.8.4 동작). → Task 2 확인
- 좁은 화면(세로로 쌓이는 화면): 패널이 그래프 판 너비를 넘지 않음. → Task 4 테스트(`xpClamp`)

---

### Task 1: 빌드가 바깥 문서 본문을 싣는다

**Files:**
- Modify: `viewer/build.mjs:243-256`(바깥 문서 제목 읽기), `viewer/build.mjs:539-542`(data)
- Test: `test/build.test.mjs`

**Interfaces:**
- Produces: `D.extTexts: { [target: string]: string | null }`. 키는 `extTitles`와 같다(예: `'home:study/a.md'`). 값은 BOM과 `\r\n`을 정리한 원문 전체(앞 속성 포함), 못 읽으면 `null`.

- [x] **Step 1: 실패하는 테스트**: `test('바깥 문서 본문은 가리킨 문서만 싣고, 없는 문서는 null', ...)`. `바깥 문서 제목은 …` 테스트와 같은 준비에서 `const x = dataOf(root).extTexts;` 뒤 `assert.match(x['home:study/a.md'], /# 캔버스 겹/)`, `assert.equal(x['home:study/b.md'], null)`, `assert.ok(!('home:study/c.md' in x))`.
- [x] **Step 2: 실행해 실패 확인**: `node --test test/build.test.mjs` → 새 테스트가 `extTexts` undefined로 실패.
- [x] **Step 3: 구현**: `extTitles`를 채우는 반복에서 `extTexts[e.target]`도 같은 `text`로 채운다(처음 `null`). `data`에 `extTexts`를 더한다.
- [x] **Step 4: 실행해 통과 확인**: `node --test test/build.test.mjs` → 모두 통과.
- [x] **Step 5: 커밋**: `feat: 뷰어 데이터에 바깥 문서 본문을 싣는다`

### Task 2: 홈 모드 영역(A′)

**Files:**
- Modify: `viewer/template.html` 영역 부분(지금 `:577-626`), `graphData`(`:1354-1398`), `AREA_KEYS`·`rootless`(`:1611-1612`), `viewGraph`의 자리(`:1941-1945`)·클러스터 그리기(`:2003-2009`)·범례(`:2434-2440`)
- Create: `test/graph-areas.test.mjs`

**Interfaces:**
- Produces(전역, 템플릿 안):
  - `HOME_MODE: boolean` = `D.mode === 'home'`
  - `areaCalc(f)`: 홈 모드에서 `EXTF.has(f)` → `'p:' + f.split('/')[0]`, 아니면 `'home'`. 프로젝트 모드는 지금과 같음
  - `isProjArea(a: string): boolean` = `a.startsWith('p:')`
  - `registerProjArea(name: string): void`: 처음 보는 이름이면 `AREA_KEYS`에 `'p:'+name`을 넣고 `AREA_C`, `AREA_ICON`(폴더 아이콘), `AREA_NAME`(`name + ' 프로젝트'`), `AREA_SUB`(`'홈 노트가 가리키는 문서 · 누르면 그 프로젝트 뷰어로'`)를 채운다. 색은 밝은 테마 `#6B7785`, 어두운 테마 `#AEB8C2`
  - `areaLabel(a)`: `p:` 를 뗀 이름, 아니면 그대로
  - `shownFolder('(맨 위)')`: 홈 모드 `'home'`, 프로젝트 모드 `'.siloroot'`
  - `rootless(f)`: 지금 둘에 더해 홈 모드의 `'(맨 위)'`
- 홈 모드 바깥 점 묶음 이름(`folder`)은 프로젝트 이름 하나(`w.label`). 홈 모드가 아니면 지금처럼 `라벨/첫 폴더`

- [x] **Step 1: 실패하는 테스트**: `test/graph-areas.test.mjs`. 템플릿에서 `// @areas-start`와 `// @areas-end` 사이를 잘라 `node:vm`으로 돌린다. 문맥: `window = { matchMedia: () => ({ matches: false }) }`, `document = { querySelector: () => null }`, `D`(모드만 바꿔 가며), `folders`. 돌린 뒤 `EXTF.add(...)`로 바깥 묶음을 넣고 확인:
  - 프로젝트 모드: `areaCalc('shared/ideas')==='shared'`, `areaCalc('(맨 위)')==='private'`, `areaCalc('home/study')==='home'`, `shownFolder('(맨 위)')==='.siloroot'`, `rootless('(맨 위)')===false`
  - 홈 모드: `areaCalc('study')==='home'`, `areaCalc('(맨 위)')==='home'`, EXTF에 `'siloroot'`를 넣은 뒤 `areaCalc('siloroot')==='p:siloroot'`, `shownFolder('(맨 위)')==='home'`, `rootless('(맨 위)')===true`
  - `registerProjArea('siloroot')` 두 번 뒤 `AREA_KEYS.filter(a => a==='p:siloroot').length===1`, `AREA_C['p:siloroot']==='#6B7785'`, `areaLabel('p:siloroot')==='siloroot'`
- [x] **Step 2: 실행해 실패 확인**: `node --test test/graph-areas.test.mjs` → 표시 줄이 없어 실패.
- [x] **Step 3: 구현(영역 계산)**: 템플릿의 영역 상수와 함수들을 `// @areas-start` … `// @areas-end`로 감싼다(`EXT_FOLDER`부터 `shownFolder`까지, `rootless`, `AREA_KEYS`, 위 새 함수 포함. 필요하면 `rootless`, `AREA_KEYS`를 이 구역으로 옮긴다). 위 Interfaces대로 바꾼다. `areaColor`는 홈 모드 `'(맨 위)'`에 `AREA_C.home`을 준다.
- [x] **Step 4: 실행해 통과 확인**: `node --test test/graph-areas.test.mjs` → 통과.
- [x] **Step 5: 구현(그리기)**:
  - `graphData`: 홈 모드 바깥 점 `folder`를 프로젝트 이름으로, `EXTF.add` 뒤 `registerProjArea(이름)`
  - `viewGraph` 자리: 홈 모드는 `home` 중심 `(W*0.36, H*0.5)`, 프로젝트 영역 `k`개는 `x = W*0.86`, `y = H*(k>1 ? 0.2 + 0.6*i/(k-1) : 0.5)`. `rootless` 폴더는 영역 중심(반지름 0)
  - 클러스터 원과 이름표: 프로젝트 영역 폴더는 `hull` 요소에 `hx` 클래스를 더하고 CSS `.hull.hx{display:none}`(원은 영토와 가두기에 계속 씀)
  - 영토 이름표(`areaSvg`)와 범례 머리는 `areaLabel(a)`를 쓴다
  - 범례: 홈 모드는 `home` 머리와 칩들, 다음에 `projects` 머리(흐린 글자) 한 번, 프로젝트마다 칩 하나(`chip(이름, 이름)`). 칩을 누르면 지금 숨김 흐름 그대로
  - 바깥 점 이름표를 늘 켜는 CSS(`.nd.ext .lb{display:inline!important}`)를 홈 모드에서는 쓰지 않는다(`body.homemode` 같은 조건 클래스로)
- [x] **Step 6: 화면 확인**: 이 저장소 코드로 홈 뷰어를 띄운다(`.claude/launch.json`에 `node viewer/serve.mjs C:/Users/<나>/siloroot-home --port 4196`). 시안 그림과 같은 배치인지, 프로젝트 영토가 홈보다 눈에 띄지 않는지(넘치면 안 보이는 원 반지름이나 영토 여백을 줄임), 홈 맨 위 문서 점이 클러스터 원에 붙어 있지 않은지, 범례에서 `siloroot`를 끄고 켜면 영토가 사라졌다 돌아오는지, 다크 모드. 프로젝트 뷰어도 같은 방식(`--port 4197`)으로 띄워 지금 4180 화면과 스크린샷으로 견준다.
- [x] **Step 7: `npm test`** → 원래 실패 말고 새 실패 없음.
- [x] **Step 8: 커밋**: `feat: 홈 뷰어 그래프를 홈 영토와 프로젝트별 영토로 그린다`

### Task 3: 다른 작업 공간 영토 제목 누르기

**Files:**
- Modify: `viewer/template.html` CSS(`.alab .ahit`, `:265`), `viewGraph`의 svg 이벤트(`:2973` 근처)

**Interfaces:**
- Consumes: `isProjArea`, `areaLabel`(Task 2), `openExternal(n)`(지금 것, `{ d: { title }, url, href }`를 받음)
- Produces: `foreignArea(a: string): boolean` = 홈 모드 `isProjArea(a)`, 프로젝트 모드 `a === 'home'`. `areaViewerUrl(a: string): string | null` = `D.externals`에서 홈 모드는 `label === areaLabel(a)`, 프로젝트 모드는 `name === 'home'`인 항목의 `url`

- [x] **Step 1: 구현**: `foreignArea`, `areaViewerUrl`을 `@areas` 구역에 둔다. `graph-areas.test.mjs`에 두 모드의 `foreignArea` 기대값을 더한다(`'home'`: 프로젝트 모드 true, 홈 모드 false. `'p:x'`: 홈 모드 true. `'shared'`: 둘 다 false).
- [x] **Step 2: 실행해 통과 확인**: `node --test test/graph-areas.test.mjs`
- [x] **Step 3: 구현(이벤트)**: svg `click`에서 `.alab`의 `data-a`가 `foreignArea`면 `openExternal({ d: { title: areaLabel(a) === 'home' ? '홈' : areaLabel(a) }, url, href: url && url + '/#graph' })`. CSS: 그 영토의 `.ahit`는 `cursor:pointer`, 올리면 글자 밑줄. 내 영토는 그대로 `cursor:help`
- [x] **Step 4: 화면 확인**: 두 뷰어에서 제목을 눌러 새 탭 주소가 `<그 뷰어>/#graph`인지, 상대 서버를 끈 상태(다른 포트로 띄운 쪽을 멈춤)에서 알림이 뜨는지
- [x] **Step 5: 커밋**: `feat: 다른 작업 공간 영토 제목을 누르면 그 뷰어를 연다`

### Task 4: 문서 옆 패널

**Files:**
- Modify: `viewer/template.html` CSS(그래프 정보 상자 CSS 뒤), 전역 함수(`openExternal` 근처), `viewGraph`의 `pick`(`:2934`)

**Interfaces:**
- Consumes: `D.extTexts`(Task 1), `md(text, linkMap, base)`, `color(f)`, `ICON.x`, `openExternal`
- Produces(전역):
  - `xpClamp(w: number, boardW: number): number` = `Math.round(Math.max(320, Math.min(boardW * 0.8, w)))`(`@areas` 구역에 둬 테스트)
  - `XP = { id: string | null }` 지금 연 바깥 점 id
  - `openXPanel(n, mates)`: 바깥 점 `n`, 그 점과 이어진 내 점 배열 `mates`로 패널을 `.gwrap` 안에 그린다(있으면 내용만 바꿈). `XP.id = n.id`
  - `closeXPanel()`: 패널을 지우고 `XP.id = null`

- [x] **Step 1: 실패하는 테스트**: `graph-areas.test.mjs`에 `xpClamp(100, 1000)===320`, `xpClamp(900, 1000)===800`, `xpClamp(500, 1000)===500`, `xpClamp(500, 300)===320`(좁은 판에서도 최소 우선. 패널 CSS가 `calc(100% - 24px)`로 판 안에 가둔다)
- [x] **Step 2: 실패 확인**: `node --test test/graph-areas.test.mjs`
- [x] **Step 3: `xpClamp` 구현, 통과 확인**
- [x] **Step 4: 구현(패널)**: 시안 `popup.js`의 옆 패널(`.xpop.side`)과 손잡이(`mockGrip`)를 옮긴다. 이름은 Interfaces대로. 내용: 머리(점 색, 제목, `xws` 작업 공간 표시 + 경로, 닫기), 본문 `md(text, {}, '')` 또는 "본문을 읽지 못했습니다.", 바닥("가리키는 내 문서 N개", "<작업 공간 이름> 뷰어에서 열기" → `openExternal(n)`). 작업 공간 이름은 홈 모드 프로젝트 이름, 프로젝트 모드 `'홈'`. Esc로 닫기
- [x] **Step 5: 구현(누르기)**: `pick(k)`: 바깥 점이면 `select(null)` 뒤 `openXPanel(nodes[k], 이웃 중 ext 아닌 점)`, 아니면 `closeXPanel()` 뒤 `select(k)`. 빈 곳을 눌러 `select(null)` 할 때 패널은 그대로 둔다
- [x] **Step 6: 화면 확인**: 두 뷰어에서 바깥 점을 눌러 본문, 끌기 너비(440→늘림→다른 점에서도 유지→두 번 눌러 440), 화살표, Esc, 본문 없는 문서(가리키기만 하고 파일이 없는 경로를 임시 노트에 적어 확인 후 지움)
- [x] **Step 7: 커밋**: `feat: 다른 작업 공간 문서를 옆 패널로 읽는다`

### Task 5: 실시간 반영, 문서, 마무리

**Files:**
- Modify: `viewer/template.html` `viewGraph` 끝(패널 다시 붙이기), `CHANGELOG.md`, `README.md:129` 뒤, `README.ko.md:129` 뒤

**Interfaces:**
- Consumes: `XP`, `openXPanel`, `closeXPanel`(Task 4)

- [x] **Step 1: 구현**: `viewGraph`가 화면을 다시 그린 뒤 `XP.id`가 있으면 그 점이 새 `nodes`에 있을 때 다시 연다(너비 유지), 없으면 `closeXPanel()`. 연결 화면을 떠나면(다른 hash) 닫는다
- [x] **Step 2: 화면 확인**: 패널을 연 채 홈에 노트를 하나 만들어 실시간 반영 → 패널 유지. 그 바깥 문서를 가리키던 줄을 지워 점이 사라지면 패널이 닫힘. 임시 노트는 지움
- [x] **Step 3: 문서**: `CHANGELOG.md` "다음" 절(없으면 `## 0.8.5` 위에 만든다)에 두 줄: 홈 뷰어 영토, 영토 제목과 옆 패널. README 두 벌 129줄 뒤에 같은 뜻 한 항목씩
- [x] **Step 4: 확인**: `npm test`, `claude plugin validate .`
- [x] **Step 5: 커밋**: `docs: 홈 그래프 영토와 옆 패널을 README와 바뀐 것에 적는다`
- [x] **Step 6: PR**: 저장소 `CLAUDE.md` 흐름대로(푸시 전 `gh` 계정 확인, 본문에 바꾼 것, 확인한 것, 못 한 것, 버전 안 올림)
