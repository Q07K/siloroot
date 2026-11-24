import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 사용자 폴더(~/.siloroot/user.json이 있는 곳)를 임시 폴더로 바꾼다. 진짜 사용자 폴더를 건드리지 않게, 이 파일을 불러오는 모든 테스트에 쓰인다.
// 공백과 한글을 넣어 Windows 사용자 이름에 공백이 든 경우도 함께 본다. 자식 프로세스(훅, 스크립트)도 이 값을 물려받는다.
if (!process.env.SILOROOT_USER_DIR) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'siloroot-user-')), '사용자 A');
  fs.mkdirSync(dir, { recursive: true });
  process.env.SILOROOT_USER_DIR = dir;
}

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
