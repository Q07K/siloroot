---
type: requirement
status: 완료
created: 2026-11-26
related: [shared/ideas/home-graph-projects.md, shared/ideas/cross-workspace-jump.md, shared/design/home-graph-and-workspace-jump.md, shared/plans/home-graph-and-workspace-jump.md, shared/roadmap.md]
---

# 홈 그래프 영토와 작업 공간 오가기

## 문제

- 홈 뷰어 연결 그래프가 프로젝트용 코드를 그대로 써서 홈 폴더가 회색 "other"로, 홈 맨 위 문서가 `private / .siloroot`로 잘못 보임
- 다른 작업 공간 문서를 보려면 점을 눌러 새 탭으로 그 뷰어를 열어야 함

## 목표와 비목표

- 목표: 홈 그래프를 홈 영토와 프로젝트별 영토로 그림. 두 그래프 모두 다른 작업 공간 영토 제목은 그 뷰어로, 그 문서 점은 옆 패널로 엶
- 비목표: 옆 패널에서 고치기와 댓글, 내 영토 제목 동작, 여러 작업 공간을 한 그래프에 합치기
- 성공 기준: 프로젝트 그래프 모양이 그대로이고, 범례 끄기(0.8.4)와 실시간 반영(0.8.5)이 그대로 동작함

## 거쳐 온 길

| 종류 | 문서 |
| --- | --- |
| 아이디어 | `shared/ideas/home-graph-projects.md`, `shared/ideas/cross-workspace-jump.md` |
| 컨벤션 | `shared/conventions/web-mockup-real-screen.md` |
| 설계 | `shared/design/home-graph-and-workspace-jump.md` |
| 구현 계획 | `shared/plans/home-graph-and-workspace-jump.md` |

## 결과

- 2026-11-26 PR #40으로 `main`에 머지하고, PR #41로 0.8.6에 담아 내보냄
- 바뀐 것
  - 홈 뷰어 그래프: 홈 영토 하나와 프로젝트별 영토(A′). 홈 맨 위 문서는 원 없이 점으로
  - 두 뷰어 모두: 다른 작업 공간 영토 제목 → 그 뷰어, 그 점 → 너비를 바꾸는 옆 패널
  - 빌드가 바깥 문서 본문(`extTexts`)을 실음. 바깥 연결만 바뀌어도 실시간 반영
- 확인: `npm test` 259 통과, 원래 있던 포트 테스트 1 실패. 프로젝트 그래프는 0.8.5와 같은 해시
- 남긴 작은 것 8가지는 PR 본문 "남겨 둔 작은 것"에 있음
