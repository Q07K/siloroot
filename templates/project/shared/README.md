---
type: index
status: 사용 중
created: {{date}}
related: [metadata-guide.md]
---

# 공유 영역

팀과 나눌 수 있는 문서를 둔다. 이 폴더만 바깥 코드 저장소의 git에 보인다. 올릴지는 사용자가 커밋할 때 고른다.

| 폴더 | 무엇이 있나 |
| --- | --- |
| `shared/issues/` | 겪은 문제와 원인, 해결 (`issue`) |
| `shared/ideas/` | 이 프로젝트에서 만들 것 (`idea`) |
| `shared/decisions/` | 따로 남길 결정 (`decision`) |
| `shared/design/` | 설계 문서 (`design`) |
| `shared/roadmap/` | 만드는 순서와 계획 (`roadmap`) |
| `shared/conventions/` | 팀이 따르는 약속과 정책 (`convention`) |

- 여기 문서는 팀원이 볼 수 없는 문서(`private/`, `home:`)를 가리키지 않는다. 뷰어의 속성 점검이 경고한다.
- 팀원이 이 저장소를 받아 `/siloroot:init`을 하면 이 폴더를 그대로 쓰고 나머지를 자기 것으로 만든다.
