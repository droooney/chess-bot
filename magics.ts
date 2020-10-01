const max = 2n ** 64n - 1n;

class Utils {
  static random(): bigint {
    let n = 0n;

    for (let i = 0; i < 64; i++) {
      n = n << 1n | (Math.random() > 0.5 ? 1n : 0n);
    }

    return n;
  }

  static getSlidingPieceMask(square: number, isBishop: boolean, blockers: bigint, pop: boolean): bigint {
    if (isBishop) {
      return (
        Utils.traverseDirection2(square, -1, -1, blockers, pop, false)
        | Utils.traverseDirection2(square, -1, +1, blockers, pop, false)
        | Utils.traverseDirection2(square, +1, -1, blockers, pop, false)
        | Utils.traverseDirection2(square, +1, +1, blockers, pop, false)
      );
    }

    return (
      Utils.traverseDirection2(square, -1, 0, blockers, pop, false)
      | Utils.traverseDirection2(square, +1, 0, blockers, pop, false)
      | Utils.traverseDirection2(square, 0, -1, blockers, pop, false)
      | Utils.traverseDirection2(square, 0, +1, blockers, pop, false)
    );
  }

  static traverseDirection2(square: number, incrementX: number, incrementY: number, blockers: bigint, pop: boolean, stopAfter1: boolean): bigint {
    const squares: number[] = [];
    const traverse = (x: number, y: number) => {
      const nextX = x + incrementX;
      const nextY = y + incrementY;

      if (nextX < 0 || nextX > 7 || nextY < 0 || nextY > 7) {
        return;
      }

      squares.push(nextY << 3 | nextX);

      if (!(blockers & 1n << BigInt(nextY << 3 | nextX)) && !stopAfter1) {
        traverse(nextX, nextY);
      }
    };

    traverse(square & 7, square >> 3);

    if (pop) {
      squares.pop();
    }

    return Utils.squaresToBitboard(squares);
  }

  static generateSlidingAttackBitboards(square: number, isBishop: boolean): bigint {
    const blockersTable: bigint[] = [];
    const actualAttacks: bigint[] = [];
    const attacks: bigint[] = [];
    const mask = Utils.getSlidingPieceMask(square, isBishop, 0n, true);
    const size = 2 ** Utils.getBitsCount(mask);
    const shift = 64n - BigInt(Utils.getBitsCount(mask));
    let blockers = 0n;
    const traverse = (index: bigint) => {
      if (index === 64n) {
        blockersTable.push(blockers);
        actualAttacks.push(Utils.getSlidingPieceMask(square, isBishop, blockers, false));
      } else {
        traverse(index + 1n);

        if (mask & 1n << index) {
          blockers ^= 1n << index;

          traverse(index + 1n);

          blockers ^= 1n << index;
        }
      }
    };

    traverse(0n);

    if (blockersTable.length !== size) {
      throw new Error('wrong');
    }

    let magic: bigint;

    top: while (true) {
      magic = Utils.random() & Utils.random() & Utils.random();

      if (this.getBitsCount(magic * mask & 0xFF00000000000000n) < 6) {
        continue;
      }

      for (let i = 0; i < size; i++) {
        attacks[i] = 0n;
      }

      for (let i = 0; i < size; i++) {
        const ix = (blockersTable[i] * magic & max) >> shift;
        const val = attacks[ix as any];

        if (val) {
          if (val !== actualAttacks[i]) {
            continue top;
          }
        } else {
          attacks[ix as any] = actualAttacks[i];
        }
      }
    }

    return magic;
  }

  static squaresToBitboard(squares: number[]): bigint {
    let bitboard = 0n;

    squares.forEach((square) => {
      bitboard |= 1n << BigInt(square);
    });

    return bitboard;
  }

  static getBitsCount(bitboard: bigint): number {
    let count = 0;

    for (; bitboard; bitboard &= bitboard - 1n) {
      count++;
    }

    return count;
  }
}

const bishops = new Array(64).fill(0).map((_, sq) => (
  Utils.generateSlidingAttackBitboards(sq, true)
));
const rooks = new Array(64).fill(0).map((_, sq) => (
  Utils.generateSlidingAttackBitboards(sq, false)
));

let bishopsString = '{\n';
let rooksString = '{\n';

for (let i = 0; i < 8; i++) {
  bishopsString += '  ';
  rooksString += '  ';

  for (let j = 0; j < 8; j++) {
    bishopsString += `0x${bishops[i << 3 | j].toString(16)}ULL, `;
    rooksString += `0x${rooks[i << 3 | j].toString(16)}ULL, `;
  }

  bishopsString += '\n';
  rooksString += '\n';
}

bishopsString += '}';
rooksString += '}';

console.log(bishopsString);
console.log(rooksString);
