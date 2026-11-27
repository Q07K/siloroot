---
type: plan
status: 완료
created: 2026-11-27
related: [shared/design/narrow-doc-view.md, shared/requirements/unified-doc-view.md, shared/conventions/viewer-responsive.md, shared/conventions/reuse-existing-implementation.md]
---

# 좁은 문서 뷰 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문서 뷰 그릇이 900px보다 좁으면 오른쪽 칸 카드를 본문 위 단추 줄로 접고, 단추를 누르면 그 카드가 줄 아래 떠 있는 상자로 펼쳐진다. 넓으면 지금 모양 그대로다.

**Architecture:** `renderDocView`와 `renderExtDocView`가 문서 뷰를 그릇(`.dv`, CSS 컨테이너)으로 싸고, 오른쪽 칸 카드에 종류(`data-k`)를 단다. 새 함수 `wireDocBar(host)`가 단추 줄을 만들고 펼치기·접기를 맡는다. 넓고 좁음은 CSS 컨테이너 쿼리가 정하고, JS는 단추 줄이 보이는지로 안다. 단추 목록과 상자 높이 계산은 DOM 없는 함수로 `@areas` 구역에 두어 Node에서 시험한다.

**Tech Stack:** Node 표준 라이브러리, `node:test`, 브라우저 바닐라 JS(한 파일 템플릿 `viewer/template.html`), CSS 컨테이너 쿼리.

**Spec:** `shared/design/narrow-doc-view.md`(승인 2026-11-27). 시안 코드(참고만): 스크래치패드 `docmock/tools/a.css`, `docmock/tools/a.js`, `docmock/tools/patch-shared.mjs`.

경로 메모: 이 문서와 설계는 `.siloroot/` 아래에 있다. 저장소 파일 경로는 저장소 맨 위 기준이다. 줄 번호 대신 함수 이름으로 찾는다.

## Global Constraints

- 일을 시작하기 전에 `.siloroot/shared/conventions/`의 문서를 모두 읽는다.
- 최신 `main`에서 `feat/narrow-doc-view` 브랜치를 딴다. `main`에 바로 커밋하지 않는다.
- 넓고 좁음의 기준: 문서 뷰 그릇 너비 900px 미만이면 좁음(`@container (max-width:899px)`). 창 너비(`@media`)로 가르지 않는다.
- 단추는 `.pill.sm`, 눌린 단추는 `.pill.on`, 개수는 `.nbadge`. 새 단추 모양을 만들지 않는다.
- 펼치는 상자 모양은 그래프 필터 상자(`.gpanel`)와 한 규칙을 함께 쓴다(바탕 `var(--surface)`, 테두리 `1px solid var(--border)`, 모서리 12px, 그림자 `0 6px 20px var(--shadow)`). 값을 옮겨 적지 않는다.
- 단추 이름: "목차", "댓글", "연결", "피드백". 연결과 피드백은 개수가 0보다 크면 `.nbadge`로 단다.
- 좁을 때 안내 문구: "문장을 고르면 댓글 칸이 열립니다." 넓을 때는 지금 문구("본문에서 문장을 고르면 오른쪽 댓글 창에 들어갑니다.") 그대로.
- `SCHEMA`는 그대로, 버전은 올리지 않는다. README 두 벌을 함께 고친다. `CHANGELOG.md` "다음"에 한 줄.
- 커밋과 PR 본문에 실명, 회사, 고객사 이름을 쓰지 않는다.

## Review Focus

- 패널에서 댓글을 쓰는 중에 상자를 접거나 바깥을 눌러도 글과 인용이 남아야 한다. 패널을 떠날 때 "쓰던 내용이 사라집니다"도 그대로 물어야 한다.
- 상자가 열린 채 Esc를 누르면 상자만 접히고 패널은 그대로여야 한다. 상자가 닫혀 있으면 지금처럼 패널이 닫힌다.
- 그릇 너비가 바뀌면(패널 너비 끌기, 창 크기) 넓을 때는 카드가 모두 오른쪽에 보이고, 다시 좁아지면 접힌 상태여야 한다.
- 제목이 없는 문서, 다른 작업 공간 문서, 파일로 연 뷰어(댓글 없음)에서는 있는 카드의 단추만 나와야 한다.
- 펼친 상자는 패널 아래가 낮은 960×520(판 전체 패널)에서도 잘리지 않아야 한다.

---

### Task 1: 단추 목록과 상자 높이 계산(DOM 없음)

**Files:**
- Modify: `viewer/template.html` (`// @areas-start` ~ `// @areas-end` 구역 안)
- Test: `test/graph-areas.test.mjs`

**Interfaces:**
- Produces:
  - `docBarItems(cards: Array<{k: string, n: number}>) -> Array<{k: string, label: string, n: number}>`: 카드 종류 목록(같은 종류가 여럿일 수 있음, 예: 연결 카드 둘)을 받아 단추 목록을 돌려준다. 순서는 `toc`, `cmt`, `link`, `fb`. 있는 종류만. 같은 종류의 `n`은 더한다. label은 목차, 댓글, 연결, 피드백. `toc`, `cmt`의 `n`은 0.
  - `docPopMax(bottom: number, top: number) -> number`: 상자 위끝(`top`)과 그릇 아래끝(`bottom`)으로 최대 높이를 정한다. `Math.max(160, Math.min(bottom - top - 8, 460))`.
- `test/graph-areas.test.mjs`의 `areas()`가 돌려주는 객체 목록에 `docBarItems`, `docPopMax`를 더한다.

- [ ] **Step 1: 실패하는 테스트 쓰기**

```js
test('좁은 문서 뷰 단추 목록은 있는 카드만 정한 순서로', () => {
  const A = areas('project');
  assert.deepEqual(A.docBarItems([{ k: 'cmt', n: 0 }, { k: 'fb', n: 2 }, { k: 'link', n: 3 }, { k: 'link', n: 4 }, { k: 'toc', n: 0 }]).map(x => [x.k, x.label, x.n]),
    [['toc', '목차', 0], ['cmt', '댓글', 0], ['link', '연결', 7], ['fb', '피드백', 2]]);
  assert.deepEqual(A.docBarItems([{ k: 'link', n: 0 }]).map(x => x.k), ['link']); // 다른 작업 공간 문서, 제목 없음
  assert.deepEqual(A.docBarItems([]), []);
});
test('펼친 상자 높이는 그릇 아래끝을 넘지 않고 160~460', () => {
  const A = areas('project');
  assert.equal(A.docPopMax(1000, 300), 460);
  assert.equal(A.docPopMax(600, 300), 292);
  assert.equal(A.docPopMax(400, 300), 160);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/graph-areas.test.mjs`
Expected: FAIL(`docBarItems is not defined`)

- [ ] **Step 3: `@areas` 구역에 `docBarItems`, `docPopMax`를 `const` 함수로 더한다**

- [ ] **Step 4: 통과 확인**

Run: `node --test test/graph-areas.test.mjs`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add viewer/template.html test/graph-areas.test.mjs
git commit -m "feat: 좁은 문서 뷰 단추 목록과 상자 높이 계산"
```

### Task 2: 문서 뷰 그릇, 단추 줄, 펼치는 상자

**Files:**
- Modify: `viewer/template.html`: CSS(`.doc` 규칙 근처, `.gpanel` 규칙), `renderDocView`, `renderExtDocView`, 새 `wireDocBar`, 패널 Esc 처리(`document.addEventListener('keydown', ...)`에서 `closeDocPanel`을 부르는 곳)

**Interfaces:**
- Consumes: `docBarItems`, `docPopMax`(Task 1)
- Produces: `wireDocBar(host: Element) -> void`. `renderDocView`와 `renderExtDocView`가 `buildDocToc(host)` 뒤에 부른다(목차 카드가 지워진 뒤에 단추를 정해야 해서).
- 마크업(두 그리기 함수 공통):
  - 그릇 `<div class="dv">`가 편집 줄(`.doctools`, 내 문서만)과 `.doc`를 함께 싼다. 경로 줄은 밖에 둔다.
  - `<aside class="side">` 안 맨 앞에 `<div class="dvbar"></div>`, 그 뒤 카드를 모두 `<div class="dvpop">`로 싼다.
  - 카드에 `data-k`: 댓글 남기기 `cmt`, 이 문서의 피드백 `fb`, 가리키는 문서 두 카드 `link`, 목차 `toc`.
  - 안내 문구: 넓을 때 문구에 `class="note dvwide"`, 좁을 때 문구 `<span class="note dvnarrow">`를 그 옆에.
- 펼치기 상태: 패널 Esc 처리가 알 수 있게, 상자가 열렸으면 그릇에 `dvopen` 클래스를 둔다.

- [ ] **Step 1: CSS를 더한다**
  - `.dv{container:dv / inline-size}`, 넓을 때 `.dvbar`, `.dvnarrow` 숨김
  - `@container dv (max-width:899px)` 안: `.dvwide` 숨김, `.dvnarrow` 보임, `.doc` 세로 한 줄(`flex-direction:column; flex-wrap:nowrap`), `aside.side`는 맨 위(`order:-1`)에 위로 붙음(`position:sticky; top:0`, 바탕 `var(--bg)`, 패널 안에서는 `var(--surface)`), 패널 안에서는 몸통 윗여백 10px까지 덮음(`top:-10px; padding-top:10px; margin-top:-10px`), `.dvbar` 보임(`display:flex; flex-wrap:wrap; gap:6px`), `.dvpop`은 `.dvbar` 아래 떠 있는 상자(`position:absolute; top:calc(100% + 4px); left:0; right:0; overflow:auto`), `.dvpop[hidden]` 숨김, `.dvpop` 안 카드는 `.on`만 보이고 카드 테두리·바탕 없음, `.on` 카드가 이어지면 사이에 선, 본문 `h1~h3`에 `scroll-margin-top:56px`
  - 떠 있는 상자 모양: `.gpanel`의 바탕·테두리·모서리·그림자를 한 규칙(예: `.gpanel,.dvpop{...}`를 좁을 때도 맞게)으로 함께 쓰게 정리한다. `.gpanel`의 자리·너비·여백은 그대로 둔다.
- [ ] **Step 2: `renderDocView`, `renderExtDocView`에 위 마크업을 넣고 `wireDocBar(host)`를 부른다**
- [ ] **Step 3: `wireDocBar(host)`를 만든다**(동작은 설계 "펼치고 접기")
  - 카드에서 `{k, n}`을 모아(`n`은 카드 안 `li:not(.empty)` 수) `docBarItems`로 단추를 만든다. 단추는 `<button type="button" class="pill sm" data-k aria-expanded>`, 개수는 `<span class="nbadge">`
  - 좁음 판정: `getComputedStyle(bar).display !== 'none'`
  - 펼치기: 한 번에 하나. 같은 단추는 접기. `.pill.on`, `aria-expanded`, 카드 `.on`, `pop.hidden`, 그릇 `dvopen`을 함께 맞춘다. 펼칠 때 `pop.style.maxHeight = docPopMax(그릇 아래끝, pop 위끝) + 'px'`(그릇 아래끝: 패널이면 `host.closest('.xb')`의 아래끝, 아니면 `innerHeight`)
  - 문장 고르기: 본문 `mouseup` 뒤(인용은 `wireDocTools`가 넣으므로 `setTimeout(…, 0)`) 좁고 고른 글이 본문 안이고 댓글 카드가 있으면 댓글을 펼친다
  - 목차 줄을 누르면 좁을 때 접는다
  - 바깥 누르기(`pointerdown`, 잡는 단계): 좁고 열려 있을 때만 접는다. 댓글 칸에 글이 있으면, 또는 댓글이 열린 채 본문을 눌렀으면 접지 않는다. 그릇이 문서에서 빠지면 리스너를 걷는다
  - 그릇 너비가 바뀌면(`ResizeObserver`): 넓으면 `pop.hidden=false`, `maxHeight` 지움. 좁으면 열린 카드가 없을 때 `pop.hidden=true`
  - Esc(`keydown`, 잡는 단계): 좁고 열려 있으면 접고 `stopPropagation`
- [ ] **Step 4: 패널 Esc 처리가 열린 상자가 있으면(`#xpanel .dv.dvopen`) 패널을 닫지 않게 한다**(Step 3의 잡는 단계 처리와 겹쳐도 해가 없게)
- [ ] **Step 5: 테스트가 깨지지 않았는지 본다**

Run: `npm test`
Expected: 모두 PASS

- [ ] **Step 6: 브라우저로 다섯 크기 확인**(`shared/conventions/viewer-responsive.md`)
  - 저장소를 뷰어 서버로 띄운다(launch 설정 `repo-project-viewer`, 포트 4199)
  - 1920×1040, 1280×720, 960×1040, 960×520, 640×1040에서 문서 `shared/design/unified-doc-view.md`를 패널로 열고: 단추 줄이 보이고, 목차·댓글·연결·피드백이 펼쳐지고, 스크롤해도 줄이 위에 붙고, 상자가 잘리지 않는지
  - 같은 다섯 크기에서 문서 화면: 1920·1280은 지금 오른쪽 칸 그대로, 960·640은 단추 줄
  - 패널: 문장 고르면 댓글이 펼쳐짐, 댓글 쓰다가 바깥 누르기·Esc, 다른 노드 누르기 때 "쓰던 내용이 사라집니다", 패널 너비를 끌어 900px 위아래로 오가기
  - 다른 작업 공간 노드(홈 노드)를 눌러 연결·목차 단추만 나오는지
- [ ] **Step 7: 커밋**

```bash
git add viewer/template.html
git commit -m "feat: 좁은 문서 뷰는 오른쪽 칸을 위 단추 줄로 접는다"
```

### Task 3: 문서와 마무리

**Files:**
- Modify: `README.md`, `README.ko.md`(연결 그래프 패널 설명의 "오른쪽 열이 그대로 나온다" 부분과 문서 화면 설명), `CHANGELOG.md` "다음"
- Modify(작업 공간 문서): `.siloroot/shared/design/narrow-doc-view.md` `status: 확정`, 이 계획 `status`, `.siloroot/shared/requirements/unified-doc-view.md` "결과", `.siloroot/shared/roadmap.md` "지금" 칸 상태

- [ ] **Step 1: README 두 벌에 같은 뜻으로 적는다**: 문서 뷰가 좁으면(패널, 분할 화면) 오른쪽 칸이 본문 위 단추 줄(목차, 댓글, 연결, 피드백)로 접히고, 누르면 펼쳐지며, 문장을 고르면 댓글이 열린다
- [ ] **Step 2: `CHANGELOG.md` "다음"에 한 줄**
- [ ] **Step 3: `npm test`와 `claude plugin validate .`**

Expected: 모두 통과. 실패가 있으면 이번 변경 때문인지 원래 있던 것인지 가려 PR에 적는다

- [ ] **Step 4: 커밋, 푸시, PR**(본문: 무엇을 왜, 확인한 크기, 확인하지 못한 것, 버전은 올리지 않음). `gh` 전에 인증 계정이 `Q07K`인지 확인한다
- [ ] **Step 5: 작업 공간 문서의 상태를 맞춘다**(git에 넣지 않음)
