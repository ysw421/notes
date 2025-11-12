// Vercel Serverless Function
const CORRECT_PASSWORD_HASH = 'a1db5646b6fe049a2509691b3597f736e89fccd6bedb25d8e49e0b54a6d44604'; // 나중에 설정
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Vercel 환경변수
const REPO_OWNER = 'ysw421';
const REPO_NAME = 'private-notes';

export default async function handler(req, res) {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password, path = '' } = req.body;

    // 비밀번호 검증
    const passwordHash = await hashPassword(password);
    if (passwordHash !== CORRECT_PASSWORD_HASH) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    try {
        // GitHub API 호출
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// 비밀번호 해시 함수 (SHA-256)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
