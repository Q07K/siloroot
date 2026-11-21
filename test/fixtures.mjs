import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 공백과 한글이 든 새 임시 프로젝트 폴더를 만든다.
export function makeProject(name = '테스트 폴더 A') {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'siloroot-'));
  const root = path.join(base, name);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

export function write(root, rel, text) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
  return full;
}
