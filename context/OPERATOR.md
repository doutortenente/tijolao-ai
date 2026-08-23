# Contexto canônico do operador

> Fonte neutra para Claude, Codex e Hermes. Atualizar fatos mutáveis com data de verificação.
> Histórico, débitos e auto-memory são referências sob demanda, não fatos atuais.

## Perfil

- Nícholas Nagaita ("Dr. Tenente") é médico intensivista em São José dos Campos/SP.
- É especialista em medicina e iniciante em engenharia de software desde março de 2026.
- Tem TDAH, dislexia e AH/SD.
- Objetivo central: usar software e IA para elevar segurança, precisão e execução clínica.

## Preferências

- Responder em português do Brasil e abrir pela conclusão.
- Traduzir cada termo de desenvolvimento na primeira aparição, em linguagem comum.
- Ser direto, rigoroso e sem bajulação, preâmbulo ou emoji.
- Recomendar uma opção principal; mostrar alternativas somente quando mudarem o resultado.
- Usar tabela para três ou mais itens comparáveis, lista para sequência e parágrafos curtos.
- Preferir números medidos; marcar fato não verificado como `[SEM_FONTE]`.
- Executar autonomamente o que foi autorizado e testar antes de declarar pronto.
- Perguntar apenas quando a decisão muda produto, escopo, custo ou irreversibilidade.
- Não imprimir tokens, chaves ou valores de arquivos `.env`.
## Ambiente

- Última verificação: 2026-08-22.
- Host: `Tijolão`, Linux Mint 22.3, 4 threads e 7,6 GiB de RAM.
- RAM é o principal gargalo; evitar duas IDEs JetBrains simultâneas e limitar paralelismo.
- Repositórios de código ficam em `/home/dr/projetos`.
- Estado e runtime ativo do Hermes ficam em `/home/dr/.hermes`.
- Node é contextual: NVM interativo usa v24.16.0; Hermes inclui Node v26.
- Confirmar `command -v node` antes de assumir o runtime.
- Serviços pessoais escutam apenas em `127.0.0.1`, salvo ordem explícita posterior.

## Projetos

- `/home/dr/projetos/tijolao-ai`: fonte declarativa desta pilha e do contexto compartilhado.
- `/home/dr/projetos/claude`: configuração e catálogo de skills/subagentes; preservar a worktree existente.
- `/home/dr/projetos/SASI-V3`: aplicação clínica ativa; regras específicas vivem no próprio repositório.
- `/home/dr/.hermes/hermes-agent`: instalação ativa; não tratar como clone descartável.
- `/home/dr/projetos/hermes-agent`: clone de desenvolvimento, com fork pessoal em `origin` e projeto oficial em `upstream`.
- `/home/dr/projetos/hermes-workspace`: interface escolhida; `hermes-webui` fica apenas como fallback.
- `/home/dr/vaults/celebro`: vault de conhecimento; conteúdo clínico não entra na memória global.

## Decisões

- 2026-08-20: `openai-codex/gpt-5.6-sol` é o cérebro principal do Hermes.
- 2026-08-22: contexto compartilhado passa a ser curado por projeção, sem importação bruta.
- 2026-08-22: skills Claude são referenciadas por `skills.external_dirs`; não duplicar o catálogo.
- 2026-08-22: não criar symlinks novos para configuração; gerar cópias explícitas.
- 2026-08-22: manter runtime Hermes em `~/.hermes` e código de desenvolvimento em `~/projetos`.
- 2026-08-22: usar `hermes-workspace` como interface; `hermes-webui` fica como fallback.
- 2026-08-22: manter n8n nativo via systemd enquanto a versão instalada for suportada e estável.
- 2026-08-22: n8n 2.32.5 integrado ao Hermes com webhook autenticado, credenciais criptografadas e backup/rollback SQLite.
- 2026-08-22: economizar tokens com recursos nativos do Hermes; não adicionar LangChain, LiteLLM ou banco vetorial sem ganho medido.
- 2026-08-22: compressor em 50% com cauda enxuta; revisão de fundo usa modelo gratuito via OpenRouter.
- 2026-08-22: remover o MCP `agentbridge` quebrado; só reativar com endpoint MCP válido.

## Pendências

- Inventariar a configuração real do HARPA antes de versioná-la.

## Projeções

- Codex global: `/home/dr/.codex/AGENTS.md`.
- Hermes — pessoa e comunicação: `/home/dr/.hermes/memories/USER.md`.
- Hermes — estado técnico e decisões: `/home/dr/.hermes/memories/MEMORY.md`.
- Claude mantém sua política própria; este arquivo fornece apenas fatos compartilhados.
