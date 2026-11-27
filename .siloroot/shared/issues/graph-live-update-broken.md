---
type: issue
status: 해결
created: 2026-11-25
related: [shared/ideas/live-reading-graph.md, shared/ideas/connection-graph-areas.md]
---

# 연결 그래프가 새 문서와 연결을 실시간으로 그리지 않는다

## 겪은 일

연결 그래프를 띄워 둔 채 새 문서를 만들고 연결을 더해도 점과 선이 생기지 않았다. "문서가 바뀌었어요 · 새로 고침" 알림만 떴다. 서버는 변경을 알렸고 `/data`에도 새 문서와 선이 들어 있었다.

## 원인

`applyLiveData` → `viewGraph(carry)`에서 예외가 나고, `graphLiveUpdate`의 `catch`가 이를 삼켜 새로 고침 알림으로 넘어간다.

- 오류: `TypeError: Cannot read properties of undefined (reading 'startsWith')` (`areaOf` ← `landSeeds` ← `areaShapes` ← `viewGraph`)
- 실시간 갱신은 이전 폴더 원을 `LIVE.snapshot()`의 `hulls`로 넘기는데, 여기에 `{ cx, cy, r }`만 담고 폴더 이름 `f`를 빠뜨린다. 새로 생긴 폴더 원(`freeCircle`)에도 `f`가 없다.
- 0.8.1에서 영토(`areaShapes`)가 들어오며 `h.f`로 영토를 가르게 되어, `f` 없는 원에서 터진다. 0.8.0에서는 돌았다.

## 해결

snapshot의 폴더 원, 이어받은 원, 새 폴더 원(`freeCircle`)에 `f`를 넣었다. 브랜치 `fix/graph-live-update`, PR #39로 머지해 0.8.5로 내보냈다(`67d62f3`). 고친 서버에서 새 선이 그어지고, 새 폴더의 새 문서가 원·점·알림과 함께 생기는 것을 확인했다.

## 다시 안 나게

- `catch`가 오류를 콘솔에 남긴다(반영함).
- 실시간 갱신 경로(`viewGraph(carry)`)를 도는 자동 테스트는 아직 없다. 그래프 클라이언트 코드를 시험할 DOM 도구가 없어서다.
