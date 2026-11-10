// Cloudflare Worker: Spotify album lookup (keeps your client secret off the website).
// Deploy: dash.cloudflare.com > Workers > Create > paste this file.
// Settings > Variables: add secrets SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
// (from developer.spotify.com/dashboard). Usage: GET /?id=<albumId>
const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!/^[A-Za-z0-9]{22}$/.test(id)) return json({ error: 'bad id' }, 400);

    const tokRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!tokRes.ok) return json({ error: 'spotify auth failed' }, 502);
    const { access_token } = await tokRes.json();

    const headers = { Authorization: `Bearer ${access_token}` };
    const albumRes = await fetch(`https://api.spotify.com/v1/albums/${id}`, { headers });
    if (!albumRes.ok) return json({ error: 'album not found' }, albumRes.status);
    const a = await albumRes.json();

    let items = a.tracks?.items || [];
    let next = a.tracks?.next;
    while (next) {
      const r = await fetch(next, { headers });
      if (!r.ok) break;
      const page = await r.json();
      items = items.concat(page.items);
      next = page.next;
    }
    return json({
      title: a.name,
      artist: (a.artists || []).map((x) => x.name).join(', '),
      cover: a.images?.[0]?.url || '',
      tracks: items.map((t) => t.name),
    });
  },
};

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CORS });
