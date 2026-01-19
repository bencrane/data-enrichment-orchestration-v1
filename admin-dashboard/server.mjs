import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

// Set project name for port registry
process.env.PROJECT_NAME = 'admin-dashboard';

// Dynamic import after setting PROJECT_NAME
const { port } = await import('port-registry/port-client');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const allocatedPort = await port;

const app = next({ dev, hostname, port: allocatedPort });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url, true);
  handle(req, res, parsedUrl);
});

server.listen(allocatedPort, () => {
  console.log(`> Ready on http://${hostname}:${allocatedPort}`);
});
