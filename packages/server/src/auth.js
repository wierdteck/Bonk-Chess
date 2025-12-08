import bcrypt from 'bcrypt';
import { pg } from '../db/postgres.js';

// Initialize users table if it doesn't exist
async function initDatabase() {
  try {
    await pg.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);
    console.log('Users table initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

initDatabase();

// Password validation
function validatePassword(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  // Optional: Add more requirements
  // const numUpper = (password.match(/[A-Z]/g) || []).length;
  // const numNum = (password.match(/[0-9]/g) || []).length;
  // const numSpecial = (password.match(/[^A-Za-z0-9]/g) || []).length;
  
  return errors;
}

// Username validation
function validateUsername(username) {
  const errors = [];
  
  if (username.length < 4) {
    errors.push('Username must be at least 4 characters long');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, hyphens, and underscores');
  }
  
  return errors;
}

// Register new user
async function registerUser(username, password, passwordConfirm) {
  // Check if passwords match
  if (password !== passwordConfirm) {
    return { success: false, error: 'Passwords do not match' };
  }
  
  // Validate username
  const usernameErrors = validateUsername(username);
  if (usernameErrors.length > 0) {
    return { success: false, error: usernameErrors[0] };
  }
  
  // Validate password
  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    return { success: false, error: passwordErrors[0] };
  }
  
  // Check if username and password are the same
  if (username === password) {
    return { success: false, error: 'Username and password cannot be the same' };
  }
  
  try {
    // Check if user already exists
    const existingUser = await pg.query(
      'SELECT username FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      return { success: false, error: 'Username already exists' };
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user into database
    await pg.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, hashedPassword]
    );
    
    console.log(`User registered: ${username}`);
    return { success: true, username };
  } catch (err) {
    console.error('Registration error:', err);
    return { success: false, error: 'An error occurred during registration' };
  }
}

// Login user
async function loginUser(username, password) {
  try {
    // Get user from database
    const result = await pg.query(
      'SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Invalid username or password' };
    }
    
    const user = result.rows[0];
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return { success: false, error: 'Invalid username or password' };
    }
    
    // Update last login
    await pg.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    console.log(`User logged in: ${user.username}`);
    return { success: true, username: user.username, userId: user.id };
  } catch (err) {
    console.error('Login error:', err);
    return { success: false, error: 'An error occurred during login' };
  }
}

// Get user by username
async function getUser(username) {
  try {
    const result = await pg.query(
      'SELECT id, username, created_at, last_login FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (err) {
    console.error('Get user error:', err);
    return null;
  }
}

// Get user by ID
async function getUserById(userId) {
  try {
    const result = await pg.query(
      'SELECT id, username, created_at, last_login FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (err) {
    console.error('Get user by ID error:', err);
    return null;
  }
}

export {
  registerUser,
  loginUser,
  getUser,
  getUserById
};