<!-- siloroot:start -->
## SiloRoot 작업 공간

이 폴더는 SiloRoot 작업 공간이다. 마크다운 파일이 원본이고, 사람은 뷰어 화면으로, AI는 파일로 같은 내용을 본다. 이 블록(`siloroot:start`부터 `siloroot:end`까지)은 `/siloroot:init`이 관리한다. 블록 밖은 자유롭게 고친다.

### 폴더

| 폴더 | 무엇이 있나 |
| --- | --- |
| `01-log/` | 작업 기록(`changelog.md`)과 사용자 확인이 필요한 것(`open-questions.md`) |
| `02-study/` | 문답으로 공부한 노트. 주제 하나에 파일 하나, 목록은 `02-study/README.md` |
| `03-ideas/` | 아직 만들지 않은 아이디어. 아이디어 하나에 파일 하나 |
| `04-feedback/` | 뷰어에서 남긴 댓글과 글쓰기 규칙 후보 |
| `.siloroot/` | 설정(`config.json`)과 뷰어 생성물. 직접 고치지 않는다 |

### 규칙

- 모든 마크다운 문서 맨 위에 속성(`type`, `status`)을 적는다. 값과 폴더별 규칙은 `metadata-guide.md`에 있다.
- 다른 문서는 폴더 맨 위 기준 경로를 백틱으로 적는다. 뷰어가 이것을 연결로 읽는다.
- 기술 질문을 공부할 때는 `/siloroot:note`, "검증해 줘"라고 하면 `/siloroot:verify`를 따른다.
- 훅이 "[SiloRoot] 처리할 일"을 알리면 지금 요청을 끝낸 뒤 `/siloroot:feedback`을 따른다.
- 글을 쓰거나 고치기 전에 `writing-guide.md`를 읽는다. 사용자가 표현을 지적하면 규칙 후보로 남긴다.

### 마칠 때

- 한 일을 `01-log/changelog.md`에 날짜와 함께 한 줄로 남긴다.
- 사용자 확인이 필요한 것은 `01-log/open-questions.md`에 더한다.
- 문서를 만들었거나 속성을 고쳤으면 뷰어를 다시 만들어 "속성 점검" 경고가 0개인지 본다.
<!-- siloroot:end -->
