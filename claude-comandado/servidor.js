#!/usr/bin/env node
/**
 * claude-comandado — servidor MCP (stdio) que expõe o Claude Code como
 * ferramenta para outro agente (Grok Build, Grok CLI, ou qualquer cliente MCP).
 *
 * Arquivo único, zero dependências. Roda com: node servidor.js
 *
 * Variáveis de ambiente (todas opcionais):
 *   CC_MCP_RAIZES     diretórios permitidos, separados por ':'  (padrão: /home/dr/projetos)
 *   CC_MCP_ESCRITA    "1" habilita a ferramenta claude_tarefa   (padrão: "0" = só leitura)
 *   CC_MCP_TIMEOUT    segundos por chamada                      (padrão: 900)
 *   CC_MCP_ORCAMENTO  teto de gasto em USD por chamada          (padrão: 2.00; 0 = sem teto)
 *   CC_MCP_TURNOS     teto de turnos agênticos por chamada      (padrão: 20; 0 = sem teto)
 *   CC_MCP_BIN        caminho do binário do Claude Code         (padrão: "claude")
 *   CC_MCP_MODELO     modelo padrão (sonnet|opus|haiku|fable)   (padrão: o configurado na máquina)
 *   CC_MCP_SAIDA_MAX  máximo de caracteres devolvidos           (padrão: 40000)
 *   CC_MCP_MCP_INTERNO "1" deixa o Claude delegado usar os MCPs dele (padrão: "0" = isolado,
 *                      o que evita o Claude carregar ESTE servidor e chamar a si mesmo em loop)
 */

'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------- configuração

const CFG = {
  raizes: (process.env.CC_MCP_RAIZES || '/home/dr/projetos')
    .split(':')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => path.resolve(p)),
  escrita: process.env.CC_MCP_ESCRITA === '1',
  timeoutMs: (Number(process.env.CC_MCP_TIMEOUT) || 900) * 1000,
  orcamento: process.env.CC_MCP_ORCAMENTO === undefined ? 2.0 : Number(process.env.CC_MCP_ORCAMENTO),
  turnos: process.env.CC_MCP_TURNOS === undefined ? 20 : Number(process.env.CC_MCP_TURNOS),
  bin: process.env.CC_MCP_BIN || 'claude',
  modelo: process.env.CC_MCP_MODELO || '',
  saidaMax: Number(process.env.CC_MCP_SAIDA_MAX) || 40000,
  mcpInterno: process.env.CC_MCP_MCP_INTERNO === '1',
};

const NOME = 'claude-comandado';
const VERSAO = '1.0.0';
const PROTOCOLOS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'];

const log = (...a) => process.stderr.write(`[${NOME}] ${a.join(' ')}\n`);

// ------------------------------------------------------------------ utilitários

/** Resolve e valida um diretório de trabalho contra a lista de raízes permitidas. */
function resolverDiretorio(dir) {
  const alvo = path.resolve(dir || CFG.raizes[0]);
  let real;
  try {
    real = fs.realpathSync(alvo);
  } catch {
    throw new Error(
      `diretório não existe: ${alvo}. Raízes permitidas: ${CFG.raizes.join(', ')}`,
    );
  }
  if (!fs.statSync(real).isDirectory()) throw new Error(`não é um diretório: ${real}`);

  const permitido = CFG.raizes.some((raiz) => {
    let raizReal;
    try {
      raizReal = fs.realpathSync(raiz);
    } catch {
      return false;
    }
    return real === raizReal || real.startsWith(raizReal + path.sep);
  });
  if (!permitido) {
    throw new Error(
      `diretório fora das raízes permitidas: ${real}. ` +
        `Permitido: ${CFG.raizes.join(', ')}. Ajuste CC_MCP_RAIZES para liberar outro caminho.`,
    );
  }
  return real;
}

function truncar(txt) {
  if (typeof txt !== 'string') txt = String(txt ?? '');
  if (txt.length <= CFG.saidaMax) return txt;
  return (
    txt.slice(0, CFG.saidaMax) +
    `\n\n[...truncado: ${txt.length - CFG.saidaMax} caracteres omitidos. ` +
    `Peça um recorte mais específico ou continue a sessão.]`
  );
}

/** Detecta erro de flag desconhecida, para poder repetir a chamada sem as flags opcionais. */
function ehFlagDesconhecida(txt) {
  return /unknown option|unknown flag|unrecognized option|error: unknown|invalid option/i.test(
    txt || '',
  );
}

// ------------------------------------------------------- execução do Claude Code

function executarClaude(args, cwd) {
  return new Promise((resolve) => {
    let filho;
    try {
      filho = spawn(CFG.bin, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    } catch (e) {
      return resolve({ codigo: -1, stdout: '', stderr: String(e && e.message), falhaSpawn: true });
    }

    let stdout = '';
    let stderr = '';
    let encerrado = false;

    filho.stdout.on('data', (d) => {
      stdout += d;
    });
    filho.stderr.on('data', (d) => {
      stderr += d;
    });

    const timer = setTimeout(() => {
      encerrado = true;
      filho.kill('SIGTERM');
      setTimeout(() => filho.kill('SIGKILL'), 5000);
    }, CFG.timeoutMs);

    filho.on('error', (e) => {
      clearTimeout(timer);
      resolve({ codigo: -1, stdout, stderr: String(e && e.message), falhaSpawn: true });
    });

    filho.on('close', (codigo) => {
      clearTimeout(timer);
      resolve({ codigo, stdout, stderr, timeout: encerrado });
    });
  });
}

/** Monta os argumentos e roda, com repetição automática sem flags opcionais se a versão não as aceitar. */
async function rodarClaude({ prompt, cwd, modo, modelo, sistema, ferramentas, sessao, turnos }) {
  const base = ['-p', prompt, '--output-format', 'json'];

  if (sessao) base.push('--resume', sessao);
  if (modelo || CFG.modelo) base.push('--model', modelo || CFG.modelo);
  if (sistema) base.push('--append-system-prompt', sistema);

  // Modo de permissão: leitura usa dontAsk (nega tudo fora do conjunto read-only).
  base.push('--permission-mode', modo === 'escrita' ? 'acceptEdits' : 'dontAsk');
  if (modo === 'escrita') base.push('--add-dir', cwd);
  if (Array.isArray(ferramentas) && ferramentas.length) {
    base.push('--allowedTools', ...ferramentas);
  }

  // Isolamento de MCP: sem isto o Claude delegado carrega o .mcp.json do projeto,
  // que pode conter ESTE servidor — e aí ele chama a si mesmo em recursão.
  if (!CFG.mcpInterno) base.push('--strict-mcp-config');

  // Flags que dependem da versão do Claude Code — removidas na repetição se rejeitadas.
  const opcionais = [];
  const limite = turnos === undefined ? CFG.turnos : turnos;
  if (limite > 0) opcionais.push('--max-turns', String(limite));
  if (CFG.orcamento > 0) opcionais.push('--max-budget-usd', String(CFG.orcamento));
  opcionais.push('--permission-prompts', 'none');

  let r = await executarClaude([...base, ...opcionais], cwd);

  if (r.codigo !== 0 && !r.falhaSpawn && ehFlagDesconhecida(r.stderr + r.stdout)) {
    log('flag opcional rejeitada por esta versão do Claude Code; repetindo sem elas');
    r = await executarClaude(base, cwd);
    r.semGuardrails = true;
  }
  return r;
}

/** Traduz o resultado bruto em texto para o agente chamador. */
function formatarResultado(r, cwd) {
  if (r.falhaSpawn) {
    return {
      erro: true,
      texto:
        `Não consegui executar o Claude Code ("${CFG.bin}").\n` +
        `Detalhe: ${r.stderr}\n` +
        `Verifique se o Claude Code está instalado e no PATH do processo que iniciou este servidor MCP, ` +
        `ou aponte CC_MCP_BIN para o caminho absoluto do binário.`,
    };
  }
  if (r.timeout) {
    return {
      erro: true,
      texto:
        `A execução passou do limite de ${CFG.timeoutMs / 1000}s e foi encerrada.\n` +
        `Saída parcial:\n${truncar(r.stdout || r.stderr)}`,
    };
  }

  let payload = null;
  const linha = (r.stdout || '').trim().split('\n').filter(Boolean).pop();
  if (linha) {
    try {
      payload = JSON.parse(linha);
    } catch {
      /* saída não-JSON; tratada abaixo */
    }
  }

  if (!payload) {
    return {
      erro: r.codigo !== 0,
      texto:
        (r.codigo !== 0 ? `Claude Code saiu com código ${r.codigo}.\n` : '') +
        truncar(r.stdout || r.stderr || '(sem saída)'),
    };
  }

  const partes = [truncar(payload.result ?? JSON.stringify(payload))];
  const meta = [];
  if (payload.session_id) meta.push(`sessao=${payload.session_id}`);
  if (typeof payload.total_cost_usd === 'number') {
    meta.push(`custo_estimado_usd=${payload.total_cost_usd.toFixed(4)}`);
  }
  meta.push(`dir=${cwd}`);
  if (r.semGuardrails) meta.push('aviso=limites de turno/orçamento não aplicados nesta versão');
  if (payload.is_error) meta.push('is_error=true');
  partes.push(`\n---\n[${meta.join(' | ')}]`);

  return { erro: r.codigo !== 0 || payload.is_error === true, texto: partes.join('') };
}

// ---------------------------------------------------------------- ferramentas

const DESC_DIR = `Diretório de trabalho absoluto. Precisa estar dentro de: ${CFG.raizes.join(', ')}.`;

const FERRAMENTAS = [
  {
    name: 'claude_perguntar',
    description:
      'Delega uma pergunta ou análise ao Claude Code, em modo SOMENTE LEITURA. ' +
      'O Claude pode ler e pesquisar arquivos do diretório indicado, mas não escreve, ' +
      'não edita e não executa comandos que alterem o sistema. Use para revisar código, ' +
      'explicar um repositório, auditar, comparar arquivos ou pedir uma segunda opinião. ' +
      'Devolve a resposta final em texto, mais o id da sessão para continuar depois.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'A instrução completa para o Claude. Ele não pode fazer perguntas de volta: ' +
            'tudo o que ele precisa saber tem de estar aqui ou nos arquivos do diretório.',
        },
        diretorio: { type: 'string', description: DESC_DIR },
        modelo: {
          type: 'string',
          enum: ['sonnet', 'opus', 'haiku', 'fable'],
          description: 'Modelo a usar. Omitir usa o padrão configurado na máquina.',
        },
        instrucao_de_sistema: {
          type: 'string',
          description: 'Texto extra anexado ao prompt de sistema, ex.: papel ou formato de saída.',
        },
        turnos_max: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: `Teto de turnos agênticos. Padrão ${CFG.turnos}.`,
        },
      },
      required: ['prompt'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: 'claude_tarefa',
    description:
      'Delega uma tarefa ao Claude Code COM PERMISSÃO DE ESCRITA no diretório indicado: ' +
      'ele pode criar e editar arquivos. Use para implementar, refatorar, corrigir bugs ou ' +
      'gerar arquivos. Comandos de shell só rodam se listados em ferramentas_permitidas. ' +
      (CFG.escrita
        ? 'Está HABILITADA nesta instalação.'
        : 'ATENÇÃO: está DESABILITADA nesta instalação (CC_MCP_ESCRITA != 1) e vai recusar.'),
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'A tarefa completa, autossuficiente.' },
        diretorio: { type: 'string', description: DESC_DIR },
        modelo: { type: 'string', enum: ['sonnet', 'opus', 'haiku', 'fable'] },
        instrucao_de_sistema: { type: 'string' },
        ferramentas_permitidas: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Regras de permissão liberadas sem confirmação, ex.: ["Bash(npm test *)", "Bash(git diff *)"]. ' +
            'Sem isso, comandos de shell são negados.',
        },
        turnos_max: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['prompt', 'diretorio'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  {
    name: 'claude_continuar',
    description:
      'Continua uma sessão anterior do Claude Code pelo id devolvido por claude_perguntar ou ' +
      'claude_tarefa, mantendo todo o contexto da conversa. Use para follow-up em vez de ' +
      'repetir o contexto inteiro num prompt novo.',
    inputSchema: {
      type: 'object',
      properties: {
        sessao: { type: 'string', description: 'O session_id devolvido na chamada anterior.' },
        prompt: { type: 'string', description: 'A mensagem de continuação.' },
        diretorio: { type: 'string', description: DESC_DIR },
        escrita: {
          type: 'boolean',
          description: 'true para continuar com permissão de escrita. Padrão false (só leitura).',
        },
        turnos_max: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['sessao', 'prompt'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: 'claude_diagnostico',
    description:
      'Verifica se o Claude Code está instalado, autenticado e acessível a partir deste servidor. ' +
      'Chame isto primeiro se qualquer outra ferramenta falhar.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
];

async function chamarFerramenta(nome, args) {
  args = args || {};

  if (nome === 'claude_diagnostico') {
    const v = await executarClaude(['--version'], process.cwd());
    const a = await executarClaude(['auth', 'status'], process.cwd());
    const linhas = [
      `binário: ${CFG.bin}`,
      `versão: ${v.falhaSpawn ? 'NÃO ENCONTRADO — ' + v.stderr : (v.stdout || '').trim()}`,
      `autenticação: ${a.falhaSpawn ? 'indisponível' : (a.stdout || a.stderr || '').trim() || `código ${a.codigo}`}`,
      `raízes permitidas: ${CFG.raizes.join(', ')}`,
      `modo escrita: ${CFG.escrita ? 'HABILITADO' : 'desabilitado'}`,
      `timeout: ${CFG.timeoutMs / 1000}s | orçamento: ${CFG.orcamento > 0 ? 'US$ ' + CFG.orcamento : 'sem teto'} | turnos: ${CFG.turnos || 'sem teto'}`,
      `modelo padrão: ${CFG.modelo || '(o da máquina)'}`,
      `MCPs dentro do Claude delegado: ${CFG.mcpInterno ? 'HABILITADOS (risco de recursão se este servidor estiver no .mcp.json do projeto)' : 'isolados'}`,
    ];
    return { erro: v.falhaSpawn === true, texto: linhas.join('\n') };
  }

  if (!args.prompt || typeof args.prompt !== 'string' || !args.prompt.trim()) {
    return { erro: true, texto: 'Parâmetro "prompt" é obrigatório e não pode ser vazio.' };
  }

  let cwd;
  try {
    cwd = resolverDiretorio(args.diretorio);
  } catch (e) {
    return { erro: true, texto: e.message };
  }

  if (nome === 'claude_perguntar') {
    const r = await rodarClaude({
      prompt: args.prompt,
      cwd,
      modo: 'leitura',
      modelo: args.modelo,
      sistema: args.instrucao_de_sistema,
      turnos: args.turnos_max,
    });
    return formatarResultado(r, cwd);
  }

  if (nome === 'claude_tarefa') {
    if (!CFG.escrita) {
      return {
        erro: true,
        texto:
          'Modo de escrita desabilitado neste servidor. Nenhum arquivo foi tocado.\n' +
          'Para habilitar, o dono da máquina precisa definir CC_MCP_ESCRITA=1 na configuração do servidor MCP. ' +
          'Enquanto isso, use claude_perguntar (somente leitura).',
      };
    }
    const r = await rodarClaude({
      prompt: args.prompt,
      cwd,
      modo: 'escrita',
      modelo: args.modelo,
      sistema: args.instrucao_de_sistema,
      ferramentas: args.ferramentas_permitidas,
      turnos: args.turnos_max,
    });
    return formatarResultado(r, cwd);
  }

  if (nome === 'claude_continuar') {
    if (!args.sessao || typeof args.sessao !== 'string') {
      return { erro: true, texto: 'Parâmetro "sessao" é obrigatório.' };
    }
    if (args.escrita && !CFG.escrita) {
      return { erro: true, texto: 'Modo de escrita desabilitado neste servidor (CC_MCP_ESCRITA != 1).' };
    }
    const r = await rodarClaude({
      prompt: args.prompt,
      cwd,
      modo: args.escrita ? 'escrita' : 'leitura',
      sessao: args.sessao,
      turnos: args.turnos_max,
    });
    return formatarResultado(r, cwd);
  }

  return { erro: true, texto: `Ferramenta desconhecida: ${nome}` };
}

// ------------------------------------------------------------ camada JSON-RPC

function enviar(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function responder(id, result) {
  enviar({ jsonrpc: '2.0', id, result });
}

function responderErro(id, code, message) {
  enviar({ jsonrpc: '2.0', id, error: { code, message } });
}

async function tratar(msg) {
  const { id, method, params } = msg;
  const ehNotificacao = id === undefined || id === null;

  switch (method) {
    case 'initialize': {
      const pedido = params && params.protocolVersion;
      const versao = PROTOCOLOS.includes(pedido) ? pedido : PROTOCOLOS[PROTOCOLOS.length - 1];
      return responder(id, {
        protocolVersion: versao,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: NOME, version: VERSAO },
        instructions:
          'Este servidor delega trabalho ao Claude Code rodando na máquina local. ' +
          'claude_perguntar é somente leitura; claude_tarefa escreve arquivos e pode estar desabilitada. ' +
          'Prompts precisam ser autossuficientes: o Claude não consegue perguntar nada de volta.',
      });
    }

    case 'notifications/initialized':
    case 'initialized':
    case 'notifications/cancelled':
      return;

    case 'ping':
      return responder(id, {});

    case 'tools/list':
      return responder(id, { tools: FERRAMENTAS });

    case 'resources/list':
      return responder(id, { resources: [] });

    case 'resources/templates/list':
      return responder(id, { resourceTemplates: [] });

    case 'prompts/list':
      return responder(id, { prompts: [] });

    case 'tools/call': {
      const nome = params && params.name;
      try {
        const r = await chamarFerramenta(nome, (params && params.arguments) || {});
        return responder(id, {
          content: [{ type: 'text', text: r.texto }],
          isError: r.erro === true,
        });
      } catch (e) {
        log('erro em tools/call:', e && e.stack);
        return responder(id, {
          content: [{ type: 'text', text: `Falha interna do servidor: ${e && e.message}` }],
          isError: true,
        });
      }
    }

    default:
      if (ehNotificacao) return;
      return responderErro(id, -32601, `Método não suportado: ${method}`);
  }
}

let buffer = '';
let emVoo = 0;
let entradaFechada = false;

function talvezEncerrar() {
  if (entradaFechada && emVoo === 0) process.exit(0);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (pedaco) => {
  buffer += pedaco;
  let quebra;
  while ((quebra = buffer.indexOf('\n')) !== -1) {
    const linha = buffer.slice(0, quebra).trim();
    buffer = buffer.slice(quebra + 1);
    if (!linha) continue;
    let msg;
    try {
      msg = JSON.parse(linha);
    } catch {
      log('linha ignorada (JSON inválido)');
      continue;
    }
    const lote = Array.isArray(msg) ? msg : [msg];
    for (const m of lote) {
      emVoo++;
      Promise.resolve(tratar(m))
        .catch((e) => log('erro não tratado:', e && e.stack))
        .finally(() => {
          emVoo--;
          talvezEncerrar();
        });
    }
  }
});

// Não encerrar com trabalho em andamento: uma chamada pode levar minutos.
process.stdin.on('end', () => {
  entradaFechada = true;
  talvezEncerrar();
});
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

log(
  `pronto | raízes=${CFG.raizes.join(',')} | escrita=${CFG.escrita ? 'ON' : 'OFF'} | bin=${CFG.bin}`,
);
