---
type: idea
status: 아이디어
created: 2026-11-26
related: [shared/ideas/live-reading-graph.md, shared/ideas/implementation-check.md, shared/ideas/usage-metrics.md, shared/ideas/session-handoff.md]
tags: [재사용, 이탈]
---

# 기록을 쓴 것을 보이기

- 2026-11-26 외부 제품 피드백(이탈 원인 가설) 검토에서 나옴
- 피드백의 P1 "기존 지식 재사용 및 근거 표시"

## 피드백이 말한 것

- 기록을 쌓을 이유가 생김
- 핵심 주장: SiloRoot를 끄면 AI가 일을 못한다고 느껴야 함
- 예: "지금 코드가 3일 전 결정과 충돌함. 당시 PostgreSQL을 고른 까닭은 트랜잭션 일관성"
  - 충돌을 찾는 쪽은 `shared/ideas/implementation-check.md`
  - 근거를 대는 쪽이 이 문서

## 지금 있는 것 (AI, 2026-11-26 확인)

| 무엇 | 지금 | 빈 곳 |
| --- | --- | --- |
| 흔적 | 이번 답에서 읽고 고친 문서를 연결 그래프에 차례로 보임(`shared/ideas/live-reading-graph.md`) | 뷰어를 열어야 보임. 새 메시지에 지워짐. 답 안에는 없음 |
| 관리 블록 | "코드 열기 전에 로드맵과 결정 먼저 보기" | 답에 근거를 적으라는 약속 없음 |
| 사용 기록 | 턴마다 시간, 토큰, 도구 횟수 | 어느 문서를 썼는지 남기지 않음 |

## 생각해 볼 방향 (AI, 정하지 않음)

- 판단에 문서를 실제로 썼을 때만 답 끝에 그 문서를 한 줄로 적는 약속
  - 매 답마다 붙으면 시끄러움
- 흔적을 날짜별로 모아 "쓰인 문서 / 한 번도 안 쓰인 문서"를 셈
  - 재사용 비율 지표와 이어짐: `shared/ideas/usage-metrics.md`
  - 뷰어에서 오래 안 쓰인 문서를 흐리게 보이는 데도 쓸 수 있음

## 열린 질문

- 근거 줄을 누구에게 보일지: 채팅 답, 뷰어, 둘 다
- 흔적을 모으면 경로가 남음. 지금 사용 기록의 "경로 안 남김" 원칙과 어떻게 맞출지
