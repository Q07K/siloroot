---
type: issue
status: 열림
created: 2026-11-27
related: [shared/ideas/existing-project-adoption.md]
---

# git 저장소 하위 폴더를 작업 공간으로 쓰면 개인 영역이 git에 보인다

## 겪은 일

- 다른 세션이 회사 저장소의 하위 폴더에 init해도 되는지 검토하다 찾음
- 작업 공간이 git 맨 위 폴더가 아니면 `.siloroot/private/` 같은 개인 문서가 `git status`에 그대로 뜸
- 그대로 두면 작업 일지와 메모가 커밋 대상에 섞임

## 재현 (AI, 2026-11-27)

- 빈 저장소에 `sub/proj/.siloroot/private/a.md`, `sub/proj/.siloroot/shared/b.md`를 만듦
- `.git/info/exclude`에 `.siloroot/*`, `!.siloroot/shared/`를 넣음
- `git status --porcelain -uall` 결과: 두 파일 모두 `??`로 보임

## 원인

- 제외 줄(`lib/workspace-sync.mjs` `EXCLUDE_LINES_V3`)이 `.siloroot/*`
- gitignore 규칙에서 가운데에 `/`가 있는 패턴은 그 목록이 있는 곳 기준으로 고정됨
- `.git/info/exclude`의 기준은 저장소 맨 위라서, 하위 폴더의 `.siloroot/`에는 걸리지 않음
- 예전 줄 `.siloroot/`(끝에만 `/`)는 어느 깊이에서나 걸렸음. 모양 3에서 `shared/`만 보이게 바꾸며 생김

## 해결

아직 없음. 생각한 방법:

- 작업 공간이 git 맨 위가 아니면 저장소 기준 경로를 앞에 붙임
  - 예: `/sub/proj/.siloroot/*`, `!/sub/proj/.siloroot/shared/`
- init과 맞추기(`/siloroot:update`) 둘 다 고쳐야 이미 설치한 곳도 바로잡힘
- `CLAUDE.local.md`, `.ignore` 줄도 같은 문제가 있는지 함께 봄

## 다시 안 나게

- 하위 폴더 작업 공간을 테스트에 넣음
