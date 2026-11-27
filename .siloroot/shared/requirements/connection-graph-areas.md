---
type: requirement
status: 진행 중
created: 2026-11-25
related: [shared/ideas/connection-graph-areas.md, shared/conventions/glossary.md, shared/roadmap.md]
---

# 연결 그래프를 영토로 묶기

## 문제

작업 공간을 shared, private, 홈으로 나눈 뒤 연결 그래프가 폴더마다 따로 흩어져 무엇이 어느 영역인지 알 수 없었다("각개전투하는 중"). 홈 공부 노트는 그래프에 보이지 않았다.

## 목표와 비목표

- 목표: 연결 화면으로 세 가지를 본다. 아이디어가 어떤 설계, 결정과 이어졌나. Claude가 지금 어떤 문서를 읽나(흔적). 프로젝트가 홈 지식을 잘 참조하나(링크와 실제로 읽는지 둘 다).
- 비목표: 홈 전체를 프로젝트 그래프에 끌어오기, 규칙과 안내 문서를 지식처럼 그리기.
- 성공 기준: 문서 500개에서도 열기와 끌기가 멈추지 않는다(지금 열기 0.94초, 끌기 프레임 약 27ms).

## 거쳐 온 길

| 종류 | 문서 |
| --- | --- |
| 아이디어 | `shared/ideas/connection-graph-areas.md`, `shared/ideas/territory-tangent-neck.md`, `shared/ideas/territory-fence.md` |
| 결정 | `shared/decisions/graph-perf-by-computation.md`, `shared/decisions/graph-lines-on-canvas.md`, `shared/decisions/no-layered-canvas.md`, `shared/decisions/territory-push-real-shape.md`, `shared/decisions/area-names-keep.md` |
| 설계 | 없음(시안으로 정하는 중) |
| 용어 | `shared/conventions/glossary.md` |
| 이슈 | `shared/issues/territory-overlap-freeze.md`, `shared/issues/drag-release-lag.md`, `shared/issues/territory-tearing.md` |

## 결과

아직이다. 시안은 브랜치 `feat/graph-areas`에 있고, 정식 코드와 테스트, README 두 벌로 옮기는 것이 남았다.
