#!/usr/bin/env node
// SiloRoot 작업 공간을 설치된 플러그인 버전에 맞춘다. /siloroot:update 스킬이 실행한다.
// - 작업 공간 모양(schema)이 플러그인(SCHEMA)보다 낮으면 마이그레이션(lib/migrations/)을 순서대로 돌린다.
// - 그 뒤 관리 블록, 빠진 파일, 빠진 줄을 맞춘다(lib/workspace-sync.mjs). 이미 있는 안내 문서는 덮어쓰지 않는다.
// - 파일을 바꾸기 전에 백업하고(lib/backup.mjs), 되돌릴 수 있다.
// 실행:
//   node scripts/update.mjs <프로젝트 폴더> --plan                         바뀔 것을 미리 본다. 파일을 바꾸지 않는다
//   node scripts/update.mjs <프로젝트 폴더> --apply [--answers <json 파일>]  적용한다
//   node scripts/update.mjs <프로젝트 폴더> --restore <백업 이름> [--force]  최신 백업을 되돌린다
//   node scripts/update.mjs <프로젝트 폴더> --backups                      백업 목록
// 출력은 모두 표준 출력의 JSON이다.
// answers: { migrations: { <id>: 'apply'|'hold' }, decisions: { <id>: 값 }, declined: { <파일>: [표 항목] } }

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig, updateConfig, pluginVersion, SCHEMA, SUPPORTED_SCHEMAS } from '../lib/config.mjs';
import { pendingMigrations } from '../lib/migrations/index.mjs';
import { planRefresh, applyRefresh, refreshPaths } from '../lib/workspace-sync.mjs';
import { createBackup, sealBackup, listBackups, restoreBackup, pruneBackups } from '../lib/backup.mjs';
import { timeScript } from '../lib/metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(here, '..', 'viewer', 'build.mjs');
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

const refreshClean = (r) => r.blocks.every((b) => b.state === 'skipped' || b.state === 'conflict') && !r.missingFiles.length && !r.missingLines.length;
const heldBy = (cfg, m) => cfg.hold != null && m.to <= cfg.hold;

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
  const migrations = pendingMigrations(cfg.schema, SCHEMA).map((m) => ({
    id: m.id, title: m.title, from: m.from, to: m.to, held: heldBy(cfg, m), plan: m.plan({ root, cfg }),
  }));
  const refresh = planRefresh(root, cfg, { declined });
  const upToDate = migrations.every((m) => m.held) && refreshClean(refresh) && !refresh.guideGaps.length;
  return { from: cfg.schema, to: SCHEMA, pluginFrom: cfg.plugin, pluginTo: pluginVersion(), hold: cfg.hold, migrations, refresh, upToDate };
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
  const answers = { migrations: {}, decisions: {}, declined: {}, ...answersArg };

  // 돌릴 마이그레이션. 하나를 머물기로 하면 그 뒤도 모두 머문다(모양은 한 칸씩만 오른다)
  const pending = pendingMigrations(cfg.schema, SCHEMA);
  const missing = [];
  const run = [];
  let holding = false;
  for (const m of pending) {
    // 전에 머물기로 한(hold) 마이그레이션은 답이 없으면 계속 머문다
    const a = answers.migrations[m.id] ?? (heldBy(cfg, m) ? 'hold' : undefined);
    if (a !== 'apply' && a !== 'hold') { missing.push('migration:' + m.id); continue; }
    if (a === 'hold') holding = true;
    run.push({ m, hold: holding });
  }
  // 사람이 고를 것에 답이 없으면 기본값을 쓰지 않고 멈춘다
  const plans = new Map();
  for (const { m, hold } of run) {
    if (hold) continue;
    const p = m.plan({ root, cfg });
    plans.set(m.id, p);
    for (const d of p.decisions) if (!d.options.includes(answers.decisions[d.id])) missing.push(d.id);
  }
  if (missing.length) return { error: 'missing-decisions', ids: missing };

  const declined = saveDeclined(cfg, answers.declined);
  const applying = run.filter((x) => !x.hold).map((x) => x.m);
  const touchesFiles = applying.length || !refreshClean(planRefresh(root, cfg, { declined }));

  let backup = null;
  if (touchesFiles) {
    const files = ['.siloroot/config.json'], creates = [];
    for (const m of applying) { const t = plans.get(m.id).touches; files.push(...t.files); creates.push(...t.creates); }
    // 맞추기는 마이그레이션 뒤 배치로 돌기 때문에 지금 배치와 감싼 배치의 대상을 모두 담는다
    files.push(...refreshPaths(root, cfg), ...refreshPaths(root, { ...cfg, layout: 'wrapped' }));
    const to = applying.length ? applying[applying.length - 1].to : cfg.schema;
    backup = createBackup(root, { from: cfg.schema, to, files, creates }).name;
  }

  const results = [];
  let stoppedAt = null;
  let heldTo = null;
  for (const { m, hold } of run) {
    if (hold) { results.push({ id: m.id, status: 'held' }); heldTo = Math.max(heldTo ?? 0, m.to); continue; }
    try {
      m.apply({ root, cfg: loadConfig(root) }, answers.decisions);
      updateConfig(root, { schema: m.to, hold: null });
      results.push({ id: m.id, status: 'applied' });
    } catch (e) {
      results.push({ id: m.id, status: 'failed', error: e.message });
      stoppedAt = m.id;
      break;
    }
  }

  let refresh = null;
  if (!stoppedAt) {
    if (heldTo != null) updateConfig(root, { hold: heldTo });
    refresh = applyRefresh(root, loadConfig(root), { declined });
    updateConfig(root, { plugin: pluginVersion() });
  }
  if (backup) { sealBackup(root, backup); pruneBackups(root); }
  const after = loadConfig(root);
  return { backup, migrations: results, refresh, check: check(root), schema: after.schema, plugin: after.plugin, stoppedAt };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [target = process.cwd(), ...args] = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
  timeScript(target, 'script', 'script:update');
  let res;
  try {
    if (args.includes('--plan')) res = planUpdate(target);
    else if (args.includes('--apply')) {
      const file = flag('--answers');
      res = applyUpdate(target, file ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')) : {});
    } else if (args.includes('--restore')) {
      try { res = restoreBackup(target, flag('--restore'), { force: args.includes('--force') }); } catch (e) {
        if (e.message !== 'not-latest') throw e;
        res = { error: 'not-latest', latest: (listBackups(target)[0] || {}).name || null };
      }
    } else if (args.includes('--backups')) res = listBackups(target);
    else res = { error: 'usage', usage: 'update.mjs <프로젝트 폴더> --plan | --apply [--answers <파일>] | --restore <이름> [--force] | --backups' };
  } catch (e) {
    console.error('업데이트하지 못했습니다: ' + e.message);
    process.exit(1);
  }
  console.log(JSON.stringify(res, null, 2));
}
