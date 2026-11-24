// 프로젝트의 .siloroot/config.json을 읽고 쓴다. 모든 SiloRoot 스크립트가 이 파일로 폴더 이름과 포트를 정한다.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 작업 공간 모양 번호. 폴더 배치, 문서 위치, 속성 규칙처럼 옮겨야 하는 변화가 있을 때만 오른다(lib/migrations/).
// 1: 예전 배치(flat), 2: .siloroot/ 안에 감싼 배치(wrapped),
// 3: 프로젝트는 shared/와 private/로 나누고 공부와 사용자 정보는 홈(mode: home)에 둔다(lib/layout.mjs)
// 모양 2에서 3으로는 마이그레이션 002(lib/migrations/002-project-areas.mjs)가 옮긴다. 모양 2에 머문 작업 공간도 계속 돈다.
export const SCHEMA = 3;
// 계속 읽고 관리 블록을 맞춰 주는 모양. 여기서 빼는 것(호환을 끊는 것)은 메이저 버전에서만 한다.
export const SUPPORTED_SCHEMAS = Object.freeze([1, 2, 3]);

export const DEFAULT_DIRS = Object.freeze({ log: '01-log', study: '02-study', ideas: '03-ideas', feedback: '04-feedback', profile: '05-profile' });

const fileOf = (root) => path.join(path.resolve(root), '.siloroot', 'config.json');
const PLUGIN_JSON = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.claude-plugin', 'plugin.json');

// 설치된 플러그인 버전
export function pluginVersion() {
  return JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8').replace(/^﻿/, '')).version;
}

function readRaw(root) {
  return JSON.parse(fs.readFileSync(fileOf(root), 'utf8').replace(/^﻿/, ''));
}

// 문서를 두는 배치는 두 가지다.
// - wrapped: SiloRoot 문서를 모두 프로젝트의 .siloroot/ 안에 둔다. 새로 초기화하는 폴더의 기본값.
// - flat: 문서를 프로젝트 맨 위에 바로 둔다. layout 값이 없는 예전 설정은 이것으로 읽는다.
// root는 늘 프로젝트 폴더이고, 문서가 있는 곳은 docsRoot다. 문서 안의 경로(related, 백틱 경로)는 docsRoot 기준이다.
export const LAYOUTS = Object.freeze(['wrapped', 'flat']);

// 설정이 없으면 null. SiloRoot 폴더가 아니라는 뜻이다.
export function loadConfig(root) {
  const abs = path.resolve(root);
  let raw;
  try { raw = readRaw(abs); } catch { return null; }
  const layout = raw.layout === 'wrapped' ? 'wrapped' : 'flat';
  const num = (v) => (Number.isInteger(v) ? v : null);
  return {
    root: abs,
    layout,
    docsRoot: layout === 'wrapped' ? path.join(abs, '.siloroot') : abs,
    port: Number(raw.port) || 4180,
    dirs: { ...DEFAULT_DIRS, ...(raw.dirs || {}) },
    stateDir: path.join(abs, '.siloroot', 'state'),
    // 사용 기록(lib/metrics.mjs). "metrics": false면 남기지 않는다.
    metrics: raw.metrics !== false,
    // 작업 공간 모양. 없으면 배치로 추정한다(wrapped면 2, 아니면 1)
    schema: num(raw.schema) ?? (layout === 'wrapped' ? 2 : 1),
    // 마지막으로 맞춘 플러그인 버전. 없으면 알 수 없음
    plugin: typeof raw.plugin === 'string' ? raw.plugin : null,
    // 옛 모양에 머물기로 한 목표 모양 번호(/siloroot:update에서 거절). 없으면 null
    hold: num(raw.hold),
    // 예전 배치에서 옮길 때 문서를 계속 바깥 git에 올리기로 했으면 true. 이때 git 제외 목록에 .siloroot/를 넣지 않는다
    tracked: raw.tracked === true,
    // 작업 공간 종류. 홈은 사람마다 하나이고 공부와 사용자 정보를 둔다. 없으면 프로젝트
    mode: raw.mode === 'home' ? 'home' : 'project',
  };
}

export function writeConfig(root, { port, dirs, layout, schema, plugin, mode } = {}) {
  const file = fileOf(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = { version: 1, port };
  if (layout === 'wrapped') body.layout = 'wrapped';
  if (dirs) body.dirs = dirs;
  if (schema != null) body.schema = schema;
  if (plugin != null) body.plugin = plugin;
  if (mode != null) body.mode = mode;
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
}

// 설정 파일의 원래 JSON에 patch를 얕게 합쳐 쓴다. 값이 null인 칸은 지우고, 모르는 칸은 남긴다.
export function updateConfig(root, patch) {
  const body = readRaw(root);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete body[k];
    else body[k] = v;
  }
  fs.writeFileSync(fileOf(root), JSON.stringify(body, null, 2) + '\n');
}

function canListen(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

// avoid: 지금 꺼져 있어도 다른 작업 공간이 쓰는 포트(lib/user.mjs의 usedPorts)
export async function findFreePort(start = 4180, end = 4299, { avoid = new Set() } = {}) {
  for (let p = start; p <= end; p++) if (!avoid.has(p) && (await canListen(p))) return p;
  throw new Error(`${start}~${end} 사이에 빈 포트가 없습니다`);
}
