---
type: decision
status: 확정
created: 2026-11-25
related: [shared/ideas/doc-slots.md, shared/conventions/glossary.md]
---

# 용어집은 컨벤션 안의 문서 하나로

## 맥락

이 프로젝트에는 용어집 자리가 없어서, 연결 그래프 용어 표가 설계 폴더(`shared/design/connection-graph-terms.md`)에 들어갔다. 용어집 폴더를 따로 만들면 노드가 하나뿐이다.

## 정한 것 (사용자, 2026-11-25)

- 용어집은 따로 폴더를 두지 않고 `shared/conventions/glossary.md` 하나로 둔다. 용어도 팀이 따르는 약속이다.

## 버린 것

- 용어집 폴더: 문서가 하나뿐이라 그래프에 노드 하나짜리 클러스터가 생긴다.

## 따라오는 일

- `shared/design/connection-graph-terms.md`의 용어 표를 `shared/conventions/glossary.md`로 옮기고, 원래 자리에는 경로를 남긴다.

## 반영

- 이 작업 공간: 용어 표를 `shared/conventions/glossary.md`로 옮겼다(2026-11-25). 옛 파일은 지웠고, 옮긴 사실은 용어집 맨 위에 적었다
- 플러그인: 플러그인 PR #30(2026-11-25 머지, 0.8.0으로 내보냄). 관리 블록 자리 표와 컨벤션 README가 용어집을 가리킨다
