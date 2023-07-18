import { Player } from './Player';

export class Room {
  private _players: Player[] = [];
  id: number;

  static counter = 0;

  constructor() {
    this.id = Room.counter;
    Room.counter = Room.counter + 1;
  }

  addPlayer(player: Player) {
    this.players.push(player);
  }

  get players() {
    return this._players;
  }
}
