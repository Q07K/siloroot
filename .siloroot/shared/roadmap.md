---
type: roadmap
status: 사용 중
created: 2026-11-25
related: [shared/requirements/doc-slots.md, shared/requirements/connection-graph-areas.md, shared/ideas/architecture-view.md, shared/requirements/codex-support.md, shared/requirements/home-graph-and-workspace-jump.md, shared/requirements/unified-doc-view.md, shared/requirements/metrics-doc-slots.md, shared/requirements/conventions-on-session-start.md, shared/requirements/persistent-new-marks.md]
---

# 로드맵

만들기로 정한 것만 올린다. 생각 중인 것은 아이디어(`shared/ideas/`)에만 둔다. 칸을 옮길 때 아이디어와 요구사항의 `status`도 맞춘다.

## 지금

진행 중. 요구사항 문서(`shared/requirements/`)가 있다.

| 기능 | 요구사항 | 상태 |
| --- | --- | --- |
| 연결 그래프를 영토로 묶기 | `shared/requirements/connection-graph-areas.md` | 시안(브랜치 `feat/graph-areas`), 정식 코드 전 |
| 프로젝트 작업 공간 폴더 구조(모양 3) | 없음(이 규칙 전에 시작) | 아이디어 `shared/ideas/project-folder-layout.md`가 진행 중. 끝났는지 확인할 것 |
| 업데이트 스킬과 마이그레이션 | 없음(이 규칙 전에 시작) | 0.8.2로 내보냄: update와 migrate로 나누기(`shared/design/update-split-design.md`). 받은 뒤 실제 올리기 흐름 확인이 남음 |
| Codex에서 SiloRoot 쓰기 | `shared/requirements/codex-support.md` | 문서 흔적 구현과 격리 검증 완료. 설치·초기화·알림·통계 추가 조사 |
| 한 문서 뷰(문서 화면과 옆 패널 통일, 문서 뷰 디자인 개선) | `shared/requirements/unified-doc-view.md` | 1단계 0.8.7로 내보냄(PR #43, #44). 2단계 첫 항목 좁은 문서 뷰(위 단추 줄) main에 머지(PR #48), 0.8.9로 내보냄(PR #49). 받은 뒤 실제 화면 확인이 남음 |
| 사용 기록에 자리별 문서 읽기·쓰기 세기 | `shared/requirements/metrics-doc-slots.md` | 0.8.8로 내보냄(PR #45, #46). 받은 뒤 실제 세션에서 새 칸 확인이 남음 |
| 세션을 시작할 때 컨벤션을 맥락에 넣기 | `shared/requirements/conventions-on-session-start.md` | 0.8.9로 내보냄(PR #47, #49). 받은 뒤 실제 세션과 압축 뒤, Codex 확인이 남음 |
| 새 점과 새 선을 다음 메시지까지 남기기 | `shared/requirements/persistent-new-marks.md` | 0.8.11로 내보냄(PR #52). 받은 뒤 실제 세션 확인과 AI가 정한 기본값 확인이 남음 |

## 다음

곧 시작한다.

| 기능 | 아이디어 |
| --- | --- |

## 나중

만들기로 했지만 때는 정하지 않았다. 아이디어 `status`는 `보류`.

| 기능 | 아이디어 |
| --- | --- |
| 뷰어 구조 탭(코드 지도 + 시스템 개요) | `shared/ideas/architecture-view.md` |
