require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
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
            // Remove everything except numbers (currency symbols, spaces, "COP", etc)
            const cleaned = rawPrice.replace(/[^0-9]/g, '');
            priceNum = parseInt(cleaned) || 0;
          }

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

    // Stores list
    const stores = Array.from(new Set(all.map(p => p.store)));
    const storeCount = stores.length;

    res.json({ categories, featured: featured.slice(0, 12), storeCount, stores });
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
