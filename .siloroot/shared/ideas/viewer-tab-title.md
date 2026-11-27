---
type: idea
status: 완료
created: 2026-11-24
related: [shared/ideas/project-unit.md]
---

# 뷰어 탭 제목에 프로젝트 이름 넣기

`shared/ideas/project-unit.md`에서 프로젝트가 여럿일 때를 이야기하다가 나왔다. 논의 과정은 private/discussions/2026-11-24-init-modes.md에 있다.

## 왜

사용자 제안: 프로젝트마다 init하면 훅이 있어 프로젝트를 열 때마다 뷰어가 브라우저로 열린다. 어느 탭이 어느 프로젝트인지 헷갈리니 브라우저 제목에 프로젝트 이름을 함께 적는다.

지금은 모든 뷰어의 제목이 `SiloRoot` 하나로 같다(`viewer/template.html`의 `<title>`).

## 정한 것

**2026-11-24, 사용자:** 지금 만든다.

- 제목은 `<프로젝트 폴더 이름> · SiloRoot`. 탭이 좁아지면 뒤쪽이 잘리니 이름을 앞에 둔다.
- 이름은 뷰어가 이미 데이터에 넣던 프로젝트 폴더 이름(`root`)을 쓴다. 폴더 이름이 없으면 `SiloRoot`만.

## 진행

- 브랜치 `fix/viewer-title-project-name`(버전 0.2.1). `viewer/template.html`의 제목 자리를 `viewer/build.mjs`가 채우고, 테스트를 하나 더했다.
- `npm test`: 60개 중 59개 통과. 실패 1개는 포트 4180을 이미 쓰는 중이라 나는 포트 테스트로, `main`에서도 같다.
- PR #20을 열었다. 2026-11-24 사용자 승인으로 merge commit으로 머지했다(0.2.1). PR #19도 버전을 올리므로 머지할 때 버전을 맞춘다.

## 열린 질문

- 홈 작업 공간이 생기면 홈은 `홈 · SiloRoot`로 할지(홈이 만들어질 때 정한다).
