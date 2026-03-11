import { WebSocketServer } from 'ws';
import net from 'net';

const PORT = parseInt(process.env.WS_PROXY_PORT || '5433', 10);
const PG_PORT = parseInt(process.env.PG_PORT || '5432', 10);
const PG_HOST = process.env.PG_HOST || 'localhost';

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  const tcp = net.connect({ port: PG_PORT, host: PG_HOST });

  tcp.on('connect', () => {
    ws.on('message', (data) => {
      tcp.write(Buffer.isBuffer(data) ? data : Buffer.from(data));
    });
    tcp.on('data', (data) => {
      if (ws.readyState === 1) ws.send(data);
    });
  });

  const cleanup = () => {
    tcp.destroy();
    if (ws.readyState <= 1) ws.close();
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
  tcp.on('close', cleanup);
  tcp.on('error', cleanup);
});

console.log(`[ws-proxy] WebSocket→TCP proxy: ws://localhost:${PORT} → tcp://${PG_HOST}:${PG_PORT}`);
