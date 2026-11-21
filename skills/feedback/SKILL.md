---
name: feedback
description: SiloRoot 훅이 "[SiloRoot] 처리할 일이 있습니다"라고 알렸을 때, 또는 사용자가 뷰어의 댓글, 웹 편집, 글쓰기 규칙 후보를 처리해 달라고 할 때 쓴다. 대기 중인 피드백을 처리하고, 웹 편집 기록에서 글쓰기 규칙 후보를 만들고, 승인된 규칙을 writing-guide.md에 넣는다.
---

# 뷰어 피드백 처리

사용자의 지금 요청을 먼저 끝낸다. 그다음 같은 턴에서 아래를 처리하고 무엇을 했는지 보고한다. 폴더 이름은 `.siloroot/config.json`의 `dirs.feedback`(기본 `04-feedback`)을 따른다. 파일 형식은 `04-feedback/README.md`에 있다. 문서를 지우거나 크게 바꾸는 일은 고치기 전에 사용자에게 확인한다.

## A. 피드백 처리 (status: 대기)

1. 파일의 `status`를 `진행 중`으로 바꾼다.
2. `related`의 대상 문서, "고른 부분", "댓글"을 읽고 문서를 고친다. `CLAUDE.md`, `writing-guide.md`, `metadata-guide.md`의 규칙을 지킨다.
3. "처리" 절의 안내 문장을 지우고 적는다: 무엇을 고쳤나(파일과 바뀐 문장), 왜 그렇게 고쳤나, 고치지 않은 것과 이유.
4. `status`를 `완료`로 바꾼다. 하지 않기로 했으면 `안 함`으로 바꾸고 처리 절에 이유를 적는다.
5. 댓글이 글의 표현을 지적한 것이면 B의 규칙 후보도 만든다.
6. `01-log/changelog.md`에 한 줄 남긴다.

## B. 웹 편집에서 규칙 후보 만들기

1. `.siloroot/state/web-edits.jsonl`에서 `04-feedback/reviewed-edits.json`의 `last`보다 뒤의 기록을 읽는다.
2. 같은 방향의 수정을 찾는다. 같은 표현을 지우거나 바꾼 것이 여러 번이면 후보가 된다. 사용자가 이유를 적은 표현 수정은 한 번이어도 후보가 될 수 있다. 사실이나 수치를 고친 내용 수정은 후보로 만들지 않는다.
3. 아래 틀로 `04-feedback/rule-YYYY-MM-DD-NNN.md`를 만든다. 이미 `writing-guide.md`에 있는 규칙이면 만들지 않는다.
4. 이유는 사용자가 적은 말만 따옴표로 옮긴다. 이유가 없으면 "이유를 적지 않음"으로 두고 짐작으로 채우지 않는다.
5. `reviewed-edits.json`의 `last`를 마지막으로 본 기록의 id로 바꾼다.

```markdown
---
type: rule
status: 제안
created: YYYY-MM-DD
related: [writing-guide.md]
---

# 규칙 후보: 짧은 이름

## 제안하는 규칙

| 쓰지 않는 것 | 바꿔 쓰는 법 |
| --- | --- |
| … | … |

## 근거가 된 수정

- e-… `문서 경로`: "고치기 전" → "고친 뒤". 이유: "사용자가 적은 말"
```

## C. 승인된 규칙 반영 (status: 승인)

1. `writing-guide.md` 1절 표에 행을 더한다. 출처는 "본인", 바꿔 쓰는 법에는 사용자가 적은 이유를 짧게 넣는다.
2. `writing-guide.md` 2절 변경 기록에 날짜와 이 규칙 파일 경로를 적는다.
3. 규칙 파일의 `status`를 `반영`으로 바꾼다.
