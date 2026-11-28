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

### Use from Codex

In an existing SiloRoot workspace, Codex follows the SiloRoot workspace rules too, and the connection graph can show document activity from Codex shell reads and `apply_patch` edits.

```powershell
codex plugin marketplace add Q07K/siloroot
codex plugin add siloroot@siloroot
```

To test a local checkout, use its absolute path in place of the GitHub repository in the first command. Review and trust the SiloRoot hooks in **Settings → Hooks** in the Codex desktop app or with `/hooks` in the CLI. Open a new session in the workspace and select **Connections → Trail** in the running SiloRoot viewer. [Codex hooks documentation](https://developers.openai.com/codex/hooks#review-and-trust-hooks)

If the viewer is stopped, run `node "<SiloRoot plugin folder>/viewer/serve.mjs" "<workspace folder>"`. A new message clears the current Codex session's trail.

A Codex session in a layout 3 or later project also gets the project's conventions at session start, the same way as in Claude Code (see the hook notes under "Viewer"). Codex caps hook output at about 2,500 tokens, so above 3,000 characters it gets the list of convention documents instead of their text.

Codex does not read `CLAUDE.local.md`, so the SiloRoot workspace rules (`.siloroot/CLAUDE.md`, or `CLAUDE.md` in the home) reach it in two ways.

- A session start hook adds the rules, plus the profile that their `@` line points to, to the context. This hook raises its output limit (`additionalContextLimit`) to 12,000 tokens. It runs only after you trust it.
- `/siloroot:init` and `/siloroot:update` add a SiloRoot managed block to the Codex global instructions (`~/.codex/AGENTS.md`, following `CODEX_HOME`, or `AGENTS.override.md` if that file is in use). The block is a short note: in a SiloRoot folder, read the rules file first, and "write it up as a document" means a Markdown document. It covers the case where the hooks are not trusted. Text outside the block is left alone, and nothing is created when there is no Codex folder.

## Skills

| Skill | When |
| --- | --- |
| `/siloroot:init` | Turns the folder into a workspace. Creates only missing files and opens the viewer |
| `/siloroot:note` | Learn a technical concept through Q&A. Creates and extends study notes. When questions drift to a neighboring topic, splits it into its own note and links the two |
| `/siloroot:verify` | Say "검증해 줘" (verify me). Claude asks questions, grades your answers, and updates the verification log and understanding level |
| `/siloroot:feedback` | Processes comments and web edits left in the viewer, and records user-profile candidates (work habits and preferences Claude noticed). When you say "from now on, always …", Claude still writes a candidate first, takes your words as approval, and adds it to your profile (`profile.md` in your home). The hooks tell you when there is something to process, including candidates waiting in your home |
| `/siloroot:update` | Gets a new plugin version (asks first), refreshes the managed block and guide documents in the workspace and the home, restarts the viewer servers on the new version, and shows what changed in that version. Run it whenever a new version is out |
| `/siloroot:migrate` | Moves an older workspace layout to the new one (migration). Only needed when a version changes the layout. Shows the changes first, asks for approval, and keeps a backup so you can roll back |

One conversation can move freely between study, ideas, decisions, and projects. The conversation stays as it is; Claude looks at what kind of content came up, files it in the right folder, and links the documents to each other. The rules live in the workspace's `CLAUDE.md` block.

## Created files

SiloRoot keeps two kinds of workspace (layout 4, from 0.8.0):

- **Project**: inside each project's `.siloroot/` folder. A shared area (`shared/`) holds what the team can see; a private area (`private/`) holds what only you see.
- **Home**: one per person, by default `<user folder>/siloroot-home`. It holds what spans projects: study notes, personal ideas, your profile and writing rules. The first `/siloroot:init` in a project asks where to put it and creates it.

The home location and the list of projects are kept in `~/.siloroot/user.json`. The team's shared `CLAUDE.md` and `.gitignore` are left alone.

### Project

| Path | Contents |
| --- | --- |
| `.siloroot/CLAUDE.md` | A SiloRoot block (a table of places and rules). Everything outside the block is yours |
| `.siloroot/metadata-guide.md` | Document property conventions for the project |
| `.siloroot/shared/` | `roadmap.md` (what you decided to build: now, next, later), `architecture.md` (the current structure on one page), `requirements/` (one per feature), `ideas/` (product ideas), `decisions/` (decisions and where they are applied), `design/`, `plans/` (implementation plans), `issues/`, `conventions/` (including the glossary, `glossary.md`). Shows in `git status`; you decide what to commit |
| `.siloroot/private/` | `worklog/` (a work log, one document per day), `open-questions.md` (things to confirm), `sources/`, `notes/`, `discussions/`, `feedback/` (viewer comments) |
| `.siloroot/config.json`, `state/` | Settings (port, layout) and viewer output |
| `CLAUDE.local.md` | Loads the SiloRoot rules with one line, `@.siloroot/CLAUDE.md`. If the file exists, only the marked block is appended |
| `.ignore` | Lets Claude's search (ripgrep) find `.siloroot/` even though git ignores it (`!.siloroot/`). Viewer output stays out of search |
| Git exclude list (`.git/info/exclude`) | Keeps `.siloroot/` except `shared/`, plus `.ignore` and `CLAUDE.local.md`, out of commits in this clone only. Written only in a git repository |

### Home

| Path | Contents |
| --- | --- |
| `CLAUDE.md`, `metadata-guide.md` | The home's rules block and property conventions |
| `study/` | Study notes and the topic list (understanding levels). Concepts learned in any project go here; what happened in a project goes to that project's `shared/issues/` |
| `ideas/` | Personal ideas (ones you called personal), with their decisions, designs and plans next to them |
| `feedback/` | Writing-rule and user-profile candidates from every project, and comments on home documents |
| `worklog/`, `open-questions.md` | A work log, one document per day; things to confirm |
| `profile.md`, `ai-comment.md`, `writing-guide.md` | Approved work habits and preferences (every project's rules block imports this), the "나" (me) page comment, writing rules |

- Every place folder has a `README.md`: what goes in, what does not (and where it goes instead), file names, statuses and a template. The viewer graph draws places with no documents as faint circles.
- Each kind of event in a conversation has a document to go to: a decision goes to a decision record, a problem to an issue, measurements to the decision they support, something you decided to build to the roadmap and a requirement, and a new topic to a new discussion. The rules are in the block's "흐름 나누기" (splitting the flow) section.
- Paths inside documents (`related`, backtick paths) are relative to the workspace's document root (`.siloroot/` in a project). Home documents are written `home:study/a.md`, another project's documents `<name>:shared/issues/x.md`; names come from `user.json`.
- Shared documents should not point at private or home documents your teammates cannot see. The viewer's property check warns about it.
- Home access: the home is outside the project, so Claude Code may ask for permission each time it writes there. init offers to add the home folder to the project's `.claude/settings.local.json` (`permissions.additionalDirectories`); the default is to add it. Other settings in that file are kept.
- `.git/info/exclude` is per clone, so run init again after cloning the project on another machine. A teammate who clones a repository with `shared/` gets the shared documents and init creates the rest.
- Workspaces from earlier versions (layout 1 or 2, numbered folders such as the study-notes folder) keep working as they are. `/siloroot:update` moves them one step at a time: to layout 3 from 0.7.0, to layout 4 from 0.8.0 (see Updating).

The templates and skill text are currently in Korean only.

## Updating

`/siloroot:update` is the everyday update. It checks the marketplace for a newer SiloRoot, asks before upgrading the plugin for this project, refreshes the managed block and guide documents in the workspace and the home, restarts any viewer server still running an older version (open viewer tabs reload by themselves), and lists what changed from `CHANGELOG.md`. New skills and hooks still take effect from the next session. When a version changes the workspace layout, `/siloroot:migrate` moves it. The minor version (0.x.0) goes up only for layout changes; everything else ships as a patch (0.x.y).

At session start a hook says so once if the layout is behind (`/siloroot:migrate`) or there is something to refresh (`/siloroot:update`). If only the version number differs and nothing needs refreshing, it just records the new number without a notice. It is not added to every message.

- The workspace records its layout number (`schema`) and the plugin version it was last brought up to (`plugin`) in `.siloroot/config.json`.
- When a version changes the layout, `/siloroot:migrate` moves things, one layout step at a time (after one step, the update previews the next). There are three:
  - Layout 1 (the old style, documents at the project root) to layout 2 (documents wrapped in `.siloroot/`).
  - Layout 2 to layout 3 (0.7.0). Project documents are split into `shared/` and `private/`, and study notes, your profile, writing rules and writing-rule and profile candidates move to the home. If you have no home yet, it is created where you choose. The update shows where each document will go and asks you to approve the list once. Ideas cannot be sorted by rule, so they default to `shared/ideas/`; move personal ones to `home:ideas/`, and their decision documents and images follow them. Paths inside the moved documents are rewritten to the new places (`home:…` and `<name>:…` across workspaces). If the home already has `profile.md`, `writing-guide.md` or `study/README.md`, table rows are merged instead of overwritten, and a study note with the same name as one in the home is asked about. Nothing is committed: you choose what in `shared/` to commit. The update then brings the home up to date with the same script.
  - Layout 3 to layout 4 (0.8.0). The work log (`changelog.md`) is split at each date heading into `private/worklog/YYYY-MM-DD.md`, and the open questions move to `private/open-questions.md`. Documents in the old `shared/roadmap/` are per-feature implementation plans, so they move to `shared/plans/`; a one-page roadmap (`shared/roadmap.md`), a system overview (`shared/architecture.md`) and a README in every place folder are created. Decision, design and plan documents inside the ideas folder move to their own places after you approve the list once. Issue statuses `원인 찾음` become `열림` and `안 함` becomes `안 고침`. Paths that pointed at moved documents are rewritten, including in the home and in registered projects. The home turns `log/` into `worklog/` and `open-questions.md`.
- The session-start notice in a layout 3 or later project also says when the home is behind.
- The changes are shown first, and anything that needs a person's choice (content outside the block in the team `CLAUDE.md`, the top-level `.gitignore`, documents already committed to git, and so on) is asked one by one. Defaults are never picked without an answer.
- You can stay on the current layout instead. You then get only the managed-block refresh, and the notice for that layout stops (`hold` in `config.json`).
- Before changing anything it makes a backup in `.siloroot/state/backups/`. Say "되돌려 줘" (roll it back) to restore, newest backup first (`/siloroot:migrate`, which also rolls back refreshes made by `/siloroot:update`). If you edited files after the update, it stops and asks. Backups that changed the layout are never removed automatically; refresh-only backups keep the latest 5.

## Viewer

`http://127.0.0.1:<port from config.json>`. It is reachable only from this machine and makes no external network requests.

- On wide screens, the left sidebar (search and screen list) shares the background color and only the content sits on a rounded panel. The button at the top of the sidebar collapses it to an icon strip; hovering an icon shows its name. The magnifier in the collapsed strip expands the sidebar and puts the cursor in the search box. The collapsed state is remembered in the browser. At 760px wide or less, a top bar is used instead.
- When a document changes, the page redraws right away and briefly highlights new documents and new lines in yellow.
- The "나" (me) page opens with a usage radar computed from your own folder records: study depth (how many study notes passed verification), study breadth (distinct fields in study-note `tags`), follow-through (closed open questions and finished ideas), consistency (days with a record in the last 14), and AI training (rule and profile candidates you decided plus comments you closed in the last 30 days). Click an axis to see its formula, target and evidence. Next to it is an AI comment (`ai-comment.md` in your profile place, Claude's opinion, not approved information). A hook asks Claude to rewrite it in the first session after 9 a.m. each day, and the panel shows when it was last written and when the next update is due. Below that, each axis is compared with a week ago. Further down are the entries Claude currently uses about you, with their evidence: approved entries from your profile (`profile.md`), pending and rejected user-profile candidates, and the writing rules. If an item is wrong, press "이건 아니에요" (that's not right) to leave a comment on it. In a layout 3 project this page lives in the home viewer; the project viewer's "나" shows a link to it (or says the home viewer is off).
- The connection graph links documents through `related` properties and backticked paths. By default it shows every link type, common documents (guides, indexes, ledgers, logs), archived documents and unlinked documents. Folders are listed in a legend at the bottom left of the graph (click one to hide it), and the other switches sit behind the "필터" (filter) button in the graph header, which shows how many are turned off. If a document is created or deleted while you are looking at the graph, its node and edges are added or removed without a reload. Documents are grouped by folder: each folder is its own small disk inside a circle (repulsion that weakens with distance, gravity that grows with distance, springs that stay loose around hubs, and collision): documents with more links inside the folder sit nearer the center, circles fit their dots tightly and keep apart, and you can drag a circle (or its name) to move the whole folder or drag a dot out to stretch it. Folder names are drawn above the lines. Titles appear from 150% zoom (or on hover), nodes never overlap, and "맞춤" (fit) frames everything visible. Lines curve around other nodes instead of crossing them (one smooth arc, bending at most 22% of the line length, otherwise straight), and the layout pushes nodes away from lines. Links between folders are drawn as bundles: they gather at the edge of the source circle, travel together along a shortest path that avoids other folder circles (grid search, then smoothed), and fan out to each document in the target folder while avoiding the other documents there. Hovering or selecting a document highlights its links along the same bundles. While you drag, the avoidance is skipped and recomputed when you let go, so dragging stays smooth. New links drawn during a live update no longer look cut off once their drawing animation ends.
- In a shape-3 project the graph groups folders into three territories: shared, private, and home (only the home notes this project links to, each with how many project documents point at it, `← 4`). A territory is a tinted shape drawn around its folder circles and labeled with an icon (open lock, lock, house) and its English name; hovering the label says who can see it. Territories never overlap, and links to another territory gather at a gate on the border and run side by side as a band. Nodes stay inside their own territory and out of other folders' circles and names. Folder names are plain text in the folder color with the document count. The legend is grouped by territory and folds away with the button at its top. "필터" (filter), "흔적" (trail) and "맞춤" (fit) sit in the graph header, and zooming is done with the mouse wheel. "맞춤" fits the graph into the part of the view the legend and side boxes do not cover.
- The home viewer's graph uses the same territories: every home folder and the home's top-level documents (as plain dots, no circle) sit in one green home territory, and each project the home notes link to gets its own gray territory with a folder icon, holding only the linked documents (their titles appear when zoomed in). The legend lists each project as one entry under "projects". In both viewers, clicking the title of another workspace's territory (home in a project, a project in the home) opens that viewer's graph in a new tab, and clicking one of its dots opens the document in the side panel without leaving the graph (the panel is described below).
- While Claude answers, the connection graph shows the documents it read or edited, in order. When two documents visited one after the other are already linked, that link fills with color from the first toward the second, the way new links are drawn (reads in the accent color, edits in the yellow color used for changed lines); documents that are not linked get no line, only their numbers, each node gets its visit numbers (`2·6` if it was visited twice), and the latest node pulses. A list right under the "흔적" (trail) button at the top right shows the order: three rows high, scrolling to the newest. It steps left of a right-side document panel and hides while a bottom or full panel is open. Read, Edit, Write, MultiEdit and NotebookEdit count, and so does a Bash command that names a document path; Grep and Glob are left out. Hovering a node a subagent read shows "N번 · 서브에이전트가 읽음" (read by a subagent). The trail clears when you send a new message, and the "흔적" (trail) button next to "맞춤" turns it off. If several sessions work in the same folder, the graph shows the one that moved last.
- Documents and links created since your last message stay marked in the connection graph until you send the next one. They use the viewer's "added" color so they do not look like the trail (accent and yellow). New links are drawn thick with a soft glow at any zoom level (the glow is turned off above 60 new links), and where the trail runs over a new link the trail color shows on top. New documents get a tinted halo and a "새" (new) tag at the lower right of the node. The trail list marks new documents with "새" and its header shows how many documents and links are new. Everything created in that time counts, not only what Claude made; documents that reappear because you changed a filter do not. Names of trail nodes and new documents show only where they do not overlap other names, and below 150% they still show (along with the selected node) when they do not overlap each other. If the viewer server was off when you sent the message, counting starts from the first view drawn after it starts.
- Links to another workspace (`home:…`, `<name>:…`) are drawn as one dim "outside" node per linked document, grouped by workspace. The build reads only the linked documents (title and body) and no other document of that workspace. Clicking a node opens the document in the side panel, whose button opens that workspace's viewer in a new tab, or says it is off.
- Clicking any node (yours or another workspace's) opens the same document view as the document page in a side panel: path line, property chips, body, links and table of contents. When the document view is 900px or wider, the links and table of contents sit in a right column; when it is narrower (the side panel, or the document page in a split screen), that column folds into a row of buttons above the body (목차, 댓글, 연결, 피드백, with counts). A button opens that card in a box under the row; the row stays at the top while you scroll, and selecting a sentence in the body opens the comment box with the quote. A table-of-contents entry, clicking outside, or Esc folds it again (Esc closes only the box, not the panel), and a comment you are writing stays. Your own documents can be edited and commented on there; other workspaces' documents are read-only. The clicked node and its neighbours stay highlighted while the panel is open, and the graph shifts so they are not hidden under it. Links inside the panel open in the panel. The panel header has X (or Esc) to close and a button: "문서 화면으로" (to the document page) for your own documents, "<workspace> 뷰어에서 열기" (open in that viewer) for another workspace's. Double-clicking a node still goes to the document page. The panel sits on the right when at least 360px of graph stays beside it; otherwise at the bottom (58% of the height) when the graph is at least 640px tall, otherwise it covers the whole graph, so it works in half and 2-4 split screens. Drag the left edge of a right-side panel to change its width (remembered in this browser; double-click the edge to reset). Editing and commenting in the panel do not reload the page, so the graph layout and the panel stay; leaving the panel with unsent text asks "쓰던 내용이 사라집니다. 계속할까요?", and file changes that arrive while you write are applied after you finish. The trail box ("이번 답에서 거쳐 간 문서") sits right under the "흔적" button at the top right, steps left of a right-side panel, and hides while a bottom or full panel is open.

The hooks run only in folders that contain `.siloroot/config.json`. On session start they launch the viewer server (and, in a layout 3 project, the home's viewer server too) and open the project viewer in the browser (unless a viewer tab is already open or the session restarted after compaction). If the viewer server already running for the folder is older than the installed plugin, they stop it and start the current one. An open viewer tab reloads itself when it reconnects to a server of another version; tabs served by 0.5.1 or older cannot, so Claude is told to ask you to refresh them; when you send a message they tell you if there is feedback to process. If the workspace is behind the installed plugin, the session-start hook also tells you an update is available. For the reading trail, two background hooks (`"async": true`, so Claude never waits for them) append the document path after each tool call and clear the session's trail when you send a message, writing the message time to `.siloroot/state/trail/turn.json`. When that time changes, the viewer server saves the current documents and links to `.siloroot/state/turn-base.json` as the baseline and marks what appears after it in the graph. The trail itself goes to `.siloroot/state/trail/<session>.jsonl`, keeping only the time, the document path, read or edit, and the subagent id; trail files of other sessions unused for 7 days are removed. In a 0.1.x-style folder (documents at the project root) that already had a `.gitignore`, add `.siloroot/state/` to it yourself.

In a layout 3 or later project, another session-start hook puts the text of the conventions (`shared/conventions/`) into Claude's context, so Claude follows them without being told to read them first. It runs again after `/clear` and after compaction. Each document goes in with its path and without its properties; the folder guide (`README.md`) and documents whose `status` is `폐기` (dropped) or `바뀜` (replaced) are left out. Claude Code caps one hook output at 10,000 characters and shows only a preview of anything longer, so above 9,000 characters the hook puts in the list of documents and their paths and tells Claude to read them all before starting. The home has no conventions place, so nothing is added there.

## Usage log

To find where SiloRoot is slow or uses many tokens, the plugin writes one JSON line per step to `.siloroot/state/metrics.jsonl`. It is on by default, stays on this machine, and is kept out of git with the rest of `state/`.

| Stage | What is measured |
| --- | --- |
| `turn:siloroot:<skill>` | A turn (one message and the whole response) that used a SiloRoot skill, by slash command or by Claude calling it |
| `turn:siloroot-docs` | A turn that read or wrote workspace or home documents without a SiloRoot skill (the state folder and settings file do not count; commands that work on the documents folder do). If a SiloRoot skill was used earlier in the session, the summary groups it as `turn:siloroot-docs (siloroot:<skill> 뒤)`, so follow-up Q&A turns of `note` or `verify` stay visible |
| `turn:other` | Any other turn in the workspace, as a baseline |
| `hook:autostart`, `hook:notify-session`, `hook:notify-prompt`, `hook:conventions`, `hook:metrics-turn` | Hook run time, including Node startup. The notify and conventions hooks also record how many characters they added to Claude's context |
| `script:init`, `script:update`, `script:build` (`:data-only`, `:seen`, `:seen-path`) | Script run time and document count |
| `context:always-loaded` | At session start, the length in characters of `.siloroot/CLAUDE.md` and `profile.md`, which Claude loads on every turn |

- Turn records come from a `Stop` hook. It reads the conversation transcript (`transcript_path` in the hook input) from where it stopped last time and adds up each response's `usage`: input, output, cache-read, and cache-write tokens. A response split over several lines is counted once by its message id. Subagent tokens (`<session>/subagents/`) go into a separate `sub` field. It also records how many characters each tool's results brought into the context (`resultChars`, by tool name) and how much of that came from tool calls on documents (`docChars`), which shows what looking up documents costs. For each turn it also records, by slot name, how many documents were read for reference (`docReads`, leaving out documents edited in the same turn) and how many were edited (`docEdits`), how many files outside the documents were edited (`codeEdits`), and how many commands worked on the documents folder without naming a document (`docScripts`). Whether a file is a document, and whether it was read or edited, is decided the same way as the trail in the connection graph. Only lengths are counted, never the content. The read position is kept per session in `.siloroot/state/metrics-cursor/`, so sessions running at the same time do not overwrite each other. If a position is lost and turns are logged twice, the summary counts each turn once.
- A record holds only stage names, timestamps, durations, token counts, tool names with counts and time, SiloRoot skill names, the session id, and document counts by slot name (only names SiloRoot defines, such as `decisions` or `worklog`). No document text, prompts, file paths, or other plugins' skill names.
- If logging fails, the original work goes on. The `Stop` hook always exits 0 with no output.
- To turn it off, set `"metrics": false` in `.siloroot/config.json` or the environment variable `SILOROOT_METRICS=0`. At 5 MB the file moves to `metrics.1.jsonl` and a new one starts.

To see the summary, run the script in the plugin folder (for a marketplace install, `~/.claude/plugins/cache/<marketplace>/siloroot/<version>/`) from the project folder. `--days 7` limits it to the last week and `--json` prints the totals as JSON.

```powershell
node "<plugin folder>/scripts/metrics.mjs" . --days 7
```

It prints the stages that used the most time, tokens, and cost, then a table for turns (sorted by cost), a turn breakdown, document counts by slot, and a table for scripts and hooks.

- The turn breakdown sorts turns into use (read reference documents and edited code), code only, document work (read reference documents, no code edits), record only (edited documents without reading references), documents handled by scripts, and untouched. Reference documents are everything except the worklog, folder guides, rule files, and the writing guide. It shows whether the records get used in the work. Older records without these fields are left out.
- Documents read or edited inside scripts or PowerShell cannot be told apart one by one.

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

Versions are bumped when a release goes out, not with every pull request. Features build up on `main` and ship together as one minor version (0.x.0); a fix to a released version ships right away as a patch version (0.x.y). To try `main` before it is released, load the clone for one terminal session:

```powershell
claude --plugin-dir <path to the clone>
```

This applies only to that session. While you do this, turn off the installed SiloRoot for the project so its hooks do not run as well (`claude plugin disable siloroot@siloroot --scope project`), and turn it back on afterwards (`claude plugin enable siloroot@siloroot --scope project`).

The privacy test reads banned words from `test/banned-words.local.txt` (one word per line), which is not committed. Without that file the test runs with no banned words.

The README exists in English (`README.md`) and Korean (`README.ko.md`). When you change one, change the other too.

## License

MIT

The viewer bundles the Pretendard variable font (`viewer/fonts/PretendardVariable.woff2`, Pretendard 1.3.9 by Kil Hyung-jin), licensed under the SIL Open Font License 1.1. See `viewer/fonts/LICENSE-Pretendard.txt`.
