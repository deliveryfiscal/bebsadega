# Beb's Gestão v2.1.4 — Catálogo limpo + Bip Fácil + Checkout amplo

Base obrigatória: v2.1 + persistência v2.1.1 + garrafas/doses v2.1.2 + PIN v2.1.3 + SQL 006.

## Objetivo

Este patch substitui o catálogo operacional anterior pela lista consolidada fornecida em 13/09/2026, zera códigos e estoque para uma nova implantação física, simplifica o cadastro do leitor para um usuário com pouca familiaridade com tecnologia e libera mais espaço no PDV movendo o checkout para um popup grande.

## Catálogo

- 295 cadastros no total, incluindo produtos físicos, doses, copões, combos e a promoção de gelo.
- Estoque inicial: 0.
- Código de barras inicial: vazio.
- Custo inicial: 0.
- Produtos com preço explicitamente não confirmado ficam inativos e marcados para revisão.
- Azeitona e Calabresa preservam o primeiro preço informado e recebem observação com o segundo preço anotado para conferência.
- Doses com garrafa de origem inequívoca foram vinculadas à garrafa correspondente.
- Doses sem origem inequívoca ficam cadastradas, porém pendentes de vínculo antes de ativar.
- Copões ficam cadastrados com preço, porém pendentes porque a lista não informa quantos ml de cada destilado entram em cada receita. O sistema não inventa baixa de estoque.
- Combos ficam cadastrados com preço, porém pendentes quando a descrição usa componentes genéricos como “Red” ou “Energético 2 L”. A única promoção configurada automaticamente é Gelo comum 3 por R$ 26,00, pois a composição é inequívoca.

## Cadastro de códigos — Bip Fácil

A tela agora segue um único fluxo principal:

1. O sistema mostra em letras grandes o **Produto da vez**.
2. O dono pega esse produto na prateleira.
3. Bipa uma vez.
4. O código é salvo automaticamente.
5. O próximo produto aparece sozinho.

Também existem três botões grandes: **Produto sem código / Gerar 4 dígitos**, **Escolher outro produto** e **Pular por enquanto**. Cadastro de caixa/pack continua disponível, mas fica escondido em “Código de caixa/pack (opcional)” para não confundir a operação comum.

## PDV

O checkout lateral foi removido. A área principal ficou dedicada aos produtos e ao scanner.

Na parte inferior existe apenas uma barra compacta com quantidade de itens, cliente, total e o botão **Avançar / Checkout**. Ao avançar, abre um popup grande com:

- itens da venda e alteração de quantidade;
- cliente;
- desconto;
- subtotal e total;
- Dinheiro, PIX, Débito e Crédito;
- pagamento dividido;
- dinheiro recebido e troco;
- confirmação final.

O atalho F9 também abre esse checkout.

## SQL 007 — obrigatório uma única vez

Execute `supabase/migrations/007_catalogo_pdv_bip_facil_v214.sql` depois de publicar os arquivos.

Ele altera apenas o catálogo dentro de `company_state`, limpa vendas suspensas antigas que apontavam para IDs do catálogo anterior e preserva clientes, histórico de vendas, financeiro, caixa, fornecedores e auditorias.

O SQL define `catalogRevision = bebs-catalog-2026-09-13-v214`. O código da v2.1.4 usa essa revisão para impedir que um cache antigo do navegador sobrescreva o catálogo novo após o reset.

Ao final do SQL a consulta deve retornar `total_produtos = 295`.

## Ordem atual das migrations

001 → 002 → 003 → 004 → 005 → 006 → 007
