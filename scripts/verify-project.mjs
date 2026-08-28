import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(process.cwd());
const required = [
  "package.json",
  "app/layout.tsx",
  "app/(app)/pdv/page.tsx",
  "app/(app)/vendas/page.tsx",
  "app/(app)/codigos/page.tsx",
  "app/(app)/recebimento/page.tsx",
  "app/(app)/estoque/page.tsx",
  "app/(app)/clientes/page.tsx",
  "app/(app)/financeiro/page.tsx",
  "app/(app)/caixa/page.tsx",
  "app/api/integrations/orders/route.ts",
  "supabase/migrations/001_initial_schema.sql",
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Arquivo obrigatório ausente: ${file}`);
}

for (const file of ["package.json", "tsconfig.json"]) {
  try { JSON.parse(fs.readFileSync(path.join(root, file), "utf8")); }
  catch (error) { failures.push(`JSON inválido em ${file}: ${error.message}`); }
}

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next"].includes(entry.name)) continue;
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

if (failures.length) {
  console.error("\nFalhas encontradas:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`Projeto verificado: ${sourceFiles.length} arquivos TypeScript/TSX, imports locais e JSON sem erros de sintaxe.`);
