---
type: idea
status: 아이디어
created: 2026-11-27
related: [shared/ideas/task-discovery.md, shared/ideas/task-objects.md, shared/ideas/completion-check.md, shared/ideas/autonomy-policy.md, shared/ideas/autopilot-loop.md, shared/ideas/edge-meaning.md]
tags: [자율 업무, 포지션]
---

# 스스로 일을 찾고 하는 AI로 넓히기

- 2026-11-27 외부 AI가 낸 "자율 업무 시스템" 관점 검토에서 나옴
- 이 문서는 전체를 묶는 자리. 관심사마다 문서를 따로 둠

## 외부 의견이 말한 것

- SiloRoot를 AI 기억 플러그인에서 "Agent Workspace", "Agent Operating Layer"로 넓힘
- 핵심은 도구를 더 주는 것이 아님. AI가 다음에 할 일을 판단할 업무 상태와 기준을 주는 것
- 이미 있는 것
  - 장기 기억: 지식, 작업 일지, 결정
  - 목표: 로드맵, 요구사항
  - 행동 제약: 컨벤션, 사용자 정보
  - 문제 인식: 이슈, 확인할 것
  - 학습 기반: 피드백, 검증 기록
- 빈 곳: 이 정보로 스스로 일을 시작하고 이어 가는 실행 제어 층
- 차별점: 주어진 일을 자동화하지 않고, 지금 해야 할 일을 AI가 찾게 함
- 역할 나눔

| 구분 | 역할 |
| --- | --- |
| LLM | 추론 |
| Claude Code | 실행 |
| 스킬 | 일하는 방법 |
| 훅 | 행동 감지와 제어 |
| SiloRoot | 기억, 목표, 지식, 업무 상태 |
| Autopilot | 자율 업무 순환 |

- 그래서 SiloRoot가 특정 LLM이나 에이전트에 묶이지 않는 업무 환경이 될 수 있다고 함

## 관심사 나누기

| 관심사 | 문서 | 이미 있는 이웃 |
| --- | --- | --- |
| 업무 발견: 목표와 지금 상태를 견줘 할 일을 찾음 | `shared/ideas/task-discovery.md` | 인수인계의 다음 할 일 제안(`shared/ideas/session-handoff.md`) |
| 업무 객체와 상태 전이 | `shared/ideas/task-objects.md` | 구현 계획 체크 목록, 확인할 것 장부 |
| 완료 조건 검증 | `shared/ideas/completion-check.md` | 구현 점검(`shared/ideas/implementation-check.md`) |
| 자율 단계와 실행 허용 정책 | `shared/ideas/autonomy-policy.md` | 컨벤션, Claude Code 권한 |
| 자율 실행 루프, 예약 실행, 예산 | `shared/ideas/autopilot-loop.md` | 쓰이는지 재기(`shared/ideas/usage-metrics.md`) |
| 관계 모델로 판단하기 | 새 문서 없이 `shared/ideas/edge-meaning.md`에 절을 더함 | 선 종류(근거, 영향, 구현) |

## 지금 SiloRoot와 맞대 보기 (AI, 2026-11-27, 정하지 않음)

- 이탈 피드백 검토(2026-11-26)의 "기록 → 활용" 축을 더 밀고 간 모습
  - 그때 열린 질문: "기록하는 AI"에서 "기록 덕분에 일을 더 잘하는 AI"로 바꿀지
  - 이 관점은 한 걸음 더 감: "기록을 보고 스스로 일하는 AI"
- 새로 만들 것보다 이미 있는 아이디어와 겹치는 곳이 많음(위 표 마지막 칸)
- 외부 의견의 새 폴더 넷은 이미 있는 자리와 겹침

| 외부 의견 폴더 | 지금 자리 |
| --- | --- |
| goals | 로드맵(만들기로 정한 것) + 요구사항(목표와 비목표, 성공 기준) |
| policies | 컨벤션. README가 이미 "약속과 정책"을 담는다고 적음 |
| evaluations | 구현 점검 결과를 남길 자리(아직 안 정함) |
| tasks | 딱 맞는 자리 없음. `shared/ideas/task-objects.md`에서 다룸 |

- 새 폴더나 새 `type`은 작업 공간 모양(`SCHEMA`) 변경. 마이그레이션과 부 버전이 따라옴
- 전제: 문서가 지금 상태와 맞아야 함
  - 이 작업 공간에도 끝났는지 확인 못 한 로드맵 줄과 지난 확인할 것 줄이 있음
  - 낡은 문서 위에서 업무를 찾으면 틀린 일을 만듦
  - 빈 작업 공간에서는 찾을 것이 없음. 첫 지식 만들기(`shared/ideas/project-bootstrap.md`)와 이어짐
- 지난 결정과 부딪히는 곳
  - 구현 점검에서 "알림은 막지 않음, 막는 관문은 사용자가 고름"으로 정함(2026-11-24, 사용자)
  - 외부 의견의 Stop 훅 관문과 자율 루프는 이와 부딪힘
  - 완료 조건 검증과 루프 문서에 각각 적음
- 비용: 자율 루프는 사용자가 묻지 않은 턴에도 토큰을 씀
- 에이전트에 묶이지 않는다는 주장과 실제 제안의 차이
  - 제안한 장치(Stop 훅으로 막기, headless CLI, Agent SDK)는 모두 Claude Code 것
  - 로드맵 "지금" 칸에 Codex 지원(`shared/requirements/codex-support.md`)이 있음. 업무 상태(문서)는 어디서나 읽히지만 실행 제어는 도구마다 다시 만들어야 함

## 열린 질문

- 이 방향(스스로 일하는 AI)으로 갈지. 간다면 자율 단계 어디까지
- 어느 관심사부터 볼지
- 새 폴더 없이 지금 자리로 어디까지 할 수 있는지
