// 시안: 실제 뷰어 연결 화면 위에 "읽은 문서 흔적"을 덧그린다. ?t=초 로 한 장면을 고른다.
(function () {
  const T = parseFloat(new URLSearchParams(location.search).get('t') || '0');
  const STEPS = [
    { at: 1.3, path: 'CLAUDE.md', kind: 'read' },
    { at: 2.3, path: '03-ideas/live-reading-graph.md', kind: 'read' },
    { at: 3.3, path: '02-study/claude-code-hooks.md', kind: 'read' },
    { at: 4.3, path: '06-discussions/2026-11-24-live-reading-graph.md', kind: 'read' },
    { at: 5.3, path: '03-ideas/edge-meaning.md', kind: 'read', sub: true },
    { at: 6.3, path: '03-ideas/live-reading-graph.md', kind: 'edit' },
    { at: 7.3, path: '01-log/changelog.md', kind: 'edit' },
  ];
  const END = 10.4;
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const css = getComputedStyle(document.documentElement);
  // 읽음은 뷰어 강조색(선택한 점의 선과 같은 색), 고침은 뷰어가 "바뀐 줄"에 쓰는 노란 띠 색
  const COL = { read: css.getPropertyValue('--accent').trim(), edit: css.getPropertyValue('--flash-bar').trim() };
  const ON = css.getPropertyValue('--on-accent').trim();
  const svg = document.querySelector('#gsvg');
  if (!svg) return;
  const zk = parseFloat(svg.style.getPropertyValue('--zk')) || 1;
  const byPath = new Map();
  svg.querySelectorAll('.nd').forEach(g => {
    const tip = g.querySelector('.dot').getAttribute('data-tip') || '';
    const m = tip.match(/\(([^()]+)\)$/);
    const tr = g.getAttribute('transform').match(/translate\(([-\d.]+),([-\d.]+)\)/);
    if (m && tr) byPath.set(m[1], { title: tip.replace(/ \([^()]+\)$/, ''), g, x: +tr[1], y: +tr[2], r: +g.querySelector('.dot').getAttribute('r') });
  });
  // 알림 상자가 뜬 뒤 잠깐 두었다가 비운다(알림 상자와 목록이 함께 보이는 순간을 보이려고)
  const clear = T >= END + 0.8 ? Math.max(0, 1 - (T - END - 0.8) / 0.4) : 1;
  const done = STEPS.filter(s => T >= s.at && byPath.has(s.path));
  const total = done.length;
  const NS = 'http://www.w3.org/2000/svg';
  const layer = document.createElementNS(NS, 'g');
  layer.id = 'gtrail';
  svg.querySelector('#gn').before(layer);
  let html = '';
  // 흔적 선: 뷰어의 새 선처럼 그어지듯 나타나고, 오래될수록 흐려진다
  const paths = [];
  done.forEach((s, i) => {
    if (i === 0) return;
    const p = byPath.get(done[i - 1].path), q = byPath.get(s.path);
    const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const sx = p.x + ux * (p.r + 3 * zk), sy = p.y + uy * (p.r + 3 * zk);
    const ex = q.x - ux * (q.r + 5 * zk), ey = q.y - uy * (q.r + 5 * zk);
    const bend = Math.min(40, L * 0.18);
    const mx = (sx + ex) / 2 - uy * bend, my = (sy + ey) / 2 + ux * bend;
    const age = total - 1 - i;
    const op = Math.max(0.3, 1 - age * 0.15) * clear;
    // 뷰어의 새 선(path.born)과 같은 때와 빠르기: 0.3초 뒤 0.9초 동안, 출발 문서에서 도착 문서 쪽으로 색이 차오른다
    const grow = ease((T - s.at - 0.3) / 0.9);
    paths.push({ d: 'M' + sx.toFixed(1) + ',' + sy.toFixed(1) + ' Q' + mx.toFixed(1) + ',' + my.toFixed(1) + ' ' + ex.toFixed(1) + ',' + ey.toFixed(1), kind: s.kind, op, grow });
  });
  html += paths.map((p, i) => '<path data-t="' + i + '" d="' + p.d + '" fill="none" stroke="' + p.kind + '" stroke-width="' + (2.2 * zk).toFixed(2) + '" stroke-linecap="round" opacity="' + p.op.toFixed(2) + '"/>').join('');
  // 점: 거쳐 간 차례 번호
  const visits = new Map();
  done.forEach((s, i) => { if (!visits.has(s.path)) visits.set(s.path, []); visits.get(s.path).push({ n: i + 1, kind: s.kind, i }); });
  for (const [path, v] of visits) {
    if (clear <= 0) break;
    const n = byPath.get(path), last = v[v.length - 1];
    const age = total - 1 - last.i;
    const op = Math.max(0.4, 1 - age * 0.13) * clear;
    // 선이 있는 문서는 색이 다 차오른 뒤에 둘레가 켜진다
    const popAt = done[last.i].at + (last.i > 0 ? 1.0 : 0);
    const pop = ease((T - popAt) / 0.35);
    const c = v.some(x => x.kind === 'edit') ? COL.edit : COL.read;
    html += '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + (n.r + 3.5 * zk).toFixed(1) + '" fill="none" stroke="' + COL[last.kind] + '" stroke-width="' + (2.2 * zk).toFixed(2) + '" opacity="' + (op * pop).toFixed(2) + '"/>';
    // 가장 최근 문서: 뷰어가 새 점에 쓰는 퍼지는 둘레(fvhalo)와 같은 움직임
    if (last.i === total - 1 && T < END) {
      const ph = (Math.max(0, T - popAt) % 1.6) / 1.6;
      html += '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + ((n.r + 5) * (1 + ph * 1.4)).toFixed(1) + '" fill="' + COL[last.kind] + '" opacity="' + (0.45 * (1 - ph)).toFixed(2) + '"/>';
    }
    const label = v.map(x => x.n).join('·');
    const fs = 10.5 * zk, w = (label.length * 6.6 + 10) * zk, h = 16 * zk;
    const bx = n.x - w / 2, by = n.y - n.r - h - 4 * zk;
    html += '<g opacity="' + (op * pop).toFixed(2) + '"><rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + (h / 2).toFixed(1) + '" fill="' + c + '"/>' +
      '<text x="' + n.x.toFixed(1) + '" y="' + (by + h / 2).toFixed(1) + '" text-anchor="middle" dominant-baseline="central" style="font-size:' + fs.toFixed(2) + 'px;font-weight:700;fill:' + ON + '">' + label + '</text></g>';
    // 흔적에 든 점은 마우스를 올린 점처럼 둘레와 이름을 보인다
    if (pop > 0.5 || v.length > 1) n.g.classList.add('trail');
  }
  layer.innerHTML = html;
  layer.querySelectorAll('path[data-t]').forEach(el => {
    const p = paths[+el.dataset.t];
    el.setAttribute('stroke', COL[p.kind]);
    const len = el.getTotalLength();
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = (len * (1 - p.grow)).toFixed(1);
  });

  // 오른쪽 도구 줄에 "흔적" 켜고 끄기 (맞춤 단추와 같은 모양, 켜진 상태)
  const tools = document.querySelector('.gtools');
  const tb = document.createElement('button');
  tb.type = 'button'; tb.className = 'wide'; tb.textContent = '흔적';
  tb.style.cssText = 'background:var(--accent-bg);color:var(--accent);border-color:var(--accent-bg);font-size:13px;font-weight:600';
  tools.appendChild(tb);

  // 오른쪽 아래: 점을 골랐을 때 뜨는 정보 상자와 같은 상자에 순서 목록
  const box = document.querySelector('#ginfo');
  let li = done.map((s, i) => {
    const o = ease((T - s.at) / 0.3) * clear;
    const name = byPath.get(s.path).title;
    const isLast = i === total - 1 && T < END;
    return '<li style="opacity:' + o.toFixed(2) + '"><button type="button" class="lnk" style="display:flex;align-items:center;gap:8px;color:var(--ink);font-size:13px;' + (isLast ? 'background:var(--code-bg)' : '') + '">' +
      '<span style="flex:none;width:18px;height:18px;border-radius:50%;background:' + COL[s.kind] + ';color:' + ON + ';font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center">' + (i + 1) + '</span>' +
      '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + name + '</span>' +
      (s.sub ? '<span class="chip" style="margin:0">서브에이전트</span>' : '') +
      '<span style="flex:none;font-size:11px;color:var(--faint)">' + (s.kind === 'edit' ? '고침' : '읽음') + '</span></button></li>';
  }).join('');
  // 제목과 개수는 고정하고, 목록만 항목 3개 높이로 고정해 넘치면 스크롤한다(정보 상자의 .ginfo ul과 같은 방식, 높이만 3줄)
  const shown = clear > 0 ? total : 0;
  box.innerHTML = '<div class="ghead"><div style="flex:1;min-width:0"><strong>이번 답에서 거쳐 간 문서</strong><div class="path">메시지를 보내면 비워져요</div></div></div><h3>' + shown + '개</h3><ul id="trl">' + (clear > 0 ? li : '<li class="empty" style="font-size:13px;padding:4px 0">Claude가 문서를 열면 순서대로 쌓여요</li>') + '</ul>';
  box.hidden = false;
  // 알림 상자(#toast, 창 오른쪽 아래 16px에 고정)와 겹치지 않게, 알림 상자가 뜨는 자리만큼 위로 올린다
  const gw = document.querySelector('.gwrap').getBoundingClientRect();
  const TOAST_ZONE = 16 + 44 + 12; // 알림 상자 아래 여백 + 한 줄 높이 + 사이 여백
  const lift = Math.max(34, Math.ceil(gw.bottom - (innerHeight - TOAST_ZONE)));
  box.style.cssText = 'left:auto;top:auto;right:12px;bottom:' + lift + 'px';
  const ul = document.getElementById('trl');
  const rowH = 28; // 한 줄 높이를 고정해 비었을 때와 찼을 때 상자 크기가 같다
  ul.querySelectorAll('li').forEach(x => { x.style.height = rowH + 'px'; x.style.boxSizing = 'border-box'; });
  ul.style.cssText = 'flex:none;height:' + Math.round(rowH * 3) + 'px;max-height:none;overflow-y:auto';
  // 새 항목이 생기면 맨 아래(가장 최근)로 부드럽게 내린다
  if (clear > 0 && total > 3) {
    const lastAt = done[total - 1].at;
    const from = Math.max(0, (total - 1 - 3) * rowH), to = ul.scrollHeight - ul.clientHeight;
    ul.scrollTop = from + (to - from) * ease((T - lastAt) / 0.35);
  }
  const st = document.createElement('style');
  st.textContent = '#gn .nd.trail .lb{display:inline!important;font-weight:700}#gn .nd.trail .halo{opacity:.22}';
  document.head.appendChild(st);

  // 새 메시지를 보낸 때: 뷰어의 알림 상자
  if (T < 1.1 || T >= END) {
    const t = document.createElement('div'); t.id = 'toast'; t.innerHTML = '<span>새 메시지 · 흔적을 비웠어요</span>';
    document.body.appendChild(t);
  }
  // 서브에이전트가 읽은 점에 마우스를 올린 모습: 뷰어 이름표(.tip)
  const sub = done.find(s => s.sub);
  if (sub && T >= sub.at + 0.35 && T < sub.at + 1.7) {
    const n = byPath.get(sub.path), dot = n.g.querySelector('.dot').getBoundingClientRect();
    const tip = document.createElement('div'); tip.className = 'tip';
    tip.textContent = n.title + '\n5번 · 서브에이전트가 읽음';
    tip.style.cssText = 'opacity:1;transform:translate(' + Math.round(dot.left - 40) + 'px,' + Math.round(dot.top - 58) + 'px)';
    document.body.appendChild(tip);
  }
})();
