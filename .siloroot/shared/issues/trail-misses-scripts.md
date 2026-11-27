---
type: issue
status: 열림
created: 2026-11-25
related: [shared/ideas/live-reading-graph.md, shared/architecture.md]
---

# 스크립트나 PowerShell로 읽고 고친 문서가 흔적에 남지 않는다

## 겪은 일

2026-11-25에 속성 경고 50개를 정리하면서, Claude가 node 스크립트 하나로 공유 문서 26개와 논의 기록 등 4개를 읽고 고쳤다. 연결 그래프의 흔적에는 경로를 명령에 직접 적은 `sed` 몇 줄만 남았고, 그마저 "고침"이 아니라 "읽음"으로 남았다. 사용자가 "파워쉘이나 코드로 만들어서 읽어 버리면 웹뷰 흔적이 안 남지?"라고 물어 확인했다.

## 원인

흔적 훅(`hooks/hooks.json`의 PostToolUse → `scripts/trail.mjs` → `lib/trail.mjs`)은 도구 호출의 입력만 본다.

| 어떻게 읽고 고쳤나 | 흔적 |
| --- | --- |
| Read | 읽음 |
| Edit, Write, MultiEdit, NotebookEdit | 고침 |
| Bash, 명령 글자에 있는 `.md` 경로 | 읽음으로만(`sed -i`로 고쳐도 읽음) |
| Bash로 스크립트 실행 | 안 남음. 스크립트 안에서 읽고 고친 문서는 명령 글자에 없다 |
| PowerShell 도구 | 안 남음. 훅의 matcher에 PowerShell이 없다 |
| Grep, Glob | 안 남음(일부러 뺐다) |

## 해결

아직 없다. 생각한 방법:

1. 고침은 파일 변화로 잡는다. 뷰어 서버가 이미 문서 폴더를 감시하므로(`viewer/serve.mjs`), 답하는 동안 바뀐 문서를 흔적에 "고침"으로 더한다. 어떤 도구나 스크립트로 고쳤든 잡힌다.
2. PowerShell도 Bash처럼 본다. matcher에 PowerShell을 더하고, 명령 글자에서 경로를 찾는 방식(`docPathsInCommand`)을 같이 쓴다.
3. 스크립트가 안에서 읽기만 한 문서는 파일이 바뀌지 않아 바깥에서 알 수 없다. 1, 2를 해도 남는 한계다.

## 다시 안 나게

고친 뒤 정한다. 그때까지 Claude가 문서를 여럿 고칠 때 스크립트를 쓰면 흔적이 빠진다는 것을 알고 있어야 한다.
