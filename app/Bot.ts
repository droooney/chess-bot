import 'colors';

import Game from './Game';
import { Color, Piece, PieceType } from './Utils';

interface PositionInfo {
  squareAttacks: { [color in Color]: { [square in number]: PieceType[]; }; };
  attacks: { [color in Color]: number[][]; };
  pawns: { [color in Color]: Piece[]; };
  pawnFiles: { [color in Color]: { [file in number]: { min: number; max: number; }; }; };
}

export default class Bot extends Game {
  static SEARCH_DEPTH = 2 * 2;
  static OPTIMAL_MOVE_THRESHOLD = 50;
  static MATE_SCORE = 1e7;

  static getMateScore(depth: number): number {
    return -(Bot.MATE_SCORE - depth);
  }

  static getScore(score: number): string {
    return Bot.isMateScore(score)
      ? `#${score < 0 ? '-' : ''}${Math.ceil((Bot.MATE_SCORE - Math.abs(score)) / 2)}`
      : `${score / 1000}`;
  }

  static isMateScore(score: number): boolean {
    return Math.abs(score) > 1e6;
  }

  color: Color;
  debug: boolean;
  moveCount: number = 0;
  evaluatedPositions: Map<bigint, number> = new Map();
  evaluatedPawnPositions: { [color in Color]: Map<bigint, number>; } = [new Map(), new Map()];
  nodes: number = 0;
  evalTime: number = 0;
  evalKingSafetyTime: number = 0;
  evalPawnsTime: number = 0;
  evalPiecesTime: number = 0;
  calculatePositionInfoTime: number = 0;
  calculateLegalMovesTime: number = 0;
  performMoveTime: number = 0;
  revertMoveTime: number = 0;
  moveSortTime: number = 0;
  mateTime: number = 0;
  drawTime: number = 0;

  constructor(fen: string, color: Color, debug: boolean) {
    super(fen);

    this.color = color;
    this.debug = debug;
  }

  eval(depth: number): number {
    const timestamp = this.getTimestamp();

    if (this.isCheck && this.isNoMoves()) {
      this.mateTime += this.getTimestamp() - timestamp;

      return Bot.getMateScore(depth);
    }

    const timestamp2 = this.getTimestamp();

    this.mateTime += timestamp2 - timestamp;

    if (this.isDraw || (!this.isCheck && this.isNoMoves())) {
      this.drawTime += this.getTimestamp() - timestamp2;

      return 0;
    }

    const timestamp3 = this.getTimestamp();

    this.drawTime += timestamp3 - timestamp2;

    const currentPawnScore = this.evaluatedPawnPositions[this.turn].get(this.pawnKey);
    const noPawnScore = currentPawnScore === undefined;
    const positionInfo: PositionInfo = {
      squareAttacks: [{}, {}],
      attacks: [[], []],
      pawns: [[], []],
      pawnFiles: [{}, {}]
    };
    let pawnCount = 0;

    for (let color = Color.WHITE; color <= Color.BLACK; color++) {
      const pieces = this.pieces[color];
      const pieceCount = this.pieceCounts[color];

      for (let i = 0; i < pieceCount; i++) {
        const piece = pieces[i];
        const attacks = this.getAttacks(piece);

        positionInfo.attacks[color].push(attacks);

        if (piece.type === PieceType.PAWN) {
          const rank = Bot.squareRanks[piece.square];
          const file = Bot.squareFiles[piece.square];

          if (noPawnScore) {
            const currentFileInfo = positionInfo.pawnFiles[color][file];

            if (currentFileInfo) {
              currentFileInfo.max = Math.max(rank, currentFileInfo.max);
              currentFileInfo.min = Math.max(rank, currentFileInfo.min);
            } else {
              positionInfo.pawnFiles[color][file] = { max: rank, min: rank };
            }

            positionInfo.pawns[color].push(piece);
          } else {
            positionInfo.pawnFiles[color][file] = { max: rank, min: rank };
          }

          pawnCount++;
        }

        for (let i = 0; i < attacks.length; i++) {
          const square = attacks[i];

          if (this.board[square]) {
            (positionInfo.squareAttacks[color][square] = positionInfo.squareAttacks[color][square] || []).push(piece.type);
          }
        }
      }
    }

    const isEndgame = (
      pawnCount < 5
      || this.pieceCounts[Color.WHITE] + this.pieceCounts[Color.BLACK] - pawnCount < 9
    );
    const timestamp4 = this.getTimestamp();
    const pawnsScore = noPawnScore
      ? this.evalPawns(this.turn, positionInfo) - this.evalPawns(Game.oppositeColor[this.turn], positionInfo)
      : currentPawnScore!;

    if (noPawnScore) {
      this.evaluatedPawnPositions[this.turn].set(this.pawnKey, pawnsScore);
    }

    if (this.debug) {
      this.calculatePositionInfoTime += timestamp4 - timestamp3;
      this.evalPawnsTime += this.getTimestamp() - timestamp4;
    }

    return pawnsScore + this.evalColor(this.turn, positionInfo, isEndgame) - this.evalColor(Game.oppositeColor[this.turn], positionInfo, isEndgame);
  }

  evalColor(color: Color, positionInfo: PositionInfo, isEndgame: boolean): number {
    const timestamp = this.getTimestamp();

    const kingSafetyScore = this.evalKingSafety(color, isEndgame);
    const timestamp2 = this.getTimestamp();

    const piecesScore = this.evalPieces(color, positionInfo, isEndgame);

    if (this.debug) {
      this.evalKingSafetyTime += timestamp2 - timestamp;
      this.evalPiecesTime += this.getTimestamp() - timestamp2;
    }

    return kingSafetyScore + piecesScore;
  }

  evalKingSafety(color: Color, isEndgame: boolean): number {
    const king = this.kings[color];

    if (isEndgame) {
      return 0;
    }

    const kingFile = Bot.squareFiles[king.square];
    const kingRank = Bot.squareRanks[king.square];
    const isWhite = color === Color.WHITE;

    if (isWhite ? kingRank > Bot.ranks.RANK_4[Color.WHITE] : kingRank < Bot.ranks.RANK_4[Color.BLACK]) {
      return -3000;
    }

    if (kingRank === Bot.ranks.RANK_4[color]) {
      return -2000;
    }

    if (kingRank === Bot.ranks.RANK_3[color]) {
      return -1000;
    }

    if (
      kingRank === Bot.ranks.RANK_2[color]
      && kingFile >= Bot.files.FILE_C
      && kingFile < Bot.files.FILE_G
    ) {
      return kingFile === Bot.files.FILE_D || kingFile === Bot.files.FILE_E
        ? -750
        : -500;
    }

    if (kingFile === Bot.files.FILE_D || kingFile === Bot.files.FILE_E) {
      return -250;
    }

    if (kingFile === Bot.files.FILE_F) {
      return -100;
    }

    const upperRank = kingRank + Bot.directions.UP[color];
    const defendingPieces = [
      this.board[Bot.squares[kingRank][kingFile - 1]],
      this.board[Bot.squares[kingRank][kingFile + 1]],
      this.board[Bot.squares[upperRank][kingFile - 1]],
      this.board[Bot.squares[upperRank][kingFile]],
      this.board[Bot.squares[upperRank][kingFile + 1]]
    ];

    let score = kingRank === Bot.ranks.RANK_1[color] && kingFile === Bot.files.FILE_C ? 0 : 100;

    for (let i = 0, l = defendingPieces.length; i < l; i++) {
      const piece = defendingPieces[i];

      if (piece && piece.color === color) {
        score += (
          Bot.squareRanks[piece.square] === upperRank
            ? piece.type === PieceType.PAWN
              ? 100
              : 50
            : piece.type === PieceType.PAWN
              ? 50
              : 25
        );
      }
    }

    return score;
  }

  evalPawns(color: Color, positionInfo: PositionInfo): number {
    const isWhite = color === Color.WHITE;
    const pawns = positionInfo.pawns[color];
    const pawnFiles = positionInfo.pawnFiles[color];
    const opponentPawnFiles = positionInfo.pawnFiles[Bot.oppositeColor[color]];
    let score = 0;
    let islandState: 0 | 1 = 0;
    let islandsCount = 0;

    for (let file = 0; file < 8; file++) {
      const fileInfo = pawnFiles[file];

      if (fileInfo) {
        if (fileInfo.max !== fileInfo.min) {
          score -= 300;
        }

        if (!islandState) {
          islandsCount++;
        }

        islandState = 1;
      } else {
        islandState = 0;
      }
    }

    for (let i = 0; i < pawns.length; i++) {
      const pawn = pawns[i];
      const file = Bot.squareFiles[pawn.square];
      const rank = Bot.squareRanks[pawn.square];
      const leftInfo = opponentPawnFiles[file - 1];
      const fileInfo = opponentPawnFiles[file];
      const rightInfo = opponentPawnFiles[file + 1];

      if (
        (!leftInfo || (isWhite ? leftInfo.max <= rank : leftInfo.min >= rank))
        && (!fileInfo || (isWhite ? fileInfo.max <= rank : fileInfo.min >= rank))
        && (!rightInfo || (isWhite ? rightInfo.max <= rank : rightInfo.min >= rank))
      ) {
        score += 500 + (
          rank === Bot.ranks.RANK_7[color]
            ? 1000
            : rank === Bot.ranks.RANK_6[color]
              ? 500
              : rank === Bot.ranks.RANK_5[color]
                ? 200
                : 0
        );
      }
    }

    return score + (islandsCount - 1) * -200;
  }

  evalPieces(color: Color, positionInfo: PositionInfo, isEndgame: boolean): number {
    const pieces = this.pieces[color];
    const pieceCount = this.pieceCounts[color];
    const opponentColor = Bot.oppositeColor[color];
    const isWhite = color === Color.WHITE;
    const distances = Bot.distances[this.kings[opponentColor].square];
    const defendedSquares = positionInfo.squareAttacks[color];
    const attackedSquares = positionInfo.squareAttacks[opponentColor];
    const hangingPiecesCoeff = this.turn === color ? 100 : 1000;
    let bishopsCount = 0;
    let score = 0;

    for (let i = 0; i < pieceCount; i++) {
      const piece = pieces[i];
      const file = Bot.squareFiles[piece.square];
      const rank = Bot.squareRanks[piece.square];

      // development
      score += (
        (
          (piece.type === PieceType.KNIGHT || piece.type === PieceType.BISHOP)
          && rank === Bot.ranks.RANK_1[color]
        )
          ? -300
          : (
            piece.type === PieceType.PAWN
            && (file === Bot.files.FILE_D || file === Bot.files.FILE_E)
            && rank === Bot.ranks.RANK_2[color]
          )
            ? this.board[(rank + Bot.directions.UP[color]) << 3 | file]
              ? -1000
              : -300
            : 0
      );

      // bishop pair
      if (piece.type === PieceType.BISHOP) {
        bishopsCount++;
      }

      // rooks on open/semi-open files
      if (piece.type === PieceType.ROOK && !(file in positionInfo.pawnFiles[color])) {
        score += 100 + (file in positionInfo.pawnFiles[opponentColor] ? 0 : 100);
      }

      // control
      if (piece.type !== PieceType.KING || isEndgame) {
        const attacks = positionInfo.attacks[color][i];

        for (let i = 0, l = attacks.length; i < l; i++) {
          const square = attacks[i];
          const rank = Bot.squareRanks[square];
          const file = Bot.squareFiles[square];
          const distanceToOpponentKing = distances[square];

          score += (
            isEndgame || (isWhite ? rank < Bot.ranks.RANK_4[Color.WHITE] : rank > Bot.ranks.RANK_4[Color.BLACK])
              ? 10
              : rank === Bot.ranks.RANK_4[color] || rank === Bot.ranks.RANK_5[color] || rank === Bot.ranks.RANK_6[color]
              ? file === Bot.files.FILE_D || file === Bot.files.FILE_E
                ? 50
                : file === Bot.files.FILE_C || file === Bot.files.FILE_F
                  ? 25
                  : 10
              : 20
          ) + (
            distanceToOpponentKing > 2
              ? 0
              : distanceToOpponentKing === 2
              ? 50
              : 150
          );
        }
      }

      // hanging pieces
      if (piece.type !== PieceType.KING) {
        const attackingPieces = attackedSquares[piece.square];

        if (attackingPieces) {
          const defendingPieces = defendedSquares[piece.square];

          if (defendingPieces) {
            defendingPieces.sort(this.pieceSorter);
            attackingPieces.sort(this.pieceSorter);

            let pieceToTake: PieceType = piece.type;
            let state: 0 | 1 = 0;
            const lossStates: number[] = [0];

            while (true) {
              if (state === 0) {
                let lessValuableAttacker = attackingPieces.pop();

                /*
                for (const pieceId in opponentPieces) {
                  const attackingPiece = opponentPieces[pieceId];
                  const legalMoves = this.getLegalMoves(attackingPiece, false);

                  for (let i = 0, l = legalMoves.length; i < l; i++) {
                    const square = legalMoves[i];

                    if (square === piece.square) {
                      if (!lessValuableAttacker || lessValuableAttacker.type > attackingPiece.type) {
                        lessValuableAttacker = attackingPiece;
                      }

                      break;
                    }
                  }
                }
                */

                if (!lessValuableAttacker) {
                  break;
                }

                // this.performMove(lessValuableAttacker.square << 9 | piece.square << 3, false);

                lossStates.push(-Bot.piecesWorth[pieceToTake]);

                pieceToTake = lessValuableAttacker;
                state = 1;
              } else {
                let lessValuableDefender = defendingPieces.pop();

                /*
                for (const pieceId in pieces) {
                  const defendingPiece = pieces[pieceId];
                  const legalMoves = this.getLegalMoves(defendingPiece, false);

                  for (let i = 0, l = legalMoves.length; i < l; i++) {
                    const square = legalMoves[i];

                    if (square === piece.square) {
                      if (!lessValuableDefender || lessValuableDefender.type > defendingPiece.type) {
                        lessValuableDefender = defendingPiece;
                      }

                      break;
                    }
                  }
                }
                */

                if (!lessValuableDefender) {
                  break;
                }

                // this.performMove(lessValuableDefender.square << 9 | piece.square << 3, false);

                lossStates.push(Bot.piecesWorth[pieceToTake]);

                pieceToTake = lessValuableDefender;
                state = 0;
              }
            }

            lossStates.push(lossStates[lossStates.length - 1]);

            let maxWin = -Infinity;
            let maxWinIndex = 0;
            let minLoss = Infinity;
            let minLossIndex = 0;
            let loss = 0;

            for (let i = 0, l = lossStates.length; i < l; i++) {
              loss += lossStates[i];

              if (i & 1) {
                if (maxWin < loss) {
                  maxWin = loss;
                  maxWinIndex = i;
                }
              } else {
                if (minLoss > loss) {
                  minLoss = loss;
                  minLossIndex = i;
                }
              }

              /*
              if (i < l - 2) {
                this.revertLastMove();
              }
              */
            }

            score += (minLossIndex < maxWinIndex ? minLoss : maxWin) * hangingPiecesCoeff;
          } else {
            score -= Bot.piecesWorth[piece.type] * hangingPiecesCoeff;
          }
        }
      }
    }

    return score + this.material[color] * 1000 + (bishopsCount >= 2 ? 500 : 0);
  }

  executeNegamax(depth: number, alpha: number, beta: number): number | null {
    if (this.isDraw) {
      return 0;
    }

    if (depth === Bot.SEARCH_DEPTH) {
      const timestamp = Date.now();
      const currentScore = this.evaluatedPositions.get(this.positionKey);
      const score = currentScore === undefined ? this.eval(depth) : currentScore;

      if (currentScore === undefined) {
        this.evaluatedPositions.set(this.positionKey, score);
      }

      this.nodes++;
      this.evalTime += Date.now() - timestamp;

      return score;
    }

    const timestamp = this.getTimestamp();
    const legalMoves = this.getAllLegalMoves();
    const timestamp2 = this.getTimestamp();
    let wereNewEvals = false;

    if (!legalMoves.length) {
      return this.isCheck ? Bot.getMateScore(depth) : 0;
    }

    legalMoves.sort(this.moveSorter);

    const timestamp3 = this.getTimestamp();

    if (this.debug) {
      this.calculateLegalMovesTime += timestamp2 - timestamp;
      this.moveSortTime += timestamp3 - timestamp2;
    }

    for (let i = 0; i < legalMoves.length; i++) {
      const move = legalMoves[i];

      const timestamp = this.getTimestamp();
      const moveObject = this.performMove(move);
      const timestamp2 = this.getTimestamp();

      const scoreOrNull = this.executeNegamax(depth + 1, -beta, -alpha);
      const timestamp3 = this.getTimestamp();

      this.revertMove(moveObject);

      if (this.debug) {
        this.performMoveTime += timestamp2 - timestamp;
        this.revertMoveTime += this.getTimestamp() - timestamp3;
      }

      if (scoreOrNull === null) {
        continue;
      }

      const score = -scoreOrNull;

      if (score >= beta) {
        return beta;
      }

      if (score > alpha) {
        alpha = score;
      }

      wereNewEvals = true;
    }

    if (!wereNewEvals) {
      return null;
    }

    return alpha;
  }

  getOptimalMove(): number | undefined {
    const legalMoves = this.getAllLegalMoves();

    if (legalMoves.length === 1) {
      console.log('only move', Bot.moveToUci(legalMoves[0]).red.bold);

      return legalMoves[0];
    }

    const optimalMoves: { move: number; score: number; }[] = [];

    this.evaluatedPositions.clear();
    this.evaluatedPawnPositions[Color.WHITE].clear();
    this.evaluatedPawnPositions[Color.BLACK].clear();

    legalMoves
      .map((move) => {
        const moveObject = this.performMove(move);

        const score = -this.eval(1);

        this.revertMove(moveObject);

        return {
          move,
          score
        };
      })
      .sort(({ score: score1 }, { score: score2 }) => score2 - score1)
      .forEach(({ move }) => {
        const moveObject = this.performMove(move);

        const score = -this.executeNegamax(1, -Infinity, -(optimalMoves.length ? optimalMoves[0].score - Bot.OPTIMAL_MOVE_THRESHOLD : -Infinity))!;
        const index = optimalMoves.findIndex(({ score: optimalScore }) => score > optimalScore);

        optimalMoves.splice(index === -1 ? optimalMoves.length : index, 0, { move, score });

        this.revertMove(moveObject);

        return {
          move,
          score
        };
      });

    const threshold = Bot.isMateScore(optimalMoves[0].score)
      ? 0.5
      : Bot.OPTIMAL_MOVE_THRESHOLD;

    for (let i = optimalMoves.length - 1; i > 0; i--) {
      if (optimalMoves[0].score - optimalMoves[i].score >= threshold) {
        optimalMoves.pop();
      } else {
        break;
      }
    }

    const randomIndex = Math.floor(Math.random() * optimalMoves.length);
    const selectedMove = optimalMoves[randomIndex];

    if (!selectedMove) {
      return;
    }

    console.log('optimal moves:', optimalMoves.map(({ move, score }) => `${Game.moveToUci(move).red.bold} (${Bot.getScore(score).green.bold})`).join(', '));
    console.log(`picked move ${Bot.moveToUci(selectedMove.move).red.bold} (${Bot.getScore(selectedMove.score).green.bold})`);

    return selectedMove.move;
  }

  getTimestamp(): number {
    return this.debug ? Date.now() : 0;
  }

  makeMove(): number | undefined {
    if (this.turn !== this.color) {
      return;
    }

    this.nodes = 0;
    this.evalTime = 0;
    this.evalKingSafetyTime = 0;
    this.evalPawnsTime = 0;
    this.evalPiecesTime = 0;
    this.calculatePositionInfoTime = 0;
    this.calculateLegalMovesTime = 0;
    this.performMoveTime = 0;
    this.revertMoveTime = 0;
    this.moveSortTime = 0;
    this.mateTime = 0;
    this.drawTime = 0;

    const timestamp = Date.now();
    const move = this.getOptimalMove();
    const moveTook = Date.now() - timestamp;

    console.log(`move took ${`${moveTook}`.red.bold} ms`);
    console.log(`eval took ${`${this.evalTime}`.red.bold} ms`);
    console.log(`rest took ${`${moveTook - this.evalTime}`.red.bold} ms`);

    if (this.debug) {
      console.log(`evalKingSafety took ${this.evalKingSafetyTime} ms`);
      console.log(`evalPawns took ${this.evalPawnsTime} ms`);
      console.log(`evalPiecesTime took ${this.evalPiecesTime} ms`);
      console.log(`calculatePositionInfo took ${this.calculatePositionInfoTime} ms`);
      console.log(`calculateLegalMoves took ${this.calculateLegalMovesTime} ms`);
      console.log(`performMove took ${this.performMoveTime} ms`);
      console.log(`revertMove took ${this.revertMoveTime} ms`);
      console.log(`moveSort took ${this.moveSortTime} ms`);
      console.log(`mate took ${this.mateTime} ms`);
      console.log(`draw took ${this.drawTime} ms`);
    }

    console.log(`nodes: ${`${this.nodes}`.blue.bold}`);
    console.log(`performance: ${`${+(this.nodes / moveTook).toFixed(3)}`.green.bold} kn/s`);
    console.log('-'.repeat(80).bold);

    // return undefined;
    return move;
  }

  moveSorter = (move1: number, move2: number): number => {
    const to1Piece = this.board[move1 >> 3 & 63];
    const to2Piece = this.board[move2 >> 3 & 63];

    if (!to1Piece) {
      return to2Piece ? 1 : 0;
    }

    if (!to2Piece) {
      return -1;
    }

    return to1Piece.type - to2Piece.type;
  };

  pieceSorter = (type1: PieceType, type2: PieceType): number => {
    return type1 - type2;
  };
}
