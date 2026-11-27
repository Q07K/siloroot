---
type: idea
status: 완료
created: 2026-11-26
related: [shared/ideas/home-workspace.md, shared/ideas/connection-graph-areas.md, shared/ideas/cross-workspace-jump.md, shared/conventions/web-mockup-real-screen.md, shared/design/home-graph-and-workspace-jump.md, shared/requirements/home-graph-and-workspace-jump.md]
---

# 홈 그래프: 홈 영토와 프로젝트 영토

홈 뷰어 연결 그래프를 고치자는 사용자 요청(2026-11-26)에서 나옴. 프로젝트 그래프의 영토 모양을 홈 뷰어에도 맞춘다.

## 지금 문제

- 홈 폴더(study, ideas, feedback, worklog)가 영토 없이 회색 클러스터로, 범례에 "other"로 나옴
- 홈 맨 위 문서 5개(`CLAUDE.md`, `profile.md` 등)가 자물쇠 달린 `private` 영토의 `.siloroot` 클러스터로 나옴
  - 원인: 맨 위 묶음을 늘 `.siloroot`라 부르고 `private` 영토에 넣는 코드가 프로젝트만 생각하고 짜임
- 프로젝트 문서가 `siloroot/shared`, `siloroot/private` 회색 클러스터로 나오고, 이름표가 늘 켜져 겹침

## 견준 안

시안은 실제 홈 데이터와 예시 프로젝트 하나로 띄움.

| 안 | 모습 | 결과 |
| --- | --- | --- |
| A | 프로젝트마다 회색 클러스터 하나, 안에 문서 점 | A′로 바꿈 |
| A′ | 프로젝트마다 영토 하나(폴더 아이콘과 이름), 안에 문서 점만 | **고름** |
| B | 프로젝트 영토 안에 shared, private를 점 하나씩 | 어느 문서인지 안 보임 |
| C | 프로젝트 하나가 점 하나 | 가장 단순하나 어느 문서인지 안 보임 |
| D | 프로젝트 영토 안에 shared, private 클러스터와 문서 점 | 홈 그래프가 무거워짐 |

- A와 A′ 비교: 그래프에서 클러스터는 폴더, 영토는 영역을 뜻함. 프로젝트 그래프가 홈을 영토로 그리므로 홈 그래프도 프로젝트를 영토로 그리면 두 화면이 맞물림
- 고른 시안: `shared/ideas/home-graph-projects-mockup.jpg`

## 정한 것

| 정한 것 | 날짜 |
| --- | --- |
| 홈 폴더와 맨 위 문서를 초록 홈 영토 하나로 묶음. `private` 영토와 `.siloroot` 이름은 홈에서 쓰지 않음 | 2026-11-26 |
| 홈 맨 위 문서는 클러스터 없이 홈 영토 안에 점으로 둠(프로젝트 그래프의 `shared`, `private` 바로 밑 문서와 같은 방식) | 2026-11-26 |
| 프로젝트는 A′: 프로젝트마다 영토 하나, 안에 클러스터 없이 문서 점만. shared, private 구분은 그리지 않음 | 2026-11-26 |
| 프로젝트 문서 이름표는 늘 켜지 않고, 다른 점처럼 확대해야 보임 | 2026-11-26 |

## 만들 때 볼 것

- 프로젝트 영토가 문서 수에 비해 넓어 홈보다 눈에 띔. 영토 여백을 줄여 홈이 주인공으로 남게 함
- 홈 맨 위 문서 점이 클러스터 원 가장자리에 붙어 다른 폴더 문서처럼 읽힘. 원에서 조금 떨어뜨림
- 범례가 study 클러스터를 덮음. 지금 뷰어에도 있는 문제라 함께 봄
- 프로젝트 그래프(4180) 모양은 바뀌지 않아야 함
