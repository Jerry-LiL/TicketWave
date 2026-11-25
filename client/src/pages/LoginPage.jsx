import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';
import { useMe } from '../auth';

export function LoginPage() {
  const me = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const login = useMutation({
    mutationFn: () => api('/api/auth/login', { method: 'POST', body: { email, password } }),
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.setQueryData(['me'], data.user);
      navigate(location.state?.from || '/');
    },
    onError: (err) => setError(err.message),
  });

  if (me.data) return <Navigate to="/" replace />;

  return (
    <form
      className="auth-card"
      onSubmit={(event) => {
        event.preventDefault();
        setError('');
        login.mutate();
      }}
    >
      <h1>Sign in</h1>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="button" disabled={login.isPending}>
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="quiet">
        New here? <Link to="/register">Create an account</Link>
      </p>
    </form>
  );
}
