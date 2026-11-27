---
type: plan
status: 제안
created: 2026-11-24
related: [shared/design/project-folder-layout-decision-design.md, shared/ideas/project-folder-layout.md]
---

# 구조 2판 1단계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새로 init하는 사람이 처음부터 모양 3(프로젝트의 `shared/`·private/와 홈)을 받게 하고, 모양 1·2 작업 공간은 지금처럼 돌게 한다. 마이그레이션 `002`는 이 계획 밖(2단계)이다.

**Architecture:** 자리표(`lib/layout.mjs`)가 모양과 종류(`mode`)마다 역할의 경로를 낸다. 맞추기(`lib/workspace-sync.mjs`), init, 뷰어, 훅이 모두 이 표를 본다. 사용자 단위 설정(`lib/user.mjs`, `<사용자 폴더>/.siloroot/user.json`)이 홈 위치와 프로젝트 이름을 갖고, 작업 공간 사이 경로(`home:`, `<이름>:`)는 이 파일로 푼다. 모양 3 템플릿은 `templates/project/`, `templates/home/`에 새로 두고 지금 템플릿은 모양 1·2용으로 남긴다.

**Tech Stack:** Node.js 표준 라이브러리만(ESM, `node:test`). 외부 패키지 없음.

**Spec:** `shared/design/project-folder-layout-decision-design.md` (확정). 파일은 저장소의 `.siloroot/03-ideas/`에 있다. 이 계획은 설계 4.12의 1번이다.

## Global Constraints

- 저장소 `C:\Users\<나>\github\q07k\siloroot`. 시작할 때의 최신 `origin/main`에서 `feat/structure-v2-home` 브랜치를 워크트리로 딴다. 계획을 쓸 때는 c5b4dab(PR #23 머지)였다. 다른 세션의 PR #24(`fix/trail-existing-links`, 0.5.1)가 뷰어 흔적을 고치는 중이라, 그것이 먼저 머지되면 그 `main`에서 딴다. 지금 체크아웃은 그 세션의 브랜치라 건드리지 않는다.
- 외부 의존성 없음. 버전은 `.claude-plugin/plugin.json`과 `package.json` 모두 `0.6.0`.
- `SCHEMA = 3`, `SUPPORTED_SCHEMAS = [1, 2, 3]`. `mode`가 없으면 `project`. 홈은 flat 배치(`<홈>/.siloroot/config.json`)이고 처음부터 모양 3, `mode: home`.
- 이 계획은 `SCHEMA`를 올리지만 `002`를 내지 않는다(설계 4.12). 저장소 `CLAUDE.md`의 "SCHEMA를 올리면 마이그레이션을 함께 낸다"를 이번에만 따르지 않는다. 그래서 갈 마이그레이션이 없는 모양 차이는 알리지 않는다(Task 1). PR 본문에 이 사정을 적는다.
- 모양 1·2 작업 공간의 맞추기, 뷰어, 훅, 스킬은 지금과 같게 돈다. init은 옮기지 않는다.
- 테스트는 진짜 사용자 폴더를 건드리지 않는다. `test/fixtures.mjs`가 import될 때 `process.env.SILOROOT_USER_DIR`을 새 임시 폴더로 정한다(이미 있으면 그대로). 모든 테스트 파일이 이미 fixtures를 import한다.
- 경로는 저장할 때 `/`로 잇는다(`user.json`, 관리 블록, 데이터).
- 모양 3 프로젝트의 git 제외 줄: `.siloroot/*`, `!.siloroot/shared/`, `.ignore`, `CLAUDE.local.md`. `.siloroot/.gitignore`는 만들지 않는다.
- 홈 쓰기 허락(`.claude/settings.local.json`의 `permissions.additionalDirectories`)은 사용자가 고른 답(`--home-access add`)이 있을 때만 쓴다.
- 홈 포트 기본 시작값 4181, 프로젝트 4180.
- 글과 커밋 메시지는 한국어. 금지어 검사, README 두 벌. 커밋 끝 줄: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. 사용자 폴더 이름에 공백이나 한글이 있다(`C:/Users/김 철수`) → 관리 블록의 사용자 정보 불러오기가 깨지지 않아야 한다. 홈이 사용자 폴더 아래면 `@~/…` 꼴로 적는다. (Task 2, Task 3 테스트)
2. 홈 뷰어가 꺼져 있어 포트가 비어 보인다 → 새 프로젝트가 홈의 포트를 집으면 안 된다. 포트는 `user.json`에 등록된 작업 공간의 설정 포트를 피한다. (Task 4 테스트)
3. `user.json`이 깨진 JSON이다 → 훅과 뷰어는 죽지 않고 홈 없이 돌고, init은 덮어쓰지 않고 `user-json-invalid`로 멈춘다. (Task 2, Task 4, Task 7 테스트)
4. `.claude/settings.local.json`에 다른 설정이 있거나 깨진 JSON이다 → 다른 칸은 그대로, 깨졌으면 건드리지 않고 알린다. (Task 2 테스트)
5. 본문의 `C:/x.md`, `https://…`, 등록 안 된 `foo:bar.md` → 작업 공간 경로로 읽지 않는다. `related`에 적힌 등록 안 된 이름만 경고한다. (Task 5 테스트)

---

### Task 1: 자리표, 새 type, 모양 3 설정

**Files:**
- Create: `lib/layout.mjs`
- Modify: `lib/config.mjs`, `lib/vocab.mjs`, `lib/update-check.mjs`
- Test: `test/layout.test.mjs` (새로), `test/config.test.mjs`, `test/update.test.mjs`

**Interfaces:**
- Produces:
  - `config.mjs`: `SCHEMA = 3`, `SUPPORTED_SCHEMAS = [1, 2, 3]`. `loadConfig` 결과에 `mode: 'project'|'home'`(`raw.mode === 'home'`일 때만 home). `writeConfig(root, { port, dirs, layout, schema, plugin, mode })`는 `mode`가 주어지면 적는다. `findFreePort(start = 4180, end = 4299, { avoid = new Set() } = {})`는 `avoid`의 포트를 건너뛴다.
  - `vocab.mjs`에 더한다: `issue: ['열림', '원인 찾음', '해결', '안 함']`, `design: ['제안', '확정', '바뀜']`, `roadmap: ['제안', '확정', '진행 중', '완료', '접음']`, `convention: ['제안', '사용 중', '바뀜', '폐기']`, `source: ['사용 중', '보관']`.
  - `layout.mjs`:
    - `export const ROLE_LABELS` — `{ log: '작업 기록', study: '공부 노트', issues: '이슈', ideas: '제품 아이디어', personalIdeas: '개인 아이디어', decisions: '결정', design: '설계', roadmap: '로드맵', conventions: '컨벤션', sources: '원자료', notes: '프로젝트 메모', discussions: '논의', feedback: '뷰어 댓글', candidates: '후보', profile: '사용자 정보', aiComment: '"나" 코멘트', writingGuide: '글쓰기 규칙' }`
    - `export function placesOf(cfg): Record<role, string|null>` — 문서 뿌리 기준 경로. 폴더는 끝 `/` 없이, 파일은 `.md`까지. 다른 작업 공간에 있으면 `home:` 접두사. 없는 역할은 `null`. 값은 아래 표 그대로.
    - `export const localPlace = (p) => (p && !p.includes(':') ? p : null)`
    - `export function folderRules(cfg): Array<{ prefix: string, types: string[] }>` — 아래 표. `prefix`는 끝에 `/`. 모든 폴더의 `README.md`는 `index`로 빠진다(지금 build의 skip 규칙).
    - `export function groupOf(rel, cfg): string` — 모양 3 프로젝트에서 첫 마디가 `shared`나 `private`이고 마디가 셋 이상이면 앞 두 마디(`shared/ideas`), 아니면 첫 마디, 맨 위 파일은 `'(맨 위)'`.

| 역할 | 모양 1·2 (`d = cfg.dirs`) | 모양 3 프로젝트 | 모양 3 홈 |
| --- | --- | --- | --- |
| log | `d.log` | `private/log` | `log` |
| study | `d.study` | `home:study` | `study` |
| issues | null | `shared/issues` | null |
| ideas | `d.ideas` | `shared/ideas` | null |
| personalIdeas | null | `home:ideas` | `ideas` |
| decisions | `d.ideas` | `shared/decisions` | null |
| design, roadmap | null | `shared/design`, `shared/roadmap` | null |
| conventions | null | `shared/conventions` | null |
| sources, notes, discussions | null | private/sources, private/notes, private/discussions | null |
| feedback | `d.feedback` | private/feedback | `feedback` |
| candidates | `d.feedback` | `home:feedback` | `feedback` |
| profile, aiComment | `` `${d.profile}/profile.md` ``, `` `${d.profile}/ai-comment.md` `` | `home:profile.md`, `home:ai-comment.md` | `profile.md`, `ai-comment.md` |
| writingGuide | `writing-guide.md` | home:writing-guide.md | `writing-guide.md` |

| folderRules | prefix → types |
| --- | --- |
| 모양 1·2 | `d.ideas/` → idea, decision · `d.study/` → study · `d.feedback/` → feedback, rule, trait (지금 build의 REQUIRED와 같다) |
| 모양 3 프로젝트 | `shared/issues/` → issue · `shared/ideas/` → idea · `shared/decisions/` → decision · `shared/design/` → design · `shared/roadmap/` → roadmap · `shared/conventions/` → convention · private/sources/ → source · private/notes/, private/discussions/ → note · private/feedback/ → feedback · `private/log/` → log, ledger |
| 모양 3 홈 | `study/` → study · `ideas/` → idea, decision, design, roadmap · `feedback/` → feedback, rule, trait · `log/` → log, ledger |

- [ ] **Step 1: 실패하는 테스트** (`test/layout.test.mjs`, `test/config.test.mjs`)

```js
test('모양 2 작업 공간의 자리는 dirs에서 온다', () => {
  const p = placesOf({ schema: 2, mode: 'project', dirs: { ...DEFAULT_DIRS } });
  assert.equal(p.study, '02-study'); assert.equal(p.decisions, '03-ideas'); assert.equal(p.profile, '05-profile/profile.md'); assert.equal(p.issues, null);
});
test('모양 3 프로젝트는 공부와 사용자 정보를 홈에서 찾는다', () => {
  const p = placesOf({ schema: 3, mode: 'project', dirs: {} });
  assert.equal(p.study, 'home:study'); assert.equal(p.candidates, 'home:feedback'); assert.equal(p.log, 'private/log');
  assert.equal(localPlace(p.study), null); assert.equal(localPlace(p.log), 'private/log');
});
test('모양 3 홈의 ideas는 결정, 설계, 로드맵도 받는다', () => {
  const r = folderRules({ schema: 3, mode: 'home', dirs: {} }).find((x) => x.prefix === 'ideas/');
  assert.deepEqual(r.types.sort(), ['decision', 'design', 'idea', 'roadmap']);
});
test('groupOf는 모양 3 프로젝트에서 앞 두 마디로 묶는다', () => {
  const c = { schema: 3, mode: 'project', dirs: {} };
  assert.equal(groupOf('shared/ideas/a.md', c), 'shared/ideas'); assert.equal(groupOf('shared/README.md', c), 'shared'); assert.equal(groupOf('CLAUDE.md', c), '(맨 위)');
  assert.equal(groupOf('03-ideas/a.md', { schema: 2, mode: 'project', dirs: {} }), '03-ideas');
});
test('folderRules의 type은 모두 VOCAB에 있다', () => { /* 세 경우를 돌며 VOCAB[t] 존재 확인 */ });
test('mode가 없으면 project, home이면 home', () => { /* writeConfig 두 번, loadConfig(..).mode 확인 */ });
test('findFreePort는 avoid의 포트를 건너뛴다', async () => { assert.notEqual(await findFreePort(4290, 4299, { avoid: new Set([4290]) }), 4290); });
test('갈 마이그레이션이 없는 모양 차이는 알리지 않는다', () => {
  assert.deepEqual(updateNotice({ schema: 2, hold: null, plugin: pluginVersion() }), []);
});
```

- [ ] **Step 2:** `npm test -- --test-name-pattern="자리|folderRules|groupOf|mode가|avoid|갈 마이그레이션"` → FAIL
- [ ] **Step 3:** Interfaces대로 구현. `updateNotice`는 `pendingMigrations(cfg.schema, SCHEMA)`가 비면 모양 줄을 넣지 않는다. `scripts/init.mjs`는 Task 4 전까지 새 작업 공간에 `schema: 2`를 그대로 적는다(지금 `SCHEMA`를 쓰는 자리를 숫자 2로, 주석 "Task 4에서 모양 3으로"). init의 "/siloroot:update로 올리세요" 경고도 `pendingMigrations(cfg.schema, SCHEMA).length`일 때만 낸다.
- [ ] **Step 4:** 같은 명령 → PASS. `npm test` 전체에서 `SCHEMA`를 2로 박은 기존 단언만 깨지면, 그 단언을 `SCHEMA` 상수나 "모양 2 픽스처" 뜻에 맞게 고친다. 다른 실패는 원인을 찾는다.
- [ ] **Step 5:** 커밋 `feat: 모양 3 자리표와 새 type을 둔다`

### Task 2: 사용자 단위 설정과 홈 쓰기 허락

**Files:**
- Create: `lib/user.mjs`, `lib/claude-settings.mjs`
- Modify: `test/fixtures.mjs`
- Test: `test/user.test.mjs` (새로)

**Interfaces:**
- Produces (`lib/user.mjs`):
  - `userDir(): string` — `process.env.SILOROOT_USER_DIR || os.homedir()`
  - `userFile(): string` — `<userDir>/.siloroot/user.json`
  - `readUser(): { version: 1, home: string|null, projects: Array<{ name, path }>, invalid?: true }` — 없으면 빈 값, 깨졌으면 빈 값에 `invalid: true`
  - `setHome(home: string): void` — `invalid`면 `Error('user-json-invalid')`
  - `registerProject(root: string): string` — 같은 경로(win32는 대소문자 무시)면 있는 이름, 새로면 폴더 이름에서 공백과 `:`를 `-`로 바꾼 것, 겹치면 `-2`, `-3`. `home`은 쓰지 않는다(`home-2`). `invalid`면 throw. 이름은 `<이름>:` 경로에 쓰이므로 공백이 없어야 한다
  - `workspaceRoot(name: string): string|null` — `'home'`이면 홈, 아니면 등록된 프로젝트 경로
  - `importPath(abs: string): string` — `userDir()` 아래면 `~/` + 나머지, 아니면 `/`로 이은 절대 경로
  - `usedPorts(): Set<number>` — 홈과 등록 프로젝트의 `loadConfig(..).port`(읽지 못하면 뺀다)
- Produces (`lib/claude-settings.mjs`):
  - `addAdditionalDirectory(root: string, dir: string): 'added'|'present'|'invalid'` — `<root>/.claude/settings.local.json`의 `permissions.additionalDirectories`에 `dir`(`/`로 이음)을 더한다. 파일이 없으면 만든다. 다른 칸은 그대로. JSON이 아니면 쓰지 않고 `'invalid'`.

- [ ] **Step 1: 실패하는 테스트**

```js
test('fixtures는 사용자 폴더를 임시 폴더로 바꾼다', () => { assert.ok(userDir().startsWith(os.tmpdir())); });
test('registerProject는 같은 경로를 다시 등록하지 않고 이름이 겹치면 -2', () => {
  const a = makeProject('앱'), b = path.join(makeProject('x'), '..', '앱'); fs.mkdirSync(b, { recursive: true });
  assert.equal(registerProject(a), '앱'); assert.equal(registerProject(a), '앱'); assert.equal(registerProject(b), '앱-2');
  assert.equal(workspaceRoot('앱-2'), b.split(path.sep).join('/'));
  assert.equal(registerProject(makeProject('테스트 폴더 A')), '테스트-폴더-A');
  assert.equal(registerProject(makeProject('home')), 'home-2');
});
test('user.json이 깨졌으면 읽기는 빈 값, 쓰기는 멈춘다', () => {
  write(userDir(), '.siloroot/user.json', '{ 깨짐');
  assert.equal(readUser().invalid, true); assert.equal(readUser().home, null);
  assert.throws(() => setHome('x'), /user-json-invalid/);
  assert.equal(fs.readFileSync(userFile(), 'utf8'), '{ 깨짐');
});
test('importPath는 사용자 폴더 아래를 ~/로 적어 공백 든 사용자 이름을 피한다', () => {
  assert.equal(importPath(path.join(userDir(), 'siloroot-home', 'profile.md')), '~/siloroot-home/profile.md');
});
test('addAdditionalDirectory는 다른 설정을 지키고 두 번째는 present', () => {
  const r = makeProject(); write(r, '.claude/settings.local.json', JSON.stringify({ permissions: { allow: ['Bash(ls)'] }, model: 'x' }));
  assert.equal(addAdditionalDirectory(r, 'C:\\h'), 'added'); assert.equal(addAdditionalDirectory(r, 'C:/h'), 'present');
  const j = JSON.parse(fs.readFileSync(path.join(r, '.claude/settings.local.json'), 'utf8'));
  assert.deepEqual(j, { permissions: { allow: ['Bash(ls)'], additionalDirectories: ['C:/h'] }, model: 'x' });
});
test('settings.local.json이 JSON이 아니면 건드리지 않는다', () => { /* '// 주석\n{' 쓰고 'invalid', 내용 그대로 */ });
```

각 테스트는 시작할 때 `fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true })`로 `user.json`을 비운다.

- [ ] **Step 2:** `npm test -- --test-name-pattern="fixtures는|registerProject|user.json이|importPath|addAdditionalDirectory|settings.local"` → FAIL
- [ ] **Step 3:** `test/fixtures.mjs` 맨 위에 `SILOROOT_USER_DIR` 설정을 넣고, 두 모듈을 구현
- [ ] **Step 4:** 같은 명령 → PASS, `npm test` 전체 그대로
- [ ] **Step 5:** 커밋 `feat: 홈 위치와 프로젝트 목록을 적는 user.json`

### Task 3: 모양 3 템플릿과 맞추기

**Files:**
- Create: `templates/project/CLAUDE.block.md`, `templates/project/metadata-guide.md`, `templates/project/shared/README.md`, `templates/project/private/README.md`, `templates/project/private/log/changelog.md`, `templates/project/private/log/open-questions.md`
- Create: `templates/home/CLAUDE.block.md`, `templates/home/metadata-guide.md`, `templates/home/profile.md`, `templates/home/writing-guide.md`, `templates/home/study/README.md`, `templates/home/feedback/README.md`, `templates/home/log/changelog.md`, `templates/home/log/open-questions.md`
- Modify: `lib/workspace-sync.mjs`
- Test: `test/sync.test.mjs`

**Interfaces:**
- Consumes: `placesOf`, `folderRules`, `ROLE_LABELS` (Task 1), `readUser`, `importPath`, `registerProject`의 이름 규칙 (Task 2)
- Produces (`workspace-sync.mjs`):
  - `export const EXCLUDE_LINES_V3 = ['.siloroot/*', '!.siloroot/shared/', '.ignore', 'CLAUDE.local.md']`
  - `export function blockOf(cfg): string` — 모양 1·2는 지금 `claudeBlock(cfg.layout)`, 모양 3 프로젝트는 `templates/project/CLAUDE.block.md`, 홈은 `templates/home/CLAUDE.block.md`. 프로젝트 블록 자리표시: `{{home-path}}`(홈 절대 경로), `{{profile-import}}`(홈이 있으면 `@` + `importPath(<홈>/profile.md)`, 없으면 `홈을 찾지 못했다. /siloroot:init을 다시 실행해 홈을 만든다.`), `{{writing-guide}}`(`importPath(<홈>/writing-guide.md)`).
  - `targets(root, cfg)`는 `cfg.schema ?? (layout === 'wrapped' ? 2 : 1)`로 고른다. 모양 3이면 `dirs`(만들 빈 폴더 목록)를 더 낸다. 프로젝트: `.siloroot/shared/{issues,ideas,decisions,conventions,design,roadmap}`, `.siloroot/private/{feedback,notes,discussions,sources}`. 홈: `study`, `ideas`, `feedback`, `log`.
  - `planRefresh`의 `missingFiles`와 `applyRefresh`의 `created`에 빠진 빈 폴더를 끝 `/`를 붙여 넣는다(예: `.siloroot/shared/issues/`).
  - 모양 3 프로젝트의 줄 목록: `.ignore`는 지금 `IGNORE_LINES`, git 제외는 `EXCLUDE_LINES_V3`. 홈은 줄 목록이 없다.
  - `STALE_CHECK`: 모양 3은 `metadata-guide.md`와 (홈) `feedback/README.md`.
- 템플릿 내용:
  - 블록의 폴더 표는 `| 자리 | 경로 | 무엇이 있나 |`. `placesOf`가 null이 아닌 역할마다 그 역할 이름(`ROLE_LABELS`)과 백틱 경로(폴더는 끝 `/`)가 같은 표 줄에 있다. 한 줄에 이름 여럿을 쉼표로 둘 수 있다.
  - 프로젝트 블록: 경로와 검색 절(지금 `layout-wrapped.md`를 바탕으로 `shared/`만 git에 남는다는 것), `home:`이 `{{home-path}}`라는 설명과 `<이름>:` 꼴(설계 4.5), 방향 원칙(공유 문서는 private/과 `home:`을 가리키지 않는다), 흐름 나누기(개념은 `home:study/`, 사건은 `shared/issues/`, 홈 노트에서 `related: [<이름>:shared/issues/…]`, 이슈는 홈을 가리키지 않는다. 아이디어를 만들기 시작하면 결정은 `shared/decisions/`, 설계는 `shared/design/`, 계획은 `shared/roadmap/`), 사용자 정보 절의 `{{profile-import}}`, 글쓰기 규칙은 `{{writing-guide}}`를 읽는다. 마칠 때는 `private/log/`.
  - 홈 블록: 공부, 개인 아이디어(옆의 결정·설계·로드맵은 같은 `ideas/`), 사용자 정보(`@profile.md`), 글쓰기 규칙, 후보, 작업 기록, 등록된 프로젝트를 가리키는 법(`<이름>:`, 이름은 `~/.siloroot/user.json`).
  - `metadata-guide.md` 두 벌: 지금 가이드의 1, 2, 4, 5절 틀을 따르고 3절 폴더 규칙은 `folderRules` 그대로. 2절 type 표에 새 type 다섯을 넣는다.
  - `shared/README.md`(index): 공유 영역의 폴더 여섯과 git에 올릴지는 사용자가 커밋할 때 고른다는 것. private/README.md(index): 개인 영역의 폴더와 댓글 형식은 home:feedback/README.md를 따른다는 것. 홈 `feedback/README.md`는 지금 home:feedback/README.md를 바탕으로, `study/README.md`와 `profile.md`, `writing-guide.md`, 기록 두 개는 지금 템플릿과 같은 틀.

- [ ] **Step 1: 실패하는 테스트**

```js
const v3 = (mode) => ({ schema: 3, mode, layout: mode === 'home' ? 'flat' : 'wrapped', dirs: {} });
test('모양 3 프로젝트 맞추기는 shared와 private 뼈대와 빈 폴더를 만든다', () => {
  const root = makeProject(); setHome(path.join(userDir(), 'siloroot-home'));
  const p = planRefresh(root, v3('project'));
  for (const f of ['.siloroot/shared/README.md', '.siloroot/private/README.md', '.siloroot/private/log/changelog.md', '.siloroot/shared/issues/', '.siloroot/private/sources/']) assert.ok(p.missingFiles.includes(f), f);
  assert.ok(!p.missingFiles.some((f) => f.includes('01-log') || f.endsWith('.gitignore')));
});
test('모양 3 블록의 자리 표는 placesOf의 모든 자리를 적는다', () => {
  for (const mode of ['project', 'home']) {
    const block = blockOf(v3(mode)), rows = block.split('\n').filter((l) => l.startsWith('|'));
    for (const [role, place] of Object.entries(placesOf(v3(mode)))) {
      if (!place) continue;
      const shown = '`' + place + (place.endsWith('.md') ? '' : '/') + '`';
      assert.ok(rows.some((l) => l.includes(ROLE_LABELS[role]) && l.includes(shown)), mode + ' ' + role);
    }
  }
});
test('프로젝트 블록은 홈 사용자 정보를 ~/ 꼴로 불러오고, 홈이 없으면 안내 문장을 둔다', () => {
  setHome(path.join(userDir(), 'siloroot-home'));
  assert.match(blockOf(v3('project')), /^@~\/siloroot-home\/profile\.md$/m);
  fs.rmSync(userFile());
  assert.doesNotMatch(blockOf(v3('project')), /^@/m); assert.match(blockOf(v3('project')), /\/siloroot:init/);
});
test('모양 3 metadata-guide 3절은 folderRules의 모든 폴더와 type을 적는다', () => { /* 두 벌 모두, prefix와 각 type이 같은 표 줄 */ });
test('모양 2 작업 공간의 맞추기 계획은 그대로다', () => { /* writeConfig(layout wrapped) → planRefresh missingFiles에 .siloroot/01-log/changelog.md, shared/ 없음 */ });
test('git 저장소에서 모양 3 프로젝트를 맞추면 shared 아래만 git에 보인다', () => {
  const root = makeProject(); git(root, ['init', '-q']); setHome(path.join(userDir(), 'siloroot-home'));
  applyRefresh(root, v3('project'));
  write(root, '.siloroot/private/notes/a.md', 'x'); write(root, '.siloroot/shared/ideas/b.md', 'x');
  const st = git(root, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean).map((l) => l.slice(3)).sort();
  assert.deepEqual(st, ['.siloroot/shared/README.md', '.siloroot/shared/ideas/b.md']);
});
```

(`git` 도우미는 `test/init.test.mjs`의 것과 같은 꼴로 이 파일에 둔다. 각 테스트는 `user.json`을 비우고 시작한다.)

- [ ] **Step 2:** `npm test -- --test-name-pattern="모양 3|모양 2 작업 공간의 맞추기|shared 아래만"` → FAIL
- [ ] **Step 3:** 템플릿을 쓰고 `workspace-sync.mjs`를 Interfaces대로 고친다
- [ ] **Step 4:** 같은 명령 → PASS. `npm test` 전체에서 이 Task 때문에 깨진 것이 없어야 한다(init은 아직 모양 2를 만든다)
- [ ] **Step 5:** 커밋 `feat: 모양 3 프로젝트와 홈 템플릿을 맞추기에 넣는다`

### Task 4: init 모드

**Files:**
- Modify: `scripts/init.mjs`
- Test: `test/init.test.mjs`, `test/sync.test.mjs`(init으로 만들던 앞부분)

**Interfaces:**
- Consumes: Task 1~3 전부
- Produces:
  - `initHome(home: string): Promise<{ mode: 'home', root, created, updated, skipped, warnings, notes, port, url }>` — 설정이 없으면 `writeConfig(home, { port: await findFreePort(4181, 4299, { avoid: usedPorts() }), schema: 3, mode: 'home', plugin })`(layout 없음 = flat). 맞추기, `setHome(home)`, 뷰어 빌드.
  - `initProject(root, { home, homeAccess } = {})`:
    - 이미 설정이 있으면 지금처럼 맞추기만 한다(모양 그대로). 경고 "/siloroot:update로 올리세요"는 `pendingMigrations(cfg.schema, SCHEMA).length`일 때만. 모양 3 프로젝트인데 `readUser().home`이 없으면 경고 `홈을 찾지 못했습니다. /siloroot:init --home <경로>로 홈을 다시 만드세요.`
    - 새 프로젝트: `readUser().invalid`면 `{ error: 'user-json-invalid', file: userFile() }`. 홈은 `readUser().home ?? home`. 둘 다 없으면 `{ error: 'need-home', defaultHome: <userDir>/siloroot-home }`를 내고 아무것도 만들지 않는다. 홈에 설정이 없으면 `initHome`. 그다음 `writeConfig(root, { port: findFreePort(4180, 4299, { avoid: usedPorts() }), layout: 'wrapped', schema: 3, mode: 'project', plugin })`, 맞추기, `registerProject(root)`.
    - `homeAccess === 'add'`면 `addAdditionalDirectory(root, home)`. 결과 칸 `homeAccess: 'added'|'present'|'invalid'|'skipped'|'not-asked'`(`'skip'`이면 `'skipped'`, 안 주면 `'not-asked'`).
    - 결과에 `mode: 'project'`, `name`, `home`, `homeCreated: boolean`을 더한다.
  - CLI: `init.mjs <폴더> [--mode project|home] [--home <경로>] [--home-access add|skip]`. `--mode home`이면 `<폴더>`가 홈이다. `error`가 있으면 그 JSON을 표준 출력에 쓰고 종료 코드 2.

- [ ] **Step 1: 실패하는 테스트** (`EXPECTED` 목록을 모양 3으로 바꾼다)

```js
test('홈이 없고 --home도 없으면 need-home을 내고 아무것도 만들지 않는다', async () => {
  const root = makeProject(); const res = await initProject(root);
  assert.equal(res.error, 'need-home'); assert.ok(res.defaultHome.endsWith('/siloroot-home'));
  assert.deepEqual(fs.readdirSync(root), []);
});
test('첫 프로젝트는 홈과 프로젝트를 만들고 user.json에 적는다', async () => {
  const root = makeProject('앱'), home = path.join(userDir(), 'siloroot-home');
  const res = await initProject(root, { home });
  assert.equal(res.homeCreated, true); assert.equal(res.name, '앱'); assert.equal(res.homeAccess, 'not-asked');
  assert.equal(loadConfig(home).mode, 'home'); assert.equal(loadConfig(root).mode, 'project'); assert.equal(loadConfig(root).schema, 3);
  assert.ok(fs.existsSync(path.join(home, 'profile.md'))); assert.ok(fs.existsSync(path.join(root, '.siloroot', 'shared', 'issues')));
  assert.ok(!fs.existsSync(path.join(root, '.siloroot', '01-log')));
  for (const r of [root, home]) assert.match(execFileSync(process.execPath, [BUILD, r], { encoding: 'utf8' }), /속성 점검: 경고 0개/);
});
test('두 번째 프로젝트는 홈을 다시 만들지 않고 홈 포트를 피한다', async () => {
  const home = path.join(userDir(), 'siloroot-home');
  const a = await initProject(makeProject('a'), { home }); const b = await initProject(makeProject('b'));
  assert.equal(b.homeCreated, false); assert.notEqual(b.port, loadConfig(home).port); assert.notEqual(b.port, a.port);
});
test('팀원이 받은 shared/만 있는 저장소에서는 shared 문서를 건드리지 않는다', async () => { /* shared/ideas/x.md 미리 쓰고 init, 내용·mtime 그대로, private/ 생김 */ });
test('--home-access add는 홈을 additionalDirectories에 더한다', async () => { /* homeAccess: 'add' → 'added', 파일 확인 */ });
test('user.json이 깨졌으면 init은 멈추고 파일을 그대로 둔다', async () => { /* error user-json-invalid */ });
test('모양 2 작업 공간에서 다시 실행하면 맞추기만 하고 업데이트 안내를 하지 않는다', async () => { /* writeConfig(layout wrapped) → warnings에 /siloroot:update 없음, shared/ 안 생김, schema 2 그대로 */ });
test('--mode home은 홈만 만든다', () => { /* CLI execFileSync, JSON mode home, user.json home 적힘, projects 빔 */ });
```

- [ ] **Step 2:** `npm test -- --test-name-pattern="need-home|첫 프로젝트|두 번째 프로젝트|팀원이|home-access|init은 멈추고|모양 2 작업 공간에서 다시|--mode home"` → FAIL
- [ ] **Step 3:** 구현. 기존 init 테스트와 `sync.test.mjs`처럼 init으로 작업 공간을 만들던 테스트는 `initProject(root, { home })`를 쓰고 모양 3 경로로 기대값을 고친다. 모양 2 동작을 보던 테스트는 `writeConfig(root, { port, layout: 'wrapped' })` 픽스처로 바꿔 남긴다.
- [ ] **Step 4:** `npm test` 전체 → PASS (원래 있던 포트 테스트 1 실패는 따로 적는다)
- [ ] **Step 5:** 커밋 `feat: init이 모양 3 프로젝트와 홈을 만든다`

### Task 5: 뷰어 데이터 (자리표, 바깥 점, 방향 경고)

**Files:**
- Modify: `viewer/build.mjs`
- Test: `test/build.test.mjs`

**Interfaces:**
- Consumes: `placesOf`, `localPlace`, `folderRules`, `groupOf` (Task 1), `readUser`, `workspaceRoot` (Task 2), `loadConfig`
- Produces (데이터 칸, Task 6이 읽는다):
  - `docs[].folder = groupOf(rel, CFG)`
  - `REQUIRED`를 `folderRules(CFG)`로. 공부, 아이디어, 질문, "나"는 `localPlace(placesOf(CFG).<역할>)`로 찾고, null이면 그 객체는 빈 목록.
  - `objects.me`: `localPlace(places.profile)`이 null이면 `null`.
  - `data.home: { label: '홈', url: string|null } | null` — 모양 3 프로젝트일 때만. url은 `'http://127.0.0.1:' + loadConfig(home).port`, 홈 설정을 못 읽으면 null.
  - `data.externals: Array<{ id: '@' + name, name, label, url: string|null }>` — 가리킨 작업 공간마다 하나. `home`의 label은 `'홈'`, 프로젝트는 그 이름.
  - `data.extEdges: Array<{ from, to: '@' + name, kind: 'code'|'link'|'prop', target: '<name>:<path>' }>` — `edges`와 따로 둔다(문서 화면의 앞뒤 연결 목록에 섞이지 않게).
  - `data.mode`, `data.schema`
- 작업 공간 경로 읽기: `/^([\p{L}\p{N}][\p{L}\p{N}._-]+):([^\s:]+\.(md|markdown))$/u` 이고, 이름이 `home`이거나 `workspaceRoot(name)`이 있을 때만 바깥 연결이다. 이름은 두 글자 이상이라 `C:/x.md`는 걸리지 않고, `https://`는 `.md`로 끝나도 `//` 때문에 `[^\s:]`에 맞지만 이름 `https`가 등록되지 않아 버려진다. 본문의 등록 안 된 이름은 조용히 버린다. `related`의 등록 안 된 이름은 경고 `related의 "<값>": 작업 공간 "<이름>"을 user.json에서 찾지 못함`.
- 방향 경고: 모양 3 프로젝트에서 `shared/` 문서가 private/ 문서나 바깥 연결(`edges`, `extEdges` 모두, 종류 상관없이)을 가리키면 대상마다 한 번 `공유 문서가 팀원이 볼 수 없는 <대상>을 가리킴`.

- [ ] **Step 1: 실패하는 테스트** (각 테스트는 `user.json`을 비우고 `initProject(root, { home })`로 시작)

```js
test('모양 3 프로젝트의 폴더 묶음은 앞 두 마디', async () => { /* shared/ideas/a.md 쓰고 build → docs의 folder 'shared/ideas' */ });
test('home: 연결은 바깥 점 하나로 모이고 문서 연결에는 섞이지 않는다', async () => {
  write(root, '.siloroot/private/notes/n.md', '---\ntype: note\nstatus: 사용 중\nrelated: [home:study/a.md]\n---\n\n# n\n\n`home:study/b.md`\n');
  const d = dataOf(build(root));
  assert.deepEqual(d.externals.map((x) => x.id), ['@home']); assert.equal(d.externals[0].url, 'http://127.0.0.1:' + loadConfig(home).port);
  assert.equal(d.extEdges.length, 2); assert.ok(!d.edges.some((e) => e.to.startsWith('@')));
  assert.ok(!d.objects.issues.some((x) => x.msg.includes('찾지 못함')));
});
test('등록 안 된 이름은 related에서만 경고하고 C:/와 https://는 경로로 읽지 않는다', async () => { /* related [foo:a.md] → 경고 1, 본문 `C:/x.md` `https://a.md` `foo:b.md` → extEdges 0 */ });
test('한글 이름 프로젝트를 가리키는 연결도 바깥 점이 된다', async () => { /* 두 번째 프로젝트 '테스트 폴더 A' 등록 → `테스트-폴더-A:shared/issues/x.md` → externals에 '@테스트-폴더-A' */ });
test('shared 문서가 private나 홈을 가리키면 경고한다', async () => { /* shared/ideas/i.md (type idea, status 아이디어)가 related [private/notes/n.md, home:study/a.md] → 경고 2 */ });
test('모양 3 프로젝트는 "나" 데이터가 없고 홈 주소를 싣는다', async () => { /* objects.me === null, d.home.url */ });
test('홈 빌드는 "나" 데이터를 홈의 profile과 feedback에서 읽는다', async () => { /* home/feedback/t.md trait 반영, profile.md 표 줄 → objects.me.approved 1 */ });
test('새 type은 자기 폴더에서 경고 없이, 다른 폴더에서는 경고', async () => { /* shared/issues/x.md type issue status 열림 → 0, shared/ideas/y.md type issue → 경고 */ });
```

- [ ] **Step 2:** `npm test -- --test-name-pattern="앞 두 마디|바깥 점|등록 안 된 이름|shared 문서가|홈 주소|홈 빌드|새 type"` → FAIL
- [ ] **Step 3:** 구현. 모양 1·2 빌드 결과는 `externals`, `extEdges`가 빈 배열이고 `home`이 null인 것 말고는 그대로다.
- [ ] **Step 4:** `npm test` 전체 → PASS
- [ ] **Step 5:** 커밋 `feat: 뷰어가 자리표로 문서를 읽고 다른 작업 공간 연결을 바깥 점으로 낸다`

### Task 6: 뷰어 화면 (바깥 점, "나" 자리)

**Files:**
- Modify: `viewer/template.html`

**Interfaces:**
- Consumes: `D.externals`, `D.extEdges`, `D.home`, `D.objects.me === null` (Task 5)

- [ ] **Step 1:** `graphData()`가 `D.externals`마다 노드 `{ id, d: { path: id, title: label, folder: '(바깥)', fm: {} }, ext: true, url }`를 더하고, `D.extEdges`를 `GS.kinds` 거르기를 따라 연결로 더한다. `isCommon`, `isArch`는 바깥 노드에 false. `(바깥)`은 폴더처럼 한 묶음이 되어도 된다. 색은 `PAL`이 아닌 흐린 회색 하나.
- [ ] **Step 2:** `nodeSvg`가 바깥 노드에 `ext` 클래스를 붙인다. CSS: 점 투명도 0.45, 이름표는 확대와 상관없이 늘 보인다.
- [ ] **Step 3:** 바깥 노드를 누르면 정보 상자 대신: `fetch(url + '/health', { mode: 'no-cors' })`가 되면 `window.open(url, '_blank', 'noopener')`, 실패하거나 url이 null이면 토스트 `<label> 뷰어가 꺼져 있습니다` (홈이면 `홈 뷰어가 꺼져 있습니다`).
- [ ] **Step 4:** `viewMe()`: `D.objects.me`가 null이면 카드 하나를 그린다. `D.home`이 있으면 "사용자 정보와 "나" 화면은 홈 뷰어에 있습니다"와 홈 뷰어 링크(새 탭), 같은 `no-cors` 확인이 실패하면 링크 옆에 `홈 뷰어가 꺼져 있습니다`. `D.home`이 null이면 `홈을 찾지 못했습니다. /siloroot:init을 다시 실행하세요.` 메뉴의 "나" 숫자 배지는 0으로 둔다.
- [ ] **Step 5: 확인** 임시 사용자 폴더(`SILOROOT_USER_DIR`)로 홈과 프로젝트를 만든 뒤 `home:` 연결이 있는 노트를 하나 쓰고, 프로젝트 뷰어와 홈 뷰어를 `viewer/serve.mjs`로 각각 켜서 내장 브라우저로 본다.
  - 연결 그래프에 흐린 "홈" 점 하나와 선이 보인다. 누르면 홈 뷰어가 새 탭으로 열린다.
  - 홈 서버를 끄고 누르면 `홈 뷰어가 꺼져 있습니다`가 뜬다.
  - 프로젝트 뷰어의 "나"는 홈 링크 카드, 홈 뷰어의 "나"는 지금 화면이다.
  - 모양 2 작업 공간(이 저장소의 `.siloroot/`를 복사한 임시 폴더)의 그래프와 "나"가 바뀌지 않았다.
  - 콘솔 오류가 없다.
- [ ] **Step 6:** `npm test` 전체 → PASS, 커밋 `feat: 연결 그래프에 바깥 점을 그리고 프로젝트 뷰어의 "나"를 홈으로 잇는다`

### Task 7: 훅과 서버가 자리표를 따른다

**Files:**
- Modify: `viewer/serve.mjs`, `viewer/notify.mjs`, `viewer/autostart.mjs`
- Test: `test/hooks.test.mjs`, `test/serve.test.mjs`

**Interfaces:**
- Consumes: `placesOf`, `localPlace` (Task 1), `readUser` (Task 2)
- Produces:
  - `serve.mjs`: 댓글 폴더 `FB_REL = localPlace(placesOf(CFG).feedback)`.
  - `notify.mjs`: 할 일을 `collectItems({ docsRoot, places, show })`로 모은다. `show`는 알림 글에 붙일 경로 앞부분(프로젝트는 `.siloroot/`, 홈은 `<홈 절대 경로>/`). 모양 3 프로젝트는 자기 댓글 자리와 홈의 후보 자리를 함께 본다. 승인된 `trait`의 반영 대상은 홈 `profile.md`, `rule`은 홈 `writing-guide.md`. AI 코멘트 갱신 확인과 `context:always-loaded` 글자 수는 홈의 `aiComment`, `profile`을 본다. 홈을 못 찾거나 `user.json`이 깨졌으면 홈 쪽은 건너뛴다.
  - `autostart.mjs`: 서버 켜기를 `ensureServer(cfg): Promise<{ state: 'mine'|'other'|'down', viewers: number|null }>`로 뗀다. 모양 3 프로젝트면 자기 뷰어 다음에 `readUser().home`의 설정으로 홈 서버도 켠다(브라우저는 열지 않는다). 홈 포트를 다른 폴더가 쓰면 한 줄 `[SiloRoot] 홈 뷰어 포트 <port>을 다른 폴더가 쓰는 중입니다. <홈>/.siloroot/config.json의 port를 바꾸세요.` `VIEWER_AUTOSTART_DRY=1`이면 stderr에 `home:<state>` 한 줄을 더 쓴다.

- [ ] **Step 1: 실패하는 테스트**

```js
test('모양 3 프로젝트 세션은 홈의 승인된 사용자 정보 후보를 알린다', () => { /* initProject(root,{home}); home/feedback/t.md trait 승인 → notify --session 출력에 홈 경로와 profile.md */ });
test('user.json이 깨져도 notify는 프로젝트 할 일만 알리고 끝난다', () => { /* 종료 코드 0, private/feedback 대기 댓글 알림 */ });
test('autostart는 모양 3 프로젝트에서 홈 뷰어도 켠다', async () => { /* DRY, stderr에 home:mine, 홈 /health root가 홈 */ });
test('뷰어 댓글은 private/feedback에 쓴다', async () => { /* serve.test의 댓글 POST를 모양 3 프로젝트로 */ });
```

테스트가 켠 서버는 지금 hooks 테스트처럼 끝에서 끈다(홈 서버 포함).

- [ ] **Step 2:** `npm test -- --test-name-pattern="홈의 승인된|user.json이 깨져도|홈 뷰어도|private/feedback에"` → FAIL
- [ ] **Step 3:** 구현. 모양 1·2에서는 `places`가 지금 `dirs`와 같은 경로를 내므로 출력이 같아야 한다(기존 hooks 테스트가 확인).
- [ ] **Step 4:** `npm test` 전체 → PASS
- [ ] **Step 5:** 커밋 `feat: 훅과 서버가 자리표를 따르고 프로젝트 세션이 홈 뷰어도 켠다`

### Task 8: 스킬을 자리 이름으로, 모양 2 블록의 자리 열, 문서와 버전

**Files:**
- Modify: `skills/note/SKILL.md`, `skills/verify/SKILL.md`, `skills/feedback/SKILL.md`, `skills/init/SKILL.md`, `skills/update/SKILL.md`, `templates/CLAUDE.block.md`, `README.md`, `README.ko.md`, `.claude-plugin/plugin.json`, `package.json`
- Test: `test/sync.test.mjs`, `test/init.test.mjs`

**Interfaces:**
- Consumes: `ROLE_LABELS`, `placesOf` (Task 1), `blockOf` (Task 3), init CLI (Task 4)

- [ ] **Step 1: 실패하는 테스트**

```js
test('모양 2 블록의 자리 표도 placesOf의 모든 자리를 적는다', () => { /* Task 3의 블록 표 테스트를 { schema: 2, layout: 'wrapped', dirs: DEFAULT_DIRS }로 */ });
test('스킬은 옛 폴더 이름을 박지 않는다', () => {
  for (const f of fs.readdirSync(path.join(REPO, 'skills'), { recursive: true }).filter((f) => f.endsWith('.md')))
    assert.doesNotMatch(fs.readFileSync(path.join(REPO, 'skills', f), 'utf8'), /0[1-5]-(log|study|ideas|feedback|profile)/, f);
});
test('플러그인 버전은 0.6.0으로 두 파일이 같다', () => { /* plugin.json, package.json */ });
```

- [ ] **Step 2:** `npm test -- --test-name-pattern="모양 2 블록의 자리|옛 폴더 이름|0.6.0"` → FAIL
- [ ] **Step 3:** 고친다.
  - `templates/CLAUDE.block.md`의 폴더 표를 `| 자리 | 경로 | 무엇이 있나 |`로 바꾼다(관리 블록만 바뀌므로 `SCHEMA`와 상관없다. 모양 2 작업 공간은 `/siloroot:update`의 맞추기로 받는다).
  - 스킬은 "관리 블록 자리 표의 공부 노트 자리", "작업 기록 자리"처럼 역할 이름으로 쓰고, 경로가 `home:`이면 블록에 적힌 홈 경로에서 연다고 적는다.
  - `init` 스킬:
    - 처음 init하는 프로젝트에서는 홈 위치와 홈 쓰기 허락을 함께 묻는다. 홈 기본값은 `need-home`의 `defaultHome`, 허락 기본값은 "더함"이다.
    - 그다음 `--home`과 `--home-access`를 붙여 다시 실행한다.
    - 허락을 물을 때 설계 4.10의 이유를 한 문장으로 말한다.
    - `--mode home` 사용법을 적는다.
  - README 두 벌에 모양 3 구조, 홈, `user.json`, 홈 쓰기 허락을 적는다. 옛 작업 공간은 다음 버전의 `/siloroot:update`로 옮긴다고 적는다.
  - 버전을 0.6.0으로 올린다.
- [ ] **Step 4:** `npm test` 전체 → PASS. `claude plugin validate .` → 통과.
- [ ] **Step 5:** 커밋 `docs: 스킬을 자리 이름으로 쓰고 모양 3을 README에 적는다 (0.6.0)`

## 계획 뒤 (이 계획 밖)

- 브랜치를 푸시해 PR을 연다. PR 본문에는 이 내용을 적는다.
  - `SCHEMA`를 올리고도 `002`를 내지 않은 사정.
  - 확인한 것과 확인하지 못한 것.
  - 원래 있던 포트 테스트 실패.
- 2단계: 업데이트 장치의 계획 고치기, `002`, 업데이트 스킬의 목록 승인과 홈 맞추기. 세션 시작 알림이 홈이 뒤처졌는지도 보는 일은 2단계에서 한다.
