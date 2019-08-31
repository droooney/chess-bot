import 'colors';

import Game from './Game';
import { Color, Piece, PieceType, Result } from './Utils';

type PawnFiles = { [file in number]: number; };

interface PiecesAttacks {
  squareAttacks: { [color in Color]: { [square in number]: PieceType[]; }; };
  attacks: { [pieceId in number]: number[]; }
}

export default class Bot extends Game {
  static SEARCH_DEPTH = 2;
  static OPTIMAL_LINES_COUNT = 10;
  static OPTIMAL_MOVE_THRESHOLD = 50;
  static MATE_SCORE = 1e7;

  static getScore(score: number): string {
    return Math.abs(score) > 1e6
      ? `#${score < 0 ? '-' : ''}${Bot.MATE_SCORE - Math.abs(score) + 1}`
      : `${score / 1000}`
  }

  color: Color;
  opponentColor: Color;
  moveCount: number = 0;
  visitedPositions: Map<bigint, number | null> = new Map();
  evals: number = 0;
  evalTime: bigint = 0n;
  evalDoubledPawnsTime: bigint = 0n;
  evalKingSafetyTime: bigint = 0n;
  evalPassedPawnsTime: bigint = 0n;
  evalPawnIslandsTime: bigint = 0n;
  evalPiecesTime: bigint = 0n;
  calculateAttacksTime: bigint = 0n;
  calculateRestTime: bigint = 0n;

  constructor(fen: string, color: Color) {
    super(fen);

    this.color = color;
    this.opponentColor = Bot.oppositeColor[color];
  }

  eval(depth: number): number {
    const timestamp = process.hrtime.bigint();

    if (this.isCheck && this.isNoMoves()) {
      this.evals++;
      this.evalTime += process.hrtime.bigint() - timestamp;

      return this.getFinishedGameScore(Bot.oppositeColor[this.turn] as 0 | 1, depth);
    }

    if (!this.isCheck && this.isNoMoves()) {
      this.evals++;
      this.evalTime += process.hrtime.bigint() - timestamp;

      return this.getFinishedGameScore(Result.DRAW, depth);
    }

    if (this.result !== null) {
      this.evals++;
      this.evalTime += process.hrtime.bigint() - timestamp;

      return this.getFinishedGameScore(this.result, depth);
    }

    const piecesAttacks: PiecesAttacks = {
      squareAttacks: [{}, {}],
      attacks: {}
    };
    let pawnCount = 0;

    for (let color = Color.WHITE; color <= Color.BLACK; color++) {
      for (const pieceId in this.pieces[color]) {
        const piece = this.pieces[color][pieceId];
        const attacks = piecesAttacks.attacks[pieceId] = this.getAttacks(piece);

        if (piece.type === PieceType.PAWN) {
          pawnCount++;
        }

        for (let i = 0, l = attacks.length; i < l; i++) {
          const square = attacks[i];

          if (this.board[square]) {
            (piecesAttacks.squareAttacks[color][square] = piecesAttacks.squareAttacks[color][square] || []).push(piece.type);
          }
        }
      }
    }

    const isEndgame = (
      pawnCount < 5
      || this.pieceCounts[Color.WHITE] + this.pieceCounts[Color.BLACK] - pawnCount < 9
    );

    this.calculateAttacksTime += process.hrtime.bigint() - timestamp;

    const result = this.evalColor(this.color, piecesAttacks, isEndgame) - this.evalColor(this.opponentColor, piecesAttacks, isEndgame);

    this.evals++;
    this.evalTime += process.hrtime.bigint() - timestamp;

    // console.log(this.moves.map(({ move }) => Game.getUciFromMove(move)).join(' '), result);

    return result;
  }

  evalColor(color: Color, piecesAttacks: PiecesAttacks, isEndgame: boolean): number {
    const timestamp = process.hrtime.bigint();
    const opponentColor = Bot.oppositeColor[color];

    const pawns = this.getPawns(color);
    const pawnFiles: PawnFiles = {};

    for (let i = 0, l = pawns.length; i < l; i++) {
      const file = Bot.squareFiles[pawns[i].square];

      pawnFiles[file] = pawnFiles[file] + 1 || 1;
    }

    this.calculateRestTime += process.hrtime.bigint() - timestamp;

    /*
    if (this.moves.map(Game.moveToUci).join(' ') === 'g2h3 d5e4') {
      console.log(color, (
        this.evalDoubledPawns(pawnFiles)
        + this.evalKingSafety(color, isEndgame)
        + this.evalPassedPawns(color, opponentColor, pawns, isEndgame)
        + this.evalPawnIslands(pawnFiles)
        + this.evalPieces(color, pawnFiles, piecesAttacks, isEndgame)
      ), {
        evalDoubledPawns: this.evalDoubledPawns(pawnFiles),
        evalKingSafety: this.evalKingSafety(color, isEndgame),
        evalPassedPawns: this.evalPassedPawns(color, opponentColor, pawns, isEndgame),
        evalPawnIslands: this.evalPawnIslands(pawnFiles),
        evalPieces: this.evalPieces(color, pawnFiles, piecesAttacks, isEndgame)
      });
    }
    */

    return (
      this.evalDoubledPawns(pawnFiles)
      + this.evalKingSafety(color, isEndgame)
      + this.evalPassedPawns(color, opponentColor, pawns, isEndgame)
      + this.evalPawnIslands(pawnFiles)
      + this.evalPieces(color, pawnFiles, piecesAttacks, isEndgame)
    );
  }

  evalDoubledPawns(pawnFiles: PawnFiles): number {
    const timestamp = process.hrtime.bigint();
    let score = 0;

    for (const file in pawnFiles) {
      if (pawnFiles[file] > 1) {
        score -= 300;
      }
    }

    this.evalDoubledPawnsTime += process.hrtime.bigint() - timestamp;

    return score;
  }

  evalKingSafety(color: Color, isEndgame: boolean): number {
    const timestamp = process.hrtime.bigint();
    const king = this.kings[color];

    if (isEndgame) {
      this.evalKingSafetyTime += process.hrtime.bigint() - timestamp;

      return 0;
    }

    const kingFile = Bot.squareFiles[king.square];
    const kingRank = Bot.squareRanks[king.square];
    const isWhite = color === Color.WHITE;

    if (isWhite ? kingRank > Bot.ranks.RANK_4[Color.WHITE] : kingRank < Bot.ranks.RANK_4[Color.BLACK]) {
      this.evalKingSafetyTime += process.hrtime.bigint() - timestamp;

      return -3000;
    }

    if (kingRank === Bot.ranks.RANK_4[color]) {
      this.evalKingSafetyTime += process.hrtime.bigint() - timestamp;

      return -2000;
    }

    if (kingRank === Bot.ranks.RANK_3[color]) {
      this.evalKingSafetyTime += process.hrtime.bigint() - timestamp;

      return -1000;
    }

    if (
      kingRank === Bot.ranks.RANK_2[color]
      && kingFile >= Bot.files.FILE_C
      && kingFile < Bot.files.FILE_G
    ) {
      this.evalKingSafetyTime += process.hrtime.bigint() - timestamp;

      return kingFile === Bot.files.FILE_D || kingFile === Bot.files.FILE_E
        ? -750
        : -500;
    }

    if (kingFile === Bot.files.FILE_D || kingFile === Bot.files.FILE_E) {
      this.evalKingSafetyTime += process.hrtime.bigint() - timestamp;

      return -250;
    }

    if (kingFile === Bot.files.FILE_F) {
      this.evalKingSafetyTime += process.hrtime.bigint() - timestamp;

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

    this.evalKingSafetyTime += process.hrtime.bigint() - timestamp;

    return score;
  }

  evalPassedPawns(color: Color, opponentColor: Color, pawns: Piece[], isEndgame: boolean): number {
    const timestamp = process.hrtime.bigint();
    const opponentPawns = this.getPawns(opponentColor);
    const passedPawnFiles: { [file in number]: number; } = {};
    const isWhite = color === Color.WHITE;
    let passedPawnCount = 0;

    pawns: for (let i = 0, l = pawns.length; i < l; i++) {
      const pawn = pawns[i];
      const file = Bot.squareFiles[pawn.square];
      const rank = Bot.squareRanks[pawn.square];

      if (file in passedPawnFiles) {
        passedPawnFiles[file] = isWhite
          ? Math.max(passedPawnFiles[file], rank)
          : Math.min(passedPawnFiles[file], rank);

        continue;
      }

      for (let i = 0, l = opponentPawns.length; i < l; i++) {
        const opponentPawn = opponentPawns[i];
        const opponentFile = Bot.squareFiles[opponentPawn.square];
        const opponentRank = Bot.squareRanks[opponentPawn.square];

        if (
          opponentFile >= file - 1
          && opponentFile <= file + 1
          && (isWhite ? opponentRank > rank : opponentRank < rank)
        ) {
          continue pawns;
        }
      }

      passedPawnFiles[file] = rank;
      passedPawnCount++;
    }

    let score = passedPawnCount * 500;

    for (const file in passedPawnFiles) {
      const rank = passedPawnFiles[file];
      const isProtected = +file + 1 in passedPawnFiles || +file - 1 in passedPawnFiles;
      const isProtectedRightNow = isProtected && (
        passedPawnFiles[+file + 1] === rank + Bot.directions.DOWN[color]
        || passedPawnFiles[+file - 1] === rank + Bot.directions.DOWN[color]
      );

      score += (
        isProtectedRightNow
          ? (
            rank === Bot.ranks.RANK_7[color]
              ? 2500
              : rank === Bot.ranks.RANK_6[color]
                ? 1500
                : rank === Bot.ranks.RANK_5[color]
                  ? 700
                  : 300
          )
          : isProtected
            ? (
              rank === Bot.ranks.RANK_7[color]
                ? 1200
                : rank === Bot.ranks.RANK_6[color]
                  ? 600
                  : rank === Bot.ranks.RANK_5[color]
                    ? 250
                    : 100
            )
            : 0
      ) + (
        isEndgame
          ? (
            rank === Bot.ranks.RANK_7[color]
              ? 1000
              : rank === Bot.ranks.RANK_6[color]
                ? 500
                : rank === Bot.ranks.RANK_5[color]
                  ? 250
                  : 0
          )
          : (
            rank === Bot.ranks.RANK_7[color]
              ? 500
              : rank === Bot.ranks.RANK_6[color]
                ? 200
                : 0
          )
      );
    }

    this.evalPassedPawnsTime += process.hrtime.bigint() - timestamp;

    return score;
  }

  evalPawnIslands(pawnFiles: PawnFiles): number {
    const timestamp = process.hrtime.bigint();
    let state: 'island' | 'no-island' | null = null;
    let islandsCount = 0;

    for (let file = 0; file < 8; file++) {
      const arePawnsOnFile = file in pawnFiles;

      if (arePawnsOnFile) {
        if (state !== 'island') {
          islandsCount++;
        }

        state = 'island';
      } else {
        state = state ? 'no-island' : null;
      }
    }

    this.evalPawnIslandsTime += process.hrtime.bigint() - timestamp;

    return (islandsCount - 1) * -200;
  }

  evalPawns(): number {
    return 0;
  }

  evalPieces(
    color: Color,
    pawnFiles: PawnFiles,
    piecesAttacks: PiecesAttacks,
    isEndgame: boolean
  ): number {
    const timestamp = process.hrtime.bigint();
    const pieces = this.pieces[color];
    const opponentColor = Bot.oppositeColor[color];
    const isWhite = color === Color.WHITE;
    const distances = Bot.distances[this.kings[opponentColor].square];
    const defendedSquares = piecesAttacks.squareAttacks[color];
    const attackedSquares = piecesAttacks.squareAttacks[opponentColor];
    const hangingPiecesCoeff = this.turn === color ? 100 : 1000;
    let bishopsCount = 0;
    let score = 0;

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];
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
      if (piece.type === PieceType.ROOK && !(file in pawnFiles)) {
        score += 100;
      }

      // control
      if (piece.type !== PieceType.KING || isEndgame) {
        const attacks = piecesAttacks.attacks[pieceId];

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

    this.evalPiecesTime += process.hrtime.bigint() - timestamp;

    return score + this.material[color] * 1000 + (bishopsCount >= 2 ? 500 : 0);
  }

  executeMiniMax(depth: number, isSame: boolean, currentOptimalScore: number): number {
    if (this.result !== null) {
      const result = this.getFinishedGameScore(this.result, depth);

      this.visitedPositions.set(this.position, result);

      return result;
    }

    const currentResult = this.visitedPositions.get(this.position);

    if (currentResult != null) {
      return currentResult;
    }

    if (depth === Bot.SEARCH_DEPTH) {
      const result = this.eval(depth);

      this.visitedPositions.set(this.position, result);

      return result;
    }

    const turn = this.turn;
    const pieces = this.pieces[turn];

    let maxScore = isSame ? -Infinity : Infinity;
    let wereLegalMoves = false;

    this.visitedPositions.set(this.position, null);

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];
      const legalMoves = this.getLegalMoves(piece);

      for (let i = 0, l = legalMoves.length; i < l; i++) {
        wereLegalMoves = true;

        const square = legalMoves[i];
        let move = piece.square << 9 | square << 3;

        if (piece.type === PieceType.PAWN && square in Bot.promotionSquares[turn]) {
          move |= PieceType.QUEEN;
        }

        const moveObject = this.performMove(move);

        if (this.visitedPositions.get(this.position) === null) {
          this.revertMove(moveObject);

          continue;
        }

        const score = this.executeMiniMax(isSame ? depth : depth + 1, !isSame, maxScore);

        if (isSame ? score >= currentOptimalScore : score <= currentOptimalScore) {
          this.revertMove(moveObject);

          const result = isSame ? Infinity : -Infinity;

          this.visitedPositions.set(this.position, result);

          return result;
        }

        maxScore = isSame ? Math.max(maxScore, score) : Math.min(maxScore, score);

        this.revertMove(moveObject);
      }
    }

    if (!wereLegalMoves) {
      const result = this.getFinishedGameScore(this.isCheck ? Bot.oppositeColor[this.turn] as 0 | 1 : Result.DRAW, depth);

      this.visitedPositions.set(this.position, result);

      return result;
    }

    this.visitedPositions.set(this.position, maxScore);

    return maxScore;
  }

  getAllLegalMoves(): number[] {
    const moves: number[] = [];
    const pieces = this.pieces[this.turn];

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];
      const legalMoves = this.getLegalMoves(piece);

      for (let i = 0, l = legalMoves.length; i < l; i++) {
        const square = legalMoves[i];
        const move = piece.square << 9 | square << 3;

        if (piece.type === PieceType.PAWN && square in Bot.promotionSquares[this.turn]) {
          moves.push(move | PieceType.QUEEN);
          moves.push(move | PieceType.KNIGHT);
          moves.push(move | PieceType.ROOK);
          moves.push(move | PieceType.BISHOP);
        } else {
          moves.push(move);
        }
      }
    }

    return moves;
  }

  getFinishedGameScore(result: Result, depth: number): number {
    return result === Result.DRAW
      ? 0
      : result === this.color as 0 | 1
        ? Bot.MATE_SCORE - depth
        : -(Bot.MATE_SCORE - depth + 1)
  }

  getOptimalMove(): number | undefined {
    const legalMoves = this.getAllLegalMoves();

    if (legalMoves.length === 1) {
      console.log('only move', Bot.moveToUci(legalMoves[0]).red.bold);

      return legalMoves[0];
    }

    const optimalLines = new Array(Bot.OPTIMAL_LINES_COUNT).fill(0).map(() => ({ move: 0, score: -Infinity }));

    this.visitedPositions.clear();

    legalMoves
      .map((move) => {
        const moveObject = this.performMove(move);

        const score = this.eval(0);

        this.revertMove(moveObject);

        return {
          move,
          score
        };
      })
      .sort(({ score: score1 }, { score: score2 }) => score2 - score1)
      .forEach(({ move }) => {
        const moveObject = this.performMove(move);

        const score = this.executeMiniMax(0, false, optimalLines[0].score - Bot.OPTIMAL_MOVE_THRESHOLD);
        const index = optimalLines.findIndex(({ score: optimalScore }) => score > optimalScore);

        if (index !== -1) {
          optimalLines.splice(index, 0, { move, score });
          optimalLines.pop();
        }

        this.revertMove(moveObject);

        return {
          move,
          score
        };
      });

    for (let i = Bot.OPTIMAL_LINES_COUNT - 1; i > 0; i--) {
      if (optimalLines[0].score - optimalLines[i].score > Bot.OPTIMAL_MOVE_THRESHOLD) {
        optimalLines[i] = { move: 0, score: -Infinity };
      } else {
        break;
      }
    }

    const optimalMoves = optimalLines.filter(({ move }) => move);
    const randomIndex = Math.floor(Math.random() * optimalMoves.length);
    const selectedMove = optimalMoves[randomIndex];

    if (!selectedMove) {
      return;
    }

    console.log('optimal moves:', optimalMoves.map(({ move, score }) => `${Game.moveToUci(move).red.bold} (${Bot.getScore(score).green.bold})`).join(', '));
    console.log(`picked move ${Bot.moveToUci(selectedMove.move).red.bold} (${Bot.getScore(selectedMove.score).green.bold})`);

    return selectedMove.move;
  }

  getPawns(color: Color): Piece[] {
    const pieces = this.pieces[color];
    const pawns: Piece[] = [];

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];

      if (piece.type === PieceType.PAWN) {
        pawns.push(piece);
      }
    }

    return pawns;
  }

  makeMove(): number | undefined {
    if (this.turn !== this.color) {
      return;
    }

    this.evals = 0;
    this.evalTime = 0n;
    this.evalDoubledPawnsTime = 0n;
    this.evalKingSafetyTime = 0n;
    this.evalPassedPawnsTime = 0n;
    this.evalPawnIslandsTime = 0n;
    this.evalPiecesTime = 0n;
    this.calculateAttacksTime = 0n;
    this.calculateRestTime = 0n;

    const timestamp = process.hrtime.bigint();
    const move = this.getOptimalMove();
    const moveTook = Number(process.hrtime.bigint() - timestamp) / 1e6;
    const evalTook = Number(this.evalTime) / 1e6;

    console.log(`move took ${`${moveTook}`.red.bold} ms`);
    console.log(`eval took ${`${evalTook}`.red.bold} ms`);
    console.log(`rest took ${`${moveTook - evalTook}`.red.bold} ms`);
    /*
    console.log(`evalDoubledPawns took ${Number(this.evalDoubledPawnsTime) / 1e6} ms`);
    console.log(`evalKingSafety took ${Number(this.evalKingSafetyTime) / 1e6} ms`);
    console.log(`evalPassedPawns took ${Number(this.evalPassedPawnsTime) / 1e6} ms`);
    console.log(`evalPawnIslands took ${Number(this.evalPawnIslandsTime) / 1e6} ms`);
    console.log(`evalPiecesTime took ${Number(this.evalPiecesTime) / 1e6} ms`);
    console.log(`calculateAttacks took ${Number(this.calculateAttacksTime) / 1e6} ms`);
    console.log(`calculateRest took ${Number(this.calculateRestTime) / 1e6} ms`);
    */
    console.log(`evals: ${`${this.evals}`.blue.bold}, took ${`${evalTook}`.red.bold} ms`);
    console.log(`performance: ${`${this.evals / (moveTook / 1000)}`.green.bold} nodes/s`);
    console.log('-'.repeat(80).black.bold);

    // return undefined;
    return move;
  }

  pieceSorter = (type1: PieceType, type2: PieceType): number => {
    return type1 - type2;
  };
}
