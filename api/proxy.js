export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const targetUrl = `https://api.storytv.asia${url.pathname === '/api/proxy' ? '' : url.pathname}${url.search}`;

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

        // 1. प्रोफाइल और सब्सक्रिप्शन स्टेटस को एक्टिव करना
        if (json.data && typeof json.data === 'object') {
          if ('subStat' in json.data) json.data.subStat = "1";
          if ('plan' in json.data) json.data.plan = "Lifetime VIP Active";
          if ('cta' in json.data) json.data.cta = "Subscribed";
          if ('valdTxt' in json.data) json.data.valdTxt = "All Episodes Unlocked";
          if ('mdActv' in json.data) json.data.mdActv = true;
          json.data.has_premium = true;
          json.data.is_vip = true;
        }

        if (json.user) {
          json.user.has_premium = true;
          json.user.is_vip = true;
        }

        // 2. रिकर्सिवली सभी शोज़, एपिसोड्स और लॉक्स को हमेशा के लिए खोलना
        const unlockEverything = (obj) => {
          if (obj && typeof obj === 'object') {
            if ('is_locked' in obj) obj.is_locked = false;
            if ('locked' in obj) obj.locked = false;
            if ('is_premium' in obj) obj.is_premium = false;
            if ('is_vip' in obj) obj.is_vip = true;
            if ('paid' in obj) obj.paid = false;
            if ('free' in obj) obj.free = true;
            if ('monetization_type' in obj) obj.monetization_type = 'free';
            if ('access_type' in obj) obj.access_type = 'free';

            if (Array.isArray(obj.episodes)) {
              obj.episodes.forEach(ep => {
                if (ep && typeof ep === 'object') {
                  ep.is_locked = false;
                  ep.locked = false;
                  ep.is_free = true;
                  ep.is_premium = false;
                }
              });
            }

            if (Array.isArray(obj.content)) {
              obj.content.forEach(item => unlockEverything(item));
            }
            if (Array.isArray(obj.items)) {
              obj.items.forEach(item => unlockEverything(item));
            }
            if (Array.isArray(obj.data)) {
              obj.data.forEach(item => unlockEverything(item));
            }

            Object.values(obj).forEach(val => {
              if (typeof val === 'object' && val !== null) {
                unlockEverything(val);
              }
            });
          }
        };

        unlockEverything(json);

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
