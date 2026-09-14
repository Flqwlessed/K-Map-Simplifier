/* kmap.js — Gray code, K-map layout, cell mapping and group validation */
(function (global) {
  "use strict";

  const VARIABLE_SETS = {
    2: ["A", "B"],
    3: ["A", "B", "C"],
    4: ["A", "B", "C", "D"],
  };

  function grayCode(bits) {
    if (bits === 0) return [0];
    if (bits === 1) return [0, 1];
    const smaller = grayCode(bits - 1);
    return smaller.concat(smaller.slice().reverse().map((v) => v | (1 << (bits - 1))));
  }

  function pad(value, bits) {
    let s = value.toString(2);
    while (s.length < bits) s = "0" + s;
    return s;
  }

  /** Layout description for a given variable count. */
  function layout(nvars) {
    const vars = VARIABLE_SETS[nvars];
    let rowBits;
    if (nvars === 2) rowBits = 1;
    else if (nvars === 3) rowBits = 1;
    else rowBits = 2;
    const colBits = nvars - rowBits;
    const rowVars = vars.slice(0, rowBits);
    const colVars = vars.slice(rowBits);
    const rowCodes = grayCode(rowBits);
    const colCodes = grayCode(colBits);
    return {
      vars,
      rowVars,
      colVars,
      rowBits,
      colBits,
      rowCodes,
      colCodes,
      rowLabels: rowCodes.map((c) => pad(c, rowBits)),
      colLabels: colCodes.map((c) => pad(c, colBits)),
      mintermAt(rowIdx, colIdx) {
        return (rowCodes[rowIdx] << colBits) | colCodes[colIdx];
      },
    };
  }

  /** Position (row, col) of a minterm inside the map. */
  function positionOf(minterm, nvars) {
    const l = layout(nvars);
    const rowCode = minterm >> l.colBits;
    const colCode = minterm & ((1 << l.colBits) - 1);
    return { row: l.rowCodes.indexOf(rowCode), col: l.colCodes.indexOf(colCode) };
  }

  /**
   * Checks whether a set of cells forms a legal K-map group.
   * Returns { valid, reason, pattern }.
   */
  function validateGroup(cells, nvars) {
    const unique = Array.from(new Set(cells)).sort((a, b) => a - b);
    if (!unique.length) return { valid: false, reason: "Select at least one cell." };
    const size = unique.length;
    if ((size & (size - 1)) !== 0) {
      return { valid: false, reason: "K-map groups must contain 1, 2, 4, 8 or 16 cells." };
    }
    const bits = nvars;
    let pattern = "";
    for (let i = 0; i < bits; i++) {
      const bitValues = new Set(unique.map((m) => (m >> (bits - 1 - i)) & 1));
      pattern += bitValues.size === 1 ? String(Array.from(bitValues)[0]) : "-";
    }
    const covered = global.KSimplifier.patternCovers(pattern);
    if (covered.length !== size || covered.some((m) => unique.indexOf(m) === -1)) {
      return { valid: false, reason: "Selected cells do not form a valid Karnaugh Map rectangle." };
    }
    return { valid: true, pattern, cells: unique };
  }

  /** Explanation of one group: which variables stay constant. */
  function explainGroup(pattern, varNames, mode) {
    const constants = [];
    const changing = [];
    pattern.split("").forEach((c, i) => {
      if (c === "-") changing.push(varNames[i]);
      else constants.push({ name: varNames[i], value: Number(c) });
    });
    const term =
      mode === "POS"
        ? global.KSimplifier.patternToPosTerm(pattern, varNames)
        : global.KSimplifier.patternToSopTerm(pattern, varNames);
    return { constants, changing, term };
  }

  /** Distinct translucent colours generated from the golden-angle hue wheel. */
  function groupColor(index, alpha) {
    const hue = (index * 47 + 190) % 360;
    return "hsla(" + hue + ", 72%, 62%, " + (alpha === undefined ? 0.28 : alpha) + ")";
  }

  function binaryOf(minterm, nvars) {
    return pad(minterm, nvars);
  }

  global.KMap = {
    VARIABLE_SETS,
    grayCode,
    layout,
    positionOf,
    validateGroup,
    explainGroup,
    groupColor,
    binaryOf,
  };
})(window);
