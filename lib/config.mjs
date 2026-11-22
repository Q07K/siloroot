// 프로젝트의 .siloroot/config.json을 읽고 쓴다. 모든 SiloRoot 스크립트가 이 파일로 폴더 이름과 포트를 정한다.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export const DEFAULT_DIRS = Object.freeze({ log: '01-log', study: '02-study', ideas: '03-ideas', feedback: '04-feedback', profile: '05-profile' });

const fileOf = (root) => path.join(path.resolve(root), '.siloroot', 'config.json');

// 설정이 없으면 null. SiloRoot 폴더가 아니라는 뜻이다.
export function loadConfig(root) {
  const abs = path.resolve(root);
  let raw;
  try { raw = JSON.parse(fs.readFileSync(fileOf(abs), 'utf8').replace(/^﻿/, '')); } catch { return null; }
  return {
    root: abs,
    port: Number(raw.port) || 4180,
    dirs: { ...DEFAULT_DIRS, ...(raw.dirs || {}) },
    stateDir: path.join(abs, '.siloroot', 'state'),
  };
}

export function writeConfig(root, { port, dirs } = {}) {
  const file = fileOf(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = { version: 1, port };
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
