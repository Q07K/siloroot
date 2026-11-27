---
type: idea
status: 아이디어
created: 2026-11-26
related: [shared/ideas/existing-project-adoption.md, shared/ideas/architecture-view.md, shared/ideas/implementation-check.md, shared/ideas/session-handoff.md, shared/architecture.md]
tags: [초기화, 이탈]
---

# 기존 프로젝트에서 첫 지식 만들기

- 2026-11-26 외부 제품 피드백(이탈 원인 가설) 검토에서 나옴
- 피드백의 P0 "기존 프로젝트 자동 분석 및 초기 지식 구축"

## 피드백이 말한 것

- 빈 폴더에서 시작하면 문서가 쌓일 때까지 가치를 못 느낌
- 기존 프로젝트를 분석해 지식 구조를 자동으로 만들면 처음 가치 체감 문제가 상당 부분 풀림

## 지금 있는 것 (AI, 2026-11-26 확인)

| 무엇 | 지금 | 빈 곳 |
| --- | --- | --- |
| `/siloroot:init` | `scripts/init.mjs`가 없는 파일만 만듦. 빈 자리, 자리마다 README, 빈 틀뿐 | 코드, git 기록, 기존 문서에서 끌어오는 것 없음 |
| 시스템 개요 | `shared/architecture.md`는 빈 틀(부품, 흐름, 고칠 때) | 사람이나 AI가 따로 채워야 함 |
| 코드 지도 | `shared/ideas/architecture-view.md`(보류) | 뷰어 탭을 그리는 쪽. 문서를 채우는 일은 아님 |

## 끌어올 수 있는 것 (AI, 정하지 않음)

| 원천 | 채울 자리 |
| --- | --- |
| 폴더 구조, 패키지 설정 | 시스템 개요의 부품 |
| 기존 README, 문서 폴더 | 시스템 개요, 용어집 후보 |
| lint·formatter 설정, 기존 `CLAUDE.md` | 컨벤션 후보 |
| git 기록(커밋 메시지, PR) | 결정 후보, 이슈 후보 |
| 코드의 TODO, FIXME | 확인할 것 후보 |

## 주의할 점 (AI)

- 만든 문서는 후보로 두고 사용자가 승인함
  - 틀린 결정 기록이 쌓이면 결정 충돌 감지(`shared/ideas/implementation-check.md`)가 틀린 근거로 돎
- 큰 저장소는 토큰이 많이 듦. 읽을 범위와 상한이 필요함
- 팀 저장소에서 `shared/`에 바로 쓰면 `git status`에 보임
- init 안에서 물을지, init 뒤 따로 부르는 단계로 둘지

## 열린 질문

- 처음에 무엇까지 만들지(시스템 개요만, 컨벤션 후보까지, 결정 후보까지)
- 이미 문서가 쌓인 작업 공간에서 다시 돌리면 어떻게 할지
