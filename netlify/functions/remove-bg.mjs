export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  };

  if (req.method === "OPTIONS") return new Response(null, {status:204, headers});
  if (req.method !== "POST") return Response.json({error:"Method tidak diizinkan."},{status:405,headers});

  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) return Response.json({error:"REMOVE_BG_API_KEY belum dipasang di Netlify."},{status:500,headers});

  try {
    const body = await req.json();
    const image = body?.image;
    if (typeof image !== "string") return Response.json({error:"Data gambar tidak ditemukan."},{status:400,headers});

    const m = image.match(/^data:(image\\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
    if (!m) return Response.json({error:"Format gambar tidak didukung."},{status:400,headers});

    const mime = m[1].toLowerCase().replace("image/jpg","image/jpeg");
    const binary = Buffer.from(m[2], "base64");
    if (!binary.length) return Response.json({error:"Gambar kosong."},{status:400,headers});
    if (binary.length > 5 * 1024 * 1024) return Response.json({error:"Foto terlalu besar untuk dikirim ke server. Gunakan foto di bawah 5 MB."},{status:413,headers});

    const form = new FormData();
    form.append("image_file", new Blob([binary], {type:mime}), mime === "image/png" ? "image.png" : "image.jpg");
    form.append("size","auto");
    form.append("format","png");

    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), 60000);
    let response;
    try {
      response = await fetch("https://api.remove.bg/v1.0/removebg", {
        method:"POST",
        headers:{"X-Api-Key":apiKey},
        body:form,
        signal:controller.signal
      });
    } finally { clearTimeout(timer); }

    if (!response.ok) {
      let detail="";
      try { detail=(await response.text()).slice(0,800); } catch {}
      const msg =
        response.status===401 ? "API key Remove.bg tidak valid." :
        response.status===402 ? "Kredit Remove.bg tidak cukup." :
        response.status===413 ? "Gambar terlalu besar untuk Remove.bg." :
        response.status===429 ? "Batas penggunaan Remove.bg tercapai. Coba lagi nanti." :
        `Remove.bg error ${response.status}${detail ? ": "+detail : ""}`;
      return Response.json({error:msg},{status:response.status,headers});
    }

    return new Response(await response.arrayBuffer(), {
      status:200,
      headers:{...headers,"Content-Type":"image/png"}
    });
  } catch (e) {
    const msg=e?.name==="AbortError" ? "Remove.bg timeout setelah 60 detik." : (e?.message || "Server gagal memproses gambar.");
    return Response.json({error:msg},{status:500,headers});
  }
};