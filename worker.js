const REPO_OWNER = 'ysw421';
const REPO_NAME = 'private-notes';

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const data = encodedHeader + '.' + encodedPayload;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return data + '.' + encodedSignature;
}

async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = encodedHeader + '.' + encodedPayload;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signature = Uint8Array.from(atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));

  if (!isValid) throw new Error('Invalid signature');

  const payload = JSON.parse(atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/')));

  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token expired');
  }

  return payload;
}

async function getUser(env, username) {
  const userData = await env.USERS_KV.get(`user:${username}`);
  return userData ? JSON.parse(userData) : null;
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
    const username = key.name.replace('user:', '');
    const userData = await env.USERS_KV.get(key.name);
    if (userData) {
      const user = JSON.parse(userData);
      users[username] = {
        role: user.role,
        permissions: user.permissions
      };
    }
  }
  return users;
}

async function getPublicPaths(env) {
  const data = await env.USERS_KV.get('public:paths');
  return data ? JSON.parse(data) : [];
}

async function setPublicPaths(env, paths) {
  await env.USERS_KV.put('public:paths', JSON.stringify(paths));
}

export default {
  async fetch(request, env) {
    const GITHUB_TOKEN = env.GITHUB_TOKEN;
    const JWT_SECRET = env.JWT_SECRET;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith('/admin/users')) {
        const body = request.method !== 'GET' ? await request.json() : {};
        const { token } = body;

        if (!token) {
          return new Response(JSON.stringify({ error: 'Token required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let decoded;
        try {
          decoded = await verifyJWT(token, JWT_SECRET);
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (decoded.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (request.method === 'GET' || (request.method === 'POST' && body.action === 'list')) {
          const users = await listUsers(env);
          return new Response(JSON.stringify({ users }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (request.method === 'POST' && body.action === 'create') {
          const { username, password, role, permissions } = body;

          if (!username || !password || !role) {
            return new Response(JSON.stringify({ error: 'Username, password, and role required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const existingUser = await getUser(env, username);
          if (existingUser) {
            return new Response(JSON.stringify({ error: 'User already exists' }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const passwordHash = await sha256(password);
          await setUser(env, username, {
            passwordHash,
            role,
            permissions: permissions || { basePath: '/', allowed: [], denied: [] }
          });

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (request.method === 'POST' && body.action === 'update') {
          const { username, password, role, permissions } = body;

          if (!username) {
            return new Response(JSON.stringify({ error: 'Username required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const existingUser = await getUser(env, username);
          if (!existingUser) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const updatedUser = { ...existingUser };
          if (password) {
            updatedUser.passwordHash = await sha256(password);
          }
          if (role) {
            updatedUser.role = role;
          }
          if (permissions) {
            updatedUser.permissions = permissions;
          }

          await setUser(env, username, updatedUser);

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (request.method === 'POST' && body.action === 'delete') {
          const { username } = body;

          if (!username) {
            return new Response(JSON.stringify({ error: 'Username required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          await deleteUser(env, username);

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (url.pathname.startsWith('/admin/public')) {
        const body = await request.json();
        const { token } = body;

        if (!token) {
          return new Response(JSON.stringify({ error: 'Token required' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let decoded;
        try {
          decoded = await verifyJWT(token, JWT_SECRET);
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (decoded.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (body.action === 'list') {
          const publicPaths = await getPublicPaths(env);
          return new Response(JSON.stringify({ publicPaths }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (body.action === 'set') {
          const { paths } = body;
          await setPublicPaths(env, paths || []);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json();
      const { username, password, token, path = '' } = body;

      if (username && password && !token) {
        const user = await getUser(env, username);
        if (!user) {
          return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const passwordHash = await sha256(password);
        if (passwordHash !== user.passwordHash) {
          return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const payload = {
          authenticated: true,
          username,
          role: user.role,
          permissions: user.permissions,
          timestamp: Date.now(),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        };

        const authToken = await signJWT(payload, JWT_SECRET);
        return new Response(JSON.stringify({ token: authToken }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      else if (token) {
        let decoded;
        try {
          decoded = await verifyJWT(token, JWT_SECRET);
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const username = decoded.username;
        const user = await getUser(env, username);

        if (!user) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { role, permissions } = user;

        if (role !== 'admin') {
          const normalizedPath = '/' + path;
          const basePath = permissions.basePath;

          if (!normalizedPath.startsWith(basePath)) {
            return new Response(JSON.stringify({ error: 'Access denied to this path' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const isBasePath = normalizedPath === basePath || normalizedPath === basePath.replace(/\/$/, '');

          const isExplicitlyAllowed = permissions.allowed && permissions.allowed.some(allowedPath => {
            const normalizedAllowed = allowedPath.startsWith('/') ? allowedPath : '/' + allowedPath;
            return normalizedPath.startsWith(normalizedAllowed);
          });

          if (!isBasePath && !isExplicitlyAllowed) {
            const isDenied = permissions.denied && permissions.denied.some(deniedPath => {
              const normalizedDenied = deniedPath.startsWith('/') ? deniedPath : '/' + deniedPath;
              return normalizedPath.startsWith(normalizedDenied);
            });

            if (isDenied) {
              return new Response(JSON.stringify({ error: 'Access denied to this path' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
        }

        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Private-Notes-Viewer'
          }
        });

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();

        const responseData = {
          files: data,
          userPermissions: { role, permissions }
        };

        return new Response(JSON.stringify(responseData), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      else {
        const publicPaths = await getPublicPaths(env);
        const normalizedPath = '/' + path;

        const isPublic = publicPaths.some(publicPath => {
          const normalizedPublic = publicPath.startsWith('/') ? publicPath : '/' + publicPath;
          return normalizedPath.startsWith(normalizedPublic);
        });

        if (isPublic) {
          const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
          const response = await fetch(url, {
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Private-Notes-Viewer'
            }
          });

          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
          }

          const data = await response.json();

          const responseData = {
            files: data,
            userPermissions: { role: 'public', permissions: {} }
          };

          return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ error: 'Password or token required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
