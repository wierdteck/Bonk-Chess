-- Create database (run this first if database doesn't exist)
-- CREATE DATABASE bonk_chess;

-- Connect to bonk_chess database and run the following:

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Game history table (optional, for future use)
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(100) UNIQUE NOT NULL,
  white_player_id INTEGER REFERENCES users(id),
  black_player_id INTEGER REFERENCES users(id),
  winner_id INTEGER REFERENCES users(id),
  result VARCHAR(20), -- 'white_wins', 'black_wins', 'draw', 'abandoned'
  move_history JSONB,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_players ON games(white_player_id, black_player_id);
CREATE INDEX IF NOT EXISTS idx_games_started_at ON games(started_at);