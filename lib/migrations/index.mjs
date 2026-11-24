// 작업 공간 모양(schema)을 한 칸씩 올리는 마이그레이션 모음. 번호 순서대로만 돈다.
// 마이그레이션 하나 = { id, from, to, title, plan(ctx), apply(ctx, answers) }, ctx = { root, cfg }
//   plan: 파일을 바꾸지 않고 { moves, edits, decisions, notes, touches }를 낸다.
//     decisions는 사람이 고를 것({ id, question, why, options, default })이고, touches는 백업할 경로({ files, creates })다.
//   apply: decisions의 답({ [id]: 값 })을 받아 바꾸고 { moved, edited, created, notes }를 낸다. 답이 빠지면 아무것도 바꾸지 않고 멈춘다.
// 새 모양을 만들면 lib/config.mjs의 SCHEMA를 올리고 여기에 더한다. 테스트도 같이 낸다.

import m001 from './001-wrap-siloroot-folder.mjs';
import m002 from './002-project-areas.mjs';

export const MIGRATIONS = [m001, m002];

// fromSchema에서 toSchema로 가는 데 돌릴 마이그레이션(순서대로)
export function pendingMigrations(fromSchema, toSchema) {
  return MIGRATIONS.filter((m) => m.from >= fromSchema && m.to <= toSchema).sort((a, b) => a.from - b.from);
}
