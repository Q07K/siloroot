---
type: decision
status: 확정
created: 2026-11-25
related: [shared/ideas/doc-slots.md, shared/conventions/glossary.md]
---

# 자리 폴더마다 README, 빈 폴더도 그래프에

## 맥락

`shared/issues/`, `shared/conventions/`, `shared/decisions/`, private/sources/는 폴더만 있고 문서가 0개였다. 템플릿은 `shared/README.md`와 private/README.md만 만들고 자리 폴더마다 README를 두지 않는다. 연결 그래프는 문서에서 클러스터를 만들어서 빈 폴더는 그려지지 않는다. 사용자는 그 자리가 있는 줄 몰랐다.

## 정한 것 (사용자, 2026-11-25)

- 자리 폴더마다 README를 둔다. 무엇을 넣는지, 파일 이름은 어떻게 짓는지, 쓰는 틀을 적는다. 사람과 AI 모두 그 자리를 안다.
- 연결 그래프는 문서가 0개인 자리 폴더도 빈 클러스터(흐린 원과 `issues 0` 같은 이름)로 그린다. 비어 있다는 것 자체가 보인다.

## 따라오는 일

- 템플릿에 자리 폴더 README를 더한다. 안내 문서 템플릿만 바뀌므로 `SCHEMA`는 그대로이고 `/siloroot:update`의 맞추기가 빠진 파일을 더한다.
- 뷰어가 빈 자리 폴더를 클러스터로 그린다.

## 반영

- 플러그인: 플러그인 PR #30(2026-11-25 머지, 0.8.0으로 내보냄). 자리 README 템플릿, 그래프 빈 자리(README만 있으면 흐린 원, 점이 없으면 빈 점선 원)
- 이 작업 공간: 자리 README를 맞추기로 만들었다(2026-11-25). 그래프의 빈 자리 표시는 플러그인을 올린 뒤 보인다
