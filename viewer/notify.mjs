#!/usr/bin/env node
// 뷰어에서 생긴 할 일을 Claude Code에 알려 주는 플러그인 훅.
//   --session : 세션을 시작할 때(SessionStart). 남아 있는 할 일을 모두 알린다.
//   (인자 없음): 사용자가 메시지를 보낼 때(UserPromptSubmit). 지난번 알린 뒤 새로 생긴 것만 알린다.
// 할 일: 대기, 진행 중인 피드백 / 승인됐지만 아직 반영 안 한 규칙 후보와 사용자 정보 후보 / 규칙 후보를 아직 안 본 웹 편집
//        / (세션 시작 때만) 갱신 시각이 지난 "나" 화면 AI 코멘트 (lib/me-schedule.mjs)
// 자리는 자리표(lib/layout.mjs)에서 찾는다. 모양 3 프로젝트는 홈(~/.siloroot/user.json)의 후보와 댓글, 사용자 정보, AI 코멘트도 본다.
// 홈을 못 찾거나 user.json이 깨졌으면 홈 쪽은 건너뛴다.
// (세션 시작 때만) 작업 공간이 설치된 플러그인보다 뒤처졌으면 업데이트를 따로 알린다 (lib/update-check.mjs, /siloroot:update)
// SiloRoot 폴더가 아니거나 알릴 것이 없으면 아무것도 출력하지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { timeScript, appendMetrics } from '../lib/metrics.mjs';
import { checkUpdate, stampPlugin } from '../lib/update-check.mjs';
import { AI_COMMENT_HOUR, lastSlot, commentDue } from '../lib/me-schedule.mjs';
import { placesOf, localPlace } from '../lib/layout.mjs';
import { readUser } from '../lib/user.mjs';

const cfg = loadConfig(process.env.CLAUDE_PROJECT_DIR || process.cwd());
if (!cfg) process.exit(0);

const SESSION = process.argv.includes('--session');
// 걸린 시간과 Claude에게 덧붙인 알림 글자 수(매 메시지에 붙는 토큰 비용)를 남긴다 (lib/metrics.mjs)
const timer = timeScript(cfg.root, 'hook', SESSION ? 'hook:notify-session' : 'hook:notify-prompt');
timer.set({ chars: 0 });
const PLACES = placesOf(cfg);
const FB_REL = localPlace(PLACES.feedback);
// 알림 글은 프로젝트 맨 위에서 일하는 Claude가 읽는다. 감싼 배치면 열 수 있게 경로 앞에 .siloroot/를 붙여 보여 준다.
const SHOW = cfg.layout === 'wrapped' ? '.siloroot/' : '';
const EDIT_LOG = path.join(cfg.stateDir, 'web-edits.jsonl');
const REVIEWED = FB_REL ? path.join(cfg.docsRoot, FB_REL, 'reviewed-edits.json') : null;
const STATE = path.join(cfg.stateDir, 'notified.json');

// 모양 3 프로젝트의 홈. 홈 문서는 절대 경로로 보여 준다(프로젝트 밖이라)
function findHome() {
  if ((cfg.schema ?? 0) < 3 || cfg.mode === 'home') return null;
  try {
    const u = readUser();
    if (u.invalid || !u.home) return null;
    const hc = loadConfig(u.home);
    if (!hc || hc.mode !== 'home') return null;
    return { docsRoot: hc.docsRoot, places: placesOf(hc), show: u.home.replace(/\/+$/, '') + '/' };
  } catch { return null; }
}
const HOME = findHome();

// 자리 하나를 { full, shown }으로. home: 자리는 홈이 있을 때만
function resolvePlace(p) {
  if (!p) return null;
  const lp = localPlace(p);
  if (lp) return { full: path.join(cfg.docsRoot, lp), shown: SHOW + lp };
  if (p.startsWith('home:') && HOME) { const r = p.slice('home:'.length); return { full: path.join(HOME.docsRoot, r), shown: HOME.show + r }; }
  return null;
}

const fmOf = (t) => {
  const m = t.replace(/^﻿/, '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  const o = {};
  if (m) for (const l of m[1].split('\n')) { const kv = l.match(/^([\w가-힣-]+)\s*:\s*(.*)$/); if (kv) o[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, ''); }
  return o;
};

// 한 작업 공간의 댓글 자리와 후보 자리에서 할 일을 모은다. show는 알림 글의 경로 앞부분, keyPrefix는 다른 작업 공간 것과 키가 겹치지 않게 붙인다.
// 승인된 후보의 반영 대상(profile, writing guide)은 그 작업 공간의 자리를 따르고, 다른 작업 공간에 있으면(home:) 그 경로를 그대로 적는다
function collectItems({ docsRoot, places, show, keyPrefix = '', target = (p) => (localPlace(p) ? show + p : p) }) {
  const items = [];
  const dirs = [...new Set([localPlace(places.feedback), localPlace(places.candidates)].filter(Boolean))];
  for (const rel of dirs) {
    let files = [];
    try { files = fs.readdirSync(path.join(docsRoot, rel)).filter((f) => f.endsWith('.md') && f !== 'README.md'); } catch { files = []; }
    for (const f of files) {
      const fm = fmOf(fs.readFileSync(path.join(docsRoot, rel, f), 'utf8'));
      const r = rel + '/' + f;
      const key = keyPrefix + r;
      const on = (fm.related || '').replace(/^\[|\]$/g, '').split(',')[0].trim();
      if (fm.type === 'feedback' && (fm.status === '대기' || fm.status === '진행 중')) items.push({ key: key + '|' + fm.status, text: `피드백 ${fm.status}: ${show}${r}${on ? ' (대상 ' + show + on + ')' : ''}` });
      if (fm.type === 'rule' && fm.status === '승인') items.push({ key: key + '|승인', text: `승인된 규칙 후보, ${target(places.writingGuide)} 반영 대기: ${show}${r}` });
      if (fm.type === 'trait' && fm.status === '승인') items.push({ key: key + '|승인', text: `승인된 사용자 정보 후보, ${target(places.profile)} 반영 대기: ${show}${r}` });
    }
  }
  return items;
}

const items = collectItems({ docsRoot: cfg.docsRoot, places: PLACES, show: SHOW, target: (p) => (resolvePlace(p) || { shown: p }).shown });
if (HOME) items.push(...collectItems({ docsRoot: HOME.docsRoot, places: HOME.places, show: HOME.show, keyPrefix: 'home:' }));

let last = '';
try { last = JSON.parse(fs.readFileSync(REVIEWED, 'utf8')).last || ''; } catch { last = ''; }
let edits = [];
try { edits = fs.readFileSync(EDIT_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { edits = []; }
const fresh = edits.filter((e) => e.id > last && (e.kind === '표현' || e.reason));
if (fresh.length) items.push({ key: 'edits|' + fresh[fresh.length - 1].id, text: `규칙 후보를 아직 안 본 웹 편집 ${fresh.length}건 (.siloroot/state/web-edits.jsonl, ${last || '처음'} 이후)` });

// "나" 화면 AI 코멘트: 세션을 시작할 때만 본다. 코멘트 파일이 있고(사용자가 한 번 만들어 달라고 해서 쓰기 시작한 뒤), 매일 AI_COMMENT_HOUR가 지났는데 그보다 오래됐으면 알린다
if (SESSION) {
  const c = resolvePlace(PLACES.aiComment);
  let mt = 0;
  try { mt = c ? fs.statSync(c.full).mtimeMs : 0; } catch { mt = 0; }
  if (mt && commentDue(mt)) items.push({ key: 'ai-comment|' + lastSlot().toISOString(), text: `"나" 화면 AI 코멘트 갱신 차례: 매일 ${AI_COMMENT_HOUR}시 이후 첫 세션인데 ${c.shown}가 그 전에 쓴 것 (F 절차)` });
}

let seen = {};
try { seen = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { seen = {}; }
const show = SESSION ? items : items.filter((x) => !seen[x.key]);
for (const x of items) seen[x.key] = true;
try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(seen)); } catch { /* 알림 기록을 못 남겨도 알림은 보낸다 */ }

// 업데이트 안내는 처리 절차가 달라 할 일과 섞지 않고 앞에 따로 붙인다. 메시지 알림에는 붙이지 않는다(토큰을 계속 쓰지 않게)
const parts = [];
let updateLines = [];
if (SESSION) {
  try {
    const u = checkUpdate(cfg);
    updateLines = u.lines;
    // 맞출 것 없이 플러그인 번호만 옛것인 작업 공간은 알리지 않고 번호만 올려 적는다(lib/update-check.mjs)
    for (const r of u.stamp) { try { stampPlugin(r); } catch { /* 못 적어도 다음 세션에 다시 본다 */ } }
  } catch { updateLines = []; }
}
if (updateLines.length) parts.push('[SiloRoot] 업데이트할 것이 있습니다. 줄 끝의 명령으로 미리 보고 올릴 수 있습니다.\n' + updateLines.map((l) => '- ' + l).join('\n'));
if (show.length) parts.push('[SiloRoot] 처리할 일이 있습니다. /siloroot:feedback 절차를 따릅니다.\n' + show.map((x) => '- ' + x.text).join('\n'));

if (parts.length) {
  const text = parts.join('\n\n');
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: SESSION ? 'SessionStart' : 'UserPromptSubmit', additionalContext: text } }));
  timer.set({ chars: text.length });
}

// 세션을 시작할 때 매 턴 불러오는 SiloRoot 규칙 문서의 크기를 남긴다. 이 글자 수가 모든 턴의 고정 비용이다(모양 3 프로젝트는 홈의 사용자 정보도)
if (SESSION) {
  let chars = 0;
  const profile = resolvePlace(PLACES.profile);
  for (const f of [path.join(cfg.docsRoot, 'CLAUDE.md'), profile && profile.full].filter(Boolean)) {
    try { chars += fs.readFileSync(f, 'utf8').length; } catch { /* 없으면 0 */ }
  }
  appendMetrics(cfg, { kind: 'context', stage: 'context:always-loaded', start: new Date().toISOString(), chars });
}
