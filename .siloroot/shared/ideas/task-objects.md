---
type: idea
status: 아이디어
created: 2026-11-27
related: [shared/ideas/autonomous-work.md, shared/ideas/task-discovery.md, shared/ideas/completion-check.md, shared/ideas/edge-meaning.md, shared/decisions/roadmap-vs-plan.md, shared/decisions/requirements-hub.md]
tags: [자율 업무, 구조]
---

# 업무 객체와 상태 전이

- 2026-11-27 외부 AI가 낸 자율 업무 관점 검토에서 나옴. 묶음은 `shared/ideas/autonomous-work.md`

## 외부 의견이 말한 것

- 업무(task)를 상태가 바뀌는 객체로 둠. 마크다운 메모와 다르게 다룸
- 새 자리
  - 공유 영역: `goals/`(달성 목표), `tasks/`(실행 단위), `policies/`(자율 행동 정책), `evaluations/`(결과 검증)
  - `state/`: `runs/`(실행 이력), `runtime.db`(실행 상태, 잠금)
- 업무 프론트매터 예: `id`, `type: task`, `status: ready`, `priority`, `assignee: ai`, `source`(이슈), `goal`, `depends_on`, `approval_required`, `max_attempts`
- 본문 절: 목적, 완료 조건, 실행 제약, 실행 결과, 검증 근거, 후속 업무
- 마크다운은 사람이 읽는 업무 정의 원본
- 중복 실행 막기, 잠금, 재시도 횟수처럼 한 번에 처리해야 하는 상태는 SQLite 같은 곳에 둠
- 상태 전이를 LLM이 다 맡으면 안 됨
  - AI는 전이를 제안하고, 되는지는 프로그램이 검증
  - 아니면 검증 안 한 일을 완료로 적거나 같은 일을 끝없이 만들 수 있음
- 상태 머신 그림은 붙여 넣을 때 빠져 있었음

## 지금 있는 것 (AI, 2026-11-27 확인)

| 외부 의견 | 지금 자리 | 다른 점 |
| --- | --- | --- |
| 업무 | 구현 계획(`shared/plans/`)의 체크 목록, 확인할 것 장부 줄 | 계획은 기능 하나에 한 문서, 단계는 본문 체크. 하나하나가 객체가 아님 |
| goals | 로드맵 한 장 + 요구사항(목표와 비목표) | 따로 둘 까닭이 약함 |
| `status` 검증 | 뷰어 속성 점검: 정해진 값인지 봄 | 어디서 어디로 바뀌었는지는 안 봄 |
| 실행 상태 | `state/`: 뷰어 생성물, 사용 기록, 흔적 | 잠금, 재시도 횟수 없음 |
| 의존 | 없음 | |

- 정해진 것과 맞대기
  - 로드맵과 구현 계획을 가름(`shared/decisions/roadmap-vs-plan.md`): 로드맵은 한 장, 계획은 기능마다
  - 요구사항이 기능의 중심(`shared/decisions/requirements-hub.md`)
  - 업무 객체는 그 아래로 한 단계 더 잘게 나눈 것이 됨
- 플러그인 의존성: `package.json`에 의존 패키지 없음. SQLite를 쓰려면 Node 내장 모듈이나 패키지가 필요함

## 생각해 볼 방향 (AI, 정하지 않음)

- 새 폴더 대신 지금 자리로 시작
  - 구현 계획 체크 목록의 한 줄을 업무 하나로 봄. 계획 문서에 이미 단계와 확인 방법이 있음
  - 기능에 묶이지 않는 업무(조사, 문서 정리)가 많아지면 그때 `type: task` 자리를 더함
- 새 `type`이나 폴더는 작업 공간 모양(`SCHEMA`) 변경. 마이그레이션과 부 버전이 따라옴(저장소 규칙)
- `source`, `goal`, `depends_on`은 종류 있는 연결
  - 선 종류를 프론트매터 키로 두기로 한 것(`shared/ideas/edge-meaning.md`)과 같은 모양으로 맞춤
- 실행 상태는 SQLite 대신 `state/` 안의 JSON과 잠금 파일로도 됨. 의존성이 늘지 않음
- 전이 검증은 스크립트가 맡음
  - 허용 전이 표
  - 완료로 가려면 검증 근거 절이 비어 있지 않아야 함

## 열린 질문

- 업무를 따로 객체로 둘지, 구현 계획 체크 목록으로 충분한지
- 업무를 공유 영역에 둘지 개인 영역에 둘지
- 상태 값 목록과 허용 전이
