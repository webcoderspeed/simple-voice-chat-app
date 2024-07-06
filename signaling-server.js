const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const rooms = {};

wss.on('connection', (ws) => {
	ws.on('message', (message) => {
		const data = JSON.parse(message);
		const { type, payload, room } = data;

		if (!rooms[room]) {
			rooms[room] = [];
		}

		if (type === 'offer' || type === 'answer' || type === 'new-ice-candidate') {
			rooms[room].forEach((client) => {
				if (client !== ws && client.readyState === WebSocket.OPEN) {
					client.send(JSON.stringify({ type, payload }));
				}
			});
		}

		if (!rooms[room].includes(ws)) {
			rooms[room].push(ws);
		}

		ws.on('close', () => {
			rooms[room] = rooms[room].filter((client) => client !== ws);
			if (rooms[room].length === 0) {
				delete rooms[room];
			}
		});

		console.log({rooms, })
	});
});

console.log('Signaling server running on ws://localhost:8080');
