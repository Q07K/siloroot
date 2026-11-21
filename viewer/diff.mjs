// 줄 단위 비교. 뷰어 생성기(최근 바뀐 것)와 서버(웹 편집 기록)가 같이 쓴다.

export function diffLines(a, b) {
  const n = a.length, m = b.length;
  if (n * m > 6_000_000) return null;
  const W = m + 1;
  const dp = new Uint32Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * W + j] = a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push([' ', a[i]]); i++; j++; }
    else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) { ops.push(['-', a[i]]); i++; }
    else { ops.push(['+', b[j]]); j++; }
  }
  while (i < n) ops.push(['-', a[i++]]);
  while (j < m) ops.push(['+', b[j++]]);
  return ops;
}

export function compact(ops, ctx = 2, limit = 400) {
  const keep = new Array(ops.length).fill(false);
  ops.forEach((o, k) => {
    if (o[0] === ' ') return;
    for (let d = -ctx; d <= ctx; d++) if (k + d >= 0 && k + d < ops.length) keep[k + d] = true;
  });
  const out = [];
  let gap = false;
  for (let k = 0; k < ops.length; k++) {
    if (keep[k]) { out.push(ops[k]); gap = false; }
    else if (!gap && out.length) { out.push(['…', '']); gap = true; }
    if (out.length >= limit) { out.push(['…', '(이하 생략)']); break; }
  }
  while (out.length && out[out.length - 1][0] === '…' && out[out.length - 1][1] === '') out.pop();
  return out;
}

// 두 글을 비교해 늘어난 줄, 줄어든 줄, 보여 줄 조각을 돌려준다.
export function summarize(before, after) {
  const ops = diffLines(before.split('\n'), after.split('\n'));
  return {
    plus: ops ? ops.filter((o) => o[0] === '+').length : 0,
    minus: ops ? ops.filter((o) => o[0] === '-').length : 0,
    diff: ops ? compact(ops) : null,
  };
}
