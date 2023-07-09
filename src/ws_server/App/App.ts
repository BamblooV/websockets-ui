import WebSocket from 'ws';
import { PlayerService } from '../services';
import { ClientCommands, ServerCommands } from '../commands';
import { Player } from '../models';

type ClientRequest = {
  type: ClientCommands;
  data: string;
};

class ResponseFactory {
  type: ServerCommands;
  data: string;
  id: 0;

  constructor(type: ServerCommands, data: any) {
    this.type = type;
    this.data = JSON.stringify(data);
    this.id = 0;
  }
}

export class App {
  private openSockets: { [key: number]: WebSocket } = {};

  constructor(private playerService: PlayerService) {}

  connectionHandler(socket: WebSocket) {
    console.log('New connection to app');

    socket.on('message', (msg) => this.commandDispatcher(msg, socket));
  }

  private commandDispatcher(msg: WebSocket.RawData, socket: WebSocket) {
    const requestObj: ClientRequest = JSON.parse(msg.toString());

    const { type, data } = requestObj;
    console.log(`App get command ${type}`);
    console.log(`App get data ${data}`);

    switch (type) {
      case ClientCommands.REG: {
        const responseData = this.authHandler(data, socket);
        const respone = new ResponseFactory(ServerCommands.REG, responseData);
        console.log(responseData);

        socket.send(JSON.stringify(respone));
        break;
      }

      default:
        break;
    }
  }

  private authHandler(data: string, socket: WebSocket) {
    const { name, password } = JSON.parse(data);

    let responseData = {
      name,
      password,
      error: false,
      errorText: '',
    };

    let player: Player | undefined;

    if (this.playerService.isAlreadyRegistered(name)) {
      player = this.playerService.auth(name, password);

      if (!player) {
        console.log('Wrong password');

        responseData.error = true;
        responseData.errorText = 'Wrong password';
        return responseData;
      }

      this.openSockets[player.id].close();

      this.openSockets[player.id] = socket;
      return responseData;
    }

    player = Player.isValidUserBody(name, password)
      ? new Player(name, password)
      : undefined;

    if (!player) {
      console.log('Invalid name or password');

      responseData.error = true;
      responseData.errorText = 'Invalid name or password';
      return responseData;
    }

    this.playerService.addPlayer(player);
    this.openSockets[player.id] = socket;
    return responseData;
  }

  private createRoom() {}
}
