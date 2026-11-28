// Codex 전역 지침 파일(~/.codex/AGENTS.md)의 SiloRoot 관리 블록. init과 업데이트가 작업 공간을 맞출 때 같이 맞춘다.
// - Codex는 CLAUDE.local.md를 읽지 않아서 SiloRoot 규칙을 모른다. 세션 시작 훅(scripts/rules.mjs)이 규칙 본문을 넣지만,
//   훅은 사용자가 신뢰해야 돈다. 이 블록은 훅이 돌지 않아도 Codex가 규칙 파일을 찾아 읽게 하는 안전망이다
//   (shared/issues/codex-rules-not-loaded.md).
// - Codex 폴더(CODEX_HOME, 없으면 ~/.codex)가 없으면 Codex를 쓰지 않는 것으로 보고 아무것도 만들지 않는다.
// - Codex는 폴더마다 AGENTS.override.md가 있으면 그것만 읽으므로, 그 파일이 비어 있지 않으면 그쪽에 넣는다.
// - 블록 밖(사용자가 쓴 지침)은 건드리지 않는다. 작업 공간 밖 파일이라 작업 공간 백업에는 담지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import { readUser, userDir } from './user.mjs';
import { readTpl, blockState, ensureBlock } from './workspace-sync.mjs';

export const codexHome = () => process.env.CODEX_HOME || path.join(userDir(), '.codex');

const nonEmpty = (file) => { try { return fs.readFileSync(file, 'utf8').trim() !== ''; } catch { return false; } };

// Codex가 읽는 전역 지침 파일. Codex 폴더가 없으면 null
export function codexAgentsFile() {
  const dir = codexHome();
  if (!fs.existsSync(dir)) return null;
  const override = path.join(dir, 'AGENTS.override.md');
  return nonEmpty(override) ? override : path.join(dir, 'AGENTS.md');
}

export function codexBlock() {
  const home = readUser().home;
  return readTpl('codex/AGENTS.block.md').split('{{home}}').join(home || '`~/.siloroot/user.json`의 home').trimEnd();
}

const shown = (file) => file.split(path.sep).join('/');

// 쓰지 않고 판정만 한다. Codex 폴더가 없으면 null. state: created, updated, skipped, conflict
export function planCodex() {
  const file = codexAgentsFile();
  return file ? { file: shown(file), state: blockState(file, codexBlock()) } : null;
}

// 맞춘다. 결과는 planCodex와 같은 꼴에 사람에게 보일 한 줄(message)을 더한다
export function applyCodex() {
  const file = codexAgentsFile();
  if (!file) return null;
  let state;
  try { state = ensureBlock(file, codexBlock(), (b) => b + '\n'); } catch (e) { return { file: shown(file), state: 'error', message: `Codex 전역 지침(${shown(file)})을 쓰지 못했습니다: ${e.message}` }; }
  const message = {
    created: `Codex 전역 지침(${shown(file)})을 만들고 SiloRoot 블록을 넣었습니다. Codex도 SiloRoot 폴더에서 규칙 파일을 읽습니다.`,
    updated: `Codex 전역 지침(${shown(file)})의 SiloRoot 블록을 넣거나 새로 맞췄습니다. 블록 밖은 그대로 두었습니다.`,
    conflict: `Codex 전역 지침(${shown(file)})의 SiloRoot 표시가 짝이 맞지 않아 건드리지 않았습니다. 두 표시를 한 번씩만 남기거나 모두 지운 뒤 다시 실행하세요.`,
  }[state] || null;
  return { file: shown(file), state, message };
}
