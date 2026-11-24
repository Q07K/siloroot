// 프로젝트의 .siloroot/config.json을 읽고 쓴다. 모든 SiloRoot 스크립트가 이 파일로 폴더 이름과 포트를 정한다.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export const DEFAULT_DIRS = Object.freeze({ log: '01-log', study: '02-study', ideas: '03-ideas', feedback: '04-feedback', profile: '05-profile' });

const fileOf = (root) => path.join(path.resolve(root), '.siloroot', 'config.json');

// 문서를 두는 배치는 두 가지다.
// - wrapped: SiloRoot 문서를 모두 프로젝트의 .siloroot/ 안에 둔다. 새로 초기화하는 폴더의 기본값.
// - flat: 문서를 프로젝트 맨 위에 바로 둔다. layout 값이 없는 예전 설정은 이것으로 읽는다.
// root는 늘 프로젝트 폴더이고, 문서가 있는 곳은 docsRoot다. 문서 안의 경로(related, 백틱 경로)는 docsRoot 기준이다.
export const LAYOUTS = Object.freeze(['wrapped', 'flat']);

// 설정이 없으면 null. SiloRoot 폴더가 아니라는 뜻이다.
export function loadConfig(root) {
  const abs = path.resolve(root);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(fileOf(abs), 'utf8').replace(/^﻿/, '')); } catch { return null; }
  const layout = raw.layout === 'wrapped' ? 'wrapped' : 'flat';
  return {
    root: abs,
    layout,
    docsRoot: layout === 'wrapped' ? path.join(abs, '.siloroot') : abs,
    port: Number(raw.port) || 4180,
    dirs: { ...DEFAULT_DIRS, ...(raw.dirs || {}) },
    stateDir: path.join(abs, '.siloroot', 'state'),
    // 사용 기록(lib/metrics.mjs). "metrics": false면 남기지 않는다.
    metrics: raw.metrics !== false,
  };
}

export function writeConfig(root, { port, dirs, layout } = {}) {
  const file = fileOf(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = { version: 1, port };
  if (layout === 'wrapped') body.layout = 'wrapped';
  if (dirs) body.dirs = dirs;
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
}

function canListen(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

export async function findFreePort(start = 4180, end = 4299) {
  for (let p = start; p <= end; p++) if (await canListen(p)) return p;
  throw new Error(`${start}~${end} 사이에 빈 포트가 없습니다`);
}
