// 프로젝트의 Claude Code 개인 설정(.claude/settings.local.json)을 고친다. 사용자가 더하라고 했을 때만 부른다.
import fs from 'node:fs';
import path from 'node:path';

export const settingsFile = (root) => path.join(path.resolve(root), '.claude', 'settings.local.json');

// dir이 이미 additionalDirectories에 있는가. 파일이 없거나 깨졌으면 false
export function hasAdditionalDirectory(root, dir) {
  try {
    const body = JSON.parse(fs.readFileSync(settingsFile(root), 'utf8').replace(/^﻿/, ''));
    const list = body?.permissions?.additionalDirectories;
    const norm = (s) => String(s).replace(/\\/g, '/').replace(/\/+$/, '');
    const same = (a, b) => (process.platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b));
    return Array.isArray(list) && list.some((x) => same(x, dir));
  } catch {
    return false;
  }
}

// permissions.additionalDirectories에 dir을 더한다. 다른 칸은 그대로 둔다.
// 'added' | 'present'(이미 있음) | 'invalid'(JSON이 아니라 건드리지 않음)
export function addAdditionalDirectory(root, dir) {
  const file = path.join(path.resolve(root), '.claude', 'settings.local.json');
  const want = dir.replace(/\\/g, '/');
  let body = {};
  if (fs.existsSync(file)) {
    try { body = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return 'invalid'; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return 'invalid';
  }
  const perms = body.permissions && typeof body.permissions === 'object' ? body.permissions : (body.permissions = {});
  const list = Array.isArray(perms.additionalDirectories) ? perms.additionalDirectories : (perms.additionalDirectories = []);
  const norm = (s) => String(s).replace(/\\/g, '/').replace(/\/+$/, '');
  const same = (a, b) => (process.platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b));
  if (list.some((x) => same(x, want))) return 'present';
  list.push(want);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
  return 'added';
}
