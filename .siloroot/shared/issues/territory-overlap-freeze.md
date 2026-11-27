---
type: issue
status: 해결
created: 2026-11-25
related: [shared/ideas/connection-graph-areas.md, shared/decisions/graph-perf-by-computation.md, shared/ideas/territory-tangent-neck.md]
---

# 영토끼리 겹치면 브라우저가 멈춘다

## 겪은 일

연결 그래프 11안에서 클러스터를 끌어 두 영토가 겹치는 순간 브라우저가 멈췄다.

사용자: "영토끼리 겹치는 순간은 무조건 브라우저 렉 걸려서 죽는다."

## 원인

다른 영토로 가는 선은 길 찾기로 다른 영토를 피한다.

영토가 겹치면 막힌 칸이 크게 늘어 길이 길게 꺾이는데, 찾은 경로를 곧게 펴는 단계가 점 수의 제곱만큼 견줘서 경로 하나에 시간이 크게 들었다.

막힌 칸도 처음에 전부 계산했다.

## 해결

- 경로 펴기를 앞에서부터 한 번 훑는 방식으로 바꿨다.
- 막힌 칸은 길 찾기가 그 칸에 닿을 때만 계산한다.
- 영토끼리 겹치지 않게 밀어낸다(지금은 실제 모양으로 견준다: `shared/decisions/territory-push-real-shape.md`).

## 다시 안 나게

- 성능은 그리는 모양을 바꾸지 않고 계산으로 푼다(`shared/decisions/graph-perf-by-computation.md`).
- 문서 200개·500개 가짜 작업 공간으로 끌기를 잰다.
