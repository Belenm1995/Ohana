import { Routes, Route, Link, useLocation, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { Calendar, Users, Settings, CreditCard, Scissors, Package, BarChart, Megaphone, Banknote, Gift, Receipt, LogOut } from 'lucide-react'
import { cn } from './lib/utils'

import LandingPage from './pages/public/LandingPage'
import BookingFlow from './pages/public/BookingFlow'
import GiftFlow from './pages/public/GiftFlow'
import AdminCalendar from './pages/admin/AdminCalendar'
import AdminClients from './pages/admin/AdminClients'
import AdminServices from './pages/admin/AdminServices'
import AdminStaff from './pages/admin/AdminStaff'
import AdminProducts from './pages/admin/AdminProducts'
import AdminPOS from './pages/admin/AdminPOS'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCashRegister from './pages/admin/AdminCashRegister'
import AdminExpenses from './pages/admin/AdminExpenses'
import AdminSettings from './pages/admin/AdminSettings'
import AdminMarketing from './pages/admin/AdminMarketing'
import AdminGiftCards from './pages/admin/AdminGiftCards'
import LoginPage from './pages/auth/LoginPage'
import { supabase } from './lib/supabase'
import { useState, useEffect } from 'react'

// --- PANTALLAS PRIVADAS (ADMIN) ---

// Auth Guard component
const AuthGuard = ({ children }) => {
  const [session, setSession] = useState(() => {
    try {
      const local = localStorage.getItem('ohana_admin_session')
      return local ? JSON.parse(local) : null
    } catch {
      return null
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session)
      } else if (!localStorage.getItem('ohana_admin_session')) {
        setSession(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading && !session) return <div className="flex h-screen items-center justify-center bg-gray-50 font-medium text-gray-500">Cargando Ohana...</div>
  if (!session) return <LoginPage onLoginSuccess={(sess) => setSession(sess)} />

  return children
}

// Componente NavLink para el menú lateral
const NavLink = ({ to, icon: Icon, children }) => {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors font-medium",
        active ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-100"
      )}
    >
      <Icon className="w-5 h-5" /> {children}
    </Link>
  )
}

// Layout del Administrador
const AdminLayout = () => {
  const handleLogout = () => {
    localStorage.removeItem('ohana_admin_session')
    supabase.auth.signOut().finally(() => {
      window.location.href = '/login'
    })
  }

  return (
    <div className="flex h-screen bg-gray-50/50">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-6 border-b">
          <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
            <Scissors className="w-6 h-6" /> Ohana CRM
          </Link>
        </div>
        <nav className="flex flex-col gap-2 p-4 flex-1">
          <NavLink to="/admin/dashboard" icon={BarChart}>Dashboard</NavLink>
          <NavLink to="/admin/calendar" icon={Calendar}>Agenda</NavLink>
          <NavLink to="/admin/clients" icon={Users}>Clientes</NavLink>
          <NavLink to="/admin/marketing" icon={Megaphone}>Marketing</NavLink>
          <NavLink to="/admin/services" icon={Scissors}>Catálogo</NavLink>
          <NavLink to="/admin/products" icon={Package}>Inventario</NavLink>
          <NavLink to="/admin/staff" icon={Users}>Equipo</NavLink>
          <NavLink to="/admin/pos" icon={CreditCard}>TPV</NavLink>
          <NavLink to="/admin/gift-cards" icon={Gift}>Regalos</NavLink>
          <NavLink to="/admin/cash" icon={Banknote}>Caja</NavLink>
          <NavLink to="/admin/expenses" icon={Receipt}>Gastos y Facturas</NavLink>
          <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-gray-100">
            <NavLink to="/admin/settings" icon={Settings}>Configuración</NavLink>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-3 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors font-medium text-left w-full"
              title="Cerrar sesión"
            >
              <LogOut className="w-5 h-5" /> Salir del CRM
            </button>
          </div>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/booking" element={<BookingFlow />} />
      <Route path="/gift" element={<GiftFlow />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/crm" element={<Navigate to="/admin" replace />} />
      <Route path="/equipo" element={<Navigate to="/admin" replace />} />

      {/* Rutas Privadas / Admin */}
      <Route path="/admin" element={<AuthGuard><AdminLayout /></AuthGuard>}>
        {/* Redirigir /admin a /admin/calendar por defecto si es necesario, por ahora renderizamos el calendario */}
        <Route index element={<AdminDashboard />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="calendar" element={<AdminCalendar />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="marketing" element={<AdminMarketing />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="staff" element={<AdminStaff />} />
        <Route path="pos" element={<AdminPOS />} />
        <Route path="gift-cards" element={<AdminGiftCards />} />
        <Route path="cash" element={<AdminCashRegister />} />
        <Route path="expenses" element={<AdminExpenses />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
  )
}

export default App
