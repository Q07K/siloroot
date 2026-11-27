---
type: plan
status: 확정
created: 2026-11-24
related: [shared/design/update-migration-decision-design.md, shared/ideas/update-migration.md]
---

# 업데이트 장치 1단계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 작업 공간이 자기 모양 번호를 알고, `/siloroot:update`가 미리 보기 → 승인 → 백업 → 마이그레이션·맞추기 → 점검을 하며, 첫 마이그레이션 `001`(flat → wrapped)을 담는다.

**Architecture:** `config.json`에 `schema`, `plugin`, `hold`를 더한다. init의 블록·파일·줄 맞추기를 `lib/workspace-sync.mjs`로 떼어 init과 업데이트가 같이 쓴다. 마이그레이션은 `lib/migrations/`의 번호 붙은 모듈(`plan`/`apply`)이고, `scripts/update.mjs`가 백업(`lib/backup.mjs`)과 함께 순서대로 돌린다. 세션 시작 훅이 뒤처진 작업 공간을 알린다.

**Tech Stack:** Node.js 표준 라이브러리만(ESM, `node:test`). 외부 패키지 없음.

**Spec:** `shared/design/update-migration-decision-design.md` (이 작업 공간 기준 경로. 파일은 저장소의 `.siloroot/03-ideas/`)

## Global Constraints

- 저장소: `C:\Users\<나>\github\q07k\siloroot`. PR #21을 먼저 머지한 최신 `main`에서 `feat/update-migration` 브랜치를 딴다. 다른 세션이 이 폴더를 쓰고 있으면 워크트리를 따로 만든다.
- 외부 의존성 없음. Node 표준 라이브러리만.
- 마지막 버전: `.claude-plugin/plugin.json`과 `package.json` 모두 `0.4.0`.
- `SCHEMA = 2`, `SUPPORTED_SCHEMAS = [1, 2]`. `schema`가 없을 때: `layout`이 `wrapped`면 2, 아니면 1.
- 사용자 문서 내용을 덮어쓰거나 지우지 않는다. 팀 파일(맨 위 `.gitignore`, 맨 위 `CLAUDE.md`의 블록 밖)은 `decisions` 답 없이 바꾸지 않는다.
- `decisions`에 답이 없으면 기본값을 쓰지 않고 멈춘다.
- 업데이트 알림은 세션 시작(`notify.mjs --session`)에만 붙는다. 메시지 알림에는 붙지 않는다.
- 백업 자리: `.siloroot/state/backups/<YYYYMMDD-HHmmss>-schema<from>-to<to>/`. 되돌리기는 최신 백업부터만. 모양을 바꾼 백업(from≠to)은 저절로 지우지 않고, 맞추기만 한 백업(from=to)은 최근 5개.
- 글과 커밋 메시지는 한국어, 이 저장소 `CLAUDE.md`의 규칙(금지어 검사, README 두 벌)을 따른다. 테스트 폴더는 공백과 한글이 든 이름(`test/fixtures.mjs`의 `makeProject`).
- 커밋 끝 줄: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. 맨 위 `CLAUDE.md`가 CRLF 줄바꿈이다 → 블록을 떼어 낸 뒤에도 남은 내용의 줄바꿈이 그대로여야 한다. (Task 5 테스트)
2. `config.json`에 모르는 칸(`metrics: false` 등)이나 BOM이 있다 → 업데이트가 설정을 고친 뒤에도 그 칸이 남아야 한다. (Task 1 테스트)
3. 업데이트를 두 번 돌리거나, 실패 뒤 다시 돌린다 → 두 번째는 `upToDate`이고, 실패 뒤에는 마지막 성공 모양에서 이어진다. (Task 6 테스트)
4. git 저장소가 아닌 폴더 → `001`이 git 제외 목록을 건너뛰고 `notes`로 알린다. (Task 5 테스트)
5. 업데이트 뒤 사용자가 옮겨진 문서를 고친 상태에서 되돌리기 → 멈추고 바뀐 파일을 알려야 한다. (Task 4 테스트)

---

### Task 1: 설정에 모양 번호와 플러그인 버전

**Files:**
- Modify: `lib/config.mjs`
- Test: `test/config.test.mjs`

**Interfaces:**
- Produces:
  - `export const SCHEMA = 2`, `export const SUPPORTED_SCHEMAS = [1, 2]`
  - `loadConfig(root)` 결과에 `schema: number`, `plugin: string|null`, `hold: number|null`를 더한다
  - `export function updateConfig(root, patch: object): void` — 파일의 원래 JSON을 읽어 `patch`를 얕게 합쳐 쓴다. 값이 `null`인 칸은 지운다. 모르는 칸은 남긴다
  - `writeConfig(root, { port, dirs, layout, schema, plugin })` — `schema`, `plugin`이 주어지면 적는다
  - `export function pluginVersion(): string` — `.claude-plugin/plugin.json`의 `version`

- [ ] **Step 1: 실패하는 테스트**

```js
test('schema가 없으면 layout으로 추정한다', () => {
  const a = makeProject(); writeConfig(a, { port: 4180, layout: 'wrapped' });
  assert.equal(loadConfig(a).schema, 2);
  const b = makeProject(); writeConfig(b, { port: 4180 });
  assert.equal(loadConfig(b).schema, 1);
  assert.equal(loadConfig(b).plugin, null);
  assert.equal(loadConfig(b).hold, null);
});
test('updateConfig는 모르는 칸과 BOM 있는 파일을 지키고 null 칸을 지운다', () => {
  const r = makeProject();
  write(r, '.siloroot/config.json', '\ufeff' + JSON.stringify({ version: 1, port: 4181, metrics: false, hold: 2 }));
  updateConfig(r, { schema: 2, plugin: '0.4.0', hold: null });
  const raw = JSON.parse(fs.readFileSync(path.join(r, '.siloroot', 'config.json'), 'utf8'));
  assert.deepEqual(raw, { version: 1, port: 4181, metrics: false, schema: 2, plugin: '0.4.0' });
});
test('pluginVersion은 plugin.json의 버전', () => {
  assert.match(pluginVersion(), /^\d+\.\d+\.\d+$/);
});
```

- [ ] **Step 2:** `npm test -- --test-name-pattern="schema가 없으면|updateConfig|pluginVersion"` → FAIL
- [ ] **Step 3:** 위 Interfaces대로 구현
- [ ] **Step 4:** 같은 명령 → PASS, `npm test` 전체에서 새로 깨진 것 없음
- [ ] **Step 5:** 커밋 `feat: 설정에 작업 공간 모양 번호와 플러그인 버전을 둔다`

### Task 2: init의 맞추기를 함께 쓰는 모듈로 떼기

**Files:**
- Create: `lib/workspace-sync.mjs`, `lib/vocab.mjs`
- Modify: `scripts/init.mjs`, `viewer/build.mjs`(VOCAB를 `lib/vocab.mjs`에서 가져옴)
- Test: `test/init.test.mjs`(기존 통과 유지), `test/sync.test.mjs`(새로)

**Interfaces:**
- Produces (`lib/workspace-sync.mjs`):
  - `START`, `END`, `LOCAL_BLOCK`, `IGNORE_HEAD`, `IGNORE_LINES`, `EXCLUDE_HEAD`, `EXCLUDE_LINES`, `FILES`, `STALE_CHECK` (init.mjs에서 옮김)
  - `readTpl(rel): string`, `claudeBlock(layout): string`, `gitExcludeFile(root): string|null`, `missingTableItems(tplText, curText): string[]`
  - `blockState(file, block): 'created'|'updated'|'skipped'|'conflict'` — 쓰지 않고 판정만
  - `ensureBlock(file, block, fresh)`, `ensureLines(file, head, lines)` (지금과 같은 동작)
  - `planRefresh(root, cfg): { blocks: [{file, state}], missingFiles: [rel], missingLines: [{file, lines}], guideGaps: [{file, tpl, items}] }` — 파일을 바꾸지 않는다. `file`은 프로젝트 맨 위 기준 경로
  - `applyRefresh(root, cfg, { declined = {} }): { created, updated, skipped, warnings }` — `declined`는 `{ <file>: [items] }`, 이 항목은 `guideGaps`에서 뺀다. 안내 문서 줄은 더하지 않는다(스킬이 사람 답을 받아 더함)
- Produces (`lib/vocab.mjs`): `export const VOCAB` (지금 `viewer/build.mjs`의 표 그대로)

- [ ] **Step 1: 실패하는 테스트** (`test/sync.test.mjs`)

```js
test('planRefresh는 파일을 바꾸지 않고 바뀔 블록과 빠진 파일을 알린다', () => {
  const root = makeProject();
  await initProject(root);
  fs.rmSync(path.join(root, '.siloroot', '03-ideas', 'README.md'));
  const cfgFile = path.join(root, '.siloroot', 'CLAUDE.md');
  fs.writeFileSync(cfgFile, fs.readFileSync(cfgFile, 'utf8').replace('흐름 나누기', '옛 이름'));
  const before = fs.readdirSync(root, { recursive: true }).sort();
  const p = planRefresh(root, loadConfig(root));
  assert.deepEqual(fs.readdirSync(root, { recursive: true }).sort(), before);
  assert.ok(p.missingFiles.includes('.siloroot/03-ideas/README.md'));
  assert.equal(p.blocks.find((b) => b.file === '.siloroot/CLAUDE.md').state, 'updated');
});
```

- [ ] **Step 2:** `npm test -- --test-name-pattern="planRefresh"` → FAIL
- [ ] **Step 3:** init.mjs의 상수와 함수를 옮기고 `initProject`가 새 모듈을 쓰게 바꾼다. 동작은 같다
- [ ] **Step 4:** `npm test` → 기존 init, build, wrapped 테스트와 새 테스트 PASS
- [ ] **Step 5:** 커밋 `refactor: init의 블록·파일 맞추기를 lib/workspace-sync.mjs로 뗀다`

### Task 3: init이 모양 번호를 적고 뒤처진 작업 공간을 안내

**Files:**
- Modify: `scripts/init.mjs`, `skills/init/SKILL.md`
- Test: `test/init.test.mjs`

**Interfaces:**
- Consumes: `SCHEMA`, `pluginVersion`, `updateConfig` (Task 1)
- Produces: 새 작업 공간의 `config.json`에 `schema: 2`, `plugin: pluginVersion()`. 이미 있는 작업 공간은 `plugin`을 바꾸지 않는다. `schema < SCHEMA`면 `warnings`에 `작업 공간 모양이 예전 버전입니다(모양 1). /siloroot:update로 올리세요.`

- [ ] **Step 1: 실패하는 테스트**

```js
test('새 init은 schema와 plugin을 적는다', async () => {
  const root = makeProject(); await initProject(root);
  const c = loadConfig(root);
  assert.equal(c.schema, 2); assert.equal(c.plugin, pluginVersion());
});
test('flat 작업 공간에서 init을 다시 돌리면 옮기지 않고 업데이트를 안내한다', async () => {
  const root = makeProject(); writeConfig(root, { port: 4180 });
  write(root, '02-study/a.md', '---\ntype: study\nstatus: 검증 전\ntags: [x]\n---\n\n# a\n');
  const res = await initProject(root);
  assert.ok(fs.existsSync(path.join(root, '02-study', 'a.md')));
  assert.ok(res.warnings.some((w) => w.includes('/siloroot:update')));
});
```

- [ ] **Step 2:** 해당 테스트 → FAIL
- [ ] **Step 3:** 구현. `skills/init/SKILL.md`의 "예전 방식으로 초기화된 폴더는 그 방식을 그대로 따른다. 옮기지 않는다."를 "옮기는 것은 `/siloroot:update`가 한다. init은 옮기지 않는다."로 바꾼다
- [ ] **Step 4:** `npm test` → PASS
- [ ] **Step 5:** 커밋 `feat: init이 작업 공간 모양 번호를 적고 예전 모양이면 업데이트를 안내한다`

### Task 4: 백업과 되돌리기

**Files:**
- Create: `lib/backup.mjs`
- Test: `test/backup.test.mjs`

**Interfaces:**
- Produces:
  - `createBackup(root, { from, to, files: [rel], creates: [rel] }): { name, dir }` — `files`(맨 위 기준, 폴더면 안의 파일 전부)를 `<dir>/files/<rel>`로 복사하고 `manifest.json`(`{ name, created, from, to, files, creates, after: {} }`)을 쓴다. `state/` 아래는 담지 않는다
  - `sealBackup(root, name): void` — 적용 뒤 `files`와 `creates` 경로의 지금 sha256을 `manifest.after`에 적는다(없는 파일은 `null`)
  - `listBackups(root): [{ name, created, from, to }]` — 최신이 앞. `.restored`로 끝나는 폴더는 뺀다
  - `restoreBackup(root, name, { force = false }): { restored: [rel], removed: [rel], conflicts: [rel], keptAfter: string|null }` — `name`이 최신이 아니면 `Error('not-latest')`. `after`와 지금 해시가 다른 파일이 있으면 `force`가 아닐 때 아무것도 바꾸지 않고 `conflicts`만 채워 돌려준다. `force`면 그 파일들을 `<dir>/after-update/`에 복사한 뒤 되돌린다. 되돌린 뒤 폴더 이름을 `<name>.restored`로 바꾼다
  - `pruneBackups(root): string[]` — 지운 이름. from=to 백업만 최근 5개 남김

- [ ] **Step 1: 실패하는 테스트**

```js
test('백업 → 바꾸기 → 되돌리기로 원래대로', () => { /* a.md 내용 바꾸고 b.md 새로 만든 뒤 restore → a 원래 내용, b 없음 */ });
test('업데이트 뒤 고친 파일이 있으면 되돌리기가 멈춘다', () => {
  /* seal 뒤 a.md를 고치면 restoreBackup(...).conflicts === ['a.md'], 파일은 그대로 */
});
test('force면 고친 파일을 after-update에 남기고 되돌린다', () => { /* keptAfter 폴더에 고친 a.md */ });
test('최신이 아닌 백업은 되돌리지 않는다', () => { assert.throws(() => restoreBackup(root, older), /not-latest/); });
test('맞추기 백업은 5개만, 모양 바꾼 백업은 남긴다', () => { /* from=to 7개 + from≠to 1개 → prune 뒤 6개 */ });
```

- [ ] **Step 2:** `npm test -- --test-name-pattern="백업|되돌리기"` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** 커밋 `feat: 업데이트 백업과 되돌리기`

### Task 5: 마이그레이션 틀과 001(flat → wrapped)

**Files:**
- Create: `lib/migrations/index.mjs`, `lib/migrations/001-wrap-siloroot-folder.mjs`
- Test: `test/migrate-001.test.mjs`

**Interfaces:**
- Consumes: `workspace-sync`(Task 2), `VOCAB`(Task 2), `updateConfig`(Task 1)
- Produces:
  - `MIGRATIONS: Migration[]`(번호 순), `pendingMigrations(fromSchema, toSchema): Migration[]`
  - `Migration = { id, from, to, title, plan(ctx), apply(ctx, answers) }`, `ctx = { root, cfg }`
  - `plan` 결과: `{ moves: [{from, to}], edits: [{file, what}], decisions: [{id, question, why, options: [string], default: string}], notes: [string], touches: { files: [rel], creates: [rel] } }` — `touches`는 백업에 쓴다(옮길 것의 원래 경로와 고칠 파일 / 옮긴 뒤 경로와 새로 만들 파일)
  - `apply` 결과: `{ moved: [rel], edited: [rel], created: [rel], notes: [string] }`
- `001`의 `decisions` id와 값(설계 4.3):
  - `move-folder:<이름>`: `move` | `stay`, 기본 `stay` — 맨 위의 다른 폴더 중 안 마크다운이 모두 `VOCAB`의 `type`을 가진 것
  - `root-claude-skeleton`: `delete` | `keep`, 기본 `delete` — 블록을 뗀 뒤 남는 것이 프론트매터와 `# 작업 규칙`뿐일 때
  - `root-claude-outside`: `move` | `keep`, 기본 `keep` — 블록 밖에 사용자 내용이 있을 때(`move`면 `.siloroot/CLAUDE.md`의 블록 뒤에 붙임)
  - `root-gitignore`: `delete` | `keep`, 기본 `keep` — 맨 위 `.gitignore`가 `templates/gitignore`와 같을 때
  - `git-tracked`: `keep-tracked` | `make-private`, 기본 `keep-tracked` — 옮길 파일 중 `git ls-files`에 나오는 것이 있을 때. `keep-tracked`면 `git mv`로 옮기고 제외 목록에 `.siloroot/`를 넣지 않는다

- [ ] **Step 1: 실패하는 테스트**

```js
const flatProject = () => { /* writeConfig(port만), 01-log~05-profile 문서, metadata-guide.md, writing-guide.md,
  맨 위 CLAUDE.md = 팀 내용 + 블록(claudeBlock('flat')), templates/gitignore와 같은 .gitignore */ };
test('plan은 파일을 바꾸지 않는다', () => { /* 앞뒤 파일 목록 같음, moves에 02-study 등 */ });
test('apply 뒤 모양이 새로 init한 감싼 작업 공간과 같고 문서 내용은 바이트까지 같다', () => {
  /* .siloroot/CLAUDE.md 블록 === claudeBlock('wrapped'), CLAUDE.local.md에 LOCAL_BLOCK,
     .ignore에 IGNORE_LINES, config.layout === 'wrapped', schema === 2, 옮긴 a.md 바이트 같음,
     맨 위 CLAUDE.md의 팀 내용 그대로, 블록 없음 */
});
test('CRLF CLAUDE.md에서 블록을 떼도 남은 줄바꿈이 CRLF', () => {});
test('git 저장소가 아니면 제외 목록을 건너뛰고 notes로 알린다', () => {});
test('커밋된 문서가 있으면 git-tracked를 묻고 keep-tracked면 git mv로 옮긴다', () => {
  /* git init, add, commit → plan.decisions에 git-tracked → apply 뒤 git status가 rename으로 보임 */
});
test('VOCAB type만 든 사용자 폴더는 move-folder로 묻고 stay면 그대로', () => {});
```

- [ ] **Step 2:** `npm test -- --test-name-pattern="plan은|apply 뒤|CRLF|git"` → FAIL
- [ ] **Step 3:** 구현. 관리 블록 떼기는 `START`~`END`를 잘라 내고 남은 문자열을 그대로 쓴다(줄바꿈 보존)
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** 커밋 `feat: 마이그레이션 틀과 첫 마이그레이션(예전 배치를 .siloroot/로 감싸기)`

### Task 6: `scripts/update.mjs`

**Files:**
- Create: `scripts/update.mjs`
- Test: `test/update.test.mjs`

**Interfaces:**
- Consumes: Task 1, 2, 4, 5
- Produces:
  - `planUpdate(root): { from, to, pluginFrom, pluginTo, hold, migrations: [{ id, title, from, to, held, plan }], refresh, upToDate }` — `held`는 `hold != null && m.to <= hold`. `upToDate`는 `migrations`가 비었거나 모두 `held`이고 `refresh`의 블록이 모두 `skipped`, `missingFiles`, `missingLines`, `guideGaps`가 비었을 때
  - `applyUpdate(root, answers): { backup: string|null, migrations: [{ id, status: 'applied'|'held'|'failed', error? }], refresh, check: { warnings: number, broken: [string] }, schema, plugin, stoppedAt: string|null }`
  - `answers = { migrations: { [id]: 'apply'|'hold' }, decisions: { [id]: string }, declined: { [file]: [items] } }`
  - CLI: `--plan`, `--apply [--answers <file>]`, `--restore <name> [--force]`, `--backups` — 결과 JSON을 표준 출력
- 동작(설계 4.5, 4.7-1):
  - 적용할 마이그레이션의 `decisions`에 답이 빠지면 아무것도 바꾸지 않고 `{ error: 'missing-decisions', ids: [...] }`
  - `hold`로 답한 마이그레이션은 건너뛰고 `hold`에 그 `to`를 적는다. `apply`로 답하면 `hold`를 지운다
  - 바꿀 파일이 있으면 시작 전에 백업 하나(모든 `touches` + 맞추기로 바뀔 파일), 끝에 `sealBackup`, `pruneBackups`
  - 마이그레이션 하나가 끝날 때마다 `updateConfig({ schema: m.to })`. 실패하면 `stoppedAt: id`로 멈추고 맞추기는 하지 않는다
  - 마지막에 `applyRefresh`, `updateConfig({ plugin: pluginVersion() })`, `viewer/build.mjs` 실행 후 출력에서 `속성 점검: 경고 N개`와 `related의 "…" 문서를 찾지 못함` 줄을 모아 `check`
  - 바꿀 파일이 하나도 없으면 백업 없이 `plugin`만 적는다
  - `answers.declined`는 `.siloroot/state/update-declined.json`에 합쳐 저장하고, `planUpdate`는 이 파일을 읽어 `applyRefresh`/`planRefresh`의 `declined`로 넘긴다(다음 업데이트에서 다시 묻지 않음, 설계 4.4)
  - `cfg.schema`가 `SUPPORTED_SCHEMAS`에 없으면 `planUpdate`와 `applyUpdate` 모두 아무것도 바꾸지 않고 `{ error: 'unsupported-schema', schema }`

- [ ] **Step 1: 실패하는 테스트**

```js
test('flat 작업 공간: plan → apply → 두 번째 plan은 upToDate', () => {});
test('decisions 답이 없으면 아무것도 바꾸지 않는다', () => {});
test('hold로 답하면 모양은 그대로, 맞추기만 하고 hold가 적힌다', () => {});
test('마이그레이션이 실패하면 거기서 멈추고 schema는 마지막 성공 값', () => {
  /* 테스트용 실패 마이그레이션을 MIGRATIONS에 잠깐 끼워 넣는다 */
});
test('plugin만 다르면 백업 없이 plugin만 적는다', () => {});
test('거절한 안내 문서 줄은 다음 plan의 guideGaps에 다시 나오지 않는다', () => {});
test('모르는 schema(예: 9)면 아무것도 바꾸지 않고 unsupported-schema', () => {});
test('--restore로 apply 전 모양으로 돌아간다', () => {});
```

- [ ] **Step 2:** → FAIL
- [ ] **Step 3:** 구현. 끝에 `timeScript(root, 'script', 'script:update')`로 사용 기록(기존 init.mjs 방식)
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** 커밋 `feat: 업데이트 스크립트(미리 보기, 적용, 되돌리기)`

### Task 7: 세션 시작 업데이트 알림

**Files:**
- Create: `lib/update-check.mjs`
- Modify: `viewer/notify.mjs`
- Test: `test/hooks.test.mjs`

**Interfaces:**
- Consumes: `SCHEMA`, `pluginVersion`, `MIGRATIONS`
- Produces: `updateNotice(cfg): string[]` — 파일을 읽지 않는다. `cfg.schema < SCHEMA`이고 `!(cfg.hold != null && SCHEMA <= cfg.hold)`면 `작업 공간 모양 ${cfg.schema} → ${SCHEMA}: ${제목들}`, `cfg.plugin !== pluginVersion()`이면 `규칙 블록과 안내 문서를 ${version}에 맞출 수 있습니다`
- notify.mjs: `--session`일 때만, 줄이 있으면 `[SiloRoot] 업데이트할 것이 있습니다. /siloroot:update로 미리 보고 올릴 수 있습니다.` 덩어리를 할 일 덩어리 앞에 붙인다(할 일이 없어도 낸다). 메시지 알림에는 붙이지 않는다

- [ ] **Step 1: 실패하는 테스트**

```js
test('뒤처진 작업 공간은 세션 시작에만 업데이트를 알린다', () => {
  const root = makeProject(); writeConfig(root, { port: 4180 });   // flat, schema 1
  assert.match(JSON.parse(run('notify.mjs', root, ['--session'])).hookSpecificOutput.additionalContext, /업데이트할 것이 있습니다/);
  assert.doesNotMatch(run('notify.mjs', root), /업데이트할 것/);
});
test('hold가 SCHEMA 이상이면 모양 알림을 끄고 맞추기 알림만 남긴다', () => {});
test('최신 작업 공간은 업데이트 알림이 없다', () => { /* schema 2, plugin 지금 버전 */ });
```

- [ ] **Step 2:** → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** `npm test` → PASS
- [ ] **Step 5:** 커밋 `feat: 세션 시작 때 뒤처진 작업 공간을 알린다`

### Task 8: `/siloroot:update` 스킬, 문서, 정책, 버전

**Files:**
- Create: `skills/update/SKILL.md`
- Modify: `README.md`, `README.ko.md`, `CLAUDE.md`(저장소), `.claude-plugin/plugin.json`, `package.json`

**Interfaces:**
- Consumes: `scripts/update.mjs` CLI (Task 6)

- [ ] **Step 1:** `skills/update/SKILL.md` — frontmatter `name: update`, `description`에 트리거("SiloRoot 업데이트", "/siloroot:update", "[SiloRoot] 업데이트할 것이 있습니다" 알림, "되돌려 줘"). 본문은 설계 4.8의 8단계와 되돌리기 그대로: `node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --plan` → 마이그레이션마다 올릴지/머물지 → `decisions` 하나씩 → `guideGaps` 줄마다 → 최종 승인 → 답을 `.siloroot/state/update-answers.json`에 써서 `--apply --answers` → 결과 알림 → private/worklog/ 한 줄. `upToDate`인데 `plugin`만 다르면 묻지 않고 `--apply`. 사용자가 더하겠다고 한 안내 문서 줄은 AI가 그 파일에 더하고, 거절한 줄은 `declined`로 넘긴다
- [ ] **Step 2:** README 두 벌의 스킬 표에 `/siloroot:update` 한 줄, "업데이트" 절(무엇을 하고, 머물 수 있고, 되돌릴 수 있다)을 같은 내용으로
- [ ] **Step 3:** 저장소 `CLAUDE.md` "올리기 전 확인"에 두 줄: "폴더 배치, 문서 위치, 속성 값, 설정 모양이 바뀌면 `SCHEMA`를 올리고 `lib/migrations/`에 마이그레이션과 테스트를 함께 낸다." "관리 블록이나 안내 문서 템플릿만 바뀌면 `SCHEMA`는 그대로 둔다."
- [ ] **Step 4:** 버전 `0.4.0` 두 파일
- [ ] **Step 5:** `npm test`(알려진 포트 테스트 실패 1개 말고 모두 통과)와 `claude plugin validate .`(새 경고 없음)
- [ ] **Step 6:** 커밋 `feat: /siloroot:update 스킬과 마이그레이션 정책 (0.4.0)`, 푸시, PR(본문: 무엇을 왜, 확인한 것, 확인하지 못한 것)

## 계획 뒤 (이 계획 밖)

- 플러그인을 0.4.0으로 올린 뒤 이 작업 공간에서 `/siloroot:update`를 돌려 본다(이 작업 공간은 이미 wrapped라 맞추기만 나와야 한다).
- 구조 분리(`002`)는 다음 설계에서.
