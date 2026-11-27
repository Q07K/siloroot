---
type: idea
status: 보류
created: 2026-11-25
related: [shared/ideas/doc-slots.md, shared/ideas/doc-versioning.md, shared/ideas/project-bootstrap.md]
---

# 뷰어의 구조 탭

`shared/ideas/doc-slots.md`에서 시스템 개요(`shared/architecture.md`, 프로젝트가 지금 어떤 부품으로 되어 있고 어떻게 이어지나를 보이는 한 장)를 이야기하다 나왔다. 사용자: "이걸 오히려 SiloRoot의 탭에서 보이는 뷰로 만들어야 하는 거 아냐? 그리고 이것도 버전 관리해서 보이는 걸로?"

## 생각 (AI 제안)

시스템 개요에는 코드에서 저절로 알 수 있는 것과 사람이 적어야 하는 것이 섞여 있다.

| 내용 | 어디서 오나 |
| --- | --- |
| 폴더와 파일, 무엇이 무엇을 부르나(import) | 코드에서 저절로. 늘 지금 상태라 낡지 않는다 |
| 부품마다 하는 일, 흐름(훅 → 스크립트 → 뷰어), 고칠 때 함께 볼 곳 | 사람(또는 AI)이 `shared/architecture.md`에 적는다 |

- 뷰어에 "구조" 탭을 둔다. 왼쪽은 코드에서 만든 지도, 오른쪽(또는 지도 위)은 `architecture.md`의 설명.
- 지도에 있는데 설명에 없는 부품, 설명에 있는데 코드에서 사라진 부품을 표시한다. 문서가 낡았다는 것이 바로 보인다.
- 버전: `shared/ideas/doc-versioning.md`에서 정한 방식(최신본은 같은 경로, 지난 버전은 옆 폴더, 뷰어에서 버전을 바꿔 보고 비교)을 그대로 쓴다. 따로 장치를 만들지 않는다.

## 아직 안 정한 것

- 코드 지도를 어느 언어까지 만들지(JavaScript, TypeScript, Python의 import만 볼지, 폴더 나무만 그릴지).
- 구조 탭이 연결 그래프(문서끼리)와 어떻게 다른 모양이어야 하는지.

## 보류 (사용자, 2026-11-25)

시안 넷(부품 목록, 지도, 흐름, 문서)을 만들다가 사용자가 "고도화되기 전까지 그냥 문서만 두고 패스하자"고 했다. 지금은 `shared/architecture.md` 문서만 둔다. 만들기로는 했으니 로드맵이 생기면 "나중" 칸에 올린다.

## 이어진 아이디어 (2026-11-26)

- 기존 코드에서 시스템 개요 문서를 채우는 일은 `shared/ideas/project-bootstrap.md`. 이 문서는 뷰어 탭을 그리는 쪽
