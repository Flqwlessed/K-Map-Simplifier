# K-Map Boolean Simplifier

A Karnaugh map simplifier I built to stop losing marks on digital-electronics assignments.
Type minterms, click a truth table, or paste a Boolean expression — the app draws the K-map,
finds the groups, gives you the minimal SOP or POS expression, and explains every step.

Everything runs in the browser. No backend, no build step, no API keys.

## Features

- 2, 3 and 4 variable maps (A, B, C, D) with correct Gray-code ordering
- Three input modes: minterm list (`Σm(0,2,5,7)`), clickable truth table, Boolean expression
- Don't-care support (`d(1,3,9)`, or the `X` state in the truth table / map)
- Real Quine-McCluskey minimisation with an exact minimal-cover search (not a fake demo)
- SOP (group 1s) and POS (group 0s) output
- Automatic group visualisation with generated translucent colours, plus two-way hover
  highlighting between a term and its cells
- Literal count before/after and reduction percentage
- Step-by-step "how the simplification worked" section, generated from the actual map
- Manual mode: pick your own cells and the app tells you whether the group is legal
- Practice mode with easy/medium/hard random problems and answer checking
- Copy expression / truth table / minterms, reset, load example, animation toggle
- Dark glassy responsive UI that works on phones

## Screenshots

_Add your own screenshots here:_

```
assets/screenshots/kmap.png
assets/screenshots/steps.png
```

## How Karnaugh maps work (short version)

A K-map is a truth table redrawn so that physically adjacent cells differ in exactly one
variable. That is why the rows/columns use Gray code (`00, 01, 11, 10`) instead of counting
order. When two adjacent 1s are grouped, the variable that changes between them cancels out
(`AB + AB' = A`). Groups must be rectangles whose size is a power of two, they may wrap
around the edges (and the four corners are adjacent), they may overlap, and don't-cares may
be included whenever they let you build a bigger group.

## How the simplification algorithm works

The visual grouping you see is the result of an algebraic algorithm, so it is always minimal:

1. **Prime implicants (Quine-McCluskey).** Minterms and don't-cares are written in binary and
   repeatedly merged whenever two patterns differ in one bit; the changing bit becomes `-`.
   Patterns that can no longer merge are prime implicants. (`simplifier.js: primeImplicants`)
2. **Essential prime implicants.** Any required minterm covered by exactly one prime implicant
   forces that implicant into the solution.
3. **Exact minimal cover.** A branch-and-bound search always branches on the least-covered
   remaining minterm, so the chosen set is the smallest possible (ties broken by literal
   count, then lexicographically — the result is deterministic).
4. **Term building.** In each pattern, `1` becomes `A`, `0` becomes `A'`, `-` is dropped.
5. **POS.** The zeros are minimised the same way, then each product term is complemented into a
   sum term: `A'B` over the zeros becomes `(A + B')`.

Don't-cares are allowed to build implicants but are never required to be covered.

## Project structure

```
kmap-simplifier/
├── index.html        markup and layout
├── style.css         dark glassmorphism design system
├── app.js            UI events, state, DOM rendering, animations
├── kmap.js           Gray code, map layout, cell mapping, group validation, colours
├── simplifier.js     Quine-McCluskey, prime implicants, minimal cover, SOP/POS
├── parser.js         expression tokenizer/parser, truth-table generation, minterm parsing
├── README.md
└── assets/
    └── icons/        logo.svg, favicon.svg
```

## Run locally

Option 1 — just double-click `index.html`. Everything is plain scripts, so `file://` works.

Option 2 — any static server, e.g.:

```bash
python3 -m http.server 5500
# then open http://localhost:5500
```

## Deploy on GitHub Pages

1. Create a repository named `kmap-simplifier` and push these files to the repo root:
   ```bash
   git init
   git add .
   git commit -m "K-map simplifier"
   git branch -M main
   git remote add origin https://github.com/<your-user>/kmap-simplifier.git
   git push -u origin main
   ```
2. Repo → **Settings → Pages**.
3. **Source**: *Deploy from a branch*. **Branch**: `main`, folder `/ (root)`. Save.
4. Wait ~1 minute, then open `https://<your-user>.github.io/kmap-simplifier/`.

No build command, no Node, no Python needed on the server.

## Test cases

| Input | Expected |
| --- | --- |
| `F(A,B) = Σm(1,3)` | `F = B` |
| `F(A,B,C) = Σm(1,3,5,7)` | `F = C` |
| `F(A,B,C,D) = Σm(0,2,8,10)` | `F = B'D'` |
| `F(A,B,C,D) = Σm(0,2,5,7,8,10,13,15)` | `F = B'D' + BD` |
| all cells 1 | `F = 1` |
| no cells 1 | `F = 0` |
| `Σm(0,1,2)` with `d(3)` on 2 vars | `F = 1` |
| expression `A'B + AC` (3 vars) | same map as `Σm(2,3,5,7)` |
| POS on `Σm(0,1,2,3,4,5,6,7)` (3 vars) | `F = 1` |

## Technologies used

HTML5, CSS3 (custom properties, grid, backdrop-filter), vanilla JavaScript (ES2017).
No frameworks, no dependencies.

## Future improvements

- 5 and 6 variable maps (two/four stacked 4-variable planes)
- Petrick's method shown as a table instead of only the final cover
- Export the map and steps as PNG/PDF
- NAND/NOR-only implementations and gate-count estimates
- Save/share a function through the URL hash

## Known limitations

- Maximum 4 variables.
- Practice mode marks an answer wrong if it uses more literals than the minimal solution,
  even when the logic is correct — that is intentional for exam practice.
- The expression parser treats adjacency as AND, so `AB` means `A AND B`; multi-letter
  variable names are not supported.
- Clipboard copying needs a browser that allows the Clipboard API (over `file://` some
  browsers block it).
