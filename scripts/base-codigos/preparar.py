# Prepara a base de códigos e as fotos a partir dos pacotes recebidos (zips extraídos em
# <entrada>/base_codigos, <entrada>/imagens_190 e <entrada>/imagens_backup).
# Fotos reduzidas para 320 px WEBP; nomes e categorias normalizados para os da loja.
import csv, json, hashlib, re, sys, os, collections
from PIL import Image

UP, OUT = sys.argv[1], sys.argv[2]
os.makedirs(f"{OUT}/img", exist_ok=True)

def ler_csv(p):
    with open(p, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))

def dv13(base12):
    s = sum(int(d) * (3 if i % 2 else 1) for i, d in enumerate(base12))
    return str((10 - s % 10) % 10)

CAT = {
    "Cervejas": "Cervejas", "Chopes": "Cervejas",
    "Energéticos": "Energéticos", "Isotônicos": "Energéticos",
    "Uísque": "Whisky", "Vodka": "Vodka", "Derivados de vodka": "Vodka", "Gim (gin) e genebra": "Gin",
    "Bebida ice": "Beats / Ice", "Cooler": "Beats / Ice", "Sangrias e coquetéis": "Beats / Ice",
    "Batida e similares": "Vinhos e batidas", "Sidra e similares": "Vinhos e batidas",
}
PASTA = {"01_Cervejas": "Cervejas", "02_Energeticos": "Energéticos", "04_Whiskies": "Whisky", "05_Vodkas": "Vodka",
         "06_Gins": "Gin", "07_Cachacas": "Bebidas quentes / destilados", "08_Vinhos": "Vinhos e batidas",
         "09_Ices_e_Drinks": "Beats / Ice", "10_Isotonicos": "Energéticos", "11_Aguas": "Água e sucos"}

def categoria(fonte, vol):
    if fonte == "Refrigerantes":
        return "Refrigerantes – 2 litros" if (vol or 0) >= 1000 else "Refrigerantes – latas e pequenos"
    return CAT.get(fonte, "Bebidas quentes / destilados")

def limpar_nome(produto):
    partes = [p.strip() for p in produto.split(" — ")]
    nome = partes[0]
    for p in partes[1:]:
        if re.fullmatch(r"[\d.,]+\s*(ml|l|litros?)", p, re.I):
            nome += " " + p
    return re.sub(r"\s+", " ", nome).strip()

# ---------- fotos: reduz para no máximo 320 px em WEBP, nome = hash do conteúdo ----------
fotos = {}
def foto(caminho):
    if caminho in fotos: return fotos[caminho]
    try:
        with Image.open(caminho) as im:
            im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
            im.thumbnail((320, 320))
            if im.mode == "RGBA":
                fundo = Image.new("RGB", im.size, (255, 255, 255)); fundo.paste(im, mask=im.split()[3]); im = fundo
            tmp = f"{OUT}/img/_tmp.webp"
            im.save(tmp, "WEBP", quality=80, method=6)
        h = hashlib.sha1(open(tmp, "rb").read()).hexdigest()[:16]
        os.replace(tmp, f"{OUT}/img/{h}.webp")
        fotos[caminho] = f"{h}.webp"
    except Exception as e:
        print("foto inválida:", caminho, e); fotos[caminho] = None
    return fotos[caminho]

# ---------- base de 5.366 códigos ----------
base = ler_csv(f"{UP}/base_codigos/Catalogo_Adega_Codigos_de_Barras.csv")
ref = {}
for r in base:
    cod = r["codigo_barras"].strip()
    if not cod.isdigit(): continue
    vol = int(r["volume_ml"]) if r["volume_ml"].strip().isdigit() else None
    un = int(r["unidades_embalagem"]) if r["unidades_embalagem"].strip().isdigit() else 1
    ref[cod] = dict(codigo=cod, nome=limpar_nome(r["produto"]), categoria=categoria(r["categoria"], vol), categoria_fonte=r["categoria"],
                    fabricante=r["fabricante"].strip(), volume_ml=vol, embalagem=r["embalagem"].strip(),
                    unidades=max(un, 1) if r["tipo_codigo"] == "Pack/caixa" else 1, codigo_unidade=None, imagem=None, fonte="Base pública de códigos (GO/SC)")
for cod, r in ref.items():
    if r["unidades"] > 1 and len(cod) == 14:
        u = cod[1:13] + dv13(cod[1:13])
        if u in ref: r["codigo_unidade"] = u

# ---------- 190 imagens com código ----------
cat190 = ler_csv(f"{UP}/imagens_190/Catalogo_Imagens.csv")
img_por_codigo = {}
for r in cat190:
    cod = r["codigo_barras_fonte"].strip()
    arq = foto(f"{UP}/imagens_190/{r['arquivo']}")
    if not arq or not cod.isdigit(): continue
    img_por_codigo[cod] = arq
    if cod in ref: ref[cod]["imagem"] = arq
    else:
        cat = "Refrigerantes – latas e pequenos" if r["categoria"] == "03_Refrigerantes" else PASTA.get(r["categoria"], "Bebidas")
        ref[cod] = dict(codigo=cod, nome=r["produto"].strip(), categoria=cat, categoria_fonte=r["categoria"], fabricante=r["marca"].strip().title(),
                        volume_ml=None, embalagem=None, unidades=1, codigo_unidade=None, imagem=arq, fonte="Catálogo de imagens (Prezunic)")

# ---------- fotos do nosso catálogo (backup) ----------
ACEITOS = {"correspondencia_gtin", "correspondencia_nome", "referencia_garrafa_para_dose", "referencia_unidade_para_caixa", "conferir_volume"}
bk = ler_csv(f"{UP}/imagens_backup/Catalogo_Completo_Bebs.csv")
prod_img, recusados = [], collections.Counter()
for r in bk:
    if not r["arquivo_imagem"]: continue
    if r["status"] not in ACEITOS: recusados[r["status"]] += 1; continue
    arq = foto(f"{UP}/imagens_backup/{r['arquivo_imagem']}")
    if not arq: continue
    prod_img.append(dict(legado_id=r["id"], imagem=arq, status=r["status"]))
    cod = r["codigo_fonte"].strip()
    if r["status"] == "correspondencia_gtin" and cod.isdigit():
        img_por_codigo.setdefault(cod, arq)
        if cod in ref and not ref[cod]["imagem"]: ref[cod]["imagem"] = arq
        elif cod not in ref and r["produto_fonte"].strip():
            ref[cod] = dict(codigo=cod, nome=r["produto_fonte"].strip(), categoria=r["categoria"], categoria_fonte=r["categoria"], fabricante="",
                            volume_ml=None, embalagem=None, unidades=1, codigo_unidade=None, imagem=arq, fonte="Catálogo de imagens do backup")
# pack herda a foto da unidade
for r in ref.values():
    if not r["imagem"] and r["codigo_unidade"] and ref[r["codigo_unidade"]]["imagem"]:
        r["imagem"] = ref[r["codigo_unidade"]]["imagem"]

json.dump(list(ref.values()), open(f"{OUT}/referencia.json", "w"), ensure_ascii=False)
json.dump(prod_img, open(f"{OUT}/produtos_imagens.json", "w"), ensure_ascii=False)
json.dump(img_por_codigo, open(f"{OUT}/imagens_por_codigo.json", "w"), ensure_ascii=False)
print("referência:", len(ref), "· com foto:", sum(1 for r in ref.values() if r["imagem"]), "· packs ligados à unidade:", sum(1 for r in ref.values() if r["codigo_unidade"]))
print("fotos de produtos (backup) aceitas:", len(prod_img), "· recusadas (pedir conferência):", dict(recusados))
print("arquivos de foto reduzidos:", len(set(v for v in fotos.values() if v)), "· tamanho total KB:", sum(os.path.getsize(f"{OUT}/img/{f}") for f in os.listdir(f"{OUT}/img")) // 1024)
for r in list(ref.values())[:3]: print(r)
