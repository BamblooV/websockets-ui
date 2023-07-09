export class Player {
  name: string;
  password: string;
  id: number;
  socket: WebSocket;
  private _wins: number;
  RoomID: number | undefined;

  static counter = 1;

  static isValidUserBody(name: string, password: string, socket: WebSocket) {
    if (name.trim() && password.trim() && socket instanceof WebSocket) {
      return true;
    }

    return false;
  }

  constructor(name: string, password: string, socket: WebSocket) {
    this.name = name;
    this.password = password;
    this._wins = 0;
    this.socket = socket;
    this.id = Player.counter;
    Player.counter = Player.counter + 1;
  }

  get wins() {
    return this._wins;
  }

  win() {
    this._wins += 1;
  }
}
