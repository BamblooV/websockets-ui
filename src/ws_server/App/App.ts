import WebSocket from 'ws';
import { PlayerService } from '../services';
import { ClientCommands, ServerCommands } from '../commands';
import { Player, Room, UpdateRoomData } from '../models';

type ClientRequest = {
  type: ClientCommands;
  data: string;
};

class ResponseFactory {
  type: ServerCommands;
  data: string;
  id: 0;

  constructor(type: ServerCommands, data: string) {
    this.type = type;
    this.data = data;
    this.id = 0;
  }

  static stringInstance(type: ServerCommands, data: string) {
    return JSON.stringify(new ResponseFactory(type, data));
  }
}

type ExtendedSocket = WebSocket & {
  player?: Player;
  room?: Room;
};

export class App {
  private openSockets: Record<number, ExtendedSocket> = {};

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
        const responseData = JSON.stringify(this.authHandler(data, socket));
        const respone = ResponseFactory.stringInstance(
          ServerCommands.REG,
          responseData,
        );

        socket.send(respone);

        this.notifyEveryone(
          ResponseFactory.stringInstance(
            ServerCommands.UPDATE_ROOM,
            this.updateRooms(),
          ),
        );

        break;
      }

      case ClientCommands.CREATE_ROOM: {
        this.createRoom(socket);
      }

      default:
        break;
    }
  }

  private authHandler(data: string, socket: ExtendedSocket) {
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
      this.openSockets[player.id].terminate();

      this.openSockets[player.id] = socket;
      socket.player = player;
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
    socket.player = player;
    return responseData;
  }

  private createRoom(socket: ExtendedSocket) {
    if (socket.room) {
      return;
    }

    const room = new Room();
    if (!socket.player) {
      throw new Error('Socket should have player field');
    }
    room.addPlayer(socket.player);

    socket.room = room;

    const responseData = this.updateRooms();
    const response = ResponseFactory.stringInstance(
      ServerCommands.UPDATE_ROOM,
      responseData,
    );
    this.notifyEveryone(response);
  }

  private notifyEveryone(response: string) {
    console.log('send new rooms to everyone');

    Object.values(this.openSockets).forEach((socket) => {
      socket.send(response);
    });
  }

  private updateRooms() {
    const responseData = Object.values(this.openSockets).reduce(
      (acc, socket) => {
        const { room } = socket;
        if (room && room.players.length === 1) {
          const player = room.players[0];
          acc.push({
            roomId: room.id,
            roomUsers: [{ name: player.name, index: player.id }],
          });
        }
        return acc;
      },
      <UpdateRoomData[]>[],
    );

    return JSON.stringify(responseData);
  }
}
