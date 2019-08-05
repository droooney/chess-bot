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
import Utils, { Color } from './Utils';

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
    const results: T[] = [];
    let flush: ((data: T) => void) | null = null;

    return {
      [Symbol.asyncIterator]: () => {
        this.sendRequest(url, 'get', async (res) => {
          for await (const data of res) {
            if (data instanceof Buffer) {
              data.toString('utf8').split('\n').forEach((data) => {
                if (data) {
                  try {
                    results.push(JSON.parse(data));
                  } catch (err) {
                    /* empty */
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
        });

        return {
          next() {
            return new Promise<IteratorResult<T>>((resolve) => {
              const result = results.shift();

              if (result) {
                resolve({
                  done: false,
                  value: result
                });
              } else {
                flush = (data) => {
                  resolve({
                    done: false,
                    value: data
                  });

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
    console.log('challenge', challenge);

    if (
      !challenge.rated
      && challenge.variant.key === 'standard'
      && challenge.speed === 'classical'
    ) {
      this.sendRequest(`/api/challenge/${challenge.id}/accept`, 'post');
    } else {
      this.sendRequest(`/api/challenge/${challenge.id}/decline`, 'post');
    }
  }

  async handleGameStart(gameId: string) {
    const stream = this.createStream<LichessGameEvent>(`/api/bot/game/stream/${gameId}`);

    for await (const event of stream) {
      if (event.type === 'gameFull') {
        const bot = this.bots[gameId] = new Bot(event.white.id === this.name ? Color.WHITE : Color.BLACK);

        this.handleGameState(gameId, bot, event.state);
      } else if (event.type === 'gameState') {
        const bot = this.bots[gameId];

        if (bot) {
          this.handleGameState(gameId, bot, event);
        }
      }
    }
  }

  handleGameState(gameId: string, bot: Bot, gameState: LichessGameState) {
    if (gameState.moves) {
      gameState.moves.split(' ').slice(bot.moves.length).forEach((uci) => {
        bot.performMove(Utils.getMoveFromUci(uci), true);
      });
    }

    if (bot.result) {
      delete this.bots[gameId];
    }

    const move = bot.makeMove();

    if (move) {
      this.sendMove(gameId, move);
    }
  }

  async monitorCommandLine() {
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
    const stream = this.createStream<LichessLobbyEvent>('/api/stream/event');

    for await (const event of stream) {
      if (event.type === 'challenge') {
        this.handleChallenge(event.challenge);
      } else if (event.type === 'gameStart') {
        this.handleGameStart(event.game.id);
      }
    }
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
