# Tijolão AI

Configuração declarativa e reproduzível do assistente pessoal de IA do Tijolão.

O repositório reúne somente o que deve ser versionado. Segredos, bancos, sessões, logs, caches e runtimes permanecem locais.

## Estado verificado

Em 2026-08-22:

- Hermes 0.20.5 usa `openai-codex/gpt-5.6-sol` como cérebro principal.
- Gateway, dashboard, Hermes Workspace e n8n rodam como serviços systemd do usuário.
- n8n 2.32.5 tem proprietário local, 2 credenciais criptografadas e 2 workflows publicados.
- Toda interface escuta apenas em `127.0.0.1`.
- O contexto compartilhado é curado; históricos brutos não são importados como memória.

## Componentes

| Componente | Papel | Endereço local |
|---|---|---|
| Hermes API | Agente e API compatível com OpenAI | `127.0.0.1:8642` |
| Hermes Dashboard | Estado e manutenção do Hermes | `127.0.0.1:9119` |
| Hermes Workspace | Interface principal | `127.0.0.1:3000` |
| n8n | Automações e webhooks | `127.0.0.1:5678` |
| claude-comandado | Servidor MCP que expõe o Claude Code a outros agentes | stdio, sem porta |

## Estrutura

- `context/`: fonte canônica compartilhada.
- `codex/` e `hermes/`: projeções específicas por agente.
- `n8n/`: ambiente de exemplo e workflows portáveis.
- `services/`: unidades systemd sem credenciais.
- `scripts/`: sincronização e verificação.
- `harpa/`: área reservada após inventário real.
- `claude-comandado/`: servidor MCP stdio que expõe o Claude Code como ferramenta
  para outros agentes, como o Grok Build. Não tem serviço systemd nem porta: o
  cliente MCP sobe o processo sob demanda. Ver `claude-comandado/README.md`.

## Aplicação

O script opera em modo de prévia por padrão:

```bash
./scripts/sync-context.sh
./scripts/sync-context.sh --apply
./scripts/install-n8n-integration.sh
```

O instalador do n8n cria um backup SQLite validado, configura o proprietário local,
importa credenciais e workflows, publica os webhooks e testa a chamada completa.
Em falha, restaura o banco anterior automaticamente.

Preencha arquivos de ambiente diretamente no host. Nunca copie valores secretos
para este repositório.

## Autenticação

O Hermes usa OAuth `openai-codex` como rota principal. `OPENAI_API_KEY` pode
existir apenas como fallback. Tokens da API, proprietário do n8n e autenticação
do webhook ficam fora do Git, em arquivos `0600`. O webhook `hermes-ask` exige
o cabeçalho secreto local; chamadas sem ele recebem `403`.

O `claude-comandado` não tem credencial própria: usa o login do Claude Code já
instalado na máquina. Nenhuma chave entra no repositório.

## Economia de tokens

Não foi instalada uma camada externa como LangChain, LiteLLM ou banco vetorial.
No host de 7,6 GiB, isso consumiria RAM sem eliminar o custo fixo do prompt.
O Hermes já fornece cache de prompt, compressor de contexto, busca FTS5 e
carregamento progressivo de ferramentas.

Configuração aplicada em 2026-08-22:

- compressão a 50%, em contexto, com cauda enxuta de 3 pedidos do usuário;
- poda proativa desativada para preservar o cache;
- revisão de fundo roteada ao modelo gratuito `nemotron-3-ultra-550b-a55b:free`;
- cache de prompt acumulado medido em 96,48%;
- carga fixa medida em 74.449 bytes por requisição, incluindo 17 ferramentas.

Audite sem exibir credenciais:

```bash
./scripts/audit-tokens.sh 7
```

## Verificação

```bash
./scripts/verify-stack.sh
./scripts/verify-stack.sh --deep
```

O teste normal confirma serviços, portas, webhooks, permissões, autenticação e o
handshake JSON-RPC do `claude-comandado`, sem exibir credenciais. `--deep` também
chama Hermes → Codex, n8n → Hermes → Codex e confere se o Claude Code responde
pelo servidor MCP. Nenhuma das checagens do `claude-comandado` invoca modelo.

## Publicação

O remoto canônico é privado. A publicação deve ocorrer por branch, pull request e
merge; arquivos ignorados e valores secretos nunca entram no commit.
