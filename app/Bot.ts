import 'colors';

import Game from './Game';
import { Color, Piece, PieceType, Result } from './Utils';

type PawnFiles = { [file in number]: number; };

interface PiecesAttacks {
  squareAttacks: { [color in Color]: { [square in number]: PieceType[]; }; };
  attacks: { [pieceId in number]: number[]; }
}

interface VisitedPositionResult {
  score: number | null;
  depth: number;
}

export default class Bot extends Game {
  static SEARCH_DEPTH = 2;
  static OPTIMAL_LINES_COUNT = 10;
  static OPTIMAL_MOVE_THRESHOLD = 50;
  static MATE_SCORE = 1e7;

  static getScore(score: number): string {
    return Math.abs(score) > 1e6
      ? `#${score < 0 ? '-' : ''}${Bot.MATE_SCORE - Math.abs(score) + 1}`
      : `${score / 1000}`;
  }

  color: Color;
  opponentColor: Color;
  debug: boolean;
  moveCount: number = 0;
  visitedPositions: Map<bigint, VisitedPositionResult> = new Map();
  evals: number = 0;
  evalTime: bigint = 0n;
  evalColorTime: bigint = 0n;
  evalDoubledPawnsTime: bigint = 0n;
  evalKingSafetyTime: bigint = 0n;
  evalPassedPawnsTime: bigint = 0n;
  evalPawnIslandsTime: bigint = 0n;
  evalPiecesTime: bigint = 0n;
  calculateAttacksTime: bigint = 0n;
  calculateLegalMovesTime: bigint = 0n;
  calculateRestTime: bigint = 0n;
  performMoveTime: bigint = 0n;
  revertMoveTime: bigint = 0n;

  constructor(fen: string, color: Color, debug: boolean) {
    super(fen);

    this.color = color;
    this.opponentColor = Bot.oppositeColor[color];
    this.debug = debug;
  }

  eval(depth: number): number {
    if (this.isCheck && this.isNoMoves()) {
      return this.getFinishedGameScore(Bot.oppositeColor[this.turn] as 0 | 1, depth);
    }

    if (!this.isCheck && this.isNoMoves()) {
      return this.getFinishedGameScore(Result.DRAW, depth);
    }

    if (this.result !== null) {
      return this.getFinishedGameScore(this.result, depth);
    }

    const timestamp = this.getTimestamp();

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

        for (let i = 0; i < attacks.length; i++) {
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
    const timestamp2 = this.getTimestamp();

    const score = this.evalColor(this.color, piecesAttacks, isEndgame) - this.evalColor(this.opponentColor, piecesAttacks, isEndgame);

    if (this.debug) {
      this.calculateAttacksTime += timestamp2 - timestamp;
      this.evalColorTime += this.getTimestamp() - timestamp2;
    }

    return score;
  }

  evalColor(color: Color, piecesAttacks: PiecesAttacks, isEndgame: boolean): number {
    const timestamp = this.getTimestamp();
    const opponentColor = Bot.oppositeColor[color];

    const pawns = this.getPawns(color);
    const pawnFiles: PawnFiles = {};

    for (let i = 0, l = pawns.length; i < l; i++) {
      const file = Bot.squareFiles[pawns[i].square];

      pawnFiles[file] = pawnFiles[file] + 1 || 1;
    }

    const timestamp2 = this.getTimestamp();

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

    const evalDoubledPawns = this.evalDoubledPawns(pawnFiles);
    const timestamp3 = this.getTimestamp();

    const evalKingSafety = this.evalKingSafety(color, isEndgame);
    const timestamp4 = this.getTimestamp();

    const evalPassedPawns = this.evalPassedPawns(color, opponentColor, pawns, isEndgame);
    const timestamp5 = this.getTimestamp();

    const evalPawnIslands = this.evalPawnIslands(pawnFiles);
    const timestamp6 = this.getTimestamp();

    const evalPieces = this.evalPieces(color, pawnFiles, piecesAttacks, isEndgame);

    if (this.debug) {
      this.calculateRestTime += timestamp2 - timestamp;
      this.evalDoubledPawnsTime += timestamp3 - timestamp2;
      this.evalKingSafetyTime += timestamp4 - timestamp3;
      this.evalPassedPawnsTime += timestamp5 - timestamp4;
      this.evalPawnIslandsTime += timestamp6 - timestamp5;
      this.evalPiecesTime += this.getTimestamp() - timestamp6;
    }

    return evalDoubledPawns + evalKingSafety + evalPassedPawns + evalPawnIslands + evalPieces;
  }

  evalDoubledPawns(pawnFiles: PawnFiles): number {
    let score = 0;

    for (const file in pawnFiles) {
      if (pawnFiles[file] > 1) {
        score -= 300;
      }
    }

    return score;
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

  evalPassedPawns(color: Color, opponentColor: Color, pawns: Piece[], isEndgame: boolean): number {
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

    return score;
  }

  evalPawnIslands(pawnFiles: PawnFiles): number {
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

    return score + this.material[color] * 1000 + (bishopsCount >= 2 ? 500 : 0);
  }

  executeMiniMax(depth: number, isSame: boolean, currentOptimalScore: number): number | null {
    if (this.result !== null) {
      const score = this.getFinishedGameScore(this.result, depth);

      this.visitedPositions.set(this.position, { score, depth });

      return score;
    }

    const currentResult = this.visitedPositions.get(this.position);

    if (currentResult && currentResult.depth <= depth) {
      return currentResult.score;
    }

    if (depth === Bot.SEARCH_DEPTH) {
      const timestamp = process.hrtime.bigint();
      const score = this.eval(depth);

      this.evals++;
      this.evalTime += process.hrtime.bigint() - timestamp;

      this.visitedPositions.set(this.position, { score, depth });

      return score;
    }

    const turn = this.turn;
    const pieces = this.pieces[turn];

    let bestScore = isSame ? -Infinity : Infinity;
    let wereLegalMoves = false;
    let wereNewEvals = false;

    if (!currentResult) {
      this.visitedPositions.set(this.position, { score: null, depth });
    }

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];
      const timestamp = this.getTimestamp();
      const legalMoves = this.getLegalMoves(piece);

      if (this.debug) {
        this.calculateLegalMovesTime += this.getTimestamp() - timestamp;
      }

      for (let i = 0, l = legalMoves.length; i < l; i++) {
        wereLegalMoves = true;

        const square = legalMoves[i];
        let move = piece.square << 9 | square << 3;

        if (piece.type === PieceType.PAWN && square in Bot.promotionSquares[turn]) {
          move |= PieceType.QUEEN;
        }

        const timestamp = this.getTimestamp();
        const moveObject = this.performMove(move);
        const timestamp2 = this.getTimestamp();

        const score = this.executeMiniMax(isSame ? depth : depth + 1, !isSame, bestScore);
        const timestamp3 = this.getTimestamp();

        this.revertMove(moveObject);

        if (this.debug) {
          this.performMoveTime += timestamp2 - timestamp;
          this.revertMoveTime += this.getTimestamp() - timestamp3;
        }

        if (score === null) {
          continue;
        }

        if (isSame ? score >= currentOptimalScore : score <= currentOptimalScore) {
          const score = isSame ? Infinity : -Infinity;

          this.visitedPositions.set(this.position, { score, depth });

          return score;
        }

        wereNewEvals = true;
        bestScore = isSame
          ? bestScore > score
            ? bestScore
            : score
          : bestScore < score
            ? bestScore
            : score;
      }
    }

    if (!wereLegalMoves) {
      const score = this.getFinishedGameScore(this.isCheck ? Bot.oppositeColor[this.turn] as 0 | 1 : Result.DRAW, depth);

      this.visitedPositions.set(this.position, { score, depth });

      return score;
    }

    if (!wereNewEvals) {
      return null;
    }

    this.visitedPositions.set(this.position, { score: bestScore, depth });

    return bestScore;
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

        const score = this.executeMiniMax(0, false, optimalLines[0].score - Bot.OPTIMAL_MOVE_THRESHOLD)!;
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

    const threshold = Math.abs(optimalLines[0].score) > 1e6
      ? 0
      : Bot.OPTIMAL_MOVE_THRESHOLD;

    for (let i = Bot.OPTIMAL_LINES_COUNT - 1; i > 0; i--) {
      if (optimalLines[0].score - optimalLines[i].score > threshold) {
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

  getTimestamp(): bigint {
    return this.debug ? process.hrtime.bigint() : 0n;
  }

  makeMove(): number | undefined {
    if (this.turn !== this.color) {
      return;
    }

    this.evals = 0;
    this.evalTime = 0n;
    this.evalColorTime = 0n;
    this.evalDoubledPawnsTime = 0n;
    this.evalKingSafetyTime = 0n;
    this.evalPassedPawnsTime = 0n;
    this.evalPawnIslandsTime = 0n;
    this.evalPiecesTime = 0n;
    this.calculateAttacksTime = 0n;
    this.calculateLegalMovesTime = 0n;
    this.calculateRestTime = 0n;
    this.performMoveTime = 0n;
    this.revertMoveTime = 0n;

    const timestamp = process.hrtime.bigint();
    const move = this.getOptimalMove();
    const moveTook = Number(process.hrtime.bigint() - timestamp) / 1e6;
    const evalTook = Number(this.evalTime) / 1e6;

    console.log(`move took ${`${moveTook}`.red.bold} ms`);
    console.log(`eval took ${`${evalTook}`.red.bold} ms`);
    console.log(`rest took ${`${moveTook - evalTook}`.red.bold} ms`);

    if (this.debug) {
      console.log(`evalColor took ${Number(this.evalColorTime) / 1e6} ms`);
      console.log(`evalDoubledPawns took ${Number(this.evalDoubledPawnsTime) / 1e6} ms`);
      console.log(`evalKingSafety took ${Number(this.evalKingSafetyTime) / 1e6} ms`);
      console.log(`evalPassedPawns took ${Number(this.evalPassedPawnsTime) / 1e6} ms`);
      console.log(`evalPawnIslands took ${Number(this.evalPawnIslandsTime) / 1e6} ms`);
      console.log(`evalPiecesTime took ${Number(this.evalPiecesTime) / 1e6} ms`);
      console.log(`calculateAttacks took ${Number(this.calculateAttacksTime) / 1e6} ms`);
      console.log(`calculateLegalMoves took ${Number(this.calculateLegalMovesTime) / 1e6} ms`);
      console.log(`calculateRest took ${Number(this.calculateRestTime) / 1e6} ms`);
      console.log(`performMove took ${Number(this.performMoveTime) / 1e6} ms`);
      console.log(`revertMove took ${Number(this.revertMoveTime) / 1e6} ms`);
    }

    console.log(`evals: ${`${this.evals}`.blue.bold}, took ${`${evalTook}`.red.bold} ms`);
    console.log(`performance: ${`${+(this.evals / moveTook).toFixed(3)}`.green.bold} kn/s`);
    console.log('-'.repeat(80).bold);

    // return undefined;
    return move;
  }

  pieceSorter = (type1: PieceType, type2: PieceType): number => {
    return type1 - type2;
  };
}
