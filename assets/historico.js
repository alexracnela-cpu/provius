// PROVIUS · tela Histórico: tudo o que aconteceu nos processos, do mais recente para o mais antigo
// Lê a tabela movimentos (a mesma do histórico de cada processo). Os envios à AGEMAN feitos juntos
// aparecem num bloco só, com a lista dos processos; o administrador pode desfazer um envio dali.
const HI = { de: '', ate: '', acao: '', pessoa: '', busca: '', dados: [], ok: false };
const HI_ACOES = [
  ['', 'Todas as ações'], ['enviar', 'Envios à AGEMAN'], ['entregar', 'Entregas'], ['devolver', 'Devoluções'], ['criar', 'Cadastros de croqui'],
  ['concluir', 'Conclusões (sem AGEMAN)'], ['cancelar', 'Cancelamentos e reativações'], ['desfazer_envio', 'Envios desfeitos'], ['editar', 'Edições']
];
const HI_ROT = { enviar: 'Envio AGEMAN', entregar: 'Entrega', devolver: 'Devolução', criar: 'Cadastro', concluir: 'Conclusão', cancelar: 'Cancelamento', reativar: 'Reativação', desfazer_envio: 'Envio desfeito', editar: 'Edição', itens: 'Itens', urgente: 'Urgência', trava: 'Edição' };
const HI_COR = { enviar: 'k-env', desfazer_envio: 'k-des', devolver: 'k-dev', cancelar: 'k-can', reativar: 'k-ok', concluir: 'k-ok', criar: 'k-cri', entregar: 'k-ent' };

function histIniciar() {
  const d = new Date(); d.setDate(d.getDate() - 30);
  HI.de = d.toISOString().slice(0, 10); HI.ate = hojeISO();
  $('#hi-de').value = HI.de; $('#hi-ate').value = HI.ate;
  $('#hi-acao').innerHTML = HI_ACOES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  $$('#hi-rapido button').forEach(b => b.onclick = () => {
    const n = +b.dataset.d, i = new Date(); i.setDate(i.getDate() - n);
    $('#hi-de').value = n < 0 ? '2020-01-01' : i.toISOString().slice(0, 10); $('#hi-ate').value = hojeISO(); histCarregar();
  });
  $('#hi-de').onchange = $('#hi-ate').onchange = histCarregar;
  $('#hi-acao').onchange = () => { HI.acao = $('#hi-acao').value; histDesenha(); };
  $('#hi-pessoa').onchange = () => { HI.pessoa = $('#hi-pessoa').value; histDesenha(); };
  $('#hi-busca').oninput = () => { HI.busca = $('#hi-busca').value.trim().toUpperCase(); histDesenha(); };
  $('#hi-recarregar').onclick = () => histCarregar();
}
async function histAbrir() { if (!HI.ok) await histCarregar(); else histDesenha(); }

async function histCarregar() {
  HI.de = $('#hi-de').value || '2020-01-01'; HI.ate = $('#hi-ate').value || hojeISO();
  const ate = new Date(HI.ate + 'T00:00:00'); ate.setDate(ate.getDate() + 1);
  const r = await tarefa(async () => {
    let tudo = [], de = 0; const N = 1000;
    for (; ;) {
      const { data, error } = await sb.from('movimentos').select('*').gte('em', new Date(HI.de + 'T00:00:00').toISOString()).lt('em', ate.toISOString())
        .order('em', { ascending: false }).range(de, de + N - 1);
      if (error) throw error; tudo = tudo.concat(data); if (data.length < N || tudo.length >= 5000) break; de += N;
    }
    return tudo;
  });
  if (!r) return;
  HI.dados = r; HI.ok = true;
  const pessoas = [...new Set(r.map(m => m.por_nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  $('#hi-pessoa').innerHTML = '<option value="">Todas as pessoas</option>' + pessoas.map(p => `<option${p === HI.pessoa ? ' selected' : ''}>${esc(p)}</option>`).join('');
  if (!pessoas.includes(HI.pessoa)) HI.pessoa = '';
  histDesenha();
}

// envios à AGEMAN gravados juntos (mesma pessoa, mesmo minuto) viram um bloco só
function histAgrupar(lista) {
  const out = [];
  lista.forEach(m => {
    const u = out[out.length - 1];
    if (m.acao === 'enviar' && u && u.acao === 'enviar' && u.por_nome === m.por_nome && Math.abs(new Date(u.em) - new Date(m.em)) < 60e3) u.itens.push(m);
    else out.push({ ...m, itens: [m] });
  });
  return out;
}
const histNum = id => D.find(d => d.id === id);
const histGrupoAcao = a => a === 'reativar' ? 'cancelar' : a;

function histDesenha() {
  if (!HI.ok) return;
  const num = m => histNum(m.processo_id)?.numero || '#' + m.processo_id;
  const f = HI.dados.filter(m => (!HI.acao || histGrupoAcao(m.acao) === HI.acao) && (!HI.pessoa || m.por_nome === HI.pessoa) &&
    (!HI.busca || num(m).toUpperCase().includes(HI.busca) || (histNum(m.processo_id)?.logradouro || '').toUpperCase().includes(HI.busca)));
  const grupos = histAgrupar(f);
  // resumo do período
  const conta = a => HI.dados.filter(m => m.acao === a).length;
  const envios = histAgrupar(HI.dados.filter(m => m.acao === 'enviar'));
  $('#hi-kpis').innerHTML = [['Movimentos no período', fmt(HI.dados.length)], ['Envios à AGEMAN', fmt(envios.length) + ' <small class="hi-peq">' + fmt(conta('enviar')) + ' processos</small>'],
    ['Entregas entre setores', fmt(conta('entregar'))], ['Devoluções', fmt(conta('devolver'))]].map(([k, v]) => `<div class="sd-kpi"><span class="r">${k}</span><b>${v}</b></div>`).join('');
  $('#hi-sub').textContent = 'De ' + dataBR(HI.de) + ' a ' + dataBR(HI.ate) + ' · ' + (f.length === HI.dados.length ? fmt(f.length) + ' movimentos' : fmt(f.length) + ' de ' + fmt(HI.dados.length) + ' movimentos com os filtros');
  if (!grupos.length) { $('#hi-lista').innerHTML = '<p class="vazio" style="padding:16px">Nenhum movimento com esses filtros neste período.</p>'; return; }
  let dia = '', h = '';
  grupos.forEach((g, gi) => {
    const d = new Date(g.em).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    if (d !== dia) { if (dia) h += '</ul>'; dia = d; h += `<h3 class="hi-dia">${esc(d)}</h3><ul class="hi-ul">`; }
    const hora = new Date(g.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const rot = `<span class="hi-tag ${HI_COR[g.acao] || ''}">${esc(HI_ROT[g.acao] || g.acao)}</span>`;
    let corpo;
    if (g.acao === 'enviar') {
      const ps = g.itens.map(m => histNum(m.processo_id)).filter(Boolean);
      const desfeito = ps.length && ps.every(p => p.etapa !== 6);
      corpo = `<span><b>${esc(g.por_nome || '')}</b> enviou ${g.itens.length} processo${g.itens.length > 1 ? 's' : ''} à AGEMAN${g.texto ? ' · ' + esc(g.texto.replace(/^enviou à AGEMAN\s*·?\s*/i, '')) : ''}</span>
        <span class="hi-nums">${g.itens.map(m => `<button type="button" class="link-pdf" data-p="${m.processo_id}">${esc(num(m))}</button>`).join('')}</span>
        ${desfeito ? '<span class="hi-obs">Este envio foi desfeito; os processos voltaram para Pronto p/ AGEMAN.</span>' : EU.admin ? `<button type="button" class="btn peq dev hi-desf" data-g="${gi}">↩ Desfazer este envio</button>` : ''}`;
    } else {
      corpo = `<span><button type="button" class="link-pdf" data-p="${g.processo_id}">${esc(num(g))}</button> · <b>${esc(g.por_nome || '')}</b> ${esc(textoMov(g))}</span>
        <span class="hi-obs">${esc(histNum(g.processo_id)?.logradouro || '')}</span>`;
    }
    h += `<li><span class="hi-hora">${hora}</span>${rot}<div class="hi-txt">${corpo}</div></li>`;
  });
  $('#hi-lista').innerHTML = h + '</ul>';
  $$('#hi-lista [data-p]').forEach(b => b.onclick = () => detalhe(+b.dataset.p));
  $$('#hi-lista .hi-desf').forEach(b => b.onclick = () => histDesfazer(grupos[+b.dataset.g]));
}

async function histDesfazer(g) {
  const ids = g.itens.map(m => m.processo_id), nums = ids.map(i => histNum(i)?.numero || '#' + i);
  const motivo = prompt(`Desfazer o envio à AGEMAN de ${dataHora(g.em)} feito por ${g.por_nome || '—'}?\n\nProcessos: ${nums.join(', ')}\n\nEles voltam para "Pronto p/ AGEMAN" e o desfazimento fica no histórico. Diga o motivo:`, 'Enviado por engano');
  if (motivo === null) return;
  if (!motivo.trim()) { toast('Diga o motivo para desfazer', true); return; }
  const r = await tarefa(() => rpc('desfazer_envio', { p_ids: ids, p_motivo: motivo.trim() }));
  if (!r) return;
  toast('Envio desfeito · ' + nums.length + ' processo' + (nums.length > 1 ? 's voltaram' : ' voltou') + ' para Pronto p/ AGEMAN');
  await recarregar(); await histCarregar();
}
