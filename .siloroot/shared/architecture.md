---
type: architecture
status: 사용 중
created: 2026-11-25
related: [shared/roadmap.md, shared/conventions/glossary.md]
---

# 시스템 개요

SiloRoot 플러그인이 어떤 부품으로 되어 있고 서로 어떻게 이어지나. 2026-11-25, 플러그인 PR #30(모양 4) 기준이다. 구조가 바뀌면 이 문서도 같이 고친다. 부르는 관계는 코드의 import와 훅 설정에서 확인했다.

## 부품

| 부품 | 하는 일 |
| --- | --- |
| `hooks/hooks.json` | Claude Code가 세션 시작, 메시지, 도구 사용, 응답 끝 때 부르는 훅 목록 |
| `skills/` | 사용자가 부르는 명령: init, note, verify, feedback, update(가벼운 업데이트), migrate(모양 옮기기와 되돌리기) |
| `scripts/` | 훅과 스킬이 실행하는 파일: 초기화(`init.mjs`), 업데이트(`update.mjs`), 흔적(`trail.mjs`), 사용 기록(`metrics-turn.mjs`, `metrics.mjs`) |
| `viewer/` | 뷰어: 문서를 읽어 데이터와 화면을 만들고(`build.mjs`, `template.html`), 이 PC 안에서 보여 주고(`serve.mjs`, `autostart.mjs`), 할 일을 알린다(`notify.mjs`) |
| `lib/` | 여럿이 같이 쓰는 기능: 설정과 모양 번호(`config.mjs`), 자리표(`layout.mjs`), 속성 값(`vocab.mjs`), 문서 연결(`links.mjs`), 맞추기(`workspace-sync.mjs`), 흔적(`trail.mjs`), 사용 기록(`metrics.mjs`, `transcript.mjs`, `pricing.mjs`), 사용자 설정(`user.mjs`), 백업(`backup.mjs`) |
| `lib/migrations/` | 작업 공간 모양을 한 칸씩 올리는 마이그레이션(001, 002, 003) |
| `templates/` | 작업 공간에 넣는 관리 블록과 안내 문서. `project/`, `home/`은 모양 4, `v3/`은 모양 3, 맨 위는 모양 1·2 |
| `test/` | `node --test` 테스트 |

## 흐름

- 세션 시작: `hooks/hooks.json` → `viewer/autostart.mjs` → `viewer/serve.mjs`(뷰어 서버)
- 할 일과 업데이트 알림: `hooks/hooks.json` → `viewer/notify.mjs` → `lib/update-check.mjs`
- 문서 읽고 고치기(흔적): `hooks/hooks.json` → `scripts/trail.mjs` → `lib/trail.mjs` → `viewer/serve.mjs`가 그래프로 보냄
- 턴 기록: `hooks/hooks.json` → `scripts/metrics-turn.mjs` → `lib/transcript.mjs`, `lib/metrics.mjs`
- 초기화: `skills/init/SKILL.md` → `scripts/init.mjs` → `lib/workspace-sync.mjs`(템플릿 맞추기)
- 업데이트: `skills/update/SKILL.md` → `claude plugin` 명령(스킬이 Bash로) → `scripts/update.mjs --versions, --refresh, --servers, --changes` → `lib/workspace-sync.mjs`(맞추기), `lib/servers.mjs`(뷰어 서버 바꾸기), `CHANGELOG.md`(바뀐 것)
- 옮기기: `skills/migrate/SKILL.md` → `scripts/update.mjs --plan, --apply, --restore` → `lib/migrations/index.mjs`(마이그레이션) → `lib/workspace-sync.mjs`, 바꾸기 전에 `lib/backup.mjs`
- 뷰어 서버 버전: `viewer/autostart.mjs`(세션 시작)와 `scripts/update.mjs --servers`가 `lib/servers.mjs`를 같이 쓴다
- 뷰어 만들기: `viewer/build.mjs` → `lib/layout.mjs`, `lib/links.mjs` → `viewer/template.html`

## 고칠 때

- 폴더 배치, 문서 위치, 속성 값을 바꾸면: `lib/config.mjs`의 `SCHEMA`, `lib/layout.mjs`, `lib/vocab.mjs`, `lib/migrations/`의 새 마이그레이션과 테스트, `templates/`(옛 모양 템플릿은 `templates/v3/`처럼 남긴다), README 두 벌
- 관리 블록이나 안내 문서만 바꾸면: `templates/`. `SCHEMA`는 그대로이고 맞추기가 맡는다
- 화면을 바꾸면: `viewer/template.html`. 새 데이터가 필요하면 `viewer/build.mjs`도
- 훅을 더하면: `hooks/hooks.json`과 `scripts/`
