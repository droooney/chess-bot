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
  if (this->isCheck && this->isNoMoves()) {
    return this->getMateScore(depth);
  }

  if (this->isDraw() || (!this->isCheck && this->isNoMoves())) {
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

      List<Square, 32>* attacks = &positionInfo.attacks[color][i];

      attacks->last = this->getAttacks(attacks->list, piece);

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

      for (auto &square : *attacks) {
        if (this->board[square] != this->noPiece) {
          positionInfo.squareAttacks[color][square].push(piece->type);
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

  if (isWhite ? kingRank > gameUtils::rank4(color) : kingRank < gameUtils::rank4(color)) {
    return Score(-3000);
  }

  if (kingRank == gameUtils::rank4(color)) {
    return Score(-2000);
  }

  if (kingRank == gameUtils::rank3(color)) {
    return Score(-1000);
  }

  if (
    kingRank == gameUtils::rank2(color)
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

  int score = kingRank == gameUtils::rank1(color) && kingFile == FILE_C ? 0 : 100;

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
        rank == gameUtils::rank7(color)
          ? 1000
          : rank == gameUtils::rank6(color)
            ? 500
            : rank == gameUtils::rank5(color)
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
  bool isWhite = color == WHITE;
  int* distances = gameUtils::distances[this->kings[opponentColor]->square];
  List<PieceType, 32>* defendedSquares = positionInfo->squareAttacks[color];
  List<PieceType, 32>* attackedSquares = positionInfo->squareAttacks[opponentColor];
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
        && rank == gameUtils::rank1(color)
      )
        ? -300
        : (
          piece->type == PAWN
          && (file == FILE_D || file == FILE_E)
          && rank == gameUtils::rank2(color)
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
      for (auto &square : positionInfo->attacks[color][i]) {
        Rank rank = gameUtils::squareRanks[square];
        File file = gameUtils::squareFiles[square];
        int distanceToOpponentKing = distances[square];

        score += (
          isEndgame || (isWhite ? rank < gameUtils::rank4(color) : rank > gameUtils::rank4(color))
            ? 10
            : rank == gameUtils::rank4(color) || rank == gameUtils::rank5(color) || rank == gameUtils::rank6(color)
              ? file == FILE_D || file == FILE_E
                ? 50
                : file == FILE_C || file == FILE_F
                  ? 25
                  : 10
              : 20
        ) + (
          distanceToOpponentKing > 2
            ? 0
            : distanceToOpponentKing == 2
              ? 50
              : 150
        );
      }
    }

    // hanging pieces
    if (piece->type != KING) {
      List<PieceType, 32>* attackingPieces = &attackedSquares[piece->square];

      if (!attackingPieces->empty()) {
        List<PieceType, 32>* defendingPieces = &defendedSquares[piece->square];

        if (defendingPieces->empty()) {
          score -= gameUtils::piecesWorth[piece->type] * hangingPiecesCoeff;
        } else {
          sort(
            defendingPieces->list,
            defendingPieces->last,
            [](auto type1, auto type2) { return type1 < type2; }
          );
          sort(
            attackingPieces->list,
            attackingPieces->last,
            [](auto type1, auto type2) { return type1 < type2; }
          );

          PieceType pieceToTake = piece->type;
          bool state = false;
          List<int, 32> lossStates;

          lossStates.push(0);

          while (true) {
            if (state) {
              if (defendingPieces->empty()) {
                break;
              }

              PieceType lessValuableDefender = defendingPieces->pop();

              lossStates.push(gameUtils::piecesWorth[pieceToTake]);

              pieceToTake = lessValuableDefender;
              state = false;
            } else {
              if (attackingPieces->empty()) {
                break;
              }

              PieceType lessValuableAttacker = attackingPieces->pop();

              lossStates.push(-gameUtils::piecesWorth[pieceToTake]);

              pieceToTake = lessValuableAttacker;
              state = true;
            }
          }

          lossStates.push(lossStates[lossStates.size() - 1]);

          int maxWin = -10000;
          int maxWinIndex = 0;
          int minLoss = 10000;
          int minLossIndex = 0;
          int loss = 0;

          for (int i = 0; i < lossStates.size(); i++) {
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

  List<Move, 256> legalMoves;

  legalMoves.last = this->getAllLegalMoves(legalMoves.list);

  if (legalMoves.empty()) {
    return this->isCheck ? this->getMateScore(depth) : SCORE_EQUAL;
  }

  bool isEndgame = this->isEndgame();
  List<MoveWithScore, 256> legalMovesWithScores;

  legalMovesWithScores.last += legalMoves.size();

  for (int i = 0; i < legalMoves.size(); i++) {
    legalMovesWithScores[i].move = legalMoves[i];
    legalMovesWithScores[i].score = this->moveScore(legalMoves[i], isEndgame);
  }

  sort(
    legalMovesWithScores.list,
    legalMovesWithScores.last,
    [](auto &move1, auto &move2) { return move2.score < move1.score;}
  );

  for (int i = 0; i < legalMovesWithScores.size(); i++) {
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

Score Bot::getMateScore(int depth) {
  return Score(-(MATE_SCORE - depth));
}

Move Bot::getOptimalMove() {
  List<Move, 256> legalMoves;

  legalMoves.last = this->getAllLegalMoves(legalMoves.list);

  if (legalMoves.empty()) {
    return NO_MOVE;
  }

  if (legalMoves.size() == 1) {
    cout << "only move " << utils::formatString(gameUtils::moveToUci(legalMoves[0]), {"red", "bold"}) << endl;

    return legalMoves[0];
  }

  List<MoveWithScore, 256> legalMovesWithScores;

  legalMovesWithScores.last += legalMoves.last - legalMoves.list;

  for (int i = 0; i < legalMoves.size(); i++) {
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

  for (auto &[move, _] : legalMovesWithScores) {
    MoveInfo moveInfo = this->performMove(move);
    Score score = -this->executeNegamax(
      1,
      -INFINITE_SCORE,
      -(optimalMoves.empty() ? -INFINITE_SCORE : optimalMoves[0].score - OPTIMAL_MOVE_THRESHOLD)
    );
    size_t index = optimalMoves.size();

    for (size_t i = 0; i < optimalMoves.size(); i++) {
      if (score > optimalMoves[i].score) {
        index = i;

        break;
      }
    }

    optimalMoves.insert({ .move = move, .score = score }, index);

    this->revertMove(&moveInfo);
  }

  double threshold = this->isMateScore(optimalMoves[0].score)
    ? 0.5
    : OPTIMAL_MOVE_THRESHOLD;

  for (int i = optimalMoves.size() - 1; i > 0; i--) {
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

  for (int i = 0; i < optimalMoves.size(); i++) {
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
    return string("#") + (score < 0 ? "-" : "") + to_string(ceil((MATE_SCORE - abs(score)) / 2.0));
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
