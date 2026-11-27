---
type: issue
status: 열림
created: 2026-11-25
related: []
---

# Claude Code 검색 도구가 .siloroot 문서를 못 찾는다

## 겪은 일

2026-11-25에 Claude Code의 검색 도구(Grep)로 검색 경로를 `.siloroot`로 주고 "자물쇠"를 찾았는데 "찾은 것 없음"이 나왔다.

같은 낱말을 셸의 `grep -r`로 찾으니 문서 다섯 개에 있었다.

그래서 AI가 이미 문서에 남아 있던 아이콘 결정을 못 보고 코드를 열어 알게 됐다.

## 원인

아직 모른다.

`.siloroot/`는 git 제외 목록에 있고, 프로젝트 맨 위 `.ignore`의 `!.siloroot/`가 검색에서는 다시 찾게 하도록 되어 있다.

검색 도구가 `.ignore`를 읽지 않거나, 제외 목록(`.siloroot/*`, `!.siloroot/shared/`)을 다르게 해석하는 것으로 보인다.

## 해결

아직 없다.

그동안 SiloRoot 문서를 찾을 때 결과가 비면 셸의 `grep -r`로 한 번 더 본다.

## 다시 안 나게

- 원인을 찾으면 관리 블록의 "경로와 검색" 안내를 고친다.
