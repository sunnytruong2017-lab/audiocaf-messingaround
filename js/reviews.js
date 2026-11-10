(() => {
  const KEY = 'audiocaf:reviews';
  const main = document.querySelector('.reviews');
  const dialog = document.getElementById('review-dialog');
  const form = document.getElementById('review-form');

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  };
  const save = (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      alert('Could not save. Storage may be full; try a smaller cover image.');
      return false;
    }
  };

  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...kids);
    return n;
  };

  function render(r) {
    const score = el('div', { className: 'review-score' }, String(Number(r.score)), el('span', {}, '/10'));
    score.setAttribute('aria-label', `Score: ${r.score} out of 10`);

    const copy = el('div', { className: 'review-copy' },
      el('p', { className: 'review-kicker' }, r.artist),
      el('h2', {}, el('em', {}, r.title)),
      el('p', {}, r.text));

    const remove = el('button', { className: 'remove', type: 'button' }, 'remove');
    remove.addEventListener('click', () => {
      if (!confirm(`Remove "${r.title}"?`)) return;
      save(load().filter((x) => x.id !== r.id));
      article.remove();
    });

    const art = r.cover
      ? el('img', { src: r.cover, alt: `${r.title} album artwork` })
      : el('div', { className: 'album-ph' });

    const info = el('div', { className: 'album-info' },
      el('h3', {}, r.title),
      el('ol', {}, ...r.tracks.map((t) => el('li', {}, t))),
      remove);

    const article = el('article', { className: 'review user' },
      el('div', { className: 'review-body' }, score, copy),
      el('div', { className: 'album' }, art, info));
    return article;
  }

  function readCover(file) {
    return new Promise((resolve) => {
      if (!file || !file.size) return resolve('');
      const fr = new FileReader();
      fr.onerror = () => resolve('');
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => resolve('');
        img.onload = () => {
          const s = Math.min(1, 500 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * s);
          c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  document.getElementById('add-review').addEventListener('click', () => dialog.showModal());
  document.getElementById('cancel-review').addEventListener('click', () => dialog.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const r = {
      id: Date.now().toString(36),
      artist: f.get('artist').trim(),
      title: f.get('title').trim(),
      score: f.get('score'),
      text: f.get('text').trim(),
      tracks: f.get('tracks').split('\n').map((s) => s.trim()).filter(Boolean),
      cover: await readCover(f.get('cover')),
    };
    const list = load();
    list.unshift(r);
    if (!save(list)) return;
    main.prepend(render(r));
    form.reset();
    dialog.close();
  });

  const frag = document.createDocumentFragment();
  load().forEach((r) => frag.append(render(r)));
  main.prepend(frag);
})();
