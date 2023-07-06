import { WebSocketServer } from 'ws';

// TODO:
//  PlayerService for create and store player, store and manage winners methods: Login or create player || Update winners
//  RoomService for creating and store rooms, methods : Create new room || Add player to room || Update room state
//  GameService for managing board, ships, game routrine

enum Commands {
  REG = 'reg',
}

const WS_PORT = 3000;

const wss = new WebSocketServer({ port: WS_PORT, host: 'localhost' });

wss.on('connection', (socket) => {
  console.log(`New connection to wss:${WS_PORT}`);

  socket.on('message', (msg) => {
    const msgObj = JSON.parse(msg.toString());
    const { type, data } = msgObj;

    console.log('type ', type);
    console.log('data ', data);

    switch (type) {
      case Commands.REG:
        const { name, password } = JSON.parse(data);
        console.log('name ', name);
        console.log('password ', password);

        const responseData = {
          name,
          password,
          error: false,
          errorText: '',
        };

        const response = {
          type: Commands.REG,
          data: JSON.stringify(responseData),
          id: 0,
        };

        socket.send(JSON.stringify(response));
        break;

      default:
        break;
    }
  });
});
