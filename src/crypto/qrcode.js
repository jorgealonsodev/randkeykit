/**
 * QR Code Generator — Minimal Pure-JS Implementation
 *
 * Based on the QR code specification (ISO/IEC 18004).
 * Supports byte-mode encoding, error correction level L,
 * and versions 1–10 (up to ~271 bytes at L level).
 *
 * Produces inline SVG output suitable for embedding in HTML.
 *
 * Inspired by Nayuki's QR Code generator (MIT License).
 * @license MIT
 *
 * Copyright (c) 2024 Project Nayuki (original algorithm reference)
 * Adapted for RandKeyKit — minimal byte-mode + SVG output only.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 */

// --- Error correction level L tables ---

/** Number of error correction codewords per block for each version (level L) */
const EC_CODEWORDS_PER_BLOCK_L = [
  -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, // v1-v10
];

/** Number of error correction blocks for each version (level L) */
const NUM_EC_BLOCKS_L = [
  -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, // v1-v10
];

/** Total data codewords capacity for each version (level L) */
const DATA_CODEWORDS_CAPACITY_L = [
  -1, 19, 34, 55, 80, 108, 136, 156, 194, 232, 274, // v1-v10
];

// --- Reed-Solomon error correction ---

const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

// Initialize GF(256) tables with primitive polynomial 0x11d
(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) {
    GF256_EXP[i] = GF256_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF256_EXP[GF256_LOG[a] + GF256_LOG[b]];
}

/**
 * Computes Reed-Solomon error correction codewords.
 * @param {number[]} data - Data codewords
 * @param {number} ecCount - Number of EC codewords to generate
 * @returns {number[]} Error correction codewords
 */
function computeReedSolomon(data, ecCount) {
  // Build generator polynomial
  let generator = [1];
  for (let i = 0; i < ecCount; i++) {
    const newGen = new Array(generator.length + 1).fill(0);
    for (let j = 0; j < generator.length; j++) {
      newGen[j] ^= generator[j];
      newGen[j + 1] ^= gfMul(generator[j], GF256_EXP[i]);
    }
    generator = newGen;
  }

  // Polynomial division
  const result = new Array(ecCount).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.shift();
    result.push(0);
    for (let j = 0; j < ecCount; j++) {
      result[j] ^= gfMul(factor, generator[j + 1]);
    }
  }

  return result;
}

// --- QR Matrix construction ---

const FINDER_PATTERN = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
];

/** Alignment pattern center positions for versions 2-10 */
const ALIGNMENT_POSITIONS = [
  [], // v1 (none)
  [6, 18], // v2
  [6, 22], // v3
  [6, 26], // v4
  [6, 30], // v5
  [6, 34], // v6
  [6, 22, 38], // v7
  [6, 24, 42], // v8
  [6, 26, 46], // v9
  [6, 28, 50], // v10
];

/**
 * Selects the minimum QR version that can hold the data.
 * @param {number} dataLength - Number of data bytes
 * @returns {number} QR version (1-10)
 */
function selectVersion(dataLength) {
  // Byte mode: 4-bit mode indicator + character count indicator + data
  for (let version = 1; version <= 10; version++) {
    const ccBits = version <= 9 ? 8 : 16;
    const totalBits = 4 + ccBits + dataLength * 8;
    const capacityBits = DATA_CODEWORDS_CAPACITY_L[version] * 8;
    if (totalBits <= capacityBits) return version;
  }
  throw new Error("Data too long for QR version 1-10 at level L");
}

/**
 * Encodes data bytes into QR codewords with error correction.
 * @param {Uint8Array} data - Raw data bytes
 * @param {number} version - QR version
 * @returns {number[]} All codewords (data + EC, interleaved)
 */
function encodeData(data, version) {
  const dataCapacity = DATA_CODEWORDS_CAPACITY_L[version];
  const ccBits = version <= 9 ? 8 : 16;

  // Build bit stream
  let bits = "";
  bits += "0100"; // Byte mode indicator
  bits += data.length.toString(2).padStart(ccBits, "0"); // Character count
  for (const byte of data) {
    bits += byte.toString(2).padStart(8, "0");
  }
  // Terminator (up to 4 zeros)
  const terminatorLen = Math.min(4, dataCapacity * 8 - bits.length);
  bits += "0".repeat(terminatorLen);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits += "0";

  // Convert to codewords
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(parseInt(bits.slice(i, i + 8), 2));
  }
  // Pad codewords
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < dataCapacity) {
    codewords.push(padBytes[padIndex % 2]);
    padIndex++;
  }

  // Split into blocks and compute EC
  const numBlocks = NUM_EC_BLOCKS_L[version];
  const ecPerBlock = EC_CODEWORDS_PER_BLOCK_L[version];
  const totalDataCodewords = dataCapacity;
  const shortBlockLen = Math.floor(totalDataCodewords / numBlocks);
  const numLongBlocks = totalDataCodewords % numBlocks;
  const numShortBlocks = numBlocks - numLongBlocks;

  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;

  for (let i = 0; i < numBlocks; i++) {
    const blockLen = i < numShortBlocks ? shortBlockLen : shortBlockLen + 1;
    const block = codewords.slice(offset, offset + blockLen);
    offset += blockLen;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomon(block, ecPerBlock));
  }

  // Interleave data blocks
  const result = [];
  const maxDataLen = shortBlockLen + (numLongBlocks > 0 ? 1 : 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  // Interleave EC blocks
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) {
      result.push(block[i]);
    }
  }

  return result;
}

/**
 * Creates the QR matrix with function patterns.
 * @param {number} version - QR version
 * @returns {{ matrix: number[][], reserved: boolean[][] }}
 */
function createFunctionPatterns(version) {
  const size = version * 4 + 17;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(-1));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  function setModule(row, col, value) {
    if (row >= 0 && row < size && col >= 0 && col < size) {
      matrix[row][col] = value;
      reserved[row][col] = true;
    }
  }

  // Finder patterns (top-left, top-right, bottom-left)
  const finderPositions = [[0, 0], [0, size - 7], [size - 7, 0]];
  for (const [startRow, startCol] of finderPositions) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        setModule(startRow + r, startCol + c, FINDER_PATTERN[r][c]);
      }
    }
  }

  // Separators (white border around finders)
  for (let i = 0; i < 8; i++) {
    // Top-left
    setModule(7, i, 0);
    setModule(i, 7, 0);
    // Top-right
    setModule(7, size - 8 + i, 0);
    setModule(i, size - 8, 0);
    // Bottom-left
    setModule(size - 8, i, 0);
    setModule(size - 8 + i, 7, 0);
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0 ? 1 : 0);
    setModule(i, 6, i % 2 === 0 ? 1 : 0);
  }

  // Alignment patterns
  if (version >= 2) {
    const positions = ALIGNMENT_POSITIONS[version - 1];
    for (const row of positions) {
      for (const col of positions) {
        // Skip if overlaps with finder patterns
        if (reserved[row][col]) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const value = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
            setModule(row + r, col + c, value);
          }
        }
      }
    }
  }

  // Dark module
  setModule(size - 8, 8, 1);

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) { reserved[8][i] = true; matrix[8][i] = -1; }
    if (!reserved[i][8]) { reserved[i][8] = true; matrix[i][8] = -1; }
  }
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][size - 1 - i]) { reserved[8][size - 1 - i] = true; matrix[8][size - 1 - i] = -1; }
    if (!reserved[size - 1 - i][8]) { reserved[size - 1 - i][8] = true; matrix[size - 1 - i][8] = -1; }
  }

  // Reserve version info areas (versions 7+)
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = true;
        reserved[size - 11 + j][i] = true;
      }
    }
  }

  return { matrix, reserved };
}

/**
 * Places data bits into the matrix.
 */
function placeData(matrix, reserved, codewords) {
  const size = matrix.length;
  let bitIndex = 0;
  const allBits = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) {
      allBits.push((cw >> i) & 1);
    }
  }

  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing column
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (let dc = 0; dc <= 1; dc++) {
        const c = col - dc;
        if (c < 0 || reserved[row][c]) continue;
        matrix[row][c] = bitIndex < allBits.length ? allBits[bitIndex] : 0;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}

/**
 * Applies a mask pattern and returns the masked matrix.
 */
function applyMask(matrix, reserved, maskId) {
  const size = matrix.length;
  const result = matrix.map((row) => [...row]);

  const maskFns = [
    (r, c) => (r + c) % 2 === 0,
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
    (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
  ];

  const maskFn = maskFns[maskId];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && maskFn(r, c)) {
        result[r][c] ^= 1;
      }
    }
  }

  return result;
}

/**
 * Writes format information (EC level L + mask pattern).
 */
function writeFormatInfo(matrix, maskId) {
  const size = matrix.length;
  // Format info for level L: data bits = 0b00 (L) + 3-bit mask
  const data = (0b00 << 3) | maskId;

  // Compute BCH(15,5) error correction
  let formatBits = data << 10;
  const generator = 0b10100110111;
  let temp = formatBits;
  for (let i = 4; i >= 0; i--) {
    if (temp & (1 << (i + 10))) {
      temp ^= generator << i;
    }
  }
  formatBits = (data << 10) | temp;
  formatBits ^= 0b101010000010010; // XOR mask

  // Place format info bits
  const bits = [];
  for (let i = 14; i >= 0; i--) {
    bits.push((formatBits >> i) & 1);
  }

  // Around top-left finder
  const positions1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  // Around other finders
  const positions2 = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];

  for (let i = 0; i < 15; i++) {
    const [r1, c1] = positions1[i];
    const [r2, c2] = positions2[i];
    matrix[r1][c1] = bits[i];
    matrix[r2][c2] = bits[i];
  }
}

/**
 * Evaluates penalty score for a masked matrix (simplified).
 */
function evaluatePenalty(matrix) {
  const size = matrix.length;
  let penalty = 0;

  // Rule 1: Runs of same color (5+ in a row/column)
  for (let r = 0; r < size; r++) {
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += runLen - 2;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += runLen - 2;
  }
  for (let c = 0; c < size; c++) {
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += runLen - 2;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += runLen - 2;
  }

  // Rule 4: Proportion of dark modules
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) darkCount++;
    }
  }
  const total = size * size;
  const percent = (darkCount * 100) / total;
  const deviation = Math.abs(percent - 50);
  penalty += Math.floor(deviation / 5) * 10;

  return penalty;
}

/**
 * Generates a QR code as an SVG string.
 * @param {string} data - Text data to encode
 * @param {Object} [options]
 * @param {number} [options.moduleSize=4] - Pixel size of each module
 * @param {number} [options.margin=2] - Quiet zone in modules
 * @returns {string} SVG markup
 */
export function qrToSvg(data, options = {}) {
  const { moduleSize = 4, margin = 2 } = options;

  // Encode string to bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);

  // Select version
  const version = selectVersion(bytes.length);
  const size = version * 4 + 17;

  // Encode data with EC
  const codewords = encodeData(bytes, version);

  // Create function patterns
  const { matrix, reserved } = createFunctionPatterns(version);

  // Place data
  placeData(matrix, reserved, codewords);

  // Try all 8 masks and pick the best
  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let maskId = 0; maskId < 8; maskId++) {
    const masked = applyMask(matrix, reserved, maskId);
    writeFormatInfo(masked, maskId);
    const penalty = evaluatePenalty(masked);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = maskId;
    }
  }

  // Apply best mask
  const finalMatrix = applyMask(matrix, reserved, bestMask);
  writeFormatInfo(finalMatrix, bestMask);

  // Generate SVG
  const svgSize = (size + margin * 2) * moduleSize;
  const rects = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (finalMatrix[r][c] === 1) {
        const x = (c + margin) * moduleSize;
        const y = (r + margin) * moduleSize;
        rects.push(`<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}" shape-rendering="crispEdges"><rect width="${svgSize}" height="${svgSize}" fill="white"/>${rects.join("")}</svg>`;
}
