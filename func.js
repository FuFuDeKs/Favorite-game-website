
document.addEventListener('DOMContentLoaded', () => {
    const newsContainer = document.getElementById('news-container');

    if (!newsContainer) return;

    fetch('/api/news')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network error: ' + response.status);
            }

            return response.json();
        })
        .then(articles => {
            if (!Array.isArray(articles) || articles.length === 0) {
                newsContainer.textContent = 'No news available at the moment.';
                return;
            }

            const cards = articles.map(article => {
                const card = document.createElement('article');
                card.className = 'news-card';

                const category = document.createElement('span');
                category.className = 'news-category';
                category.textContent = article.category || 'News';

                const title = document.createElement('h3');
                title.className = 'news-title';
                title.textContent = article.title || 'Untitled';

                const description = document.createElement('p');
                description.className = 'news-description';
                description.textContent =
                    article.short_description || article.full_content || '';

                const date = document.createElement('time');
                date.className = 'news-date';

                const publishDate = new Date(article.publish_date);

                if (!Number.isNaN(publishDate.getTime())) {
                    date.dateTime = publishDate.toISOString();
                    date.textContent = publishDate.toLocaleDateString('lv-LV');
                } else {
                    date.textContent = 'Date unavailable';
                }

                card.append(category, title, description, date);

                return card;
            });

            newsContainer.replaceChildren(...cards);
        })
        .catch(error => {
            console.error('News loading error:', error);

            newsContainer.textContent = 'Failed to load news.';
            newsContainer.classList.add('news-error');
        });
});
