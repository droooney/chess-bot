import Game, { GetPossibleMovesType } from './Game';
import { Color, ColorPieces, Piece, PieceType, Result } from './Utils';

type PawnFiles = { [file in number]: number; };

export default class Bot extends Game {
  color: Color;
  opponentColor: Color;
  evals: number = 0;
  evalTime: number = 0;
  evalAdvancedPawnsTime: number = 0;
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

  constructor(color: Color) {
    super();

    this.color = color;
    this.opponentColor = Bot.oppositeColor[color];
  }

  eval(): number {
    if (this.result !== null) {
      return this.result === Result.DRAW
        ? 0
        : this.result === this.color as 0 | 1
          ? Infinity
          : -Infinity
    }

    const timestamp = Date.now();
    const result = this.evalColor(this.color) - this.evalColor(this.opponentColor);

    this.evals++;
    this.evalTime += Date.now() - timestamp;

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

    return (
      this.evalAdvancedPawns(color, pawns)
      + this.evalBishopPair(pieces)
      + this.evalControl(color, opponentKing, pieces, isEndgame)
      + this.evalDevelopment(color, pieces)
      + this.evalDoubledPawns(pawnFiles)
      + this.evalHangingPieces(color, pieces, opponentPieces)
      + this.evalKingSafety(color, king, isEndgame)
      + this.evalMaterial(pieces)
      + this.evalPassedPawns(color, opponentColor, pawns)
      + this.evalPawnIslands(pawnFiles)
      + this.evalRooksActivity(pieces, pawnFiles)
      // + this.evalUndefendedPieces(pieces, opponentPieces)
    );
  }

  evalAdvancedPawns(color: Color, pawns: Piece[]): number {
    const timestamp = Date.now();
    let score = 0;
    const isWhite = color === Color.WHITE;

    for (let i = 0, l = pawns.length; i < l; i++) {
      const pawn = pawns[i];
      const y = pawn.square >> 3;

      score += (
        (isWhite ? y < 5 : y > 2)
          ? 0
          : (isWhite ? y === 5 : y === 2)
            ? 200
            : 500
      );
    }

    this.evalAdvancedPawnsTime += Date.now() - timestamp;

    return score;
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
    const opponentKingFile = opponentKing.square & 7;
    const opponentKingRank = opponentKing.square >> 3;
    const isWhite = color === Color.WHITE;

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];

      if (piece.type === PieceType.KING && !isEndgame) {
        continue;
      }

      const legalMoves = this.getLegalMoves(piece);

      for (let i = 0, l = legalMoves.length; i < l; i++) {
        const square = legalMoves[i];
        const file = square & 7;
        const rank = square >> 3;
        const distanceToOpponentKing = Math.abs(opponentKingFile - file) + Math.abs(opponentKingRank - rank);

        score += (
          isEndgame || (isWhite ? rank < 3 : rank > 4)
            ? 10
            : (isWhite ? rank === 3 : rank === 4)
              ? 11
              : (isWhite ? rank === 4 : rank === 3)
                ? 12
                : (isWhite ? rank === 5 : rank === 2)
                  ? 13
                  : (isWhite ? rank === 6 : rank === 1)
                    ? 14
                    : 15
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
          && rank === Bot.pieceRanks[color]
        )
          ? piece.type === PieceType.KNIGHT
            ? -300
            : -500
          : (
            piece.type === PieceType.PAWN
            && (file === 3 || file === 4)
            && rank === Bot.pawnRanks[color]
          )
            ? -250
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

    pieces: for (const pieceId in pieces) {
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
      let diff = 0;
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

          lossStates.push(diff += pieceToTake);

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

          lossStates.push(diff -= pieceToTake);

          pieceToTake = lessValuableDefender.type;
          state = 0;
        }
      }

      lossStates.push(lossStates[lossStates.length - 1]);

      let maxWin = -Infinity;
      let maxWinIndex = 0;
      let minLoss = Infinity;
      let minLossIndex = 0;

      for (let i = 0, l = lossStates.length; i < l; i++) {
        let loss = lossStates[i];

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

      score -= lossStates[Math.min(minLossIndex, maxWinIndex)] * coeff;
    }

    this.evalHangingPiecesTime += Date.now() - timestamp;

    return score;
  }

  evalKingSafety(color: Color, king: Piece, isEndgame: boolean): number {
    const timestamp = Date.now();

    if (isEndgame) {
      this.evalKingSafetyTime += Date.now() - timestamp;

      return this.getLegalMoves(king).length * 10;
    }

    const kingFile = king.square & 7;
    const kingRank = king.square >> 3;
    const isWhite = color === Color.WHITE;

    if (isWhite ? kingRank >= 4 : kingRank <= 5) {
      return -5000;
    }

    if (isWhite ? kingRank === 3 : kingRank === 4) {
      return -4000;
    }

    if (isWhite ? kingRank === 2 : kingRank === 5) {
      return -3000;
    }

    if (
      (isWhite ? kingRank === 1 : kingRank === 6)
      && kingFile >= 2
      && kingFile < 6
    ) {
      return kingFile === 3 || kingFile === 4
        ? -1500
        : -1000;
    }

    if (kingFile === 3 || kingFile === 4) {
      return -500;
    }

    if (kingFile === 5) {
      return -250;
    }

    const upperRank = isWhite
      ? kingRank + 1
      : kingRank - 1;
    const defendingPieces = [
      this.board[Bot.squares[kingRank][kingFile - 1]],
      this.board[Bot.squares[kingRank][kingFile + 1]],
      this.board[Bot.squares[upperRank][kingFile - 1]],
      this.board[Bot.squares[upperRank][kingFile]],
      this.board[Bot.squares[upperRank][kingFile + 1]]
    ];

    let score = (isWhite ? kingRank === 0 : kingRank === 7) && kingFile !== 2 ? 300 : 0;

    for (let i = 0, l = defendingPieces.length; i < l; i++) {
      const piece = defendingPieces[i];

      if (piece && piece.color === color) {
        score += (
          (piece.square >> 3) === upperRank
            ? piece.type === PieceType.PAWN
              ? 200
              : 100
            : piece.type === PieceType.PAWN
              ? 100
              : 50
        );
      }
    }

    this.evalKingSafetyTime += Date.now() - timestamp;

    return score;
  }

  evalMaterial(pieces: ColorPieces): number {
    const timestamp = Date.now();
    let score = 0;

    for (const pieceId in pieces) {
      score += Bot.piecesWorth[pieces[pieceId].type] * 1000;
    }

    this.evalMaterialTime += Date.now() - timestamp;

    return score;
  }

  evalPassedPawns(color: Color, opponentColor: Color, pawns: Piece[]): number {
    const timestamp = Date.now();
    const opponentPawns = this.getPawns(opponentColor);
    const passedPawnFiles: { [file in number]: true; } = {};
    const isWhite = color === Color.WHITE;
    let passedPawnCount = 0;

    pawns: for (let i = 0, l = pawns.length; i < l; i++) {
      const pawn = pawns[i];
      const file = pawn.square & 7;
      const rank = pawn.square >> 3;

      if (file in passedPawnFiles) {
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

      passedPawnFiles[file] = true;
      passedPawnCount++;
    }

    let score = passedPawnCount * 500;

    for (const file in passedPawnFiles) {
      score += passedPawnFiles[+file + 1] || passedPawnFiles[+file - 1] ? 250 : 0;
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

  evalUndefendedPieces(pieces: ColorPieces, opponentPieces: ColorPieces) {
    let score = 0;
    const defendedSquares: { [square in number]: true; } = {};
    const attackedSquares: { [square in number]: true; } = {};

    for (const pieceId in pieces) {
      const defendedSquaresByPiece = this.getPossibleMoves(pieces[pieceId], GetPossibleMovesType.ATTACKED);

      for (let i = 0, l = defendedSquaresByPiece.length; i < l; i++) {
        defendedSquares[defendedSquaresByPiece[i]] = true;
      }
    }

    for (const pieceId in opponentPieces) {
      const attackedSquaresByPiece = this.getPossibleMoves(opponentPieces[pieceId], GetPossibleMovesType.ATTACKED);

      for (let i = 0, l = attackedSquaresByPiece.length; i < l; i++) {
        attackedSquares[attackedSquaresByPiece[i]] = true;
      }
    }

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];

      if (
        piece.type !== PieceType.KING
        && piece.type !== PieceType.QUEEN
        && !(piece.square in defendedSquares)
        && !(piece.square in attackedSquares)
      ) {
        score -= Bot.piecesWorth[piece.type] * 10;
      }
    }

    return score;
  }

  executeMiniMax(depth: number, isSame: boolean, currentOptimalScore: number): number {
    if (this.result !== null) {
      return this.result === Result.DRAW
        ? 0
        : this.result === this.color as 0 | 1
          ? Infinity
          : -Infinity
    }

    if (depth === 0) {
      return this.eval();
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

        this.performMove(move, true);

        if (this.isInCheck(turn)) {
          this.revertLastMove();

          continue;
        }

        const score = this.executeMiniMax(isSame ? depth : depth - 1, !isSame, maxScore);

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

  getOptimalMove(): number | undefined {
    const legalMoves = this.getAllLegalMoves();

    if (legalMoves.length === 1) {
      return legalMoves[0];
    }

    const legalMovesWithScores = legalMoves.map((move) => {
      this.performMove(move, true);

      const score = this.eval();

      this.revertLastMove();

      return {
        move,
        score
      };
    });

    legalMovesWithScores.sort(({ score: score1 }, { score: score2 }) => score2 - score1);

    let maxScore = -Infinity;
    const scores = legalMovesWithScores.map(({ move }) => {
      this.performMove(move, true);

      const score = this.executeMiniMax(1, false, maxScore);

      if (score > maxScore) {
        maxScore = score;
      }

      this.revertLastMove();

      return {
        move,
        score
      };
    });

    const maxScoreMoves = scores.filter(({ score }) => score === maxScore);

    const randomIndex = Math.floor(Math.random() * maxScoreMoves.length);
    const selectedMove = maxScoreMoves[randomIndex];

    if (!selectedMove) {
      return;
    }

    console.log(Bot.getUciFromMove(selectedMove.move), selectedMove.score / 1000);

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
      evalMaterial += Bot.piecesWorth[myPieces[pieceId].type];
    }

    for (const pieceId in opponentPieces) {
      evalMaterial += Bot.piecesWorth[opponentPieces[pieceId].type];
    }

    return evalMaterial < 35;
  }

  makeMove(): number | undefined {
    if (this.turn !== this.color) {
      return;
    }

    this.evals = 0;
    this.evalTime = 0;
    this.evalAdvancedPawnsTime = 0;
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
    console.log(`evalAdvancedPawnsTime took ${this.evalAdvancedPawnsTime} ms`);
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

    return move;
  }

  pieceSorter = ({ type: type1 }: Piece, { type: type2 }: Piece): number => {
    return Bot.piecesWorth[type2] - Bot.piecesWorth[type1];
  };
}
