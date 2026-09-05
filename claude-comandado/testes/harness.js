// Harness: conversa JSON-RPC com o servidor MCP e imprime um relatório de aprovado/reprovado.
const { spawn } = require('node:child_process');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const PROJ = path.join(__dirname, 'proj');

// Fixtures que o git não carrega sozinho: o binário falso está versionado como
// 100644 e o subdiretório vazio não existe no clone. Recria os dois aqui.
require('node:fs').chmodSync(path.join(__dirname, 'fakebin', 'claude'), 0o755);
require('node:fs').mkdirSync(path.join(PROJ, 'sub'), { recursive: true });

const fs = require('node:fs');
let contadorLog = 0;

function sessao(env, mensagens) {
  const arqLog = path.join(__dirname, `args-${++contadorLog}.log`);
  try { fs.unlinkSync(arqLog); } catch {}
  return new Promise((resolve) => {
    const p = spawn('node', [path.join(RAIZ, 'servidor.js')], {
      env: { ...process.env, FAKE_LOG: arqLog, PATH: path.join(__dirname, 'fakebin') + ':' + process.env.PATH, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => {
      const respostas = out
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return { LINHA_INVALIDA: l };
          }
        });
      let args = '';
      try { args = fs.readFileSync(arqLog, 'utf8'); } catch {}
      resolve({ respostas, err: err + '\n' + args, args });
    });
    for (const m of mensagens) p.stdin.write(JSON.stringify(m) + '\n');
    p.stdin.end();
  });
}

let ok = 0;
let falhou = 0;
function checa(nome, cond, detalhe) {
  if (cond) {
    ok++;
    console.log(`  OK   ${nome}`);
  } else {
    falhou++;
    console.log(`  FALHA ${nome}${detalhe ? '\n        -> ' + detalhe : ''}`);
  }
}

const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'grok-teste', version: '1' } } };
const notif = { jsonrpc: '2.0', method: 'notifications/initialized' };

(async () => {
  console.log('\n== 1. Handshake e listagem ==');
  {
    const { respostas } = await sessao({ CC_MCP_RAIZES: PROJ }, [
      init,
      notif,
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'ping' },
      { jsonrpc: '2.0', id: 4, method: 'prompts/list' },
    ]);
    const r1 = respostas.find((r) => r.id === 1);
    checa('initialize responde', !!r1 && !!r1.result, JSON.stringify(r1));
    checa('ecoa a versão de protocolo pedida', r1?.result?.protocolVersion === '2025-06-18', r1?.result?.protocolVersion);
    checa('serverInfo presente', r1?.result?.serverInfo?.name === 'claude-comandado');
    checa('notificação não gera resposta', !respostas.some((r) => r.method));
    const r2 = respostas.find((r) => r.id === 2);
    checa('tools/list traz 4 ferramentas', r2?.result?.tools?.length === 4, JSON.stringify(r2?.result?.tools?.map((t) => t.name)));
    checa('schemas têm required', r2?.result?.tools?.every((t) => t.inputSchema.type === 'object'));
    checa('ping responde', !!respostas.find((r) => r.id === 3)?.result);
    checa('prompts/list vazio', Array.isArray(respostas.find((r) => r.id === 4)?.result?.prompts));
  }

  console.log('\n== 2. Protocolo novo (2026-07-28) ==');
  {
    const { respostas } = await sessao({ CC_MCP_RAIZES: PROJ }, [
      { ...init, params: { ...init.params, protocolVersion: '2026-07-28' } },
    ]);
    checa('aceita 2026-07-28', respostas[0]?.result?.protocolVersion === '2026-07-28');
  }
  {
    const { respostas } = await sessao({ CC_MCP_RAIZES: PROJ }, [
      { ...init, params: { ...init.params, protocolVersion: '1999-01-01' } },
    ]);
    checa('versão desconhecida cai no fallback', respostas[0]?.result?.protocolVersion === '2025-03-26', respostas[0]?.result?.protocolVersion);
  }

  console.log('\n== 3. claude_perguntar (somente leitura) ==');
  {
    const { respostas, err } = await sessao({ CC_MCP_RAIZES: PROJ }, [
      init,
      { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'claude_perguntar', arguments: { prompt: 'o que tem aqui', diretorio: PROJ } } },
    ]);
    const r = respostas.find((x) => x.id === 9);
    const txt = r?.result?.content?.[0]?.text || '';
    checa('devolve texto do resultado', txt.includes('resposta do claude'), txt.slice(0, 200));
    checa('isError false', r?.result?.isError === false);
    checa('expõe session_id', txt.includes('sessao=sess-abc-123'), txt);
    checa('expõe custo estimado', txt.includes('custo_estimado_usd=0.0123'), txt);
    checa('usa --permission-mode dontAsk', err.includes('--permission-mode dontAsk'), err);
    checa('não passa --add-dir em leitura', !err.includes('--add-dir'), err);
    checa('aplica --max-turns 20', err.includes('--max-turns 20'), err);
    checa('aplica --max-budget-usd 2', err.includes('--max-budget-usd 2'), err);
    checa('roda no cwd pedido', txt.includes(`cwd=${PROJ}`), txt);
    checa('isola MCPs por padrão (anti-recursão)', err.includes('--strict-mcp-config'), err);
  }

  {
    const { respostas, err } = await sessao({ CC_MCP_RAIZES: PROJ, CC_MCP_MCP_INTERNO: '1' }, [
      init,
      { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'claude_perguntar', arguments: { prompt: 'x', diretorio: PROJ } } },
    ]);
    checa('CC_MCP_MCP_INTERNO=1 libera os MCPs', !err.includes('--strict-mcp-config'), err);
  }

  console.log('\n== 4. Cerca do diretório ==');
  {
    const { respostas } = await sessao({ CC_MCP_RAIZES: PROJ }, [
      init,
      { jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'claude_perguntar', arguments: { prompt: 'x', diretorio: '/etc' } } },
      { jsonrpc: '2.0', id: 11, method: 'tools/call', params: { name: 'claude_perguntar', arguments: { prompt: 'x', diretorio: PROJ + '/../..' } } },
      { jsonrpc: '2.0', id: 12, method: 'tools/call', params: { name: 'claude_perguntar', arguments: { prompt: 'x', diretorio: PROJ + '/sub' } } },
    ]);
    const a = respostas.find((x) => x.id === 10)?.result;
    const b = respostas.find((x) => x.id === 11)?.result;
    const c = respostas.find((x) => x.id === 12)?.result;
    checa('recusa /etc', a?.isError === true && /fora das raízes/.test(a.content[0].text));
    checa('recusa escapada por ..', b?.isError === true, JSON.stringify(b));
    checa('aceita subdiretório da raiz', c?.isError === false, JSON.stringify(c));
  }

  console.log('\n== 5. Modo escrita ==');
  {
    const { respostas } = await sessao({ CC_MCP_RAIZES: PROJ }, [
      init,
      { jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name: 'claude_tarefa', arguments: { prompt: 'cria arquivo', diretorio: PROJ } } },
    ]);
    const r = respostas.find((x) => x.id === 20)?.result;
    checa('escrita bloqueada por padrão', r?.isError === true && /desabilitado/.test(r.content[0].text), JSON.stringify(r));
  }
  {
    const { respostas, err } = await sessao({ CC_MCP_RAIZES: PROJ, CC_MCP_ESCRITA: '1' }, [
      init,
      { jsonrpc: '2.0', id: 21, method: 'tools/call', params: { name: 'claude_tarefa', arguments: { prompt: 'cria arquivo', diretorio: PROJ, ferramentas_permitidas: ['Bash(npm test *)'] } } },
    ]);
    const r = respostas.find((x) => x.id === 21)?.result;
    checa('escrita liberada com CC_MCP_ESCRITA=1', r?.isError === false, JSON.stringify(r));
    checa('usa acceptEdits', err.includes('--permission-mode acceptEdits'), err);
    checa('passa --add-dir', err.includes('--add-dir'), err);
    checa('repassa allowedTools', err.includes('Bash(npm test *)'), err);
  }

  console.log('\n== 6. Continuar sessão ==');
  {
    const { respostas, err } = await sessao({ CC_MCP_RAIZES: PROJ }, [
      init,
      { jsonrpc: '2.0', id: 30, method: 'tools/call', params: { name: 'claude_continuar', arguments: { sessao: 'sess-abc-123', prompt: 'e agora', diretorio: PROJ } } },
    ]);
    const r = respostas.find((x) => x.id === 30)?.result;
    checa('continuar funciona', r?.isError === false, JSON.stringify(r));
    checa('passa --resume', err.includes('--resume sess-abc-123'), err);
  }

  console.log('\n== 7. Versão antiga do Claude Code (flag desconhecida) ==');
  {
    const { respostas, err } = await sessao({ CC_MCP_RAIZES: PROJ, FAKE_VELHO: '1' }, [
      init,
      { jsonrpc: '2.0', id: 40, method: 'tools/call', params: { name: 'claude_perguntar', arguments: { prompt: 'x', diretorio: PROJ } } },
    ]);
    const r = respostas.find((x) => x.id === 40)?.result;
    const txt = r?.result || r?.content?.[0]?.text || '';
    checa('repete sem as flags opcionais e tem sucesso', r?.isError === false, JSON.stringify(r));
    checa('avisa que os limites não foram aplicados', /limites de turno/.test(txt), txt);
    checa('log registra a repetição', /flag opcional rejeitada/.test(err), err);
  }

  console.log('\n== 8. Diagnóstico e erros ==');
  {
    const { respostas } = await sessao({ CC_MCP_RAIZES: PROJ }, [
      init,
      { jsonrpc: '2.0', id: 50, method: 'tools/call', params: { name: 'claude_diagnostico', arguments: {} } },
      { jsonrpc: '2.0', id: 51, method: 'tools/call', params: { name: 'claude_perguntar', arguments: { diretorio: PROJ } } },
      { jsonrpc: '2.0', id: 52, method: 'metodo/inexistente' },
    ]);
    const d = respostas.find((x) => x.id === 50)?.result?.content?.[0]?.text || '';
    checa('diagnóstico acha o binário', /2\.1\.260/.test(d), d);
    checa('diagnóstico mostra autenticação', /loggedIn/.test(d), d);
    checa('diagnóstico mostra modo escrita', /modo escrita: desabilitado/.test(d), d);
    const e = respostas.find((x) => x.id === 51)?.result;
    checa('prompt vazio vira erro claro', e?.isError === true && /obrigatório/.test(e.content[0].text));
    checa('método desconhecido devolve -32601', respostas.find((x) => x.id === 52)?.error?.code === -32601);
  }
  {
    const { respostas } = await sessao({ CC_MCP_RAIZES: PROJ, CC_MCP_BIN: '/nao/existe/claude' }, [
      init,
      { jsonrpc: '2.0', id: 60, method: 'tools/call', params: { name: 'claude_perguntar', arguments: { prompt: 'x', diretorio: PROJ } } },
    ]);
    const r = respostas.find((x) => x.id === 60)?.result;
    checa('binário ausente dá mensagem acionável', r?.isError === true && /CC_MCP_BIN/.test(r.content[0].text), JSON.stringify(r));
  }

  console.log('\n== 9. Timeout ==');
  {
    const { respostas } = await sessao({ CC_MCP_RAIZES: PROJ, FAKE_LENTO: '1', CC_MCP_TIMEOUT: '2' }, [
      init,
      { jsonrpc: '2.0', id: 70, method: 'tools/call', params: { name: 'claude_perguntar', arguments: { prompt: 'x', diretorio: PROJ } } },
    ]);
    const r = respostas.find((x) => x.id === 70)?.result;
    checa('mata a execução no timeout', r?.isError === true && /limite de 2s/.test(r.content[0].text), JSON.stringify(r));
  }

  console.log(`\n===== ${ok} aprovados, ${falhou} reprovados =====\n`);
  process.exit(falhou ? 1 : 0);
})();
