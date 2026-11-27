---
type: design
status: 확정
created: 2026-11-24
related: [shared/plans/project-folder-layout-decision-plan.md, shared/ideas/project-folder-layout.md, shared/ideas/update-migration.md, shared/design/update-migration-decision-design.md, shared/ideas/home-workspace.md, shared/ideas/workspace-modes.md, shared/ideas/shared-private-areas.md, shared/ideas/project-unit.md, shared/ideas/edge-meaning.md]
---

# 구조 2판과 마이그레이션 002 설계

private/discussions/2026-11-24-structure-migration.md에서 정한 것을 만들 수 있게 쓴 설계다. 확정한 폴더 그림은 `shared/ideas/project-folder-layout.md`에 있다. 이 문서만 읽고 계획을 세울 수 있게 쓴다. "AI가 정함"은 사용자가 따로 정하지 않아 AI가 고른 것이다.

## 1. 왜

- 2판 구조(`shared/`, private/, 홈)는 문서로만 확정했다. 0.4.0을 새로 깔아도 init은 `01-log/`~`05-profile/`을 만든다.
- 업데이트 장치(0.4.0)를 먼저 만든 까닭은, 구조 분리를 마이그레이션 하나로 올려서 이 작업 공간과 다른 사용자가 같은 길로 새 구조에 오게 하려는 것이다(`shared/ideas/update-migration.md`).

## 2. 목표, 하지 않을 것, 실패로 볼 것

**목표**

1. 새로 까는 사람은 처음부터 2판 구조를 받는다. 프로젝트에서 init하면 `.siloroot/shared/`, `.siloroot/private/`가 생기고, 홈이 없으면 홈도 만든다.
2. 홈: 사람마다 하나, 프로젝트 밖의 폴더. 공부 노트(개념), 개인 아이디어, 사용자 정보, 글쓰기 규칙이 여기 있다. 모든 프로젝트의 AI가 사용자 정보와 글쓰기 규칙을 홈에서 불러온다.
3. 마이그레이션 `002`: 옛 작업 공간(모양 2)을 새 구조(모양 3)로 옮긴다. 홈에 갈 것은 홈으로, 개인 것은 private/로, 팀에 갈 것은 `shared/`로 간다(사용자). 홈이 없으면 만든다(사용자).
4. 문서마다 갈 곳은 목록 한 번으로 승인한다(방법 A, 사용자).
5. 문서 안의 경로(`related`, 백틱 경로, 마크다운 링크)는 옮긴 뒤에도 이어진다. 홈과 프로젝트 사이도 이어진다.

**하지 않을 것** (다른 덩어리)

- 선 종류 키(`basis`, `from`, `met_in` 등): `shared/ideas/edge-meaning.md`. 이번에는 `related`만 쓴다.
- 버전 파일(`<문서>.versions/`): `shared/ideas/doc-versioning.md`.
- 공개본 만들기와 `shared/publish/`: `shared/ideas/publish-copy.md`. 폴더도 이번에 만들지 않는다.
- 작업 공간이 위아래로 겹칠 때 보기: `shared/ideas/project-unit.md`.
- 홈 그래프에서 여러 프로젝트를 묶어 보이는 시안 고르기: `shared/ideas/home-workspace.md`. 이번에는 바깥 점 하나로만 보인다(4.6).
- 구현 점검: `shared/ideas/implementation-check.md`.
- 커밋. 업데이트와 init은 `shared/`를 git에 올리지 않는다. 무엇을 커밋할지는 사용자가 정한다.

**실패로 볼 것**

- 개인 문서가 한순간이라도 `shared/`에 놓이는 것. 애매하면 private/가 기본값이다.
- 옮긴 뒤 이어져 있던 연결이 끊기는 것.
- 홈에 이미 있던 사용자 정보, 글쓰기 규칙, 공부 노트를 덮어쓰는 것.
- 되돌리기가 홈에 쓴 것을 남기는 것.
- 사용자가 고를 것을 몰래 고르는 것.

## 3. 지금 코드에서 닿는 곳

코드를 조사한 결과다(2026-11-24).

| 곳 | 지금 | 바뀌어야 할 것 |
| --- | --- | --- |
| `lib/config.mjs` | 문서 뿌리 하나(`docsRoot`). `DEFAULT_DIRS`가 역할마다 경로 하나(`log`, `study`, `ideas`, `feedback`, `profile`) | 역할이 홈과 프로젝트 둘에 걸친다. 모양별 자리표가 필요하다 |
| `viewer/build.mjs` | 문서 뿌리 아래만 읽는다. 밖을 가리키는 `related`는 "찾지 못함" 경고, 본문 경로는 조용히 버린다. 폴더별 type 규칙이 코드에 박혀 있다. "나" 화면은 `profile.md`, `writing-guide.md`, `trait` 후보를 같은 뿌리에서 읽는다 | 다른 작업 공간 경로를 바깥 점으로. 폴더 규칙을 표 하나로. "나" 화면은 홈에서 |
| `viewer/serve.mjs`, `notify.mjs` | 댓글을 `dirs.feedback`에 쓴다. 할 일 알림은 그 폴더 하나만 본다 | 프로젝트 댓글은 private/feedback/, 규칙과 사용자 정보 후보는 홈 |
| `lib/workspace-sync.mjs` | `FILES`가 옛 폴더 경로를 그대로 적는다. git 제외는 `.siloroot/` 통째 | 모양별 파일 목록. `shared/`만 git에 남기는 제외 줄 |
| `templates/` | 01~05 폴더, 관리 블록의 폴더 표와 `@05-profile/profile.md` | 프로젝트용과 홈용 템플릿 두 벌. 홈 사용자 정보는 절대 경로로 불러온다 |
| 스킬 `note`, `verify`, `feedback`, `init` | 옛 폴더 경로를 글로 적는다 | 자리 이름으로 적고, 실제 경로는 관리 블록의 표를 본다(4.9) |
| 사용자 단위 설정 | 없다. 홈 폴더를 읽는 코드가 없다 | 홈 위치와 프로젝트 목록을 적을 곳(4.4) |
| `lib/backup.mjs` | 프로젝트 밖 경로를 `files-external/`에 담을 수 있다 | 그대로 쓴다. 홈에 쓴 것도 백업과 되돌리기에 들어간다 |
| 테스트 | 옛 폴더 이름을 박은 곳이 135곳쯤 | 모양 3 기준으로 고치고, 모양 2 픽스처는 마이그레이션과 머물기 시험에 남긴다 |

## 4. 설계

### 4.1 작업 공간 두 가지와 모양 3

| 종류 | `config.json`의 `mode` | 자리 | 개수 |
| --- | --- | --- | --- |
| 프로젝트 | `project` | 프로젝트 폴더의 `.siloroot/` (감싼 배치) | 프로젝트마다 하나 |
| 홈 | `home` | 사용자가 고른 폴더 자체가 문서 뿌리 (flat 배치, 설정은 `<홈>/.siloroot/config.json`) | 사람마다 하나 |

- 플러그인 `SCHEMA`는 3, `SUPPORTED_SCHEMAS`는 [1, 2, 3]. 홈은 처음부터 모양 3이다.
- `mode`가 없는 작업 공간은 `project`로 읽는다. 옛 작업 공간은 모두 프로젝트로 본다(사용자: "이거 프로젝트잖아").
- 홈이 flat 배치를 쓰는 것은 AI가 정함. 홈은 사용자의 노트 폴더라 `.siloroot/`로 한 번 더 감쌀 까닭이 없고, flat을 읽는 코드가 이미 있다.

### 4.2 프로젝트 작업 공간 (모양 3)

```
<프로젝트>/.siloroot/
  CLAUDE.md               규칙 (관리 블록)
  metadata-guide.md       속성 약속 (프로젝트용)
  shared/                 git에 올릴 수 있음
    README.md             공유 폴더 안내 (index)
    issues/  ideas/  decisions/  conventions/  design/  roadmap/
  private/                git에서 빠짐
    README.md             개인 폴더 안내 (index)
    log/                  changelog.md, open-questions.md
    feedback/             이 프로젝트 문서에 단 뷰어 댓글
    notes/  discussions/  sources/
  config.json
  state/
```

- `private/log/`는 2판 그림에 없던 자리다. 작업 기록과 열린 질문을 둔다(AI 제안, 사용자가 반대하지 않음).
- 안내는 영역마다 `README.md` 하나에 모은다. 폴더마다 두지 않는다. AI가 정함. 빈 폴더는 git에 남지 않으므로, init은 폴더를 만들되 README는 두 개만 둔다.
- `shared/publish/`는 이번에 만들지 않는다(2절).

### 4.3 홈 (모양 3)

```
<홈>/                     기본값: <사용자 폴더>/siloroot-home
  CLAUDE.md               규칙 (관리 블록, 홈용)
  metadata-guide.md       속성 약속 (홈용)
  profile.md              승인된 사용자 정보 (ledger)
  ai-comment.md           "나" 화면의 AI 의견 (note)
  writing-guide.md        글쓰기 규칙 (guide)
  study/                  공부 노트(개념). README.md에 주제 목록
  ideas/                  개인 아이디어와 그 옆의 결정, 설계, 계획
  feedback/               글쓰기 규칙 후보(rule), 사용자 정보 후보(trait), 홈 문서에 단 댓글
  log/                    changelog.md, open-questions.md
  .siloroot/              config.json, state/
```

- 규칙 후보와 사용자 정보 후보는 어느 프로젝트에서 생겨도 홈 `feedback/`에 만든다. 사람에 대한 것이라 `profile.md`, `writing-guide.md`와 같은 곳에 둔다. 그러면 "나" 화면이 홈 하나만 읽는다. AI가 정함.
- 홈은 git과 상관없다. 사용자가 원하면 홈을 따로 저장소로 만들 수 있다.

### 4.4 사용자 단위 설정

`<사용자 폴더>/.siloroot/user.json` 하나. 정함(사용자, 6절 4번).

```json
{ "version": 1, "home": "C:/Users/<나>/siloroot-home", "projects": [ { "name": "siloroot", "path": "C:/Users/<나>/github/q07k/siloroot" } ] }
```

- `home`: 홈 위치. 홈 init(또는 홈이 없을 때의 프로젝트 init, `002`)이 적는다.
- `projects`: 프로젝트 init과 `002`가 등록한다. `name`은 기본으로 프로젝트 폴더 이름이고, 겹치면 `-2`를 붙인다. 이 이름이 4.5의 접두사다.
- 사용자 폴더가 바로 프로젝트 폴더인 드문 경우에 `.siloroot/`가 겹치지 않게, 파일 이름을 `user.json`으로 따로 둔다.

### 4.5 작업 공간 사이 경로

| 가리키는 곳 | 적는 법 | 예 |
| --- | --- | --- |
| 같은 작업 공간 | 지금처럼 문서 뿌리 기준 | `shared/ideas/viewer.md`, `study/rust.md` |
| 홈 | `home:` + 홈 기준 경로 | home:study/claude-code-hooks.md |
| 다른 프로젝트 | `<이름>:` + 그 프로젝트 문서 뿌리 기준 경로 | `siloroot:shared/issues/port-in-use.md` |

- `related` 값에도, 백틱 경로에도 같은 꼴을 쓴다. 쌍점 뒤에 공백이 없으므로 지금 속성 규칙(값 안에 `: `가 있으면 따옴표)에 걸리지 않는다.
- 이름은 `user.json`에서 찾는다. 찾지 못하면 `related`는 지금처럼 속성 점검 경고, 본문 경로는 그냥 글자로 둔다.
- 방향 원칙(확정): 공유 문서는 팀원이 볼 수 없는 문서를 가리키지 않는다. `shared/` 문서가 private/나 `home:`을 가리키면 속성 점검이 경고한다. 막지는 않는다. AI가 정함.

### 4.6 뷰어

- 프로젝트 뷰어는 지금처럼 `.siloroot/` 하나를 읽는다. `shared/`와 private/가 그 아래에 있으므로 문서 찾기는 그대로다. 그래프의 폴더 묶음은 앞 두 마디(`shared/ideas`, `private/log`)로 나눈다.
- 다른 작업 공간을 가리키는 연결은 "바깥 점" 하나로 그린다: 흐린 점, 작업 공간 이름표, 누르면 그 작업 공간의 뷰어 주소(그 설정의 `port`)를 새 탭으로 연다. 그 작업 공간 문서는 읽지 않는다. 묶음과 거르기는 하지 않는다(시안을 고른 뒤 다른 덩어리에서).
- "나" 화면은 홈 뷰어에만 있다. 프로젝트 뷰어의 "나" 자리에는 홈 뷰어로 가는 링크를 둔다. AI가 정함. 프로젝트 뷰어가 홈 파일을 읽고 고치게 하면 서버의 안전 경로 검사(`safePath`)를 홈까지 넓혀야 해서다.
- 폴더별 type 규칙은 코드 여러 곳에 박지 않고 표 하나(4.8)에서 읽는다.
- 홈 뷰어 켜기: 사람들은 대개 프로젝트에서 Claude를 연다. 그래서 프로젝트 세션이 시작될 때 훅이 `user.json`으로 홈을 찾아 홈 뷰어도 켠다(이미 켜져 있으면 그대로). 홈의 포트는 홈 `config.json`에 따로 있다(기본 4181). 홈 뷰어가 꺼져 있으면 "나" 링크와 바깥 점은 "홈 뷰어가 꺼져 있습니다"를 보인다. AI가 정함(점검 3번).
- 홈 맞추기와 업데이트: 프로젝트에서 `/siloroot:update`를 돌리면 스킬이 그 프로젝트 다음에 홈도 같은 스크립트로 미리 보고 맞춘다(`update.mjs <홈>`). 홈의 백업은 홈의 `.siloroot/state/backups/`에 따로 쌓인다. 세션 시작 알림도 홈이 뒤처졌는지 함께 본다. AI가 정함(점검 3번).
- 모양이 바뀌면 경로가 다 바뀌므로, `002`는 뷰어의 "바뀐 것" 비교 기준(스냅숏)을 새로 잡는다. 안 그러면 모든 문서가 지워지고 새로 생긴 것으로 보인다.

### 4.7 git과 검색

| 파일 | 프로젝트 모양 3에서 넣을 줄 |
| --- | --- |
| `.git/info/exclude` | `.siloroot/*`, `!.siloroot/shared/`, `.ignore`, `CLAUDE.local.md` |
| `.ignore` | 지금과 같다(`!.siloroot/`, 생성물 제외) |
| `.siloroot/.gitignore` | 만들지 않는다. 제외는 `.git/info/exclude` 한 곳에서 한다 |

- 그래서 `shared/` 아래만 `git status`에 나타난다. 올릴지는 사용자가 정한다.
- 팀원이 저장소를 받으면 `shared/`만 있다. 그 사람이 init하면 있는 `shared/`를 그대로 쓰고 나머지를 만든다. 팀 문서를 고치지 않는다.
- `config.json`의 `tracked`(001에서 "계속 git에 올림"을 고른 작업 공간)는 모양 3에서 쓰지 않는다. `002`가 그런 작업 공간을 만나면 4.10의 git 항목대로 묻는다.

### 4.8 자리표와 속성

플러그인에 모양별 "자리표"를 하나 둔다(예: `lib/layout.mjs`). 뷰어, init, 맞추기, 마이그레이션, 스킬 안내가 모두 이 표를 본다.

| 자리 | 모양 2 | 모양 3 | 들어가는 type |
| --- | --- | --- | --- |
| 작업 기록 | `01-log/` | 프로젝트 `private/log/`, 홈 `log/` | `log`, `ledger` |
| 공부 노트 | `02-study/` | 홈 `study/` | `study` (`README.md`는 `index`) |
| 이슈 | (없음) | `shared/issues/` | `issue` |
| 제품 아이디어 | `03-ideas/` | `shared/ideas/` | `idea` |
| 개인 아이디어 | `03-ideas/` | 홈 `ideas/` | `idea` |
| 결정 | `03-ideas/`의 `-decision-` | `shared/decisions/` | `decision` |
| 설계 | `03-ideas/`의 `-decision-design` | `shared/design/` | `design` |
| 로드맵, 계획 | `03-ideas/`의 `-decision-plan` | `shared/roadmap/` | `roadmap` |
| 컨벤션, 정책 | (없음) | `shared/conventions/` | `convention` |
| 원자료 | (없음) | private/sources/ | `source` |
| 프로젝트 메모 | (없음) | private/notes/ | `note` |
| 논의 | (사용자가 더한 `06-discussions/`) | private/discussions/ | `note` |
| 뷰어 댓글 | `04-feedback/` | 그 작업 공간의 feedback 자리 | `feedback` |
| 규칙, 사용자 정보 후보 | `04-feedback/` | 홈 `feedback/` | `rule`, `trait` |
| 사용자 정보 | `05-profile/` | 홈 `profile.md`, `ai-comment.md` | `ledger`, `note` |
| 글쓰기 규칙 | 맨 위 `writing-guide.md` | 홈 `writing-guide.md` | `guide` |

새 type과 상태 값(정함, 사용자, 6절 3번):

| type | status |
| --- | --- |
| `issue` | 열림, 원인 찾음, 해결, 안 함 (확정한 이슈 상태) |
| `design` | 제안, 확정, 바뀜 (`decision`과 같다) |
| `roadmap` | 제안, 확정, 진행 중, 완료, 접음 |
| `convention` | 제안, 사용 중, 바뀜, 폐기 |
| `source` | 사용 중, 보관 |

- `design`과 `roadmap`의 상태 값은 지금 `decision` 값을 그대로 품게 골랐다. 그래서 `002`가 `type`만 바꾸고 `status`는 그대로 둘 수 있다. AI가 정함(만드는 사람 점검 1번).
- 홈 `ideas/`는 `idea`와 함께 그 옆의 `decision`, `design`, `roadmap`을 받는다. 개인 아이디어의 결정이 `shared/`로 가지 않게 하려는 것이다. AI가 정함(점검 2번).
- `metadata-guide.md`는 프로젝트용과 홈용 두 벌이다. 각자 자기 자리만 적는다.
- 모양 2 작업 공간이 머물면(hold), 플러그인은 모양 2의 자리표와 템플릿을 계속 쓴다.

### 4.9 규칙 블록과 스킬

- 프로젝트 `.siloroot/CLAUDE.md` 관리 블록:
  - 폴더 표는 자리표에서 만든다.
  - 사용자 정보는 홈 절대 경로로 불러온다(`@<홈>/profile.md`).
  - 글쓰기 규칙도 홈 절대 경로로 가리킨다.
  - 이 파일은 git에서 빠지므로 사람마다 경로가 달라도 된다.
  - 홈 위치가 바뀌면 맞추기가 블록을 다시 만든다.
- 홈 `CLAUDE.md` 관리 블록: 공부, 개인 아이디어, 사용자 정보, 글쓰기 규칙, 등록된 프로젝트를 가리키는 법(4.5).
- "흐름 나누기"는 자리표에 맞춰 고친다. 프로젝트에서 생긴 공부는 개념을 홈 `study/`에, 사건을 `shared/issues/`에 둔다(확정). 홈 노트에서 그 이슈로 `related: [<이름>:shared/issues/…]`를 적는다. 이슈 쪽은 홈을 가리키지 않는다.
- 스킬(`note`, `verify`, `feedback`, `init`, `update`)은 경로를 박지 않고 자리 이름(공부 노트 자리, 작업 기록 자리 등)으로 적는다. 실제 경로는 관리 블록의 폴더 표에서 찾는다. 그래야 모양 2에 머문 작업 공간에서도 같은 스킬이 돈다. AI가 정함.

### 4.10 init

- `/siloroot:init`에 모드를 둔다.
  - `project`(기본): 지금 프로젝트에 모양 3을 만든다. `user.json`에 홈이 없으면 홈 위치를 묻고(기본값 `<사용자 폴더>/siloroot-home`) 홈도 만든다. 프로젝트를 `user.json`에 등록한다.
  - `home`: 홈만 만든다. 이미 있으면 맞추기만 한다.
- 홈 없는 프로젝트는 없다. `project` 모드는 홈이 없으면 늘 만든다. 정함(사용자, 6절 1번).
- 홈 쓰기 허락: 홈은 프로젝트 밖이라, 프로젝트 세션이 홈에 공부 노트나 후보를 쓸 때마다 Claude Code가 허락을 물을 수 있다. 관리 블록의 `@<홈>/profile.md` 같은 바깥 불러오기도 처음에 승인을 묻는다. 그래서 init은 "프로젝트의 `.claude/settings.local.json`에 홈 폴더를 더할까요?"를 묻고, 승낙하면 `permissions.additionalDirectories`에 홈 경로를 더한다. 기본값은 더하기다. 이 파일은 Claude Code가 git에서 빼는 개인 설정이다. 이미 있는 다른 설정은 건드리지 않는다. 정함(사용자, 6절 5번).
- 기존 모양 2 작업 공간에서 init을 다시 돌리면 지금처럼 맞추기만 하고 `/siloroot:update`를 안내한다.

### 4.11 마이그레이션 `002` (모양 2 → 3)

`lib/migrations/002-project-areas.mjs`. 업데이트 장치의 `plan`/`apply`를 그대로 따른다.

**계획: 갈 곳 목록 (방법 A)**

- 문서 뿌리 아래 모든 파일(관리 대상 `CLAUDE.md`, `metadata-guide.md`, `config.json`, `state/`는 빼고)에 4.8 자리표로 기본 갈 곳을 정한다.
- 규칙으로 정할 수 없는 문서는 `review: true`로 표시한다.
  - 지금은 `idea` 문서 하나뿐이다. 제품 아이디어(`shared/ideas/`)인지 개인 아이디어(`home:ideas/`)인지 규칙으로 못 가른다.
  - 기본값은 `shared/ideas/`다. 옛 `03-ideas/`는 프로젝트 안에 있었으므로 그 프로젝트의 아이디어로 본다. AI가 정함.
  - 사용자가 이 기본값으로 정했다(6절 2번). 개인 아이디어는 목록에서 홈으로 바꾼다. `002`는 커밋하지 않으므로, `shared/`에 놓인 문서를 올릴지는 커밋할 때 사용자가 고른다. 스킬은 목록을 보일 때 이것을 한 줄로 알린다.
- 아이디어 옆의 문서(`<아이디어 이름>-decision-*.md`)는 그 아이디어를 따라간다. 아이디어가 `shared/ideas/`로 가면 자리표대로 `shared/decisions/`, `shared/design/`, `shared/roadmap/`으로 나뉜다. `home:ideas/`로 가면 함께 홈 `ideas/`로 간다. 목록에서 아이디어의 갈 곳을 바꾸면 옆 문서도 같이 바뀐다. AI가 정함(점검 2번).
- 마크다운이 아닌 파일(그림, 스크립트)은 그 파일을 가리키는 문서를 따라간다. 가리키는 문서가 없으면 같은 폴더의 기본값을 따른다.
- 사용자가 더한 폴더: 자리표에 같은 이름이 있으면 그리로 간다(`06-discussions/` → private/discussions/). 없으면 `private/<폴더 이름>/`이 기본값이다.
- 목록은 `plan.placements`로 낸다: 옛 경로, 갈 곳, 근거(어느 규칙인지), `review` 여부.
- 스킬은 `review` 문서만 AI가 읽고 갈 곳을 제안한다. 그다음 목록 전체를 한 번 보여 준다. 사용자는 "기본값으로" 또는 고칠 줄만 말한다.
- 답은 업데이트 답 파일에 `placements: { "<옛 경로>": "<갈 곳>" }`으로 고친 것만 적는다. 업데이트 장치의 답 모양에 이 칸을 더한다.

**계획: 묻는 것 (`decisions`)**

| id | 언제 | 고를 값 | 기본값 |
| --- | --- | --- | --- |
| `home-location` | `user.json`에 홈이 없을 때 | 경로 | `<사용자 폴더>/siloroot-home` |
| `home-collision:<경로>` | 홈에 같은 이름 파일이 이미 있을 때(공부 노트, 아이디어) | 이름 바꿔 둠(`<이름>-<프로젝트>.md`), 건너뜀 | 이름 바꿔 둠 |
| `git-private` | 개인 영역이나 홈으로 갈 파일 중 git이 추적하는 것이 있을 때 | 추적 끊기(`git rm --cached`, 파일은 남음), 그대로 | 추적 끊기 |
| `home-access` | 프로젝트의 `.claude/settings.local.json`에 홈이 아직 없을 때 | 더함, 안 더함 | 더함 (4.10) |

- 홈에 `profile.md`, `writing-guide.md`, `study/README.md`가 이미 있으면 덮어쓰지 않고 합친다. 표의 줄을 같은 절 끝에 더하고, 같은 줄은 건너뛴다. 묻지 않는다. AI가 정함.

**적용 순서** (중간에 실패해도 다시 돌리면 이어지게, 001과 같은 원칙)

1. 홈이 없으면 만들고 `user.json`에 홈과 이 프로젝트를 적는다.
2. 홈으로 갈 파일을 홈에 복사하고 합친다.
3. 프로젝트 안 파일을 새 자리로 옮긴다.
4. 경로를 고친다. 옮긴 모든 문서, `.siloroot/CLAUDE.md`의 관리 블록 밖, 홈으로 간 문서가 대상이다.
   - 프로젝트 문서가 홈으로 간 문서를 가리키면 `home:…`으로 바꾼다.
   - 홈 문서가 프로젝트에 남은 문서를 가리키면 `<이름>:…`으로 바꾼다.
5. `design/`, `roadmap/`으로 간 문서의 `type`을 `decision`에서 `design`, `roadmap`으로 바꾼다. `status`는 그대로 둔다.
6. 홈으로 복사한 원본을 프로젝트에서 지운다.
7. `metadata-guide.md`를 새 템플릿으로 바꾼다. 옛 가이드에서 사용자가 더한 줄(옛 템플릿에 없는 줄, 예: `06-discussions/` 폴더 규칙)은 경로를 고쳐 새 가이드의 같은 절에 옮긴다.
8. git 제외 줄, 관리 블록, 홈 관리 블록을 맞춘다. `home-access`가 "더함"이면 `.claude/settings.local.json`에 홈을 더한다.
9. 뷰어 스냅숏을 새로 잡는다.
10. 마지막에 `config.json`을 고친다: `schema: 3`, `mode: project`, `tracked` 지움.

- 백업은 프로젝트 `.siloroot/`, 홈에서 바뀌거나 생길 파일, `user.json`, 고칠 경우 `.claude/settings.local.json`을 담는다. 업데이트 장치의 백업이 프로젝트 밖 경로를 이미 다룬다. 되돌리면 홈에 만든 파일도 지운다.
- 홈은 여러 프로젝트가 함께 쓴다. 프로젝트 A를 옮긴 뒤 프로젝트 B도 홈으로 옮겼다면, A를 되돌릴 때 B가 고친 홈 파일(`profile.md`, `user.json` 등)이 충돌로 나온다. 지금 되돌리기 장치대로 멈추고 목록을 보인다. 사용자가 "그래도 되돌림"을 고르면 그 파일들은 `keptAfter` 폴더에 따로 남아 B의 내용이 없어지지 않는다. 줄 단위로 A의 몫만 빼는 되돌리기는 만들지 않는다. 드문 경우라 백업 모양을 새로 짤 만큼은 아니다. AI가 정함(점검 4번).
- 경로를 고친 뒤 `shared/` 문서가 private/나 `home:`을 가리키는 곳이 있으면 개수와 예를 `notes`로 알린다(4.5 경고와 같다). 고치지는 않는다.

**옮긴 뒤 (스크립트 밖, 스킬이 하는 일)**

- 홈으로 간 공부 노트 가운데 프로젝트 사건이 섞인 것은 노트마다 AI가 "사건 부분을 `shared/issues/`로 나눌까요?"를 제안한다. 승인한 것만 나눈다. 글을 쓰는 일이라 마이그레이션 백업 밖이다. 스킬은 이것을 알린다.

**002보다 먼저 고칠 것**

- 업데이트 장치는 지금 뒤 마이그레이션을 앞 마이그레이션 전의 상태로 계획한다(PR #22의 미룬 것). 모양 1 작업 공간이 1 → 2 → 3을 한 번에 올리려면, 앞 것의 계획 결과를 반영한 상태로 뒤 것을 계획해야 한다. 아니면 한 번에 하나씩만 올리고 다시 미리 보게 한다. 어느 쪽이든 `002` 전에 정한다. AI 제안: 한 번에 하나씩(단순하고, 질문이 섞이지 않는다).

### 4.12 내는 순서

| 순서 | 내용 | 버전 |
| --- | --- | --- |
| 1 | 자리표, 모양 3 템플릿(프로젝트, 홈), `user.json`, init 모드, 뷰어(바깥 점, 폴더 규칙 표, "나" 화면 자리, 홈 뷰어 켜기), 스킬을 자리 이름으로, 모양 2 계속 지원 | 그때의 다음 부 버전 |
| 2 | 업데이트 장치의 계획 고치기(4.11 끝), `002`, 업데이트 스킬의 목록 승인 단계와 홈 맞추기 | 그다음 부 버전 |
| 3 | 이 작업 공간에 `/siloroot:update`로 첫 시험 | |

- 읽는 문서 흔적(PR #23, 0.5.0)이 뷰어를 고치는 중이다. 1은 그것이 머지된 `main`에서 시작한다.

1을 먼저 내서 새로 까는 사람이 바로 새 구조를 받게 한다. 1은 모양 2를 계속 읽어야 하므로, 2가 늦어져도 옛 작업 공간은 그대로 돈다.

### 4.13 시험 (만드는 사람에게)

- 새 init: 홈 없음 → 홈과 프로젝트가 생기고 `user.json`이 적힌다. 홈 있음 → 프로젝트만 생긴다.
- git 제외: init 뒤 `git status`에 `shared/` 아래만 보인다.
- 경로: `home:`과 `<이름>:` 연결이 바깥 점으로 보인다. 등록되지 않은 이름은 경고로 나온다. `shared/` → private/ 연결은 경고로 나온다.
- `002`: 이 작업 공간과 같은 모양의 픽스처를 미리 보기, 적용, 되돌리기(홈까지 원래대로)로 돌린다. 홈에 같은 이름 노트가 있을 때, 홈에 `profile.md`가 이미 있을 때, 사용자가 더한 폴더, git이 추적하는 문서, 중간 실패 뒤 다시 돌리기를 확인한다.
- 머물기: 모양 2에 머문 작업 공간에서 맞추기와 스킬 안내가 모양 2 경로로 나온다.

## 5. 고른 방법 (Approaches)

| 안 | 모습 | 장단 |
| --- | --- | --- |
| **A. 목록 한 번 승인 (고름)** | 스크립트가 규칙으로 갈 곳을 정하고, 규칙으로 못 정하는 것만 AI가 제안한다. 사용자는 목록을 한 번 승인한다. 백업 하나로 통째로 되돌린다 | 업데이트 장치에 그대로 얹힌다. 공부 노트 나누기는 옮긴 뒤 따로 한다 |
| B. 폴더째 옮기고 나중에 손보기 | 폴더 단위로 옮기고, 문서별 다시 고르기는 나중에 AI가 한다 | 단순하다. 잘못 간 문서가 잠깐 `shared/`에 놓이고, 나중 손질은 백업 밖이다 |
| C. AI가 전부 | 스크립트 없이 스킬이 문서를 하나씩 옮긴다 | 섬세하다. 토큰이 많이 들고 백업과 되돌리기가 없다 |

**정함 (2026-11-24, 사용자):** A.

옛 작업 공간을 무엇으로 바꿀지도 비교했다(프로젝트로, 홈으로, 물어서). 사용자가 "옛 작업 공간은 프로젝트"로 정해 접었다. 홈에 갈 것을 잠시 private/에 두는 안(AI 추천)도 사용자가 "홈까지 해"로 접었다.

## 6. 열린 질문에 정한 것

**확정 (2026-11-24, 사용자):** 이 설계 문서 전체를 승인했다("확정, 계획 써").

**정함 (2026-11-24, 사용자):** 아래 다섯 개를 AI 추천대로 정했다. 각 내용은 본문의 그 절에 넣었다.

1. 홈 없는 프로젝트는 두지 않는다. 프로젝트 init은 늘 홈을 만들고 위치만 묻는다. 사용자 정보와 글쓰기 규칙이 한 곳에만 있어야 해서다(4.10).
2. 옛 `03-ideas/` 아이디어의 기본 갈 곳은 `shared/ideas/`다. 개인 것은 목록에서 홈으로 바꾼다. 아직 커밋하지 않으므로, `shared/`에 놓인 문서를 올릴지는 커밋할 때 사용자가 고른다(4.11).
3. 새 type과 상태 값은 4.8의 표대로다.
4. 홈 위치와 프로젝트 목록은 `<사용자 폴더>/.siloroot/user.json`에 둔다(4.4).
5. init과 `002`가 프로젝트의 `.claude/settings.local.json`에 홈을 `additionalDirectories`로 더할지 묻는다. 기본값은 더하기다. 설정을 바꾸는 일이라 묻지 않고는 하지 않는다(4.10, 4.11의 `home-access`).

남은 열린 질문은 없다. 4.11 끝의 "002보다 먼저 고칠 것"은 AI 제안(한 번에 하나씩)으로 두고, 2단계 계획에서 정한다.

## 7. 만드는 사람에게 맡기는 것

- 자리표의 코드 모양, 모양 2와 3의 템플릿을 나누는 법.
- 바깥 점의 생김새(흐린 점과 이름표 안에서).
- 표 줄 합치기의 세부(같은 줄 판단).
- 경로 고치기의 세부(백틱, `related`, 마크다운 링크를 이미 읽는 뷰어 코드를 재사용할지).
