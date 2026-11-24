---
name: update
description: SiloRoot 작업 공간을 설치된 플러그인 버전에 맞춘다. 예전 모양의 작업 공간을 새 모양으로 옮기고(마이그레이션), 관리 블록과 안내 문서를 맞추고, 되돌린다. 사용자가 "SiloRoot 업데이트", "/siloroot:update"라고 할 때, 세션 시작 훅이 "[SiloRoot] 업데이트할 것이 있습니다"라고 알린 뒤 사용자가 올리자고 할 때, 업데이트 뒤 "되돌려 줘"라고 할 때 쓴다. 플러그인 자체 설치나 버전 올리기는 Claude Code의 /plugin이 한다.
---

# SiloRoot 업데이트

작업 공간(`.siloroot/config.json`이 있는 프로젝트 폴더)을 지금 설치된 플러그인에 맞춘다. 파일을 직접 옮기거나 고치지 말고 아래 스크립트를 실행한다. 스크립트가 바꾸기 전에 백업하고, 되돌릴 수 있다.

- 마이그레이션: 작업 공간 모양(`schema`)이 플러그인보다 낮으면 순서대로 옮긴다. 예: 모양 1 → 2는 프로젝트 맨 위에 있던 문서를 `.siloroot/` 안으로 감싼다.
- 맞추기: 관리 블록을 새 템플릿으로 바꾸고, 빠진 파일과 줄을 더한다. 이미 있는 안내 문서(`metadata-guide.md` 등)는 덮어쓰지 않는다.
- 사람이 고를 것(`decisions`)과 안내 문서에 더할 줄은 사용자에게 묻는다. 답 없이 기본값을 고르지 않는다.

스크립트: `node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더 절대 경로>" <명령>`. 출력은 모두 JSON이다.

## 올리기

1. 미리 본다. 파일은 바뀌지 않는다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --plan
   ```

   출력: `from`(지금 모양), `to`(플러그인 모양), `pluginFrom`, `pluginTo`, `hold`(머물기로 한 모양), `migrations`(각각 `id`, `title`, `held`, `plan`), `refresh`(`blocks`, `missingFiles`, `missingLines`, `guideGaps`), `upToDate`.
   - `error`가 `unsupported-schema`면 이 플러그인이 모르는 모양이다. 플러그인을 더 새 버전으로 올리라고 알리고 끝낸다.
   - `upToDate`이고 `pluginFrom`과 `pluginTo`가 같으면 "최신입니다"로 끝낸다. `held`인 마이그레이션이 있으면 "모양 N에 머물고 있습니다. 올리려면 말씀하세요"를 덧붙인다. 사용자가 올리자고 하면 3단계부터 이어 간다.
   - `upToDate`인데 `plugin`만 다르면 묻지 않고 `--apply`만 돌린다(파일은 바뀌지 않고 버전만 적힌다). 6단계로 간다.

2. 바뀌는 것을 짧게 보여 준다: 마이그레이션 제목, 옮길 것 수와 예 두세 개(`plan.moves`), 고칠 파일(`plan.edits`), 알릴 것(`plan.notes`), 맞출 관리 블록(`refresh.blocks`에서 `skipped`가 아닌 것), 새로 만들 파일과 줄.

3. 마이그레이션마다 "올릴까요, 지금 모양에 머물까요?"를 묻는다. 머물면 그 마이그레이션은 하지 않고 관리 블록 맞추기만 받으며, 그 모양 알림은 다시 나오지 않는다(더 새 모양이 나오면 한 번 다시 알린다). 하나를 머물면 그 뒤 마이그레이션도 머문다.

   3-1. 올리기로 한 마이그레이션의 `plan.decisions`를 하나씩 묻는다. `question`, `why`, 고를 값(`options`), 기본값(`default`)을 보여 준다. 사용자가 "기본값으로"라고 하면 그 값을 답으로 쓴다.

4. `refresh.guideGaps`가 있으면 파일마다 빠진 표 항목(`items`)을 보여 주고 줄마다 더할지 묻는다. `${CLAUDE_PLUGIN_ROOT}/templates/<tpl>`에서 그 항목이 든 줄을 찾아 보여 준다. 사용자가 일부러 지운 줄일 수 있다.
   - 더하기로 한 줄: 적용 뒤(6단계 다음) 그 파일의 같은 표에 Claude가 직접 더한다.
   - 더하지 않기로 한 줄: 답의 `declined`에 넣는다. 다음 업데이트에서 다시 묻지 않는다.

5. 마지막으로 정리해 보여 주고 "이대로 올릴까요?"를 묻는다. 승인 없이 적용하지 않는다.

6. 답을 `.siloroot/state/update-answers.json`에 쓰고 적용한다.

   ```json
   { "migrations": { "<id>": "apply 또는 hold" }, "decisions": { "<id>": "<고른 값>" }, "declined": { "<파일>": ["<표 항목>"] } }
   ```

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --apply --answers "<프로젝트 폴더>/.siloroot/state/update-answers.json"
   ```

   - `error`가 `missing-decisions`면 아무것도 바뀌지 않았다. `ids`의 항목을 마저 묻고 다시 돌린다(`migration:<id>`는 3단계의 올릴지 머물지).
   - `stoppedAt`이 있으면 그 마이그레이션에서 실패해 멈췄다. 앞의 것은 적용됐고 `schema`는 마지막으로 성공한 모양이다. `migrations`의 `error`를 전하고, 원인을 치운 뒤 다시 올릴지, 백업(`backup`)으로 되돌릴지 묻는다.
   - `stoppedAt`이 `refresh`면 마이그레이션은 끝났고 관리 블록 맞추기에서 실패했다(`refreshError`). `plugin`은 적지 않았다. 원인을 치운 뒤 다시 돌리면 이어진다.

7. 결과를 알린다: 백업 이름(`backup`, 없으면 파일을 바꾸지 않은 것), 마이그레이션 결과, 만든 파일과 고친 파일(`refresh`), 알릴 것(`refresh.notes`, `refresh.warnings`), 점검 결과(`check.warnings` 속성 경고 수, `check.broken` 끊어진 `related`), 되돌리는 법("되돌려 줘"라고 하면 된다). 감싼 배치로 옮겼으면 규칙은 `CLAUDE.local.md`가 불러오므로 다음 세션부터 적용된다고 알린다.

8. 작업 기록(`01-log/changelog.md`)에 한 줄을 남긴다. 예: `SiloRoot 업데이트: 모양 1 → 2, 플러그인 0.4.0 (백업 <이름>)`.

## 되돌리기

사용자가 "되돌려 줘"라고 하면:

1. 백업 목록을 보여 준다(최신이 앞, `from` → `to`, 만든 때).

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --backups
   ```

2. 되돌리기는 최신 백업부터 차례로만 된다. 더 오래된 것으로 가려면 최신부터 하나씩 되돌린다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --restore "<백업 이름>"
   ```

3. `conflicts`가 비어 있지 않으면 아무것도 되돌리지 않은 것이다. 업데이트 뒤 고쳤거나 새로 만든 파일 목록이니 보여 주고 묻는다. 모양을 바꾼 업데이트 뒤에는 올리기 8단계에서 쓴 `changelog.md` 한 줄도 여기에 나온다. 사용자가 "그래도 되돌림"을 고르면 `--force`를 붙여 다시 돌린다. 그 파일들은 `keptAfter` 폴더에 따로 남는다고 알린다.
4. `error`가 `not-latest`면 `latest`가 최신 백업이다. 그것부터 되돌리라고 알린다.
5. 되돌린 파일(`restored`)과 지운 파일(`removed`)을 알리고, `changelog.md`에 한 줄을 남긴다.

옮길 때 문서를 git에 계속 올리기로 했다면(`git mv`로 옮긴 경우) 되돌린 뒤 `git status`에 옮김이 남아 있을 수 있다. 그때는 `git restore --staged`로 정리할 수 있다고 알린다.
