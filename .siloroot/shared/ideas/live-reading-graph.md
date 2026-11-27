---
type: idea
status: 완료
created: 2026-11-24
related: [shared/issues/trail-misses-scripts.md, shared/design/live-reading-graph-decision-design.md, shared/plans/live-reading-graph-decision-plan.md, shared/issues/codex-support-missing.md, shared/ideas/reuse-evidence.md]
---

# 연결 그래프에 Claude가 지금 읽는 문서 표시하기

작업 중에 뷰어의 연결 화면을 열어 두는 사용자가 제안했다. 논의 과정은 private/discussions/2026-11-24-live-reading-graph.md에 있다.

Codex에서 같은 흐름을 시험한 결과는 `shared/issues/codex-support-missing.md`에 있다.

## 왜

사용자 제안: Claude가 문서를 읽을 때 지금 어떤 문서를 읽고 있는지 연결 그래프에서 실시간으로 보고 싶다.

**2026-11-24, 사용자:** 거쳐 간 문서가 순서대로 흔적으로 남으면 좋겠다. 도구를 부를 때마다 느려지는 것은 피하고 싶다.

## 만드는 방법

**2026-11-24, 사용자:** A(백그라운드 훅)로 한다. 흔적은 새 메시지를 보낼 때 지운다.

| 방법 | 느려짐 | 장단점 |
| --- | --- | --- |
| A. 백그라운드 훅: `PostToolUse` 훅에 `"async": true` | Claude가 기다리지 않음. 뒤에서 node가 한 번씩 뜸 | 공식 문서에 있는 방식. 서브에이전트가 부른 것도 잡힌다. 도구가 끝난 뒤에 알린다. 뷰어가 꺼져 있어도 기록이 남는다 |
| B. 뷰어 서버가 대화 기록(JSONL)을 직접 따라 읽기 | 도구 호출마다 붙는 것이 없음 | 기록 파일 형식이 Claude Code 내부 형식이라 바뀌면 깨진다(지금 `lib/transcript.mjs`도 같은 위험을 지고 있다). 서브에이전트 기록은 다른 파일이라 따로 봐야 한다 |
| C. 지금처럼 기다리는 훅 | 호출마다 수십 ms | 빼기로 함 |

AI 추천: A. 공식 방식이라 덜 깨지고, 느려짐은 B와 체감 차이가 없다.

훅 공부(home:study/claude-code-hooks.md)에서 더 본 것:

- 훅에는 `http` 방식도 있다. 사건을 주소로 바로 POST하므로 node를 띄우지 않는다. 다만 뷰어가 꺼져 있으면 흔적이 남지 않고, 플러그인 훅 설정에 뷰어 주소(포트)를 어떻게 넣을지 확인해야 한다.
- `InstructionsLoaded` 사건은 `CLAUDE.md`를 불러올 때 일어난다. 자동으로 불러오는 문서도 흔적에 넣을 수 있을지 모른다.

**2026-11-24, 사용자:** 시안대로 만든다. 설계는 `shared/design/live-reading-graph-decision-design.md`, 구현 계획은 `shared/plans/live-reading-graph-decision-plan.md`.

## 시안

`shared/ideas/live-reading-graph-mockup.gif` (움직이는 모습). 실제 뷰어 화면(이 작업 공간의 연결 그래프)에 `shared/ideas/live-reading-graph-mockup.js`를 덧붙여 장면마다 찍은 것이다. 흔적은 뷰어에 이미 있는 모양을 그대로 쓴다.

- 읽음은 뷰어 강조색(`--accent`, 고른 점의 선 색), 고침은 바뀐 줄에 쓰는 노란 띠 색(`--flash-bar`)
- 화살표는 쓰지 않는다. 방향은 뷰어의 새 선(`path.born`)처럼 출발 문서에서 도착 문서 쪽으로 색이 차오르는 것으로 보인다(0.3초 뒤 0.9초). 색이 다 차면 도착 문서의 둘레가 켜진다
- 가장 최근 점은 새 점처럼 둘레가 퍼진다
- 순서 목록은 점을 골랐을 때 뜨는 정보 상자(`.ginfo`) 모양으로 오른쪽 아래에 둔다(왼쪽 위는 폴더 원을 가린다)
  - 알림 상자(`#toast`)는 창 오른쪽 아래 16px에 고정이라 목록 상자와 겹친다. 목록 상자를 알림 상자가 뜨는 자리(아래 여백 16px + 한 줄 44px + 사이 12px)보다 위로 올린다(사용자 요청)
  - 제목, 설명, 개수는 고정하고 목록만 스크롤한다. 목록 높이는 항목 3개(한 줄 28px)로 고정해, 비었을 때도 상자 크기가 같다(사용자 요청)
  - 새 항목이 생기면 목록을 맨 아래(가장 최근)로 부드럽게 내린다(사용자 요청)
- "흔적" 켜고 끄기는 오른쪽 도구 줄의 "맞춤" 아래 단추
- 서브에이전트 표시는 뷰어 이름표(`.tip`), 비웠다는 알림은 뷰어 알림 상자(`#toast`)

## 지금 코드로 본 것

- 뷰어 서버(`viewer/serve.mjs`)는 이미 `/events`로 화면에 실시간 알림을 보낸다. 지금은 문서 파일이 바뀔 때만 보낸다.
- 연결 그래프(`viewer/template.html`의 `graphLiveUpdate`)는 알림을 받으면 새로 고치지 않고 점과 선만 고친다.
- 새 문서나 새 연결은 파일이 저장된 뒤에야 보인다. 서버가 파일 변경을 감시하다가(`fs.watch`) 0.4초 모아서 알리고, 그래프는 그때 `/data`를 다시 받아 점과 선을 더한다. Claude는 글을 다 지은 뒤 Write나 Edit로 한 번에 저장하므로, 쓰는 도중은 보이지 않는다.
- 빠진 것은 "Claude가 어떤 파일을 열었다"는 신호다. 파일을 읽기만 하면 파일이 바뀌지 않으니 지금 감시로는 잡히지 않는다.
- Claude Code 훅(`PreToolUse`/`PostToolUse`)은 Read, Grep, Edit 같은 도구를 쓸 때마다 경로를 넘겨준다. 이 훅이 서버에 알리고, 서버가 `/events`로 그래프에 넘기면 된다.

## 걸리는 것

- 대화 시작 때 `CLAUDE.md`, `profile.md`처럼 자동으로 불러오는 파일은 도구 호출이 아니라서 잡히지 않는다.
  - 2026-11-24 확인: `InstructionsLoaded` 훅 입력에는 불러온 파일 경로(`file_path`)가 있고 `@` 가져오기에도 일어난다(`load_reason: "include"`). 그런데 이 훅은 백그라운드(`"async": true`)로 걸면 돌지 않는다. 기다리는 훅으로 걸면 지시 파일을 불러올 때마다 node가 한 번씩 떠서 느려지고, 대화 시작 때 불러온 것은 첫 메시지의 비우기로 어차피 지워진다. 그래서 흔적에 넣지 않았다.
- 지금 서버의 쓰기 요청은 뷰어 화면에서 온 것만 받는다(`trusted`). 훅이 알리려면 다른 통로(상태 폴더의 파일, 또는 토큰)가 필요하다.
- 도구를 쓸 때마다 node가 한 번 더 뜬다. 한 번에 수십 ms 정도 늦어진다.
