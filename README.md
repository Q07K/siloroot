# SiloRoot

도구마다 흩어진 기록(사일로)을 마크다운 폴더 하나(뿌리)로 모으는 Claude Code 플러그인이다. 폴더의 마크다운 파일이 원본이고, 사람은 로컬 뷰어 화면으로, AI는 파일로 같은 내용을 본다. 지금은 본인이 쓰는 v0이다.

## 설치 (이 PC)

```powershell
claude plugin marketplace add <이 저장소 경로>
cd <작업 공간으로 쓸 폴더>
claude plugin install siloroot@siloroot --scope project
```

그 폴더에서 Claude Code를 열고 `/siloroot:init`을 실행한다.

## 스킬

| 스킬 | 언제 |
| --- | --- |
| `/siloroot:init` | 폴더를 작업 공간으로 만든다. 없는 파일만 만들고 뷰어를 연다 |
| `/siloroot:note` | 기술 개념을 문답으로 공부한다. 공부 노트가 생기고 이어 적힌다 |
| `/siloroot:verify` | "검증해 줘". Claude가 질문하고 판정해 검증 기록과 이해도를 갱신한다 |
| `/siloroot:feedback` | 뷰어에서 남긴 댓글과 웹 편집을 처리한다. 훅이 알려 준다 |

## 만들어지는 폴더

| 경로 | 내용 |
| --- | --- |
| `CLAUDE.md` | SiloRoot 표시 블록(폴더 지도와 규칙). 블록 밖은 자유 |
| `metadata-guide.md`, `writing-guide.md` | 문서 속성 약속, 글쓰기 규칙 |
| `01-log/` | 작업 기록, 미해결 질문 |
| `02-study/` | 공부 노트와 주제 목록(이해도) |
| `03-ideas/` | 아이디어 |
| `04-feedback/` | 뷰어 댓글, 글쓰기 규칙 후보 |
| `.siloroot/` | 설정(`config.json`: 포트, 폴더 이름)과 뷰어 생성물(`state/`) |

## 뷰어

`http://127.0.0.1:<config.json의 port>`. 이 PC 안에서만 열린다. 문서가 바뀌면 화면이 바로 다시 그려지고, 새 문서와 새 줄이 잠깐 노랗게 칠해진다. 외부 네트워크 요청은 없다.

훅은 `.siloroot/config.json`이 있는 폴더에서만 동작한다. 세션을 시작하면 뷰어 서버를 켜고(그날 첫 세션이면 브라우저도 연다), 메시지를 보낼 때 처리할 피드백이 있으면 알린다. 이미 `.gitignore`가 있는 폴더라면 `.siloroot/state/`를 직접 더한다.

## 개발

```powershell
npm test
claude plugin validate .
```
