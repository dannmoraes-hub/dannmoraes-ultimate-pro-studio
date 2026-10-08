/**
 * DANNMORAES Ultimate Pro Studio — Netlify Function (ESM)
 * Server-side proxy for Remove.bg.
 * Keep REMOVE_BG_API_KEY in Netlify Environment Variables.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (req.method !== 'POST') {
    return json({ error: 'Method tidak diizinkan. Gunakan POST.' }, 405);
  }

  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    return json({ error: 'REMOVE_BG_API_KEY belum dipasang di Netlify Environment Variables.' }, 500);
  }

  try {
    const payload = await req.json();
    const image = typeof payload?.image === 'string' ? payload.image : '';
    const size = payload?.size === 'preview' ? 'preview' : 'auto';

    const match = image.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) return json({ error: 'Format gambar tidak didukung. Gunakan PNG, JPG, atau WebP.' }, 400);

    const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    const bytes = Buffer.from(match[2], 'base64');

    // Netlify Functions receive the JSON body as a buffered request. Base64 adds
    // overhead, so keep the binary image comfortably below the request limit.
    const MAX_BYTES = 4_200_000;
    if (bytes.length > MAX_BYTES) {
      return json({ error: 'Foto masih terlalu besar untuk jalur AI Online. Coba lagi; aplikasi akan mengompres foto otomatis.' }, 413);
    }

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const form = new FormData();
    form.append('image_file', new Blob([bytes], { type: mime }), `dannmoraes.${ext}`);
    form.append('size', size);
    // WebP keeps the same pixel dimensions while producing a much smaller
    // transparent result than PNG. The browser converts it to PNG on download.
    form.append('format', 'webp');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let apiResponse;
    try {
      apiResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!apiResponse.ok) {
      const raw = await apiResponse.text();
      let detail = `Remove.bg mengembalikan HTTP ${apiResponse.status}.`;
      try {
        const parsed = JSON.parse(raw);
        const first = parsed?.errors?.[0];
        detail = first?.title || first?.detail || parsed?.error || detail;
      } catch (_) {
        if (raw) detail = raw.slice(0, 700);
      }

      if (apiResponse.status === 401) detail = 'API key Remove.bg tidak valid atau sudah dicabut.';
      else if (apiResponse.status === 402) detail = 'Kredit Remove.bg tidak mencukupi.';
      else if (apiResponse.status === 413) detail = 'Foto terlalu besar untuk diproses Remove.bg.';
      else if (apiResponse.status === 429) detail = 'Batas penggunaan Remove.bg tercapai. Coba lagi nanti.';

      return json({ error: detail }, apiResponse.status >= 400 && apiResponse.status < 600 ? apiResponse.status : 502);
    }

    const result = await apiResponse.arrayBuffer();
    return new Response(result, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'image/webp',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'Server AI terlalu lama merespons. Coba lagi.'
      : (error?.message || 'Server gagal memproses gambar.');
    return json({ error: message }, 500);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
