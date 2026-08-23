# MEMORY

## Estado verificado — 2026-08-22

- Cérebro principal: `openai-codex/gpt-5.6-sol`, autenticado por OAuth de dispositivo.
- Chamada direta do Hermes respondeu `HERMES_CODEX_OK`; API compatível com OpenAI respondeu `API_CODEX_OK`.
- Serviços de usuário ativos: gateway, dashboard em `127.0.0.1:9119`, Workspace em `127.0.0.1:3000` e n8n em `127.0.0.1:5678`.
- Runtime ativo: `/home/dr/.hermes/hermes-agent`; clones de desenvolvimento ficam em `/home/dr/projetos`.
- Skills Claude são referenciadas por `skills.external_dirs=['/home/dr/.claude/skills']`; não duplicar o catálogo.
- n8n 2.32.5 roda no Node NVM v24 com proprietário local, 2 credenciais criptografadas e 2 workflows publicados.
- O caminho n8n → Hermes → Codex foi testado; `hermes-ask` exige autenticação por cabeçalho e rejeita chamadas anônimas com `403`.
- Compressor do Hermes usa limiar de 50%, cauda enxuta de 3 pedidos e revisão de fundo em modelo gratuito via OpenRouter.

## Ambiente

- Host `Tijolão`: Linux Mint 22.3, 4 threads e 7,6 GiB de RAM. RAM é o principal limite.
- Serviços pessoais escutam apenas em `127.0.0.1`, salvo ordem explícita posterior.
- Código fica em `/home/dr/projetos`; estado do Hermes fica em `/home/dr/.hermes`.

## Decisões

- Contexto compartilhado vem de `/home/dr/projetos/tijolao-ai/context/OPERATOR.md`, por cópias curadas.
- Não ingerir histórico, débitos ou auto-memory em massa e não criar symlinks novos de configuração.
- Interface preferida: `hermes-workspace`; `hermes-webui` não roda em paralelo.
- n8n permanece nativo via systemd enquanto a versão instalada for suportada e estável.
- Recursos nativos do Hermes são a rota padrão para economia de tokens; adicionar frameworks ou banco vetorial exige ganho medido.
- O MCP quebrado `agentbridge` foi removido; só deve voltar com endpoint MCP válido.

## Pendências

- Inventariar a configuração real do HARPA antes de versioná-la.
