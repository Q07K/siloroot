---
type: design
status: 확정
created: 2026-11-25
related: [shared/ideas/doc-slots.md, shared/decisions/roadmap-vs-plan.md, shared/decisions/slot-readme-and-empty-clusters.md, shared/decisions/glossary-in-conventions.md, shared/decisions/research-split.md, shared/decisions/requirements-hub.md, shared/decisions/runbook-on-demand.md, shared/decisions/area-names-keep.md, shared/decisions/issue-status.md, shared/decisions/worklog-daily.md, shared/ideas/daily-worklog.md, shared/ideas/architecture-view.md]
---

# 문서 자리 다시 짜기 설계 (모양 4)

아이디어는 `shared/ideas/doc-slots.md`, 정한 것은 `shared/decisions/`의 결정 기록 9개다. 이 문서는 그것을 플러그인에 옮길 때의 모양을 한 장으로 묶는다. AI가 정한 것은 "(AI)"로 표시하고 맨 끝에 모았다.

## 1. 왜

- 대화는 여러 주제를 자주 오간다. 문서는 관심사마다 나눠 그 종류의 자리에 둬야 한다(사용자, home:profile.md에도 넣음).
- 연결 그래프 작업 이틀 동안 결정 기록과 이슈가 0개였다. 자리는 있었는데 README도 없고 그래프에도 안 보여서 사용자도 AI도 몰랐고, 결정은 논의 기록 끝과 아이디어 문서에 묻혔다.
- 문서만 보고 일이 시작 전인지, 진행 중인지, 끝났는지 알 수 있어야 한다. AI가 코드를 열어 보고서야 이미 한 일을 아는 일이 있었다.

## 2. 목표와 하지 않을 것

목표

- 대화에서 생기는 일마다 갈 문서가 정해져 있고, AI가 그 자리에 쓴다.
- 자리마다 README가 있어 무엇을 넣고 무엇을 넣지 않는지 안다. 빈 자리도 그래프에 보인다.
- 일 단위 문서(요구사항, 결정, 계획, 이슈)는 상태를 달고, 로드맵 한 장이 기능마다 상태를 모은다.

하지 않을 것

- `shared`, `private` 폴더 이름은 바꾸지 않는다(`shared/decisions/area-names-keep.md`).
- 뷰어 구조 탭, 작업 일지 자동 수집, 문서 버전 관리는 이번에 하지 않는다(각각 `shared/ideas/architecture-view.md`, `shared/ideas/daily-worklog.md`, `shared/ideas/doc-versioning.md`).
- 운영 절차 자리는 기본으로 만들지 않는다(`shared/decisions/runbook-on-demand.md`).

## 3. 자리

### 프로젝트

```text
.siloroot/
├─ CLAUDE.md, metadata-guide.md, config.json, state/
├─ shared/
│  ├─ README.md
│  ├─ roadmap.md            새로. 지금, 다음, 나중 세 칸
│  ├─ architecture.md       새로. 지금 구조 한 장(빈 틀로 시작)
│  ├─ requirements/         새로. 기능 하나에 하나
│  ├─ ideas/
│  ├─ decisions/
│  ├─ design/
│  ├─ plans/                새로. 구현 계획(예전 roadmap/의 문서)
│  ├─ issues/
│  └─ conventions/          glossary.md는 쓸 때 만든다
└─ private/
   ├─ README.md
   ├─ open-questions.md     옮김(예전 private/log/)
   ├─ worklog/              새로. YYYY-MM-DD.md 하루에 한 문서
   ├─ sources/
   ├─ notes/
   ├─ discussions/
   └─ feedback/
```

자리 폴더마다 `README.md`를 둔다(5절). `shared/roadmap/`과 `private/log/`는 없어진다.

### 홈

```text
~/siloroot-home/
├─ CLAUDE.md, metadata-guide.md, profile.md, writing-guide.md, ai-comment.md
├─ open-questions.md        옮김(예전 log/)
├─ worklog/                 새로. YYYY-MM-DD.md
├─ study/
├─ ideas/                   README 더함
└─ feedback/
```

### 자리표(`lib/layout.mjs`) 바뀌는 것

| 역할 | 모양 3 | 모양 4 |
| --- | --- | --- |
| `log` | `private/log` | 없앰. `worklog`와 `openQuestions`로 나눔 |
| `worklog` (새로) | | private/worklog, 홈은 `worklog` |
| `openQuestions` (새로) | | private/open-questions.md, 홈은 open-questions.md |
| `roadmap` | `shared/roadmap` (폴더) | `shared/roadmap.md` (파일) |
| `plans` (새로) | | `shared/plans` |
| `requirements` (새로) | | `shared/requirements` |
| `architecture` (새로) | | `shared/architecture.md` |
| `glossary` (새로) | | `shared/conventions/glossary.md` |

## 4. 문서 종류와 상태

| 자리 | type | status | 바뀐 것 |
| --- | --- | --- | --- |
| `shared/requirements/` | `requirement` | 시작 전, 진행 중, 완료, 접음 | 새로 (AI: 접음을 더함. 만들다 그만둔 기능) |
| `shared/plans/` | `plan` | 제안, 확정, 진행 중, 완료, 접음 | 새로. 진행은 본문 체크 목록 |
| `shared/roadmap.md` | `roadmap` | 사용 중 | 한 장이라 문서 종류로. 칸(지금, 다음, 나중)은 본문 |
| `shared/architecture.md` | `architecture` | 사용 중 | 새로 |
| `shared/issues/` | `issue` | 열림, 보류, 해결, 안 고침 | `원인 찾음`은 `열림`으로, `안 함`은 `안 고침`으로 |
| `shared/decisions/` | `decision` | 제안, 확정, 바뀜 | 그대로. 본문에 "반영" 절 |
| private/worklog/ | `log` | 사용 중, 끝남 | 날짜 지난 문서는 `끝남` |

## 5. 자리 README

자리 폴더마다 같은 틀로 둔다. 템플릿에 넣고 맞추기(`/siloroot:update`)가 빠진 것만 더한다. 이미 있는 README는 덮어쓰지 않는다.

```markdown
# 결정

## 여기에 넣는 것
결정 하나에 문서 하나. 무엇을 왜 정했나, 버린 것, 반영 상태.

## 여기에 넣지 않는 것
- 정하기 전의 논의 → `private/discussions/`
- 측정 과정 → 결정 기록의 근거 절에 값만, 개념은 홈 공부 노트

## 파일 이름
`영문-주제.md`

## 상태
제안, 확정, 바뀜

## 쓰는 틀
(맥락 / 정한 것 / 버린 것 / 반영)
```

이것은 모양 3 템플릿이 "안내는 영역마다 README.md 하나에 모으고 폴더마다 두지 않는다"고 했던 것을 되돌린다(`shared/decisions/slot-readme-and-empty-clusters.md`).

## 6. 관심사 나누기 규칙 (관리 블록)

관리 블록의 "흐름 나누기"에 아래 표를 넣는다. 지금 블록의 "따로 남길 결정", "작은 결정은 changelog" 같은 애매한 말은 뺀다.

| 대화에서 이런 일이 생기면 | 문서 | 넣지 않는 곳 |
| --- | --- | --- |
| 사용자가 무엇을 정했다 | 결정 하나에 결정 기록 하나(작은 결정은 그 아이디어나 설계 문서의 정한 것 표) | 논의 기록 끝 목록, worklog |
| 깨졌거나 느렸고 원인을 찾았다 | 이슈 하나 | 아이디어 문서, worklog |
| 측정하거나 실험했다 | 그 값으로 정한 결정 기록의 근거. 개념은 홈 공부 노트 | 아이디어 문서 |
| 만들고 싶은 것이 나왔다 | 아이디어 하나 | 지금 문서의 한 절 |
| 만들기로 했다 | 로드맵 칸(지금, 다음, 나중). 지금이면 요구사항 문서를 만든다 | |
| 이야기 주제가 바뀌었다 | 논의 기록을 새로 열고 서로 `related` | 앞 논의 기록에 이어 쓰기 |
| 용어를 정했다 | `shared/conventions/glossary.md` | 설계 문서 |
| 요청 하나를 마쳤다 | 그날 worklog에 한 줄(경로만, 내용은 다시 쓰지 않음) | |

더하는 규칙

- 코드를 열기 전에 로드맵과 결정 기록부터 본다.
- 결정 기록에는 "반영" 절을 두고 어디에 반영됐는지(코드, 문서, 아직)를 적는다.
- 같은 설명은 한 곳에만 쓰고 다른 곳에서는 가리킨다.

## 7. 뷰어

- 빈 자리 폴더(README만 있거나 비어 있음)를 그래프에 흐린 원과 `issues 0` 같은 이름으로 그린다.
- 미해결 질문(객체 탭)은 `openQuestions` 자리를 읽는다.
- "나" 화면의 꾸준함은 worklog 파일 이름의 날짜와 문서 `created`로 센다(지금은 changelog의 날짜 제목).
- 속성 점검: 새 type과 status, 폴더 규칙(4절)을 따른다.

## 8. 마이그레이션 003 (모양 3 → 4)

프로젝트

1. 폴더를 만든다: `shared/requirements/`, `shared/plans/`, private/worklog/.
2. `shared/roadmap/` 안의 문서를 `shared/plans/`로 옮기고 `type`을 `plan`으로 바꾼다. `shared/roadmap.md`는 템플릿에서 새로 만든다.
3. `private/log/changelog.md`를 `## YYYY-MM-DD` 제목마다 `private/worklog/YYYY-MM-DD.md`로 나눈다. 날짜 제목 앞의 글은 버리지 않고 가장 이른 날 문서 앞에 둔다(AI). 오늘이 아닌 날은 `status: 끝남`.
4. `private/log/open-questions.md`를 private/open-questions.md로 옮기고, 비면 `private/log/`를 지운다.
5. 자리가 어긋난 문서를 옮긴다. 목록을 한 번 승인받는다(002의 갈 곳 목록과 같은 방식): `shared/ideas/` 안의 `type: decision` → `shared/decisions/`, `type: design` → `shared/design/`, `type: roadmap` → `shared/plans/`.
6. 이슈 status를 바꾼다: `원인 찾음` → `열림`, `안 함` → `안 고침`.
7. 옮긴 문서를 가리키던 경로(본문 백틱, `related`, 홈 노트의 `<프로젝트>:` 경로)를 고친다(`lib/links.mjs`).

홈

1. `log/changelog.md`를 `worklog/YYYY-MM-DD.md`로 나누고, `log/open-questions.md`를 open-questions.md로 옮긴다.

맞추기(마이그레이션 뒤)

- 자리 README, `shared/roadmap.md`, `shared/architecture.md`, 홈 `ideas/README.md`의 빠진 파일을 더한다.
- 관리 블록과 `metadata-guide.md`의 표를 새 템플릿에 맞춘다(안내 문서는 덮어쓰지 않고 빠진 줄을 묻는다).

## 9. 바꾸는 곳

| 곳 | 무엇 |
| --- | --- |
| `lib/config.mjs` | `SCHEMA` 4 |
| `lib/layout.mjs` | 자리표(3절), 폴더 규칙(4절) |
| `lib/vocab.mjs` | 새 type, 이슈 status |
| `lib/migrations/003-*.mjs`, 테스트 | 8절 |
| `lib/workspace-sync.mjs` | 만들 폴더와 파일, 자리 README |
| `templates/project/`, `templates/home/` | 관리 블록(6절), 속성 가이드, 자리 README, `roadmap.md`, `architecture.md`, 홈 `ideas/README.md` |
| `skills/` | feedback, note, update의 changelog와 open-questions 경로 |
| `viewer/build.mjs`, `viewer/template.html` | 7절 |
| `README.md`, `README.ko.md` | 폴더 표 |

## 10. 이 작업 공간 정리 (플러그인을 올린 뒤)

마이그레이션이 하지 않는, 이 작업 공간에만 있는 일이다.

- private/discussions/2026-11-24-graph-areas.md를 관심사마다 쪼갠다: 홈 아이디어 자리 규칙, 그래프 디자인, 그래프 성능, 그래프 화면.
- `shared/ideas/connection-graph-areas.md`의 측정 절을 결정 기록의 근거로 옮긴다(두 겹 캔버스를 쓰지 않는다, 영토 밀어내기는 실제 모양으로).
- 겪은 문제를 이슈로 남긴다: 영토가 겹치면 브라우저 멈춤, 놓은 뒤 렉, 영토 끊김.
- `shared/design/connection-graph-terms.md`의 용어 표를 `shared/conventions/glossary.md`로 옮긴다.
- `shared/ideas/README.md`의 옛 문장("결정은 아이디어 옆에")을 고친다.
- `shared/architecture.md`를 이 플러그인 구조로 채우고, `shared/roadmap.md`를 쓴다(보류한 구조 탭은 나중 칸).

## 11. 확인

- `npm test`, `claude plugin validate .`
- 마이그레이션 003: 미리 보기, 적용, 되돌리기, 날짜별 나누기, 자리 어긋난 문서 목록, 경로 고치기 테스트.
- 이 작업 공간 복사본에 적용해 끊어진 연결 0, 속성 경고를 견준다.
- 뷰어: 빈 클러스터, 미해결 질문, "나" 꾸준함을 화면으로 본다.
- 버전은 내보낼 때 부 버전(0.8.0)으로 올린다.

## AI가 정한 것

- type 이름: `requirement`, `plan`, `architecture`. 요구사항 status에 `접음`을 더함.
- 로드맵은 문서 종류(`사용 중`)로 두고 칸은 본문에.
- changelog를 나눌 때 날짜 제목 앞의 글은 가장 이른 날 문서 앞에 둔다. 지난 날은 `끝남`.
- 이슈 `원인 찾음`은 `열림`으로 합친다(원인을 찾았어도 아직 안 고쳤으면 열림).
- 자리가 어긋난 문서 옮기기를 003에 넣고, 002처럼 목록을 한 번 승인받는다.
- 자리 README의 틀(넣는 것, 넣지 않는 것, 파일 이름, 상태, 쓰는 틀).
- 마이그레이션 번호 003, 모양 4.
