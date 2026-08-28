import type { AppState } from "./types";
import { clientCatalog } from "./catalog-data";


export const demoState: AppState = {
  products: clientCatalog,
  customers: [
    { id: "c_rafael", name: "Rafael Oliveira", phone: "(11) 97527-0632", email: "rafael.oliveira@email.com", birthDate: "1986-07-15", notes: "Prefere destilados e promoções de cerveja.", consentMarketing: true, createdAt: "2024-03-12T10:00:00.000Z" },
    { id: "c_juliana", name: "Juliana Castro", phone: "(11) 98811-2040", email: "juliana@email.com", consentMarketing: true, createdAt: "2024-04-03T10:00:00.000Z" },
    { id: "c_carlos", name: "Carlos Almeida", phone: "(11) 97730-9010", consentMarketing: false, createdAt: "2024-04-18T10:00:00.000Z" },
  ],
  sales: [],
  cashSession: {
    id: "cash_demo",
    status: "open",
    openedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    openingAmount: 150,
    operator: "Pedro Silva",
    movements: [{ id: "mov_open", type: "opening", amount: 150, description: "Abertura de caixa", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), operator: "Pedro Silva" }],
  },
  financialEntries: [
    { id: "f_rent", type: "expense", category: "Aluguel", description: "Aluguel da loja", amount: 2500, date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString() },
    { id: "f_energy", type: "expense", category: "Energia", description: "Conta de energia", amount: 680.4, date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() },
  ],
  suppliers: [
    { id: "s1", name: "Distribuidora BEB+", document: "00.000.000/0001-01", phone: "(11) 4000-1000" },
    { id: "s2", name: "Tabacaria Central", document: "00.000.000/0001-02", phone: "(11) 4000-2000" },
  ],
  purchases: [],
  integrations: [
    { platform: "iFood", enabled: false, accountName: "Beb's Adega e Tabacaria", commissionRate: 23 },
    { platform: "99Food", enabled: false, accountName: "Beb's Adega e Tabacaria", commissionRate: 20 },
  ],
  auditLogs: [],
  company: { name: "Beb's Adega e Tabacaria", phone: "(11) 97527-0632", document: "", address: "" },
};
