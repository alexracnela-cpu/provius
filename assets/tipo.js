// PROVIUS · Mudar o tipo do processo (só o administrador)
//
// Comum, Campo / Quadra (C-), Reequilíbrio (R-), Manutenção preventiva (MP-), Remodelamento (RM-) e
// Locais violentos (V-), sem cancelar e refazer: o processo continua o mesmo
// (histórico, arquivos, tabela de carga, observações e traçado) e recebe o próximo número do novo tipo,
// no ano do processo. O número antigo fica na lista como CANCELADO, apontando para o novo.
// Banco: função mudar_tipo e colunas numero_anterior / substituido_por (provius-mudar-tipo.sql).

const TIPO_ROT = { '': 'Comum', C: 'Campo / Quadra', R: 'Reequilíbrio', MP: 'Manutenção preventiva', RM: 'Remodelamento', V: 'Locais violentos' };
const MT = { p: null, prox: {} };

// número que o processo antigo virou (pela lista carregada)
function tipoNumNovo(d) { const n = D.find(x => x.id === d.substituido_por); return n ? n.numero : 'outro número'; }

// faixa do número antigo (cancelado por mudança de tipo), com o link para o processo novo
function tipoFaixa(p) {
  return `<div class="faixa-dev mt-faixa" style="margin:0"><span><b>CANCELADO · MUDANÇA DE TIPO</b><br>${esc(p.cancel_texto || '')}</span>
    <button type="button" class="btn peq" data-mt-novo="${p.substituido_por}">Abrir ${esc(tipoNumNovo(p))} →</button></div>`;
}

function tipoDetalhe(p, barra) {
  const b = $('#det-corpo [data-mt-novo]');
  if (b) {   // número antigo: o histórico, os arquivos e o traçado ficaram no número novo
    b.onclick = () => detalhe(+b.dataset.mtNovo); barra.remove();
    const arq = $('#det-corpo .det-arq'); if (arq && !(p.arquivos || []).length) arq.querySelector('p.ajuda').textContent = 'Os arquivos ficaram no processo ' + tipoNumNovo(p) + '.';
  }
  if (!EU || !EU.admin || SEM_TIPO || p.cancelado || p.etapa >= 6 || p.substituido_por) return;
  const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn peq'; bt.textContent = '⇄ Mudar tipo';
  bt.title = 'Trocar o tipo do processo sem perder o histórico (só o administrador)';
  bt.onclick = () => tipoAbrir(p); barra.prepend(bt);
}

async function tipoAbrir(p) {
  MT.p = p; const atual = p.tipo || '';
  const { data } = await sb.from('contadores').select('*').eq('ano', p.ano); MT.prox = {}; (data || []).forEach(c => MT.prox[c.tipo] = c.ultimo);
  const num = t => (t ? t + '-' : '') + String((MT.prox[t] || 0) + 1).padStart(4, '0') + '/' + p.ano;
  $('#mt-tit').textContent = 'Mudar tipo · ' + p.numero;
  $('#mt-atual').textContent = (TIPO_ROT[atual] || atual) + ' · ' + p.numero;
  $('#mt-tipos').innerHTML = ['', 'C', 'R', 'MP', 'RM', 'V'].filter(t => t !== atual).map((t, i) => `<label class="opcao"><input type="radio" name="mt-tipo" value="${t}"${i ? '' : ' checked'}><span><b>${TIPO_ROT[t]}</b><small>vira ${num(t)}</small></span></label>`).join('');
  $$('input[name=mt-aq]').forEach(r => r.checked = false);
  $('#mt-serv').value = ''; $('#mt-motivo').value = ''; $('#mt-erro').hidden = true;
  $$('input[name=mt-tipo]').forEach(r => r.onchange = tipoAvisos); tipoAvisos();
  fechaModal('#modal-det'); abreModal('#modal-tipo');
}

function tipoAvisos() {
  const p = MT.p, novo = $('input[name=mt-tipo]:checked').value, deR = (p.tipo || '') === 'R', av = [];
  $('#mt-aq-c').hidden = novo !== 'R';
  $('#mt-serv-c').hidden = !(deR || p.tipo_servico === 'REEQUILÍBRIO') || novo === 'R';
  av.push(`O número <b>${esc(p.numero)}</b> fica na lista como <b>CANCELADO</b>, indicando o número novo. O histórico, os arquivos, as observações e o traçado no mapa passam para o número novo.`);
  if (deR) av.push('Os itens de reequilíbrio lançados neste processo <b>saem do saldo</b> (ficam escritos no histórico).');
  if (novo === 'MP') av.push(p.etapa > 1 ? 'MP- é só desenho: o processo é <b>concluído agora</b>, sem Execução, Cadastro, As built e AGEMAN.' : 'MP- é só desenho: quando Projetos entregar o projeto (com Tabela de Carga e traçado), o processo é concluído.');
  else if (novo === 'R') av.push(p.etapa > 1 ? 'Os itens de reequilíbrio só são lançados na Tela 2 (projeto). Como o processo já passou dessa etapa, ele só vai abater do saldo se for devolvido para Projetos.' : 'Projetos lança os itens de reequilíbrio na Tela 2 antes de entregar. A tabela de carga, se já preenchida, fica guardada, mas o R- não usa.');
  else if (deR) av.push('Os outros tipos usam a Tabela de Carga: Projetos preenche na Tela 2 (ou no As built) antes de entregar.');
  if (novo === 'RM' || novo === 'V') av.push(TIPO_ROT[novo] + ' segue o fluxo normal, como o Comum.');
  if (novo === 'C' || (p.tipo || '') === 'C') av.push('O traçado no mapa troca de camada junto (Campos e Quadras ↔ zona do bairro).');
  $('#mt-aviso').innerHTML = av.map(t => `<li>${t}</li>`).join('');
}

async function tipoConfirmar() {
  const p = MT.p, novo = $('input[name=mt-tipo]:checked')?.value, aq = $('input[name=mt-aq]:checked')?.value, mot = $('#mt-motivo').value.trim(), serv = $('#mt-serv').value;
  const erro = t => { $('#mt-erro').textContent = t; $('#mt-erro').hidden = false; };
  if (novo == null) return erro('Escolha o novo tipo.');
  if (novo === 'R' && !aq) return erro('Diga se o reequilíbrio é adquirido ou não adquirido.');
  if (!$('#mt-serv-c').hidden && !serv) return erro('Escolha o tipo de serviço.');
  if (!mot) return erro('Escreva o motivo da mudança.');
  const r = await tarefa(() => rpc('mudar_tipo', { p_id: p.id, p_tipo: novo, p_motivo: mot, p_adquirido: novo === 'R' ? aq === 'sim' : null, p_servico: $('#mt-serv-c').hidden ? null : serv }));
  if (!r) return;
  fechaModal('#modal-tipo'); toast(`${r.anterior} virou ${r.numero} · o número antigo ficou como cancelado`);
  await recarregar(); detalhe(r.id);
}

$('#mt-ok').onclick = tipoConfirmar;
