export interface LichessUser {
  id: string;
  name: string;
}

export type LichessVariantKey = 'standard' | 'chess960' | 'kingOfTheHill' | 'threeCheck' | 'antichess' | 'atomic' | 'horde' | 'racingKings' | 'fromPosition';

export interface LichessVariant {
  key: LichessVariantKey;
  name: string;
  short: string;
}

export interface LichessUnlimitedTimeControl {
  type: 'unlimited';
}

export interface LichessCorrespondenceTimeControl {
  type: 'correspondence';
  daysPerTurn: number;
}

export interface LichessClockTimeControl {
  type: 'clock';
  limit: number;
  increment: number;
  show: string;
}

export type LichessTimeControl = LichessUnlimitedTimeControl | LichessCorrespondenceTimeControl | LichessClockTimeControl;

export type LichessSpeed = 'correspondence' | 'ultraBullet' | 'bullet' | 'blitz' | 'rapid' | 'classical';

export type LichessColor = 'white' | 'black' | 'random';

export interface LichessChallenge {
  id: string;
  status: string;
  challenger: LichessUser;
  destUser: LichessUser;
  variant: LichessVariant;
  rated: boolean;
  speed: LichessSpeed;
  timeControl: LichessTimeControl;
  color: LichessColor;
}

export interface LichessGameState {
  moves: string;
  wtime: number;
  btime: number;
  winc: number;
  binc: number;
  wdraw: boolean;
  bdraw: boolean;
}

export interface LichessChallengeEvent {
  type: 'challenge';
  challenge: LichessChallenge;
}

export interface LichessGameStartEvent {
  type: 'gameStart';
  game: {
    id: string;
  };
}

export type LichessLobbyEvent = LichessChallengeEvent | LichessGameStartEvent;

export interface LichessFullGameEvent {
  type: 'gameFull';
  id: string;
  variant: LichessVariant;
  speed: LichessSpeed;
  rated: boolean;
  createdAt: number;
  white: LichessUser;
  black: LichessUser;
  initialFen: string;
  state: LichessGameState;
}

export interface LichessGameStateEvent extends LichessGameState {
  type: 'gameState';
}

export interface LichessChatLineEvent {
  type: 'chatLine';
}

export type LichessGameEvent = LichessFullGameEvent | LichessGameStateEvent | LichessChatLineEvent;
