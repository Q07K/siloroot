// 세션 시작 알림(viewer/notify.mjs --session)에 붙일 업데이트 안내. 설정과 플러그인 버전, 맞출 것(관리 블록, 빠진 파일과 줄)만 본다.
// 모양 3 프로젝트는 홈(user.json의 home)의 설정도 본다. 홈은 사람들이 거기서 Claude를 잘 열지 않아 프로젝트 세션에서 같이 알린다.
// - 옮길 모양이 있으면 /siloroot:migrate를 알린다.
// - 설정의 plugin이 이 플러그인보다 옛것이고 맞출 것이 있으면 /siloroot:update를 알린다.
// - plugin만 옛것이고 맞출 것이 없으면 알리지 않고 stamp에 넣는다. notify.mjs가 설정의 plugin만 올려 적는다.
// - plugin이 이 플러그인보다 새것이면(더 새 플러그인을 쓰는 다른 프로젝트가 홈을 맞췄다) 알리지도 적지도 않는다. 올리기만 하고 내리지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA, pluginVersion, loadConfig, updateConfig } from './config.mjs';
import { pendingMigrations } from './migrations/index.mjs';
import { planRefresh } from './workspace-sync.mjs';
import { isOlder } from './servers.mjs';
import { readUser } from './user.mjs';

const declinedOf = (cfg) => { try { return JSON.parse(fs.readFileSync(path.join(cfg.stateDir, 'update-declined.json'), 'utf8')); } catch { return {}; } };
// 맞출 것이 있는가(관리 블록을 넣거나 바꿀 것, 빠진 파일, 빠진 줄, 안내 문서에 빠진 표 항목)
function needsRefresh(cfg) {
  try {
    const r = planRefresh(cfg.root, cfg, { declined: declinedOf(cfg) });
    return r.blocks.some((b) => b.state === 'created' || b.state === 'updated') || r.missingFiles.length > 0 || r.missingLines.length > 0 || r.guideGaps.length > 0;
  } catch { return true; }
}

// 한 작업 공간: { lines, stamp }. stamp는 plugin만 올려 적을 폴더
function checkOne(cfg, label = '') {
  const lines = [], stamp = [];
  // hold: 사용자가 그 모양까지는 올리지 않기로 했다. 그보다 새 모양으로 가는 마이그레이션이 나오면 다시 알린다
  const pending = pendingMigrations(cfg.schema, SCHEMA);
  if (pending.some((m) => !(cfg.hold != null && m.to <= cfg.hold))) {
    const to = pending[pending.length - 1].to;
    lines.push(`${label}작업 공간 모양 ${cfg.schema} → ${to}: ${pending.map((m) => m.title).join(', ')} (/siloroot:migrate)`);
  }
  const version = pluginVersion();
  if (cfg.plugin !== version && isOlder(cfg.plugin, version)) {
    if (needsRefresh(cfg)) lines.push(`${label}규칙 블록과 안내 문서를 ${version}에 맞출 수 있습니다 (/siloroot:update)`);
    else stamp.push(cfg.root);
  }
  return { lines, stamp };
}

// { lines, stamp }
export function checkUpdate(cfg) {
  const out = checkOne(cfg);
  if ((cfg.schema ?? 0) >= 3 && cfg.mode === 'project') {
    const u = readUser();
    const home = !u.invalid && u.home ? loadConfig(u.home) : null;
    if (home) { const h = checkOne(home, `홈(${u.home}): `); out.lines.push(...h.lines); out.stamp.push(...h.stamp); }
  }
  return out;
}

// 알릴 줄. 없으면 []
export const updateNotice = (cfg) => checkUpdate(cfg).lines;

// 번호만 올려 적고, 올리기 전 번호를 state/update-from.json에 남긴다. /siloroot:update가 바뀐 것을 보일 때 쓰고 지운다.
// 여러 번 올려 적어도 아직 보이지 않은 가장 옛 번호를 둔다
export const UPDATE_FROM = 'update-from.json';
export function stampPlugin(root) {
  const cfg = loadConfig(root);
  if (!cfg) return;
  const f = path.join(cfg.stateDir, UPDATE_FROM);
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(f, 'utf8')).from || null; } catch { /* 없음 */ }
  if (cfg.plugin && (!prev || isOlder(cfg.plugin, prev))) {
    fs.mkdirSync(cfg.stateDir, { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ from: cfg.plugin }) + '\n');
  }
  updateConfig(root, { plugin: pluginVersion() });
}
