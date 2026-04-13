function deepCopy(arr) {
    return arr.map(row => [...row]);
}

function isValidGroup(arr) {
    const nums = arr.filter(n => n !== 0);
    return new Set(nums).size === nums.length;
}

// {
//   getPuzzle(): number[][]
//   getGrid(): number[][]
//   getCell(row, col): number
//   isFixed(row, col): boolean
//   guess(move): void
//   clone(): Sudoku
//   validate(): boolean
//   toJSON(): any
//   toString(): string
// }
class Sudoku {
    constructor(puzzle, grid = null) {
        if (!Array.isArray(puzzle) || puzzle.length !== 9 ||
            puzzle.some(row => !Array.isArray(row) || row.length !== 9)) {
            throw new Error('Invalid puzzle: must be a 9x9 array');
        }
        this.puzzle = deepCopy(puzzle);
        this.grid = grid ? deepCopy(grid) : deepCopy(puzzle);
    }

    getPuzzle() {
        return deepCopy(this.puzzle);
    }

    getGrid() {
        return deepCopy(this.grid);
    }

    getCell(row, col) {
        return this.grid[row][col];
    }

    isFixed(row, col) {
        return this.puzzle[row][col] !== 0;
    }

    guess(move) {
        const { row, col, value } = move;
        if (row < 0 || row > 8 || col < 0 || col > 8) return;
        if (value < 0 || value > 9) return;
        if (this.isFixed(row, col)) return;
        this.grid[row][col] = value;
    }

    clone() {
        return new Sudoku(this.puzzle, this.grid);
    }

    validate() {
        for (let i = 0; i < 9; i++) {
            if (!isValidGroup(this.grid[i])) return false;
            if (!isValidGroup(this.grid.map(row => row[i]))) return false;
        }
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const box = [];
                for (let k = 0; k < 3; k++) {
                    for (let l = 0; l < 3; l++) {
                        box.push(this.grid[i * 3 + k][j * 3 + l]);
                    }
                }
                if (!isValidGroup(box)) return false;
            }
        }
        return true;
    }

    toJSON() {
        return {
            puzzle: deepCopy(this.puzzle),
            grid: deepCopy(this.grid),
        };
    }

    static fromJSON(json) {
        return new Sudoku(json.puzzle, json.grid);
    }

    toString() {
        return this.grid
            .map(row => row.map(n => n === 0 ? '.' : n).join(' '))
            .join('\n') + '\n';
    }
}


// {
//   getSudoku(): Sudoku
//   guess(move): void
//   undo(): void
//   redo(): void
//   canUndo(): boolean
//   canRedo(): boolean
//   toJSON(): any
// }
class Game {
    constructor({ sudoku, history = [], future = [] }) {
        // Clone incoming sudoku so Game owns its own copy
        this.sudoku = sudoku.clone();
        // Shallow-copy each move record so callers can't mutate our history
        this.history = history.map(m => ({ ...m }));
        this.future = future.map(m => ({ ...m }));
    }

    // Returns an independent clone of the current sudoku state
    getSudoku() {
        return this.sudoku.clone();
    }

    guess(move) {
        // Skip fixed puzzle cells before touching history
        if (this.sudoku.isFixed(move.row, move.col)) return;
        const prev = this.sudoku.getCell(move.row, move.col);
        this.sudoku.guess(move);
        this.history.push({ row: move.row, col: move.col, value: prev });
        this.future = [];
    }

    canUndo() {
        return this.history.length > 0;
    }

    canRedo() {
        return this.future.length > 0;
    }

    undo() {
        if (!this.canUndo()) return;
        const last = this.history.pop();
        const current = this.sudoku.getCell(last.row, last.col);
        this.future.push({ row: last.row, col: last.col, value: current });
        this.sudoku.guess(last);
    }

    redo() {
        if (!this.canRedo()) return;
        const next = this.future.pop();
        const current = this.sudoku.getCell(next.row, next.col);
        this.history.push({ row: next.row, col: next.col, value: current });
        this.sudoku.guess(next);
    }

    // Returns a plain-object snapshot; all arrays are defensively copied
    toJSON() {
        return {
            sudoku: this.sudoku.toJSON(),
            history: this.history.map(m => ({ ...m })),
            future: this.future.map(m => ({ ...m })),
        };
    }

    static fromJSON(json) {
        return new Game({
            sudoku: Sudoku.fromJSON(json.sudoku),
            history: json.history.map(m => ({ ...m })),
            future: json.future.map(m => ({ ...m })),
        });
    }
}


export function createSudoku(input) {
    return new Sudoku(input);
}

export function createSudokuFromJSON(json) {
    return Sudoku.fromJSON(json);
}

export function createGame({ sudoku }) {
    return new Game({ sudoku });
}

export function createGameFromJSON(json) {
    return Game.fromJSON(json);
}
