---
type: requirement
status: 진행 중
created: 2026-11-27
related: [shared/ideas/conventions-on-session-start.md, shared/conventions/README.md, shared/roadmap.md]
---

# 세션을 시작할 때 컨벤션을 맥락에 넣기

## 문제

- 컨벤션 README에 "일을 시작하기 전에 이 폴더의 문서를 모두 읽는다"고 적어도 AI가 일부만 읽고 시작함
- 2026-11-26, 2026-11-27 두 번 사용자가 지적함. AI 메모리로 막으려 했지만 다시 일어남

## 목표와 비목표

- 목표
  - 세션을 시작할 때 훅이 컨벤션 문서의 본문을 그대로 맥락에 넣음. "읽어라"라는 지시가 아니라 내용이 처음부터 맥락에 있음
  - 새로 시작, 이어 열기, 비우기(`/clear`), 맥락 압축 뒤에도 다시 들어감
  - Claude Code와 Codex 모두
- 비목표
  - 컨벤션이 아닌 문서(로드맵, 결정 등)를 넣기
  - 컨벤션 자리가 없는 작업 공간(모양 1·2, 홈)
- 성공 기준
  - 새 세션에서 도구를 쓰지 않고도 컨벤션 내용을 따름
  - 맥락 길이 제한을 넘으면 앞부분만 잘려 들어가지 않고 문서 목록과 경로가 들어감

## 거쳐 온 길

| 종류 | 문서 |
| --- | --- |
| 아이디어 | `shared/ideas/conventions-on-session-start.md` |
| 결정 | 없음(아이디어 문서와 PR #47 본문에 둠) |
| 설계 | 없음(작아서 PR #47 본문에 둠) |
| 구현 계획 | 없음 |
| 이슈 | 없음 |

## 결과

- PR #47 머지(2026-11-27, `a214586`), 0.8.9로 내보냄(PR #49, `aec7bcf`)
- 만든 것
  - `lib/conventions.mjs`: 자리표의 컨벤션 자리에서 문서를 모아 맥락 글을 만듦. 문서마다 경로를 붙이고 속성은 뗌
  - 폴더 안내(`README.md`)와 `status`가 폐기, 바뀜인 문서는 넣지 않음. 제안은 `(제안)`을 붙여 넣음
  - `scripts/conventions.mjs`: SessionStart 훅. matcher 없이 startup, resume, clear, compact, fork에서 모두 돎. 넣은 글자 수를 사용 기록(`hook:conventions`)에 남김
  - 길이: Claude Code는 9,000자, Codex는 3,000자를 넘으면 본문 대신 문서 목록과 경로를 넣고 모두 읽고 시작하라고 함
- 할 일 알림(`viewer/notify.mjs --session`)을 넓히지 않고 스크립트를 따로 둔 까닭
  - 훅 출력 길이 제한은 출력 하나마다 잼. 합치면 할 일·업데이트 알림과 한도를 나눠 씀
  - `notify.mjs`의 Claude Code 전용 안내가 Codex에 함께 가지 않게
- 확인한 것: 테스트 `test/conventions.test.mjs`, 임시 작업 공간에서 실제 Claude Code 새 세션이 도구 없이 컨벤션 내용으로 답함(startup)
- 이 저장소 작업 공간에서는 문서 4개, 3,360자가 들어감. Codex에서는 목록으로 들어감
- 남은 것
  - 내보낸 뒤 실제 세션에서 들어가는지, 맥락 압축 뒤에도 다시 들어가는지
  - Codex 실제 세션 확인. 새 훅은 Codex에서 신뢰 검토를 다시 받아야 돎
  - Codex 한도 3,000자는 어림값. `additionalContextLimit`로 한도를 올릴지는 옛 Codex 동작을 몰라 넣지 않음
