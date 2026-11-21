---
type: index
status: 사용 중
created: {{date}}
related: [metadata-guide.md, writing-guide.md]
---

# 피드백과 글쓰기 규칙

뷰어에서 남긴 댓글과, 웹 편집에서 나온 글쓰기 규칙 후보가 모이는 폴더다. 사람은 뷰어의 "피드백" 화면에서 보고, AI는 `/siloroot:feedback` 절차로 처리한다. 대기 중인 일이 있으면 훅이 대화에 "[SiloRoot] 처리할 일"로 알려 준다.

## 이 폴더의 파일

| 파일 | 누가 만드나 | type | status |
| --- | --- | --- | --- |
| `YYYY-MM-DD-NNN.md` | 뷰어의 댓글 창 | `feedback` | 대기, 진행 중, 완료, 안 함 |
| `rule-YYYY-MM-DD-NNN.md` | AI | `rule` | 제안, 승인, 거절, 반영 |
| `reviewed-edits.json` | AI | 없음 | 규칙 후보를 만들려고 마지막으로 본 웹 편집 id (`{"last": "e-..."}`) |

웹 편집 기록은 `.siloroot/state/web-edits.jsonl`에 한 줄씩 쌓인다. 서버만 쓰고 사람이나 AI는 고치지 않는다.

## 사람이 할 일

- 문서 화면에서 문장을 고르고 댓글을 남긴다. 편집 버튼으로 직접 고칠 때는 무엇을 왜 바꿨는지 한 줄 적어 두면 규칙 후보가 정확해진다.
- "피드백" 화면에서 진행 상황을 보고, 규칙 후보를 승인하거나 거절한다.
