#!/usr/bin/env node
// SiloRoot 작업 공간 초기화. /siloroot:init 스킬이 실행한다.
// - 없는 파일만 만든다. 이미 있는 파일은 건드리지 않는다 (CLAUDE.md, CLAUDE.local.md는 표시 블록만, .ignore와 git 제외 목록은 빠진 줄만 더한다).
// - 두 번 실행해도 결과가 같다.
// - 작업 공간은 두 가지다(lib/layout.mjs). 프로젝트는 문서를 .siloroot/ 안에 두고 shared/와 private/로 나눈다.
//   홈은 사람마다 하나이고, 공부 노트와 사용자 정보를 둔다. 홈 없는 프로젝트는 없어서, 새 프로젝트는 홈이 없으면 홈도 만든다.
// - 이미 초기화된 폴더는 그 모양(schema)과 배치를 그대로 따르고 맞추기만 한다. 옮기는 것은 /siloroot:migrate에 맡긴다.
// - 홈 위치와 프로젝트 목록은 사용자 단위 설정(~/.siloroot/user.json, lib/user.mjs)에 적는다.
// 실행: node scripts/init.mjs <폴더> [--mode project|home] [--home <홈 경로>] [--home-access add|skip]
//   표준 출력에 결과 JSON. 사람 답이 필요하거나 멈추면 { error, ... }를 쓰고 종료 코드 2
//   error: need-home(홈 위치를 물어야 함, defaultHome), user-json-invalid(user.json이 깨짐, file), not-home(홈 자리에 프로젝트가 있음),
//          home-path-space(홈 경로에 공백), home-in-project(홈이 프로젝트와 같거나 안이나 바깥)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig, writeConfig, findFreePort, SCHEMA, pluginVersion } from '../lib/config.mjs';
import { pendingMigrations } from '../lib/migrations/index.mjs';
import { timeScript } from '../lib/metrics.mjs';
import { applyRefresh, ensureLines, gitExcludeFile, EXCLUDE_HEAD } from '../lib/workspace-sync.mjs';
import { readUser, setHome, registerProject, usedPorts, userDir, userFile, importPath, overlaps } from '../lib/user.mjs';
import { addAdditionalDirectory } from '../lib/claude-settings.mjs';
import { applyCodex } from '../lib/codex.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(here, '..', 'viewer', 'build.mjs');
const slash = (p) => path.resolve(p).split(path.sep).join('/');
const build = (root) => execFileSync(process.execPath, [BUILD, root], { stdio: 'ignore', windowsHide: true });
const urlOf = (cfg) => 'http://127.0.0.1:' + cfg.port;

// Codex 전역 지침의 SiloRoot 블록도 맞춘다(lib/codex.mjs). Codex를 쓰지 않으면(폴더가 없으면) codex를 적지 않는다
function withCodex(res) {
  const c = applyCodex();
  if (!c) return res;
  res.codex = { file: c.file, state: c.state };
  if (c.message) (c.state === 'conflict' || c.state === 'error' ? res.warnings : res.notes).push(c.message);
  return res;
}

// 새로 고른 홈 자리를 쓸 수 있는지 본다. 못 쓰면 { error, ... }, 쓸 수 있으면 null
// - 홈 경로(사용자 폴더 아래면 ~/ 뒤)에 공백이 있으면 규칙 블록의 @ 불러오기가 공백에서 끊긴다
// - 홈이 프로젝트와 같거나 안이나 바깥이면 개인 문서가 팀 저장소로 들어가거나 팀 CLAUDE.md를 고친다
function checkHome(home, projectRoot) {
  if (/\s/.test(importPath(path.join(home, 'profile.md')))) return { error: 'home-path-space', home: slash(home) };
  const roots = [projectRoot, ...readUser().projects.map((p) => p.path)].filter(Boolean);
  const hit = roots.find((r) => overlaps(home, r));
  if (hit) return { error: 'home-in-project', home: slash(home), project: slash(hit) };
  return null;
}

// 홈을 만들거나 맞춘다. 홈은 폴더 자체가 문서 뿌리(flat)이고 설정만 <홈>/.siloroot/에 둔다
// codex: false면 Codex 전역 지침을 맞추지 않는다(프로젝트 초기화가 홈을 만들 때. 프로젝트 쪽에서 한 번 맞추고 알린다)
export async function initHome(homeArg, { codex = true } = {}) {
  const home = path.resolve(homeArg);
  if (readUser().invalid) return { error: 'user-json-invalid', file: userFile() };
  const existing = loadConfig(home);
  if (!existing) { const bad = checkHome(home); if (bad) return bad; }
  if (existing && existing.mode !== 'home') return { error: 'not-home', home: slash(home) };
  fs.mkdirSync(home, { recursive: true });
  const rel = (full) => path.relative(home, full).split(path.sep).join('/');
  let cfg = existing;
  const configCreated = !cfg;
  if (!cfg) {
    // 4180은 대개 처음 만드는 프로젝트가 쓰므로 홈은 4181부터 찾는다
    writeConfig(home, { port: await findFreePort(4181, 4299, { avoid: usedPorts() }), schema: SCHEMA, mode: 'home', plugin: pluginVersion() });
    cfg = loadConfig(home);
  }
  const { created, updated, skipped, warnings, notes } = applyRefresh(home, cfg);
  (configCreated ? created : skipped).push(rel(path.join(home, '.siloroot', 'config.json')));
  setHome(home);
  build(home);
  const res = { mode: 'home', root: slash(home), created, updated, skipped, warnings, notes, port: cfg.port, url: urlOf(cfg) };
  return codex ? withCodex(res) : res;
}

// 홈 쓰기 허락: 프로젝트의 .claude/settings.local.json에 홈을 더한다. git 저장소면 그 파일을 이 PC의 제외 목록에도 넣는다
function grantHomeAccess(root, home, answer) {
  if (answer === 'skip') return 'skipped';
  if (answer !== 'add') return 'not-asked';
  const state = addAdditionalDirectory(root, home);
  const exclude = gitExcludeFile(root);
  if (state !== 'invalid' && exclude) ensureLines(exclude, EXCLUDE_HEAD, ['.claude/settings.local.json']);
  return state;
}

export async function initProject(rootArg, { home, homeAccess } = {}) {
  const root = path.resolve(rootArg);
  const rel = (full) => path.relative(root, full).split(path.sep).join('/');
  const cfgFile = path.join(root, '.siloroot', 'config.json');

  // 이미 있는 작업 공간: 설정(모양, 배치, tracked 등)을 그대로 따르고 맞추기만 한다
  const existing = loadConfig(root);
  if (existing) {
    const v3project = existing.schema >= 3 && existing.mode === 'project';
    let u = readUser();
    // user.json을 잃은 모양 3 프로젝트: --home으로 홈을 다시 잇고 이 프로젝트를 다시 등록한다(맞추기 전에, 블록이 홈 경로를 쓰므로)
    if (v3project && !u.invalid) {
      if (!u.home && home) {
        const hc = loadConfig(home);
        if (hc && hc.mode !== 'home') return { error: 'not-home', home: slash(home) };
        if (hc) { const bad = overlaps(home, root) ? { error: 'home-in-project', home: slash(home), project: slash(root) } : null; if (bad) return bad; setHome(home); }
        else { const h = await initHome(home, { codex: false }); if (h.error) return h; }
      }
      registerProject(root);
      u = readUser();
    }
    const { created, updated, skipped, warnings, notes } = applyRefresh(root, existing);
    skipped.push(rel(cfgFile));
    // init은 옮기지 않는다. 옮기는 것은 /siloroot:migrate가 한다(scripts/update.mjs).
    if (pendingMigrations(existing.schema, SCHEMA).length) warnings.push(`작업 공간 모양이 예전 버전입니다(모양 ${existing.schema}). /siloroot:migrate로 옮기세요.`);
    // 홈을 모르거나 user.json이 깨졌다는 알림은 맞추기(applyRefresh)가 낸다
    const res = { mode: existing.mode, layout: existing.layout, created, updated, skipped, warnings, notes, port: existing.port, url: urlOf(existing) };
    if (v3project && u.home) res.homeAccess = grantHomeAccess(root, u.home, homeAccess);
    build(root);
    return withCodex(res);
  }

  // 새 프로젝트: 홈부터 정한다. 아무것도 만들기 전에 멈출 것을 본다
  const u = readUser();
  if (u.invalid) return { error: 'user-json-invalid', file: userFile() };
  const homeDir = u.home ?? (home ? slash(home) : null);
  if (!homeDir) return { error: 'need-home', defaultHome: slash(path.join(userDir(), 'siloroot-home')) };
  const homeCfg = loadConfig(homeDir);
  if (homeCfg && homeCfg.mode !== 'home') return { error: 'not-home', home: homeDir };
  // 홈이 이 프로젝트와 겹치면 개인 문서가 팀 저장소에 들어간다. 새로 고르는 홈이면 경로의 공백도 본다
  if (overlaps(homeDir, root)) return { error: 'home-in-project', home: homeDir, project: slash(root) };
  if (!homeCfg) { const bad = checkHome(homeDir, root); if (bad) return bad; }
  let homeCreated = false;
  if (!homeCfg) {
    const h = await initHome(homeDir, { codex: false });
    if (h.error) return h;
    homeCreated = true;
  } else if (!u.home) {
    setHome(homeDir);
  }

  fs.mkdirSync(root, { recursive: true });
  writeConfig(root, { port: await findFreePort(4180, 4299, { avoid: usedPorts() }), layout: 'wrapped', schema: SCHEMA, mode: 'project', plugin: pluginVersion() });
  const cfg = loadConfig(root);
  const name = registerProject(root);
  const { created, updated, skipped, warnings, notes } = applyRefresh(root, cfg);
  created.push(rel(cfgFile));
  const homeAccessState = grantHomeAccess(root, homeDir, homeAccess);
  build(root);
  return withCodex({
    mode: 'project', layout: 'wrapped', name, home: homeDir, homeCreated, homeAccess: homeAccessState,
    created, updated, skipped, warnings, notes, port: cfg.port, url: urlOf(cfg),
  });
}

function parseArgs(argv) {
  const out = { target: process.cwd(), mode: 'project' };
  const rest = [...argv];
  if (rest.length && !rest[0].startsWith('--')) out.target = rest.shift();
  while (rest.length) {
    const k = rest.shift();
    if (k === '--mode') out.mode = rest.shift();
    else if (k === '--home') out.home = rest.shift();
    else if (k === '--home-access') out.homeAccess = rest.shift();
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const a = parseArgs(process.argv.slice(2));
  timeScript(a.target, 'script', 'script:init');
  const run = a.mode === 'home' ? initHome(a.target) : initProject(a.target, { home: a.home, homeAccess: a.homeAccess });
  run.then(
    (res) => { console.log(JSON.stringify(res, null, 2)); if (res.error) process.exitCode = 2; },
    (e) => { console.error('초기화하지 못했습니다: ' + e.message); process.exit(1); },
  );
}
