---
type: idea
status: 아이디어
created: 2026-11-24
related: [shared/ideas/workspace-modes.md, shared/ideas/shared-private-areas.md, shared/ideas/publish-copy.md, shared/ideas/doc-versioning.md, shared/ideas/edge-meaning.md, shared/ideas/implementation-check.md, shared/ideas/home-workspace.md, shared/ideas/project-unit.md, shared/ideas/project-folder-layout.md, shared/ideas/update-migration.md]
---

# SiloRoot를 개발 프로젝트에 쓰기

`.siloroot/` 안에 폴더를 더 만들 수 있는지 묻다가 나온 이야기다. 이 문서는 전체를 묶는 자리이고, 덩어리마다 문서를 따로 둔다. 의견을 주고받은 과정은 private/discussions/2026-11-24-siloroot-beyond-study.md에 있다.

## 왜

- SiloRoot는 학습이 중요하다고 보고 만들었다. 그런데 밑에 깔린 구조는 IT 서비스 개발에도 충분히 쓸 수 있다. 마크다운이 원본이고, 사람은 뷰어로, AI는 파일로 같은 걸 본다. 문서는 경로로 연결되고, 이야기는 관심사별로 나뉜다.
- AI로 개발하다 보면 일하면서 생긴 지식이 너무 쉽게 휘발된다.

## 원하는 것

1. 컨벤션 관리
2. 일하면서 생긴 지식 관리
3. 외부 공유용 문서 만들기
4. 시간이 지난 뒤, 그때 왜 그렇게 결정했는지 확인하기

## 지금 SiloRoot와 맞대 보기

AI가 정리한 의견이다.

| 원하는 것 | 지금 있는 것 | 빈 곳 |
| --- | --- | --- |
| 컨벤션 | 규칙 후보를 만들고 사용자가 승인하면 `writing-guide.md`에 넣는 흐름 | 글 표현에만 쓴다. 코드, API, 폴더 구조 같은 개발 컨벤션을 담을 곳이 없다 |
| 일하며 생긴 지식 | `/siloroot:note`: 사용자가 물어야 노트가 생긴다 | 디버깅하다 찾은 원인, 함정, 우회법은 아무도 묻지 않아서 남지 않는다. 휘발되는 까닭이 여기 있다 |
| 외부 공유용 문서 | 없음 | 원본 문서에서 읽는 사람에 맞춰 뽑아내는 결과물이라, 원본과 성격이 다르다 |
| 결정 이유 | `decision` 문서(제안, 확정, 바뀜) | 아이디어 옆에만 둔다. 고른 대안, 그때의 조건, 무엇으로 바뀌었는지 적는 틀이 없다. 코드에서 결정으로 거슬러 찾아가는 길도 없다 |

사용자가 가져온 외부 대화의 제안(모드 나누기, `docs/`로 원본 옮기기, 여덟 영역 분류, 뜻이 있는 관계)은 private/discussions/2026-11-24-siloroot-beyond-study.md에 있다.

## 덩어리

한 번에 만들기에는 커서 넷으로 나눈다. 순서는 AI 제안이고 아직 정하지 않았다.

| 순서 | 덩어리 | 문서 | 어디까지 왔나 |
| --- | --- | --- | --- |
| 1 | 영역과 모듈: 공유·개인 영역, 모드, 사람에 대한 정보의 자리 | `shared/ideas/shared-private-areas.md`, `shared/ideas/workspace-modes.md`, `shared/ideas/home-workspace.md`, `shared/ideas/project-unit.md` | 영역은 정함. 모드는 논의 중 |
| 2 | 지식 남기기와 컨벤션 (원하는 것 1, 2번) | 아직 없음 | 아직 이야기하지 않음 |
| 3 | 버전 | `shared/ideas/doc-versioning.md` | 정함 |
| 4 | 공개본 만들기: 팀 공개 아카이브, 외부 공유 (원하는 것 3번) | `shared/ideas/publish-copy.md` | 방향은 정함 |
| - | 프로젝트 작업 공간의 폴더 구조 (정한 원칙을 한 그림으로) | `shared/ideas/project-folder-layout.md` | 2판 확정 |
| - | 업데이트 스킬과 마이그레이션 정책 | `shared/ideas/update-migration.md` | 1단계 완료 (PR #22 머지). 이 작업 공간에서 돌려 보기와 `002` 설계가 남음 |
| - | 뷰어 탭 제목에 프로젝트 이름 넣기 | `shared/ideas/viewer-tab-title.md` | 완료 (PR #20 머지) |
| - | 구현 점검: 구현이 컨벤션과 설계를 따랐나 (원하는 것 1번과 이어짐) | `shared/ideas/implementation-check.md` | 맡는 범위 정함. 결과 모양은 남음 |
| - | 그래프 선에 "왜 이어졌나" 보여 주기 (원하는 것 4번과 이어짐) | `shared/ideas/edge-meaning.md` | 방식 정함. 종류 목록은 남음 |

## 열린 질문

- 일하며 생긴 지식을 AI가 묻지 않아도 남기는 방법(원하는 것 2번).
- 컨벤션을 담는 방법(원하는 것 1번).
- 덩어리를 어떤 순서로 만들지.
