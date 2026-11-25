import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';
import { useMe } from '../auth';

export function RegisterPage() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const register = useMutation({
    mutationFn: () => api('/api/auth/register', { method: 'POST', body: { name, email, password } }),
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.setQueryData(['me'], data.user);
      navigate('/');
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
        register.mutate();
      }}
    >
      <h1>Create an account</h1>
      <label>
        Name
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
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
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" className="button" disabled={register.isPending}>
        {register.isPending ? 'Creating…' : 'Create account'}
      </button>
      <p className="quiet">
        Already have one? <Link to="/login">Sign in</Link>
      </p>
    </form>
  );
}
