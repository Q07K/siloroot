---
type: issue
status: 열림
created: 2026-11-29
related: [shared/requirements/codex-support.md, shared/issues/codex-support-missing.md]
---

# Codex가 SiloRoot 작업 규칙을 읽지 않음

`shared/requirements/codex-support.md`의 "더 조사할 것 → 초기화와 규칙" 줄이 실제로 터진 건.

## 겪은 일

2026-11-29 Codex 데스크톱(SiloRoot 0.8.11)에서 새 폴더를 SiloRoot로 초기화하고 쓴 두 세션.

- 첫 세션(초기화한 세션): "문서로 정리해줘" → 자리 폴더를 두고 `shared/` 바로 밑에 문서를 만듦
  - 사용자가 지적하자 자리 표에 없는 `shared/runbook/`을 새로 만들어 옮김
  - 속성 `type: guide`도 metadata-guide에 없는 값
- 새 세션: "이거 문서로 ㄱㄱ" → Codex 기본 `documents` 스킬(Word `.docx` 전용)을 불러 폴더 맨 위에 `.docx`를 만듦
  - `.siloroot/CLAUDE.md`를 한 번도 읽지 않음
  - 세션 시작 맥락에 SiloRoot 규칙이 없음(새 작업 공간이라 컨벤션 문서도 없어 컨벤션 훅 출력도 빈 글)

## 원인

확인한 것:

- 규칙 블록을 불러오는 길이 Claude Code에만 있음
  - init은 `CLAUDE.local.md`에 `@.siloroot/CLAUDE.md` 한 줄만 씀
  - Codex는 `AGENTS.override.md`, `AGENTS.md`, `project_doc_fallback_filenames`에 적은 이름만 읽음. 폴더마다 하나만, 프로젝트 맨 위에서 cwd까지
  - Codex 지침 파일에는 `@경로` 같은 불러오기 문법이 없음
- Codex용 SessionStart 훅(`hooks/codex-hooks.json`)은 컨벤션 문서만 넣음. 작업 규칙(자리 표, 흐름 나누기, 마칠 때)은 넣지 않음
- 규칙이 없으니 "문서"라는 말이 `documents` 스킬 설명(Word, `.docx`)에 걸림

추정(아직 확인 안 함):

- 첫 세션은 init 과정에서 규칙을 한 번 읽었지만, 자리 표보다 일반 습관을 따름. 규칙이 맥락에 계속 있지 않고 한 번 읽은 파일이라 약했던 것으로 봄
- 개념 질문("adb가 뭐야")과 사용법 정리는 규칙상 홈 공부 노트 자리인데, Codex는 공유 영역으로 봄

## 해결

- 2026-11-29 사용자가 A+B를 고름. 작업 브랜치 `fix/codex-rules`에서 고침
- A: Codex 세션 시작 훅에 규칙 훅(`scripts/rules.mjs`, `lib/rules.mjs`)을 더함
  - 문서 뿌리의 `CLAUDE.md` 본문을 넣음. 속성과 관리 표시는 떼고, 한 줄짜리 `@경로`는 그 파일 본문으로 펼침(사용자 정보)
  - `additionalContextLimit` 12000. 이 저장소 기준 약 7천 자
  - 16,000자를 넘으면 본문 대신 "규칙 파일을 읽으라"는 안내만
- B: init과 update가 Codex 전역 지침에 관리 블록을 맞춤(`lib/codex.mjs`, `templates/codex/AGENTS.block.md`)
  - Codex 폴더(`CODEX_HOME`, 없으면 `~/.codex`)가 없으면 아무것도 안 만듦
  - `AGENTS.override.md`가 비어 있지 않으면 그 파일에, 아니면 `AGENTS.md`에
  - 작업 공간 밖 파일이라 작업 공간 백업에 담지 않음
- 관리 블록 템플릿 넷(프로젝트·홈, 모양 3·4)에 "문서로 써 줘 = 자리 표에 맞는 마크다운" 한 줄을 더함. 템플릿만 바뀌어 `SCHEMA`는 그대로
- 남은 확인: 실제 Codex 데스크톱에서 플러그인을 올리고 새 훅을 신뢰한 뒤, 새 세션 맥락에 규칙이 들어가고 "문서로 써 줘"가 마크다운 문서로 가는지

고른 길과 견준 것:

| 길 | 하는 일 | 좋은 점 | 걸리는 점 |
| --- | --- | --- | --- |
| A. Codex SessionStart 훅이 규칙 블록을 넣음 | 컨벤션 앞에 `.siloroot/CLAUDE.md` 본문을 넣고 `additionalContextLimit`를 올림 | 플러그인만 올리면 모든 작업 공간에 바로 적용. 파일을 안 고침 | 훅을 신뢰해야 돌아감. 규칙 블록 약 5천 자가 매 세션 맥락을 씀 |
| B. 전역 `~/.codex/AGENTS.md`에 관리 블록 | "`.siloroot/config.json`이 있는 폴더에서는 `.siloroot/CLAUDE.md`를 먼저 읽고 따른다"와 문서 요청 규칙 몇 줄. init/update가 관리 | 훅 신뢰와 상관없이 늘 적용. 팀 파일을 안 건드림 | 개인 설정 파일을 고침. 본문이 아니라 "읽어라"라서 약함 |
| C. 프로젝트 `AGENTS.md`에 규칙 블록 전문 | init이 `CLAUDE.local.md`처럼 씀 | Codex가 가장 확실히 읽는 자리 | 팀이 커밋한 `AGENTS.md`가 있으면 그 파일이 더러워짐. 없을 때만 쓰고 git에서 빼야 함 |

- 어느 길이든 규칙 블록에 "문서로 써 달라 = 자리 표에 맞는 `.siloroot/` 안 마크다운. Word, PDF는 사용자가 형식을 말할 때만" 한 줄을 더함
- A, B는 작업 공간 모양이 안 바뀌어 `SCHEMA`를 올리지 않음. C는 init이 새 파일을 관리하게 되므로 `/siloroot:update` 맞추기 대상에 넣음

## 다시 안 나게

- Codex 쪽 테스트: 새로 초기화한 작업 공간에서 Codex 세션 시작 맥락에 규칙 블록(또는 그 안내)이 들어가는지 확인
- Codex 지원을 늘릴 때 훅만 보지 말고 "규칙이 맥락에 들어가는가"를 첫 확인 항목으로 둠
