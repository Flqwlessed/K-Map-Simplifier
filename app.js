/* app.js — UI events, state, DOM rendering, animations */
(function () {
  "use strict";

  const state = {
    nvars: 4,
    form: "SOP",
    inputMode: "minterms",
    values: new Array(16).fill(0),
    result: null,
    manual: false,
    manualSelection: [],
    skipAnimation: false,
    animationTimers: [],
    quiz: null,
    quizDifficulty: "easy",
  };

  const EXAMPLES = {
    2: { minterms: "1,3", dontcares: "" },
    3: { minterms: "1,3,5,7", dontcares: "" },
    4: { minterms: "0,2,5,7,8,10,13,15", dontcares: "" },
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ---------------- toast ---------------- */
  function toast(message, kind) {
    const host = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 250);
    }, 3600);
  }

  const varNames = () => KMap.VARIABLE_SETS[state.nvars];
  const cellCount = () => 1 << state.nvars;

  /* ---------------- input reading ---------------- */
  function valuesFromMinterms() {
    const max = cellCount() - 1;
    const m = KParser.parseMintermList($("#input-minterms").value, max);
    const d = KParser.parseMintermList($("#input-dontcares").value, max);
    if (m.duplicates.length) toast("Duplicate minterms ignored: " + m.duplicates.join(", "));
    if (d.duplicates.length) toast("Duplicate don't cares ignored: " + d.duplicates.join(", "));
    const clash = m.list.filter((v) => d.list.indexOf(v) !== -1);
    if (clash.length) {
      throw new Error("Term(s) " + clash.join(", ") + " appear in both minterms and don't cares.");
    }
    const values = new Array(cellCount()).fill(0);
    m.list.forEach((v) => (values[v] = 1));
    d.list.forEach((v) => (values[v] = "x"));
    return values;
  }

  function readValues() {
    if (state.inputMode === "minterms") return valuesFromMinterms();
    if (state.inputMode === "truth") return state.values.slice();
    const text = $("#input-expression").value.trim();
    if (!text) throw new Error("Enter a Boolean expression first.");
    return KParser.expressionToValues(text, varNames());
  }

  function syncInputsFromValues() {
    const ones = [];
    const dc = [];
    state.values.forEach((v, m) => {
      if (v === 1) ones.push(m);
      else if (v === "x") dc.push(m);
    });
    $("#input-minterms").value = ones.join(",");
    $("#input-dontcares").value = dc.join(",");
  }

  /* ---------------- truth table ---------------- */
  function renderTruthTable() {
    const vars = varNames();
    const rows = state.values
      .map((value, m) => {
        const bits = KMap.binaryOf(m, state.nvars).split("").map((b) => "<td>" + b + "</td>").join("");
        return (
          '<tr><td class="muted">m' + m + "</td>" + bits +
          '<td class="out" data-minterm="' + m + '" data-value="' + value + '">' +
          (value === "x" ? "X" : value) + "</td></tr>"
        );
      })
      .join("");
    $("#truth-table").innerHTML =
      '<table class="truth"><thead><tr><th>#</th>' +
      vars.map((v) => "<th>" + v + "</th>").join("") +
      "<th>F</th></tr></thead><tbody>" + rows + "</tbody></table>";
  }

  function cycleValue(v) {
    if (v === 0 || v === "0") return 1;
    if (v === 1 || v === "1") return "x";
    return 0;
  }

  /* ---------------- k-map ---------------- */
  function renderKmap(animate) {
    const l = KMap.layout(state.nvars);
    const host = $("#kmap");
    host.innerHTML = "";
    host.style.gridTemplateColumns = "auto repeat(" + l.colLabels.length + ", auto)";

    const corner = document.createElement("div");
    corner.className = "corner";
    corner.textContent = l.rowVars.join("") + " \\ " + l.colVars.join("");
    host.appendChild(corner);

    l.colLabels.forEach((label) => {
      const head = document.createElement("div");
      head.className = "col-head";
      head.textContent = label;
      host.appendChild(head);
    });

    l.rowLabels.forEach((rowLabel, r) => {
      const rh = document.createElement("div");
      rh.className = "row-head";
      rh.textContent = rowLabel;
      host.appendChild(rh);

      l.colLabels.forEach((_, c) => {
        const m = l.mintermAt(r, c);
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.minterm = String(m);
        cell.dataset.value = String(state.values[m]);
        cell.innerHTML =
          '<span class="mid">m' + m + '</span><span class="val">' +
          (state.values[m] === "x" ? "X" : state.values[m]) +
          '</span><span class="bin">' + KMap.binaryOf(m, state.nvars) + "</span>";
        if (animate) {
          cell.style.opacity = "0";
          setTimeout(() => {
            cell.style.opacity = "1";
            cell.classList.add("pop");
          }, 25 * (r * l.colLabels.length + c));
        }
        host.appendChild(cell);
      });
    });
    paintGroups();
    paintManualSelection();
  }

  function paintGroups(limit) {
    if (!state.result) return;
    const terms = state.result.terms.slice(0, limit === undefined ? undefined : limit);
    $$("#kmap .cell").forEach((cell) => {
      cell.style.boxShadow = "";
      cell.style.background = "";
    });
    terms.forEach((term, idx) => {
      const color = KMap.groupColor(idx, 0.3);
      const ring = KMap.groupColor(idx, 0.95);
      term.cells.forEach((m) => {
        const cell = document.querySelector('#kmap .cell[data-minterm="' + m + '"]');
        if (!cell) return;
        const inset = 3 + idx * 3;
        const prev = cell.style.boxShadow ? cell.style.boxShadow + ", " : "";
        cell.style.boxShadow = prev + "inset 0 0 0 " + inset + "px " + ring;
        cell.style.background = color;
      });
    });
  }

  function highlightTerm(index, on) {
    const term = state.result && state.result.terms[index];
    if (!term) return;
    $$("#kmap .cell").forEach((cell) => {
      const m = Number(cell.dataset.minterm);
      cell.classList.toggle("dim", on && term.cells.indexOf(m) === -1);
      cell.classList.toggle("flash", on && term.cells.indexOf(m) !== -1);
    });
    $$("#groups .group-chip").forEach((chip, i) => {
      chip.style.borderColor = on && i === index ? KMap.groupColor(i, 1) : "";
    });
  }

  function paintManualSelection() {
    $$("#kmap .cell").forEach((cell) => {
      cell.classList.toggle("selected", state.manualSelection.indexOf(Number(cell.dataset.minterm)) !== -1);
    });
  }

  /* ---------------- results ---------------- */
  function mintermSummary() {
    const ones = [];
    const dc = [];
    state.values.forEach((v, m) => {
      if (v === 1) ones.push(m);
      else if (v === "x") dc.push(m);
    });
    let text = "F(" + varNames().join(",") + ") = Σm(" + ones.join(",") + ")";
    if (dc.length) text += " + d(" + dc.join(",") + ")";
    return text;
  }

  function renderResult(result, animate) {
    $("#original-fn").textContent = mintermSummary();
    $("#stats").innerHTML =
      '<div class="stat"><b>' + result.canonicalLiterals + "</b><span>Original literals</span></div>" +
      '<div class="stat"><b>' + result.simplifiedLiterals + "</b><span>Simplified literals</span></div>" +
      '<div class="stat"><b>' + result.reduction + "%</b><span>Reduction</span></div>" +
      '<div class="stat"><b>' + result.terms.length + "</b><span>Groups</span></div>";

    const chips = result.terms
      .map((term, i) => {
        return (
          '<div class="group-chip" data-term="' + i + '" style="background:' + KMap.groupColor(i, 0.16) +
          ";border-color:" + KMap.groupColor(i, 0.55) + '">' +
          '<div class="tag">Group ' + (i + 1) + (term.essential ? " · essential" : "") + "</div>" +
          '<div class="term">' + term.text + "</div>" +
          '<div class="cells">' + term.cells.map((m) => "m" + m).join(" ") + "</div></div>"
        );
      })
      .join("");
    $("#groups").innerHTML = chips || '<p class="hint">No groups — the function is constant.</p>';
    renderSteps(result);

    const resultEl = $("#result-expression");
    if (animate && !state.skipAnimation && result.terms.length) {
      resultEl.textContent = "F = …";
      let shown = 0;
      const step = () => {
        shown++;
        paintGroups(shown);
        resultEl.textContent =
          "F = " + result.terms.slice(0, shown).map((t) => t.text).join(result.mode === "POS" ? "" : " + ");
        resultEl.classList.remove("reveal");
        void resultEl.offsetWidth;
        resultEl.classList.add("reveal");
        if (shown < result.terms.length) state.animationTimers.push(setTimeout(step, 380));
      };
      state.animationTimers.push(setTimeout(step, 320));
    } else {
      resultEl.textContent = result.expression;
      paintGroups();
    }
  }

  function renderSteps(result) {
    const vars = varNames();
    const targetName = result.mode === "POS" ? "0s (maxterms)" : "1s (minterms)";
    const generic = [
      ["Step 1", "Convert the Boolean function into its truth table and list the " + targetName + ": " +
        (result.targets.length ? result.targets.map((m) => "m" + m).join(", ") : "none") + "."],
      ["Step 2", "Place those cells into the Karnaugh map using Gray-code ordering so neighbouring cells differ in exactly one variable."],
      ["Step 3", "Generate every prime implicant with the Quine-McCluskey merging procedure (" +
        result.primeImplicants.length + " found), using don't cares where they help."],
      ["Step 4", "Keep the essential prime implicants (" + result.essentialImplicants.length +
        ") — cells that only one implicant can cover."],
      ["Step 5", "Choose the smallest set of remaining implicants that covers every required cell (exact minimal cover)."],
      ["Step 6", "Inside each group, variables that stay constant become literals; variables that change are removed."],
      ["Step 7", result.mode === "POS"
        ? "Complement each group of 0s to obtain a sum term, then multiply the sum terms into the POS expression."
        : "Combine the resulting product terms with OR to form the minimal SOP expression."],
    ];

    let html = generic
      .map((s) => '<div class="step"><h4>' + s[0] + "</h4><p>" + s[1] + "</p></div>")
      .join("");

    if (result.trivial !== null) {
      html += '<div class="step"><h4>Result</h4><p>The function is constant, so F = ' + result.trivial + ".</p></div>";
    }

    result.terms.forEach((term, i) => {
      const info = KMap.explainGroup(term.pattern, vars, result.mode);
      const binaries = term.cells.map((m) => "m" + m + " = " + KMap.binaryOf(m, state.nvars)).join("\n");
      const constants = info.constants
        .map((c) => c.name + " is always " + c.value)
        .concat(info.changing.map((c) => c + " changes → removed"))
        .join("\n");
      html +=
        '<div class="step" style="border-left-color:' + KMap.groupColor(i, 1) + '"><h4>Group ' + (i + 1) +
        " → " + term.text + "</h4><pre>" + binaries + "\n\n" + constants + "</pre></div>";
    });

    $("#steps").innerHTML = html;
  }

  /* ---------------- generate ---------------- */
  function clearTimers() {
    state.animationTimers.forEach(clearTimeout);
    state.animationTimers = [];
  }

  function generate(animate) {
    clearTimers();
    let values;
    try {
      values = readValues();
    } catch (err) {
      toast(err.message, "error");
      return;
    }
    state.values = values;
    if (state.inputMode !== "minterms") syncInputsFromValues();
    renderTruthTable();
    state.result = KSimplifier.simplify(values, varNames(), state.form);
    renderKmap(animate && !state.skipAnimation);
    renderResult(state.result, animate);
  }

  function refreshSignature() {
    $("#fn-signature").textContent = "F(" + varNames().join(",") + ")";
    $("#kmap-caption").textContent =
      "Gray-code ordering · " + KMap.layout(state.nvars).rowVars.join("") + " rows / " +
      KMap.layout(state.nvars).colVars.join("") + " columns";
  }

  function setVariableCount(n) {
    state.nvars = n;
    state.values = new Array(cellCount()).fill(0);
    state.manualSelection = [];
    state.result = null;
    refreshSignature();
    renderTruthTable();
    renderKmap(false);
    $("#result-expression").textContent = "F = 0";
    $("#groups").innerHTML = "";
    $("#steps").innerHTML = "";
    $("#stats").innerHTML = "";
    $("#original-fn").textContent = mintermSummary();
  }

  /* ---------------- copy ---------------- */
  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      toast(label + " copied to clipboard.", "success");
    } catch (err) {
      toast("Clipboard blocked by the browser — select the text manually.", "error");
    }
  }

  function truthTableText() {
    const vars = varNames();
    let out = vars.join(" ") + " | F\n";
    state.values.forEach((v, m) => {
      out += KMap.binaryOf(m, state.nvars).split("").join(" ") + " | " + (v === "x" ? "X" : v) + "\n";
    });
    return out;
  }

  /* ---------------- quiz ---------------- */
  function randomQuiz() {
    const difficulty = state.quizDifficulty;
    const nvars = difficulty === "easy" ? 3 : 4;
    const total = 1 << nvars;
    const count =
      difficulty === "easy" ? 2 + Math.floor(Math.random() * 3)
      : difficulty === "medium" ? 4 + Math.floor(Math.random() * 3)
      : 6 + Math.floor(Math.random() * 5);
    const pool = [];
    for (let i = 0; i < total; i++) pool.push(i);
    pool.sort(() => Math.random() - 0.5);
    const ones = pool.slice(0, count).sort((a, b) => a - b);
    const dontCares = difficulty === "hard" ? pool.slice(count, count + 2).sort((a, b) => a - b) : [];
    const values = new Array(total).fill(0);
    ones.forEach((m) => (values[m] = 1));
    dontCares.forEach((m) => (values[m] = "x"));
    const solution = KSimplifier.simplify(values, KMap.VARIABLE_SETS[nvars], "SOP");
    state.quiz = { nvars, ones, dontCares, values, solution };
    $("#quiz-question").textContent =
      "Simplify (SOP):  F(" + KMap.VARIABLE_SETS[nvars].join(",") + ") = Σm(" + ones.join(",") + ")" +
      (dontCares.length ? " + d(" + dontCares.join(",") + ")" : "");
    $("#quiz-answer").value = "";
    $("#quiz-feedback").textContent = "";
    $("#quiz-feedback").className = "quiz-feedback";
  }

  function checkQuiz() {
    if (!state.quiz) {
      toast("Generate a question first.", "error");
      return;
    }
    const answer = $("#quiz-answer").value.trim();
    if (!answer) {
      toast("Type your simplified expression first.", "error");
      return;
    }
    const vars = KMap.VARIABLE_SETS[state.quiz.nvars];
    let userValues;
    try {
      userValues = KParser.expressionToValues(answer, vars);
    } catch (err) {
      toast(err.message, "error");
      return;
    }
    const equivalent = state.quiz.values.every((v, m) => v === "x" || Number(v) === userValues[m]);
    const feedback = $("#quiz-feedback");
    if (!equivalent) {
      feedback.textContent = "Try again — your expression does not match the function.";
      feedback.className = "quiz-feedback bad";
      return;
    }
    /* count literals of the answer to check minimality */
    const literals = (answer.match(/[A-Za-z]/g) || []).length;
    if (literals > state.quiz.solution.simplifiedLiterals) {
      feedback.textContent =
        "Correct logic, but not minimal. Minimal answer: " + state.quiz.solution.expression;
      feedback.className = "quiz-feedback bad";
      return;
    }
    feedback.textContent = "Correct! " + state.quiz.solution.expression;
    feedback.className = "quiz-feedback ok";
  }

  function loadQuizIntoMap() {
    if (!state.quiz) {
      toast("Generate a question first.", "error");
      return;
    }
    setVariableCount(state.quiz.nvars);
    $$("#var-select .seg").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.vars) === state.quiz.nvars));
    setInputMode("minterms");
    $("#input-minterms").value = state.quiz.ones.join(",");
    $("#input-dontcares").value = state.quiz.dontCares.join(",");
    generate(true);
    toast("Question loaded into the K-map.", "success");
  }

  /* ---------------- modes ---------------- */
  function setInputMode(mode) {
    state.inputMode = mode;
    $$("#mode-tabs .seg").forEach((b) => b.classList.toggle("is-active", b.dataset.mode === mode));
    $$(".panel").forEach((p) => p.classList.toggle("is-hidden", p.dataset.panel !== mode));
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    $$("#var-select .seg").forEach((btn) =>
      btn.addEventListener("click", () => {
        $$("#var-select .seg").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        setVariableCount(Number(btn.dataset.vars));
        $("#input-minterms").value = "";
        $("#input-dontcares").value = "";
        $("#input-expression").value = "";
      })
    );

    $$("#form-select .seg").forEach((btn) =>
      btn.addEventListener("click", () => {
        $$("#form-select .seg").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.form = btn.dataset.form;
        if (state.result) generate(false);
      })
    );

    $$("#mode-tabs .seg").forEach((btn) => btn.addEventListener("click", () => setInputMode(btn.dataset.mode)));

    $$("#quiz-difficulty .seg").forEach((btn) =>
      btn.addEventListener("click", () => {
        $$("#quiz-difficulty .seg").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        state.quizDifficulty = btn.dataset.difficulty;
      })
    );

    $("#btn-generate").addEventListener("click", () => generate(true));

    ["#input-minterms", "#input-dontcares", "#input-expression"].forEach((sel) => {
      $(sel).addEventListener("keydown", (e) => {
        if (e.key === "Enter") generate(true);
      });
      $(sel).addEventListener("input", () => {
        /* reactive: live update without animation */
        const isExpr = sel === "#input-expression";
        if ((isExpr && state.inputMode !== "expression") || (!isExpr && state.inputMode !== "minterms")) return;
        try {
          const values = readValues();
          state.values = values;
          renderTruthTable();
          state.result = KSimplifier.simplify(values, varNames(), state.form);
          renderKmap(false);
          renderResult(state.result, false);
        } catch (err) {
          /* silent while typing; explicit generate reports the error */
        }
      });
    });

    $("#btn-skip").addEventListener("click", () => {
      state.skipAnimation = !state.skipAnimation;
      $("#btn-skip").textContent = state.skipAnimation ? "Animation: off" : "Skip animation";
      $("#btn-skip").classList.toggle("is-on", state.skipAnimation);
      clearTimers();
      if (state.result) renderResult(state.result, false);
    });

    $("#btn-manual").addEventListener("click", () => {
      state.manual = !state.manual;
      $("#btn-manual").textContent = "Manual mode: " + (state.manual ? "on" : "off");
      $("#btn-manual").classList.toggle("is-on", state.manual);
      $("#manual-bar").classList.toggle("is-hidden", !state.manual);
      state.manualSelection = [];
      paintManualSelection();
    });

    $("#btn-manual-clear").addEventListener("click", () => {
      state.manualSelection = [];
      paintManualSelection();
      $("#manual-status").textContent = "Selection cleared.";
    });

    $("#btn-manual-check").addEventListener("click", () => {
      const check = KMap.validateGroup(state.manualSelection, state.nvars);
      if (!check.valid) {
        $("#manual-status").textContent = "Invalid group: " + check.reason;
        toast("Invalid group: " + check.reason, "error");
        return;
      }
      const term = KSimplifier.patternToSopTerm(check.pattern, varNames());
      const covered = check.cells.every((m) => state.values[m] === 1 || state.values[m] === "x");
      const inAuto = state.result && state.result.terms.some((t) => t.pattern === check.pattern);
      let msg = "Valid group of " + check.cells.length + " cells → " + term + ".";
      if (!covered) msg += " Warning: it includes cells whose value is 0.";
      msg += inAuto ? " This group is part of the automatic minimal solution." : " Not used in the minimal solution.";
      $("#manual-status").textContent = msg;
      toast(msg, covered ? "success" : "error");
    });

    $("#btn-example").addEventListener("click", () => {
      const ex = EXAMPLES[state.nvars];
      setInputMode("minterms");
      $("#input-minterms").value = ex.minterms;
      $("#input-dontcares").value = ex.dontcares;
      generate(true);
      toast("Example loaded for " + state.nvars + " variables.", "success");
    });

    $("#btn-reset").addEventListener("click", () => {
      clearTimers();
      $("#input-minterms").value = "";
      $("#input-dontcares").value = "";
      $("#input-expression").value = "";
      state.manual = false;
      $("#btn-manual").textContent = "Manual mode: off";
      $("#btn-manual").classList.remove("is-on");
      $("#manual-bar").classList.add("is-hidden");
      setVariableCount(state.nvars);
      toast("Everything reset.");
    });

    $$("[data-copy]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const what = btn.dataset.copy;
        if (what === "expression") copyText(state.result ? state.result.expression : "F = 0", "Expression");
        else if (what === "truth") copyText(truthTableText(), "Truth table");
        else {
          const ones = state.values.map((v, m) => (v === 1 ? m : null)).filter((v) => v !== null);
          copyText("Σm(" + ones.join(",") + ")", "Minterms");
        }
      })
    );

    /* truth-table cell cycling */
    $("#truth-table").addEventListener("click", (e) => {
      const td = e.target.closest("td.out");
      if (!td) return;
      const m = Number(td.dataset.minterm);
      state.values[m] = cycleValue(state.values[m]);
      setInputMode("truth");
      syncInputsFromValues();
      renderTruthTable();
      state.result = KSimplifier.simplify(state.values, varNames(), state.form);
      renderKmap(false);
      renderResult(state.result, false);
    });

    /* k-map cell interaction */
    $("#kmap").addEventListener("click", (e) => {
      const cell = e.target.closest(".cell");
      if (!cell) return;
      const m = Number(cell.dataset.minterm);
      if (state.manual) {
        const idx = state.manualSelection.indexOf(m);
        if (idx === -1) state.manualSelection.push(m);
        else state.manualSelection.splice(idx, 1);
        paintManualSelection();
        $("#manual-status").textContent =
          "Selected: " + (state.manualSelection.length ? state.manualSelection.map((x) => "m" + x).join(", ") : "none");
        return;
      }
      state.values[m] = cycleValue(state.values[m]);
      syncInputsFromValues();
      renderTruthTable();
      state.result = KSimplifier.simplify(state.values, varNames(), state.form);
      renderKmap(false);
      renderResult(state.result, false);
    });

    /* hover interactions between map and terms */
    $("#kmap").addEventListener("mouseover", (e) => {
      const cell = e.target.closest(".cell");
      if (!cell || !state.result) return;
      const m = Number(cell.dataset.minterm);
      const idx = state.result.terms.findIndex((t) => t.cells.indexOf(m) !== -1);
      if (idx !== -1) highlightTerm(idx, true);
    });
    $("#kmap").addEventListener("mouseout", () => {
      $$("#kmap .cell").forEach((c) => c.classList.remove("dim", "flash"));
      $$("#groups .group-chip").forEach((chip) => (chip.style.borderColor = ""));
    });

    $("#groups").addEventListener("mouseover", (e) => {
      const chip = e.target.closest(".group-chip");
      if (chip) highlightTerm(Number(chip.dataset.term), true);
    });
    $("#groups").addEventListener("mouseout", () => {
      $$("#kmap .cell").forEach((c) => c.classList.remove("dim", "flash"));
    });

    $("#btn-quiz-new").addEventListener("click", randomQuiz);
    $("#btn-quiz-check").addEventListener("click", checkQuiz);
    $("#btn-quiz-load").addEventListener("click", loadQuizIntoMap);
    $("#quiz-answer").addEventListener("keydown", (e) => {
      if (e.key === "Enter") checkQuiz();
    });
  }

  /* ---------------- boot ---------------- */
  refreshSignature();
  renderTruthTable();
  renderKmap(false);
  wire();
  $("#input-minterms").value = EXAMPLES[4].minterms;
  generate(true);
})();
