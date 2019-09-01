import Game from './Game';

const initialFen = Game.standardFen;
const DEPTH = 4;
const realMap = {};
const debug = false;

for (let i = debug ? DEPTH : 1; i <= DEPTH; i++) {
  perft(i, debug);
}

function perft(depth: number, useMap: boolean) {
  const timestamp = process.hrtime.bigint();
  const game = new Game(initialFen);
  const calculateNodes = (depth: number): number => {
    if (depth === 0) {
      return 1;
    }

    let nodes = 0;
    const legalMoves = game.getAllLegalMoves();

    for (let i = 0, l = legalMoves.length; i < l; i++) {
      const move = game.performMove(legalMoves[i]);
      const moveNodes = calculateNodes(depth - 1);

      nodes += moveNodes;

      game.revertMove(move);

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
  const time = Number(process.hrtime.bigint() - timestamp) / 1e6;

  console.log('depth:', depth);
  console.log('nodes:', nodes);
  console.log('time:', `${time} ms`);
  console.log('perft:', `${nodes / time} kn/s`);
}
