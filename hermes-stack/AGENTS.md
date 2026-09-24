# Contrato dos agentes — Tijolão

A fonte de verdade da frota é [`swarm.yaml`](./swarm.yaml). Cada especialista
tem um perfil em `~/.hermes/profiles/<id>/` (com `SOUL.md` e `config.yaml`
próprios) e um wrapper em `~/.local/bin/<id>`.

> Esta frota substitui a do upstream (`orchestrator`, `km-agent`, `builder`,
> `reviewer`, `qa`, `researcher`, `ops-watch`, `maintainer`, `strategist`,
> `inbox-triage`). Aquela nunca foi provisionada nesta máquina: nenhum daqueles
> perfis, wrappers ou sessões tmux existia.

## A frota

O **orquestrador não é um worker**: é o perfil `default`
(`~/.hermes/config.yaml`), que roda no Telegram e no terminal. Ele prescreve a
missão, consolida o retorno e traduz para o Dr. Nícolas. Os cinco abaixo
executam apenas o escopo recebido.

| Especialista | Papel | Modelo | Retorno obrigatório |
|---|---|---|---|
| `chefe` | Infraestrutura do Tijolão — scripts, serviços, docker, rede | `poolside/laguna-s-2.1` | `CONCLUSÃO` · `ALTEROU` · `VERIFICOU` · `PENDÊNCIA` |
| `residente` | Implementação de produto, com ênfase no SASI | `poolside/laguna-s-2.1` | `FIZ` · `VERIFIQUEI` · `PENDÊNCIA` |
| `fiscal` | Revisão independente — tenta refutar antes de aceitar | `poolside/laguna-s-2.1` | `VEREDITO` · `PROVAS` · `FALHAS` · `CORREÇÃO EXIGIDA` |
| `secretaria` | Consolidação operacional — registro canônico, poda | `poolside/laguna-s-2.1` | `ATUALIZOU` · `PODOU` · `PENDÊNCIA` |
| `evidencia` | Pesquisa e auditoria clínica — literatura, rastreabilidade | `cx/gpt-5.6-terra` | `AFIRMAÇÃO` · `VEREDITO` · `FONTE` · `POPULAÇÃO` · `LIMITE` |

`poolside/laguna-s-2.1` vai direto a `https://inference.poolside.ai/v1`.
`cx/gpt-5.6-terra` vai ao 9Router em `http://127.0.0.1:20128/v1`.

## Travas comuns (em todo `profiles/<id>/SOUL.md`)

- Não invente caminho, serviço, porta ou saída.
- Não abra melhoria lateral.
- Não execute rotina destrutiva sem autorização explícita.
- Não publique, faça push ou altere produção sem autorização.
- **Não delegue; devolva bloqueio objetivo ao orquestrador.**

Nenhum especialista chama outro. A topologia é estrela, não malha: tudo volta
ao `default`, que decide o próximo passo.

## Como chamar

```bash
fiscal chat -q "Refute: o kanban do workspace está funcionando"
residente chat -q "Implemente o campo X na tabela Y do SASI"
evidencia chat -q "Qual a dose de noradrenalina em choque séptico refratário?"
```

Também funciona por flag de perfil, sem wrapper:

```bash
hermes chat -q "..." -p fiscal
```

Retomar uma sessão:

```bash
hermes --resume <session-id> -p <perfil>
```

## Ao mexer na frota

Mantenha alinhados, na mesma mudança:

1. `swarm.yaml` — o bloco do worker
2. `~/.hermes/profiles/<id>/config.yaml` — modelo, provider, toolsets
3. `~/.hermes/profiles/<id>/SOUL.md` — persona e formato de retorno
4. `~/.local/bin/<id>` — o wrapper
5. Esta tabela

`swarm.yaml` é bind-mounted em `/app/swarm.yaml` (ver
`docker-compose.tijolao.yml`), então editar e reiniciar basta — **não** precisa
rebuild da imagem.

## Modelo: como configurar sem cair em fallback

Nesta versão do Hermes, o atalho `provider: <nome do bloco providers>` **não é
resolvido** — o agente trata como `custom` sem `base_url`, a chamada falha e ele
desce silenciosamente para os `fallback_providers` do OpenRouter. O sintoma é
uma resposta que chega normalmente, com um aviso discreto:

```
⚠️ Model fallback: laguna-s-2.1 via custom unavailable (provider failure)
```

O padrão que funciona é sempre explícito:

```yaml
model:
  default: "poolside/laguna-s-2.1"
  provider: "custom"
  base_url: "https://inference.poolside.ai/v1"
  api_key: ${POOLSIDE_API_KEY}
```

Ao trocar o modelo de um perfil, o teste válido não é "respondeu" — é
**"respondeu sem aviso de fallback"**:

```bash
<perfil> chat -q "Responda apenas: PRONTO" 2>&1 | grep -c "Model fallback"
# 0 = está no modelo certo
```

## Swarm Mode da interface — por que não funciona ainda

O painel Swarm do Workspace inicia workers com
`tmux new-session ... exec hermes chat --tui` (`swarm-tmux-start.ts`). Dentro do
container do workspace faltam três coisas, e nenhuma é só um pacote:

1. `tmux` não está na imagem;
2. não existe binário `hermes` ali — ele vive no container do agente;
3. o CLI e o socket do Docker não estão montados (decisão de segurança
   registrada em `COMO-USAR.md`).

Enquanto isso, os cinco especialistas são operados pelos wrappers de linha de
comando acima, que funcionam hoje. Um caminho possível para religar o painel é
montar o socket tmux do host (`/tmp/tmux-1000`) e instalar só o *cliente* tmux
na imagem — mas o cliente precisa casar com a versão do servidor (host: 3.4;
Debian bookworm entrega 3.3a), então exige verificação antes de valer a pena.
