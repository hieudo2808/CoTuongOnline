// src/ui/renderer.js
export class UI {
    constructor(boardContainerId = null) {
        this.boardContainerId = boardContainerId;
        this.boardContainer = boardContainerId ? document.getElementById(boardContainerId) : null;
        
        this.elements = {
            checkText: null,
            beginText: null,
            turnText: null,
            movesList: null,
            chessboardTable: null
        };
        
        this.buttons = { newGame: null, resign: null, draw: null };
        
        if (!this.boardContainer) {
            // Lazy mode
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
        boardWrapper.className = 'board-wrapper'; // Đổi tên class để tránh xung đột css cũ
        
        // 1. Lớp hình ảnh bàn cờ (Background Grid)
        const boardShape = document.createElement('div');
        boardShape.className = 'xiangqi-grid';
        
        // Vẽ 9 dòng ngang, 8 dòng dọc (tạo ra 9x10 giao điểm)
        // Cách vẽ mới: Sử dụng CSS Grid/Flex để vẽ đường kẻ thay vì Table để chính xác hơn
        let gridHtml = '';
        
        // Vẽ 4 ô vuông lưới (Sở hà hán giới ở giữa)
        // Đây là cách đơn giản: Dùng ảnh nền hoặc CSS border
        // Ở đây ta dùng cấu trúc Table cũ cho Grid nhưng fix CSS cứng
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

        // 2. Lớp chứa quân cờ (Piece Overlay) - Quan trọng: Phải đè đúng lên giao điểm
        const chessboard = document.createElement('div');
        chessboard.id = 'chessboardContainer';
        chessboard.className = 'piece-layer';
        
        // Tạo 90 điểm đặt quân (10 hàng x 9 cột)
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const spot = document.createElement('div');
                spot.className = 'piece-spot';
                spot.setAttribute('data-x', r);
                spot.setAttribute('data-y', c);
                // Spot này sẽ chứa quân cờ (div.pieces)
                chessboard.appendChild(spot);
            }
        }
        
        // Lưu tham chiếu để render quân
        this.elements.chessboardTable = chessboard; // Giữ tên cũ để tương thích controller
        
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
        const style = document.createElement('style');
        style.id = 'xiangqi-renderer-styles';
        style.textContent = `
            /* Container chính */
            .board-wrapper {
                position: relative;
                width: 520px; /* 8 cols * 60px + padding */
                height: 580px; /* 9 rows * 60px + padding */
                background: #d4a574;
                margin: 20px auto;
                padding: 40px; /* Padding tạo lề bàn cờ */
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                user-select: none;
                transition: transform 0.6s ease-in-out;
            }

            /* Lưới bàn cờ (Nằm dưới) */
            .xiangqi-grid {
                position: relative;
                width: 100%;
                height: 100%;
                border: 2px solid #5d4037;
            }

            .grid-table {
                width: 100%;
                height: 100%;
                border-collapse: collapse;
            }

            .grid-table td {
                border: 1px solid #5d4037;
                width: 12.5%; /* 100% / 8 ô */
                height: 11.1%; /* 100% / 9 ô */
            }
            
            .grid-table .river-cell {
                border-left: 1px solid #5d4037;
                border-right: 1px solid #5d4037;
                border-top: none;
                border-bottom: none;
            }

            .river-text {
                position: absolute;
                top: 50%;
                left: 0;
                width: 100%;
                transform: translateY(-50%);
                text-align: center;
                font-size: 32px;
                color: rgba(93, 64, 55, 0.3);
                pointer-events: none;
            }

            /* Lớp chứa quân cờ (Nằm đè lên lưới) */
            .piece-layer {
                position: absolute;
                /* Mở rộng ra ngoài lưới để tâm quân cờ trùng giao điểm */
                top: 10px; /* 40px padding - 30px (nửa quân cờ) */
                left: 10px;
                width: 580px;
                height: 640px;
                display: grid;
                grid-template-columns: repeat(9, 1fr); /* 9 cột giao điểm */
                grid-template-rows: repeat(10, 1fr);   /* 10 hàng giao điểm */
                z-index: 10;
                pointer-events: none; /* Để click xuyên qua nếu cần, nhưng piece sẽ có pointer-events auto */
            }

            /* Điểm neo quân cờ */
            .piece-spot {
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                pointer-events: auto; /* Bắt sự kiện click */
                cursor: pointer;
            }

            /* Quân cờ */
            .pieces {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                font-weight: bold;
                font-family: "KaiTi", "SimSun", serif;
                box-shadow: 2px 2px 5px rgba(0,0,0,0.4);
                transition: transform 0.2s, box-shadow 0.2s;
                position: relative;
                z-index: 20;
            }

            .pieces:hover {
                transform: scale(1.15) !important;
                z-index: 30;
                cursor: pointer;
            }

            .pieces.red {
                background: #fdf5e6;
                color: #cc0000;
                border: 4px solid #cc0000;
            }

            .pieces.black {
                background: #fdf5e6;
                color: #000;
                border: 4px solid #000;
            }

            .pieces.selected {
                background-color: #81c784 !important;
                box-shadow: 0 0 15px #81c784;
                transform: scale(1.15);
            }

            /* --- Xoay bàn cờ --- */
            .board-wrapper.flipped {
                transform: rotate(180deg);
            }

            /* Xoay ngược quân cờ để nó đứng thẳng khi bàn cờ xoay */
            .board-wrapper.flipped .pieces {
                transform: rotate(180deg);
            }
        `;
        document.head.appendChild(style);
    }

    // --- Helper Methods ---

    createPiece(x, y, icon, color) {
        if (!this.isInitialized) return null;
        
        // Tìm đúng spot theo x (row) và y (col)
        // piece-layer là Grid container, children theo thứ tự row-major
        // index = x * 9 + y
        const index = x * 9 + y;
        const spot = this.elements.chessboardTable.children[index];
        
        if (!spot) {
            console.error(`Invalid coordinates: ${x}, ${y}`);
            return null;
        }
        
        const div = document.createElement('div');
        div.setAttribute('data-color', color);
        div.classList.add('pieces', color);
        div.textContent = icon;
        
        spot.innerHTML = ''; // Xóa quân cũ nếu có
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
    
    // Giữ lại các hàm cũ nhưng update DOM
    updateTurn(turn) {
        if (this.elements.turnText) {
            const isRed = turn === 'red';
            this.elements.turnText.innerHTML = isRed 
                ? `<span style="color:#e74c3c">🔴 Lượt Đỏ</span>` 
                : `<span style="color:#2c3e50">⚫ Lượt Đen</span>`;
        }
    }
    
    updateCheckStatus(msg) { /* ... */ }
    showWinner(winner) { alert(winner + " thắng!"); }
    
    // Support flip
    flipBoard(isFlipped) {
        const wrapper = this.boardContainer.querySelector('.board-wrapper');
        if (wrapper) {
            if (isFlipped) wrapper.classList.add('flipped');
            else wrapper.classList.remove('flipped');
        }
    }
}