import Game, { GetPossibleMovesType } from './Game';
import { Color, ColorPieces, Piece, PieceType, Result } from './Utils';

type PawnFiles = { [file in number]: number; };

export default class Bot extends Game {
  color: Color;
  opponentColor: Color;

  constructor(color: Color) {
    super();

    this.color = color;
    this.opponentColor = Bot.oppositeColor[color];
  }

  eval(): number {
    return this.evalColor(this.color) - this.evalColor(this.opponentColor);
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

    const evalMaterial = this.evalMaterial(pieces);
    const evalAdvancedPawns = this.evalAdvancedPawns(color, pawns);
    const evalBishopPair = this.evalBishopPair(pieces);
    const evalControl = this.evalControl(color, opponentKing, pieces, isEndgame);
    const evalDevelopment = this.evalDevelopment(color, pieces);
    const evalDoubledPawns = this.evalDoubledPawns(pawnFiles);
    const evalHangingPieces = this.evalHangingPieces(color, pieces, opponentPieces, evalMaterial);
    const evalKingSafety = this.evalKingSafety(color, king, isEndgame);
    const evalPassedPawns = this.evalPassedPawns(color, opponentColor, pawns);
    const evalPawnIslands = this.evalPawnIslands(pawnFiles);
    const evalRooksActivity = this.evalRooksActivity(pieces, pawnFiles);
    const evalUndefendedPieces = this.evalUndefendedPieces(pieces, opponentPieces);

    /*
    console.log({
      color,
      evalMaterial,
      evalAdvancedPawns,
      evalBishopPair,
      evalChecksCount,
      evalControl,
      evalDevelopment,
      evalDoubledPawns,
      evalHangingPieces,
      evalKingNearCenter,
      evalKingSafety,
      evalPassedPawns,
      evalPawnIslands,
      evalRooksActivity,
      evalUndefendedPieces
    });
    */

    return (
      evalMaterial
      + evalAdvancedPawns
      + evalBishopPair
      + evalControl
      + evalDevelopment
      + evalDoubledPawns
      + evalHangingPieces
      + evalKingSafety
      + evalPassedPawns
      + evalPawnIslands
      + evalRooksActivity
      + evalUndefendedPieces
    );
  }

  evalAdvancedPawns(color: Color, pawns: Piece[]): number {
    let score = 0;
    const isWhite = color === Color.WHITE;

    for (let i = 0, l = pawns.length; i < l; i++) {
      const pawn = pawns[i];
      const y = pawn.square >> 3;

      score += (
        (isWhite ? y < 5 : y > 2)
          ? 0
          : (isWhite ? y === 5 : y === 2)
            ? 20
            : 50
      );
    }

    return score;
  }

  evalBishopPair(pieces: ColorPieces): number {
    let bishopsCount = 0;

    for (const pieceId in pieces) {
      if (pieces[pieceId].type === PieceType.BISHOP) {
        if (++bishopsCount === 2) {
          return 50;
        }
      }
    }

    return 0;
  }

  evalControl(color: Color, opponentKing: Piece, pieces: ColorPieces, isEndgame: boolean): number {
    let score = 0;
    const opponentKingFile = opponentKing.square & 7;
    const opponentKingRank = opponentKing.square >> 3;
    const isWhite = color === Color.WHITE;

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];

      if (piece.type === PieceType.KING && !isEndgame) {
        continue;
      }

      const legalMoves = this.getLegalMoves(piece, false);

      for (let i = 0, l = legalMoves.length; i < l; i++) {
        const square = legalMoves[i];
        const file = square & 7;
        const rank = square >> 3;
        const distanceToOpponentKing = (
          (file > opponentKingFile ? opponentKingFile - file : file - opponentKingFile)
          + (rank > opponentKingRank ? opponentKingRank - rank : rank - opponentKingRank)
        );

        score += (
          isEndgame || (isWhite ? rank < 3 : rank > 4)
            ? 3
            : (isWhite ? rank === 3 : rank === 4)
              ? 4
              : (isWhite ? rank === 4 : rank === 3)
                ? 5
                : (isWhite ? rank === 5 : rank === 2)
                  ? 6
                  : 7
        ) + (
          distanceToOpponentKing > 2
            ? 0
            : distanceToOpponentKing === 2
              ? 5
              : 15
        );
      }
    }

    return score;
  }

  evalDevelopment(color: Color, pieces: ColorPieces): number {
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
            ? -30
            : -50
          : (
            piece.type === PieceType.PAWN
            && (file === 3 || file === 4)
            && rank === Bot.pawnRanks[color]
          )
            ? -25
            : 0
      );
    }

    return score;
  }

  evalDoubledPawns(pawnFiles: PawnFiles): number {
    let score = 0;

    for (const file in pawnFiles) {
      if (pawnFiles[file] > 1) {
        score -= 30;
      }
    }

    return score;
  }

  evalHangingPieces(color: Color, pieces: ColorPieces, opponentPieces: ColorPieces, evalMaterial: number): number {
    let evalMaterialDiff = evalMaterial - this.evalMaterial(opponentPieces);
    const initialMaterialDiff = evalMaterialDiff;
    const coeff = this.turn === color ? 10 : 100;
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

      while (defendingPieces.length && attackingPieces.length) {
        const defender = defendingPieces.pop()!;
        const attacker = attackingPieces.pop()!;

        evalMaterialDiff += Bot.piecesWorth[attacker.type] - Bot.piecesWorth[pieceToTake];

        pieceToTake = defender.type;

        if (evalMaterialDiff < initialMaterialDiff) {
          score -= Bot.piecesWorth[piece.type] * coeff;

          continue pieces;
        }

        if (evalMaterialDiff - Bot.piecesWorth[pieceToTake] >= initialMaterialDiff) {
          continue pieces;
        }
      }

      if (attackingPieces.length) {
        evalMaterialDiff -= Bot.piecesWorth[pieceToTake];
      }

      if (evalMaterialDiff < initialMaterialDiff) {
        score -= Bot.piecesWorth[piece.type] * coeff;
      }
    }

    return score;
  }

  evalKingSafety(color: Color, king: Piece, isEndgame: boolean): number {
    if (isEndgame) {
      return this.getLegalMoves(king, false).length * 10;
    }

    const kingFile = king.square & 7;
    const kingRank = king.square >> 3;
    const isWhite = color === Color.WHITE;

    if (isWhite ? kingRank >= 4 : kingRank < 5) {
      return -500;
    }

    if (isWhite ? kingRank === 3 : kingRank === 4) {
      return -400;
    }

    if (isWhite ? kingRank === 2 : kingRank === 5) {
      return -300;
    }

    if (
      (isWhite ? kingRank === 1 : kingRank === 6)
      && kingFile >= 2
      && kingFile < 6
    ) {
      return kingFile === 3 || kingFile === 4
        ? -150
        : -100;
    }

    if (kingFile === 3 || kingFile === 4) {
      return -50;
    }

    if (kingFile === 5) {
      return -25;
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

    let score = (isWhite ? kingRank === 0 : kingRank === 7) && kingFile !== 2 ? 30 : 0;

    for (let i = 0, l = defendingPieces.length; i < l; i++) {
      const piece = defendingPieces[i];

      if (piece && piece.color === color) {
        score += (
          (piece.square >> 3) === upperRank
            ? piece.type === PieceType.PAWN
              ? 20
              : 10
            : piece.type === PieceType.PAWN
              ? 10
              : 5
        );
      }
    }

    return score;
  }

  evalMaterial(pieces: ColorPieces): number {
    let score = 0;

    for (const pieceId in pieces) {
      score += Bot.piecesWorth[pieces[pieceId].type] * 100;
    }

    return score;
  }

  evalPassedPawns(color: Color, opponentColor: Color, pawns: Piece[]): number {
    const opponentPawns = this.getPawns(opponentColor);
    const passedPawnFiles: { [file in number]: true; } = {};
    const isWhite = color === Color.WHITE;
    let passedPawnCount = 0;

    pawns: for (let i = 0, l = pawns.length; i < l; i++) {
      const pawn = pawns[i];
      const file = pawn.square & 7;

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
          && (isWhite ? opponentRank > file : opponentRank < file)
        ) {
          continue pawns;
        }
      }

      passedPawnFiles[file] = true;
      passedPawnCount++;
    }

    let score = passedPawnCount * 50;

    for (const file in passedPawnFiles) {
      score += (passedPawnFiles[+file + 1]) ? 1 : 0;
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

    return (islandsCount - 1) * -20;
  }

  evalRooksActivity(pieces: ColorPieces, pawnFiles: PawnFiles): number {
    let score = 0;

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];

      if (piece.type === PieceType.ROOK && !((piece.square & 7) in pawnFiles)) {
        score += 10;
      }
    }

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
        score -= -Bot.piecesWorth[piece.type];
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

    const legalMoves = this.getAllLegalMoves();

    let maxScore = isSame ? -Infinity : Infinity;

    for (let i = 0, l = legalMoves.length; i < l; i++) {
      this.performMove(legalMoves[i], true);

      const score = this.executeMiniMax(isSame ? depth : depth - 1, !isSame, maxScore);

      if (isSame ? score >= currentOptimalScore : score <= currentOptimalScore) {
        this.revertLastMove();

        return isSame ? Infinity : -Infinity;
      }

      maxScore = isSame ? Math.max(maxScore, score) : Math.min(maxScore, score);

      this.revertLastMove();
    }

    return maxScore;
  }

  getAllLegalMoves(): number[] {
    const moves: number[] = [];
    const pieces = this.pieces[this.turn];

    for (const pieceId in pieces) {
      const piece = pieces[pieceId];
      const legalMoves = this.getLegalMoves(piece, false);

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

  getOptimalMove(): number {
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

    console.log(Bot.getUciFromMove(selectedMove.move), selectedMove.score);

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
    if (this.result || this.turn !== this.color) {
      return;
    }

    const time = Date.now();
    const move = this.getOptimalMove();

    console.log(`move took ${Date.now() - time} ms`);

    return move;
  }

  pieceSorter = ({ type: type1 }: Piece, { type: type2 }: Piece): number => {
    return Bot.piecesWorth[type1] - Bot.piecesWorth[type2];
  };
}
