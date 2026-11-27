---
type: decision
status: 확정
created: 2026-11-26
related: [shared/ideas/own-node-side-panel.md, shared/requirements/unified-doc-view.md, shared/conventions/reuse-existing-implementation.md]
---

# 문서 화면과 옆 패널을 한 문서 뷰로 통일한다

## 맥락

- 0.8.6 연결 그래프는 노드를 누르면 정보 상자(내 노드)나 옆 패널(바깥 노드)을 띄움
- 문서 화면(`viewDoc`)과 옆 패널(`openXPanel`)이 문서 본문, 속성, 연결을 따로 그림
- 내 노드도 옆 패널로 열자는 시안(`shared/ideas/own-node-side-panel.md`)을 A~E로 다듬던 중, 패널 모양을 하나 더 따로 만들고 있었음

## 정한 것 (사용자, 2026-11-26)

- 문서를 보여 주는 뷰를 하나로 통일함
- 문서 화면에서 보는 뷰가 그대로 옆 패널에도 보임
- 그다음 그 문서 뷰의 디자인을 개선함. 패널과 문서 화면을 따로 다듬지 않음
- 사용자: "이거 별개로 따로 관리할 문제가 아닌듯"

## 버린 것

- 옆 패널 전용 모양을 따로 다듬기(시안 A~E의 패널 머리, 탭)
  - 패널과 문서 화면이 따로 바뀌고, 한쪽만 고쳐지는 일이 생김

## 근거

- 같은 문서를 두 곳에서 보이는데 구현이 둘이면 고칠 곳도 둘이 됨
- 이 결정과 함께 컨벤션을 더함: `shared/conventions/reuse-existing-implementation.md`

## 반영

- 코드: 1단계(통일) `main`에 머지(PR #43, 2026-11-26). 문서 화면과 옆 패널이 `renderDocView` 하나로 그림. 0.8.7로 내보냄(PR #44, 2026-11-26)
- 2단계(문서 뷰 디자인 개선): 첫 항목 좁은 문서 뷰 `main`에 머지(PR #48, 2026-11-27). 0.8.9로 내보냄(PR #49). 문서 화면과 패널이 같은 함수, 같은 기준(그릇 너비)으로 바뀜
- 문서: 요구사항 `shared/requirements/unified-doc-view.md`, 로드맵 "지금"
