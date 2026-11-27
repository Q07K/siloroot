---
type: idea
status: 진행 중
created: 2026-11-24
related: [shared/design/project-folder-layout-decision-design.md, shared/ideas/dev-project-use.md, shared/ideas/shared-private-areas.md, shared/ideas/doc-versioning.md, shared/ideas/project-unit.md, shared/ideas/home-workspace.md, shared/ideas/workspace-modes.md, shared/ideas/edge-meaning.md, shared/ideas/publish-copy.md, shared/ideas/implementation-check.md, shared/ideas/update-migration.md]
---

# 프로젝트 작업 공간의 폴더 구조

사용자가 "프로젝트용 문서 관리 폴더 구조는 어떻게 되어 있나"를 물어서, 여러 아이디어 문서에 흩어져 정한 것을 폴더 모양 하나로 모았다. 각 결정의 이유는 가리킨 문서에 있다.

## 지금까지 이야기한 것으로 그린 모습 (2판)

**확정 (2026-11-24, 사용자):** 지금 버전에서는 아래 2판으로 확정한다. 아직 만든 것은 없다.

```
<사용자가 init한 폴더>/.siloroot/
  shared/                 git에 올라감 (팀과 공유)
    issues/               문제: 작업 중 이슈, 인터뷰에서 나온 사용자 문제. 해결되면 그대로 작업 지식
    ideas/                제품 아이디어 (문제에서 나온 것 포함)
    decisions/            결정 (미팅에서 정한 것 포함)
    conventions/          컨벤션과 정책 (구현 점검의 기준)
    design/               설계서
    roadmap/              로드맵, 해결 절차
    publish/              공개본: 팀 공개 아카이브, 외부 공유 문서, 미팅 정리본
    <문서>.versions/      지난 버전. 최신본은 늘 같은 경로
  private/                git에서 빠짐 (나만)
    sources/              원자료: 미팅 기록, 사용자 인터뷰
    notes/                이 프로젝트에 대한 내 메모
    discussions/          AI와 의견을 주고받은 과정
    feedback/             뷰어 댓글
  config.json
  state/                  뷰어 생성물, 사용 기록, 점검 결과

<홈>/                     사람마다 하나, 프로젝트 밖
  study/                  공부 노트 (개념). "만난 곳"으로 프로젝트의 issues를 가리킴
  ideas/                  개인 아이디어
  profile.md, writing-guide.md
```

**만들기 시작 (2026-11-24):** 이 구조를 플러그인에 넣고 옛 작업 공간을 옮기는 마이그레이션 `002`의 설계를 `shared/design/project-folder-layout-decision-design.md`에 썼다. 거기서 `private/log/`(작업 기록 자리)를 더했다.

## 문서끼리 잇는 법

선은 나중에 생긴 쪽 문서의 프론트매터에 적고, 뷰어가 거꾸로도 보여 준다(`shared/ideas/edge-meaning.md`).

```
private/sources/인터뷰 ──낳음──▶ shared/issues/문제 ──계기(from)──▶ ideas/ · decisions/ · conventions/ · roadmap/
                                       ▲                              │
              홈 study ──만난 곳(met_in)                     근거(basis) ──▶ issues/, design/
```

- **정함 (2026-11-24, 사용자):** 원자료(`sources/`)는 개인 영역에 둔다. 사용자가 "미팅 기록 원자료를 shared로 하는 게 맞나"를 짚어 고쳤다. 인터뷰 원문에는 인터뷰이의 개인 정보와 날것의 말이 있고, 미팅 기록에는 정리되지 않은 의견과 사람 이름이 있다. git에 한 번 올라가면 지워도 기록에 남는다. 팀에 나가는 것은 원자료가 아니라 거기서 나온 이슈, 결정, 그리고 필요하면 미팅 정리본(공개본)이다.
- 원자료와 이슈를 잇는 선은 원자료 쪽에 적는다(`produced: [shared/issues/…]`). "나중에 생긴 쪽에 적는다"의 예외로, 공유 문서는 팀원이 볼 수 없는 개인 문서를 가리키지 않는다는 한 방향 원칙이 앞선다. 이슈 문서 본문에는 "2026-11-25 사용자 인터뷰 3번"처럼 출처를 글로만 적는다.

- 이슈는 다른 문서가 생겨나는 출발점이다. 결정, 컨벤션, 아이디어, 로드맵 항목에 `from: [shared/issues/…]`를 적는다.
- 결정에서 `계기` 선을 거꾸로 따라가면 어떤 문제 때문이었고 원인이 무엇이었는지 나온다(원하는 것 4번).
- 이슈 문서는 해결되면 그대로 작업 지식이 되므로, 작업 지식 폴더를 따로 두지 않는다(1판의 `knowledge/`를 `issues/`로 합침).

| 원칙 | 정한 곳 |
| --- | --- |
| 프로젝트 단위는 사용자가 init한 폴더. 위아래로 겹치면 상위는 하위를 다 보고, 하위는 상위를 흐린 점으로 본다 | `shared/ideas/project-unit.md` |
| 공유 영역과 개인 영역으로 나눈다 | `shared/ideas/shared-private-areas.md` |
| 공유 영역 문서는 버전 파일로 지난 버전을 남긴다 | `shared/ideas/doc-versioning.md` |
| 개인 문서를 팀에 내려면 개인 의존성을 뗀 공개본을 새로 만든다 | `shared/ideas/publish-copy.md` |
| 공부의 개념은 홈, 사건은 프로젝트로 | `shared/ideas/workspace-modes.md`, `shared/ideas/home-workspace.md` |
| 선 종류는 프론트매터 키, 설명은 본문 | `shared/ideas/edge-meaning.md` |

## 이슈 (사용자와 이야기한 것)

- 프로젝트를 하며 생긴 이슈를 적을 자리가 없어 오늘 이슈들이 채팅, PR 본문, 논의 기록에 흩어졌다.
- 이슈는 아이디어가 아니다. 사용자 인터뷰에서 나온 문제를 등록해도 아이디어로 들어가면 안 된다. 문제 폴더를 따로 둔다.
- 이슈 하나에 문서 하나, 상태는 열림, 원인 찾음, 해결, 안 함. 출처(작업 중, 사용자 인터뷰, 뷰어 피드백)를 적는다.
- 이슈에서 아이디어, 결정, 컨벤션 등이 나온다.

## 열린 질문

- 위 2판의 폴더 이름과 나눔이 맞는지.
- 컨벤션과 정책을 한 폴더에 둘지.
- 개인 사용자가 혼자 쓰는 프로젝트에서도 `shared/`를 둘지.
- 뷰어에 `issue` type과 상태 값을 더하는 일(지금은 정해진 type만 받는다).
