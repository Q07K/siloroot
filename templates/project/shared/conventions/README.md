---
type: index
status: 사용 중
created: {{date}}
related: [metadata-guide.md]
---

# 컨벤션

팀이 따르는 약속과 정책. 약속 하나에 문서 하나. 용어집은 이 폴더의 glossary.md 한 장이다.

세션을 시작할 때 SiloRoot 훅이 이 폴더 문서의 본문을 AI 맥락에 넣는다. 이 안내 문서와 `폐기`, `바뀜` 상태의 문서는 넣지 않는다. 모두 합쳐 9,000자를 넘으면 본문 대신 목록을 넣는다.

## 여기에 넣는 것

- 코드 스타일, 브랜치, 리뷰, 커밋 규칙 같은 약속
- 이 프로젝트에서 쓰는 말의 뜻 → `glossary.md`

## 여기에 넣지 않는 것

- 그 약속을 정한 까닭 → `shared/decisions/`

## 파일 이름과 상태

- 파일: `영문-약속.md`, 용어집은 `glossary.md`
- `type: convention`, `status`: 제안, 사용 중, 바뀜, 폐기
