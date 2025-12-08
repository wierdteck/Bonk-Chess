const bcrypt = require('bcrypt');

// In-memory user storage (replace with a database later)
const users = new Map();

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
  
  // Check if user already exists
  if (users.has(username.toLowerCase())) {
    return { success: false, error: 'Username already exists' };
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Store user
  users.set(username.toLowerCase(), {
    username: username,
    password: hashedPassword,
    createdAt: new Date()
  });
  
  console.log(`User registered: ${username}`);
  return { success: true, username };
}

// Login user
async function loginUser(username, password) {
  const user = users.get(username.toLowerCase());
  
  if (!user) {
    return { success: false, error: 'Invalid username or password' };
  }
  
  const passwordMatch = await bcrypt.compare(password, user.password);
  
  if (!passwordMatch) {
    return { success: false, error: 'Invalid username or password' };
  }
  
  console.log(`User logged in: ${username}`);
  return { success: true, username: user.username };
}

// Get user
function getUser(username) {
  return users.get(username.toLowerCase());
}

module.exports = {
  registerUser,
  loginUser,
  getUser,
  users
};