---
type: idea
status: 진행 중
created: 2026-11-25
related: [shared/issues/graph-scale-limit.md, shared/conventions/glossary.md, shared/decisions/version-minor-on-schema.md, shared/decisions/graph-perf-by-computation.md, shared/decisions/graph-lines-on-canvas.md, shared/decisions/no-layered-canvas.md, shared/decisions/territory-push-real-shape.md, shared/ideas/territory-tangent-neck.md, shared/ideas/territory-fence.md, shared/ideas/home-workspace.md, shared/ideas/live-reading-graph.md, shared/issues/hidden-cluster-territory.md]
---

# 연결 그래프를 영토로 묶기

작업 공간을 모양 3(shared, private, 홈)으로 옮긴 뒤, 연결 그래프를 본 사용자가 "study가 안 보인다", "private 상위 폴더랑 shared 상위 폴더 그래프 표현을 다듬었으면 좋겠다. 각개전투하는 중이라 뭔지 잘 모르겠다"고 해서 시작했다. 용어(노드, 클러스터, 영토, 선, 다발, 문, 흔적)는 `shared/conventions/glossary.md`에 있다.

## 왜 (사용자)

연결 화면을 여는 쓰임은 셋이다.

1. 아이디어가 어떤 설계, 결정과 이어졌는지 본다.
2. Claude가 지금 어떤 문서를 읽고 있는지 흐름(흔적)을 본다.
3. 만들어지는 지식과 학습 정보를 다시 확인하고 학습하거나, 프로젝트가 그것을 잘 참조하는지 확인한다. 링크로 이어 두었는지와 Claude가 실제로 읽는지 둘 다 본다.

## 정한 것

- 홈 문서: 이 프로젝트 문서가 가리키는 홈 문서를 문서마다 노드로 그린다. 홈 전체를 끌어오지 않는다. 규칙과 안내 문서(`profile.md`, `writing-guide.md`, 폴더 README)는 지식이 아니라서 뺀다. (사용자, 규칙 문서 빼기는 AI 제안)
- 홈 쪽 클러스터 이름표는 다른 폴더처럼 경로로 쓴다: `home/study`. (사용자)
- 홈 노트 이름표 뒤에 이 프로젝트 문서 몇 개가 가리키는지(`← 4`)를 붙이고, 흔적이 홈 노트까지 이어진다. (사용자 "둘 다 보고 싶어")
- 홈 노트 이름표도 다른 노드와 같은 규칙(확대, 마우스 올림, 흔적)을 따른다. 늘 보이게 하지 않는다. (사용자 "공통 규칙 따라라")
- 영토는 9안처럼 클러스터 둘레를 영역 색으로 칠한 덩어리로 그린다. 사각형 판이나 완전한 원으로 하지 않는다. (사용자)
- 영역 바로 밑 문서(README)는 클러스터 없이 노드 하나로 같은 영토 안에 둔다. 영토 모양을 바꾸지 않는다. (사용자)
- 선은 노드, 클러스터, 다른 영토를 휘어서 피한다. 다른 영토로 가는 선은 영토 경계의 문에서 모였다가 나가고, 두 영토 사이는 나란한 띠(다발)로 흐른다. 한 줄로 겹치지 않는다. (사용자)
- 이름표끼리 겹치지 않게 하는 장치는 늘 보이는 이름표가 없어지면서 쓰지 않는다.

## 시안

브랜치 `feat/graph-areas`의 뷰어 코드에 `?v=번호`로 넣어 견줬다. 11안(클러스터 이름표 C안, 이름표 자리 3안)을 골라 정식 코드로 옮기고 다른 시안 코드는 지웠다(PR #32, 2026-11-25).

- 9안: 지금까지 정한 것을 모두 담은 기준 시안.
- 11안: 9안 + 공통 외접원으로 클러스터를 잇는 영토(`shared/ideas/territory-tangent-neck.md`).
- 1~8, 10안은 견주어 본 다른 방식(겹친 원, 사각형 판, 영역 원만, 색만, 판 순서, 둥근 덩어리, 방사형, 큰 글자)이고 고르지 않았다.

## 개선 아이디어

사용자가 노드, 클러스터, 영토 표현을 다듬을 아이디어를 하나씩 내고 있다. 아이디어가 나오면 먼저 여기에 적고(따로 설명할 만하면 문서를 나눈다), 그다음 시안을 만든다.

| 차례 | 아이디어 | 문서 | 상태 |
| --- | --- | --- | --- |
| 1 | 영토를 공통 외접원으로 잇는 연결 면으로(영토 하나에 반지름 R 하나, 영토끼리 겹치지 않게) | `shared/ideas/territory-tangent-neck.md` | 시안(11안) |
| 2 | 영토는 자기 노드와 클러스터를 늘 감싼다. 노드는 다른 클러스터에 못 들어간다 | `shared/ideas/territory-fence.md` | 시안(11안) |
| 3 | 클러스터 이름표를 클러스터의 일부로 친다. 노드는 다른 클러스터의 원과 이름표 자리에 못 들어가고, 클러스터끼리도 이름표 자리까지 떼어 놓는다. 이름표는 늘 원 위 가운데에 둔다(사용자: 옆으로 비켜 가는 것은 "툭 튀어나간다"). 새 규칙을 늘리지 않고 2번의 "다른 클러스터 금지"를 넓힌다 | 이 문서 | 시안 기본값(사용자가 고름) |

## 성능

측정값과 까닭은 결정 기록에 있다. 재는 법은 첫 결정 기록의 근거 절에 있다.

| 결정 | 요약 | 문서 |
| --- | --- | --- |
| 성능은 계산으로 푼다 | 문서 500개에서 열기 멈춤 10.7초 → 0.94초, 끌기 프레임 51 → 29ms | `shared/decisions/graph-perf-by-computation.md` |
| 선은 캔버스에 | 끌기 프레임 29 → 25ms | `shared/decisions/graph-lines-on-canvas.md` |
| 두 겹 캔버스는 쓰지 않는다 | 클러스터를 끌면 선 대부분이 움직여 이득이 없었다 | `shared/decisions/no-layered-canvas.md` |
| 영토 밀어내기는 실제 모양으로 | 멀리 있는 영토를 밀지 않고, 끌기 프레임 약 38 → 27ms | `shared/decisions/territory-push-real-shape.md` |

겪은 문제는 이슈로 남겼다: `shared/issues/territory-overlap-freeze.md`, `shared/issues/drag-release-lag.md`, `shared/issues/territory-tearing.md`, `shared/issues/hidden-cluster-territory.md`.

## 남은 것

- 영토 사이 24px(`AREA_GAP`)이 알맞은지 화면으로 보고 정하기. 예전(감싸는 원)보다 영토끼리 훨씬 가까이 붙을 수 있다.
- 영토가 붙어 있을 때 다른 영토로 가는 다발 줄기가 좁은 틈을 어떻게 지나는지 화면으로 확인하지 않았다.
- 흔적, 새 선 애니메이션이 캔버스 전환 뒤에도 그대로인지 화면으로 확인하지 않았다(마우스 올림 강조는 확인).
- 원을 끌어 옮길 때 영토와 다발이 잘 따라오는지 확인.
- 흔적 번호 하나가 노드를 옮긴 뒤 보이지 않는 문제.
- 끌기가 끝나고 자리가 다 잡힌 뒤 같은 영토 안 클러스터 이름표가 한두 쌍 다시 겹칠 수 있다(원을 노드에 다시 맞추며 벌린 자리가 되돌아가는 것으로 보임). 처음 열 때는 겹치지 않는다.
- 흔적 모드에서 문서 이름표끼리 겹친다.
- 문서가 하나도 없는 자리의 점선 원은 영토 모양에 들지 않아 노드가 그 위를 지날 수 있다.
