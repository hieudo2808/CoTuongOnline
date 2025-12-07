// UI rendering and DOM manipulation
// Modern version using existing HTML containers (Flexbox compatible)

export class UI {
    constructor(boardContainerId = null) {
        this.boardContainerId = boardContainerId;
        this.boardContainer = boardContainerId ? document.getElementById(boardContainerId) : null;
        
        // Store references to UI elements
        this.elements = {
            checkText: null,
            beginText: null,
            turnText: null,
            movesList: null,
            chessboardTable: null,
            boardShapeTable: null
        };
        
        // Button references
        this.buttons = {
            newGame: null,
            resign: null,
            draw: null
        };
        
        // Determine mode:
        // 1. If boardContainerId is null -> skip initialization (lazy mode)
        // 2. If boardContainerId provided but element not found -> throw error
        // 3. If boardContainerId provided and element found -> modern mode
        
        if (boardContainerId === null) {
            // Lazy mode - don't initialize anything yet
            this.isLegacyMode = false;
            this.isInitialized = false;
            console.log('[UI] Lazy mode - no container provided, skipping initialization');
            return;
        }
        
        if (!this.boardContainer) {
            console.error(`[UI] Container "${boardContainerId}" not found! Make sure the element exists in the DOM.`);
            throw new Error(`UI container "${boardContainerId}" not found. Cannot initialize game board.`);
        }
        
        this.isLegacyMode = false;
        this.isInitialized = true;
        
        // Modern mode: use existing HTML containers
        this.initModernMode();
    }

    /**
     * Initialize or reinitialize UI with a container ID
     * Used for lazy initialization after initial construction
     */
    initialize(boardContainerId) {
        if (this.isInitialized) {
            console.log('[UI] Already initialized');
            return true;
        }
        
        if (!boardContainerId) {
            throw new Error('Container ID is required for initialization');
        }
        
        this.boardContainerId = boardContainerId;
        this.boardContainer = document.getElementById(boardContainerId);
        
        if (!this.boardContainer) {
            console.error(`[UI] Container "${boardContainerId}" not found!`);
            throw new Error(`UI container "${boardContainerId}" not found. Cannot initialize game board.`);
        }
        
        this.isLegacyMode = false;
        this.isInitialized = true;
        
        this.initModernMode();
        console.log('[UI] Lazy initialization completed');
        return true;
    }

    // ==========================================
    // MODERN MODE - Uses existing HTML structure
    // ==========================================
    
    initModernMode() {
        console.log('[UI] Initializing in modern mode with container:', this.boardContainerId);
        
        // Create board inside existing container
        this.initModernBoard();
        
        // Bind to existing UI elements
        this.bindExistingElements();
    }
    
    initModernBoard() {
        // Clear the container first
        this.boardContainer.innerHTML = '';
        
        // Create board wrapper with proper styling
        const boardWrapper = document.createElement('div');
        boardWrapper.className = 'board-container';
        
        // Create the visual board grid (9x9 lines = 8x9 cells for display)
        const boardShape = document.createElement('table');
        boardShape.className = 'board-shape';
        const shapeBody = document.createElement('tbody');
        
        for (let i = 0; i < 9; i++) {
            const row = shapeBody.insertRow(i);
            for (let j = 0; j < 8; j++) {
                const cell = row.insertCell(j);
                if (i !== 4) {
                    cell.className = 'board-cell';
                } else {
                    cell.className = 'river-cell';
                }
            }
        }
        boardShape.appendChild(shapeBody);
        this.elements.boardShapeTable = boardShape;
        
        // Create the clickable chessboard overlay (10x9 for pieces)
        const chessboard = document.createElement('table');
        chessboard.id = 'chessboardContainer';
        chessboard.className = 'chessboard-overlay';
        const chessBody = document.createElement('tbody');
        
        for (let i = 0; i < 10; i++) {
            const row = chessBody.insertRow(i);
            for (let j = 0; j < 9; j++) {
                const cell = row.insertCell(j);
                cell.setAttribute('data-x', i);
                cell.setAttribute('data-y', j);
                cell.className = 'chess-cell';
            }
        }
        chessboard.appendChild(chessBody);
        this.elements.chessboardTable = chessboard;
        
        // Store tbody reference for piece manipulation
        window.tBody = chessBody;
        
        // Add river text
        const riverOverlay = document.createElement('div');
        riverOverlay.className = 'board-river';
        riverOverlay.textContent = '楚 河 漢 界';
        
        // Assemble the board
        boardWrapper.appendChild(boardShape);
        boardWrapper.appendChild(chessboard);
        boardWrapper.appendChild(riverOverlay);
        
        this.boardContainer.appendChild(boardWrapper);
        
        // Add modern board styles
        this.injectModernStyles();
    }
    
    bindExistingElements() {
        // Use existing elements from app.html if available
        this.elements.turnText = document.getElementById('turn-text');
        this.elements.movesList = document.getElementById('moves-list');
        
        // Bind existing buttons (if present)
        this.buttons.resign = document.getElementById('btn-resign');
        this.buttons.draw = document.getElementById('btn-draw-offer');
        this.buttons.newGame = document.getElementById('btn-new-game');
        
        // Create dummy buttons if not found (for compatibility)
        if (!this.buttons.resign) {
            this.buttons.resign = this.createDummyButton();
        }
        if (!this.buttons.draw) {
            this.buttons.draw = this.createDummyButton();
        }
        if (!this.buttons.newGame) {
            this.buttons.newGame = this.createDummyButton();
        }
    }
    
    createDummyButton() {
        const btn = document.createElement('button');
        btn.style.display = 'none';
        return btn;
    }
    
    injectModernStyles() {
        // Check if styles already injected
        if (document.getElementById('ui-renderer-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'ui-renderer-styles';
        styles.textContent = `
            .board-container {
                position: relative;
                display: inline-block;
                background: #d4a574;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            .board-shape {
                border-collapse: collapse;
            }
            
            .board-shape td {
                width: 62px;
                height: 62px;
                border: 1px solid #000;
            }
            
            .board-shape .river-cell {
                border-left: 1px solid #000;
                border-right: 1px solid #000;
                border-top: none;
                border-bottom: none;
            }
            
            .chessboard-overlay {
                position: absolute;
                top: 20px;
                left: 20px;
                border-collapse: collapse;
                z-index: 10;
            }
            
            .chessboard-overlay td {
                width: 62px;
                height: 62px;
                cursor: pointer;
                position: relative;
            }
            
            .chessboard-overlay td:hover {
                background: rgba(255, 255, 0, 0.2);
            }
            
            .board-river {
                position: absolute;
                left: 20px;
                right: 20px;
                top: calc(50% - 31px);
                height: 62px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                font-weight: bold;
                color: rgba(0, 0, 0, 0.3);
                letter-spacing: 40px;
                padding-left: 40px;
                pointer-events: none;
                z-index: 5;
            }
            
            .pieces {
                margin: 5px auto;
                height: 50px;
                width: 50px;
                border: 2px solid #333;
                border-radius: 50%;
                text-align: center;
                font-family: 'SimSun', 'FangSong', serif;
                font-size: 28px;
                font-weight: bold;
                background: linear-gradient(145deg, #fff8dc, #f5deb3);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .pieces:hover {
                transform: scale(1.1);
                box-shadow: 0 5px 12px rgba(0, 0, 0, 0.4);
            }
            
            .pieces.red {
                color: #dc3545;
                border-color: #dc3545;
            }
            
            .pieces.black {
                color: #000;
                border-color: #000;
            }
            
            .pieces.selected {
                transform: scale(1.15);
                box-shadow: 0 0 0 4px rgba(255, 215, 0, 0.6), 0 5px 15px rgba(0, 0, 0, 0.5);
            }
        `;
        document.head.appendChild(styles);
    }

    // ==========================================
    // LEGACY MODE - Creates all elements from scratch
    // ==========================================
    
    initLegacyMode() {
        console.log('[UI] Initializing in legacy mode (creating all elements)');
        this.initBoardShape();
        this.initChessboard();
        this.initGameInfo();
        this.initControls();
        this.initMoveRecords();
    }

    initBoardShape() {
        window.main = document.createElement('div');
        main.setAttribute('id', 'mainContainer');
        main.style.position = 'relative';
        main.style.display = 'flex';
        main.style.justifyContent = 'center';
        main.style.padding = '20px';
        main.style.flexWrap = 'wrap';
        main.style.gap = '30px';
        document.body.appendChild(main);

        const boardShape = document.createElement('table');
        const shapeBody = document.createElement('tbody');
        boardShape.classList.add('board');

        for (let i = 0; i < 9; i++) {
            const row = shapeBody.insertRow(i);
            for (let j = 0; j < 8; j++) {
                const cell = row.insertCell(j);
                if (i !== 4) {
                    cell.classList.add('board');
                }
            }
        }

        boardShape.appendChild(shapeBody);
        this.elements.boardShapeTable = boardShape;
        
        // Create board container
        const boardContainer = document.createElement('div');
        boardContainer.className = 'board-container';
        boardContainer.style.position = 'relative';
        boardContainer.appendChild(boardShape);
        main.appendChild(boardContainer);
        
        this.legacyBoardContainer = boardContainer;
    }

    initChessboard() {
        const chessboard = document.createElement('table');
        window.tBody = document.createElement('tbody');

        for (let i = 0; i < 10; i++) {
            const row = tBody.insertRow(i);
            for (let j = 0; j < 9; j++) {
                const cell = row.insertCell(j);
                cell.setAttribute('data-x', i);
                cell.setAttribute('data-y', j);
            }
        }

        chessboard.setAttribute('id', 'chessboardContainer');
        chessboard.style.position = 'absolute';
        chessboard.style.top = '0';
        chessboard.style.left = '0';
        chessboard.appendChild(tBody);
        
        this.elements.chessboardTable = chessboard;
        
        if (this.legacyBoardContainer) {
            this.legacyBoardContainer.appendChild(chessboard);
        }
    }

    initGameInfo() {
        const infoContainer = document.createElement('div');
        infoContainer.className = 'game-info-panel';
        infoContainer.style.display = 'flex';
        infoContainer.style.flexDirection = 'column';
        infoContainer.style.gap = '15px';
        infoContainer.style.minWidth = '250px';

        // Check status
        window.checkText = document.createElement('h2');
        checkText.className = 'check-status';
        checkText.innerHTML = '';
        this.elements.checkText = checkText;
        infoContainer.appendChild(checkText);

        // Game status
        window.beginText = document.createElement('h2');
        beginText.innerHTML = 'Game Start';
        beginText.setAttribute('id', 'beginText');
        beginText.className = 'game-status';
        this.elements.beginText = beginText;
        infoContainer.appendChild(beginText);

        // Turn indicator
        window.turnText = document.createElement('h2');
        turnText.innerHTML = 'Red Turn';
        turnText.className = 'turn-indicator-text';
        this.elements.turnText = turnText;
        infoContainer.appendChild(turnText);

        main.appendChild(infoContainer);
        this.legacyInfoContainer = infoContainer;
    }

    initControls() {
        const btnContainer = document.createElement('div');
        btnContainer.setAttribute('id', 'btnContainer');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginTop = '20px';
        btnContainer.style.flexWrap = 'wrap';
        
        if (this.legacyInfoContainer) {
            this.legacyInfoContainer.appendChild(btnContainer);
        }

        // New Game button
        const newGameBtn = document.createElement('button');
        newGameBtn.innerHTML = 'New Game';
        newGameBtn.setAttribute('class', 'funcBtn');
        newGameBtn.style.padding = '10px 20px';
        newGameBtn.style.cursor = 'pointer';
        btnContainer.appendChild(newGameBtn);

        // Resign button
        const resignBtn = document.createElement('button');
        resignBtn.innerHTML = 'Resign';
        resignBtn.setAttribute('class', 'funcBtn');
        resignBtn.style.padding = '10px 20px';
        resignBtn.style.cursor = 'pointer';
        btnContainer.appendChild(resignBtn);

        // Draw button
        const drawBtn = document.createElement('button');
        drawBtn.innerHTML = 'Request Draw';
        drawBtn.setAttribute('class', 'funcBtn');
        drawBtn.style.padding = '10px 20px';
        drawBtn.style.cursor = 'pointer';
        btnContainer.appendChild(drawBtn);

        this.buttons = {
            newGame: newGameBtn,
            resign: resignBtn,
            draw: drawBtn
        };
    }

    initMoveRecords() {
        const movesContainer = document.createElement('div');
        movesContainer.setAttribute('id', 'movesContainer');
        movesContainer.style.marginTop = '20px';
        movesContainer.style.width = '100%';
        movesContainer.style.maxHeight = '300px';
        movesContainer.style.backgroundColor = '#f8f9fa';
        movesContainer.style.borderRadius = '8px';
        movesContainer.style.overflow = 'auto';
        movesContainer.style.padding = '15px';
        
        if (this.legacyInfoContainer) {
            this.legacyInfoContainer.appendChild(movesContainer);
        }

        const moveTable = document.createElement('table');
        moveTable.setAttribute('id', 'movesRecords');
        moveTable.style.width = '100%';
        moveTable.style.borderCollapse = 'collapse';
        movesContainer.appendChild(moveTable);

        // Table header
        const headerRow = moveTable.insertRow();
        headerRow.style.backgroundColor = '#e9ecef';
        
        const turnHeader = document.createElement('th');
        turnHeader.innerHTML = 'Turn';
        turnHeader.style.padding = '8px';
        turnHeader.style.textAlign = 'center';
        headerRow.appendChild(turnHeader);

        const redActionHeader = document.createElement('th');
        redActionHeader.innerHTML = 'Red';
        redActionHeader.style.padding = '8px';
        redActionHeader.style.textAlign = 'center';
        headerRow.appendChild(redActionHeader);

        const blackActionHeader = document.createElement('th');
        blackActionHeader.innerHTML = 'Black';
        blackActionHeader.style.padding = '8px';
        blackActionHeader.style.textAlign = 'center';
        headerRow.appendChild(blackActionHeader);
        
        this.elements.movesList = movesContainer;
    }

    // ==========================================
    // SHARED METHODS - Work in both modes
    // ==========================================

    // Create piece element on board
    createPiece(x, y, icon, color) {
        if (!this.isInitialized) {
            console.warn('[UI] Cannot create piece: UI not initialized');
            return null;
        }
        
        const tbody = window.tBody || this.elements.chessboardTable?.querySelector('tbody');
        if (!tbody || !tbody.rows[x] || !tbody.rows[x].cells[y]) {
            console.warn('[UI] Cannot create piece: invalid position', x, y);
            return null;
        }
        
        const div = document.createElement('div');
        div.setAttribute('data-color', color);
        div.classList.add('pieces');
        div.classList.add(color);
        div.appendChild(document.createTextNode(icon));
        tbody.rows[x].cells[y].appendChild(div);
        return div;
    }

    // Remove all pieces from board
    clearBoard() {
        if (!this.isInitialized) return;
        
        const tbody = window.tBody || this.elements.chessboardTable?.querySelector('tbody');
        if (!tbody) return;
        
        for (let i = 0; i <= 9; i++) {
            for (let j = 0; j <= 8; j++) {
                if (tbody.rows[i] && tbody.rows[i].cells[j]) {
                    const piece = tbody.rows[i].cells[j].querySelector('div');
                    if (piece) {
                        piece.remove();
                    }
                }
            }
        }
    }

    // Render pieces on board
    renderBoard(board) {
        if (!this.isInitialized) {
            console.warn('[UI] Cannot render board: UI not initialized');
            return;
        }
        
        for (let i = 0; i <= 9; i++) {
            for (let j = 0; j <= 8; j++) {
                const piece = board[i][j];
                if (piece) {
                    this.createPiece(i, j, piece.icon, piece.color);
                }
            }
        }
    }

    // Update turn display
    updateTurn(turn) {
        if (!this.isInitialized) return;
        
        const turnElement = this.elements.turnText || window.turnText;
        if (turnElement) {
            if (this.isLegacyMode) {
                turnElement.innerHTML = turn === 'red' ? 'Red Turn' : 'Black Turn';
            } else {
                // Modern mode - use emoji indicators
                const turnEmoji = turn === 'red' ? '🔴' : '⚫';
                const turnText = turn === 'red' ? 'Lượt Đỏ' : 'Lượt Đen';
                turnElement.innerHTML = `${turnEmoji} ${turnText}`;
            }
        }
    }

    // Update check status
    updateCheckStatus(status) {
        const checkElement = this.elements.checkText || window.checkText;
        if (checkElement) {
            checkElement.innerHTML = status;
        }
    }

    // Update game status
    updateGameStatus(status) {
        const beginElement = this.elements.beginText || window.beginText;
        if (beginElement) {
            beginElement.innerHTML = status;
        }
    }

    // Show winner
    showWinner(winner) {
        this.updateTurn('');
        const turnElement = this.elements.turnText || window.turnText;
        if (turnElement) {
            turnElement.innerHTML = `🏆 ${winner} Thắng!`;
        }
        this.updateGameStatus('Game Over');
    }
    
    // Add move to history (modern mode)
    addMoveToHistory(moveNumber, redMove, blackMove = '') {
        const movesList = this.elements.movesList || document.getElementById('moves-list');
        if (!movesList) return;
        
        const moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        moveItem.innerHTML = `
            <span class="move-number">${moveNumber}.</span>
            <span class="red-move">${redMove}</span>
            ${blackMove ? `<span class="black-move">${blackMove}</span>` : ''}
        `;
        movesList.appendChild(moveItem);
        movesList.scrollTop = movesList.scrollHeight;
    }
    
    // Clear move history
    clearMoveHistory() {
        const movesList = this.elements.movesList || document.getElementById('moves-list');
        if (movesList) {
            movesList.innerHTML = '';
        }
    }
}
