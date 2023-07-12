import { WebSocketServer } from 'ws';
import { PlayerService } from './services';
import { App } from './App';

const WS_PORT = 3000;

const wss = new WebSocketServer({ port: WS_PORT, host: 'localhost' });

const playerService = new PlayerService();

const app = new App(playerService);

wss.on('connection', (socket, req) => {
  console.log(`New connection to wss:${WS_PORT}`);
  app.connectionHandler(socket);
});
