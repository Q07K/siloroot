---
name: update
description: SiloRoot 플러그인을 새 버전으로 올리고, 작업 공간과 홈의 관리 블록을 맞추고, 뷰어 서버를 새 버전으로 바꾸고, 이번 버전에 무엇이 바뀌었는지 보인다. 사용자가 "SiloRoot 업데이트", "/siloroot:update", "새 버전 받아 줘"라고 할 때, 세션 시작 훅이 "(/siloroot:update)"가 붙은 업데이트 줄을 알린 뒤 사용자가 맞추자고 할 때 쓴다. 작업 공간 모양을 옮기는 일(마이그레이션)과 되돌리기는 /siloroot:migrate가 한다.
---

# SiloRoot 업데이트

버전이 오를 때마다 하는 가벼운 일이다. 마이그레이션은 하지 않는다. 옮길 모양이 있으면 끝에 `/siloroot:migrate`를 알린다.

- 스크립트: `node "<S>/scripts/update.mjs" "<폴더 절대 경로>" <명령>`. 출력은 모두 JSON이다. `<S>`는 처음에는 `${CLAUDE_PLUGIN_ROOT}`이고, 플러그인을 올렸으면 새 버전의 설치 폴더다.
- `claude` 명령은 Bash로 프로젝트 폴더에서 돌린다. 스크립트는 그 결과 파일을 읽기만 한다.
- 사용자의 승인 없이 플러그인을 올리지 않는다. 마켓플레이스가 선언한 명령을 확인하라는 응답이 오면 사용자에게 보이고 사용자가 정한다. `-y`를 붙이지 않는다.

## 새 버전 보기와 올리기

1. 설치 목록을 저장하고 이 프로젝트의 설치를 본다.

   ```bash
   claude plugin list --json > "<프로젝트 폴더>/.siloroot/state/plugin-list.json"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --versions
   ```

   - `dev`면 저장소에서 불러온 개발 플러그인이다. 올리기를 건너뛰고 "맞추기"로 간다(`<S>`는 `${CLAUDE_PLUGIN_ROOT}`).
   - `error`가 `not-installed`면 이 프로젝트에 설치된 siloroot를 찾지 못했다. 올리기를 건너뛰고 "맞추기"로 간다.
   - 출력의 `market`(마켓플레이스 이름)과 `installed`(설치 버전)를 기억한다.

2. 마켓플레이스 목록을 새로 받고 최신 버전을 본다.

   ```bash
   claude plugin marketplace update <market>
   claude plugin marketplace list --json > "<프로젝트 폴더>/.siloroot/state/plugin-markets.json"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs" "<프로젝트 폴더>" --versions
   ```

   `newer`가 false면 "플러그인은 최신(`installed`)입니다"를 알리고 "맞추기"로 간다. `latest`가 null이면 최신 버전을 알 수 없다고 알리고, 올려 볼지 묻는다.

3. `newer`면 "`installed` → `latest`로 올릴까요?"를 묻는다. 승인하면 올린다.

   ```bash
   claude plugin update <id> --scope <scope> --json
   ```

   `<id>`와 `<scope>`는 `--versions` 출력의 값이다. 끝나면 1단계의 두 줄을 다시 돌려 새 `installPath`와 `installed`를 얻는다. 올리기 전 버전을 "옛 버전"으로 기억한다.

4. 올렸으면 새 버전의 스킬 글을 읽고 그 글의 "맞추기"부터 이어 간다. 이 세션에 실린 스킬 글과 스크립트는 옛 버전이라서다.

   ```
   <새 installPath>/skills/update/SKILL.md
   ```

   그 뒤로 `<S>`는 새 `installPath`다.

## 맞추기

5. 맞출 것을 미리 본다.

   ```bash
   node "<S>/scripts/update.mjs" "<프로젝트 폴더>" --refresh-plan
   ```

   - `skipped`가 `newer`면 이 폴더는 더 새 플러그인으로 맞춰져 있다. 건드리지 않는다.
   - 올리지 않았으면 `pluginFrom`을 "옛 버전"으로 기억한다.
   - `upToDate`가 아니면 맞출 관리 블록(`refresh.blocks`에서 `skipped`가 아닌 것), 새로 만들 파일과 줄을 짧게 보여 준다.
   - `refresh.guideGaps`가 있으면 파일마다 빠진 표 항목(`items`)을 보이고 줄마다 더할지 묻는다. `<S>/templates/<tpl>`에서 그 항목이 든 줄을 찾아 보여 준다. 사용자가 일부러 지운 줄일 수 있다. 더하지 않기로 한 줄은 답의 `declined`에 넣는다.

6. 맞춘다. 맞출 것이 있으면 바꾸기 전에 스크립트가 백업한다.

   ```bash
   node "<S>/scripts/update.mjs" "<프로젝트 폴더>" --refresh --answers "<프로젝트 폴더>/.siloroot/state/update-answers.json"
   ```

   답 파일: `{ "declined": { "<파일>": ["<표 항목>"] } }`. 묻지 않았으면 `{}`. 더하기로 한 표 항목은 적용 뒤 그 파일의 같은 표에 Claude가 직접 더한다.

7. 홈도 맞춘다. 모양 3 이상 프로젝트면 홈 위치는 `~/.siloroot/user.json`의 `home`이다. 5~6단계를 `<홈 폴더>`로 한다.

## 뷰어 서버와 바뀐 것

8. 뷰어 서버를 새 버전으로 바꾼다. 옛 버전 서버만 끄고 다시 켜며, 브라우저는 열지 않는다. 열려 있는 뷰어 화면은 스스로 새로 읽는다.

   ```bash
   node "<S>/scripts/update.mjs" "<프로젝트 폴더>" --servers
   ```

   다음 호출에서 한 번 더 돌려 프로젝트와 홈 서버가 모두 `state: mine`이고 `version`이 새 버전인지 확인한다. `stopFailed`면 그 포트의 서버를 끄고 다시 돌리라고 알린다. `homeSkipped`가 `dev`면 개발 플러그인이라 다른 프로젝트도 쓰는 홈 서버는 그대로 두었다.

9. 이번에 바뀐 것을 보인다.

   ```bash
   node "<S>/scripts/update.mjs" "<프로젝트 폴더>" --changes <옛 버전>
   ```

   옛 버전은 3단계에서 올리기 전 버전, 올리지 않았으면 5단계의 `pluginFrom`이다. 둘 다 지금 버전과 같으면 옛 버전 없이 `--changes`만 돌린다. 플러그인을 이 스킬 밖에서 올렸을 때 세션 시작 훅이 남긴 옛 번호를 쓴다. `changes`의 버전마다 내용을 짧게 알린다. 비었으면 넘어간다.

## 마치기

10. 결과를 알린다: 플러그인 버전(올렸으면 전 → 후), 맞춘 것과 백업 이름(없으면 파일을 바꾸지 않은 것), 서버, 바뀐 것, 점검 결과(`check.warnings` 속성 경고 수, `check.broken` 끊어진 `related`).
    - 맞추기 출력의 `migration`이 있고 `held`가 아니면 "작업 공간 모양 `from` → `to`로 옮길 것이 있습니다. `/siloroot:migrate`로 미리 보고 옮길 수 있습니다"를 알린다. `held`면 "모양 `from`에 머물고 있습니다"만 알린다.
    - 플러그인을 올렸으면 "새 스킬과 훅은 새 세션부터 적용됩니다"를 알린다.
    - 맞춘 것을 되돌리려면 `/siloroot:migrate`의 되돌리기를 쓴다고 알린다.

11. 작업 기록에 한 줄을 남긴다. 예: `SiloRoot 업데이트: 플러그인 0.8.1 → 0.8.2, 관리 블록 1개 (백업 <이름>)`. 모양 4는 그날 작업 일지(`private/worklog/YYYY-MM-DD.md`, 홈은 `worklog/`), 모양 3은 `private/log/changelog.md`.
