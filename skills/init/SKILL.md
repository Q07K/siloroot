---
name: init
description: 지금 프로젝트 폴더를 SiloRoot 작업 공간으로 초기화한다. 프로젝트의 .siloroot/ 안에 공유 영역(shared/)과 개인 영역(private/), 규칙 문서, 문서 속성 가이드, 뷰어 설정을 만들고, 홈(사람마다 하나인 공부 노트와 사용자 정보 폴더)이 없으면 홈도 만든 뒤 뷰어를 연다. 사용자가 "SiloRoot로 초기화", "SiloRoot 시작", "/siloroot:init"이라고 할 때 쓴다. 홈만 만들 때도 쓴다. Claude 기본 /init(CLAUDE.md만 만드는 명령)과 다르다.
---

# SiloRoot 초기화

지금 프로젝트 폴더(작업 디렉터리)를 SiloRoot 작업 공간으로 만든다. 파일을 직접 쓰지 말고 아래 스크립트를 실행한다. 스크립트는 없는 파일만 만들고 이미 있는 파일은 건드리지 않는다.

## 작업 공간 두 가지

| 종류 | 자리 | 무엇이 있나 |
| --- | --- | --- |
| 프로젝트 | 프로젝트 폴더의 `.siloroot/` | 공유 영역 `shared/`(이슈, 제품 아이디어, 결정, 설계, 로드맵, 컨벤션)와 개인 영역 `private/`(작업 기록, 원자료, 메모, 논의, 뷰어 댓글) |
| 홈 | 사람마다 하나. 기본 `<사용자 폴더>/siloroot-home` | 공부 노트, 개인 아이디어, 사용자 정보, 글쓰기 규칙, 후보 |

홈 위치와 등록한 프로젝트 목록은 `~/.siloroot/user.json`에 적힌다. 홈 없는 프로젝트는 없다. 처음 init하는 프로젝트는 홈도 함께 만든다.

## 프로젝트에 생기는 것

| 자리 | 하는 일 |
| --- | --- |
| `.siloroot/` | 규칙(`CLAUDE.md`), 속성 약속(`metadata-guide.md`), `shared/`, `private/`, 설정(`config.json`), 뷰어 생성물(`state/`) |
| `CLAUDE.local.md` | `@.siloroot/CLAUDE.md` 한 줄로 SiloRoot 규칙을 불러온다. 이미 있으면 표시 블록만 끝에 붙인다 |
| `.ignore` | git은 `.siloroot/`를 무시해도 Claude의 검색은 찾게 한다. 이미 있으면 빠진 줄만 더한다 |
| git 제외 목록(`.git/info/exclude`) | `.siloroot/` 가운데 `shared/`만 남기고, `.ignore`, `CLAUDE.local.md`와 함께 이 PC의 이 저장소에서만 커밋 대상에서 뺀다. git 저장소일 때만 쓴다 |

`shared/`는 `git status`에 보인다. 올릴지는 사용자가 커밋할 때 고른다. 팀이 같이 쓰는 `.gitignore`와 `CLAUDE.md`는 고치지 않는다. 팀원이 받은 저장소에 `shared/`가 이미 있으면 그대로 쓰고 나머지만 만든다.

이미 초기화된 폴더는 그 모양을 그대로 따르고 맞추기만 한다. 예전 모양을 옮기는 것은 `/siloroot:update`가 한다. init은 옮기지 않는다. 출력의 `warnings`에 업데이트 안내가 있으면 `/siloroot:update`를 권한다.

## 순서

0. 처음 초기화하는 폴더면(`.siloroot/config.json`이 없으면) 실행하기 전에 위 표를 짧게 보여 주고 진행할지 묻는다. 다시 실행하는 것이면 묻지 않는다.

1. 초기화 스크립트를 실행한다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" "<프로젝트 폴더 절대 경로>"
   ```

   - 종료 코드 2와 `"error": "need-home"`이 나오면 홈이 아직 없다. 아무것도 만들지 않았다. 두 가지를 한 번에 묻는다.
     - 홈 위치. 기본값은 출력의 `defaultHome`.
     - 홈 쓰기 허락. 기본값은 "더함". 물을 때 이유를 한 문장으로 말한다: 홈은 프로젝트 밖이라 공부 노트나 후보를 홈에 쓸 때마다 Claude Code가 허락을 물을 수 있어서, 이 프로젝트의 개인 설정(`.claude/settings.local.json`)에 홈 폴더를 더해 둔다.
     - 답을 받으면 다시 실행한다: `node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" "<프로젝트>" --home "<홈>" --home-access add` (더하지 않기로 했으면 `skip`).
   - `"error": "user-json-invalid"`면 `~/.siloroot/user.json`이 깨진 것이다. 아무것도 만들지 않았다. 파일 경로를 알리고 고치거나 지울지 사용자에게 묻는다.
   - `"error": "not-home"`이면 고른 홈 자리에 프로젝트 작업 공간이 있다. 다른 위치를 묻는다.
   - `"error": "home-in-project"`면 고른 홈이 이 프로젝트(또는 등록된 프로젝트, 출력의 `project`)와 같거나 그 안이나 바깥이다. 그대로 두면 개인 문서가 팀 저장소에 들어간다. 프로젝트 밖의 다른 위치를 묻는다.
   - `"error": "home-path-space"`면 홈 경로(사용자 폴더 아래면 그 뒤)에 공백이 있다. 규칙 블록의 `@` 불러오기가 공백에서 끊기므로 공백 없는 위치를 묻는다.
   - 이미 초기화된 프로젝트에서 `warnings`에 "홈을 찾지 못해"가 나오면 `~/.siloroot/user.json`을 잃은 것이다. 규칙 블록은 그대로 두었다. 홈 위치를 묻고 `--home "<홈>"`을 붙여 다시 실행하면 홈을 다시 잇고 이 프로젝트를 다시 등록한다. "user.json이 깨져서"가 나오면 그 파일을 고치거나 지울지 묻는다.

   성공하면 출력은 JSON이다: `mode`, `layout`, `name`(이 프로젝트를 다른 문서에서 `<이름>:경로`로 가리킬 때 쓰는 이름), `home`, `homeCreated`, `homeAccess`(`added`, `present`, `invalid`, `skipped`, `not-asked`), `created`, `updated`, `skipped`, `warnings`, `notes`, `port`, `url`. 경로는 프로젝트 맨 위 기준이고, 빈 폴더는 끝에 `/`가 붙는다. `warnings`가 있으면 3단계에서 그대로 전한다. `homeAccess`가 `invalid`면 `.claude/settings.local.json`이 JSON이 아니라 건드리지 않았다고 알린다.

   이미 있던 `metadata-guide.md`나 후보 자리의 `README.md`가 예전 버전이라 새 템플릿의 표 항목이 빠졌으면 `warnings`에 나온다. 파일을 덮어쓰지 말고, `${CLAUDE_PLUGIN_ROOT}/templates/`의 같은 파일과 비교해 빠진 줄만 더할지 사용자에게 묻는다. 사용자가 일부러 지운 줄일 수 있다.

2. 뷰어 서버를 켜고 브라우저로 연다. 프로젝트 폴더에서 실행한다. 홈 뷰어도 함께 켜진다(브라우저는 프로젝트 뷰어만 연다).

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/viewer/autostart.mjs"
   ```

   다른 폴더가 같은 포트를 쓴다는 알림이 나오면 그대로 사용자에게 전하고, 그 작업 공간의 `.siloroot/config.json`의 `port`를 다른 값으로 바꿀지 묻는다.

3. 사용자에게 짧게 알린다.
   - 새로 만든 파일, 줄을 더한 파일, 이미 있어서 그대로 둔 파일. 홈을 새로 만들었으면 홈 위치도
   - 뷰어 주소 (`url`). 사용자 정보와 "나" 화면은 홈 뷰어에 있다
   - SiloRoot 규칙은 `CLAUDE.local.md`가 불러오므로 다음 세션부터 적용된다
   - 다음에 할 수 있는 것: 기술 질문을 하면 홈에 공부 노트가 생긴다(`/siloroot:note`), "검증해 줘"라고 하면 Claude가 질문한다(`/siloroot:verify`)
   - 다음 세션부터는 세션을 열 때 뷰어가 자동으로 켜진다

이미 초기화된 폴더에서 다시 실행해도 된다. 그때는 `created`와 `updated`가 비어 있다. 다시 실행할 때 홈 쓰기 허락을 더하려면 `--home-access add`를 붙인다.

## 홈만 만들기

사용자가 홈만 만들거나 맞추고 싶어 하면 홈 폴더를 인자로 준다. 이미 있으면 맞추기만 한다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" "<홈 폴더 절대 경로>" --mode home
```
