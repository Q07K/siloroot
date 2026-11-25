#!/usr/bin/env node
// SiloRoot 작업 공간을 설치된 플러그인 버전에 맞춘다. 스킬 둘이 실행한다.
// /siloroot:update(가벼움, 버전이 오를 때마다): 새 버전 확인, 관리 블록 맞추기, 뷰어 서버 바꾸기, 바뀐 것 보이기. 마이그레이션은 돌리지 않는다.
//   node scripts/update.mjs <프로젝트 폴더> --versions          설치 목록과 마켓플레이스 목록(state/의 plugin-list.json, plugin-markets.json)으로 이 프로젝트의 설치 버전과 최신 버전
//   node scripts/update.mjs <폴더> --refresh-plan               맞출 것을 미리 본다. 옮길 모양이 있으면 migration에 적는다
//   node scripts/update.mjs <폴더> --refresh [--answers <파일>] 마이그레이션 없이 맞춘다. 그 폴더가 더 새 플러그인으로 맞춰져 있으면 건너뛴다
//   node scripts/update.mjs <프로젝트 폴더> --servers           프로젝트와 홈의 뷰어 서버를 이 플러그인 버전으로 바꾼다(옛 버전일 때만)
//   node scripts/update.mjs <폴더> --changes <옛 버전>          CHANGELOG.md에서 옛 버전 다음부터 이 버전까지의 항목
// /siloroot:migrate(무거움, 모양이 바뀔 때만): 작업 공간 모양(schema)이 플러그인(SCHEMA)보다 낮으면 마이그레이션(lib/migrations/)을 돌리고,
// 그 뒤 관리 블록, 빠진 파일, 빠진 줄을 맞춘다(lib/workspace-sync.mjs). 이미 있는 안내 문서는 덮어쓰지 않는다.
// 파일을 바꾸기 전에 백업하고(lib/backup.mjs), 되돌릴 수 있다.
//   node scripts/update.mjs <프로젝트 폴더> --plan                         바뀔 것을 미리 본다. 파일을 바꾸지 않는다
//   node scripts/update.mjs <프로젝트 폴더> --apply [--answers <json 파일>]  적용한다
//   node scripts/update.mjs <프로젝트 폴더> --restore <백업 이름> [--force]  최신 백업을 되돌린다
//   node scripts/update.mjs <프로젝트 폴더> --backups                      백업 목록
// 출력은 모두 표준 출력의 JSON이다.
// answers: { migrations: { <id>: 'apply'|'hold' }, decisions: { <id>: 값 }, placements: { <옛 경로>: <갈 곳> }, declined: { <파일>: [표 항목] } }
// 모양은 한 번에 한 칸씩 오른다. 다음 마이그레이션 하나만 미리 보고 적용한다. 더 남았으면 more가 true이고, 적용한 뒤 다시 미리 본다.
// 뒤 마이그레이션은 앞 것이 옮긴 뒤의 모양을 보고 계획해야 해서다.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig, updateConfig, pluginVersion, SCHEMA, SUPPORTED_SCHEMAS } from '../lib/config.mjs';
import { pendingMigrations } from '../lib/migrations/index.mjs';
import { planRefresh, applyRefresh } from '../lib/workspace-sync.mjs';
import { createBackup, sealBackup, listBackups, restoreBackup, pruneBackups } from '../lib/backup.mjs';
import { timeScript } from '../lib/metrics.mjs';
import { isOlder, ensureServer } from '../lib/servers.mjs';
import { readUser } from '../lib/user.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(here, '..', 'viewer', 'build.mjs');
const SERVE = path.join(here, '..', 'viewer', 'serve.mjs');
const CHANGELOG = path.join(here, '..', 'CHANGELOG.md');
const DECLINED = 'update-declined.json';

// 사용자가 더하지 않겠다고 한 안내 문서 표 항목. 다음 업데이트에서 다시 묻지 않는다.
function readDeclined(cfg) {
  try { return JSON.parse(fs.readFileSync(path.join(cfg.stateDir, DECLINED), 'utf8')); } catch { return {}; }
}
function saveDeclined(cfg, add) {
  const cur = readDeclined(cfg);
  for (const [file, items] of Object.entries(add || {})) cur[file] = [...new Set((cur[file] || []).concat(items))];
  fs.mkdirSync(cfg.stateDir, { recursive: true });
  fs.writeFileSync(path.join(cfg.stateDir, DECLINED), JSON.stringify(cur, null, 2) + '\n');
  return cur;
}

// 맞추기가 바꿀 파일(관리 블록을 넣거나 바꿀 파일, 새로 만들 파일, 줄을 더할 파일)
const refreshChanges = (r) => r.blocks.filter((b) => b.state === 'created' || b.state === 'updated').map((b) => b.file)
  .concat(r.missingFiles, r.missingLines.map((l) => l.file));
const refreshClean = (r) => r.blocks.every((b) => b.state === 'skipped' || b.state === 'conflict') && !r.missingFiles.length && !r.missingLines.length;
// 머물기: hold는 사용자가 올리지 않기로 한 모양까지다. 남은 마이그레이션이 모두 그 안이면 머무는 중이다.
// 그보다 새 모양이 나오면 머물기가 풀려 다시 묻는다(세션 알림 lib/update-check.mjs와 같은 규칙). 하나만 보므로 m은 받지 않는다
const heldBy = (cfg) => cfg.hold != null && nextOf(cfg).every((x) => x.to <= cfg.hold);
// 답이 고를 값에 맞는가. free인 질문(홈 위치 같은 경로)은 빈 글자가 아니면 된다
export const validAnswer = (d, a) => (d.free ? typeof a === 'string' && a.trim() !== '' : d.options.includes(a));
// 이번에 볼 마이그레이션은 다음 하나뿐이다
const nextOf = (cfg) => pendingMigrations(cfg.schema, SCHEMA);
// 마이그레이션 뒤 맞추기가 볼 설정(백업 범위를 정할 때)
const afterCfg = (cfg, m) => ({ ...cfg, layout: 'wrapped', schema: m.to });

function open(rootArg) {
  const root = path.resolve(rootArg);
  const cfg = loadConfig(root);
  if (!cfg) return { error: 'not-siloroot' };
  if (!SUPPORTED_SCHEMAS.includes(cfg.schema)) return { error: 'unsupported-schema', schema: cfg.schema };
  return { root, cfg };
}

export function planUpdate(rootArg) {
  const o = open(rootArg);
  if (o.error) return o;
  const { root, cfg } = o;
  const declined = readDeclined(cfg);
  const pending = nextOf(cfg);
  const migrations = pending.slice(0, 1).map((m) => ({
    id: m.id, title: m.title, from: m.from, to: m.to, held: heldBy(cfg), plan: m.plan({ root, cfg }),
  }));
  const refresh = planRefresh(root, cfg, { declined });
  const upToDate = migrations.every((m) => m.held) && refreshClean(refresh) && !refresh.guideGaps.length;
  // to: 마이그레이션으로 갈 수 있는 모양. 새 모양의 마이그레이션이 아직 없으면 지금 모양 그대로다
  const to = migrations.length ? migrations[migrations.length - 1].to : cfg.schema;
  return { from: cfg.schema, to, pluginFrom: cfg.plugin, pluginTo: pluginVersion(), hold: cfg.hold, migrations, more: pending.length > 1, refresh, upToDate };
}

// viewer/build.mjs를 다시 돌려 속성 경고 수와 끊어진 related를 모은다
function check(root) {
  try {
    const out = execFileSync(process.execPath, [BUILD, root], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const m = out.match(/속성 점검: 경고 (\d+)개/);
    return { warnings: m ? Number(m[1]) : 0, broken: out.split(/\r?\n/).filter((l) => /related의 ".*" 문서를 찾지 못함/.test(l)).map((l) => l.trim().replace(/^- /, '')) };
  } catch (e) {
    return { warnings: 0, broken: [], error: '뷰어를 다시 만들지 못했습니다: ' + (e.stderr || e.message) };
  }
}

export function applyUpdate(rootArg, answersArg = {}) {
  const o = open(rootArg);
  if (o.error) return o;
  const { root, cfg } = o;
  const answers = { migrations: {}, decisions: {}, placements: {}, declined: {}, ...answersArg };

  // 돌릴 마이그레이션. 하나를 머물기로 하면 그 뒤도 모두 머문다(모양은 한 칸씩만 오른다)
  const pending = nextOf(cfg).slice(0, 1);
  const missing = [];
  const run = [];
  let holding = false;
  for (const m of pending) {
    // 전에 머물기로 한(hold) 마이그레이션은 답이 없으면 계속 머문다
    const a = answers.migrations[m.id] ?? (heldBy(cfg) ? 'hold' : undefined);
    if (a !== 'apply' && a !== 'hold') { missing.push('migration:' + m.id); continue; }
    if (a === 'hold') holding = true;
    run.push({ m, hold: holding });
  }
  // 사람이 고를 것에 답이 없으면 기본값을 쓰지 않고 멈춘다
  const plans = new Map();
  for (const { m, hold } of run) {
    if (hold) continue;
    // 답(홈 위치, 갈 곳)에 따라 묻는 것이 늘 수 있어 답을 넣어 다시 계획한다
    const p = m.plan({ root, cfg }, answers);
    plans.set(m.id, p);
    if (p.error) return { error: p.error, migration: m.id, detail: p.detail ?? null };
    for (const d of p.decisions) if (!validAnswer(d, answers.decisions[d.id])) missing.push(d.id);
  }
  if (missing.length) return { error: 'missing-decisions', ids: missing };

  const declined = saveDeclined(cfg, answers.declined);
  const applying = run.filter((x) => !x.hold).map((x) => x.m);
  const touchesFiles = applying.length || !refreshClean(planRefresh(root, cfg, { declined }));

  let backup = null;
  if (touchesFiles) {
    const files = ['.siloroot/config.json'], creates = [];
    for (const m of applying) { const t = plans.get(m.id).touches; files.push(...t.files); creates.push(...t.creates); }
    // 맞추기가 실제로 바꿀 파일만 담는다. 작업 기록처럼 계속 쓰는 문서를 담으면 되돌릴 때 그 뒤 쓴 내용까지 돌아간다.
    // 마이그레이션이 있으면 맞추기는 옮긴 뒤 배치로 돌기 때문에 감싼 배치의 계획도 더한다
    files.push(...refreshChanges(planRefresh(root, cfg, { declined })));
    for (const m of applying) files.push(...refreshChanges(planRefresh(root, afterCfg(cfg, m), { declined })));
    const to = applying.length ? applying[applying.length - 1].to : cfg.schema;
    backup = createBackup(root, { from: cfg.schema, to, files, creates }).name;
  }

  const results = [];
  let stoppedAt = null;
  let heldTo = null;
  for (const { m, hold } of run) {
    // 머물면 지금 플러그인이 아는 모양 전부를 거절한 것으로 적는다. 다음에 새 모양이 나오면 다시 묻는다
    if (hold) { results.push({ id: m.id, status: 'held' }); heldTo = Math.max(heldTo ?? 0, SCHEMA); continue; }
    try {
      m.apply({ root, cfg: loadConfig(root) }, answers.decisions, answers);
      updateConfig(root, { schema: m.to, hold: null });
      results.push({ id: m.id, status: 'applied' });
    } catch (e) {
      results.push({ id: m.id, status: 'failed', error: e.message });
      stoppedAt = m.id;
      break;
    }
  }

  let refresh = null;
  let refreshError = null;
  try {
    if (!stoppedAt) {
      if (heldTo != null) updateConfig(root, { hold: heldTo });
      try {
        refresh = applyRefresh(root, loadConfig(root), { declined });
        updateConfig(root, { plugin: pluginVersion() });
      } catch (e) {
        // 맞추기에서 실패하면 plugin을 적지 않고 멈춘다. 마이그레이션은 이미 적용됐다
        refreshError = e.message;
        stoppedAt = 'refresh';
      }
    }
  } finally {
    // 실패해도 봉해 둔다. 봉하지 않으면 되돌릴 때 모든 파일이 충돌로 보인다
    if (backup) { sealBackup(root, backup); pruneBackups(root); }
  }
  const after = loadConfig(root);
  const out = { backup, migrations: results, refresh, check: check(root), schema: after.schema, plugin: after.plugin, stoppedAt };
  if (refreshError) out.refreshError = refreshError;
  return out;
}

// ---------- /siloroot:update(가벼운 길) ----------

const norm = (p) => path.resolve(String(p || '')).split(path.sep).join('/').toLowerCase();
// 이 스크립트가 플러그인 설치 폴더(~/.claude/plugins/cache) 밖에서 돌면 --plugin-dir로 불러온 개발 플러그인이다
export const isDevCopy = (dir = here) => !/[\\/]\.claude[\\/]plugins[\\/]cache[\\/]/i.test(dir);

// claude plugin list --json 결과에서 이 프로젝트에 깔린 siloroot. 프로젝트 범위 설치가 먼저, 없으면 사용자 범위
export function pickInstall(list, root) {
  const all = (Array.isArray(list) ? list : (list && list.plugins) || []).filter((p) => p && typeof p.id === 'string' && p.id.split('@')[0] === 'siloroot');
  return all.find((p) => p.projectPath && norm(p.projectPath) === norm(root)) || all.find((p) => p.scope === 'user') || null;
}

// claude plugin marketplace list --json 결과와 마켓플레이스 이름으로, 그 마켓플레이스가 받아 둔 siloroot의 버전. 모르면 null
export function latestIn(markets, name) {
  const m = (Array.isArray(markets) ? markets : (markets && markets.marketplaces) || []).find((x) => x && x.name === name);
  if (!m || !m.installLocation) return null;
  try {
    const cat = JSON.parse(fs.readFileSync(path.join(m.installLocation, '.claude-plugin', 'marketplace.json'), 'utf8').replace(/^﻿/, ''));
    const entry = (cat.plugins || []).find((p) => p.name === 'siloroot');
    if (!entry) return null;
    if (typeof entry.source !== 'string') return entry.version || null;
    const pj = JSON.parse(fs.readFileSync(path.join(m.installLocation, entry.source, '.claude-plugin', 'plugin.json'), 'utf8').replace(/^﻿/, ''));
    return pj.version || null;
  } catch { return null; }
}

export function versionsOf(rootArg) {
  const o = open(rootArg);
  if (o.error) return o;
  const { root, cfg } = o;
  const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(cfg.stateDir, f), 'utf8').replace(/^﻿/, '')); } catch { return null; } };
  const running = pluginVersion();
  if (isDevCopy()) return { dev: true, running, note: '저장소에서 불러온 개발 플러그인이라 플러그인을 올리지 않습니다.' };
  const list = read('plugin-list.json'), markets = read('plugin-markets.json');
  if (!list) return { error: 'no-plugin-list', detail: 'claude plugin list --json 결과를 ' + path.join(cfg.stateDir, 'plugin-list.json') + '에 먼저 저장하세요.' };
  const inst = pickInstall(list, root);
  if (!inst) return { error: 'not-installed', running };
  const market = inst.id.split('@')[1] || null;
  const latest = markets ? latestIn(markets, market) : null;
  return {
    running, installed: inst.version, id: inst.id, scope: inst.scope, installPath: inst.installPath, market, latest,
    newer: !!(latest && isOlder(inst.version, latest)),
  };
}

// 다음에 옮길 모양(있으면). 머물기로 한 모양이면 held
function nextMigration(cfg) {
  const m = nextOf(cfg)[0];
  return m ? { id: m.id, title: m.title, from: m.from, to: m.to, held: heldBy(cfg) } : null;
}
// 그 폴더가 이 플러그인보다 새 버전으로 맞춰져 있으면 맞추지 않는다(홈은 여러 프로젝트가 같이 쓰고 프로젝트마다 버전이 다를 수 있다)
const newerThanMe = (cfg) => !!(cfg.plugin && isOlder(pluginVersion(), cfg.plugin));

export function planRefreshOnly(rootArg) {
  const o = open(rootArg);
  if (o.error) return o;
  const { root, cfg } = o;
  if (newerThanMe(cfg)) return { skipped: 'newer', plugin: cfg.plugin, pluginTo: pluginVersion() };
  const refresh = planRefresh(root, cfg, { declined: readDeclined(cfg) });
  return { schema: cfg.schema, pluginFrom: cfg.plugin, pluginTo: pluginVersion(), refresh, upToDate: refreshClean(refresh) && !refresh.guideGaps.length, migration: nextMigration(cfg) };
}

// 마이그레이션 없이 맞추기만 한다. hold를 적지 않는다(옮길지는 /siloroot:migrate에서 정한다)
export function applyRefreshOnly(rootArg, answersArg = {}) {
  const o = open(rootArg);
  if (o.error) return o;
  const { root, cfg } = o;
  if (newerThanMe(cfg)) return { skipped: 'newer', plugin: cfg.plugin, pluginTo: pluginVersion() };
  const declined = saveDeclined(cfg, (answersArg && answersArg.declined) || {});
  const plan = planRefresh(root, cfg, { declined });
  let backup = null;
  if (!refreshClean(plan)) backup = createBackup(root, { from: cfg.schema, to: cfg.schema, files: ['.siloroot/config.json', ...refreshChanges(plan)], creates: [] }).name;
  let refresh = null, refreshError = null;
  try {
    refresh = applyRefresh(root, cfg, { declined });
    updateConfig(root, { plugin: pluginVersion() });
  } catch (e) {
    refreshError = e.message;
  } finally {
    if (backup) { sealBackup(root, backup); pruneBackups(root); }
  }
  const out = { backup, refresh, check: check(root), plugin: loadConfig(root).plugin, migration: nextMigration(loadConfig(root)) };
  if (refreshError) out.refreshError = refreshError;
  return out;
}

// 프로젝트(와 모양 3 이상이면 홈)의 뷰어 서버를 이 플러그인 버전으로. 옛 버전일 때만 바꾸고 브라우저는 열지 않는다
export async function swapServers(rootArg) {
  const o = open(rootArg);
  if (o.error) return o;
  const { cfg } = o;
  const version = pluginVersion();
  const one = async (c, label) => {
    const h = await ensureServer(c, { serve: SERVE, version });
    return { label, port: c.port, state: h.state, version: h.version || null, was: h.was, replaced: h.replaced, started: h.wasDown && !h.replaced, stopFailed: h.stopFailed };
  };
  const out = [await one(cfg, 'project')];
  // 개발 플러그인(--plugin-dir)은 홈 서버를 건드리지 않는다. 홈 서버는 다른 프로젝트도 같이 쓴다
  if (isDevCopy()) return { version, servers: out, homeSkipped: 'dev' };
  if ((cfg.schema ?? 0) >= 3 && cfg.mode !== 'home') {
    try {
      const u = readUser();
      const hc = !u.invalid && u.home ? loadConfig(u.home) : null;
      if (hc && hc.mode === 'home') out.push(await one(hc, 'home'));
    } catch { /* 홈을 못 찾으면 프로젝트만 */ }
  }
  return { version, servers: out };
}

// CHANGELOG.md의 "## <버전>" 절 가운데 from보다 새것이고 to(기본: 이 플러그인)보다 새것이 아닌 것. 새것이 앞
export function changesBetween(from, to = pluginVersion(), file = CHANGELOG) {
  let text;
  try { text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n'); } catch { return []; }
  const out = [];
  for (const part of text.split(/^## /m).slice(1)) {
    const nl = part.indexOf('\n'), head = (nl < 0 ? part : part.slice(0, nl)).trim(), body = nl < 0 ? '' : part.slice(nl + 1).trim();
    const v = (head.match(/^(\d+\.\d+\.\d+)/) || [])[1];
    if (!v) continue;
    if ((from && !isOlder(from, v)) || isOlder(to, v)) continue;
    out.push({ version: v, body });
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [target = process.cwd(), ...args] = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  timeScript(target, 'script', 'script:update');
  let res;
  try {
    if (args.includes('--versions')) res = versionsOf(target);
    else if (args.includes('--refresh-plan')) res = planRefreshOnly(target);
    else if (args.includes('--refresh')) {
      const file = flag('--answers');
      res = applyRefreshOnly(target, file ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : {});
    } else if (args.includes('--servers')) res = await swapServers(target);
    else if (args.includes('--changes')) res = { from: flag('--changes') || null, to: pluginVersion(), changes: changesBetween(flag('--changes') || null) };
    else if (args.includes('--plan')) res = planUpdate(target);
    else if (args.includes('--apply')) {
      const file = flag('--answers');
      res = applyUpdate(target, file ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')) : {});
    } else if (args.includes('--restore')) {
      try { res = restoreBackup(target, flag('--restore'), { force: args.includes('--force') }); } catch (e) {
        if (e.message !== 'not-latest') throw e;
        res = { error: 'not-latest', latest: (listBackups(target)[0] || {}).name || null };
      }
    } else if (args.includes('--backups')) res = listBackups(target);
    else res = { error: 'usage', usage: 'update.mjs <폴더> --versions | --refresh-plan | --refresh [--answers <파일>] | --servers | --changes <옛 버전> | --plan | --apply [--answers <파일>] | --restore <이름> [--force] | --backups' };
  } catch (e) {
    console.error('업데이트하지 못했습니다: ' + e.message);
    process.exit(1);
  }
  console.log(JSON.stringify(res, null, 2));
}
