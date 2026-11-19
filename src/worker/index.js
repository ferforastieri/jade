const COOKIE_NAME = 'jade_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_JSON_BYTES = 32_000;
const MAX_IMAGE_DIMENSION = 6_000;
const MAX_IMAGE_PIXELS = 20_000_000;
const MAX_ROOM_VISITORS = 32;
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function withSecurityHeaders(response) {
  if (response.status === 101 || response.webSocket) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' wss: ws:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(byteCount = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacBytes(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, value));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validPepper(env) {
  return typeof env.PASSWORD_PEPPER === 'string' && env.PASSWORD_PEPPER.length >= 40;
}

function cookieValue(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  for (const entry of cookieHeader.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() === name) return entry.slice(separator + 1).trim();
  }
  return null;
}

function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

function expiredCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}

async function getCurrentUser(request, env) {
  const token = cookieValue(request, COOKIE_NAME);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  return env.DB.prepare(
    `SELECT users.id, users.email
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ? LIMIT 1`,
  ).bind(tokenHash, now).first();
}

async function issueSession(user, request, env, status = 200) {
  const token = randomToken();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)).run();
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).bind(await sha256Hex(token), user.id, expiresAt, new Date().toISOString()).run();
  return json({ user: { id: user.id, email: user.email } }, status, { 'Set-Cookie': sessionCookie(token, request) });
}

function validEmail(value) {
  if (typeof value !== 'string' || value.length > 254) return false;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function normalizeOptionalDate(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}

function validMemorialDates(bornOn, rememberedOn) {
  const today = new Date().toISOString().slice(0, 10);
  return !(bornOn && bornOn > today) && !(rememberedOn && rememberedOn > today) &&
    !(bornOn && rememberedOn && bornOn > rememberedOn);
}

function plainText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (cleaned.length > maxLength) return null;
  return cleaned;
}

function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

async function readLimitedBody(request, maximumBytes) {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maximumBytes) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return null;
  const bytes = await readLimitedBody(request, MAX_JSON_BYTES);
  if (!bytes?.length) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

async function checkAuthRateLimit(request, env, identity) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Math.floor(Date.now() / 1000);
  const expiredBefore = now - 15 * 60;
  const keys = [
    { key: hex(await hmacBytes(env.PASSWORD_PEPPER, encoder.encode(`auth-ip:${ip}`))), limit: 30 },
    { key: hex(await hmacBytes(env.PASSWORD_PEPPER, encoder.encode(`auth-email:${identity.toLowerCase()}`))), limit: 8 },
  ];
  await env.DB.prepare('DELETE FROM auth_attempts WHERE window_start < ?').bind(now - 86_400).run();
  let limited = false;
  for (const bucket of keys) {
    await env.DB.prepare(
      `INSERT INTO auth_attempts (bucket_key, attempts, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT(bucket_key) DO UPDATE SET
         attempts = CASE WHEN auth_attempts.window_start < ? THEN 1 ELSE auth_attempts.attempts + 1 END,
         window_start = CASE WHEN auth_attempts.window_start < ? THEN excluded.window_start ELSE auth_attempts.window_start END`,
    ).bind(bucket.key, now, expiredBefore, expiredBefore).run();
    const row = await env.DB.prepare('SELECT attempts FROM auth_attempts WHERE bucket_key = ?').bind(bucket.key).first();
    if (Number(row?.attempts || 0) > bucket.limit) limited = true;
  }
  return limited;
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52) || 'memoria';
}

function publicTribute(row, ownerId = null) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    born_on: row.born_on,
    remembered_on: row.remembered_on,
    epitaph: row.epitaph,
    story: row.story,
    visibility: row.visibility,
    layout: row.layout,
    theme: row.theme,
    photo_url: row.photo_key ? `/media/${row.photo_key}` : null,
    flower_count: Number(row.flower_count || 0),
    is_owner: Boolean(ownerId && row.owner_id === ownerId),
    is_seed: Boolean(row.is_seed),
    created_at: row.created_at,
  };
}

async function findTribute(env, slug, userId = null) {
  const row = await env.DB.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM flowers f WHERE f.tribute_id = t.id) AS flower_count
     FROM tributes t WHERE t.slug = ?
     AND (t.visibility IN ('public', 'unlisted') OR t.owner_id = ?)
     LIMIT 1`,
  ).bind(slug, userId || '').first();
  return row || null;
}

async function requireOwner(request, env, tribute) {
  const user = await getCurrentUser(request, env);
  if (!user) return { response: error('Entre na sua conta para continuar.', 401) };
  if (tribute.owner_id !== user.id) return { response: error('Você não pode editar esta homenagem.', 403) };
  return { user };
}

async function handleAuth(request, env, pathname) {
  if (pathname === '/api/auth/session' && request.method === 'GET') {
    const user = await getCurrentUser(request, env);
    return json({ user: user ? { id: user.id, email: user.email } : null });
  }

  if (pathname === '/api/auth/salt' && request.method === 'GET') {
    if (!isSameOrigin(request)) return error('Origem inválida.', 403);
    if (!validPepper(env)) return error('A autenticação ainda não está configurada.', 503);
    const email = (new URL(request.url).searchParams.get('email') || '').trim().toLowerCase();
    if (!validEmail(email)) return error('Informe um e-mail válido.');
    const user = await env.DB.prepare('SELECT password_salt FROM users WHERE email = ? COLLATE NOCASE LIMIT 1')
      .bind(email)
      .first();
    const salt = user?.password_salt
      ? user.password_salt
      : toBase64((await hmacBytes(env.PASSWORD_PEPPER, encoder.encode(`jade-login-salt:${email}`))).slice(0, 16));
    return json({ salt });
  }

  if (!['/api/auth/login', '/api/auth/register', '/api/auth/logout'].includes(pathname)) return null;
  if (!isSameOrigin(request)) return error('Origem inválida.', 403);

  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = cookieValue(request, COOKIE_NAME);
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
    }
    return json({ ok: true }, 200, { 'Set-Cookie': expiredCookie(request) });
  }

  if (request.method !== 'POST') return error('Método não permitido.', 405);
  if (!validPepper(env)) return error('A autenticação ainda não está configurada.', 503);
  const payload = await readJson(request);
  if (!payload) return error('Envie os dados em formato JSON válido.');
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  let verifier;
  try { verifier = fromBase64(payload.verifier); } catch { verifier = new Uint8Array(); }
  if (!validEmail(email) || verifier.byteLength !== 32) {
    return error('Não foi possível validar o acesso. Confira o e-mail e tente novamente.');
  }
  if (await checkAuthRateLimit(request, env, email)) return error('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 429);

  if (pathname === '/api/auth/register') {
    let salt;
    try { salt = fromBase64(payload.salt); } catch { salt = new Uint8Array(); }
    if (salt.byteLength !== 16) return error('Não foi possível criar o acesso. Tente novamente.');
    const id = randomToken(16);
    const passwordHash = toBase64(await hmacBytes(env.PASSWORD_PEPPER, verifier));
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_salt, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING`,
    ).bind(id, email, toBase64(salt), passwordHash, new Date().toISOString()).run();
    // The same status and body are returned whether the address was new or already registered.
    return json({ ok: true }, 202);
  }

  const user = await env.DB.prepare('SELECT id, email, password_hash FROM users WHERE email = ? COLLATE NOCASE LIMIT 1')
    .bind(email)
    .first();
  const candidateHash = await hmacBytes(env.PASSWORD_PEPPER, verifier);
  let expectedHash = new Uint8Array(32);
  if (user) {
    try { expectedHash = fromBase64(user.password_hash); } catch { expectedHash = new Uint8Array(32); }
  }
  const verified = Boolean(user) && constantTimeEqual(candidateHash, expectedHash);
  if (!verified) return error('E-mail ou senha incorretos.', 401);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateKeys = [
    hex(await hmacBytes(env.PASSWORD_PEPPER, encoder.encode(`auth-ip:${ip}`))),
    hex(await hmacBytes(env.PASSWORD_PEPPER, encoder.encode(`auth-email:${email}`))),
  ];
  await env.DB.prepare('DELETE FROM auth_attempts WHERE bucket_key IN (?, ?)').bind(...rateKeys).run();
  return issueSession(user, request, env);
}

function readU16BE(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32BE(bytes, offset) {
  return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function readU16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32LE(bytes, offset) {
  return (bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + (bytes[offset + 3] * 0x1000000)) >>> 0;
}

function readU24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function validDimensions(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 &&
    width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION && width * height <= MAX_IMAGE_PIXELS;
}

function joinByteArrays(parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function sanitizePng(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 33 || signature.some((value, index) => bytes[index] !== value)) return null;
  const chunks = [bytes.subarray(0, 8)];
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawEnd = false;
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = readU32BE(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    const type = ascii(bytes, offset + 4, 4);
    if (type === 'IHDR') {
      if (sawHeader || length !== 13 || offset !== 8) return null;
      width = readU32BE(bytes, offset + 8);
      height = readU32BE(bytes, offset + 12);
      sawHeader = true;
    }
    if (!['eXIf', 'tEXt', 'zTXt', 'iTXt'].includes(type)) chunks.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') {
      sawEnd = true;
      break;
    }
  }
  if (!sawHeader || !sawEnd || offset !== bytes.length || !validDimensions(width, height)) return null;
  return { bytes: joinByteArrays(chunks), contentType: 'image/png', extension: 'png', width, height };
}

function sanitizeJpeg(bytes) {
  if (bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return null;
  const parts = [bytes.subarray(0, 2)];
  let width = 0;
  let height = 0;
  let sawFrame = false;
  let sawScan = false;
  let offset = 2;
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const start = offset;
    while (bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9) {
      parts.push(bytes.subarray(start, offset));
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(start, offset));
      continue;
    }
    if (offset + 2 > bytes.length) return null;
    const segmentLength = readU16BE(bytes, offset);
    const end = offset + segmentLength;
    if (segmentLength < 2 || end > bytes.length) return null;
    if (frameMarkers.has(marker)) {
      if (segmentLength < 8) return null;
      height = readU16BE(bytes, offset + 3);
      width = readU16BE(bytes, offset + 5);
      sawFrame = true;
    }
    if (marker === 0xda) {
      if (!sawFrame) return null;
      parts.push(bytes.subarray(start));
      sawScan = true;
      break;
    }
    // EXIF/XMP (APP1) and IPTC/Photoshop (APP13) may carry location and identity metadata.
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) parts.push(bytes.subarray(start, end));
    offset = end;
  }
  if (!sawFrame || !sawScan || !validDimensions(width, height)) return null;
  return { bytes: joinByteArrays(parts), contentType: 'image/jpeg', extension: 'jpg', width, height };
}

function sanitizeWebp(bytes) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null;
  const declaredLength = readU32LE(bytes, 4) + 8;
  if (declaredLength !== bytes.length) return null;
  const chunks = [];
  let width = 0;
  let height = 0;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = readU32LE(bytes, offset + 4);
    const chunkEnd = offset + 8 + length;
    const paddedEnd = chunkEnd + (length & 1);
    if (paddedEnd > bytes.length) return null;
    const data = offset + 8;
    if (type === 'ANIM' || type === 'ANMF') return null;
    if (type === 'VP8X' && length >= 10) {
      width = readU24LE(bytes, data + 4) + 1;
      height = readU24LE(bytes, data + 7) + 1;
    } else if (type === 'VP8 ' && length >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      width = readU16LE(bytes, data + 6) & 0x3fff;
      height = readU16LE(bytes, data + 8) & 0x3fff;
    } else if (type === 'VP8L' && length >= 5 && bytes[data] === 0x2f) {
      width = 1 + (((bytes[data + 2] & 0x3f) << 8) | bytes[data + 1]);
      height = 1 + (((bytes[data + 4] & 0x0f) << 10) | (bytes[data + 3] << 2) | ((bytes[data + 2] & 0xc0) >> 6));
    }
    if (type === 'VP8X') {
      const sanitizedChunk = new Uint8Array(bytes.subarray(offset, paddedEnd));
      sanitizedChunk[8] &= ~0x0c; // clear EXIF and XMP metadata flags
      chunks.push(sanitizedChunk);
    } else if (type !== 'EXIF' && type !== 'XMP ') {
      chunks.push(bytes.subarray(offset, paddedEnd));
    }
    offset = paddedEnd;
  }
  if (offset !== bytes.length || !validDimensions(width, height)) return null;
  const output = joinByteArrays([bytes.subarray(0, 12), ...chunks]);
  const riffSize = output.length - 8;
  output[4] = riffSize & 0xff;
  output[5] = (riffSize >>> 8) & 0xff;
  output[6] = (riffSize >>> 16) & 0xff;
  output[7] = (riffSize >>> 24) & 0xff;
  return { bytes: output, contentType: 'image/webp', extension: 'webp', width, height };
}

function sanitizeImage(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return sanitizeJpeg(bytes);
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return sanitizePng(bytes);
  if (ascii(bytes, 0, 4) === 'RIFF') return sanitizeWebp(bytes);
  return null;
}

async function handlePhotoUpload(request, env, tribute, user) {
  if (!env.MEDIA) return error('O armazenamento de fotos ainda não está configurado.', 503);
  const body = await readLimitedBody(request, MAX_PHOTO_BYTES + 64_000);
  if (!body) return error('A fotografia deve ter até 5 MB.', 413);
  let form;
  try {
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    form = await new Request(request.url, { method: 'POST', headers, body }).formData();
  } catch {
    return error('Envie uma fotografia válida.');
  }
  const file = form.get('photo');
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size || file.size > MAX_PHOTO_BYTES) {
    return error('A fotografia deve ter até 5 MB.');
  }
  const original = new Uint8Array(await file.arrayBuffer());
  const image = sanitizeImage(original);
  if (!image) return error('Use uma imagem JPEG, PNG ou WebP válida, com até 6.000 px por lado e 20 megapixels.');

  const key = `tributes/${tribute.id}/cover-${randomToken(12)}.${image.extension}`;
  await env.MEDIA.put(key, image.bytes, {
    httpMetadata: { contentType: image.contentType, cacheControl: 'public, max-age=600' },
    customMetadata: { tributeId: tribute.id, ownerId: user.id, width: String(image.width), height: String(image.height) },
  });
  const oldKey = tribute.photo_key;
  await env.DB.prepare('UPDATE tributes SET photo_key = ?, updated_at = ? WHERE id = ?')
    .bind(key, new Date().toISOString(), tribute.id)
    .run();
  if (oldKey && oldKey !== key) await env.MEDIA.delete(oldKey);
  return json({ photo_url: `/media/${key}`, width: image.width, height: image.height }, 201);
}

async function handleRoomSocket(request, env, slug) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return error('Origem inválida.', 403);
  if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return error('Esta rota aceita apenas uma conexão WebSocket.', 426);
  }
  if (!env.ROOMS) return error('A conversa da sala ainda não está configurada.', 503);
  const user = await getCurrentUser(request, env);
  const tribute = await findTribute(env, slug, user?.id || null);
  if (!tribute || tribute.layout !== 'room') return error('Sala não encontrada.', 404);

  const visitorId = randomToken(16);
  const visitorCode = randomToken(2).slice(0, 4).toUpperCase();
  const isOwner = Boolean(user && tribute.owner_id === user.id);
  const headers = new Headers(request.headers);
  headers.set('X-Jade-Visitor-Id', visitorId);
  headers.set('X-Jade-Visitor-Name', `${isOwner ? 'Anfitrião' : 'Visitante'} ${visitorCode}`);
  headers.set('X-Jade-Visitor-Owner', isOwner ? '1' : '0');
  const upstream = new Request(request, { headers });
  const roomId = env.ROOMS.idFromName(tribute.id);
  return env.ROOMS.get(roomId).fetch(upstream);
}

export class MemorialRoom {
  constructor(state) {
    this.state = state;
  }

  publicPlayer(player) {
    return { id: player.id, name: player.name, isOwner: Boolean(player.isOwner), x: player.x, z: player.z };
  }

  send(socket, payload) {
    try { socket.send(JSON.stringify(payload)); } catch { /* socket is already closing */ }
  }

  broadcast(payload, excludedId = null) {
    for (const socket of this.state.getWebSockets()) {
      let player;
      try { player = socket.deserializeAttachment(); } catch { continue; }
      if (player?.id && player.id !== excludedId) this.send(socket, payload);
    }
  }

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket upgrade required', { status: 426 });
    }
    const id = request.headers.get('X-Jade-Visitor-Id') || '';
    const name = plainText(request.headers.get('X-Jade-Visitor-Name') || '', 24);
    const isOwner = request.headers.get('X-Jade-Visitor-Owner') === '1';
    if (!/^[a-f0-9]{32}$/.test(id) || !name) return new Response('Invalid visitor', { status: 400 });
    const existing = this.state.getWebSockets();
    if (existing.length >= MAX_ROOM_VISITORS) return new Response('Room is full', { status: 429 });

    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server);
    const player = { id, name, isOwner, x: 0, z: 3.65, lastMoveAt: 0, recentMessages: [] };
    server.serializeAttachment(player);
    const players = this.state.getWebSockets().map((socket) => {
      try { return socket.deserializeAttachment(); } catch { return null; }
    }).filter(Boolean);
    this.send(server, { type: 'welcome', selfId: id, players: players.map((entry) => this.publicPlayer(entry)) });
    this.broadcast({ type: 'presence', action: 'join', player: this.publicPlayer(player) }, id);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    if (typeof message !== 'string' || message.length > 2_048) return;
    let payload;
    try { payload = JSON.parse(message); } catch { return; }
    const player = socket.deserializeAttachment();
    if (!player?.id || !payload || typeof payload !== 'object') return;

    if (payload.type === 'move') {
      const now = Date.now();
      if (now - player.lastMoveAt < 80) return;
      const x = Number(payload.x);
      const z = Number(payload.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      player.x = Math.max(-4.2, Math.min(4.2, x));
      player.z = Math.max(-4.2, Math.min(4.2, z));
      player.lastMoveAt = now;
      socket.serializeAttachment(player);
      this.broadcast({ type: 'move', player: this.publicPlayer(player) }, player.id);
      return;
    }

    if (payload.type === 'chat') {
      const text = plainText(payload.text, 240);
      if (!text) {
        this.send(socket, { type: 'error', message: 'Escreva uma mensagem curta para enviar.' });
        return;
      }
      if (/(https?:\/\/|www\.)/i.test(text)) {
        this.send(socket, { type: 'error', message: 'Links não são permitidos na conversa da sala.' });
        return;
      }
      const now = Date.now();
      const recent = (player.recentMessages || []).filter((time) => now - time < 10_000);
      if (recent.length >= 4) {
        this.send(socket, { type: 'error', message: 'Aguarde alguns segundos antes de enviar outra mensagem.' });
        return;
      }
      recent.push(now);
      player.recentMessages = recent;
      socket.serializeAttachment(player);
      this.broadcast({
        type: 'chat',
        message: { id: randomToken(8), playerId: player.id, name: player.name, isOwner: player.isOwner, text, sentAt: now },
      });
      return;
    }

    if (payload.type === 'kick' && player.isOwner && typeof payload.playerId === 'string') {
      const target = this.state.getWebSockets().find((candidate) => {
        try {
          const candidatePlayer = candidate.deserializeAttachment();
          return candidatePlayer.id === payload.playerId && !candidatePlayer.isOwner;
        } catch { return false; }
      });
      if (target) {
        this.send(target, { type: 'kicked', message: 'O criador encerrou sua visita a esta sala.' });
        try { target.close(4003, 'Removed by room host'); } catch { /* already closed */ }
      }
    }
  }

  webSocketClose(socket) {
    this.removePlayer(socket);
  }

  webSocketError(socket) {
    this.removePlayer(socket);
  }

  removePlayer(socket) {
    let player;
    try { player = socket.deserializeAttachment(); } catch { return; }
    if (!player?.id || player.left) return;
    player.left = true;
    try { socket.serializeAttachment(player); } catch { /* closing socket */ }
    this.broadcast({ type: 'presence', action: 'leave', playerId: player.id }, player.id);
  }
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === '/api/health' && request.method === 'GET') return json({ ok: true, service: 'jade' });

  const authResponse = await handleAuth(request, env, pathname);
  if (authResponse) return authResponse;

  const roomSocketMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomSocketMatch) {
    const slug = decodeURIComponent(roomSocketMatch[1]);
    if (!/^[a-z0-9-]{1,64}$/i.test(slug)) return error('Sala não encontrada.', 404);
    return handleRoomSocket(request, env, slug);
  }

  if (pathname === '/api/tributes' && request.method === 'GET') {
    const result = await env.DB.prepare(
      `SELECT t.*, (SELECT COUNT(*) FROM flowers f WHERE f.tribute_id = t.id) AS flower_count
       FROM tributes t WHERE t.visibility = 'public'
       ORDER BY t.is_seed DESC, t.updated_at DESC LIMIT 60`,
    ).all();
    const user = await getCurrentUser(request, env);
    return json({ tributes: (result.results || []).map((row) => publicTribute(row, user?.id)) });
  }

  if (pathname === '/api/tributes' && request.method === 'POST') {
    if (!isSameOrigin(request)) return error('Origem inválida.', 403);
    const user = await getCurrentUser(request, env);
    if (!user) return error('Entre na sua conta para criar uma homenagem.', 401);
    const payload = await readJson(request);
    if (!payload) return error('Envie os dados em formato JSON válido.');
    const name = plainText(payload.name, 80);
    const epitaph = plainText(payload.epitaph ?? '', 180);
    const story = plainText(payload.story ?? '', 4000);
    const bornOn = normalizeOptionalDate(payload.born_on);
    const rememberedOn = normalizeOptionalDate(payload.remembered_on);
    const visibility = payload.visibility ?? 'public';
    const layout = payload.layout ?? 'room';
    if (!name || epitaph === null || story === null || bornOn === undefined || rememberedOn === undefined || !validMemorialDates(bornOn, rememberedOn)) {
      return error('Revise o nome, as datas e o tamanho dos textos.');
    }
    if (!['public', 'unlisted'].includes(visibility) || !['room', 'simple'].includes(layout)) {
      return error('Escolha um formato e uma visibilidade válidos.');
    }
    const id = randomToken(16);
    const slug = `${slugify(name).slice(0, 24)}-${randomToken(16)}`;
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO tributes (id, slug, owner_id, name, born_on, remembered_on, epitaph, story, visibility, layout, theme, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dawn', ?, ?)`,
    ).bind(id, slug, user.id, name, bornOn, rememberedOn, epitaph, story, visibility, layout, now, now).run();
    const created = await findTribute(env, slug, user.id);
    return json({ tribute: publicTribute(created, user.id) }, 201);
  }

  if (pathname === '/api/me/tributes' && request.method === 'GET') {
    const user = await getCurrentUser(request, env);
    if (!user) return error('Entre na sua conta para ver suas homenagens.', 401);
    const result = await env.DB.prepare(
      `SELECT t.*, (SELECT COUNT(*) FROM flowers f WHERE f.tribute_id = t.id) AS flower_count
       FROM tributes t WHERE t.owner_id = ? ORDER BY t.updated_at DESC LIMIT 60`,
    ).bind(user.id).all();
    return json({ tributes: (result.results || []).map((row) => publicTribute(row, user.id)) });
  }

  const mediaMatch = pathname.match(/^\/media\/(.+)$/);
  if (mediaMatch && request.method === 'GET') {
    if (!env.MEDIA) return error('Foto não encontrada.', 404);
    const key = decodeURIComponent(mediaMatch[1]);
    if (!key.startsWith('tributes/') || key.includes('..')) return error('Foto não encontrada.', 404);
    const owner = await env.DB.prepare('SELECT visibility FROM tributes WHERE photo_key = ? LIMIT 1').bind(key).first();
    if (!owner || !['public', 'unlisted'].includes(owner.visibility)) return error('Foto não encontrada.', 404);
    const object = await env.MEDIA.get(key);
    if (!object) return error('Foto não encontrada.', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(object.body, { headers });
  }

  const tributeMatch = pathname.match(/^\/api\/tributes\/([^/]+)(?:\/(.*))?$/);
  if (!tributeMatch) return null;
  const slug = decodeURIComponent(tributeMatch[1]);
  const action = tributeMatch[2] || '';
  if (!/^[a-z0-9-]{1,64}$/i.test(slug)) return error('Homenagem não encontrada.', 404);

  const existing = await findTribute(env, slug, (await getCurrentUser(request, env))?.id || null);
  if (!existing) return error('Homenagem não encontrada.', 404);

  if (action === '' && request.method === 'GET') {
    const objects = await env.DB.prepare(
      'SELECT id, kind, x, z, created_at FROM tribute_objects WHERE tribute_id = ? ORDER BY created_at ASC LIMIT 80',
    ).bind(existing.id).all();
    const user = await getCurrentUser(request, env);
    return json({ tribute: publicTribute(existing, user?.id), objects: objects.results || [] });
  }

  if (action === '' && request.method === 'PATCH') {
    if (!isSameOrigin(request)) return error('Origem inválida.', 403);
    const auth = await requireOwner(request, env, existing);
    if (auth.response) return auth.response;
    const payload = await readJson(request);
    if (!payload) return error('Envie os dados em formato JSON válido.');
    const name = payload.name === undefined ? existing.name : plainText(payload.name, 80);
    const epitaph = payload.epitaph === undefined ? existing.epitaph : plainText(payload.epitaph, 180);
    const story = payload.story === undefined ? existing.story : plainText(payload.story, 4000);
    const visibility = payload.visibility === undefined ? existing.visibility : payload.visibility;
    if (!name || epitaph === null || story === null || !['public', 'unlisted'].includes(visibility)) {
      return error('Revise os dados da homenagem.');
    }
    await env.DB.prepare('UPDATE tributes SET name = ?, epitaph = ?, story = ?, visibility = ?, updated_at = ? WHERE id = ?')
      .bind(name, epitaph, story, visibility, new Date().toISOString(), existing.id)
      .run();
    const updated = await findTribute(env, slug, auth.user.id);
    return json({ tribute: publicTribute(updated, auth.user.id) });
  }

  if (action === '' && request.method === 'DELETE') {
    if (!isSameOrigin(request)) return error('Origem inválida.', 403);
    const auth = await requireOwner(request, env, existing);
    if (auth.response) return auth.response;
    if (existing.is_seed) return error('Esta homenagem base não pode ser removida.', 403);
    await env.DB.prepare('DELETE FROM tributes WHERE id = ? AND owner_id = ? AND is_seed = 0')
      .bind(existing.id, auth.user.id)
      .run();
    if (existing.photo_key && env.MEDIA) await env.MEDIA.delete(existing.photo_key);
    return json({ ok: true });
  }

  if (action === 'photo' && request.method === 'POST') {
    if (!isSameOrigin(request)) return error('Origem inválida.', 403);
    const auth = await requireOwner(request, env, existing);
    if (auth.response) return auth.response;
    return handlePhotoUpload(request, env, existing, auth.user);
  }

  if (action === 'flowers' && request.method === 'POST') {
    if (!isSameOrigin(request)) return error('Origem inválida.', 403);
    if (!validPepper(env)) return error('O jardim está temporariamente indisponível para receber flores.', 503);
    const payload = await readJson(request);
    if (!payload) return error('Envie os dados em formato JSON válido.');
    const kind = ['daisy', 'rose', 'sunflower'].includes(payload.kind) ? payload.kind : 'daisy';
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const visitorHash = hex(await hmacBytes(env.PASSWORD_PEPPER, encoder.encode(`${ip}|${existing.id}`)));
    const now = Date.now();
    const cutoff = now - 30_000;
    await env.DB.prepare('DELETE FROM flower_rate_limits WHERE last_flower_at < ?').bind(now - 86_400_000).run();
    const gate = await env.DB.prepare(
      `INSERT INTO flower_rate_limits (tribute_id, visitor_hash, last_flower_at) VALUES (?, ?, ?)
       ON CONFLICT(tribute_id, visitor_hash) DO UPDATE SET last_flower_at = excluded.last_flower_at
       WHERE flower_rate_limits.last_flower_at <= ?`,
    ).bind(existing.id, visitorHash, now, cutoff).run();
    if (Number(gate.meta?.changes || 0) === 0) return error('Sua flor já chegou. Aguarde um instante para deixar outra.', 429);
    await env.DB.prepare('INSERT INTO flowers (id, tribute_id, kind, visitor_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(randomToken(12), existing.id, kind, visitorHash, new Date(now).toISOString())
      .run();
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM flowers WHERE tribute_id = ?').bind(existing.id).first();
    return json({ flower_count: Number(count?.count || 0) }, 201);
  }

  if (action === 'objects' && request.method === 'POST') {
    if (!isSameOrigin(request)) return error('Origem inválida.', 403);
    const auth = await requireOwner(request, env, existing);
    if (auth.response) return auth.response;
    if (existing.layout !== 'room') return error('Esta homenagem não tem uma sala para editar.', 409);
    const payload = await readJson(request);
    if (!payload || !['flower', 'candle', 'book', 'lantern', 'bench'].includes(payload.kind)) {
      return error('Escolha um objeto válido.');
    }
    const x = Number(payload.x);
    const z = Number(payload.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < -4.25 || x > 4.25 || z < -4.25 || z > 4.25) {
      return error('Esse lugar fica fora da sala.');
    }
    const total = await env.DB.prepare('SELECT COUNT(*) AS count FROM tribute_objects WHERE tribute_id = ?').bind(existing.id).first();
    if (Number(total?.count || 0) >= 60) return error('A sala já está cheia de lembranças.', 409);
    const object = { id: randomToken(12), kind: payload.kind, x: Number(x.toFixed(2)), z: Number(z.toFixed(2)) };
    await env.DB.prepare('INSERT INTO tribute_objects (id, tribute_id, kind, x, z, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(object.id, existing.id, object.kind, object.x, object.z, new Date().toISOString())
      .run();
    return json({ object }, 201);
  }

  const objectMatch = action.match(/^objects\/([a-f0-9]{24})$/i);
  if (objectMatch && request.method === 'DELETE') {
    if (!isSameOrigin(request)) return error('Origem inválida.', 403);
    const auth = await requireOwner(request, env, existing);
    if (auth.response) return auth.response;
    await env.DB.prepare('DELETE FROM tribute_objects WHERE id = ? AND tribute_id = ?')
      .bind(objectMatch[1], existing.id)
      .run();
    return json({ ok: true });
  }

  return error('Método ou recurso não encontrado.', 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) {
        const response = await handleApi(request, env);
        return withSecurityHeaders(response || error('Recurso não encontrado.', 404));
      }
      const asset = await env.ASSETS.fetch(request);
      return withSecurityHeaders(asset);
    } catch (caught) {
      // Never log request bodies, credentials, or cookies.
      console.error('Jade Worker request failed:', caught instanceof Error ? caught.message : 'unknown error');
      return withSecurityHeaders(error('O jardim encontrou um problema. Tente novamente.', 500));
    }
  },
};
