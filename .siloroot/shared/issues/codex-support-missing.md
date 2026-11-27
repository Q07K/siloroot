---
type: issue
status: 해결
created: 2026-11-25
related: [shared/requirements/codex-support.md, shared/ideas/live-reading-graph.md]
---

# Codex 지원 안됨

`shared/ideas/live-reading-graph.md`의 문서 흔적이 Codex에서도 보이는지 시험하다가 발견했다.

## 겪은 일

2026-11-25 Windows의 Codex 데스크톱에서 `shared/ideas/daily-worklog.md`를 두 번 읽었다. 현재 세션의 흔적 파일이 만들어지지 않았고, 문서 경로도 흔적에 없었다.

이 이슈와 요구사항 문서를 추가했을 때도 같은 증상이 있었다. 뷰어의 `/data`에는 두 문서가 있었고, `/trail`에는 추가 흔적이 없었다.

## 원인

- 처음에는 Codex가 이미 사라진 `0.8.1` 캐시 경로에서 플러그인 내용을 검사하려다 훅을 건너뛰었다. `hooks/list`에 Windows 오류 3이 남았다.
- 캐시가 `0.8.2`로 바뀐 뒤에는 훅 6개가 목록에 나왔고 모두 `untrusted`였다. Codex는 플러그인 훅을 신뢰한 뒤 실행한다.
- 읽기 훅의 실행 명령은 `node`로만 표시됐다. 당시 설정은 실행할 스크립트를 별도 `args`에 넣었다. Codex용 설정에는 스크립트까지 포함된 명령 문자열이 필요하다.
- Codex는 셸 호출을 `Bash`로 보내므로 기존 읽기 처리를 재사용할 수 있다. `apply_patch`는 별도 이벤트 형식이라 문서 경로를 뽑는 처리가 필요하다. [Codex 훅 문서](https://developers.openai.com/codex/hooks)

## 해결

작업 브랜치에 Codex 플러그인 설정을 두고 문서 읽기·패치·새 메시지에서 초기화를 연결했다. 실제 Codex CLI에 임시 설치했을 때 두 훅이 스크립트 경로를 포함한 명령으로 등록됐고 신뢰 검토 대상으로 표시됐다.

증상이 난 데스크톱 채팅은 셸과 패치를 `functions.exec`로 묶어 불렀다. Windows Codex CLI의 같은 도구 묶음 방식에서 두 호출을 재현했다. 셸에는 `Bash`, 문서 추가에는 `apply_patch` 이름으로 개별 `PostToolUse` 이벤트가 왔다.

작업 브랜치의 플러그인을 임시 프로필에 설치한 상태에서 읽기와 추가가 모두 JSONL에 들어갔다. 뷰어는 새 문서와 두 흔적을 읽었다. 같은 Codex 세션에서 다음 메시지를 보내니 해당 세션의 흔적만 비워졌다.

임시 설치에서 확인한 수정은 `0.8.3`으로 `main`에 합쳤다. 실제 데스크톱에서 설치 후 훅을 검토하고 새 세션에서 적용을 확인하는 단계가 남아 있다. [PR #37](https://github.com/Q07K/siloroot/pull/37)

검증 결과와 후속 조사 항목은 `shared/requirements/codex-support.md`에 있다.

## 다시 안 나게

- Codex가 읽는 설정의 명령을 테스트에서 직접 실행한다. 셸 읽기, 패치, 새 메시지를 차례로 보내 흔적 저장과 초기화를 확인한다.
- 실제 Codex에서 플러그인 설치 경로와 훅 신뢰 상태까지 확인한다. 업데이트 뒤에는 새 코드의 훅이 검토 대상으로 다시 잡히는지도 본다.
