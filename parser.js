/* parser.js — Boolean expression parsing and truth-table generation */
(function (global) {
  "use strict";

  function tokenize(input) {
    const tokens = [];
    let i = 0;
    const src = input.replace(/\s+/g, "");
    while (i < src.length) {
      const ch = src[i];
      if (/[A-Za-z]/.test(ch)) {
        tokens.push({ type: "var", value: ch.toUpperCase() });
        i++;
      } else if (ch === "'") {
        tokens.push({ type: "post-not" });
        i++;
      } else if (ch === "!" || ch === "~") {
        tokens.push({ type: "not" });
        i++;
      } else if (ch === "+" || ch === "|") {
        tokens.push({ type: "or" });
        i++;
        if (src[i] === "|") i++;
      } else if (ch === "*" || ch === "&" || ch === ".") {
        tokens.push({ type: "and" });
        i++;
        if (src[i] === "&") i++;
      } else if (ch === "(") {
        tokens.push({ type: "lparen" });
        i++;
      } else if (ch === ")") {
        tokens.push({ type: "rparen" });
        i++;
      } else if (ch === "0" || ch === "1") {
        tokens.push({ type: "const", value: Number(ch) });
        i++;
      } else if (ch === "^") {
        tokens.push({ type: "xor" });
        i++;
      } else {
        throw new Error("Unexpected character: " + ch);
      }
    }
    return tokens;
  }

  /* Recursive descent parser -> AST */
  function parse(input) {
    if (!input || !input.trim()) throw new Error("Expression is empty.");
    const tokens = tokenize(input);
    let pos = 0;

    const peek = () => tokens[pos];
    const eat = (type) => {
      if (!peek() || peek().type !== type) throw new Error("Invalid syntax near position " + pos + ".");
      return tokens[pos++];
    };

    function parseOr() {
      let node = parseXor();
      while (peek() && peek().type === "or") {
        pos++;
        node = { op: "or", left: node, right: parseXor() };
      }
      return node;
    }

    function parseXor() {
      let node = parseAnd();
      while (peek() && peek().type === "xor") {
        pos++;
        node = { op: "xor", left: node, right: parseAnd() };
      }
      return node;
    }

    function startsAtom(t) {
      return t && (t.type === "var" || t.type === "not" || t.type === "lparen" || t.type === "const");
    }

    function parseAnd() {
      let node = parseUnary();
      while (peek() && (peek().type === "and" || startsAtom(peek()))) {
        if (peek().type === "and") pos++;
        node = { op: "and", left: node, right: parseUnary() };
      }
      return node;
    }

    function parseUnary() {
      if (peek() && peek().type === "not") {
        pos++;
        return { op: "not", child: parseUnary() };
      }
      return parsePostfix();
    }

    function parsePostfix() {
      let node = parseAtom();
      while (peek() && peek().type === "post-not") {
        pos++;
        node = { op: "not", child: node };
      }
      return node;
    }

    function parseAtom() {
      const t = peek();
      if (!t) throw new Error("Unexpected end of expression.");
      if (t.type === "var") {
        pos++;
        return { op: "var", name: t.value };
      }
      if (t.type === "const") {
        pos++;
        return { op: "const", value: t.value };
      }
      if (t.type === "lparen") {
        pos++;
        const inner = parseOr();
        if (!peek() || peek().type !== "rparen") throw new Error("Unbalanced parentheses.");
        eat("rparen");
        return inner;
      }
      throw new Error("Unexpected token in expression.");
    }

    const ast = parseOr();
    if (pos !== tokens.length) throw new Error("Unbalanced parentheses or trailing operator.");
    return ast;
  }

  function collectVars(ast, set) {
    set = set || new Set();
    if (!ast) return set;
    if (ast.op === "var") set.add(ast.name);
    if (ast.left) collectVars(ast.left, set);
    if (ast.right) collectVars(ast.right, set);
    if (ast.child) collectVars(ast.child, set);
    return set;
  }

  function evaluate(ast, env) {
    switch (ast.op) {
      case "const":
        return ast.value ? 1 : 0;
      case "var":
        return env[ast.name] ? 1 : 0;
      case "not":
        return evaluate(ast.child, env) ? 0 : 1;
      case "and":
        return evaluate(ast.left, env) && evaluate(ast.right, env) ? 1 : 0;
      case "or":
        return evaluate(ast.left, env) || evaluate(ast.right, env) ? 1 : 0;
      case "xor":
        return evaluate(ast.left, env) ^ evaluate(ast.right, env) ? 1 : 0;
      default:
        throw new Error("Unknown node in expression.");
    }
  }

  /**
   * Converts an expression into an array of 0/1 values of length 2^varNames.length.
   * Throws when the expression uses variables outside varNames.
   */
  function expressionToValues(input, varNames) {
    const ast = parse(input);
    const used = Array.from(collectVars(ast));
    const invalid = used.filter((v) => varNames.indexOf(v) === -1);
    if (invalid.length) {
      throw new Error(
        "Unknown variable" + (invalid.length > 1 ? "s" : "") + ": " + invalid.join(", ") +
          ". Allowed: " + varNames.join(", ") + "."
      );
    }
    const n = varNames.length;
    const values = [];
    for (let m = 0; m < 1 << n; m++) {
      const env = {};
      varNames.forEach((name, idx) => {
        env[name] = (m >> (n - 1 - idx)) & 1;
      });
      values.push(evaluate(ast, env));
    }
    return values;
  }

  /** Parses "Σm(0,2,5)" / "0,2,5" / "m(0 2 5)" into a sorted unique number list. */
  function parseMintermList(raw, maxIndex) {
    const empty = { list: [], duplicates: [] };
    if (raw === null || raw === undefined) return empty;
    let text = String(raw).trim();
    if (!text) return empty;
    text = text.replace(/[Σ∑]/g, "").replace(/[a-zA-Z]/g, "").replace(/[()\[\]]/g, " ");
    const parts = text.split(/[\s,;]+/).filter(Boolean);
    const out = [];
    const seen = new Set();
    const duplicates = [];
    parts.forEach((p) => {
      if (!/^\d+$/.test(p)) throw new Error('"' + p + '" is not a valid minterm number.');
      const value = parseInt(p, 10);
      if (value > maxIndex) {
        throw new Error("Minterm " + value + " is out of range (allowed 0–" + maxIndex + ").");
      }
      if (seen.has(value)) {
        duplicates.push(value);
        return;
      }
      seen.add(value);
      out.push(value);
    });
    out.sort((a, b) => a - b);
    return { list: out, duplicates: Array.from(new Set(duplicates)) };
  }

  global.KParser = { parse, evaluate, collectVars, expressionToValues, parseMintermList, tokenize };
})(window);
