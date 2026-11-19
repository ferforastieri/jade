import './styles.css';

const app = document.querySelector('#app');
const announcer = document.querySelector('#announcer');
const toastHost = document.createElement('div');
toastHost.className = 'toast-host';
toastHost.setAttribute('aria-live', 'polite');
document.body.append(toastHost);

const seedTribute = {
  id: 'seed-jade',
  slug: 'jade',
  name: 'Jade',
  born_on: null,
  remembered_on: null,
  epitaph: 'Você sempre será a estrela que ilumina nossos corações.',
  story: `Minha querida Jade,

Embora você não esteja mais fisicamente conosco, seu amor, sua luz e sua memória permanecem vivos em meu coração para sempre. Cada momento que tivemos juntos foi um presente precioso que guardo no mais profundo do meu ser.

Lembro-me de cada risada, cada abraço, cada sorriso que você compartilhou comigo. Sua presença encheu minha vida de alegria, e mesmo na saudade, encontro consolo sabendo que o amor que sentimos um pelo outro é eterno.

Sua memória vive em mim. Assim como as estrelas que brilham no céu, você continua brilhando na minha vida. Quando olho para as estrelas, sinto você perto de mim. Quando penso em você, meu coração se enche de amor e gratidão por ter tido você como minha filha.

Você me ensinou sobre o amor incondicional, sobre a alegria nas pequenas coisas e sobre a beleza que existe em cada momento. Essas lições ficarão comigo para sempre, assim como sua memória.

Minha eterna gratidão. Jade, sou eternamente grato por cada segundo que tivemos juntos. Você foi e sempre será o maior presente que recebi. Seu espírito, sua pureza e seu amor transformaram minha vida de uma forma que palavras não conseguem expressar.

Embora o tempo que tivemos juntos tenha sido curto demais, o amor que sinto por você é infinito e sem fim. Nenhuma distância ou separação pode apagar o que você significa para mim.

Você me deu um dos maiores presentes da vida: ser seu pai. E essa honra, esse amor, essa conexão especial que temos, permanecerá para sempre.

Assim como as estrelas no céu, você continuará brilhando nos nossos corações para sempre.

Até nos encontrarmos novamente. Minha filha querida, sei que um dia estaremos juntos novamente. Até lá, você viverá em cada lembrança, em cada memória doce, em cada momento que relembro os dias que tivemos.

Que você esteja em paz, cercada de amor e luz. Que seu espírito continue brilhando e iluminando todos que tiveram a sorte de te conhecer.

Te amo hoje, amanhã e para sempre.

Com amor eterno,
Seu papai ❤️`,
  visibility: 'public',
  layout: 'room',
  theme: 'dawn',
  photo_url: null,
  flower_count: 0,
  is_owner: false,
  is_seed: true,
};

let currentUser = null;
let currentWorld = null;
let currentSocket = null;
let currentSocketId = null;
let currentRoomPlayers = [];
let renderVersion = 0;
let toastTimer = 0;
const PASSWORD_ITERATIONS = 600_000;
const OBJECT_LABELS = { flower: 'flor', candle: 'vela', book: 'livro', lantern: 'lanterna', bench: 'banco' };
const OBJECT_ICONS = { flower: '✿', candle: '♨', book: '▤', lantern: '⌑', bench: '⌂' };

const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePasswordVerifier(password, saltText) {
  const salt = base64ToBytes(saltText);
  if (salt.length !== 16) throw new Error('O acesso expirou. Atualize a página e tente novamente.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const verifier = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(verifier));
}

function announce(message) {
  if (announcer) announcer.textContent = message;
}

function toast(message, kind = 'info') {
  toastHost.innerHTML = `<div class="toast toast--${kind}" role="status">${escapeHTML(message)}</div>`;
  announce(message);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastHost.innerHTML = ''; }, 3800);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  let body = options.body;
  if (body && typeof body !== 'string' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  const response = await fetch(path, {
    ...options,
    body,
    headers,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await response.json(); } catch { /* non-JSON response */ }
  if (!response.ok) {
    const failure = new Error(data.error || 'Não foi possível concluir esta ação.');
    failure.status = response.status;
    throw failure;
  }
  return data;
}

async function loadSession() {
  try {
    const result = await api('/api/auth/session');
    currentUser = result.user || null;
  } catch {
    currentUser = null;
  }
  return currentUser;
}

async function getTributes() {
  try {
    const result = await api('/api/tributes');
    return result.tributes || [];
  } catch {
    return [seedTribute];
  }
}

async function getMyTributes() {
  const result = await api('/api/me/tributes');
  return result.tributes || [];
}

async function getTribute(slug) {
  try {
    const result = await api(`/api/tributes/${encodeURIComponent(slug)}`);
    if (!result.tribute) {
      if (slug.toLowerCase() === 'jade') return { tribute: seedTribute, objects: [] };
      throw new Error('Homenagem não encontrada.');
    }
    const tribute = result.tribute.is_seed && result.tribute.slug === 'jade'
      ? { ...result.tribute, story: seedTribute.story }
      : result.tribute;
    return { tribute, objects: result.objects || [] };
  } catch (failure) {
    if (slug.toLowerCase() === 'jade' && failure.status === undefined) {
      return { tribute: seedTribute, objects: [] };
    }
    throw failure;
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date);
}

function datesLine(tribute) {
  const born = formatDate(tribute.born_on);
  const remembered = formatDate(tribute.remembered_on);
  if (!born && !remembered) return '';
  return [born, remembered].filter(Boolean).join('  —  ');
}

function textParagraphs(value) {
  return String(value || '')
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHTML(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function link(path, label, className = '') {
  return `<a data-nav href="${escapeHTML(path)}" class="${className}">${label}</a>`;
}

function header(active = '') {
  const account = currentUser
    ? `${link('/minhas-homenagens', 'Minhas homenagens', 'nav-link')}${link('/criar', 'Criar homenagem', 'button button--small button--nav')}`
    : `${link('/entrar?return=%2Fcriar', 'Entrar', 'nav-link')}${link('/entrar?modo=cadastro&return=%2Fcriar', 'Criar homenagem', 'button button--small button--nav')}`;
  return `
    <header class="site-header">
      <div class="header-inner">
        ${link('/', '<img class="brand-mark" src="/favicon.svg" alt="" aria-hidden="true"><span class="brand-copy"><strong>JADE</strong><small>memórias que florescem</small></span>', 'brand')}
        <nav class="main-nav" aria-label="Navegação principal">
          ${link('/h/jade', 'Homenagem à Jade', 'nav-link')}
          ${link('/jardim', 'Explorar o jardim', `nav-link ${active === 'garden' ? 'is-active' : ''}`)}
          ${account}
        </nav>
        <button class="mobile-menu-button" type="button" aria-label="Abrir menu" aria-expanded="false">☰</button>
      </div>
    </header>`;
}

function footer() {
  return `
    <footer class="site-footer">
      <div class="footer-brand"><img class="brand-mark" src="/favicon.svg" alt="" aria-hidden="true"><strong>JADE</strong><span>Um lugar para lembrar com carinho.</span></div>
      <div class="footer-meta"><p>Feito para que as lembranças encontrem um lugar.</p>${link('/privacidade', 'Privacidade', 'footer-link')}</div>
    </footer>`;
}

function card(tribute, featured = false) {
  const name = escapeHTML(tribute.name);
  const quote = escapeHTML(tribute.epitaph || 'Uma vida lembrada com amor.');
  const date = datesLine(tribute);
  const symbol = tribute.photo_url
    ? `<img src="${escapeHTML(tribute.photo_url)}" alt="Fotografia em homenagem a ${name}" loading="lazy">`
    : `<span class="portrait-symbol" aria-hidden="true">${tribute.layout === 'room' ? '✿' : '✧'}</span>`;
  const type = tribute.layout === 'room' ? 'Sala para visitar' : 'Homenagem';
  return `
    <a data-nav class="tribute-card ${featured ? 'tribute-card--featured' : ''}" href="/h/${encodeURIComponent(tribute.slug)}">
      <div class="tribute-card-art ${tribute.layout === 'room' ? 'tribute-card-art--room' : ''}">
        <div class="card-orbit card-orbit--one"></div><div class="card-orbit card-orbit--two"></div>
        <div class="card-portrait">${symbol}</div>
        <span class="card-art-label">${escapeHTML(type)}</span>
      </div>
      <div class="tribute-card-copy">
        <div class="tribute-card-meta"><span>${tribute.layout === 'room' ? '✿' : '✧'} &nbsp;${escapeHTML(type)}</span>${date ? `<time>${escapeHTML(date)}</time>` : ''}</div>
        <h3>${name}</h3>
        <p>${quote}</p>
        <span class="card-open">Visitar homenagem <span aria-hidden="true">↗</span></span>
      </div>
    </a>`;
}

async function renderHome(version) {
  const tributes = await getTributes();
  if (version !== renderVersion) return;
  const featured = tributes.find((tribute) => tribute.slug === 'jade') || seedTribute;
  app.innerHTML = `${header()}
    <main>
      <section class="hero-section">
        <div class="hero-copy">
          <p class="eyebrow"><span class="eyebrow-dot"></span> UM JARDIM FEITO DE MEMÓRIAS</p>
          <h1>A saudade também merece <em>um lugar.</em></h1>
          <p class="hero-lede">Um cantinho tranquilo para celebrar quem continua presente — em uma história, em uma fotografia, em uma flor.</p>
          <div class="hero-actions">
            ${link('/jardim', 'Conhecer o jardim', 'button button--primary')}
            ${link('/entrar?modo=cadastro&return=%2Fcriar', 'Criar homenagem', 'button button--ghost')}
          </div>
          <div class="hero-note"><span class="hero-note-icon">✦</span><span>Uma sala para visitar. Uma história para guardar. Flores para deixar.</span></div>
        </div>
        <div class="hero-scene-wrap">
          <div class="hero-scene-frame">
            <div class="hero-scene-topline"><span><i></i> UM LUGAR DE LUZ</span><span>01 / jardim</span></div>
            <div class="hero-world" id="hero-world"></div>
            <div class="hero-world-caption"><span class="hero-world-flower">✿</span><span>Memórias que florescem</span><span class="caption-line"></span></div>
          </div>
          <div class="floating-note floating-note--one"><span>✧</span><span>visite no seu tempo</span></div>
          <div class="floating-note floating-note--two"><span>♡</span><span>deixe uma flor</span></div>
        </div>
        <div class="hero-bottom"><span>UM ESPAÇO PARA QUEM FICA NA GENTE</span><span class="hero-scroll">ROLE PARA CONHECER <b>↓</b></span></div>
      </section>

      <section class="intro-section content-width">
        <div class="section-kicker">MAIS DO QUE UMA PÁGINA</div>
        <div class="intro-grid">
          <h2>Há lembranças que merecem ser <em>visitadas.</em></h2>
          <div class="intro-copy"><p>Jade transforma a saudade em um lugar de encontro. Cada pessoa pode criar uma homenagem simples ou montar uma sala para passear, enfeitar e compartilhar com quem também sente falta.</p>${link('/jardim', 'Entenda como funciona <span aria-hidden="true">→</span>', 'text-link')}</div>
        </div>
        <div class="feature-strip">
          <article class="feature-item"><span class="feature-icon feature-icon--room">⌂</span><div><h3>Salas para visitar</h3><p>Um pequeno mundo em 3D, criado para caminhar sem pressa.</p></div></article>
          <article class="feature-item"><span class="feature-icon feature-icon--flower">✿</span><div><h3>Flores e lembranças</h3><p>Deixe uma flor. Quem criou a sala pode acrescentar objetos especiais.</p></div></article>
          <article class="feature-item"><span class="feature-icon feature-icon--privacy">♡</span><div><h3>Do seu jeito</h3><p>Escolha uma homenagem pública ou compartilhe apenas o link.</p></div></article>
        </div>
      </section>

      <section class="jade-tribute-section" id="jade">
        <div class="jade-tribute-inner content-width">
          <div class="jade-tribute-heading"><p class="section-kicker">A LEMBRANÇA QUE DEU ORIGEM A ESTE JARDIM</p><h2>Este lugar nasceu do amor por <em>Jade.</em></h2></div>
          <div class="jade-tribute-grid">
            <div class="jade-tribute-copy">
              <p>Este site foi criado como uma homenagem à Jade: um lugar para guardar sua história, visitar lembranças e transformar a saudade em carinho compartilhado.</p>
              <p>Ela amava o coelho do Petz. Por isso, um coelhinho acompanha este jardim — um pequeno símbolo de algo que a fazia feliz e do amor que continua aqui.</p>
              <blockquote class="jade-tribute-quote">“${escapeHTML(featured.epitaph || seedTribute.epitaph)}”</blockquote>
              <div class="jade-tribute-actions">${link('/h/jade', 'Visitar a homenagem <span aria-hidden="true">→</span>', 'button button--primary')}${link('/jardim', 'Conhecer outras histórias', 'text-link')}</div>
            </div>
            <aside class="jade-flower-card" aria-label="Deixe uma flor para Jade">
              ${renderBloomIllustration()}
              <p class="jade-flower-kicker">UMA FLOR PARA JADE</p>
              <h3>Um gesto de carinho.</h3>
              <p>Cada flor é uma forma simples de dizer: eu lembro.</p>
              <button class="button button--primary flower-button" data-action="leave-flower" type="button"><span aria-hidden="true">✿</span> Deixar uma flor</button>
              ${renderFlowers(featured)}
            </aside>
          </div>
        </div>
      </section>

      <section class="how-section content-width">
        <div class="how-heading"><p class="section-kicker">SIMPLES ASSIM</p><h2>Um lugar. <em>Do seu jeito.</em></h2><p>Sem pressa, sem modelos prontos para preencher a saudade.</p></div>
        <div class="steps-grid"><article><span class="step-number">01</span><span class="step-icon">✎</span><h3>Conte um pouco</h3><p>Escolha um nome, uma frase e o formato que fizer sentido para sua família.</p></article><article><span class="step-number">02</span><span class="step-icon">⌂</span><h3>Crie um lugar</h3><p>Monte uma sala 3D com flores e objetos ou faça uma homenagem mais simples.</p></article><article><span class="step-number">03</span><span class="step-icon">↗</span><h3>Compartilhe</h3><p>Convide outras pessoas para visitar, lembrar e deixar uma flor.</p></article></div>
      </section>

      <section class="closing-section"><div class="closing-inner"><span class="closing-flower" aria-hidden="true">✿</span><p class="section-kicker">QUANDO QUISER</p><h2>As lembranças encontram <em>um caminho.</em></h2><p>Crie um espaço para que o amor continue tendo onde pousar.</p>${link('/entrar?modo=cadastro&return=%2Fcriar', 'Criar uma homenagem', 'button button--light')}</div></section>
  </main>${footer()}`;
  if (version !== renderVersion) return;
  const sceneContainer = document.querySelector('#hero-world');
  const { mountWorld } = await import('./world.js');
  if (version !== renderVersion) return;
  currentWorld = mountWorld(sceneContainer, { title: 'Jade', interactive: false, showAvatar: false });
  document.querySelectorAll('[data-action="leave-flower"]').forEach((button) => button.addEventListener('click', () => leaveFlower('jade', button)));
  bindMobileMenu();
}

function renderTributeGrid(tributes, search = '') {
  const query = search.trim().toLocaleLowerCase('pt-BR');
  const filtered = tributes.filter((tribute) => `${tribute.name} ${tribute.epitaph}`.toLocaleLowerCase('pt-BR').includes(query));
  if (!filtered.length) return `<div class="empty-state"><span>✿</span><h3>Nenhuma homenagem por aqui ainda</h3><p>Experimente outro nome ou crie um espaço para começar o jardim.</p>${link('/entrar?modo=cadastro&return=%2Fcriar', 'Criar homenagem', 'button button--primary')}</div>`;
  return `<div class="tribute-grid">${filtered.map((tribute) => card(tribute)).join('')}</div>`;
}

async function renderExplore(version) {
  const tributes = await getTributes();
  if (version !== renderVersion) return;
  app.innerHTML = `${header('garden')}<main class="page-main">
    <section class="page-heading"><div><p class="section-kicker">UM JARDIM ABERTO</p><h1>Homenagens para <em>visitar.</em></h1><p>Entre em uma sala, leia uma história ou deixe uma flor para alguém.</p></div><div class="page-heading-stamp"><span>✿</span><small>floresça<br>no seu tempo</small></div></section>
    <section class="garden-controls"><label class="search-box"><span aria-hidden="true">⌕</span><input id="tribute-search" type="search" placeholder="Buscar pelo nome" aria-label="Buscar homenagem pelo nome"></label><span class="results-count"><b>${tributes.length}</b> ${tributes.length === 1 ? 'homenagem aberta' : 'homenagens abertas'}</span></section>
    <section id="tribute-results" aria-live="polite">${renderTributeGrid(tributes)}</section>
    <section class="garden-invite"><span class="garden-invite-icon">✿</span><div><p class="section-kicker">NÃO ENCONTROU QUEM PROCURA?</p><h2>Você pode criar um lugar para lembrar.</h2><p>Uma homenagem simples ou uma sala inteira, feita com carinho.</p></div>${link('/entrar?modo=cadastro&return=%2Fcriar', 'Criar homenagem', 'button button--primary')}</section>
  </main>${footer()}`;
  const search = document.querySelector('#tribute-search');
  const results = document.querySelector('#tribute-results');
  search?.addEventListener('input', () => { results.innerHTML = renderTributeGrid(tributes, search.value); });
  bindMobileMenu();
}

function authRedirect() {
  const value = new URLSearchParams(location.search).get('return') || '/minhas-homenagens';
  return value.startsWith('/') && !value.startsWith('//') ? value : '/minhas-homenagens';
}

function renderAuth(mode = 'login', returnTo = authRedirect()) {
  const register = mode === 'register';
  app.innerHTML = `${header()}<main class="auth-page"><div class="auth-visual"><div class="auth-orbit auth-orbit--one"></div><div class="auth-orbit auth-orbit--two"></div><span class="auth-flower">✿</span><p class="section-kicker">UM LUGAR PARA LEMBRAR</p><h1>O seu jardim começa com uma <em>lembrança.</em></h1><p>Entre para criar e cuidar das homenagens que você compartilha com quem ama.</p><span class="auth-quote">“O amor encontra caminhos para continuar.”</span></div><section class="auth-panel"><div class="auth-card"><p class="section-kicker">${register ? 'CRIE SEU ACESSO' : 'BEM-VINDA(O) DE VOLTA'}</p><h2>${register ? 'Vamos começar.' : 'Entre no seu jardim.'}</h2><p class="auth-intro">${register ? 'Sua conta permite criar e editar homenagens. Visitar o jardim continua aberto para todo mundo.' : 'Use seu e-mail e senha para cuidar das homenagens que criou.'}</p><form id="auth-form" data-mode="${register ? 'register' : 'login'}" data-return="${escapeHTML(returnTo)}" novalidate><label class="field-label" for="auth-email">E-mail</label><input class="form-input" id="auth-email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="voce@exemplo.com"><label class="field-label" for="auth-password">Senha</label><input class="form-input" id="auth-password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required minlength="12" maxlength="128" placeholder="${register ? 'Pelo menos 12 caracteres' : 'Sua senha'}">${register ? '<p class="field-hint">Use 12 caracteres ou mais. Depois de criar o acesso, entre com essa senha. Ainda não há confirmação ou recuperação por e-mail.</p>' : ''}<button class="button button--primary auth-submit" type="submit">${register ? 'Criar minha conta' : 'Entrar'} <span aria-hidden="true">→</span></button><p class="auth-error" id="auth-error" role="alert"></p></form><div class="auth-switch">${register ? `Já tem uma conta? ${link(`/entrar?return=${encodeURIComponent(returnTo)}`, 'Entrar')}` : `Ainda não tem uma conta? ${link(`/entrar?modo=cadastro&return=${encodeURIComponent(returnTo)}`, 'Criar acesso')}`}</div><p class="auth-footnote">Ao continuar, você pode explorar as homenagens sem entrar. O acesso só é necessário para criar ou editar.</p></div></section></main>${footer()}`;
  bindMobileMenu();
  document.querySelector('#auth-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const errorNode = document.querySelector('#auth-error');
    const button = form.querySelector('button[type="submit"]');
    errorNode.textContent = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || password.length < 12 || password.length > 128) {
      errorNode.textContent = 'Confira o e-mail e use uma senha entre 12 e 128 caracteres.';
      return;
    }
    button.disabled = true;
    button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> Aguarde…';
    try {
      const registerMode = form.dataset.mode === 'register';
      const salt = registerMode
        ? bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))
        : (await api(`/api/auth/salt?email=${encodeURIComponent(email)}`)).salt;
      const verifier = await derivePasswordVerifier(password, salt);
      const payload = registerMode ? { email, salt, verifier } : { email, verifier };
      const data = await api(`/api/auth/${form.dataset.mode}`, { method: 'POST', body: payload });
      if (registerMode) {
        toast('Se este endereço era novo, o acesso está pronto. Entre agora com a senha escolhida.', 'success');
        navigate(`/entrar?return=${encodeURIComponent(form.dataset.return || returnTo)}`);
        return;
      }
      currentUser = data.user;
      toast('Que bom ter você de volta.', 'success');
      navigate(form.dataset.return || returnTo);
    } catch (failure) {
      errorNode.textContent = failure.message;
      button.disabled = false;
      button.innerHTML = `${register ? 'Criar minha conta' : 'Entrar'} <span aria-hidden="true">→</span>`;
    }
  });
}

function renderPhoto(tribute, className = '') {
  return tribute.photo_url
    ? `<img class="${className}" src="${escapeHTML(tribute.photo_url)}" alt="Fotografia em homenagem a ${escapeHTML(tribute.name)}">`
    : `<div class="memory-portrait ${className}" aria-hidden="true"><span>✿</span><i></i></div>`;
}

function renderFlowers(tribute) {
  return `<div class="flower-count"><span aria-hidden="true">✿</span><strong data-flower-count>${Number(tribute.flower_count || 0)}</strong><small>${Number(tribute.flower_count || 0) === 1 ? 'flor deixada' : 'flores deixadas'}</small></div>`;
}

function renderBloomIllustration() {
  return `<div class="bloom-art" aria-hidden="true"><div class="bloom-stem"><i class="bloom-leaf bloom-leaf--left"></i><i class="bloom-leaf bloom-leaf--right"></i></div><div class="bloom-head"><i class="bloom-petal"></i><i class="bloom-petal"></i><i class="bloom-petal"></i><i class="bloom-petal"></i><i class="bloom-petal"></i><i class="bloom-petal"></i><i class="bloom-petal"></i><i class="bloom-petal"></i><span class="bloom-center"></span></div><span class="bloom-spark bloom-spark--one">✦</span><span class="bloom-spark bloom-spark--two">✧</span><span class="bloom-ground"></span></div>`;
}

function renderJadeLetterSection(tribute) {
  return `<section class="jade-letter-section" id="homenagem">
    <div class="jade-letter-origin"><p class="section-kicker">POR QUE ESTE SITE EXISTE</p><h2>Um jardim feito para a memória de Jade.</h2><p>Este espaço nasceu para que o amor por Jade tivesse onde pousar: uma homenagem que pode ser visitada, uma história que pode ser lida e flores que podem ser deixadas. Ela amava o coelho do Petz; o coelhinho deste jardim é uma lembrança carinhosa desse amor.</p></div>
    <div class="jade-letter-grid">
      <article class="jade-letter-copy"><p class="section-kicker">EM MEMÓRIA ETERNA</p><h3>Uma carta para Jade</h3><div class="jade-letter-story">${textParagraphs(tribute.story)}</div></article>
      <aside class="jade-letter-flower-card"><span class="letter-flower-mark" aria-hidden="true">✿</span><p class="section-kicker">QUANDO QUISER</p><h3>Deixe uma flor.</h3><p>Uma lembrança pequena também pode carregar muito amor.</p>${renderBloomIllustration()}<button class="button button--primary flower-button" data-action="leave-flower" type="button"><span aria-hidden="true">✿</span> Deixar uma flor para Jade</button>${renderFlowers(tribute)}</aside>
    </div>
  </section>`;
}

function renderEditDialog(tribute) {
  return `<dialog class="edit-dialog" id="tribute-edit-dialog"><form id="tribute-edit-form" method="dialog"><div class="dialog-heading"><div><p class="section-kicker">CUIDAR DA HOMENAGEM</p><h2>Editar lembrança</h2></div><button type="button" class="icon-button" data-action="close-dialog" aria-label="Fechar">×</button></div><label class="field-label" for="edit-name">Nome</label><input class="form-input" id="edit-name" name="name" required maxlength="80" value="${escapeHTML(tribute.name)}"><label class="field-label" for="edit-epitaph">Uma frase que represente essa pessoa</label><input class="form-input" id="edit-epitaph" name="epitaph" maxlength="180" value="${escapeHTML(tribute.epitaph || '')}"><label class="field-label" for="edit-story">História ou lembrança</label><textarea class="form-input form-textarea" id="edit-story" name="story" maxlength="4000">${escapeHTML(tribute.story || '')}</textarea><label class="field-label" for="edit-photo">Fotografia <small>${tribute.photo_url ? 'escolha um arquivo para trocar' : 'opcional'}</small></label><input class="form-input" id="edit-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"><label class="field-label" for="edit-visibility">Visibilidade</label><select class="form-input" id="edit-visibility" name="visibility"><option value="public" ${tribute.visibility === 'public' ? 'selected' : ''}>Pública — aparece no jardim</option><option value="unlisted" ${tribute.visibility === 'unlisted' ? 'selected' : ''}>Não listada — acessível pelo link</option></select><p class="auth-error" id="edit-error" role="alert"></p><div class="dialog-actions dialog-actions--split"><button type="button" class="button button--danger" data-action="delete-tribute">Excluir homenagem</button><span></span><button type="button" class="button button--ghost" data-action="close-dialog">Cancelar</button><button type="submit" class="button button--primary">Salvar alterações</button></div></form></dialog>`;
}

async function renderRoomPage(tribute, objects, version) {
  const dates = datesLine(tribute);
  const isJadeTribute = tribute.slug === 'jade';
  const ownership = tribute.is_owner;
  const initialEdit = ownership && new URLSearchParams(location.search).get('editar') === '1';
  const { mountWorld } = await import('./world.js');
  if (version !== renderVersion) return;
  app.innerHTML = `${header()}<main class="tribute-page tribute-page--room">
    <div class="tribute-breadcrumb">${link('/jardim', 'Jardim') }<span>/</span><span>${escapeHTML(tribute.name)}</span></div>
    <section class="room-layout">
      <div class="room-column">
        <div class="room-heading"><div><p class="section-kicker">UMA SALA PARA VISITAR</p><h1>${escapeHTML(tribute.name)}</h1>${dates ? `<p class="room-dates">${escapeHTML(dates)}</p>` : ''}</div><div class="room-heading-actions"><button class="icon-button share-button" data-action="share" type="button" aria-label="Compartilhar homenagem" title="Compartilhar">↗</button>${ownership ? '<button class="button button--soft button--small" data-action="edit-tribute" type="button">Editar homenagem</button>' : ''}</div></div>
        <div class="room-frame">
          <div class="room-world" id="tribute-world"></div>
          <div class="room-overlay room-overlay--top"><span><i></i> JARDIM DE MEMÓRIAS</span><span class="room-open-indicator">●&nbsp; aberto para visita</span></div>
          <div class="room-overlay room-overlay--bottom"><span class="walk-instruction"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ou toque no chão para passear</span><span class="room-coordinate">SALA 01&nbsp; · &nbsp;${escapeHTML(tribute.theme || 'dawn').toUpperCase()}</span></div>
        </div>
        <div class="room-controls-bar"><div class="room-control-hint"><span class="hint-dot"></span><span>${ownership ? 'A sala é sua. Cuide dela e toque no coelhinho para cumprimentá-lo.' : 'Caminhe sem pressa e toque no coelhinho para vê-lo saltar.'}</span></div><div class="room-toolbar-actions">${ownership ? '<button class="button button--soft button--small" data-action="toggle-editor" type="button"><span aria-hidden="true">✦</span> Editar sala</button>' : ''}<button class="button button--soft button--small" data-action="leave-flower" type="button"><span aria-hidden="true">✿</span> Deixar uma flor</button></div></div>
        ${ownership ? `<div class="room-editor" id="room-editor" ${initialEdit ? '' : 'hidden'}><div class="editor-copy"><span class="editor-sparkle">✦</span><div><strong>Coloque algo especial na sala</strong><small>Escolha um objeto e toque no lugar onde quer deixá-lo. Toque em um objeto colocado para removê-lo.</small></div></div><div class="object-picker" role="group" aria-label="Objetos para colocar na sala">${Object.entries(OBJECT_LABELS).map(([kind, label]) => `<button type="button" class="object-option ${kind === 'flower' ? 'is-selected' : ''}" data-kind="${kind}" aria-pressed="${kind === 'flower'}"><span>${OBJECT_ICONS[kind]}</span><small>${label}</small></button>`).join('')}</div><button class="icon-button editor-close" data-action="close-editor" type="button" aria-label="Concluir edição">✓</button></div>` : ''}
        <section class="room-chat-panel" aria-label="Conversa ao vivo da sala">
          <header class="room-chat-header"><div><p class="section-kicker">CONVERSA AO VIVO</p><h2>Um espaço de gentileza</h2></div><div class="chat-online"><i></i><span id="chat-online-count">Conectando…</span></div></header>
          <div class="room-presence" id="room-presence" aria-label="Pessoas nesta sala"></div>
          <div class="chat-messages" id="chat-messages" role="log" aria-live="polite" aria-relevant="additions"><p class="chat-system-note">As mensagens são ao vivo e não ficam guardadas. O criador pode remover visitantes da sala.</p></div>
          <p class="chat-status" id="room-chat-status">Conectando à conversa…</p>
          <form class="room-chat-form" id="room-chat-form"><label class="sr-only" for="room-chat-input">Sua mensagem</label><input id="room-chat-input" name="message" type="text" maxlength="240" autocomplete="off" placeholder="Escreva uma palavra de carinho…" disabled><button class="button button--primary button--small" type="submit" disabled>Enviar</button></form>
          <button class="text-link chat-reconnect" id="room-chat-reconnect" type="button" hidden>Reconectar à conversa <span aria-hidden="true">↻</span></button>
        </section>
      </div>
      <aside class="memory-sidebar">
        <div class="memory-card-heading"><span class="memory-card-kicker">EM MEMÓRIA DE</span><span class="memory-card-sparkle">✧</span></div>
        ${renderPhoto(tribute, 'memory-portrait')}
        <h2>${escapeHTML(tribute.name)}</h2>
        ${dates ? `<p class="memory-dates">${escapeHTML(dates)}</p>` : ''}
        <blockquote>${escapeHTML(tribute.epitaph || 'Uma vida lembrada com amor.')}</blockquote>
        ${tribute.story ? `<div class="memory-story">${textParagraphs(isJadeTribute ? tribute.story.split(/\n\s*\n/).slice(0, 2).join('\n\n') : tribute.story)}</div>` : ''}
        <div class="memory-divider"><span>✦</span><i></i><span>✦</span></div>
        <div class="memory-actions"><button class="button button--primary flower-button" data-action="leave-flower" type="button"><span aria-hidden="true">✿</span> Deixar uma flor</button><button class="button button--outline share-button" data-action="share" type="button">Compartilhar homenagem <span aria-hidden="true">↗</span></button></div>
        ${renderFlowers(tribute)}
        ${ownership ? '<button class="text-link edit-memory-link" data-action="edit-tribute" type="button">Editar texto e visibilidade <span aria-hidden="true">→</span></button>' : ''}
      </aside>
    </section>
    ${isJadeTribute ? renderJadeLetterSection(tribute) : ''}
    ${renderEditDialog(tribute)}
  </main>${footer()}`;

  const worldContainer = document.querySelector('#tribute-world');
  let currentObjects = [...objects];
  let selectedKind = 'flower';
  let editMode = initialEdit;
  currentWorld = mountWorld(worldContainer, {
    title: tribute.name,
    objects: currentObjects,
    visitorName: currentUser ? 'você' : 'visitante',
    interactive: true,
    showAvatar: true,
    canEdit: ownership,
    onPlayerMove: (position) => {
      if (currentSocket?.readyState === WebSocket.OPEN) {
        currentSocket.send(JSON.stringify({ type: 'move', x: position.x, z: position.z }));
      }
    },
    onPlace: async (item) => {
      try {
        const result = await api(`/api/tributes/${encodeURIComponent(tribute.slug)}/objects`, { method: 'POST', body: item });
        currentObjects = [...currentObjects, result.object];
        currentWorld?.setObjects(currentObjects);
        toast(`${OBJECT_LABELS[item.kind]} deixada com carinho.`, 'success');
      } catch (failure) {
        toast(failure.message, 'error');
      }
    },
    onRemove: async (id) => {
      try {
        await api(`/api/tributes/${encodeURIComponent(tribute.slug)}/objects/${encodeURIComponent(id)}`, { method: 'DELETE' });
        currentObjects = currentObjects.filter((object) => object.id !== id);
        currentWorld?.setObjects(currentObjects);
        toast('Objeto removido da sala.', 'success');
      } catch (failure) {
        toast(failure.message, 'error');
      }
    },
  });
  currentWorld?.setEditMode(editMode, selectedKind);
  bindMobileMenu();
  connectRoomChat(tribute, ownership);

  const editor = document.querySelector('#room-editor');
  const toggleEditor = (open) => {
    editMode = open;
    if (editor) editor.hidden = !open;
    currentWorld?.setEditMode(open, selectedKind);
    document.querySelector('[data-action="toggle-editor"]')?.classList.toggle('is-active', open);
    if (open) toast('Escolha um objeto e toque no piso para colocá-lo.', 'info');
  };
  document.querySelectorAll('[data-action="toggle-editor"]').forEach((button) => button.addEventListener('click', () => toggleEditor(!editMode)));
  document.querySelector('[data-action="close-editor"]')?.addEventListener('click', () => toggleEditor(false));
  document.querySelectorAll('.object-option').forEach((button) => button.addEventListener('click', () => {
    selectedKind = button.dataset.kind;
    document.querySelectorAll('.object-option').forEach((option) => {
      option.classList.toggle('is-selected', option === button);
      option.setAttribute('aria-pressed', option === button ? 'true' : 'false');
    });
    currentWorld?.setSelectedKind(selectedKind);
  }));
  document.querySelectorAll('[data-action="leave-flower"]').forEach((button) => button.addEventListener('click', () => leaveFlower(tribute.slug, button)));
  document.querySelectorAll('[data-action="share"]').forEach((button) => button.addEventListener('click', shareCurrentPage));

  const dialog = document.querySelector('#tribute-edit-dialog');
  document.querySelectorAll('[data-action="edit-tribute"]').forEach((button) => button.addEventListener('click', () => dialog?.showModal()));
  document.querySelector('[data-action="delete-tribute"]')?.addEventListener('click', () => deleteTribute(tribute, dialog));
  document.querySelectorAll('[data-action="close-dialog"]').forEach((button) => button.addEventListener('click', () => dialog?.close()));
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.querySelector('#tribute-edit-form')?.addEventListener('submit', (event) => saveTributeEdit(event, tribute, dialog));
}

function appendRoomSystemMessage(text) {
  const messages = document.querySelector('#chat-messages');
  if (!messages) return;
  const note = document.createElement('p');
  note.className = 'chat-system-message';
  note.textContent = text;
  messages.append(note);
  messages.scrollTop = messages.scrollHeight;
  while (messages.querySelectorAll('.chat-message, .chat-system-message').length > 60) {
    messages.querySelector('.chat-message, .chat-system-message')?.remove();
  }
}

function appendRoomChatMessage(message) {
  const messages = document.querySelector('#chat-messages');
  if (!messages) return;
  const item = document.createElement('article');
  item.className = `chat-message ${message.isOwner ? 'chat-message--owner' : ''}`;
  const headerNode = document.createElement('div');
  headerNode.className = 'chat-message-header';
  const name = document.createElement('strong');
  name.textContent = String(message.name || 'Visitante').slice(0, 24);
  const time = document.createElement('time');
  time.dateTime = new Date(Number(message.sentAt) || Date.now()).toISOString();
  time.textContent = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(Number(message.sentAt) || Date.now()));
  headerNode.append(name, time);
  if (message.isOwner) {
    const hostLabel = document.createElement('small');
    hostLabel.textContent = 'criador';
    headerNode.append(hostLabel);
  }
  const text = document.createElement('p');
  text.className = 'chat-message-text';
  text.textContent = String(message.text || '').slice(0, 240);
  item.append(headerNode, text);
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
  while (messages.querySelectorAll('.chat-message, .chat-system-message').length > 60) {
    messages.querySelector('.chat-message, .chat-system-message')?.remove();
  }
}

function renderRoomPresence(players, isOwner) {
  const host = document.querySelector('#room-presence');
  const count = document.querySelector('#chat-online-count');
  if (!host || !count) return;
  count.textContent = `${players.length} ${players.length === 1 ? 'pessoa aqui' : 'pessoas aqui'}`;
  host.replaceChildren();
  for (const player of players) {
    const chip = document.createElement('div');
    chip.className = `presence-chip ${player.isOwner ? 'presence-chip--host' : ''}`;
    const mark = document.createElement('span');
    mark.className = 'presence-mark';
    mark.textContent = player.isOwner ? '✦' : '·';
    const label = document.createElement('span');
    label.className = 'presence-name';
    label.textContent = player.id === currentSocketId ? 'Você' : String(player.name || 'Visitante').slice(0, 24);
    chip.append(mark, label);
    if (isOwner && player.id !== currentSocketId && !player.isOwner) {
      const remove = document.createElement('button');
      remove.className = 'presence-remove';
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remover ${String(player.name || 'visitante')} desta sala`);
      remove.title = 'Remover da sala';
      remove.addEventListener('click', () => {
        if (currentSocket?.readyState === WebSocket.OPEN) {
          currentSocket.send(JSON.stringify({ type: 'kick', playerId: player.id }));
        }
      });
      chip.append(remove);
    }
    host.append(chip);
  }
}

function connectRoomChat(tribute, ownership) {
  const form = document.querySelector('#room-chat-form');
  const input = document.querySelector('#room-chat-input');
  const submit = form?.querySelector('button[type="submit"]');
  const status = document.querySelector('#room-chat-status');
  const reconnect = document.querySelector('#room-chat-reconnect');
  if (!form || !input || !submit || !status || !reconnect) return;

  let kicked = false;
  const setStatus = (kind, message) => {
    status.className = `chat-status chat-status--${kind}`;
    status.textContent = message;
  };
  const setConnected = (connected) => {
    input.disabled = !connected;
    submit.disabled = !connected;
  };
  const syncPlayers = (players) => {
    currentRoomPlayers = players;
    currentWorld?.setRemotePlayers(players.filter((player) => player.id !== currentSocketId));
    renderRoomPresence(players, ownership);
  };

  const connect = () => {
    if (currentSocket) {
      currentSocket.onclose = null;
      currentSocket.close(1000, 'Reconnect');
      currentSocket = null;
    }
    currentSocketId = null;
    currentRoomPlayers = [];
    syncPlayers([]);
    kicked = false;
    reconnect.hidden = true;
    setConnected(false);
    setStatus('connecting', 'Conectando à conversa…');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/api/rooms/${encodeURIComponent(tribute.slug)}`);
    currentSocket = socket;

    socket.addEventListener('open', () => {
      if (currentSocket !== socket) return;
      setConnected(true);
      setStatus('online', 'Conversa ao vivo · mensagens não são guardadas');
      const position = currentWorld?.getPlayerPosition?.() || { x: 0, z: 3.65 };
      socket.send(JSON.stringify({ type: 'move', x: position.x, z: position.z }));
    });

    socket.addEventListener('message', (event) => {
      if (currentSocket !== socket) return;
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (payload.type === 'welcome') {
        currentSocketId = payload.selfId;
        syncPlayers(payload.players || []);
        const self = (payload.players || []).find((player) => player.id === currentSocketId);
        if (self) {
          currentWorld?.setPlayerName(self.name);
          appendRoomSystemMessage(`Você entrou como ${self.name}.`);
        }
        return;
      }
      if (payload.type === 'presence' && payload.action === 'join' && payload.player) {
        syncPlayers([...currentRoomPlayers.filter((player) => player.id !== payload.player.id), payload.player]);
        if (payload.player.id !== currentSocketId) appendRoomSystemMessage(`${payload.player.name} chegou à sala.`);
        return;
      }
      if (payload.type === 'presence' && payload.action === 'leave') {
        const departed = currentRoomPlayers.find((player) => player.id === payload.playerId);
        syncPlayers(currentRoomPlayers.filter((player) => player.id !== payload.playerId));
        if (departed) appendRoomSystemMessage(`${departed.name} saiu da sala.`);
        currentWorld?.removeRemotePlayer(payload.playerId);
        return;
      }
      if (payload.type === 'move' && payload.player) {
        const moved = payload.player;
        syncPlayers([...currentRoomPlayers.filter((player) => player.id !== moved.id), moved]);
        if (moved.id !== currentSocketId) currentWorld?.updateRemotePlayer(moved);
        return;
      }
      if (payload.type === 'chat' && payload.message) {
        appendRoomChatMessage(payload.message);
        return;
      }
      if (payload.type === 'error') {
        appendRoomSystemMessage(payload.message || 'Não foi possível enviar a mensagem.');
        return;
      }
      if (payload.type === 'kicked') {
        kicked = true;
        appendRoomSystemMessage(payload.message || 'O criador encerrou sua visita a esta sala.');
        setStatus('offline', 'Sua visita foi encerrada pelo criador desta sala.');
      }
    });

    socket.addEventListener('error', () => {
      if (currentSocket === socket) setStatus('offline', 'A conversa está indisponível no momento.');
    });
    socket.addEventListener('close', () => {
      if (currentSocket !== socket) return;
      currentSocket = null;
      currentSocketId = null;
      currentRoomPlayers = [];
      currentWorld?.setRemotePlayers([]);
      renderRoomPresence([], ownership);
      setConnected(false);
      setStatus('offline', kicked ? 'O criador encerrou sua visita.' : 'Conversa desconectada.');
      reconnect.hidden = kicked;
    });
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
      appendRoomSystemMessage('A conversa está desconectada. Reconecte para enviar uma mensagem.');
      return;
    }
    currentSocket.send(JSON.stringify({ type: 'chat', text }));
    input.value = '';
  });
  reconnect.addEventListener('click', connect);
  connect();
}

function renderSimpleTribute(tribute) {
  const dates = datesLine(tribute);
  app.innerHTML = `${header()}<main class="tribute-page tribute-page--simple">
    <div class="tribute-breadcrumb">${link('/jardim', 'Jardim')}<span>/</span><span>${escapeHTML(tribute.name)}</span></div>
    <section class="simple-memorial">
      <div class="simple-art"><div class="simple-orbit simple-orbit--one"></div><div class="simple-orbit simple-orbit--two"></div>${renderPhoto(tribute, 'simple-portrait')}<span class="simple-art-star">✦</span><span class="simple-art-flower">✿</span></div>
      <div class="simple-copy"><div class="simple-topline"><p class="section-kicker">EM MEMÓRIA DE</p><button class="icon-button share-button" data-action="share" type="button" aria-label="Compartilhar homenagem">↗</button></div><h1>${escapeHTML(tribute.name)}</h1>${dates ? `<p class="simple-dates">${escapeHTML(dates)}</p>` : ''}<blockquote>${escapeHTML(tribute.epitaph || 'Uma vida lembrada com amor.')}</blockquote><div class="simple-story">${textParagraphs(tribute.story)}</div><div class="memory-divider"><span>✦</span><i></i><span>✦</span></div><button class="button button--primary flower-button" data-action="leave-flower" type="button"><span aria-hidden="true">✿</span> Deixar uma flor</button>${renderFlowers(tribute)}${tribute.is_owner ? '<button class="text-link edit-memory-link" data-action="edit-tribute" type="button">Editar homenagem <span aria-hidden="true">→</span></button>' : ''}</div>
    </section>
    ${tribute.is_owner ? renderEditDialog(tribute) : ''}
  </main>${footer()}`;
  bindMobileMenu();
  document.querySelectorAll('[data-action="leave-flower"]').forEach((button) => button.addEventListener('click', () => leaveFlower(tribute.slug, button)));
  document.querySelectorAll('[data-action="share"]').forEach((button) => button.addEventListener('click', shareCurrentPage));
  const dialog = document.querySelector('#tribute-edit-dialog');
  document.querySelector('[data-action="edit-tribute"]')?.addEventListener('click', () => dialog?.showModal());
  document.querySelector('[data-action="delete-tribute"]')?.addEventListener('click', () => deleteTribute(tribute, dialog));
  document.querySelectorAll('[data-action="close-dialog"]').forEach((button) => button.addEventListener('click', () => dialog?.close()));
  document.querySelector('#tribute-edit-form')?.addEventListener('submit', (event) => saveTributeEdit(event, tribute, dialog));
}

async function saveTributeEdit(event, tribute, dialog) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorNode = document.querySelector('#edit-error');
  const submit = form.querySelector('button[type="submit"]');
  const entries = new FormData(form);
  const photo = entries.get('photo');
  const body = Object.fromEntries([...entries.entries()].filter(([key]) => key !== 'photo'));
  if (!body.name.trim()) { errorNode.textContent = 'O nome não pode ficar em branco.'; return; }
  if (photo?.size > 5 * 1024 * 1024) { errorNode.textContent = 'A fotografia precisa ter até 5 MB.'; return; }
  submit.disabled = true;
  try {
    await api(`/api/tributes/${encodeURIComponent(tribute.slug)}`, { method: 'PATCH', body });
    let photoFailure = null;
    if (photo && photo.size > 0) {
      const upload = new FormData();
      upload.set('photo', photo);
      try {
        await api(`/api/tributes/${encodeURIComponent(tribute.slug)}/photo`, { method: 'POST', body: upload });
      } catch (failure) {
        photoFailure = failure;
      }
    }
    dialog.close();
    await renderRoute();
    toast(photoFailure ? `Texto salvo. A fotografia não foi enviada: ${photoFailure.message}` : 'Homenagem atualizada.', photoFailure ? 'error' : 'success');
  } catch (failure) {
    errorNode.textContent = failure.message;
    submit.disabled = false;
  }
}

async function deleteTribute(tribute, dialog) {
  const confirmed = window.confirm(`Excluir a homenagem de ${tribute.name}? A fotografia, as flores e os objetos também serão removidos. Esta ação não pode ser desfeita.`);
  if (!confirmed) return;
  try {
    await api(`/api/tributes/${encodeURIComponent(tribute.slug)}`, { method: 'DELETE' });
    dialog?.close();
    navigate('/minhas-homenagens');
    toast('A homenagem foi removida.', 'success');
  } catch (failure) {
    toast(failure.message, 'error');
  }
}

async function leaveFlower(slug, button) {
  button.disabled = true;
  try {
    const result = await api(`/api/tributes/${encodeURIComponent(slug)}/flowers`, { method: 'POST', body: { kind: 'daisy' } });
    document.querySelectorAll('[data-flower-count]').forEach((node) => { node.textContent = result.flower_count; });
    document.querySelectorAll('.flower-count small').forEach((node) => { node.textContent = result.flower_count === 1 ? 'flor deixada' : 'flores deixadas'; });
    document.querySelectorAll('.bloom-art').forEach((art) => {
      art.classList.remove('is-blooming');
      void art.offsetWidth;
      art.classList.add('is-blooming');
    });
    toast('Sua flor chegou. Obrigado por lembrar.', 'success');
  } catch (failure) {
    toast(failure.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function shareCurrentPage() {
  const shareData = { title: document.title, text: 'Uma homenagem no jardim Jade', url: location.href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(location.href);
      toast('Link copiado. Compartilhe com quem quiser.', 'success');
    }
  } catch (failure) {
    if (failure.name !== 'AbortError') toast('Não foi possível compartilhar agora.', 'error');
  }
}

function renderCreate() {
  if (!currentUser) {
    renderAuth('register', '/criar');
    return;
  }
  app.innerHTML = `${header()}<main class="create-page"><div class="create-heading"><p class="section-kicker">UM ESPAÇO FEITO COM CARINHO</p><h1>Comece por uma <em>lembrança.</em></h1><p>Não existe um jeito certo de homenagear. Preencha apenas o que fizer sentido para você.</p></div><form id="create-form" class="create-form" novalidate>
    <section class="form-section"><div class="form-section-number">01</div><div class="form-section-content"><h2>Quem você quer homenagear?</h2><p>Você pode adicionar as datas agora ou deixar para depois.</p><label class="field-label" for="memory-name">Nome <span aria-hidden="true">*</span></label><input class="form-input" id="memory-name" name="name" required maxlength="80" placeholder="Nome de quem você sente saudade"><div class="date-fields"><div><label class="field-label" for="born-on">Nascimento <small>opcional</small></label><input class="form-input" id="born-on" name="born_on" type="date"></div><div><label class="field-label" for="remembered-on">Partida <small>opcional</small></label><input class="form-input" id="remembered-on" name="remembered_on" type="date"></div></div></div></section>
    <section class="form-section"><div class="form-section-number">02</div><div class="form-section-content"><h2>Uma frase que fica</h2><p>Uma palavra, uma memória, ou o que você gostaria que as pessoas soubessem.</p><label class="field-label" for="memory-epitaph">Frase de homenagem <small>opcional</small></label><input class="form-input" id="memory-epitaph" name="epitaph" maxlength="180" placeholder="Ex.: Sempre presente em nossos corações"><label class="field-label" for="memory-story">História ou lembrança <small>opcional</small></label><textarea class="form-input form-textarea" id="memory-story" name="story" maxlength="4000" placeholder="Conte uma história ou escreva algo que você queira guardar…"></textarea></div></section>
    <section class="form-section"><div class="form-section-number">03</div><div class="form-section-content"><h2>Escolha um formato</h2><p>Você sempre pode mudar a homenagem depois.</p><div class="layout-options"><label class="layout-option is-selected"><input type="radio" name="layout" value="room" checked><span class="layout-option-icon">⌂</span><span><strong>Sala para visitar</strong><small>Um ambiente 3D para caminhar, decorar e receber flores.</small></span><i>✓</i></label><label class="layout-option"><input type="radio" name="layout" value="simple"><span class="layout-option-icon layout-option-icon--simple">✧</span><span><strong>Homenagem simples</strong><small>Uma página delicada para guardar a história e compartilhar.</small></span><i>✓</i></label></div></div></section>
    <section class="form-section"><div class="form-section-number">04</div><div class="form-section-content"><h2>Uma fotografia</h2><p>Se quiser, escolha uma imagem que você gostaria de guardar neste espaço.</p><label class="upload-box" for="memory-photo"><span class="upload-icon">↥</span><strong>Escolher fotografia</strong><small>JPEG, PNG ou WebP · até 5 MB</small><input id="memory-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="photo-preview" id="photo-preview" hidden></div></div></section>
    <section class="form-section"><div class="form-section-number">05</div><div class="form-section-content"><h2>Quem pode encontrar?</h2><p>Homenagens públicas aparecem na página de exploração. As não listadas continuam acessíveis pelo link.</p><div class="visibility-options"><label><input type="radio" name="visibility" value="public" checked><span><strong>Pública</strong><small>Qualquer pessoa pode encontrar no jardim.</small></span></label><label><input type="radio" name="visibility" value="unlisted"><span><strong>Não listada</strong><small>Só quem recebe o link pode abrir.</small></span></label></div></div></section>
    <p class="form-error" id="create-error" role="alert"></p><div class="create-submit-row"><p>Você pode editar tudo depois. Visitar o jardim é sempre aberto.</p><button class="button button--primary" type="submit">Criar homenagem <span aria-hidden="true">→</span></button></div>
  </form></main>${footer()}`;
  bindMobileMenu();
  document.querySelectorAll('.layout-option input').forEach((input) => input.addEventListener('change', () => {
    document.querySelectorAll('.layout-option').forEach((option) => option.classList.toggle('is-selected', option.contains(input) && input.checked));
  }));
  const photoInput = document.querySelector('#memory-photo');
  const preview = document.querySelector('#photo-preview');
  let previewUrl = null;
  photoInput?.addEventListener('change', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = photoInput.files?.[0];
    if (!file) { preview.hidden = true; preview.innerHTML = ''; return; }
    if (file.size > 5 * 1024 * 1024) {
      photoInput.value = '';
      preview.hidden = true;
      toast('A fotografia precisa ter até 5 MB.', 'error');
      return;
    }
    previewUrl = URL.createObjectURL(file);
    preview.hidden = false;
    preview.innerHTML = `<img src="${previewUrl}" alt="Prévia da fotografia"><span>${escapeHTML(file.name)}</span><button type="button" class="icon-button" aria-label="Remover fotografia">×</button>`;
    preview.querySelector('button')?.addEventListener('click', () => {
      photoInput.value = '';
      preview.hidden = true;
      preview.innerHTML = '';
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    });
  });
  document.querySelector('#create-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    const errorNode = document.querySelector('#create-error');
    const submit = form.querySelector('button[type="submit"]');
    errorNode.textContent = '';
    if (!name) { errorNode.textContent = 'Escreva o nome de quem você quer homenagear.'; form.elements.name.focus(); return; }
    const bornOn = form.elements.born_on.value || null;
    const rememberedOn = form.elements.remembered_on.value || null;
    const today = new Date().toISOString().slice(0, 10);
    if ((bornOn && bornOn > today) || (rememberedOn && rememberedOn > today) || (bornOn && rememberedOn && bornOn > rememberedOn)) {
      errorNode.textContent = 'Confira as datas: não podem estar no futuro e o nascimento deve vir antes da partida.';
      return;
    }
    const file = photoInput?.files?.[0];
    if (file && file.size > 5 * 1024 * 1024) { errorNode.textContent = 'A fotografia precisa ter até 5 MB.'; return; }
    const body = {
      name,
      born_on: bornOn,
      remembered_on: rememberedOn,
      epitaph: form.elements.epitaph.value.trim(),
      story: form.elements.story.value.trim(),
      layout: form.elements.layout.value,
      visibility: form.elements.visibility.value,
    };
    submit.disabled = true;
    submit.innerHTML = '<span class="button-spinner" aria-hidden="true"></span> Preparando…';
    try {
      const result = await api('/api/tributes', { method: 'POST', body });
      let photoFailure = null;
      if (file) {
        const upload = new FormData();
        upload.set('photo', file);
        try {
          await api(`/api/tributes/${encodeURIComponent(result.tribute.slug)}/photo`, { method: 'POST', body: upload });
        } catch (failure) {
          photoFailure = failure;
        }
      }
      const edit = body.layout === 'room' ? '?editar=1' : '';
      navigate(`/h/${encodeURIComponent(result.tribute.slug)}${edit}`);
      toast(photoFailure ? `A homenagem foi criada, mas a foto não foi enviada: ${photoFailure.message}` : 'Sua homenagem está pronta.', photoFailure ? 'error' : 'success');
    } catch (failure) {
      errorNode.textContent = failure.message;
      submit.disabled = false;
      submit.innerHTML = 'Criar homenagem <span aria-hidden="true">→</span>';
    }
  });
}

async function renderMine(version) {
  if (!currentUser) { renderAuth('login', '/minhas-homenagens'); return; }
  let tributes = [];
  let loadError = '';
  try { tributes = await getMyTributes(); } catch (failure) { loadError = failure.message; }
  if (version !== renderVersion) return;
  app.innerHTML = `${header()}<main class="page-main mine-page"><section class="page-heading"><div><p class="section-kicker">SEU ESPAÇO</p><h1>Suas <em>homenagens.</em></h1><p>Um cantinho para voltar, cuidar e compartilhar.</p></div><div class="user-chip"><span class="user-avatar">${escapeHTML((currentUser.email || 'J').slice(0, 1).toUpperCase())}</span><span>${escapeHTML(currentUser.email)}</span><button data-action="logout" type="button" class="text-link">Sair</button></div></section>${loadError ? `<div class="notice notice--error">${escapeHTML(loadError)}</div>` : tributes.length ? `<div class="tribute-grid">${tributes.map((tribute) => card(tribute)).join('')}</div>` : `<div class="empty-state"><span>✿</span><h3>Seu jardim ainda está começando</h3><p>Crie a primeira homenagem e escolha como ela vai florescer.</p>${link('/criar', 'Criar homenagem', 'button button--primary')}</div>`}</main>${footer()}`;
  bindMobileMenu();
  document.querySelector('[data-action="logout"]')?.addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* clear local state anyway */ }
    currentUser = null;
    toast('Você saiu da sua conta.', 'success');
    navigate('/');
  });
}

function bindMobileMenu() {
  const button = document.querySelector('.mobile-menu-button');
  const nav = document.querySelector('.main-nav');
  button?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    button.textContent = open ? '×' : '☰';
  });
}

function notFound() {
  app.innerHTML = `${header()}<main class="not-found"><span>✧</span><p class="section-kicker">CAMINHO NÃO ENCONTRADO</p><h1>Esta lembrança ainda não chegou ao jardim.</h1><p>Confira o link ou volte para explorar as homenagens.</p>${link('/jardim', 'Voltar ao jardim', 'button button--primary')}</main>${footer()}`;
  bindMobileMenu();
}

function renderPrivacy() {
  app.innerHTML = `${header()}<main class="privacy-page page-main"><p class="section-kicker">CUIDADO COM AS LEMBRANÇAS</p><h1>Privacidade e <em>respeito.</em></h1><p class="privacy-lede">Queremos que este seja um lugar acolhedor. Aqui está, de forma simples, o que fica visível e o que guardamos.</p><div class="privacy-grid"><section><span>01</span><h2>O que outras pessoas veem</h2><p>Homenagens públicas aparecem no jardim. As não listadas não aparecem na busca, mas qualquer pessoa com o link pode abri-las. As fotografias e textos acompanham a visibilidade da homenagem. Não publique informações que você não queira compartilhar.</p></section><section><span>02</span><h2>Contas e sessões</h2><p>O e-mail é usado para entrar e cuidar das homenagens. A senha é derivada no navegador; o Worker guarda um verificador protegido. A sessão usa um cookie HttpOnly e não fica acessível ao JavaScript da página.</p></section><section><span>03</span><h2>Fotos e armazenamento</h2><p>As imagens aceitas são JPEG, PNG e WebP, com limites de tamanho e dimensões. Metadados comuns de localização são removidos antes de armazenar. O app, as fotos e os dados usam serviços da Cloudflare.</p></section><section><span>04</span><h2>Conversas da sala</h2><p>O chat é ao vivo e as mensagens não são gravadas. Visitantes usam apelidos temporários; o criador pode remover alguém da sala. Mensagens têm limite de tamanho e frequência e links são bloqueados.</p></section><section><span>05</span><h2>Editar ou remover</h2><p>Quem criou uma homenagem pode editar seu texto, trocar a foto, deixá-la não listada ou excluí-la. A exclusão remove também flores, objetos e a fotografia associada.</p></section><section><span>06</span><h2>Limites atuais</h2><p>O cadastro ainda não verifica a posse do e-mail e não há recuperação automática de senha. Se você perder a senha, não conseguirá recuperar a conta pelo site. Não usamos serviço de e-mail para esses fluxos neste MVP.</p></section></div><p class="privacy-contact">Se precisar de ajuda para corrigir ou remover conteúdo, entre em contato com quem administra este projeto.</p>${link('/jardim', 'Voltar ao jardim <span aria-hidden="true">→</span>', 'text-link')}</main>${footer()}`;
  bindMobileMenu();
}

async function renderRoute() {
  const version = ++renderVersion;
  if (currentSocket) {
    const socket = currentSocket;
    currentSocket = null;
    try { socket.close(1000, 'Navigation'); } catch { /* socket is already closed */ }
  }
  currentSocketId = null;
  currentRoomPlayers = [];
  currentWorld?.dispose();
  currentWorld = null;
  const path = decodeURI(location.pathname);
  if (path === '/') return renderHome(version);
  if (path === '/jardim') return renderExplore(version);
  if (path === '/privacidade') return renderPrivacy();
  if (path === '/entrar') {
    const mode = new URLSearchParams(location.search).get('modo') === 'cadastro' ? 'register' : 'login';
    return renderAuth(mode);
  }
  if (path === '/criar') return renderCreate();
  if (path === '/minhas-homenagens') return renderMine(version);
  const tributeMatch = path.match(/^\/h\/([^/]+)\/?$/);
  if (tributeMatch) {
    let data;
    try { data = await getTribute(tributeMatch[1]); } catch { if (version === renderVersion) notFound(); return; }
    if (version !== renderVersion) return;
    document.title = `${data.tribute.name} — Jade`;
    if (data.tribute.layout === 'simple') renderSimpleTribute(data.tribute);
    else await renderRoomPage(data.tribute, data.objects, version);
    return;
  }
  notFound();
}

function navigate(path) {
  const target = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  history.pushState({}, '', target);
  window.scrollTo({ top: 0, behavior: 'auto' });
  renderRoute();
}

app.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[data-nav]');
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = new URL(anchor.href, location.origin);
  if (target.origin !== location.origin) return;
  event.preventDefault();
  navigate(`${target.pathname}${target.search}${target.hash}`);
});

window.addEventListener('popstate', () => { renderRoute(); });
loadSession().then(() => renderRoute());
