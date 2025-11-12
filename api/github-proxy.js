// 비밀번호 해시 (실제 해시로 교체하세요)
const CORRECT_PASSWORD_HASH = '6e659deaa85842cdabb5c6305fcc40033ba43772ec00d45c2a3c921741a5e377';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'ysw421';
const REPO_NAME = 'private-notes';

export default async function handler(req, res) {
    // CORS 헤더를 가장 먼저 설정
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

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
        const { password, path = '' } = req.body;

        // 비밀번호 검증
        const crypto = await import('crypto');
        const passwordHash = crypto
            .createHash('sha256')
            .update(password)
            .digest('hex');

        if (passwordHash !== CORRECT_PASSWORD_HASH) {
            return res.status(401).json({ error: 'Invalid password' });
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
        return res.status(200).json(data);

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
