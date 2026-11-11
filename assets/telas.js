// PROVIUS · telas de trabalho de cada setor

// ================= 1 · PEDIDO (Engenharia) =================
const PED = { prox: {} };
function pedidoIniciar() {
  caixaPdf('#p-arq-croqui', '#p-up-croqui'); caixaPdf('#p-arq-ped', '#p-up-ped');
  $('#p-bairro').onchange = () => { const z = BAIRROS[$('#p-bairro').value]; $('#p-zona').textContent = z || 'escolha o bairro'; $('#p-zona').classList.toggle('on', !!z); };
  $$('input[name=tipo]').forEach(r => r.onchange = () => { pedidoNumero(); $('#p-aq-c').hidden = $('input[name=tipo]:checked').value !== 'R'; });
  $('#f-ped').onsubmit = async e => {
    e.preventDefault(); $$('#f-ped .campo').forEach(c => c.classList.remove('invalido'));
    const falta = [];
    if (!$('#p-origem').value) { falta.push('origem'); $('#p-origem').closest('.campo').classList.add('invalido'); }
    if (!$('#p-logr').value.trim()) { falta.push('logradouro'); $('#p-logr').closest('.campo').classList.add('invalido'); }
    if (!$('#p-bairro').value) { falta.push('bairro'); $('#p-bairro').closest('.campo').classList.add('invalido'); }
    const croq = $('#p-up-croqui')._arqs[0]; if (!croq) { falta.push('croqui'); $('#p-up-croqui')._erro('Anexe o croqui em PDF.'); }
    const ehR = $('input[name=tipo]:checked').value === 'R', aq = $('input[name=p-aq]:checked')?.value;
    if (ehR && !aq) { falta.push('adquirido ou não adquirido'); $('#p-aq-c').classList.add('invalido'); }
    if (falta.length) { toast('Faltam: ' + falta.join(', '), true); return; }
    const r = await tarefa(async () => {
      const pasta = 'novos/' + hojeISO().slice(0, 7);
      const c = await enviarArquivo(pasta, 'croqui', croq);
      const pd = $('#p-up-ped')._arqs[0] ? await enviarArquivo(pasta, 'pedido', $('#p-up-ped')._arqs[0]) : null;
      return rpc('novo_processo', { p: {
        tipo: $('input[name=tipo]:checked').value, origem: $('#p-origem').value, ref_pedido: $('#p-ref').value.trim(), data_pedido: $('#p-data').value,
        solicitante: $('#p-solic').value.trim(), logradouro: $('#p-logr').value.trim(), tipo_logradouro: $('#p-tlogr').value, bairro: $('#p-bairro').value,
        referencia: $('#p-refer').value.trim(), ja_executado: $('input[name=p-exec]:checked').value === 'sim', obs: $('#p-obs').value.trim(), croqui: c, pedido: pd } });
    });
    if (!r) return;
    const urg = $('input[name=p-urg]:checked').value === 'sim';
    const idNovo = (urg || ehR) ? (r.id ?? (await sb.from('processos').select('id').eq('numero', r.numero).single()).data?.id) : null;
    if (urg) await marcarUrgente(idNovo, true);
    if (ehR) await marcarAquisicao(idNovo, aq === 'sim');
    toast('Processo ' + r.numero + (urg ? ' (URGENTE)' : '') + ' cadastrado e entregue para Projetos');
    $('#f-ped').reset(); $('#p-aq-c').hidden = true; $('#p-aq-c').classList.remove('invalido'); $('#p-up-croqui')._limpa(); $('#p-up-ped')._limpa(); $('#p-zona').textContent = 'escolha o bairro'; $('#p-zona').classList.remove('on'); $('#p-data').value = hojeISO();
    await recarregar(); pedidoNumero();
  };
}
// urgência: gravada por função própria no banco (fica registrada no histórico)
async function marcarUrgente(id, urg) {
  if (!id) return false;
  try { await rpc('marcar_urgente', { p_id: id, p_urgente: !!urg }); return true; }
  catch (e) { console.error(e); toast('Não consegui gravar a urgência. Falta rodar o SQL provius-urgente.sql no Supabase.', true); return false; }
}
// R-: adquirido ou não adquirido (define se o processo passa pelo Cadastro e vai à AGEMAN)
async function marcarAquisicao(id, adquirido) {
  if (!id) return false;
  try { await rpc('marcar_aquisicao', { p_id: id, p_adquirido: !!adquirido }); return true; }
  catch (e) { console.error(e); toast('Não consegui gravar se é adquirido. Falta rodar o SQL provius-reequilibrio.sql no Supabase.', true); return false; }
}
async function pedidoAbrir() {
  if (!$('#p-bairro').options.length) selectBairros($('#p-bairro'));
  if (!$('#p-data').value) $('#p-data').value = hojeISO();
  const ano = new Date().getFullYear(); const { data } = await sb.from('contadores').select('*').eq('ano', ano);
  PED.prox = {}; (data || []).forEach(c => PED.prox[c.tipo] = c.ultimo);
  pedidoNumero();
}
function pedidoNumero() {
  const ano = new Date().getFullYear(), n = t => (t ? t + '-' : '') + String((PED.prox[t] || 0) + 1).padStart(4, '0') + '/' + ano;
  ['', 'C', 'R'].forEach(t => { const el = document.getElementById('px-' + t); if (el) el.textContent = 'próximo ' + n(t); });
  $('#num-prev').textContent = n($('input[name=tipo]:checked').value);
}

// ================= trava de edição (quem está mexendo no processo) =================
// Ao abrir um processo na Tela 2 ele fica marcado no nome de quem abriu. Quem abrir depois vê "Em edição por …"
// e fica só em leitura. A marcação sai ao entregar, devolver, cancelar, trocar de processo ou de aba, fechar a
// página, ou depois de 30 minutos sem mexer (a cada minuto com atividade ela é renovada).
const TRAVA = { id: null, meu: false, timer: null, mexeu: false, token: null, n: 0, alvo: null };
['click', 'keydown', 'input', 'scroll', 'mousemove', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { TRAVA.mexeu = true; }, { passive: true, capture: true }));
function travaNoD(id, r) { const d = D.find(x => x.id === id); if (!d) return; d.editando_por = r?.por || null; d.editando_nome = r?.nome || null; d.editando_desde = r?.desde || null; d.editando_em = r?.em || null; }
async function travaMarcar(id, assumir) {
  if (SEM_TRAVA) return { meu: true };
  const n = ++TRAVA.n; TRAVA.alvo = id;
  try {
    const { data: { session } } = await sb.auth.getSession(); TRAVA.token = session?.access_token || TRAVA.token;
    const r = await rpc('marcar_edicao', { p_id: id, p_assumir: !!assumir });
    if (n !== TRAVA.n) { if (r.meu && id !== TRAVA.alvo) rpc('liberar_edicao', { p_id: id }).catch(() => { }); return r; }   // já mudou de processo
    TRAVA.id = id; TRAVA.meu = !!r.meu; travaNoD(id, r);
    clearInterval(TRAVA.timer); TRAVA.timer = r.meu ? setInterval(travaRenova, 6e4) : null; TRAVA.mexeu = false;
    return r;
  } catch (e) {
    if (/banco ainda não foi atualizado/.test(e.message)) SEM_TRAVA = true; else console.error(e);
    return { meu: true };   // sem conseguir marcar, não trava o trabalho de ninguém
  }
}
async function travaRenova() {
  if (!TRAVA.meu || !TRAVA.id || !TRAVA.mexeu || TELA !== 'projetos') return;   // sem atividade, a marcação vence sozinha em 30 min
  const id = TRAVA.id, r = await travaMarcar(id, false);
  if (!r.meu && PJ.p && PJ.p.id === id) {
    projetosModo(r); projetosFila();
    toast(primeiroNome(r.nome) + ' assumiu a edição de ' + PJ.p.numero + '. O que você não salvou não foi gravado.', true);
  }
}
async function travaLiberar() {
  const id = TRAVA.id, meu = TRAVA.meu; clearInterval(TRAVA.timer); TRAVA.n++; Object.assign(TRAVA, { id: null, meu: false, timer: null, alvo: null });
  if (!id || !meu || SEM_TRAVA) return; travaNoD(id, null);
  try { await rpc('liberar_edicao', { p_id: id }); } catch (e) { console.error(e); }
}
// ao fechar a aba ou o navegador: libera mesmo com a página saindo
window.addEventListener('pagehide', () => {
  if (!TRAVA.id || !TRAVA.meu || SEM_TRAVA || !TRAVA.token) return;
  try { fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/liberar_edicao', { method: 'POST', keepalive: true, headers: { apikey: CFG.SUPABASE_CHAVE, Authorization: 'Bearer ' + TRAVA.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_id: TRAVA.id }) }); } catch (e) { }
});
window.addEventListener('pageshow', e => { if (e.persisted && TELA === 'projetos' && PJ.p) projetosAbrir(PJ.p.id); });
// a cada 30 s atualiza na fila quem está mexendo em quê
setInterval(async () => {
  if (SEM_TRAVA || !EU || TELA !== 'projetos' || document.hidden) return;
  const { data, error } = await sb.from('processos').select('id,editando_por,editando_nome,editando_desde,editando_em').eq('etapa', 1);
  if (error || !data) return;
  data.forEach(x => { const d = D.find(y => y.id === x.id); if (d) Object.assign(d, x); });
  projetosFila();
  // se eu estava só olhando e a outra pessoa saiu, o processo passa para mim
  if (PJ.p && TRAVA.id === PJ.p.id && !TRAVA.meu && !travaAtiva(D.find(d => d.id === PJ.p.id))) { toast('O processo ' + PJ.p.numero + ' foi liberado. Agora você pode editar.'); projetosAbrir(PJ.p.id); }
}, 30000);
const horaTrava = t => { if (!t) return ''; const d = new Date(t); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : dataHora(t); };

// ================= 2 · PROJETOS: elaborar =================
const PJ = { fila: [], at: 0, p: null };
function projetosIniciar() {
  caixaPdf('#j-arq', '#j-up');
  $('#j-bairro').onchange = () => $('#j-zona').textContent = BAIRROS[$('#j-bairro').value] || '';
  $('#j-addpot').onclick = () => { potLinha(50, ''); potSoma(); };
  itensProjetoIniciar();
  $$('.j-mod').forEach(i => i.oninput = potSoma);
  $('#j-croqui').onclick = () => verArquivo(ultimoArquivo(PJ.p, 'croqui'), 'Croqui ' + PJ.p.numero);
  $('#j-salvar').onclick = () => projetosGravar(false);
  $('#j-ok').onclick = () => projetosGravar(true);
  $('#j-canc').onclick = () => abrirCancelar(PJ.p);
  $('#j-assumir').onclick = async () => {
    const p = PJ.p, d = D.find(x => x.id === p?.id); if (!p) return;
    const nome = primeiroNome(d?.editando_nome);
    if (!confirm(`${nome} está editando o processo ${p.numero}.\n\nAssumir a edição? O que ${nome} ainda não salvou não será gravado, e fica registrado no histórico que você assumiu.`)) return;
    ocupado(true); await travaMarcar(p.id, true); ocupado(false);
    toast('Você assumiu a edição de ' + p.numero); projetosAbrir(p.id);
  };
}
function projetosFila() {
  $('#j-fila').innerHTML = PJ.fila.map((p, i) => itemFila(D.find(d => d.id === p.id) || p, i, PJ.at)).join('') || '<p class="vazio">Fila vazia.</p>';
  $$('#j-fila .item').forEach(b => b.onclick = () => { PJ.at = +b.dataset.i; projetosAbrir(PJ.fila[PJ.at].id); });
}
// com a trava: "Você está editando" ou "Em edição por …" (só leitura, botões travados)
function projetosModo(r) {
  const eu = !!r.meu, el = $('#j-trava'), outro = esc(r.nome || 'outra pessoa');
  $('#j-form').classList.toggle('so-leitura', !eu);
  $$('#j-form input, #j-form select, #j-form textarea, #j-form button').forEach(x => { if (['j-croqui', 'j-ver-proj', 'j-assumir'].includes(x.id)) return; x.disabled = !eu; });
  ['#j-canc', '#j-salvar', '#j-ok'].forEach(b => $(b).title = eu ? '' : 'Processo em edição por ' + (r.nome || 'outra pessoa'));
  $('#j-assumir').hidden = eu || SEM_TRAVA;
  if (SEM_TRAVA) { el.hidden = true; return; }
  el.hidden = false; el.className = 'trava ' + (eu ? 'eu' : 'outro');
  el.innerHTML = eu ? `✎ Você está editando · desde ${horaTrava(r.desde)}` : `🔒 Em edição por <b>${outro}</b> desde ${horaTrava(r.desde)} · somente leitura`;
}
async function projetosAbrir(idSel) {
  PJ.fila = filaDe(1); const i = idSel ? PJ.fila.findIndex(p => p.id === idSel) : PJ.fila.findIndex(p => p.id === PJ.p?.id); PJ.at = Math.max(0, i);
  $('#j-form').hidden = !PJ.fila.length; $('#j-vazio').hidden = !!PJ.fila.length;
  const alvo = PJ.fila[PJ.at]?.id, seq = PJ.seq = (PJ.seq || 0) + 1;
  if (TRAVA.id && TRAVA.id !== alvo) await travaLiberar();   // trocou de processo: solta o anterior
  projetosFila();
  if (!PJ.fila.length) { PJ.p = null; return; }
  const [p, trava] = await Promise.all([tarefa(() => carregarProcesso(alvo)), travaMarcar(alvo, false)]); if (seq !== PJ.seq || !p) return; PJ.p = p;
  projetosFila();
  $('#j-tit').textContent = p.numero; $('#j-sub').textContent = 'Recebido em ' + dataHora(p.etapa_desde) + ' · ' + (p.movimentos.find(m => m.acao === 'criar')?.por_nome ? 'cadastrado por ' + p.movimentos.find(m => m.acao === 'criar').por_nome : 'histórico da planilha');
  faixaDevolvido($('#j-dev'), p);
  $('#j-num').textContent = ({ '': 'Comum', C: 'Campo / Quadra', R: 'Reequilíbrio', RM: 'Remodelamento', V: 'Locais violentos', MP: 'Manutenção preventiva' }[p.tipo] || '') + ' · ' + p.numero;
  $('#j-serv').value = (p.tipo_servico === 'EXPANSÃO' ? 'CRESCIMENTO VEGETATIVO' : p.tipo_servico) || (p.tipo === 'R' ? 'REEQUILÍBRIO' : '');   // Expansão passou a se chamar Crescimento vegetativo
  $('#j-origem').value = p.origem || ''; $('#j-ref').value = p.ref_pedido || ''; $('#j-logr').value = p.logradouro || '';
  selectBairros($('#j-bairro'), p.bairro); $('#j-zona').textContent = p.zona || '';
  $$('input[name=j-exec]').forEach(r => r.checked = (r.value === 'sim') === !!p.ja_executado);
  $$('input[name=j-urg]').forEach(r => r.checked = (r.value === 'sim') === !!p.urgente);
  $('#j-obsped-c').hidden = !p.obs_pedido; $('#j-obsped').textContent = p.obs_pedido || '';
  $('#j-pot').innerHTML = ''; Object.entries(p.potencias || {}).forEach(([w, q]) => potLinha(+w, q)); if (!Object.keys(p.potencias || {}).length) potLinha(50, '');
  $('#j-cv').value = p.mod_cv || ''; $('#j-mo').value = p.mod_mod || ''; $('#j-de').value = p.mod_dest || ''; potSoma();
  $('#j-obs').value = p.obs_projetos || ''; $('#j-up')._limpa();
  const ja = p.arquivos.filter(a => a.tipo === 'projeto' && new Date(a.em) >= new Date(p.etapa_desde)).slice(-1)[0];
  $('#j-arq-info').innerHTML = ja ? `✓ Já enviado: <button type="button" class="link-pdf" id="j-ver-proj">${esc(ja.nome)}</button> (${dataHora(ja.em)}). Escolha outro só se precisar mandar uma versão nova; o anterior fica no histórico.` : '';
  if (ja) $('#j-ver-proj').onclick = () => verArquivo(ja, 'Projeto ' + p.numero);
  $('#j-ok').textContent = 'Entregar para Engenharia →';   // já executado ou não, o projeto sempre vai para a Engenharia
  await itensProjeto(p); if (seq !== PJ.seq) return;
  projetosModo(trava);
}
function potLinha(w, q) {
  const tr = document.createElement('tr'), id = 'pw' + Math.random().toString(36).slice(2, 7);
  tr.innerHTML = `<td><select id="${id}" aria-label="Potência">${POTS.map(p => `<option value="${p}"${p === w ? ' selected' : ''}>${p} W</option>`).join('')}</select></td><td class="num"><input type="number" min="0" value="${q ?? ''}" aria-label="Quantidade" class="qt"></td><td><button type="button" class="rem" aria-label="Remover linha">×</button></td>`;
  tr.querySelector('.qt').oninput = potSoma; tr.querySelector('select').onchange = potSoma; tr.querySelector('.rem').onclick = () => { tr.remove(); potSoma(); }; $('#j-pot').appendChild(tr);
}
function potLer() { const o = {}; $$('#j-pot tr').forEach(tr => { const w = tr.querySelector('select').value, q = +tr.querySelector('.qt').value || 0; if (q > 0) o[w] = (o[w] || 0) + q; }); return o; }
function potSoma() {
  const t = Object.values(potLer()).reduce((a, b) => a + b, 0); $('#j-tot').textContent = t;
  const m = $$('.j-mod').reduce((a, i) => a + (+i.value || 0), 0), c = $('#j-conf');
  if (t === m && t > 0) { c.className = 'conf ok'; c.textContent = '✓ Modalidades somam ' + m + ' pontos, igual ao total das potências.'; }
  else { c.className = 'conf no'; c.textContent = 'Modalidades somam ' + m + ' pontos, mas o total das potências é ' + t + '. Ajuste antes de entregar.'; }
}
async function projetosGravar(entregar) {
  const p = PJ.p; if (!p) return;
  const ehR = p.tipo === 'R';   // R-: no lugar de potências e modalidades vão os itens de reequilíbrio
  const campos = { tipo_servico: $('#j-serv').value, origem: $('#j-origem').value, ref_pedido: $('#j-ref').value.trim(), logradouro: $('#j-logr').value.trim(),
    bairro: $('#j-bairro').value, ja_executado: $('input[name=j-exec]:checked')?.value === 'sim', potencias: ehR ? {} : potLer(),
    mod_cv: ehR ? 0 : +$('#j-cv').value || 0, mod_mod: ehR ? 0 : +$('#j-mo').value || 0, mod_dest: ehR ? 0 : +$('#j-de').value || 0, obs_projetos: $('#j-obs').value.trim() };
  if (ehR) { const ok = await tarefa(() => itensGravar(p, entregar)); if (!ok) return; }
  const arq = $('#j-up')._arqs[0];
  const urg = $('input[name=j-urg]:checked')?.value === 'sim';
  if (urg !== !!p.urgente && await marcarUrgente(p.id, urg)) p.urgente = urg;
  const r = await tarefa(async () => {
    if (arq) { const a = await enviarArquivo('processos/' + p.id, 'projeto', arq); await rpc('registrar_arquivo', { p_id: p.id, p_tipo: 'projeto', p_caminho: a.caminho, p_nome: a.nome, p_tamanho: a.tamanho }); $('#j-up')._limpa(); }
    if (entregar) return rpc('entregar', { p_id: p.id, p_campos: campos });
    await rpc('salvar', { p_id: p.id, p_campos: campos }); return { salvo: true };
  });
  if (!r) { if (arq) projetosAbrir(p.id); return; }
  toast(r.salvo ? 'Alterações salvas' : p.numero + ' entregue para Engenharia');
  await recarregar(); projetosAbrir(r.salvo ? p.id : null);
}

// ================= 3 · EXECUÇÃO (Engenharia) =================
const XE = { fila: [], at: 0, p: null };
function execIniciar() {
  caixaPdf('#x-arq', '#x-up', { varios: true, imagens: true }).addEventListener('mudou', () => {
    $('#x-arqs').innerHTML = $('#x-up')._arqs.map((f, i) => `<span><b>${/\.pdf$/i.test(f.name) ? 'PDF' : 'FOTO'}</b>${esc(f.name)}<button type="button" data-i="${i}" aria-label="Tirar">×</button></span>`).join('');
    $$('#x-arqs button').forEach(b => b.onclick = () => { $('#x-up')._arqs.splice(+b.dataset.i, 1); $('#x-up').dispatchEvent(new Event('mudou')); });
  });
  $$('input[name=x-sit]').forEach(r => r.onchange = execMostra); $$('input[name=x-cor]').forEach(r => r.onchange = execMostra);
  $('#x-ver').onclick = () => verArquivo(ultimoArquivo(XE.p, 'projeto'), 'Projeto ' + XE.p.numero);
  $('#x-dev').onclick = () => abrirDevolver(XE.p, [1]);
  $('#x-salvar').onclick = () => execGravar(false); $('#x-ok').onclick = () => execGravar(true);
}
const naoAdq = p => !!p && p.tipo === 'R' && p.adquirido === false;   // R- não adquirido: pula o Cadastro e não vai à AGEMAN
function execMostra() { const s = $('input[name=x-sit]:checked').value, c = $('input[name=x-cor]:checked').value; $('#x-parc-c').hidden = s !== 'parcial'; $('#x-cor-c').hidden = c !== 'sim'; $('#x-ok').textContent = s === 'parcial' ? 'Salvar execução parcial' : naoAdq(XE.p) ? 'Entregar para Projetos (não adquirido) →' : 'Entregar para Cadastro →'; }
async function execAbrir(idSel) {
  XE.fila = filaDe(2); const i = idSel ? XE.fila.findIndex(p => p.id === idSel) : XE.fila.findIndex(p => p.id === XE.p?.id); XE.at = Math.max(0, i);
  $('#x-form').hidden = !XE.fila.length; $('#x-vazio').hidden = !!XE.fila.length;
  $('#x-fila').innerHTML = XE.fila.map((p, i) => itemFila(p, i, XE.at)).join('') || '<p class="vazio">Fila vazia.</p>';
  $$('#x-fila .item').forEach(b => b.onclick = () => { XE.at = +b.dataset.i; execAbrir(XE.fila[XE.at].id); });
  if (!XE.fila.length) return;
  const p = await tarefa(() => carregarProcesso(XE.fila[XE.at].id)); if (!p) return; XE.p = p;
  $('#x-tit').textContent = p.numero; $('#x-sub').textContent = 'Recebido de Projetos em ' + dataBR(p.etapa_desde) + ' · há ' + diasDesde(p.etapa_desde) + ' dias';
  faixaDevolvido($('#x-dev-faixa'), p);
  const proj = ultimoArquivo(p, 'projeto');
  $('#x-resumo').innerHTML = [['Serviço', esc(p.tipo_servico || '—')], ['Logradouro', esc(p.logradouro)], ['Bairro / zona', esc((p.bairro || '') + ' · ' + (p.zona || ''))], ['Pontos', p.total_pontos],
    ['Projeto', proj ? `<button class="link-pdf" type="button" id="x-link">${esc(proj.nome)}</button>` : 'sem PDF (histórico)']].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  if (proj) $('#x-link').onclick = () => $('#x-ver').click(); $('#x-ver').disabled = !proj;
  $('#x-obs-box').hidden = !p.obs_projetos; $('#x-obs').textContent = p.obs_projetos || '';
  const sit = p.exec_situacao || (p.ja_executado ? 'executado' : 'nao'); $$('input[name=x-sit]').forEach(r => r.checked = r.value === sit);
  $$('input[name=x-cor]').forEach(r => r.checked = r.value === (p.correcoes ? 'sim' : 'nao'));
  $('#x-data').value = p.executado_em || hojeISO(); $('#x-equipe').value = p.equipe || ''; $('#x-parc').value = p.exec_parcial || ''; $('#x-cor-txt').value = p.correcoes || '';
  $('#x-up')._limpa(); $('#x-arqs').innerHTML = p.arquivos.filter(a => a.tipo === 'correcoes').map(a => `<span><b>${/\.pdf$/i.test(a.caminho) ? 'PDF' : 'FOTO'}</b>${esc(a.nome)} · já enviado</span>`).join('');
  $$('#tela-exe .campo').forEach(c => c.classList.remove('invalido')); execMostra();
}
async function execGravar(entregar) {
  const p = XE.p; if (!p) return; const sit = $('input[name=x-sit]:checked').value, cor = $('input[name=x-cor]:checked').value;
  if (sit === 'parcial' && !$('#x-parc').value.trim()) { $('#x-parc').closest('.campo').classList.add('invalido'); toast('Diga o que ficou faltando', true); return; }
  if (entregar && sit === 'nao') { toast('Marque como Executado para entregar ' + (naoAdq(p) ? 'a Projetos' : 'ao Cadastro'), true); return; }
  if (cor === 'sim' && !$('#x-cor-txt').value.trim()) { $('#x-cor-txt').closest('.campo').classList.add('invalido'); toast('Descreva as correções de campo', true); return; }
  const campos = { exec_situacao: sit, executado_em: $('#x-data').value, equipe: $('#x-equipe').value.trim(), exec_parcial: sit === 'parcial' ? $('#x-parc').value.trim() : '', correcoes: cor === 'sim' ? $('#x-cor-txt').value.trim() : '' };
  const arqs = $('#x-up')._arqs.slice(); const ent = entregar && sit === 'executado';
  const r = await tarefa(async () => {
    for (const f of arqs) { const a = await enviarArquivo('processos/' + p.id, 'correcoes', f); await rpc('registrar_arquivo', { p_id: p.id, p_tipo: 'correcoes', p_caminho: a.caminho, p_nome: a.nome, p_tamanho: a.tamanho }); }
    $('#x-up')._limpa();
    if (ent) return rpc('entregar', { p_id: p.id, p_campos: campos });
    await rpc('salvar', { p_id: p.id, p_campos: campos }); return { salvo: true };
  });
  if (!r) return;
  toast(r.salvo ? (sit === 'parcial' ? 'Execução parcial salva. O processo continua na sua fila.' : 'Alterações salvas') : p.numero + ' entregue para ' + (ETAPAS[r.etapa]?.setor || 'o Cadastro'));
  await recarregar(); execAbrir(r.salvo ? p.id : null);
}

// ================= 4 · CADASTRO =================
const KD = { fila: [], at: 0, p: null, modo: 'ed', base: null };
function cadIniciar() {
  edIniciar(); caixaPdf('#k-arq', '#k-up');
  $('#km-ed').onclick = () => cadModo('ed'); $('#km-up').onclick = () => cadModo('up');
  $('#ed-gerar').onclick = () => tarefa(async () => { await edGerar(); }, 'PDF gerado. Ele é enviado quando você clicar em "Entregar para Projetos".');
  const sel = document.createElement('select'); sel.id = 'ed-base'; sel.style.cssText = 'width:auto;padding:5px 8px;font-size:13px'; sel.setAttribute('aria-label', 'PDF base');
  $('#k-editor .ed-ctl').prepend(sel); sel.onchange = () => cadBase(sel.value);
  $('#k-dev').onclick = () => abrirDevolver(KD.p, [2, 1]);
  $('#k-salvar').onclick = () => cadGravar(false); $('#k-ok').onclick = () => cadGravar(true);
}
function cadModo(m) { KD.modo = m; $('#km-ed').setAttribute('aria-pressed', m === 'ed'); $('#km-up').setAttribute('aria-pressed', m === 'up'); $('#k-editor').hidden = m !== 'ed'; $('#k-modo-up').hidden = m !== 'up'; }
async function cadBase(id) {
  const a = KD.p.arquivos.find(x => String(x.id) === String(id)); if (!a) { edLimpa('Nenhum PDF de projeto neste processo. Use "Baixar e enviar PDF".'); return; }
  await tarefa(async () => edAbrir(await bytesDe(a.caminho), a.nome));
}
async function cadAbrir(idSel) {
  KD.fila = filaDe(3); const i = idSel ? KD.fila.findIndex(p => p.id === idSel) : KD.fila.findIndex(p => p.id === KD.p?.id); KD.at = Math.max(0, i);
  $('#k-form').hidden = !KD.fila.length; $('#k-vazio').hidden = !!KD.fila.length;
  $('#k-fila').innerHTML = KD.fila.map((p, i) => itemFila(p, i, KD.at)).join('') || '<p class="vazio">Fila vazia.</p>';
  $$('#k-fila .item').forEach(b => b.onclick = () => { KD.at = +b.dataset.i; cadAbrir(KD.fila[KD.at].id); });
  if (!KD.fila.length) return;
  const p = await tarefa(() => carregarProcesso(KD.fila[KD.at].id)); if (!p) return; KD.p = p;
  $('#k-tit').textContent = p.numero; $('#k-sub').textContent = 'Recebido da Engenharia em ' + dataBR(p.etapa_desde) + (p.executado_em ? ' · executado em ' + dataBR(p.executado_em) : '');
  faixaDevolvido($('#k-dev-faixa'), p);
  $('#k-resumo').innerHTML = [['Serviço', esc(p.tipo_servico || '—')], ['Logradouro', esc(p.logradouro)], ['Bairro / zona', esc((p.bairro || '') + ' · ' + (p.zona || ''))], ['Pontos', p.total_pontos]].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('#k-corr').textContent = p.correcoes || 'Sem correções. Executado conforme o projeto.';
  const pdfs = p.arquivos.filter(a => ['projeto', 'correcoes'].includes(a.tipo) && /\.pdf$/i.test(a.caminho)).reverse();
  $('#ed-base').innerHTML = pdfs.map(a => `<option value="${a.id}">${a.tipo === 'projeto' ? 'Projeto' : 'Correções'} · ${esc(a.nome)}</option>`).join('') || '<option value="">sem PDF</option>';
  $('#k-baixar').innerHTML = p.arquivos.filter(a => ['projeto', 'correcoes'].includes(a.tipo)).map(a => `<button type="button" class="btn peq" data-id="${a.id}">↓ ${esc(a.nome)}</button>`).join('') || '<span class="ajuda">Sem arquivos (processo do histórico).</span>';
  $$('#k-baixar button').forEach(b => b.onclick = () => abrirNovaAba(p.arquivos.find(a => String(a.id) === b.dataset.id).caminho));
  $('#k-reg').textContent = EU.nome + ' (' + EU.setor + ') · a data e a hora são registradas ao entregar';
  $('#k-obs').value = p.obs_cadastro || ''; $('#k-up')._limpa();
  cadModo(pdfs.length ? 'ed' : 'up'); if (pdfs.length) cadBase(pdfs[0].id); else edLimpa();
}
async function cadGravar(entregar) {
  const p = KD.p; if (!p) return; let arq = null;
  if (KD.modo === 'ed' && ED.saida) arq = new File([ED.saida], 'plaquetas-' + p.numero.replace(/\W+/g, '-') + '.pdf', { type: 'application/pdf' });
  else if (KD.modo === 'ed' && ED.marcas.length && entregar) { toast('Clique em "Gerar PDF com plaquetas" antes de entregar', true); return; }
  else if (KD.modo === 'up') arq = $('#k-up')._arqs[0] || null;
  const r = await tarefa(async () => {
    if (arq) { const a = await enviarArquivo('processos/' + p.id, 'plaquetas', arq); await rpc('registrar_arquivo', { p_id: p.id, p_tipo: 'plaquetas', p_caminho: a.caminho, p_nome: a.nome, p_tamanho: a.tamanho }); ED.saida = null; $('#k-up')._limpa(); }
    const campos = { obs_cadastro: $('#k-obs').value.trim() };
    if (entregar) return rpc('entregar', { p_id: p.id, p_campos: campos });
    await rpc('salvar', { p_id: p.id, p_campos: campos }); return { salvo: true };
  });
  if (!r) return;
  toast(r.salvo ? 'Alterações salvas' : p.numero + ' entregue para Projetos');
  await recarregar(); cadAbrir(r.salvo ? p.id : null);
}

// ================= 5 · AS BUILT E AGEMAN (Projetos) =================
const AB = { fila: [], at: 0, p: null, sel: new Set(), visor: null, carta: null };
function asbIniciar() {
  caixaPdf('#a-arq', '#a-up'); caixaPdf('#ag-arq', '#ag-up');
  AB.visor = criaVisor({ area: '#v-area', canvas: '#v-cv', zoom: '#v-z', menos: '#v-menos', mais: '#v-mais', ajusta: '#v-ajusta' });
  $('#v-cheia').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else { await $('#v-area').requestFullscreen(); setTimeout(AB.visor.desenha, 150); } } catch (e) { toast('Tela cheia não disponível aqui', true); } };
  document.addEventListener('fullscreenchange', () => setTimeout(AB.visor.desenha, 150));
  $('#v-print').onclick = () => { if (AB.visor.bytes) abrirBlob(new Blob([AB.visor.bytes], { type: 'application/pdf' })); };
  $('#a-dev').onclick = () => abrirDevolver(AB.p, naoAdq(AB.p) ? [2, 1] : [3, 2, 1]);
  $('#a-canc').onclick = () => abrirCancelar(AB.p);
  $('#a-salvar').onclick = () => asbGravar(false); $('#a-ok').onclick = () => asbGravar(true);
  $('#ag-todos').onchange = e => { AB.sel = e.target.checked ? new Set(filaDe(5).map(d => d.id)) : new Set(); agLista(); };
  $('#ag-carta').onclick = abrirCarta; $('#ag-enviar').onclick = registrarEnvio;
  $('#ct-gerar').onclick = cartaPrevia; ['#ct-num', '#ct-data', '#ct-dest', '#ct-att', '#ct-attc', '#ct-ass', '#ct-ref', '#ct-link', '#ct-nome', '#ct-cargo'].forEach(s => $(s).addEventListener('change', cartaPrevia));
  AB.vc = criaVisor({ area: '#ct-area', canvas: '#ct-cv' });
  $('#ct-baixar').onclick = () => { if (!AB.carta) return; if (!$('#ct-link').value.trim()) { toast('Cole o link de acesso antes', true); return; } baixarBlob('carta-' + $('#ct-num').value.replace(/\W+/g, '-') + '.pdf', new Blob([AB.carta], { type: 'application/pdf' })); };
  $('#ct-anexar').onclick = () => { if (!AB.carta) return; if (!$('#ct-link').value.trim()) { $('#ct-link').closest('.campo').classList.add('invalido'); toast('Cole o link de acesso antes de usar a carta', true); return; }
    $('#ag-of').value = $('#ct-num').value; $('#ag-data').value = $('#ct-data').value; AB.cartaPronta = { bytes: AB.carta, num: $('#ct-num').value, link: $('#ct-link').value.trim() };
    fechaModal('#modal-carta'); toast('Carta pronta. Ela é guardada junto com o registro do envio.'); };
}
async function asbAbrir(idSel) {
  AB.fila = filaDe(4); const i = idSel ? AB.fila.findIndex(p => p.id === idSel) : AB.fila.findIndex(p => p.id === AB.p?.id); AB.at = Math.max(0, i);
  $('#a-form').hidden = !AB.fila.length; $('#a-vazio').hidden = !!AB.fila.length;
  $('#a-fila').innerHTML = AB.fila.map((p, i) => itemFila(p, i, AB.at)).join('') || '<p class="vazio">Fila vazia.</p>';
  $$('#a-fila .item').forEach(b => b.onclick = () => { AB.at = +b.dataset.i; asbAbrir(AB.fila[AB.at].id); });
  if (!$('#ag-data').value) $('#ag-data').value = hojeISO();
  agLista();
  if (!AB.fila.length) return;
  const p = await tarefa(() => carregarProcesso(AB.fila[AB.at].id)); if (!p) return; AB.p = p;
  $('#a-tit').textContent = p.numero; faixaDevolvido($('#a-dev-faixa'), p);
  const pl = ultimoArquivo(p, 'plaquetas');
  $('#a-resumo').innerHTML = [['Serviço', esc(p.tipo_servico || '—')], ['Logradouro', esc(p.logradouro)], ['Bairro / zona', esc((p.bairro || '') + ' · ' + (p.zona || ''))], ['As Built com plaqueta', pl ? `<button class="link-pdf" type="button" id="a-link">${esc(pl.nome)}</button>` : 'sem PDF (histórico)']].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  if (pl) $('#a-link').onclick = () => $('#v-area').scrollIntoView({ behavior: 'smooth' });
  $('#a-obs-box').hidden = !p.obs_cadastro; $('#a-obs-cad').textContent = p.obs_cadastro || '';
  $('#a-hist').innerHTML = p.movimentos.map(m => `<li><span>${dataBR(m.em)}</span><b style="font-weight:500">${esc(m.por_nome || '')}: ${esc(textoMov(m))}</b></li>`).join('') || '<li><span></span><b style="font-weight:500">Histórico da planilha (sem movimentos registrados).</b></li>';
  $('#a-ok').textContent = naoAdq(p) ? 'Concluir processo (não adquirido, sem AGEMAN) ✓' : 'Concluir as built → pronto p/ AGEMAN';
  $('#a-pts').textContent = p.total_pontos + ' pontos'; $('#a-obs').value = p.obs_asbuilt || ''; $('#a-up')._limpa();
  AB.visor.limpa(); $('#v-fonte').textContent = pl ? 'Carregando…' : 'Sem PDF de plaquetas neste processo.';
  if (pl) tarefa(async () => { await AB.visor.abrir(await bytesDe(pl.caminho), pl.nome); $('#v-fonte').textContent = pl.nome + ' · enviado por ' + (pl.por_nome || '') + ' em ' + dataHora(pl.em); });
}
async function asbGravar(entregar) {
  const p = AB.p; if (!p) return; const arq = $('#a-up')._arqs[0];
  const r = await tarefa(async () => {
    if (arq) { const a = await enviarArquivo('processos/' + p.id, 'asbuilt', arq); await rpc('registrar_arquivo', { p_id: p.id, p_tipo: 'asbuilt', p_caminho: a.caminho, p_nome: a.nome, p_tamanho: a.tamanho }); $('#a-up')._limpa(); }
    const campos = { obs_asbuilt: $('#a-obs').value.trim() };
    if (entregar) return rpc('entregar', { p_id: p.id, p_campos: campos });
    await rpc('salvar', { p_id: p.id, p_campos: campos }); return { salvo: true };
  });
  if (!r) return;
  toast(r.salvo ? 'Alterações salvas' : naoAdq(p) ? p.numero + ' concluído (não adquirido, não vai à AGEMAN)' : p.numero + ' pronto para enviar à AGEMAN');
  await recarregar(); asbAbrir(r.salvo ? p.id : null);
}
function agLista() {
  const f = filaDe(5); AB.sel = new Set([...AB.sel].filter(id => f.some(d => d.id === id)));
  $('#ag-lista').innerHTML = f.map(d => `<tr><td><input type="checkbox" data-id="${d.id}" ${AB.sel.has(d.id) ? 'checked' : ''} aria-label="Selecionar ${esc(d.numero)}"></td><td class="nn">${esc(d.numero)}</td><td>${esc(d.logradouro)}</td><td>${esc(d.bairro || '')}</td><td class="num">${d.total_pontos}</td><td><button class="link-pdf" type="button" data-ab="${d.id}">abrir</button></td></tr>`).join('') || '<tr><td colspan="6" class="vazio">Nada pronto para enviar.</td></tr>';
  $$('#ag-lista input').forEach(c => c.onchange = () => { const id = +c.dataset.id; c.checked ? AB.sel.add(id) : AB.sel.delete(id); agLista(); });
  $$('#ag-lista [data-ab]').forEach(b => b.onclick = async () => { const { data } = await sb.from('arquivos').select('*').eq('processo_id', +b.dataset.ab).eq('tipo', 'asbuilt').order('em', { ascending: false }).limit(1); if (data && data[0]) verArquivo(data[0], 'As built'); else toast('Sem PDF de as built (processo do histórico).', true); });
  const sp = f.filter(d => AB.sel.has(d.id)).reduce((a, d) => a + d.total_pontos, 0);
  $('#ag-cont').textContent = AB.sel.size ? AB.sel.size + ' de ' + f.length + ' selecionados · ' + sp + ' pontos' : f.length + ' processo' + (f.length === 1 ? '' : 's');
  $('#ag-enviar').textContent = AB.sel.size ? 'Registrar envio à AGEMAN (' + AB.sel.size + ')' : 'Registrar envio à AGEMAN';
  $('#ag-todos').checked = f.length > 0 && AB.sel.size === f.length;
}
async function abrirCarta() {
  if (!AB.sel.size) { toast('Selecione os projetos que vão na carta', true); return; }
  if (!$('#ct-num').value) { const { data } = await sb.from('envios').select('numero_carta').not('numero_carta', 'is', null).order('id', { ascending: false }).limit(1);
    const u = data && data[0] && /^(\d+)\/(\d{4})$/.exec(data[0].numero_carta), ano = new Date().getFullYear();
    $('#ct-num').value = u && +u[2] === ano ? String(+u[1] + 1).padStart(4, '0') + '/' + ano : ''; }
  if (!$('#ct-data').value) $('#ct-data').value = hojeISO();
  abreModal('#modal-carta'); cartaPrevia();
}
async function cartaPrevia() {
  const sel = filaDe(5).filter(d => AB.sel.has(d.id));
  const r = await tarefa(() => gerarCarta(sel)); if (!r) return; AB.carta = r.bytes;
  $('#ct-info').textContent = `${sel.length} projeto${sel.length === 1 ? '' : 's'} · ${r.tot} pontos · ${r.paginas} página${r.paginas > 1 ? 's' : ''}` + ($('#ct-link').value.trim() ? '' : ' · falta o link');
  AB.vc.abrir(r.bytes, 'carta.pdf');
}
async function registrarEnvio() {
  const ids = [...AB.sel]; if (!ids.length) { toast('Selecione pelo menos um processo', true); return; }
  const data = $('#ag-data').value; if (!data) { toast('Informe a data do envio', true); return; }
  const comp = $('#ag-up')._arqs[0], carta = AB.cartaPronta;
  const r = await tarefa(async () => {
    const pasta = 'envios/' + data.slice(0, 4);
    const c = carta ? await enviarArquivo(pasta, 'carta', new File([carta.bytes], 'carta.pdf', { type: 'application/pdf' })) : null;
    const k = comp ? await enviarArquivo(pasta, 'comprovante', comp) : null;
    return rpc('registrar_envio', { p_ids: ids, p_carta: $('#ag-of').value.trim(), p_data: data, p_link: carta?.link || $('#ct-link').value.trim(), p_oficio: null, p_carta_caminho: c?.caminho || null, p_comprovante: k?.caminho || null });
  });
  if (!r) return;
  toast(ids.length + ' processo' + (ids.length > 1 ? 's' : '') + ' enviado' + (ids.length > 1 ? 's' : '') + ' à AGEMAN em ' + dataBR(data));
  AB.sel.clear(); AB.cartaPronta = null; $('#ag-up')._limpa(); $('#ag-of').value = ''; $('#ct-num').value = ''; $('#ct-link').value = '';
  await recarregar(); asbAbrir();
}

// ================= devolver / cancelar (comuns) =================
let DEV = null;
function abrirDevolver(p, destinos) {
  if (!p) return; DEV = p;
  $('#dv-tit').textContent = 'Devolver ' + p.numero; $('#dv-para').innerHTML = destinos.map(e => `<option value="${e}">${ETAPAS[e].setor} · ${ETAPAS[e].nome}</option>`).join('');
  $('#dv-motivo').value = ''; $('#dv-txt').value = ''; $('#dv-erro').hidden = true; abreModal('#modal-dev'); $('#dv-motivo').focus();
}
async function confirmaDevolver() {
  if (!$('#dv-motivo').value || !$('#dv-txt').value.trim()) { $('#dv-erro').hidden = false; return; }
  const p = DEV, para = +$('#dv-para').value;
  const r = await tarefa(() => rpc('devolver', { p_id: p.id, p_para: para, p_motivo: $('#dv-motivo').value, p_texto: $('#dv-txt').value.trim() }));
  if (!r) return; fechaModal('#modal-dev'); toast(p.numero + ' devolvido para ' + ETAPAS[para].setor);
  await recarregar(); abrirTela(TELA, true);
}
let CANC = null;
function abrirCancelar(p) { if (!p) return; CANC = p; $('#c-tit').textContent = 'Cancelar processo ' + p.numero; $('#c-motivo').value = ''; $('#c-txt').value = ''; $('#c-erro').hidden = true; abreModal('#modal-canc'); }
async function confirmaCancelar() {
  if (!$('#c-motivo').value || !$('#c-txt').value.trim()) { $('#c-erro').hidden = false; return; }
  const p = CANC; const r = await tarefa(() => rpc('cancelar', { p_id: p.id, p_motivo: $('#c-motivo').value, p_texto: $('#c-txt').value.trim() }).then(() => true));
  if (!r) return; fechaModal('#modal-canc'); toast(p.numero + ' cancelado · fica no histórico');
  await recarregar(); abrirTela(TELA, true);
}
function textoMov(m) {
  const e = x => x ? ETAPAS[x]?.nome || '' : '';
  if (m.acao === 'criar') return 'cadastrou o pedido e o croqui';
  if (m.acao === 'entregar') return 'entregou (' + e(m.de_etapa) + ' → ' + e(m.para_etapa) + ')' + (m.texto ? ' · ' + m.texto : '');
  if (m.acao === 'devolver') return 'devolveu para ' + (ETAPAS[m.para_etapa]?.setor || '') + ' · ' + (m.motivo || '') + ': ' + (m.texto || '');
  if (m.acao === 'cancelar') return 'cancelou · ' + (m.motivo || '') + ': ' + (m.texto || '');
  if (m.acao === 'reativar') return 'reativou o processo';
  if (m.acao === 'concluir') return m.texto || 'concluiu o processo (não adquirido, sem AGEMAN)';
  if (m.acao === 'itens') return m.texto || 'lançou os itens de reequilíbrio';
  if (m.acao === 'enviar') return m.texto || 'enviou à AGEMAN';
  if (m.acao === 'desfazer_envio') return 'desfez o envio à AGEMAN' + (m.texto ? ' · ' + m.texto : '');
  if (m.acao === 'editar') return (m.texto || 'alterou dados').replace(/_/g, ' ');
  return m.texto || m.acao;
}
