import { CellState, Game } from '../models/Game';

export type Position = {
  x: number;
  y: number;
};

type ShipType = 'small' | 'medium' | 'large' | 'huge';

export enum AttackResult {
  MISS = 'miss',
  KILLED = 'killed',
  SHOT = 'shot',
  NOTALLOWEDCELL = 'retry',
}

export type Ship = {
  position: Position;
  direction: boolean;
  length: number;
  type: ShipType;
};

export class GameService {
  playerShips: Record<number, Ship[]> = {};
  currentPlayerID: number;
  oponentID: number;

  winner: number | undefined;

  filledBoards = 0;

  constructor(public game: Game) {
    console.log('init game service');

    this.currentPlayerID = game.room.players[0].id;
    this.oponentID = game.room.players[1].id;
  }

  addShips(ships: Ship[], playerID: number, gameId: number) {
    if (this.game.id !== gameId) {
      console.log('Wrong game ID, ships was not placed');
      return;
    }

    const board = this.game.boards[playerID];

    for (const ship of ships) {
      const {
        position: { x, y },
      } = ship;

      // x for columns
      // y for rows
      for (let i = 0; i < ship.length; i++) {
        if (ship.direction) {
          // place vertical
          board[y + i][x] = CellState.TAKEN;
        } else {
          // place horizontal
          board[y][x + i] = CellState.TAKEN;
        }
      }
    }

    console.table(board);

    this.playerShips[playerID] = ships;

    this.filledBoards += 1;
  }

  attack(x: number, y: number, playerID: number) {
    if (playerID !== this.currentPlayerID) {
      console.log(
        `Get attack from playe ${playerID}, but turn for ${this.currentPlayerID}`,
      );
      return;
    }

    const oponentBoard = this.game.boards[this.oponentID];

    const targetCell = oponentBoard[y][x];

    switch (targetCell) {
      case CellState.EMPTY:
        oponentBoard[y][x] = CellState.MISSED;

        const tmp = this.currentPlayerID;
        this.currentPlayerID = this.oponentID;
        this.oponentID = tmp;

        return AttackResult.MISS;

      case CellState.MISSED:
      case CellState.SHOTED:
        return AttackResult.NOTALLOWEDCELL;

      case CellState.TAKEN:
        oponentBoard[y][x] = CellState.SHOTED;
        if (this.isKilled(x, y, oponentBoard)) {
          this.game.boatsLeft[this.oponentID] -= 1;
          if (this.game.boatsLeft[this.oponentID] === 0) {
            this.winner = this.currentPlayerID;
            this.game.room.players
              .find((player) => player.id === this.winner)
              ?.win();
          }
          return AttackResult.KILLED;
        } else {
          return AttackResult.SHOT;
        }

      default:
        break;
    }
  }

  isKilled(x: number, y: number, board: CellState[][]) {
    const visitedCells = new Set<string>();
    const visitQuery: Position[] = [];
    visitQuery.push({ x, y });
    while (true) {
      if (visitQuery.length === 0) {
        return true;
      }
      const { x, y } = visitQuery.pop()!;

      visitedCells.add(`${y}${x}`);

      for (let i = -1; i <= 1; i++) {
        const row = board[y + i];
        if (!row) {
          continue;
        }
        for (let j = -1; j <= 1; j++) {
          const cell = row[x + j];
          const coordsHash = `${y + i}${x + j}`;
          if (
            cell === undefined ||
            cell === CellState.MISSED ||
            visitedCells.has(coordsHash)
          ) {
            continue;
          }

          if (cell === CellState.TAKEN) {
            return false;
          }

          if (cell === CellState.SHOTED) {
            visitQuery.push({ x: x + j, y: y + i });
          }
        }
      }
    }
  }

  getShipNeighbour(x: number, y: number, playerID: number) {
    const [, board] = Object.entries(this.game.boards).filter(
      ([id]) => playerID.toString() !== id,
    )[0];

    const visitedCells = new Set<string>();
    const visitQuery: Position[] = [];
    visitQuery.push({ x, y });
    const result: Position[] = [];

    while (true) {
      if (visitQuery.length === 0) {
        return result;
      }

      const { x, y } = visitQuery.pop()!;

      visitedCells.add(`${y}${x}`);

      for (let i = -1; i <= 1; i++) {
        const row = board[y + i];
        if (!row) {
          continue;
        }
        for (let j = -1; j <= 1; j++) {
          const cell = row[x + j];
          const coordsHash = `${y + i}${x + j}`;
          if (cell === undefined || visitedCells.has(coordsHash)) {
            continue;
          }

          if (cell === CellState.EMPTY) {
            result.push({ x: x + j, y: y + i });
            board[y + i][x + j] = CellState.MISSED;
          }

          if (cell === CellState.SHOTED) {
            visitQuery.push({ x: x + j, y: y + i });
          }
        }
      }
    }
  }

  getShipCells(x: number, y: number, playerID: number) {
    const [, board] = Object.entries(this.game.boards).filter(
      ([id]) => playerID.toString() !== id,
    )[0];

    const visitQuery: Position[] = [];
    const visitedCells = new Set<string>();
    const result: Position[] = [];

    visitQuery.push({ x, y });

    while (true) {
      if (visitQuery.length === 0) {
        return result;
      }

      const { x, y } = visitQuery.pop()!;
      visitedCells.add(`${y}${x}`);

      for (let i = -1; i <= 1; i++) {
        const row = board[y + i];
        if (!row) {
          continue;
        }
        for (let j = -1; j <= 1; j++) {
          const cell = row[x + j];
          const position: Position = { x: x + j, y: y + i };
          const coordsHash = `${y + i}${x + j}`;

          if (cell === undefined) {
            continue;
          }

          if (cell === CellState.SHOTED) {
            result.push(position);
          }

          if (cell === CellState.SHOTED && !visitedCells.has(coordsHash)) {
            visitQuery.push(position);
          }
        }
      }
    }
  }
}
