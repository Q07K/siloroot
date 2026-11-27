---
type: requirement
status: 완료
created: 2026-11-25
related: [shared/ideas/doc-slots.md, shared/design/doc-slots.md, shared/roadmap.md]
---

# 문서 자리 다시 짜기(모양 4)

## 문제

대화가 여러 주제를 자주 오가는데, 문서가 관심사마다 나뉘지 않고 한 논의 기록이나 아이디어 문서에 쌓였다. 연결 그래프 작업 이틀 동안 결정 기록과 이슈가 0개였다. 자리는 있었지만 README도 없고 그래프에도 안 보여 사용자도 AI도 몰랐다. 그래서 AI가 이미 정하고 반영한 일을 문서가 아니라 코드를 읽고서야 알았다.

## 목표와 비목표

- 목표: 대화에서 생기는 일마다 갈 문서가 정해져 있고 AI가 그 자리에 쓴다. 자리마다 넣는 것과 넣지 않는 것이 적혀 있다. 빈 자리도 보인다. 문서만 보고 일이 시작 전인지, 진행 중인지, 끝났는지 안다.
- 비목표: `shared`, `private` 이름 바꾸기, 뷰어 구조 탭, 작업 일지 자동 수집, 문서 버전 관리.
- 성공 기준: 다음 기능 작업에서 결정, 이슈, 측정이 결정 기록과 이슈 자리에 따로 쌓이고, 작업 일지에는 경로만 남는다.

## 거쳐 온 길

| 종류 | 문서 |
| --- | --- |
| 아이디어 | `shared/ideas/doc-slots.md`, `shared/ideas/daily-worklog.md`(따로), `shared/ideas/architecture-view.md`(보류) |
| 결정 | `shared/decisions/roadmap-vs-plan.md`, `shared/decisions/slot-readme-and-empty-clusters.md`, `shared/decisions/glossary-in-conventions.md`, `shared/decisions/research-split.md`, `shared/decisions/requirements-hub.md`, `shared/decisions/runbook-on-demand.md`, `shared/decisions/area-names-keep.md`, `shared/decisions/issue-status.md`, `shared/decisions/worklog-daily.md` |
| 설계 | `shared/design/doc-slots.md` |
| 구현 계획 | 없음(설계에서 바로 구현) |
| 이슈 | `shared/issues/grep-misses-siloroot.md` |

## 결과

- 플러그인: PR #30(2026-11-25 머지, 0.8.0으로 내보냄). 모양 4, 마이그레이션 003, 자리 README 12개, 관리 블록 "흐름 나누기" 표, 그래프 빈 자리. 테스트 232 통과(원래 있던 포트 테스트 1 실패).
- 이 작업 공간: 003으로 옮김. 작업 기록 3일치 → 작업 일지 3개, 계획 3개 → `shared/plans/`, 경로 고친 곳 30곳(옛 작업 기록 이야기를 잘못 고친 본문 10줄은 되살림), 그래프 논의 기록 → 관심사 4개, 측정 → 결정 기록 4개, 이슈 4개.
- 홈: 003으로 옮김. 속성 경고 0.
- 받아 확인(2026-11-25): 플러그인 0.8.0을 설치하고 이 작업 공간과 홈의 업데이트 미리 보기가 "최신"(모양 4, 옮길 것 없음)으로 끝났다. 뷰어 서버를 0.8.0으로 바꿨고, 연결 화면에서 README만 있는 자리(private/sources 0)가 흐린 원으로 보인다.
