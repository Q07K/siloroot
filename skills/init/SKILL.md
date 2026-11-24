---
name: init
description: 지금 프로젝트 폴더를 SiloRoot 작업 공간으로 초기화한다. 폴더 뼈대(01-log, 02-study, 03-ideas, 04-feedback), 지시사항 문서, 문서 속성 가이드, 뷰어 설정을 프로젝트의 .siloroot/ 폴더 안에 만들고 뷰어를 연다. 사용자가 "SiloRoot로 초기화", "SiloRoot 시작", "/siloroot:init"이라고 할 때 쓴다. Claude 기본 /init(CLAUDE.md만 만드는 명령)과 다르다.
---

# SiloRoot 초기화

지금 프로젝트 폴더(작업 디렉터리)를 SiloRoot 작업 공간으로 만든다. 파일을 직접 쓰지 말고 아래 스크립트를 실행한다. 스크립트는 없는 파일만 만들고 이미 있는 파일은 건드리지 않는다.

## 무엇이 어디에 생기나

새 폴더는 SiloRoot 문서를 모두 `.siloroot/` 안에 감싼다. 코드 옆에 섞이지 않고, 팀 저장소에도 올라가지 않는다.

| 자리 | 하는 일 |
| --- | --- |
| `.siloroot/` | 문서 전부(`CLAUDE.md`, `metadata-guide.md`, `01-log/` ~ `05-profile/`), 설정(`config.json`), 뷰어 생성물(`state/`) |
| `CLAUDE.local.md` | `@.siloroot/CLAUDE.md` 한 줄로 SiloRoot 규칙을 불러온다. 이미 있으면 표시 블록만 끝에 붙인다 |
| `.ignore` | git은 `.siloroot/`를 무시해도 Claude의 검색은 찾게 한다. 이미 있으면 빠진 줄만 더한다 |
| git 제외 목록(`.git/info/exclude`) | `.siloroot/`, `.ignore`, `CLAUDE.local.md`를 이 PC의 이 저장소에서만 커밋 대상에서 뺀다. git 저장소일 때만 쓴다 |

팀이 같이 쓰는 `.gitignore`와 `CLAUDE.md`는 고치지 않는다.

이미 예전 방식(문서를 프로젝트 맨 위에 바로 두는 방식)으로 초기화된 폴더는 그 방식을 그대로 따른다. 옮기는 것은 `/siloroot:update`가 한다. init은 옮기지 않는다. 출력의 `warnings`에 업데이트 안내가 있으면 `/siloroot:update`를 권한다.

## 순서

0. 처음 초기화하는 폴더면(`.siloroot/config.json`이 없으면) 실행하기 전에 위 표를 짧게 보여 주고 진행할지 묻는다. 다시 실행하는 것이면 묻지 않는다.

1. 초기화 스크립트를 실행한다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" "<프로젝트 폴더 절대 경로>"
   ```

   출력은 JSON이다: `layout`(`wrapped` 또는 예전 방식 `flat`), `created`(새로 만든 파일), `updated`(줄이나 블록을 더한 파일), `skipped`(이미 있어 그대로 둔 파일), `warnings`(사용자가 직접 정리해야 할 것), `notes`(참고), `port`, `url`. 경로는 프로젝트 맨 위 기준이다. `warnings`가 있으면 3단계에서 그대로 전한다.

   이미 있던 `metadata-guide.md`나 `04-feedback/README.md`가 예전 버전이라 새 템플릿의 표 항목(예: `trait` type)이 빠졌으면 `warnings`에 나온다. 파일을 덮어쓰지 말고, `${CLAUDE_PLUGIN_ROOT}/templates/`의 같은 파일과 비교해 빠진 줄만 더할지 사용자에게 묻는다. 사용자가 일부러 지운 줄일 수 있다.

2. 뷰어 서버를 켜고 브라우저로 연다. 프로젝트 폴더에서 실행한다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/viewer/autostart.mjs"
   ```

   다른 폴더가 같은 포트를 쓴다는 알림이 나오면 그대로 사용자에게 전하고, `.siloroot/config.json`의 `port`를 다른 값으로 바꿀지 묻는다.

3. 사용자에게 짧게 알린다.
   - 새로 만든 파일, 줄을 더한 파일, 이미 있어서 그대로 둔 파일
   - 뷰어 주소 (`url`)
   - 감싼 배치(`wrapped`)면: SiloRoot 규칙은 `CLAUDE.local.md`가 불러오므로 다음 세션부터 적용된다
   - 다음에 할 수 있는 것: 기술 질문을 하면 공부 노트가 생긴다(`/siloroot:note`), "검증해 줘"라고 하면 Claude가 질문한다(`/siloroot:verify`)
   - 다음 세션부터는 세션을 열 때 뷰어가 자동으로 켜진다

이미 초기화된 폴더에서 다시 실행해도 된다. 그때는 `created`와 `updated`가 비어 있다.
