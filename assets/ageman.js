// PROVIUS · 6 · Entrega para a AGEMAN (Setor de Projetos)
// "Novo lote": processos prontos (etapa 5), carta e registro do envio.
// "Envios anteriores": os lotes já enviados, lidos dos movimentos (os envios feitos juntos viram um lote só,
// como na tela Histórico) e, para os de antes do Provius, da data de envio da planilha.
const AG = { sel: new Set(), carta: null, cartaPronta: null, vc: null, modo: 'lote', ant: null, ano: null };

function agIniciar() {
  caixaPdf('#ag-arq', '#ag-up');
  $$('#ag-modo button').forEach(b => b.onclick = () => agModo(b.dataset.m));
  $('#ag-todos').onchange = e => { AG.sel = e.target.checked ? new Set(filaDe(5).map(d => d.id)) : new Set(); agLista(); };
  $('#ag-carta').onclick = abrirCarta; $('#ag-enviar').onclick = registrarEnvio; $('#ag-unidos-bt').onclick = agUnidosTodos;
  $('#ct-gerar').onclick = cartaPrevia; ['#ct-num', '#ct-data', '#ct-dest', '#ct-att', '#ct-attc', '#ct-ass', '#ct-ref', '#ct-link', '#ct-nome', '#ct-cargo'].forEach(s => $(s).addEventListener('change', cartaPrevia));
  AG.vc = criaVisor({ area: '#ct-area', canvas: '#ct-cv' });
  $('#ct-baixar').onclick = () => { if (!AG.carta) return; if (!$('#ct-link').value.trim()) { toast('Cole o link de acesso antes', true); return; } baixarBlob('carta-' + $('#ct-num').value.replace(/\W+/g, '-') + '.pdf', new Blob([AG.carta], { type: 'application/pdf' })); };
  $('#ct-anexar').onclick = () => { if (!AG.carta) return; if (!$('#ct-link').value.trim()) { $('#ct-link').closest('.campo').classList.add('invalido'); toast('Cole o link de acesso antes de usar a carta', true); return; }
    $('#ag-of').value = $('#ct-num').value; $('#ag-data').value = $('#ct-data').value; AG.cartaPronta = { bytes: AG.carta, num: $('#ct-num').value, link: $('#ct-link').value.trim() };
    fechaModal('#modal-carta'); toast('Carta pronta. Ela é guardada junto com o registro do envio.'); };
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
  abreModal('#modal-carta'); cartaPrevia();
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
  const comp = $('#ag-up')._arqs[0], carta = AG.cartaPronta;
  const r = await tarefa(async () => {
    const pasta = 'envios/' + data.slice(0, 4);
    const c = carta ? await enviarArquivo(pasta, 'carta', new File([carta.bytes], 'carta.pdf', { type: 'application/pdf' })) : null;
    const k = comp ? await enviarArquivo(pasta, 'comprovante', comp) : null;
    return rpc('registrar_envio', { p_ids: ids, p_carta: $('#ag-of').value.trim(), p_data: data, p_link: carta?.link || $('#ct-link').value.trim(), p_oficio: null, p_carta_caminho: c?.caminho || null, p_comprovante: k?.caminho || null });
  });
  if (!r) return;
  toast(ids.length + ' processo' + (ids.length > 1 ? 's' : '') + ' enviado' + (ids.length > 1 ? 's' : '') + ' à AGEMAN em ' + dataBR(data));
  AG.sel.clear(); AG.cartaPronta = null; AG.ant = null; $('#ag-up')._limpa(); $('#ag-of').value = ''; $('#ct-num').value = ''; $('#ct-link').value = '';
  await recarregar(); agAbrir();
}

// ---------- PDF unido: as built enviado + tabela de carga (uma página atrás da outra) ----------
const agNomeArq = p => p.numero.replace(/\//g, '-') + '.pdf';
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
    return { movs, envios: e.error ? [] : e.data || [] };
  });
  if (!r) return;
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
    const bts = l.provius ? [l.cartaArq ? `<button type="button" class="btn peq" data-arq="${esc(l.cartaArq)}">📄 Carta</button>` : '', l.comprovante ? `<button type="button" class="btn peq" data-arq="${esc(l.comprovante)}">📎 Comprovante</button>` : '', l.link ? `<a class="btn peq" href="${esc(l.link)}" target="_blank" rel="noopener">🔗 Pasta</a>` : ''].join('') || '<span class="ajuda">sem carta, comprovante ou link guardados</span>' : '<span class="ajuda">Envio de antes do Provius: só a data veio da planilha.</span>';
    return `<details class="ag-lote${l.desfeito ? ' desf' : ''}"${i === 0 ? ' open' : ''}>
      <summary><span class="ag-l1"><b class="nn">${titulo}</b><span>${dataBR(l.data)}${l.provius ? ' às ' + new Date(l.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>${l.por ? `<span>por <b>${esc(l.por)}</b></span>` : ''}</span>
        <span class="ag-l2"><span class="contador">${l.ids.length} processo${l.ids.length > 1 ? 's' : ''}</span><span class="contador">${fmt(tp)} pontos</span>${l.desfeito ? '<span class="pill dev" style="margin:0">Envio desfeito</span>' : l.desfeitos.length ? '<span class="pill dias" style="margin:0">' + l.desfeitos.length + ' desfeito' + (l.desfeitos.length > 1 ? 's' : '') + '</span>' : ''}</span></summary>
      <div class="ag-lc"><div class="ag-lb">${bts}${l.provius && !l.desfeito && EU.admin ? `<button type="button" class="btn peq dev" style="margin-left:auto" data-desf="${i}">↩ Desfazer este envio</button>` : ''}</div>
        ${l.desfTxt ? `<p class="hi-obs" style="margin:0 0 10px">${esc(l.desfTxt.por_nome || '')} desfez ${l.desfeito ? 'este envio' : 'parte deste envio'} em ${dataHora(l.desfTxt.em)}${l.desfTxt.texto ? ' · ' + esc(l.desfTxt.texto) : ''}. Os processos voltaram para a lista de prontos.</p>` : ''}
        <div class="tab-wrap" style="padding:0"><table><thead><tr><th>Nº</th><th>Logradouro</th><th>Bairro</th><th class="num">Pontos</th><th></th></tr></thead><tbody>${ps.map(d => `<tr${l.desfeitos.includes(d.id) ? ' class="ag-desf"' : ''}><td class="nn">${esc(d.numero)}</td><td>${esc(d.logradouro)}</td><td>${esc(d.bairro || '')}</td><td class="num">${d.total_pontos}</td>
          <td class="ag-arqs" style="text-align:right">${d.tipo === 'R' ? '' : `<button type="button" class="link-pdf" data-tc="${d.id}">Tabela de carga</button> · `}<button type="button" class="link-pdf" data-det="${d.id}">ver processo</button></td></tr>`).join('')}</tbody></table></div>
      </div></details>`;
  }).join('') + (f.length > 200 ? `<p class="ajuda" style="padding:12px 16px;margin:0">Mostrando 200 de ${fmt(f.length)} envios. Use o ano ou a busca para achar os outros.</p>` : '');
  $$('#an-lista [data-arq]').forEach(b => b.onclick = () => abrirNovaAba(b.dataset.arq));
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
