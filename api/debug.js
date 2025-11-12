export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 모든 요청 정보를 반환
    return res.status(200).json({
        method: req.method,
        headers: req.headers,
        body: req.body,
        bodyType: typeof req.body,
        bodyKeys: req.body ? Object.keys(req.body) : null,
        password: req.body?.password,
        token: req.body?.token,
        path: req.body?.path,
    });
}
