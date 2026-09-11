import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(process.cwd());
const required = [
  "package.json",
  ".env.example",
  "app/layout.tsx",
  "app/login/page.tsx",
  "app/(app)/pdv/page.tsx",
  "app/(app)/vendas/page.tsx",
  "app/(app)/codigos/page.tsx",
  "app/(app)/consulta-preco/page.tsx",
  "app/(app)/recebimento/page.tsx",
  "app/(app)/inventario/page.tsx",
  "app/(app)/estoque/page.tsx",
  "app/(app)/garrafas/page.tsx",
  "app/(app)/clientes/page.tsx",
  "app/(app)/financeiro/page.tsx",
  "app/(app)/caixa/page.tsx",
  "app/(app)/compras/page.tsx",
  "app/(app)/alertas/page.tsx",
  "app/(app)/auditoria/page.tsx",
  "app/(app)/implantacao/page.tsx",
  "app/(app)/resumo-dia/page.tsx",
  "app/api/integrations/orders/route.ts",
  "lib/supabase/client.ts",
  "components/ui/number-input.tsx",
  "components/products/product-form.tsx",
  "supabase/migrations/001_initial_schema.sql",
  "supabase/migrations/002_client_catalog.sql",
  "supabase/migrations/003_mega_update_v2.sql",
  "supabase/migrations/004_operacao_pro_v21.sql",
  "data/catalogo-bebs.json",
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Arquivo obrigatório ausente: ${file}`);
}

let packageJson = null;
for (const file of ["package.json", "tsconfig.json"]) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
    if (file === "package.json") packageJson = parsed;
  } catch (error) {
    failures.push(`JSON inválido em ${file}: ${error.message}`);
  }
}
if (packageJson?.version !== "2.1.2") failures.push(`package.json deveria estar na versão 2.1.2, encontrado ${packageJson?.version || "indefinido"}.`);

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) sourceFiles.push(full);
  }
}
walk(root);

const localImport = /from\s+["'](@\/[^"']+|\.\.?\/[^"']+)["']/g;
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  let match;
  while ((match = localImport.exec(content))) {
    const spec = match[1];
    const base = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(file), spec);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) failures.push(`Import local não encontrado em ${path.relative(root, file)}: ${spec}`);
  }
}

try {
  const require = createRequire(import.meta.url);
  let ts;
  try { ts = require("typescript"); }
  catch { ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js"); }
  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    try {
      const result = ts.transpileModule(content, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.Preserve,
        },
        fileName: file,
        reportDiagnostics: true,
      });
      for (const diagnostic of result.diagnostics || []) {
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
          failures.push(`Erro de sintaxe em ${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
        }
      }
    } catch (error) {
      failures.push(`Falha ao analisar ${path.relative(root, file)}: ${error.message}`);
    }
  }
} catch (error) {
  failures.push(`Não foi possível executar a verificação de sintaxe: ${error.message}`);
}

// Regressões que já quebraram deploys anteriores.
const allSource = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
if (/\bCashRegister\b/.test(allSource)) failures.push("Regressão: CashRegister voltou a ser importado/usado.");
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
if (css.includes("bg-panel-2/80")) failures.push("Regressão: classe Tailwind inválida bg-panel-2/80 encontrada.");

// Patch v2.1.2: campos numéricos, dose e ausência de catálogos externos.
for (const file of sourceFiles) {
  const relative = path.relative(root, file);
  const content = fs.readFileSync(file, "utf8");
  if ((relative.startsWith("app/") || relative.startsWith("components/")) && /type=["']number["']/.test(content)) {
    failures.push(`Campo numérico legado encontrado em ${relative}. Use NumberInput para evitar zeros durante a digitação.`);
  }
}
if (!allSource.includes("generateInternalCode")) failures.push("Patch v2.1.2: gerador de código interno ausente.");
if (!allSource.includes("doseSourceProductId")) failures.push("Patch v2.1.2: Produto Dose vinculado à garrafa ausente.");
const forbiddenCatalogTokens = ["cosmos.bluesoft", "openfoodfacts", "api.cosmos", "verified by gs1"];
for (const token of forbiddenCatalogTokens) {
  if (allSource.toLowerCase().includes(token)) failures.push(`Patch v2.1.2 não deve incluir catálogo externo de EAN: ${token}.`);
}

// Catálogo esperado.
try {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalogo-bebs.json"), "utf8"));
  const products = Array.isArray(catalog?.products) ? catalog.products : Array.isArray(catalog) ? catalog : [];
  const combos = Array.isArray(catalog?.combos) ? catalog.combos : [];
  if (products.length && products.length !== 146) failures.push(`Catálogo: esperado 146 produtos-base, encontrado ${products.length}.`);
  if (combos.length && combos.length !== 17) failures.push(`Catálogo: esperado 17 combos, encontrado ${combos.length}.`);
} catch (error) {
  failures.push(`Não foi possível validar data/catalogo-bebs.json: ${error.message}`);
}

if (failures.length) {
  console.error("\nFalhas encontradas:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`Projeto v2.1.2 verificado: ${sourceFiles.length} arquivos TypeScript/TSX, imports locais, JSON, campos numéricos, dose/garrafas e regressões conhecidas sem erros.`);
