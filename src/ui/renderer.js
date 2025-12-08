// src/ui/renderer.js
export class UI {
    constructor(boardContainerId = null) {
        this.boardContainerId = boardContainerId;
        this.boardContainer = boardContainerId ? document.getElementById(boardContainerId) : null;
        
        this.elements = {
            turnText: null,
            movesList: null,
            chessboardTable: null
        };
        
        this.buttons = { newGame: null, resign: null, draw: null };
        
        if (!this.boardContainer) {
            this.isInitialized = false;
            return;
        }
        
        this.isLegacyMode = false;
        this.isInitialized = true;
        this.initModernMode();
    }

    initialize(boardContainerId) {
        if (this.isInitialized) return true;
        this.boardContainerId = boardContainerId;
        this.boardContainer = document.getElementById(boardContainerId);
        if (!this.boardContainer) throw new Error(`Container "${boardContainerId}" not found.`);
        
        this.isLegacyMode = false;
        this.isInitialized = true;
        this.initModernMode();
        return true;
    }

    initModernMode() {
        this.initModernBoard();
        this.bindExistingElements();
    }
    
    initModernBoard() {
        this.boardContainer.innerHTML = '';
        
        // Wrapper chính
        const boardWrapper = document.createElement('div');
        boardWrapper.className = 'board-wrapper';
        
        // 1. Lớp hình ảnh bàn cờ (Grid)
        const boardShape = document.createElement('div');
        boardShape.className = 'xiangqi-grid';
        
        const gridTable = document.createElement('table');
        gridTable.className = 'grid-table';
        for(let r=0; r<9; r++) {
            const row = gridTable.insertRow();
            for(let c=0; c<8; c++) {
                const cell = row.insertCell();
                if(r===4) cell.className = 'river-cell';
                else cell.className = 'normal-cell';
            }
        }
        boardShape.appendChild(gridTable);
        
        // River Text
        const riverText = document.createElement('div');
        riverText.className = 'river-text';
        riverText.textContent = '楚 河 漢 界';
        boardShape.appendChild(riverText);

        // 2. Lớp chứa quân cờ (Overlay)
        const chessboard = document.createElement('div');
        chessboard.id = 'chessboardContainer';
        chessboard.className = 'piece-layer';
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const spot = document.createElement('div');
                spot.className = 'piece-spot';
                spot.setAttribute('data-x', r);
                spot.setAttribute('data-y', c);
                chessboard.appendChild(spot);
            }
        }
        
        this.elements.chessboardTable = chessboard;
        
        boardWrapper.appendChild(boardShape);
        boardWrapper.appendChild(chessboard);
        this.boardContainer.appendChild(boardWrapper);
        
        this.injectStyles();
    }
    
    bindExistingElements() {
        this.elements.turnText = document.getElementById('turn-text');
        this.elements.movesList = document.getElementById('moves-list');
        this.buttons.resign = document.getElementById('btn-resign') || document.createElement('button');
        this.buttons.draw = document.getElementById('btn-draw-offer') || document.createElement('button');
        this.buttons.newGame = document.getElementById('btn-new-game') || document.createElement('button');
    }
    
    injectStyles() {
        if (document.getElementById('xiangqi-renderer-styles')) return;

        const CELL_SIZE = 67; // Kích thước 1 ô vuông (px)

        const PADDING = Math.round(CELL_SIZE * 0.66);      // Lề bàn cờ
        const PIECE_SIZE = Math.round(CELL_SIZE * 0.88);   // Kích thước quân cờ
        const FONT_SIZE = Math.round(PIECE_SIZE * 0.52);   // Cỡ chữ quân cờ
        const RIVER_FONT_SIZE = Math.round(CELL_SIZE * 0.64); // Cỡ chữ sông
        
        // Kích thước lưới kẻ (Grid): 8 ô ngang x 9 ô dọc
        const GRID_WIDTH = 8 * CELL_SIZE; 
        const GRID_HEIGHT = 9 * CELL_SIZE;
        
        // Kích thước tổng thể Wrapper = Grid + Padding 2 bên
        const WRAPPER_WIDTH = GRID_WIDTH + (PADDING * 2);
        const WRAPPER_HEIGHT = GRID_HEIGHT + (PADDING * 2);

        // Kích thước Grid Container (Thêm 2px border để khớp)
        const GRID_BOX_WIDTH = GRID_WIDTH + 2; 
        const GRID_BOX_HEIGHT = GRID_HEIGHT + 2;

        // Kích thước Lớp phủ quân (Overlay): 9 cột x 10 dòng giao điểm
        const LAYER_WIDTH = 9 * CELL_SIZE;
        const LAYER_HEIGHT = 10 * CELL_SIZE;

        const LAYER_OFFSET = PADDING - (CELL_SIZE / 2);

        const style = document.createElement('style');
        style.id = 'xiangqi-renderer-styles';
        style.textContent = `
            /* Reset container cũ */
            .game-container .board-container, 
            #xiangqi-board {
                width: auto !important; height: auto !important;
                padding: 0 !important; margin: 0 !important;
                background: transparent !important; border: none !important;
                box-shadow: none !important; display: block !important;
            }

            /* Container chính */
            .board-wrapper {
                position: relative;
                width: ${WRAPPER_WIDTH}px;
                height: ${WRAPPER_HEIGHT}px;
                background: #d4a574;
                margin: 0 auto;
                border-radius: 12px;
                box-shadow: 0 15px 40px rgba(0,0,0,0.5);
                user-select: none;
                box-sizing: content-box;
                transition: transform 0.6s ease;
            }

            /* Lưới kẻ */
            .xiangqi-grid {
                position: absolute;
                top: ${PADDING}px;
                left: ${PADDING}px;
                width: ${GRID_BOX_WIDTH}px;
                height: ${GRID_BOX_HEIGHT}px;
                border: 2px solid #5d4037;
                z-index: 1;
                box-sizing: border-box;
            }

            .grid-table { width: 100%; height: 100%; border-collapse: collapse; }
            .grid-table td {
                border: 1px solid #5d4037;
                width: ${CELL_SIZE}px;
                height: ${CELL_SIZE}px;
                padding: 0; box-sizing: border-box;
            }
            .grid-table .river-cell {
                border-left: 1px solid #5d4037; border-right: 1px solid #5d4037;
                border-top: none; border-bottom: none;
            }

            .river-text {
                position: absolute;
                top: 50%; left: 0; width: 100%;
                transform: translateY(-50%);
                text-align: center;
                font-size: ${RIVER_FONT_SIZE}px;
                font-family: "KaiTi", "SimSun", serif;
                color: rgba(93, 64, 55, 0.4);
                pointer-events: none;
                letter-spacing: ${Math.round(CELL_SIZE * 0.6)}px;
                text-indent: ${Math.round(CELL_SIZE * 0.6)}px;
            }

            /* Lớp phủ chứa quân (Overlay) */
            .piece-layer {
                position: absolute;
                top: ${LAYER_OFFSET}px;
                left: ${LAYER_OFFSET}px;
                width: ${LAYER_WIDTH}px; 
                height: ${LAYER_HEIGHT}px;
                display: grid;
                grid-template-columns: repeat(9, ${CELL_SIZE}px);
                grid-template-rows: repeat(10, ${CELL_SIZE}px);
                z-index: 10;
                pointer-events: none;
            }

            .piece-spot {
                width: ${CELL_SIZE}px;
                height: ${CELL_SIZE}px;
                display: flex;
                justify-content: center;
                align-items: center;
                pointer-events: auto;
                cursor: pointer;
            }

            /* Quân cờ */
            .pieces {
                width: ${PIECE_SIZE}px;
                height: ${PIECE_SIZE}px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${FONT_SIZE}px;
                font-weight: bold;
                font-family: "KaiTi", "SimSun", serif;
                
                position: relative !important; 
                top: auto !important; left: auto !important; margin: 0 !important;
                
                box-shadow: 3px 5px 8px rgba(0,0,0,0.4);
                transition: transform 0.2s, box-shadow 0.2s;
                z-index: 20;
                background: #fdf5e6;
            }

            .pieces:hover {
                transform: scale(1.15);
                z-index: 30;
                cursor: pointer;
                box-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
            }

            .pieces.red {
                color: #cc0000;
                border: 3px solid #cc0000;
                box-shadow: inset 0 0 8px rgba(204,0,0,0.1), 2px 4px 6px rgba(0,0,0,0.3);
            }

            .pieces.black {
                color: #000;
                border: 3px solid #000;
                box-shadow: inset 0 0 8px rgba(0,0,0,0.1), 2px 4px 6px rgba(0,0,0,0.3);
            }

            .pieces.selected {
                background-color: #a5d6a7 !important;
                box-shadow: 0 0 0 4px #4caf50, 0 5px 15px rgba(0,0,0,0.4);
                transform: scale(1.15);
            }

            /* Xoay bàn cờ */
            .board-wrapper.flipped { transform: rotate(180deg); }
            .board-wrapper.flipped .pieces { transform: rotate(180deg); }
            .board-wrapper.flipped .river-text { transform: translateY(-50%) rotate(180deg); }
        `;
        document.head.appendChild(style);
    }

    createPiece(x, y, icon, color) {
        if (!this.isInitialized) return null;
        // index = x * 9 + y (hàng * số cột + cột)
        const index = x * 9 + y;
        const spot = this.elements.chessboardTable.children[index];
        
        if (!spot) return null;
        
        const div = document.createElement('div');
        div.setAttribute('data-color', color);
        div.classList.add('pieces', color);
        div.textContent = icon;
        
        spot.innerHTML = '';
        spot.appendChild(div);
        return div;
    }

    clearBoard() {
        if (!this.isInitialized || !this.elements.chessboardTable) return;
        const spots = this.elements.chessboardTable.children;
        for (let spot of spots) {
            spot.innerHTML = '';
        }
    }

    renderBoard(board) {
        if (!this.isInitialized) return;
        this.clearBoard();
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 9; j++) {
                if (board[i][j]) {
                    this.createPiece(i, j, board[i][j].icon, board[i][j].color);
                }
            }
        }
    }
    
    updateTurn(turn) {
        if (this.elements.turnText) {
            const isRed = turn === 'red';
            this.elements.turnText.innerHTML = isRed 
                ? `<span style="color:#e74c3c">🔴 Lượt Đỏ</span>` 
                : `<span style="color:#2c3e50">⚫ Lượt Đen</span>`;
        }
    }
    
    flipBoard(isFlipped) {
        const wrapper = this.boardContainer.querySelector('.board-wrapper');
        if (wrapper) {
            if (isFlipped) wrapper.classList.add('flipped');
            else wrapper.classList.remove('flipped');
        }
    }
}