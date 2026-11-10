(() => {
  const KEY = 'audiocaf:reviews:v2';
  const OLD_KEY = 'audiocaf:reviews'; // v1 held only user-added reviews
  const main = document.querySelector('.reviews');
  const dialog = document.getElementById('review-dialog');
  const form = document.getElementById('review-form');
  const formTitle = document.getElementById('form-title');
  const status = document.getElementById('spotify-status');
  const importBtn = document.getElementById('spotify-import');
  let spotifyCover = '';

  // One floating player shared by all reviews, so review cards never change size.
  const player = el('aside', { id: 'player', hidden: true });
  const closeBtn = el('button', { type: 'button', className: 'player-close' }, '✕ close');
  const frame = el('iframe', {
    title: 'Spotify player',
    allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
  });
  player.append(closeBtn, frame);
  document.body.append(player);
  closeBtn.addEventListener('click', () => {
    player.hidden = true;
    frame.src = 'about:blank';
  });
  function play(r) {
    frame.src = `https://open.spotify.com/embed/album/${r.spotifyId}`;
    player.hidden = false;
  }

  const read = (k) => {
    try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
  };
  const load = () => {
    const v2 = read(KEY);
    if (v2) return v2;
    const list = [...(read(OLD_KEY) || []), ...(window.AUDIOCAF_SEED || [])];
    save(list);
    return list;
  };
  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      alert('Could not save. Storage may be full; try a smaller cover image.');
      return false;
    }
  }

  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    n.append(...kids);
    return n;
  };

  // *text* renders as italics
  const rich = (text) => text.split('*').map((s, i) => (i % 2 ? el('em', {}, s) : s));

  function render(r) {
    const score = el('div', { className: 'review-score' }, String(Number(r.score)), el('span', {}, '/10'));
    score.setAttribute('aria-label', `Score: ${r.score} out of 10`);

    const copy = el('div', { className: 'review-copy' },
      el('p', { className: 'review-kicker' }, r.artist),
      el('h2', {}, el('em', {}, r.title)),
      el('p', {}, ...rich(r.text)));

    const edit = el('button', { className: 'edit', type: 'button' }, 'edit');
    edit.addEventListener('click', () => openForm(r));
    const remove = el('button', { className: 'remove', type: 'button' }, 'remove');
    remove.addEventListener('click', () => {
      if (!confirm(`Remove "${r.title}"?`)) return;
      save(load().filter((x) => x.id !== r.id));
      article.remove();
    });

    const art = r.cover
      ? el('img', { src: r.cover, alt: `${r.title} album artwork`, loading: 'lazy' })
      : el('div', { className: 'album-ph' });

    const actions = el('div', { className: 'actions' }, edit, remove);
    if (r.spotifyId) {
      const preview = el('button', { className: 'edit', type: 'button' }, '▶ preview');
      preview.addEventListener('click', () => play(r));
      actions.prepend(preview);
    }
    const info = el('div', { className: 'album-info' },
      el('h3', {}, r.title),
      el('ol', { className: r.tracks.length > 9 ? 'long' : '', tabIndex: 0 }, ...r.tracks.map((t) => el('li', {}, t))),
      actions);

    const article = el('article', { className: 'review user' },
      el('div', { className: 'review-body' }, score, copy),
      el('div', { className: 'album' }, art, info));
    article.dataset.id = r.id;
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

  function openForm(r) {
    form.reset();
    spotifyCover = '';
    status.textContent = '';
    form.elements.id.value = r ? r.id : '';
    formTitle.textContent = r ? 'Edit review' : 'New review';
    if (r) {
      form.elements.artist.value = r.artist;
      form.elements.title.value = r.title;
      form.elements.score.value = r.score;
      form.elements.text.value = r.text;
      form.elements.tracks.value = r.tracks.join('\n');
      if (r.spotifyId) form.elements.spotify.value = `https://open.spotify.com/album/${r.spotifyId}`;
    }
    dialog.showModal();
  }

  // ---- Spotify import ----
  const albumId = (s) => (s.match(/album[/:]([A-Za-z0-9]{22})/) || [])[1];

  async function importSpotify() {
    const link = form.elements.spotify.value.trim();
    const id = albumId(link);
    if (!id) { status.textContent = 'Paste a Spotify album link.'; return; }
    status.textContent = 'Importing...';
    importBtn.disabled = true;
    try {
      const proxy = (window.AUDIOCAF_CONFIG || {}).spotifyProxy;
      if (proxy) {
        const res = await fetch(`${proxy.replace(/\/$/, '')}/?id=${id}`);
        if (!res.ok) throw new Error(`proxy ${res.status}`);
        const d = await res.json();
        form.elements.title.value = d.title;
        form.elements.artist.value = d.artist;
        form.elements.tracks.value = d.tracks.join('\n');
        spotifyCover = d.cover;
        status.textContent = `Imported ${d.tracks.length} tracks and cover.`;
      } else {
        // No proxy: Spotify's public oEmbed gives title/cover only, no tracklist.
        const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/album/${id}`)}`);
        if (!res.ok) throw new Error(`oembed ${res.status}`);
        const d = await res.json();
        if (d.title) form.elements.title.value = d.title;
        spotifyCover = d.thumbnail_url || '';
        status.textContent = 'Imported title' + (spotifyCover ? ' and cover' : '') +
          '. Tracklist needs the Spotify proxy (see spotify-proxy/worker.js).';
      }
    } catch {
      status.textContent = 'Import failed. Check the link and the proxy URL in js/config.js.';
    } finally {
      importBtn.disabled = false;
    }
  }

  importBtn.addEventListener('click', importSpotify);
  document.getElementById('add-review').addEventListener('click', () => openForm(null));
  document.getElementById('cancel-review').addEventListener('click', () => dialog.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const list = load();
    const id = f.get('id');
    const existing = list.find((x) => x.id === id);
    const upload = await readCover(f.get('cover'));
    const r = {
      id: id || Date.now().toString(36),
      artist: f.get('artist').trim(),
      title: f.get('title').trim(),
      score: f.get('score'),
      text: f.get('text').trim(),
      tracks: f.get('tracks').split('\n').map((s) => s.trim()).filter(Boolean),
      cover: upload || spotifyCover || (existing ? existing.cover : ''),
      spotifyId: albumId(f.get('spotify').trim()) || '',
    };
    if (existing) list[list.indexOf(existing)] = r; else list.unshift(r);
    if (!save(list)) return;
    const node = render(r);
    const old = main.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
    if (old) old.replaceWith(node); else main.prepend(node);
    dialog.close();
  });

  const frag = document.createDocumentFragment();
  load().forEach((r) => frag.append(render(r)));
  main.prepend(frag);
})();
