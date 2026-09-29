export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    
    // राउटिंग और पाथ को बिल्कुल क्लीन करना ताकि कोई एरर न आए
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

        // 1. यूजर प्रोफाइल, सब्सक्रिप्शन और स्टेट को पूरी तरह से VIP और Active करना
        if (json.data && typeof json.data === 'object') {
          if ('subStat' in json.data) json.data.subStat = "1";
          if ('plan' in json.data) json.data.plan = "Lifetime VIP Active";
          if ('cta' in json.data) json.data.cta = "Subscribed";
          if ('valdTxt' in json.data) json.data.valdTxt = "All Episodes Unlocked";
          if ('mdActv' in json.data) json.data.mdActv = true;
          json.data.has_premium = true;
          json.data.is_vip = true;
          json.data.locked = false;
          json.data.is_locked = false;
        }

        if (json.user) {
          json.user.has_premium = true;
          json.user.is_vip = true;
        }

        // 2. 100% फुल-प्रूफ एडवांस रिकर्सिव अनलॉक स्कैनर (Advanced Deep Unlocker)
        const unlockEverything = (obj) => {
          if (obj && typeof obj === 'object') {
            // हर संभव लॉकिंग और मोनेटाइजेशन फ्लैग को टारगेट करना
            for (let key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const lowerKey = key.toLowerCase();
                
                // अगर की में lock, locked, premium, vip, paid, free आदि से जुड़ा कुछ भी है
                if (lowerKey.includes('lock') || lowerKey.includes('is_locked')) {
                  obj[key] = false;
                }
                if (lowerKey.includes('premium') || lowerKey.includes('vip')) {
                  if (typeof obj[key] === 'boolean') obj[key] = true;
                  if (typeof obj[key] === 'string') obj[key] = "1";
                }
                if (lowerKey.includes('paid')) {
                  obj[key] = false;
                }
                if (lowerKey.includes('free')) {
                  obj[key] = true;
                }
                if (lowerKey.includes('price') || lowerKey.includes('coin') || lowerKey.includes('amount')) {
                  if (typeof obj[key] === 'number') obj[key] = 0;
                  if (typeof obj[key] === 'string') obj[key] = "0";
                }
                if (lowerKey.includes('status') || lowerKey.includes('stat')) {
                  if (obj[key] === "0" || obj[key] === 0) obj[key] = "1";
                }
              }
            }

            // स्पेसिफिक एपिसोड्स एरे को जबरन अनलॉक करना
            if (Array.isArray(obj.episodes)) {
              obj.episodes.forEach(ep => {
                if (ep && typeof ep === 'object') {
                  ep.is_locked = false;
                  ep.locked = false;
                  ep.is_free = true;
                  ep.is_premium = false;
                  ep.paid = false;
                  if ('coin' in ep) ep.coin = 0;
                  if ('price' in ep) ep.price = 0;
                }
              });
            }

            // सभी प्रकार की लिस्ट, कंटेंट और डेटा एरेज़ को स्कैन करना
            if (Array.isArray(obj.content)) {
              obj.content.forEach(item => unlockEverything(item));
            }
            if (Array.isArray(obj.items)) {
              obj.items.forEach(item => unlockEverything(item));
            }
            if (Array.isArray(obj.data)) {
              obj.data.forEach(item => unlockEverything(item));
            }
            if (Array.isArray(obj.list)) {
              obj.list.forEach(item => unlockEverything(item));
            }

            // नेस्टेड ऑब्जेक्ट्स के लिए रिकर्सिव कॉल
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
      } catch (err) {
        // एरर आने पर भी ऐप क्रैश न हो, ओरिजिनल पास कर दो
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
