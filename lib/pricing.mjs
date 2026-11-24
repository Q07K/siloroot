// 응답 하나의 토큰을 API 정가(달러)로 환산한다. 사용 기록 요약에서 "어디서 돈이 드나"를 보려고 쓴다.
// 구독 요금제의 실제 청구와는 다르다. 단계끼리 견줄 상대값으로 본다.
// 값: Anthropic 첫 자리 API 정가, 1백만 토큰당 달러 (2026-11-03 기준 표). 값이 바뀌면 이 표만 고친다.
// - 출력은 모든 모델이 입력의 5배.
// - 캐시 쓰기는 5분 캐시 1.25배, 1시간 캐시 2배.
// - 캐시 읽기는 대부분 0.1배, 아래 cacheRead를 적은 모델만 그 값.
// - fast 모드 응답(usage.speed === 'fast')은 2배.
// 표에 없는 모델은 값을 매기지 않고 unpriced로 센다.

const TABLE = [
  // [모델 id에 들어 있는 글자, 입력, 캐시 읽기(없으면 입력의 0.1배)]
  ['fable-5-2', 8, 0.2],
  ['mythos-5-2', 8, 0.2],
  ['fable-5-1', 10, 0.25],
  ['mythos-5-1', 10, 0.25],
  ['fable-5', 10],
  ['mythos-5', 10],
  ['opus-5-5', 4, 0.2],
  ['opus-5', 5],
  ['opus-4-8', 5],
  ['opus-4-7', 5],
  ['opus-4-6', 5],
  ['sonnet-5-5', 2, 0.1],
  ['sonnet-5', 2],
  ['sonnet-4-6', 3],
  ['haiku-5-5', 0.1],
  ['haiku-4-5', 1],
];

export function priceOf(model) {
  if (typeof model !== 'string') return null;
  const row = TABLE.find(([k]) => model.includes(k));
  if (!row) return null;
  const [, input, read] = row;
  return { input, output: input * 5, write5m: input * 1.25, write1h: input * 2, read: read ?? input * 0.1 };
}

// usage 하나의 값을 마이크로달러(1백만분의 1달러) 정수로. 읽기 몫은 따로 돌려준다. 표에 없으면 null.
export function costOf(model, u) {
  const p = priceOf(model);
  if (!p || !u) return null;
  const n = (v) => Number(v) || 0;
  const w1h = n(u.cache_creation && u.cache_creation.ephemeral_1h_input_tokens);
  const w5m = Math.max(0, n(u.cache_creation_input_tokens) - w1h);
  const fast = u.speed === 'fast' ? 2 : 1;
  const read = n(u.cache_read_input_tokens) * p.read * fast;
  const total = (n(u.input_tokens) * p.input + n(u.output_tokens) * p.output + w5m * p.write5m + w1h * p.write1h) * fast + read;
  // 1백만 토큰당 달러 × 토큰 = 마이크로달러
  return { micro: total, microRead: read };
}
