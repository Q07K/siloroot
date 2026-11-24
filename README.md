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

You can also ask Claude Code in plain words instead of typing the commands. This is handy where you don't open a separate terminal, such as the desktop app. Open the folder you want as your workspace as a project in Claude Code and say:

```text
Install the SiloRoot plugin in this project. The marketplace is Q07K/siloroot.
```

- Claude runs the two commands above in the open project folder. You don't need to give a path or `cd`. Depending on your permission settings, you may need to approve the command once.
- The conversation where you asked does not get the plugin. When the install finishes, open a new session in the same project and run `/siloroot:init`.
- Updates work the same way. Ask "Update the SiloRoot plugin in this project" and Claude runs `claude plugin update siloroot@siloroot --scope project`. Open a new session to apply it.

## Skills

| Skill | When |
| --- | --- |
| `/siloroot:init` | Turns the folder into a workspace. Creates only missing files and opens the viewer |
| `/siloroot:note` | Learn a technical concept through Q&A. Creates and extends study notes. When questions drift to a neighboring topic, splits it into its own note and links the two |
| `/siloroot:verify` | Say "검증해 줘" (verify me). Claude asks questions, grades your answers, and updates the verification log and understanding level |
| `/siloroot:feedback` | Processes comments and web edits left in the viewer, and records user-profile candidates (work habits and preferences Claude noticed). When you say "from now on, always …", Claude still writes a candidate first, takes your words as approval, and adds it to `05-profile/profile.md`. The hooks tell you when there is something to process |
| `/siloroot:update` | After you upgrade the plugin, brings the workspace up to the new version. Moves an older workspace layout to the new one (migration) and refreshes the managed block and guide documents. Shows the changes first, asks for approval, and keeps a backup so you can roll back |

One conversation can move freely between study, ideas, decisions, and projects. The conversation stays as it is; Claude looks at what kind of content came up, files it in the right folder, and links the documents to each other. The rules live in the workspace's `CLAUDE.md` block.

## Created files

Everything SiloRoot creates goes inside the project's `.siloroot/` folder. You read it through the viewer and Claude manages the files, so it sits one level down instead of mixing with your code. The team's shared `CLAUDE.md` and `.gitignore` are left alone.

| Path | Contents |
| --- | --- |
| `.siloroot/CLAUDE.md` | A SiloRoot block (folder map and rules). Everything outside the block is yours |
| `.siloroot/metadata-guide.md`, `writing-guide.md` | Document property conventions, writing rules |
| `.siloroot/01-log/` | Work log, open questions |
| `.siloroot/02-study/` | Study notes and the topic list (understanding levels) |
| `.siloroot/03-ideas/` | Ideas, projects you have started building, and their decision records |
| `.siloroot/04-feedback/` | Viewer comments, writing-rule candidates, user-profile candidates |
| `.siloroot/05-profile/` | Work habits and preferences you approved (`profile.md`). The rules block imports it, so every conversation uses it |
| `.siloroot/config.json`, `state/` | Settings (port, folder names, layout) and viewer output |
| `CLAUDE.local.md` | Loads the SiloRoot rules with one line, `@.siloroot/CLAUDE.md`. If the file exists, only the marked block is appended |
| `.ignore` | Lets Claude's search (ripgrep) find `.siloroot/` even though git ignores it (`!.siloroot/`). Viewer output stays out of search |
| Git exclude list (`.git/info/exclude`) | Keeps `.siloroot/`, `.ignore`, and `CLAUDE.local.md` out of commits in this clone only. Written only in a git repository |

- Paths inside documents (`related`, backtick paths) are relative to `.siloroot/`. Claude adds the `.siloroot/` prefix only when opening or searching files.
- `.git/info/exclude` is per clone, so run init again after cloning the project on another machine.
- Folders initialized with 0.1.x, where documents sit at the project root, keep working that way. init does not move them; `/siloroot:update` moves them into `.siloroot/` (see "Updating" below).

The templates and skill text are currently in Korean only.

## Updating

After you upgrade the plugin (`/plugin`), `/siloroot:update` brings the workspace in line with it. If the workspace is behind, a hook says so once at session start. It is not added to every message.

- The workspace records its layout number (`schema`) and the plugin version it was last brought up to (`plugin`) in `.siloroot/config.json`.
- When a version changes the layout, a migration moves things. Today there is one: layout 1 (the old style, documents at the project root) to layout 2 (documents wrapped in `.siloroot/`).
- The changes are shown first, and anything that needs a person's choice (content outside the block in the team `CLAUDE.md`, the top-level `.gitignore`, documents already committed to git, and so on) is asked one by one. Defaults are never picked without an answer.
- You can stay on the current layout instead. You then get only the managed-block refresh, and the notice for that layout stops (`hold` in `config.json`).
- Before changing anything it makes a backup in `.siloroot/state/backups/`. Say "되돌려 줘" (roll it back) to restore, newest backup first. If you edited files after the update, it stops and asks. Backups that changed the layout are never removed automatically; refresh-only backups keep the latest 5.

## Viewer

`http://127.0.0.1:<port from config.json>`. It is reachable only from this machine and makes no external network requests.

- On wide screens, the left sidebar (search and screen list) shares the background color and only the content sits on a rounded panel. The button at the top of the sidebar collapses it to an icon strip; hovering an icon shows its name. The magnifier in the collapsed strip expands the sidebar and puts the cursor in the search box. The collapsed state is remembered in the browser. At 760px wide or less, a top bar is used instead.
- When a document changes, the page redraws right away and briefly highlights new documents and new lines in yellow.
- The "나" (me) page opens with a usage radar computed from your own folder records: study depth (how many study notes passed verification), study breadth (distinct fields in study-note `tags`), follow-through (closed open questions and finished ideas), consistency (days with a record in the last 14), and AI training (rule and profile candidates you decided plus comments you closed in the last 30 days). Click an axis to see its formula, target and evidence. Next to it is an AI comment (`05-profile/ai-comment.md`, Claude's opinion, not approved information). A hook asks Claude to rewrite it in the first session after 9 a.m. each day, and the panel shows when it was last written and when the next update is due. Below that, each axis is compared with a week ago. Further down are the entries Claude currently uses about you, with their evidence: approved entries from `05-profile/profile.md`, pending and rejected user-profile candidates, and the writing rules. If an item is wrong, press "이건 아니에요" (that's not right) to leave a comment on it.
- The connection graph links documents through `related` properties and backticked paths. By default it shows every link type, common documents (guides, indexes, ledgers, logs), archived documents and unlinked documents. Folders are listed in a legend at the bottom left of the graph (click one to hide it), and the other switches sit behind the "필터" (filter) button at the top right, which shows how many are turned off. If a document is created or deleted while you are looking at the graph, its node and edges are added or removed without a reload. Documents are grouped by folder: each folder is its own small disk inside a circle (repulsion that weakens with distance, gravity that grows with distance, springs that stay loose around hubs, and collision): documents with more links inside the folder sit nearer the center, circles fit their dots tightly and keep apart, and you can drag a circle (or its name) to move the whole folder or drag a dot out to stretch it. Folder names are drawn above the lines. Titles appear from 150% zoom (or on hover), nodes never overlap, and "맞춤" (fit) frames everything visible. Lines curve around other nodes instead of crossing them (one smooth arc, bending at most 22% of the line length, otherwise straight), and the layout pushes nodes away from lines. Links between folders are drawn as bundles: they gather at the edge of the source circle, travel together along a shortest path that avoids other folder circles (grid search, then smoothed), and fan out to each document in the target folder while avoiding the other documents there. Hovering or selecting a document highlights its links along the same bundles. While you drag, the avoidance is skipped and recomputed when you let go, so dragging stays smooth. New links drawn during a live update no longer look cut off once their drawing animation ends.
- While Claude answers, the connection graph shows the documents it read or edited, in order. When two documents visited one after the other are already linked, that link fills with color from the first toward the second, the way new links are drawn (reads in the accent color, edits in the yellow color used for changed lines); documents that are not linked get no line, only their numbers, each node gets its visit numbers (`2·6` if it was visited twice), and the latest node pulses. A list at the bottom right, kept above the notification box, shows the order: three rows high, scrolling to the newest. Read, Edit, Write, MultiEdit and NotebookEdit count, and so does a Bash command that names a document path; Grep and Glob are left out. Hovering a node a subagent read shows "N번 · 서브에이전트가 읽음" (read by a subagent). The trail clears when you send a new message, and the "흔적" (trail) button below "맞춤" turns it off. If several sessions work in the same folder, the graph shows the one that moved last.

The hooks run only in folders that contain `.siloroot/config.json`. On session start they launch the viewer server and open it in the browser (unless a viewer tab is already open or the session restarted after compaction). If the viewer server already running for the folder is older than the installed plugin, they stop it and start the current one, so an upgrade takes effect without restarting the server by hand; when you send a message they tell you if there is feedback to process. If the workspace is behind the installed plugin, the session-start hook also tells you an update is available. For the reading trail, two background hooks (`"async": true`, so Claude never waits for them) append the document path after each tool call and clear the session's trail when you send a message. They write to `.siloroot/state/trail/<session>.jsonl` and keep only the time, the document path, read or edit, and the subagent id; trail files of other sessions unused for 7 days are removed. In a 0.1.x-style folder (documents at the project root) that already had a `.gitignore`, add `.siloroot/state/` to it yourself.

## Usage log

To find where SiloRoot is slow or uses many tokens, the plugin writes one JSON line per step to `.siloroot/state/metrics.jsonl`. It is on by default, stays on this machine, and is kept out of git with the rest of `state/`.

| Stage | What is measured |
| --- | --- |
| `turn:siloroot:<skill>` | A turn (one message and the whole response) that used a SiloRoot skill, by slash command or by Claude calling it |
| `turn:siloroot-docs` | A turn that read or wrote files under `.siloroot/` without a SiloRoot skill. If a SiloRoot skill was used earlier in the session, the summary groups it as `turn:siloroot-docs (siloroot:<skill> 뒤)`, so follow-up Q&A turns of `note` or `verify` stay visible |
| `turn:other` | Any other turn in the workspace, as a baseline |
| `hook:autostart`, `hook:notify-session`, `hook:notify-prompt`, `hook:metrics-turn` | Hook run time, including Node startup. The notify hooks also record how many characters they added to Claude's context |
| `script:init`, `script:update`, `script:build` (`:data-only`, `:seen`, `:seen-path`) | Script run time and document count |
| `context:always-loaded` | At session start, the length in characters of `.siloroot/CLAUDE.md` and `profile.md`, which Claude loads on every turn |

- Turn records come from a `Stop` hook. It reads the conversation transcript (`transcript_path` in the hook input) from where it stopped last time and adds up each response's `usage`: input, output, cache-read, and cache-write tokens. A response split over several lines is counted once by its message id. Subagent tokens (`<session>/subagents/`) go into a separate `sub` field. It also records how many characters each tool's results brought into the context (`resultChars`, by tool name) and how much of that came from tool calls on `.siloroot` (`docChars`), which shows what looking up documents costs. Only lengths are counted, never the content. The read position is kept per session in `.siloroot/state/metrics-cursor/`, so sessions running at the same time do not overwrite each other. If a position is lost and turns are logged twice, the summary counts each turn once.
- A record holds only stage names, timestamps, durations, token counts, tool names with counts and time, SiloRoot skill names, and the session id. No document text, prompts, file paths, or other plugins' skill names.
- If logging fails, the original work goes on. The `Stop` hook always exits 0 with no output.
- To turn it off, set `"metrics": false` in `.siloroot/config.json` or the environment variable `SILOROOT_METRICS=0`. At 5 MB the file moves to `metrics.1.jsonl` and a new one starts.

To see the summary, run the script in the plugin folder (for a marketplace install, `~/.claude/plugins/cache/<marketplace>/siloroot/<version>/`) from the project folder. `--days 7` limits it to the last week and `--json` prints the totals as JSON.

```powershell
node "<plugin folder>/scripts/metrics.mjs" . --days 7
```

It prints the stages that used the most time, tokens, and cost, then a table for turns (sorted by cost) and one for scripts and hooks.

- Cost is the API list price of each response (`lib/pricing.mjs`, prices as of 2026-11-03), subagents included. 1-hour cache writes and fast mode are priced as such. It is a relative figure for comparing stages, not what a subscription plan bills. Responses from models missing from the table are counted as unpriced.
- The cache-read share is how much of that cost went to re-reading the conversation from cache. Every tool call is a new request that reads the whole conversation again, so a large share means fewer calls would save the most.
- Work tokens are input + output + cache-write, subagents included. Cache-read tokens grow with conversation length, so they get their own column; their price is included in the cost above.
- A turn counts as a whole toward its stage. A message that used `/siloroot:note` and also did other work counts entirely as `turn:siloroot:note`, so per-skill numbers are approximate.
- Result characters are characters, not tokens. A Korean character is roughly one token or more.
- Turn time includes waiting for you. Answering a question or approving a permission prompt shows up as tool time (`AskUserQuestion`, `Edit`, `Write`, and so on).
- Tokens a background subagent spends after its turn has ended are not counted.

## Development

```powershell
npm test
claude plugin validate .
```

The privacy test reads banned words from `test/banned-words.local.txt` (one word per line), which is not committed. Without that file the test runs with no banned words.

The README exists in English (`README.md`) and Korean (`README.ko.md`). When you change one, change the other too.

## License

MIT

The viewer bundles the Pretendard variable font (`viewer/fonts/PretendardVariable.woff2`, Pretendard 1.3.9 by Kil Hyung-jin), licensed under the SIL Open Font License 1.1. See `viewer/fonts/LICENSE-Pretendard.txt`.
