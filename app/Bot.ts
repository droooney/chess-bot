import * as _ from 'lodash';
import 'colors';

import Game from './Game';
import { Color, Piece, PieceType } from './Utils';

interface PositionInfo {
  squareAttacks: Record<Color, Record<number, PieceType[]>>;
  attacks: Record<Color, number[][]>;
  pawns: Record<Color, Piece[]>;
  pawnFiles: Record<Color, Record<number, { min: number; max: number; }>>;
}

interface MoveScore {
  move: number;
  score: number;
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
  moveCount: number = 0;
  evaluatedPositions: Map<bigint, number> = new Map();
  evaluatedPawnPositions: Record<Color, Map<bigint, number>> = [new Map(), new Map()];
  nodes: number = 0;
  cutNodesCount: number = 0;
  firstCutNodesCount: number = 0;

  constructor(fen: string, color: Color) {
    super(fen);

    this.color = color;
  }

  eval(depth: number): number {
    if (this.isCheck && this.isNoMoves()) {
      return Bot.getMateScore(depth);
    }

    if (this.isDraw || (!this.isCheck && this.isNoMoves())) {
      return 0;
    }

    const currentPawnScore = this.evaluatedPawnPositions[this.turn].get(this.pawnKey);
    const noPawnScore = currentPawnScore === undefined;
    const positionInfo: PositionInfo = {
      squareAttacks: [{}, {}],
      attacks: [[], []],
      pawns: [[], []],
      pawnFiles: [{}, {}]
    };

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
        }

        for (let i = 0; i < attacks.length; i++) {
          const square = attacks[i];

          if (this.board[square]) {
            (positionInfo.squareAttacks[color][square] = positionInfo.squareAttacks[color][square] || []).push(piece.type);
          }
        }
      }
    }

    const pawnsScore = noPawnScore
      ? this.evalPawns(this.turn, positionInfo) - this.evalPawns(Bot.oppositeColor[this.turn], positionInfo)
      : currentPawnScore!;

    if (noPawnScore) {
      this.evaluatedPawnPositions[this.turn].set(this.pawnKey, pawnsScore);
    }

    return pawnsScore + this.evalColor(this.turn, positionInfo) - this.evalColor(Bot.oppositeColor[this.turn], positionInfo);
  }

  evalColor(color: Color, positionInfo: PositionInfo): number {
    return this.evalKingSafety(color) + this.evalPieces(color, positionInfo);
  }

  evalKingSafety(color: Color): number {
    const isEndgame = this.isEndgame();

    if (isEndgame) {
      return 0;
    }

    const king = this.kings[color];
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

      score += 2 * Bot.pieceSquareTables[color][PieceType.PAWN][0][pawn.square];

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

  evalPieces(color: Color, positionInfo: PositionInfo): number {
    const isEndgame = this.isEndgame();
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

      // piece-square tables
      score += 10 * Bot.pieceSquareTables[color][piece.type][+isEndgame][piece.square];

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

                if (lessValuableAttacker === undefined) {
                  break;
                }

                lossStates.push(-Bot.piecesWorth[pieceToTake]);

                pieceToTake = lessValuableAttacker;
                state = 1;
              } else {
                let lessValuableDefender = defendingPieces.pop();

                if (lessValuableDefender === undefined) {
                  break;
                }

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

  executeNegamax(depth: number, alpha: number, beta: number): number {
    if (this.isDraw) {
      return 0;
    }

    if (depth === Bot.SEARCH_DEPTH) {
      const currentScore = this.evaluatedPositions.get(this.positionKey);
      const score = currentScore === undefined ? this.eval(depth) : currentScore;

      if (currentScore === undefined) {
        this.evaluatedPositions.set(this.positionKey, score);
      }

      this.nodes++;

      return score;
    }

    const legalMoves = this.getAllLegalMoves();

    if (!legalMoves.length) {
      return this.isCheck ? Bot.getMateScore(depth) : 0;
    }

    const sortedMoves = _.sortBy(legalMoves, this.moveScore);

    for (let i = 0; i < sortedMoves.length; i++) {
      const move = sortedMoves[i];
      const moveObject = this.performMove(move);
      const score = -this.executeNegamax(depth + 1, -beta, -alpha);

      this.revertMove(moveObject);

      if (score >= beta) {
        if (i === 0) {
          this.firstCutNodesCount++;
        }

        this.cutNodesCount++;

        return beta;
      }

      if (score > alpha) {
        alpha = score;
      }
    }

    return alpha;
  }

  getOptimalMove(): number | undefined {
    const legalMoves = this.getAllLegalMoves();

    if (legalMoves.length === 1) {
      console.log('only move', Bot.moveToUci(legalMoves[0]).red.bold);

      return legalMoves[0];
    }

    const optimalMoves: MoveScore[] = [];

    legalMoves
      .map((move) => {
        const moveObject = this.performMove(move);
        const score = -this.eval(1);

        this.revertMove(moveObject);

        return { move, score };
      })
      .sort(this.scoreSorter)
      .forEach(({ move }) => {
        const moveObject = this.performMove(move);
        const score = -this.executeNegamax(1, -Infinity, -(optimalMoves.length ? optimalMoves[0].score - Bot.OPTIMAL_MOVE_THRESHOLD : -Infinity))!;
        const index = optimalMoves.findIndex(({ score: optimalScore }) => score > optimalScore);

        optimalMoves.splice(index === -1 ? optimalMoves.length : index, 0, { move, score });

        this.revertMove(moveObject);
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

    console.log('optimal moves:', optimalMoves.map(({ move, score }) => `${Bot.moveToUci(move).red.bold} (${Bot.getScore(score).green.bold})`).join(', '));
    console.log(`picked move ${Bot.moveToUci(selectedMove.move).red.bold} (${Bot.getScore(selectedMove.score).green.bold})`);

    return selectedMove.move;
  }

  makeMove(): number | undefined {
    if (this.turn !== this.color) {
      return;
    }

    this.nodes = 0;
    this.cutNodesCount = 0;
    this.firstCutNodesCount = 0;

    this.evaluatedPositions.clear();
    this.evaluatedPawnPositions[Color.WHITE].clear();
    this.evaluatedPawnPositions[Color.BLACK].clear();

    const timestamp = Date.now();
    const move = this.getOptimalMove();
    const moveTook = Date.now() - timestamp;

    console.log(`move took ${`${moveTook}`.red.bold} ms`);
    console.log(`nodes: ${`${this.nodes}`.blue.bold}`);
    console.log(`move ordering quality: ${`${Math.round((this.firstCutNodesCount / this.cutNodesCount) * 100)}%`.green.bold}`);
    console.log(`performance: ${`${Math.round(this.nodes / moveTook)}`.green.bold} kn/s`);
    console.log('-'.repeat(80).bold);

    // return;
    return move;
  }

  moveSorter = (move1: number, move2: number): number => {
    return this.moveScore(move1) - this.moveScore(move2);
  };

  moveScore = (move: number): number => {
    const from = Bot.movesFrom[move];
    const to = Bot.movesTo[move];
    const promotion: PieceType = move & 7;
    let score: number = 0;

    if (promotion) {
      score += 1000 * Bot.piecesWorth[promotion];
    }

    const opponentColor = Bot.oppositeColor[this.turn];
    const isEndgame = this.isEndgame();
    const piece = this.board[from]!;
    const toPiece = this.board[to];

    if (toPiece) {
      // const fromPieceWorth = Bot.piecesWorth[piece.type];
      const toPieceWorth = Bot.piecesWorth[toPiece.type];

      score += 1000 * toPieceWorth;
    }

    if (piece.type < PieceType.PAWN && piece.type > PieceType.KING) {
      const isFromControlledByPawn = this.isControlledByOpponentPawn(from, opponentColor);
      const isToControlledByPawn = this.isControlledByOpponentPawn(to, opponentColor);

      score += (isFromControlledByPawn ? 1000 : 0) + (isToControlledByPawn ? -2000 : 0);
    }

    if (piece.type === PieceType.PAWN) {
      const targets = Bot.pawnAttacks[this.turn][to];
      const leftTarget = this.board[targets[0]];
      const rightTarget = this.board[targets[1]];

      if (leftTarget && leftTarget.color === opponentColor && leftTarget.type < PieceType.PAWN) {
        score += leftTarget.type === PieceType.KING
          ? 100
          : Bot.piecesWorth[leftTarget.type] * 100;
      }

      if (rightTarget && rightTarget.color === opponentColor && rightTarget.type < PieceType.PAWN) {
        score += rightTarget.type === PieceType.KING
          ? 100
          : Bot.piecesWorth[rightTarget.type] * 100;
      }
    } else if (piece.type === PieceType.KNIGHT) {
      const attacks = Bot.knightMoves[to];

      for (let i = 0; i < attacks.length; i++) {
        const square = attacks[i];
        const pieceInSquare = this.board[square];

        if (pieceInSquare && pieceInSquare.color === opponentColor && pieceInSquare.type < PieceType.BISHOP) {
          score += pieceInSquare.type === PieceType.KING
            ? 100
            : Bot.piecesWorth[pieceInSquare.type] * 50;
        }
      }
    }

    score += 10 * (
      Bot.pieceSquareTables[piece.color][piece.type][+isEndgame][to]
      - Bot.pieceSquareTables[piece.color][piece.type][+isEndgame][from]
    );

    return -score;
  };

  pieceSorter = (type1: PieceType, type2: PieceType): number => {
    return type1 - type2;
  };

  scoreSorter = ({ score: score1 }: MoveScore, { score: score2 }: MoveScore) => {
    return score2 - score1;
  };
}
