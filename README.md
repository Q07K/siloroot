# SiloRoot

**English** | [한국어](README.ko.md)

A Claude Code plugin that gathers notes scattered across tools (silos) into one folder of Markdown files (the root). The Markdown files are the source of truth: people read them in a local viewer, and the AI reads and writes the files directly. This is an early version (v0).

## Requirements

- Claude Code
- Node.js on your `PATH` (the hooks and the viewer run with `node`)

## Install

```powershell
claude plugin marketplace add Q07K/siloroot
cd <folder to use as your workspace>
claude plugin install siloroot@siloroot --scope project
```

To use a local clone instead, replace the first line with `claude plugin marketplace add <path to the clone>`.

Then open Claude Code in that folder and run `/siloroot:init`.

## Skills

| Skill | When |
| --- | --- |
| `/siloroot:init` | Turns the folder into a workspace. Creates only missing files and opens the viewer |
| `/siloroot:note` | Learn a technical concept through Q&A. Creates and extends study notes. When questions drift to a neighboring topic, splits it into its own note and links the two |
| `/siloroot:verify` | Say "검증해 줘" (verify me). Claude asks questions, grades your answers, and updates the verification log and understanding level |
| `/siloroot:feedback` | Processes comments and web edits left in the viewer, and records user-profile candidates (work habits and preferences Claude noticed). The hooks tell you when there is something to process |

One conversation can move freely between study, ideas, decisions, and projects. The conversation stays as it is; Claude looks at what kind of content came up, files it in the right folder, and links the documents to each other. The rules live in the workspace's `CLAUDE.md` block.

## Created files

| Path | Contents |
| --- | --- |
| `CLAUDE.md` | A SiloRoot block (folder map and rules). Everything outside the block is yours |
| `metadata-guide.md`, `writing-guide.md` | Document property conventions, writing rules |
| `01-log/` | Work log, open questions |
| `02-study/` | Study notes and the topic list (understanding levels) |
| `03-ideas/` | Ideas, projects you have started building, and their decision records |
| `04-feedback/` | Viewer comments, writing-rule candidates, user-profile candidates |
| `05-profile/` | Work habits and preferences you approved (`profile.md`). `CLAUDE.md` imports it, so every conversation uses it |
| `.siloroot/` | Settings (`config.json`: port, folder names) and viewer output (`state/`) |

The templates and skill text are currently in Korean only.

## Viewer

`http://127.0.0.1:<port from config.json>`. It is reachable only from this machine and makes no external network requests.

- When a document changes, the page redraws right away and briefly highlights new documents and new lines in yellow.
- The "나" (me) page shows what Claude currently uses about you, with the evidence for each item: approved entries from `05-profile/profile.md`, pending and rejected user-profile candidates, and the writing rules. There are no scores or ratings. If an item is wrong, press "이건 아니에요" (that's not right) to leave a comment on it.
- The connection graph links documents through `related` properties and backticked paths. If a document is created or deleted while you are looking at the graph, its node and edges are added or removed without a reload.

The hooks run only in folders that contain `.siloroot/config.json`. On session start they launch the viewer server and open it in the browser (unless a viewer tab is already open or the session restarted after compaction); when you send a message they tell you if there is feedback to process. If the folder already has a `.gitignore`, add `.siloroot/state/` to it yourself.

## Development

```powershell
npm test
claude plugin validate .
```

The privacy test reads banned words from `test/banned-words.local.txt` (one word per line), which is not committed. Without that file the test runs with no banned words.

The README exists in English (`README.md`) and Korean (`README.ko.md`). When you change one, change the other too.

## License

MIT
