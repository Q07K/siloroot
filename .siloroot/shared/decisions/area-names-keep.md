---
type: decision
status: 확정
created: 2026-11-25
related: [shared/ideas/doc-slots.md, shared/ideas/shared-private-areas.md]
---

# shared, private 이름은 그대로, 아이콘으로 뜻을 보인다

## 맥락

혼자 쓰는 사람에게 `shared`가 어디 공개되는 것처럼 읽힌다. 실제 기준은 git에 올라가느냐다. 후보로 repo / local, docs / desk가 나왔다. 폴더 이름을 바꾸면 템플릿, 스킬, README 두 벌, 홈 노트의 `siloroot:shared/...` 경로까지 모두 바꾸는 마이그레이션이 필요하다.

## 정한 것 (사용자, 2026-11-25)

- 폴더 이름은 그대로 둔다.
- 뜻은 그래프 아이콘과 설명으로 보인다. 공유는 열린 자물쇠, 개인은 잠긴 자물쇠다. 사람 둘은 "남에게 공개"로, git 가지는 "버전 관리"로 읽히고 git을 안 쓰는 프로젝트에 맞지 않아서 뺐다.

## 반영

- 뷰어 시안(브랜치 `feat/graph-areas`, 커밋 전): 반영됨. 마우스를 올리면 "공유 · 잠그지 않은 문서 · 프로젝트를 받는 사람도 봄"(설명 문구는 AI가 정함).
- 정식 코드와 README: 아직.

## 버린 것

- repo, local: 뜻은 분명하지만 옮기는 비용이 크다.
- docs, desk: git 기준이 이름에 드러나지 않는다.
