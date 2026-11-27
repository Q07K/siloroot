---
type: plan
status: 확정
created: 2026-11-24
related: [shared/design/live-reading-graph-decision-design.md, shared/ideas/live-reading-graph.md]
---

# 읽는 문서 흔적 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude가 한 번 답하는 동안 읽고 고친 문서를 연결 그래프에 순서대로 흔적으로 보이고, 새 메시지를 보내면 비운다.

**Architecture:** 백그라운드 `PostToolUse` 훅(`scripts/trail.mjs`)이 문서 경로를 `.siloroot/state/trail/<세션>.jsonl`에 한 줄씩 붙이고, `UserPromptSubmit` 백그라운드 훅이 그 파일을 비운다. 경로 바꾸기와 파일 읽고 쓰기는 `lib/trail.mjs`에 모은다. 뷰어 서버가 `state/trail/`을 지켜보다 `/events`로 `event: trail`을 보내고, `GET /trail`로 지금 흔적을 준다. 연결 그래프(`viewer/template.html`)가 흔적 선, 번호, 순서 목록, "흔적" 단추를 그린다.

**Tech Stack:** Node.js 표준 라이브러리만(ESM, `node:test`). 화면은 `viewer/template.html` 안의 SVG와 CSS.

**Spec:** `shared/design/live-reading-graph-decision-design.md`. 시안은 `shared/ideas/live-reading-graph-mockup.gif`와 `shared/ideas/live-reading-graph-mockup.js`. 세 파일 모두 이 작업 공간 기준 경로이고, 실제 파일은 `C:\Users\<나>\github\q07k\siloroot\.siloroot\03-ideas\`에 있다. 워크트리에는 `.siloroot/`가 없으므로 이 절대 경로로 읽는다.

## Global Constraints

- 작업 자리: 최신 `origin/main`에서 딴 브랜치 `feat/live-reading-trail`, 워크트리 `C:\Users\<나>\github\q07k\siloroot-trail`. 원래 폴더(`siloroot`)는 PR #21 브랜치, `siloroot-update`는 다른 세션의 브랜치이니 건드리지 않는다.
- 워크트리에는 git에 없는 `test/banned-words.local.txt`가 없다. 테스트 전에 원래 폴더에서 복사한다(커밋하지 않는다).
- 외부 패키지 없음.
- 훅 두 개 모두 `"async": true`. `.siloroot/config.json`이 없는 폴더에서는 아무것도 하지 않는다. 무엇이 실패해도 표준 출력 없이 끝 코드 0.
- 남기는 것: `{"ts", "kind", "path", "agent"}`만. `kind`는 `read` 또는 `edit`. `agent`는 서브에이전트일 때만. Bash 명령 문자열은 남기지 않는다.
- 문서 위치(`cfg.docsRoot`) 안의 `.md`만, 문서 위치 기준 `/` 구분 상대 경로로. `state/` 아래와 `.`이나 `_`로 시작하는 폴더 안은 뺀다(`viewer/serve.mjs`의 `onChange`와 같은 기준).
- 비울 때 7일(`7 * 24 * 3600 * 1000` ms) 넘게 안 바뀐 다른 세션 파일을 지운다.
- 화면 수치: 읽음 `--accent`, 고침 `--flash-bar`. 선은 화살표 없이 0.3초 뒤 0.9초 동안 ease-out으로 그어진다(`fvdraw`와 같은 값). 도착 점의 둘레와 번호는 선이 다 그어진 뒤(1.2초)에 켜진다. 오래된 선의 투명도 `max(0.3, 1 - 0.15 × 나이)`. 목록 높이 3줄, 한 줄 28px. 목록 상자는 알림 상자 자리(아래 16px + 알림 높이(최소 44px) + 12px) 위. 알림 문구 "새 메시지 · 흔적을 비웠어요". 이름표 문구 "N번 · 서브에이전트가 읽음". 목록 제목 "이번 답에서 거쳐 간 문서", 설명 "메시지를 보내면 비워져요", 빈 목록 "Claude가 문서를 열면 순서대로 쌓여요".
- 새 모양을 만들지 않는다. 색, 상자, 단추, 칩, 이름표, 알림은 뷰어에 있는 클래스(`.ginfo`, `.lnk`, `.chip`, `.gtools button.wide`, `.tip`, `toast()`)를 쓴다.
- 커밋 메시지와 글은 한국어. 저장소 `CLAUDE.md`의 규칙(README 두 벌, 금지어, 버전 두 파일 함께)을 따른다.

## Review Focus

- 훅 입력의 `session_id`에 `../`나 `\` 같은 경로 글자가 들어 있으면: 파일을 만들지 않고 조용히 끝나야 한다(파일 이름으로 쓰기 때문). → Task 1 테스트.
- Windows에서 훅이 주는 경로의 드라이브 글자 대소문자나 `\`/`/`가 설정의 경로와 다르면: 같은 문서로 알아봐야 한다. → Task 1 테스트.
- 훅 표준 입력이 비었거나 JSON이 깨졌으면: 출력 없이 0으로 끝난다. → Task 2 테스트.
- 흔적 파일에 반쯤 쓰인 줄이나 깨진 줄이 있으면: 그 줄만 건너뛰고 나머지를 보인다. → Task 1 테스트.
- 뷰어를 흔적 파일이 생기기 전에 열었으면: `/trail`은 빈 흔적을 주고, 나중에 생긴 파일도 알림으로 받아야 한다(서버가 시작할 때 `state/trail/`을 만든다). → Task 3 테스트.

---

### Task 1: 흔적 기록 모듈 `lib/trail.mjs`

**Files:**
- Create: `lib/trail.mjs`
- Test: `test/trail.test.mjs`

**Interfaces:**
- Consumes: `loadConfig(root)`(`lib/config.mjs`)가 돌려주는 `cfg`(`root`, `docsRoot`, `stateDir`, `layout`).
- Produces:
  - `trailDir(cfg) -> string` : `path.join(cfg.stateDir, 'trail')`
  - `toDocPath(cfg, file: string) -> string | null` : 절대 경로나 `cfg.root` 기준 상대 경로를 문서 위치 기준 상대 경로로. 조건에 안 맞으면 `null`.
  - `docPathsInCommand(cfg, command: string, cwd?: string) -> string[]` : 명령 문자열에서 `.md`로 끝나는 덩어리를 찾는다. 덩어리마다 win32에서는 MSYS 꼴(`/c/Users/…`)을 `C:/Users/…`로 바꾸고, `cwd`(있으면), `cfg.root`, `cfg.docsRoot` 순서로 붙여 보아 `toDocPath`가 값을 내고 실제로 있는 첫 경로를 쓴다. 처음 나온 순서로, 겹치지 않게. (Claude는 `cd …/.siloroot && cat 02-study/x.md`처럼 문서 위치 기준 경로나 MSYS 절대 경로로 읽는 일이 많다.)
  - `entriesFromHook(cfg, input) -> Array<{kind, path, agent?}>` : 훅 입력 하나를 흔적 줄로. Read → `read`, Edit/Write/MultiEdit/NotebookEdit → `edit`, Bash → `docPathsInCommand(cfg, input.tool_input.command, input.cwd)`의 경로마다 `read`. `input.agent_id`가 있으면 `agent`로.
  - `safeSession(id) -> string | null` : `/^[A-Za-z0-9_-]{1,128}$/`에 맞으면 그대로, 아니면 `null`.
  - `appendTrail(cfg, session, entries, now = Date.now()) -> void` : `ts`를 붙여 한 번의 `appendFileSync`로 붙인다(한 호출이 여러 줄이어도 쓰기 한 번).
  - `resetTrail(cfg, session, now = Date.now()) -> void` : 그 세션 파일을 비우고(없으면 만들지 않는다), 다른 `.jsonl` 중 7일 넘게 안 바뀐 것을 지운다.
  - `readTrail(file) -> Array<{ts, kind, path, agent?}>` : 깨진 줄은 건너뛴다.
  - `latestTrail(cfg) -> { session: string | null, items: Array }` : `trailDir`에서 가장 최근에 바뀐 `.jsonl`.

- [ ] **Step 1: 워크트리를 만들고 금지어 파일을 복사한다**

Run:
```bash
cd /c/Users/<나>/github/q07k/siloroot && git fetch origin && git worktree add -b feat/live-reading-trail ../siloroot-trail origin/main && cp test/banned-words.local.txt ../siloroot-trail/test/ && cd ../siloroot-trail && npm test
```
Expected: 워크트리가 생기고 지금 테스트가 모두 통과한다.

- [ ] **Step 2: 실패하는 테스트를 쓴다** (`test/trail.test.mjs`, `makeProject`와 `writeConfig(root, { port, layout: 'wrapped' })`로 감싼 배치 프로젝트를 만든다. 문서는 `.siloroot/03-ideas/a.md`, `.siloroot/CLAUDE.md`)

- `toDocPath는 문서 위치 안의 md만 상대 경로로 바꾼다`: 절대 경로 `<root>/.siloroot/03-ideas/a.md` → `'03-ideas/a.md'`; `'.siloroot/03-ideas/a.md'`(root 기준 상대) → 같은 값; `<root>/src/x.md` → `null`; `<root>/.siloroot/state/trail/x.md` → `null`; `<root>/.siloroot/03-ideas/a.txt` → `null`; `<root>/.siloroot/_draft/b.md` → `null`.
- `toDocPath는 드라이브 글자 대소문자와 구분자가 달라도 같은 문서로 본다`: win32에서만(`process.platform === 'win32'`가 아니면 `t.skip()`). 절대 경로의 첫 글자를 반대 대소문자로 바꾸고 `\`를 `/`로 바꾼 값 → `'03-ideas/a.md'`.
- `docPathsInCommand는 명령 속 문서 경로만 찾는다`: `cat .siloroot/03-ideas/a.md && sed -n 1,5p ".siloroot/CLAUDE.md"; ls .siloroot/03-ideas` → `['03-ideas/a.md', 'CLAUDE.md']`; 없는 파일 `.siloroot/03-ideas/zz.md` → 빠짐; 같은 경로 두 번 → 한 번.
- `docPathsInCommand는 문서 위치 기준 경로와 cwd 기준 경로도 찾는다`: `cd <root>/.siloroot && cat 02-study/b.md`(문서 `.siloroot/02-study/b.md`를 더 만든다) → `['02-study/b.md']`; `cwd`를 `<root>/.siloroot/03-ideas`로 주고 `cat a.md` → `['03-ideas/a.md']`.
- `docPathsInCommand는 MSYS 절대 경로를 알아본다`: win32에서만. `<root>`의 `C:\` 꼴을 `/c/…` 꼴로 바꾼 `cat /c/…/.siloroot/03-ideas/a.md` → `['03-ideas/a.md']`.
- `entriesFromHook는 도구별로 kind를 정한다`: `{tool_name:'Read', tool_input:{file_path:abs}}` → `[{kind:'read', path:'03-ideas/a.md'}]`; `Edit`, `Write`, `MultiEdit` → `edit`; `Grep` → `[]`; `agent_id:'sub1'`이 있으면 `agent:'sub1'`.
- `safeSession는 경로 글자가 든 id를 받지 않는다`: `'abc-123_x'` → 그대로; `'../x'`, `'a\\b'`, `''`, `'a'.repeat(129)` → `null`.
- `appendTrail과 latestTrail로 순서대로 읽는다`: 세션 `s1`에 두 번 붙이면 `latestTrail(cfg)`가 `{session:'s1', items:[...]}`(두 줄, 붙인 순서, `ts` 있음). 뒤에 `s2`에 붙이면(파일 수정 시각을 1초 뒤로 `fs.utimesSync`) `s2`가 나온다.
- `readTrail은 깨진 줄을 건너뛴다`: 파일 내용 `'{"ts":1,"kind":"read","path":"a.md"}\n{"ts":2,"ki\n'` → 한 줄.
- `resetTrail은 세션 파일을 비우고 7일 넘은 다른 파일을 지운다`: `s1`(지금), `old`(수정 시각 8일 전), `recent`(6일 전) → `resetTrail(cfg,'s1')` 뒤 `s1.jsonl`은 길이 0, `old.jsonl`은 없음, `recent.jsonl`은 있음.
- `흔적 폴더가 없으면 latestTrail은 빈 흔적을 준다` → `{session:null, items:[]}`.

- [ ] **Step 3: 테스트가 실패하는지 본다**

Run: `node --test test/trail.test.mjs`
Expected: FAIL (`lib/trail.mjs`를 찾지 못함)

- [ ] **Step 4: `lib/trail.mjs`를 만든다**

`toDocPath`는 `path.resolve(cfg.root, file)`을 `path.relative(cfg.docsRoot, …)`로 바꿔 `..`로 시작하거나 절대 경로면 `null`(win32의 `path.relative`는 대소문자를 가리지 않는다). 상대 경로를 `/`로 잇고, `.md`가 아니거나, 첫 조각이 `state`(감싼 배치) 또는 `.siloroot`(평평한 배치)이거나, 어느 조각이 `.`/`_`로 시작하면 `null`. `docPathsInCommand`는 따옴표와 공백으로 끊긴 덩어리 중 `/\.md$/i`인 것을 고른다.

- [ ] **Step 5: 테스트가 통과하는지 본다**

Run: `node --test test/trail.test.mjs`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add lib/trail.mjs test/trail.test.mjs
git commit -m "feat: 읽고 고친 문서 흔적을 남기고 읽는 모듈을 더한다"
```

### Task 2: 백그라운드 훅 `scripts/trail.mjs`와 `hooks.json`

**Files:**
- Create: `scripts/trail.mjs`
- Modify: `hooks/hooks.json` (`PostToolUse` 더하기, `UserPromptSubmit`의 hooks 배열에 하나 더하기, 맨 위 `description`에 흔적 한 줄)
- Test: `test/trail.test.mjs`(이어 씀)

**Interfaces:**
- Consumes: Task 1의 `loadConfig`, `safeSession`, `entriesFromHook`, `appendTrail`, `resetTrail`.
- Produces: `node scripts/trail.mjs` (표준 입력 = `PostToolUse` 훅 JSON), `node scripts/trail.mjs --reset` (표준 입력 = `UserPromptSubmit` 훅 JSON). 둘 다 출력 없음. 프로젝트 폴더는 `CLAUDE_PROJECT_DIR`, 없으면 `process.cwd()`.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (스크립트를 `spawnSync(process.execPath, [script, ...args], { input, env: { ...process.env, CLAUDE_PROJECT_DIR: root }, encoding: 'utf8' })`로 돌린다)

- `훅은 Read를 흔적 파일에 남기고 아무것도 출력하지 않는다`: 입력 `{session_id:'s1', tool_name:'Read', tool_input:{file_path:<abs a.md>}}` → `status` 0, `stdout` `''`, `latestTrail(cfg).items`의 경로 `['03-ideas/a.md']`.
- `--reset은 그 세션 흔적을 비운다`: 위 뒤에 `--reset`과 `{session_id:'s1'}` → 0, `''`, items `[]`.
- `SiloRoot 폴더가 아니면 아무것도 만들지 않는다`: 설정 없는 폴더 → 0, `''`, 폴더 안 파일 목록이 그대로.
- `입력이 비었거나 깨졌으면 조용히 끝난다`: 입력 `''`와 `'{"session_id":'` → 둘 다 0, `''`.
- `session_id가 경로 글자면 파일을 만들지 않는다`: `session_id:'../../x'` → 0, `trailDir`에 파일 없음.
- `동시에 붙여도 줄이 섞이지 않는다`: `spawn`으로 20개를 한꺼번에 돌리고 모두 끝난 뒤 `readTrail`이 20줄, 모두 파싱된다.
- `hooks.json에 두 흔적 훅이 async로 있다`: `PostToolUse` 항목의 `matcher`가 `'Read|Edit|Write|MultiEdit|NotebookEdit|Bash'`이고 그 훅의 `args`에 `scripts/trail.mjs`, `async: true`; `UserPromptSubmit`에 `args`가 `[…/scripts/trail.mjs, '--reset']`이고 `async: true`인 훅이 있다.

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `node --test test/trail.test.mjs`
Expected: 새 테스트들 FAIL

- [ ] **Step 3: `scripts/trail.mjs`를 만들고 `hooks.json`을 고친다**

표준 입력 읽기는 `scripts/metrics-turn.mjs`의 `readStdin`(1초 제한)과 같게. 전체를 `try`로 감싸 어떤 예외도 0으로 끝낸다. `hooks.json`의 새 항목은 기존 항목과 같은 exec 형식(`"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/trail.mjs"]`)에 `"async": true`, `"timeout": 10`.

- [ ] **Step 4: 테스트와 플러그인 점검이 통과하는지 본다**

Run: `npm test` 와 `claude plugin validate .`
Expected: 모두 통과 (기존 `hooks.test.mjs`도 통과, `async`와 exec 꼴 `args`가 플러그인 훅 설정으로 받아들여진다)

- [ ] **Step 5: 실제 Claude Code 세션에서 훅이 도는지 확인한다**

사용자의 "느려지지 않게"를 확인하는 유일한 자리다. 시험용 SiloRoot 폴더(`node scripts/init.mjs <폴더>`로 만들거나 Task 1의 감싼 배치 폴더에 `.siloroot/CLAUDE.md`, 문서 2개)에서:

Run: `claude -p "먼저 .siloroot/CLAUDE.md를 Read로 읽고, 그다음 .siloroot/03-ideas/a.md를 읽고, 두 문서를 한 줄씩 요약해" --plugin-dir C:/Users/<나>/github/q07k/siloroot-trail --debug`
Expected: 디버그 출력에 흔적 훅이 백그라운드(async)로 시작했다고 나오고 응답을 기다리지 않는다. 끝난 뒤 `.siloroot/state/trail/<세션>.jsonl`에 적어도 첫 문서 줄이 있다(`-p`는 끝날 때 덜 끝난 백그라운드 훅을 끊으므로 마지막 줄은 없을 수 있다).
- `UserPromptSubmit`에서 `async`가 거절되거나 무시되면: `--reset` 훅을 빼고, 비우기를 지금 기다리는 훅인 `viewer/notify.mjs`(메시지 알림, 인자 없음) 안에서 `resetTrail`을 부르는 것으로 바꾼다. 테스트 `--reset은 그 세션 흔적을 비운다`도 `notify.mjs` 실행으로 바꾼다.
- 확인하지 못하면 그 이유를 PR의 "확인하지 못한 것"에 적는다.

- [ ] **Step 6: 커밋**

```bash
git add scripts/trail.mjs hooks/hooks.json test/trail.test.mjs
git commit -m "feat: 문서를 읽고 고칠 때 흔적을 남기는 백그라운드 훅을 더한다"
```

### Task 3: 뷰어 서버가 흔적을 보내기

**Files:**
- Modify: `viewer/serve.mjs` (흔적 폴더 감시, `GET /trail`, `event: trail` 보내기, 맨 위 주석에 `/trail` 한 줄)
- Test: `test/serve.test.mjs`(이어 씀)

**Interfaces:**
- Consumes: Task 1의 `trailDir`, `latestTrail`. 서버의 `CFG`, `clients`.
- Produces:
  - `GET /trail` → `200`, `application/json`, 본문 `{ session: string|null, items: [...] }`.
  - `/events`에 `event: trail\ndata: <같은 JSON>\n\n`. 흔적 폴더 변경을 150ms 모아 한 번 보낸다. 이름 없는 문서 변경 알림은 그대로.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (서버 시험 폴더는 평평한 배치이므로 흔적 파일은 `<root>/.siloroot/state/trail/s1.jsonl`)

- `흔적이 없으면 /trail은 빈 흔적을 준다` → `{session:null, items:[]}`.
- `흔적 파일을 쓰면 /trail이 그 흔적을 준다`: `appendTrail(loadConfig(root), 's1', [{kind:'read', path:'02-study/a.md'}])` 뒤 → `session` `'s1'`, `items[0].path` `'02-study/a.md'`.
- `흔적이 바뀌면 /events로 trail 알림이 온다`: `http.get(base + '/events')`로 받기 시작한 뒤 `appendTrail`로 한 줄 더 → 3초 안에 받은 글에 `event: trail`과 `"02-study/a.md"`가 있다.

- [ ] **Step 2: 테스트가 실패하는지 본다**

Run: `node --test test/serve.test.mjs`
Expected: 새 테스트 FAIL (`/trail` 404)

- [ ] **Step 3: `viewer/serve.mjs`를 고친다**

서버가 시작할 때 `fs.mkdirSync(trailDir(CFG), { recursive: true })` 뒤 `fs.watch(trailDir(CFG), …)`. 감시를 못 걸면 지금 감시처럼 오류만 찍고 계속 돈다. 보낼 때 `latestTrail(CFG)`를 다시 읽는다.

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add viewer/serve.mjs test/serve.test.mjs
git commit -m "feat: 뷰어 서버가 흔적을 /trail과 실시간 알림으로 보낸다"
```

### Task 4: 연결 그래프에 흔적 그리기

**Files:**
- Modify: `viewer/template.html` (CSS 몇 줄, `GS`와 `saveGS`에 `trail`, 흔적 상태와 받기, `viewGraph` 안의 흔적 그리기와 목록 상자와 단추, `toast()`에서 목록 자리 다시 재기, `/events` 받기)

**Interfaces:**
- Consumes: Task 3의 `GET /trail`, `event: trail`. `viewGraph` 안의 `nodes`, `rad`, `visibleNode`, `pick`, `zk`, `apply`, 끌기 `loop`.
- Produces(이 파일 안):
  - 전역 `TRAIL = { session: null, items: [] }`, `setTrail(data)`: 받은 흔적으로 바꾸고, 같은 세션의 흔적이 있다가 비면 `toast('<span>새 메시지 · 흔적을 비웠어요</span>', 3000)`, 그다음 `trailRedraw`가 있으면 부른다.
  - 전역 `trailRedraw: null | (() => void)`: 연결 화면이 떠 있는 동안 `viewGraph`가 채운다.
  - `GS.trail` (기본 `true`, `fv-graph3`에 저장).

- [ ] **Step 1: 흔적 그리기를 넣는다**

시안 스크립트(`shared/ideas/live-reading-graph-mockup.js`)의 모양을 그대로 따른다. 차이만 적는다.
- 흔적 층은 `#vp` 안, `#gn` 바로 앞 `<g id="gtrail">`. 선은 `vector-effect="non-scaling-stroke"`, 굵기 2.2. 번호 크기는 `zk`로 맞추므로 `apply()` 끝과 끌기 `loop`에서 다시 그린다.
- 같은 점을 여러 번 거치면 번호를 `·`로 잇고(`2·6`), 고침이 하나라도 있으면 고침 색.
- 새로 온 마지막 선만 그어지는 움직임(`--len`과 `fvdraw .9s .3s ease-out forwards`), 그 도착 점의 둘레와 번호는 `animation-delay: 1.2s`로 나타난다. 이미 그린 선은 그대로 둔다(다시 그릴 때 움직임을 되풀이하지 않는다).
- 가장 최근 점은 `fvhalo`를 끝없이 되풀이한다.
- 흔적에 든 점은 이름표를 보이고 굵게(`.nd.trail .lb{display:inline!important;font-weight:700}`, `.nd.trail .halo{opacity:.22}`).
- 선은 보이는 점끼리만 잇는다. 숨긴 점이나 그래프에 없는 문서는 건너뛰고 앞뒤 보이는 점을 잇는다.
- 서브에이전트 줄이 있는 점의 `.dot`에 `data-tip`을 "제목\nN번 · 서브에이전트가 읽음"으로 단다(뷰어 이름표가 띄운다).
- 목록 상자는 `.ginfo` 클래스를 쓴 새 요소 `#gtrailbox`(점을 고를 때 쓰는 `#ginfo`와 따로). 오른쪽 아래, 목록 `ul` 높이 `84px`(3×28), `overflow-y:auto`, 줄 높이 28px. 새 항목이 생기면 `scrollTo({ top: scrollHeight, behavior: 'smooth' })`. 줄을 누르면 그 점을 `pick(k)`. 가장 최근 줄은 `background:var(--code-bg)`.
- 목록 상자 아래 여백 `trailBoxBottom()`: `max(34, 알림 자리)`. 알림 자리는 알림 상자가 떠 있으면 그 높이로, 아니면 44px로 `16 + h + 12`를 창 아래에서 잰 값을 그래프 판 아래 기준으로 바꾼 것. 폴더 범례(`.glegend`)가 목록 상자와 가로로 겹치면(좁은 화면) 범례 위로 올린다. `toast()`가 알림을 띄우거나 숨길 때, 창 크기가 바뀔 때 다시 잰다.
- 도구 줄 "맞춤" 아래에 `<button type="button" id="gtrail-btn" class="wide" aria-pressed="…">흔적</button>`. 켜짐이면 `background:var(--accent-bg);color:var(--accent)`. 끄면 흔적 층과 목록 상자를 숨긴다. `SERVED`가 아니면(파일로 연 뷰어) 단추도 만들지 않는다.
- 실시간 그래프 갱신(`viewGraph(carry)`) 뒤에도 흔적을 다시 그린다.

- [ ] **Step 2: 흔적을 받는다**

`SERVED`면 처음에 `fetch('/trail')`로 `setTrail`, 그리고 기존 `EventSource`에 `es.addEventListener('trail', ev => setTrail(JSON.parse(ev.data)))`. 기존 `onmessage`는 그대로.

- [ ] **Step 3: 화면에서 확인한다**

`npm test`가 통과하는지 먼저 본다. 그다음 시험 폴더를 만들어 서버를 띄우고 내장 브라우저(`mcp__Claude_Browser__*`)로 `http://127.0.0.1:<port>/#graph`를 연다. 시험 폴더는 Task 3 테스트처럼 `writeConfig`와 문서 6~8개(폴더 3개 이상, `related`로 서로 이음)로 만든다. `node -e`로 `appendTrail`을 1초 간격으로 7번(마지막 둘은 `edit`, 다섯째는 `agent`) 부른다. 확인할 것:
- 선이 출발 쪽에서 도착 쪽으로 그어지고, 다 그어진 뒤 도착 점에 둘레와 번호가 켜진다. 화살표가 없다.
- 목록이 3줄 높이로 고정되고, 4번째부터 스크롤되어 최신 줄이 보인다. 빈 목록과 찬 목록의 상자 크기가 같다.
- `resetTrail`을 부르면 알림 상자에 "새 메시지 · 흔적을 비웠어요"가 뜨고, 목록 상자와 겹치지 않는다.
- 점을 끌거나 확대해도 선과 번호가 따라간다. "흔적" 단추로 켜고 끈다. 새로 고쳐도 흔적과 단추 상태가 남는다.
- 창 너비 375px(`resize_window` mobile)에서 목록 상자가 범례, 알림 상자와 겹치지 않는다. 확인 뒤 `desktop`으로 되돌린다.

- [ ] **Step 4: 커밋**

```bash
git add viewer/template.html
git commit -m "feat: 연결 그래프에 읽고 고친 문서 흔적과 순서 목록을 그린다"
```

### Task 5: 자동으로 불러오는 지시 파일 (`InstructionsLoaded`)

**Files:**
- Modify(될 때만): `lib/trail.mjs`, `hooks/hooks.json`, `test/trail.test.mjs`
- Modify(안 될 때): `C:\Users\<나>\github\q07k\siloroot\.siloroot\03-ideas\live-reading-graph.md`

**Interfaces:**
- Consumes: Task 1의 `entriesFromHook`, Task 2의 스크립트.
- Produces(될 때만): `entriesFromHook`가 `hook_event_name: 'InstructionsLoaded'` 입력을 `read`로 바꾼다.

- [ ] **Step 1: 공식 문서(https://code.claude.com/docs/en/hooks)에서 `InstructionsLoaded` 입력에 불러온 파일 경로 칸이 있는지, `@` 가져오기 파일에도 일어나는지 확인한다**

- [ ] **Step 2: 경로 칸이 있으면** 그 칸 이름으로 테스트 하나(`InstructionsLoaded 입력은 read로 남는다`, 경로 `<abs>/.siloroot/CLAUDE.md` → `[{kind:'read', path:'CLAUDE.md'}]`)를 먼저 쓰고 실패를 본 뒤, `entriesFromHook`에 더하고 `hooks.json`에 `InstructionsLoaded` 백그라운드 훅을 더한다. `npm test` 통과 뒤 커밋(`feat: 자동으로 불러오는 지시 파일도 흔적에 넣는다`).

- [ ] **Step 3: 경로 칸이 없거나 확인이 안 되면** 아이디어 문서의 "걸리는 것"에 이유를 한 줄 적고 코드는 고치지 않는다.

### Task 6: 문서, 버전, 올리기 전 확인, PR

**Files:**
- Modify: `README.md`, `README.ko.md`, `.claude-plugin/plugin.json`, `package.json`

- [ ] **Step 1: README 두 벌에 흔적 기능을 더한다** — 연결 그래프 설명 근처에 같은 내용으로: Claude가 한 번 답하며 읽고 고친 문서가 순서대로 보이고, 새 메시지를 보내면 비워지며, "흔적" 단추로 끌 수 있고, 기록은 `.siloroot/state/trail/`에 경로만 남는다는 것. 훅 목록이 있으면 두 훅도 더한다.

- [ ] **Step 2: 버전을 정한다** — `git fetch origin` 뒤 `origin/main`의 `package.json` 버전을 보고 둘째 자리를 하나 올린다(예: `0.4.0`이 머지돼 있으면 `0.5.0`, `0.3.x`면 `0.4.0`이되 그때 `feat/update-migration`이 아직 PR 전이면 PR 본문에 버전이 겹칠 수 있다고 적는다). 두 파일을 같은 값으로.

- [ ] **Step 3: 올리기 전 확인**

Run: `npm test` 와 `claude plugin validate .`
Expected: 모두 통과. 실패가 있으면 이번 변경 때문인지 원래 있던 것인지 가려 PR에 적는다.

- [ ] **Step 4: 커밋, 푸시, PR**

```bash
git add README.md README.ko.md .claude-plugin/plugin.json package.json
git commit -m "docs: 읽는 문서 흔적을 README에 적고 버전을 올린다"
gh api --hostname github.com user --jq .login   # Q07K인지 확인
git push -u origin feat/live-reading-trail
```
PR 본문: 무엇을 왜(설계 문서 요약), 확인한 것(테스트, Task 2 Step 5 실제 세션 확인, 화면 확인 항목), 확인하지 못한 것(사람이 쓰는 대화형 세션에서 오래 써 본 것, 해당하면 `InstructionsLoaded`). 실명, 회사 이름을 쓰지 않는다. 머지는 사용자 승인 뒤.
