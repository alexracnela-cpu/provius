// PROVIUS · tema de Réveillon
// Liga sozinho de RV_DE até o fim do dia RV_ATE. Cada pessoa pode desligar no menu do usuário (fica salvo no navegador).
(function () {
  const RV_DE = '2026-12-26', RV_ATE = '2027-01-06';
  const d = new Date(), hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!window.REVEILLON_PREVIA && (hoje < RV_DE || hoje > RV_ATE)) return;

  const raiz = document.documentElement, CHAVE = 'provius-reveillon';
  const parado = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ligado = true; try { ligado = localStorage.getItem(CHAVE) !== 'off'; } catch (e) { }
  const ANO = d.getMonth() === 0 ? d.getFullYear() : d.getFullYear() + 1;
  function txtConta() {
    const agora = new Date(), alvo = new Date(ANO, 0, 1);
    if (agora >= alvo) return `Boas entregas em ${ANO}!`;
    const ms = alvo - agora, dias = Math.round((alvo - new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())) / 864e5);
    if (dias <= 1) { const h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60; return `É hoje! Faltam ${h}h${String(m).padStart(2, '0')} para ${ANO}`; }
    return `Faltam ${dias} dias para ${ANO}`;
  }
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

  const OURO = '#e8b931', OURO2 = '#f6d77a', OURO3 = '#b98a12', NOITE = '#0b1f4a', PRATA = '#cfd8e3';
  const CHAPEU = `<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M20 6 L36 44 H4Z" fill="${NOITE}"/><path d="M20 6 L36 44 H26Z" fill="#162d63"/><path d="M15 17 L25 17 M12 25 L28 25 M9 33 L31 33" stroke="${OURO}" stroke-width="3"/><rect x="2" y="41" width="36" height="6" rx="3" fill="${OURO}"/><path d="M20 5 l-5 -4 M20 5 l5 -4 M20 5 l0 -5" stroke="${OURO2}" stroke-width="1.6" stroke-linecap="round"/><circle cx="20" cy="5" r="4.5" fill="${OURO2}"/></svg>`;
  const CORES = [OURO, '#ffffff', OURO2, PRATA, OURO];

  // ---------- varal de luzes douradas ----------
  function luzes() {
    const topo = document.querySelector('.topo'); if (!topo) return;
    let el = document.getElementById('rv-luzes');
    if (!el) { el = mk('div'); el.id = 'rv-luzes'; el.setAttribute('aria-hidden', 'true'); topo.appendChild(el); }
    if (!topo.clientWidth) return;
    const w = Math.max(320, topo.clientWidth), passo = 64, n = Math.ceil(w / passo) + 1;
    let fio = 'M0 2', lamps = '', estrelas = '';
    for (let i = 0; i < n; i++) {
      const x0 = i * passo, xm = x0 + passo / 2, x1 = x0 + passo;
      fio += ` Q${xm} 14 ${x1} 2`;
      [0.2, 0.4, 0.6, 0.8].forEach((t, k) => {
        const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * xm + t * t * x1, y = 2 + 2 * (1 - t) * t * 12;
        const idx = i * 4 + k, cor = CORES[idx % CORES.length], cls = ['', 'b', 'c'][idx % 3];
        lamps += `<g class="lamp ${cls}" style="color:${cor}"><circle cx="${x}" cy="${y + 3.5}" r="2.6" fill="${cor}"/></g>`;
      });
      estrelas += `<path transform="translate(${x1} 3)" d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4Z" fill="${OURO2}"/>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${w} 22" height="22"><path d="${fio}" fill="none" stroke="${OURO3}" stroke-width="1.6"/>${lamps}${estrelas}</svg>`;
  }

  // ---------- estrelas e serpentinas penduradas ----------
  function estrela(cx, cy, r, cor) { let p = ''; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .45 : r; p += `${k ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)} `; } return `<path d="${p}Z" fill="${cor}" stroke="${OURO3}" stroke-width="1"/>`; }
  function pendurados() {
    if (document.getElementById('rv-estrelas')) return;
    const el = mk('div'); el.id = 'rv-estrelas'; el.setAttribute('aria-hidden', 'true');
    const lista = [['1.2%', 110, OURO], ['3.4%', 60, PRATA], ['5.4%', 150, OURO2], ['92.2%', 140, OURO2], ['94.4%', 70, OURO], ['96.6%', 120, PRATA]];
    el.innerHTML = lista.map(([x, h, c], i) => {
      const serp = i % 2 ? '' : `<path d="M17 ${h * .2} q6 6 0 12 q-6 6 0 12 q6 6 0 12" stroke="${c === PRATA ? OURO : PRATA}" stroke-width="2" fill="none" opacity=".8"/>`;
      return `<svg class="pend" style="left:${x};width:34px;height:${h + 36}px" viewBox="0 0 34 ${h + 36}"><line x1="17" y1="0" x2="17" y2="${h + 4}" stroke="#9aa6b2" stroke-width="1"/>${serp}<g class="brilho">${estrela(17, h + 18, 15, c)}</g></svg>`;
    }).join('');
    document.body.appendChild(el);
  }

  // ---------- rodapé: balões 2027 e taças ----------
  function balao(x, y, n, cor, esc) { return `<g><path d="M${x} ${y + 34} q-4 30 6 60" stroke="#9aa6b2" stroke-width="1" fill="none"/><ellipse cx="${x}" cy="${y}" rx="22" ry="27" fill="${cor}"/><path d="M${x - 4} ${y + 26} h8 l-4 7z" fill="${esc}"/><ellipse cx="${x - 8}" cy="${y - 11}" rx="5" ry="8" fill="#fff" opacity=".45" transform="rotate(25 ${x - 8} ${y - 11})"/><text x="${x}" y="${y + 10}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="28" fill="${esc}">${n}</text></g>`; }
  function chao() {
    if (document.getElementById('rv-chao')) return;
    const el = mk('div'); el.id = 'rv-chao'; el.setAttribute('aria-hidden', 'true');
    const dig = String(ANO).split('');
    el.innerHTML = `<svg class="baloes" viewBox="0 0 210 160">${balao(30, 52, dig[0], OURO, NOITE)}${balao(78, 40, dig[1], PRATA, NOITE)}${balao(126, 56, dig[2], OURO, NOITE)}${balao(174, 44, dig[3], NOITE, OURO2)}</svg>`
      + `<svg class="tacas" viewBox="0 0 150 120">
        <g transform="rotate(-12 60 112)"><path d="M40 10 H76 L72 52 Q58 64 44 52Z" fill="${OURO2}" opacity=".9"/><path d="M40 10 H76 L75 22 H41Z" fill="#fff8dc"/><path d="M58 60 V104 M44 108 H72" stroke="${PRATA}" stroke-width="4" stroke-linecap="round"/><circle cx="52" cy="40" r="1.8" fill="#fff"/><circle cx="62" cy="32" r="1.4" fill="#fff"/></g>
        <g transform="rotate(12 92 112)"><path d="M74 10 H110 L106 52 Q92 64 78 52Z" fill="${OURO2}" opacity=".9"/><path d="M74 10 H110 L109 22 H75Z" fill="#fff8dc"/><path d="M92 60 V104 M78 108 H106" stroke="${PRATA}" stroke-width="4" stroke-linecap="round"/><circle cx="88" cy="38" r="1.8" fill="#fff"/></g>
        <path d="M76 4 l2 -4 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2z" fill="${OURO}"/>
        <g transform="translate(118 30)"><rect x="6" y="0" width="8" height="16" fill="#1d4d2c"/><path d="M4 16 H16 Q22 24 22 34 V88 H-2 V34 Q-2 24 4 16Z" fill="#1d4d2c"/><rect x="-2" y="48" width="24" height="20" fill="${OURO}"/><rect x="5" y="-3" width="10" height="6" fill="${OURO3}"/></g></svg>`;
    const f = document.getElementById('fundo'); f && f.parentNode ? f.parentNode.insertBefore(el, f.nextSibling) : document.body.prepend(el);
  }

  // ---------- fogos de artifício e confete ----------
  let raf = 0, cv = null;
  function fogos() {
    if (parado || cv) return;
    cv = mk('canvas'); cv.id = 'rv-fogos'; cv.setAttribute('aria-hidden', 'true');
    const f = document.getElementById('fundo'); f && f.parentNode ? f.parentNode.insertBefore(cv, f.nextSibling) : document.body.prepend(cv);
    const ctx = cv.getContext('2d'); let W, H, conf = [], fog = [], foguetes = [], prox = 0;
    const escuro = () => (raiz.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    const PAL_E = [OURO, OURO2, '#ffffff', PRATA, '#ff9ec7', '#7fd6ff', '#9be8a8'], PAL_C = ['#d19a00', '#b98a12', '#1f4fb5', '#c2185b', '#0e8a6a', '#7b3fc4', '#e0602a'];
    let PAL = PAL_E;
    function medir() {
      const r = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight; cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0);
      const qtd = Math.round(Math.min(70, W * H / 18000));
      while (conf.length < qtd) conf.push(novoConf(true)); conf.length = qtd;
    }
    function novoConf(qq) { return { x: Math.random() * W, y: qq ? Math.random() * H : -10, v: .5 + Math.random() * 1, g: Math.random() * 6.28, o: Math.random() * 6.28, w: 4 + Math.random() * 5, c: [OURO, OURO3, '#9aa8b8', NOITE, OURO2][Math.floor(Math.random() * 5)] }; }
    function lanca() { PAL = escuro() ? PAL_E : PAL_C; const x = W * (.1 + Math.random() * .8); foguetes.push({ x, y: H, vy: -(7 + Math.random() * 3), alvo: H * (.1 + Math.random() * .3), c: PAL[Math.floor(Math.random() * PAL.length)] }); }
    function estoura(x, y, c) { const n = 70 + Math.floor(Math.random() * 30), dois = Math.random() < .35 ? PAL[Math.floor(Math.random() * PAL.length)] : c; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random() * .05, s = 1.5 + Math.random() * 2.8; fog.push({ x, y, px: x, py: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 1, c: i % 2 ? c : dois }); } }
    function quadro(t) {
      ctx.clearRect(0, 0, W, H);
      if (t > prox) { lanca(); prox = t + 1100 + Math.random() * 1600; }
      ctx.lineCap = 'round';
      foguetes = foguetes.filter(r => { r.y += r.vy; r.vy *= .985; ctx.strokeStyle = escuro() ? 'rgba(255,230,160,.8)' : 'rgba(185,138,18,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + 14); ctx.stroke(); if (r.y <= r.alvo || r.vy > -1.5) { estoura(r.x, r.y, r.c); return false; } return true; });
      fog = fog.filter(p => p.l > 0);
      for (const p of fog) { p.px = p.x; p.py = p.y; p.x += p.vx; p.y += p.vy; p.vy += .04; p.vx *= .985; p.vy *= .985; p.l -= .011; ctx.globalAlpha = Math.max(0, p.l); ctx.strokeStyle = p.c; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      ctx.globalAlpha = 1;
      for (const p of conf) { p.y += p.v; p.o += .02; p.g += .05; p.x += Math.sin(p.o) * .6; if (p.y > H + 10) Object.assign(p, novoConf(false)); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.g); ctx.scale(1, Math.cos(p.g * 1.3)); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -1.6, p.w, 3.2); ctx.restore(); }
      raf = requestAnimationFrame(quadro);
    }
    medir(); addEventListener('resize', medir); raf = requestAnimationFrame(quadro);
  }

  // ---------- personagens (a "borda" do desenho fica alinhada ao topo do elemento onde ele está) ----------
  // taças brindando, apoiadas na borda da caixa de entrada (borda em y = 100)
  const TACAS = { vb: [0, -20, 110, 120], borda: 100, svg: () => `
    <g><animateTransform attributeName="transform" type="rotate" values="0 35 100;-14 35 100;0 35 100;0 35 100" keyTimes="0;.18;.36;1" dur="3s" repeatCount="indefinite"/>
      <path d="M15 8 H51 L47 50 Q33 62 19 50Z" fill="${OURO}" stroke="${OURO3}" stroke-width="1.5"/><path d="M15 8 H51 L50 20 H16Z" fill="#fff8dc"/><path d="M33 58 V96 M20 99 H46" stroke="#9aa8b8" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="28" cy="40" r="1.8" fill="#fff"><animate attributeName="cy" values="46;24" dur="1.4s" repeatCount="indefinite"/></circle><circle cx="38" cy="36" r="1.4" fill="#fff"><animate attributeName="cy" values="44;22" dur="1.1s" repeatCount="indefinite"/></circle></g>
    <g><animateTransform attributeName="transform" type="rotate" values="0 75 100;14 75 100;0 75 100;0 75 100" keyTimes="0;.18;.36;1" dur="3s" repeatCount="indefinite"/>
      <path d="M59 8 H95 L91 50 Q77 62 63 50Z" fill="${OURO}" stroke="${OURO3}" stroke-width="1.5"/><path d="M59 8 H95 L94 20 H60Z" fill="#fff8dc"/><path d="M77 58 V96 M64 99 H90" stroke="#9aa8b8" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="72" cy="40" r="1.8" fill="#fff"><animate attributeName="cy" values="46;24" dur="1.3s" repeatCount="indefinite"/></circle></g>
    <g opacity="0"><animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;.15;.2;.32;1" dur="3s" repeatCount="indefinite"/>
      <path d="M55 -2 V-16 M55 -2 L45 -12 M55 -2 L65 -12 M55 -2 L42 -2 M55 -2 L68 -2" stroke="${OURO}" stroke-width="2.4" stroke-linecap="round"/><circle cx="55" cy="-2" r="3" fill="#fff"/></g>` };

  // relógio espiando no "Aguardando você": sobe, os ponteiros correm para meia-noite, brilha e desce (borda em y = 6)
  const RELOGIO = { vb: [-40, -52, 80, 66], borda: 6, svg: (i) => `
    <defs><clipPath id="rc${i}"><rect x="-60" y="-80" width="120" height="86"/></clipPath></defs>
    <g clip-path="url(#rc${i})"><g>
      <animateTransform attributeName="transform" type="translate" values="0 56;0 56;0 0;0 0;0 56;0 56" keyTimes="0;.03;.1;.88;.95;1" dur="8s" repeatCount="indefinite"/>
      <path d="M-26 -44 l-8 -6 a6 6 0 0 1 10 -4z M26 -44 l8 -6 a6 6 0 0 0 -10 -4z" fill="${OURO}"/>
      <circle cx="0" cy="-20" r="28" fill="${OURO}" stroke="${OURO3}" stroke-width="2"/><circle cx="0" cy="-20" r="23" fill="#fffdf4"/>
      ${Array.from({ length: 12 }, (_, k) => { const a = k * Math.PI / 6, r1 = k % 3 ? 20 : 18; return `<line x1="${(Math.sin(a) * r1).toFixed(1)}" y1="${(-20 - Math.cos(a) * r1).toFixed(1)}" x2="${(Math.sin(a) * 22).toFixed(1)}" y2="${(-20 - Math.cos(a) * 22).toFixed(1)}" stroke="${NOITE}" stroke-width="${k % 3 ? 1 : 2}"/>`; }).join('')}
      <line x1="0" y1="-20" x2="0" y2="-32" stroke="${NOITE}" stroke-width="2.6" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="-60 0 -20;-60 0 -20;0 0 -20;0 0 -20" keyTimes="0;.2;.45;1" dur="8s" repeatCount="indefinite"/></line>
      <line x1="0" y1="-20" x2="0" y2="-38" stroke="${NOITE}" stroke-width="1.8" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="-720 0 -20;-720 0 -20;0 0 -20;0 0 -20" keyTimes="0;.2;.45;1" dur="8s" repeatCount="indefinite"/></line>
      <circle cx="0" cy="-20" r="2.4" fill="${OURO3}"/>
      <g opacity="0"><animate attributeName="opacity" values="0;0;1;0;1;0;0" keyTimes="0;.45;.5;.56;.62;.7;1" dur="8s" repeatCount="indefinite"/>
        <path d="M-34 -40 l-6 -6 M34 -40 l6 -6 M-38 -20 h-8 M38 -20 h8" stroke="${OURO}" stroke-width="2.4" stroke-linecap="round"/></g>
    </g></g>
    <ellipse cx="-20" cy="7" rx="7" ry="4" fill="${OURO3}"/><ellipse cx="20" cy="7" rx="7" ry="4" fill="${OURO3}"/>` };

  // garrafa de espumante em cima do 1º cartão das etapas: a rolha estoura e sai espuma (borda em y = 100)
  const ESPUMANTE = { vb: [-34, -60, 68, 160], borda: 100, svg: () => `
    <g><animateTransform attributeName="transform" type="rotate" values="0 0 100;0 0 100;-4 0 100;4 0 100;-3 0 100;0 0 100;0 0 100" keyTimes="0;.2;.25;.3;.35;.4;1" dur="5s" repeatCount="indefinite"/>
      <path d="M-6 0 H6 V22 Q16 32 16 46 V98 Q16 100 14 100 H-14 Q-16 100 -16 98 V46 Q-16 32 -6 22Z" fill="#1d4d2c"/>
      <path d="M-11 50 V92" stroke="#3c7a52" stroke-width="3" stroke-linecap="round" opacity=".7"/>
      <rect x="-16" y="54" width="32" height="26" fill="${OURO}"/><rect x="-16" y="54" width="32" height="3" fill="${OURO3}"/>
      <text x="0" y="72" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="10" fill="${NOITE}">${ANO}</text>
      <path d="M-7 -2 H7 V20 H-7Z" fill="${OURO}"/><path d="M-7 8 H7" stroke="${OURO3}" stroke-width="1.4"/></g>
    <g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;10 -46;22 -10;22 -10;0 0" keyTimes="0;.2;.3;.42;.95;1" dur="5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="1;1;1;1;0;0;1" keyTimes="0;.2;.3;.42;.45;.95;1" dur="5s" repeatCount="indefinite"/>
      <rect x="-5" y="-10" width="10" height="9" rx="2" fill="#d9b48a" stroke="#a9845c"/></g>
    <g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.2;.22;.55;.7;1" dur="5s" repeatCount="indefinite"/>
      <circle cx="-4" cy="-8" r="5" fill="#fffbe6"/><circle cx="4" cy="-12" r="6" fill="#fffbe6"/><circle cx="0" cy="-20" r="5" fill="#fff8dc"/><circle cx="-8" cy="-22" r="3.5" fill="#fffbe6"/><circle cx="8" cy="-26" r="3" fill="#fffbe6"/>
      <path d="M-14 -30 l-6 -6 M14 -34 l7 -5 M0 -36 v-9 M-20 -14 h-8 M20 -18 h8" stroke="${OURO}" stroke-width="2.2" stroke-linecap="round"/></g>` };

  let nB = 0;
  function boneco(p, alto, pos) {
    const [, y, w, h] = p.vb, esc = alto / h, larg = w * esc, abaixo = (y + h - p.borda) * esc, i = 'r' + (++nB);
    const el = mk('div', 'rv-boneco'); el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `width:${larg}px;height:${alto}px;bottom:calc(100% - ${abaixo}px);${pos(larg)}`;
    el.innerHTML = `<svg viewBox="${p.vb.join(' ')}">${p.svg(i)}</svg>`;
    if (parado) setTimeout(() => { const s = el.querySelector('svg'); s && s.pauseAnimations && s.pauseAnimations(); });
    return el;
  }
  function personagens() {
    document.querySelectorAll('#f-login, #f-senha').forEach(c => { if (!c.querySelector(':scope > .rv-boneco')) c.append(boneco(TACAS, 92, () => 'right:20px')); });
    document.querySelectorAll('.lado > .caixa').forEach(c => { if (c.querySelector('.fila') && !c.querySelector(':scope > .rv-boneco')) c.append(boneco(RELOGIO, 64, () => 'right:30px')); });
    const est = document.getElementById('esteira');
    if (est && !document.querySelector('.rv-boneco-esteira')) {
      const w = mk('div', 'rv-boneco-esteira'); w.setAttribute('aria-hidden', 'true');
      w.append(boneco(ESPUMANTE, 112, l => `left:calc(var(--col) * .78 - ${l / 2}px)`)); est.before(w);
    }
  }

  // ---------- chapéus, mensagem e contagem ----------
  let tConta = 0;
  function enfeites() {
    document.querySelectorAll('.marca, .acesso-cx').forEach(c => { if (!c.querySelector(':scope > .rv-chapeu')) c.prepend(mk('span', 'rv-chapeu', CHAPEU)); });
    const login = document.querySelector('#f-login');
    if (login && !login.querySelector('.rv-msg')) {
      const imgs = login.querySelectorAll('img'); imgs[imgs.length - 1].after(mk('p', 'rv-msg', `✨ Feliz ${ANO}, Equipe Manaus Luz!<small>${txtConta()}</small>`));
    }
    const quem = document.getElementById('u-eu');
    if (quem && !document.querySelector('.rv-conta')) quem.after(mk('p', 'rv-conta', `🥂 ${txtConta()}`));
    clearInterval(tConta);
    tConta = setInterval(() => { const t = txtConta(); document.querySelectorAll('.rv-msg small').forEach(e => e.textContent = t); document.querySelectorAll('.rv-conta').forEach(e => e.textContent = '🥂 ' + t); }, 30000);
  }

  // ---------- ligar / desligar ----------
  function ligar() { raiz.classList.add('reveillon'); enfeites(); personagens(); luzes(); pendurados(); chao(); fogos(); }
  function desligar() {
    raiz.classList.remove('reveillon'); cancelAnimationFrame(raf); cv = null; clearInterval(tConta);
    ['#rv-luzes', '#rv-fogos', '#rv-estrelas', '#rv-chao', '.rv-chapeu', '.rv-msg', '.rv-conta', '.rv-boneco', '.rv-boneco-esteira'].forEach(s => document.querySelectorAll(s).forEach(e => e.remove()));
  }
  function botao() {
    const ref = document.getElementById('trocar-senha'); if (!ref) return;
    const b = mk('button', 'item'); b.type = 'button'; b.id = 'rv-tog';
    const pinta = () => { b.innerHTML = `🎆 Enfeites de Ano Novo <span>${ligado ? 'ligados' : 'desligados'}</span>`; };
    b.onclick = () => { ligado = !ligado; try { localStorage.setItem(CHAVE, ligado ? 'on' : 'off'); } catch (e) { } ligado ? ligar() : desligar(); pinta(); };
    pinta(); ref.before(b);
  }

  function iniciar() {
    botao(); if (ligado) ligar();
    const topo = document.querySelector('.topo'); let t, larg = 0;
    const refaz = () => { clearTimeout(t); t = setTimeout(() => { const w = topo ? topo.clientWidth : 0; if (ligado && w && w !== larg) { larg = w; luzes(); } if (ligado) personagens(); }, 100); };
    if (topo && 'ResizeObserver' in window) new ResizeObserver(refaz).observe(topo);
    addEventListener('resize', refaz);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
