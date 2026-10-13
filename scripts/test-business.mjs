import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = new URL("../lib/business.ts", import.meta.url);
const ts = require("typescript");
const result = ts.transpileModule(fs.readFileSync(fileURLToPath(root), "utf8"), {
  fileName: "business.ts",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.ok(!(result.diagnostics || []).some((d) => d.category === ts.DiagnosticCategory.Error), "typescript sem erros");
const runtime = { exports: {} };
new Function("module", "exports", "require", result.outputText)(runtime, runtime.exports, require);
const {
  calculateCart, applyCartToStock, restoreCartToStock, lowStockProducts,
  dashboardMetrics, comboAvailability, findBarcodeMatches,
} = runtime.exports;

const unit = (id, extra = {}) => ({
  id, name: id, kind: "unit", barcode: "", barcodes: [], sku: id,
  stock: 10, minStock: 2, cost: 5, price: 10, active: true,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  ...extra,
});
const bottle = (id, extra = {}) => unit(id, {
  kind: "volume", bottleVolumeMl: 1000, openVolumeMl: 0, stock: 1,
  cost: 40, price: 80, ...extra,
});
const cart = (p, quantity = 1, mode = "unit", doseMl) => ({
  id: "cart-test", productId: p.id, name: p.name, mode,
  quantity, unitPrice: 10, doseMl,
});
const fails = (fn, snippet) =>
  assert.throws(fn, (error) => error instanceof Error && error.message.includes(snippet), snippet);

// Carrinho, precisão e validação de valores inválidos.
assert.deepEqual(calculateCart([cart(unit("a"), 2)], 2), { subtotal: 20, discount: 2, total: 18 });
fails(() => calculateCart([cart(unit("a"), -1)]), "Quantidade");
fails(() => calculateCart([cart(unit("a"), 1)], Number.NaN), "Desconto");

// Um item excluído ou inativo jamais sai em uma venda nova.
const deleted = unit("deleted", { deletedAt: "2026-10-01", active: false, stock: 9 });
fails(() => applyCartToStock([deleted], [cart(deleted)]), "indisponível");
const disabled = unit("disabled", { active: false });
fails(() => applyCartToStock([disabled], [cart(disabled)]), "indisponível");

// Baixa de doses exige ml válidos: 0/ausente não pode virar venda de garrafa inteira.
const vodka = bottle("vodka");
fails(() => applyCartToStock([vodka], [cart(vodka, 1, "dose")]), "ml");
fails(() => applyCartToStock([vodka], [cart(vodka, 1, "dose", 0)]), "ml");
fails(() => applyCartToStock([vodka], [cart(vodka, 1, "dose", -10)]), "ml");
const afterDose = applyCartToStock([vodka], [cart(vodka, 1, "dose", 50)]);
assert.equal(afterDose[0].stock, 0);
assert.equal(afterDose[0].openVolumeMl, 950);
const reverted = restoreCartToStock(afterDose, [cart(vodka, 1, "dose", 50)]);
assert.equal(reverted[0].stock, 1);
assert.equal(reverted[0].openVolumeMl, 0);

// Venda em lote não permite atravessar estoque mesmo quando itens repetem produto.
const soda = unit("soda", { stock: 3 });
fails(() => applyCartToStock([soda], [cart(soda, 2), cart(soda, 2)]), "Estoque insuficiente");

// Combo referenciando produto excluído é indisponível e não pode ser vendido.
const combo = unit("combo", { kind: "combo", comboItems: [{ productId: "deleted", quantity: 1 }] });
assert.equal(comboAvailability(combo, [combo, deleted]).available, 0);
fails(() => applyCartToStock([combo, deleted], [cart(combo, 1, "combo")]), "Produto excluído");

// Alertas e valor de estoque não devem contar produtos excluídos.
assert.deepEqual(lowStockProducts([unit("ok", { stock: 0 }), unit("old", { stock: 0, deletedAt: "2026-10-01" })]).map((p) => p.id), ["ok"]);
const metrics = dashboardMetrics({
  products: [unit("keep", { stock: 2, cost: 3 }), deleted, bottle("open", { stock: 0, openVolumeMl: 500, cost: 40 })],
  sales: [], financialEntries: [],
});
assert.equal(metrics.inventoryValue, 26);

// Busca de EAN exclui produtos apagados, evitando abrir o item errado.
const oldProduct = unit("oldbarcode", { barcode: "7890000000001", deletedAt: "2026-10-01" });
const validProduct = unit("valid", { barcode: "7890000000001" });
assert.deepEqual(findBarcodeMatches([oldProduct, validProduct], "7890000000001").map((v) => v.product.id), ["valid"]);

console.log("✓ Testes de lógica: estoque, doses, combos, exclusões, valores, estorno, códigos e valuation.");
