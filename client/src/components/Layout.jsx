import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { setToken } from '../api';
import { useMe } from '../auth';

export function Layout() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  function logout() {
    setToken(null);
    queryClient.clear();
    navigate('/');
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          TicketWave
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Shows
          </NavLink>
          <NavLink to="/tickets">Tickets</NavLink>
        </nav>
        <div className="account">
          {me.data ? (
            <>
              <span className="who">{me.data.name}</span>
              <button type="button" className="text-button" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <Link to="/login">Sign in</Link>
          )}
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
