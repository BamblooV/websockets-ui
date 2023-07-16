import WebSocket from 'ws';
import { PlayerService } from '../services';
import { ClientCommands, ServerCommands } from '../commands';
import { Player, Room, UpdateRoomData } from '../models';
import {
  AttackResult,
  GameService,
  Position,
  Ship,
} from '../services/Game.service';
import { CellState, Game } from '../models/Game';

type ClientRequest = {
  type: ClientCommands;
  data: string;
};

interface AddShipsRequest {
  gameId: number;
  ships: Ship[];
  indexPlayer: number;
}

interface AttackRequest {
  gameId: number;
  x: number;
  y: number;
  indexPlayer: number;
}

interface RandomAttackRequest {
  gameId: number;
  indexPlayer: number;
}

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
  gameService?: GameService;
};

export class App {
  private openSockets: Record<number, ExtendedSocket> = {};

  constructor(private playerService: PlayerService) {}

  connectionHandler(socket: WebSocket) {
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

        this.sendUpdatedRooms();
        this.sendUpdateWinners();
        break;
      }

      case ClientCommands.CREATE_ROOM: {
        this.createRoomHandler(socket);
        break;
      }

      case ClientCommands.ADD_USER_TO_ROOM: {
        this.addUserToRoomHandler(socket, data);
        break;
      }

      case ClientCommands.ADD_SHIPS: {
        this.addShipsHandler(socket, data);
        break;
      }

      case ClientCommands.ATTACK: {
        this.attackHandler(socket, data);
        break;
      }

      case ClientCommands.RANDOM_ATTACK: {
        this.randomAttack(socket, data);
        break;
      }

      case ClientCommands.PLAY_WITH_BOT: {
        break;
      }

      default:
        break;
    }
  }

  private authHandler(data: string, socket: ExtendedSocket) {
    const { name, password } = JSON.parse(data);

    console.log(`auth user: ${name} ${password}`);

    let responseData = {
      name,
      password,
      error: false,
      errorText: '',
    };

    let player: Player | undefined;

    socket.on('close', () => {
      console.log('socket disconect');

      if (!player) {
        return;
      }

      delete this.openSockets[player.id];

      this.sendUpdatedRooms();
    });

    if (this.playerService.isAlreadyRegistered(name)) {
      player = this.playerService.auth(name, password);

      if (!player) {
        console.log('Wrong password');

        responseData.error = true;
        responseData.errorText = 'Wrong password';
        return responseData;
      }

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

  private createRoomHandler(socket: ExtendedSocket) {
    console.log(`Create room for ${socket.player?.id} ${socket.player?.name}`);

    if (socket.room) {
      console.log('room already exist');
      delete socket.room;
    }

    const room = new Room();
    if (!socket.player) {
      throw new Error('Socket should have player field');
    }
    room.addPlayer(socket.player);

    socket.room = room;

    this.sendUpdatedRooms();
  }

  private addUserToRoomHandler(socket: ExtendedSocket, data: string) {
    const { indexRoom } = JSON.parse(data);

    const { player } = socket;

    console.log(`Add user ${player?.name} to room`);

    const room = Object.values(this.openSockets).find(
      (roomMaster) => roomMaster.room?.id === indexRoom,
    )?.room;

    if (!player || !room) {
      console.log('Unexpected: sockets miss player or room fields');
      this.sendUpdatedRooms();
      return;
    }

    if (socket.room?.id === indexRoom) {
      return;
    }

    room.addPlayer(player);
    socket.room = room;

    this.sendUpdatedRooms();

    if (room.players.length === 2) {
      this.createGame(room);
    }
  }

  private createGame(room: Room) {
    console.log('Create game for room ', room.id);
    const game = new Game(room);

    const gameService = new GameService(game);

    room.players.forEach((player) => {
      const socket = this.openSockets[player.id];
      socket.gameService = gameService;

      socket.on('close', () => {
        const players = socket.gameService?.game.room.players;

        if (!players) {
          return;
        }

        players
          .filter((player) => player.id !== socket.player?.id)
          .forEach((player) => {
            const socket = this.openSockets[player.id];
            socket.send(
              ResponseFactory.stringInstance(
                ServerCommands.FINISH,
                JSON.stringify({
                  winPlayer: player.id,
                }),
              ),
            );
            player.win();

            delete socket.room;
            delete socket.gameService;
          });

        this.sendUpdateWinners();
      });

      socket.send(
        ResponseFactory.stringInstance(
          ServerCommands.CREATE_GAME,
          JSON.stringify({
            idGame: game.id,
            idPlayer: player.id,
          }),
        ),
      );
    });
  }

  private notifyEveryone(response: string) {
    Object.values(this.openSockets).forEach((socket) => {
      socket.send(response);
    });
  }

  private sendUpdatedRooms() {
    console.log('Send new rooms to everyone');

    this.notifyEveryone(
      ResponseFactory.stringInstance(
        ServerCommands.UPDATE_ROOM,
        this.updateRooms(),
      ),
    );
  }

  private sendUpdateWinners() {
    console.log('Send winners to everyone');

    const winners = this.playerService.getWinners();
    this.notifyEveryone(
      ResponseFactory.stringInstance(
        ServerCommands.UPDATE_WINNERS,
        JSON.stringify(winners),
      ),
    );
  }

  private updateRooms() {
    console.log('Collect rooms with 1 player');

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

  private addShipsHandler(socket: ExtendedSocket, data: string) {
    const { gameId, ships, indexPlayer } = JSON.parse(data) as AddShipsRequest;

    const service = socket.gameService;

    if (!service) {
      console.log('No game service on player socket ', socket.player?.id);
      return;
    }

    service.addShips(ships, indexPlayer, gameId);

    if (service?.filledBoards === 2) {
      service.game.room.players.forEach((player) => {
        const socket = this.openSockets[player.id];
        const ships = service.playerShips[player.id];
        socket.send(
          ResponseFactory.stringInstance(
            ServerCommands.START_GAME,
            JSON.stringify({
              ships,
              currentPlayerIndex: player.id,
            }),
          ),
        );
        const currentPlayer = service.currentPlayerID;
        this.sendTurn(socket, currentPlayer);
      });
    }
  }

  private attackHandler(socket: ExtendedSocket, data: string) {
    const { gameId, x, y, indexPlayer } = JSON.parse(data) as AttackRequest;

    const service = socket.gameService;

    if (!service) {
      console.log('No game service on player socket ', socket.player?.id);
      return;
    }

    if (service.game.id !== gameId) {
      console.log(
        `Wrong gameID while attack. Should ${service.game.id}, but get ${gameId}`,
      );
      return;
    }

    const attackResult = service.attack(x, y, indexPlayer);

    if (!attackResult) {
      return;
    }

    if (attackResult === AttackResult.NOTALLOWEDCELL) {
      this.sendTurn(socket, indexPlayer);
      return;
    }

    const players = service.game.room.players;

    players.forEach((player) => {
      const socket = this.openSockets[player.id];
      socket.send(
        ResponseFactory.stringInstance(
          ServerCommands.ATTACK,
          JSON.stringify({
            position: {
              x,
              y,
            },
            currentPlayer: indexPlayer,
            status: attackResult,
          }),
        ),
      );

      this.sendTurn(socket, service.currentPlayerID);
    });

    if (attackResult === AttackResult.KILLED) {
      const cellsToMiss = service.getShipNeighbour(x, y, indexPlayer);
      const cellsToKill = service.getShipCells(x, y, indexPlayer);

      cellsToMiss.forEach(({ x, y }) => {
        players.forEach((player) => {
          const socket = this.openSockets[player.id];
          socket.send(
            ResponseFactory.stringInstance(
              ServerCommands.ATTACK,
              JSON.stringify({
                position: {
                  x,
                  y,
                },
                currentPlayer: indexPlayer,
                status: AttackResult.MISS,
              }),
            ),
          );
        });
      });

      cellsToKill.forEach(({ x, y }) => {
        players.forEach((player) => {
          const socket = this.openSockets[player.id];
          socket.send(
            ResponseFactory.stringInstance(
              ServerCommands.ATTACK,
              JSON.stringify({
                position: {
                  x,
                  y,
                },
                currentPlayer: indexPlayer,
                status: AttackResult.KILLED,
              }),
            ),
          );
        });
      });

      this.sendTurn(socket, service.currentPlayerID);
    }

    if (service.winner) {
      players.forEach((player) => {
        const socket = this.openSockets[player.id];
        socket.send(
          ResponseFactory.stringInstance(
            ServerCommands.FINISH,
            JSON.stringify({
              winPlayer: service.currentPlayerID,
            }),
          ),
        );
        delete socket.room;
        delete socket.gameService;
      });

      this.sendUpdateWinners();
    }
  }

  private randomAttack(socket: ExtendedSocket, data: string) {
    const { gameId, indexPlayer } = JSON.parse(data) as RandomAttackRequest;

    const service = socket.gameService;

    if (!service) {
      console.log('No game service on player socket ', socket.player?.id);
      return;
    }

    if (service.game.id !== gameId) {
      console.log(
        `Wrong gameID while attack. Should ${service.game.id}, but get ${gameId}`,
      );
      return;
    }

    const cellsToAttack: Position[] = [];

    service.game.boards[indexPlayer].forEach((row, rowIndex) => {
      row.forEach((cell, cellIndex) => {
        if (cell === CellState.EMPTY || cell === CellState.TAKEN) {
          cellsToAttack.push({ y: rowIndex, x: cellIndex });
        }
      });
    });

    const randomCellPosition: Position =
      cellsToAttack[Math.floor(Math.random() * cellsToAttack.length)];

    this.attackHandler(
      socket,
      JSON.stringify({
        gameId,
        x: randomCellPosition.x,
        y: randomCellPosition.y,
        indexPlayer,
      }),
    );
  }

  private sendTurn(socket: ExtendedSocket, currentPlayer: number) {
    socket.send(
      ResponseFactory.stringInstance(
        ServerCommands.TURN,
        JSON.stringify({
          currentPlayer,
        }),
      ),
    );
  }
}
