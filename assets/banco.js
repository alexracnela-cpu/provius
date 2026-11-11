// PROVIUS · Uso do banco de dados (só o administrador)
//
// Mostra o espaço usado no Supabase contra os limites do plano gratuito:
//   banco de dados 500 MB · arquivos (Storage) 1 GB · 50 MB por arquivo.
// Os números vêm da função uso_banco() (arquivo provius-uso-banco.sql), que também
// guarda uma foto por dia para mostrar o crescimento.

const BD = { dados: null, carregadoEm: 0 };
let SEM_BANCO = false;   // banco ainda sem a função uso_banco()
const BD_ROT = { ...{ pedido: 'Pedido', croqui: 'Croqui', projeto: 'Projeto', correcoes: 'Correções de campo', plaquetas: 'As built com plaqueta', asbuilt: 'As built final' }, carta: 'Carta de envio', comprovante: 'Comprovante de envio', outros: 'Outros' };
const fmtB = b => { b = Number(b || 0); if (b < 1024 * 1024) return (b / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' KB'; if (b < 1024 ** 3) return (b / 1024 ** 2).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB'; return (b / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' GB'; };
const bdSit = p => p > 1 ? 'est' : p >= 0.8 ? 'ate' : 'nor';
const bdMes = m => { const [a, n] = String(m).split('-'); return MESES[+n - 1].slice(0, 3) + '/' + a.slice(2); };

async function bancoCarregar(forcar) {
  if (SEM_BANCO) return false;
  if (!forcar && BD.dados && Date.now() - BD.carregadoEm < 60000) return true;
  const { data, error } = await sb.rpc('uso_banco');
  if (error) { if (/Could not find the function|schema cache/i.test(error.message || '')) { SEM_BANCO = true; return false; } throw new Error(msgErro(error)); }
  BD.dados = data; BD.carregadoEm = Date.now(); return true;
}

// selo na aba quando o banco ou os arquivos passam de 80% do limite
async function bancoAba() {
  if (!EU || !EU.admin) return;
  try { if (!(await bancoCarregar())) return; } catch (e) { return; }
  const d = BD.dados, n = [d.banco_bytes / d.limites.banco, d.storage_bytes / d.limites.storage].filter(p => p >= 0.8).length, b = $('#bd-badge');
  b.hidden = !n; b.textContent = n; b.title = 'Uso acima de 80% do limite do plano'; $('#adm-ponto').hidden = !n;
}

function bancoIniciar() {
  $('#bd-recarregar').onclick = () => tarefa(async () => { await bancoCarregar(true); bancoDesenha(); bancoAba(); }, 'Atualizado');
}
async function bancoAbrir() {
  const ok = await tarefa(() => bancoCarregar());
  $('#bd-corpo').hidden = !ok; $('#bd-vazio').hidden = !!ok;
  if (ok) bancoDesenha();
}

// quantos meses até o limite, no ritmo médio dos últimos 6 meses fechados + o atual
function bdPrevisao(usado, limite, porMes) {
  if (porMes <= 0) return 'sem crescimento recente';
  if (usado >= limite) return 'limite já atingido';
  const m = (limite - usado) / porMes;
  if (m > 120) return 'mais de 10 anos até o limite, no ritmo atual';
  const quando = new Date(); quando.setMonth(quando.getMonth() + Math.floor(m));
  return 'no ritmo atual, chega ao limite em ' + (m < 1 ? 'menos de 1 mês' : Math.round(m) + (Math.round(m) === 1 ? ' mês' : ' meses')) + ' (' + MESES[quando.getMonth()].slice(0, 3) + '/' + quando.getFullYear() + ')';
}
// minigráfico das fotos diárias
function bdLinha(pts, lim) {
  if (pts.length < 2) return '<span class="ajuda">O gráfico diário aparece a partir da 2ª foto (uma por dia).</span>';
  const W = 220, H = 36, mx = Math.max(...pts), mn = Math.min(...pts), am = (mx - mn) || mx || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * W, H - 3 - ((v - mn) / am) * (H - 6)]);
  return `<svg class="bd-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Uso nos últimos ${pts.length} dias: de ${fmtB(pts[0])} a ${fmtB(pts[pts.length - 1])}"><polyline points="${xy.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"/></svg>`;
}

function bancoDesenha() {
  const d = BD.dados; if (!d) return;
  const L = d.limites, pB = d.banco_bytes / L.banco, pS = d.storage_bytes / L.storage;
  $('#bd-sub').textContent = 'Projeto do Provius no Supabase · plano gratuito · medido em ' + dataHora(d.medido_em);

  // ritmo de crescimento dos arquivos: média dos últimos 6 meses (o atual conta proporcional)
  const meses = d.storage_meses || [], hoje = new Date();
  const chaves = []; for (let i = 5; i >= 0; i--) { const t = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); chaves.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`); }
  const porChave = {}; meses.forEach(m => porChave[m.mes] = m);
  const fracAtual = hoje.getDate() / new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  // só contam os meses desde o primeiro arquivo enviado (o mês atual entra pela fração já passada)
  const prim = meses.length ? meses[0].mes : chaves[5];
  const fechados = chaves.slice(0, 5).filter(k => k >= prim).length;
  const somaS = chaves.reduce((a, k) => a + Number(porChave[k]?.bytes || 0), 0), nMes = Math.max(fracAtual, fechados + fracAtual);
  const ritmoS = somaS / nMes;
  // ritmo do banco: pelas fotos diárias (precisa de pelo menos 7 dias)
  const reg = d.registro || [];
  let ritmoB = null;
  if (reg.length >= 2) { const a = reg[0], b = reg[reg.length - 1], dias = (new Date(b.dia) - new Date(a.dia)) / 864e5; if (dias >= 7) ritmoB = (b.banco_bytes - a.banco_bytes) / dias * 30.4; }

  // alerta
  const al = [];
  if (pB >= 0.8) al.push(`Banco de dados em ${Math.round(pB * 100)}% do limite (${fmtB(d.banco_bytes)} de ${fmtB(L.banco)})`);
  if (pS >= 0.8) al.push(`Arquivos em ${Math.round(pS * 100)}% do limite (${fmtB(d.storage_bytes)} de ${fmtB(L.storage)})`);
  $('#bd-alerta').hidden = !al.length; $('#bd-alerta').classList.toggle('bd-ate', pB <= 1 && pS <= 1);
  $('#bd-alerta').innerHTML = al.length ? `<b>⚠ ${pB > 1 || pS > 1 ? 'Limite do plano ultrapassado' : 'Atenção ao espaço'}</b><span>${al.map(esc).join(' · ')}. Antes de chegar a 100%, avalie apagar arquivos repetidos ou passar para o plano pago.</span>` : '';

  // resumo
  const kpi = (rot, val, p, txt, extra) => { const s = p == null ? '' : bdSit(p); return `<div class="sd-kpi"><span class="r">${rot}</span><b>${val}</b>${p != null ? `<span class="sd-bar m"><i class="k-${s}" style="width:${Math.min(100, p * 100)}%"></i><em></em></span>` : ''}<span class="ajuda">${p != null ? `<span class="sd-sit k-${s}">${{ nor: 'Normal', ate: 'Atenção', est: 'Acima do limite' }[s]}</span> ` : ''}${txt}</span>${extra || ''}</div>`; };
  const mediaArq = d.storage_qtd ? d.storage_bytes / d.storage_qtd : 0;
  $('#bd-kpis').innerHTML =
    kpi('Banco de dados', fmtB(d.banco_bytes), pB, `${Math.round(pB * 100)}% de ${fmtB(L.banco)} · ${ritmoB == null ? 'previsão a partir de 7 dias de fotos' : bdPrevisao(d.banco_bytes, L.banco, ritmoB)}`, bdLinha(reg.slice(-60).map(r => Number(r.banco_bytes)))) +
    kpi('Arquivos (PDFs e fotos)', fmtB(d.storage_bytes), pS, `${Math.round(pS * 100)}% de ${fmtB(L.storage)} · ${bdPrevisao(d.storage_bytes, L.storage, ritmoS)}`, bdLinha(reg.slice(-60).map(r => Number(r.storage_bytes)))) +
    kpi('Quantidade de arquivos', fmt(d.storage_qtd), null, `média de ${fmtB(mediaArq)} por arquivo · limite de ${fmtB(L.arquivo)} cada`) +
    kpi('Crescimento dos arquivos', fmtB(ritmoS) + '/mês', null, 'média dos últimos 6 meses');

  // arquivos por mês (últimos 12 meses)
  const M12 = []; for (let i = 11; i >= 0; i--) { const t = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; M12.push({ mes: k, bytes: Number(porChave[k]?.bytes || 0), qtd: Number(porChave[k]?.qtd || 0) }); }
  const antes = meses.filter(m => m.mes < M12[0].mes).reduce((a, m) => a + Number(m.bytes), 0);
  let ac = antes; M12.forEach(m => { ac += m.bytes; m.acum = ac; });
  const mx = Math.max(1, ...M12.map(m => m.bytes));
  $('#bd-meses').innerHTML = M12.map((m, i) => `<div class="bd-col${i === 11 ? ' atual' : ''}" tabindex="0" aria-label="${bdMes(m.mes)}: ${fmtB(m.bytes)} em ${m.qtd} arquivos; total acumulado ${fmtB(m.acum)}">
      <span class="bd-tip"><b>${bdMes(m.mes)}${i === 11 ? ' (até hoje)' : ''}</b>${fmtB(m.bytes)} · ${fmt(m.qtd)} ${m.qtd === 1 ? 'arquivo' : 'arquivos'}<small>acumulado: ${fmtB(m.acum)}</small></span>
      <span class="bd-v">${m.bytes ? fmtB(m.bytes) : ''}</span>
      <span class="bd-barra"><i style="height:${m.bytes ? Math.max(2, m.bytes / mx * 100) : 0}%"></i></span>
      <span class="bd-m">${bdMes(m.mes)}</span></div>`).join('');

  // arquivos por tipo
  const tipos = d.storage_tipos || [], tot = Math.max(1, d.storage_bytes);
  $('#bd-tipos').innerHTML = tipos.map(t => `<tr><td>${esc(BD_ROT[t.tipo] || t.tipo)}</td><td class="num">${fmt(t.qtd)}</td><td class="num">${fmtB(t.bytes)}</td><td><span class="sd-pct"><span class="sd-bar"><i style="width:${t.bytes / tot * 100}%"></i></span><b>${Math.round(t.bytes / tot * 100)}%</b></span></td></tr>`).join('') || '<tr><td colspan="4" class="vazio">Nenhum arquivo enviado ainda.</td></tr>';

  // tabelas
  const tabs = d.tabelas || [], totT = Math.max(1, d.provius_bytes);
  $('#bd-tabelas').innerHTML = tabs.map(t => `<tr><td class="nn">${esc(t.nome)}</td><td class="num">${fmt(t.linhas)}</td><td class="num">${fmtB(t.bytes)}</td><td><span class="sd-pct"><span class="sd-bar"><i style="width:${t.bytes / totT * 100}%"></i></span><b>${Math.round(t.bytes / totT * 100)}%</b></span></td></tr>`).join('');
  $('#bd-tab-nota').textContent = `As tabelas do Provius somam ${fmtB(d.provius_bytes)}. O restante dos ${fmtB(d.banco_bytes)} é do próprio Supabase (login, sistema e índices internos), que já vem ocupado em todo projeto.`;

  // maiores arquivos
  $('#bd-maiores').innerHTML = (d.maiores || []).map(a => `<tr><td><button type="button" class="link-pdf" data-c="${esc(a.caminho)}">${esc(a.nome)}</button></td><td class="nn">${esc(a.numero || '—')}</td><td>${esc(BD_ROT[a.tipo] || a.tipo || '—')}</td><td class="num">${fmtB(a.bytes)}</td><td>${dataBR(a.em)}</td></tr>`).join('') || '<tr><td colspan="5" class="vazio">Nenhum arquivo enviado ainda.</td></tr>';
  $$('#bd-maiores [data-c]').forEach(b => b.onclick = () => abrirNovaAba(b.dataset.c));
}
