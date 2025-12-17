import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/auth.css';

const API_URL = import.meta.env.VITE_API_URL;

function Register({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, passwordConfirm }),
      });

      const data = await response.json();

      if (data.success) {
        onLogin(data.username);
        navigate('/game');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      console.error('Register error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <header>
        <h1>Register for an Account</h1>
      </header>

      <main>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="passwordConfirm">Confirm Password:</label>
            <input
              type="password"
              id="passwordConfirm"
              name="passwordConfirm"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="button-container">
            <button type="submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
            <Link to="/login">
              <button type="button" disabled={loading}>Login</button>
            </Link>
          </div>

          {error && <p className="error-message">{error}</p>}
        </form>
      </main>

      <footer>
        <p>Bonk Chess</p>
      </footer>
    </div>
  );
}

export default Register;