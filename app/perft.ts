// https://www.chessprogramming.org/Perft_Results

import 'colors';

import Game from './Game';

const initialFen = Game.standardFen;
const DEPTH = 4;
const realMap = {};
const mm = {};
const checkPosition = false;
const debug = false;
const timestamp = Date.now();
const tests = [
  {
    initialFen: Game.standardFen,
    nodeCounts: [20, 400, 8_902, 197_281, 4_865_609]
  },
  {
    initialFen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    nodeCounts: [48, 2_039, 97_862, 4_085_603]
  },
  {
    initialFen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    nodeCounts: [14, 191, 2_812, 43_238, 674_624, 11_030_083]
  },
  {
    initialFen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    nodeCounts: [6, 264, 9_467, 422_333, 15_833_292]
  },
  {
    initialFen: 'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1',
    nodeCounts: [6, 264, 9_467, 422_333, 15_833_292]
  },
  {
    initialFen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    nodeCounts: [44, 1_486, 62_379, 2_103_487]
  },
  {
    initialFen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    nodeCounts: [46, 2_079, 89_890, 3_894_594]
  },
  {
    initialFen: 'rnbq1k1r/pp1P1ppp/2p5/8/2B4b/P7/1PP1NnPP/RNBQK2R w KQ - 1 9',
    nodeCounts: [42, 1_432, 51_677, 1_747_286]
  },
  {
    initialFen: '3b4/2P5/8/8/8/2n5/8/2k1K2R w K - 0 1',
    nodeCounts: [20, 268, 5_464, 69_692, 1_490_361]
  },
  {
    initialFen: '6b1/5P2/8/8/3n1k2/8/8/4K2R w K - 0 1',
    nodeCounts: [22, 325, 6_839, 96_270, 2_148_378]
  },
  {
    initialFen: '8/p3p3/1b1k4/3P1p2/8/8/1n3B2/2KR4 w - - 0 1',
    nodeCounts: [19, 326, 5_853, 99_157, 1_905_025]
  },
  {
    initialFen: '8/p3p3/3k4/3P1p2/8/8/5B2/K7 w - - 0 1',
    nodeCounts: [12, 99, 1_262, 11_208, 150_846, 1_366_710]
  }
];
// let calculateLegalMovesTime = 0;
// let performMoveTime = 0;
// let revertMoveTime = 0;

if (checkPosition) {
  for (let i = debug ? DEPTH : 1; i <= DEPTH; i++) {
    perft(initialFen, i, debug);
  }
} else {
  tests.forEach(({ initialFen, nodeCounts }) => {
    for (let i = 1; i <= nodeCounts.length; i++) {
      const nodes = perft(initialFen, i, false);
      const expected = nodeCounts[i - 1];

      if (nodes !== expected) {
        console.log(`invalid nodes count. fen: ${initialFen.blue.bold}, expected ${`${expected}`.green.bold}, got ${`${nodes}`.red.bold}`);

        process.exit(1);
      }
    }
  });
}

console.log(`test took ${Date.now() - timestamp} ms`);
// console.log(`calculateLegalMoves took ${calculateLegalMovesTime} ms`);
// console.log(`performMove took ${performMoveTime} ms`);
// console.log(`revertMove took ${revertMoveTime} ms`);

function perft(initialFen: string, depth: number, useMap: boolean): number {
  const timestamp = Date.now();
  const game = new Game(initialFen);
  const calculateNodes = (depth: number): number => {
    if (depth === 0) {
      return 1;
    }

    let nodes = 0;
    // const timestamp = Date.now();
    const legalMoves = game.getAllLegalMoves();

    // calculateLegalMovesTime += Date.now() - timestamp;

    for (let i = 0, l = legalMoves.length; i < l; i++) {
      // const timestamp = Date.now();
      const move = game.performMove(legalMoves[i]);

      // performMoveTime += Date.now() - timestamp;

      const moveNodes = calculateNodes(depth - 1);

      nodes += moveNodes;

      // const timestamp2 = Date.now();

      game.revertMove(move);

      // revertMoveTime += Date.now() - timestamp2;

      if (useMap && depth === DEPTH) {
        const uci = Game.moveToUci(legalMoves[i]);

        if (!(uci in realMap)) {
          console.log(`${uci} is not a real move!`);
        } else {
          if (realMap[uci as keyof typeof realMap] !== moveNodes) {
            console.log(`${uci} has ${moveNodes} nodes, real one has ${realMap[uci as keyof typeof realMap]}`);
          }

          delete realMap[uci as keyof typeof realMap];
        }
      }
    }

    if (useMap && depth === DEPTH) {
      if (Object.keys(realMap).length !== 0) {
        console.log('no moves were generated for', Object.keys(realMap));
      }
    }

    return nodes;
  };

  const nodes = calculateNodes(depth);
  const time = Date.now() - timestamp;

  if (false) {
    game.performMove(Game.uciToMove('g4h5'));
    console.log(game.getAllLegalMoves().map(Game.moveToUci).sort().join(' '));
    console.log(Object.keys(mm).sort().join(' '));
  }

  console.log('fen:', initialFen);
  console.log('depth:', depth);
  console.log('nodes:', nodes);
  console.log('time:', `${time} ms`);
  console.log('perft:', `${Math.round(nodes / time)} kn/s`);

  return nodes;
}
