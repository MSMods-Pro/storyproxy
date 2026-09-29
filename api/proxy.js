export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    
    // पाथ को बिल्कुल सुरक्षित तरीके से क्लीन करना
    let cleanPath = url.pathname.replace(/^\/api\/proxy/, '');
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    if (cleanPath === '//') cleanPath = '/';

    // ओरिजिनल सर्वर को ही टारगेट करना है
    const targetUrl = `https://api.storytv.asia${cleanPath}${url.search}`;

    const method = req.method;
    const headers = {};
    
    // 1. ऑथेंटिकेशन और ओरिजिनल हेडर्स को सुरक्षित रखना (ताकि Unauthorized ना आए)
    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      // Vercel और Fetch के डिफ़ॉल्ट हेडर्स को हटाना ताकि सर्वर ब्लॉक न करे
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

    // 2. अगर रिस्पॉन्स JSON है, तभी उसे मॉडिफाई करें
    if (contentType.includes('application/json')) {
      try {
        // Buffer से स्ट्रिंग में बदलकर JSON पार्स करना
        let json = JSON.parse(buffer.toString('utf8'));

        // @Rzmod वाले वर्किंग डेटा के हिसाब से सब्सक्रिप्शन इंजेक्ट करना
        if (json.data && typeof json.data === 'object') {
          if ('subStat' in json.data) json.data.subStat = "2";
          if ('plan' in json.data) json.data.plan = "Mod by @MSModsPro";
          if ('cta' in json.data) json.data.cta = "VIP Active";
          if ('valdTxt' in json.data) json.data.valdTxt = "Valid till: 15th December, 2030";
          if ('pvend' in json.data) json.data.pvend = "JUSPAY";
          if ('mdActv' in json.data) json.data.mdActv = false; 
          
          json.data.has_premium = true;
          json.data.is_vip = true;
        }

        if (json.user && typeof json.user === 'object') {
          json.user.has_premium = true;
          json.user.is_vip = true;
        }

        // 3. सेफ और फास्ट रिकर्सिव अनलॉकर (बिना क्रैश के हर ताला खोलने के लिए)
        const unlockEverything = (obj) => {
          if (obj && typeof obj === 'object') {
            
            // सीधा लॉकिंग फ्लैग्स को टारगेट करना
            if ('is_locked' in obj) obj.is_locked = false;
            if ('locked' in obj) obj.locked = false;
            if ('is_premium' in obj) obj.is_premium = true;
            if ('is_vip' in obj) obj.is_vip = true;

            // एपिसोड्स के लिए स्पेशल अनलॉक
            if (Array.isArray(obj.episodes)) {
              obj.episodes.forEach(ep => {
                if (ep && typeof ep === 'object') {
                  ep.is_locked = false;
                  ep.locked = false;
                  ep.is_free = true;
                  ep.is_premium = true;
                }
              });
            }

            // एरे (Arrays) को सेफली ट्रैवर्स करना
            const arrayKeys = ['content', 'items', 'data', 'list'];
            arrayKeys.forEach(arrKey => {
              if (Array.isArray(obj[arrKey])) {
                obj[arrKey].forEach(item => unlockEverything(item));
              }
            });

            // नेस्टेड ऑब्जेक्ट्स (Nested Objects) को सेफली ट्रैवर्स करना
            Object.keys(obj).forEach(key => {
              if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                unlockEverything(obj[key]);
              }
            });
          }
        };

        unlockEverything(json);

        // 4. मॉडिफाइड JSON को सही हेडर्स के साथ भेजना (Something went wrong से बचने के लिए)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(JSON.stringify(json));

      } catch (err) {
        // अगर पार्सिंग में कोई दिक्कत हुई (जैसे खाली रिस्पॉन्स), तो ओरिजिनल रिस्पॉन्स पास कर दें
      }
    }

    // 5. जो JSON नहीं है (या पार्स नहीं हुआ), उसके ओरिजिनल हेडर्स सेट करना
    response.headers.forEach((value, key) => {
      // GZIP और Length को हटाना बहुत जरूरी है, नहीं तो ऐप क्रैश होगा
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
