document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('gallery-grid');
    const status = document.getElementById('gallery-status');
    const lightbox = document.getElementById('gallery-lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxLabel = document.getElementById('lightbox-label');
    const closeButton = document.getElementById('lightbox-close');

    if (!grid || !status) return;

    const closeLightbox = () => {
        lightbox.classList.remove('open');
        lightboxImage.src = '';
    };

    closeButton?.addEventListener('click', closeLightbox);
    lightbox?.addEventListener('click', event => {
        if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeLightbox();
    });

    try {
        const response = await fetch('/api/gallery');
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const images = await response.json();

        if (!Array.isArray(images) || images.length === 0) {
            status.textContent = 'Galerijā pašlaik nav attēlu.';
            return;
        }

        const cards = images.map(item => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'gallery-item';
            card.setAttribute('aria-label', `Atvērt attēlu: ${item.title || 'Terraria'}`);

            const image = document.createElement('img');
            image.src = item.image_url;
            image.alt = item.title || 'Terraria attēls';
            image.loading = 'lazy';

            const caption = document.createElement('span');
            caption.className = 'gallery-caption';
            const title = document.createElement('strong');
            title.textContent = item.title || 'Bez nosaukuma';
            const description = document.createElement('span');
            description.textContent = item.description || '';
            caption.append(title, document.createElement('br'), description);
            card.append(image, caption);

            card.addEventListener('click', () => {
                lightboxImage.src = item.image_url;
                lightboxImage.alt = item.title || 'Terraria attēls';
                lightboxLabel.textContent = [item.title, item.description].filter(Boolean).join(' — ');
                lightbox.classList.add('open');
            });

            image.addEventListener('error', () => {
                card.classList.add('gallery-item-broken');
                image.alt = 'Attēlu neizdevās ielādēt';
            });

            return card;
        });

        grid.replaceChildren(...cards);
        status.remove();
    } catch (error) {
        console.error('Gallery loading error:', error);
        status.textContent = 'Neizdevās ielādēt galeriju. Pārbaudi servera un datubāzes savienojumu.';
        status.classList.add('news-error');
    }
});
