import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

// Set project name for port registry
process.env.PROJECT_NAME = 'admin-dashboard';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';

// Try to use port-registry if available, otherwise use default port 3000
let allocatedPort = 3000;
try {
  const { port } = await import('port-registry/port-client');
  allocatedPort = await port;
} catch {
  // port-registry not available, use default
}

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
