---
type: decision
status: 확정
created: 2026-11-25
related: [shared/ideas/doc-slots.md, shared/ideas/daily-worklog.md]
---

# 작업 기록은 worklog, 하루에 한 문서

## 맥락

AI가 요청 하나를 마칠 때마다 한 일을 한 줄로 적는 기록이 `private/log/changelog.md` 한 문서에 쌓였다. 이름은 버전마다 바뀐 것(변경 이력)처럼 읽힌다. 이틀 만에 긴 줄이 마흔 개를 넘었고, 여러 세션이 같은 파일 맨 위에 줄을 더해 서로 부딪혔다. 그래프에서는 모든 날이 노드 하나에 들어 있다.

## 정한 것 (사용자, 2026-11-25)

- 이름은 worklog. 자리는 `private/worklog/YYYY-MM-DD.md`, 하루에 한 문서. 그때 기록이라 그날이 지나면 고치지 않는다.
- 확인할 것(open-questions.md)은 닫아 가는 살아 있는 목록이라 날짜로 나누지 않고 private/open-questions.md 한 장으로 둔다.
- `private/log/` 폴더는 없어진다.
- 홈도 같은 모양: home:worklog/YYYY-MM-DD.md, home:open-questions.md.

## 이 문서가 담지 않는 것

worklog는 AI가 손으로 적는 한 일의 요약이다. 대화 내용, 파일을 안 바꾼 문답, 세션과 시각은 남지 않는다. 그것까지 남기는 일지는 `shared/ideas/daily-worklog.md`에서 따로 본다.

## 반영

- 플러그인: 플러그인 PR #30(2026-11-25 머지, 0.8.0으로 내보냄). 자리표, 관리 블록, 스킬, 템플릿, 마이그레이션 003
- 이 작업 공간과 홈: 003으로 나눴다(2026-11-25, 백업 `20261125-045323-schema3-to4`, 홈 `20261125-045535-schema3-to4`)
