// Main game controller - handles game logic and events

import { Board } from "./board.js";
import { Record } from "../models/record.js";
import { UI } from "../ui/renderer.js";
import { MoveNotation } from "../utils/moveNotation.js";

export class GameController {
    constructor(initialPosition) {
        this.chessboard = new Board();
        this.initialPosition = initialPosition;
        this.stack = []; // Move history
        this.ui = new UI();

        // Bind methods to this context
        this.boundChoosePiece = (e) => this.choosePiece(e);
        this.boundCancelPiece = (e) => this.cancelPiece(e);

        // Initialize board
        this.chessboard.initBoard(initialPosition);
        this.ui.renderBoard(this.chessboard.board);

        // Bind event handlers
        this.bindEvents();
        this.initListeners();
    }

    /**
     * Reset the game to the initial position (keeps the same controller instance)
     */
    reset() {
        // Clear move history
        this.stack = [];

        // Reinitialize board pieces
        if (this.initialPosition) {
            this.chessboard.initBoard(this.initialPosition);
        } else {
            // If no initial position saved, clear the board
            this.chessboard.initBoard([]);
        }

        // Reset chessboard state
        this.chessboard.turn = 'red';
        this.chessboard.status = true;
        this.chessboard.curPiece = null;
        this.chessboard.turnCnt = 0;

        // Clear and re-render UI
        if (this.ui && typeof this.ui.clearBoard === 'function') {
            this.ui.clearBoard();
            this.ui.renderBoard(this.chessboard.board);
        }

        // Re-bind listeners for the new board state
        this.initListeners();
    }

    bindEvents() {
        // Button events
        this.ui.buttons.newGame.addEventListener("click", () =>
            this.handleNewGame()
        );
        this.ui.buttons.resign.addEventListener("click", () =>
            this.handleResign()
        );
        this.ui.buttons.draw.addEventListener("click", () => this.handleDraw());

        // Board click events
        const cells = document.querySelectorAll("#chessboardContainer td");
        cells.forEach((cell) => {
            cell.addEventListener("click", (e) => this.handleBoardClick(e));
        });
    }

    handleNewGame() {
        location.reload();
    }

    handleResign() {
        const winner = this.chessboard.turn === "red" ? "Black" : "Red";
        this.ui.showWinner(winner);
        this.chessboard.status = false;
    }

    handleDraw() {
        alert("Request draw");
    }

    handleBoardClick(event) {
        if (!this.chessboard.status) {
            event.stopPropagation();
            return;
        }

        if (this.chessboard.curPiece) {
            const cell = event.currentTarget;
            const x = parseInt(cell.getAttribute("data-x"));
            const y = parseInt(cell.getAttribute("data-y"));

            const res = this.chessboard.movePiece(
                this.chessboard.curPiece,
                x,
                y
            );
            if (res) {
                this.executeMove(x, y);
            }
        }
        event.stopPropagation();
    }

    executeMove(newRow, newCol) {
        const curRow = this.chessboard.curPiece.row;
        const curCol = this.chessboard.curPiece.col;

        // Update board state
        this.chessboard.board[curRow][curCol] = null;
        this.chessboard.board[newRow][newCol] = this.chessboard.curPiece;

        // Update DOM
        const source = document.querySelector(
            `[data-x="${curRow}"][data-y="${curCol}"]`
        );
        const target = document.querySelector(
            `[data-x="${newRow}"][data-y="${newCol}"]`
        );
        const clickedPiece = source.querySelector("div");
        const targetPiece = target.children[0];

        source.removeChild(clickedPiece);
        if (targetPiece) {
            target.removeChild(targetPiece);
        }
        target.appendChild(clickedPiece);
        clickedPiece.style.backgroundColor = "#FAF0E6";

        // Record move
        this.recordMove(
            curRow,
            curCol,
            newRow,
            newCol,
            clickedPiece,
            targetPiece
        );

        // Switch turn
        this.switchTurn();

        // Update piece position
        this.chessboard.curPiece.row = newRow;
        this.chessboard.curPiece.col = newCol;
        this.chessboard.curPiece = null;

        // Check for check/checkmate
        this.checkGameStatus();

        // Update event listeners
        this.initListeners();
    }

    switchTurn() {
        this.chessboard.turn = this.chessboard.turn === "red" ? "black" : "red";
        this.ui.updateTurn(this.chessboard.turn);
    }

    checkGameStatus() {
        const checkRed = this.chessboard.isCheck("red", this.chessboard.board);
        const checkBlack = this.chessboard.isCheck(
            "black",
            this.chessboard.board
        );

        if (checkRed || checkBlack) {
            this.ui.updateCheckStatus("Check!");
            const isCheckmate = this.chessboard.isCheckMate(
                this.chessboard.turn,
                this.chessboard.board
            );

            if (isCheckmate) {
                const winner = this.chessboard.turn === "red" ? "Black" : "Red";
                this.ui.updateCheckStatus("Checkmate!");
                this.ui.showWinner(winner);
                this.chessboard.status = false;
            }
        } else {
            this.ui.updateCheckStatus("");
        }
    }

    recordMove(curRow, curCol, newRow, newCol, clickedPiece, targetPiece) {
        const moveTable = document.getElementById("movesRecords");
        const record = new Record(
            curRow,
            curCol,
            newRow,
            newCol,
            clickedPiece,
            targetPiece
        );
        this.stack.push(record);

        if (this.chessboard.turn === "red") {
            this.chessboard.turnCnt++;
            const moveRow = moveTable.insertRow();
            moveRow.setAttribute("class", "moveRow");
            moveRow.setAttribute("data-turn", this.chessboard.turnCnt);

            const turnContainer = document.createElement("td");
            turnContainer.setAttribute("class", "turnCnt");
            turnContainer.innerHTML = this.chessboard.turnCnt;

            const redMoveContainer = document.createElement("td");
            redMoveContainer.setAttribute("class", "redMove");

            const blackMoveContainer = document.createElement("td");
            blackMoveContainer.setAttribute("class", "blackMove");

            moveRow.appendChild(turnContainer);
            moveRow.appendChild(redMoveContainer);
            moveRow.appendChild(blackMoveContainer);

            // Generate notation
            const notation = MoveNotation.generateRedNotation(
                this.chessboard.curPiece,
                curRow,
                curCol,
                newRow,
                newCol
            );
            redMoveContainer.innerHTML = notation;
        } else {
            const moveRow = document.querySelector(
                `[data-turn="${this.chessboard.turnCnt}"]`
            );
            const blackMoveContainer =
                moveRow.getElementsByClassName("blackMove")[0];

            // Generate notation
            const notation = MoveNotation.generateBlackNotation(
                this.chessboard.curPiece,
                curRow,
                curCol,
                newRow,
                newCol
            );
            blackMoveContainer.innerHTML = notation;
        }
    }

    choosePiece(event) {
        if (!this.chessboard.status) {
            event.stopPropagation();
            return;
        }

        const clickedPiece = event.target;
        if (this.chessboard.turn !== clickedPiece.getAttribute("data-color")) {
            return;
        }

        if (clickedPiece.classList.contains("pieces")) {
            const x = parseInt(clickedPiece.parentNode.getAttribute("data-x"));
            const y = parseInt(clickedPiece.parentNode.getAttribute("data-y"));
            this.chessboard.curPiece = this.chessboard.board[x][y];
        }

        if (
            this.chessboard.turn === clickedPiece.getAttribute("data-color") &&
            this.chessboard.curPiece
        ) {
            clickedPiece.style.backgroundColor = "#B0E0E6";
            event.stopPropagation();
        }

        this.initListeners();
    }

    cancelPiece(event) {
        const clickedPiece = event.target;
        let selectedPiece = null;

        if (clickedPiece) {
            const x = parseInt(clickedPiece.parentNode.getAttribute("data-x"));
            const y = parseInt(clickedPiece.parentNode.getAttribute("data-y"));
            selectedPiece = this.chessboard.board[x][y];
        }

        if (
            this.chessboard.status &&
            this.chessboard.curPiece &&
            this.chessboard.curPiece === selectedPiece
        ) {
            clickedPiece.style.backgroundColor = "#FAF0E6";
            this.chessboard.curPiece = null;
        }

        this.initListeners();
    }

    initListeners() {
        const pieces = document.getElementsByClassName("pieces");
        for (let i = 0; i < pieces.length; i++) {
            // Remove old listeners
            pieces[i].removeEventListener("click", this.boundChoosePiece);
            pieces[i].removeEventListener("click", this.boundCancelPiece);

            // Add new listeners based on game state
            if (!this.chessboard.curPiece) {
                pieces[i].addEventListener(
                    "click",
                    this.boundChoosePiece,
                    false
                );
            } else {
                pieces[i].addEventListener(
                    "click",
                    this.boundCancelPiece,
                    false
                );
            }
        }
    }
}
