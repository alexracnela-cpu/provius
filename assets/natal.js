// PROVIUS · tema de Natal
// Fica ligado até o fim do dia NATAL_ATE e sai sozinho depois. Cada pessoa pode desligar no menu do usuário (fica salvo no navegador).
(function () {
  const NATAL_ATE = '2026-12-25';
  const d = new Date(), hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (hoje > NATAL_ATE) return;

  const raiz = document.documentElement, CHAVE = 'provius-natal';
  const parado = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ligado = true; try { ligado = localStorage.getItem(CHAVE) !== 'off'; } catch (e) { }
  const faltam = Math.round((new Date(NATAL_ATE + 'T00:00:00') - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  const txtFaltam = faltam === 0 ? 'Feliz Natal!' : faltam === 1 ? 'Falta 1 dia para o Natal' : `Faltam ${faltam} dias para o Natal`;
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

  const GORRO = '<svg viewBox="0 0 64 56" aria-hidden="true"><path d="M8 44 C14 22 30 6 50 8 C58 9 60 18 56 30 C54 22 48 18 42 20 C38 28 40 38 44 44 Z" fill="#c8242f"/><path d="M42 20 C48 18 54 22 56 30" fill="none" stroke="#9e1822" stroke-width="2"/><rect x="2" y="40" width="48" height="13" rx="6.5" fill="#fff" stroke="#e3e3e3"/><circle cx="56" cy="32" r="7" fill="#fff" stroke="#e3e3e3"/></svg>';
  const LACO = '<svg viewBox="0 0 58 34" aria-hidden="true"><path d="M29 17 C18 2 4 2 6 12 C7 20 20 20 29 17Z" fill="#c8242f" stroke="#9e1822" stroke-width="1.5"/><path d="M29 17 C40 2 54 2 52 12 C51 20 38 20 29 17Z" fill="#c8242f" stroke="#9e1822" stroke-width="1.5"/><path d="M27 18 L19 33 L24 31 L26 34 L29 20Z M31 18 L39 33 L34 31 L32 34 L29 20Z" fill="#b01d28"/><circle cx="29" cy="17" r="5" fill="#e03440" stroke="#9e1822" stroke-width="1.5"/></svg>';
  const CORES = ['#e53340', '#2fbf5b', '#f2c230', '#3f9cf0', '#f07a2a'];
  const ARVORE = (cls, bolas) => `<svg class="arv ${cls}" viewBox="0 0 80 120" aria-hidden="true"><rect x="35" y="100" width="10" height="16" fill="#6b4226"/><path d="M40 14 L12 56 H26 L6 84 H22 L2 104 H78 L58 84 H74 L54 56 H68 Z" fill="#1d6b38"/><path d="M40 14 L26 56 H40 Z M40 56 L22 84 H40 Z M40 84 L18 104 H40Z" fill="#185c30"/>${bolas.map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="${c}"/>`).join('')}<path d="M40 2 L43 10 L51 10 L45 15 L47 23 L40 18 L33 23 L35 15 L29 10 L37 10Z" fill="#f2c230"/></svg>`;
  const PRESENTE = (cls, c1, c2) => `<svg class="presente ${cls}" viewBox="0 0 40 36" aria-hidden="true"><rect x="2" y="12" width="36" height="24" fill="${c1}"/><rect x="0" y="8" width="40" height="7" fill="${c1}" stroke="rgba(0,0,0,.15)"/><rect x="17" y="8" width="6" height="28" fill="${c2}"/><path d="M20 8 C12 -2 4 4 12 8Z M20 8 C28 -2 36 4 28 8Z" fill="${c2}"/></svg>`;

  // ---------- guirlanda de pinheiro + pisca-pisca ----------
  function luzes() {
    const topo = document.querySelector('.topo'); if (!topo) return;
    let el = document.getElementById('natal-luzes');
    if (!el) { el = mk('div'); el.id = 'natal-luzes'; el.setAttribute('aria-hidden', 'true'); topo.appendChild(el); }
    if (!topo.clientWidth) return;   // cabeçalho escondido (tela de entrada): desenha quando aparecer
    const w = Math.max(320, topo.clientWidth), passo = 70, n = Math.ceil(w / passo) + 1;
    let fio = 'M0 2', lamps = '', lacos = '';
    for (let i = 0; i < n; i++) {
      const x0 = i * passo, xm = x0 + passo / 2, x1 = x0 + passo;
      fio += ` Q${xm} 16 ${x1} 2`;
      [0.25, 0.5, 0.75].forEach((t, k) => {   // 3 lâmpadas por laço da guirlanda
        const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * xm + t * t * x1, y = 2 + 2 * (1 - t) * t * 14;
        const idx = i * 3 + k, cor = CORES[idx % CORES.length], cls = ['', 'b', 'c'][idx % 3];
        lamps += `<g class="lamp ${cls}" style="color:${cor}"><rect x="${x - 1.6}" y="${y + 1}" width="3.2" height="3" fill="#2a2a2a"/><ellipse cx="${x}" cy="${y + 7.5}" rx="3.2" ry="4.6" fill="${cor}"/></g>`;
      });
      lacos += `<g transform="translate(${x1} 2)"><path d="M0 0 C-7 -6 -11 -1 -8 2Z M0 0 C7 -6 11 -1 8 2Z" fill="#c8242f"/><path d="M-1 0 L-4 9 M1 0 L4 9" stroke="#c8242f" stroke-width="2.2" stroke-linecap="round"/><circle r="2.4" fill="#e03440"/></g>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${w} 24" height="24"><path d="${fio}" fill="none" stroke="#1a5c31" stroke-width="7" stroke-linecap="round"/><path d="${fio}" fill="none" stroke="#2a8a4a" stroke-width="7" stroke-dasharray="2 3"/><path d="${fio}" fill="none" stroke="#3aa45c" stroke-width="3" stroke-dasharray="1 4" stroke-linecap="round" transform="translate(0 -1.5)"/>${lamps}${lacos}</svg>`;
  }

  // ---------- bolas penduradas nas laterais ----------
  function bolas() {
    if (document.getElementById('natal-bolas')) return;
    const el = mk('div'); el.id = 'natal-bolas'; el.setAttribute('aria-hidden', 'true');
    const lista = [['1.2%', 120, '#c8242f'], ['3.4%', 70, '#f2c230'], ['5.4%', 160, '#1f7a3f'], ['92.2%', 150, '#1f7a3f'], ['94.4%', 80, '#c8242f'], ['96.6%', 130, '#f2c230']];
    el.innerHTML = lista.map(([x, h, c]) => `<svg class="bola" style="left:${x};width:34px;height:${h + 40}px" viewBox="0 0 34 ${h + 40}"><line x1="17" y1="0" x2="17" y2="${h}" stroke="#9aa6b2" stroke-width="1"/><rect x="12" y="${h}" width="10" height="6" rx="1.5" fill="#d9b23a"/><circle cx="17" cy="${h + 20}" r="14" fill="${c}"/><ellipse cx="11.5" cy="${h + 14}" rx="4" ry="2.6" fill="rgba(255,255,255,.55)" transform="rotate(-35 11.5 ${h + 14})"/><path d="M5 ${h + 24} Q17 ${h + 30} 29 ${h + 24}" stroke="rgba(255,255,255,.5)" stroke-width="1.5" fill="none"/></svg>`).join('');
    document.body.appendChild(el);
  }

  // ---------- neve acumulada, árvores e presentes no rodapé ----------
  function chao() {
    if (document.getElementById('natal-chao')) return;
    const el = mk('div'); el.id = 'natal-chao'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = ARVORE('e1', [[30, 50, '#e53340'], [50, 62, '#f2c230'], [24, 78, '#3f9cf0'], [56, 88, '#e53340'], [36, 96, '#f2c230'], [44, 72, '#ffffff']])
      + ARVORE('e2', [[32, 60, '#f2c230'], [50, 80, '#e53340'], [28, 94, '#ffffff']])
      + ARVORE('d1', [[28, 48, '#f2c230'], [52, 58, '#e53340'], [22, 82, '#ffffff'], [58, 86, '#3f9cf0'], [40, 74, '#e53340'], [46, 98, '#f2c230']])
      + ARVORE('d2', [[46, 58, '#3f9cf0'], [30, 78, '#f2c230'], [54, 96, '#e53340']])
      + '<svg class="monte" viewBox="0 0 1000 60" preserveAspectRatio="none"><path d="M0 30 C80 10 160 26 250 22 C340 18 400 4 500 16 C600 28 680 8 780 14 C870 20 930 6 1000 18 V60 H0Z" fill="#ffffff" opacity=".95"/></svg>'
      + PRESENTE('p1', '#c8242f', '#f2c230') + PRESENTE('p2', '#1f7a3f', '#e8e8e8');
    const f = document.getElementById('fundo'); f && f.parentNode ? f.parentNode.insertBefore(el, f.nextSibling) : document.body.prepend(el);
  }

  // ---------- neve caindo ----------
  let raf = 0, cv = null;
  function neve() {
    if (parado || cv) return;
    cv = mk('canvas'); cv.id = 'natal-neve'; cv.setAttribute('aria-hidden', 'true');
    const f = document.getElementById('fundo'); f && f.parentNode ? f.parentNode.insertBefore(cv, f.nextSibling) : document.body.prepend(cv);
    const ctx = cv.getContext('2d'); let W, H, flocos = [];
    const escuro = () => (raiz.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    function medir() {
      const r = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight; cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0);
      const qtd = Math.round(Math.min(140, W * H / 9000));
      while (flocos.length < qtd) flocos.push(novo(true)); flocos.length = qtd;
    }
    function novo(qualquer) { const cr = Math.random() < .22; return { x: Math.random() * W, y: qualquer ? Math.random() * H : -12, r: cr ? 5 + Math.random() * 5 : 1.4 + Math.random() * 3, cr, v: .3 + Math.random() * .8, o: Math.random() * 6.28, g: Math.random() * 6.28, a: .55 + Math.random() * .45 }; }
    function cristal(p) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.g); ctx.beginPath();
      for (let k = 0; k < 6; k++) { ctx.rotate(Math.PI / 3); ctx.moveTo(0, 0); ctx.lineTo(0, p.r); ctx.moveTo(0, p.r * .55); ctx.lineTo(p.r * .28, p.r * .8); ctx.moveTo(0, p.r * .55); ctx.lineTo(-p.r * .28, p.r * .8); }
      ctx.stroke(); ctx.restore();
    }
    function quadro() {
      ctx.clearRect(0, 0, W, H);
      const esc = escuro();
      ctx.shadowColor = esc ? 'rgba(255,255,255,.6)' : 'rgba(40,80,140,.5)'; ctx.shadowBlur = esc ? 4 : 3; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      for (const p of flocos) {
        p.y += p.v; p.o += .01; p.g += .004; p.x += Math.sin(p.o) * .4;
        if (p.y > H + 12) Object.assign(p, novo(false));
        const cor = `rgba(255,255,255,${p.a})`;
        if (p.cr) { ctx.strokeStyle = cor; cristal(p); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fillStyle = cor; ctx.fill(); }
      }
      raf = requestAnimationFrame(quadro);
    }
    medir(); addEventListener('resize', medir); quadro();
  }

  // ---------- Papai Noel (desenho em SVG; cabeça centrada em 0,0) ----------
  const PELE = '#fbd3b6', VERM = '#d42a35', BORDA_B = '#d9e1ea', LUVA = '#1f7a3f', LUVA2 = '#16602f';
  // gradientes de cada boneco (id próprio para não colidir)
  const defs = (i) => `<defs>
    <radialGradient id="pele${i}" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe3cf"/><stop offset="1" stop-color="#f1b38f"/></radialGradient>
    <radialGradient id="verm${i}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#ec3d48"/><stop offset="1" stop-color="#a8161f"/></radialGradient>
    <radialGradient id="nariz${i}" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#ffb3a6"/><stop offset="1" stop-color="#e2786b"/></radialGradient>
    <radialGradient id="luva${i}" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#2f9a55"/><stop offset="1" stop-color="#155c2c"/></radialGradient>
    <linearGradient id="branco${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e8eef4"/></linearGradient>
  </defs>`;
  // pelo fofo: círculos em volta de um caminho, com contorno suave
  function fofo(pts, r, i, base = '') {
    const c = (d, f) => pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + d}" fill="${f}"/>`).join('');
    return `<g>${c(1, BORDA_B)}${base ? base.replace('FILL', BORDA_B).replace('/>', ' stroke="' + BORDA_B + '" stroke-width="2"/>') : ''}${c(0, `url(#branco${i})`)}${base ? base.replace('FILL', `url(#branco${i})`) : ''}</g>`;
  }
  const linha = (x0, y0, x1, y1, q, n) => Array.from({ length: n }, (_, k) => { const t = k / (n - 1); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - q * 4 * t * (1 - t)]; });
  const arco = (cx, cy, rx, ry, a0, a1, n) => Array.from({ length: n }, (_, k) => { const a = a0 + (a1 - a0) * k / (n - 1); return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });

  function cabeca(i) {
    const barbaPts = arco(0, 2, 17.5, 30, 0.05, Math.PI - 0.05, 11);
    const barbaBase = `<path d="M-17.5 2 A17.5 30 0 0 0 17.5 2 C14 10 8 13 0 13 C-8 13 -14 10 -17.5 2Z" fill="FILL"/>`;
    return `
    <ellipse cx="-16.5" cy="0" rx="3.4" ry="4.6" fill="url(#pele${i})"/><ellipse cx="16.5" cy="0" rx="3.4" ry="4.6" fill="url(#pele${i})"/>
    <circle cx="0" cy="-1" r="17" fill="url(#pele${i})"/>
    <ellipse cx="-9.5" cy="5" rx="4.2" ry="3" fill="#ff8f8f" opacity=".55"/><ellipse cx="9.5" cy="5" rx="4.2" ry="3" fill="#ff8f8f" opacity=".55"/>
    <g transform="translate(0 -1.5)"><g>
      <animateTransform attributeName="transform" type="scale" values="1 1;1 1;1 .12;1 1" keyTimes="0;.9;.95;1" dur="4.5s" repeatCount="indefinite"/>
      <ellipse cx="-6" cy="0" rx="2.3" ry="3" fill="#2a1a14"/><ellipse cx="6" cy="0" rx="2.3" ry="3" fill="#2a1a14"/>
      <circle cx="-5.2" cy="-1.1" r="1" fill="#fff"/><circle cx="6.8" cy="-1.1" r="1" fill="#fff"/></g></g>
    ${fofo(linha(-10.5, -6.5, -2.5, -7, 1.6, 4), 1.7, i)}${fofo(linha(2.5, -7, 10.5, -6.5, 1.6, 4), 1.7, i)}
    ${fofo(barbaPts, 5, i, barbaBase)}
    <path d="M-4.5 13.5 Q0 20 4.5 13.5Z" fill="#8a2626"/><ellipse cx="0" cy="16.3" rx="2.2" ry="1.3" fill="#e46a6a"/>
    <g stroke="${BORDA_B}" stroke-width="1" fill="url(#branco${i})">
      <path d="M0 9.5 C-2 5.5 -8 5 -12 7 C-15.5 8.5 -16.5 12.5 -13.5 13 C-12 11 -9 11.5 -6.5 12.2 C-3.5 13 -1 12 0 10.5Z"/>
      <path d="M0 9.5 C2 5.5 8 5 12 7 C15.5 8.5 16.5 12.5 13.5 13 C12 11 9 11.5 6.5 12.2 C3.5 13 1 12 0 10.5Z"/></g>
    <circle cx="0" cy="5" r="3.9" fill="url(#nariz${i})"/><circle cx="-1.2" cy="3.7" r="1.1" fill="#fff" opacity=".7"/>
    <path d="M-17 -14 C-16 -31 -2 -42 14 -41 C25 -40 33 -32 33 -19 C30 -26 25 -30 19 -29 C19 -23 18 -18 17 -14Z" fill="url(#verm${i})"/>
    <path d="M19 -29 C25 -30 30 -26 33 -19" fill="none" stroke="#8e141c" stroke-width="1.4" opacity=".6"/>
    <path d="M-8 -30 C-3 -36 4 -38 10 -37" fill="none" stroke="#ff7b84" stroke-width="2" stroke-linecap="round" opacity=".5"/>
    ${fofo(linha(-19, -15.5, 19, -15.5, 1.5, 9), 4.4, i)}
    ${fofo(arco(33, -17, 3.6, 3.6, 0, Math.PI * 2, 7), 2.6, i, `<circle cx="33" cy="-17" r="4" fill="FILL"/>`)}`;
  }
  // luva com polegar; e = 1 (direita) ou -1 (esquerda)
  const luva = (x, y, r, e, i) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${e} 1)">
    <ellipse cx="-5.6" cy="-1.5" rx="2.8" ry="3.8" fill="url(#luva${i})" transform="rotate(-35 -5.6 -1.5)"/>
    <ellipse rx="6.8" ry="5.8" fill="url(#luva${i})"/>
    <path d="M-1.5 -4.2 V2.5 M2.2 -4 V2.5" stroke="${LUVA2}" stroke-width="1" stroke-linecap="round" opacity=".7"/></g>`;
  const manga = (d, i) => `<path d="${d}" stroke="url(#verm${i})" stroke-width="11" stroke-linecap="round" fill="none"/>`;
  const punho = (x, y, r, i) => fofo(linha(-5.5, 0, 5.5, 0, 0, 4).map(([a, b]) => { const c = Math.cos(r * Math.PI / 180), s = Math.sin(r * Math.PI / 180); return [x + a * c - b * s, y + a * s + b * c]; }), 3.2, i);
  const tronco = (y0, y1, i) => `<path d="M-26 ${y1} C-28 ${y0 + 12} -18 ${y0} 0 ${y0} C18 ${y0} 28 ${y0 + 12} 26 ${y1}Z" fill="url(#verm${i})"/>
    <rect x="-3.6" y="${y0}" width="7.2" height="${y1 - y0}" fill="url(#branco${i})"/>`;

  // ---------- pose A: acenando (borda do cartão em y = 58); duas mãos: uma acena, outra segura a borda ----------
  const ACENA = { vb: [-36, -48, 82, 114], borda: 58, svg: (i) => defs(i) + `
    ${tronco(29, 58, i)}
    <g><animateTransform attributeName="transform" type="rotate" values="-12 21 38;14 21 38;-12 21 38" dur="1.1s" repeatCount="indefinite"/>
      ${manga('M21 38 Q35 30 35 12', i)}${punho(35, 9, 0, i)}${luva(35, 1, -8, 1, i)}</g>
    ${cabeca(i)}
    ${manga('M-21 39 Q-28 47 -21 54', i)}${punho(-20, 54, 25, i)}${luva(-17, 59, 15, -1, i)}` };

  // ---------- pose B: escondido, espiando (borda em y = 6) ----------
  // mão esquerda apontando para baixo (para a fila): a mesma luva, com o indicador para fora
  const aponta = (i) => `
    <g transform="translate(-21 6) rotate(10)">
      <ellipse cx="5.6" cy="-1.5" rx="2.8" ry="3.8" fill="url(#luva${i})" transform="rotate(35 5.6 -1.5)"/>
      <rect x="1.4" y="1" width="4.4" height="9.5" rx="2.2" fill="url(#luva${i})" transform="rotate(-8 3.6 1)"/>
      <ellipse rx="6.8" ry="5.8" fill="url(#luva${i})"/>
      <path d="M-3.8 -3.6 V2.4 M-0.6 -4 V2.6" stroke="${LUVA2}" stroke-width="1" stroke-linecap="round" opacity=".7"/>
    </g>`;
  const ESPIA = { vb: [-40, -50, 82, 78], borda: 6, svg: (i) => defs(i) + `
    <defs><clipPath id="c${i}"><rect x="-60" y="-80" width="140" height="86"/></clipPath></defs>
    <g clip-path="url(#c${i})"><g>
      <animateTransform attributeName="transform" type="translate" values="0 52;0 52;0 0;0 0;0 52;0 52" keyTimes="0;.12;.2;.74;.82;1" dur="7s" repeatCount="indefinite"/>
      <g><animateTransform attributeName="transform" type="rotate" values="0;0;7;7;-6;-6;0;0" keyTimes="0;.2;.26;.32;.38;.7;.74;1" dur="7s" repeatCount="indefinite"/>${cabeca(i)}</g>
    </g></g>
    ${luva(19, 7, 0, 1, i)}
    <g>${luva(-19, 7, 0, -1, i)}<animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;.37;.38;.7;.71;1" dur="7s" repeatCount="indefinite"/></g>
    <g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.37;.38;.7;.71;1" dur="7s" repeatCount="indefinite"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 3.5;0 0" dur=".7s" repeatCount="indefinite"/>${aponta(i)}</g></g>` };

  // ---------- pose C: sentado na borda (borda em y = 50) ----------
  const perna = (x, atraso, e, i) => `<g transform="translate(${x} 50)"><g>
    <animateTransform attributeName="transform" type="rotate" values="-10;12;-10" dur="1.8s" begin="${atraso}s" repeatCount="indefinite"/>
    <rect x="-5.5" y="-2" width="11" height="15" rx="4" fill="url(#verm${i})"/>
    ${fofo(linha(-5, 13, 5, 13, 0, 4), 2.8, i)}
    <path transform="scale(${e} 1)" d="M-6 15.5 H6 V22 C6 24.5 10 24.5 11.5 27 C12 30.5 -6 30.5 -6 27.5Z" fill="#232323"/>
    <path transform="scale(${e} 1)" d="M-4 18 V26" stroke="#4a4a4a" stroke-width="1.4" stroke-linecap="round"/>
  </g></g>`;
  const SENTA = { vb: [-38, -56, 78, 138], borda: 50, svg: (i) => defs(i) + `
    ${perna(-9, 0, -1, i)}${perna(9, -0.9, 1, i)}
    <path d="M-25 52 C-28 31 -17 22 0 22 C17 22 28 31 25 52Z" fill="url(#verm${i})"/>
    <rect x="-3.6" y="22" width="7.2" height="18" fill="url(#branco${i})"/>
    <rect x="-25.5" y="40" width="51" height="6.5" fill="#222"/>
    <rect x="-5.5" y="38.8" width="11" height="9" rx="1.6" fill="none" stroke="#f2c230" stroke-width="2.2"/>
    ${fofo(linha(-25, 51, 25, 51, 0, 10), 3, i)}
    <g transform="translate(0 -6)">${cabeca(i)}</g>
    ${manga('M-20 29 Q-29 38 -21 45', i)}${manga('M20 29 Q29 38 21 45', i)}
    ${punho(-19, 45, -35, i)}${punho(19, 45, 35, i)}
    ${luva(-14, 50, -10, -1, i)}${luva(14, 50, 10, 1, i)}` };

  // monta o Papai Noel: alto em px; a "borda" do desenho fica alinhada ao topo do elemento onde ele está
  let nNoel = 0;
  function noel(p, alto, pos) {
    const [, y, w, h] = p.vb, esc = alto / h, larg = w * esc, abaixo = (y + h - p.borda) * esc, i = 'n' + (++nNoel);
    const el = mk('div', 'natal-noel'); el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `width:${larg}px;height:${alto}px;bottom:calc(100% - ${abaixo}px);${pos(larg)}`;
    el.innerHTML = `<svg viewBox="${p.vb.join(' ')}">${p.svg(i)}</svg>`;
    if (parado) setTimeout(() => { const s = el.querySelector('svg'); s && s.pauseAnimations && s.pauseAnimations(); });
    return el;
  }
  function papaiNoel() {
    // acenando: caixa de entrada (e a de trocar senha)
    document.querySelectorAll('#f-login, #f-senha').forEach(c => { if (!c.querySelector(':scope > .natal-noel')) c.append(noel(ACENA, 124, () => 'right:22px')); });
    // escondido: painel "Aguardando você"
    document.querySelectorAll('.lado > .caixa').forEach(c => { if (c.querySelector('.fila') && !c.querySelector(':scope > .natal-noel')) c.append(noel(ESPIA, 72, () => 'right:30px')); });
    // sentado: em cima do primeiro cartão das etapas (tela Todos)
    const est = document.getElementById('esteira');
    if (est && !document.querySelector('.natal-noel-esteira')) {
      const w = mk('div', 'natal-noel-esteira'); w.setAttribute('aria-hidden', 'true');
      w.append(noel(SENTA, 112, l => `left:calc(var(--col) * .74 - ${l / 2}px)`)); est.before(w);
    }
  }

  // ---------- gorros, laço, mensagem e contagem ----------
  function enfeites() {
    document.querySelectorAll('.marca, .acesso-cx').forEach(c => { if (!c.querySelector(':scope > .natal-gorro')) c.prepend(mk('span', 'natal-gorro', GORRO)); });
    document.querySelectorAll('.acesso-cx').forEach(c => { if (!c.querySelector('.natal-laco')) c.prepend(mk('span', 'natal-laco', LACO)); });
    const login = document.querySelector('#f-login');
    if (login && !login.querySelector('.natal-msg')) {
      const imgs = login.querySelectorAll('img'); imgs[imgs.length - 1].after(mk('p', 'natal-msg', `🎄 Boas festas, Equipe Manaus Luz!<small>${txtFaltam}</small>`));
    }
    const quem = document.getElementById('u-eu');
    if (quem && !document.querySelector('.natal-conta')) quem.after(mk('p', 'natal-conta', `🎅 ${txtFaltam}`));
  }

  // ---------- ligar / desligar ----------
  function ligar() { raiz.classList.add('natal'); enfeites(); papaiNoel(); luzes(); bolas(); chao(); neve(); }
  function desligar() {
    raiz.classList.remove('natal'); cancelAnimationFrame(raf); cv = null;
    ['#natal-luzes', '#natal-neve', '#natal-bolas', '#natal-chao', '.natal-gorro', '.natal-laco', '.natal-msg', '.natal-conta', '.natal-noel', '.natal-noel-esteira'].forEach(s => document.querySelectorAll(s).forEach(e => e.remove()));
  }
  function botao() {
    const ref = document.getElementById('trocar-senha'); if (!ref) return;
    const b = mk('button', 'item'); b.type = 'button'; b.id = 'natal-tog';
    const pinta = () => { b.innerHTML = `🎄 Enfeites de Natal <span>${ligado ? 'ligados' : 'desligados'}</span>`; };
    b.onclick = () => { ligado = !ligado; try { localStorage.setItem(CHAVE, ligado ? 'on' : 'off'); } catch (e) { } ligado ? ligar() : desligar(); pinta(); };
    pinta(); ref.before(b);
  }

  function iniciar() {
    botao(); if (ligado) ligar();
    // redesenha a guirlanda sempre que a largura do cabeçalho muda (inclusive quando ele aparece depois da entrada)
    const topo = document.querySelector('.topo'); let t, larg = 0;
    const refaz = () => { clearTimeout(t); t = setTimeout(() => { const w = topo ? topo.clientWidth : 0; if (ligado && w && w !== larg) { larg = w; luzes(); } }, 100); };
    if (topo && 'ResizeObserver' in window) new ResizeObserver(refaz).observe(topo);
    addEventListener('resize', refaz);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
