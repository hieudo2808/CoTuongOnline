-- SQL Server Schema for Xiangqi Multiplayer
-- Database: XiangqiDB

-- Create database (run this first)
CREATE DATABASE XiangqiDB;
GO

USE XiangqiDB;
GO

-- Users table
CREATE TABLE Users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(64) UNIQUE NOT NULL,
    email NVARCHAR(128) UNIQUE NOT NULL,
    password_hash NVARCHAR(128) NOT NULL,
    rating INT DEFAULT 1200,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    INDEX IX_Users_Rating (rating DESC),
    INDEX IX_Users_Username (username)
);
GO

-- Matches table
CREATE TABLE Matches (
    match_id NVARCHAR(64) PRIMARY KEY,
    red_user_id INT NOT NULL,
    black_user_id INT NOT NULL,
    result NVARCHAR(16) CHECK (result IN ('red_win', 'black_win', 'draw', 'ongoing')),
    moves_json NVARCHAR(MAX),
    started_at NVARCHAR(32),
    ended_at NVARCHAR(32),
    FOREIGN KEY (red_user_id) REFERENCES Users(user_id),
    FOREIGN KEY (black_user_id) REFERENCES Users(user_id),
    INDEX IX_Matches_Users (red_user_id, black_user_id),
    INDEX IX_Matches_StartedAt (started_at DESC)
);
GO

-- Sessions table (optional - for persistent sessions)
CREATE TABLE Sessions (
    session_token NVARCHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id),
    INDEX IX_Sessions_UserID (user_id),
    INDEX IX_Sessions_ExpiresAt (expires_at)
);
GO

INSERT INTO Users (username, email, password_hash, rating, wins, losses, draws)
VALUES ('testuser', 'test@example.com', 'd91da15b07b01fb413e31be527f05b9563b0515652b0515672b0bcb1ca2a6185', 1200, 0, 0, 0);
-- Pass: test123 of testUser

-- View for leaderboard
CREATE VIEW Leaderboard AS
SELECT 
    username,
    rating,
    wins,
    losses,
    draws,
    (wins + losses + draws) as total_games,
    CASE 
        WHEN (wins + losses + draws) > 0 
        THEN CAST(wins AS FLOAT) / (wins + losses + draws) * 100 
        ELSE 0 
    END as win_rate
FROM Users
WHERE (wins + losses + draws) > 0;
GO

-- Stored procedure to update stats after match
CREATE PROCEDURE UpdateMatchStats
    @red_user_id INT,
    @black_user_id INT,
    @result NVARCHAR(16)
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @result = 'red_win'
    BEGIN
        UPDATE Users SET wins = wins + 1 WHERE user_id = @red_user_id;
        UPDATE Users SET losses = losses + 1 WHERE user_id = @black_user_id;
    END
    ELSE IF @result = 'black_win'
    BEGIN
        UPDATE Users SET losses = losses + 1 WHERE user_id = @red_user_id;
        UPDATE Users SET wins = wins + 1 WHERE user_id = @black_user_id;
    END
    ELSE IF @result = 'draw'
    BEGIN
        UPDATE Users SET draws = draws + 1 WHERE user_id = @red_user_id;
        UPDATE Users SET draws = draws + 1 WHERE user_id = @black_user_id;
    END
END;
GO

-- Cleanup expired sessions
CREATE PROCEDURE CleanupExpiredSessions
AS
BEGIN
    DELETE FROM Sessions WHERE expires_at < GETDATE();
END;
GO

PRINT 'Database schema created successfully!';
