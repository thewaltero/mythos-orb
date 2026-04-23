import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Portability: Allow overriding memory path & port via ENV for standalone use
const MEMORY_PATH = process.env.MEMORY_PATH || 
                  (fs.existsSync(path.resolve(__dirname, '../MEMORY.md')) 
                    ? path.resolve(__dirname, '../MEMORY.md') 
                    : path.resolve(__dirname, 'MEMORY.md'));

const REPO_ROOT = process.env.REPO_ROOT || path.dirname(MEMORY_PATH);
const PORT = process.env.PORT || 3333;

const server = fastify({ logger: false });

server.register(cors);

/**
 * Inline rate limiter — explicit preHandler so CodeQL can trace the guard.
 * Creates a sliding-window limiter keyed by IP address.
 */
function createRateLimiter(maxRequests, windowMs) {
  const hits = new Map();

  // Periodically purge expired entries to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) hits.delete(ip);
      else hits.set(ip, valid);
    }
  }, windowMs).unref();

  return function rateLimitPreHandler(request, reply, done) {
    const ip = request.ip;
    const now = Date.now();
    const timestamps = (hits.get(ip) || []).filter(t => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      reply.status(429).send({ error: 'Too many requests, please try again later.' });
      return;
    }

    timestamps.push(now);
    hits.set(ip, timestamps);
    done();
  };
}

// Rate limiters for API routes
const apiLimiter = createRateLimiter(100, 60 * 1000);     // 100 req/min
const openLimiter = createRateLimiter(10, 60 * 1000);     // 10 req/min

// Serve the production build if it exists
server.register(fastifyStatic, {
  root: path.join(__dirname, 'dist'),
  prefix: '/',
});

/**
 * Parsed memory structure
 */
function parseMemory() {
  if (!fs.existsSync(MEMORY_PATH)) return [];
  const content = fs.readFileSync(MEMORY_PATH, 'utf-8');
  const lines = content.split('\n');

  const sessions = [];
  let currentSession = null;
  let metadataBlock = [];
  let isParsingMeta = false;
  let rawLines = [];

  for (const line of lines) {
    if (line.includes('<!-- mythos:meta')) {
      isParsingMeta = true;
      metadataBlock = [];
      continue;
    }

    if (isParsingMeta && line.includes('-->')) {
      isParsingMeta = false;
      const meta = {};
      metadataBlock.forEach(m => {
        const [k, v] = m.split('=');
        if (k && v) meta[k.trim()] = v.trim();
      });
      if (currentSession) {
        currentSession.metadata = meta;
        currentSession.rawContent = rawLines.join('\n');
        sessions.push(currentSession);
        currentSession = null;
        rawLines = [];
      }
      continue;
    }

    if (isParsingMeta) {
      metadataBlock.push(line);
      continue;
    }

    rawLines.push(line);

    if (line.startsWith('|') && !line.includes('---') && !line.includes('Timestamp')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 4) {
        const ts = parts[1] || '';
        const action = parts[2] || '';
        const result = parts[3] || '';

        if (!currentSession) {
          currentSession = {
            id: Date.now() + Math.random(),
            entries: [],
            timestamp_start: ts,
            metadata: {}
          };
        }
        currentSession.entries.push({
          timestamp: ts,
          action: action,
          result: result
        });
      }
    }
  }

  return sessions.reverse();
}

/**
 * Endpoints
 */
server.get('/api/sessions', { preHandler: apiLimiter }, async () => {
  return parseMemory();
});

server.get('/api/diff', { preHandler: apiLimiter }, async (request, reply) => {
  const { hash } = request.query;
  if (!hash || !/^[a-f0-9]{7,40}$/.test(hash)) {
    return reply.status(400).send({ error: 'Invalid commit hash' });
  }

  return new Promise((resolve) => {
    const git = spawn('git', ['show', '--format=', hash], { cwd: REPO_ROOT });
    let stdout = '';
    git.stdout.on('data', (data) => stdout += data);
    git.on('close', () => resolve(stdout));
  });
});

server.post('/api/open', { preHandler: openLimiter }, async (request, reply) => {
  const { filePath } = request.body;

  // Allowlist: only permit safe path characters (no shell metacharacters)
  if (filePath && !/^[\w.\-\/\\ :]+$/.test(filePath)) {
    return reply.status(400).send({ error: 'Invalid file path characters' });
  }

  const target = filePath ? path.resolve(REPO_ROOT, filePath) : REPO_ROOT;

  try {
    // Path-traversal guard: resolved path must stay within REPO_ROOT
    if (!target.startsWith(REPO_ROOT)) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Verify the path actually exists before opening
    if (!fs.existsSync(target)) {
      return reply.status(404).send({ error: 'File not found' });
    }

    // Safe: explorer.exe is not a shell — no command-line interpretation occurs.
    // The target path is passed as a direct argument to a GUI executable.
    const child = spawn('explorer.exe', [target], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '127.0.0.1' });
    console.log(`\n🚀 Mythos Orb active at http://127.0.0.1:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
