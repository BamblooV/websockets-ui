import { Room } from './Room';

export enum CellState {
  EMPTY = 0,
  TAKEN = 1,
  SHOTED = 2,
  MISSED = 3,
}

export class Game {
  id: number;
  boards: Record<number, CellState[][]> = {};
  boatsLeft: Record<number, number> = {};

  static counter = 0;
  constructor(public room: Room) {
    this.id = Game.counter;
    Game.counter = Game.counter + 1;

    console.log('init game with id: ', this.id);

    room.players.forEach((player) => {
      this.boatsLeft[player.id] = 10;
      this.boards[player.id] = Array(10)
        .fill(-1)
        .map((_) => Array(10).fill(CellState.EMPTY));
    });
  }
}
