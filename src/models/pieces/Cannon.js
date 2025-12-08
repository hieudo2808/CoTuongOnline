import { ChessPiece } from "./ChessPiece.js";

export class Cannon extends ChessPiece {
    constructor(color, icon, col, row) {
        super(color, "cannon", icon, col, row);
    }

    validateMove(newRow, newCol, board) {
        // 1. Kiểm tra cơ bản: Không được ăn quân mình
        if (this.isFriendly(newRow, newCol, board)) return false;

        // 2. Chỉ được đi thẳng hàng hoặc thẳng cột
        if (this.row !== newRow && this.col !== newCol) return false;

        // 3. Đếm số lượng quân cản trên đường đi (không tính điểm đầu và điểm cuối)
        let obstacles = 0;

        if (this.row === newRow) {
            // Đi ngang
            const start = Math.min(this.col, newCol) + 1;
            const end = Math.max(this.col, newCol);
            for (let c = start; c < end; c++) {
                if (board[this.row][c] !== null) {
                    obstacles++;
                }
            }
        } else {
            // Đi dọc
            const start = Math.min(this.row, newRow) + 1;
            const end = Math.max(this.row, newRow);
            for (let r = start; r < end; r++) {
                if (board[r][this.col] !== null) {
                    obstacles++;
                }
            }
        }

        // 4. Kiểm tra đích đến
        const targetPiece = board[newRow][newCol];

        if (targetPiece === null) {
            // Nước đi thông thường (không ăn quân): Phải không có vật cản
            return obstacles === 0;
        } else {
            // Nước ăn quân (Capture): Phải có ĐÚNG 1 vật cản (ngòi pháo)
            return obstacles === 1;
        }
    }
}