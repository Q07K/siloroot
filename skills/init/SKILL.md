---
name: init
description: 지금 프로젝트 폴더를 SiloRoot 작업 공간으로 초기화한다. 폴더 뼈대(01-log, 02-study, 03-ideas, 04-feedback), 지시사항 문서, 문서 속성 가이드, 뷰어 설정을 만들고 뷰어를 연다. 사용자가 "SiloRoot로 초기화", "SiloRoot 시작", "/siloroot:init"이라고 할 때 쓴다. Claude 기본 /init(CLAUDE.md만 만드는 명령)과 다르다.
---

# SiloRoot 초기화

지금 프로젝트 폴더(작업 디렉터리)를 SiloRoot 작업 공간으로 만든다. 파일을 직접 쓰지 말고 아래 스크립트를 실행한다. 스크립트는 없는 파일만 만들고 이미 있는 파일은 건드리지 않는다. `CLAUDE.md`가 이미 있으면 SiloRoot 표시 블록만 끝에 붙이거나 바꾼다.

1. 초기화 스크립트를 실행한다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" "<프로젝트 폴더 절대 경로>"
   ```

   출력은 JSON이다: `created`(새로 만든 파일), `skipped`(이미 있어 그대로 둔 파일), `port`, `url`.

2. 뷰어 서버를 켜고 브라우저로 연다. 프로젝트 폴더에서 실행한다.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/viewer/autostart.mjs"
   ```

   다른 폴더가 같은 포트를 쓴다는 알림이 나오면 그대로 사용자에게 전하고, `.siloroot/config.json`의 `port`를 다른 값으로 바꿀지 묻는다.

3. 사용자에게 짧게 알린다.
   - 새로 만든 파일 목록과, 이미 있어서 그대로 둔 파일 목록
   - 뷰어 주소 (`url`)
   - 다음에 할 수 있는 것: 기술 질문을 하면 공부 노트가 생긴다(`/siloroot:note`), "검증해 줘"라고 하면 Claude가 질문한다(`/siloroot:verify`)
   - 다음 세션부터는 세션을 열 때 뷰어가 자동으로 켜진다

이미 초기화된 폴더에서 다시 실행해도 된다. 그때는 `created`가 비어 있다.
