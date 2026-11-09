// PROVIUS · funções comuns
const HASH0 = location.hash;   // guardado antes do Supabase ler o link do convite
const CFG = window.PROVIUS_CONFIG || {};
const CONFIGURADO = !!(CFG.SUPABASE_URL && !/^COLE/.test(CFG.SUPABASE_URL) && CFG.SUPABASE_CHAVE && !/^COLE/.test(CFG.SUPABASE_CHAVE));
const sb = CONFIGURADO ? supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_CHAVE) : null;
const BUCKET = 'provius';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('pt-BR');
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dataBR = t => { if (!t) return ''; const s = String(t); const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (m) return `${m[3]}/${m[2]}/${m[1]}`; return new Date(s).toLocaleDateString('pt-BR'); };
const dataHora = t => t ? new Date(t).toLocaleDateString('pt-BR') + ' às ' + new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
const diasDesde = t => t ? Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 864e5)) : null;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const ETAPAS = {
  1: { setor: 'Projetos', nome: 'Elaborar projeto', aba: 'projetos', curto: 'Projeto' },
  2: { setor: 'Engenharia', nome: 'Execução e correções', aba: 'exe', curto: 'Execução' },
  3: { setor: 'Cadastro', nome: 'Emplaquetamento', aba: 'cad', curto: 'Emplaquetamento' },
  4: { setor: 'Projetos', nome: 'Atualizar as built', aba: 'asb', curto: 'As built' },
  5: { setor: 'Projetos', nome: 'Pronto p/ AGEMAN', aba: 'asb', curto: 'AGEMAN' },
  6: { setor: 'AGEMAN', nome: 'Enviado', aba: null, curto: 'AGEMAN' }
};
const POTS = [12, 15, 18, 20, 22, 30, 32, 35, 36, 37, 40, 45, 46, 47, 50, 58, 60, 70, 80, 90, 96, 100, 105, 115, 117, 120, 145, 150, 160, 175, 200, 220, 240, 250, 400];

let EU = null;            // perfil de quem está usando
let BAIRROS = {};         // nome -> zona
let D = [];               // lista de processos (resumo)

function msgErro(e) {
  if (!e) return 'Algo deu errado. Tente de novo.';
  const m = e.message || String(e);
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem internet no momento. Confira a conexão e tente de novo.';
  if (/JWT|session|not authenticated/i.test(m)) return 'Sua sessão expirou. Entre de novo.';
  if (/Could not find the function|schema cache/i.test(m)) return 'O banco ainda não foi atualizado. Rode o último arquivo .sql no Supabase.';
  if (/Duplicate|already exists/i.test(m)) return 'Esse arquivo já foi enviado.';
  if (/row-level security|violates/i.test(m)) return 'Você não tem permissão para isso.';
  return m;
}
async function rpc(nome, args) {
  const { data, error } = await sb.rpc(nome, args || {});
  if (error) throw new Error(msgErro(error));
  return data;
}

let toastT;
function toast(t, erro) { const e = $('#toast'); e.textContent = t; e.classList.toggle('erro', !!erro); e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, erro ? 6000 : 3800); }
function ocupado(v) { $('#carregando').hidden = !v; }
async function tarefa(fn, ok) {
  ocupado(true);
  try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); return r; }
  catch (e) { console.error(e); toast(msgErro(e), true); return undefined; }
  finally { ocupado(false); }
}

// janelas
function abreModal(id) { $(id).hidden = false; }
function fechaModal(id) { $(id).hidden = true; }
document.addEventListener('click', e => { const b = e.target.closest('[data-fecha]'); if (b) b.closest('.fundo').hidden = true; else if (e.target.classList?.contains('fundo')) e.target.hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.fundo').forEach(m => m.hidden = true); });

// caixa de envio de PDF: valida e guarda o arquivo escolhido em el._arq
function caixaPdf(inp, box, { varios = false, imagens = false } = {}) {
  const i = $(inp), b = $(box), nome = b.querySelector('.nome'), txt0 = nome.textContent;
  b._arqs = [];
  i.onchange = () => {
    const fs = [...i.files]; i.value = '';
    for (const f of fs) {
      const ehPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
      const ehImg = imagens && /^image\/(jpeg|png)$/.test(f.type);
      if (!ehPdf && !ehImg) { b.classList.add('err'); nome.textContent = f.name + ' não é ' + (imagens ? 'PDF nem foto JPG/PNG.' : 'PDF.'); return; }
      if (f.size > 10 * 1024 * 1024) { b.classList.add('err'); nome.textContent = f.name + ' passa de 10 MB. Reduza e tente de novo.'; return; }
    }
    b._arqs = varios ? b._arqs.concat(fs) : fs.slice(0, 1);
    b.classList.remove('err'); b.classList.toggle('tem', b._arqs.length > 0);
    nome.textContent = b._arqs.length ? b._arqs.map(f => f.name + ' · ' + (f.size / 1048576).toFixed(1) + ' MB').join(' · ') : txt0;
    b.dispatchEvent(new Event('mudou'));
  };
  b._limpa = () => { b._arqs = []; b.classList.remove('tem', 'err'); nome.textContent = txt0; };
  b._erro = t => { b.classList.add('err'); nome.textContent = t; };
  return b;
}

// envia um arquivo para a pasta; nunca substitui (upsert desligado)
async function enviarArquivo(pasta, rotulo, arq) {
  const ext = (/\.(pdf|jpe?g|png)$/i.exec(arq.name || '') || [, 'pdf'])[1].toLowerCase();
  const id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
  const caminho = `${pasta}/${rotulo}-${Date.now()}-${id.slice(0, 8)}.${ext}`;
  const tipo = ext === 'pdf' ? 'application/pdf' : (ext === 'png' ? 'image/png' : 'image/jpeg');
  const { error } = await sb.storage.from(BUCKET).upload(caminho, arq, { upsert: false, contentType: tipo });
  if (error) throw new Error('Não consegui enviar ' + (arq.name || rotulo) + ': ' + msgErro(error));
  return { caminho, nome: arq.name || (rotulo + '.' + ext), tamanho: arq.size || 0 };
}
async function bytesDe(caminho) {
  const { data, error } = await sb.storage.from(BUCKET).download(caminho);
  if (error) throw new Error('Não consegui abrir o arquivo: ' + msgErro(error));
  return new Uint8Array(await data.arrayBuffer());
}
async function abrirNovaAba(caminho) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(caminho, 3600);
  if (error) { toast(msgErro(error), true); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}
function baixarBlob(nome, blob) {
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
function abrirBlob(blob) { const u = URL.createObjectURL(blob); window.open(u, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(u), 60000); }

// detalhes completos de um processo
async function carregarProcesso(id) {
  const [p, a, m] = await Promise.all([
    sb.from('processos').select('*').eq('id', id).single(),
    sb.from('arquivos').select('*').eq('processo_id', id).order('em'),
    sb.from('movimentos').select('*').eq('processo_id', id).order('em')
  ]);
  if (p.error) throw new Error(msgErro(p.error));
  return { ...p.data, arquivos: a.data || [], movimentos: m.data || [] };
}
const ultimoArquivo = (p, tipo) => (p.arquivos || []).filter(a => a.tipo === tipo).slice(-1)[0];

// trava de edição: quem está mexendo no processo (vale 30 minutos sem atividade)
const TRAVA_MIN = 30;
let SEM_TRAVA = false;    // banco ainda sem as colunas/funções da trava: o sistema funciona sem ela
const travaAtiva = d => !!(d && d.editando_por && d.editando_em && Date.now() - new Date(d.editando_em).getTime() < TRAVA_MIN * 6e4);
const primeiroNome = n => String(n || '').trim().split(/\s+/)[0] || 'alguém';
function seloTrava(d) {
  if (SEM_TRAVA || !travaAtiva(d)) return '';
  const eu = EU && d.editando_por === EU.id;
  return ` <span class="pill trava${eu ? '' : ' outro'}" title="${eu ? 'Você está editando este processo' : 'Em edição por ' + esc(d.editando_nome || '')}">✎ ${eu ? 'Você' : esc(primeiroNome(d.editando_nome))}</span>`;
}

// fila de um setor
function filaDe(etapa) { return D.filter(d => d.etapa === etapa && !d.cancelado).sort((a, b) => (!!b.urgente - !!a.urgente) || new Date(a.etapa_desde) - new Date(b.etapa_desde)); }   // urgentes primeiro
const seloUrg = d => d && d.urgente ? '<span class="pill urg">🔴 Urgente</span>' : '';
function itemFila(p, i, at) {
  const dd = diasDesde(p.etapa_desde);
  return `<button class="item" data-i="${i}" aria-current="${i === at}"><span class="n">${esc(p.numero)}</span><span class="l">${esc(p.logradouro)}</span>` + seloUrg(p) +
    (p.devolvido ? '<span class="pill dev">Devolvido</span> ' : '') +
    (dd !== null ? `<span class="pill ${dd > 60 ? 'dev' : 'dias'}">${dd} dia${dd === 1 ? '' : 's'} aqui</span>` : '') + seloTrava(p) + '</button>';
}
function faixaDevolvido(el, p) {
  const d = p.devolvido; el.hidden = !d;
  if (d) el.innerHTML = `<b>DEVOLVIDO</b> por ${esc(d.setor)} (${esc(d.por || '')}) em ${dataBR(d.em)} · <b>${esc(d.motivo)}</b>: ${esc(d.texto)}`;
}
function selectBairros(sel, atual) {
  sel.innerHTML = '<option value="">Selecione</option>' + Object.keys(BAIRROS).sort().map(b => `<option${b === atual ? ' selected' : ''}>${esc(b)}</option>`).join('');
}
