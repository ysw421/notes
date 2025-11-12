import jwt from 'jsonwebtoken';

// Fixed: 2025-11-12 - API logic with proper if-else-if structure
// 비밀번호 해시
const CORRECT_PASSWORD_HASH = '6e659deaa85842cdabb5c6305fcc40033ba43772ec00d45c2a3c921741a5e377';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'ysw421';
const REPO_NAME = 'private-notes';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// API Version: 2025-11-12-v3
export default async function handler(req, res) {
    // CORS 헤더를 가장 먼저 설정
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );
    res.setHeader('X-API-Version', '2025-11-12-v3');

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // POST만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 버전 체크 - Vercel이 최신 코드를 사용하는지 확인
        if (req.body?.version_check === true) {
            return res.status(200).json({
                version: '2025-11-12-v2',
                timestamp: new Date().toISOString(),
                body: req.body
            });
        }

        // 디버깅: req.body 내용 확인
        console.log('Request body:', req.body);
        console.log('Body type:', typeof req.body);

        const { password, token, path = '' } = req.body;

        console.log('Parsed - password:', password, 'token:', token, 'path:', path);

        // 로그인 요청 (비밀번호로 토큰 발급)
        if (password && !token) {
            console.log('Login branch - generating token');
            const crypto = await import('crypto');
            const passwordHash = crypto
                .createHash('sha256')
                .update(password)
                .digest('hex');

            console.log('Password hash:', passwordHash);
            console.log('Expected hash:', CORRECT_PASSWORD_HASH);

            if (passwordHash !== CORRECT_PASSWORD_HASH) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            // JWT 토큰 생성 (24시간 유효)
            const authToken = jwt.sign(
                { authenticated: true, timestamp: Date.now() },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            console.log('Token generated successfully');
            return res.status(200).json({ token: authToken });
        }

        // 데이터 요청 (토큰 검증)
        else if (token) {
            console.log('Data request branch - token provided');
            try {
                // JWT 토큰 검증
                jwt.verify(token, JWT_SECRET);
            } catch (error) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            // GitHub API 호출
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
            console.log('Returning GitHub data');
            return res.status(200).json(data);
        }

        else {
            console.log('No password or token provided');
            return res.status(400).json({ error: 'Password or token required' });
        }

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
