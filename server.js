const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('Server listening on port 8080');

const externalWsUrl = 'ws://localhost:9090';

wss.on('connection', (ws) => {
    console.log('New ws connection');

    ws.on('message', (message) => {
        console.log('New data:', message);

        const externalWs = new WebSocket(externalWsUrl);

        externalWs.on('open', () => {
            externalWs.send(message);
            console.log(`Forwarded data to external WebSocket: ${message}`);
        });

        externalWs.on('message', (externalMessage) => {
            console.log(`Received from external server: ${externalMessage}`);
            ws.send(`Response from external server: ${externalMessage}`);
        });

        externalWs.on('close', () => {
            console.log('Connection to external WebSocket closed');
        });
    });

    ws.on('close', () => {
        console.log('WS connection closed');
    });

    ws.send('Hello.');
});
