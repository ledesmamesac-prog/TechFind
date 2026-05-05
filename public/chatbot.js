/**
 * TechFind Assistant - Robust Recommendation System
 * Non-generative AI approach based on intent parsing and fuzzy search
 */

document.addEventListener('DOMContentLoaded', () => {
    // State
    let allProducts = [];
    let brands = [];
    let categories = [];
    const messages = [];

    // UI Elements
    const chatToggle = document.getElementById('chat-toggle');
    const chatWindow = document.getElementById('chatbot-window');
    const chatClose = document.getElementById('close-chat');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('send-chat');
    const chatMessages = document.getElementById('chat-messages');

    if (!chatToggle || !chatWindow) return;

    // Helpers for history
    const HISTORY_KEY = 'techfind_chat_history';
    const saveHistory = () => {
        // Disabled: chat history not persisted across sessions
    };

    const loadHistory = () => {
        // Disabled: always start fresh, no storage retrieval
        renderQuickActions(['Ofertas del día', 'Celulares baratos', 'Laptops']);
    };

    // Load product data
    const loadData = async () => {
        try {
            const res = await fetch('/api/products');
            allProducts = await res.json();
            brands = [...new Set(allProducts.map(p => p.brand).filter(b => b))];
            categories = [...new Set(allProducts.map(p => p.category).filter(c => c))];
        } catch (err) {
            console.error('Chatbot failed to load products:', err);
        }
    };
    loadData();

    // NLP & intent config
    const STOP_WORDS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'que', 'en', 'y', 'para', 'con', 'por', 'me', 'quisiera', 'buscar', 'necesito', 'quiero', 'algun', 'algunos', 'algunas', 'ver', 'mostrar', 'dame', 'enséñame', 'busco', 'podrias', 'puedes']);
    const VARIATIONS = {
        'computadoras': 'computadores',
        'computadora': 'computadores',
        'cel': 'celulares',
        'telefono': 'celulares',
        'telefonos': 'celulares',
        'laptop': 'computadores',
        'portatil': 'computadores',
        'portatiles': 'computadores',
        'audifonos': 'audio',
        'parlantes': 'audio',
        'pantalla': 'pantallas',
        'tv': 'pantallas',
        'televisor': 'pantallas',
        'televisores': 'pantallas'
    };
    const QUERY_SYNONYMS = {
        bateria: ['bateria', 'baterias', 'pilas', 'pila', 'battery'],
        audifono: ['audifono', 'audifonos', 'headset', 'headsets', 'auriculares'],
        smartwatch: ['smartwatch', 'reloj inteligente', 'relojes inteligentes'],
        laptop: ['laptop', 'portatil', 'notebook'],
        celular: ['celular', 'celulares', 'telefono', 'telefonos', 'smartphone', 'movil'],
        tv: ['tv', 'televisor', 'televisores', 'pantalla', 'pantallas']
    };

    // Friendly & sarcastic messages
    const EMPTY_MESSAGES = [
        "Mmm... busqué hasta debajo de las piedras y no encontré nada. ¿Puedes ser más específico? ",
        "Ni el mejor buscador del universo encontraría eso aquí... ¿intentamos con otra cosa? ",
        "Houston, tenemos un problema. No hay productos para eso. ",
        "Busqué, rebusqué y hasta le pregunté a mi abuela... nada. Intenta con otras palabras ",
        "¿Seguro que eso existe? Porque yo no lo encontré por ningún lado ",
        "Resultado de búsqueda: 0. Drama level: 100. ¿Intentamos de nuevo? ",
        "Eso está más perdido que yo en un examen de matemáticas "
    ];

    const FEW_RESULTS_MESSAGES = [
        "No hay mucho, pero lo que hay está bueno Mira esto:",
        "Encontré lo justo... como pizza que solo alcanza para uno ",
        "Poquito pero selecto. La calidad sobre la cantidad "
    ];

    const MANY_RESULTS_MESSAGES = [
        (n) => `¡Encontré ${n} opciones! Aquí van las mejores: `,
        (n) => `Tengo ${n} resultados. Esto sí está bien surtido `,
        (n) => `¡${n} productos! Que empiece la comparadera `
    ];

    const GREETINGS_MESSAGE = "¡Hola! Soy TechFind, tu asistente de tecnología favorito (y el único que no te cobra consulta)  ¿Qué buscas hoy?";
    const OUT_OF_CATALOG_MESSAGE = "Eso no es tecnología... ¡pero si quieres un celular para pedir domicilios de neveras, tengo opciones! ";

    // Helper for random messages
    const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Utils
    const normalize = (text = '') => String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const cleanQuery = (text = '') => {
        const tokens = normalize(text).split(/\s+/);
        return tokens
            .filter(t => !STOP_WORDS.has(t))
            .map(t => VARIATIONS[t] || t)
            .join(' ');
    };

    const singularize = (word = '') => {
        const w = normalize(word);
        if (w.length <= 3) return w;
        if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
        if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
        return w;
    };

    const expandQueryTerms = (query = '') => {
        const cleaned = cleanQuery(query);
        const baseTokens = cleaned.split(/\s+/).filter(Boolean);
        const expanded = new Set();

        baseTokens.forEach(token => {
            const sing = singularize(token);
            expanded.add(token);
            expanded.add(sing);
            if (QUERY_SYNONYMS[sing]) {
                QUERY_SYNONYMS[sing].forEach(term => expanded.add(normalize(term)));
            }
        });

        return [...expanded].filter(Boolean);
    };

    const scoreProduct = (product, terms = []) => {
        const haystack = normalize([
            product.name,
            product.brand,
            product.category,
            product.subcategory,
            product.store
        ].filter(Boolean).join(' '));

        let score = 0;
        terms.forEach(term => {
            const t = normalize(term);
            if (!t) return;
            if (haystack.includes(t)) score += Math.max(2, Math.min(8, t.length));
            else if (haystack.includes(singularize(t))) score += 3;
        });

        if (product.discountPercentage || (product.originalPrice && product.originalPrice > product.price)) score += 2;
        return score;
    };

    const searchProductsByQuery = (query, limit = 5) => {
        const terms = expandQueryTerms(query);
        let results = Array.isArray(allProducts) ? [...allProducts] : [];

        if (results.length === 0) return [];

        results = results
            .map(product => ({ product, score: scoreProduct(product, terms) }))
            .filter(entry => entry.score > 0)
            .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
            .map(entry => entry.product);

        if (results.length === 0) {
            const q = normalize(query);
            if (q.includes('barat') || q.includes('econom') || q.includes('ofert') || q.includes('descuento')) {
                results = [...allProducts].sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0) || a.price - b.price);
            } else {
                results = [...allProducts].sort((a, b) => a.price - b.price);
            }
        }

        return results.slice(0, limit);
    };

    const levenshtein = (a, b) => {
        a = a || '';
        b = b || '';
        const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
        for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
            }
        }
        return matrix[a.length][b.length];
    };

    const fuzzyMatch = (query, list = [], threshold = 2) => {
        const cleaned = cleanQuery(query);
        let bestMatch = null;
        let minDistance = Infinity;
        if (!cleaned) return null;

        for (const item of list) {
            const normalizedItem = normalize(item);
            if (cleaned.includes(normalizedItem) || normalizedItem.includes(cleaned)) return item;
        }

        for (const item of list) {
            const normalizedItem = normalize(item);
            const distance = levenshtein(cleaned, normalizedItem);
            if (distance < minDistance && distance <= threshold) {
                minDistance = distance;
                bestMatch = item;
            }
        }
        return bestMatch;
    };

    const extractPrice = (text = '') => {
        const match = String(text).match(/(\d+)\s*(mil|millones|k)?/i);
        if (!match) return null;
        let val = parseInt(match[1], 10);
        if (match[2]) {
            const unit = match[2].toLowerCase();
            if (unit === 'mil' || unit === 'k') val *= 1000;
            if (unit === 'millones') val *= 1000000;
        }
        return val;
    };

    // Search engine
    const getRecommendations = (query) => {
        const q = normalize(query);
        const cleaned = cleanQuery(query);
        let results = Array.isArray(allProducts) ? [...allProducts] : [];

        const intent = {
            brand: fuzzyMatch(query, brands),
            category: fuzzyMatch(query, categories),
            maxPrice: extractPrice(query),
            isCheap: q.includes('barat') || q.includes('economico') || q.includes('bajo precio') || q.includes('comodo'),
            isExpensive: q.includes('caro') || q.includes('costoso') || q.includes('alta gama') || q.includes('mejor'),
            isOffer: q.includes('oferta') || q.includes('descuento') || q.includes('rebaja') || q.includes('promo'),
        };

        if (intent.brand) results = results.filter(p => p.brand === intent.brand);
        if (intent.category) results = results.filter(p => p.category === intent.category);
        if (intent.maxPrice) results = results.filter(p => p.price <= intent.maxPrice);
        if (intent.isOffer) results = results.filter(p => (p.discountPercentage > 0) || (p.originalPrice && p.originalPrice > p.price));

        if (results.length > 20 || (!intent.brand && !intent.category)) {
            const keywords = cleaned.split(' ').filter(w => w.length > 2);
            results = results.filter(p => {
                const name = normalize(p.name);
                return keywords.some(k => name.includes(k));
            });
        }

        if (intent.isCheap) results.sort((a, b) => a.price - b.price);
        else if (intent.isExpensive) results.sort((a, b) => b.price - a.price);
        else if (intent.isOffer) results.sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0));

        return { items: results.slice(0, 5), intent };
    };

    // UI helpers
    const showTypingIndicator = () => {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator assistant';
        indicator.id = 'typing-indicator';
        indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const hideTypingIndicator = () => {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    };

    const renderQuickActions = (actions) => {
        const container = document.createElement('div');
        container.className = 'quick-actions';
        actions.forEach(text => {
            const chip = document.createElement('div');
            chip.className = 'quick-chip';
            chip.innerText = text;
            chip.onclick = () => {
                appendMessage('user', text);
                handleQuery(text);
                container.remove();
            };
            container.appendChild(chip);
        });
        chatMessages.appendChild(container);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const renderProduct = (p) => {
        const hasDiscount = p.originalPrice && p.originalPrice > p.price;
        const discountPct = hasDiscount ? Math.round((1 - (p.price / p.originalPrice)) * 100) : 0;
        return `
            <div class="chat-product-card" data-id="${p._id || p.id}">
                <img src="${p.image}" alt="${p.name}" style="width:40px; height:40px; object-fit:contain; border-radius:4px; background:#fff;">
                <div style="flex:1; min-width:0;">
                    <div style="font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                    <div style="font-size:11px; color:var(--text-secondary);">$${(p.price || 0).toLocaleString()} ${discountPct > 0 ? `<span style="color:#be1111; font-weight:700;">-${discountPct}%</span>` : ''}</div>
                    <div style="font-size:10px; color:var(--text-tertiary);">${p.brand || ''} | ${p.store || ''}</div>
                </div>
            </div>
        `;
    };

    // Messaging
    const appendMessage = (role, content, save = true) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        msgDiv.innerHTML = content;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        messages.push({ role, content, ts: Date.now() });
        if (save) saveHistory();
    };

    // Click delegation for product cards
    chatMessages.addEventListener('click', (e) => {
        const card = e.target.closest('.chat-product-card');
        if (!card) return;
        const productId = card.dataset.id;
        const product = allProducts.find(p => String(p._id) === String(productId) || String(p.id) === String(productId));
        if (product && window.showProductDetails) {
            window.showProductDetails(product);
            if (chatWindow) {
                chatWindow.style.display = 'none';
                chatWindow.classList.remove('active');
            }
        }
    });

    // Main conversation handler
    const handleQuery = async (query) => {
        const q = normalize(query);
        showTypingIndicator();
        await new Promise(r => setTimeout(r, 600));
        hideTypingIndicator();
        if (['gracias', 'grac', 'perfecto', 'buenisimo'].some(w => q.includes(w))) {
            return appendMessage('assistant', '¡Con mucho gusto! 😄 ¿Hay algo más en lo que pueda ayudarte?');
        }

        if (['hola', 'buenos dias', 'buenas tardes'].some(w => q.includes(w))) {
            appendMessage('assistant', '¡Hola de nuevo! Cuéntame, ¿qué estás buscando?');
            return renderQuickActions(['Ver Ofertas', 'Celulares', 'Laptops']);
        }

        if (q.includes('oferta') || q.includes('promo') || q.includes('descuento')) {
            const { items } = getRecommendations(query);
            if (items.length > 0) {
                appendMessage('assistant', '¡Claro! Estas son las mejores ofertas que encontré hoy:');
                const html = items.map(p => renderProduct(p)).join('');
                return appendMessage('assistant', `<div style="display:flex; flex-direction:column; gap:8px;">${html}</div>`);
            }
        }

        if (q.includes('quien eres') || q.includes('que haces')) {
            return appendMessage('assistant', 'Soy el asistente inteligente de TechFind. Mi trabajo es ayudarte a encontrar los mejores productos tecnológicos al mejor precio entre múltiples tiendas.');
        }

        const renderResults = (headline, items, emptyMessage) => {
            if (!items || items.length === 0) {
                appendMessage('assistant', emptyMessage || 'Te dejo algunas opciones cercanas que podrían servirte:');
                return renderQuickActions(['Celulares Samsung', 'Laptops baratas', 'Audífonos']);
            }
            appendMessage('assistant', headline);
            const html = items.map(p => renderProduct(p)).join('');
            return appendMessage('assistant', `<div style="display:flex; flex-direction:column; gap:8px;">${html}</div>`);
        };

        const buildFallbackResults = (intent = {}) => {
            const queryResults = searchProductsByQuery(query, 5);
            if (queryResults.length > 0) return queryResults;

            let results = Array.isArray(allProducts) ? [...allProducts] : [];
            const brand = intent.brand ? normalize(intent.brand) : '';
            const category = intent.category ? normalize(intent.category) : '';

            if (brand) results = results.filter(p => normalize(p.brand || '').includes(brand));
            if (category) results = results.filter(p => normalize(p.category || '').includes(category));
            if (intent.offers_only) results = results.filter(p => (p.discountPercentage || (p.originalPrice && p.originalPrice > p.price)));

            if (results.length === 0) {
                results = Array.isArray(allProducts) ? [...allProducts].sort((a, b) => a.price - b.price) : [];
            }

            return results.slice(0, 5);
        };

        // Try AI-driven intent extraction and formatting via server proxy
        try {
            const searchResp = await fetch('/api/ai/phi/search-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            if (!searchResp.ok) throw new Error('AI search-json failed');
            const searchJson = await searchResp.json();

            // Optimized: use backend search endpoint instead of local filtering
            const searchResp2 = await fetch('/api/products/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    intent: searchJson.intent || {}, 
                    size: searchJson.size || 5 
                })
            });
            if (!searchResp2.ok) throw new Error('Backend search failed');
            const searchResult = await searchResp2.json();
            const filtered = searchResult.products || [];

            if (filtered.length === 0) {
                appendMessage('assistant', getRandom(EMPTY_MESSAGES));
                const fallbackItems = buildFallbackResults(searchJson.intent || {});
                if (fallbackItems.length > 0) {
                    const html = fallbackItems.map(p => renderProduct(p)).join('');
                    appendMessage('assistant', `<div style="display:flex; flex-direction:column; gap:8px;">${html}</div>`);
                }
                return;
            }

            // Frontend renders products directly (no AI formatting needed)
            let headline;
            const total = searchResult.total || filtered.length;
            if (filtered.length <= 2) {
                headline = getRandom(FEW_RESULTS_MESSAGES);
            } else {
                const msgFunc = getRandom(MANY_RESULTS_MESSAGES);
                headline = typeof msgFunc === 'function' ? msgFunc(total) : msgFunc;
            }
            appendMessage('assistant', headline);
            const productsHtml = filtered.map(p => renderProduct(p)).join('');
            appendMessage('assistant', `<div style="display:flex; flex-direction:column; gap:8px;">${productsHtml}</div>`);
        } catch (err) {
            console.warn('AI flow failed, falling back to local recommendations', err);
            // Fallback to local search
            const { items, intent } = getRecommendations(query);
            if (items.length > 0) {
                let resp = '¡Entendido! He buscado lo mejor para ti:';
                if (intent.brand || intent.category) resp = `He encontrado estas opciones de ${intent.brand || intent.category} que coinciden con lo que buscas:`;
                const productsHtml = items.map(p => renderProduct(p)).join('');
                appendMessage('assistant', resp + `<div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">${productsHtml}</div>`);
            } else {
                const fallbackItems = buildFallbackResults();
                renderResults('Te dejo opciones relacionadas con tu búsqueda:', fallbackItems, 'Te dejo algunas opciones relacionadas con tu búsqueda:');
            }
        }
    };

    // Event listeners
    chatToggle.addEventListener('click', () => {
        const isHidden = !chatWindow.classList.contains('active') && chatWindow.style.display !== 'flex';
        chatWindow.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            chatInput && chatInput.focus();
            if (chatMessages.children.length === 0) {
                renderQuickActions(['Ofertas del día', 'Celulares baratos', 'Laptops']);
            }
        }
    });

    chatClose && chatClose.addEventListener('click', () => chatWindow.style.display = 'none');

    const onSend = () => {
        const text = chatInput.value.trim();
        if (!text) return;
        appendMessage('user', text);
        chatInput.value = '';
        handleQuery(text);
    };

    chatSend && chatSend.addEventListener('click', onSend);
    chatInput && chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') onSend(); });

    // Initial load - disabled (no history persistence)
    // setTimeout(loadHistory, 300);
});

