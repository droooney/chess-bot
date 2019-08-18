import * as https from 'https';
import * as http from 'http';
import * as qs from 'qs';
import * as _ from 'lodash';

import Bot from './Bot';
import {
  LichessChallenge,
  LichessCreateChallengeOptions,
  LichessGameEvent,
  LichessGameState,
  LichessLobbyEvent
} from './types';
import Utils, { Color, Result } from './Utils';

export default class LichessBot {
  token: string;
  name: string;
  isProduction: boolean;
  bots: { [gameId: string]: Bot; } = {};

  constructor(token: string, name: string, isProduction: boolean) {
    this.token = token;
    this.name = name;
    this.isProduction = isProduction;

    this.monitorCommandLine();
    this.monitorLobbyEvents();
  }

  createChallenge(userId: string, challengeOptions: LichessCreateChallengeOptions) {
    this.sendRequest(`/api/challenge/${userId}`, 'post', challengeOptions);
  }

  createStream<T>(url: string): AsyncIterable<T> {
    const results: IteratorResult<T>[] = [];
    let result = '';
    let flush: ((data: IteratorResult<T>) => void) | null = null;

    return {
      [Symbol.asyncIterator]: () => {
        this.sendRequest(url, 'get', null, async (res) => {
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
      && (
        challenge.variant.key === 'standard'
        || (!this.isProduction && challenge.variant.key === 'fromPosition')
      )
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
        bot.performMove(Utils.uciToMove(uci));
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

          this.sendMove(gameId, Utils.uciToMove(uci));
        } else if (keyword === 'challenge') {
          const [userId, clock = '3+0', colorString] = additionalData;
          const color = colorString === 'white' || colorString === 'black'
            ? colorString
            : 'random';
          const [initial, increment = '0'] = clock.split('+');

          this.createChallenge(userId, {
            rated: false,
            'clock.limit': +initial * 60,
            'clock.increment': +increment,
            color
          });
        } else if (keyword === 'resign') {
          const [gameId] = additionalData;

          this.resign(gameId);
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

    await new Promise((resolve) => setTimeout(resolve, 5000));
    await this.monitorLobbyEvents();
  }

  resign(gameId: string) {
    this.sendRequest(`/api/bot/game/${gameId}/resign`, 'post');
  }

  sendMove(gameId: string, move: number) {
    this.sendRequest(`/api/bot/game/${gameId}/move/${Utils.moveToUci(move)}`, 'post');
  }

  sendRequest(path: string, method: string, body?: object | null, callback?: (res: http.IncomingMessage) => void): void {
    const data = qs.stringify(body || {});
    const req = https.request({
      protocol: 'https:',
      hostname: 'lichess.org',
      path,
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      }
    }, callback);

    req.end(data);
  }
}
