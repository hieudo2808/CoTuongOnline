// Main entry point
import { GameController } from "./src/core/gameController.js";
import { OPENING_POSITION, parsePosition } from "./src/core/config.js";

// Initialize game with opening position
const initialPosition = parsePosition(OPENING_POSITION);
const game = new GameController(initialPosition);

// Initialize piece listeners on load
window.addEventListener("load", () => {
    game.initListeners();
});
