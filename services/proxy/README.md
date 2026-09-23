# services/proxy — Traefik + Heimdall

Instalado pelo Hermes em 23-set-2026 (Docker Compose, subindo pelo host).

## O que é
- **Traefik v3.7.13** — porteiro HTTP: recebe na porta 80 e encaminha para o serviço certo, lendo rótulos (labels) dos containers.
- **Heimdall 2.8.3** — página de atalhos: http://tijolao.tail9e88c5.ts.net/
- **Painel do Traefik** — http://tijolao.tail9e88c5.ts.net/dashboard/ (usuário `dr`, senha em `~/projetos/.env` → `TRAEFIK_DASHBOARD_PASSWORD`)

## Alcance
- Escuta **apenas** em `127.0.0.1` e `100.91.46.87` (IP da tailnet). A LAN comum (192.168.x) não alcança.
- HTTP simples dentro da tailnet: o WireGuard cifra o caminho (mesmo modelo do painel do Hermes, porta 9119).

## Arquivos
- `docker-compose.yml` — os dois containers
- `traefik.yml` — configuração estática do Traefik
- `data/` — **não versionado**: `data/usersfile` (hash da senha do painel) e `data/heimdall/` (dados do Heimdall)

## Comandos (no host)
- subir: `docker compose -f ~/projetos/tijolao-ai/services/proxy/docker-compose.yml up -d`
- descer: mesmo com `down`
- ver logs: `docker logs traefik` / `docker logs heimdall`
