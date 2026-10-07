DANNMORAES ULTIMATE PRO STUDIO V9 — NETLIFY DEPLOY

1. Upload/deploy folder ini ke Netlify.
2. Buka Netlify > Site configuration > Environment variables.
3. Tambahkan:
   Name: REMOVE_BG_API_KEY
   Value: API key Remove.bg milik kamu.
4. Redeploy site.
5. Buka Ultimate Pro Studio > EXCISION BG > AI ONLINE.

ALUR ONLINE:
Browser -> /.netlify/functions/remove-bg -> Remove.bg API -> PNG transparan

API KEY TIDAK ADA DI HTML. Jangan menaruh API key langsung di frontend.

OFFLINE:
Smart Edge, Color Key, Eraser, Restore, Feather, Mask, Undo/Redo tetap berjalan
lokal dan tidak mengupload foto.

CATATAN:
- Netlify Function membutuhkan REMOVE_BG_API_KEY agar AI Online aktif.
- Tanpa API key, tombol AI Online akan memberi popup custom yang menjelaskan masalah.
- Remove.bg API memiliki limit/kredit sesuai akun/provider. Cek dashboard provider untuk pemakaian dan biaya.
