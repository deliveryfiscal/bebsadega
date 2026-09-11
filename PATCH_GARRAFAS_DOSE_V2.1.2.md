# Beb's Gestão v2.1.2 — Garrafas & Dose

Patch incremental para **Beb's Gestão v2.1 + Persistência v2.1.1**.

> O patch **Operação Turbo v2.2 foi descartado e não faz parte desta entrega**.

## Instalação

1. Use como base o projeto v2.1 com o patch de persistência v2.1.1 já aplicado.
2. Extraia este patch na raiz do projeto, preservando as pastas, e permita substituir os arquivos existentes.
3. Não há migration SQL nova neste patch. O banco deve continuar com as migrations `001` a `005` já aplicadas.
4. Faça novo deploy na Vercel.

## O que mudou

### Código interno automático
- Botão **Gerar código** no cadastro/edição de produto.
- Gera um código interno aleatório de 4 dígitos, entre 1000 e 9999.
- Verifica todos os códigos já usados antes de aceitar o novo código.
- O código interno funciona no PDV como qualquer outro código cadastrado.
- Nenhuma consulta externa de EAN/GTIN foi adicionada.

### Garrafas vendidas inteiras ou em ml
- Todo produto do tipo **Garrafa** (`volume`) pode ser vendido inteiro ou fracionado.
- Ao clicar/bipar uma garrafa unitária no PDV, o sistema pergunta se será **garrafa inteira** ou **venda em ml**.
- Venda em ml sempre pergunta:
  - quantidade servida em ml;
  - valor cobrado naquela dose.
- O valor é livre: doses com a mesma bebida podem ter ml e preços diferentes.

### Controle automático de garrafa aberta
- `estoque de garrafas fechadas × volume da garrafa + ml da garrafa aberta = total disponível em ml`.
- Na primeira venda em ml, uma garrafa fechada é aberta automaticamente.
- O sistema consome primeiro a garrafa aberta.
- Se a dose ultrapassar o restante da aberta, termina essa garrafa, abre a próxima e continua a baixa automaticamente.
- Não permite vender volume maior que o total disponível.
- Entrada, inventário e ajustes das garrafas fechadas refletem imediatamente no total disponível em ml.

### Produto Dose
- Novo modo **Produto Dose**, usado como atalho comercial para uma garrafa.
- Produto Dose não possui estoque nem custo independentes.
- Ao vender, o operador informa ml e valor; a baixa acontece diretamente na garrafa vinculada.
- Produto Dose não entra em entrada de estoque, inventário, compra ou alerta de estoque baixo como produto independente.

### Garrafas e doses
- A página Garrafas agora mostra todos os produtos do tipo garrafa, inclusive os que ainda não possuem garrafa aberta.
- Mostra garrafas fechadas, ml equivalentes nas fechadas, ml na aberta, nível da aberta e total disponível em ml.
- Conferência manual de uma garrafa que ainda não estava aberta transforma uma unidade fechada em aberta, evitando duplicar o volume.
- Perdas em ml usam primeiro a garrafa aberta e abrem outra apenas se necessário.

### Cancelamento de dose
- O cancelamento devolve ao estoque a quantidade de ml vendida.
- A reversão é feita por diferença/movimentação, de forma que cancelar uma venda antiga não apague vendas ou entradas que aconteceram depois dela.

### Campos numéricos
- Criado `NumberInput` reutilizável e aplicado aos campos numéricos das telas operacionais.
- Zero deixa de ficar preso no campo enquanto o usuário tenta digitar.
- Campo zerado pode aparecer vazio durante a edição.
- Ao focar um valor já existente, ele é selecionado para substituição rápida.
- Aceita vírgula ou ponto em valores decimais.
- Usa teclado decimal/numeral adequado em celular e tablet.
- Aplicado a preço, custo, estoque, quantidade, ml, desconto, pagamentos, caixa, compras, financeiro, cashback, inventário e recebimento.

## Não incluído neste patch

- Cosmos / Bluesoft.
- GS1.
- Open Food Facts.
- Qualquer lista externa de EAN/GTIN.
- Busca automática de nome, imagem ou peso pelo código de barras.

Essas funções ficaram deliberadamente fora deste patch para uma etapa futura.

## Testes operacionais recomendados após o deploy

1. Criar um produto sem EAN e clicar em **Gerar código**; salvar, atualizar a página e confirmar que o produto/código permanecem.
2. Criar ou editar uma garrafa de 1.000 ml com estoque 3; confirmar que Garrafas mostra 3.000 ml.
3. No PDV, vender 70 ml por um valor livre; confirmar 2 fechadas + 930 ml na aberta.
4. Vender mais 100 ml; confirmar 830 ml na aberta.
5. Testar uma dose que atravesse duas garrafas.
6. Cancelar uma venda por ml e confirmar que os ml retornam sem desfazer operações posteriores.
7. Criar Produto Dose, vincular a uma garrafa e vender pelo atalho.
8. Testar preço/custo/estoque digitando diretamente sobre campos que estavam zerados.

