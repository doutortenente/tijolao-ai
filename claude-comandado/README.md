# claude-comandado

Servidor MCP (stdio) que expõe o **Claude Code** como ferramenta para o **Grok** — ou para
qualquer outro cliente MCP. Inverte a direção habitual: quem comanda é o Grok, quem executa
é o Claude, com acesso real ao disco da máquina.

Arquivo único, **zero dependências**, sem passo de build. Só precisa de Node 18+.

---

## Ferramentas expostas

| Ferramenta | O que faz | Escreve em disco? |
|---|---|---|
| `claude_perguntar` | Pergunta / análise / revisão de código. O Claude lê e pesquisa arquivos. | Não |
| `claude_tarefa` | Implementa, refatora, corrige, gera arquivos. | **Sim** (desligada por padrão) |
| `claude_continuar` | Continua uma sessão anterior pelo `session_id`, com todo o contexto. | Opcional |
| `claude_diagnostico` | Confere binário, autenticação e configuração. Chame primeiro se algo falhar. | Não |

Cada resposta volta com `sessao=<id>` e `custo_estimado_usd=<valor>`, para o Grok encadear
follow-ups e acompanhar gasto.

---

## Instalação

1. Coloque o `servidor.js` onde quiser na máquina. O caminho no `mcp.json` é placeholder:
   troque pelo caminho absoluto real do arquivo.
2. Confirme que o Claude Code está instalado e logado (`claude auth status`).
3. Registre o servidor no cliente MCP (abaixo).

Não há `npm install`.

## Configuração no Grok Build

O Grok Build lê `.mcp.json` e `claude_desktop_config.json` no mesmo formato do Claude Code.
Use o `mcp.json` de exemplo deste diretório, trocando os dois caminhos em MAIÚSCULAS:

```json
{
  "mcpServers": {
    "claude-comandado": {
      "command": "node",
      "args": ["/CAMINHO/ABSOLUTO/ATE/claude-comandado/servidor.js"],
      "env": {
        "CC_MCP_RAIZES": "/CAMINHO/QUE/O/AGENTE/PODE/LER",
        "CC_MCP_ESCRITA": "0"
      }
    }
  }
}
```

> Cuidado com onde esse arquivo de configuração mora. Se ele ficar dentro de um projeto em
> que o Claude Code também roda, o Claude carregaria este servidor e poderia chamar a si
> mesmo. O servidor já se protege disso (veja `CC_MCP_MCP_INTERNO`), mas o melhor é
> guardá-lo fora dos projetos.

---

## Variáveis de ambiente

| Variável | Padrão | Para que serve |
|---|---|---|
| `CC_MCP_RAIZES` | `/home/dr/projetos` | Diretórios liberados, separados por `:`. Qualquer caminho fora disso é recusado, inclusive via `..` e symlink. |
| `CC_MCP_ESCRITA` | `0` | `1` habilita `claude_tarefa`. Enquanto for `0`, o Grok não escreve nada. |
| `CC_MCP_TIMEOUT` | `900` | Segundos por chamada. Estourou, o processo é morto. |
| `CC_MCP_ORCAMENTO` | `2.00` | Teto de gasto em USD por chamada (`--max-budget-usd`). `0` desliga. |
| `CC_MCP_TURNOS` | `20` | Teto de turnos agênticos por chamada. `0` desliga. |
| `CC_MCP_MCP_INTERNO` | `0` | `1` deixa o Claude delegado usar os MCPs dele. Padrão isola, para não haver recursão. |
| `CC_MCP_BIN` | `claude` | Caminho do binário, se não estiver no PATH. |
| `CC_MCP_MODELO` | (o da máquina) | `sonnet`, `opus`, `haiku` ou `fable`. |
| `CC_MCP_SAIDA_MAX` | `40000` | Corte de caracteres na resposta, para não estourar o contexto do Grok. |

O padrão de `CC_MCP_RAIZES` é só um padrão: se o diretório não existir, o servidor recusa
todas as chamadas em vez de abrir alguma coisa por engano.

---

## Segurança — leia antes de ligar a escrita

Com `CC_MCP_ESCRITA=1`, um prompt vindo do Grok vira edição de arquivo na sua máquina, sem
ninguém confirmando. Se o Grok engolir uma instrução maliciosa de uma página web ou de um
repositório, ela chega aqui como tarefa legítima. As barreiras que existem:

- **Cerca de diretório**: `realpath` resolvido e comparado com `CC_MCP_RAIZES`. Fora dali, recusa.
- **Shell fechado por padrão**: em modo leitura o servidor usa `--permission-mode dontAsk`, que
  nega tudo fora do conjunto somente-leitura. Em modo escrita, comandos de shell só rodam se
  o chamador listar regras explícitas em `ferramentas_permitidas`.
- **Tetos**: turnos, orçamento em dólar e timeout, todos por chamada.
- **Sem injeção de shell**: o processo é criado com lista de argumentos, nunca via shell.
- **Isolamento de MCP**: o Claude delegado não herda os servidores MCP do projeto.

Recomendação: deixe em `0`, use `claude_perguntar`, e só ligue a escrita apontando
`CC_MCP_RAIZES` para um diretório descartável.

---

## Autenticação e custo

Sem a flag `--bare`, o Claude Code usa o login da sua **assinatura**. Não precisa de
`ANTHROPIC_API_KEY` nem de crédito de API. O `custo_estimado_usd` que volta em cada resposta
é a estimativa do próprio Claude Code, não a sua fatura.

## Testes

```bash
node testes/harness.js
```

41 checagens: handshake, negociação de protocolo (2025-03-26 até 2026-07-28), cerca de
diretório, bloqueio de escrita, continuação de sessão, timeout, binário ausente e o caminho
de repetição automática quando a versão instalada rejeita uma flag opcional.

**Limite honesto**: os testes rodam contra um Claude Code simulado, não contra o binário real.
O que foi verificado é o comportamento do servidor MCP; o que não foi verificado é a resposta
da sua instalação do Claude Code às flags. `claude_diagnostico` existe exatamente para isso.

## Pendente

As duas checagens deste servidor deveriam entrar em `scripts/verify-stack.sh`, junto com o
resto da pilha: o handshake JSON-RPC no teste normal e `claude_diagnostico` no `--deep`.
O código foi escrito e testado, mas não foi commitado: a API do GitHub grava todo arquivo
como `100644` e isso apagaria o bit de execução do `verify-stack.sh`, que hoje é `100755`.
A integração precisa ser feita de uma máquina com git de verdade.
