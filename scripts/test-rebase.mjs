import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../lib/rebase.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { rebaseSnapshot } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputText).toString("base64"));
const clone = (x) => JSON.parse(JSON.stringify(x));
const base = {
  products: [{id:"a",stock:4},{id:"b",stock:7}], customers:[],sales:[],suspendedSales:[],
  cashHistory:[],financialEntries:[],suppliers:[],purchases:[],auditLogs:[],employees:[],consumptions:[],
  integrations:[{platform:"iFood",enabled:false},{platform:"99Food",enabled:false}],
  company:{name:"Bebs"},scannerSettings:{},currentOperator:{name:"operador",role:"admin"},
  cashSession:{id:"cash",status:"open",movements:[],openingAmount:150}
};
const mine=clone(base), remote=clone(base);
mine.products[0].stock=3;
remote.products[1].stock=6;
mine.auditLogs.push({id:"local"});
remote.auditLogs.push({id:"remote"});
mine.currentOperator.name="PC 1";
let merged=rebaseSnapshot(base,mine,remote);
assert.deepEqual(merged.products.map(p=>p.stock),[3,6]);
assert.equal(merged.auditLogs.length,2);
assert.equal(merged.currentOperator.name,"PC 1");
remote.products[0].stock=2;
assert.equal(rebaseSnapshot(base,mine,remote),null);
const mCash=clone(base), rCash=clone(base);
mCash.cashSession.movements.push({id:"m",type:"sale",amount:4});
rCash.cashSession.movements.push({id:"r",type:"supply",amount:5});
assert.equal(rebaseSnapshot(base,mCash,rCash).cashSession.movements.length,2);
rCash.cashSession.status="closed";
assert.equal(rebaseSnapshot(base,mCash,rCash),null);
const aInt=clone(base),bInt=clone(base);
aInt.integrations[0].enabled=true;
bInt.integrations[1].enabled=true;
merged=rebaseSnapshot(base,aInt,bInt);
assert.equal(merged.integrations[0].enabled,true);
assert.equal(merged.integrations[1].enabled,true);
console.log("OK — rebase de registros independentes, conflitos e caixa.");