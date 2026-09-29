export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    
    let cleanPath = url.pathname.replace(/^\/api\/proxy/, '');
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    if (cleanPath === '//') cleanPath = '/';

    const targetUrl = `https://api.storytv.asia${cleanPath}${url.search}`;

    const method = req.method;
    const headers = {};
    
    // सभी ओरिजिनल हेडर्स को सुरक्षित रूप से पास करें
    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      if (!['host', 'content-length', 'connection', 'accept-encoding'].includes(lowerKey)) {
        headers[key] = value;
      }
    }
    
    headers['host'] = 'api.storytv.asia';
    headers['origin'] = 'https://api.storytv.asia';
    headers['referer'] = 'https://api.storytv.asia/';

    let body = undefined;
    if (method !== 'GET' && method !== 'HEAD' && req.body) {
      body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (contentType.includes('application/json')) {
      try {
        let json = JSON.parse(buffer.toString('utf8'));

        if (json.data && typeof json.data === 'object') {
          if ('subStat' in json.data) json.data.subStat = "1";
          if ('plan' in json.data) json.data.plan = "Lifetime VIP Active";
          if ('mdActv' in json.data) json.data.mdActv = true;
          json.data.has_premium = true;
          json.data.is_vip = true;
        }

        if (json.user) {
          json.user.has_premium = true;
          json.user.is_vip = true;
        }

        const unlockSafe = (obj) => {
          if (obj && typeof obj === 'object') {
            if ('is_locked' in obj) obj.is_locked = false;
            if ('locked' in obj) obj.locked = false;
            if ('is_premium' in obj) obj.is_premium = false;
            if ('is_vip' in obj) obj.is_vip = true;

            if (Array.isArray(obj.episodes)) {
              obj.episodes.forEach(ep => {
                if (ep && typeof ep === 'object') {
                  ep.is_locked = false;
                  ep.locked = false;
                  ep.is_free = true;
                }
              });
            }

            Object.values(obj).forEach(val => {
              if (typeof val === 'object' && val !== null) {
                unlockSafe(val);
              }
            });
          }
        };

        unlockSafe(json);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(JSON.stringify(json));
      } catch (err) {}
    }

    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status).send(buffer);

  } catch (error) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Proxy Error: ' + error.message });
  }
}
