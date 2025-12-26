import {
    General, Chariot, Horse, Elephant, Advisor, Pawn, Cannon
} from "../models/pieces/index.js";

export class Board {
    constructor() {
        this.board = []; // 10 * 9 array
        this.turn = "red";
        this.status = true; 
        this.curPiece = null;
        this.turnCnt = 0;
    }

    // --- SETUP BOARD ---
    initBoard(situation) {
        for (let i = 0; i < 10; i++) {
            this.board[i] = new Array(9).fill(null);
        }
        situation.forEach((pieceInfo) => this.placePiece(pieceInfo));
    }

    placePiece(pieceInfo) {
        const [type, color, r, c] = pieceInfo;
        const row = parseInt(r);
        const col = parseInt(c);
        const PieceClass = {
            chariot: Chariot, horse: Horse, elephant: Elephant,
            advisor: Advisor, general: General, cannon: Cannon, pawn: Pawn
        }[type];

        if (PieceClass) {
            // Mapping icon đơn giản
            const icons = {
                red: { chariot: "车", horse: "马", elephant: "相", advisor: "仕", general: "帅", cannon: "炮", pawn: "兵" },
                black: { chariot: "車", horse: "馬", elephant: "象", advisor: "士", general: "将", cannon: "砲", pawn: "卒" }
            };
            this.board[row][col] = new PieceClass(color, icons[color][type], col, row);
        }
    }

    // --- CORE LOGIC ---

    /**
     * Di chuyển quân cờ (Main entry point)
     */
    movePiece(piece, newRow, newCol) {
        // 1. Validate cơ bản
        if (newRow < 0 || newRow > 9 || newCol < 0 || newCol > 8) return false;
        if (this.board[piece.row][piece.col] !== piece) return false;

        // 2. Validate luật đi của quân cờ
        if (!piece.validateMove(newRow, newCol, this.board)) return false;

        // 3. Validate luật "Tự sát" (Không được đi vào thế bị chiếu)
        if (this.isSuicideMove(piece, newRow, newCol)) {
            console.log("Move invalid: King is in danger (Suicide move)");
            return false;
        }

        return true;
    }

    /**
     * Kiểm tra xem Tướng của phe 'color' có đang bị chiếu không?
     * @param {string} color - Phe cần kiểm tra (VD: 'red' -> Tướng đỏ có bị đen chiếu không?)
     */
    isKingInDanger(color, boardState = this.board) {
        // 1. Tìm vị trí Tướng của phe mình
        let kingPos = null;
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 9; j++) {
                const p = boardState[i][j];
                if (p && p.type === "general" && p.color === color) {
                    kingPos = { r: i, c: j };
                    break;
                }
            }
            if (kingPos) break;
        }
        if (!kingPos) return true; // Mất tướng -> Coi như thua

        // 2. Tìm tất cả quân địch
        const enemyColor = color === "red" ? "black" : "red";
        
        // 3. Check xem có quân địch nào ăn được Tướng mình không
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 9; j++) {
                const enemy = boardState[i][j];
                if (enemy && enemy.color === enemyColor) {
                    // Kiểm tra nếu enemy có thể đi vào ô KingPos
                    if (enemy.validateMove(kingPos.r, kingPos.c, boardState)) {
                        return true; // Bị chiếu!
                    }
                }
            }
        }
        return false;
    }

    /**
     * Giả lập nước đi để kiểm tra xem có an toàn không
     */
    isSuicideMove(piece, newRow, newCol) {
        // Tạo bàn cờ giả lập
        const tempBoard = this.copyBoard(this.board);
        const oldRow = piece.row;
        const oldCol = piece.col;

        // Thực hiện nước đi trên bàn cờ ảo
        // Clone piece để không ảnh hưởng piece thật
        const clonePiece = Object.assign(Object.create(Object.getPrototypeOf(piece)), piece);
        clonePiece.row = newRow;
        clonePiece.col = newCol;

        tempBoard[oldRow][oldCol] = null;
        tempBoard[newRow][newCol] = clonePiece;

        // Sau khi đi xong, kiểm tra xem Tướng phe mình có bị chiếu không
        // (Bao gồm cả trường hợp 2 tướng nhìn nhau - Flying General)
        // Vì nếu lộ mặt, General địch sẽ validateMove() tới General mình thành công -> isKingInDanger trả về true
        return this.isKingInDanger(piece.color, tempBoard);
    }

    /**
     * Kiểm tra xem phe 'color' còn nước đi hợp lệ nào không
     * Trả về TRUE nếu còn nước đi, FALSE nếu hết cờ (Thua)
     */
    hasValidMoves(color) {
        // Duyệt tất cả quân của phe mình
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 9; j++) {
                const piece = this.board[i][j];
                if (piece && piece.color === color) {
                    // Vét cạn: Thử đi quân này tới mọi ô trên bàn cờ
                    // (Có thể tối ưu bằng cách chỉ check vùng xung quanh, nhưng vét cạn an toàn hơn cho logic)
                    for (let r = 0; r < 10; r++) {
                        for (let c = 0; c < 9; c++) {
                            // 1. Check luật di chuyển quân (validateMove)
                            if (piece.validateMove(r, c, this.board)) {
                                // 2. Check luật an toàn tướng (isSuicideMove)
                                if (!this.isSuicideMove(piece, r, c)) {
                                    return true; // Tìm thấy ít nhất 1 nước đi -> Chưa thua
                                }
                            }
                        }
                    }
                }
            }
        }
        return false; // Không còn nước nào -> Thua
    }

    /**
     * API công khai để check Game Over
     * Trả về: null (đang chơi), 'red' (đỏ thắng), 'black' (đen thắng)
     */
    checkWinner() {
        // Phe hiện tại (đang đến lượt)
        const currentTurn = this.turn;
        
        // Nếu phe hiện tại KHÔNG còn nước đi nào hợp lệ
        if (!this.hasValidMoves(currentTurn)) {
            // Phe kia thắng
            return currentTurn === 'red' ? 'black' : 'red';
        }
        
        return null;
    }

    copyBoard(original) {
        const copy = new Array(10);
        for (let i = 0; i < 10; i++) {
            copy[i] = [...original[i]];
        }
        return copy;
    }
}