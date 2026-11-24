# SiloRoot 개발 규칙

이 저장소는 SiloRoot 플러그인 자체의 코드다. 플러그인이 작업 공간에 넣는 규칙은 `templates/`에 있고, 이 파일은 이 저장소를 고칠 때의 규칙이다.

## 작업 흐름: 작업 하나에 브랜치 하나, PR로 머지

1. `main`에 바로 커밋하거나 푸시하지 않는다.
2. 작업을 시작할 때 최신 `main`에서 브랜치를 딴다. 이름은 `feat/…`, `fix/…`, `docs/…`, `chore/…` 중 하나로, 무엇을 하는지 드러나게 짓는다.
3. 작업 하나가 끝나면 아래 "올리기 전 확인"을 하고, 브랜치를 푸시해 PR을 연다. 서로 관계없는 작업은 한 PR에 섞지 않는다.
4. PR 본문에는 무엇을 왜 바꿨는지, 확인한 것, 확인하지 못한 것을 적는다.
5. 바뀐 내용을 PR에서 검토하고, 사용자가 승인하면 merge commit으로 머지한다(`gh pr merge <번호> --merge --delete-branch`). 합쳐진 브랜치는 원격과 로컬 모두 지우고, 머지 뒤 로컬 `main`을 당겨 온다. squash와 rebase는 쓰지 않는다.

## 올리기 전 확인

- `npm test`와 `claude plugin validate .`를 실행한다. 실패가 있으면 이번 변경 때문인지 원래 있던 것인지 가려 PR에 적는다.
- 개인 정보 검사: 테스트가 `test/banned-words.local.txt`(git에 올리지 않음)의 금지어로 템플릿, 스킬, README를 검사한다. 커밋 기록과 PR 본문에도 실명, 회사, 고객사 이름을 쓰지 않는다.
- 기능이나 템플릿이 바뀌면 `.claude-plugin/plugin.json`과 `package.json`의 버전을 함께 올린다.
- 폴더 배치, 문서 위치, 속성 값, 설정 모양이 바뀌면 `SCHEMA`(`lib/config.mjs`)를 올리고 `lib/migrations/`에 마이그레이션과 테스트를 함께 낸다.
- 관리 블록이나 안내 문서 템플릿만 바뀌면 `SCHEMA`는 그대로 둔다. `/siloroot:update`의 맞추기가 맡는다.
- README는 영어(`README.md`)와 한국어(`README.ko.md`) 두 벌이다. 한쪽을 고치면 다른 쪽도 고친다.

## 저장소 설정

- 커밋 작성자는 이 저장소의 git 설정대로 `Q07K` noreply 주소를 쓴다.
- `gh`를 쓰기 전에 인증 계정이 `Q07K`인지 확인한다.
