---
type: convention
status: 사용 중
created: 2026-11-25
related: [shared/ideas/connection-graph-areas.md, shared/ideas/live-reading-graph.md, shared/ideas/home-workspace.md, shared/decisions/glossary-in-conventions.md]
---

# 용어집

이 프로젝트에서 쓰는 말의 뜻. 2026-11-25에 설계 폴더의 `shared/design/connection-graph-terms.md`에서 옮겼다(`shared/decisions/glossary-in-conventions.md`).

## 연결 그래프

뷰어 "연결" 화면을 이야기할 때 쓰는 말이다. 영토 묶음 시안(9안, `shared/ideas/connection-graph-areas.md`)을 다듬다가 사용자가 "용어를 익숙해지게 잡아 보자"고 해서 정했다(2026-11-25).

### 용어

| 화면에서 | 부르는 말 | 실제로는 |
| --- | --- | --- |
| 점 | 노드 | 문서 하나 |
| 노드를 감싼 점선 원 | 클러스터 | 폴더 하나(`shared/ideas` 등) |
| 클러스터들을 덮는 색 땅 | 영토 | shared, private, home |
| 노드 사이를 잇는 줄 | 선 | 문서 사이 관계(마크다운 링크, `related`, 경로 글자) |
| 여러 선이 나란히 모여 흐르는 띠 | 다발 | 같은 클러스터나 같은 영토 사이를 오가는 선들 |
| 선이 영토를 드나드는 자리 | 문 | 영토 경계에서 다발이 모이고 갈라지는 곳 |
| 번호 붙은 굵은 길 | 흔적 | Claude가 이번 답에서 읽고 고친 차례(`shared/ideas/live-reading-graph.md`) |

## 덧붙임

- home은 프로젝트의 상위 폴더가 아니다. 프로젝트 밖에 있는 다른 작업 공간(사람마다 하나인 홈)이다. 그래프에서는 shared, private와 똑같이 영토 하나로 다룬다(`shared/ideas/home-workspace.md`).
- 영역 바로 밑 문서(`shared/README.md` 같은 안내)는 클러스터를 만들지 않고 노드 하나로 자기 영토 안에 둔다.
- 코드에서는 클러스터를 `hull`(폴더 원), 영토를 `area`, 다발을 `bundle`·`trunk`, 문을 `gate`로 부른다.
