import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'ysw421';
const REPO_NAME = 'private-notes';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

let users = {};
try {
    const usersPath = join(process.cwd(), 'api', 'users.json');
    users = JSON.parse(readFileSync(usersPath, 'utf8'));
} catch (error) {
    console.error('Failed to load users.json:', error);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { username, password, token, path = '' } = req.body;

        if (username && password && !token) {
            const user = users[username];
            if (!user) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const crypto = await import('crypto');
            const passwordHash = crypto
                .createHash('sha256')
                .update(password)
                .digest('hex');

            if (passwordHash !== user.passwordHash) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            const authToken = jwt.sign(
                {
                    authenticated: true,
                    username: username,
                    role: user.role,
                    permissions: user.permissions,
                    timestamp: Date.now()
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.status(200).json({ token: authToken });
        }

        else if (token) {
            let decoded;
            try {
                decoded = jwt.verify(token, JWT_SECRET);
            } catch (error) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            const { role, permissions } = decoded;

            if (role !== 'admin') {
                const normalizedPath = '/' + path;
                const basePath = permissions.basePath;

                if (!normalizedPath.startsWith(basePath)) {
                    return res.status(403).json({ error: 'Access denied to this path' });
                }

                const isDenied = permissions.denied.some(deniedPath =>
                    normalizedPath.startsWith(deniedPath)
                );

                if (isDenied) {
                    return res.status(403).json({ error: 'Access denied to this path' });
                }

                if (permissions.allowed.length > 0) {
                    const isAllowed = permissions.allowed.some(allowedPath =>
                        normalizedPath.startsWith(allowedPath)
                    );

                    if (!isAllowed && normalizedPath !== basePath) {
                        return res.status(403).json({ error: 'Access denied to this path' });
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
                const error = await response.text();
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const data = await response.json();
            return res.status(200).json(data);
        }

        else {
            return res.status(400).json({ error: 'Password or token required' });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
