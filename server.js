const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('Server listening on port 8080');

const clients = new Set();

wss.on('connection', (ws) => {
    console.log('New ws connection');
    clients.add(ws);

    ws.on('message', (message) => {
        console.log('New data:', message);
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(`${message}`);
            }
        });
    });

    ws.on('close', () => {
        console.log('WS connection closed');
        clients.delete(ws);
    });

    ws.send('Hello.');
});
