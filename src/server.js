import WebSocket, { WebSocketServer } from 'ws';
import config from './server-cfg.js';

const wss = new WebSocketServer({ port: config.port });

console.log(`Server listening on port ${config.port} `);

const clients = new Set();

wss.on('connection', (ws) => {
    console.log('New ws connection');
    clients.add(ws);

    ws.on('message', (message) => {
        console.log('New data:', message);
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(`${message}`);
            }
        });
    });

    ws.on('close', () => {
        console.log('WS connection closed');
        clients.delete(ws);
    });
});
