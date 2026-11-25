---
name: migrate
description: SiloRoot 작업 공간을 새 모양으로 옮긴다(마이그레이션). 옮기기 전에 백업하고, 되돌린다. 세션 시작 훅이나 /siloroot:update가 "작업 공간 모양 N → M"을 알린 뒤 사용자가 옮기자고 할 때, 사용자가 "/siloroot:migrate", "작업 공간 옮겨 줘"라고 할 때, 업데이트나 마이그레이션 뒤 "되돌려 줘"라고 할 때 쓴다. 버전이 오를 때마다 하는 가벼운 맞추기와 플러그인 올리기는 /siloroot:update가 한다.
---

# SiloRoot 작업 공간 옮기기

작업 공간(`.siloroot/config.json`이 있는 프로젝트 폴더)의 모양(`schema`)이 설치된 플러그인보다 낮을 때 한 칸씩 옮긴다. 모양은 부 버전(0.x.0)이 오를 때만 바뀐다. 파일을 직접 옮기거나 고치지 말고 아래 스크립트를 실행한다. 스크립트가 바꾸기 전에 백업하고, 되돌릴 수 있다.

- 마이그레이션: 모양 1 → 2는 프로젝트 맨 위 문서를 `.siloroot/` 안으로 감싼다. 2 → 3은 문서를 `shared/`(팀과 나눌 것)와 `private/`(나만)로 나누고, 공부 노트와 사용자 정보, 글쓰기 규칙은 홈(사람마다 하나, 프로젝트 밖)으로 옮긴다. 3 → 4는 문서 자리를 다시 짠다(작업 일지, 확인할 것, 구현 계획, 자리마다 README).
- 옮긴 뒤 관리 블록과 빠진 파일, 줄도 새 모양에 맞춘다. 이미 있는 안내 문서(`metadata-guide.md` 등)는 덮어쓰지 않는다.
- 사람이 고를 것(`decisions`)과 안내 문서에 더할 줄은 사용자에게 묻는다. 답 없이 기본값을 고르지 않는다.

스크립트: `node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더 절대 경로>" <명령>`. 출력은 모두 JSON이다.

옮기기 전에: Claude의 셸 작업 폴더가 옮길 폴더 안(예: `.siloroot/` 아래)이면 프로젝트 맨 위로 나온다. 셸이 폴더를 잡고 있으면 옛 폴더를 지우다 멈춘다(EBUSY).

## 옮기기

1. 미리 본다. 파일은 바뀌지 않는다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --plan
   ```

   출력: `from`(지금 모양), `to`(이번에 갈 모양), `more`(그 뒤에도 갈 모양이 남았는가), `pluginFrom`, `pluginTo`, `hold`(머물기로 한 모양), `migrations`(다음 하나만. `id`, `title`, `held`, `plan`), `refresh`(`blocks`, `missingFiles`, `missingLines`, `guideGaps`), `upToDate`.
   - 모양은 한 번에 한 칸씩 오른다. `more`가 true면 이번 것을 적용한 뒤 1단계부터 다시 미리 본다. 앞 마이그레이션이 옮긴 뒤의 모양을 보고 다음 것을 계획해야 해서다.
   - `error`가 `unsupported-schema`면 이 플러그인이 모르는 모양이다. `/siloroot:update`로 플러그인을 올리라고 알리고 끝낸다.
   - `migrations`가 비어 있으면 옮길 것이 없다. 관리 블록 맞추기는 `/siloroot:update`가 한다고 알리고 끝낸다.
   - `held`인 마이그레이션이면 "모양 N에 머물고 있습니다. 옮기려면 말씀하세요"를 알린다. 사용자가 옮기자고 하면 3단계부터 이어 간다.

2. 바뀌는 것을 짧게 보여 준다: 마이그레이션 제목, 옮길 것 수와 예 두세 개(`plan.moves`), 고칠 파일(`plan.edits`), 알릴 것(`plan.notes`), 맞출 관리 블록(`refresh.blocks`에서 `skipped`가 아닌 것), 새로 만들 파일과 줄.

3. 마이그레이션마다 "옮길까요, 지금 모양에 머물까요?"를 묻는다. 머물면 그 마이그레이션은 하지 않고 관리 블록 맞추기만 받으며, 그 모양 알림은 다시 나오지 않는다(더 새 모양이 나오면 한 번 다시 알린다). 하나를 머물면 그 뒤 마이그레이션도 머문다.

   3-1. 옮기기로 한 마이그레이션의 `plan.decisions`를 하나씩 묻는다. `question`, `why`, 고를 값(`options`), 기본값(`default`)을 보여 준다. 사용자가 "기본값으로"라고 하면 그 값을 답으로 쓴다. `free: true`인 질문(홈 위치 같은 경로)은 고를 값이 없고 사용자가 적은 값을 그대로 답으로 쓴다.

   3-2. `plan.placements`가 있으면(문서를 다른 자리로 나누는 마이그레이션, 예: 002) 갈 곳 목록을 한 번 승인받는다.
   - 003에서는 아이디어 폴더 안의 결정, 설계, 계획 문서를 제자리(`shared/decisions/`, `shared/design/`, `shared/plans/`)로 옮기는 목록이다. 그대로 두려면 갈 곳에 옛 경로를 적는다. 갈 곳은 `shared/…`나 `private/…`의 `.md`만 된다.
   - `review`가 true인 문서만 Claude가 읽고 갈 곳을 제안한다. 002에서는 아이디어 문서다. 이 프로젝트의 제품 아이디어면 기본값(`shared/ideas/…`), 사람 개인의 아이디어면 `home:ideas/<이름>.md`를 제안하고 까닭을 한 줄 붙인다.
   - 그다음 목록 전체를 한 번 보여 준다. 폴더별로 묶어 "옛 경로 → 갈 곳"을 보이고, `review`인 줄과 Claude가 바꾸자고 제안한 줄에 표시를 단다. 아이디어 옆의 결정 문서와 그림은 아이디어를 따라가므로 따로 묻지 않는다고 알린다.
   - `plan.notes`에 있는 "커밋하지 않는다"는 줄을 함께 보여 준다. `shared/`에 놓인 문서를 팀 저장소에 올릴지는 커밋할 때 사용자가 고른다.
   - 사용자는 "기본값으로", "제안대로" 또는 고칠 줄만 말한다. 기본값과 다른 줄만 답의 `placements`에 `"<옛 경로>": "<갈 곳>"`으로 적는다. 갈 곳은 `shared/…`, `private/…`, `home:…` 꼴이다.

   3-3. 답(특히 홈 위치와 갈 곳)에 따라 새 질문이 생길 수 있다(예: 홈에 같은 이름 노트가 있음, `home-collision:<경로>`). 답을 넣어 다시 미리 본다: 답 파일을 쓰고 `--apply`를 돌리면, 빠진 질문이 있을 때 아무것도 바꾸지 않고 `missing-decisions`를 낸다. 그 `ids`를 마저 묻는다. `error`가 `bad-placement`, `placement-conflict`, `home-path-space`, `home-in-project`, `not-home`, `user-json-invalid`면 아무것도 바뀌지 않았다. `detail`을 보여 주고 답을 고친다.

4. `refresh.guideGaps`가 있으면 파일마다 빠진 표 항목(`items`)을 보여 주고 줄마다 더할지 묻는다. `${CLAUDE_PLUGIN_ROOT}/templates/<tpl>`에서 그 항목이 든 줄을 찾아 보여 준다. 사용자가 일부러 지운 줄일 수 있다.
   - 더하기로 한 줄: 적용 뒤(6단계 다음) 그 파일의 같은 표에 Claude가 직접 더한다.
   - 더하지 않기로 한 줄: 답의 `declined`에 넣는다. 다음 업데이트에서 다시 묻지 않는다.

5. 마지막으로 정리해 보여 주고 "이대로 옮길까요?"를 묻는다. 승인 없이 적용하지 않는다.

6. 답을 `.siloroot/state/update-answers.json`에 쓰고 적용한다.

   ```json
   { "migrations": { "<id>": "apply 또는 hold" }, "decisions": { "<id>": "<고른 값>" }, "placements": { "<옛 경로>": "<갈 곳>" }, "declined": { "<파일>": ["<표 항목>"] } }
   ```

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --apply --answers "<프로젝트 폴더>/.siloroot/state/update-answers.json"
   ```

   - `error`가 `missing-decisions`면 아무것도 바뀌지 않았다. `ids`의 항목을 마저 묻고 다시 돌린다(`migration:<id>`는 3단계의 올릴지 머물지).
   - `stoppedAt`이 있으면 그 마이그레이션에서 실패해 멈췄다. 앞의 것은 적용됐고 `schema`는 마지막으로 성공한 모양이다. `migrations`의 `error`를 전하고, 원인을 치운 뒤 다시 올릴지, 백업(`backup`)으로 되돌릴지 묻는다.
   - `stoppedAt`이 `refresh`면 마이그레이션은 끝났고 관리 블록 맞추기에서 실패했다(`refreshError`). `plugin`은 적지 않았다. 원인을 치운 뒤 다시 돌리면 이어진다.

7. 결과를 알린다: 백업 이름(`backup`, 없으면 파일을 바꾸지 않은 것), 마이그레이션 결과, 만든 파일과 고친 파일(`refresh`), 알릴 것(`refresh.notes`, `refresh.warnings`), 점검 결과(`check.warnings` 속성 경고 수, `check.broken` 끊어진 `related`), 되돌리는 법("되돌려 줘"라고 하면 된다). 감싼 배치로 옮겼으면 규칙은 `CLAUDE.local.md`가 불러오므로 다음 세션부터 적용된다고 알린다.

8. 작업 기록에 한 줄을 남긴다. 예: `SiloRoot 옮기기: 모양 3 → 4, 플러그인 0.8.0 (백업 <이름>)`. 모양 4는 그날 작업 일지(`private/worklog/YYYY-MM-DD.md`, 홈은 `worklog/`), 모양 3은 `private/log/changelog.md`, 그 전은 작업 기록 폴더(`config.json`의 `dirs.log`)의 `changelog.md`다.

9. `more`였으면 1단계부터 다시 미리 본다.

10. 홈 옮기기: 모양 3 이상 프로젝트면(옮긴 직후 포함) 홈도 같은 스크립트로 미리 본다. 홈 위치는 `~/.siloroot/user.json`의 `home`이다(관리 블록에도 적혀 있다).

    ```bash
    node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<홈 폴더>" --plan
    ```

    홈에 옮길 마이그레이션(`migrations`)이 있으면 1~7단계를 홈에 대해 한다. 없고 맞출 것만 남았으면 `/siloroot:update`가 맞춘다고 알리고 넘어간다. 홈의 백업은 홈의 `.siloroot/state/backups/`에 따로 쌓인다. 기록은 홈의 작업 일지(모양 4는 `worklog/YYYY-MM-DD.md`, 모양 3은 `log/changelog.md`)에 남긴다.

11. 마이그레이션 계획에 `plan.after`(옮긴 뒤 Claude가 할 일)가 있었으면, 적용한 뒤 그 항목을 차례로 한다. 문서를 고치는 일은 하나씩 묻고 승인한 것만 한다. 이 일은 업데이트 백업 밖이라고 알린다.

## 되돌리기

사용자가 "되돌려 줘"라고 하면(`/siloroot:update`의 맞추기 백업도 여기서 되돌린다):

1. 백업 목록을 보여 준다(최신이 앞, `from` → `to`, 만든 때).

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --backups
   ```

2. 되돌리기는 최신 백업부터 차례로만 된다. 더 오래된 것으로 가려면 최신부터 하나씩 되돌린다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --restore "<백업 이름>"
   ```

3. `conflicts`가 비어 있지 않으면 아무것도 되돌리지 않은 것이다. 업데이트 뒤 고쳤거나 새로 만든 파일 목록이니 보여 주고 묻는다. 모양을 바꾼 업데이트 뒤에는 올리기 8단계에서 쓴 작업 기록 한 줄도 여기에 나온다. 사용자가 "그래도 되돌림"을 고르면 `--force`를 붙여 다시 돌린다. 그 파일들은 `keptAfter` 폴더에 따로 남는다고 알린다.
4. `error`가 `not-latest`면 `latest`가 최신 백업이다. 그것부터 되돌리라고 알린다.
5. 되돌린 파일(`restored`)과 지운 파일(`removed`)을 알리고, 작업 기록에 한 줄을 남긴다.

옮길 때 문서를 git에 계속 올리기로 했다면(`git mv`로 옮긴 경우) 되돌린 뒤 `git status`에 옮김이 남아 있을 수 있다. 그때는 `git restore --staged`로 정리할 수 있다고 알린다.
