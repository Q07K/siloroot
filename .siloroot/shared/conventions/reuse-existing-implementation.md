---
type: convention
status: 사용 중
created: 2026-11-26
related: [shared/conventions/README.md, shared/decisions/unify-doc-view.md, shared/conventions/web-mockup-real-screen.md]
---

# 새로 만들기 전에 기존 구현을 쓴다

연결 그래프 옆 패널을 다듬던 중(2026-11-26), 문서 화면과 옆 패널이 문서를 따로 그리고 있는 것을 보고 사용자가 정함.

## 약속

- 기능, 화면, 스크립트를 만들거나 고치기 전에 같은 일을 하는 구현이 이미 있는지 먼저 찾음
- 있으면 그 구현을 그대로 쓰거나 넓혀서 씀. 비슷한 것을 따로 새로 만들지 않음
- 같은 것을 여러 곳에서 보여야 하면 한 구현을 여러 곳에서 부름. 한 번 고치면 모든 곳이 함께 바뀜
- 기존 구현으로 안 되는 까닭이 있으면 새로 만들기 전에 사용자에게 말하고 정함
- 시안도 같음: 기존 화면 코드를 복사해 고침(`shared/conventions/web-mockup-real-screen.md`)

## 뷰어에서 먼저 볼 것

| 하는 일 | 지금 구현 |
| --- | --- |
| 문서 뷰 그리기(문서 화면, 옆 패널) | `renderDocView`, `md()` (`viewer/template.html`) |
| 노드를 눌렀을 때 | 옆 패널 `openDocPanel`(한 문서 뷰 이후, 정보 상자는 없앰) |
| 알림 | `toast` |
| 다른 작업 공간 열기 | `openExternal` |

- 이 표는 예시. 일하기 전에 코드에서 다시 찾음

## 예

- 옆 패널이 문서 본문을 따로 그리던 것 → 문서 화면 하나를 패널에서도 그대로 보이게 통일: `shared/decisions/unify-doc-view.md`
