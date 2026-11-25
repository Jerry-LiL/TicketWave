import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { getToken } from './api';
import { useMe } from './auth';
import { Layout } from './components/Layout';
import { CheckoutPage } from './pages/CheckoutPage';
import { EventPage } from './pages/EventPage';
import { EventsPage } from './pages/EventsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TicketsPage } from './pages/TicketsPage';

function RequireAuth({ children }) {
  const location = useLocation();
  const me = useMe();

  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (me.isLoading) return <p className="status">Checking your session…</p>;
  if (me.isError || !me.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<EventsPage />} />
        <Route path="events/:eventId" element={<EventPage />} />
        <Route
          path="checkout/:eventId"
          element={
            <RequireAuth>
              <CheckoutPage />
            </RequireAuth>
          }
        />
        <Route
          path="tickets"
          element={
            <RequireAuth>
              <TicketsPage />
            </RequireAuth>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="*" element={<p className="status">That page is not on the bill.</p>} />
      </Route>
    </Routes>
  );
}
