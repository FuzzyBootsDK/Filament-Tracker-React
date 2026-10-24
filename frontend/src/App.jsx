import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { PrinterProvider } from './context/PrinterContext.jsx';
import Layout from './components/Layout/Layout.jsx';
import Login from './pages/Login.jsx';
import Inventory from './pages/Inventory.jsx';
import AddFilament from './pages/AddFilament.jsx';
import Spools from './pages/Spools.jsx';
import Calculator from './pages/Calculator.jsx';
import Printer from './pages/Printer.jsx';
import AMS from './pages/AMS.jsx';
import UsageLog from './pages/UsageLog.jsx';
import Settings from './pages/Settings.jsx';

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    // Still loading
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0b1220', color: 'rgba(230,237,247,.4)', fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }
  if (user === null) return <Navigate to="/login" replace />;
  return children;
}

function LoginRoute() {
  const { authDisabled } = useAuth();
  if (authDisabled) return <Navigate to="/" replace />;
  return <Login />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/*" element={
        <RequireAuth>
          <PrinterProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Inventory />} />
                <Route path="/add" element={<AddFilament />} />
                <Route path="/add/:id" element={<AddFilament />} />
                <Route path="/spools" element={<Spools />} />
                <Route path="/calculator" element={<Calculator />} />
                <Route path="/printer" element={<Printer />} />
                <Route path="/ams" element={<AMS />} />
                <Route path="/log" element={<UsageLog />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </PrinterProvider>
        </RequireAuth>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
