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
  function ligar() { raiz.classList.add('natal'); enfeites(); luzes(); bolas(); chao(); neve(); }
  function desligar() {
    raiz.classList.remove('natal'); cancelAnimationFrame(raf); cv = null;
    ['#natal-luzes', '#natal-neve', '#natal-bolas', '#natal-chao', '.natal-gorro', '.natal-laco', '.natal-msg', '.natal-conta'].forEach(s => document.querySelectorAll(s).forEach(e => e.remove()));
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
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (ligado) luzes(); }, 150); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
