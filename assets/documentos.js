// PROVIUS · PDFs: visualizador, editor de plaquetas, carta, relatório e Excel
let _pdfjs = null;
async function carregaPdfjs() {
  if (_pdfjs) return _pdfjs;
  const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/';
  const lib = await import(base + 'pdf.min.mjs');
  lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
  _pdfjs = lib; return lib;
}

// ---------- visualizador genérico ----------
function criaVisor({ area, canvas, zoom, pags, pinfo, pant, ppro, menos, mais, ajusta }) {
  const v = { doc: null, pag: 1, z: 1, task: null, bytes: null, nome: '' };
  v.desenha = async () => {
    if (!v.doc) return;
    const pg = await v.doc.getPage(v.pag), cv = $(canvas), dpr = window.devicePixelRatio || 1;
    const w = Math.max(280, ($(area).clientWidth || 900) - 28) * v.z;
    const v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: w / v1.width * dpr });
    if (v.task) { v.task.cancel(); try { await v.task.promise } catch (e) { } }
    cv.width = vp.width; cv.height = vp.height; cv.style.width = vp.width / dpr + 'px'; cv.style.height = vp.height / dpr + 'px';
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    v.task = pg.render({ canvas: cv, canvasContext: ctx, viewport: vp }); try { await v.task.promise } catch (e) { }
    if (zoom) $(zoom).textContent = Math.round(v.z * 100) + '%';
    if (pags) { $(pags).hidden = v.doc.numPages < 2; $(pinfo).textContent = v.pag + ' / ' + v.doc.numPages; }
  };
  v.abrir = async (bytes, nome) => {
    v.bytes = bytes; v.nome = nome || 'arquivo.pdf'; v.pag = 1; v.z = 1;
    const lib = await carregaPdfjs(); v.doc = await lib.getDocument({ data: bytes.slice() }).promise; await v.desenha();
  };
  v.limpa = () => { v.doc = null; const cv = $(canvas); cv.width = 10; cv.height = 10; cv.style.width = '0'; };
  const zz = async (z, fx = .5, fy = .5) => {
    z = Math.max(.5, Math.min(4, z)); if (Math.abs(z - v.z) < .001) return; const a = $(area);
    const cx = (a.scrollLeft + a.clientWidth * fx) / a.scrollWidth, cy = (a.scrollTop + a.clientHeight * fy) / a.scrollHeight; v.z = z; await v.desenha();
    a.scrollLeft = cx * a.scrollWidth - a.clientWidth * fx; a.scrollTop = cy * a.scrollHeight - a.clientHeight * fy;
  };
  if (mais) $(mais).onclick = () => zz(v.z * 1.25); if (menos) $(menos).onclick = () => zz(v.z / 1.25); if (ajusta) $(ajusta).onclick = () => zz(1);
  if (pant) $(pant).onclick = () => { if (v.pag > 1) { v.pag--; v.desenha() } };
  if (ppro) $(ppro).onclick = () => { if (v.doc && v.pag < v.doc.numPages) { v.pag++; v.desenha() } };
  $(area).addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const r = $(area).getBoundingClientRect(); zz(v.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height) }, { passive: false });
  return v;
}

// janela de PDF (qualquer arquivo do processo)
let VJ = null;
async function verArquivo(arq, titulo) {
  if (!arq) { toast('Arquivo não encontrado.', true); return; }
  if (!/\.pdf$/i.test(arq.caminho)) { abrirNovaAba(arq.caminho); return; }
  if (!VJ) {
    VJ = criaVisor({ area: '#mp-area', canvas: '#mp-cv', zoom: '#mp-z', pags: '#mp-pags', pinfo: '#mp-pinfo', pant: '#mp-pant', ppro: '#mp-ppro', menos: '#mp-menos', mais: '#mp-mais' });
    $('#mp-baixar').onclick = () => baixarBlob(VJ.nome, new Blob([VJ.bytes], { type: 'application/pdf' }));
    $('#mp-print').onclick = () => abrirBlob(new Blob([VJ.bytes], { type: 'application/pdf' }));
  }
  $('#mp-tit').textContent = titulo || arq.nome; $('#mp-fonte').textContent = (arq.nome || '') + (arq.por_nome ? ' · enviado por ' + arq.por_nome + ' em ' + dataHora(arq.em) : '');
  abreModal('#modal-pdf'); VJ.limpa();
  await tarefa(async () => VJ.abrir(await bytesDe(arq.caminho), arq.nome));
}

// ---------- editor de plaquetas ----------
const ED = { doc: null, bytes: null, pag: 1, z: 1, marcas: [], vp: null, rot: 0, saida: null, vendo: false, ver: null, pop: null, tk: 0, task: null };
function edIniciar() {
  const zz = async (z, fx = .5, fy = .5) => { z = Math.max(.5, Math.min(4, z)); if (Math.abs(z - ED.z) < .001) return; const a = $('#ed-area'); const cx = (a.scrollLeft + a.clientWidth * fx) / a.scrollWidth, cy = (a.scrollTop + a.clientHeight * fy) / a.scrollHeight; ED.z = z; edFechaPop(); await edDesenha(); a.scrollLeft = cx * a.scrollWidth - a.clientWidth * fx; a.scrollTop = cy * a.scrollHeight - a.clientHeight * fy; };
  $('#ed-mais').onclick = () => zz(ED.z * 1.25); $('#ed-menos').onclick = () => zz(ED.z / 1.25); $('#ed-ajusta').onclick = () => zz(1);
  $('#ed-area').addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const a = $('#ed-area').getBoundingClientRect(); zz(ED.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), (e.clientX - a.left) / a.width, (e.clientY - a.top) / a.height) }, { passive: false });
  $('#ed-pant').onclick = () => { if (ED.pag > 1) { ED.pag--; edFechaPop(); edDesenha() } };
  $('#ed-ppro').onclick = () => { if (ED.doc && ED.pag < ED.doc.numPages) { ED.pag++; edFechaPop(); edDesenha() } };
  $('#ed-cv').addEventListener('click', e => { if (!ED.doc || ED.vendo) return; const r = $('#ed-cv').getBoundingClientRect(); edAbrePop((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, null) });
  $('#ed-okp').onclick = edConfirma; $('#ed-x').onclick = edFechaPop;
  $('#ed-del').onclick = () => { ED.marcas.splice(ED.pop.i, 1); ED.saida = null; edFechaPop(); edMarcas(); };
  $('#ed-num').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); edConfirma() } if (e.key === 'Escape') { e.stopPropagation(); edFechaPop() } });
  $('#ed-ver').onclick = async () => { if (ED.vendo) { ED.vendo = false; edDesenha(); return } if (!ED.saida) return; const lib = await carregaPdfjs(); ED.ver = await lib.getDocument({ data: ED.saida.slice() }).promise; ED.vendo = true; edDesenha(); };
}
async function edAbrir(bytes, nome) {
  Object.assign(ED, { bytes, pag: 1, z: 1, marcas: [], saida: null, vendo: false, nome });
  const lib = await carregaPdfjs(); ED.doc = await lib.getDocument({ data: bytes.slice() }).promise; await edDesenha();
}
function edLimpa(msg) { ED.doc = null; ED.marcas = []; ED.saida = null; const cv = $('#ed-cv'); cv.width = 10; cv.height = 10; cv.style.width = '0'; $('#ed-marcas').innerHTML = ''; $('#ed-fonte').textContent = msg || ''; edConta(); }
async function edDesenha() {
  const tk = ++ED.tk, cv = $('#ed-cv'), dpr = window.devicePixelRatio || 1, baseW = Math.min(1100, ($('#ed-area').clientWidth || 900) - 28);
  $('#ed-zinfo').textContent = Math.round(ED.z * 100) + '%';
  const doc = ED.vendo ? ED.ver : ED.doc; if (!doc) return;
  $('#ed-pags').hidden = doc.numPages < 2; $('#ed-pinfo').textContent = ED.pag + ' / ' + doc.numPages;
  $('#ed-ver').hidden = !ED.saida; $('#ed-ver').textContent = ED.vendo ? 'Voltar a editar' : 'Ver PDF gerado';
  $('#ed-fonte').textContent = ED.vendo ? 'Visualizando o PDF gerado, com as plaquetas gravadas.' : 'Arquivo: ' + (ED.nome || '');
  const pg = await doc.getPage(Math.min(ED.pag, doc.numPages)); if (tk !== ED.tk) return;
  const v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: baseW * ED.z / v1.width * dpr });
  if (!ED.vendo) { ED.vp = vp; ED.rot = ((pg.rotate || 0) % 360 + 360) % 360; }
  if (ED.task) { ED.task.cancel(); try { await ED.task.promise } catch (e) { } }
  cv.width = vp.width; cv.height = vp.height; cv.style.width = vp.width / dpr + 'px'; cv.style.height = vp.height / dpr + 'px';
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ED.task = pg.render({ canvas: cv, canvasContext: ctx, viewport: vp }); try { await ED.task.promise } catch (e) { }
  edMarcas();
}
function edConta() { const q = ED.marcas.length, c = $('#ed-cont'); c.textContent = q + ' plaqueta' + (q === 1 ? '' : 's'); c.classList.toggle('cheio', q > 0); }
function edMarcas() {
  const box = $('#ed-marcas'); if (ED.vendo) { box.innerHTML = ''; edConta(); return; }
  const cont = {}; ED.marcas.forEach(m => cont[m.num] = (cont[m.num] || 0) + 1);
  const vis = ED.marcas.map((m, i) => [m, i]).filter(([m]) => m.p === ED.pag);
  box.innerHTML = `<svg class="ed-linhas" viewBox="0 0 1000 1000" preserveAspectRatio="none">${vis.map(([m]) => `<line x1="${m.x * 1000}" y1="${m.y * 1000}" x2="${(m.x + m.dx) * 1000}" y2="${(m.y + m.dy) * 1000}"/>`).join('')}</svg>` +
    vis.map(([m]) => `<span class="ancora" style="left:${m.x * 100}%;top:${m.y * 100}%"></span>`).join('') +
    vis.map(([m, i]) => `<button type="button" class="mk${cont[m.num] > 1 ? ' dup' : ''}" data-i="${i}" style="left:${(m.x + m.dx) * 100}%;top:${(m.y + m.dy) * 100}%" aria-label="Plaqueta ${esc(m.num)}, arraste para mover"><b>${esc(m.num)}</b></button>`).join('');
  $$('#ed-marcas .mk').forEach(b => {
    const i = +b.dataset.i; let ini = null;
    b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); b.setPointerCapture(e.pointerId); const m = ED.marcas[i]; ini = { x: e.clientX, y: e.clientY, dx: m.dx, dy: m.dy, mov: false }; edFechaPop(); });
    b.addEventListener('pointermove', e => {
      if (!ini) return; const r = $('#ed-cv').getBoundingClientRect(), ddx = e.clientX - ini.x, ddy = e.clientY - ini.y;
      if (!ini.mov && Math.hypot(ddx, ddy) < 4) return; ini.mov = true; b.classList.add('arrastando');
      const m = ED.marcas[i]; m.dx = ini.dx + ddx / r.width; m.dy = ini.dy + ddy / r.height; b.style.left = (m.x + m.dx) * 100 + '%'; b.style.top = (m.y + m.dy) * 100 + '%';
      const ln = $$('#ed-marcas line')[vis.findIndex(([, j]) => j === i)]; if (ln) { ln.setAttribute('x2', (m.x + m.dx) * 1000); ln.setAttribute('y2', (m.y + m.dy) * 1000); }
    });
    b.addEventListener('pointerup', () => { if (!ini) return; b.classList.remove('arrastando'); const mov = ini.mov; ini = null; const m = ED.marcas[i]; if (mov) ED.saida = null; else edAbrePop(m.x + m.dx, m.y + m.dy, i); });
    b.addEventListener('click', e => e.stopPropagation());
    b.addEventListener('keydown', e => { const m = ED.marcas[i], st = .005, k = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key]; if (k) { e.preventDefault(); m.dx += k[0]; m.dy += k[1]; ED.saida = null; edMarcas(); $(`#ed-marcas .mk[data-i="${i}"]`)?.focus(); } if (e.key === 'Enter') { e.preventDefault(); edAbrePop(m.x + m.dx, m.y + m.dy, i); } });
  });
  edConta();
}
function edAbrePop(x, y, i) {
  const pop = $('#ed-pop'); ED.pop = { x, y, i }; pop.style.left = x * 100 + '%'; pop.style.top = y * 100 + '%'; pop.hidden = false;
  let sug = ''; if (i !== null) sug = ED.marcas[i].num; else if (ED.marcas.length) { const u = ED.marcas[ED.marcas.length - 1].num; if (/^\d+$/.test(u)) sug = String(BigInt(u) + 1n).padStart(u.length, '0'); }
  $('#ed-num').value = sug; $('#ed-del').hidden = i === null; setTimeout(() => { $('#ed-num').focus(); $('#ed-num').select(); }, 0);
}
function edFechaPop() { $('#ed-pop').hidden = true; ED.pop = null; }
function edConfirma() {
  const v = $('#ed-num').value.trim(); if (!v) { $('#ed-num').focus(); return; } const pp = ED.pop;
  if (pp.i === null) {
    const [px, py] = ED.vp.convertToPdfPoint(pp.x * ED.vp.width, pp.y * ED.vp.height);
    const ch = $('#ed-cv').getBoundingClientRect().height || 600;
    ED.marcas.push({ p: ED.pag, x: pp.x, y: pp.y, dx: 0, dy: -30 / ch, px, py, rot: ED.rot, num: v });
  } else ED.marcas[pp.i].num = v;
  const rep = ED.marcas.filter(m => m.num === v).length > 1; ED.saida = null; edFechaPop(); edMarcas(); if (rep) toast('Atenção: a plaqueta ' + v + ' já foi usada', true);
}
async function edGerar() {
  if (!ED.doc) throw new Error('Abra o projeto primeiro.');
  if (!ED.marcas.length) throw new Error('Marque pelo menos uma plaqueta no desenho.');
  const cont = {}; ED.marcas.forEach(m => cont[m.num] = (cont[m.num] || 0) + 1); const dups = Object.keys(cont).filter(k => cont[k] > 1);
  if (dups.length) throw new Error('Plaqueta repetida: ' + dups.join(', '));
  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
  const pdf = await PDFDocument.load(ED.bytes, { ignoreEncryption: true }); const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const azul = rgb(.043, .227, .471), verm = rgb(.84, .27, .18);
  ED.marcas.forEach(m => {
    const pg = pdf.getPage(m.p - 1), { width: w, height: h } = pg.getSize(), R = m.rot || 0, wd = (R === 90 || R === 270) ? h : w, hd = (R === 90 || R === 270) ? w : h, fs = Math.max(7, wd / 120);
    const a = R * Math.PI / 180, up = [-Math.sin(a), Math.cos(a)], rt = [Math.cos(a), Math.sin(a)], X = m.px, Y = m.py;
    const tw = font.widthOfTextAtSize(m.num, fs), bh = fs * 1.5, bw = tw + fs * .8;
    const ox = (m.dx || 0) * wd, oy = -(m.dy || 0) * hd, LX = X + rt[0] * ox + up[0] * oy, LY = Y + rt[1] * ox + up[1] * oy;
    const cx = LX - rt[0] * bw / 2 - up[0] * bh / 2, cy = LY - rt[1] * bw / 2 - up[1] * bh / 2;
    pg.drawCircle({ x: X, y: Y, size: fs * .3, color: verm }); pg.drawLine({ start: { x: X, y: Y }, end: { x: LX, y: LY }, thickness: fs * .1, color: azul });
    pg.drawRectangle({ x: cx, y: cy, width: bw, height: bh, rotate: degrees(R), color: rgb(1, 1, 1), borderColor: azul, borderWidth: fs * .12 });
    pg.drawText(m.num, { x: cx + rt[0] * (bw - tw) / 2 + up[0] * bh * .28, y: cy + rt[1] * (bw - tw) / 2 + up[1] * bh * .28, size: fs, font, color: azul, rotate: degrees(R) });
  });
  ED.saida = await pdf.save(); edDesenha(); return ED.saida;
}

// ---------- carta de envio à AGEMAN ----------
let _logoML = null;
async function logoML() { if (!_logoML) _logoML = new Uint8Array(await (await fetch('assets/logo-manaus-luz.png')).arrayBuffer()); return _logoML; }
async function gerarCarta(sel) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib; const pdf = await PDFDocument.create();
  const F = await pdf.embedFont(StandardFonts.Helvetica), FB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(await logoML()), lr = logo.height / logo.width;
  const W = 595, H = 842, M = 52, pr = rgb(.08, .08, .1), cz = rgb(.55, .58, .68), verde = rgb(.33, .6, .27), verdeC = rgb(.89, .94, .85), borda = rgb(.66, .78, .6), sz = 10.5;
  const corta = (t, f, s, max) => { t = String(t); if (f.widthOfTextAtSize(t, s) <= max) return t; while (t.length && f.widthOfTextAtSize(t + '…', s) > max) t = t.slice(0, -1); return t + '…'; };
  const quebra = (t, f, s, max) => { const out = []; String(t).split('\n').forEach(par => { let l = ''; par.split(' ').forEach(w => { const tt = l ? l + ' ' + w : w; if (f.widthOfTextAtSize(tt, s) > max && l) { out.push(l); l = w } else l = tt }); out.push(l) }); return out; };
  const MES = MESES.map(m => m[0].toUpperCase() + m.slice(1));
  const [y0, m0, d0] = ($('#ct-data').value || hojeISO()).split('-'); const dataExt = `Manaus, ${d0} de ${MES[+m0 - 1]} de ${y0}`;
  let pg, y;
  const nova = () => {
    pg = pdf.addPage([W, H]); const ww = 380; pg.drawImage(logo, { x: (W - ww) / 2, y: H / 2 - ww * lr / 2 - 20, width: ww, height: ww * lr, opacity: .07 });
    const lw = 115; pg.drawImage(logo, { x: (W - lw) / 2, y: H - 30 - lw * lr, width: lw, height: lw * lr, opacity: .55 });
    pg.drawText('Rua Belo Horizonte, 953 – Adrianópolis – Cep 69.057-060', { x: M, y: 42, size: 8.5, font: FB, color: cz }); pg.drawText('Tel: 2129-4800', { x: M, y: 31, size: 8.5, font: FB, color: cz }); y = H - 118;
  };
  const txt = (t, { f = F, s = sz, x = M, c = pr } = {}) => pg.drawText(t, { x, y, size: s, font: f, color: c });
  const par = (rot, t) => { const rw = rot ? FB.widthOfTextAtSize(rot + ' ', sz) : 0; quebra(t, F, sz, W - 2 * M - rw).forEach((l, i) => { if (i === 0 && rot) { txt(rot, { f: FB }); txt(l, { x: M + rw }) } else txt(l, { x: i === 0 ? M + rw : M }); y -= 14 }) };
  nova();
  txt(dataExt, { x: W - M - F.widthOfTextAtSize(dataExt, sz) }); y -= 14; txt($('#ct-num').value, { f: FB }); y -= 34;
  txt('À '); txt($('#ct-dest').value + ',', { f: FB, x: M + F.widthOfTextAtSize('À ', sz) }); y -= 26;
  txt('Att.: '); txt($('#ct-att').value, { f: FB, x: M + F.widthOfTextAtSize('Att.: ', sz) }); y -= 13; txt($('#ct-attc').value); y -= 24;
  par('Assunto:', $('#ct-ass').value); y -= 8; par('Referência:', $('#ct-ref').value); txt('Prezados Senhores,'); y -= 24;
  txt('Encaminhamos os seguintes AS Builts dos Projetos:'); y -= 14;
  const cols = [{ t: 'Nº DO PROJETO', w: 78 }, { t: 'LOGRADOURO', w: 225 }, { t: 'BAIRRO', w: 155 }, { t: 'TOTAL', w: 33 }], rh = 15, fs = 8;
  const cabT = () => { let x = M; pg.drawRectangle({ x: M, y: y - rh + 3, width: 491, height: rh, color: verde }); cols.forEach(c => { const w = FB.widthOfTextAtSize(c.t, fs); pg.drawText(c.t, { x: x + (c.w - w) / 2, y: y - rh + 7.5, size: fs, font: FB, color: rgb(1, 1, 1) }); x += c.w }); y -= rh; };
  cabT(); let tot = 0, n0 = 0;
  sel.forEach((d, i) => {
    if (y < 120) { pg.drawRectangle({ x: M, y: y + 3, width: 491, height: n0 * rh + rh, borderColor: borda, borderWidth: .6 }); nova(); n0 = 0; cabT(); }
    if (i % 2 === 0) pg.drawRectangle({ x: M, y: y - rh + 3, width: 491, height: rh, color: verdeC });
    let x = M; const vals = [d.numero, corta(d.logradouro, F, fs, cols[1].w - 6), corta(d.bairro || '', F, fs, cols[2].w - 6), String(d.total_pontos || 0)];
    vals.forEach((v, j) => { const w = F.widthOfTextAtSize(v, fs); pg.drawText(v, { x: j === 3 ? x + cols[j].w - 4 - w : x + (cols[j].w - w) / 2, y: y - rh + 7.5, size: fs, font: F, color: pr }); pg.drawLine({ start: { x: x + cols[j].w, y: y + 3 }, end: { x: x + cols[j].w, y: y - rh + 3 }, thickness: .5, color: borda }); x += cols[j].w; });
    pg.drawLine({ start: { x: M, y: y - rh + 3 }, end: { x: M + 491, y: y - rh + 3 }, thickness: .5, color: borda }); y -= rh; tot += d.total_pontos || 0; n0++;
  });
  pg.drawRectangle({ x: M, y: y + 3, width: 491, height: (n0 + 1) * rh, borderColor: borda, borderWidth: .6 });
  y -= 22; if (y < 200) nova();
  txt('E o link para acesso:'); y -= 24; const lk = $('#ct-link').value.trim() || '(link não informado)';
  quebra(lk, F, sz, W - 2 * M).forEach(l => { txt(l, { c: rgb(.02, .39, .76) }); pg.drawLine({ start: { x: M, y: y - 1.5 }, end: { x: M + F.widthOfTextAtSize(l, sz), y: y - 1.5 }, thickness: .6, color: rgb(.02, .39, .76) }); y -= 14 }); y -= 14;
  quebra('Sem mais, por esta nos colocamos à disposição de quaisquer esclarecimentos que se fizerem necessários.', F, sz, W - 2 * M).forEach(l => { txt(l); y -= 14 });
  y = Math.min(y - 90, 190); if (y < 80) { nova(); y = H - 200; }
  txt($('#ct-nome').value, { f: FB }); y -= 30; txt($('#ct-cargo').value);
  pdf.getPages().forEach((p, i) => p.drawText(String(i + 1), { x: W / 2, y: 31, size: 9, font: F, color: cz }));
  return { bytes: await pdf.save(), tot, paginas: pdf.getPageCount() };
}

// logo com transparência aplicada nos pixels: [55% para o cabeçalho, 7% para a marca d'água]
async function cartaLogoFosco(png) {
  try {
    const bmp = await createImageBitmap(new Blob([png], { type: 'image/png' }));
    return await Promise.all([.55, .07].map(async a => {
      const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
      const cx = cv.getContext('2d'); cx.globalAlpha = a; cx.drawImage(bmp, 0, 0);
      return new Uint8Array(await (await new Promise(r => cv.toBlob(r, 'image/png'))).arrayBuffer());
    }));
  } catch (e) { return [png, png]; }
}
// carta em Word (.docx): mesmo conteúdo e visual da carta em PDF, para editar e assinar no Word
async function gerarCartaDocx(sel) {
  const x = t => xEsc(String(t ?? '')), v = id => $(id).value;
  const MES = MESES.map(m => m[0].toUpperCase() + m.slice(1));
  const [y0, m0, d0] = (v('#ct-data') || hojeISO()).split('-'), dataExt = `Manaus, ${d0} de ${MES[+m0 - 1]} de ${y0}`;
  const logo = await logoML(), dv = new DataView(logo.buffer, logo.byteOffset), lr = dv.getUint32(20) / dv.getUint32(16);   // altura/largura do PNG
  const emu = pt => Math.round(pt * 12700), PR = '141419', CZ = '8C94AD', VD = '549945', VDC = 'E3F0D9', BD = 'A8C799';
  const run = (t, o = {}) => `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.c ? `<w:color w:val="${o.c}"/>` : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}${o.u ? '<w:u w:val="single"/>' : ''}</w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  const par = (runs, o = {}) => `<w:p><w:pPr><w:spacing w:before="${o.antes || 0}" w:after="0"/>${o.al ? `<w:jc w:val="${o.al}"/>` : ''}</w:pPr>${runs}</w:p>`;
  const fosco = await cartaLogoFosco(logo);   // [logo a 55%, marca d'água a 7%]
  const img = (id, w, h, alpha, anchor) => {
    const g = `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="logo${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${alpha > 10000 ? 'rLogo' : 'rMarca'}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>`;
    return anchor
      ? `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="1" locked="1" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:align>center</wp:align></wp:positionH><wp:positionV relativeFrom="page"><wp:align>center</wp:align></wp:positionV><wp:extent cx="${w}" cy="${h}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="Marca d'água"/><wp:cNvGraphicFramePr/>${g}</wp:anchor></w:drawing></w:r>`
      : `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${w}" cy="${h}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Logo"/><wp:cNvGraphicFramePr/>${g}</wp:inline></w:drawing></w:r>`;
  };
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
  // tabela dos projetos
  const cols = [[1560, 'Nº DO PROJETO', 'center'], [4400, 'LOGRADOURO', 'center'], [3100, 'BAIRRO', 'center'], [760, 'TOTAL', 'right']];
  const cel = (w, t, al, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.fundo ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fundo}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:before="40" w:after="40"/><w:jc w:val="${al}"/></w:pPr>${run(t, { b: o.b, c: o.c, sz: 16 })}</w:p></w:tc>`;
  const borda = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="${BD}"/>`).join('');
  const tabela = `<w:tbl><w:tblPr><w:tblW w:w="9820" w:type="dxa"/><w:tblBorders>${borda}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="60" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cols.map(c => `<w:gridCol w:w="${c[0]}"/>`).join('')}</w:tblGrid>
    <w:tr><w:trPr><w:tblHeader/></w:trPr>${cols.map(c => cel(c[0], c[1], 'center', { b: 1, c: 'FFFFFF', fundo: VD })).join('')}</w:tr>
    ${sel.map((d, i) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${[d.numero, d.logradouro, d.bairro || '', String(d.total_pontos || 0)].map((t, j) => cel(cols[j][0], t, cols[j][2], { fundo: i % 2 === 0 ? VDC : '' })).join('')}</w:tr>`).join('')}</w:tbl>`;
  const lk = v('#ct-link').trim();
  const link = lk ? `<w:hyperlink r:id="rLink">${run(lk, { c: '0563C1', u: 1 })}</w:hyperlink>` : run('(link não informado)');
  const corpo = [
    par(run(dataExt), { al: 'right' }),
    par(run(v('#ct-num'), { b: 1 })),
    par(run('À ') + run(v('#ct-dest') + ',', { b: 1 }), { antes: 600 }),
    par(run('Att.: ') + run(v('#ct-att'), { b: 1 }), { antes: 360 }),
    par(run(v('#ct-attc'))),
    par(run('Assunto: ', { b: 1 }) + run(v('#ct-ass')), { antes: 360, al: 'both' }),
    par(run('Referência: ', { b: 1 }) + run(v('#ct-ref')), { antes: 160, al: 'both' }),
    par(run('Prezados Senhores,'), { antes: 200 }),
    par(run('Encaminhamos os seguintes AS Builts dos Projetos:'), { antes: 360 }),
    par('', { antes: 80 }), tabela,
    par(run('E o link para acesso:'), { antes: 360 }),
    `<w:p><w:pPr><w:spacing w:before="200" w:after="0"/></w:pPr>${link}</w:p>`,
    par(run('Sem mais, por esta nos colocamos à disposição de quaisquer esclarecimentos que se fizerem necessários.'), { antes: 360, al: 'both' }),
    par(run(v('#ct-nome'), { b: 1 }), { antes: 1600 }),
    par(run(v('#ct-cargo')), { antes: 400 })].join('');
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rCab"/><w:footerReference w:type="default" r:id="rRod"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2360" w:right="1040" w:bottom="1700" w:left="1040" w:header="600" w:footer="500" w:gutter="0"/></w:sectPr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${corpo}${sect}</w:body></w:document>`;
  const cab = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>${img(1, emu(115), emu(115 * lr), 55000)}${img(2, emu(380), emu(380 * lr), 7000, true)}</w:p></w:hdr>`;
  const cinza = t => run(t, { b: 1, c: CZ, sz: 17 });
  const rod = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${cinza('Rua Belo Horizonte, 953 – Adrianópolis – Cep 69.057-060')}</w:p>
    <w:p><w:pPr><w:tabs><w:tab w:val="center" w:pos="4913"/></w:tabs><w:spacing w:after="0"/></w:pPr>${cinza('Tel: 2129-4800')}<w:r><w:tab/></w:r><w:r><w:rPr><w:color w:val="${CZ}"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:color w:val="${CZ}"/><w:sz w:val="18"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:color w:val="${CZ}"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:color w:val="${CZ}"/><w:sz w:val="18"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:color w:val="${CZ}"/><w:sz w:val="18"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:color w:val="${PR}"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const blob = zipStore({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rEst" Type="${REL}/styles" Target="styles.xml"/><Relationship Id="rCab" Type="${REL}/header" Target="header1.xml"/><Relationship Id="rRod" Type="${REL}/footer" Target="footer1.xml"/>${lk ? `<Relationship Id="rLink" Type="${REL}/hyperlink" Target="${x(lk)}" TargetMode="External"/>` : ''}</Relationships>`,
    'word/_rels/header1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rLogo" Type="${REL}/image" Target="media/logo.png"/><Relationship Id="rMarca" Type="${REL}/image" Target="media/marca.png"/></Relationships>`,
    'word/document.xml': doc, 'word/styles.xml': estilos, 'word/header1.xml': cab, 'word/footer1.xml': rod, 'word/media/logo.png': fosco[0], 'word/media/marca.png': fosco[1]
  });
  return new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ---------- relatório em PDF ----------
async function gerarRelatorio(sel, setores, anoTxt) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib; const pdf = await PDFDocument.create();
  const F = await pdf.embedFont(StandardFonts.Helvetica), FB = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo = null; try { logo = await pdf.embedPng(new Uint8Array(await (await fetch('assets/logo-provius.png')).arrayBuffer())); } catch (e) { }
  const W = 842, H = 595, M = 34, az = rgb(.043, .227, .471), cz = rgb(.42, .45, .5), pr = rgb(.1, .1, .12), lin = rgb(.85, .87, .9), fundoG = rgb(.89, .93, .97);
  const corta = (t, f, s, max) => { t = String(t ?? ''); if (f.widthOfTextAtSize(t, s) <= max) return t; while (t.length && f.widthOfTextAtSize(t + '…', s) > max) t = t.slice(0, -1); return t + '…'; };
  const cols = [{ t: 'Nº', w: 76 }, { t: 'Serviço', w: 86 }, { t: 'Logradouro', w: 204 }, { t: 'Bairro', w: 112 }, { t: 'Zona', w: 68 }, { t: 'Pontos', w: 46, r: 1 }, { t: 'Etapa atual', w: 118 }, { t: 'Data', w: 0 }];
  cols[7].w = W - 2 * M - cols.slice(0, 7).reduce((a, c) => a + c.w, 0);
  let pg, y;
  const nova = () => { pg = pdf.addPage([W, H]); if (logo) { const lw = 92; pg.drawImage(logo, { x: M, y: H - 26 - lw * logo.height / logo.width, width: lw, height: lw * logo.height / logo.width }); }
    pg.drawText('Relatório de projetos', { x: M + 110, y: H - 36, size: 15, font: FB, color: az });
    pg.drawText(`Setores: ${setores.join(', ')} · ${anoTxt} · gerado em ${new Date().toLocaleDateString('pt-BR')} por ${EU?.nome || ''}`, { x: M + 110, y: H - 50, size: 8.5, font: F, color: cz });
    pg.drawLine({ start: { x: M, y: H - 60 }, end: { x: W - M, y: H - 60 }, thickness: .8, color: az }); y = H - 78; };
  const cab = () => { pg.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 15, color: fundoG }); let x = M + 4; cols.forEach(c => { pg.drawText(c.t, { x: c.r ? x + c.w - 8 - FB.widthOfTextAtSize(c.t, 8) : x, y, size: 8, font: FB, color: az }); x += c.w }); y -= 16; };
  nova();
  const resumo = {}; sel.forEach(d => { const g = grupo(d); resumo[g] = resumo[g] || [0, 0]; resumo[g][0]++; resumo[g][1] += d.total_pontos || 0; });
  let rx = M; Object.entries(resumo).forEach(([g, [n, p]]) => { const t2 = `${n} proj. · ${fmt(p)} pts`, bw = Math.max(FB.widthOfTextAtSize(g, 9), F.widthOfTextAtSize(t2, 8)) + 16;
    pg.drawRectangle({ x: rx, y: y - 22, width: bw, height: 30, borderColor: lin, borderWidth: .8 }); pg.drawText(g, { x: rx + 8, y: y - 3, size: 9, font: FB, color: pr }); pg.drawText(t2, { x: rx + 8, y: y - 16, size: 8, font: F, color: cz }); rx += bw + 8; });
  y -= 44; let g0 = null;
  sel.forEach(d => { const g = grupo(d); if (y < M + 40) { nova(); g0 = null; }
    if (g !== g0) { if (y < M + 70) nova(); g0 = g; y -= 4; pg.drawText(`${g.toUpperCase()}  ·  ${resumo[g][0]} projetos · ${fmt(resumo[g][1])} pontos`, { x: M, y, size: 9.5, font: FB, color: az }); y -= 14; cab(); }
    const data = d.etapa === 6 ? dataBR(d.enviado_ageman) : (d.cancelado ? '' : 'desde ' + dataBR(d.etapa_desde));
    const v = [d.numero, d.tipo_servico || '—', d.logradouro, d.bairro, d.zona, String(d.total_pontos || 0), d.cancelado ? 'Cancelado' : (d.etapa < 6 ? ETAPAS[d.etapa].nome : 'Enviado AGEMAN'), data];
    let x = M + 4; cols.forEach((c, j) => { const t = corta(v[j], j === 0 ? FB : F, 8, c.w - 8); pg.drawText(t, { x: c.r ? x + c.w - 8 - F.widthOfTextAtSize(t, 8) : x, y, size: 8, font: j === 0 ? FB : F, color: pr }); x += c.w; });
    pg.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: .4, color: lin }); y -= 14; });
  const n = pdf.getPageCount(); pdf.getPages().forEach((p, i) => p.drawText(`Provius · página ${i + 1} de ${n}`, { x: W - M - 100, y: 18, size: 7.5, font: F, color: cz }));
  return { bytes: await pdf.save(), paginas: n };
}

// ---------- Excel no formato da planilha de acompanhamento ----------
const CAB_PLAN = ['TIPO DE SERVIÇO', 'CROQUÍ', 'Nº DE ENCAMINHAMENTO', 'Nº DO PROJETO', 'LOGRADOURO', 'BAIRRO', 'ZONA', ...POTS.map(w => w + 'W'), 'TOTAL DE PONTOS', 'MODERNIZAÇÃO', 'CRESCIMENTO VEGETATIVO', 'ILUMINAÇÃO DE DESTAQUE', 'PONTOS INSTALADOS', 'DESENHO', 'TABELA DE CARGA', 'CADASTRO', 'ENTREGUE EXECUÇÃO', 'EXECUTADA', 'AS BUILT - RECEBIDO', 'AS BUILT - DESENHO', 'ASBUILT AGEMAN', 'ANO', 'SITUAÇÃO NO PROVIUS'];
const dataXL = t => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
function linhaPlanilha(d) {
  const pw = d.potencias || {}, can = d.cancelado, sn = c => can ? '' : (c ? 'SIM' : 'NÃO'), e = d.etapa;
  return [can ? 'PROJETO CANCELADO' : (d.tipo_servico || ''), d.croqui_recebido === false ? 'NÃO RECEBIDO' : 'RECEBIDO', d.ref_pedido || '', d.numero, d.logradouro, d.bairro, d.zona,
    ...POTS.map(w => pw[w] || null), d.total_pontos || 0, d.mod_mod || null, d.mod_cv || null, d.mod_dest || null, (d.mod_cv + d.mod_mod + d.mod_dest) || d.total_pontos || 0,
    sn(e >= 2), sn(e >= 2), sn(e >= 4), dataXL(d.entregue_execucao) || (e >= 2 && !can ? 'SIM' : null), sn(e >= 3), sn(e >= 4), sn(e >= 5),
    e === 6 ? (dataXL(d.enviado_ageman) || 'SIM') : (can ? '' : 'NÃO ENVIADO'), d.ano, grupo(d) + (e < 6 && !can ? ' · ' + ETAPAS[e].nome : '')];
}
function xEsc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function colL(i) { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; } return s; }
function geraXlsx(cab, linhas) {
  const cel = (v, r, c, st) => { const ref = colL(c) + r; if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return `<c r="${ref}" s="2"><v>${v.getTime() / 864e5 + 25569}</v></c>`; if (typeof v === 'number') return `<c r="${ref}"${st ? ` s="${st}"` : ''}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${st ? ` s="${st}"` : ''}><is><t xml:space="preserve">${xEsc(v)}</t></is></c>`; };
  const larg = cab.map((h, i) => /^\d+W$/.test(h) ? 6 : i === 4 ? 44 : i === 5 ? 26 : i === cab.length - 1 ? 34 : Math.max(10, Math.min(22, h.length + 2)));
  const rows = [`<row r="1">${cab.map((h, i) => cel(h, 1, i, 1)).join('')}</row>`].concat(linhas.map((l, j) => `<row r="${j + 2}">${l.map((v, i) => cel(v, j + 2, i)).join('')}</row>`));
  const ult = colL(cab.length - 1) + (linhas.length + 1);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${larg.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:${ult}"/></worksheet>`;
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="PROJETOS" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">PROJETOS!$A$1:$${colL(cab.length - 1)}$${linhas.length + 1}</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B3A78"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': sheet };
  return zipStore(files);
}
const _CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = _CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(), partes = [], central = []; let off = 0;
  for (const [nome, txt] of Object.entries(files)) {
    const nb = enc.encode(nome), db = typeof txt === 'string' ? enc.encode(txt) : txt, crc = crc32(db);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, db.length, true); h.setUint32(22, db.length, true); h.setUint16(26, nb.length, true);
    partes.push(new Uint8Array(h.buffer), nb, db);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, db.length, true); c.setUint32(24, db.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nb); off += 30 + nb.length + db.length;
  }
  const cs = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22)), n = Object.keys(files).length;
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, n, true); e.setUint16(10, n, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return new Blob([...partes, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
