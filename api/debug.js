export default async function handler(req, res) {
    // CORS 헤더 설정 (github-proxy.js와 동일하게)
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

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
