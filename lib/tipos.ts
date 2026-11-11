export type Papel = "dono" | "atendente";

export type Funcionario = {
  id: string;
  nome: string;
  usuario: string;
  papel: Papel;
  ativo: boolean;
  criado_em: string;
};

export type Produto = {
  id: string;
  nome: string;
  categoria: string;
  tipo: "unidade" | "combo";
  preco: number;
  custo: number;
  estoque: number;
  estoque_minimo: number;
  favorito: boolean;
  ativo: boolean;
  arquivado: boolean;
  sku: string | null;
  atualizado_em: string;
};

export type Codigo = {
  codigo: string;
  produto_id: string;
  multiplicador: number;
  descricao: string;
};

export type ComboItem = { combo_id: string; produto_id: string; quantidade: number };

export type Caixa = {
  id: string;
  status: "aberto" | "fechado";
  aberto_em: string;
  aberto_por_nome: string;
  valor_abertura: number;
  fechado_em: string | null;
  fechado_por_nome: string | null;
  valor_esperado: number | null;
  valor_contado: number | null;
  diferenca: number | null;
  observacao: string | null;
};

export type ResumoCaixa = {
  vendas: number;
  total_vendas: number;
  canceladas: number;
  dinheiro: number;
  pix: number;
  debito: number;
  credito: number;
  outro: number;
  sangrias: number;
  suprimentos: number;
  dinheiro_esperado: number;
  diferenca?: number;
};

export type FormaPagamento = "dinheiro" | "pix" | "debito" | "credito" | "outro";

export type Venda = {
  id: string;
  numero: number;
  criado_em: string;
  caixa_id: string | null;
  funcionario_nome: string;
  subtotal: number;
  desconto: number;
  total: number;
  troco: number;
  status: "concluida" | "cancelada";
  cancelada_em: string | null;
  cancelada_por_nome: string | null;
  motivo_cancelamento: string | null;
  dispositivo: string | null;
  venda_itens?: VendaItem[];
  venda_pagamentos?: { forma: FormaPagamento; valor: number }[];
};

export type VendaItem = {
  produto_id: string | null;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  total: number;
};

export type ItemCarrinho = {
  produto_id: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
};

export type Consumo = {
  id: string;
  numero: number;
  criado_em: string;
  funcionario_nome: string;
  registrado_por_nome: string;
  observacao: string | null;
  valor_referencia: number;
  status: "ativo" | "cancelado";
  consumo_itens?: { nome: string; quantidade: number; preco_referencia: number }[];
};
