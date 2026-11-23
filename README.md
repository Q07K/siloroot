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

### Let Claude do it

You can also ask Claude Code in plain words instead of typing the commands. This is handy where you don't open a separate terminal, such as the desktop app.

```text
Install the SiloRoot plugin in C:\work\notes. The marketplace is Q07K/siloroot.
```

- Claude runs the two commands above in that folder. Depending on your permission settings, you may need to approve the command once.
- The conversation where you asked does not get the plugin. When the install finishes, open Claude Code in that folder and run `/siloroot:init`.
- Updates work the same way. Ask "Update the SiloRoot plugin in C:\work\notes" and Claude runs `claude plugin update siloroot@siloroot --scope project`. Open a new session in that folder to apply it.

## Skills

| Skill | When |
| --- | --- |
| `/siloroot:init` | Turns the folder into a workspace. Creates only missing files and opens the viewer |
| `/siloroot:note` | Learn a technical concept through Q&A. Creates and extends study notes. When questions drift to a neighboring topic, splits it into its own note and links the two |
| `/siloroot:verify` | Say "검증해 줘" (verify me). Claude asks questions, grades your answers, and updates the verification log and understanding level |
| `/siloroot:feedback` | Processes comments and web edits left in the viewer, and records user-profile candidates (work habits and preferences Claude noticed). When you say "from now on, always …", Claude still writes a candidate first, takes your words as approval, and adds it to `05-profile/profile.md`. The hooks tell you when there is something to process |

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

- On wide screens, the left sidebar (search and screen list) shares the background color and only the content sits on a rounded panel. The button at the top of the sidebar collapses it to an icon strip; hovering an icon shows its name. The magnifier in the collapsed strip expands the sidebar and puts the cursor in the search box. The collapsed state is remembered in the browser. At 760px wide or less, a top bar is used instead.
- When a document changes, the page redraws right away and briefly highlights new documents and new lines in yellow.
- The "나" (me) page opens with a usage radar computed from your own folder records: study depth (how many study notes passed verification), study breadth (distinct fields in study-note `tags`), follow-through (closed open questions and finished ideas), consistency (days with a record in the last 14), and AI training (rule and profile candidates you decided plus comments you closed in the last 30 days). Click an axis to see its formula, target and evidence. Next to it is an AI comment (`05-profile/ai-comment.md`, Claude's opinion, not approved information). A hook asks Claude to rewrite it in the first session after 9 a.m. each day, and the panel shows when it was last written and when the next update is due. Below that, each axis is compared with a week ago. Further down are the entries Claude currently uses about you, with their evidence: approved entries from `05-profile/profile.md`, pending and rejected user-profile candidates, and the writing rules. If an item is wrong, press "이건 아니에요" (that's not right) to leave a comment on it.
- The connection graph links documents through `related` properties and backticked paths. By default it shows every link type, common documents (guides, indexes, ledgers, logs), archived documents and unlinked documents. Folders are listed in a legend at the bottom left of the graph (click one to hide it), and the other switches sit behind the "필터" (filter) button at the top right, which shows how many are turned off. If a document is created or deleted while you are looking at the graph, its node and edges are added or removed without a reload. Documents are grouped by folder: each folder is its own small disk inside a circle (repulsion that weakens with distance, gravity that grows with distance, springs that stay loose around hubs, and collision): documents with more links inside the folder sit nearer the center, circles fit their dots tightly and keep apart, and you can drag a circle (or its name) to move the whole folder or drag a dot out to stretch it. Folder names are drawn above the lines. Titles appear from 150% zoom (or on hover), nodes never overlap, and "맞춤" (fit) frames everything visible. Lines curve around other nodes instead of crossing them (one smooth arc, bending at most 22% of the line length, otherwise straight), and the layout pushes nodes away from lines. Links between folders are drawn as bundles: they gather at the edge of the source circle, travel together along a shortest path that avoids other folder circles (grid search, then smoothed), and fan out to each document in the target folder while avoiding the other documents there. Hovering or selecting a document highlights its links along the same bundles. While you drag, the avoidance is skipped and recomputed when you let go, so dragging stays smooth. New links drawn during a live update no longer look cut off once their drawing animation ends.

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
