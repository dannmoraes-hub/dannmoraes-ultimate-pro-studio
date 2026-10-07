export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return Response.json(
      { error: "Method tidak diizinkan." },
      { status: 405, headers }
    );
  }

  const apiKey = process.env.REMOVE_BG_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "REMOVE_BG_API_KEY belum dipasang di Netlify." },
      { status: 500, headers }
    );
  }

  try {
    const body = await req.json();
    const image = body?.image;
    const size = body?.size === "preview" ? "preview" : "auto";

    if (!image || typeof image !== "string") {
      return Response.json(
        { error: "Data gambar tidak ditemukan." },
        { status: 400, headers }
      );
    }

    const match = image.match(
      /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i
    );

    if (!match) {
      return Response.json(
        { error: "Format gambar tidak didukung." },
        { status: 400, headers }
      );
    }

    const mime = match[1].toLowerCase().replace("image/jpg", "image/jpeg");
    const base64 = match[2];
    const binary = Buffer.from(base64, "base64");

    const form = new FormData();

    form.append(
      "image_file",
      new Blob([binary], { type: mime }),
      mime === "image/png" ? "image.png" : "image.jpg"
    );

    form.append("size", size);

    const apiResponse = await fetch(
      "https://api.remove.bg/v1.0/removebg",
      {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey
        },
        body: form
      }
    );

    if (!apiResponse.ok) {
      let detail = `Remove.bg error ${apiResponse.status}`;

      try {
        const text = await apiResponse.text();
        if (text) detail = text.slice(0, 1000);
      } catch (_) {}

      return Response.json(
        { error: detail },
        { status: apiResponse.status, headers }
      );
    }

    const result = await apiResponse.arrayBuffer();

    return new Response(result, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "image/png",
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    return Response.json(
      {
        error: error?.message || "Server gagal memproses gambar."
      },
      { status: 500, headers }
    );
  }
};
