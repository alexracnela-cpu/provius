// PROVIUS · 6 · Entrega para a AGEMAN (Setor de Projetos)
// "Novo lote": processos prontos (etapa 5), carta e registro do envio.
// "Envios anteriores": os lotes já enviados, lidos dos movimentos (os envios feitos juntos viram um lote só,
// como na tela Histórico) e, para os de antes do Provius, da data de envio da planilha.
const AG = { sel: new Set(), carta: null, cartaPronta: null, vc: null, modo: 'lote', ant: null, ano: null, codigo: null, lotes: null };

function agIniciar() {
  caixaPdf('#ag-arq', '#ag-up');
  $$('#ag-modo button').forEach(b => b.onclick = () => agModo(b.dataset.m));
  $('#ag-todos').onchange = e => { AG.sel = e.target.checked ? new Set(filaDe(5).map(d => d.id)) : new Set(); agLista(); };
  $('#ag-carta').onclick = abrirCarta; $('#ag-enviar').onclick = registrarEnvio; $('#ag-unidos-bt').onclick = agUnidosTodos;
  $('#ct-gerar').onclick = cartaPrevia; ['#ct-num', '#ct-data', '#ct-dest', '#ct-att', '#ct-attc', '#ct-ass', '#ct-ref', '#ct-link', '#ct-nome', '#ct-cargo'].forEach(s => $(s).addEventListener('change', cartaPrevia));
  AG.vc = criaVisor({ area: '#ct-area', canvas: '#ct-cv' });
  const cartaOk = () => { if (!$('#ct-link').value.trim()) { toast('Cole o link de acesso antes', true); return false; } return true; }, cartaNome = ext => 'carta-' + $('#ct-num').value.replace(/\W+/g, '-') + '.' + ext;
  $('#ct-baixar').onclick = async () => { if (!cartaOk()) return; const sel = filaDe(5).filter(d => AG.sel.has(d.id)); const b = await tarefa(() => gerarCartaDocx(sel)); if (b) baixarBlob(cartaNome('docx'), b); };   // a carta sai em Word
  $('#ct-pdf').onclick = () => { if (!AG.carta || !cartaOk()) return; baixarBlob(cartaNome('pdf'), new Blob([AG.carta], { type: 'application/pdf' })); };
  $('#ct-anexar').onclick = () => { if (!AG.carta) return; if (!$('#ct-link').value.trim()) { $('#ct-link').closest('.campo').classList.add('invalido'); toast('Cole o link de acesso antes de usar a carta', true); return; }
    $('#ag-of').value = $('#ct-num').value; $('#ag-data').value = $('#ct-data').value; AG.cartaPronta = { bytes: AG.carta, num: $('#ct-num').value, link: $('#ct-link').value.trim() };
    fechaModal('#modal-carta'); toast('Carta pronta. Ela é guardada junto com o registro do envio.'); };
  $('#ct-link').addEventListener('input', loteDica);
  $('#ct-link-provius').onclick = () => { $('#ct-link').value = loteLink(loteNovoCodigo()); loteDica(); cartaPrevia(); };
  $('#an-ano').onchange = () => { AG.ano = $('#an-ano').value; agAntDesenha(); };
  $('#an-busca').oninput = agAntDesenha;
}
function agModo(m) {
  AG.modo = m; $$('#ag-modo button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
  $('#ag-lote').hidden = m !== 'lote'; $('#ag-ant').hidden = m !== 'ant';
  if (m === 'ant') agAntCarregar(); else agLista();
}
async function agAbrir() {
  if (!$('#ag-data').value) $('#ag-data').value = hojeISO();
  agModo(AG.modo);
  if (AG.loteOk === undefined) { const t = await sb.rpc('lotes_resumo'); AG.loteOk = !t.error; }   // o link do lote só depois de rodar provius-link-lote.sql
  // próximo número de carta, a partir da última registrada
  const { data } = await sb.from('envios').select('numero_carta').not('numero_carta', 'is', null).order('id', { ascending: false }).limit(1);
  const u = data && data[0] && data[0].numero_carta;
  $('#ag-of-dica').textContent = u ? 'A última carta registrada foi a ' + u + '. Gere a carta para numerar a próxima.' : '';
}

// ---------- novo lote ----------
const agServ = d => d.tipo === 'R' ? 'REEQUILÍBRIO' : (d.tipo_servico === 'EXPANSÃO' ? 'CRESCIMENTO VEGETATIVO' : d.tipo_servico) || '—';
function agLista() {
  const f = filaDe(5); AG.sel = new Set([...AG.sel].filter(id => f.some(d => d.id === id)));
  $('#ag-lista').innerHTML = f.map(d => { const dd = diasDesde(d.etapa_desde);
    return `<tr><td><input type="checkbox" data-id="${d.id}" ${AG.sel.has(d.id) ? 'checked' : ''} aria-label="Selecionar ${esc(d.numero)}"></td><td class="nn"><button type="button" class="link-pdf" data-det="${d.id}">${esc(d.numero)}</button>${seloUrg(d)}</td><td>${esc(d.logradouro)}</td><td>${esc(d.bairro || '')}</td><td><span class="etq ag-etq">${esc(agServ(d))}</span></td><td class="num">${d.total_pontos}</td>
      <td>${dd === null ? '—' : `<span class="pill ${dd > 15 ? 'dev' : 'dias'}" style="margin:0">${dd} dia${dd === 1 ? '' : 's'}</span>`}</td>
      <td class="ag-arqs"><button class="link-pdf" type="button" data-ab="${d.id}">As built</button>${d.tipo === 'R' ? '' : ` · <button class="link-pdf" type="button" data-tc="${d.id}">Tabela de carga</button>`} · <button class="link-pdf ag-uni" type="button" data-uni="${d.id}" title="As built + tabela de carga num PDF só">⬇ Unido</button></td></tr>`; }).join('') || '<tr><td colspan="8" class="vazio">Nenhum processo pronto para enviar.</td></tr>';
  $$('#ag-lista input').forEach(c => c.onchange = () => { const id = +c.dataset.id; c.checked ? AG.sel.add(id) : AG.sel.delete(id); agLista(); });
  $$('#ag-lista [data-det]').forEach(b => b.onclick = () => detalhe(+b.dataset.det));
  $$('#ag-lista [data-ab]').forEach(b => b.onclick = async () => { const { data } = await sb.from('arquivos').select('*').eq('processo_id', +b.dataset.ab).eq('tipo', 'asbuilt').order('em', { ascending: false }).limit(1); if (data && data[0]) verArquivo(data[0], 'As built'); else toast('Sem PDF de as built (processo do histórico).', true); });
  $$('#ag-lista [data-tc]').forEach(b => b.onclick = () => tcPdfDoProcesso(+b.dataset.tc));
  $$('#ag-lista [data-uni]').forEach(b => b.onclick = () => agUnidoBaixar(+b.dataset.uni));
  const nU = AG.sel.size || f.length;
  $('#ag-unidos').hidden = !f.length;
  $('#ag-unidos-bt').textContent = '⬇ Baixar PDFs unidos ' + (AG.sel.size ? 'dos selecionados' : 'de todos') + ' (' + nU + ')';
  const sp = f.filter(d => AG.sel.has(d.id)).reduce((a, d) => a + d.total_pontos, 0);
  $('#ag-cont').textContent = AG.sel.size ? AG.sel.size + ' de ' + f.length + ' selecionados · ' + fmt(sp) + ' pontos' : f.length + ' processo' + (f.length === 1 ? '' : 's');
  $('#ag-enviar').textContent = AG.sel.size ? 'Registrar envio à AGEMAN (' + AG.sel.size + ')' : 'Registrar envio à AGEMAN';
  $('#ag-todos').checked = f.length > 0 && AG.sel.size === f.length;
  // resumo
  const velho = f.reduce((m, d) => diasDesde(d.etapa_desde) > (m ? diasDesde(m.etapa_desde) : -1) ? d : m, null);
  const ano = new Date().getFullYear(), env = D.filter(d => d.etapa === 6 && d.enviado_ageman && +String(d.enviado_ageman).slice(0, 4) === ano);
  const ult = D.filter(d => d.etapa === 6 && d.enviado_ageman).sort((a, b) => String(b.enviado_ageman).localeCompare(String(a.enviado_ageman)))[0];
  const nUlt = ult ? D.filter(d => d.etapa === 6 && d.enviado_ageman === ult.enviado_ageman).length : 0;
  const k = (r, v, s) => `<div class="sd-kpi"><span class="r">${r}</span><b>${v}</b><span class="ajuda">${s}</span></div>`;
  $('#ag-kpis').innerHTML = k('Prontos para enviar', f.length + (f.length === 1 ? ' processo' : ' processos'), fmt(f.reduce((a, d) => a + d.total_pontos, 0)) + ' pontos aguardando') +
    k('Mais antigo esperando', velho ? diasDesde(velho.etapa_desde) + ' dias' : '—', velho ? esc(velho.numero) + ' · pronto desde ' + dataBR(velho.etapa_desde) : 'nenhum na fila') +
    k('Último envio', ult ? dataBR(ult.enviado_ageman) : '—', ult ? nUlt + (nUlt === 1 ? ' processo' : ' processos') : 'nenhum registrado') +
    k('Enviados em ' + ano, fmt(env.length) + (env.length === 1 ? ' processo' : ' processos'), fmt(env.reduce((a, d) => a + d.total_pontos, 0)) + ' pontos');
}
async function abrirCarta() {
  if (!AG.sel.size) { toast('Selecione os projetos que vão na carta', true); return; }
  if (!$('#ct-num').value) { const { data } = await sb.from('envios').select('numero_carta').not('numero_carta', 'is', null).order('id', { ascending: false }).limit(1);
    const u = data && data[0] && /^(\d+)\/(\d{4})$/.exec(data[0].numero_carta), ano = new Date().getFullYear();
    $('#ct-num').value = u && +u[2] === ano ? String(+u[1] + 1).padStart(4, '0') + '/' + ano : ''; }
  if (!$('#ct-data').value) $('#ct-data').value = $('#ag-data').value || hojeISO();
  if (!$('#ct-link').value.trim() && AG.loteOk) $('#ct-link').value = loteLink(loteNovoCodigo());   // padrão: o link do Provius
  loteDica(); abreModal('#modal-carta'); cartaPrevia();
}
async function cartaPrevia() {
  const sel = filaDe(5).filter(d => AG.sel.has(d.id));
  const r = await tarefa(() => gerarCarta(sel)); if (!r) return; AG.carta = r.bytes;
  $('#ct-info').textContent = `${sel.length} projeto${sel.length === 1 ? '' : 's'} · ${r.tot} pontos · ${r.paginas} página${r.paginas > 1 ? 's' : ''}` + ($('#ct-link').value.trim() ? '' : ' · falta o link');
  AG.vc.abrir(r.bytes, 'carta.pdf');
}
async function registrarEnvio() {
  const ids = [...AG.sel]; if (!ids.length) { toast('Selecione pelo menos um processo', true); return; }
  const data = $('#ag-data').value; if (!data) { toast('Informe a data do envio', true); return; }
  const comp = $('#ag-up')._arqs[0], carta = AG.cartaPronta, numCarta = $('#ag-of').value.trim();
  // sem link (envio registrado sem gerar a carta): o Provius cria o link do lote
  let link = carta?.link || $('#ct-link').value.trim();
  if (!link && AG.loteOk) link = loteLink(loteNovoCodigo());
  const cod = loteCodigoDe(link);
  // link do Provius: junta os PDFs (as built + tabela de carga) de cada processo antes de registrar
  let prep = null;
  if (cod) {
    prep = await lotePreparar(ids); if (!prep) return;
    if (prep.avisos.length && !confirm('Atenção no link do lote:\n\n' + prep.avisos.join('\n') + '\n\nRegistrar o envio mesmo assim?')) return;
  }
  const r = await tarefa(async () => {
    let publicado = false;
    if (prep) { await lotePublicar(cod, prep, numCarta, data); publicado = true; }
    try {
      const pasta = 'envios/' + data.slice(0, 4);
      const c = carta ? await enviarArquivo(pasta, 'carta', new File([carta.bytes], 'carta.pdf', { type: 'application/pdf' })) : null;
      const k = comp ? await enviarArquivo(pasta, 'comprovante', comp) : null;
      return await rpc('registrar_envio', { p_ids: ids, p_carta: numCarta, p_data: data, p_link: link, p_oficio: null, p_carta_caminho: c?.caminho || null, p_comprovante: k?.caminho || null });
    } catch (e) {   // o envio não foi registrado: desliga o link que acabou de ser criado
      if (publicado) await sb.rpc('lote_desligar', { p_codigo: cod, p_motivo: 'Envio não registrado: ' + msgErro(e) });
      throw e;
    }
  });
  if (!r) return;
  toast(ids.length + ' processo' + (ids.length > 1 ? 's' : '') + ' enviado' + (ids.length > 1 ? 's' : '') + ' à AGEMAN em ' + dataBR(data) + (cod ? ' · link do lote no ar' : ''));
  AG.sel.clear(); AG.cartaPronta = null; AG.ant = null; AG.codigo = null; AG.lotes = null; $('#ag-up')._limpa(); $('#ag-of').value = ''; $('#ct-num').value = ''; $('#ct-link').value = '';
  await recarregar(); agAbrir();
}

// ---------- link do lote: página pública lote.html?c=<código> com os PDFs congelados do envio ----------
const LOTE_RE = /lote\.html\?(?:[^#]*&)?c=([A-Za-z0-9]{20,64})/;
function loteNovoCodigo() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', a = new Uint8Array(24); crypto.getRandomValues(a);
  return AG.codigo = [...a].map(b => L[b % L.length]).join('');   // 24 letras: impossível de adivinhar
}
const loteLink = c => new URL('lote.html?c=' + c, location.href.split(/[?#]/)[0]).href;
const loteCodigoDe = link => LOTE_RE.exec(link || '')?.[1] || null;
function loteDica() {
  const v = $('#ct-link').value.trim(), meu = loteCodigoDe(v);
  $('#ct-link-dica').textContent = meu ? 'Link do Provius: os PDFs do lote (as built + tabela de carga) ficam disponíveis nele quando o envio for registrado. Não vence.'
    : v ? 'Link de fora do Provius (reserva): confira se a pasta tem todos os arquivos e está aberta para a AGEMAN.' : '';
  $('#ct-link-provius').hidden = !!meu || !AG.loteOk;
}
// junta os PDFs de cada processo (o mesmo "Unido" da lista: as built + tabela de carga)
async function lotePreparar(ids) {
  const lista = filaDe(5).filter(d => ids.includes(d.id)), itens = [], avisos = [];
  ocupado(true);
  try {
    for (const [i, d] of lista.entries()) {
      toast(`Preparando o link do lote: ${i + 1} de ${lista.length} (${d.numero})…`);
      try {
        const r = await agUnido(d.id);
        if (!r.bytes) { avisos.push('• ' + d.numero + ': sem as built e sem tabela de carga no Provius (fica fora do link)'); continue; }
        if (r.faltou.length) avisos.push('• ' + d.numero + ': vai sem ' + r.faltou.join(' e '));
        itens.push({ d, p: r.p, bytes: r.bytes });
      } catch (e) { console.error(e); toast(d.numero + ': ' + msgErro(e), true); return null; }
    }
  } finally { ocupado(false); }
  if (!itens.length) { toast('Nenhum processo selecionado tem PDF no Provius para o link. Use um link de fora (pasta do Drive).', true); return null; }
  return { itens, avisos };
}
// envia os PDFs para envios/AAAA/lote-<código>/ (cópia fixa: mudanças depois do envio não alteram o link) e grava o lote
async function lotePublicar(cod, prep, carta, data) {
  const pasta = `envios/${data.slice(0, 4)}/lote-${cod}`, arqs = [];
  for (const [i, it] of prep.itens.entries()) {
    const caminho = `${pasta}/${String(i + 1).padStart(3, '0')}-${String(it.d.numero).replace(/[^A-Za-z0-9]+/g, '-')}.pdf`;
    const { error } = await sb.storage.from(BUCKET).upload(caminho, new Blob([it.bytes], { type: 'application/pdf' }), { upsert: false, contentType: 'application/pdf' });
    if (error) throw new Error('Não consegui guardar o PDF de ' + it.d.numero + ' para o link: ' + msgErro(error));
    arqs.push({ ordem: i, processo_id: it.d.id, numero: it.d.numero, logradouro: it.d.logradouro, bairro: it.d.bairro || '', pontos: it.d.total_pontos || 0, caminho, nome: agNomeArq(it.p), tamanho: it.bytes.length });
  }
  await rpc('lote_publicar', { p_codigo: cod, p_carta: carta || null, p_data: data, p_arquivos: arqs });
}

// ---------- PDF unido: as built enviado + tabela de carga (uma página atrás da outra) ----------
const agNomeArq = p => nomeProcesso(p) + '.pdf';   // ex.: C-0023-2026 - AV. TARUMÃ COM R. SILVA RAMOS - CENTRO.pdf
async function agUnido(id) {
  const p = await carregarProcesso(id), faltou = [];
  const out = await PDFLib.PDFDocument.create(); out.setTitle('As built e tabela de carga ' + p.numero); out.setProducer('Provius');
  const asb = ultimoArquivo(p, 'asbuilt');
  if (asb) {
    const src = await PDFLib.PDFDocument.load(await bytesDe(asb.caminho), { ignoreEncryption: true });
    (await out.copyPages(src, src.getPageIndices())).forEach(pg => out.addPage(pg));
  } else faltou.push('as built');
  const temAsb = tcTemLinhas(p.tabela_carga_asb), t = temAsb ? p.tabela_carga_asb : p.tabela_carga;
  if (p.tipo !== 'R' && tcTemLinhas(t)) {
    const r = await gerarTabelaCarga(p, t, { asbuilt: temAsb, base: temAsb ? p.tabela_carga : null, por: EU?.nome });
    const src = await PDFLib.PDFDocument.load(r.bytes);
    (await out.copyPages(src, src.getPageIndices())).forEach(pg => out.addPage(pg));
  } else if (p.tipo !== 'R') faltou.push('tabela de carga');
  if (!out.getPageCount()) return { p, bytes: null, faltou };
  return { p, bytes: await out.save(), faltou };
}
async function agUnidoBaixar(id) {
  const r = await tarefa(() => agUnido(id)); if (!r) return;
  if (!r.bytes) { toast(r.p.numero + ': sem as built e sem tabela de carga no Provius.', true); return; }
  baixarBlob(agNomeArq(r.p), new Blob([r.bytes], { type: 'application/pdf' }));
  if (r.faltou.length) toast(r.p.numero + ': baixado sem ' + r.faltou.join(' e ') + ' (não está no Provius).', true);
}
// todos da lista (ou só os selecionados) num ZIP, um PDF por processo
async function agUnidosTodos() {
  const lista = filaDe(5).filter(d => !AG.sel.size || AG.sel.has(d.id)); if (!lista.length) return;
  const arqs = {}, avisos = [];
  ocupado(true);
  try {
    for (const [i, d] of lista.entries()) {
      toast(`Juntando ${i + 1} de ${lista.length}: ${d.numero}…`);
      try {
        const r = await agUnido(d.id);
        if (r.bytes) arqs[agNomeArq(r.p)] = r.bytes; else avisos.push(d.numero + ' (sem arquivos)');
        if (r.bytes && r.faltou.length) avisos.push(d.numero + ' sem ' + r.faltou.join(' e '));
      } catch (e) { console.error(e); avisos.push(d.numero + ' (erro: ' + msgErro(e) + ')'); }
    }
  } finally { ocupado(false); }
  const n = Object.keys(arqs).length;
  if (!n) { toast('Nenhum PDF para juntar: ' + avisos.join(' · '), true); return; }
  baixarBlob('ageman-as-built-' + hojeISO() + '.zip', new Blob([zipStore(arqs)], { type: 'application/zip' }));
  toast(n + ' PDF' + (n > 1 ? 's' : '') + ' unido' + (n > 1 ? 's' : '') + ' no ZIP' + (avisos.length ? ' · atenção: ' + avisos.join(' · ') : ''), !!avisos.length);
}

// ---------- envios anteriores ----------
async function agAntCarregar(forcar) {
  if (AG.ant && !forcar) { agAntDesenha(); return; }
  const r = await tarefa(async () => {
    let movs = [], de = 0; const N = 1000;
    for (; ;) {
      const { data, error } = await sb.from('movimentos').select('*').in('acao', ['enviar', 'desfazer_envio']).order('em', { ascending: false }).range(de, de + N - 1);
      if (error) throw error; movs = movs.concat(data); if (data.length < N || movs.length >= 10000) break; de += N;
    }
    const e = await sb.from('envios').select('*').order('id', { ascending: false }).limit(2000);
    const lt = await sb.rpc('lotes_resumo');   // links do lote (vazio se o SQL ainda não foi rodado)
    return { movs, envios: e.error ? [] : e.data || [], lotes: lt.error ? [] : lt.data || [] };
  });
  if (!r) return;
  AG.lotes = Object.fromEntries(r.lotes.map(x => [x.codigo, x]));
  // lotes registrados no Provius (mesma pessoa, mesmo minuto)
  const desf = r.movs.filter(m => m.acao === 'desfazer_envio');
  const lotes = histAgrupar(r.movs.filter(m => m.acao === 'enviar')).map(g => {
    const ids = [...new Set(g.itens.map(m => m.processo_id))];
    const desfeitos = ids.filter(id => desf.some(m => m.processo_id === id && new Date(m.em) > new Date(g.em)));
    const ev = agEnvioDe(g, r.envios), cartaTxt = /carta\s*(?:n[ºo°.]*\s*)?([\w./-]+)/i.exec(g.texto || '')?.[1];
    const dataEnvio = String(ev?.data_envio || ev?.data || g.em).slice(0, 10);
    return { provius: true, em: g.em, data: dataEnvio, por: g.por_nome, ids, desfeito: desfeitos.length === ids.length, desfeitos, desfTxt: desf.find(m => ids.includes(m.processo_id) && new Date(m.em) > new Date(g.em)),
      carta: ev?.numero_carta || cartaTxt || '', link: ev?.link || '', cartaArq: ev?.carta_caminho || (typeof ev?.carta === 'string' && /\.pdf$/i.test(ev.carta) ? ev.carta : ''), comprovante: ev?.comprovante_caminho || ev?.comprovante || '' };
  });
  // envios de antes do Provius (só a data da planilha): um lote por data
  const noProvius = new Set(lotes.flatMap(l => l.ids));
  const porData = {};
  D.filter(d => d.etapa === 6 && d.enviado_ageman && !noProvius.has(d.id)).forEach(d => { const k = String(d.enviado_ageman).slice(0, 10); (porData[k] = porData[k] || []).push(d.id); });
  Object.entries(porData).forEach(([k, ids]) => lotes.push({ provius: false, em: k + 'T12:00:00', data: k, ids, desfeitos: [] }));
  lotes.sort((a, b) => b.data.localeCompare(a.data) || String(b.em).localeCompare(String(a.em)));
  AG.ant = lotes;
  const anos = [...new Set(lotes.map(l => l.data.slice(0, 4)))].sort().reverse();
  if (!AG.ano || !anos.includes(AG.ano)) AG.ano = anos[0] || String(new Date().getFullYear());
  $('#an-ano').innerHTML = anos.map(a => `<option${a === AG.ano ? ' selected' : ''}>${a}</option>`).join('') + '<option value="*"' + (AG.ano === '*' ? ' selected' : '') + '>Todos</option>';
  agAntDesenha();
}
// o registro da tabela envios que corresponde ao lote (pelo horário ou pelo nº da carta)
function agEnvioDe(g, envios) {
  const t0 = new Date(g.em).getTime();
  const perto = envios.find(e => ['em', 'criado_em', 'registrado_em', 'created_at'].some(k => e[k] && Math.abs(new Date(e[k]).getTime() - t0) < 3 * 60e3));
  if (perto) return perto;
  return envios.find(e => e.numero_carta && (g.texto || '').includes(e.numero_carta)) || null;
}
function agAntDesenha() {
  if (!AG.ant) return;
  const q = ($('#an-busca').value || '').trim().toUpperCase(), ano = $('#an-ano').value || AG.ano;
  const proc = id => D.find(d => d.id === id);
  const f = AG.ant.filter(l => (ano === '*' || l.data.startsWith(ano)) && (!q || (l.carta || '').toUpperCase().includes(q) || l.ids.some(id => { const d = proc(id); return d && (d.numero.includes(q) || (d.logradouro || '').toUpperCase().includes(q)); })));
  const validos = f.filter(l => !l.desfeito), nProc = validos.reduce((a, l) => a + l.ids.length - l.desfeitos.length, 0);
  const pts = validos.reduce((a, l) => a + l.ids.filter(id => !l.desfeitos.includes(id)).reduce((s, id) => s + (proc(id)?.total_pontos || 0), 0), 0);
  const k = (r, v, s) => `<div class="sd-kpi"><span class="r">${r}</span><b>${v}</b><span class="ajuda">${s}</span></div>`;
  const nd = f.length - validos.length;
  $('#an-kpis').innerHTML = k('Lotes' + (ano === '*' ? '' : ' em ' + ano), fmt(validos.length), nd ? nd + (nd === 1 ? ' desfeito' : ' desfeitos') : 'nenhum desfeito') +
    k('Processos enviados', fmt(nProc), validos.length ? 'média de ' + Math.round(nProc / validos.length) + ' por lote' : '—') + k('Pontos enviados', fmt(pts), ano === '*' ? 'todos os anos' : 'em ' + ano) +
    k('Registrados no Provius', fmt(validos.filter(l => l.provius).length), 'os demais vêm da planilha (só a data)');
  if (!f.length) { $('#an-lista').innerHTML = '<p class="vazio" style="padding:16px">Nenhum envio encontrado.</p>'; return; }
  $('#an-lista').innerHTML = f.slice(0, 200).map((l, i) => {
    const ps = l.ids.map(proc).filter(Boolean), tp = ps.reduce((a, d) => a + (d.total_pontos || 0), 0);
    const titulo = l.carta ? 'Carta ' + esc(l.carta) : l.provius ? 'Envio sem nº de carta' : 'Envio da planilha';
    const bts = l.provius ? [`<button type="button" class="btn peq" data-carta="${i}" title="${l.cartaArq ? 'A carta guardada no envio' : 'Sem carta guardada: o Provius monta de novo a partir do registro do envio'}">📄 Carta${l.cartaArq ? '' : ' (recriar)'}</button>`, l.comprovante ? `<button type="button" class="btn peq" data-arq="${esc(l.comprovante)}">📎 Comprovante</button>` : '', agLinkBts(l, i)].join('') : '<span class="ajuda">Envio de antes do Provius: só a data veio da planilha.</span>';
    return `<details class="ag-lote${l.desfeito ? ' desf' : ''}"${i === 0 ? ' open' : ''}>
      <summary><span class="ag-l1"><b class="nn">${titulo}</b><span>${dataBR(l.data)}${l.provius ? ' às ' + new Date(l.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>${l.por ? `<span>por <b>${esc(l.por)}</b></span>` : ''}</span>
        <span class="ag-l2"><span class="contador">${l.ids.length} processo${l.ids.length > 1 ? 's' : ''}</span><span class="contador">${fmt(tp)} pontos</span>${l.desfeito ? '<span class="pill dev" style="margin:0">Envio desfeito</span>' : l.desfeitos.length ? '<span class="pill dias" style="margin:0">' + l.desfeitos.length + ' desfeito' + (l.desfeitos.length > 1 ? 's' : '') + '</span>' : ''}</span></summary>
      <div class="ag-lc"><div class="ag-lb">${bts}${l.provius && !l.desfeito && EU.admin ? `<button type="button" class="btn peq dev" style="margin-left:auto" data-desf="${i}">↩ Desfazer este envio</button>` : ''}</div>
        ${l.desfTxt ? `<p class="hi-obs" style="margin:0 0 10px">${esc(l.desfTxt.por_nome || '')} desfez ${l.desfeito ? 'este envio' : 'parte deste envio'} em ${dataHora(l.desfTxt.em)}${l.desfTxt.texto ? ' · ' + esc(l.desfTxt.texto) : ''}. Os processos voltaram para a lista de prontos.</p>` : ''}
        <div class="tab-wrap" style="padding:0"><table><thead><tr><th>Nº</th><th>Logradouro</th><th>Bairro</th><th class="num">Pontos</th><th></th></tr></thead><tbody>${ps.map(d => `<tr${l.desfeitos.includes(d.id) ? ' class="ag-desf"' : ''}><td class="nn">${esc(d.numero)}</td><td>${esc(d.logradouro)}</td><td>${esc(d.bairro || '')}</td><td class="num">${d.total_pontos}</td>
          <td class="ag-arqs" style="text-align:right">${d.tipo === 'R' ? '' : `<button type="button" class="link-pdf" data-tc="${d.id}">Tabela de carga</button> · `}<button type="button" class="link-pdf" data-det="${d.id}">ver processo</button></td></tr>`).join('')}</tbody></table></div>
      </div></details>`;
  }).join('') + (f.length > 200 ? `<p class="ajuda" style="padding:12px 16px;margin:0">Mostrando 200 de ${fmt(f.length)} envios. Use o ano ou a busca para achar os outros.</p>` : '');
  $$('#an-lista [data-arq]').forEach(b => b.onclick = () => verArquivo({ caminho: b.dataset.arq, nome: b.dataset.arq.split('/').pop() }, 'Comprovante do envio'));
  $$('#an-lista [data-carta]').forEach(b => b.onclick = () => agCartaVer(f[+b.dataset.carta]));
  $$('#an-lista [data-copiar]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(f[+b.dataset.copiar].link); toast('Link copiado'); } catch (e) { prompt('Copie o link:', f[+b.dataset.copiar].link); } });
  $$('#an-lista [data-deslig]').forEach(b => b.onclick = async () => {
    const l = f[+b.dataset.deslig], cod = loteCodigoDe(l.link);
    const motivo = prompt('Desligar o link do lote da carta ' + (l.carta || 's/nº') + '?\n\nQuem abrir o link verá que ele foi desligado e não conseguirá baixar os arquivos. Isso não desfaz o envio. Diga o motivo:', '');
    if (motivo === null) return; if (!motivo.trim()) { toast('Diga o motivo para desligar o link', true); return; }
    const r = await tarefa(() => rpc('lote_desligar', { p_codigo: cod, p_motivo: motivo.trim() }).then(() => true), 'Link desligado'); if (r) agAntCarregar(true);
  });
  $$('#an-lista [data-det]').forEach(b => b.onclick = () => detalhe(+b.dataset.det));
  $$('#an-lista [data-tc]').forEach(b => b.onclick = () => tcPdfDoProcesso(+b.dataset.tc));
  $$('#an-lista [data-desf]').forEach(b => b.onclick = async () => {
    const l = f[+b.dataset.desf], ids = l.ids.filter(id => !l.desfeitos.includes(id)), nums = ids.map(id => proc(id)?.numero || '#' + id);
    const motivo = prompt(`Desfazer o envio à AGEMAN de ${dataHora(l.em)} feito por ${l.por || '—'}?\n\nProcessos: ${nums.join(', ')}\n\nEles voltam para a lista de prontos e o desfazimento fica no histórico. Diga o motivo:`, 'Enviado por engano');
    if (motivo === null) return; if (!motivo.trim()) { toast('Diga o motivo para desfazer', true); return; }
    const r = await tarefa(() => rpc('desfazer_envio', { p_ids: ids, p_motivo: motivo.trim() })); if (!r) return;
    toast('Envio desfeito · ' + nums.length + ' processo' + (nums.length > 1 ? 's voltaram' : ' voltou') + ' para a lista de prontos');
    HI.ok = false; await recarregar(); agAntCarregar(true);
  });
}

// botões do link do envio: o do Provius (abrir, copiar, acessos, desligar) ou a pasta de fora
function agLinkBts(l, i) {
  if (!l.link) return '';
  const cod = loteCodigoDe(l.link), x = cod && AG.lotes ? AG.lotes[cod] : null;
  if (!x) return `<a class="btn peq" href="${esc(l.link)}" target="_blank" rel="noopener">🔗 ${cod ? 'Link do lote' : 'Pasta'}</a>`;
  const ac = `${fmt(x.aberturas)} abertura${x.aberturas === 1 ? '' : 's'} · ${fmt(x.downloads)} download${x.downloads === 1 ? '' : 's'}` + (x.ultimo_acesso ? ' · último em ' + dataHora(x.ultimo_acesso) : '');
  if (!x.ativo) return `<span class="pill dev" style="margin:0" title="${esc((x.desligado_motivo || '') + (x.desligado_por_nome ? ' · ' + x.desligado_por_nome : ''))}">🔗 Link desligado${x.desligado_em ? ' em ' + dataBR(String(x.desligado_em).slice(0, 10)) : ''}</span><span class="ajuda">${ac}</span>`;
  return `<a class="btn peq" href="${esc(l.link)}" target="_blank" rel="noopener" title="A página que a AGEMAN abre">🔗 Link do lote</a><button type="button" class="btn peq" data-copiar="${i}">📋 Copiar link</button>` +
    (EU.admin ? `<button type="button" class="btn peq" data-deslig="${i}">⛔ Desligar link</button>` : '') + `<span class="ajuda" title="Aberturas e downloads da página do lote">${ac}</span>`;
}

// carta de um envio anterior: a guardada no envio ou, se não foi guardada, recriada com o nº, a data, o link e os processos do lote
async function agCartaVer(l) {
  const num = l.carta || 's/nº', nome = 'carta-' + num.replace(/\W+/g, '-') + '.pdf';
  if (l.cartaArq) { verArquivo({ caminho: l.cartaArq, nome, por_nome: l.por, em: l.em }, 'Carta ' + num); return; }
  const ps = l.ids.map(id => D.find(d => d.id === id)).filter(Boolean).sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'pt-BR', { numeric: true }));
  if (!ps.length) { toast('Os processos deste envio não foram encontrados.', true); return; }
  const r = await tarefa(() => gerarCarta(ps, { ...cartaCampos(true), num: l.carta || '', data: l.data, link: l.link || '' })); if (!r) return;
  verPdfBytes(r.bytes, nome, 'Carta ' + num + ' (recriada)',
    'A carta não foi guardada neste envio: montada agora com o nº, a data, o link e os ' + ps.length + ' processos do registro. Destinatário, assunto e assinatura são os padrão da carta' + (l.link ? '.' : '; o envio não tem link guardado.'));
}
