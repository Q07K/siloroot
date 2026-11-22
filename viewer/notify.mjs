#!/usr/bin/env node
// 뷰어에서 생긴 할 일을 Claude Code에 알려 주는 플러그인 훅.
//   --session : 세션을 시작할 때(SessionStart). 남아 있는 할 일을 모두 알린다.
//   (인자 없음): 사용자가 메시지를 보낼 때(UserPromptSubmit). 지난번 알린 뒤 새로 생긴 것만 알린다.
// 할 일: 대기, 진행 중인 피드백 / 승인됐지만 아직 반영 안 한 규칙 후보와 사용자 정보 후보 / 규칙 후보를 아직 안 본 웹 편집
//        / (세션 시작 때만) 갱신 시각이 지난 "나" 화면 AI 코멘트 (lib/me-schedule.mjs)
// SiloRoot 폴더가 아니거나 할 일이 없으면 아무것도 출력하지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { AI_COMMENT_FILE, AI_COMMENT_HOUR, lastSlot, commentDue } from '../lib/me-schedule.mjs';

const cfg = loadConfig(process.env.CLAUDE_PROJECT_DIR || process.cwd());
if (!cfg) process.exit(0);

const SESSION = process.argv.includes('--session');
const FB_REL = cfg.dirs.feedback;
const FB = path.join(cfg.root, FB_REL);
const EDIT_LOG = path.join(cfg.stateDir, 'web-edits.jsonl');
const REVIEWED = path.join(FB, 'reviewed-edits.json');
const STATE = path.join(cfg.stateDir, 'notified.json');

const fmOf = (t) => {
  const m = t.replace(/^﻿/, '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  const o = {};
  if (m) for (const l of m[1].split('\n')) { const kv = l.match(/^([\w가-힣-]+)\s*:\s*(.*)$/); if (kv) o[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, ''); }
  return o;
};

const items = [];
let files = [];
try { files = fs.readdirSync(FB).filter((f) => f.endsWith('.md') && f !== 'README.md'); } catch { files = []; }
for (const f of files) {
  const fm = fmOf(fs.readFileSync(path.join(FB, f), 'utf8'));
  const rel = FB_REL + '/' + f;
  const target = (fm.related || '').replace(/^\[|\]$/g, '').split(',')[0].trim();
  if (fm.type === 'feedback' && (fm.status === '대기' || fm.status === '진행 중')) items.push({ key: rel + '|' + fm.status, text: `피드백 ${fm.status}: ${rel}${target ? ' (대상 ' + target + ')' : ''}` });
  if (fm.type === 'rule' && fm.status === '승인') items.push({ key: rel + '|승인', text: `승인된 규칙 후보, writing-guide.md 반영 대기: ${rel}` });
  if (fm.type === 'trait' && fm.status === '승인') items.push({ key: rel + '|승인', text: `승인된 사용자 정보 후보, ${cfg.dirs.profile}/profile.md 반영 대기: ${rel}` });
}

let last = '';
try { last = JSON.parse(fs.readFileSync(REVIEWED, 'utf8')).last || ''; } catch { last = ''; }
let edits = [];
try { edits = fs.readFileSync(EDIT_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { edits = []; }
const fresh = edits.filter((e) => e.id > last && (e.kind === '표현' || e.reason));
if (fresh.length) items.push({ key: 'edits|' + fresh[fresh.length - 1].id, text: `규칙 후보를 아직 안 본 웹 편집 ${fresh.length}건 (.siloroot/state/web-edits.jsonl, ${last || '처음'} 이후)` });

// "나" 화면 AI 코멘트: 세션을 시작할 때만 본다. 코멘트 파일이 있고(사용자가 한 번 만들어 달라고 해서 쓰기 시작한 뒤), 매일 AI_COMMENT_HOUR가 지났는데 그보다 오래됐으면 알린다
if (SESSION) {
  const rel = cfg.dirs.profile + '/' + AI_COMMENT_FILE;
  let mt = 0;
  try { mt = fs.statSync(path.join(cfg.root, rel)).mtimeMs; } catch { mt = 0; }
  if (mt && commentDue(mt)) items.push({ key: 'ai-comment|' + lastSlot().toISOString(), text: `"나" 화면 AI 코멘트 갱신 차례: 매일 ${AI_COMMENT_HOUR}시 이후 첫 세션인데 ${rel}가 그 전에 쓴 것 (F 절차)` });
}

let seen = {};
try { seen = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { seen = {}; }
const show = SESSION ? items : items.filter((x) => !seen[x.key]);
for (const x of items) seen[x.key] = true;
try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(seen)); } catch { /* 알림 기록을 못 남겨도 알림은 보낸다 */ }

if (show.length) {
  const text = '[SiloRoot] 처리할 일이 있습니다. /siloroot:feedback 절차를 따릅니다.\n' + show.map((x) => '- ' + x.text).join('\n');
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: SESSION ? 'SessionStart' : 'UserPromptSubmit', additionalContext: text } }));
}
