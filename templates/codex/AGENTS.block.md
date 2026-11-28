<!-- siloroot:start -->
## SiloRoot 작업 공간

이 블록은 SiloRoot(`/siloroot:init`, `/siloroot:update`)가 관리한다. Codex는 SiloRoot 규칙 파일(`CLAUDE.md`)을 스스로 읽지 않아서 여기서 이어 준다. 블록 밖은 자유롭게 고친다.

- 프로젝트 맨 위에 `.siloroot/config.json`이 있으면 SiloRoot 작업 공간이다. 일을 시작하기 전에 `.siloroot/CLAUDE.md`를 읽고 따른다.
- 홈(`{{home}}`)에서 일할 때는 홈의 `CLAUDE.md`를 읽고 따른다.
- 규칙 파일 안의 `@경로` 줄은 그 파일을 함께 읽으라는 뜻이다. `~/`는 사용자 폴더다.
- 세션 시작 맥락에 "[SiloRoot] 이 폴더의 작업 규칙입니다"가 이미 들어 있으면 다시 읽지 않는다.
- 이런 폴더에서 "문서로 써 줘", "정리해 줘"는 그 규칙의 자리 표에 맞는 마크다운 문서를 만들라는 뜻이다. Word, PDF, Google Docs 같은 파일은 사용자가 그 형식을 말할 때만 만든다.
<!-- siloroot:end -->
