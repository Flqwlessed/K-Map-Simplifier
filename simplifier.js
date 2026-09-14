/* simplifier.js — Quine-McCluskey minimisation with exact minimal cover */
(function (global) {
  "use strict";

  function toBinary(value, bits) {
    let s = "";
    for (let i = bits - 1; i >= 0; i--) s += (value >> i) & 1;
    return s;
  }

  function patternCovers(pattern) {
    /* returns every minterm index covered by a pattern like "1-0-" */
    const freeIdx = [];
    pattern.split("").forEach((c, i) => {
      if (c === "-") freeIdx.push(i);
    });
    const bits = pattern.length;
    const base = pattern.split("").map((c) => (c === "1" ? 1 : 0));
    const out = [];
    for (let mask = 0; mask < 1 << freeIdx.length; mask++) {
      const bitsArr = base.slice();
      freeIdx.forEach((posIdx, k) => {
        bitsArr[posIdx] = (mask >> (freeIdx.length - 1 - k)) & 1;
      });
      let value = 0;
      for (let i = 0; i < bits; i++) value = (value << 1) | bitsArr[i];
      out.push(value);
    }
    out.sort((a, b) => a - b);
    return out;
  }

  function combinePatterns(a, b) {
    let diff = -1;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        if (diff !== -1) return null;
        diff = i;
      }
    }
    if (diff === -1) return null;
    return a.substring(0, diff) + "-" + a.substring(diff + 1);
  }

  /** All prime implicants of (ones ∪ dontCares). */
  function primeImplicants(ones, dontCares, bits) {
    const all = Array.from(new Set(ones.concat(dontCares))).sort((a, b) => a - b);
    if (!all.length) return [];
    let current = all.map((m) => toBinary(m, bits));
    const primes = new Set();
    while (current.length) {
      const used = new Array(current.length).fill(false);
      const nextSet = new Set();
      for (let i = 0; i < current.length; i++) {
        for (let j = i + 1; j < current.length; j++) {
          const merged = combinePatterns(current[i], current[j]);
          if (merged) {
            used[i] = true;
            used[j] = true;
            nextSet.add(merged);
          }
        }
      }
      current.forEach((p, i) => {
        if (!used[i]) primes.add(p);
      });
      current = Array.from(nextSet).sort();
    }
    return Array.from(primes).sort();
  }

  function literalCount(pattern) {
    return pattern.split("").filter((c) => c !== "-").length;
  }

  /** Exact minimal cover: branch on the least-covered uncovered minterm. */
  function minimalCover(primes, ones) {
    const required = ones.slice();
    if (!required.length) return [];
    const coverMap = primes.map((p) => new Set(patternCovers(p).filter((m) => required.indexOf(m) !== -1)));

    const memo = new Map();

    function search(uncovered) {
      if (!uncovered.length) return [];
      const key = uncovered.join(",");
      if (memo.has(key)) return memo.get(key);

      /* pick minterm covered by fewest primes */
      let target = uncovered[0];
      let best = Infinity;
      uncovered.forEach((m) => {
        const count = coverMap.reduce((acc, s) => acc + (s.has(m) ? 1 : 0), 0);
        if (count < best) {
          best = count;
          target = m;
        }
      });

      const candidates = [];
      coverMap.forEach((s, idx) => {
        if (s.has(target)) candidates.push(idx);
      });
      if (!candidates.length) {
        memo.set(key, null);
        return null;
      }
      candidates.sort((a, b) => {
        const d = coverMap[b].size - coverMap[a].size;
        if (d !== 0) return d;
        const l = literalCount(primes[a]) - literalCount(primes[b]);
        if (l !== 0) return l;
        return primes[a] < primes[b] ? -1 : 1;
      });

      let bestSolution = null;
      for (const idx of candidates) {
        const rest = uncovered.filter((m) => !coverMap[idx].has(m));
        const sub = search(rest);
        if (sub === null) continue;
        const solution = [idx].concat(sub);
        if (
          !bestSolution ||
          solution.length < bestSolution.length ||
          (solution.length === bestSolution.length &&
            solution.reduce((a, i) => a + literalCount(primes[i]), 0) <
              bestSolution.reduce((a, i) => a + literalCount(primes[i]), 0))
        ) {
          bestSolution = solution;
        }
        if (bestSolution && bestSolution.length === 1) break;
      }
      memo.set(key, bestSolution);
      return bestSolution;
    }

    const result = search(required.slice().sort((a, b) => a - b)) || [];
    const unique = Array.from(new Set(result));
    return unique.map((idx) => primes[idx]);
  }

  function essentialPrimes(primes, ones) {
    const essentials = [];
    ones.forEach((m) => {
      const owners = primes.filter((p) => patternCovers(p).indexOf(m) !== -1);
      if (owners.length === 1 && essentials.indexOf(owners[0]) === -1) essentials.push(owners[0]);
    });
    return essentials;
  }

  function patternToSopTerm(pattern, varNames) {
    let term = "";
    pattern.split("").forEach((c, i) => {
      if (c === "1") term += varNames[i];
      else if (c === "0") term += varNames[i] + "'";
    });
    return term === "" ? "1" : term;
  }

  function patternToPosTerm(pattern, varNames) {
    /* pattern comes from minimising the ZEROS, so each literal is complemented */
    const parts = [];
    pattern.split("").forEach((c, i) => {
      if (c === "1") parts.push(varNames[i] + "'");
      else if (c === "0") parts.push(varNames[i]);
    });
    if (!parts.length) return "0";
    return parts.length === 1 ? parts[0] : "(" + parts.join(" + ") + ")";
  }

  /**
   * values: array of 0 | 1 | "x" of length 2^nvars
   * mode: "SOP" | "POS"
   */
  function simplify(values, varNames, mode) {
    const bits = varNames.length;
    const total = 1 << bits;
    const ones = [];
    const zeros = [];
    const dontCares = [];
    for (let m = 0; m < total; m++) {
      const v = values[m];
      if (v === 1 || v === "1") ones.push(m);
      else if (v === "x" || v === "X") dontCares.push(m);
      else zeros.push(m);
    }

    const targets = mode === "POS" ? zeros : ones;
    const others = mode === "POS" ? ones : zeros;

    let expression;
    let terms = [];
    let primes = [];
    let essentials = [];
    let trivial = null;

    if (!targets.length) {
      trivial = mode === "POS" ? "1" : "0";
      expression = "F = " + trivial;
    } else if (others.length === 0) {
      trivial = mode === "POS" ? "0" : "1";
      expression = "F = " + trivial;
    } else {
      primes = primeImplicants(targets, dontCares, bits);
      essentials = essentialPrimes(primes, targets);
      const cover = minimalCover(primes, targets);
      terms = cover.map((pattern) => ({
        pattern,
        cells: patternCovers(pattern),
        literals: literalCount(pattern),
        essential: essentials.indexOf(pattern) !== -1,
        text: mode === "POS" ? patternToPosTerm(pattern, varNames) : patternToSopTerm(pattern, varNames),
      }));
      terms.sort((a, b) => (a.cells[0] === b.cells[0] ? a.pattern.localeCompare(b.pattern) : a.cells[0] - b.cells[0]));
      expression = "F = " + terms.map((t) => t.text).join(mode === "POS" ? "" : " + ");
    }

    const canonicalLiterals = targets.length * bits;
    const simplifiedLiterals = trivial !== null ? 0 : terms.reduce((a, t) => a + t.literals, 0);
    const reduction =
      canonicalLiterals === 0 ? 0 : Math.round(((canonicalLiterals - simplifiedLiterals) / canonicalLiterals) * 100);

    return {
      mode,
      ones,
      zeros,
      dontCares,
      targets,
      terms,
      trivial,
      expression,
      primeImplicants: primes,
      essentialImplicants: essentials,
      canonicalLiterals,
      simplifiedLiterals,
      reduction,
    };
  }

  global.KSimplifier = {
    simplify,
    primeImplicants,
    minimalCover,
    patternCovers,
    toBinary,
    literalCount,
    patternToSopTerm,
    patternToPosTerm,
  };
})(window);
