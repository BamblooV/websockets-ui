import WebSocket from 'ws';

export class Player {
  name: string;
  password: string;
  id: number;
  private _wins: number;

  static counter = 1;

  static isValidUserBody(name: string, password: string) {
    if (name.trim() && password.trim()) {
      return true;
    }

    return false;
  }

  constructor(name: string, password: string) {
    this.name = name;
    this.password = password;
    this._wins = 0;
    this.id = Player.counter;
    Player.counter = Player.counter + 1;
  }

  get wins() {
    return this._wins;
  }

  win() {
    this._wins += 1;
  }

  static createBot() {
    const bot = new Player('bot', Math.random().toString());
    bot.id = -1;
    return bot;
  }
}
