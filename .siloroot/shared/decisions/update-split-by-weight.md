---
type: decision
status: 확정
created: 2026-11-25
related: [shared/ideas/update-migration.md, shared/design/update-split-design.md, shared/decisions/version-minor-on-schema.md]
---

# 업데이트 스킬을 가벼운 update와 무거운 migrate로 나눈다

## 맥락

`/siloroot:update` 하나가 마이그레이션(고를 것, 갈 곳 승인, 홈 옮기기, 002 전용 단계), 관리 블록 맞추기, 백업과 되돌리기를 모두 맡아 103줄이 됐다. 사용자는 "업데이트가 포함하는 범위가 너무 크다"고 했다. 여기에 플러그인 올리기와 서버 바꾸기까지 넣으려고 하면서, 플러그인 올리기를 따로 떼어 낼지 물었다.

## 정한 것 (사용자, 2026-11-25)

부품(플러그인 / 작업 공간)이 아니라 무게(자주, 가벼움 / 드묾, 무거움)로 나눈다.

| 스킬 | 언제 | 하는 일 |
| --- | --- | --- |
| `/siloroot:update` | 버전이 오를 때마다 | 새 플러그인 받기, 뷰어 서버 바꾸기, 관리 블록 맞추기, 이번 버전에 무엇이 바뀌었나 보이기 |
| `/siloroot:migrate` | 작업 공간 모양이 바뀔 때만 | 마이그레이션, 고를 것과 갈 곳 승인, 홈 옮기기, 백업과 되돌리기 |

옮길 모양이 있으면 update가 알리고 migrate로 넘긴다.

## 버린 것

- update 하나에 다 넣기: 자주 하는 패치 업데이트에서도 마이그레이션 절차를 매번 읽는다.
- 플러그인 올리기만 따로 떼기(`plugin-update`): 올린 뒤 관리 블록 맞추기가 늘 뒤따라서, 사용자가 다시 명령 둘을 돌린다.

## 근거

- 새 버전 규칙에서 마이그레이션은 부 버전에만 생긴다(`shared/decisions/version-minor-on-schema.md`). 패치는 잦고 가볍다.
- 0.8.0, 0.8.1 업데이트는 둘 다 설정의 버전 번호만 바꿨다(작업 일지 2026-11-25).

## 반영

- 코드: PR #35 머지(`db47aaf`), 내보내기 전(`main`). 설계 `shared/design/update-split-design.md`
- 문서: 저장소 `CLAUDE.md`, README 두 벌, `CHANGELOG.md`(같은 PR)
