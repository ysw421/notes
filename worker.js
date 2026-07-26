const REPO_OWNER = 'ysw421';
const REPO_NAME = 'private-notes';
const GITHUB_API = 'https://api.github.com';
const PBKDF2_ITERATIONS = 100000;
const TOKEN_TTL_SECONDS = 86400;
const MAX_PATH_LENGTH = 512;
const MAX_BLOB_BYTES = 25 * 1024 * 1024;
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_SECONDS = 900;

function buildCors(request, env) {
  const configured = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin');
  const allowOrigin = configured.length === 0
    ? '*'
    : (configured.includes(origin) ? origin : configured[0]);
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const matched = String(hex).match(/.{1,2}/g);
  if (!matched) return new Uint8Array(0);
  return Uint8Array.from(matched.map(b => parseInt(b, 16)));
}

function b64urlFromBytes(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function encodeJsonSegment(value) {
  return b64urlFromBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJsonSegment(segment) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(segment)));
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(message) {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message)));
}

async function derive(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations, hash: 'SHA-256' },
    key,
    256
  );
  return toHex(bits);
}

async function hashPassword(password) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return {
    algo: 'pbkdf2-sha256',
    salt,
    iterations: PBKDF2_ITERATIONS,
    passwordHash: await derive(password, salt, PBKDF2_ITERATIONS),
    pwdChangedAt: Math.floor(Date.now() / 1000)
  };
}

async function verifyPassword(env, username, user, password) {
  if (user.algo === 'pbkdf2-sha256') {
    const candidate = await derive(password, user.salt, user.iterations);
    return constantTimeEqual(candidate, user.passwordHash);
  }
  const legacy = await sha256Hex(password);
  if (!constantTimeEqual(legacy, String(user.passwordHash || ''))) return false;
  const upgraded = { ...user, ...(await hashPassword(password)) };
  upgraded.pwdChangedAt = user.pwdChangedAt || 0;
  await setUser(env, username, upgraded);
  return true;
}

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

async function signJWT(payload, secret) {
  const data = encodeJsonSegment({ alg: 'HS256', typ: 'JWT' }) + '.' + encodeJsonSegment(payload);
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), new TextEncoder().encode(data));
  return data + '.' + b64urlFromBytes(new Uint8Array(signature));
}

async function verifyJWT(token, secret) {
  if (typeof token !== 'string') throw new Error('invalid');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid');
  const data = parts[0] + '.' + parts[1];
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret, 'verify'),
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(data)
  );
  if (!valid) throw new Error('invalid');
  const payload = decodeJsonSegment(parts[1]);
  if (!payload.exp || Date.now() >= payload.exp * 1000) throw new Error('expired');
  return payload;
}

function parsePath(raw) {
  if (raw === undefined || raw === null) return [];
  if (typeof raw !== 'string') return null;
  if (raw.length > MAX_PATH_LENGTH) return null;
  if (raw.includes('%') || raw.includes('\\') || raw.includes('..')) return null;
  const segments = raw.split('/').filter(s => s.length > 0);
  for (const segment of segments) {
    if (segment === '.' || segment === '..') return null;
    if (/[\u0000-\u001f\u007f?#:]/.test(segment)) return null;
  }
  return segments;
}

function isUnder(segments, rule) {
  if (rule.length > segments.length) return false;
  for (let i = 0; i < rule.length; i++) {
    if (rule[i] !== segments[i]) return false;
  }
  return true;
}

function authorize(segments, role, permissions) {
  if (segments === null) return false;
  if (role === 'admin') return true;
  if (!permissions) return false;
  const base = parsePath(permissions.basePath === undefined ? '/' : permissions.basePath);
  if (base === null || !isUnder(segments, base)) return false;
  let bestLength = base.length - 1;
  let allowed = true;
  for (const rule of Array.isArray(permissions.denied) ? permissions.denied : []) {
    const parsed = parsePath(rule);
    if (parsed !== null && isUnder(segments, parsed) && parsed.length >= bestLength) {
      bestLength = parsed.length;
      allowed = false;
    }
  }
  for (const rule of Array.isArray(permissions.allowed) ? permissions.allowed : []) {
    const parsed = parsePath(rule);
    if (parsed !== null && isUnder(segments, parsed) && parsed.length > bestLength) {
      bestLength = parsed.length;
      allowed = true;
    }
  }
  return allowed;
}

function isPublic(segments, publicPaths) {
  if (segments === null) return false;
  for (const rule of Array.isArray(publicPaths) ? publicPaths : []) {
    const parsed = parsePath(rule);
    if (parsed !== null && isUnder(segments, parsed)) return true;
  }
  return false;
}

async function getUser(env, username) {
  if (typeof username !== 'string' || !username) return null;
  const data = await env.USERS_KV.get(`user:${username}`);
  return data ? JSON.parse(data) : null;
}

async function setUser(env, username, userData) {
  await env.USERS_KV.put(`user:${username}`, JSON.stringify(userData));
}

async function deleteUser(env, username) {
  await env.USERS_KV.delete(`user:${username}`);
}

async function listUsers(env) {
  const list = await env.USERS_KV.list({ prefix: 'user:' });
  const users = {};
  for (const key of list.keys) {
    const data = await env.USERS_KV.get(key.name);
    if (!data) continue;
    const user = JSON.parse(data);
    users[key.name.replace('user:', '')] = { role: user.role, permissions: user.permissions };
  }
  return users;
}

async function getPublicPaths(env) {
  const data = await env.USERS_KV.get('public:paths');
  return data ? JSON.parse(data) : [];
}

async function setPublicPaths(env, paths) {
  const cleaned = (Array.isArray(paths) ? paths : []).filter(p => parsePath(p) !== null);
  await env.USERS_KV.put('public:paths', JSON.stringify(cleaned));
  return cleaned;
}

async function throttle(env, key) {
  const now = Math.floor(Date.now() / 1000);
  const raw = await env.USERS_KV.get(`throttle:${key}`);
  const state = raw ? JSON.parse(raw) : { count: 0, reset: now + LOGIN_WINDOW_SECONDS };
  if (state.reset <= now) {
    state.count = 0;
    state.reset = now + LOGIN_WINDOW_SECONDS;
  }
  state.count += 1;
  await env.USERS_KV.put(`throttle:${key}`, JSON.stringify(state), { expirationTtl: LOGIN_WINDOW_SECONDS + 60 });
  return state.count <= LOGIN_MAX_ATTEMPTS;
}

function githubFetch(env, pathname) {
  return fetch(GITHUB_API + pathname, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Private-Notes-Viewer'
    }
  });
}

function contentsPath(segments) {
  const encoded = segments.map(encodeURIComponent).join('/');
  return `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encoded}`;
}

function sanitizeEntry(entry) {
  const output = {
    name: entry.name,
    path: entry.path,
    sha: entry.sha,
    size: entry.size,
    type: entry.type
  };
  if (typeof entry.content === 'string') {
    output.content = entry.content;
    output.encoding = entry.encoding;
  }
  return output;
}

async function fillContent(env, entry) {
  if (entry.type !== 'file') return entry;
  if (typeof entry.content === 'string' && entry.content.length > 0) return entry;
  if (!entry.sha) return entry;
  if (typeof entry.size === 'number' && entry.size > MAX_BLOB_BYTES) return entry;
  const response = await githubFetch(env, `/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs/${entry.sha}`);
  if (!response.ok) return entry;
  const blob = await response.json();
  if (blob.encoding === 'base64' && typeof blob.content === 'string') {
    entry.content = blob.content;
    entry.encoding = 'base64';
  }
  return entry;
}

async function loadPath(env, segments, isVisible) {
  const response = await githubFetch(env, contentsPath(segments));
  if (!response.ok) {
    console.log(`github ${response.status} for /${segments.join('/')}`);
    return { status: response.status === 404 ? 404 : 502, files: null };
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    const visible = data.filter(entry => isVisible(parsePath(entry.path))).map(sanitizeEntry);
    return { status: 200, files: visible };
  }
  return { status: 200, files: sanitizeEntry(await fillContent(env, data)) };
}

function sanitizePermissions(permissions) {
  const source = permissions && typeof permissions === 'object' ? permissions : {};
  const base = parsePath(source.basePath === undefined ? '/' : source.basePath);
  const clean = list => (Array.isArray(list) ? list : []).filter(p => parsePath(p) !== null);
  return {
    basePath: base === null ? '/' : '/' + base.join('/'),
    allowed: clean(source.allowed),
    denied: clean(source.denied)
  };
}

function validUsername(username) {
  return typeof username === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(username);
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 256;
}

function validRole(role) {
  return role === 'admin' || role === 'user';
}

async function authenticate(env, token) {
  const decoded = await verifyJWT(token, env.JWT_SECRET);
  const user = await getUser(env, decoded.username);
  if (!user) throw new Error('invalid');
  const changedAt = typeof user.pwdChangedAt === 'number' ? user.pwdChangedAt : 0;
  if ((decoded.iat || 0) < changedAt) throw new Error('invalid');
  return { username: decoded.username, user };
}

async function handleAdmin(env, cors, url, body) {
  let session;
  try {
    session = await authenticate(env, body.token);
  } catch (error) {
    return json({ error: 'Invalid or expired token' }, 401, cors);
  }
  if (session.user.role !== 'admin') return json({ error: 'Admin access required' }, 403, cors);

  if (url.pathname.startsWith('/admin/public')) {
    if (body.action === 'list') return json({ publicPaths: await getPublicPaths(env) }, 200, cors);
    if (body.action === 'set') return json({ success: true, publicPaths: await setPublicPaths(env, body.paths) }, 200, cors);
    return json({ error: 'Invalid action' }, 400, cors);
  }

  if (!url.pathname.startsWith('/admin/users')) return json({ error: 'Not found' }, 404, cors);

  const { username, password, role, permissions } = body;

  if (body.action === 'list') return json({ users: await listUsers(env) }, 200, cors);

  if (body.action === 'create') {
    if (!validUsername(username)) return json({ error: 'Invalid username' }, 400, cors);
    if (!validPassword(password)) return json({ error: 'Password must be at least 12 characters' }, 400, cors);
    if (!validRole(role)) return json({ error: 'Invalid role' }, 400, cors);
    if (await getUser(env, username)) return json({ error: 'User already exists' }, 409, cors);
    await setUser(env, username, {
      role,
      permissions: sanitizePermissions(permissions),
      ...(await hashPassword(password))
    });
    return json({ success: true }, 200, cors);
  }

  if (body.action === 'update') {
    if (!validUsername(username)) return json({ error: 'Invalid username' }, 400, cors);
    const existing = await getUser(env, username);
    if (!existing) return json({ error: 'User not found' }, 404, cors);
    const updated = { ...existing };
    if (password !== undefined) {
      if (!validPassword(password)) return json({ error: 'Password must be at least 12 characters' }, 400, cors);
      Object.assign(updated, await hashPassword(password));
    }
    if (role !== undefined) {
      if (!validRole(role)) return json({ error: 'Invalid role' }, 400, cors);
      if (username === session.username && role !== 'admin') {
        return json({ error: 'Cannot remove your own admin role' }, 400, cors);
      }
      updated.role = role;
    }
    if (permissions !== undefined) updated.permissions = sanitizePermissions(permissions);
    await setUser(env, username, updated);
    return json({ success: true }, 200, cors);
  }

  if (body.action === 'delete') {
    if (!validUsername(username)) return json({ error: 'Invalid username' }, 400, cors);
    if (username === session.username) return json({ error: 'Cannot delete yourself' }, 400, cors);
    if (!(await getUser(env, username))) return json({ error: 'User not found' }, 404, cors);
    await deleteUser(env, username);
    return json({ success: true }, 200, cors);
  }

  return json({ error: 'Invalid action' }, 400, cors);
}

async function handleData(request, env, cors, body) {
  const segments = parsePath(body.path);
  if (segments === null) return json({ error: 'Invalid path' }, 400, cors);

  const { username, password, token } = body;

  if (username && password && !token) {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!(await throttle(env, clientIp))) {
      return json({ error: 'Too many attempts, try again later' }, 429, cors);
    }
    const user = validUsername(username) ? await getUser(env, username) : null;
    if (!user) {
      await derive(String(password), '00000000000000000000000000000000', PBKDF2_ITERATIONS);
      return json({ error: 'Invalid username or password' }, 401, cors);
    }
    if (!(await verifyPassword(env, username, user, String(password)))) {
      return json({ error: 'Invalid username or password' }, 401, cors);
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    const authToken = await signJWT({
      authenticated: true,
      username,
      role: user.role,
      permissions: user.permissions,
      timestamp: Date.now(),
      iat: issuedAt,
      exp: issuedAt + TOKEN_TTL_SECONDS
    }, env.JWT_SECRET);
    return json({ token: authToken }, 200, cors);
  }

  if (token) {
    let session;
    try {
      session = await authenticate(env, token);
    } catch (error) {
      return json({ error: 'Invalid or expired token' }, 401, cors);
    }
    const role = session.user.role;
    const permissions = session.user.permissions;
    if (!authorize(segments, role, permissions)) {
      return json({ error: 'Access denied to this path' }, 403, cors);
    }
    const result = await loadPath(env, segments, child => authorize(child, role, permissions));
    if (result.status !== 200) {
      return json({ error: result.status === 404 ? 'Not found' : 'Upstream error' }, result.status, cors);
    }
    return json({ files: result.files, userPermissions: { role, permissions } }, 200, cors);
  }

  const publicPaths = await getPublicPaths(env);
  if (isPublic(segments, publicPaths)) {
    const result = await loadPath(env, segments, child => isPublic(child, publicPaths));
    if (result.status !== 200) {
      return json({ error: result.status === 404 ? 'Not found' : 'Upstream error' }, result.status, cors);
    }
    return json({ files: result.files, userPermissions: { role: 'public', permissions: {} } }, 200, cors);
  }

  return json({ error: 'Password or token required' }, 400, cors);
}

export default {
  async fetch(request, env) {
    const cors = buildCors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
    if (!env.JWT_SECRET || !env.GITHUB_TOKEN) return json({ error: 'Server misconfigured' }, 500, cors);

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return json({ error: 'Invalid request body' }, 400, cors);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Invalid request body' }, 400, cors);
    }

    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/admin/')) return await handleAdmin(env, cors, url, body);
      return await handleData(request, env, cors, body);
    } catch (error) {
      return json({ error: 'Internal error' }, 500, cors);
    }
  }
};
