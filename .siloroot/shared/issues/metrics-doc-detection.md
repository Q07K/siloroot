---
type: issue
status: 해결
created: 2026-11-26
related: [shared/ideas/usage-metrics.md, shared/decisions/metrics-count-by-slot.md, shared/issues/trail-misses-scripts.md]
---

# 사용 기록이 홈 문서를 문서 턴으로 세지 않고, 문서가 아닌 상태 파일은 센다

## 겪은 일

- 2026-11-26 사용 기록을 날짜별로 뽑아 보다가, 문서 턴을 가르는 기준을 코드에서 확인함
- 문서 턴 비율(85% 안팎)이 무엇을 세는지 정확하지 않음

## 원인

- `lib/transcript.mjs`의 `splitTurns`가 도구 입력 글자에 `.siloroot`가 들어 있으면 문서를 다룬 턴(`turn:siloroot-docs`)으로 셈
- 그래서 생기는 어긋남

| 경우 | 지금 셈 | 맞는 셈 |
| --- | --- | --- |
| 홈 문서(`~/siloroot-home/…`) 읽기, 고치기 | 안 셈. 경로에 `.siloroot`가 없음 | 문서 |
| `.siloroot/state/metrics.jsonl`, `config.json` 읽기 | 문서로 셈 | 문서 아님 |
| 명령에 `.siloroot`만 들어간 Bash(예: `cd .siloroot && ls`) | 문서로 셈 | 경우에 따라 다름 |

- 흔적(`lib/trail.mjs`의 `toDocPath`)은 `.md`만, 상태 폴더 빼고, 홈 문서 포함으로 이미 가름. 두 셈이 서로 다름

## 해결

- PR #45에서 고침(2026-11-27 머지, 0.8.8로 내보냄): 사용 기록이 흔적의 `entriesFromHook`으로 문서를 가름. 홈 문서는 들어가고 상태 폴더·설정 파일은 빠짐
- 고칠 방향 정함(2026-11-26): `shared/decisions/metrics-count-by-slot.md`
- 방법: 사용 기록도 흔적의 문서 가르기(`toDocPath`, `entriesFromHook`)를 그대로 씀. 읽기·쓰기 나눠 세기(`shared/ideas/usage-metrics.md`)와 같은 일

## 다시 안 나게

- 문서인지 가르는 곳을 한 곳으로 둠(`shared/conventions/reuse-existing-implementation.md`)
