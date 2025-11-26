// Chess move notation generator

export class MoveNotation {
    // Generate Red move notation
    static generateRedNotation(piece, curRow, curCol, newRow, newCol) {
        const curType = piece.type;
        const rowChange = curRow - newRow;
        let text = "";

        if (
            curType === "pawn" ||
            curType === "chariot" ||
            curType === "cannon" ||
            curType === "general"
        ) {
            if (curType === "pawn") text += "P";
            if (curType === "chariot") text += "R";
            if (curType === "cannon") text += "C";
            if (curType === "general") text += "K";

            if (rowChange > 0) {
                text += 10 - curRow + "+" + rowChange;
            } else if (rowChange < 0) {
                text += 10 - curRow + "" + rowChange;
            } else {
                text += curCol + 1 + "=" + (newCol + 1);
            }
        } else if (
            curType === "horse" ||
            curType === "advisor" ||
            curType === "elephant"
        ) {
            if (curType === "horse") text += "N";
            if (curType === "advisor") text += "A";
            if (curType === "elephant") text += "B";

            if (rowChange > 0) {
                text += curCol + 1 + "+" + (newCol + 1);
            } else {
                text += curCol + 1 + "-" + (newCol + 1);
            }
        }

        return text;
    }

    // Generate Black move notation
    static generateBlackNotation(piece, curRow, curCol, newRow, newCol) {
        const curType = piece.type;
        const rowChange = newRow - curRow;
        let text = "";

        if (
            curType === "pawn" ||
            curType === "chariot" ||
            curType === "cannon" ||
            curType === "general"
        ) {
            if (curType === "pawn") text += "p";
            if (curType === "chariot") text += "r";
            if (curType === "cannon") text += "c";
            if (curType === "general") text += "k";

            if (rowChange > 0) {
                text += 10 - curRow + "+" + rowChange;
            } else if (rowChange < 0) {
                text += 10 - curRow + "" + rowChange;
            } else {
                text += curCol + 1 + "=" + (newCol + 1);
            }
        } else if (
            curType === "horse" ||
            curType === "advisor" ||
            curType === "elephant"
        ) {
            if (curType === "horse") text += "n";
            if (curType === "advisor") text += "a";
            if (curType === "elephant") text += "b";

            if (rowChange > 0) {
                text += curCol + 1 + "+" + (newCol + 1);
            } else {
                text += curCol + 1 + "-" + (newCol + 1);
            }
        }

        return text;
    }
}
