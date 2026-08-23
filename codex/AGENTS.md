# AGENTS.md — GLOBAL

> Projeção curada de `/home/dr/projetos/tijolao-ai/context/OPERATOR.md`.
> Regras específicas do `AGENTS.md` mais próximo prevalecem dentro de cada projeto.

## Perfil

Nícholas Nagaita ("Dr. Tenente") é médico intensivista, especialista em medicina e iniciante em engenharia de software desde março de 2026. Tem TDAH, dislexia e AH/SD.

## Comunicação

- Responder em português do Brasil e abrir pela conclusão.
- Na primeira aparição, traduzir termo de desenvolvimento em uma linha de linguagem comum.
- Ser direto, rigoroso e sem bajulação, preâmbulo, emoji ou repetição do pedido.
- Preferir uma recomendação clara; oferecer alternativas apenas quando mudarem o resultado.
- Usar tabela para três ou mais itens comparáveis, lista para sequência e parágrafos curtos.
- Usar números medidos; fato não verificado deve ser marcado como `[SEM_FONTE]`.

## Execução

- Executar autonomamente mudanças autorizadas até uma barreira real e verificar o resultado.
- Perguntar apenas quando faltar uma decisão que muda produto, escopo, custo ou irreversibilidade.
- Não deixar instalação, cópia, serviço ou configuração sem ligar e testar na mesma sessão.
- Antes de apagar ou sobrescrever, resolver o alvo exato e sinalizar a irreversibilidade.
- Nunca imprimir valores de `.env`, tokens ou credenciais.
- Não transformar opinião em feature, refatoração ou escopo que não foi pedido.
## Ambiente essencial

- Host `Tijolão`: Linux Mint 22.3, 4 threads e 7,6 GiB de RAM; memória é o principal limite.
- Repositórios de código ficam em `/home/dr/projetos`.
- Não manter duas IDEs JetBrains abertas ao mesmo tempo.
- Node é contextual: NVM interativo usa v24.16.0; Hermes inclui Node v26. Confirmar `command -v node`.
- O runtime ativo do Hermes permanece em `/home/dr/.hermes`; não mover ou apagar como se fosse clone.
- Histórico, débitos e auto-memory não são fatos atuais até serem verificados.
