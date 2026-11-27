---
type: decision
status: 확정
created: 2026-11-25
related: [shared/ideas/doc-slots.md, shared/ideas/connection-graph-areas.md]
---

# 조사는 둘로 가른다

## 맥락

조사·실험 자리가 없어서, 연결 그래프 성능 측정(표 다섯 개)이 아이디어 문서 `shared/ideas/connection-graph-areas.md` 안에 들어갔다. 사용자는 조사를 홈으로 보내 프로젝트와 완전히 떼고, 프로젝트에는 그것을 쓰는 문서만 두자고 했다.

## 정한 것 (사용자, 2026-11-25)

- 어디서나 통하는 것(예: "움직이는 것이 많으면 두 겹 캔버스는 이득이 없다")은 홈 공부 노트에 둔다. 개념은 홈, 사건은 프로젝트라는 지금 규칙과 같은 갈래다.
- 이 프로젝트의 측정값은 프로젝트에 둔다. 따로 조사 폴더를 만들지 않고, 그 값으로 정한 결정 기록의 근거로 붙인다. 값은 이 코드에서만 뜻이 있고, 홈은 팀이 볼 수 없다.

## 버린 것

- 조사를 통째로 홈에 두기: 이 프로젝트의 측정값까지 홈으로 가면 팀이 결정의 근거를 볼 수 없다.
- 조사 폴더: 측정은 결정을 내리려고 하는 것이라, 결정 기록에 붙어 있어야 읽힌다.

## 따라오는 일

- `shared/ideas/connection-graph-areas.md`의 측정 절을 결정 기록(두 겹 캔버스를 쓰지 않는다, 영토 밀어내기는 실제 모양으로 등)의 근거로 옮긴다.

## 반영

- 이 작업 공간: `shared/ideas/connection-graph-areas.md`의 측정 절을 결정 기록 4개의 근거로 옮겼다(2026-11-25): `shared/decisions/graph-perf-by-computation.md`, `shared/decisions/graph-lines-on-canvas.md`, `shared/decisions/no-layered-canvas.md`, `shared/decisions/territory-push-real-shape.md`
- 플러그인: 플러그인 PR #30(2026-11-25 머지, 0.8.0으로 내보냄). 관리 블록의 "흐름 나누기" 표
