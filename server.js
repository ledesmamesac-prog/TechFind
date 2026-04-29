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
  const admin = mongoose.connection.db.admin();
  const { databases } = await admin.listDatabases();

  // Exclude system databases
  const databasesToFetch = databases
    .map(db => db.name)
    .filter(name => !['admin', 'config', 'local'].includes(name));

  const allProducts = [];

  for (const dbName of databasesToFetch) {
    const db = mongoose.connection.useDb(dbName);
    const collections = await db.db.listCollections().toArray();

    for (const col of collections) {
      const docs = await db.collection(col.name).find({}).toArray();
      for (const doc of docs) {
        if (!doc.nombre || !doc.precio || !doc.tienda || !doc.enlace) continue;

        let priceNum = 0;
        if (typeof doc.precio === 'string') {
          const parsed = parseInt(doc.precio.replace(/\./g, '').replace(/ COP/gi, '').trim());
          if (!isNaN(parsed)) priceNum = parsed;
        } else if (typeof doc.precio === 'number') {
          priceNum = doc.precio;
        }

        if (priceNum > 0) {
          let imageUrl = doc.imagen || null;
          if (imageUrl && typeof imageUrl === 'string') {
            // Encode spaces in URL
            imageUrl = imageUrl.trim().replace(/ /g, '%20');
            // Fix relative paths like "/../" found in some DBs
            if (imageUrl.includes('/../')) {
              imageUrl = imageUrl.replace('/../', '/');
            }
          }

          allProducts.push({
            _id: doc._id.toString(),
            name: doc.nombre,
            price: priceNum,
            originalPrice: doc.precio_original || doc.precio_antes || null,
            brand: doc.marca || 'Genérico',
            store: doc.tienda,
            url: doc.enlace_normalized || doc.enlace,
            category: doc.categoria || col.name,
            image: imageUrl
          });
        }
      }
    }
  }
  return allProducts;
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
