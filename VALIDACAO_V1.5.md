# Validação v1.5

Executada sobre o pacote final antes da compactação.

## Verificações aprovadas

- 32 arquivos TypeScript/TSX analisados pelo verificador interno;
- imports locais existentes;
- JSON do projeto válido;
- rotas `/codigos`, `/recebimento` e `/vendas` presentes e incluídas no menu;
- regressão `CashRegister` ausente;
- regressão `bg-panel-2/80` ausente;
- Next.js mantido em `15.2.6`, versão que já passou pelo bloqueio da Vercel na entrega anterior;
- versão do sistema atualizada para `1.5.0`;
- testes de regra de negócio aprovados: venda unitária, consumo por dose, combo, estorno de combo e cálculo de carrinho.

## Teste físico necessário na loja

O leitor A4003 precisa ser testado conectado ao computador da Beb's para confirmar o sufixo Enter e o modo HID/teclado. O sistema foi preparado para este comportamento padrão: leitura do código + Enter.

## Build

O ambiente de empacotamento não conseguiu instalar as dependências do npm dentro do limite disponível, portanto o `next build` completo deve ser executado pela Vercel após o commit. A verificação estática e os testes das regras de negócio foram concluídos antes da entrega.
