document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('site-search-form');
    const input = document.getElementById('site-search-input');
    const status = document.getElementById('search-status');
    const results = document.getElementById('search-results');
    if (!form || !input || !status || !results) return;

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const query = input.value.trim();
        if (query.length < 2) {
            status.textContent = 'Ievadi vismaz 2 simbolus.';
            return;
        }
        status.textContent = 'Meklē...';
        results.replaceChildren();
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Meklēšana neizdevās.');
            const entries = [
                ...(data.articles || []).map(item => ({ ...item, href: '/news', label: 'Ziņas' })),
                ...(data.gallery || []).map(item => ({ ...item, href: '/gallery', label: 'Galerija' }))
            ];
            if (!entries.length) {
                status.textContent = 'Nekas netika atrasts.';
                return;
            }
            const fragment = document.createDocumentFragment();
            entries.forEach(item => {
                const article = document.createElement('article');
                article.className = 'news-card';
                const category = document.createElement('span');
                category.className = 'news-category';
                category.textContent = item.label;
                const title = document.createElement('h3');
                title.className = 'news-title';
                title.textContent = item.title || 'Bez nosaukuma';
                const description = document.createElement('p');
                description.className = 'news-description';
                description.textContent = item.description || '';
                const link = document.createElement('a');
                link.className = 'nav-link';
                link.href = item.href;
                link.textContent = `Skatīt ${item.label.toLowerCase()}`;
                article.append(category, title, description, link);
                fragment.append(article);
            });
            results.replaceChildren(fragment);
            status.textContent = `Atrasti ${entries.length} rezultāti.`;
        } catch (error) {
            status.textContent = error.message;
        }
    });
});
