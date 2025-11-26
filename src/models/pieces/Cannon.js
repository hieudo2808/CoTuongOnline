// Cannon (Pháo) piece

import { ChessPiece } from "./ChessPiece.js";

export class Cannon extends ChessPiece {
    constructor(color, icon, col, row) {
        super(color, "cannon", icon, col, row);
        this.dir = [
            [
                [1, 0],
                [2, 0],
                [3, 0],
                [4, 0],
                [5, 0],
                [6, 0],
                [7, 0],
                [8, 0],
                [9, 0],
            ],
            [
                [-1, 0],
                [-2, 0],
                [-3, 0],
                [-4, 0],
                [-5, 0],
                [-6, 0],
                [-7, 0],
                [-8, 0],
                [-9, 0],
            ],
            [
                [0, 1],
                [0, 2],
                [0, 3],
                [0, 4],
                [0, 5],
                [0, 6],
                [0, 7],
                [0, 8],
            ],
            [
                [0, -1],
                [0, -2],
                [0, -3],
                [0, -4],
                [0, -5],
                [0, -6],
                [0, -7],
                [0, -8],
            ],
        ];
    }

    rowLimit(side, isCannonEmpty, board) {
        const dirRow = side == "up" ? 1 : 0;
        let count = 0; // piece in the way
        let limit = -1;

        for (let i = 0; i < 9; i++) {
            const newRow = this.row + this.dir[dirRow][i][0];
            if (newRow < 0 || newRow > 9) break;

            if (board[newRow][this.col] != null) {
                count++;
                if (count == 2) break; // second piece is the limit
            }
            if (isCannonEmpty) {
                if (count == 1) break; // first piece is limit if there is no enemy tgt
                limit++;
            } else {
                if (count != 1) limit++;
            }
        }

        return limit;
    }

    colLimit(side, isCannonEmpty, board) {
        const dirCol = side == "right" ? 2 : 3;
        let count = 0; // piece in the way
        let limit = -1;

        for (let i = 0; i < 8; i++) {
            const newCol = this.col + this.dir[dirCol][i][1];
            if (newCol < 0 || newCol > 8) break;

            if (board[this.row][newCol] != null) {
                count++;
                if (count == 2) break; // second piece is the limit
            }
            if (isCannonEmpty) {
                if (count == 1) break; // first piece is limit if there is no enemy tgt
                limit++;
            } else {
                if (count != 1) limit++;
            }
        }

        return limit;
    }

    validateMove(newRow, newCol, board) {
        const valid = [];

        const isCannonEmpty = board[newRow][newCol] == null;

        const up = this.rowLimit("up", isCannonEmpty, board);
        for (let i = 0; i <= up; i++) {
            valid.push(this.dir[1][i]);
        }
        const down = this.rowLimit("down", isCannonEmpty, board);
        for (let i = 0; i <= down; i++) {
            valid.push(this.dir[0][i]);
        }
        const right = this.colLimit("right", isCannonEmpty, board);
        for (let i = 0; i <= right; i++) {
            valid.push(this.dir[2][i]);
        }
        const left = this.colLimit("left", isCannonEmpty, board);
        for (let i = 0; i <= left; i++) {
            valid.push(this.dir[3][i]);
        }

        return this.checkMove(newRow, newCol, valid, board);
    }
}
