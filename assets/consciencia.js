// PROVIUS · tema do Dia Nacional de Zumbi e da Consciência Negra (20 de novembro)
// Liga sozinho todo ano no dia 20/11 (o dia inteiro). Cada pessoa pode desligar no menu do usuário (fica salvo no navegador).
// Nesse dia o natal.js fica parado (ver window.PROVIUS_TEMA_DIA).
(function () {
  const d = new Date();
  const hojeCN = d.getMonth() === 10 && d.getDate() === 20;
  if (!window.CN_PREVIA && !hojeCN) return;
  window.PROVIUS_TEMA_DIA = 'consciencia';

  const raiz = document.documentElement, CHAVE = 'provius-consciencia';
  const parado = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ligado = true; try { ligado = localStorage.getItem(CHAVE) !== 'off'; } catch (e) { }
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

  const OURO = '#f2b705', OURO2 = '#ffd45c', OURO3 = '#a87a00', VERM = '#c1272d', VERDE = '#1e7b3c', PRETO = '#1b1410', TERRA = '#b5562b', TRONCO = '#6b4226';

  // Sankofa (símbolo adinkra: "voltar e buscar o que ficou para trás" — memória e ancestralidade)
  const SANKOFA = (cor, w = 3.4) => `<svg viewBox="0 0 40 42" aria-hidden="true"><g fill="none" stroke="${cor}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 13 C17 5 5 5 5 15 C5 23 13 29 20 35 C27 29 35 23 35 15 C35 5 23 5 20 13"/>
    <path d="M20 13 C19.5 18 14 19 13 15.5 C12.3 12.8 15.6 11.6 16.6 14"/>
    <path d="M20 13 C20.5 18 26 19 27 15.5 C27.7 12.8 24.4 11.6 23.4 14"/>
    <path d="M20 35 C18 39 13.5 39.5 13 37 M20 35 C22 39 26.5 39.5 27 37"/></g></svg>`;

  // ---------- faixa de grafismos (inspirada nos tecidos kente) na borda do cabeçalho ----------
  function faixa() {
    const topo = document.querySelector('.topo'); if (!topo || document.getElementById('cn-faixa')) return;
    const el = mk('div'); el.id = 'cn-faixa'; el.setAttribute('aria-hidden', 'true'); topo.appendChild(el);
  }

  // ---------- rodapé: baobás com o sol se pondo ----------
  function baoba(x, y, s, cor) {
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="${cor}">
      <path d="M-13 0 C-11 -26 -15 -46 -9 -62 L9 -62 C15 -46 11 -26 13 0Z"/>
      <path d="M-7 -60 L-26 -82 M-2 -62 L-8 -90 M3 -62 L6 -92 M7 -60 L27 -80" stroke="${cor}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="-28" cy="-86" rx="15" ry="7"/><ellipse cx="-8" cy="-94" rx="14" ry="7"/><ellipse cx="8" cy="-96" rx="15" ry="7"/><ellipse cx="29" cy="-84" rx="15" ry="7"/></g>`;
  }
  function chao() {
    if (document.getElementById('cn-chao')) return;
    const el = mk('div'); el.id = 'cn-chao'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<svg class="esq" viewBox="0 0 300 160">
        <defs><radialGradient id="cn-sol" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${OURO2}"/><stop offset=".65" stop-color="${OURO}"/><stop offset="1" stop-color="${TERRA}" stop-opacity=".0"/></radialGradient></defs>
        <circle class="sol" cx="150" cy="128" r="74" fill="url(#cn-sol)" opacity=".75"/>
        <circle cx="150" cy="128" r="42" fill="${OURO}" opacity=".9"/>
        ${baoba(78, 146, 1.05, PRETO)}${baoba(226, 146, .72, PRETO)}
        <path d="M0 160 Q40 140 90 146 Q150 152 210 144 Q260 140 300 160Z" fill="${PRETO}"/></svg>`
      + `<svg class="dir" viewBox="0 0 130 140">${baoba(64, 132, .95, PRETO)}<path d="M0 140 Q30 126 64 130 Q100 134 130 140Z" fill="${PRETO}"/>
        <g transform="translate(96 74) scale(.62)">${SANKOFA(OURO, 3.6).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g></svg>`;
    const f = document.getElementById('fundo'); f && f.parentNode ? f.parentNode.insertBefore(el, f.nextSibling) : document.body.prepend(el);
  }

  // ---------- grafismos flutuando no fundo ----------
  let raf = 0, cv = null;
  function grafismos() {
    if (parado || cv) return;
    cv = mk('canvas'); cv.id = 'cn-grafismos'; cv.setAttribute('aria-hidden', 'true');
    const f = document.getElementById('fundo'); f && f.parentNode ? f.parentNode.insertBefore(cv, f.nextSibling) : document.body.prepend(cv);
    const ctx = cv.getContext('2d'); let W, H, ps = [];
    const PAL = [OURO, VERM, VERDE, OURO2, TERRA];
    function novo(qq) { return { x: Math.random() * W, y: qq ? Math.random() * H : H + 20, v: .18 + Math.random() * .35, r: 4 + Math.random() * 7, g: Math.random() * 6.28, vg: (Math.random() - .5) * .01, o: Math.random() * 6.28, t: Math.floor(Math.random() * 4), c: PAL[Math.floor(Math.random() * PAL.length)], a: .25 + Math.random() * .35 }; }
    function medir() {
      const r = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight; cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0);
      const qtd = Math.round(Math.min(46, W * H / 26000)); while (ps.length < qtd) ps.push(novo(true)); ps.length = qtd;
    }
    function forma(p) {
      const r = p.r; ctx.beginPath();
      if (p.t === 0) { ctx.moveTo(0, -r); ctx.lineTo(r * .7, 0); ctx.lineTo(0, r); ctx.lineTo(-r * .7, 0); ctx.closePath(); ctx.fill(); }          // losango
      else if (p.t === 1) { ctx.moveTo(0, -r); ctx.lineTo(r * .9, r * .7); ctx.lineTo(-r * .9, r * .7); ctx.closePath(); ctx.fill(); }            // triângulo
      else if (p.t === 2) { ctx.arc(0, 0, r * .75, 0, 6.283); ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * .25, 0, 6.283); ctx.fill(); } // círculo com centro
      else { ctx.lineWidth = 2.2; ctx.moveTo(-r, -r * .3); ctx.lineTo(-r * .33, r * .3); ctx.lineTo(r * .33, -r * .3); ctx.lineTo(r, r * .3); ctx.stroke(); } // zigue-zague
    }
    function quadro() {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.y -= p.v; p.o += .008; p.g += p.vg; p.x += Math.sin(p.o) * .25; if (p.y < -20) Object.assign(p, novo(false));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.g); ctx.globalAlpha = p.a; ctx.fillStyle = ctx.strokeStyle = p.c; forma(p); ctx.restore();
      }
      raf = requestAnimationFrame(quadro);
    }
    medir(); addEventListener('resize', medir); raf = requestAnimationFrame(quadro);
  }

  // ---------- personagens (a "borda" do desenho fica alinhada ao topo do elemento onde ele está) ----------
  // pássaro Sankofa em cima da caixa de entrada: olha para trás, para o ovo nas costas, e volta (borda em y = 50)
  const PASSARO = { vb: [-52, -40, 100, 92], borda: 50, svg: () => `
    <path d="M-22 14 L-46 2 L-41 17 L-47 30 L-20 25Z" fill="${VERM}"/><path d="M-30 8 L-42 6 M-30 20 L-43 25" stroke="${PRETO}" stroke-width="1.6" opacity=".5"/>
    <path d="M-6 33 L-8 49 M-12 49 H-3 M6 33 L8 49 M4 49 H13" stroke="${PRETO}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="0" cy="18" rx="26" ry="16" fill="${OURO}" stroke="${OURO3}" stroke-width="1.5"/>
    <path d="M-14 16 Q-2 30 14 18" fill="none" stroke="${VERDE}" stroke-width="3" stroke-linecap="round"/>
    <path d="M-12 22 l4 -4 l4 4 l4 -4 l4 4 l4 -4" fill="none" stroke="${PRETO}" stroke-width="1.6" opacity=".6"/>
    <ellipse cx="-17" cy="3" rx="5.5" ry="7" fill="#fffaf0" stroke="${OURO3}" stroke-width="1.2" transform="rotate(-20 -17 3)"/>
    <g><animateTransform attributeName="transform" type="rotate" values="0 15 10;0 15 10;-62 15 10;-62 15 10;0 15 10;0 15 10" keyTimes="0;.3;.42;.72;.84;1" dur="6s" repeatCount="indefinite"/>
      <path d="M15 10 C17 2 18 -6 20 -12" stroke="${OURO}" stroke-width="9" stroke-linecap="round" fill="none"/>
      <circle cx="20" cy="-18" r="9" fill="${OURO}" stroke="${OURO3}" stroke-width="1.5"/>
      <path d="M14 -27 Q20 -33 26 -27" fill="none" stroke="${VERM}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="23" cy="-20" r="1.8" fill="${PRETO}"><animate attributeName="r" values="1.8;1.8;.3;1.8;1.8" keyTimes="0;.15;.17;.19;1" dur="6s" repeatCount="indefinite"/></circle>
      <path d="M28 -21 L38 -17.5 L28 -14.5Z" fill="${TERRA}"><animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;.36;.37;.78;.79;1" dur="6s" repeatCount="indefinite"/></path>
      <path d="M13 -22 L5 -25 L12.5 -16Z" fill="${TERRA}" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;.36;.37;.78;.79;1" dur="6s" repeatCount="indefinite"/></path></g>` };

  // sol espiando no "Aguardando você": sobe, os raios giram e desce (borda em y = 6)
  const SOL = { vb: [-40, -52, 80, 66], borda: 6, svg: (i) => `
    <defs><clipPath id="cs${i}"><rect x="-60" y="-80" width="120" height="86"/></clipPath></defs>
    <g clip-path="url(#cs${i})"><g>
      <animateTransform attributeName="transform" type="translate" values="0 56;0 56;0 0;0 0;0 56;0 56" keyTimes="0;.03;.1;.88;.95;1" dur="8s" repeatCount="indefinite"/>
      <g><animateTransform attributeName="transform" type="rotate" from="0 0 -20" to="45 0 -20" dur="8s" repeatCount="indefinite"/>
        ${Array.from({ length: 12 }, (_, k) => { const a = k * Math.PI / 6, c = [OURO, VERM, VERDE][k % 3]; const x = Math.sin(a), y = -Math.cos(a); return `<path d="M${(x * 24 - y * 4).toFixed(1)} ${(-20 + y * 24 + x * 4).toFixed(1)} L${(x * 36).toFixed(1)} ${(-20 + y * 36).toFixed(1)} L${(x * 24 + y * 4).toFixed(1)} ${(-20 + y * 24 - x * 4).toFixed(1)}Z" fill="${c}"/>`; }).join('')}</g>
      <circle cx="0" cy="-20" r="22" fill="${OURO}" stroke="${OURO3}" stroke-width="2"/>
      <circle cx="0" cy="-20" r="15" fill="none" stroke="${PRETO}" stroke-width="1.6" stroke-dasharray="4 3" opacity=".55"/>
      <g transform="translate(-9.5 -30) scale(.48)">${SANKOFA(PRETO, 3.8).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>
    </g></g>
    <ellipse cx="-20" cy="7" rx="7" ry="4" fill="${OURO3}"/><ellipse cx="20" cy="7" rx="7" ry="4" fill="${OURO3}"/>` };

  // baobá em cima do 1º cartão das etapas: a copa balança e as folhas caem (borda em y = 100)
  const BAOBA = { vb: [-44, -40, 88, 140], borda: 100, svg: () => `
    <path d="M-13 100 C-11 74 -15 50 -9 34 L9 34 C15 50 11 74 13 100Z" fill="${TRONCO}"/>
    <path d="M-5 50 Q-2 70 -6 92 M4 46 Q7 66 3 90" stroke="#4e2f1a" stroke-width="1.6" fill="none" opacity=".6"/>
    <g><animateTransform attributeName="transform" type="rotate" values="-3 0 36;3 0 36;-3 0 36" dur="4s" repeatCount="indefinite"/>
      <path d="M-7 36 L-26 12 M-2 34 L-8 4 M3 34 L6 2 M7 36 L28 14" stroke="${TRONCO}" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="-28" cy="8" rx="15" ry="8" fill="${VERDE}"/><ellipse cx="-8" cy="-1" rx="15" ry="8" fill="#26914a"/><ellipse cx="9" cy="-3" rx="16" ry="8" fill="${VERDE}"/><ellipse cx="29" cy="10" rx="15" ry="8" fill="#26914a"/>
      <ellipse cx="0" cy="-12" rx="11" ry="6" fill="#2fa555"/>
      <circle cx="-18" cy="12" r="2.4" fill="${OURO}"/><circle cx="18" cy="6" r="2.4" fill="${OURO}"/><circle cx="2" cy="-6" r="2.2" fill="${VERM}"/></g>
    <g><animateTransform attributeName="transform" type="translate" values="0 0;8 40;-4 80" dur="5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.8;1" dur="5s" repeatCount="indefinite"/>
      <ellipse cx="-22" cy="14" rx="3.4" ry="1.8" fill="#26914a" transform="rotate(30 -22 14)"/></g>
    <g><animateTransform attributeName="transform" type="translate" values="0 0;-8 36;4 78" dur="6.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.8;1" dur="6.5s" repeatCount="indefinite"/>
      <ellipse cx="24" cy="16" rx="3.4" ry="1.8" fill="${OURO}" transform="rotate(-30 24 16)"/></g>` };

  let nB = 0;
  function boneco(p, alto, pos) {
    const [, y, w, h] = p.vb, esc = alto / h, larg = w * esc, abaixo = (y + h - p.borda) * esc, i = 'c' + (++nB);
    const el = mk('div', 'cn-boneco'); el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `width:${larg}px;height:${alto}px;bottom:calc(100% - ${abaixo}px);${pos(larg)}`;
    el.innerHTML = `<svg viewBox="${p.vb.join(' ')}">${p.svg(i)}</svg>`;
    if (parado) setTimeout(() => { const s = el.querySelector('svg'); s && s.pauseAnimations && s.pauseAnimations(); });
    return el;
  }
  function personagens() {
    document.querySelectorAll('#f-login, #f-senha').forEach(c => { if (!c.querySelector(':scope > .cn-boneco')) c.append(boneco(PASSARO, 96, () => 'right:22px')); });
    document.querySelectorAll('.lado > .caixa').forEach(c => { if (c.querySelector('.fila') && !c.querySelector(':scope > .cn-boneco')) c.append(boneco(SOL, 64, () => 'right:30px')); });
    const est = document.getElementById('esteira');
    if (est && !document.querySelector('.cn-boneco-esteira')) {
      const w = mk('div', 'cn-boneco-esteira'); w.setAttribute('aria-hidden', 'true');
      w.append(boneco(BAOBA, 104, l => `left:calc(var(--col) * .78 - ${l / 2}px)`)); est.before(w);
    }
  }

  // ---------- Sankofa no logo, mensagem e menu ----------
  function enfeites() {
    document.querySelectorAll('.marca').forEach(c => { if (!c.querySelector(':scope > .cn-sankofa')) c.prepend(mk('span', 'cn-sankofa', SANKOFA(OURO, 3.6))); });
    const login = document.querySelector('#f-login');
    if (login && !login.querySelector('.cn-msg')) {
      const imgs = login.querySelectorAll('img'); imgs[imgs.length - 1].after(mk('p', 'cn-msg', `✊🏾 Dia da Consciência Negra<small>20 de novembro · Memória, respeito e igualdade<br>Equipe Manaus Luz</small>`));
    }
    const quem = document.getElementById('u-eu');
    if (quem && !document.querySelector('.cn-conta')) quem.after(mk('p', 'cn-conta', '✊🏾 Hoje é Dia de Zumbi e da Consciência Negra'));
  }

  // ---------- ligar / desligar ----------
  function ligar() { raiz.classList.add('consciencia'); enfeites(); personagens(); faixa(); chao(); grafismos(); }
  function desligar() {
    raiz.classList.remove('consciencia'); cancelAnimationFrame(raf); if (cv) cv.remove(); cv = null;
    ['#cn-faixa', '#cn-grafismos', '#cn-chao', '.cn-sankofa', '.cn-msg', '.cn-conta', '.cn-boneco', '.cn-boneco-esteira'].forEach(s => document.querySelectorAll(s).forEach(e => e.remove()));
  }
  function botao() {
    const ref = document.getElementById('trocar-senha'); if (!ref) return;
    const b = mk('button', 'item'); b.type = 'button'; b.id = 'cn-tog';
    const pinta = () => { b.innerHTML = `✊🏾 Enfeites da Consciência Negra <span>${ligado ? 'ligados' : 'desligados'}</span>`; };
    b.onclick = () => { ligado = !ligado; try { localStorage.setItem(CHAVE, ligado ? 'on' : 'off'); } catch (e) { } ligado ? ligar() : desligar(); pinta(); };
    pinta(); ref.before(b);
  }

  function iniciar() {
    botao(); if (ligado) ligar();
    const topo = document.querySelector('.topo'); let t;
    const refaz = () => { clearTimeout(t); t = setTimeout(() => { if (ligado) personagens(); }, 100); };
    if (topo && 'ResizeObserver' in window) new ResizeObserver(refaz).observe(topo);
    addEventListener('resize', refaz);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
