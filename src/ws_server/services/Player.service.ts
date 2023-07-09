import WebSocket from 'ws';
import { Player } from '../models/Player';

export type Winner = {
  name: string;
  wins: number;
};

export class PlayerService {
  private data: { [key: string]: Player } = {};

  addPlayer(player: Player) {
    this.data[player.name] = player;
  }

  isAlreadyRegistered(name: string) {
    return this.data.hasOwnProperty(name);
  }

  auth(name: string, password: string) {
    const player = this.data[name];
    if (player.password === password) {
      return player;
    }
    return undefined;
  }

  getWinners() {
    return Object.values(this.data)
      .reduce((acc: Winner[], player) => {
        if (player.wins > 0) {
          const { name, wins } = player;
          acc.push({ name, wins });
        }

        return acc;
      }, [])
      .sort((p1, p2) => p1.wins - p2.wins);
  }
}
