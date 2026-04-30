require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB connection error:', err));

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

            allProducts.push({
              _id: doc._id.toString(),
              name: doc.nombre,
              price: priceNum,
              originalPrice: originalPrice,
              discount: discount,
              brand: doc.marca || 'Genérico',
              store: storeName,
              url: doc.enlace_normalized || doc.enlace,
              category: doc.categoria || col.name,
              image: imageUrl
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
    const all = await fetchAllProducts();

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

    // Store count
    const storeCount = new Set(all.map(p => p.store)).size;

    res.json({ categories, featured: featured.slice(0, 12), storeCount });
  } catch (err) {
    console.error('Error building summary:', err);
    res.status(500).json({ error: 'Failed to build summary' });
  }
});

// ── GET /api/products — full product list with optional filters ──
app.get('/api/products', async (req, res) => {
  try {
    const { category, store } = req.query;
    let all = await fetchAllProducts();

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
