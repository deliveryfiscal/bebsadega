# Beb's Gestão v2.1.6 — Correções PDV, Vendas, Relatórios e Caixa

Base obrigatória: **v2.1.5 — Funcionários & Consumo**.

Este é um patch incremental. Não contém o projeto inteiro e não exige nova migration SQL.

## 1. PDV / leitor de código de barras

- O campo grande **BIPE AQUI** agora é o próprio campo real do leitor.
- Enter e Tab enviados pelo scanner finalizam a leitura diretamente no campo grande.
- O PDV mantém captura HID quando o leitor é usado sem foco em um campo.
- O último código lido mostra o produto encontrado.
- Existe o botão **Produto errado?** ao lado do último bip para abrir a correção de vínculo.
- O PDV não escolhe mais silenciosamente o primeiro produto quando o mesmo código estiver vinculado a mais de um cadastro.
- Se existir duplicidade, a venda é bloqueada e o sistema mostra quais produtos estão usando o código.

## 2. Correção de códigos vinculados ao produto errado

Na tela **Cadastrar códigos** existe a opção **Código abrindo produto errado**.

Fluxo:

1. Bipar o código problemático.
2. Conferir para qual produto ele está apontando atualmente.
3. Escolher o produto correto.
4. Confirmar com PIN gerencial.
5. O código é movido atomicamente para o produto correto e a ação fica registrada na auditoria.

A correção preserva multiplicador e tipo da embalagem quando já existirem no vínculo anterior.

## 3. Vendas — controle completo

A tela Vendas foi reconstruída para permitir conferência operacional real.

Filtros disponíveis:

- período inicial e final;
- atalhos Hoje / 7 dias / 30 dias / Este mês / Todo período;
- status: concluída, cancelada ou excluída;
- canal: Balcão, iFood ou 99Food;
- forma de pagamento;
- operador;
- valor mínimo e máximo;
- busca por número da venda, cliente, produto, operador ou motivo.

Indicadores respeitam o filtro atual:

- faturamento;
- vendas concluídas;
- ticket médio;
- descontos;
- canceladas e excluídas.

Tabela mostra:

- número;
- data/hora;
- operador;
- canal;
- cliente;
- itens;
- pagamento;
- desconto;
- total;
- status;
- ações.

Exportação:

- **CSV** do recorte filtrado;
- **PDF / Imprimir** abre relatório formatado e permite usar “Salvar como PDF” no navegador.

## 4. Exclusão de venda

A exclusão não apaga o histórico do sistema.

Ao excluir:

- motivo é obrigatório;
- a venda passa para status **Excluída**;
- data, operador e motivo permanecem gravados;
- se a venda ainda estava concluída, estoque/ml são devolvidos;
- financeiro da venda é estornado;
- movimentação de dinheiro físico é removida quando aplicável;
- não ocorre estorno duplo se a venda já estava cancelada;
- auditoria mantém o registro da exclusão.

Cancelamento e exclusão continuam sendo ações diferentes.

## 5. Exclusão de produto

Foi adicionada exclusão segura de produto.

- exige motivo;
- exige PIN gerencial;
- não apaga vendas antigas;
- remove o produto da operação/PDV;
- libera os códigos vinculados para uso futuro;
- bloqueia a exclusão se o produto ainda for fonte de Produto Dose ou componente ativo de combo;
- histórico e motivo ficam na auditoria.

Produtos excluídos podem ser consultados pelo filtro **Excluídos**.

## 6. Consumo direto pelo PDV

Com itens no carrinho, agora existe o botão **Consumo**.

Fluxo:

1. Bipar ou adicionar os produtos normalmente no PDV.
2. Clicar em **Consumo**.
3. Escolher Roberto ou outro funcionário ativo.
4. Escolher Consumo da casa ou Descontar do funcionário.
5. Confirmar.

O consumo:

- baixa estoque;
- funciona também com vendas em ml;
- atualiza Garrafas Abertas;
- não cria venda;
- não entra no faturamento;
- não movimenta caixa;
- usa a estrutura de consumo interno da v2.1.5.

## 7. Relatórios de vendas

A tela Relatórios agora usa filtros de período, canal, pagamento, operador e busca.

Inclui:

- faturamento;
- vendas;
- ticket médio;
- CMV estimado usando o custo histórico gravado na venda;
- lucro bruto estimado;
- canceladas/excluídas do período;
- valores por forma de pagamento;
- desempenho por canal;
- ranking de produtos;
- desempenho por operador;
- vendas detalhadas;
- consumo interno do mesmo período;
- exportação CSV;
- impressão / salvar em PDF.

## 8. Fechamento de caixa

O fechamento agora congela um resumo da sessão para consulta futura.

No fechamento aparecem:

- quantidade de vendas;
- faturamento do turno;
- dinheiro esperado;
- PIX;
- débito;
- crédito;
- outras formas;
- descontos;
- canceladas;
- excluídas;
- sangrias;
- suprimentos;
- dinheiro contado;
- diferença.

Se houver diferença, a justificativa é obrigatória.

Também foi adicionada a seção **Fechamentos anteriores**, com:

- filtro por data;
- tabela de conferência;
- detalhes do fechamento;
- movimentos do turno;
- CSV;
- imprimir / salvar PDF do fechamento.

## 9. Persistência

Os novos campos ficam dentro do `company_state` já utilizado pelo sistema. Portanto, este patch não cria migration nova.

A sequência SQL continua até o `007` já aplicado anteriormente.

## 10. Validação executada

- verificador estrutural do projeto;
- sintaxe TS/TSX via TypeScript transpile;
- imports locais;
- regressões conhecidas;
- catálogo v2.1.4 preservado;
- funcionários/consumo preservados;
- testes da resolução de código de barras: código único, duplicidade e bloqueio de ambiguidade;
- reconstrução do patch sobre uma base limpa v2.1.5 antes da entrega.

Versão do projeto: **2.1.6**.
