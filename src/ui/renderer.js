// UI rendering and DOM manipulation

export class UI {
    constructor() {
        this.initBoardShape();
        this.initChessboard();
        this.initGameInfo();
        this.initControls();
        this.initMoveRecords();
    }

    // Set board shape (visual grid)
    initBoardShape() {
        window.main = document.createElement("div");
        main.setAttribute("id", "mainContainer");
        document.body.appendChild(main);

        window.table = document.createElement("table");
        window.tBody = document.createElement("tBody");
        table.classList.add("board");

        for (let i = 0; i < 9; i++) {
            const row = tBody.insertRow(i);
            for (let j = 0; j < 8; j++) {
                const cell = row.insertCell(j);
                if (i !== 4) {
                    cell.classList.add("board");
                }
            }
        }

        table.style.position = "absolute";
        table.style.top = "200px";
        table.style.left = "280px";
        table.appendChild(tBody);
        main.appendChild(table);
    }

    // Generate clickable chessboard
    initChessboard() {
        window.table = document.createElement("table");
        window.tBody = document.createElement("tBody");

        for (let i = 0; i < 10; i++) {
            window.row = tBody.insertRow(i);
            for (let j = 0; j < 9; j++) {
                const cell = row.insertCell(j);
                cell.setAttribute("data-x", i);
                cell.setAttribute("data-y", j);
            }
        }

        table.setAttribute("id", "chessboardContainer");
        table.appendChild(tBody);
        table.style.position = "absolute";
        table.style.top = "170px";
        table.style.left = "250px";
        main.appendChild(table);
    }

    // Game status text
    initGameInfo() {
        // Check status
        window.checkText = document.createElement("h1");
        checkText.style.display = "inline";
        checkText.innerHTML = "";
        checkText.style.position = "absolute";
        checkText.style.top = "150px";
        checkText.style.left = "1000px";
        document.body.appendChild(checkText);

        // Game status
        window.beginText = document.createElement("h1");
        beginText.style.display = "inline";
        beginText.innerHTML = "Game Start";
        beginText.setAttribute("id", "beginText");
        beginText.style.position = "absolute";
        beginText.style.top = "200px";
        beginText.style.left = "1000px";
        document.body.appendChild(beginText);

        // Turn indicator
        window.turnText = document.createElement("h1");
        turnText.innerHTML = "Red Turn";
        turnText.style.position = "absolute";
        turnText.style.top = "250px";
        turnText.style.left = "1000px";
        document.body.appendChild(turnText);
    }

    // Control buttons
    initControls() {
        const btnContainer = document.createElement("div");
        btnContainer.setAttribute("id", "btnContainer");
        btnContainer.style.position = "absolute";
        btnContainer.style.top = "330px";
        btnContainer.style.left = "1000px";
        document.body.appendChild(btnContainer);

        // New Game button
        const newGameBtn = document.createElement("button");
        newGameBtn.innerHTML = "New Game";
        newGameBtn.setAttribute("class", "funcBtn");
        btnContainer.appendChild(newGameBtn);

        // Resign button
        const resignBtn = document.createElement("button");
        resignBtn.innerHTML = "Resign";
        resignBtn.setAttribute("class", "funcBtn");
        btnContainer.appendChild(resignBtn);

        // Draw button
        const drawBtn = document.createElement("button");
        drawBtn.innerHTML = "Request Draw";
        drawBtn.setAttribute("class", "funcBtn");
        btnContainer.appendChild(drawBtn);

        // Store button references
        this.buttons = {
            newGame: newGameBtn,
            resign: resignBtn,
            draw: drawBtn,
        };
    }

    // Move records table
    initMoveRecords() {
        const movesContainer = document.createElement("div");
        movesContainer.setAttribute("id", "movesContainer");
        movesContainer.style.position = "absolute";
        movesContainer.style.top = "410px";
        movesContainer.style.left = "1000px";
        movesContainer.style.width = "700px";
        movesContainer.style.height = "430px";
        movesContainer.style.backgroundColor = "lightgray";
        movesContainer.style.overflow = "auto";
        document.body.appendChild(movesContainer);

        const moveTable = document.createElement("table");
        moveTable.setAttribute("id", "movesRecords");
        movesContainer.appendChild(moveTable);

        // Table header
        const headerRow = moveTable.insertRow();
        const turnHeader = document.createElement("th");
        turnHeader.innerHTML = "Turn";
        turnHeader.style.paddingLeft = "75px";
        turnHeader.style.paddingRight = "75px";
        headerRow.appendChild(turnHeader);

        const redActionHeader = document.createElement("th");
        redActionHeader.innerHTML = "Red Action";
        redActionHeader.style.padding = "0 115px";
        headerRow.appendChild(redActionHeader);

        const blackActionHeader = document.createElement("th");
        blackActionHeader.innerHTML = "Black Action";
        blackActionHeader.style.paddingLeft = "75px";
        blackActionHeader.style.paddingRight = "75px";
        headerRow.appendChild(blackActionHeader);
    }

    // Create piece element on board
    createPiece(x, y, icon, color) {
        const div = document.createElement("div");
        div.setAttribute("data-color", color);
        div.classList.add("pieces");
        div.classList.add(color);
        div.appendChild(document.createTextNode(icon));
        tBody.rows[x].cells[y].appendChild(div);
        return div;
    }

    // Remove all pieces from board
    clearBoard() {
        for (let i = 0; i <= 9; i++) {
            for (let j = 0; j <= 8; j++) {
                const piece = tBody.rows[i].cells[j].querySelector("div");
                if (piece) {
                    piece.remove();
                }
            }
        }
    }

    // Render pieces on board
    renderBoard(board) {
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
        turnText.innerHTML = turn === "red" ? "Red Turn" : "Black Turn";
    }

    // Update check status
    updateCheckStatus(status) {
        checkText.innerHTML = status;
    }

    // Update game status
    updateGameStatus(status) {
        beginText.innerHTML = status;
    }

    // Show winner
    showWinner(winner) {
        turnText.innerHTML = winner + " Win!";
        beginText.innerHTML = "Game End";
    }
}
