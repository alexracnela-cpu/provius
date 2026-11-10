// PROVIUS · itens de reequilíbrio (R-): saldo do contrato, tela Saldo de Itens e bloco de itens da Tela 2
//
// De onde vem o consumo de cada item:
//   1. itens_consumo_mensal: consumo realizado mês a mês pela planilha oficial do contrato (até set/2026);
//   2. processo_itens: itens lançados por Projetos nos R- do Provius. Contam no saldo quando o projeto
//      foi entregue por Projetos (etapa 2 em diante) e o processo não está cancelado.
// Os R- antigos da planilha de itens (itens_historico) aparecem só para consulta e não mexem no saldo.

const IT = { ok: false, cat: [], porCod: {}, mensal: [], sis: [], hist: [], carregadoEm: 0, filtro: 'todos', ordem: 'item', sel: null };
let SEM_ITENS = false;   // banco ainda sem as tabelas de itens: o resto do sistema funciona sem elas
const IT_ATENCAO = 0.8;
const IT_PLANILHA_ATE = 'set/2026';   // último mês realizado da planilha do contrato carregada no banco
// prazo do contrato após o reequilíbrio: 25 anos (300 meses), de abr/2020 a mar/2045
const IT_CONTRATO_INI = new Date(2020, 3, 1), IT_CONTRATO_MESES = 25 * 12;
const IT_SIT = { est: { rot: 'Estourado', cls: 'est' }, ate: { rot: 'Atenção', cls: 'ate' }, nor: { rot: 'Normal', cls: 'nor' }, sem: { rot: 'Sem uso', cls: 'sem' } };
const fmtQ = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtR = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtMi = n => 'R$ ' + (Number(n || 0) / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' mi';
const itSit = (q, t) => q <= 0 ? 'sem' : q > t ? 'est' : q >= t * IT_ATENCAO ? 'ate' : 'nor';
const conta = s => s.processos && !s.processos.cancelado && s.processos.etapa >= 2;   // entregue por Projetos

async function itensCarregar(forcar) {
  if (SEM_ITENS) return false;
  if (!forcar && IT.ok && Date.now() - IT.carregadoEm < 60000) return true;
  const [c, m, s, h] = await Promise.all([
    sb.from('itens_contrato').select('*').order('ordem'),
    sb.from('itens_consumo_mensal').select('cod,mes,quantidade').order('mes'),
    sb.from('processo_itens').select('processo_id,cod,quantidade,processos(numero,logradouro,etapa,cancelado,criado_em)'),
    sb.from('itens_historico').select('numero,descricao,data,cod,quantidade').order('data')
  ]);
  if (c.error) { if (/itens_contrato|does not exist|schema cache/i.test(c.error.message || '')) { SEM_ITENS = true; itensAba(); return false; } toast(msgErro(c.error), true); return false; }
  IT.cat = c.data || []; IT.porCod = {}; IT.cat.forEach(i => IT.porCod[i.cod] = i);
  IT.mensal = m.data || []; IT.sis = s.data || []; IT.hist = h.data || [];
  IT.ok = true; IT.carregadoEm = Date.now(); itensAba();
  return true;
}

// consumo de cada item; "semProcesso" tira um processo da conta (a Tela 2 soma o lançamento atual por cima)
function itensResumo(semProcesso) {
  const base = {}, sis = {};
  IT.mensal.forEach(x => base[x.cod] = (base[x.cod] || 0) + Number(x.quantidade || 0));
  IT.sis.forEach(x => { if (conta(x) && x.processo_id !== semProcesso) sis[x.cod] = (sis[x.cod] || 0) + Number(x.quantidade || 0); });
  return IT.cat.map(i => {
    const q = (base[i.cod] || 0) + (sis[i.cod] || 0), t = Number(i.contratado || 0);
    return { ...i, contratado: t, base: base[i.cod] || 0, sistema: sis[i.cod] || 0, q, saldo: t - q, pct: t ? q / t : 0, sit: itSit(q, t), valor: q * Number(i.preco || 0) };
  });
}

// aba e selo com a contagem de itens em alerta
function itensAba() {
  const a = document.querySelector('#abas .aba[data-tela="saldo"]'); if (!a) return;
  if (SEM_ITENS || !pode('saldo')) { a.hidden = true; return; }
  if (!IT.ok) return;
  const n = itensResumo().filter(i => i.sit === 'est' || i.sit === 'ate').length, b = $('#sd-badge');
  b.hidden = !n; b.textContent = n; b.title = n + ' ' + (n === 1 ? 'item' : 'itens') + ' em atenção ou estourado';
}

// ================= tela Saldo de Itens =================
function saldoIniciar() {
  $('#sd-recarregar').onclick = () => tarefa(async () => { await itensCarregar(true); saldoDesenha(); }, 'Atualizado');
}
async function saldoAbrir() {
  const ok = await tarefa(() => itensCarregar());
  if (!ok) { $('#sd-corpo').hidden = true; $('#sd-vazio').hidden = false; return; }
  $('#sd-corpo').hidden = false; $('#sd-vazio').hidden = true; saldoDesenha();
}
function saldoDesenha() {
  const L = itensResumo(), cont = { est: 0, ate: 0, nor: 0 };
  L.forEach(i => { if (i.sit === 'est') cont.est++; else if (i.sit === 'ate') cont.ate++; else cont.nor++; });
  const vC = L.reduce((a, i) => a + i.valor, 0), vT = L.reduce((a, i) => a + i.contratado * Number(i.preco || 0), 0);
  $('#sd-sub').textContent = 'Contrato de 25 anos (abr/2020 a mar/2045) · realizado até ' + IT_PLANILHA_ATE + ' pela planilha do contrato + projetos R- entregues no Provius · valores base dez/19';

  // alertas
  const al = L.filter(i => i.sit === 'est' || i.sit === 'ate').sort((a, b) => b.pct - a.pct);
  $('#sd-alerta').hidden = !al.length;
  if (al.length) {
    $('#sd-alerta').innerHTML = `<b>${cont.est ? cont.est + (cont.est === 1 ? ' item estourado' : ' itens estourados') : ''}${cont.est && cont.ate ? ' e ' : ''}${cont.ate ? cont.ate + (cont.ate === 1 ? ' item em atenção' : ' itens em atenção') : ''}</b>` +
      `<span class="sd-al-bts">${al.map(i => `<button type="button" class="sd-al k-${i.sit}" data-cod="${esc(i.cod)}">${esc(i.cod)} · ${esc(i.descricao)} — ${fmtQ(i.q)} de ${fmtQ(i.contratado)} (${Math.round(i.pct * 100)}%)</button>`).join('')}</span>`;
    $$('#sd-alerta [data-cod]').forEach(b => b.onclick = () => { IT.sel = b.dataset.cod; saldoDesenha(); $('#sd-det').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  }

  // resumo
  const ini = IT_CONTRATO_INI, hoje = new Date(), M = IT_CONTRATO_MESES;
  const meses = Math.max(0, Math.min(M, (hoje.getFullYear() - ini.getFullYear()) * 12 + hoje.getMonth() - ini.getMonth() + 1));
  const kpi = (rot, val, barra, txt, cls) => `<div class="sd-kpi"><span class="r">${rot}</span><b class="${cls || ''}">${val}</b>${barra != null ? `<span class="sd-bar"><i style="width:${Math.min(100, barra)}%"></i></span>` : ''}<span class="ajuda">${txt}</span></div>`;
  $('#sd-kpis').innerHTML = kpi('Valor consumido', fmtMi(vC), vT ? vC / vT * 100 : 0, (vT ? Math.round(vC / vT * 100) : 0) + '% de ' + fmtMi(vT) + ' contratados') +
    kpi('Prazo do contrato decorrido', meses + ' de ' + M + ' meses', meses / M * 100, Math.round(meses / M * 100) + '% do prazo · faltam ' + (M - meses) + ' meses') +
    kpi('Itens estourados', cont.est, null, 'Acima de 100% do contratado', cont.est ? 'k-est' : '') +
    kpi('Itens em atenção', cont.ate, null, 'De 80% a 100% do contratado', cont.ate ? 'k-ate' : '');

  // filtros e ordem
  const F = [['todos', 'Todos', L.length], ['est', 'Estourados', cont.est], ['ate', 'Em atenção', cont.ate], ['nor', 'Normais', cont.nor]];
  $('#sd-filtros').innerHTML = F.map(([k, r, n]) => `<button type="button" data-f="${k}" aria-pressed="${IT.filtro === k}">${r} (${n})</button>`).join('');
  $$('#sd-filtros button').forEach(b => b.onclick = () => { IT.filtro = b.dataset.f; saldoDesenha(); });
  $$('#sd-ordem button').forEach(b => { b.setAttribute('aria-pressed', IT.ordem === b.dataset.o); b.onclick = () => { IT.ordem = b.dataset.o; saldoDesenha(); }; });

  let V = L.filter(i => IT.filtro === 'todos' || (IT.filtro === 'nor' ? i.sit === 'nor' || i.sit === 'sem' : i.sit === IT.filtro));
  if (IT.ordem === 'pct') V = V.slice().sort((a, b) => b.pct - a.pct);
  if (!IT.sel || !IT.porCod[IT.sel]) IT.sel = (al[0] || L[0] || {}).cod;
  $('#sd-lista').innerHTML = V.map(i => `<tr class="${i.cod === IT.sel ? 'sel' : ''}">
      <td class="nn">${esc(i.cod)}</td>
      <td><button type="button" class="sd-nome" data-cod="${esc(i.cod)}">${esc(i.descricao)}</button></td>
      <td class="num">${fmtQ(i.contratado)} ${esc(i.unidade)}</td>
      <td class="num">${fmtQ(i.q)} ${esc(i.unidade)}</td>
      <td class="num${i.saldo < 0 ? ' neg' : ''}">${fmtQ(i.saldo)} ${esc(i.unidade)}</td>
      <td><span class="sd-pct"><span class="sd-bar m"><i class="k-${i.sit}" style="width:${Math.min(100, Math.round(i.pct * 100))}%"></i><em></em></span><b class="k-${i.sit}">${Math.round(i.pct * 100)}%</b></span></td>
      <td><span class="sd-sit k-${i.sit}">${IT_SIT[i.sit].rot}</span></td></tr>`).join('') || '<tr><td colspan="7" class="vazio">Nenhum item nessa situação.</td></tr>';
  $$('#sd-lista .sd-nome').forEach(b => b.onclick = () => { IT.sel = b.dataset.cod; saldoDesenha(); });
  saldoDetalhe(L.find(i => i.cod === IT.sel));
}
function saldoDetalhe(i) {
  if (!i) { $('#sd-det').innerHTML = ''; return; }
  const anos = []; for (let a = 2020; a <= Math.max(2026, new Date().getFullYear()); a++) anos.push(a);
  const porAno = {}; anos.forEach(a => porAno[a] = 0);
  IT.mensal.filter(x => x.cod === i.cod).forEach(x => { const a = +String(x.mes).slice(0, 4); if (a in porAno) porAno[a] += Number(x.quantidade || 0); });
  IT.sis.filter(x => x.cod === i.cod && conta(x)).forEach(x => { const a = new Date(x.processos.criado_em).getFullYear(); if (a in porAno) porAno[a] += Number(x.quantidade || 0); });
  const mx = Math.max(1, ...Object.values(porAno));
  // projetos que usaram o item: os do Provius e os da planilha antiga (só consulta)
  const pj = IT.sis.filter(x => x.cod === i.cod && x.processos && !x.processos.cancelado).map(x => ({ num: x.processos.numero, desc: x.processos.logradouro, q: x.quantidade, quando: x.processos.criado_em, prov: true, emProjeto: x.processos.etapa < 2 }))
    .concat(IT.hist.filter(x => x.cod === i.cod).map(x => ({ num: x.numero, desc: x.descricao, q: x.quantidade, quando: x.data, prov: false })))
    .sort((a, b) => String(b.quando || '').localeCompare(String(a.quando || '')));
  $('#sd-det').innerHTML = `<h2>Item ${esc(i.cod)} <span class="sd-sit k-${i.sit}">${IT_SIT[i.sit].rot}</span></h2>
    <div class="sd-det-in">
      <h3>${esc(i.descricao)}</h3>
      <div class="sd-big k-${i.sit}">${Math.round(i.pct * 100)}%<small>do contratado</small></div>
      <div class="sd-nums">
        <div><span>Contratado</span><b>${fmtQ(i.contratado)} ${esc(i.unidade)}</b></div>
        <div><span>Consumido</span><b>${fmtQ(i.q)} ${esc(i.unidade)}</b></div>
        <div><span>Saldo</span><b class="${i.saldo < 0 ? 'neg' : ''}">${fmtQ(i.saldo)} ${esc(i.unidade)}</b></div>
        <div><span>Valor consumido</span><b>${fmtR(i.valor)}</b></div>
      </div>
      <p class="ajuda" style="margin:0">Planilha do contrato: ${fmtQ(i.base)} ${esc(i.unidade)} · projetos R- do Provius: ${fmtQ(i.sistema)} ${esc(i.unidade)} · preço unitário ${fmtR(i.preco)}</p>
      <div><h4>Consumo por ano</h4><div class="sd-anos">${anos.map(a => `<div><small>${porAno[a] ? fmtQ(porAno[a]) : ''}</small><i style="height:${porAno[a] ? Math.max(4, Math.round(80 * porAno[a] / mx)) : 2}px" class="${porAno[a] ? '' : 'z'}"></i><span>${a}</span></div>`).join('')}</div></div>
      <div><h4>Projetos R- que usaram o item</h4>${pj.length ? `<ul class="sd-pj">${pj.slice(0, 8).map(x => `<li><span><b>${esc(x.num)}</b>${x.prov ? (x.emProjeto ? ' <span class="pill dias">em projeto</span>' : '') : ' <span class="pill sd-ant">planilha</span>'}<small>${esc(x.desc || '')}</small></span><b>${fmtQ(x.q)} ${esc(i.unidade)}</b></li>`).join('')}</ul>${pj.length > 8 ? `<p class="ajuda" style="margin:6px 0 0">+ ${pj.length - 8} projetos mais antigos</p>` : ''}` : '<p class="ajuda" style="margin:0">Nenhum projeto R- usou este item.</p>'}</div>
      <p class="nota" style="margin:0">Os projetos marcados "planilha" são da planilha antiga de itens e servem só para consulta: o saldo usa a planilha oficial do contrato até a virada e, depois, os R- entregues no Provius. Um R- em projeto ainda não conta no saldo.</p>
    </div>`;
}

// ================= Tela 2 · bloco de itens do R- =================
const JI = { linhas: [], seq: 0, p: null };
function itensProjetoIniciar() {
  $('#j-additem').onclick = () => { const usados = new Set(JI.linhas.map(l => l.cod)); const livre = IT.cat.find(i => !usados.has(i.cod)); JI.linhas.push({ id: ++JI.seq, cod: (livre || IT.cat[0] || {}).cod, q: '' }); itensProjetoDesenha(); };
  $('#j-just').addEventListener('input', () => itensProjetoAvisos());
}
// chamado ao abrir um processo na Tela 2
async function itensProjeto(p) {
  const r = p.tipo === 'R';
  $('#j-sec-pot').hidden = r; $('#j-sec-mod').hidden = r;
  $('#j-aq-c').hidden = !r;
  $('#j-sec-itens').hidden = !r;
  JI.p = r ? p : null;
  if (!r) return;
  $('#j-aq').textContent = p.adquirido === true ? 'Adquirido · segue o fluxo normal' : p.adquirido === false ? 'Não adquirido · não passa pelo Cadastro nem vai à AGEMAN' : 'Não informado no croqui';
  if (!(await itensCarregar(true))) { $('#j-itens').innerHTML = '<tr><td colspan="7" class="vazio">Os itens de reequilíbrio ainda não estão no banco. Rode o arquivo provius-reequilibrio.sql no Supabase.</td></tr>'; $('#j-avisos').innerHTML = ''; return; }
  JI.linhas = IT.sis.filter(x => x.processo_id === p.id).map(x => ({ id: ++JI.seq, cod: x.cod, q: x.quantidade }));
  if (!JI.linhas.length) JI.linhas.push({ id: ++JI.seq, cod: (IT.cat[0] || {}).cod, q: '' });
  $('#j-just').value = p.itens_justificativa || '';
  itensProjetoDesenha();
}
function itensLer() { const o = {}; JI.linhas.forEach(l => { const q = Number(String(l.q).replace(',', '.')) || 0; if (l.cod && q > 0) o[l.cod] = (o[l.cod] || 0) + q; }); return o; }
function itensProjetoDesenha() {
  const R = {}; itensResumo(JI.p?.id).forEach(i => R[i.cod] = i);
  const soma = itensLer(), opc = IT.cat.map(i => [i.cod, i.cod + ' · ' + i.descricao]);
  $('#j-itens').innerHTML = JI.linhas.map(l => {
    const i = R[l.cod] || {}, dep = (i.q || 0) + (soma[l.cod] || 0), t = i.contratado || 0, sit = itSit(dep, t);
    return `<tr data-l="${l.id}"><td><select class="it-cod" aria-label="Item">${opc.map(([c, r]) => `<option value="${esc(c)}"${c === l.cod ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></td>
      <td class="num"><input type="number" min="0" step="any" class="it-q" value="${esc(l.q)}" aria-label="Quantidade"> <span class="ajuda">${esc(i.unidade || '')}</span></td>
      <td class="num">${fmtQ(i.saldo)} ${esc(i.unidade || '')}</td>
      <td class="num${t - dep < 0 ? ' neg' : ''}">${fmtQ(t - dep)} ${esc(i.unidade || '')}</td>
      <td class="num"><b class="sd-t k-${sit}">${t ? Math.round(dep / t * 100) : 0}%</b></td>
      <td><span class="sd-sit k-${sit}">${IT_SIT[sit].rot}</span></td>
      <td><button type="button" class="rem" aria-label="Remover item">×</button></td></tr>`;
  }).join('');
  $$('#j-itens tr[data-l]').forEach(tr => {
    const l = JI.linhas.find(x => x.id === +tr.dataset.l);
    tr.querySelector('.it-cod').onchange = e => { l.cod = e.target.value; itensProjetoDesenha(); };
    const q = tr.querySelector('.it-q'); q.onchange = e => { l.q = e.target.value; itensProjetoDesenha(); }; q.oninput = e => { l.q = e.target.value; };
    tr.querySelector('.rem').onclick = () => { JI.linhas = JI.linhas.filter(x => x !== l); itensProjetoDesenha(); };
  });
  const val = Object.entries(soma).reduce((a, [c, q]) => a + q * Number(IT.porCod[c]?.preco || 0), 0);
  $('#j-itval').textContent = fmtR(val);
  itensProjetoAvisos();
  if ($('#j-form').classList.contains('so-leitura')) $$('#j-sec-itens input, #j-sec-itens select, #j-sec-itens button, #j-sec-itens textarea').forEach(x => x.disabled = true);
}
// avisos de atenção e estouro com o lançamento atual
function itensAvisos() {
  const R = {}; itensResumo(JI.p?.id).forEach(i => R[i.cod] = i);
  return Object.entries(itensLer()).sort().map(([c, q]) => {
    const i = R[c]; if (!i) return null; const ant = itSit(i.q, i.contratado), dep = itSit(i.q + q, i.contratado);
    if (dep !== 'est' && dep !== 'ate') return null;
    const linha = `${fmtQ(i.q + q)} de ${fmtQ(i.contratado)} ${i.unidade} (${Math.round((i.q + q) / i.contratado * 100)}%)`;
    const tit = dep === 'est' ? (ant === 'est' ? `Item ${c} já está estourado` : `Item ${c} vai estourar`) : (ant === 'ate' ? `Item ${c} continua em atenção` : `Item ${c} passa para atenção`);
    return { cod: c, sit: dep, tit, txt: `${i.descricao}: com este projeto fica ${linha}.` + (dep === 'est' ? ' Precisa de justificativa para entregar.' : '') };
  }).filter(Boolean);
}
function itensProjetoAvisos() {
  const av = itensAvisos(), est = av.some(a => a.sit === 'est');
  $('#j-avisos').innerHTML = av.length ? av.map(a => `<div class="it-av k-${a.sit}"><b>${esc(a.tit)}</b><span>${esc(a.txt)}</span></div>`).join('') : (Object.keys(itensLer()).length ? '<div class="it-av k-nor"><span>Todos os itens continuam abaixo de 80% do contratado.</span></div>' : '');
  $('#j-just-c').hidden = !est;
  return { est, av };
}
// antes de salvar ou entregar um R-: confere e grava os itens. Devolve false se não pode seguir.
async function itensGravar(p, entregar) {
  if (p.tipo !== 'R') return true;
  if (SEM_ITENS) { toast('Os itens de reequilíbrio ainda não estão no banco. Rode o arquivo provius-reequilibrio.sql no Supabase.', true); return !entregar; }
  const itens = Object.entries(itensLer()).map(([cod, quantidade]) => ({ cod, quantidade }));
  const { est } = itensProjetoAvisos(), just = $('#j-just').value.trim();
  if (entregar && !itens.length) { toast('Lance pelo menos um item de reequilíbrio para entregar', true); return false; }
  if (entregar && est && !just) { $('#j-just').closest('.campo').classList.add('invalido'); toast('Preencha a justificativa do item estourado para entregar', true); return false; }
  $('#j-just').closest('.campo').classList.remove('invalido');
  await rpc('salvar_itens', { p_id: p.id, p_itens: itens, p_justificativa: est ? just : null });
  IT.carregadoEm = 0;
  return true;
}
