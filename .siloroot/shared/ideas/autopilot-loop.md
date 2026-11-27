---
type: idea
status: 아이디어
created: 2026-11-27
related: [shared/ideas/autonomous-work.md, shared/ideas/completion-check.md, shared/ideas/autonomy-policy.md, shared/ideas/usage-metrics.md]
tags: [자율 업무, 훅, 비용]
---

# 자율 실행 루프와 예약 실행

- 2026-11-27 외부 AI가 낸 자율 업무 관점 검토에서 나옴. 묶음은 `shared/ideas/autonomous-work.md`

## 외부 의견이 말한 것

- 새 스킬 여섯

| 스킬 | 하는 일 |
| --- | --- |
| `/siloroot:discover` | 문서를 보고 필요한 업무 찾기 |
| `/siloroot:plan` | 업무 나누기, 의존 짜기 |
| `/siloroot:execute` | 할 수 있는 업무 하기 |
| `/siloroot:evaluate` | 완료 조건 검증 |
| `/siloroot:autopilot` | 제한된 자율 루프 |
| `/siloroot:pause` | 자율 실행 멈춤 |

- 훅마다 넓힐 수 있는 역할

| 훅 | 지금 역할(외부 의견이 본 것) | 넓힐 수 있는 역할 |
| --- | --- | --- |
| SessionStart | 뷰어 켜기, 알림 | 업무 찾기와 고르기 |
| UserPromptSubmit | 알림, 흔적 비우기 | 요청 가르기와 업무 만들기 |
| PostToolUse | 문서 읽기·고치기 흔적 | 실행 결과와 상태 남기기 |
| Stop | 시간·토큰 기록 | 완료 검증과 다음 업무 판단(`shared/ideas/completion-check.md`) |

- 훅만으로는 끝난 세션이 다시 시작하지 않음. 스케줄러나 이벤트 트리거가 따로 필요
- 뒤에 Claude Code headless CLI나 Agent SDK를 밖의 스케줄러와 이으면 사용자가 대화를 열지 않아도 일함
- 처음에는 한 번 돌 때 최대 업무 수, 토큰 예산, 실행 시간, 재시도 횟수를 제한
- 업무 선택과 결과 검증부터 만듦
- LangGraph나 멀티에이전트 프레임워크는 처음부터 필요 없음. Claude Code가 이미 실행 환경을 줌
- 실패하면 다시 계획(그림 제목만 남음)

## 지금 있는 것 (AI, 2026-11-27 확인)

| 무엇 | 지금 |
| --- | --- |
| 훅 | SessionStart(뷰어 켜기, 알림, 컨벤션 넣기), UserPromptSubmit(알림, 흔적 비우기), PostToolUse(흔적), Stop(사용 기록) |
| 토큰 기록 | `state/metrics.jsonl`이 턴마다 시간과 토큰을 남김. 예산 셈에 쓸 수 있음 |
| Claude Code 쪽 | 이 세션 스킬 목록에 `/loop`(간격마다 다시 돎), `/schedule`(예약 클라우드 에이전트)이 보임 |
| 멈춤 | 없음 |

## 생각해 볼 방향 (AI, 정하지 않음)

- 스케줄러를 SiloRoot가 만들지 않음
  - Claude Code의 `/loop`, `/schedule`, headless 실행에 "무엇을 할지"만 넘김
  - SiloRoot의 몫은 업무 상태와 판단 기준. 외부 의견의 역할 나눔과 같음
- 스킬 여섯을 한 번에 만들지 않음. 업무 발견(찾기만)부터, 실행과 루프는 뒤
- 예산은 사용 기록으로 셈: 한 루프에서 쓴 토큰, 걸린 시간
- 멈춤은 설정 한 줄(예: 루프 꺼짐). 스킬이 돌기 전에 봄
- 끝내기를 막는 것은 사용자가 루프를 켰을 때만
  - 구현 점검의 "막지 않음" 결정과 맞춤: `shared/ideas/completion-check.md`
- 사용자가 없는 동안에는 되돌리기 쉬운 일(조사, 문서 후보)만
  - 코드 수정과 PR은 정책을 따름: `shared/ideas/autonomy-policy.md`

## 열린 질문

- 사용자가 없을 때도 돌게 할지
- 한 번 도는 데 쓰는 예산 기본값
- 여러 세션이 함께 돌 때 같은 업무를 두 번 잡지 않는 법(잠금)
  - 흔적에서 겪은 "여러 세션" 문제와 같은 뿌리
