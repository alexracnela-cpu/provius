// PROVIUS · entrada, abas, visão geral, relatório e usuários
let TELA = 'todos';
const TELAS = {
  todos: { abrir: todosAbrir }, pedido: { abrir: pedidoAbrir, setor: 'Engenharia' }, projetos: { abrir: projetosAbrir, setor: 'Projetos' },
  exe: { abrir: execAbrir, setor: 'Engenharia' }, cad: { abrir: cadAbrir, setor: 'Cadastro' }, asb: { abrir: asbAbrir, setor: 'Projetos' }, saldo: { abrir: saldoAbrir, gerencia: true }, usuarios: { abrir: usuariosAbrir, admin: true }
};
const pode = t => { const x = TELAS[t]; if (!x || !EU) return false; if (x.admin) return EU.admin; if (x.gerencia) return EU.admin || EU.setor === 'Gerência'; /* Saldo de Itens: só administrador e gerência */ return !x.setor || EU.admin || EU.setor === x.setor; };

// ---------- tema ----------
function temaAtual() { const t = document.documentElement.dataset.theme; return t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
function pintaTema() { const b = $('#tema'), d = temaAtual() === 'dark'; b.textContent = d ? '☀' : '☾'; b.title = d ? 'Mudar para modo claro' : 'Mudar para modo escuro'; b.setAttribute('aria-label', b.title); }
$('#tema').onclick = () => { const n = temaAtual() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { localStorage.setItem('provius-tema', n) } catch (e) { } pintaTema(); };

// ---------- telas de acesso ----------
function mostra(id) { ['#tela-login', '#tela-senha', '#tela-aviso', '#app'].forEach(s => $(s).hidden = s !== id); }
function aviso(t, sair) { $('#aviso-txt').textContent = t; $('#aviso-sair').hidden = !sair; mostra('#tela-aviso'); }
$('#aviso-sair').onclick = async () => { await sb.auth.signOut(); history.replaceState(null, '', location.pathname); mostra('#tela-login'); };
$('#f-login').onsubmit = async e => {
  e.preventDefault(); const er = $('#l-erro'); er.hidden = true;
  const email = $('#l-email').value.trim().toLowerCase(), senha = $('#l-senha').value;
  if (!email || !senha) { er.textContent = 'Informe o email e a senha.'; er.hidden = false; return; }
  ocupado(true); const { error } = await sb.auth.signInWithPassword({ email, password: senha }); ocupado(false);
  if (error) { er.textContent = /Invalid login/i.test(error.message) ? 'Email ou senha incorretos.' : msgErro(error); er.hidden = false; return; }
  entrar();
};
$('#l-esqueci').onclick = () => { $('#l-dica').hidden = false; };
function telaSenha(tipo, email) {
  $('#s-tit').textContent = tipo === 'trocar' ? 'Trocar minha senha' : tipo === 'primeiro' ? 'Bem-vindo(a) ao Provius! Crie sua senha' : 'Crie uma nova senha';
  let v = $('#s-voltar'); if (!v) { v = document.createElement('button'); v.type = 'button'; v.id = 's-voltar'; v.className = 'link-pdf'; v.style.alignSelf = 'center'; v.textContent = 'Voltar'; v.onclick = () => mostra('#app'); $('#f-senha').appendChild(v); }
  v.hidden = tipo !== 'trocar'; $('#s-erro').hidden = true;
  if (tipo === 'primeiro') email = (email || '') + ' · você entrou com uma senha provisória';
  $('#s-quem').textContent = email || ''; $('#s1').value = ''; $('#s2').value = ''; senhaRegras(); mostra('#tela-senha');
}
function senhaRegras() { const a = $('#s1').value, b = $('#s2').value, r = { len: a.length >= 8, let: /[a-zA-ZÀ-ú]/.test(a), num: /\d/.test(a), eq: !!a && a === b }; $$('#s-regras li').forEach(li => li.classList.toggle('ok', r[li.dataset.r])); $('#s-ok').disabled = !Object.values(r).every(Boolean); }
['#s1', '#s2'].forEach(s => $(s).addEventListener('input', senhaRegras));
$('#f-senha').onsubmit = async e => {
  e.preventDefault(); if ($('#s-ok').disabled) return; ocupado(true);
  const { error } = await sb.auth.updateUser({ password: $('#s1').value }); ocupado(false);
  if (error) { $('#s-erro').textContent = msgErro(error); $('#s-erro').hidden = false; return; }
  history.replaceState(null, '', location.pathname); if ($('#s-voltar') && !$('#s-voltar').hidden) { mostra('#app'); toast('Senha trocada'); return; } toast('Senha criada'); entrar(true);
};
$('#sair').onclick = async () => { await travaLiberar(); await sb.auth.signOut(); location.reload(); };
$('#trocar-senha').onclick = () => telaSenha('trocar', EU?.email);

async function entrar(senhaOk) {
  try { EU = await rpc('registrar_acesso', { p_senha_ok: !!senhaOk }); }
  catch (e) { aviso(e.message, true); return; }
  if (!EU.senha_ok) { telaSenha('primeiro', EU.email); return; }
  $('#u-eu').innerHTML = `<b>${esc(EU.nome)}</b> · ${esc(EU.setor)}`;
  $$('#abas .aba').forEach(a => a.hidden = !pode(a.dataset.tela));
  mostra('#app'); pintaTema();
  const { data: b } = await sb.from('bairros').select('*'); BAIRROS = {}; (b || []).forEach(x => BAIRROS[x.nome] = x.zona);
  await recarregar(); itensCarregar().catch(e => console.error(e));   // selo da aba Saldo de Itens
  const inicial = ({ Engenharia: 'exe', Projetos: 'projetos', Cadastro: 'cad' })[EU.setor] || 'todos';
  abrirTela(TELA_HASH() || inicial);
}
const TELA_HASH = () => { const h = location.hash.replace('#', ''); return TELAS[h] && pode(h) ? h : null; };

// ---------- dados ----------
const COLS = 'id,numero,tipo,ano,etapa,etapa_desde,cancelado,tipo_servico,ref_pedido,croqui_recebido,logradouro,bairro,zona,total_pontos,potencias,mod_cv,mod_mod,mod_dest,entregue_execucao,enviado_ageman,devolvido,criado_em';
let SEM_URG = false;    // banco ainda sem a coluna urgente: o sistema funciona sem ela
const COLS_TRAVA = ',editando_por,editando_nome,editando_desde,editando_em';
async function recarregar() {
  let todos = [], de = 0; const N = 1000;
  for (; ;) {
    const { data, error } = await sb.from('processos').select(COLS + (SEM_URG ? '' : ',urgente') + (SEM_TRAVA ? '' : COLS_TRAVA)).order('id').range(de, de + N - 1);
    if (error) { if (!SEM_URG && /urgente/.test(error.message || '')) { SEM_URG = true; todos = []; de = 0; continue; }
      if (!SEM_TRAVA && /editando_/.test(error.message || '')) { SEM_TRAVA = true; todos = []; de = 0; continue; } toast(msgErro(error), true); break; }
    todos = todos.concat(data); if (data.length < N) break; de += N; }
  D = todos.map(normMP); if (TELA === 'todos' && !$('#tela-todos').hidden) todosDesenha();
}
function abrirTela(t, recarregou) {
  if (!pode(t)) t = 'todos'; if (t !== 'projetos') travaLiberar(); TELA = t;
  $$('#abas .aba').forEach(a => a.setAttribute('aria-selected', a.dataset.tela === t));
  Object.keys(TELAS).forEach(k => $('#tela-' + k).hidden = k !== t);
  try { history.replaceState(null, '', '#' + t); } catch (e) { }
  if (!recarregou) window.scrollTo(0, 0);
  TELAS[t].abrir();
}
$$('#abas .aba').forEach(a => a.onclick = () => abrirTela(a.dataset.tela));
window.addEventListener('hashchange', () => { const t = TELA_HASH(); if (t && t !== TELA) abrirTela(t); });

// ---------- visão geral ----------
const ORDEM = ['Engenharia', 'Projetos', 'Cadastro', 'Pronto p/ AGEMAN', 'Concluído', 'Cancelado'];
const COR_SETOR = { Engenharia: 'Engenharia', Projetos: 'Projetos', Cadastro: 'Cadastro', 'Pronto p/ AGEMAN': 'pronto', 'Concluído': 'fim', Cancelado: 'canc' };
function grupo(d) { return d.cancelado ? 'Cancelado' : d.etapa === 6 ? 'Concluído' : d.etapa === 5 ? 'Pronto p/ AGEMAN' : ETAPAS[d.etapa].setor; }
let fEtapa = null, vista = 'lista', pag = 0; const POR = 50; let todosPronto = false;
function todosAbrir() {
  if (!todosPronto) {
    todosPronto = true;
    const anos = [...new Set(D.map(d => d.ano))].sort((a, b) => b - a);
    $('#f-ano').innerHTML = '<option value="*">Todos</option>' + anos.map(a => `<option>${a}</option>`).join('');
    $('#f-etapa').innerHTML = '<option value="*">Todas</option><option value="aberto" selected>Em andamento</option>' + [1, 2, 3, 4, 5, 6].map(e => `<option value="${e}">${ETAPAS[e].setor} · ${ETAPAS[e].nome}</option>`).join('') + '<option value="canc">Cancelados</option>';
    ['#f-busca', '#f-ano', '#f-tipo', '#f-etapa', '#f-zona', '#f-ordem'].forEach(s => $(s).addEventListener('input', () => { pag = 0; if (s === '#f-etapa') { const v = $('#f-etapa').value; fEtapa = /^\d$/.test(v) ? +v : null; } todosDesenha(); }));
    $('#v-quadro').onclick = () => muda('quadro'); $('#v-lista').onclick = () => muda('lista');
    $('#pag-ant').onclick = () => { if (pag > 0) { pag--; lista(); } }; $('#pag-prox').onclick = () => { pag++; lista(); };
    $('#recarregar').onclick = () => tarefa(recarregar, 'Atualizado');
  }
  todosDesenha();
}
function todosDesenha() { esteira(); quadro(); lista(); muda(vista); }
function muda(v) { vista = v; $('#v-quadro').setAttribute('aria-pressed', v === 'quadro'); $('#v-lista').setAttribute('aria-pressed', v === 'lista'); $('#vista-quadro').hidden = v !== 'quadro'; $('#vista-lista').hidden = v !== 'lista';
  const ab = D.filter(d => d.etapa < 6 && !d.cancelado); $('#t-resumo').textContent = v === 'quadro' ? `${ab.length} processos em andamento · ${fmt(ab.reduce((a, d) => a + d.total_pontos, 0))} pontos` : ''; }
function esteira() {
  const COR = { 1: 'Projetos', 2: 'Engenharia', 3: 'Cadastro', 4: 'Projetos', 5: 'pronto', 6: 'fim' }, ano = new Date().getFullYear();
  $('#esteira').innerHTML = [1, 2, 3, 4, 5, 6].map(e => { const it = D.filter(d => d.etapa === e && !d.cancelado && (e < 6 || d.ano === ano)); const p = it.reduce((a, d) => a + d.total_pontos, 0);
    return `<button type="button" class="est s-${COR[e]}${e === 6 ? ' fim' : ''}" data-e="${e}" aria-pressed="${fEtapa === e}"><span class="setor">${ETAPAS[e].setor}</span><span class="nome">${ETAPAS[e].nome}${e === 6 ? ' em ' + ano : ''}</span><span class="qtd">${fmt(it.length)}</span><span class="pts">${fmt(p)} pontos</span></button>`; }).join('');
  $$('.est').forEach(b => b.onclick = () => { const e = +b.dataset.e; fEtapa = fEtapa === e ? null : e; $('#f-etapa').value = fEtapa === null ? 'aberto' : String(fEtapa); $('#f-ano').value = fEtapa === 6 ? String(ano) : '*'; pag = 0; esteira(); lista(); muda('lista'); });
}
function quadro() {
  const COR = { 1: 'Projetos', 2: 'Engenharia', 3: 'Cadastro', 4: 'Projetos', 5: 'pronto' };
  $('#quadro').innerHTML = [1, 2, 3, 4, 5].map(e => { const it = filaDe(e);
    return `<div class="col s-${COR[e]}"><h3><span><small>${ETAPAS[e].setor}</small>${ETAPAS[e].nome}</span><b>${it.length}</b></h3><div class="cartoes">${it.map(d => `<button type="button" class="cartao t-${d.tipo || 'X'}${d.urgente ? ' urgente' : ''}" data-id="${d.id}"><span class="n">${esc(d.numero)}</span>${seloUrg(d)}<span class="l">${esc(d.logradouro)}</span><span class="m"><span>${esc(d.bairro || '')}</span><span>${d.total_pontos} pts</span></span></button>`).join('') || '<span class="vazio" style="padding:4px">Nada parado aqui.</span>'}</div></div>`; }).join('');
  $$('#quadro .cartao').forEach(c => c.onclick = () => detalhe(+c.dataset.id));
}
function ordem() { const o = $('#f-ordem').value, rec = (x, y) => y.ano - x.ano || y.numero.localeCompare(x.numero);
  if (o === 'setor') return (x, y) => ORDEM.indexOf(grupo(x)) - ORDEM.indexOf(grupo(y)) || x.etapa - y.etapa || rec(x, y);
  if (o === 'pontos') return (x, y) => y.total_pontos - x.total_pontos || rec(x, y); return rec; }
function filtrados() {
  const q = $('#f-busca').value.trim().toUpperCase(), a = $('#f-ano').value, t = $('#f-tipo').value, et = $('#f-etapa').value, z = $('#f-zona').value;
  return D.filter(d => (a === '*' || d.ano === +a) && (t === '*' || (d.tipo || '') === t) && (z === '*' || d.zona === z) &&
    (et === '*' || (et === 'aberto' ? d.etapa < 6 && !d.cancelado : et === 'canc' ? d.cancelado : d.etapa === +et && !d.cancelado)) &&
    (!q || d.numero.includes(q) || (d.logradouro || '').includes(q) || (d.bairro || '').includes(q))).sort(ordem());
}
const CURTO = ['Croqui', 'Projeto', 'Execução', 'Emplaquetamento', 'As built', 'AGEMAN'];
function trilha(d) {
  if (d.cancelado) return `<div class="trilha"><span class="tp feito"><i></i><em>Croqui</em></span><span class="tp canc"><i></i><em>Cancelado</em></span>${'<span class="tp nada"><i></i><em>-</em></span>'.repeat(4)}</div>`;
  return `<div class="trilha">${CURTO.map((t, i) => { let c = 'pend'; if (d.etapa === 6) c = i === 5 ? 'fim' : 'feito'; else if (i < d.etapa) c = 'feito'; else if (i === d.etapa) c = 'agora'; return `<span class="tp ${c}" title="${t}"><i></i><em>${i === 5 && d.etapa === 6 ? (d.enviado_ageman ? 'Enviado' : 'Concluído') : t}</em></span>`; }).join('')}</div>`;
}
function frase(d) {
  if (d.cancelado) return '<span class="quem">Cancelado</span><span>Projeto cancelado.</span>';
  if (d.so_desenho) return '<span class="quem">Concluído</span><span>MP- só desenho (sem as built e sem AGEMAN).</span>';
  if (d.etapa === 6 && d.tipo === 'R' && !d.enviado_ageman) return '<span class="quem">Concluído</span><span>Concluído em Projetos (R- não adquirido, não vai à AGEMAN).</span>';
  if (d.etapa === 6) return `<span class="quem">Concluído</span><span>Enviado à AGEMAN${d.enviado_ageman ? ' em <strong>' + dataBR(d.enviado_ageman) + '</strong>' : ''}.</span>`;
  if (d.etapa === 5) return '<span class="quem">Projetos</span><span>Pronto. Aguardando envio à AGEMAN.</span>';
  const dd = diasDesde(d.etapa_desde);
  return `<span class="quem">${ETAPAS[d.etapa].setor}</span><span>${d.devolvido ? '<strong>Devolvido</strong> · ' : ''}${ETAPAS[d.etapa].nome}${dd !== null ? ' · há <strong>' + dd + ' dias</strong>' : ''}</span>`;
}
const setorCls = d => d.cancelado ? 'canc' : d.etapa === 6 ? 'fim' : d.etapa === 5 ? 'pronto' : ETAPAS[d.etapa].setor;
function cardP(d) { return `<button type="button" class="pcard s-${setorCls(d)}" data-id="${d.id}"><span class="top"><b>${esc(d.numero)}</b><span class="lg">${esc(d.logradouro)} · ${esc(d.bairro || '')}</span></span><span class="dir"><span class="pts">${d.total_pontos}<small>pts</small></span>${d.tipo_servico ? '<span class="sv">' + esc(d.tipo_servico) + '</span>' : ''}</span>${trilha(d)}<span class="txt">${frase(d)}</span></button>`; }
function lista() {
  const f = filtrados(), tp = Math.max(1, Math.ceil(f.length / POR)); if (pag >= tp) pag = tp - 1; const pg = f.slice(pag * POR, pag * POR + POR);
  const porSetor = $('#f-ordem').value === 'setor'; let g0 = null; const tot = {}; if (porSetor) f.forEach(d => { const g = grupo(d); tot[g] = (tot[g] || 0) + 1; });
  $('#lista').innerHTML = pg.map(d => { let h = ''; if (porSetor) { const g = grupo(d); if (g !== g0) { g0 = g; h = `<div class="grp-cab s-${COR_SETOR[g]}"><span>${g}</span><b>${tot[g]}</b></div>`; } } return h + cardP(d); }).join('') || '<p class="vazio">Nenhum projeto com esses filtros.</p>';
  $('#pag-info').textContent = `${fmt(f.length)} projetos · ${fmt(f.reduce((a, d) => a + d.total_pontos, 0))} pontos · página ${pag + 1} de ${tp}`;
  $('#pag-ant').disabled = pag === 0; $('#pag-prox').disabled = pag >= tp - 1;
  $$('#lista .pcard').forEach(r => r.onclick = () => detalhe(+r.dataset.id));
}
const ROT_ARQ = { pedido: 'Pedido', croqui: 'Croqui', projeto: 'Projeto', correcoes: 'Correções de campo', plaquetas: 'As built com plaqueta', asbuilt: 'As built final' };
async function detalhe(id) {
  const p = await tarefa(() => carregarProcesso(id)); if (!p) return;
  $('#det-tit').textContent = p.numero + (p.cancelado ? ' · CANCELADO' : '');
  const info = [...(p.tipo === 'R' ? [['Aquisição', p.adquirido === true ? 'Adquirido' : p.adquirido === false ? 'Não adquirido' : '—']] : []), ['Serviço', p.tipo_servico || '—'], ['Logradouro', p.logradouro], ['Bairro / zona', (p.bairro || '') + ' · ' + (p.zona || '')], ['Pontos', p.total_pontos], ['Encaminhamento', p.ref_pedido || '—'], ['Etapa', p.cancelado ? 'Cancelado' : p.so_desenho ? 'Concluído (MP- só desenho, sem as built)' : p.etapa === 6 ? (p.enviado_ageman ? 'Enviado à AGEMAN em ' + dataBR(p.enviado_ageman) : 'Concluído em Projetos') : ETAPAS[p.etapa].setor + ' · ' + ETAPAS[p.etapa].nome]].map(([k, v]) => `<div><span class="ajuda">${k}</span><br><b>${esc(v)}</b></div>`).join('');
  const passos = `<ol class="passos">${[1, 2, 3, 4, 5, 6].map(e => `<li class="${p.cancelado ? '' : e < p.etapa || (e === 6 && p.etapa === 6) ? 'feito' : e === p.etapa ? 'agora' : ''}"><span><b>${ETAPAS[e].setor} · ${ETAPAS[e].nome}</b><small>${e === p.etapa && e < 6 && !p.cancelado ? 'está aqui desde ' + dataBR(p.etapa_desde) : ''}</small></span></li>`).join('')}</ol>`;
  const arqs = p.arquivos.length ? `<div class="arq-lista" style="padding:0">${p.arquivos.map(a => `<button type="button" data-a="${a.id}"><b>${/\.pdf$/i.test(a.caminho) ? 'PDF' : 'FOTO'}</b>${esc(ROT_ARQ[a.tipo] || a.tipo)} · ${esc(a.nome || '')}<small>${esc(a.por_nome || '')} · ${dataBR(a.em)}</small></button>`).join('')}</div>` : '<p class="ajuda" style="margin:0">Sem arquivos (processo do histórico da planilha).</p>';
  const hist = p.movimentos.length ? `<ul class="hist" style="padding:0">${p.movimentos.map(m => `<li><span>${dataBR(m.em)}</span><b style="font-weight:500">${esc(m.por_nome || '')}: ${esc(textoMov(m))}</b></li>`).join('')}</ul>` : '<p class="ajuda" style="margin:0">Sem movimentos registrados (histórico da planilha).</p>';
  $('#det-corpo').innerHTML = `<div class="resumo" style="padding:0">${info}</div>${p.cancelado ? `<p class="faixa-dev" style="margin:0"><b>CANCELADO</b> · ${esc(p.cancel_motivo || '')}${p.cancel_texto ? ': ' + esc(p.cancel_texto) : ''}</p>` : passos}<div class="det-sec"><h4>Arquivos</h4>${arqs}</div><div class="det-sec"><h4>Histórico</h4>${hist}</div>`;
  $$('#det-corpo [data-a]').forEach(b => b.onclick = () => verArquivo(p.arquivos.find(a => String(a.id) === b.dataset.a), p.numero));
  const bt = $('#det-abrir'); const aba = !p.cancelado && p.etapa < 6 ? ETAPAS[p.etapa].aba : null;
  if (p.cancelado && (EU.admin || EU.setor === 'Projetos')) { bt.hidden = false; bt.textContent = 'Reativar processo'; bt.onclick = async () => { const r = await tarefa(() => rpc('reativar', { p_id: p.id }).then(() => true), 'Processo reativado'); if (r) { fechaModal('#modal-det'); await recarregar(); } }; }
  else if (aba && pode(aba)) { bt.hidden = false; bt.textContent = 'Abrir na fila de ' + ETAPAS[p.etapa].setor + ' →'; bt.onclick = () => { fechaModal('#modal-det'); TELA = aba; abrirTela(aba); const f = { projetos: projetosAbrir, exe: execAbrir, cad: cadAbrir, asb: asbAbrir }[aba]; if (f && p.etapa < 5) f(p.id); }; }
  else bt.hidden = true;
  abreModal('#modal-det');
}

// ---------- relatório ----------
let RL = { bytes: null, visor: null, tk: 0 };
function relAbrir() {
  const anos = [...new Set(D.map(d => d.ano))].sort((a, b) => b - a);
  $('#rl-ano').innerHTML = '<option value="*">Todos</option>' + anos.map(a => `<option>${a}</option>`).join('');
  const cont = {}; D.forEach(d => { const g = grupo(d); cont[g] = (cont[g] || 0) + 1; });
  $('#rl-setores').innerHTML = ORDEM.map(g => `<label><input type="checkbox" value="${g}" ${['Concluído', 'Cancelado'].includes(g) ? '' : 'checked'}> ${g}<small>${fmt(cont[g] || 0)}</small></label>`).join('');
  $$('#rl-setores input').forEach(i => i.onchange = () => { relTodos(); relGera(); }); relTodos(); abreModal('#modal-rel'); relGera();
}
function relTodos() { const all = $$('#rl-setores input'); $('#rl-todos').checked = all.every(i => i.checked); $('#rl-todos').indeterminate = !$('#rl-todos').checked && all.some(i => i.checked); }
function relSel() {
  const set = new Set($$('#rl-setores input:checked').map(i => i.value)), a = $('#rl-ano').value, usa = $('#rl-filtros').checked;
  const q = $('#f-busca').value.trim().toUpperCase(), t = $('#f-tipo').value, z = $('#f-zona').value;
  return D.filter(d => set.has(grupo(d)) && (a === '*' || d.ano === +a) && (!usa || ((t === '*' || (d.tipo || '') === t) && (z === '*' || d.zona === z) && (!q || d.numero.includes(q) || (d.logradouro || '').includes(q) || (d.bairro || '').includes(q)))))
    .sort((x, y) => ORDEM.indexOf(grupo(x)) - ORDEM.indexOf(grupo(y)) || x.etapa - y.etapa || y.ano - x.ano || y.numero.localeCompare(x.numero));
}
async function relGera() {
  const tk = ++RL.tk, sel = relSel(); $('#rl-info').textContent = `${fmt(sel.length)} projetos · ${fmt(sel.reduce((a, d) => a + d.total_pontos, 0))} pontos`;
  if (!sel.length) { RL.bytes = null; RL.visor.limpa(); $('#rl-info').textContent = 'Escolha pelo menos um setor.'; return; }
  const r = await gerarRelatorio(sel, $$('#rl-setores input:checked').map(i => i.value), $('#rl-ano').value === '*' ? 'todos os anos' : $('#rl-ano').value);
  if (tk !== RL.tk) return; RL.bytes = r.bytes; $('#rl-info').textContent += ` · ${r.paginas} página${r.paginas > 1 ? 's' : ''}`; RL.visor.abrir(r.bytes, 'relatorio.pdf');
}
function relIniciar() {
  RL.visor = criaVisor({ area: '#rl-area', canvas: '#rl-cv', pags: '#rl-pags', pinfo: '#rl-pinfo', pant: '#rl-pant', ppro: '#rl-ppro' });
  $('#btn-rel').onclick = relAbrir;
  $('#rl-todos').onchange = e => { $$('#rl-setores input').forEach(i => i.checked = e.target.checked); relTodos(); relGera(); };
  $('#rl-ano').onchange = relGera; $('#rl-filtros').onchange = relGera;
  $('#rl-pdf').onclick = () => { if (!RL.bytes) { toast('Escolha pelo menos um setor', true); return; } abrirBlob(new Blob([RL.bytes], { type: 'application/pdf' })); };
  $('#rl-xlsx').onclick = () => { const sel = relSel(); if (!sel.length) { toast('Escolha pelo menos um setor', true); return; } baixarBlob('acompanhamento-projetos-' + hojeISO() + '.xlsx', geraXlsx(CAB_PLAN, sel.map(linhaPlanilha))); };
}

// ---------- usuários (administrador) ----------
let USU = [];
async function usuariosAbrir() {
  const { data, error } = await sb.from('perfis').select('*').order('nome'); if (error) { toast(msgErro(error), true); return; } USU = data || [];
  const st = u => !u.ativo ? 'off' : u.senha_ok ? 'ativo' : (u.convite_expira && new Date(u.convite_expira) < new Date() ? 'exp' : 'pend');
  $('#u-lista').innerHTML = USU.map(u => { const s = st(u);
    const sit = s === 'ativo' ? '<span class="st ativo">Ativo</span>' : s === 'pend' ? `<span class="st pend">Aguardando primeiro acesso</span><br><small class="ajuda">senha provisória vale até ${dataHora(u.convite_expira)}</small>` : s === 'exp' ? `<span class="st exp">Senha provisória vencida</span><br><small class="ajuda">venceu ${dataHora(u.convite_expira)}</small>` : '<span class="st off">Desativado</span>';
    const sel = `<select data-setor="${u.id}" aria-label="Setor de ${esc(u.nome)}" style="width:auto;padding:4px 6px">${['Engenharia', 'Projetos', 'Cadastro', 'Gerência'].map(x => `<option${x === u.setor ? ' selected' : ''}>${x}</option>`).join('')}</select>`;
    const ac = u.id === EU.id ? '<span class="ajuda">você</span>' : (s === 'off' ? `<button class="btn mini" data-a="on" data-id="${u.id}">Reativar</button>` : `<button class="btn mini${s === 'exp' ? ' pri' : ''}" data-a="senha" data-id="${u.id}">Nova senha provisória</button><button class="btn mini" data-a="off" data-id="${u.id}">Desativar</button>`);
    return `<tr><td class="u-nome"><b>${esc(u.nome)}${u.admin ? ' <span class="pill dias" style="margin:0 0 0 4px">Admin</span>' : ''}</b><small>${esc(u.email)}</small></td><td>${u.id === EU.id ? esc(u.setor) : sel}</td><td>${sit}</td><td>${u.ultimo_acesso ? dataHora(u.ultimo_acesso) : '—'}</td><td><div class="u-acoes">${ac}</div></td></tr>`; }).join('');
  const at = USU.filter(u => st(u) === 'ativo').length, pe = USU.filter(u => ['pend', 'exp'].includes(st(u))).length;
  $('#u-cont').textContent = `${at} ativo${at === 1 ? '' : 's'} · ${pe} aguardando primeiro acesso`;
  $$('#u-lista [data-setor]').forEach(s => s.onchange = () => tarefa(() => rpc('admin_alterar_perfil', { p_id: s.dataset.setor, p_setor: s.value, p_ativo: null }), 'Setor alterado'));
  $$('#u-lista button[data-a]').forEach(b => b.onclick = async () => { const u = USU.find(x => x.id === b.dataset.id);
    if (b.dataset.a === 'senha') { const r = await tarefa(() => acesso({ acao: 'nova_senha', email: u.email })); if (r) mostraSenha(u.nome, r); }
    else await tarefa(() => rpc('admin_alterar_perfil', { p_id: u.id, p_setor: null, p_ativo: b.dataset.a === 'on' }), b.dataset.a === 'on' ? u.nome + ' reativado' : u.nome + ' não consegue mais entrar');
    usuariosAbrir(); });
}
async function acesso(corpo) {
  const { data, error } = await sb.functions.invoke('convidar', { body: corpo });
  if (error) { let m = error.message; try { const j = await error.context.json(); m = j.erro || m; } catch (e) { } throw new Error(/Failed to send|not found|404/i.test(m) ? 'A função "convidar" ainda não foi publicada no Supabase.' : m); }
  if (data && data.erro) throw new Error(data.erro); return data;
}
function mostraSenha(nome, r) {
  const site = location.origin + location.pathname;
  $('#ms-nome').textContent = nome; $('#ms-exp').textContent = dataHora(r.expira);
  $('#ms-txt').value = `Olá, ${nome.split(' ')[0]}! Seu acesso ao Provius (gestão de projetos) foi criado.\n\nSite: ${site}\nEmail: ${r.email}\nSenha provisória: ${r.senha}\n\nA senha provisória vale até ${dataHora(r.expira)}. No primeiro acesso você vai criar a sua própria senha.`;
  abreModal('#modal-senha');
}
$('#ms-copiar').onclick = () => { const t = $('#ms-txt'); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => toast('Mensagem copiada'), () => { t.select(); toast('Selecionado: use Ctrl+C'); }); };
function usuariosIniciar() {
  const abre = v => { $('#u-sec').hidden = !v; $('#u-novo').hidden = v; $('#u-erro').hidden = true; if (v) $('#u-nome').focus(); else $('#u-form').reset(); };
  $('#u-novo').onclick = () => abre(true); $('#u-cancelar').onclick = () => abre(false);
  $('#u-form').onsubmit = async e => {
    e.preventDefault(); const nome = $('#u-nome').value.trim(), email = $('#u-email').value.trim().toLowerCase(), setor = $('#u-setor').value, er = $('#u-erro');
    let msg = ''; if (!nome) msg = 'Informe o nome.'; else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) msg = 'Esse email não parece válido.'; else if (!setor) msg = 'Escolha o setor.';
    er.hidden = !msg; er.textContent = msg; if (msg) return;
    const r = await tarefa(() => acesso({ acao: 'criar', nome, email, setor }));
    if (r) { abre(false); usuariosAbrir(); mostraSenha(nome, r); }
  };
}

// ---------- início ----------
$('#dv-ok').onclick = confirmaDevolver; $('#c-ok').onclick = confirmaCancelar;
(async function iniciar() {
  pintaTema();
  if (!CONFIGURADO) { aviso('O Provius ainda não foi ligado ao banco de dados. Preencha o arquivo assets/config.js com os dados do Supabase.'); return; }
  pedidoIniciar(); projetosIniciar(); execIniciar(); cadIniciar(); asbIniciar(); relIniciar(); usuariosIniciar(); saldoIniciar();
  const erroLink = /error_code=([^&]+)/.exec(HASH0)?.[1], tipoLink = /type=(invite|recovery|signup|magiclink)/.exec(HASH0)?.[1];
  if (erroLink) { history.replaceState(null, '', location.pathname); aviso(/expired/.test(erroLink) ? 'Este link venceu. Peça ao administrador um novo convite (ou use "Esqueci a senha").' : 'O link não é mais válido. Peça um novo convite ao administrador.', true); return; }
  sb.auth.onAuthStateChange((ev, ses) => { if (ev === 'PASSWORD_RECOVERY') telaSenha('recovery', ses?.user?.email); });
  const { data: { session } } = await sb.auth.getSession();
  if (session && (tipoLink === 'invite' || tipoLink === 'recovery')) { telaSenha(tipoLink, session.user.email); return; }
  if (session) entrar(); else mostra('#tela-login');
})();
