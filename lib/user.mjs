// 사용자 단위 설정 <사용자 폴더>/.siloroot/user.json. 홈 위치와 등록한 프로젝트 목록을 적는다.
// 다른 작업 공간을 가리키는 경로(home:..., <이름>:...)를 풀 때와, 새 작업 공간의 포트를 고를 때 쓴다.
// { "version": 1, "home": "C:/Users/me/siloroot-home", "projects": [{ "name": "앱", "path": "C:/work/앱" }] }
// 경로는 '/'로 잇는다. 테스트는 SILOROOT_USER_DIR로 사용자 폴더를 임시 폴더로 바꾼다(test/fixtures.mjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './config.mjs';

export const userDir = () => process.env.SILOROOT_USER_DIR || os.homedir();
export const userFile = () => path.join(userDir(), '.siloroot', 'user.json');

const slash = (p) => path.resolve(p).split(path.sep).join('/');
const samePath = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
const empty = () => ({ version: 1, home: null, projects: [] });

// 없으면 빈 값, 깨졌으면 빈 값에 invalid: true. 깨진 파일은 쓰는 함수가 덮어쓰지 않는다
export function readUser() {
  let text;
  try { text = fs.readFileSync(userFile(), 'utf8'); } catch { return empty(); }
  try {
    const raw = JSON.parse(text.replace(/^﻿/, ''));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not an object');
    return {
      version: 1,
      home: typeof raw.home === 'string' ? raw.home : null,
      projects: Array.isArray(raw.projects) ? raw.projects.filter((p) => p && typeof p.name === 'string' && typeof p.path === 'string') : [],
    };
  } catch {
    return { ...empty(), invalid: true };
  }
}

function writable() {
  const u = readUser();
  if (u.invalid) throw new Error('user-json-invalid');
  return u;
}

function save(u) {
  fs.mkdirSync(path.dirname(userFile()), { recursive: true });
  fs.writeFileSync(userFile(), JSON.stringify({ version: 1, home: u.home, projects: u.projects }, null, 2) + '\n');
}

export function setHome(home) {
  const u = writable();
  u.home = slash(home);
  save(u);
}

// 프로젝트를 목록에 넣고 이름을 돌려준다. 이름은 다른 문서에서 '<이름>:경로'로 가리킬 때 쓰여서 공백과 ':'를 '-'로 바꾼다.
// 이미 있는 경로면 있는 이름, 겹치면 -2, -3. 'home'은 홈을 가리키는 이름이라 쓰지 않는다
export function registerProject(root) {
  const u = writable();
  const abs = slash(root);
  const found = u.projects.find((p) => samePath(p.path, abs));
  if (found) return found.name;
  const base = path.basename(abs).replace(/[\s:]+/g, '-') || 'project';
  const taken = (n) => n === 'home' || u.projects.some((p) => p.name === n);
  let name = base;
  for (let i = 2; taken(name); i++) name = `${base}-${i}`;
  u.projects.push({ name, path: abs });
  save(u);
  return name;
}

// 'home'이면 홈, 아니면 등록된 프로젝트 경로. 모르면 null
export function workspaceRoot(name) {
  const u = readUser();
  if (name === 'home') return u.home;
  return u.projects.find((p) => p.name === name)?.path ?? null;
}

// CLAUDE.md의 @ 불러오기에 쓸 경로. 사용자 폴더 아래면 '~/...'로 적어 공백이 든 사용자 이름을 피한다
export function importPath(abs) {
  const rel = path.relative(userDir(), path.resolve(abs));
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return '~/' + rel.split(path.sep).join('/');
  return slash(abs);
}

// 홈과 등록한 프로젝트가 쓰는 포트. 지금 꺼져 있어도 새 작업 공간이 집지 않게 한다
export function usedPorts() {
  const u = readUser();
  const ports = new Set();
  for (const root of [u.home, ...u.projects.map((p) => p.path)]) {
    if (!root) continue;
    const cfg = loadConfig(root);
    if (cfg) ports.add(cfg.port);
  }
  return ports;
}
