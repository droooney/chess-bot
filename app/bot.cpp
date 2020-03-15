#include <algorithm>
#include <ctime>
#include <iostream>
#include <random>
#include <string>
#include <vector>

#include "bot.h"
#include "game.h"
#include "gameUtils.h"
#include "utils.h"

using namespace std;

const int SEARCH_DEPTH = 3 * 2;
const int OPTIMAL_MOVE_THRESHOLD = 50;

Bot::Bot(const string &fen, Color color) : Game(fen) {
  this->color = color;
}

Score Bot::eval(int depth) {
  if (this->checkers && this->isNoMoves()) {
    return this->getMateScore(depth);
  }

  if (this->isDraw() || (!this->checkers && this->isNoMoves())) {
    return SCORE_EQUAL;
  }

  auto currentPawnScore = this->evaluatedPawnPositions[this->turn].find(this->pawnKey);
  bool foundPawnScore = currentPawnScore != this->evaluatedPawnPositions[this->turn].end();
  PositionInfo positionInfo;

  for (Color color = WHITE; color < NO_COLOR; ++color) {
    Piece** pieces = this->pieces[color];
    int pieceCount = this->pieceCounts[color];

    for (int i = 0; i < pieceCount; i++) {
      Piece* piece = pieces[i];

      if (piece->type == PAWN) {
        Rank rank = gameUtils::squareRanks[piece->square];
        File file = gameUtils::squareFiles[piece->square];

        if (foundPawnScore) {
          positionInfo.pawnFiles[color][file].min = rank;
          positionInfo.pawnFiles[color][file].max = rank;
        } else {
          FileInfo* fileInfo = &positionInfo.pawnFiles[color][file];

          if (fileInfo->min == NO_RANK) {
            fileInfo->min = rank;
            fileInfo->max = rank;
          } else {
            fileInfo->min = min(rank, fileInfo->min);
            fileInfo->max = max(rank, fileInfo->max);
          }

          positionInfo.pawns[color].push(piece);
        }
      }
    }
  }

  Score pawnsScore = foundPawnScore
    ? currentPawnScore->second
    : this->evalPawns(this->turn, &positionInfo) - this->evalPawns(~this->turn, &positionInfo);

  if (!foundPawnScore) {
    this->evaluatedPawnPositions[this->turn][this->pawnKey] = pawnsScore;
  }

  return pawnsScore + this->evalColor(this->turn, &positionInfo) - this->evalColor(~this->turn, &positionInfo);
}

Score Bot::evalColor(Color color, PositionInfo *positionInfo) {
  return this->evalKingSafety(color) + this->evalPieces(color, positionInfo);
}

Score Bot::evalKingSafety(Color color) {
  if (this->isEndgame()) {
    return SCORE_EQUAL;
  }

  Piece* king = this->kings[color];
  File kingFile = gameUtils::squareFiles[king->square];
  Rank kingRank = gameUtils::squareRanks[king->square];
  bool isWhite = color == WHITE;

  if (isWhite ? kingRank > gameUtils::ranks[color][RANK_4] : kingRank < gameUtils::ranks[color][RANK_4]) {
    return Score(-3000);
  }

  if (kingRank == gameUtils::ranks[color][RANK_4]) {
    return Score(-2000);
  }

  if (kingRank == gameUtils::ranks[color][RANK_3]) {
    return Score(-1000);
  }

  if (
    kingRank == gameUtils::ranks[color][RANK_2]
    && kingFile >= FILE_C
    && kingFile <= FILE_F
  ) {
    return kingFile == FILE_D || kingFile == FILE_E
      ? Score(-750)
      : Score(-500);
  }

  if (kingFile == FILE_D || kingFile == FILE_E) {
    return Score(-250);
  }

  if (kingFile == FILE_F) {
    return Score(-100);
  }

  Rank upperRank = kingRank + (isWhite ? 1 : -1);
  List<Piece*, 6> defendingPieces;

  defendingPieces.push(this->board[gameUtils::squares[kingRank][kingFile - 1]]);
  defendingPieces.push(this->board[gameUtils::squares[kingRank][kingFile + 1]]);
  defendingPieces.push(this->board[gameUtils::squares[upperRank][kingFile - 1]]);
  defendingPieces.push(this->board[gameUtils::squares[upperRank][kingFile]]);
  defendingPieces.push(this->board[gameUtils::squares[upperRank][kingFile + 1]]);

  int score = kingRank == gameUtils::ranks[color][RANK_1] && kingFile == FILE_C ? 0 : 100;

  for (auto &piece : defendingPieces) {
    if (piece->color == color) {
      score += (
        gameUtils::squareRanks[piece->square] == upperRank
          ? piece->type == PAWN
            ? 100
            : 50
          : piece->type == PAWN
            ? 50
            : 25
      );
    }
  }

  return Score(score);
}

Score Bot::evalPawns(Color color, PositionInfo *positionInfo) {
  bool isWhite = color == WHITE;
  List<Piece*, 64>* pawns = &positionInfo->pawns[color];
  FileInfo* pawnFiles = positionInfo->pawnFiles[color];
  FileInfo* opponentPawnFiles = positionInfo->pawnFiles[~color];
  int score = 0;
  bool islandState = false;
  int islandsCount = 0;

  for (File file = FILE_A; file < 8; ++file) {
    FileInfo* fileInfo = &pawnFiles[file];

    if (fileInfo->min == NO_RANK) {
      islandState = false;
    } else {
      if (fileInfo->max != fileInfo->min) {
        score -= 300;
      }

      if (!islandState) {
        islandsCount++;
      }

      islandState = true;
    }
  }

  for (auto &pawn : *pawns) {
    File file = gameUtils::squareFiles[pawn->square];
    Rank rank = gameUtils::squareRanks[pawn->square];
    FileInfo* leftInfo = file == FILE_A ? nullptr : &opponentPawnFiles[file - 1];
    FileInfo* fileInfo = &opponentPawnFiles[file];
    FileInfo* rightInfo = file == FILE_H ? nullptr : &opponentPawnFiles[file + 1];

    score += 2 * gameUtils::allPieceSquareTables[color][PAWN][0][pawn->square];

    if (
      (leftInfo == nullptr || leftInfo->min == NO_RANK || (isWhite ? leftInfo->max <= rank : leftInfo->min >= rank))
      && (fileInfo->min == NO_RANK || (isWhite ? fileInfo->max <= rank : fileInfo->min >= rank))
      && (rightInfo == nullptr || rightInfo->min == NO_RANK || (isWhite ? rightInfo->max <= rank : rightInfo->min >= rank))
    ) {
      score += 500 + (
        rank == gameUtils::ranks[color][RANK_7]
          ? 1000
          : rank == gameUtils::ranks[color][RANK_6]
            ? 500
            : rank == gameUtils::ranks[color][RANK_5]
              ? 200
              : 0
      );
    }
  }

  return Score(score + (islandsCount - 1) * -200);
}

Score Bot::evalPieces(Color color, PositionInfo *positionInfo) {
  bool isEndgame = this->isEndgame();
  Piece** pieces = this->pieces[color];
  int pieceCount = this->pieceCounts[color];
  Color opponentColor = ~color;
  int hangingPiecesCoeff = this->turn == color ? 100 : 1000;
  int bishopsCount = 0;
  int score = 0;

  for (int i = 0; i < pieceCount; i++) {
    Piece* piece = pieces[i];
    Rank rank = gameUtils::squareRanks[piece->square];
    File file = gameUtils::squareFiles[piece->square];

    // piece-square tables
    score += 10 * gameUtils::allPieceSquareTables[color][piece->type][isEndgame][piece->square];

    // development
    score += (
      (
        (piece->type == KNIGHT || piece->type == BISHOP)
        && rank == gameUtils::ranks[color][RANK_1]
      )
        ? -300
        : (
          piece->type == PAWN
          && (file == FILE_D || file == FILE_E)
          && rank == gameUtils::ranks[color][RANK_2]
        )
          ? this->board[piece->square + (color == WHITE ? NORTH : SOUTH)] == this->noPiece
            ? -300
            : -1000
          : 0
    );

    // eval bishop pair
    if (piece->type == BISHOP) {
      bishopsCount++;
    }

    // rooks on open/semi-open files
    if (piece->type == ROOK && positionInfo->pawnFiles[color][file].min == NO_RANK) {
      score += 100 + (positionInfo->pawnFiles[opponentColor][file].min == NO_RANK ? 100 : 0);
    }

    // control
    if (piece->type != KING || isEndgame) {
      Bitboard attacks = this->getAttacks(piece);
      Bitboard* squareRings = gameUtils::squareRings[this->kings[opponentColor]->square];

      if (isEndgame) {
        score += 20 * __builtin_popcountll(attacks);
      } else {
        ControlBitboards* controlBitboards = &gameUtils::controlBitboards[color];

        score += (
          50 * __builtin_popcountll(attacks & controlBitboards->center)
          + 25 * __builtin_popcountll(attacks & controlBitboards->aroundCenter)
          + 20 * __builtin_popcountll(attacks & controlBitboards->opponent)
          + 10 * __builtin_popcountll(attacks & controlBitboards->unimportant)
        );
      }

      score += (
        150 * __builtin_popcountll(attacks & squareRings[0])
        + 50 * __builtin_popcountll(attacks & squareRings[1])
      );
    }

    // hanging pieces
    if (piece->type != KING) {
      Bitboard attackingPieces = this->getAttacksTo(piece->square, opponentColor);

      if (attackingPieces) {
        Bitboard defendingPieces = this->getAttacksTo(piece->square, color);

        if (defendingPieces) {
          PieceType pieceToTake = piece->type;
          bool state = false;
          List<int, 32> lossStates;

          lossStates.push(0);

          while (true) {
            Bitboard* pieces = state ? &defendingPieces : &attackingPieces;

            if (!*pieces) {
              break;
            }

            lossStates.push(state ? gameUtils::piecesWorth[pieceToTake] : -gameUtils::piecesWorth[pieceToTake]);

            pieceToTake = this->getLeastWorthAttacker(pieces, state ? color : opponentColor);
            state = !state;
          }

          lossStates.push(lossStates[lossStates.size() - 1]);

          int maxWin = -10000;
          int maxWinIndex = 0;
          int minLoss = 10000;
          int minLossIndex = 0;
          int loss = 0;

          for (size_t i = 0; i < lossStates.size(); i++) {
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
          score -= gameUtils::piecesWorth[piece->type] * hangingPiecesCoeff;
        }
      }
    }
  }

  return Score(score + this->material[color] * 1000 + (bishopsCount >= 2 ? 500 : 0));
}

Score Bot::executeNegamax(int depth, Score alpha, Score beta) {
  if (depth == SEARCH_DEPTH) {
    auto currentScore = this->evaluatedPositions.find(this->positionKey);
    bool found = currentScore != this->evaluatedPositions.end();
    Score score = found ? currentScore->second : this->eval(depth);

    if (!found) {
      this->evaluatedPositions[this->positionKey] = score;
    }

    this->nodes++;

    return score;
  }

  if (this->isDraw()) {
    return SCORE_EQUAL;
  }

  List<Move, 256> legalMoves(this->getAllLegalMoves(legalMoves.list));

  if (legalMoves.empty()) {
    return this->checkers ? this->getMateScore(depth) : SCORE_EQUAL;
  }

  bool isEndgame = this->isEndgame();
  List<MoveWithScore, 256> legalMovesWithScores;

  legalMovesWithScores.last += legalMoves.size();

  for (size_t i = 0; i < legalMoves.size(); i++) {
    legalMovesWithScores[i].move = legalMoves[i];
    legalMovesWithScores[i].score = this->moveScore(legalMoves[i], isEndgame);
  }

  sort(
    legalMovesWithScores.list,
    legalMovesWithScores.last,
    [](auto &move1, auto &move2) { return move2.score < move1.score;}
  );

  for (size_t i = 0; i < legalMovesWithScores.size(); i++) {
    MoveInfo moveInfo = this->performMove(legalMovesWithScores[i].move);
    Score score = -this->executeNegamax(depth + 1, -beta, -alpha);

    this->revertMove(&moveInfo);

    if (score >= beta) {
      if (i == 0) {
        this->firstCutNodesCount++;
      }

      this->cutNodesCount++;

      return beta;
    }

    if (score > alpha) {
      alpha = score;
    }
  }

  return alpha;
}

PieceType Bot::getLeastWorthAttacker(Bitboard* attackers, Color color) {
  for (PieceType pieceType = PAWN; pieceType >= KING; --pieceType) {
    Bitboard pieceTypeAttackers = *attackers & this->bitboards[color][pieceType];

    if (pieceTypeAttackers) {
      Square square = gameUtils::getBitboardSquare(pieceTypeAttackers);
      *attackers ^= square;

      return this->board[square]->type;
    }
  }

  return NO_PIECE;
}

Score Bot::getMateScore(int depth) {
  return Score(-(MATE_SCORE - depth));
}

Move Bot::getOptimalMove() {
  List<Move, 256> legalMoves(this->getAllLegalMoves(legalMoves.list));

  if (legalMoves.empty()) {
    return NO_MOVE;
  }

  if (legalMoves.size() == 1) {
    cout << "only move " << utils::formatString(gameUtils::moveToUci(legalMoves[0]), {"red", "bold"}) << endl;

    return legalMoves[0];
  }

  List<MoveWithScore, 256> legalMovesWithScores;

  legalMovesWithScores.last += legalMoves.last - legalMoves.list;

  for (size_t i = 0; i < legalMoves.size(); i++) {
    MoveInfo moveInfo = this->performMove(legalMoves[i]);
    Score score = -this->eval(1);

    this->revertMove(&moveInfo);

    legalMovesWithScores[i].move = legalMoves[i];
    legalMovesWithScores[i].score = score;
  }

  sort(
    legalMovesWithScores.list, legalMovesWithScores.last,
    [](auto &move1, auto &move2) { return move2.score < move1.score; }
  );

  List<MoveWithScore, 256> optimalMoves;

  for (auto &legalMoves : legalMovesWithScores) {
    MoveInfo moveInfo = this->performMove(legalMoves.move);
    Score maxScore = -INFINITE_SCORE;

    for (auto &optimalMove : optimalMoves) {
      if (optimalMove.score > maxScore) {
        maxScore = optimalMove.score;
      }
    }

    Score score = -this->executeNegamax(
      1,
      -INFINITE_SCORE,
      -(maxScore - OPTIMAL_MOVE_THRESHOLD)
    );

    MoveWithScore* last = optimalMoves.last++;

    last->move = legalMoves.move;
    last->score = score;

    this->revertMove(&moveInfo);
  }

  sort(
    optimalMoves.list, optimalMoves.last,
    [](auto &move1, auto &move2) { return move2.score < move1.score; }
  );

  double threshold = this->isMateScore(optimalMoves[0].score)
    ? 0.5
    : OPTIMAL_MOVE_THRESHOLD;

  for (size_t i = optimalMoves.size() - 1; i > 0; i--) {
    if (optimalMoves[0].score - optimalMoves[i].score >= threshold) {
      optimalMoves.pop();
    } else {
      break;
    }
  }

  std::default_random_engine generator(clock());
  std::uniform_int_distribution<int> distribution(0, optimalMoves.size() - 1);
  MoveWithScore selectedMove = optimalMoves[distribution(generator)];

  cout << "optimal moves: ";

  for (size_t i = 0; i < optimalMoves.size(); i++) {
    MoveWithScore optimalMove = optimalMoves[i];

    cout
      << utils::formatString(gameUtils::moveToUci(optimalMove.move), {"red", "bold"})
      << " (" << utils::formatString(this->getScore(optimalMove.score), {"green", "bold"}) << ")";

    if (i != optimalMoves.size() - 1) {
      cout << ", ";
    }
  }

  cout << endl;

  cout
    << "picked move " << utils::formatString(gameUtils::moveToUci(selectedMove.move), {"red", "bold"})
    << " (" << utils::formatString(this->getScore(selectedMove.score), {"green", "bold"}) << ")" << endl;

  return selectedMove.move;
}

string Bot::getScore(Score score) {
  if (this->isMateScore(score)) {
    return string("#") + (score < 0 ? "-" : "") + to_string((int)ceil((MATE_SCORE - abs(score)) / 2.0));
  }

  string result = to_string(score / 1000.0);

  return result.substr(0, result.length() - 3);
}

bool Bot::isMateScore(Score score) {
  return abs(score) > 1000000;
}

Move Bot::makeMove() {
  if (this->color != this->turn || this->isDraw() || this->isNoMoves()) {
    return NO_MOVE;
  }

  this->nodes = 0;
  this->cutNodesCount = 0;
  this->firstCutNodesCount = 0;

  this->evaluatedPositions.clear();
  this->evaluatedPawnPositions[WHITE].clear();
  this->evaluatedPawnPositions[BLACK].clear();

  clock_t timestamp = clock();
  Move move = this->getOptimalMove();
  double moveTook = (clock() - timestamp) * 1000.0 / CLOCKS_PER_SEC;

  cout << "move took " << utils::formatString(to_string((int)round(moveTook)), {"red", "bold"}) << " ms" << endl;
  cout << "nodes: " << utils::formatString(to_string(this->nodes), {"blue", "bold"}) << endl;
  cout << "move ordering quality: " << utils::formatString(
    this->cutNodesCount == 0
      ? "NaN"
      : to_string((int)round((1.0 * this->firstCutNodesCount / this->cutNodesCount) * 100)),
    {"green", "bold"}
  ) << "%" << endl;
  cout << "performance: " << utils::formatString(
    moveTook == 0
      ? "NaN"
      : to_string((int)round(this->nodes / moveTook)),
    {"green", "bold"}
  ) << " kn/s" << endl;
  cout << string(80, '-') << endl;

  return move;
}

Score Bot::moveScore(Move move, bool isEndgame) {
  Square from = gameUtils::getMoveFrom(move);
  Square to = gameUtils::getMoveTo(move);
  PieceType promotion = gameUtils::getMovePromotion(move);
  int score = 0;

  if (promotion != NO_PIECE) {
    score += 1000 * gameUtils::piecesWorth[promotion];
  }

  Color opponentColor = ~this->turn;
  Piece* piece = this->board[from];
  Piece* toPiece = this->board[to];

  if (toPiece != this->noPiece) {
    score += 1000 * gameUtils::piecesWorth[toPiece->type];
  }

  if (piece->type < PAWN && piece->type > KING) {
    score += (
      (this->isControlledByOpponentPawn(from, opponentColor) ? 1000 : 0)
      + (this->isControlledByOpponentPawn(to, opponentColor) ? -2000 : 0)
    );
  }

  if (piece->type == PAWN) {
    vector<Square>* targets = gameUtils::pawnAttacks[this->turn][to];
    Piece* leftTarget = targets->size() > 0 ? this->board[targets->at(0)] : this->noPiece;
    Piece* rightTarget = targets->size() > 1 ? this->board[targets->at(1)] : this->noPiece;

    if (leftTarget->color == opponentColor && leftTarget->type < PAWN) {
      score += leftTarget->type == KING
        ? 100
        : gameUtils::piecesWorth[leftTarget->type] * 100;
    }

    if (rightTarget->color == opponentColor && rightTarget->type < PAWN) {
      score += rightTarget->type == KING
        ? 100
        : gameUtils::piecesWorth[rightTarget->type] * 100;
    }
  } else if (piece->type == KNIGHT) {
    for (auto &square : *gameUtils::knightAttacks[to]) {
      Piece* pieceInSquare = this->board[square];

      if (pieceInSquare->color == opponentColor && pieceInSquare->type < BISHOP) {
        score += pieceInSquare->type == KING
          ? 100
          : gameUtils::piecesWorth[pieceInSquare->type] * 50;
      }
    }
  }

  score += 10 * (
    gameUtils::allPieceSquareTables[piece->color][piece->type][isEndgame][to]
    - gameUtils::allPieceSquareTables[piece->color][piece->type][isEndgame][from]
  );

  return Score(score);
}
