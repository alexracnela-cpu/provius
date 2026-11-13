// PROVIUS · Tabela de Carga (projeto na Tela 2 e as built na etapa 5)
// Projetos preenche as linhas; o sistema calcula totais, perda do reator, redução e materiais,
// e gera o PDF (e o Excel, como opção). R- (reequilíbrio) não tem tabela de carga.
//
// Tabela (gravada em processos.tabela_carga / tabela_carga_asb):
//   { mod: [{lg, cl, pr, qr, pn, lm, irc, qn, br}],   modernização: retirado (pr, qr) e instalado (pn, lm, irc, qn, br)
//     exp: [{lg, cl, pn, lm, irc, qn, br, bl}],       expansão: pontos novos · bl: 'dest' = linha do bloco Iluminação de destaque
//                                                     (gravado junto com a expansão para o banco ver as linhas; na tela fica em t.dest)
//     mat_aj: {descrição: qtd}, mat_nome: {descrição: novo nome}, mat_rem: [descrição],   materiais calculados corrigidos, renomeados ou tirados
//     mat_extra: [{d, q}] }                                                              materiais a mais

const TC_DESDE = '2026-11-14T00:00:00-04:00';   // processos criados a partir daqui precisam da tabela (igual ao SQL)
const TC_PERDAS = { 70: 14, 100: 17, 150: 22, 250: 30, 400: 38, 1000: 58 };   // perda do reator; as demais potências não têm perda
const TC_POTS_RET = [...POTS, 1000];
const TC_CLASSES = ['V1', 'V2', 'V3', 'V4', 'V5', 'P1', 'P2', 'P3', 'P4'];
const tcPerda = w => TC_PERDAS[w] || 0;
const tcQ = v => +v || 0;
let SEM_TC = false;   // banco ainda sem as colunas da tabela de carga: as telas funcionam como antes

// ---------- cálculos ----------
const tcVazia = () => ({ mod: [], exp: [], dest: [], mat_aj: {}, mat_nome: {}, mat_rem: [], mat_extra: [] });
function tcNormaliza(t) {
  t = t ? JSON.parse(JSON.stringify(t)) : tcVazia();
  t.mod = Array.isArray(t.mod) ? t.mod : []; t.exp = Array.isArray(t.exp) ? t.exp : [];
  t.dest = [...(Array.isArray(t.dest) ? t.dest : []), ...t.exp.filter(r => r && r.bl === 'dest')].map(r => { const c = { ...r }; delete c.bl; return c; });
  t.exp = t.exp.filter(r => r && r.bl !== 'dest');
  t.mat_aj = t.mat_aj && typeof t.mat_aj === 'object' ? t.mat_aj : {}; t.mat_extra = Array.isArray(t.mat_extra) ? t.mat_extra : [];
  t.mat_nome = t.mat_nome && typeof t.mat_nome === 'object' ? t.mat_nome : {}; t.mat_rem = Array.isArray(t.mat_rem) ? t.mat_rem : [];
  delete t.por; delete t.em; return t;
}
function tcTotais(t) {
  const s = (l, f) => l.reduce((a, r) => a + f(r), 0);
  const qR = s(t.mod, r => tcQ(r.qr)), pR = s(t.mod, r => tcQ(r.qr) * (tcQ(r.pr) + tcPerda(tcQ(r.pr))));
  const qM = s(t.mod, r => tcQ(r.qn)), pM = s(t.mod, r => tcQ(r.qn) * tcQ(r.pn));
  const qE = s(t.exp, r => tcQ(r.qn)), pE = s(t.exp, r => tcQ(r.qn) * tcQ(r.pn));
  const qD = s(t.dest, r => tcQ(r.qn)), pD = s(t.dest, r => tcQ(r.qn) * tcQ(r.pn));
  return { qR, pR, qM, pM, qE, pE, qD, pD, qI: qM + qE + qD, pI: pM + pE + pD, red: pR - pM, pct: pR ? (pR - pM) / pR : 0, pot: tcPotencias(t) };
}
function tcPotencias(t) { const o = {}; [...t.mod, ...t.exp, ...t.dest].forEach(r => { const q = tcQ(r.qn); if (q > 0 && tcQ(r.pn)) o[r.pn] = (o[r.pn] || 0) + q; }); return o; }
// cada bloco vai para a sua modalidade: modernização → modernização · expansão → crescimento vegetativo · destaque → destaque
function tcModalidades(t) {
  const T = tcTotais(t);
  return { mod_mod: T.qM, mod_cv: T.qE, mod_dest: T.qD };
}
// materiais calculados: [descrição, quantidade, regra]
function tcMateriaisAuto(t) {
  const lum = {}, bracos = {}; let modL = 0, expL = 0;
  const conta = (r, exp) => { const q = tcQ(r.qn); if (!q) return; exp ? expL += q : modL += q; if (tcQ(r.pn)) lum[r.pn] = (lum[r.pn] || 0) + q; if (tcQ(r.br)) bracos[tcQ(r.br)] = (bracos[tcQ(r.br)] || 0) + q; };
  t.mod.forEach(r => conta(r, false)); [...t.exp, ...t.dest].forEach(r => conta(r, true));
  const L = modL + expL, m = [];
  Object.entries(bracos).sort((a, b) => a[0] - b[0]).forEach(([b, q]) => m.push(['BRAÇO GALVANIZADO ' + Math.round(b * 1000) + 'mm', q, 'braço de cada linha × quantidade']));
  Object.entries(lum).sort((a, b) => a[0] - b[0]).forEach(([w, q]) => m.push(['LUMINÁRIA LED ' + w + 'W', q, 'soma das linhas']));
  if (L) {
    m.push(['CONECTOR PERFURANTE', L * 2, '2 por luminária']);
    if (modL) m.push(['CINTA CIRCULAR 220mm', modL * 2, '2 por luminária da modernização']);
    m.push(['PARAFUSO FRANCÊS M16 EM AÇO GALVANIZADO', L * 2, '2 por luminária']);
    m.push(['FITA ISOLANTE ADESIVA ANTI-CHAMA', L, '1 por luminária']);
    m.push(['CABO PP 3X1,5MM²', L * 6, '6 m por luminária']);
  }
  return m;
}
const tcMatNome = (t, d) => (t.mat_nome || {})[d] ? String(t.mat_nome[d]).trim().toUpperCase() : d;   // descrição editada (em maiúsculas) ou a calculada
// materiais finais (com as correções à mão e os materiais a mais): [descrição, quantidade]
function tcMateriais(t) {
  const m = tcMateriaisAuto(t).filter(([d]) => !(t.mat_rem || []).includes(d))
    .map(([d, q]) => [tcMatNome(t, d), t.mat_aj && t.mat_aj[d] != null ? tcQ(t.mat_aj[d]) : q]);
  (t.mat_extra || []).forEach(x => { if ((x.d || '').trim()) m.push([x.d.trim().toUpperCase(), tcQ(x.q)]); });
  return m.filter(([, q]) => q > 0);   // quantidade zero não vai para o PDF nem para o Excel
}
// o que falta para a tabela valer (vazio = está ok)
function tcFaltas(t) {
  const f = [], linhas = [...t.mod.map(r => ['Modernização', r]), ...t.exp.map(r => ['Expansão', r]), ...t.dest.map(r => ['Destaque', r])];
  if (!linhas.some(([, r]) => tcQ(r.qn) > 0)) f.push('pelo menos uma linha com quantidade instalada');
  linhas.forEach(([b, r], i) => {
    if (!(r.lg || '').trim()) f.push(`logradouro na linha ${i + 1} (${b})`);
    if (!tcQ(r.qn) && !(b === 'Modernização' && tcQ(r.qr))) f.push(`quantidade na linha ${i + 1} (${b})`);
  });
  return [...new Set(f)];
}
const tcTemLinhas = t => !!t && ((t.mod || []).some(r => tcQ(r.qn) || tcQ(r.qr)) || (t.exp || []).some(r => tcQ(r.qn)) || (t.dest || []).some(r => tcQ(r.qn)));
const tcExige = p => !!p && ['', 'C'].includes(p.tipo || '') && new Date(p.criado_em) >= new Date(TC_DESDE);
const tcLinhaMod = ult => ({ lg: ult?.lg || '', cl: ult?.cl || 'V5', pr: ult?.pr || 70, qr: '', pn: ult?.pn || 40, lm: ult?.lm || '', irc: ult?.irc || '>70', qn: '', br: ult?.br ?? 2 });
const tcLinhaExp = ult => ({ lg: ult?.lg || '', cl: ult?.cl || 'V5', pn: ult?.pn || 50, lm: ult?.lm || '', irc: ult?.irc || '>70', qn: '', br: ult?.br ?? '' });
// só o que vai para o banco (sem linhas vazias)
function tcParaGravar(t) {
  const vazia = r => !String(r.lg || '').trim() && !tcQ(r.qn) && !tcQ(r.qr);
  const lim = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
  return { mod: t.mod.filter(r => !vazia(r)).map(lim), exp: [...t.exp.filter(r => !vazia(r)).map(lim), ...(t.dest || []).filter(r => !vazia(r)).map(r => ({ ...lim(r), bl: 'dest' }))], mat_aj: t.mat_aj || {}, mat_nome: t.mat_nome || {}, mat_rem: t.mat_rem || [], mat_extra: (t.mat_extra || []).filter(x => (x.d || '').trim()) };
}

// ---------- editor na tela ----------
// TCED.j = Tela 2 (projeto) · TCED.a = as built. base = tabela do projeto (no as built, para marcar o que mudou)
const TCED = { j: null, a: null };
const tcF = n => Number(n || 0).toLocaleString('pt-BR');
function tcOpts(lista, v, suf = '') { return lista.map(o => `<option value="${o}"${String(o) === String(v) ? ' selected' : ''}>${o}${suf}</option>`).join(''); }
function tcAbrir(pre, el, { p, t, base, onMuda }) {
  TCED[pre] = { el, p, t: tcNormaliza(t), base: base ? tcNormaliza(base) : null, onMuda };
  tcDesenha(pre);
}
function tcFechar(pre) { if (TCED[pre]) TCED[pre].el.innerHTML = ''; TCED[pre] = null; }
function tcDesenha(pre) {
  const E = TCED[pre]; if (!E) return; const t = E.t;
  const dif = (b, i, k) => { if (!E.base) return ''; const r0 = E.base[b][i]; return !r0 || String(r0[k] ?? '') !== String(t[b][i][k] ?? '') ? ' tc-dif' : ''; };
  const inp = (b, i, k, cls, tipo = 'number') => `<input type="${tipo}" class="tc-i ${cls}${dif(b, i, k)}" data-b="${b}" data-i="${i}" data-k="${k}" value="${esc(t[b][i][k] ?? '')}"${tipo === 'number' ? ' min="0" step="any" inputmode="decimal"' : ''} aria-label="${k}">`;
  const sel = (b, i, k, lista, suf) => `<select class="tc-i${dif(b, i, k)}" data-b="${b}" data-i="${i}" data-k="${k}" aria-label="${k}">${tcOpts(lista, t[b][i][k], suf)}</select>`;
  const rem = (b, i) => `<td><button type="button" class="rem" data-rem="${b}" data-i="${i}" aria-label="Tirar linha">×</button></td>`;
  const modRows = t.mod.map((r, i) => `<tr>
    <td>${inp('mod', i, 'lg', 'tc-lg', 'text')}</td><td>${sel('mod', i, 'cl', TC_CLASSES)}</td>
    <td class="tc-r g1">${sel('mod', i, 'pr', TC_POTS_RET, ' W')}</td><td class="num tc-r" data-perda="${i}"></td><td class="tc-r">${inp('mod', i, 'qr', 'tc-n')}</td><td class="num tc-r tc-calc" data-c="mod-r-${i}"></td>
    <td class="tc-m g1">${sel('mod', i, 'pn', POTS, ' W')}</td><td class="tc-m">${inp('mod', i, 'lm', 'tc-n')}</td><td class="tc-m">${inp('mod', i, 'irc', 'tc-irc', 'text')}</td><td class="tc-m">${inp('mod', i, 'qn', 'tc-n')}</td><td class="tc-m">${inp('mod', i, 'br', 'tc-n')}</td><td class="num tc-m tc-calc" data-c="mod-m-${i}"></td>${rem('mod', i)}</tr>`).join('');
  const novos = b => t[b].map((r, i) => `<tr>
    <td>${inp(b, i, 'lg', 'tc-lg', 'text')}</td><td>${sel(b, i, 'cl', TC_CLASSES)}</td>
    <td>${sel(b, i, 'pn', POTS, ' W')}</td><td>${inp(b, i, 'lm', 'tc-n')}</td><td>${inp(b, i, 'irc', 'tc-irc', 'text')}</td><td>${inp(b, i, 'qn', 'tc-n')}</td><td>${inp(b, i, 'br', 'tc-n')}</td><td class="num tc-calc" data-c="${b}-${i}"></td>${rem(b, i)}</tr>`).join('');
  const expRows = novos('exp'), destRows = novos('dest');
  E.el.innerHTML = `
    <div class="tc-aviso" data-tc="aviso" hidden></div>
    <h3 class="tc-bloco">Modernização <span>troca de luminárias existentes</span></h3>
    <p class="tc-dica"><b>Perda</b> do reator automática pela potência retirada: 70 W 14 · 100 W 17 · 150 W 22 · 250 W 30 · 400 W 38 · 1000 W 58. As demais não têm perda.</p>
    <div class="tab-wrap"><table class="tc-t"><thead>
      <tr class="tc-g"><th colspan="2"></th><th colspan="4" class="tc-r g1"><span>Padrão retirado</span></th><th colspan="6" class="tc-m g1"><span>Padrão modernizado</span></th><th></th></tr>
      <tr><th>Logradouro</th><th>Classe</th><th class="tc-r g1">Potência</th><th class="num tc-r" title="Perda do reator, automática pela potência">Perda</th><th class="tc-r">Qtd</th><th class="num tc-r">Total</th><th class="tc-m g1">Potência</th><th class="tc-m">Lm/W</th><th class="tc-m">IRC</th><th class="tc-m">Qtd</th><th class="tc-m">Braço (m)</th><th class="num tc-m">Total</th><th></th></tr></thead>
      <tbody>${modRows || '<tr><td colspan="13" class="vazio">Sem linhas de modernização.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="tc-r g1"></td><td class="tc-r"></td><td class="num tc-r" data-c="qR"></td><td class="num tc-r" data-c="pR"></td><td class="tc-m g1"></td><td class="tc-m"></td><td class="tc-m"></td><td class="num tc-m" data-c="qM"></td><td class="tc-m"></td><td class="num tc-m" data-c="pM"></td><td></td></tr></tfoot></table></div>
    <div class="total"><button type="button" class="btn peq" data-add="mod">+ Linha de modernização</button><div class="tc-red" data-c="red"></div></div>
    <h3 class="tc-bloco">Expansão <span>pontos novos (crescimento vegetativo)</span></h3>
    <div class="tab-wrap"><table class="tc-t"><thead><tr><th>Logradouro</th><th>Classe</th><th>Potência</th><th>Lm/W</th><th>IRC</th><th>Qtd</th><th>Braço (m)</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${expRows || '<tr><td colspan="9" class="vazio">Sem linhas de expansão.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5">Total</td><td class="num" data-c="qE"></td><td></td><td class="num" data-c="pE"></td><td></td></tr></tfoot></table></div>
    <div class="total"><button type="button" class="btn peq" data-add="exp">+ Linha de expansão</button></div>
    <h3 class="tc-bloco">Iluminação de destaque <span>praças, monumentos, fachadas · conta como destaque</span></h3>
    <div class="tab-wrap"><table class="tc-t"><thead><tr><th>Logradouro</th><th>Classe</th><th>Potência</th><th>Lm/W</th><th>IRC</th><th>Qtd</th><th>Braço (m)</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${destRows || '<tr><td colspan="9" class="vazio">Sem linhas de destaque.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5">Total</td><td class="num" data-c="qD"></td><td></td><td class="num" data-c="pD"></td><td></td></tr></tfoot></table></div>
    <div class="total"><button type="button" class="btn peq" data-add="dest">+ Linha de destaque</button></div>
    <div class="tc-duas"><div><h3 class="tc-bloco">Materiais utilizados <span>calculados · dá para corrigir</span></h3><div data-tc="mat"></div></div>
      <div><h3 class="tc-bloco">Vai para o processo <span>preenchido pela tabela</span></h3><div class="tc-resumo" data-tc="resumo"></div></div></div>`;
  E.el.querySelectorAll('.tc-i').forEach(x => {
    const ev = x.tagName === 'SELECT' ? 'change' : 'input';
    x.addEventListener(ev, () => { const r = t[x.dataset.b][+x.dataset.i], k = x.dataset.k; r[k] = ['pr', 'qr', 'pn', 'lm', 'qn', 'br'].includes(k) && x.value !== '' && !isNaN(+x.value) ? +x.value : x.value; tcAtualiza(pre); });
  });
  E.el.querySelectorAll('[data-rem]').forEach(b => b.onclick = () => { t[b.dataset.rem].splice(+b.dataset.i, 1); tcDesenha(pre); });
  E.el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    const l = t[b.dataset.add], ult = l[l.length - 1]; l.push(b.dataset.add === 'mod' ? tcLinhaMod(ult) : tcLinhaExp(ult)); tcDesenha(pre);
    const tr = E.el.querySelectorAll(`[data-b="${b.dataset.add}"][data-k="lg"]`); tr[tr.length - 1]?.focus();
  });
  tcAtualiza(pre);
}
// atualiza só o que é calculado (não redesenha os campos, para não perder o cursor)
function tcAtualiza(pre) {
  const E = TCED[pre]; if (!E) return; const t = E.t, T = tcTotais(t), el = E.el, W = ' <small>W</small>';
  const set = (k, h) => { const c = el.querySelector(`[data-c="${k}"]`); if (c) c.innerHTML = h; };
  t.mod.forEach((r, i) => {
    const pe = tcPerda(tcQ(r.pr)), c = el.querySelector(`[data-perda="${i}"]`);
    if (c) c.innerHTML = `<span class="tc-chip${pe ? '' : ' zero'}" title="Perda do reator de ${esc(r.pr)} W (automática)">${pe ? pe + ' W' : 'sem perda'}</span>`;
    set('mod-r-' + i, tcF(tcQ(r.qr) * (tcQ(r.pr) + pe)) + W); set('mod-m-' + i, tcF(tcQ(r.qn) * tcQ(r.pn)) + W);
  });
  ['exp', 'dest'].forEach(b => t[b].forEach((r, i) => set(b + '-' + i, tcF(tcQ(r.qn) * tcQ(r.pn)) + W)));
  set('qR', tcF(T.qR)); set('pR', tcF(T.pR) + W); set('qM', tcF(T.qM)); set('pM', tcF(T.pM) + W); set('qE', tcF(T.qE)); set('pE', tcF(T.pE) + W); set('qD', tcF(T.qD)); set('pD', tcF(T.pD) + W);
  set('red', T.qR ? `<span>Redução <b>${tcF(T.red)} W</b></span><span class="tc-pct">${(T.pct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% a menos</span>` : '');
  // marca o que mudou em relação ao projeto (só no as built)
  if (E.base) el.querySelectorAll('.tc-i').forEach(x => { const r0 = E.base[x.dataset.b][+x.dataset.i]; x.classList.toggle('tc-dif', !r0 || String(r0[x.dataset.k] ?? '') !== String(t[x.dataset.b][+x.dataset.i][x.dataset.k] ?? '')); });
  tcResumo(pre, T); tcMatDesenha(pre);
  if (E.onMuda) E.onMuda();
}
function tcResumo(pre, T) {
  const E = TCED[pre], t = E.t, el = E.el.querySelector('[data-tc="resumo"]'); if (!el) return;
  const m = tcModalidades(t);
  const pot = Object.entries(T.pot).sort((a, b) => a[0] - b[0]).map(([w, q]) => `${q}× ${w} W`).join(', ') || '—';
  let dif = '';
  if (E.base) {
    const B = tcTotais(E.base), d = [];
    if (B.qI !== T.qI) d.push(`pontos ${B.qI} → <b>${T.qI}</b>`);
    if (B.pI !== T.pI) d.push(`potência instalada ${tcF(B.pI)} W → <b>${tcF(T.pI)} W</b>`);
    if (B.qR !== T.qR) d.push(`retiradas ${B.qR} → <b>${T.qR}</b>`);
    dif = `<p class="tc-difmsg${d.length ? '' : ' ok'}">${d.length ? 'Diferente do projeto: ' + d.join(' · ') + '. Os campos alterados ficam em laranja.' : '✓ Igual à tabela do projeto.'}</p>`;
  }
  el.innerHTML = `${dif}<div><span class="r">Potência aplicada</span><b>${pot}</b></div>
    <div><span class="r">Total de pontos</span><b class="numero">${T.qI}</b></div>
    <div><span class="r">Pontos por modalidade</span><b>Modernização ${m.mod_mod} · Crescimento vegetativo ${m.mod_cv} · Destaque ${m.mod_dest}</b></div>
    <div><span class="r">Potência instalada</span><b>${tcF(T.pI)} W</b></div>`;
}
function tcMatDesenha(pre) {
  const E = TCED[pre], t = E.t, el = E.el.querySelector('[data-tc="mat"]'); if (!el) return;
  if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;   // não atrapalha quem está digitando
  const auto = tcMateriaisAuto(t), baseM = E.base ? Object.fromEntries(tcMateriais(E.base)) : null;
  // correção de material que não é mais calculado: some
  Object.keys(t.mat_aj).forEach(d => { if (!auto.some(m => m[0] === d)) delete t.mat_aj[d]; });
  const vis = auto.filter(([d]) => !t.mat_rem.includes(d)), tirados = auto.filter(([d]) => t.mat_rem.includes(d));
  const linhas = vis.map(([d, q, regra]) => { const v = t.mat_aj[d] != null ? t.mat_aj[d] : q, aj = t.mat_aj[d] != null && +t.mat_aj[d] !== q, nome = t.mat_nome[d] || d;
    const nota = [aj ? `qtd corrigida (calculado: ${q})` : '', t.mat_nome[d] ? 'descrição editada' : ''].filter(Boolean).join(' · ');
    return `<tr><td><input type="text" data-nome="${esc(d)}" value="${esc(nome)}" class="${t.mat_nome[d] ? 'tc-aj' : ''}" aria-label="Descrição">
        <small class="tc-regra">${nota ? `${esc(nota)} · <button type="button" class="link-pdf" data-volta="${esc(d)}">voltar ao calculado</button>` : esc(regra)}</small></td>
      <td class="num"><input type="number" min="0" data-mat="${esc(d)}" value="${esc(v)}" class="${aj ? 'tc-aj' : ''}${baseM && baseM[tcMatNome(t, d)] !== +v ? ' tc-dif' : ''}" aria-label="Quantidade de ${esc(nome)}"></td>
      <td><button type="button" class="rem" data-tira="${esc(d)}" aria-label="Tirar ${esc(nome)}" title="Tirar da lista">×</button></td></tr>`; }).join('');
  const extras = t.mat_extra.map((x, i) => `<tr><td><input type="text" data-ex="${i}" data-k="d" value="${esc(x.d || '')}" placeholder="descrição do material" aria-label="Descrição"><small class="tc-regra">material a mais</small></td><td class="num"><input type="number" min="0" data-ex="${i}" data-k="q" value="${esc(x.q ?? '')}" aria-label="Quantidade"></td><td><button type="button" class="rem" data-exrem="${i}" aria-label="Tirar" title="Tirar da lista">×</button></td></tr>`).join('');
  el.innerHTML = `<div class="tab-wrap"><table class="tc-mat"><thead><tr><th>Descrição</th><th class="num">Qtd</th><th></th></tr></thead><tbody>${linhas + extras || '<tr><td colspan="3" class="vazio">Os materiais aparecem quando houver quantidade instalada.</td></tr>'}</tbody></table></div>
    ${tirados.length ? `<p class="tc-tirados">Tirados da lista: ${tirados.map(([d]) => `<button type="button" class="tc-volta" data-repoe="${esc(d)}" title="Voltar para a lista">↺ ${esc(t.mat_nome[d] || d)}</button>`).join('')}</p>` : ''}
    <div class="total"><button type="button" class="btn peq" data-tc="addmat">+ Outro material</button></div>`;
  const muda = () => { if (E.onMuda) E.onMuda(); };
  el.querySelectorAll('[data-mat]').forEach(x => { x.oninput = () => { const d = x.dataset.mat, q = auto.find(m => m[0] === d)?.[1]; if (x.value === '' || +x.value === q) delete t.mat_aj[d]; else t.mat_aj[d] = +x.value; x.classList.toggle('tc-aj', d in t.mat_aj); muda(); }; x.onchange = () => { x.blur(); tcMatDesenha(pre); }; });
  el.querySelectorAll('[data-nome]').forEach(x => { x.oninput = () => { const d = x.dataset.nome, v = x.value.trim(); if (!v || v.toUpperCase() === d.toUpperCase()) delete t.mat_nome[d]; else t.mat_nome[d] = v; x.classList.toggle('tc-aj', d in t.mat_nome); muda(); }; x.onchange = () => { x.blur(); tcMatDesenha(pre); }; });
  el.querySelectorAll('[data-volta]').forEach(b => b.onclick = () => { delete t.mat_aj[b.dataset.volta]; delete t.mat_nome[b.dataset.volta]; tcMatDesenha(pre); muda(); });
  el.querySelectorAll('[data-tira]').forEach(b => b.onclick = () => { if (!t.mat_rem.includes(b.dataset.tira)) t.mat_rem.push(b.dataset.tira); tcMatDesenha(pre); muda(); });
  el.querySelectorAll('[data-repoe]').forEach(b => b.onclick = () => { t.mat_rem = t.mat_rem.filter(d => d !== b.dataset.repoe); tcMatDesenha(pre); muda(); });
  el.querySelectorAll('[data-ex]').forEach(x => { x.oninput = () => { t.mat_extra[+x.dataset.ex][x.dataset.k] = x.dataset.k === 'q' ? +x.value : x.value; muda(); }; x.onchange = () => x.blur(); });
  el.querySelectorAll('[data-exrem]').forEach(b => b.onclick = () => { t.mat_extra.splice(+b.dataset.exrem, 1); tcMatDesenha(pre); muda(); });
  el.querySelector('[data-tc="addmat"]').onclick = () => { t.mat_extra.push({ d: '', q: 1 }); tcMatDesenha(pre); const ins = el.querySelectorAll('[data-k="d"]'); ins[ins.length - 1]?.focus(); };
}
function tcAviso(pre, txt) { const a = TCED[pre]?.el.querySelector('[data-tc="aviso"]'); if (a) { a.hidden = !txt; a.innerHTML = txt || ''; } }

// ---------- PDF ----------
// texto que a fonte do PDF não tem (emoji, setas…) vira "?" em vez de quebrar a geração
const tcPdfTxt = s => String(s ?? '').replace(/\s+/g, ' ').replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g, '?');
async function gerarTabelaCarga(p, t, o = {}) {
  t = tcNormaliza(t);
  const { PDFDocument, StandardFonts, rgb } = PDFLib; const pdf = await PDFDocument.create();
  pdf.setTitle('Tabela de carga ' + p.numero + (o.asbuilt ? ' - as built' : '')); pdf.setProducer('Provius');
  const F = await pdf.embedFont(StandardFonts.Helvetica), FB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(o.logo || await logoML());
  const W = 842, H = 595, M = 30, LW = W - 2 * M;
  const c = h => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
  const AZ = c('#0b3a78'), AZC = c('#e4edf8'), TX = c('#1b2330'), SV = c('#5d6b80'), LN = c('#cfd8e3'), ZB = c('#f5f8fb'),
    RT = c('#c4520f'), RTC = c('#fdebdf'), RTZ = c('#fff6f0'), IN = c('#2f7a3a'), INC = c('#e1f0dc'), INZ = c('#f4faf2'), AMT = c('#8a5a00'), BR = rgb(1, 1, 1);
  const n = v => Number(v || 0).toLocaleString('pt-BR');
  const larg = (s, f, sz) => f.widthOfTextAtSize(tcPdfTxt(s), sz);
  const corta = (s, f, sz, max) => { s = tcPdfTxt(s); if (larg(s, f, sz) <= max) return s; while (s.length && larg(s + '…', f, sz) > max) s = s.slice(0, -1); return s + '…'; };
  const T = tcTotais(t), B = o.base ? tcTotais(tcNormaliza(o.base)) : null;   // no as built os cartões mostram "projeto: X" quando mudou
  const quando = o.em ? new Date(o.em) : new Date();
  const dataTxt = quando.toLocaleDateString('pt-BR') + ' ' + quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  let pg, y;
  const txt = (s, x, yy, { f = F, sz = 8.5, cor = TX, al = 'l', w = 0 } = {}) => {
    s = tcPdfTxt(s); const lw = larg(s, f, sz);
    pg.drawText(s, { x: al === 'r' ? x + w - lw : al === 'c' ? x + (w - lw) / 2 : x, y: yy, size: sz, font: f, color: cor });
  };
  const caixa = (x, yy, w, h, cor) => pg.drawRectangle({ x, y: yy, width: w, height: h, color: cor });
  // caixa com cantos arredondados: raio único ou [sup.esq, sup.dir, inf.dir, inf.esq]
  const RAIO = 5;
  const arred = (x, yy, w, h, cor, borda, rr = RAIO) => {
    let [a, b, c2, d] = Array.isArray(rr) ? rr : [rr, rr, rr, rr]; const m = Math.min(w, h) / 2; [a, b, c2, d] = [a, b, c2, d].map(v => Math.min(v, m));
    const k = .4477;   // aproximação do arco com curva de Bézier
    const path = `M ${a} 0 L ${w - b} 0 C ${w - b * k} 0 ${w} ${b * k} ${w} ${b} L ${w} ${h - c2} C ${w} ${h - c2 * k} ${w - c2 * k} ${h} ${w - c2} ${h} L ${d} ${h} C ${d * k} ${h} 0 ${h - d * k} 0 ${h - d} L 0 ${a} C 0 ${a * k} ${a * k} 0 ${a} 0 Z`;
    pg.drawSvgPath(path, { x, y: yy + h, color: cor || undefined, borderColor: borda || undefined, borderWidth: borda ? .6 : 0 });
  };
  const cabecalho = primeira => {
    pg = pdf.addPage([W, H]); y = H - M;
    caixa(0, H - 6, W, 6, AZ);
    const lh = primeira ? 44 : 30, lw = lh * logo.width / logo.height; pg.drawImage(logo, { x: M, y: y - lh - 2, width: lw, height: lh });
    const xT = M + lw + 18;
    txt(o.asbuilt ? 'TABELA DE CARGA · AS BUILT' : 'TABELA DE CARGA', xT, y - 14, { f: FB, sz: 9, cor: o.asbuilt ? RT : SV });
    txt('Projeto ' + p.numero, xT, y - (primeira ? 36 : 32), { f: FB, sz: primeira ? 22 : 16, cor: AZ });
    if (primeira) {
      const info = [['Serviço', p.tipo_servico || '—'], ['Emitido em', dataTxt], ['Emitido por', o.por || '—']], xi = 470, wi = W - M - xi;
      info.forEach(([k, v], i) => { const yy = y - 14 - i * 13; txt(k.toUpperCase(), xi, yy, { f: FB, sz: 6.5, cor: SV }); txt(corta(v, F, 8.5, wi - 70), xi + 70, yy, { sz: 8.5 }); });
      y -= 66;
    } else y -= 46;
    pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: AZ });
    y -= 14;
  };
  const espaco = h => { if (y - h < 40) cabecalho(false); };

  cabecalho(true);
  // endereço em destaque
  const end = [p.logradouro, p.bairro, p.zona ? 'ZONA ' + p.zona : ''].filter(Boolean).join(' · ');
  arred(M, y - 30, LW, 30, AZC); arred(M, y - 30, 4, 30, AZ, null, [RAIO, 0, 0, RAIO]);
  txt('ENDEREÇO', M + 14, y - 18.5, { f: FB, sz: 7, cor: SV });
  txt(corta(end, FB, 14, LW - 90), M + 70, y - 20, { f: FB, sz: 14, cor: AZ });
  y -= 44;
  // cartões · bloco sem linhas não aparece no PDF
  const temMod = t.mod.length > 0 || !(t.exp.length || t.dest.length), temExp = t.exp.length > 0, temDest = t.dest.length > 0;
  {
    const det = (a, b, c3) => [temMod ? a : '', temExp ? b : '', temDest ? c3 : ''].filter(Boolean).join(' · ');
    const ks = [
      ['Pontos instalados', n(T.qI), det(`${T.qM} modernização`, `${T.qE} cresc. vegetativo`, `${T.qD} destaque`), B && B.qI !== T.qI ? 'projeto: ' + n(B.qI) : ''],
      ['Potência total retirada', n(T.pR) + ' W', `${T.qR} luminárias · com perda do reator`, B && B.pR !== T.pR ? 'projeto: ' + n(B.pR) + ' W' : ''],
      ['Potência total instalada', n(T.pI) + ' W', det(`${n(T.pM)} W modernização`, `${n(T.pE)} W cresc. vegetativo`, `${n(T.pD)} W destaque`), B && B.pI !== T.pI ? 'projeto: ' + n(B.pI) + ' W' : ''],
      ['Redução na modernização', T.qR ? n(T.red) + ' W' : '—', T.qR ? (T.pct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% menos que o retirado' : 'sem retirada', '']].filter(k => temMod || !/retirada|Redução/.test(k[0]));   // sem modernização, só pontos e potência instalada
    const g = 10, w = (LW - (ks.length - 1) * g) / ks.length, h = 50;
    ks.forEach(([rot, val, sub, dif], i) => {
      const x = M + i * (w + g), dest = /^Redução/.test(rot) && T.qR;
      arred(x, y - h, w, h, dest ? INC : AZC); arred(x, y - h, 4, h, dest ? IN : AZ, null, [RAIO, 0, 0, RAIO]);
      txt(rot.toUpperCase(), x + 11, y - 13, { f: FB, sz: 6.5, cor: SV });
      txt(val, x + 11, y - 32, { f: FB, sz: 17, cor: dest ? IN : AZ });
      txt(corta(sub, F, 7, w - 20), x + 11, y - 43, { sz: 7, cor: SV });
      if (dif) txt(dif, x, y - 13, { f: FB, sz: 6.5, cor: AMT, al: 'r', w: w - 8 });
    });
    y -= h + 16;
  }
  // tabela genérica · cols: [{t, w, al, g ('r' retirado | 'i' instalado), v: r => valor, calc}]
  const tabela = (titulo, sub, cols, linhas, totais) => {
    cols[0].w = LW - cols.slice(1).reduce((a, k) => a + k.w, 0);   // logradouro ocupa o que sobrar
    const rh = 15, hh = 22, temGrupo = cols.some(k => k.g);
    espaco(30 + hh + rh * Math.min(3, linhas.length + 1));
    txt(titulo, M, y, { f: FB, sz: 11, cor: AZ }); txt(sub, M + larg(titulo, FB, 11) + 8, y, { sz: 8, cor: SV }); y -= 8;
    const cab = () => {
      if (temGrupo) {
        let x = M; const grupos = [];
        cols.forEach(k => { const u = grupos[grupos.length - 1]; if (u && u.g === (k.g || '')) u.w += k.w; else grupos.push({ g: k.g || '', x, w: k.w }); x += k.w; });
        grupos.forEach(gr => { if (!gr.g) return; arred(gr.x, y - 13, gr.w, 13, gr.g === 'r' ? RT : IN, null, [4, 4, 0, 0]); txt(gr.g === 'r' ? 'PADRÃO RETIRADO' : 'PADRÃO MODERNIZADO', gr.x, y - 9.3, { f: FB, sz: 7, cor: BR, al: 'c', w: gr.w }); });
        y -= 13;
      }
      let x = M; arred(M, y - hh, LW, hh, AZC, null, [cols[0].g ? 0 : 4, cols[cols.length - 1].g ? 0 : 4, 0, 0]);
      cols.forEach((k, j) => {
        if (k.g) { if (j === cols.length - 1) arred(x, y - hh, k.w, hh, k.g === 'r' ? RTC : INC, null, 0); else caixa(x, y - hh, k.w, hh, k.g === 'r' ? RTC : INC); }
        const partes = k.t.split('\n'); partes.forEach((pt, i) => txt(pt, x + 4, y - (partes.length === 1 ? 13.5 : 9 + i * 8.5), { f: FB, sz: 6.6, cor: k.g === 'r' ? RT : k.g === 'i' ? IN : AZ, al: k.al || 'l', w: k.w - 8 }));
        x += k.w;
      });
      y -= hh;
    };
    cab();
    if (!linhas.length) { arred(M, y - rh, LW, rh, BR, LN, 4); txt('Sem linhas.', M + 6, y - 10.5, { sz: 8, cor: SV }); y -= rh + 18; return; }
    linhas.forEach((r, i) => {
      if (y - rh < 40) { cabecalho(false); txt(titulo + ' (continuação)', M, y, { f: FB, sz: 11, cor: AZ }); y -= 8; cab(); }
      let x = M;
      cols.forEach(k => {
        caixa(x, y - rh, k.w, rh, k.g === 'r' ? (i % 2 ? RTZ : BR) : k.g === 'i' ? (i % 2 ? INZ : BR) : (i % 2 ? ZB : BR));
        txt(corta(k.v(r), k.calc ? FB : F, 8, k.w - 8), x + 4, y - 10.5, { f: k.calc ? FB : F, sz: 8, cor: k.calc ? AZ : TX, al: k.al || 'l', w: k.w - 8 });
        x += k.w;
      });
      pg.drawLine({ start: { x: M, y: y - rh }, end: { x: W - M, y: y - rh }, thickness: .4, color: LN });
      y -= rh;
    });
    let x = M; arred(M, y - rh - 2, LW, rh + 2, AZ, null, [0, 0, 4, 4]);
    cols.forEach((k, j) => { const v = totais[j]; if (v != null) txt(v, x + 4, y - 11.5, { f: FB, sz: 8, cor: BR, al: j === 0 ? 'l' : k.al || 'l', w: k.w - 8 }); x += k.w; });
    y -= rh + 22;
  };
  const brc = r => tcQ(r.br) ? String(r.br).replace('.', ',') : '—';
  if (temMod) tabela('Modernização', 'troca de luminárias existentes', [
    { t: 'LOGRADOURO', w: 0, v: r => r.lg }, { t: 'CLASSE', w: 42, al: 'c', v: r => r.cl },
    { t: 'POTÊNCIA\n(W)', w: 52, al: 'r', g: 'r', v: r => n(r.pr) }, { t: 'PERDA\nREATOR (W)', w: 54, al: 'r', g: 'r', v: r => n(tcPerda(tcQ(r.pr))) }, { t: 'QTD', w: 38, al: 'r', g: 'r', v: r => n(r.qr) }, { t: 'TOTAL\n(W)', w: 60, al: 'r', g: 'r', calc: 1, v: r => n(tcQ(r.qr) * (tcQ(r.pr) + tcPerda(tcQ(r.pr)))) },
    { t: 'POTÊNCIA\n(W)', w: 52, al: 'r', g: 'i', v: r => n(r.pn) }, { t: 'LM/W', w: 44, al: 'r', g: 'i', v: r => r.lm || '—' }, { t: 'IRC', w: 40, al: 'c', g: 'i', v: r => r.irc || '—' }, { t: 'QTD', w: 38, al: 'r', g: 'i', v: r => n(r.qn) }, { t: 'BRAÇO\n(M)', w: 44, al: 'r', g: 'i', v: brc }, { t: 'TOTAL\n(W)', w: 86, al: 'r', g: 'i', calc: 1, v: r => n(tcQ(r.qn) * tcQ(r.pn)) }],
    t.mod, ['TOTAL', null, null, null, n(T.qR), n(T.pR), null, null, null, n(T.qM), null, n(T.pM)]);
  const colsNovos = () => [
    { t: 'LOGRADOURO', w: 0, v: r => r.lg }, { t: 'CLASSE', w: 42, al: 'c', v: r => r.cl },
    { t: 'POTÊNCIA\n(W)', w: 52, al: 'r', v: r => n(r.pn) }, { t: 'LM/W', w: 44, al: 'r', v: r => r.lm || '—' }, { t: 'IRC', w: 40, al: 'c', v: r => r.irc || '—' }, { t: 'QTD', w: 38, al: 'r', v: r => n(r.qn) }, { t: 'BRAÇO\n(M)', w: 44, al: 'r', v: brc }, { t: 'TOTAL\n(W)', w: 86, al: 'r', calc: 1, v: r => n(tcQ(r.qn) * tcQ(r.pn)) }];
  if (temExp) tabela('Crescimento vegetativo', 'pontos novos', colsNovos(), t.exp, ['TOTAL', null, null, null, null, n(T.qE), null, n(T.pE)]);
  if (temDest) tabela('Iluminação de destaque', 'pontos de destaque', colsNovos(), t.dest, ['TOTAL', null, null, null, null, n(T.qD), null, n(T.pD)]);
  // materiais (2 colunas) + luminárias por potência + assinatura
  const mat = tcMateriais(t), rh = 14, wm = 470, xr = M + wm + 24, wr = LW - wm - 24;
  const metade = Math.ceil(mat.length / 2), wc = (wm - 12) / 2, pots = Object.entries(T.pot).sort((a, b) => a[0] - b[0]);
  espaco(Math.max(26 + 16 + metade * rh, 8 + 16 + pots.length * rh + 18 + 54));
  const y0 = y;
  txt('Materiais utilizados', M, y, { f: FB, sz: 11, cor: AZ }); y -= 8;
  if (!mat.length) txt('Sem materiais.', M, y - 12, { sz: 8, cor: SV });
  [mat.slice(0, metade), mat.slice(metade)].forEach((col, ci) => {
    const x0 = M + ci * (wc + 12); let yy = y; if (!col.length) return;
    arred(x0, yy - 16, wc, 16, AZC, null, [4, 4, 0, 0]); txt('DESCRIÇÃO', x0 + 6, yy - 11, { f: FB, sz: 6.6, cor: AZ }); txt('QTD', x0, yy - 11, { f: FB, sz: 6.6, cor: AZ, al: 'r', w: wc - 8 }); yy -= 16;
    col.forEach((m, i) => {
      const ult = i === col.length - 1, fundo = i % 2 ? ZB : BR;
      if (ult) arred(x0, yy - rh, wc, rh, fundo, null, [0, 0, 4, 4]); else caixa(x0, yy - rh, wc, rh, fundo);
      const q = n(m[1]) + (/^CABO/i.test(m[0]) ? ' m' : '');
      txt(corta(m[0], F, 7.5, wc - 20 - larg(q, FB, 8)), x0 + 6, yy - 10, { sz: 7.5 }); txt(q, x0, yy - 10, { f: FB, sz: 8, cor: AZ, al: 'r', w: wc - 8 });
      if (!ult) pg.drawLine({ start: { x: x0, y: yy - rh }, end: { x: x0 + wc, y: yy - rh }, thickness: .4, color: LN }); yy -= rh;
    });
  });
  {
    let yr = y0;
    txt('Luminárias por potência', xr, yr, { f: FB, sz: 11, cor: AZ }); yr -= 8;
    const hR = 16 + pots.length * rh + 18;
    arred(xr, yr - hR, wr, hR, BR, LN); arred(xr, yr - 16, wr, 16, AZC, null, [RAIO, RAIO, 0, 0]);
    const tr = (a, b, yy, f, cor) => { txt(a, xr + 8, yy, { f, sz: 8, cor }); txt(b, xr, yy, { f, sz: 8, cor, al: 'r', w: wr - 8 }); };
    tr('POTÊNCIA', 'PONTOS', yr - 11, FB, AZ); yr -= 16;
    pots.forEach(([w, q]) => { tr(w + ' W', n(q), yr - 10, F, TX); yr -= rh; });
    pg.drawLine({ start: { x: xr, y: yr }, end: { x: xr + wr, y: yr }, thickness: .6, color: AZ });
    tr('Total', n(T.qI) + ' pontos', yr - 12, FB, AZ); yr -= 18;
    pg.drawLine({ start: { x: xr + 20, y: yr - 24 }, end: { x: xr + wr - 20, y: yr - 24 }, thickness: .6, color: TX });
    txt(o.asbuilt ? 'Responsável pelo as built' : 'Responsável pelo projeto', xr, yr - 34, { sz: 7.5, cor: SV, al: 'c', w: wr });
  }
  const tot = pdf.getPageCount();
  pdf.getPages().forEach((pp, i) => {
    pp.drawLine({ start: { x: M, y: 26 }, end: { x: W - M, y: 26 }, thickness: .5, color: LN });
    pp.drawText(tcPdfTxt('Provius · Gestão de Projetos · Manaus Luz · gerado em ' + dataTxt + (o.por ? ' por ' + o.por : '')), { x: M, y: 15, size: 7, font: F, color: SV });
    const s = 'Página ' + (i + 1) + ' de ' + tot; pp.drawText(s, { x: W - M - F.widthOfTextAtSize(s, 7), y: 15, size: 7, font: F, color: SV });
  });
  return { bytes: await pdf.save(), paginas: tot, totais: T };
}

// ---------- Excel (formato do modelo da tabela de carga, sem padrão nem colunas de ajuste) ----------
function geraXlsxCarga(p, t, asbuilt) {
  t = tcNormaliza(t); const T = tcTotais(t);
  const cel = {}, merges = [];
  // estilos (índices de cellXfs abaixo)
  const S = { tit: 1, sub: 2, faixa: 3, vias: 4, ret: 5, mod: 6, cab: 7, txt: 8, num: 9, totR: 10, totN: 11, redR: 12, redN: 13, pct: 14, matT: 15, neg: 16 };
  const put = (r, c, v, s, f) => { (cel[r] = cel[r] || {})[c] = { v, s, f }; };
  const junta = (r, c1, c2, v, s) => { for (let c = c1; c <= c2; c++) put(r, c, c === c1 ? v : null, s); if (c2 > c1) merges.push(colL(c1) + r + ':' + colL(c2) + r); };
  const NC = 12;   // colunas A..M (0..12)
  const altura = { 1: 30, 2: 20 };
  junta(1, 0, NC, 'PROJETO ' + p.numero.replace('/', '-') + (asbuilt ? ' - ASBUILT' : ''), S.tit);
  junta(2, 0, NC, [p.logradouro, p.bairro, p.zona ? 'ZONA ' + p.zona : ''].filter(Boolean).join(' - '), S.sub);
  const temMod = t.mod.length > 0 || !(t.exp.length || t.dest.length);   // bloco sem linhas não aparece
  let r = 3;
  if (temMod) {
    altura[r] = 22; junta(r, 0, NC, 'TABELA DE CARGA - MODERNIZAÇÃO', S.faixa); r += 2;
    junta(r, 0, 1, 'VIAS', S.vias); junta(r, 2, 6, 'PADRÃO RETIRADO', S.ret); junta(r, 7, 12, 'PADRÃO MODERNIZADO', S.mod); r++;
    ['LOGRADOURO', 'CLASSE', 'POTÊNCIA (W)', 'PERDA (W)', 'POTÊNCIA RETIRADA (W)', 'QTD', 'POTÊNCIA TOTAL (W)', 'POTÊNCIA (W)', 'Lm/W', 'IRC', 'QTD', 'BRAÇO (M)', 'POTÊNCIA TOTAL (W)'].forEach((h, i) => put(r, i, h, S.cab)); altura[r] = 30; r++;
    const r0 = r;
    t.mod.forEach(l => {
      const pr = tcQ(l.pr), pe = tcPerda(pr), qr = tcQ(l.qr), pn = tcQ(l.pn), qn = tcQ(l.qn);
      put(r, 0, l.lg || '', S.txt); put(r, 1, l.cl || '', S.num); put(r, 2, pr, S.num); put(r, 3, pe, S.num); put(r, 4, pr + pe, S.num, `C${r}+D${r}`); put(r, 5, qr, S.num); put(r, 6, qr * (pr + pe), S.num, `F${r}*E${r}`);
      put(r, 7, pn, S.num); put(r, 8, l.lm === '' || l.lm == null ? null : (isNaN(+l.lm) ? l.lm : +l.lm), S.num); put(r, 9, l.irc || '', S.num); put(r, 10, qn, S.num); put(r, 11, tcQ(l.br) || null, S.num); put(r, 12, qn * pn, S.num, `H${r}*K${r}`); r++;
    });
    if (r === r0) { for (let c = 0; c <= NC; c++) put(r, c, null, c ? S.num : S.txt); r++; }
    const ru = r - 1; r++;
    junta(r, 0, 4, 'QUANTIDADE RETIRADA', S.totR); put(r, 5, T.qR, S.totN, `SUM(F${r0}:F${ru})`); put(r, 6, null, S.totN);
    junta(r, 7, 9, 'QUANTIDADE INSTALADA', S.totR); put(r, 10, T.qM, S.totN, `SUM(K${r0}:K${ru})`); junta(r, 11, 12, null, S.totN); r++;
    const rp = r;
    junta(r, 0, 5, 'POTÊNCIA TOTAL (W)', S.totR); put(r, 6, T.pR, S.totN, `SUM(G${r0}:G${ru})`);
    junta(r, 7, 11, 'POTÊNCIA TOTAL (W)', S.totR); put(r, 12, T.pM, S.totN, `SUM(M${r0}:M${ru})`); r += 2;
    junta(r, 8, 11, 'POTÊNCIA REDUZIDA (W):', S.redR); put(r, 12, T.red, S.redN, `G${rp}-M${rp}`); r++;
    junta(r, 8, 11, 'PERCENTUAL REDUZIDO:', S.redR); put(r, 12, T.pct, S.pct, `IF(G${rp}=0,0,M${r - 1}/G${rp})`); r += 2;
  }
  [['exp', 'CRESCIMENTO VEGETATIVO', T.qE, T.pE], ['dest', 'ILUMINAÇÃO DE DESTAQUE', T.qD, T.pD]].forEach(([bl, nomeBl, qB, pB]) => {   // pontos novos (mesmas colunas do padrão modernizado)
    if (!t[bl].length) return;
    altura[r] = 22; junta(r, 0, NC, 'TABELA DE CARGA - ' + nomeBl, S.faixa); r++;
    junta(r, 0, 5, 'LOGRADOURO', S.cab); ['CLASSE', 'POTÊNCIA (W)', 'Lm/W', 'IRC', 'QTD', 'BRAÇO (M)', 'POTÊNCIA TOTAL (W)'].forEach((h, i) => put(r, 6 + i, h, S.cab)); altura[r] = 30; r++;
    const e0 = r;
    t[bl].forEach(l => {
      const pn = tcQ(l.pn), qn = tcQ(l.qn);
      junta(r, 0, 5, l.lg || '', S.txt); put(r, 6, l.cl || '', S.num); put(r, 7, pn, S.num); put(r, 8, l.lm === '' || l.lm == null ? null : (isNaN(+l.lm) ? l.lm : +l.lm), S.num); put(r, 9, l.irc || '', S.num); put(r, 10, qn, S.num); put(r, 11, tcQ(l.br) || null, S.num); put(r, 12, qn * pn, S.num, `H${r}*K${r}`); r++;
    });
    const eu = r - 1;
    junta(r, 0, 9, 'QUANTIDADE INSTALADA', S.totR); put(r, 10, qB, S.totN, `SUM(K${e0}:K${eu})`); junta(r, 11, 12, null, S.totN); r++;
    junta(r, 0, 11, 'POTÊNCIA TOTAL (W)', S.totR); put(r, 12, pB, S.totN, `SUM(M${e0}:M${eu})`); r += 2;
  });
  // materiais
  junta(r, 0, 3, 'TABELA DE MATERIAIS UTILIZADOS', S.matT); r++;
  junta(r, 0, 2, 'DESCRIÇÃO', S.neg); put(r, 3, 'QTD', S.neg); r++;
  tcMateriais(t).forEach(([d, q]) => { junta(r, 0, 2, d, S.txt); put(r, 3, q, S.num); r++; });
  const ult = r - 1;
  const cell = (rr, c, x) => {
    const ref = colL(c) + rr, st = ` s="${x.s || 0}"`;
    if (x.f) return `<c r="${ref}"${st}><f>${xEsc(x.f)}</f><v>${+x.v || 0}</v></c>`;
    if (x.v === null || x.v === undefined || x.v === '') return `<c r="${ref}"${st}/>`;
    if (typeof x.v === 'number') return `<c r="${ref}"${st}><v>${x.v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xEsc(x.v)}</t></is></c>`;
  };
  const rows = Object.keys(cel).map(Number).sort((a, b) => a - b).map(rr => `<row r="${rr}"${altura[rr] ? ` ht="${altura[rr]}" customHeight="1"` : ''}>${Object.keys(cel[rr]).map(Number).sort((a, b) => a - b).map(c => cell(rr, c, cel[rr][c])).join('')}</row>`).join('');
  const larg = [40, 8, 11, 9, 12, 7, 12, 11, 8, 7, 7, 9, 12];
  const nome = asbuilt ? 'ASBUILT' : 'TABELA DE CARGA';
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols>${larg.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const b = '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>';
  const fill = c => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`;
  const xf = (font, fil, al, extra = '') => `<xf numFmtId="${extra || 0}" fontId="${font}" fillId="${fil}" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${extra ? ' applyNumberFormat="1"' : ''}><alignment horizontal="${al}" vertical="center" wrapText="1"/></xf>`;
  // fontes: 0 normal · 1 título · 2 subtítulo · 3 faixa branca · 4 negrito · 5 negrito pequeno
  // preenchimentos: 2 azul · 3 laranja · 4 verde · 5 azul claro · 6 cinza
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts>
<fonts count="6"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="18"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="9"/><name val="Arial"/></font></fonts>
<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill('8FAADC')}${fill('F8CBAD')}${fill('C6E0B4')}${fill('DAE3F3')}${fill('D9D9D9')}</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${b}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="17"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>${xf(1, 0, 'center')}${xf(2, 0, 'center')}${xf(3, 2, 'center')}${xf(4, 0, 'center')}${xf(4, 3, 'center')}${xf(4, 4, 'center')}${xf(5, 5, 'center')}${xf(0, 0, 'left')}${xf(0, 0, 'center', 3)}${xf(4, 6, 'center')}${xf(4, 6, 'center', 3)}${xf(4, 5, 'right')}${xf(4, 5, 'center', 3)}${xf(4, 5, 'center', 164)}${xf(2, 5, 'center')}${xf(4, 0, 'center')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zipStore({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nome}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${nome}'!$A$1:$M$${ult}</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': styles, 'xl/worksheets/sheet1.xml': sheet });
}

// ---------- abrir o PDF / baixar o Excel ----------
// nome de arquivo: nº do processo - logradouro - bairro (sem caracteres que o Windows não aceita)
const nomeProcesso = p => [p.numero.replace(/\//g, '-'), p.logradouro, p.bairro].filter(Boolean).map(s => String(s).trim()).join(' - ')
  .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150).trim();
const tcArq = (p, asbuilt, ext) => nomeProcesso(p) + ' - TABELA DE CARGA' + (asbuilt ? ' AS BUILT' : '') + '.' + ext;
async function tcPdfAbrir(p, t, asbuilt, base) {
  const r = await tarefa(() => gerarTabelaCarga(p, t, { asbuilt, base, por: EU?.nome })); if (!r) return;
  abrirBlob(new Blob([r.bytes], { type: 'application/pdf' }));
}
function tcXlsxBaixar(p, t, asbuilt) { baixarBlob(tcArq(p, asbuilt, 'xlsx'), geraXlsxCarga(p, t, asbuilt)); }
// a tabela gravada de um processo (a do as built, se houver; senão a do projeto)
async function tcPdfDoProcesso(id) {
  const p = await tarefa(() => carregarProcesso(id)); if (!p) return;
  const asb = tcTemLinhas(p.tabela_carga_asb), t = asb ? p.tabela_carga_asb : p.tabela_carga;
  if (!tcTemLinhas(t)) { toast(p.numero + ' não tem tabela de carga no Provius.', true); return; }
  tcPdfAbrir(p, t, asb, asb ? p.tabela_carga : null);
}

// ---------- ligação com a Tela 2 (pre 'j') e o As built (pre 'a') ----------
function tcIniciar() {
  $('#j-tc-usar').onclick = () => tcUsar('j');
  $('#a-tc-usar').onclick = () => tcUsar('a');
  $('#j-tc-pdf').onclick = () => TCED.j && tcPdfAbrir({ ...PJ.p, tipo_servico: $('#j-serv').value || PJ.p.tipo_servico }, tcParaGravar(TCED.j.t), false);
  $('#j-tc-xl').onclick = () => TCED.j && tcXlsxBaixar(PJ.p, tcParaGravar(TCED.j.t), false);
  $('#a-tc-pdf').onclick = () => TCED.a && tcPdfAbrir(AB.p, tcParaGravar(TCED.a.t), true, TCED.a.base);
  $('#a-tc-xl').onclick = () => TCED.a && tcXlsxBaixar(AB.p, tcParaGravar(TCED.a.t), true);
  $('#j-serv').addEventListener('change', () => tcAtualiza('j'));
}
// a tela usa sempre a tabela (menos R-, que usa os itens de reequilíbrio)
function tcTela(pre, p) {
  const sec = $('#' + pre + '-sec-tc');
  tcFechar(pre); $('#' + pre + '-tc-opc').hidden = true;
  if (SEM_TC || !p || p.tipo === 'R' || !('tabela_carga' in p)) { if (p && !('tabela_carga' in p)) SEM_TC = true; sec.hidden = true; return; }   // R- usa os itens de reequilíbrio
  sec.hidden = false; $('#' + pre + '-tc-pdf').hidden = $('#' + pre + '-tc-xl').hidden = false;
  tcUsar(pre);   // 13/11/2026: todo processo (novo ou antigo) usa só a tabela; o editor antigo de potências e modalidades saiu
}
function tcUsar(pre) {
  const p = pre === 'j' ? PJ.p : AB.p; if (!p) return;
  let t, base = null;
  if (pre === 'j') t = p.tabela_carga;
  else { base = tcTemLinhas(p.tabela_carga) ? p.tabela_carga : null; t = tcTemLinhas(p.tabela_carga_asb) ? p.tabela_carga_asb : base; }
  t = tcNormaliza(t);
  if (!t.mod.length && !t.exp.length && !t.dest.length) { if (/MODERNIZA/i.test(p.tipo_servico || '')) t.mod.push({ ...tcLinhaMod(), lg: p.logradouro || '' }); else if (/DESTAQUE/i.test(p.tipo_servico || '')) t.dest.push({ ...tcLinhaExp(), lg: p.logradouro || '' }); else t.exp.push({ ...tcLinhaExp(), lg: p.logradouro || '' }); }
  $('#' + pre + '-tc-opc').hidden = true; $('#' + pre + '-tc-pdf').hidden = $('#' + pre + '-tc-xl').hidden = false;
  (pre === 'j' ? ['#j-sec-pot', '#j-sec-mod'] : ['#a-sec-pot']).forEach(s => $(s).hidden = true);   // potências e modalidades saem da tabela
  tcAbrir(pre, $('#' + pre + '-tc'), { p, t, base });
}
// antes de salvar/entregar: confere, grava a tabela e devolve os campos de potências e modalidades
// retorna null se não pode seguir, {} se a tela não usa a tabela
function tcPreparar(pre, entregar, servico) {
  const E = TCED[pre]; if (!E) return {};
  const g = tcParaGravar(E.t), t = tcNormaliza(g), faltas = tcFaltas(t);   // g: como vai para o banco · t: separado por bloco
  if (!entregar && !tcTemLinhas(t)) return {};   // só salvando, com a tabela vazia: não mexe nas potências já gravadas (processos antigos)
  if (entregar && faltas.length) {
    tcAviso(pre, '<b>Falta na tabela de carga:</b> ' + faltas.slice(0, 4).map(esc).join(' · ') + (faltas.length > 4 ? ' …' : ''));
    $('#' + pre + '-sec-tc').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Complete a tabela de carga antes de ' + (pre === 'a' ? 'concluir' : 'entregar'), true); return null;
  }
  tcAviso(pre, '');
  return { tabela: g, campos: { potencias: tcPotencias(t), ...tcModalidades(t) } };
}
async function tcGravar(pre, p, prep) {
  if (!prep || !prep.tabela) return;
  await rpc('salvar_tabela_carga', { p_id: p.id, p_fase: pre === 'a' ? 'asbuilt' : 'projeto', p_tabela: prep.tabela });
}
