---
type: requirement
status: 진행 중
created: 2026-11-26
related: [shared/decisions/unify-doc-view.md, shared/ideas/own-node-side-panel.md, shared/roadmap.md, shared/conventions/viewer-responsive.md, shared/design/narrow-doc-view.md, shared/plans/narrow-doc-view.md]
---

# 한 문서 뷰: 문서 화면과 옆 패널 통일, 문서 뷰 디자인 개선

## 문제

- 뷰어가 같은 문서를 문서 화면과 연결 그래프 옆 패널에서 따로 그림
- 내 노드는 작은 정보 상자, 바깥 노드는 옆 패널로 열려 보는 법이 둘
- 패널을 고치면 문서 화면은 그대로이고, 문서 화면을 고치면 패널은 그대로임

## 목표와 비목표

- 목표
  - 문서 뷰 구현을 하나로 함. 문서 화면과 옆 패널이 같은 뷰를 부름
  - 연결 그래프에서 노드를 누르면 그 문서 뷰가 옆 패널로 열림(내 노드, 바깥 노드 모두)
  - 그다음 문서 뷰 디자인을 개선함. 개선은 두 곳에 함께 보임
  - 분할 화면(2~4분할, 여러 모니터 비율)에서도 문서 뷰와 패널을 쓸 수 있음(사용자, 2026-11-26): `shared/conventions/viewer-responsive.md`
- 비목표: 정하지 않음(설계에서 정함)
- 성공 기준: 문서 뷰 구현이 한 곳. 문서 화면을 고치면 패널도 같이 바뀜

## 거쳐 온 길

| 종류 | 문서 |
| --- | --- |
| 아이디어 | `shared/ideas/own-node-side-panel.md` |
| 결정 | `shared/decisions/unify-doc-view.md` |
| 설계 | `shared/design/unified-doc-view.md`, `shared/design/narrow-doc-view.md`(2단계: 좁은 문서 뷰) |
| 구현 계획 | `shared/plans/unified-doc-view.md`, `shared/plans/narrow-doc-view.md`(2단계: 좁은 문서 뷰) |
| 이슈 | |

## 결과

- 1단계(통일): `main`에 머지(PR #43, 2026-11-26). 노드를 누르면 옆 패널에 문서 뷰, 정보 상자 없앰, 분할 화면에 맞춘 패널 자리, 흔적 상자 단추 아래, 패널에서 편집과 댓글. 0.8.7로 내보냄(PR #44)
- 2단계(문서 뷰 디자인 개선): 첫 항목 좁은 문서 뷰(오른쪽 칸을 위 단추 줄로 접기) `main`에 머지(PR #48, 2026-11-27). 0.8.9로 내보냄(PR #49)
