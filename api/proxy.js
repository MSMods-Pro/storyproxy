export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    
    let cleanPath = url.pathname.replace(/^\/api\/proxy/, '');
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    const targetUrl = `https://api.storytv.asia${cleanPath}${url.search}`;

    const method = req.method;
    const headers = { ...req.headers };
    
    headers['host'] = 'api.storytv.asia';
    headers['origin'] = 'https://api.storytv.asia';
    headers['referer'] = 'https://api.storytv.asia/';
    
    delete headers['connection'];
    delete headers['content-length'];
    delete headers['accept-encoding'];

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

        // 1. केवल जरूरी सब्सक्रिप्शन और प्रोफाइल फ्लैग्स को सुरक्षित रूप से अपडेट करना
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

        // 2. सेफ रिकर्सिव अनलॉक (जो केवल लॉकिंग फ्लैग्स को टारगेट करे, स्टेटस कोड को नहीं)
        const unlockSafe = (obj) => {
          if (obj && typeof obj === 'object') {
            if ('is_locked' in obj) obj.is_locked = false;
            if ('locked' in obj) obj.locked = false;
            if ('is_premium' in obj) obj.is_premium = false;
            if ('is_vip' in obj) obj.is_vip = true;
            if ('paid' in obj) obj.paid = false;
            if ('free' in obj) obj.free = true;

            if (Array.isArray(obj.episodes)) {
              obj.episodes.forEach(ep => {
                if (ep && typeof ep === 'object') {
                  ep.is_locked = false;
                  ep.locked = false;
                  ep.is_free = true;
                }
              });
            }

            if (Array.isArray(obj.content)) {
              obj.content.forEach(item => unlockSafe(item));
            }
            if (Array.isArray(obj.items)) {
              obj.items.forEach(item => unlockSafe(item));
            }
            if (Array.isArray(obj.data)) {
              obj.data.forEach(item => unlockSafe(item));
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
      } catch (err) {
        // अगर पार्सिंग में कोई दिक्कत हो तो ओरिजिनल भेजें
      }
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
