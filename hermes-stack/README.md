# hermes-stack — a pilha Hermes do Tijolão

Config **desta máquina** para rodar o Hermes Agent e o Hermes Workspace em
Docker. Caminhos absolutos são de propósito: isto não é uma biblioteca
portátil, é a descrição de um computador específico.

## Ligar

```bash
tijolao up        # sobe tudo
tijolao status    # o que está de pé, saúde das 4 portas, workers do swarm
tijolao logs      # ao vivo
tijolao down      # desliga (os dados em ~/.hermes ficam)
```

Interface em http://localhost:3000. Nada escuta fora do `127.0.0.1`.

Depois de clonar este repo numa máquina nova: `./install.sh` instala os
wrappers em `~/.local/bin`.

## O que é de quem

| Isto aqui | O fork do app |
|---|---|
| `docker-compose.tijolao.yml` — a pilha | `~/hermes-workspace` — código do Workspace |
| `tijolao.sh` — controle | fork de `outsourc-e/hermes-workspace` |
| `swarm.yaml` — a frota de agentes | só correções que valem PR pro upstream |
| `wrappers/` — `hermes` + 5 especialistas | |
| `AGENTS.md` — contrato dos agentes | |

Antes, tudo isso morava num branch `tijolao` dentro do fork. Isso misturava
config de máquina com código de terceiro e obrigava a rebase a cada
atualização do upstream. Agora o fork carrega só o que é defeito real do app.

## Dados (não versionados)

| O quê | Onde |
|---|---|
| Estado do agente: config, skills, perfis, kanban, cron | `~/.hermes/` |
| Segredos | `~/projetos/.env` |
| Trabalho do agente | `~/projetos/` |

Bind mounts nos mesmos caminhos dentro do container — `~/.hermes/config.yaml`
vale dos dois lados, sem cópia e sem divergência. `docker compose down` não
apaga nada disso.

## Pré-requisito

O **9Router** em `127.0.0.1:20128`. O modelo padrão aponta pra ele; se estiver
fora, o agente sobe mas não responde. `tijolao status` mostra a linha.

## Swarm

Um orquestrador (perfil `default`, roda no Telegram e no terminal) e cinco
especialistas: `chefe`, `residente`, `fiscal`, `secretaria`, `evidencia`.
Contrato e formato de retorno de cada um em [`AGENTS.md`](./AGENTS.md).

```bash
fiscal chat -q "Refute: o kanban está funcionando"
```

O painel Swarm da interface também funciona. O container do Workspace é apenas
**cliente** tmux: o servidor roda no host (âncora `hermes-swarm`, criada pelo
`tijolao up`), então o worker nasce como processo do host e entra no container
do agente pelo wrapper. O socket do Docker continua fora do container.
