---
type: idea
status: 아이디어
created: 2026-11-24
related: [shared/ideas/dev-project-use.md, shared/ideas/shared-private-areas.md, shared/ideas/doc-versioning.md, shared/ideas/project-folder-layout.md]
---

# 공개본 만들기

`shared/ideas/shared-private-areas.md`의 "팀 공개 아카이브"에서 나왔다. 논의 과정은 private/discussions/2026-11-24-sharing-and-versions.md에 있다.

## 정한 것

**2026-11-24, 사용자:** 팀 공개 아카이브는 개인 문서를 옮기는 것도, 사본을 올리는 것도 아니다. 공개용 문서를 새로 만든다. 개인 문서는 공개하지 않을 다른 개인 문서를 가리키고 있을 수 있으니, 그런 개인 의존성을 떼어 내고 공개한다.

## AI 의견

- 원하는 것 3번(외부 공유용 문서 만들기)과 같은 동작이다. 원본에서 읽는 사람이 볼 수 없는 것을 떼어 내고 새 문서를 만든다. 읽는 사람이 팀이면 팀 공개, 바깥이면 외부 공유다. 하나의 "공개본 만들기"로 묶을 수 있다.
- 연결은 한 방향이다. 개인 원본은 공개본을 가리켜도 되지만, 공개본은 개인 문서를 가리키지 않는다.
- 떼어 낼 것은 개인 문서로 가는 연결만이 아니다. 개인 맥락이 드러나는 문장(내 습관, 사용자 정보에서 온 내용)도 있다. AI가 공개본 초안을 만들고, 사용자가 보고 승인한 것만 공유 영역에 들어가게 한다. 지금의 "후보 → 승인" 흐름과 같다.
- 공개한 뒤 원본이 바뀌면 공개본을 다시 내고, 다시 낼 때마다 새 버전이 된다(`shared/ideas/doc-versioning.md`). 다시 낼지는 AI가 뷰어의 "처리할 일"로 제안하고 사용자가 정한다.

## 열린 질문

- 외부 공유 문서는 어디에 두고, 읽는 사람(팀, 바깥)을 어떻게 적을지.
