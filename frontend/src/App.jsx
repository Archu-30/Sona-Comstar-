import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import AppShell from './components/layout/AppShell';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import ClosingInventory from './pages/ClosingInventory';
import StorageAgeing from './pages/StorageAgeing';
import InTransit from './pages/InTransit';
import ProductAnalytics from './pages/ProductAnalytics';
import Reports from './pages/Reports';
import ReportHistory from './pages/ReportHistory';
import Login from './pages/Login';

function PageBoundary({ children }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      {children}
    </ErrorBoundary>
  );
}

export function isAuthenticated() {
  return localStorage.getItem('sona_auth') === '1';
}

function RequireAuth({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const location = useLocation();

  if (location.pathname === '/login') {
    return (
      <>
        {isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Login />}
        <Toaster position="top-right" richColors />
      </>
    );
  }

  return (
    <>
      <RequireAuth>
        <AppShell>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<PageBoundary><Dashboard /></PageBoundary>} />
            <Route path="/closing-inventory" element={<PageBoundary><ClosingInventory /></PageBoundary>} />
            <Route path="/storage-ageing" element={<PageBoundary><StorageAgeing /></PageBoundary>} />
            <Route path="/in-transit" element={<PageBoundary><InTransit /></PageBoundary>} />
            <Route path="/product-analytics" element={<PageBoundary><ProductAnalytics /></PageBoundary>} />
            <Route path="/reports"         element={<PageBoundary><Reports /></PageBoundary>} />
            <Route path="/report-history"  element={<PageBoundary><ReportHistory /></PageBoundary>} />
          </Routes>
        </AppShell>
      </RequireAuth>
      <Toaster position="top-right" richColors />
    </>
  );
}
