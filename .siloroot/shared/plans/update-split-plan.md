---
type: plan
status: 완료
created: 2026-11-25
related: [shared/design/update-split-design.md]
---

# 업데이트 나누기 구현 계획 (0.8.2)

설계 `shared/design/update-split-design.md`. 브랜치 `feat/update-split`.

1. 서버 바꾸기(`ensureServer` 등)를 `lib/servers.mjs`로 뺀다. `viewer/autostart.mjs`가 그것을 쓴다. 회귀 확인은 기존 훅 테스트.
2. `scripts/update.mjs`에 가벼운 길을 더한다: `--versions`(설치 목록과 마켓플레이스 JSON에서 이 프로젝트의 설치 버전과 최신 버전), `--refresh-plan`/`--refresh`(마이그레이션 없이 맞추기, hold를 적지 않음, 백업은 함), `--servers`(이 스크립트 버전으로 프로젝트와 홈 서버 바꾸기), `--changes <옛 버전>`(CHANGELOG 항목).
3. 홈 맞추기는 홈의 `plugin`이 이 플러그인보다 새것이면 건너뛴다.
4. 세션 시작 알림: `updateNotice`는 순수하게 두고 `notify.mjs`가 조용히 `plugin`을 올린다. 옮길 모양은 `/siloroot:migrate`를 가리킨다.
5. 스킬: `skills/update/SKILL.md` 다시 쓰기, `skills/migrate/SKILL.md` 새로. 002 뒤처리 단계는 002 계획의 `after`로 옮긴다. init 경고와 스킬의 `/siloroot:update`(옮기기)는 migrate로.
6. `CHANGELOG.md`(0.8.0, 0.8.1), 저장소 `CLAUDE.md` 한 줄, README 두 벌.
7. 테스트, `npm test`, `claude plugin validate .`, PR.
