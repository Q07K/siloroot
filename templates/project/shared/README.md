---
type: index
status: 사용 중
created: {{date}}
related: [metadata-guide.md]
---

# 공유 영역

팀과 나눌 수 있는 문서를 둔다. 이 폴더만 바깥 코드 저장소의 git에 보인다. 올릴지는 사용자가 커밋할 때 고른다.

| 자리 | 무엇이 있나 |
| --- | --- |
| `shared/roadmap.md` | 만들기로 정한 것의 한 장: 지금, 다음, 나중 (`roadmap`) |
| `shared/architecture.md` | 지금 구조 한 장 (`architecture`) |
| `shared/requirements/` | 기능 하나의 요구사항: 문제, 목표, 거쳐 온 길, 결과 (`requirement`) |
| `shared/ideas/` | 이 프로젝트에서 만들 것 (`idea`) |
| `shared/decisions/` | 결정 하나와 반영 상태 (`decision`) |
| `shared/design/` | 기능을 어떻게 만들지 (`design`) |
| `shared/plans/` | 기능 하나의 구현 단계 (`plan`) |
| `shared/issues/` | 겪은 문제와 원인, 해결 (`issue`) |
| `shared/conventions/` | 팀이 따르는 약속과 정책, 용어집(`glossary.md`) (`convention`) |

- 자리 폴더마다 `README.md`가 있다. 무엇을 넣고 무엇을 넣지 않는지는 거기에 있다.
- 운영할 것(배포, 장애 대응)이 생기면 `shared/runbook/`을 더한다.
- 여기 문서는 팀원이 볼 수 없는 문서(개인 영역과 홈의 문서)를 가리키지 않는다. 뷰어의 속성 점검이 경고한다.
- 팀원이 이 저장소를 받아 `/siloroot:init`을 하면 이 폴더를 그대로 쓰고 나머지를 자기 것으로 만든다.
