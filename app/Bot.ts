import Game, { GetPossibleMovesType } from './Game';
import { Color, ColorPieces, Piece, PieceType, Result } from './Utils';

type PawnFiles = { [file in number]: number; };

export default class Bot extends Game {
  static SEARCH_DEPTH = 1;
  static OPTIMAL_LINES_COUNT = 10;
  static OPTIMAL_MOVE_THRESHOLD = 50;
  static MATE_SCORE = 1e7;

  static getScore(score: number): number | string {
    return Math.abs(score) > 1e6
      ? `#${score < 0 ? '-' : ''}${Bot.MATE_SCORE - Math.abs(score) + 1}`
      : score / 1000
  }

  color: Color;
  opponentColor: Color;
  evals: number = 0;
  evalTime: number = 0;
  evalBishopPairTime: number = 0;
  evalControlTime: number = 0;
  evalDevelopmentTime: number = 0;
  evalDoubledPawnsTime: number = 0;
  evalHangingPiecesTime: number = 0;
  evalKingSafetyTime: number = 0;
  evalMaterialTime: number = 0;
  evalPassedPawnsTime: number = 0;
  evalPawnIslandsTime: number = 0;
  evalRooksActivityTime: number = 0;

  constructor(fen: string, color: Color) {
    super(fen);

    this.color = color;
    this.opponentColor = Bot.oppositeColor[color];
  }

  eval(depth: number): number {
    if (this.result !== null) {
      return this.getFinishedGameScore(depth);
    }

    const timestamp = Date.now();
    const result = this.evalColor(this.color) - this.evalColor(this.opponentColor);

    this.evals++;
    this.evalTime += Date.now() - timestamp;

    // console.log(this.moves.map(({ move }) => Game.getUciFromMove(move)).join(' '), result);

    return result;
  }

  evalColor(color: Color): number {
    const opponentColor = Bot.oppositeColor[color];
    const isEndgame = this.isEndgame();

    const pieces = this.pieces[color];
    const opponentPieces = this.pieces[opponentColor];
    const pawns = this.getPawns(color);
    const king = this.kings[color];
    const opponentKing = this.kings[opponentColor];
    const pawnFiles: PawnFiles = {};

    for (let i = 0, l = pawns.length; i < l; i++) {
      const file = pawns[i].square & 7;

      pawnFiles[file] = pawnFiles[file] + 1 || 1;
    }

    /*
    if (this.moves.map(({ move }) => Game.getUciFromMove(move)).join(' ') === 'g2h3 d5e4') {
      console.log(color, (
        this.evalBishopPair(pieces)
        + this.evalControl(color, opponentKing, pieces, isEndgame)
        + this.evalDevelopment(color, pieces)
        + this.evalDoubledPawns(pawnFiles)
        + this.evalHangingPieces(color, pieces, opponentPieces)
        + this.evalKingSafety(color, king, isEndgame)
        + this.evalMaterial(pieces)
        + this.evalPassedPawns(color, opponentColor, pawns, isEndgame)
        + this.evalPawnIslands(pawnFiles)
        + this.evalRooksActivity(pieces, pawnFiles)
      ), {
        evalBishopPair: this.evalBishopPair(pieces),
        evalControl: this.evalControl(color, opponentKing, pieces, isEndgame),
        evalDevelopment: this.evalDevelopment(color, pieces),
        evalDoubledPawns: this.evalDoubledPawns(pawnFiles),
        evalHangingPieces: this.evalHangingPieces(color, pieces, opponentPieces),
        evalKingSafety: this.evalKingSafety(color, king, isEndgame),
        evalMaterial: this.evalMaterial(pieces),
        evalPassedPawns: this.evalPassedPawns(color, opponentColor, pawns, isEndgame),
        evalPawnIslands: this.evalPawnIslands(pawnFiles),
        evalRooksActivity: this.evalRooksActivity(pieces, pawnFiles)
      });
    }
    */

    return (
      this.evalBishopPair(pieces)
      + this.evalControl(color, opponentKing, pieces, isEndgame)
      + this.evalDevelopment(color, pieces)
      + this.evalDoubledPawns(pawnFiles)
      + this.evalHangingPieces(color, pieces, opponentPieces)
      + this.evalKingSafety(color, king, isEndgame)
      + this.evalMaterial(color)
      + this.evalPassedPawns(color, opponentColor, pawns, isEndgame)
      + this.evalPawnIslands(pawnFiles)
      + this.evalRooksActivity(pieces, pawnFiles)
    );
  }

  evalBishopPair(pieces: ColorPieces): number {
    const timestamp = Date.now();
    let bishopsCount = 0;

    for (const pieceId in pieces) {
      if (pieces[pieceId].type === PieceType.BISHOP) {
        if (++bishopsCount === 2) {
          return 500;
        }
      }
    }

    this.evalBishopPairTime += Date.now() - timestamp;

    return 0;
  }

  evalControl(color: Color, opponentKing: Piece, pieces: ColorPieces, isEndgame: boolean): number {
    const timestamp = Date.now();
    let score = 0;
    const distances = Bot.distances[opponentKing.square];
    const isWhite = color === Color.WHITE;

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];

      if (piece.type === PieceType.KING && !isEndgame) {
        continue;
      }

      const legalMoves = this.getPossibleMoves(piece, GetPossibleMovesType.ATTACKED);

      for (let i = 0, l = legalMoves.length; i < l; i++) {
        const square = legalMoves[i];
        const rank = square >> 3;
        const file = square & 7;
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

    this.evalControlTime += Date.now() - timestamp;

    return score;
  }

  evalDevelopment(color: Color, pieces: ColorPieces): number {
    const timestamp = Date.now();
    let score = 0;

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];
      const file = piece.square & 7;
      const rank = piece.square >> 3;

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
    }

    this.evalDevelopmentTime += Date.now() - timestamp;

    return score;
  }

  evalDoubledPawns(pawnFiles: PawnFiles): number {
    const timestamp = Date.now();
    let score = 0;

    for (const file in pawnFiles) {
      if (pawnFiles[file] > 1) {
        score -= 300;
      }
    }

    this.evalDoubledPawnsTime += Date.now() - timestamp;

    return score;
  }

  evalHangingPieces(color: Color, pieces: ColorPieces, opponentPieces: ColorPieces): number {
    const timestamp = Date.now();
    const coeff = this.turn === color ? 100 : 1000;
    let score = 0;
    const defendedSquares: { [square in number]: Piece[]; } = {};
    const attackedSquares: { [square in number]: Piece[]; } = {};

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];
      const defendedSquaresByPiece = this.getPossibleMoves(piece, GetPossibleMovesType.ATTACKED);

      for (let i = 0, l = defendedSquaresByPiece.length; i < l; i++) {
        const defendedSquare = defendedSquaresByPiece[i];

        (defendedSquares[defendedSquare] = defendedSquares[defendedSquare] || []).push(piece);
      }
    }

    for (const pieceId in opponentPieces) {
      const opponentPiece = opponentPieces[pieceId];
      const attackedSquaresByPiece = this.getPossibleMoves(opponentPiece, GetPossibleMovesType.ATTACKED);

      for (let i = 0, l = attackedSquaresByPiece.length; i < l; i++) {
        const attackedSquare = attackedSquaresByPiece[i];

        (attackedSquares[attackedSquare] = attackedSquares[attackedSquare] || []).push(opponentPiece);
      }
    }

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];

      if (piece.type === PieceType.KING) {
        continue;
      }

      const attackingPieces = attackedSquares[piece.square];

      if (!attackingPieces) {
        continue;
      }

      const defendingPieces = defendedSquares[piece.square];

      if (!defendingPieces) {
        score -= Bot.piecesWorth[piece.type] * coeff;

        continue;
      }

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

          pieceToTake = lessValuableAttacker.type;
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

          pieceToTake = lessValuableDefender.type;
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

      score += (minLossIndex < maxWinIndex ? minLoss : maxWin) * coeff;
    }

    this.evalHangingPiecesTime += Date.now() - timestamp;

    return score;
  }

  evalKingSafety(color: Color, king: Piece, isEndgame: boolean): number {
    if (isEndgame) {
      return 0;
    }

    const timestamp = Date.now();
    const kingFile = king.square & 7;
    const kingRank = king.square >> 3;
    const isWhite = color === Color.WHITE;

    if (isWhite ? kingRank > Bot.ranks.RANK_4[Color.WHITE] : kingRank < Bot.ranks.RANK_4[Color.WHITE]) {
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
          (piece.square >> 3) === upperRank
            ? piece.type === PieceType.PAWN
              ? 100
              : 50
            : piece.type === PieceType.PAWN
              ? 50
              : 25
        );
      }
    }

    this.evalKingSafetyTime += Date.now() - timestamp;

    return score;
  }

  evalMaterial(color: Color): number {
    const timestamp = Date.now();
    const score = this.material[color] * 1000;

    this.evalMaterialTime += Date.now() - timestamp;

    return score;
  }

  evalPassedPawns(color: Color, opponentColor: Color, pawns: Piece[], isEndgame: boolean): number {
    const timestamp = Date.now();
    const opponentPawns = this.getPawns(opponentColor);
    const passedPawnFiles: { [file in number]: number; } = {};
    const isWhite = color === Color.WHITE;
    let passedPawnCount = 0;

    pawns: for (let i = 0, l = pawns.length; i < l; i++) {
      const pawn = pawns[i];
      const file = pawn.square & 7;
      const rank = pawn.square >> 3;

      if (file in passedPawnFiles) {
        passedPawnFiles[file] = isWhite
          ? Math.max(passedPawnFiles[file], rank)
          : Math.min(passedPawnFiles[file], rank);

        continue;
      }

      for (let i = 0, l = opponentPawns.length; i < l; i++) {
        const opponentPawn = opponentPawns[i];
        const opponentFile = opponentPawn.square & 7;
        const opponentRank = opponentPawn.square >> 3;

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
              : 0
          )
      );
    }

    this.evalPassedPawnsTime += Date.now() - timestamp;

    return score;
  }

  evalPawnIslands(pawnFiles: PawnFiles): number {
    const timestamp = Date.now();
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

    this.evalPawnIslandsTime += Date.now() - timestamp;

    return (islandsCount - 1) * -200;
  }

  evalRooksActivity(pieces: ColorPieces, pawnFiles: PawnFiles): number {
    const timestamp = Date.now();
    let score = 0;

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];

      if (piece.type === PieceType.ROOK && !((piece.square & 7) in pawnFiles)) {
        score += 100;
      }
    }

    this.evalRooksActivityTime += Date.now() - timestamp;

    return score;
  }

  executeMiniMax(depth: number, isSame: boolean, currentOptimalScore: number): number {
    if (this.result !== null) {
      return this.getFinishedGameScore(depth);
    }

    if (depth === Bot.SEARCH_DEPTH) {
      return this.eval(depth);
    }

    const turn = this.turn;
    const pieces = this.pieces[turn];

    let maxScore = isSame ? -Infinity : Infinity;

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];
      const possibleMoves = this.getLegalMoves(piece);

      for (let i = 0, l = possibleMoves.length; i < l; i++) {
        const square = possibleMoves[i];
        let move = piece.square << 9 | square << 3;

        if (piece.type === PieceType.PAWN && square in Bot.promotionSquares[turn]) {
          move |= PieceType.QUEEN;
        }

        this.performMove(move);

        if (this.isInCheck(turn)) {
          this.revertLastMove();

          continue;
        }

        const score = this.executeMiniMax(isSame ? depth : depth + 1, !isSame, maxScore);

        if (isSame ? score >= currentOptimalScore : score <= currentOptimalScore) {
          this.revertLastMove();

          return isSame ? Infinity : -Infinity;
        }

        maxScore = isSame ? Math.max(maxScore, score) : Math.min(maxScore, score);

        this.revertLastMove();
      }
    }

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

  getFinishedGameScore(depth: number): number {
    return this.result === Result.DRAW
      ? 0
      : this.result === this.color as 0 | 1
        ? Bot.MATE_SCORE - depth
        : -(Bot.MATE_SCORE - depth + 1)
  }

  getOptimalMove(): number | undefined {
    const legalMoves = this.getAllLegalMoves();

    if (legalMoves.length === 1) {
      console.log('only move', Bot.moveToUci(legalMoves[0]));

      return legalMoves[0];
    }

    const optimalLines = new Array(Bot.OPTIMAL_LINES_COUNT).fill(0).map(() => ({ move: 0, score: -Infinity }));

    legalMoves
      .map((move) => {
        this.performMove(move);

        const score = this.eval(0);

        this.revertLastMove();

        return {
          move,
          score
        };
      })
      .sort(({ score: score1 }, { score: score2 }) => score2 - score1)
      .forEach(({ move }) => {
        this.performMove(move);

        const score = this.executeMiniMax(0, false, optimalLines[0].score - Bot.OPTIMAL_MOVE_THRESHOLD);
        const index = optimalLines.findIndex(({ score: optimalScore }) => score > optimalScore);

        if (index !== -1) {
          optimalLines.splice(index, 0, { move, score });
          optimalLines.pop();
        }

        this.revertLastMove();

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

    console.log(optimalMoves.map(({ move, score }) => ({ move: Game.moveToUci(move), score: Bot.getScore(score) })));
    console.log(Bot.moveToUci(selectedMove.move), Bot.getScore(selectedMove.score));

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

  isEndgame(): boolean {
    let hasQueen = false;
    const myPieces = this.pieces[this.color];
    const opponentPieces = this.pieces[this.opponentColor];

    for (const pieceId in myPieces) {
      if (myPieces[pieceId].type === PieceType.QUEEN) {
        hasQueen = true;

        break;
      }
    }

    if (!hasQueen) {
      for (const pieceId in opponentPieces) {
        if (opponentPieces[pieceId].type === PieceType.QUEEN) {
          hasQueen = true;

          break;
        }
      }
    }

    if (hasQueen) {
      return false;
    }

    let evalMaterial = 0;

    for (const pieceId in myPieces) {
      const piece = myPieces[pieceId];

      if (piece.type > PieceType.QUEEN && piece.type < PieceType.PAWN) {
        evalMaterial += Bot.piecesWorth[piece.type];
      }
    }

    for (const pieceId in opponentPieces) {
      const piece = opponentPieces[pieceId];

      if (piece.type > PieceType.QUEEN && piece.type < PieceType.PAWN) {
        evalMaterial += Bot.piecesWorth[piece.type];
      }
    }

    return evalMaterial < 35;
  }

  makeMove(): number | undefined {
    if (this.turn !== this.color) {
      return;
    }

    this.evals = 0;
    this.evalTime = 0;
    this.evalBishopPairTime = 0;
    this.evalControlTime = 0;
    this.evalDevelopmentTime = 0;
    this.evalDoubledPawnsTime = 0;
    this.evalHangingPiecesTime = 0;
    this.evalKingSafetyTime = 0;
    this.evalMaterialTime = 0;
    this.evalPassedPawnsTime = 0;
    this.evalPawnIslandsTime = 0;
    this.evalRooksActivityTime = 0;

    const time = Date.now();
    const move = this.getOptimalMove();
    const moveTook = Date.now() - time;

    console.log(`move took ${moveTook} ms`);
    console.log(`eval took ${this.evalTime} ms`);
    console.log(`rest took ${moveTook - this.evalTime} ms`);
    /*
    console.log(`evalBishopPairTime took ${this.evalBishopPairTime} ms`);
    console.log(`evalControlTime took ${this.evalControlTime} ms`);
    console.log(`evalDevelopmentTime took ${this.evalDevelopmentTime} ms`);
    console.log(`evalDoubledPawnsTime took ${this.evalDoubledPawnsTime} ms`);
    console.log(`evalHangingPiecesTime took ${this.evalHangingPiecesTime} ms`);
    console.log(`evalKingSafetyTime took ${this.evalKingSafetyTime} ms`);
    console.log(`evalMaterialTime took ${this.evalMaterialTime} ms`);
    console.log(`evalPassedPawnsTime took ${this.evalPassedPawnsTime} ms`);
    console.log(`evalPawnIslandsTime took ${this.evalPawnIslandsTime} ms`);
    console.log(`evalRooksActivityTime took ${this.evalRooksActivityTime} ms`);
    console.log(`evals: ${this.evals}, took ${this.evalTime} ms`);
    */

    return move;
  }

  pieceSorter = ({ type: type1 }: Piece, { type: type2 }: Piece): number => {
    return Bot.piecesWorth[type2] - Bot.piecesWorth[type1];
  };
}
