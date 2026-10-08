export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return Response.json({ error: "Method tidak diizinkan." }, { status: 405, headers });

  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return Response.json({ error: "REMOVE_BG_API_KEY belum dipasang di Netlify Environment Variables." }, { status: 500, headers });

  try {
    const body = await req.json();
    const image = body?.image;
    const size = body?.size === "preview" ? "preview" : "auto";
    if (!image || typeof image !== "string") return Response.json({ error: "Data gambar tidak ditemukan." }, { status: 400, headers });

    const match = image.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
    if (!match) return Response.json({ error: "Format gambar tidak didukung." }, { status: 400, headers });

    const mime = match[1].toLowerCase().replace("image/jpg", "image/jpeg");
    const binary = Buffer.from(match[2], "base64");
    if (!binary.length) return Response.json({ error: "Data gambar kosong atau rusak." }, { status: 400, headers });
    // Keep a safety margin below Netlify's 6 MB buffered request limit.
    if (binary.length > 4 * 1024 * 1024) return Response.json({ error: "Foto upload terlalu besar. Coba foto dengan ukuran lebih kecil." }, { status: 413, headers });

    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const form = new FormData();
    form.append("image_file", new Blob([binary], { type: mime }), `dannmoraes.${ext}`);
    form.append("size", size);
    form.append("format", "png");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    let apiResponse;
    try {
      apiResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": apiKey },
        body: form,
        signal: controller.signal
      });
    } finally { clearTimeout(timer); }

    if (!apiResponse.ok) {
      const text = await apiResponse.text();
      let detail = `Remove.bg HTTP ${apiResponse.status}`;
      try {
        const parsed = JSON.parse(text);
        const first = parsed?.errors?.[0];
        detail = first?.title || first?.detail || parsed?.error || detail;
      } catch (_) { if (text) detail = text.slice(0, 500); }
      if (apiResponse.status === 401) detail = "API key Remove.bg tidak valid atau tidak aktif.";
      if (apiResponse.status === 402) detail = "Kredit Remove.bg tidak mencukupi.";
      if (apiResponse.status === 413) detail = "Foto terlalu besar untuk Remove.bg.";
      if (apiResponse.status === 429) detail = "Batas penggunaan Remove.bg tercapai. Coba lagi sebentar.";
      return Response.json({ error: detail }, { status: apiResponse.status, headers });
    }

    const result = await apiResponse.arrayBuffer();
    return new Response(result, { status: 200, headers: { ...headers, "Content-Type": "image/png" } });
  } catch (error) {
    const msg = error?.name === "AbortError" ? "AI timeout. Coba foto yang lebih kecil atau ulangi." : (error?.message || "Server gagal memproses gambar.");
    return Response.json({ error: msg }, { status: 500, headers });
  }
};
