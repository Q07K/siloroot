---
type: idea
status: 완료
created: 2026-11-25
related: [shared/design/doc-slots.md, shared/decisions/worklog-daily.md, shared/decisions/issue-status.md, shared/decisions/requirements-hub.md, shared/decisions/runbook-on-demand.md, shared/decisions/area-names-keep.md, shared/decisions/roadmap-vs-plan.md, shared/decisions/slot-readme-and-empty-clusters.md, shared/decisions/glossary-in-conventions.md, shared/decisions/research-split.md, shared/ideas/shared-private-areas.md, shared/conventions/glossary.md]
---

# 문서 자리 다시 짜기

연결 그래프 작업을 하며 문서가 어디에 남았는지 되짚어 보니, 자리는 있는데 비어 있거나(결정, 이슈, 컨벤션, 회의 메모) 자리가 없어서 엉뚱한 곳에 들어간 문서(조사, 용어집, 시스템 개요)가 많았다. 실제 프로젝트의 문서 종류와 SiloRoot 자리를 견줘 다시 짠다.

## 왜 (사용자)

- 자리 폴더가 있었는데 README도 없고 그래프에도 안 보여서, 있는 줄 몰랐다.
- 문제 기록은 핵심 문서인데 하나도 없다.
- 왜 바뀌었는지 팀이 볼 곳이 없다.
- 아이디어는 흩어져 나오지만, 남는 것은 "어떤 문제를 어떻게 풀었나"다. 이것이 잘 남아야 나중에 포트폴리오로 정리하기도 좋다.

- 대화는 여러 주제를 자주 오간다. 각 폴더에서도, 대화에서 나온 문서도 관심사를 꼭 나눠 관리해야 한다(사용자, 2026-11-25).

## 관심사 나누기 (사용자 요구, AI 제안)

대화가 주제를 오가도 문서는 관심사마다 나눈다. 자리를 늘리는 것만으로는 부족하다. 이번 작업에서도 자리(결정, 이슈)는 있었는데 AI가 그 자리에 쓰지 않았다. 그래서 "언제 어디에 쓰나"를 규칙과 자리 README에 분명히 적는다.

| 대화에서 이런 일이 생기면 | 문서는 | 넣지 않는 곳 |
| --- | --- | --- |
| 사용자가 무엇을 정했다 | 결정 하나에 결정 기록 하나 | 논의 기록 끝 목록, 아이디어 문서 |
| 무언가 깨졌거나 느렸고 원인을 찾았다 | 문제 하나에 이슈 하나 | 아이디어 문서, 작업 기록 |
| 측정하거나 실험했다 | 그 값으로 정한 결정 기록의 근거(개념은 홈 공부 노트) | 아이디어 문서 |
| 새로 만들고 싶은 것이 나왔다 | 아이디어 하나 | 지금 이야기하던 문서의 한 절 |
| 이야기 주제가 바뀌었다 | 논의 기록을 새로 연다(어디서 나왔는지 한 줄, 서로 `related`) | 앞 논의 기록에 이어 쓰기 |
| 용어를 정했다 | 컨벤션의 용어집 | 설계 문서 |

- 자리 폴더 README마다 "여기에 넣는 것"과 "여기에 넣지 않는 것(그건 어디로)"을 함께 적는다.

### 문서만 보고 상태를 안다 (사용자, 2026-11-25)

2026-11-25에 AI가 그래프 아이콘이 이미 열린 자물쇠로 바뀐 것을 코드를 읽고서야 알았다. 다른 세션이 사용자와 정하고 반영한 일이었는데, 기록은 여러 관심사가 섞인 긴 논의 기록 한가운데에만 있었다. 사용자: "문서로 관심사 잘 분리해서 작성했으면 이미 문서 보고 아 했구나 하고 끝났을 문제잖아", "혹은 진행 중이구나 아니면 완료했구나 시작 전이구나 이렇게".

- 일 단위 문서는 상태를 맨 위 속성으로 단다: 결정(제안, 확정, 바뀜), 요구사항(시작 전, 진행 중, 완료), 구현 계획(체크 목록으로 진행), 이슈(아래).
- 결정 기록에는 반영 상태를 한 줄 적는다: 어디에 반영됐나(코드, 문서), 아직인가.
- 로드맵 한 장이 기능마다 상태를 모아 보인다. AI는 코드를 열기 전에 로드맵과 결정 기록부터 본다.

이슈 상태 (사용자가 정함, `shared/decisions/issue-status.md`):

| status | 뜻 | 본문에 적을 것 |
| --- | --- | --- |
| 열림 | 겪었고 원인을 찾거나 고치는 중 | 겪은 일, 찾은 것 |
| 보류 | 알지만 지금은 안 고친다. 다른 일을 기다리는 것(대기)도 여기 | 까닭, 무엇을 기다리나, 언제 다시 보나 |
| 해결 | 고쳤다 | 원인, 고친 것, 다시 안 나게 한 것 |
| 안 고침 | 고치지 않기로 했다 | 까닭 |

로드맵에 무엇이 올라가나 (사용자가 정함, `shared/decisions/roadmap-vs-plan.md`):

- 로드맵에는 만들기로 정한 것만 올린다. 언제 만들지에 따라 세 칸: 지금(진행 중), 다음(곧 시작), 나중(만들기로 했지만 때는 정하지 않음).
- "나중에 하자"는 만들기로 정한 것이니 로드맵 "나중" 칸에 올리고 아이디어 문서를 가리킨다. 아이디어 문서의 `status`는 `보류`로 둔다.
- "생각해 보자"나 공부 중인 것은 로드맵에 올리지 않고 아이디어(또는 홈 공부 노트)에만 둔다.
- 지금 칸으로 옮길 때 요구사항 문서를 만든다(`shared/decisions/requirements-hub.md`).
- 같은 내용은 한 곳에만 쓰고, 작업 기록과 논의 기록은 그 문서를 가리키기만 한다.

## 정한 것

| 결정 | 문서 |
| --- | --- |
| 로드맵(프로젝트에 한 장, 늘 지금 상태)과 구현 계획(기능마다 하나, 다 만들면 끝)을 가른다 | `shared/decisions/roadmap-vs-plan.md` |
| 자리 폴더마다 README를 두고, 그래프는 문서가 없는 폴더도 빈 클러스터로 그린다 | `shared/decisions/slot-readme-and-empty-clusters.md` |
| 용어집은 따로 폴더를 두지 않고 컨벤션 안의 문서 하나로 둔다 | `shared/decisions/glossary-in-conventions.md` |
| 조사는 둘로 가른다: 어디서나 통하는 것은 홈 공부 노트, 이 프로젝트의 측정값은 그 값으로 정한 결정 기록의 근거 | `shared/decisions/research-split.md` |
| 요구사항은 `shared/requirements/`에 기능마다 하나, 그 기능의 중심 문서 | `shared/decisions/requirements-hub.md` |
| 로드맵은 `shared/roadmap.md` 파일 하나(지금·다음·나중 세 칸, 만들기로 정한 것만), 구현 계획은 `shared/plans/` | `shared/decisions/roadmap-vs-plan.md` |
| 이슈 상태는 열림, 보류(대기 포함), 해결, 안 고침 | `shared/decisions/issue-status.md` |
| AI 작업 기록은 worklog, `private/worklog/YYYY-MM-DD.md` 하루에 한 문서. 확인할 것은 private/open-questions.md 한 장. 홈도 같은 모양 | `shared/decisions/worklog-daily.md` |
| 시스템 개요는 `shared/architecture.md` 문서로 둔다. 뷰어 구조 탭은 고도화 전까지 미룬다 | 작은 결정, 여기에만. 탭은 `shared/ideas/architecture-view.md`(보류) |
| 운영 절차 자리는 필요할 때 `shared/runbook/`으로 더한다 | `shared/decisions/runbook-on-demand.md` |
| `shared`, `private` 이름은 그대로, 아이콘(열린·잠긴 자물쇠)으로 뜻을 보인다 | `shared/decisions/area-names-keep.md` |
| 팀이 보는 "왜 바뀌었나"는 결정 기록이 맡는다. 버전마다 바뀐 것은 코드 저장소 쪽 | 작은 결정, 여기에만 |
| 사람 회의 메모는 private/sources/ 그대로, 정한 것만 결정 기록으로 | 작은 결정, 여기에만 |
| 아이디어 폴더 안내의 옛 문장("결정은 아이디어 옆에")을 고친다 | 작은 결정, 여기에만 |
| 섞인 그래프 논의 기록을 관심사마다 쪼갠다(홈 아이디어 자리 규칙, 그래프 디자인, 그래프 성능, 그래프 화면) | 작은 결정, 여기에만 |

## 폴더 구조안 (AI 제안, 2026-11-25)

`★`는 정한 것에서 나온 변경, `?`는 아직 안 정한 것이다.

```text
.siloroot/
├─ CLAUDE.md, metadata-guide.md, config.json, state/
├─ shared/                    git에 올라감
│  ├─ README.md
│  ├─ requirements/        ?  기능마다 하나: 문제, 목표, 거쳐 온 길, 결과
│  ├─ ideas/                  흩어져 나오는 아이디어
│  ├─ decisions/              결정 하나에 하나 (측정값은 여기 근거로 ★)
│  ├─ design/                 설계
│  ├─ architecture.md      ?  지금 구조 한 장
│  ├─ roadmap/                ★ 로드맵 한 장(roadmap.md)
│  ├─ plans/               ?★ 기능마다 구현 계획
│  ├─ issues/                 겪은 문제와 원인, 해결
│  ├─ conventions/            약속
│  │  └─ glossary.md       ★  용어집
│  └─ runbook/             ?  배포, 되돌리기, 장애 대응
└─ private/                   git에서 빠짐
   ├─ README.md
   ├─ log/                    changelog.md(AI가 한 일), open-questions.md
   ├─ sources/                받은 자료, 회의 메모
   ├─ notes/
   ├─ discussions/
   └─ feedback/
```

- 자리 폴더마다 `README.md`(무엇을 넣나, 파일 이름, 쓰는 틀)를 둔다 ★. 그래프는 문서가 없는 자리도 빈 클러스터로 그린다 ★.
홈(사람마다 하나)과 등록부까지 그리면:

```text
~/.siloroot/user.json         등록부: 홈 위치, 프로젝트 이름과 경로
~/siloroot-home/              홈 (home:)
├─ CLAUDE.md, metadata-guide.md, .siloroot/(설정)
├─ profile.md                 사용자 정보(승인한 습관과 선호)
├─ writing-guide.md           글쓰기 규칙
├─ ai-comment.md           ?  "나" 화면 코멘트. 자리 표에는 있는데 파일이 없다
├─ study/                     개념 공부 노트 (프로젝트 조사의 개념 쪽도 여기로 ★)
│  ├─ README.md               주제 목록
│  └─ diagrams/
├─ ideas/                     사용자가 "개인 아이디어"라고 한 것만
│                          ★  README 없음, 비어 있음 → README 더함
├─ feedback/                  글쓰기 규칙 후보, 사용자 정보 후보
└─ log/                       changelog.md, open-questions.md
```

- 방향: 프로젝트 `shared/`는 홈을 가리키지 않는다. 홈 노트는 `<프로젝트 이름>:shared/...`로 프로젝트를 가리킬 수 있다.

## 아직 안 정한 것

없음(2026-11-25). 설계는 `shared/design/doc-slots.md`(확정, 2026-11-25 0.8.0으로 내보냄).

