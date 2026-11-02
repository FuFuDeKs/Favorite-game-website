const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const galleryDir = path.join(__dirname, 'gallery');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? 'root',
    database: process.env.DB_NAME || 'terraria_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

fs.mkdirSync(galleryDir, { recursive: true });
app.use(express.json({ limit: '8mb' }));

// Keep the private admin template inaccessible through the public static directory.
app.use((req, res, next) => {
    if (req.path.startsWith('/private/')) return res.sendStatus(404);
    next();
});
app.use(express.static(__dirname, { index: false }));

function requireAdmin(req, res, next) {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
        return res.status(503).send('Admin panelis nav konfigurēts. Iestati ADMIN_PASSWORD vides mainīgo.');
    }

    const header = req.headers.authorization || '';
    const match = header.match(/^Basic\s+(.+)$/i);
    if (!match) {
        res.set('WWW-Authenticate', 'Basic realm="Terraria admin", charset="UTF-8"');
        return res.status(401).send('Nepieciešama administratora parole.');
    }

    let supplied;
    try {
        supplied = Buffer.from(match[1], 'base64').toString('utf8').split(':').slice(1).join(':');
    } catch {
        return res.sendStatus(401);
    }

    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        res.set('WWW-Authenticate', 'Basic realm="Terraria admin", charset="UTF-8"');
        return res.status(401).send('Nepareiza parole.');
    }
    next();
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/content', (req, res) => res.sendFile(path.join(__dirname, 'content.html')));
app.get('/gallery', (req, res) => res.sendFile(path.join(__dirname, 'gallery.html')));
app.get('/news', (req, res) => res.sendFile(path.join(__dirname, 'news.html')));
app.get('/search', (req, res) => res.sendFile(path.join(__dirname, 'search.html')));
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'private', 'admin.html')));

app.get('/api/news', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM articles ORDER BY publish_date DESC, id DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('News database error:', error);
        res.status(500).json({ error: 'Neizdevās ielādēt ziņas.' });
    }
});

// Admin-only news management API.
app.get('/api/admin/news', requireAdmin, async (req, res) => {
    try {
        const [rows]    = await pool.query(
            'SELECT id, game_id, category, title, short_description, full_content, publish_date FROM articles ORDER BY publish_date DESC, id DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Admin news loading error:', error);
        res.status(500).json({ error: 'Neizdevās ielādēt ziņas.' });
    }
});

function validateArticle(body) {
    const { category, title, short_description, full_content, publish_date } = body || {};
    if (typeof category !== 'string' || !category.trim() || category.trim().length > 50) return 'Kategorija ir obligāta (maks. 50 simboli).';
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 150) return 'Virsraksts ir obligāts (maks. 150 simboli).';
    if (typeof short_description !== 'string' || !short_description.trim()) return 'Īsais apraksts ir obligāts.';
    if (typeof full_content !== 'string' || !full_content.trim()) return 'Pilns ziņas teksts ir obligāts.';
    if (typeof publish_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(publish_date) || Number.isNaN(Date.parse(`${publish_date}T00:00:00Z`))) return 'Norādi derīgu publicēšanas datumu.';
    return null;
}

app.post('/api/admin/news', requireAdmin, async (req, res) => {
    const validationError = validateArticle(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    try {
        const { category, title, short_description, full_content, publish_date } = req.body;
        const [result] = await pool.execute(
            `INSERT INTO articles (game_id, category, title, short_description, full_content, publish_date) VALUES (1, ?, ?, ?, ?, ?)`,
            [category.trim(), title.trim(), short_description.trim(), full_content.trim(), publish_date]
        );
        res.status(201).json({ id: result.insertId, message: 'Ziņa pievienota.' });
    } catch (error) {
        console.error('News creation error:', error);
        res.status(500).json({ error: 'Neizdevās pievienot ziņu.' });
    }
});

app.put('/api/admin/news/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Nederīgs ziņas ID.' });
    const validationError = validateArticle(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    try {
        const { category, title, short_description, full_content, publish_date } = req.body;
        const [result] = await pool.execute(
            'UPDATE articles SET category = ?, title = ?, short_description = ?, full_content = ?, publish_date = ? WHERE id = ?',
            [category.trim(), title.trim(), short_description.trim(), full_content.trim(), publish_date, id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'Ziņa nav atrasta.' });
        res.json({ message: 'Ziņa atjaunināta.' });
    } catch (error) {
        console.error('News update error:', error);
        res.status(500).json({ error: 'Neizdevās saglabāt izmaiņas.' });
    }
});

app.delete('/api/admin/news/:id', requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Nederīgs ziņas ID.' });
    try {
        const [result] = await pool.execute('DELETE FROM articles WHERE id = ?', [id]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Ziņa nav atrasta.' });
        res.json({ message: 'Ziņa izdzēsta.' });
    } catch (error) {
        console.error('News deletion error:', error);
        res.status(500).json({ error: 'Neizdevās izdzēst ziņu.' });
    }
});

app.get('/api/gallery', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, game_id, image_url, title, description FROM gallery ORDER BY id DESC'
        );

        // Older SQL dumps stored local Windows paths. Convert only their basename
        // to a URL when the corresponding file exists in the public gallery folder.
        const result = rows.map(row => {
            let imageUrl = String(row.image_url || '').replace(/\\/g, '/');
            if (/^[a-z]:/i.test(imageUrl) || imageUrl.includes('Users/')) {
                const knownFiles = fs.readdirSync(galleryDir);
                const filename = knownFiles.find(name => imageUrl.toLowerCase().includes(name.toLowerCase()));
                imageUrl = filename ? `/gallery/${encodeURIComponent(filename)}` : '';
            } else if (!imageUrl.startsWith('/') && !/^https?:\/\//i.test(imageUrl)) {
                imageUrl = `/gallery/${encodeURIComponent(path.basename(imageUrl))}`;
            }
            return { ...row, image_url: imageUrl };
        }).filter(row => row.image_url);
        res.json(result);
    } catch (error) {
        console.error('Gallery database error:', error);
        res.status(500).json({ error: 'Neizdevās ielādēt galeriju.' });
    }
});

app.post('/api/gallery', requireAdmin, async (req, res) => {
    let savedPath;
    try {
        const { title, description = '', image, game_id = 1 } = req.body || {};
        if (typeof title !== 'string' || !title.trim() || title.length > 150) {
            return res.status(400).json({ error: 'Nosaukums ir obligāts (maks. 150 simboli).' });
        }
        if (typeof description !== 'string' || description.length > 1000) {
            return res.status(400).json({ error: 'Apraksts nedrīkst pārsniegt 1000 simbolus.' });
        }
        if (!Number.isInteger(Number(game_id)) || Number(game_id) < 1) {
            return res.status(400).json({ error: 'Nederīgs game_id.' });
        }
        if (typeof image !== 'string' || !image.startsWith('data:')) {
            return res.status(400).json({ error: 'Izvēlies attēlu.' });
        }

        const match = image.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
        if (!match) return res.status(400).json({ error: 'Atļauti tikai PNG, JPG un WebP attēli.' });

        const buffer = Buffer.from(match[2], 'base64');
        if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
            return res.status(400).json({ error: 'Attēla izmērs nedrīkst pārsniegt 5 MB.' });
        }

        const signatures = {
            'image/png': buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
            'image/jpeg': buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
            'image/webp': buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
        };
        if (!signatures[match[1]]) {
            return res.status(400).json({ error: 'Attēla saturs neatbilst tā formātam.' });
        }

        const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[match[1]];
        const filename = `${crypto.randomUUID()}${extension}`;
        savedPath = path.join(galleryDir, filename);
        await fs.promises.writeFile(savedPath, buffer, { flag: 'wx' });

        const imageUrl = `/gallery/${filename}`;
        const [result] = await pool.execute(
            'INSERT INTO gallery (game_id, image_url, title, description) VALUES (?, ?, ?, ?)',
            [Number(game_id), imageUrl, title.trim(), description.trim()]
        );

        res.status(201).json({
            id: result.insertId,
            game_id: Number(game_id),
            image_url: imageUrl,
            title: title.trim(),
            description: description.trim()
        });
    } catch (error) {
        if (savedPath) await fs.promises.unlink(savedPath).catch(() => {});
        console.error('Gallery upload error:', error);
        res.status(500).json({ error: 'Neizdevās saglabāt attēlu. Pārbaudi datubāzi.' });
    }
});

app.get('/api/search', async (req, res) => {
    const term = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (term.length < 2 || term.length > 100) {
        return res.status(400).json({ error: 'Meklēšanas frāzei jābūt 2–100 simbolu garai.' });
    }
    try {
        const pattern = `%${term}%`;
        const [articles] = await pool.execute(
            `SELECT id, category, title, short_description AS description, publish_date AS date
             FROM articles
             WHERE title LIKE ? OR category LIKE ? OR short_description LIKE ? OR full_content LIKE ?
             ORDER BY publish_date DESC LIMIT 30`,
            [pattern, pattern, pattern, pattern]
        );
        const [gallery] = await pool.execute(
            `SELECT id, title, description, image_url
             FROM gallery
             WHERE title LIKE ? OR description LIKE ?
             ORDER BY id DESC LIMIT 30`,
            [pattern, pattern]
        );
        res.json({
            articles: articles.map(item => ({ ...item, type: 'news' })),
            gallery: gallery.map(item => ({ ...item, type: 'gallery' }))
        });
    } catch (error) {
        console.error('Search database error:', error);
        res.status(500).json({ error: 'Meklēšana neizdevās. Pārbaudi datubāzes struktūru.' });
    }
});

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API maršruts nav atrasts.' });
    res.status(404).sendFile(path.join(__dirname, '404.html'), err => {
        if (err && !res.headersSent) res.status(404).send('<h1>404 — Lapa nav atrasta</h1>');
    });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

async function shutdown() {
    server.close();
    await pool.end().catch(() => {});
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
