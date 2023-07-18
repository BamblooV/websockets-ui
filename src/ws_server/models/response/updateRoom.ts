import { Player } from '../Player';

type PlayerInfo = {
  name: string;
  index: number;
};

export type UpdateRoomData = {
  roomId: number;
  roomUsers: PlayerInfo[];
};
