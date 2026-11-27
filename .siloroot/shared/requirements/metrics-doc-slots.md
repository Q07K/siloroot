---
type: requirement
status: 진행 중
created: 2026-11-26
related: [shared/ideas/usage-metrics.md, shared/decisions/metrics-count-by-slot.md, shared/issues/metrics-doc-detection.md, shared/roadmap.md]
tags: [측정]
---

# 사용 기록에 자리별 문서 읽기·쓰기 세기

## 문제

- 사용자(SiloRoot를 만들고 쓰는 사람)가 쌓은 기록이 일에 쓰이는지 알 수 없음
- 사용 기록은 문서를 건드린 턴만 가르고, 읽었는지 썼는지, 어느 자리인지 모름
- 문서 턴 가르기도 어긋남: 홈 문서는 빠지고 상태 파일은 들어감

## 목표와 비목표

- 목표
  - 턴마다 참고로 읽은 문서 수와 고친 문서 수를 자리 이름별로 남김
  - 문서가 아닌 파일을 고친 수를 남김
  - 요약 스크립트가 턴을 활용, 코드만, 문서 일, 기록만으로 나눠 보임
  - 문서 턴 가르기를 흔적과 같은 기준으로 맞춤
- 비목표
  - 문서 경로를 남기기(C안)
  - 밖으로 보내기
  - 스크립트·PowerShell 안에서 다룬 문서를 문서별로 가르기
- 성공 기준
  - 새 턴 기록에 자리별 횟수가 남고, 경로·내용은 남지 않음(테스트)
  - 요약에 턴 나눔 표가 나옴
  - 홈 문서를 다룬 턴이 문서 턴으로 잡히고, 상태 파일만 읽은 턴은 잡히지 않음(테스트)

## 거쳐 온 길

| 종류 | 문서 |
| --- | --- |
| 아이디어 | `shared/ideas/usage-metrics.md` |
| 결정 | `shared/decisions/metrics-count-by-slot.md` |
| 설계 | 없음(작아서 결정 기록의 세부로 둠) |
| 구현 계획 | 없음 |
| 이슈 | `shared/issues/metrics-doc-detection.md` |

## 결과

- PR #45 머지(2026-11-27, `4bee9b3`), 0.8.8로 내보냄(PR #46, `740dec4`)
- 턴 기록에 `docReads`, `docEdits`(자리 이름별), `codeEdits`, `docScripts`를 더함. 경로는 남기지 않음
- 요약에 턴 나눔 표와 자리별 문서 수 표가 나옴
- 지난 대화 기록 28세션에 돌려 본 값: 활용 5%, 코드만 14%, 문서 일 13%, 기록만 40%, 스크립트 5%, 안 건드림 24%(도구를 안 쓴 턴 포함). 미리 뽑아 본 값은 `shared/decisions/metrics-count-by-slot.md`
- 남은 것: 내보낸 뒤 실제 세션에서 새 칸이 남는지 확인
