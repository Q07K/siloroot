
### 경로와 검색

이 작업 공간의 문서는 프로젝트의 `.siloroot/` 폴더 안에 있다. 프로젝트 맨 위의 `CLAUDE.local.md`가 이 파일을 불러온다.

- 이 블록과 문서에 적힌 경로(아래 폴더 이름, `related` 값, 백틱 경로)는 모두 `.siloroot/` 기준이다. 파일을 열거나 만들거나 검색할 때만 앞에 `.siloroot/`를 붙인다. 문서 안에 경로를 적을 때는 붙이지 않는다.
- `.siloroot/`는 바깥 코드 저장소의 git에서 빠져 있다(`.git/info/exclude`). 프로젝트 맨 위의 `.ignore`가 검색에서는 다시 찾게 하지만, SiloRoot 문서를 찾을 때는 검색 경로를 `.siloroot`로 준다.
- 바깥 코드 저장소에 SiloRoot 문서를 커밋하지 않는다. 팀의 `.gitignore`도 SiloRoot 때문에 고치지 않는다.
