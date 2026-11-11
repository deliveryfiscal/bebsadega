// Envia fotos reduzidas, a base de referência e as fotos dos produtos (login do dono).
// Uso: python3 -I scripts/base-codigos/preparar.py <pasta-dos-zips-extraidos> <pasta-saida>
//      SENHA=<senha do roberto> node scripts/base-codigos/enviar.cjs <pasta-saida>
// Só preenche fotos de produtos que ainda não têm foto (não substitui as escolhidas pelo dono).
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const PREP = process.argv[2];
const URL_ = fs.readFileSync(path.join(__dirname, "../../.env.local"), "utf8").match(/SUPABASE_URL=(.*)/)[1].trim();
const KEY = fs.readFileSync(path.join(__dirname, "../../.env.local"), "utf8").match(/ANON_KEY=(.*)/)[1];
const pub = (f) => `${URL_}/storage/v1/object/public/produtos/img/${f}`;
(async () => {
  const s = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { error: le } = await s.auth.signInWithPassword({ email: "roberto@bebs.local", password: process.env.SENHA });
  if (le) throw le;
  // 1) fotos
  const arquivos = fs.readdirSync(path.join(PREP, "img")).filter((f) => f.endsWith(".webp") && !f.startsWith("_"));
  let ok = 0;
  for (let i = 0; i < arquivos.length; i += 8) {
    await Promise.all(arquivos.slice(i, i + 8).map(async (f) => {
      const { error } = await s.storage.from("produtos").upload(`img/${f}`, fs.readFileSync(path.join(PREP, "img", f)),
        { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
      if (error) console.log("falha", f, error.message); else ok++;
    }));
  }
  console.log("fotos enviadas:", ok, "/", arquivos.length);
  // 2) base de referência
  const ref = JSON.parse(fs.readFileSync(path.join(PREP, "referencia.json"), "utf8")).map((r) => ({ ...r, imagem_url: r.imagem ? pub(r.imagem) : null }));
  let n = 0;
  for (let i = 0; i < ref.length; i += 1000) {
    const { data, error } = await s.rpc("importar_referencia", { p: ref.slice(i, i + 1000) });
    if (error) throw error;
    n += data;
  }
  console.log("base de referência gravada:", n);
  // 3) fotos dos produtos da loja
  const prods = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await s.from("produtos").select("id,legado_id,imagem_url,arquivado").range(de, de + 999);
    prods.push(...data); if (data.length < 1000) break;
  }
  const { data: cods } = await s.from("produto_codigos").select("codigo,produto_id").range(0, 4999);
  const porLegado = new Map(prods.map((p) => [p.legado_id, p]));
  const definir = new Map();
  for (const x of JSON.parse(fs.readFileSync(path.join(PREP, "produtos_imagens.json"), "utf8"))) {
    const p = porLegado.get(x.legado_id);
    if (p && !p.imagem_url) definir.set(p.id, pub(x.imagem));
  }
  const porCodigo = JSON.parse(fs.readFileSync(path.join(PREP, "imagens_por_codigo.json"), "utf8"));
  let pelo190 = 0;
  for (const c of cods) {
    const p = prods.find((y) => y.id === c.produto_id && !y.arquivado);
    if (p && !p.imagem_url && !definir.has(p.id) && porCodigo[c.codigo]) { definir.set(p.id, pub(porCodigo[c.codigo])); pelo190++; }
  }
  const lista = [...definir].map(([produto_id, imagem_url]) => ({ produto_id, imagem_url }));
  const { data: atualizados, error: e3 } = await s.rpc("definir_imagens", { p: lista });
  if (e3) throw e3;
  console.log("produtos com foto definida:", atualizados, `(${pelo190} pelo código das 190 imagens)`);
})().catch((e) => { console.error("ERRO", e.message || e); process.exit(1); });
