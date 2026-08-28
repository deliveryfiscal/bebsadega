# Beb's Gestão v1.5 — Mega Update Operacional

## Objetivo

A versão 1.5 foi focada em velocidade de operação de balcão e implantação física da loja. O principal ponto é o cadastro em massa de códigos de barras com o leitor A4003 sem exigir digitação repetitiva.

## Nova aba: Códigos de barras

Rota: `/codigos`

### Fila rápida

Fluxo recomendado para implantar os códigos da loja inteira:

1. O sistema mostra um produto sem código em destaque.
2. O operador pega esse produto físico.
3. Bipa uma vez com o A4003.
4. O código é salvo no produto automaticamente.
5. O sistema avança sozinho para o próximo item.
6. O campo do leitor volta a receber foco automaticamente.

Não é necessário clicar em "Salvar" a cada produto.

Recursos:
- progresso de implantação em porcentagem;
- total de produtos vinculados e pendentes;
- filtro por categoria;
- busca por nome/SKU/marca;
- avanço automático opcional;
- aviso sonoro de sucesso/erro quando permitido pelo navegador;
- validação de código duplicado;
- histórico dos últimos vínculos da sessão;
- desfazer vínculo errado com um clique;
- atalhos F2 (leitor) e F3 (busca).

### Bipar primeiro

Modo alternativo para quando os produtos estão fora da ordem da lista:

1. Bipe o produto físico.
2. O sistema identifica se o código já existe.
3. Se for novo, selecione o produto no catálogo.
4. Clique em vincular.

## Nova aba: Entrada rápida

Rota: `/recebimento`

Permite receber mercadorias utilizando o mesmo leitor:
- cada bip adiciona +1 unidade à entrada;
- bips repetidos acumulam quantidade;
- quantidade pode ser corrigida manualmente;
- exibe estoque atual e estoque após a entrada;
- calcula custo estimado da entrada;
- permite adicionar produto por busca caso necessário;
- confirma todos os itens de uma vez;
- gera auditoria da entrada em lote;
- não permite entrada direta de combos.

## Nova aba: Vendas

Rota: `/vendas`

Central operacional de vendas:
- busca por número, produto, cliente e pedido externo;
- filtro por status;
- filtro por Balcão, iFood e 99Food;
- detalhes completos da venda;
- visualização dos pagamentos;
- exportação CSV;
- cancelamento com motivo obrigatório;
- cancelamento devolve estoque;
- cancelamento remove o lançamento financeiro da venda;
- cancelamento remove o movimento em dinheiro do caixa quando aplicável;
- ação fica registrada na auditoria.

## PDV melhorado

Novos atalhos:
- F2: pesquisa de produtos;
- F3: campo do leitor de código de barras;
- F9: finalizar pagamento.

O comportamento de código desconhecido continua permitindo vincular um produto já cadastrado diretamente durante a venda.

## Estoque melhorado

A tela de estoque ganhou acesso direto à Entrada rápida. O inventário por bipagem continua disponível separadamente para contagem física.

## Produtos melhorado

A tela de produtos ganhou um botão direto para "Cadastrar códigos", levando ao fluxo em massa da nova aba.

## Dashboard melhorado

Foram adicionados atalhos operacionais para:
- Cadastrar códigos;
- Entrada rápida;
- Central de vendas.

O dashboard também mostra quantos produtos ainda não possuem código de barras.

## Regras novas de segurança operacional

- código de barras vazio é permitido durante implantação;
- código duplicado é bloqueado;
- combos não recebem código no fluxo de implantação padrão;
- ajustes de estoque exigem motivo;
- entrada de estoque em lote é validada antes da aplicação;
- cancelamento de venda exige motivo;
- movimentações de caixa exigem valor e descrição válidos;
- fechamento de caixa não aceita valor negativo.

## Observação sobre persistência

A interface continua compatível com o modo local existente no projeto. Para operação definitiva multiusuário, a fonte oficial de dados deve ser o Supabase, conforme a evolução prevista do projeto.
