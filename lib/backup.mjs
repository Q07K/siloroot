// 업데이트(scripts/update.mjs) 전에 건드릴 파일을 복사해 두고, 되돌린다.
// .siloroot/는 바깥 저장소의 git에서 빠져 있어 git으로 되돌릴 수 없기 때문이다.
// 자리: .siloroot/state/backups/<YYYYMMDD-HHmmss>-schema<from>-to<to>/
//   files/<원래 경로>   바꾸기 전 내용
//   manifest.json       { name, created, from, to, roots, creates, files, existed, after }
//   after-update/       되돌릴 때 업데이트 뒤 고친 파일을 따로 남긴 곳(force)
// 경로는 모두 프로젝트 맨 위 기준이고 /로 잇는다. .siloroot/state/ 아래는 담지도 지우지도 않는다.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const KEEP_REFRESH = 5; // 맞추기만 한(from = to) 백업을 몇 개 남길지
const STATE = '.siloroot/state';
const dirOf = (root) => path.join(path.resolve(root), '.siloroot', 'state', 'backups');
const abs = (root, rel) => path.join(path.resolve(root), ...rel.split('/'));
const inState = (rel) => rel === STATE || rel.startsWith(STATE + '/');
const hashOf = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// rel이 파일이면 [rel], 폴더면 안의 파일 전부, 없으면 []. state/ 아래는 뺀다.
function filesUnder(root, rel) {
  if (inState(rel)) return [];
  const full = abs(root, rel);
  let st;
  try { st = fs.statSync(full); } catch { return []; }
  if (st.isFile()) return [rel];
  if (!st.isDirectory()) return [];
  const out = [];
  for (const name of fs.readdirSync(full)) out.push(...filesUnder(root, rel + '/' + name));
  return out;
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const readManifest = (root, name) => JSON.parse(fs.readFileSync(path.join(dirOf(root), name, 'manifest.json'), 'utf8'));
const writeManifest = (root, name, m) => fs.writeFileSync(path.join(dirOf(root), name, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');

// files: 바꾸거나 옮길 원래 경로(폴더면 안의 파일 전부). creates: 업데이트가 새로 만들 경로(옮긴 뒤 자리, 새 파일).
export function createBackup(root, { from, to, files = [], creates = [] }) {
  const roots = [...new Set(files.concat(creates))].filter((r) => !inState(r));
  let name = `${stamp()}-schema${from}-to${to}`;
  for (let i = 2; fs.existsSync(path.join(dirOf(root), name)) || fs.existsSync(path.join(dirOf(root), name + '.restored')); i++) name = `${stamp()}-schema${from}-to${to}-${i}`;
  const dir = path.join(dirOf(root), name);
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  const saved = [];
  for (const r of roots) {
    for (const rel of filesUnder(root, r)) {
      if (saved.includes(rel)) continue;
      const dest = path.join(dir, 'files', ...rel.split('/'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(abs(root, rel), dest);
      saved.push(rel);
    }
  }
  const existed = roots.filter((r) => fs.existsSync(abs(root, r)));
  writeManifest(root, name, { name, created: new Date().toISOString(), from, to, roots, creates, files: saved, existed, after: {} });
  return { name, dir };
}

// 적용 직후 상태의 해시를 적는다. 되돌리기 전에 견주어 업데이트 뒤 고친 파일을 찾는다.
export function sealBackup(root, name) {
  const m = readManifest(root, name);
  const after = {};
  for (const rel of m.files) after[rel] = null;
  for (const r of m.roots) for (const rel of filesUnder(root, r)) after[rel] = hashOf(abs(root, rel));
  m.after = after;
  writeManifest(root, name, m);
}

// 최신이 앞. 되돌린 것(.restored)은 뺀다.
export function listBackups(root) {
  let names = [];
  try { names = fs.readdirSync(dirOf(root)); } catch { return []; }
  const out = [];
  for (const name of names) {
    if (name.endsWith('.restored')) continue;
    try {
      const m = readManifest(root, name);
      out.push({ name, created: m.created, from: m.from, to: m.to });
    } catch { /* manifest가 없는 폴더는 백업이 아니다 */ }
  }
  return out.sort((a, b) => (a.created === b.created ? (a.name < b.name ? 1 : -1) : a.created < b.created ? 1 : -1));
}

// 업데이트 뒤에 고쳐졌거나 새로 생긴 파일
function changedSince(root, m) {
  const out = [];
  for (const r of m.roots) {
    for (const rel of filesUnder(root, r)) {
      if (!(rel in m.after) || m.after[rel] !== hashOf(abs(root, rel))) out.push(rel);
    }
  }
  return out;
}

// 빈 폴더를 아래부터 지운다. keep에 든 폴더는 남긴다.
function pruneEmpty(full, keep) {
  let st;
  try { st = fs.statSync(full); } catch { return; }
  if (!st.isDirectory()) return;
  for (const name of fs.readdirSync(full)) pruneEmpty(path.join(full, name), keep);
  if (!keep.has(full) && fs.readdirSync(full).length === 0) fs.rmdirSync(full);
}

export function restoreBackup(root, name, { force = false } = {}) {
  const latest = listBackups(root)[0];
  if (!latest || latest.name !== name) throw new Error('not-latest');
  const dir = path.join(dirOf(root), name);
  const m = readManifest(root, name);
  const conflicts = changedSince(root, m);
  if (conflicts.length && !force) return { restored: [], removed: [], conflicts, keptAfter: null };

  let keptAfter = null;
  if (conflicts.length) {
    keptAfter = path.join(dir, 'after-update');
    for (const rel of conflicts) {
      const dest = path.join(keptAfter, ...rel.split('/'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(abs(root, rel), dest);
    }
  }

  // 원래 없던 파일(업데이트가 만든 것)을 지운다
  const original = new Set(m.files);
  const removed = [];
  for (const r of m.roots) {
    for (const rel of filesUnder(root, r)) {
      if (original.has(rel)) continue;
      fs.rmSync(abs(root, rel));
      removed.push(rel);
    }
  }
  // 원래 내용을 원래 자리에 쓴다
  const restored = [];
  for (const rel of m.files) {
    const dest = abs(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(dir, 'files', ...rel.split('/')), dest);
    restored.push(rel);
  }
  // 업데이트가 만든 빈 폴더를 지운다. 원래 있던 자리와 그 위는 남긴다
  const keep = new Set();
  for (const r of m.existed) {
    for (let p = abs(root, r); p.startsWith(path.resolve(root)); p = path.dirname(p)) { keep.add(p); if (p === path.resolve(root)) break; }
  }
  for (const rel of m.files) for (let p = path.dirname(abs(root, rel)); p.startsWith(path.resolve(root)); p = path.dirname(p)) { keep.add(p); if (p === path.resolve(root)) break; }
  for (const r of m.creates) if (!m.existed.includes(r)) pruneEmpty(abs(root, r), keep);

  fs.renameSync(dir, dir + '.restored');
  return { restored, removed, conflicts, keptAfter: keptAfter && path.join(dir + '.restored', 'after-update') };
}

// 맞추기만 한(from = to) 백업은 최근 KEEP_REFRESH개만 남긴다. 모양을 바꾼 백업은 저절로 지우지 않는다.
export function pruneBackups(root) {
  const refresh = listBackups(root).filter((b) => b.from === b.to);
  const removed = [];
  for (const b of refresh.slice(KEEP_REFRESH)) {
    fs.rmSync(path.join(dirOf(root), b.name), { recursive: true, force: true });
    removed.push(b.name);
  }
  return removed;
}
