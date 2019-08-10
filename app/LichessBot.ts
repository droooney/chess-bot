import * as https from 'https';
import * as http from 'http';
import * as _ from 'lodash';

import Bot from './Bot';
import {
  LichessChallenge,
  LichessGameEvent,
  LichessGameState,
  LichessLobbyEvent
} from './types';
import Utils, { Color, Result } from './Utils';

export default class LichessBot {
  token: string;
  name: string;
  bots: { [gameId: string]: Bot; } = {};

  constructor(token: string, name: string) {
    this.token = token;
    this.name = name;

    this.monitorCommandLine();
    this.monitorLobbyEvents();
  }

  createStream<T>(url: string): AsyncIterable<T> {
    const results: IteratorResult<T>[] = [];
    let result = '';
    let flush: ((data: IteratorResult<T>) => void) | null = null;

    return {
      [Symbol.asyncIterator]: () => {
        this.sendRequest(url, 'get', async (res) => {
          for await (const data of res) {
            if (data instanceof Buffer) {
              const lines = data.toString('utf8').split('\n');

              lines.forEach((data, ix) => {
                if (data) {
                  data = ix === 0
                    ? result + data
                    : data;

                  try {
                    results.push({
                      done: false,
                      value: JSON.parse(data)
                    });

                    result = '';
                  } catch (err) {
                    result = data;
                  }
                }
              });

              if (flush) {
                const result = results.shift();

                if (result) {
                  flush(result);
                }
              }
            }
          }

          const end = { done: true } as IteratorResult<T>;

          if (flush) {
            flush(end);
          } else {
            results.push(end);
          }
        });

        return {
          next() {
            return new Promise<IteratorResult<T>>((resolve) => {
              const result = results.shift();

              if (result) {
                resolve(result);
              } else {
                flush = (data) => {
                  resolve(data);

                  flush = null;
                };
              }
            });
          }
        };
      }
    };
  }

  handleChallenge(challenge: LichessChallenge) {
    console.log(challenge);
    console.log(`got challenge from ${challenge.challenger.name}: ${
      challenge.variant.name} ${challenge.speed} ${challenge.rated ? 'rated' : 'unrated'} game`);

    if (
      !challenge.rated
      && (challenge.variant.key === 'standard' || challenge.variant.key === 'fromPosition')
    ) {
      this.sendRequest(`/api/challenge/${challenge.id}/accept`, 'post');
    } else {
      this.sendRequest(`/api/challenge/${challenge.id}/decline`, 'post');
    }
  }

  async handleGameStart(gameId: string) {
    console.log(`game ${gameId} started. prev number of games: ${Object.keys(this.bots).length}`);

    const stream = this.createStream<LichessGameEvent>(`/api/bot/game/stream/${gameId}`);

    for await (const event of stream) {
      if (event.type === 'gameFull') {
        console.log(event);

        const bot = this.bots[gameId] = new Bot(
          event.initialFen === 'startpos' ? Bot.standardFen : event.initialFen,
          event.white.id === this.name ? Color.WHITE : Color.BLACK
        );

        this.handleGameState(gameId, bot, event.state);
      } else if (event.type === 'gameState') {
        const bot = this.bots[gameId];

        if (bot) {
          this.handleGameState(gameId, bot, event);
        }
      }
    }

    delete this.bots[gameId];

    console.log(`game ${gameId} ended. number of games: ${Object.keys(this.bots).length}`);
  }

  handleGameState(gameId: string, bot: Bot, gameState: LichessGameState) {
    if (gameState.moves) {
      gameState.moves.split(' ').slice(bot.moves.length).forEach((uci) => {
        bot.performMove(Utils.getMoveFromUci(uci), true);
      });
    }

    if (bot.result && bot.result < Result.DRAW) {
      return;
    }

    const move = bot.makeMove();

    if (move) {
      this.sendMove(gameId, move);
    }
  }

  async monitorCommandLine() {
    console.log('Listening to command line commands...');

    for await (const data of process.stdin) {
      if (data instanceof Buffer) {
        const command = data.toString('utf8').trim();
        const [keyword, ...additionalData] = command.split(/\s+/);

        if (keyword === 'move') {
          const [gameId, uci] = additionalData;

          this.sendMove(gameId, Utils.getMoveFromUci(uci));
        } else if (keyword === 'print') {
          const [gameId, prop] = additionalData;
          const bot = this.bots[gameId];

          if (bot) {
            console.log(_.get(bot, prop));
          }
        }
      }
    }
  }

  async monitorLobbyEvents() {
    console.log('Listening to lobby events...');

    const stream = this.createStream<LichessLobbyEvent>('/api/stream/event');

    for await (const event of stream) {
      if (event.type === 'challenge') {
        this.handleChallenge(event.challenge);
      } else if (event.type === 'gameStart') {
        this.handleGameStart(event.game.id);
      }
    }

    console.log('stream closed, opening again');

    this.monitorLobbyEvents();
  }

  sendMove(gameId: string, move: number) {
    this.sendRequest(`/api/bot/game/${gameId}/move/${Utils.getUciFromMove(move)}`, 'post');
  }

  sendRequest(url: string, method: string, callback?: (res: http.IncomingMessage) => void): void {
    https.get({
      protocol: 'https:',
      hostname: 'lichess.org',
      path: url,
      method,
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    }, callback);
  }
}
