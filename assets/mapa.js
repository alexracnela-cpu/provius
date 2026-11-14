// PROVIUS · Mapa dos projetos (aba Mapa) e desenho do traçado (Projetos)
// O mapa é feito aqui mesmo, sem biblioteca: o fundo vem do OpenStreetMap e os traçados são
// desenhados num canvas. Todos os setores veem; só Projetos (e o administrador) desenha ou corrige.
// Banco: tabela mapa_tracos e funções mapa_salvar / mapa_importar (provius-mapa.sql).
// 14/11/2026: as ruas do mapa do Google "Projetos/LED em Projeto" foram importadas uma vez;
// daqui para frente o mapa é só o Provius.

// ---------- número do projeto (liga o traço ao processo) ----------
const MAPA_RE = /\b(RE|RM|MP|R|C|V)?[\s-]*0*(\d{1,4})\s*[-\/.]\s*(20[12]\d)\b/i;
function mapaChave(s) {
  const m = MAPA_RE.exec(String(s || '')); if (!m) return null;
  let p = (m[1] || '').toUpperCase(); if (p === 'RE') p = 'R';
  return (p ? p + '-' : '') + m[2].padStart(4, '0') + '/' + m[3];
}
function mapaCamada(n) {   // nome da camada do mapa do Google -> camada do Provius
  n = String(n || '').trim().toUpperCase();
  if (/ESPECIAL LED/.test(n)) return 'ESPECIAL LED';
  if (/CAMPO|QUADRA|OBRAS/.test(n)) return 'CAMPOS E QUADRAS';
  if (/VIOLENT/.test(n)) return 'ÁREAS VIOLENTAS';
  return n.replace(/^ZONA\s+/, '').replace(/\s+/g, '-');
}
const MAPA_CAMADAS = ['NORTE', 'LESTE', 'SUL', 'CENTRO-SUL', 'CENTRO-OESTE', 'OESTE', 'RURAL', 'CAMPOS E QUADRAS', 'ÁREAS VIOLENTAS', 'ESPECIAL LED'];

// ---------- projeção (Web Mercator, mundo de 0 a 256 no zoom 0) ----------
const mvX = lon => (lon + 180) / 360 * 256;
const mvY = lat => { const s = Math.sin(Math.max(-85, Math.min(85, lat)) * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256; };
const mvLon = x => x / 256 * 360 - 180;
const mvLat = y => { const n = Math.PI - 2 * Math.PI * y / 256; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
const MV_CENTRO = [-60.01, -3.06];   // Manaus

// feição: { id, tipo 'L' linha | 'P' área | 'T' ponto, xy: [x0,y0,x1,y1,…] no mundo, b: [minx,miny,maxx,maxy], est }
function mvFeicao(id, tipo, coords, est, ref) {
  const c = tipo === 'T' ? [coords] : coords, xy = new Float64Array(c.length * 2); const b = [Infinity, Infinity, -Infinity, -Infinity];
  c.forEach(([lon, lat], i) => { const x = mvX(lon), y = mvY(lat); xy[i * 2] = x; xy[i * 2 + 1] = y; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; });
  return { id, tipo, xy, b, est, r: ref };
}
function mvCaixa(fs) { const b = [Infinity, Infinity, -Infinity, -Infinity]; fs.forEach(f => { b[0] = Math.min(b[0], f.b[0]); b[1] = Math.min(b[1], f.b[1]); b[2] = Math.max(b[2], f.b[2]); b[3] = Math.max(b[3], f.b[3]); }); return isFinite(b[0]) ? b : null; }
function mvDistSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); const x = ax + t * dx - px, y = ay + t * dy - py; return Math.sqrt(x * x + y * y); }

// ---------- motor do mapa ----------
// op: { aoClicar(f, ll), rotulo(f) -> texto do balão, fixo (sem arrastar/zoom), aoEditar() }
function mvCriar(box, op = {}) {
  box.classList.add('mv'); box.innerHTML = '<div class="mv-tiles"></div><canvas class="mv-cv"></canvas>' + (op.fixo ? '' : '<div class="mv-zoom"><button type="button" data-z="1" aria-label="Aproximar">+</button><button type="button" data-z="-1" aria-label="Afastar">−</button></div>') + '<div class="mv-attr">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></div><div class="mv-balao" hidden></div>';
  const tl = box.querySelector('.mv-tiles'), cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), balao = box.querySelector('.mv-balao');
  const M = { cx: mvX(MV_CENTRO[0]), cy: mvY(MV_CENTRO[1]), z: 12, f: [], est: {}, ordem: [], vis: null, sel: new Set(), hov: null, ed: null, mouse: null };
  const pool = new Map(); let raf = 0, limpaT = 0, W = 0, H = 0, dpr = 1;
  const S = () => 2 ** M.z;
  const tela = (x, y) => [(x - M.cx) * S() + W / 2, (y - M.cy) * S() + H / 2];
  const mundo = (px, py) => [M.cx + (px - W / 2) / S(), M.cy + (py - H / 2) / S()];
  const pede = () => { if (!raf) raf = requestAnimationFrame(desenha); };

  function fundo() {
    const tz = Math.max(0, Math.min(19, Math.round(M.z))), n = 2 ** tz, uw = 256 / n, [xa, ya] = mundo(0, 0), [xb, yb] = mundo(W, H), vivos = new Set();
    for (let tx = Math.floor(xa / uw); tx <= Math.floor(xb / uw); tx++) for (let ty = Math.max(0, Math.floor(ya / uw)); ty <= Math.min(n - 1, Math.floor(yb / uw)); ty++) {
      const k = tz + '/' + tx + '/' + ty; vivos.add(k); if (pool.has(k)) continue;
      const im = new Image(); im.alt = ''; im.draggable = false; im.decoding = 'async'; im._t = [tz, tx, ty];
      im.onload = () => im.classList.add('ok'); im.onerror = () => im.classList.add('erro');
      im.src = `https://tile.openstreetmap.org/${tz}/${((tx % n) + n) % n}/${ty}.png`; pool.set(k, im); tl.appendChild(im);
    }
    pool.forEach((im, k) => { const [tz2, tx, ty] = im._t, uw2 = 256 / 2 ** tz2, [sx, sy] = tela(tx * uw2, ty * uw2), ts = uw2 * S();
      im.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`; im.style.width = im.style.height = (ts + .6).toFixed(1) + 'px'; im.style.zIndex = tz2 === tz ? 2 : 1; im._vivo = vivos.has(k); });
    clearTimeout(limpaT); limpaT = setTimeout(() => pool.forEach((im, k) => { if (!im._vivo) { im.remove(); pool.delete(k); } }), 900);
  }
  function caminho(f, x0, y0, s) {
    const xy = f.xy;
    if (f.tipo === 'T') { const x = (xy[0] - x0) * s, y = (xy[1] - y0) * s; ctx.moveTo(x + 4, y); ctx.arc(x, y, 4, 0, Math.PI * 2); return; }
    ctx.moveTo((xy[0] - x0) * s, (xy[1] - y0) * s); for (let i = 2; i < xy.length; i += 2) ctx.lineTo((xy[i] - x0) * s, (xy[i + 1] - y0) * s);
    if (f.tipo === 'P') ctx.closePath();
  }
  const largBase = () => M.z < 12 ? .9 : M.z < 14 ? 1.3 : M.z < 16 ? 2 : 3;
  function desenha() {
    raf = 0; const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
    dpr = window.devicePixelRatio || 1;
    if (w !== W || h !== H || cv.width !== Math.round(w * dpr)) { W = w; H = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
    fundo();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.lineJoin = ctx.lineCap = 'round';
    const s = S(), [x0, y0] = mundo(0, 0), [x1, y1] = mundo(W, H), lb = largBase(), g = {};
    for (const f of M.f) { if (f.b[2] < x0 || f.b[0] > x1 || f.b[3] < y0 || f.b[1] > y1) continue; if (M.vis && !M.vis(f)) continue; (g[f.est] || (g[f.est] = [])).push(f); }
    for (const k of M.ordem) {
      const l = g[k], e = M.est[k]; if (!l || !e) continue;
      const areas = l.filter(f => f.tipo === 'P');
      if (areas.length) { ctx.beginPath(); areas.forEach(f => caminho(f, x0, y0, s)); ctx.fillStyle = e.cor; ctx.globalAlpha = .16; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.beginPath(); l.forEach(f => caminho(f, x0, y0, s)); ctx.strokeStyle = e.cor; ctx.lineWidth = lb * (e.larg || 1); ctx.setLineDash(e.tra ? [7, 5] : []); ctx.globalAlpha = e.alfa || 1; ctx.stroke(); ctx.globalAlpha = 1;
      const pts = l.filter(f => f.tipo === 'T'); if (pts.length) { ctx.beginPath(); pts.forEach(f => caminho(f, x0, y0, s)); ctx.fillStyle = e.cor; ctx.fill(); }
    }
    ctx.setLineDash([]);
    const real = [...M.f.filter(f => M.sel.has(f.id))]; if (M.hov && !M.sel.has(M.hov.id)) real.push(M.hov);
    real.forEach(f => { const e = M.est[f.est] || { cor: '#000' }, sel = M.sel.has(f.id);
      ctx.beginPath(); caminho(f, x0, y0, s); ctx.strokeStyle = '#fff'; ctx.lineWidth = lb * 2 + (sel ? 7 : 4); ctx.globalAlpha = .95; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); caminho(f, x0, y0, s); ctx.strokeStyle = sel ? '#0d1b2a' : e.cor; ctx.lineWidth = lb * 2 + (sel ? 3 : 1.5); ctx.stroke();
      if (sel) { ctx.beginPath(); caminho(f, x0, y0, s); ctx.strokeStyle = e.cor; ctx.lineWidth = lb * 2 + .5; ctx.stroke(); } });
    if (M.ed) desenhaEd(x0, y0, s);
  }
  // ----- edição do traçado -----
  function desenhaEd(x0, y0, s) {
    const ed = M.ed, lb = largBase();
    ed.linhas.forEach((l, i) => {
      if (!l.pts.length) return; const at = i === ed.at;
      ctx.beginPath(); l.pts.forEach(([x, y], j) => ctx[j ? 'lineTo' : 'moveTo']((x - x0) * s, (y - y0) * s)); if (l.tipo === 'P' && l.pts.length > 2 && !(at && ed.novo)) ctx.closePath();
      if (l.tipo === 'P') { ctx.fillStyle = '#e8621c'; ctx.globalAlpha = .18; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = lb + 6; ctx.stroke(); ctx.strokeStyle = at ? '#e8621c' : '#b9561f'; ctx.lineWidth = lb + 2.5; ctx.stroke();
      if (at && ed.novo && M.mouse) { const [lx, ly] = l.pts[l.pts.length - 1]; ctx.beginPath(); ctx.moveTo((lx - x0) * s, (ly - y0) * s); ctx.lineTo((M.mouse[0] - x0) * s, (M.mouse[1] - y0) * s); ctx.setLineDash([5, 5]); ctx.strokeStyle = '#e8621c'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
      l.pts.forEach(([x, y], j) => { ctx.beginPath(); ctx.arc((x - x0) * s, (y - y0) * s, at ? 5.5 : 3.5, 0, Math.PI * 2); ctx.fillStyle = at && j === l.pts.length - 1 && ed.novo ? '#e8621c' : '#fff'; ctx.fill(); ctx.strokeStyle = '#e8621c'; ctx.lineWidth = 2; ctx.stroke(); });
    });
  }
  function edVertice(px, py) {   // vértice debaixo do dedo/mouse (a linha aberta tem preferência)
    const ed = M.ed; if (!ed) return null; let m = null;
    ed.linhas.forEach((l, i) => l.pts.forEach(([x, y], j) => { const [sx, sy] = tela(x, y), d = Math.hypot(sx - px, sy - py); const lim = i === ed.at ? 11 : 8; if (d <= lim && (!m || d < m.d - (i === ed.at ? 3 : 0))) m = { li: i, pi: j, d }; }));
    return m;
  }
  function edSegmento(px, py) {
    const ed = M.ed; let m = null;
    ed.linhas.forEach((l, i) => { const p = l.pts.map(([x, y]) => tela(x, y)); const n = l.tipo === 'P' && !(i === ed.at && ed.novo) ? p.length : p.length - 1;
      for (let j = 0; j < n; j++) { const a = p[j], b = p[(j + 1) % p.length], d = mvDistSeg(px, py, a[0], a[1], b[0], b[1]); if (d <= 8 && (!m || d < m.d)) m = { li: i, pi: j, d }; } });
    return m;
  }
  function edClique(px, py) {
    const ed = M.ed, v = edVertice(px, py), w = mundo(px, py), l = ed.linhas[ed.at];
    if (ed.novo && l) {
      if (v && v.li === ed.at && l.pts.length >= 2 && (v.pi === l.pts.length - 1 || (l.tipo === 'P' && v.pi === 0))) { edConcluir(); return; }
      l.pts.push(w);
    } else if (v) { ed.at = v.li; }
    else { const sg = edSegmento(px, py); if (sg) { if (sg.li === ed.at) ed.linhas[sg.li].pts.splice(sg.pi + 1, 0, w); ed.at = sg.li; } else ed.at = -1; }
    pede(); op.aoEditar?.();
  }
  function edConcluir() {
    const ed = M.ed; if (!ed) return; const l = ed.linhas[ed.at];
    if (l) { for (let i = l.pts.length - 1; i > 0; i--) { const [ax, ay] = tela(...l.pts[i]), [bx, by] = tela(...l.pts[i - 1]); if (Math.hypot(ax - bx, ay - by) < 4) l.pts.splice(i, 1); }   // o duplo clique repete o último ponto
      if (l.pts.length < (l.tipo === 'P' ? 3 : 2)) { ed.linhas.splice(ed.at, 1); ed.at = -1; } }
    ed.novo = false; pede(); op.aoEditar?.();
  }
  // ----- achar a feição debaixo do ponteiro -----
  function achar(px, py, tol = 7) {
    const [wx, wy] = mundo(px, py), t = tol / S(); let m = null, md = Infinity;
    for (const f of M.f) {
      if (wx < f.b[0] - t || wx > f.b[2] + t || wy < f.b[1] - t || wy > f.b[3] + t) continue; if (M.vis && !M.vis(f)) continue;
      const xy = f.xy; let d = Infinity;
      if (f.tipo === 'T') d = Math.hypot(xy[0] - wx, xy[1] - wy) - 3 / S();
      else { const n = xy.length; for (let i = 0; i + 3 < n; i += 2) d = Math.min(d, mvDistSeg(wx, wy, xy[i], xy[i + 1], xy[i + 2], xy[i + 3]));
        if (f.tipo === 'P') { d = Math.min(d, mvDistSeg(wx, wy, xy[n - 2], xy[n - 1], xy[0], xy[1])); let dentro = false; for (let i = 0, j = n - 2; i < n; j = i, i += 2) { const yi = xy[i + 1], yj = xy[j + 1]; if ((yi > wy) !== (yj > wy) && wx < (xy[j] - xy[i]) * (wy - yi) / (yj - yi) + xy[i]) dentro = !dentro; } if (dentro) d = Math.min(d, t * .9); } }
      const peso = M.ordem.indexOf(f.est) * 1e-9;   // empate: a camada de cima ganha
      if (d <= t && d - peso < md) { md = d - peso; m = f; }
    }
    return m;
  }
  // ----- zoom e arrasto -----
  function zoomEm(z, px = W / 2, py = H / 2) {
    z = Math.max(3, Math.min(19, z)); const [wx, wy] = mundo(px, py); M.z = z; M.cx = wx - (px - W / 2) / S(); M.cy = wy - (py - H / 2) / S(); pede();
  }
  let zAnim = 0;
  function zoomSuave(z, px, py) { const z0 = M.z, t0 = performance.now(); cancelAnimationFrame(zAnim); const passo = t => { const k = Math.min(1, (t - t0) / 220), e = 1 - (1 - k) ** 3; zoomEm(z0 + (z - z0) * e, px, py); if (k < 1) zAnim = requestAnimationFrame(passo); }; zAnim = requestAnimationFrame(passo); }
  const pos = e => { const r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const ptr = new Map(); let arr = null, pin = null;
  function mostraBalao(f, px, py) {
    const t = f && op.rotulo ? op.rotulo(f) : ''; if (!t) { balao.hidden = true; return; }
    balao.innerHTML = t; balao.hidden = false; const bw = balao.offsetWidth; balao.style.transform = `translate(${Math.min(W - bw - 6, Math.max(6, px + 14))}px,${Math.max(6, py - 34)}px)`;
  }
  if (!op.fixo) {
    cv.addEventListener('pointerdown', e => {
      if (e.button === 2) return; cv.setPointerCapture(e.pointerId); const [px, py] = pos(e); ptr.set(e.pointerId, [px, py]);
      if (ptr.size === 1) { const v = M.ed && !M.ed.novo ? edVertice(px, py) : null; arr = { px, py, cx: M.cx, cy: M.cy, mov: false, v }; if (v) M.ed.at = v.li; }
      else if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pin = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: M.z }; if (arr) arr.mov = true; }
    });
    cv.addEventListener('pointermove', e => {
      const [px, py] = pos(e);
      if (!ptr.has(e.pointerId)) { if (e.pointerType === 'mouse') { if (M.ed) { M.mouse = mundo(px, py); cv.style.cursor = M.ed.novo ? 'crosshair' : edVertice(px, py) ? 'move' : edSegmento(px, py) ? 'copy' : 'grab'; if (M.ed.novo) pede(); return; }
        const f = achar(px, py); if (f !== M.hov) { M.hov = f; pede(); } cv.style.cursor = f ? 'pointer' : 'grab'; mostraBalao(f, px, py); } return; }
      ptr.set(e.pointerId, [px, py]);
      if (ptr.size === 2 && pin) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomEm(pin.z + Math.log2(d / pin.d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return; }
      if (!arr) return; const dx = px - arr.px, dy = py - arr.py; if (!arr.mov && Math.hypot(dx, dy) > 4) arr.mov = true; if (!arr.mov) return;
      balao.hidden = true;
      if (arr.v) { M.ed.linhas[arr.v.li].pts[arr.v.pi] = mundo(px, py); pede(); return; }
      cv.style.cursor = 'grabbing'; M.cx = arr.cx - dx / S(); M.cy = arr.cy - dy / S(); pede();
    });
    const solta = e => {
      if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); if (ptr.size < 2) pin = null;
      if (ptr.size === 0 && arr) { const a = arr; arr = null; cv.style.cursor = 'grab';
        if (a.v && a.mov) { op.aoEditar?.(); return; }
        if (!a.mov && e.type === 'pointerup') { const [px, py] = pos(e); if (M.ed) edClique(px, py); else { const f = achar(px, py, e.pointerType === 'mouse' ? 7 : 14); op.aoClicar?.(f, { lon: mvLon(mundo(px, py)[0]), lat: mvLat(mundo(px, py)[1]) }); } } }
    };
    cv.addEventListener('pointerup', solta); cv.addEventListener('pointercancel', solta);
    cv.addEventListener('pointerleave', () => { if (!ptr.size) { balao.hidden = true; if (M.hov) { M.hov = null; pede(); } } });
    cv.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = pos(e); zoomEm(M.z - e.deltaY * (e.deltaMode ? .06 : .0022), px, py); }, { passive: false });
    cv.addEventListener('dblclick', e => { e.preventDefault(); const [px, py] = pos(e); if (M.ed) { if (M.ed.novo) edConcluir(); return; } zoomSuave(Math.round(M.z) + 1, px, py); });
    cv.addEventListener('contextmenu', e => { e.preventDefault(); if (!M.ed) return; const [px, py] = pos(e), v = edVertice(px, py); if (v) { M.ed.linhas[v.li].pts.splice(v.pi, 1); if (M.ed.linhas[v.li].pts.length < (M.ed.linhas[v.li].tipo === 'P' ? 3 : 2) && !(M.ed.novo && v.li === M.ed.at)) { M.ed.linhas.splice(v.li, 1); M.ed.at = -1; M.ed.novo = false; } pede(); op.aoEditar?.(); } });
    box.querySelectorAll('.mv-zoom button').forEach(b => b.onclick = () => zoomSuave(Math.round(M.z) + +b.dataset.z));
  }
  new ResizeObserver(pede).observe(box);
  const api = {
    set(fs) { M.f = fs; pede(); return api; },
    estilos(est, ordem) { M.est = est; M.ordem = ordem; pede(); return api; },
    filtro(fn) { M.vis = fn; pede(); return api; },
    selecionar(ids) { M.sel = new Set(ids || []); pede(); return api; },
    enquadrar(b, zMax = 17) {
      if (!b) return api; const w = box.clientWidth || 600, h = box.clientHeight || 400, mx = 40;
      const z = Math.log2(Math.min((w - mx * 2) / Math.max(b[2] - b[0], 1e-7), (h - mx * 2) / Math.max(b[3] - b[1], 1e-7)));
      M.z = Math.max(3, Math.min(zMax, z)); M.cx = (b[0] + b[2]) / 2; M.cy = (b[1] + b[3]) / 2; pede(); return api;
    },
    centro(lon, lat, z) { M.cx = mvX(lon); M.cy = mvY(lat); if (z) M.z = z; pede(); return api; },
    redesenha() { pede(); return api; },
    // edição: linhas = [{ tipo, coords: [[lon,lat],…], descricao }]
    editar(linhas) { M.ed = linhas ? { linhas: linhas.map(l => ({ tipo: l.tipo === 'P' ? 'P' : 'L', descricao: l.descricao || '', pts: l.coords.map(([lon, lat]) => [mvX(lon), mvY(lat)]) })), at: -1, novo: false } : null; M.hov = null; balao.hidden = true; cv.style.cursor = 'grab'; pede(); return api; },
    edNova(tipo) { const ed = M.ed; if (!ed) return; if (ed.novo) edConcluir(); ed.linhas.push({ tipo, descricao: '', pts: [] }); ed.at = ed.linhas.length - 1; ed.novo = true; pede(); op.aoEditar?.(); },
    edConcluir,
    edDesfazer() { const ed = M.ed, l = ed?.linhas[ed.at]; if (!l) return; if (l.pts.length) l.pts.pop(); if (!l.pts.length && ed.novo) { ed.linhas.splice(ed.at, 1); ed.at = -1; ed.novo = false; } pede(); op.aoEditar?.(); },
    edApagar() { const ed = M.ed; if (!ed || ed.at < 0) return; ed.linhas.splice(ed.at, 1); ed.at = -1; ed.novo = false; pede(); op.aoEditar?.(); },
    edEstado() { const ed = M.ed; return ed ? { n: ed.linhas.filter(l => l.pts.length >= 2).length, at: ed.at, novo: ed.novo, pontos: ed.linhas[ed.at]?.pts.length || 0 } : null; },
    edLer() { return (M.ed?.linhas || []).filter(l => l.pts.length >= (l.tipo === 'P' ? 3 : 2)).map(l => ({ tipo: l.tipo, descricao: l.descricao || '', coords: l.pts.map(([x, y]) => [+mvLon(x).toFixed(6), +mvLat(y).toFixed(6)]) })); },
    edCaixa() { const p = (M.ed?.linhas || []).flatMap(l => l.pts); if (!p.length) return null; return [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1]))]; },
    get z() { return M.z; }
  };
  pede(); return api;
}

// ---------- aba Mapa ----------
const MP_SIT = {   // situação no Provius -> cor do traço (a ordem é a de desenho: os ativos ficam por cima)
  ant: { nome: 'Especial LED (contrato anterior)', cor: '#8a7560', larg: .8, alfa: .75 },
  sem: { nome: 'Sem processo no Provius', cor: '#7d8a99', larg: .9 },
  fim: { nome: 'Concluído / enviado à AGEMAN', cor: '#2f9a55' },
  canc: { nome: 'Cancelado', cor: '#b4322b', tra: true },
  e5: { nome: 'Pronto p/ AGEMAN', cor: '#14a3a0', larg: 1.3 },
  e4: { nome: 'As built (Projetos)', cor: '#7b4fd6', larg: 1.3 },
  e3: { nome: 'Cadastro', cor: '#c9a00c', larg: 1.3 },
  e2: { nome: 'Execução (Engenharia)', cor: '#e8621c', larg: 1.3 },
  e1: { nome: 'Projeto (Projetos)', cor: '#1f6fd1', larg: 1.3 }
};
const MP_ORDEM = Object.keys(MP_SIT), MP_LEG = ['e1', 'e2', 'e3', 'e4', 'e5', 'fim', 'canc', 'sem', 'ant'];
const mpSit = (d, r) => r && r.camada === 'ESPECIAL LED' && !d ? 'ant' : !d ? 'sem' : d.cancelado ? 'canc' : d.etapa === 6 ? 'fim' : 'e' + d.etapa;
const mpPodeEditar = () => !!EU && (EU.admin || EU.setor === 'Projetos');
const MP = { linhas: null, fs: [], mv: null, sel: null, sit: new Set(MP_LEG), filt: { cam: '*', ano: '*', tipo: '*', q: '' }, semTabela: false, iniciado: false };

async function mapaCarregar(forcar) {
  if (MP.linhas && !forcar) return MP.linhas;
  let todas = [], de = 0; const N = 1000;
  for (; ;) {
    const { data, error } = await sb.from('mapa_tracos').select('id,processo_id,chave,camada,nome,descricao,tipo,coords,origem,por_nome,em').order('id').range(de, de + N - 1);
    if (error) { if (/mapa_tracos|does not exist|schema cache/i.test(error.message || '')) { MP.semTabela = true; MP.linhas = []; mapaIndexar(); return MP.linhas; } throw error; }
    todas = todas.concat(data); if (data.length < N) break; de += N;
  }
  MP.semTabela = false; MP.linhas = todas; mapaIndexar(); return todas;
}
function mapaIndexar() {
  const porId = new Map(D.map(d => [d.id, d])), porCh = new Map(); D.forEach(d => { const k = mapaChave(d.numero); if (k && !porCh.has(k)) porCh.set(k, d); });
  MP.porProc = new Map();
  MP.fs = (MP.linhas || []).filter(r => Array.isArray(r.coords) && r.coords.length).map(r => {
    const d = (r.processo_id && porId.get(r.processo_id)) || (r.chave && porCh.get(r.chave)) || null; r.d = d;
    if (d) { if (!MP.porProc.has(d.id)) MP.porProc.set(d.id, []); MP.porProc.get(d.id).push(r); }
    const f = mvFeicao(r.id, r.tipo, r.coords, mpSit(d, r), r); r.f = f; return f;
  });
}
const mpAno = r => r.d ? r.d.ano : r.chave ? +r.chave.slice(-4) : null;
const mpTipo = r => r.d ? (r.d.tipo || '') : r.chave ? (/^([A-Z]+)-/.exec(r.chave)?.[1] || '') : null;
function mapaPassa(r) {
  const F = MP.filt; if (!MP.sit.has(r.f.est)) return false;
  if (F.cam !== '*' && r.camada !== F.cam) return false;
  if (F.ano !== '*' && mpAno(r) !== +F.ano) return false;
  if (F.tipo !== '*' && mpTipo(r) !== F.tipo) return false;
  return true;
}
function mpRotulo(f) {
  const r = f.r, d = r.d; if (r.camada === 'ESPECIAL LED' && !d) return '<b>Especial LED</b><small>Rua do contrato anterior · ' + esc(r.nome || '') + '</small>';
  return `<b>${esc(d ? d.numero : r.chave || r.nome || 'Sem número')}</b><small>${esc(d ? (d.logradouro || '') + (d.bairro ? ' · ' + d.bairro : '') : (r.descricao || r.nome || ''))}</small><i style="--c:${MP_SIT[f.est].cor}">${esc(MP_SIT[f.est].nome)}</i>`;
}

function mapaIniciar() {
  if (MP.iniciado) return; MP.iniciado = true;
  MP.mv = mvCriar($('#mp-mapa'), { rotulo: mpRotulo, aoClicar: f => mapaSelecionar(f ? f.r : null, false) }).estilos(MP_SIT, MP_ORDEM);
  $('#mp-busca').oninput = () => { MP.filt.q = $('#mp-busca').value.trim(); mapaResultados(); };
  ['cam', 'ano', 'tipo'].forEach(k => $('#mp-f-' + k).onchange = () => { MP.filt[k] = $('#mp-f-' + k).value; mapaAplicar(); });
  $('#mp-recarregar').onclick = () => tarefa(async () => { await recarregar(); await mapaCarregar(true); mapaMonta(); });
  $('#mp-importar').onclick = () => $('#mp-kml').click();
  $('#mp-kml').onchange = () => { const f = $('#mp-kml').files[0]; $('#mp-kml').value = ''; if (f) mapaImportar(f); };
  $('#mp-tudo').onclick = () => MP.mv.enquadrar(mvCaixa(MP.fs.filter(f => mapaPassa(f.r) && f.est !== 'ant')) || mvCaixa(MP.fs));
}
async function mapaAbrir() {
  mapaIniciar();
  if (!MP.linhas) { const ok = await tarefa(() => mapaCarregar()); if (ok === undefined) return; mapaMonta(true); }
  else { mapaIndexar(); mapaMonta(); }
  if (MP.irPara) { const id = MP.irPara; MP.irPara = null; const rs = MP.porProc.get(id); if (rs) mapaSelecionar(rs[0], true); }
}
function mapaMonta(primeira) {
  MP.mv.set(MP.fs); if (MP.sel && !MP.linhas.includes(MP.sel)) MP.sel = null;
  const anos = [...new Set(MP.linhas.map(mpAno).filter(Boolean))].sort((a, b) => b - a);
  $('#mp-f-ano').innerHTML = '<option value="*">Todos os anos</option>' + anos.map(a => `<option${String(a) === MP.filt.ano ? ' selected' : ''}>${a}</option>`).join('');
  $('#mp-f-cam').innerHTML = '<option value="*">Todas as camadas</option>' + MAPA_CAMADAS.filter(c => MP.linhas.some(r => r.camada === c)).map(c => `<option${c === MP.filt.cam ? ' selected' : ''}>${c}</option>`).join('');
  $('#mp-adm').hidden = !EU?.admin;
  $('#mp-vazio').hidden = !(MP.semTabela || !MP.linhas.length);
  $('#mp-vazio').innerHTML = MP.semTabela ? 'O mapa ainda não está no banco. Rode o arquivo <b>provius-mapa.sql</b> no Supabase.' : 'Nenhuma rua no mapa ainda.' + (EU?.admin ? ' Use <b>Importar KML do Google</b> (abaixo) para trazer o mapa antigo.' : '');
  mapaAplicar(); mapaResultados(); mapaPainelSel(); mapaConferencia();
  if (primeira) MP.mv.centro(MV_CENTRO[0], MV_CENTRO[1], 12);   // a área urbana; "Ver tudo" mostra também os rurais
}
function mapaAplicar() {
  MP.mv.filtro(f => mapaPassa(f.r) || f.r === MP.sel || (MP.sel && MP.sel.d && f.r.d === MP.sel.d));
  // legenda com a contagem de projetos (traços sem processo contam por traço)
  const cont = {}, vistos = new Set();
  MP.linhas.forEach(r => { const k = r.f.est, F = MP.filt; if ((F.cam !== '*' && r.camada !== F.cam) || (F.ano !== '*' && mpAno(r) !== +F.ano) || (F.tipo !== '*' && mpTipo(r) !== F.tipo)) return;
    const ch = r.d ? 'p' + r.d.id : r.chave ? 'c' + r.chave : 't' + r.id; if (vistos.has(k + ch)) return; vistos.add(k + ch); cont[k] = (cont[k] || 0) + 1; });
  $('#mp-leg').innerHTML = MP_LEG.map(k => `<label class="mp-leg-i${MP.sit.has(k) ? '' : ' off'}"><input type="checkbox" value="${k}"${MP.sit.has(k) ? ' checked' : ''}><i class="${MP_SIT[k].tra ? 'tra' : ''}" style="--c:${MP_SIT[k].cor}"></i><span>${MP_SIT[k].nome}</span><b>${fmt(cont[k] || 0)}</b></label>`).join('');
  $$('#mp-leg input').forEach(i => i.onchange = () => { i.checked ? MP.sit.add(i.value) : MP.sit.delete(i.value); mapaAplicar(); });
  const proc = new Set(MP.linhas.filter(r => r.d).map(r => r.d.id)), semTr = D.filter(d => !d.cancelado && !proc.has(d.id)).length;
  $('#mp-resumo').innerHTML = `<b>${fmt(proc.size)}</b> processos com traçado · <b>${fmt(MP.linhas.length)}</b> traços no mapa` + (semTr ? ` · <span title="Processos do Provius (não cancelados) que ainda não têm rua desenhada">${fmt(semTr)} processos sem traçado</span>` : '');
}
function mapaResultados() {
  const q = MP.filt.q.toUpperCase(), el = $('#mp-res'); if (!q) { el.innerHTML = ''; el.hidden = true; return; }
  const ch = mapaChave(q), vistos = new Set(), res = [];
  for (const d of D) { if (res.length >= 40) break;
    if ((ch && mapaChave(d.numero) === ch) || (!ch && (d.numero.includes(q) || (d.logradouro || '').toUpperCase().includes(q) || (d.bairro || '').toUpperCase().includes(q)))) { vistos.add(d.id); res.push({ d, rs: MP.porProc.get(d.id) || [] }); } }
  if (res.length < 40) MP.linhas.forEach(r => { if (r.d || res.length >= 40) return; const t = ((r.chave || '') + ' ' + (r.nome || '') + ' ' + (r.descricao || '')).toUpperCase(); if ((ch && r.chave === ch) || (!ch && t.includes(q))) { const k = r.chave || 't' + r.id; if (vistos.has(k)) return; vistos.add(k); res.push({ d: null, rs: MP.linhas.filter(x => !x.d && x.chave && x.chave === r.chave).concat(r.chave ? [] : [r]) }); } });
  el.hidden = false;
  el.innerHTML = res.length ? res.map((x, i) => { const r0 = x.rs[0], est = x.d ? mpSit(x.d) : r0 ? r0.f.est : 'sem';
    return `<button type="button" class="mp-res-i" data-i="${i}"${x.rs.length ? '' : ' data-sem="1"'}><i style="--c:${MP_SIT[est].cor}"></i><b>${esc(x.d ? x.d.numero : r0?.chave || r0?.nome || '')}</b><span>${esc(x.d ? (x.d.logradouro || '') + (x.d.bairro ? ' · ' + x.d.bairro : '') : (r0?.descricao || ''))}</span><small>${x.rs.length ? fmt(x.rs.length) + (x.rs.length === 1 ? ' traço' : ' traços') : 'sem traçado'}</small></button>`; }).join('') : '<p class="vazio">Nada encontrado.</p>';
  $$('#mp-res .mp-res-i').forEach(b => b.onclick = () => { const x = res[+b.dataset.i]; el.hidden = true; if (x.rs.length) mapaSelecionar(x.rs[0], true); else mapaSelecionarSem(x.d); });
}
function mapaGrupo(r) { return r.d ? MP.porProc.get(r.d.id) || [r] : r.chave ? MP.linhas.filter(x => !x.d && x.chave === r.chave) : [r]; }
function mapaSelecionar(r, ir) {
  MP.sel = r; MP.semSel = null; const g = r ? mapaGrupo(r) : [];
  MP.mv.selecionar(g.map(x => x.id)); if (ir && g.length) MP.mv.enquadrar(mvCaixa(g.map(x => x.f)), 18);
  mapaAplicar(); mapaPainelSel();
}
function mapaSelecionarSem(d) { MP.sel = null; MP.semSel = d; MP.mv.selecionar([]); mapaAplicar(); mapaPainelSel(); }
function mapaPainelSel() {
  const el = $('#mp-sel'), r = MP.sel, d = r ? r.d : MP.semSel; if (!r && !d) { el.hidden = true; return; }
  const g = r ? mapaGrupo(r) : [], est = d ? mpSit(d) : r.f.est, desc = [...new Set(g.map(x => x.descricao).filter(Boolean))].slice(0, 4);
  const linhas = d ? [['Logradouro', d.logradouro], ['Bairro / zona', (d.bairro || '—') + (d.zona ? ' · ' + d.zona : '')], ['Serviço', (d.tipo_servico === 'EXPANSÃO' ? 'CRESCIMENTO VEGETATIVO' : d.tipo_servico) || (d.tipo === 'R' ? 'REEQUILÍBRIO' : '—')], ['Pontos', fmt(d.total_pontos)]] : [['Camada', r.camada]];
  el.hidden = false;
  el.innerHTML = `<div class="mp-sel-cab"><span><i style="--c:${MP_SIT[est].cor}" class="${MP_SIT[est].tra ? 'tra' : ''}"></i>${esc(MP_SIT[est].nome)}</span><button type="button" class="mp-x" id="mp-sel-x" aria-label="Fechar">×</button></div>
    <h3>${esc(d ? d.numero : r.chave || (r.camada === 'ESPECIAL LED' ? 'Especial LED · contrato anterior' : r.nome || 'Sem número'))}</h3>
    <dl>${linhas.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v || '—')}</dd>`).join('')}</dl>
    ${desc.length ? `<p class="mp-desc">${desc.map(esc).join('<br>')}</p>` : ''}
    <p class="ajuda" style="margin:0">${g.length ? fmt(g.length) + (g.length === 1 ? ' traço' : ' traços') + (g.some(x => x.origem === 'google') ? ' · veio do mapa do Google' : '') + (g.find(x => x.origem === 'provius' && x.por_nome) ? ' · desenhado por ' + esc(g.find(x => x.origem === 'provius').por_nome) + ' em ' + dataBR(g.find(x => x.origem === 'provius').em) : '') : 'Ainda sem rua desenhada no mapa.'}${!d && r && r.chave ? '<br>Não há processo ' + esc(r.chave) + ' no Provius.' : ''}</p>
    <div class="mp-sel-bts">${d ? '<button type="button" class="btn peq" id="mp-ver">Ver processo</button>' : ''}${d && mpPodeEditar() ? `<button type="button" class="btn peq pri" id="mp-editar">✎ ${g.length ? 'Corrigir traçado' : 'Desenhar no mapa'}</button>` : ''}</div>`;
  $('#mp-sel-x').onclick = () => { MP.sel = null; MP.semSel = null; MP.mv.selecionar([]); mapaAplicar(); mapaPainelSel(); };
  if ($('#mp-ver')) $('#mp-ver').onclick = () => detalhe(d.id);
  if ($('#mp-editar')) $('#mp-editar').onclick = () => mapaEditar(d, () => { const rs = MP.porProc.get(d.id); if (rs) mapaSelecionar(rs[0], false); else mapaSelecionarSem(d); MP.mv.set(MP.fs); });
}
// ---------- conferência: mapa x processos do Provius (o histórico da planilha já está no banco) ----------
function mapaConfGrupos() {
  const sem = new Map(), semNum = [], canc = new Map(), com = new Set();
  MP.linhas.forEach(r => { if (r.camada === 'ESPECIAL LED') return;
    if (r.d) { com.add(r.d.id); if (r.d.cancelado) canc.set(r.d.id, r); }
    else if (r.chave) { if (!sem.has(r.chave)) sem.set(r.chave, r); }
    else semNum.push(r); });
  const semTr = D.filter(d => !d.cancelado && !com.has(d.id)).sort((a, b) => b.ano - a.ano || String(b.numero).localeCompare(String(a.numero)));
  return [
    { k: 'sem', nome: 'Nº do mapa que não existe no Provius', dica: 'Número digitado errado no mapa do Google ou projeto nunca cadastrado.', itens: [...sem.values()].map(r => ({ r, n: r.chave, t: r.descricao || r.nome || '', c: r.camada })).concat(semNum.map(r => ({ r, n: 'sem número', t: r.nome || r.descricao || '', c: r.camada }))) },
    { k: 'canc', nome: 'Rua de projeto cancelado', dica: 'O projeto foi cancelado, mas a rua continua desenhada.', itens: [...canc.values()].map(r => ({ r, d: r.d, n: r.d.numero, t: r.d.logradouro || '', c: r.d.zona || r.camada })) },
    { k: 'semtr', nome: 'Processo sem rua no mapa', dica: 'Processos do Provius (não cancelados) que ainda não têm traçado.', itens: semTr.map(d => ({ d, n: d.numero, t: (d.logradouro || '') + (d.bairro ? ' · ' + d.bairro : ''), c: d.cancelado ? 'Cancelado' : d.etapa === 6 ? 'Concluído' : ETAPAS[d.etapa].setor + ' · ' + ETAPAS[d.etapa].curto })) }
  ];
}
function mapaConferencia() {
  const gs = mapaConfGrupos();
  $('#mp-conf').innerHTML = gs.map((g, i) => `<button type="button" class="mp-conf-i${g.itens.length ? '' : ' zero'}" data-i="${i}" title="${esc(g.dica)}"><span>${g.nome}</span><b>${fmt(g.itens.length)}</b></button>`).join('');
  $$('#mp-conf .mp-conf-i').forEach(b => b.onclick = () => mapaConfLista(gs[+b.dataset.i]));
}
function mapaConfLista(g) {
  const el = $('#mp-res'); $('#mp-busca').value = ''; MP.filt.q = ''; el.hidden = false;
  el.innerHTML = `<div class="mp-conf-cab"><b>${esc(g.nome)}</b><span class="ajuda">${esc(g.dica)}</span><span class="mp-conf-bts"><button type="button" class="link-pdf" id="mp-conf-csv">⬇ Baixar lista</button><button type="button" class="mp-x" id="mp-conf-x" aria-label="Fechar">×</button></span></div>`
    + (g.itens.length ? g.itens.slice(0, 400).map((x, i) => `<button type="button" class="mp-res-i" data-i="${i}"${x.r ? '' : ' data-sem="1"'}><i style="--c:${MP_SIT[x.r ? x.r.f.est : mpSit(x.d)].cor}"></i><b>${esc(x.n)}</b><span>${esc(x.t)}</span><small>${esc(x.c || '')}</small></button>`).join('') + (g.itens.length > 400 ? `<p class="ajuda" style="margin:6px">Mostrando 400 de ${fmt(g.itens.length)}. A lista completa vem em "Baixar lista".</p>` : '') : '<p class="vazio">Nada nesta conferência. 👍</p>');
  $('#mp-conf-x').onclick = () => { el.hidden = true; el.innerHTML = ''; };
  $('#mp-conf-csv').onclick = () => {
    const linhas = [['Número', 'Logradouro / descrição', g.k === 'semtr' ? 'Situação' : 'Camada / zona'], ...g.itens.map(x => [x.n, x.t, x.c || ''])];
    const csv = '﻿' + linhas.map(l => l.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'conferencia-mapa-' + g.k + '-' + hojeISO() + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  $$('#mp-res .mp-res-i').forEach(b => b.onclick = () => { const x = g.itens[+b.dataset.i]; if (x.r) mapaSelecionar(x.r, true); else mapaSelecionarSem(x.d); });
}
// "Ver no mapa" a partir do detalhe do processo
function mapaIrPara(id) { MP.irPara = id; fechaModal('#modal-det'); abrirTela('mapa'); }

// ---------- desenhar / corrigir o traçado (só Projetos e administrador) ----------
const ME = { mv: null, d: null, depois: null };
async function mapaEditar(d, depois) {
  if (!mpPodeEditar()) { toast('Só o Setor de Projetos desenha no mapa.', true); return; }
  if (!MP.linhas) { const ok = await tarefa(() => mapaCarregar()); if (ok === undefined) return; }
  if (MP.semTabela) { toast('O mapa ainda não está no banco. Rode o arquivo provius-mapa.sql no Supabase.', true); return; }
  ME.d = d; ME.depois = depois;
  $('#me-tit').textContent = 'Traçado no mapa · ' + d.numero;
  $('#me-sub').textContent = [d.logradouro, d.bairro, d.zona].filter(Boolean).join(' · ');
  $('#me-busca').value = [d.logradouro, d.bairro, 'Manaus'].filter(Boolean).join(', ');
  $('#me-res').innerHTML = ''; abreModal('#modal-mapa');
  if (!ME.mv) {
    ME.mv = mvCriar($('#me-mapa'), { aoEditar: mapaEdBotoes }).estilos(Object.fromEntries(Object.entries(MP_SIT).map(([k, v]) => [k, { ...v, alfa: .45 }])), MP_ORDEM);
    $('#me-linha').onclick = () => ME.mv.edNova('L'); $('#me-area').onclick = () => ME.mv.edNova('P');
    $('#me-fim').onclick = () => ME.mv.edConcluir(); $('#me-desf').onclick = () => ME.mv.edDesfazer(); $('#me-apagar').onclick = () => ME.mv.edApagar();
    $('#me-salvar').onclick = mapaEdSalvar; $('#me-cancelar').onclick = () => fechaModal('#modal-mapa');
    $('#f-me-busca').onsubmit = e => { e.preventDefault(); mapaEndereco($('#me-busca').value); };
  }
  const meus = MP.porProc.get(d.id) || [];
  ME.mv.set(MP.fs).filtro(f => f.r.d?.id !== d.id && (f.est !== 'ant' || ME.mv.z >= 15)).selecionar([]);   // os traços deste processo viram a edição
  ME.mv.editar(meus.map(r => ({ tipo: r.tipo, coords: r.coords, descricao: r.descricao })));
  requestAnimationFrame(() => { const b = ME.mv.edCaixa(); if (b) ME.mv.enquadrar(b, 18); else ME.mv.centro(MV_CENTRO[0], MV_CENTRO[1], 12); if (!b && d.logradouro) mapaEndereco($('#me-busca').value, true); });
  mapaEdBotoes();
}
function mapaEdBotoes() {
  const s = ME.mv.edEstado(); if (!s) return;
  $('#me-fim').hidden = !s.novo; $('#me-desf').disabled = !(s.at >= 0 && (s.novo || s.pontos)); $('#me-apagar').disabled = s.at < 0;
  $('#me-n').textContent = s.n ? fmt(s.n) + (s.n === 1 ? ' traço desenhado' : ' traços desenhados') : 'Nenhum traço ainda';
  $('#me-dica').innerHTML = s.novo ? 'Clique no mapa para marcar os pontos da rua. Para terminar, <b>clique duas vezes</b> ou use <b>Terminar</b>.' : s.at >= 0 ? 'Arraste os pontos para corrigir. Clique na linha para acrescentar um ponto; botão direito num ponto o apaga.' : 'Use <b>+ Linha</b> para desenhar uma rua (ou <b>+ Área</b> para campo/quadra). Clique num traço para corrigir.';
}
async function mapaEdSalvar() {
  const d = ME.d; if (ME.mv.edEstado().novo) ME.mv.edConcluir(); const tr = ME.mv.edLer();
  const antes = (MP.porProc.get(d.id) || []).length;
  if (!tr.length && antes && !confirm('Apagar todo o traçado de ' + d.numero + ' do mapa?')) return;
  const r = await tarefa(() => rpc('mapa_salvar', { p_processo: d.id, p_tracos: tr, p_apagar: (MP.porProc.get(d.id) || []).map(x => x.id) }), tr.length ? 'Traçado salvo' : 'Traçado apagado'); if (r === undefined) return;
  MP.linhas = MP.linhas.filter(x => !(x.processo_id === d.id || x.d?.id === d.id)).concat(r || []); mapaIndexar();
  fechaModal('#modal-mapa'); if (MP.mv) { MP.mv.set(MP.fs); mapaAplicar(); mapaConferencia(); }
  ME.depois?.();
}
// procura o endereço no OpenStreetMap (Nominatim), só para levar o mapa até a rua
async function mapaEndereco(q, quieto) {
  q = String(q || '').trim(); if (!q) return; const el = $('#me-res'); el.innerHTML = '<span class="ajuda">Procurando…</span>';
  try {
    const u = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&viewbox=-60.35,-2.85,-59.75,-3.25&q=' + encodeURIComponent(q);
    const rs = await (await fetch(u, { headers: { 'Accept-Language': 'pt-BR' } })).json();
    if (!rs.length) { el.innerHTML = '<span class="ajuda">Endereço não encontrado. Arraste o mapa até o local.</span>'; return; }
    const vai = x => { const b = x.boundingbox.map(Number); ME.mv.enquadrar([mvX(b[2]), mvY(b[1]), mvX(b[3]), mvY(b[0])], 18); };
    if (quieto || rs.length === 1) { vai(rs[0]); el.innerHTML = '<span class="ajuda">Mapa levado para: ' + esc(rs[0].display_name.split(',').slice(0, 3).join(',')) + '</span>'; return; }
    el.innerHTML = rs.map((x, i) => `<button type="button" class="link-pdf" data-i="${i}">${esc(x.display_name.split(',').slice(0, 3).join(','))}</button>`).join(' · ');
    el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => vai(rs[+b.dataset.i]));
  } catch (e) { el.innerHTML = '<span class="ajuda">Não foi possível procurar agora. Arraste o mapa até o local.</span>'; }
}

// ---------- bloco "Traçado no mapa" na Tela 2 e no As built ----------
// 14/11/2026 (decisão do Alex): Projetos só entrega o projeto com o traçado desenhado (o banco também confere)
const mapaTemTraco = id => !MP.linhas || MP.semTabela || (MP.porProc.get(id) || []).length > 0;
const MB = {};
async function mapaBloco(pre, p) {
  const sec = $('#' + pre + '-sec-mapa'); if (!sec) return; sec.hidden = false;
  const info = $('#' + pre + '-mapa-info'), bt = $('#' + pre + '-mapa-bt');
  info.textContent = 'Carregando o mapa…'; bt.onclick = () => mapaEditar(D.find(x => x.id === p.id) || p, () => mapaBloco(pre, p));
  bt.hidden = !mpPodeEditar();
  try { await mapaCarregar(); } catch (e) { info.textContent = msgErro(e); return; }
  if (MP.semTabela) { info.textContent = 'O mapa ainda não está no banco (provius-mapa.sql).'; bt.hidden = true; $('#' + pre + '-mapa').hidden = true; return; }
  const rs = MP.porProc.get(p.id) || [];
  bt.textContent = rs.length ? '✎ Corrigir no mapa' : '✎ Desenhar no mapa';
  info.innerHTML = rs.length ? `<b>${fmt(rs.length)}</b> ${rs.length === 1 ? 'traço' : 'traços'} no mapa${rs.find(r => r.origem === 'provius' && r.por_nome) ? ' · desenhado por ' + esc(rs.find(r => r.origem === 'provius').por_nome) : rs.some(r => r.origem === 'google') ? ' · veio do mapa do Google' : ''}.` : (pre === 'j' ? '<b class="mp-obrig">Obrigatório para entregar.</b> ' : '') + 'Ainda sem rua desenhada. Desenhe o traçado do projeto para ele aparecer no mapa de todos os setores.';
  const box = $('#' + pre + '-mapa'); box.hidden = !rs.length; if (!rs.length) return;
  if (!MB[pre]) MB[pre] = mvCriar(box, { fixo: true }).estilos(MP_SIT, MP_ORDEM);
  MB[pre].set(rs.map(r => r.f)).enquadrar(mvCaixa(rs.map(r => r.f)), 17);
}

// ---------- importar o KML do mapa do Google (só administrador, uma vez) ----------
function mapaLerKml(txt) {
  const x = new DOMParser().parseFromString(txt, 'text/xml'), saida = [];
  if (x.getElementsByTagName('parsererror').length) throw new Error('Arquivo KML inválido.');
  const pms = [...x.getElementsByTagName('Placemark')];
  if (!pms.length && x.getElementsByTagName('NetworkLink').length) throw new Error('Esse arquivo é só um link para o mapa, sem as ruas. Baixe de novo desmarcando "Manter os dados atualizados".');
  const cs = t => String(t || '').trim().split(/\s+/).map(c => c.split(',').map(Number)).filter(c => isFinite(c[0]) && isFinite(c[1])).map(c => [+c[0].toFixed(6), +c[1].toFixed(6)]);
  pms.forEach(pm => {
    let pai = pm.parentNode; while (pai && pai.nodeName !== 'Folder') pai = pai.parentNode;
    const camada = mapaCamada(pai ? [...pai.children].find(c => c.nodeName === 'name')?.textContent : '');
    const nome = ([...pm.children].find(c => c.nodeName === 'name')?.textContent || '').trim();
    let desc = ''; [...pm.getElementsByTagName('Data')].forEach(dd => { if (/^descri/i.test(dd.getAttribute('name') || '')) desc = (dd.getElementsByTagName('value')[0]?.textContent || '').trim(); });
    if (!desc) desc = ([...pm.children].find(c => c.nodeName === 'description')?.textContent || '').replace(/<[^>]+>/g, ' ').replace(/^descri\S*:\s*/i, '').replace(/tessellate:.*$/i, '').trim();
    const chave = camada === 'ESPECIAL LED' ? null : (mapaChave(nome) || mapaChave(desc));
    const add = (tipo, coords) => { if ((tipo === 'T' && coords) || (tipo === 'L' && coords.length >= 2) || (tipo === 'P' && coords.length >= 3)) saida.push({ camada, nome, descricao: desc, chave, tipo, coords }); };
    [...pm.getElementsByTagName('LineString')].forEach(g => add('L', cs(g.getElementsByTagName('coordinates')[0]?.textContent)));
    [...pm.getElementsByTagName('Polygon')].forEach(g => { const o = g.getElementsByTagName('outerBoundaryIs')[0] || g; let c = cs(o.getElementsByTagName('coordinates')[0]?.textContent); if (c.length > 3 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1]) c = c.slice(0, -1); add('P', c); });
    [...pm.getElementsByTagName('Point')].forEach(g => add('T', cs(g.getElementsByTagName('coordinates')[0]?.textContent)[0]));
  });
  return saida;
}
async function mapaImportar(arq) {
  if (!EU?.admin) return;
  let tr; try { tr = mapaLerKml(await arq.text()); } catch (e) { toast(e.message, true); return; }
  if (!tr.length) { toast('Nenhuma rua encontrada nesse arquivo.', true); return; }
  const porCh = new Map(); D.forEach(d => { const k = mapaChave(d.numero); if (k && !porCh.has(k)) porCh.set(k, d.id); });
  tr.forEach(t => t.processo_id = t.chave ? porCh.get(t.chave) || null : null);
  const lig = new Set(tr.filter(t => t.processo_id).map(t => t.processo_id)).size, jaG = (MP.linhas || []).filter(r => r.origem === 'google').length;
  if (!confirm(`Importar ${fmt(tr.length)} traços do mapa do Google?\n\n• ${fmt(lig)} processos do Provius ligados pelo número\n• ${fmt(tr.filter(t => t.chave && !t.processo_id).length)} traços com número que não está no Provius\n• ${fmt(tr.filter(t => t.camada === 'ESPECIAL LED').length)} ruas da camada Especial LED (contrato anterior)` + (jaG ? `\n\nAs ${fmt(jaG)} ruas importadas antes do Google serão substituídas. O que Projetos desenhou no Provius fica como está.` : ''))) return;
  const L = 400; let n = 0; ocupado(true);
  try {
    for (let i = 0; i < tr.length; i += L) { n += await rpc('mapa_importar', { p_tracos: tr.slice(i, i + L), p_limpar: i === 0 }); $('#mp-resumo').textContent = 'Importando… ' + fmt(n) + ' de ' + fmt(tr.length); }
    toast(fmt(n) + ' traços importados'); await mapaCarregar(true); mapaMonta(true);
  } catch (e) { toast(msgErro(e) + ' (' + fmt(n) + ' importados até aqui; importe de novo para refazer tudo)', true); }
  finally { ocupado(false); }
}
