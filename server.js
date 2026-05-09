require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// Import Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin
let serviceAccount;

try {
  serviceAccount = require('./techfind-72d4a-firebase-adminsdk-fbsvc-51b821adb7.json');
} catch (e) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    console.error("Firebase Service Account not found.");
  }
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Middleware para verificar tokens de Firebase
const verifyFirebaseToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  if (!idToken) {
    return res.status(401).send('No se proporcionó un token.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).send('Token inválido.');
  }
};

app.use(express.json());

// Route the site root to the dashboard entry point so relative assets keep working.
app.get('/', (req, res) => {
  res.redirect('/dashboard/');
});

// --- AI / Phi-4 proxy endpoints ---
const AZURE_ENDPOINT = process.env.AZURE_PHI4_ENDPOINT;
const AZURE_DEPLOYMENT = process.env.AZURE_PHI4_DEPLOYMENT;
const AZURE_API_KEY = process.env.AZURE_PHI4_API_KEY;

async function callPhi(messages, maxTokens = 800, temperature = 0.2) {
  if (!AZURE_ENDPOINT || !AZURE_DEPLOYMENT || !AZURE_API_KEY) throw new Error('Azure Phi-4 not configured');

  const base = AZURE_ENDPOINT.replace(/\/$/, '');
  const usesOpenAiV1 = /\/openai\/v1$/i.test(base) || /\/openai\/v1\//i.test(base);
  const tryUrls = [];

  if (usesOpenAiV1) {
    // Azure AI Foundry / OpenAI v1 style endpoint
    tryUrls.push({
      url: `${base.replace(/\/$/, '')}/chat/completions`,
      body: { model: AZURE_DEPLOYMENT, messages, max_tokens: maxTokens, temperature }
    });
  } else {
    // Classic Azure OpenAI deployments path
    tryUrls.push({
      url: `${base}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=2024-06-01-preview`,
      body: { messages, max_tokens: maxTokens, temperature }
    });

    // Newer Azure AI style fallback: /openai/v1/chat/completions with model in body
    tryUrls.push({
      url: `${base}/openai/v1/chat/completions`,
      body: { model: AZURE_DEPLOYMENT, messages, max_tokens: maxTokens, temperature }
    });
  }

  let lastErr = null;
  for (const attempt of tryUrls) {
    try {
      const resp = await fetch(attempt.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': AZURE_API_KEY },
        body: JSON.stringify(attempt.body)
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error('Phi call URL:', attempt.url);
        console.error('Phi response status:', resp.status, resp.statusText);
        console.error('Phi response body:', t);
        lastErr = new Error(`Phi-4 request failed ${resp.status}: ${t}`);
        // try next
        continue;
      }
      return resp.json();
    } catch (err) {
      console.error('Phi call attempt failed for', attempt.url, err.message || err);
      lastErr = err;
    }
  }
  throw lastErr || new Error('Phi-4 call failed (unknown)');
}

function extractJsonFromPhi(content) {
  if (typeof content !== 'string') return content;
  let text = content.trim();
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/i, '');
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

// Endpoint: generate search JSON from user query
app.post('/api/ai/phi/search-json', async (req, res) => {
  const { query } = req.body || {};
  if (!query || typeof query !== 'string') return res.status(400).json({ error: 'query required' });

const system = `You are a product search extractor. Output ONLY valid JSON:
{"raw_query":"string","intent":{"brand":null,"category":null,"keywords":[],"offers_only":false,"price_min":null,"price_max":null,"sort":"relevance"},"size":5,"meta":{"confidence":0.9,"source":"phi-4"}}

Rules:
- Currency: COP. Convert text prices to integers.
- Always respond in Spanish. Keywords must be in Spanish.
- category MUST be one of: audio, celulares, computadores, consolas, impresoras, otros, pantallas, tablets. If none fits, use null.
- Correct typos in brand names (e.g. "samsng" -> "Samsung").
- Vague intent queries (working, gaming without specific product) → set category but leave keywords: []
- Set offers_only: true ONLY when user explicitly says "oferta", "descuento", "promocion", "rebaja". Words like "economico", "barato", "precio bajo" should NOT set offers_only: true, instead use sort: "price_asc".
- "laptops","portatiles","notebook" -> category "computadores"
- "smartphones","telefonos" -> category "celulares"
- "audifonos","parlantes","auriculares" -> category "audio"
- "televisor","tv","monitor" -> category "pantallas"
- "smartwatch","reloj inteligente" -> category "otros"
- No extra text.`;
  const user = `User query: "${query.replace(/\"/g, '\\"')}"`;

  try {
    const reply = await callPhi([{ role: 'system', content: system }, { role: 'user', content: user }], 250, 0.2);
    const content = reply.choices?.[0]?.message?.content || reply.choices?.[0]?.text;
    let parsed;
    try {
      parsed = JSON.parse(extractJsonFromPhi(content));
    } catch (e) {
      return res.status(500).json({ error: 'AI returned invalid JSON', raw: content });
    }
    // sanitize
    parsed.size = Math.max(1, Math.min(8, parseInt(parsed.size) || 5));
    parsed.raw_query = parsed.raw_query || query;
    parsed.meta = parsed.meta || {};
    parsed.meta.confidence = typeof parsed.meta.confidence === 'number' ? parsed.meta.confidence : 0.5;
    parsed.meta.source = 'phi-4';
    parsed.intent = parsed.intent || {};
    parsed.intent.brand = parsed.intent.brand ?? null;
    parsed.intent.category = parsed.intent.category ?? null;
    parsed.intent.keywords = Array.isArray(parsed.intent.keywords) ? parsed.intent.keywords : [];
    parsed.intent.offers_only = Boolean(parsed.intent.offers_only);
    parsed.intent.price_min = Number.isFinite(parsed.intent.price_min) ? parsed.intent.price_min : null;
    parsed.intent.price_max = Number.isFinite(parsed.intent.price_max) ? parsed.intent.price_max : null;
    parsed.intent.sort = parsed.intent.sort || 'relevance';
    return res.json(parsed);
  } catch (err) {
    console.error('Phi search-json error:', err.message || err);
    return res.status(500).json({ error: 'Phi-4 call failed', detail: String(err) });
  }
});

// Endpoint: search products by intent filters (backend optimized, no AI)
app.post('/api/products/search', async (req, res) => {
  try {
    const { intent, size } = req.body || {};
    if (!intent || typeof intent !== 'object') return res.status(400).json({ error: 'intent object required' });

    const limit = Math.max(1, Math.min(8, parseInt(size) || 5));
    let results = await getCachedProducts();

    if (intent.brand) {
      const brand = String(intent.brand).toLowerCase();
      results = results.filter(p => String((p.brand || '').toLowerCase()).includes(brand));
    }

    if (intent.category) {
      const category = String(intent.category).toLowerCase();
      results = results.filter(p => String((p.category || '').toLowerCase()).includes(category));
    }

    if (intent.price_min && Number.isFinite(intent.price_min)) {
      results = results.filter(p => p.price >= intent.price_min);
    }

    if (intent.price_max && Number.isFinite(intent.price_max)) {
      results = results.filter(p => p.price <= intent.price_max);
    }

    if (intent.offers_only === true) {
      const withDiscount = results.filter(p =>
        (p.discountPercentage || 0) > 0 ||
        p.discount ||
        (p.originalPrice && p.originalPrice > p.price)
      );
      // If there are discounted products use them, otherwise keep all results.
      if (withDiscount.length > 0) results = withDiscount;
      else results.sort((a, b) => a.price - b.price);
    }

    if (Array.isArray(intent.keywords) && intent.keywords.length > 0) {
      const keywords = intent.keywords
        .map(k => String(k).toLowerCase())
        .filter(k => k.length > 3)
        .filter(k => !['baratas', 'barato', 'economico', 'economica', 'buenos', 'bueno', 'potente', 'potentes'].includes(k));

      if (keywords.length > 0) {
        const filtered = results.filter(p => {
          const haystack = String([p.name, p.brand, p.category].filter(Boolean).join(' ')).toLowerCase();
          return keywords.some(k => haystack.includes(k));
        });
        // Apply keyword filter only if it still returns products.
        if (filtered.length > 0) results = filtered;
      }
    }

    const sort = String(intent.sort || 'relevance').toLowerCase();
    if (sort === 'price_asc') results.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') results.sort((a, b) => b.price - a.price);
    else if (sort === 'discount_desc') results.sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0));
    else if (sort === 'rating_desc') results.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return res.json({
      products: results.slice(0, limit),
      total: results.length,
      size: limit
    });
  } catch (err) {
    console.error('Search error:', err.message || err);
    return res.status(500).json({ error: 'Search failed', detail: String(err) });
  }
});

app.use(express.static('public'));

let globalProductCache = [];
let isCacheUpdating = false;

async function updateProductCache() {
  if (isCacheUpdating) return;
  isCacheUpdating = true;
  console.log('⏳ Updating product cache in background...');
  try {
    const data = await fetchAllProducts();
    if (data && data.length > 0) {
      globalProductCache = data;
      console.log(`✅ Product cache updated. ${data.length} items loaded.`);
    }
  } catch (err) {
    console.error('Failed to update cache:', err);
  } finally {
    isCacheUpdating = false;
  }
}

async function getCachedProducts() {
  if (globalProductCache.length === 0) {
    await updateProductCache();
  }
  return globalProductCache;
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
  updateProductCache();
  setInterval(updateProductCache, 30 * 60 * 1000); // 30 minutes
}).catch(err => console.error('MongoDB connection error:', err));

// ── Helper: Infer Subcategory from Title ──
function inferSubcategory(cat, name) {
  const n = (name || '').toLowerCase();
  const c = (cat || '').toLowerCase();
  
  if (c === 'computadores') {
    if (n.includes('portatil') || n.includes('portátil') || n.includes('laptop') || n.includes('macbook')) return 'Portátiles';
    if (n.includes('monitor') || n.includes('pantalla')) return 'Monitores';
    if (n.includes('mouse') || n.includes('teclado') || n.includes('diadema') || n.includes('audifonos')) return 'Periféricos';
    if (n.includes('all in one') || n.includes('aio') || n.includes('todo en uno')) return 'All in One';
    if (n.includes('impresora')) return 'Impresoras';
    if (n.includes('escritorio') || n.includes('pc') || n.includes('torre')) return 'De Escritorio';
    return 'Otros Computadores';
  }
  if (c === 'celulares') {
    if (n.includes('reloj') || n.includes('smartwatch') || n.includes('band') || n.includes('apple watch')) return 'Smartwatches';
    if (n.includes('audifonos') || n.includes('auriculares') || n.includes('airpods') || n.includes('buds')) return 'Audio';
    if (n.includes('funda') || n.includes('carcasa') || n.includes('cargador') || n.includes('cable') || n.includes('estuche')) return 'Accesorios';
    return 'Smartphones';
  }
  if (c === 'audio') {
    if (n.includes('audifono') || n.includes('auricular') || n.includes('diadema') || n.includes('airpods') || n.includes('buds')) return 'Audífonos';
    if (n.includes('parlante') || n.includes('bocina') || n.includes('soundbar') || n.includes('barra')) return 'Parlantes';
    return 'Equipos de sonido';
  }
  if (c === 'tablets') {
    if (n.includes('ipad')) return 'iPads';
    if (n.includes('galaxy tab')) return 'Galaxy Tabs';
    if (n.includes('funda') || n.includes('teclado') || n.includes('pencil') || n.includes('lápiz')) return 'Accesorios';
    return 'Otras Tablets';
  }
  if (c === 'pantallas' || c === 'televisores' || c === 'tv') {
    if (n.includes('soporte') || n.includes('base') || n.includes('cable')) return 'Accesorios TV';
    if (n.includes('oled') || n.includes('qled')) return 'Premium TV';
    return 'Televisores';
  }
  if (c === 'consolas' || c === 'videojuegos') {
    if (n.includes('ps5') || n.includes('playstation 5') || n.includes('xbox') || n.includes('nintendo switch') || n.includes('consola')) return 'Consolas';
    if (n.includes('control') || n.includes('mando') || n.includes('joy-con')) return 'Controles';
    if (n.includes('juego') || n.includes('game')) return 'Juegos';
    return 'Accesorios Gaming';
  }
  return 'General';
}

// ── Helper: fetch & normalize all products from exito + alkosto ──
async function fetchAllProducts() {
  try {
    const admin = mongoose.connection.db.admin();
    const { databases } = await admin.listDatabases();

    const dbNames = databases
      .map(db => db.name)
      .filter(name => !['admin', 'config', 'local'].includes(name));

    const allProducts = [];

    for (const dbName of dbNames) {
      const db = mongoose.connection.client.db(dbName);
      const collections = await db.listCollections().toArray();

      for (const col of collections) {
        const docs = await db.collection(col.name).find({}).toArray();
        for (const doc of docs) {
          if (!doc.nombre || !doc.tienda || !doc.enlace) continue;

          // Robust price parsing: Check multiple possible fields
          const rawPrice = doc.precio_promocion || doc.promocion || doc.precio;
          let priceNum = 0;

          if (typeof rawPrice === 'number') {
            priceNum = rawPrice;
          } else if (typeof rawPrice === 'string') {
            // Take only the first sequence of numbers (to avoid SKU concatenation)
            const match = rawPrice.replace(/[.,]/g, '').match(/\d+/);
            priceNum = match ? parseInt(match[0]) : 0;
          }

          // Safety cap: ignore prices above 100 million as they are likely errors
          if (priceNum > 100000000) priceNum = 0;

          // Fallback check: if doc.precio was "Precio no disponible", 
          // we might have skipped it if we only checked doc.precio.
          if (priceNum === 0 && doc.precio_original) {
            // Sometimes only original is there? Unlikely but let's be safe
          }

          if (priceNum > 0) {
            let imageUrl = doc.imagen || null;
            if (imageUrl && typeof imageUrl === 'string') {
              imageUrl = imageUrl.trim().replace(/ /g, '%20').replace('/../', '/');
            }

            // Normalize store name (remove accents for filtering consistency)
            let storeName = (doc.tienda || 'Otro').trim();
            if (storeName === 'Éxito') storeName = 'Exito';

            // Proxy images for stores with hotlink protection (Compulago/Computerworking)
            if (imageUrl && (imageUrl.includes('compulago.com') || imageUrl.includes('computerworking.com'))) {
              imageUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
            }

            // DISCOUNT LOGIC
            let discount = doc.descuento || null;
            let originalPrice = doc.precio_original || doc.precio_antes || null;

            if (originalPrice && typeof originalPrice === 'string') {
               const cleanedOrig = originalPrice.replace(/[^0-9]/g, '');
               originalPrice = parseInt(cleanedOrig) || null;
            }

            if (!originalPrice && discount && typeof discount === 'string' && discount.includes('%')) {
              const pct = parseInt(discount.replace(/[^0-9]/g, ''));
              if (pct > 0 && pct < 100) {
                originalPrice = Math.round(priceNum / (1 - pct / 100));
              }
            }

            const finalCategory = doc.categoria || col.name;

            allProducts.push({
              _id: doc._id.toString(),
              name: doc.nombre,
              price: priceNum,
              originalPrice: originalPrice,
              discount: discount,
              brand: doc.marca || 'Genérico',
              store: storeName,
              url: doc.enlace_normalized || doc.enlace,
              category: finalCategory,
              subcategory: inferSubcategory(finalCategory, doc.nombre),
              image: imageUrl,
              rating: doc.calificacion || doc.rating || doc.estrellas || null
            });
          }
        }
      }
    }
    return allProducts;
  } catch (err) {
    console.error('Error in fetchAllProducts:', err);
    return [];
  }
}

// ── GET /api/summary — lobby data ──
app.get('/api/summary', async (req, res) => {
  try {
    const all = await getCachedProducts();

    const CAT_ORDER = ['computadores', 'celulares', 'tablets', 'pantallas', 'audio', 'consolas', 'impresoras', 'otros'];

    // Build category map
    const catMap = {};
    all.forEach(p => {
      const cat = p.category || 'otros';
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(p);
    });

    // Category summary cards
    const categories = Object.entries(catMap)
      .sort(([a], [b]) => {
        const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
      })
      .map(([name, products]) => ({
        name,
        count: products.length,
        // Up to 4 sample products with images (prefer ones with images)
        samples: [...products]
          .sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0))
          .slice(0, 4)
          .map(({ _id, name, price, store, url, image }) => ({ _id, name, price, store, url, image }))
      }));

    // Featured products: 2 from each of top categories (with images preferred)
    const featured = [];
    const featuredCats = ['computadores', 'celulares', 'tablets', 'pantallas', 'audio', 'consolas'];
    featuredCats.forEach(cat => {
      const items = (catMap[cat] || [])
        .sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0))
        .slice(0, 2);
      featured.push(...items);
    });

    // Stores list with counts and share of total products
    const storeMap = {};
    all.forEach(p => {
      const key = p.store || 'Otro';
      if (!storeMap[key]) storeMap[key] = 0;
      storeMap[key] += 1;
    });

    const totalProducts = all.length || 1;
    const stores = Object.entries(storeMap)
      .map(([name, count]) => ({
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        count,
        percent: Math.round((count / totalProducts) * 1000) / 10
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const storeCount = stores.length;

    res.json({ categories, featured: featured.slice(0, 12), storeCount, stores, totalProducts });
  } catch (err) {
    console.error('Error building summary:', err);
    res.status(500).json({ error: 'Failed to build summary' });
  }
});

// ── GET /api/products — full product list with optional filters ──
app.get('/api/products', async (req, res) => {
  try {
    const { category, store } = req.query;
    let all = await getCachedProducts();

    if (category) all = all.filter(p => p.category === category);
    if (store) all = all.filter(p => p.store.toLowerCase() === store.toLowerCase());

    res.json(all);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Alias for backwards compatibility
app.get('/products', (req, res) => res.redirect('/api/products'));

// ── GET /api/refresh-cache ──
app.get('/api/refresh-cache', async (req, res) => {
  try {
    await updateProductCache();
    res.json({ success: true, message: 'Caché actualizada manualmente', productCount: globalProductCache.length });
  } catch (err) {
    console.error('Error refreshing cache:', err);
    res.status(500).json({ error: 'Failed to refresh cache' });
  }
});

// ── GET /databases ──
app.get('/databases', async (req, res) => {
  try {
    const admin = mongoose.connection.db.admin();
    const databases = await admin.listDatabases();
    res.json(databases.databases);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list databases' });
  }
});

// ── Image Proxy (to bypass Hotlink protection 403) ──
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).send('No URL provided');

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    // Convert response body to buffer and send
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err) {
    console.error('Proxy Error:', err.message);
    res.status(500).send('Error proxying image');
  }
});

// Ruta protegida de ejemplo
app.get('/protected', verifyFirebaseToken, (req, res) => {
  res.send(`Bienvenido, ${req.user.email}`);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
