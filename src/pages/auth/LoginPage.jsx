import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Scissors, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/button'

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const normalizedUser = email.trim().toLowerCase()

    // 1. Acceso rápido para demostración / CV (admin / admin)
    if ((normalizedUser === 'admin' || normalizedUser === 'admin@ohana.com' || normalizedUser === 'admin@admin.com') && password === 'admin') {
      try {
        const { data, error: sbDemoErr } = await supabase.auth.signInWithPassword({
          email: 'admin@ohana.com',
          password: 'ohana_admin_2026',
        })
        if (!sbDemoErr && data?.session) {
          localStorage.removeItem('ohana_admin_session')
          if (onLoginSuccess) {
            onLoginSuccess(data.session)
          }
          setLoading(false)
          navigate('/admin/calendar')
          return
        }
      } catch {
        // Si Supabase rechaza (ej. email sin confirmar o sin red), seguimos con sesión demo local
      }

      const demoSession = {
        user: {
          id: 'admin-cv-demo-id',
          email: 'admin@ohana.com',
          role: 'authenticated',
          user_metadata: { name: 'Administrador Ohana' }
        },
        access_token: 'demo_token_' + Date.now()
      }
      localStorage.setItem('ohana_admin_session', JSON.stringify(demoSession))
      if (onLoginSuccess) {
        onLoginSuccess(demoSession)
      }
      setLoading(false)
      navigate('/admin/calendar')
      return
    }

    // 2. Acceso con credenciales de Supabase
    try {
      const { data, error: sbError } = await supabase.auth.signInWithPassword({
        email: normalizedUser,
        password,
      })

      if (sbError) {
        setError('Credenciales no válidas. Para acceder a la demo usa usuario "admin" y contraseña "admin".')
      } else {
        localStorage.removeItem('ohana_admin_session')
        if (onLoginSuccess) {
          onLoginSuccess(data.session)
        }
        navigate('/admin/calendar')
      }
    } catch {
      setError('Error de conexión. Puedes usar usuario "admin" y contraseña "admin".')
    } finally {
      setLoading(false)
    }
  }

  const fillDemoCredentials = () => {
    setEmail('admin')
    setPassword('admin')
    setError(null)
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        
        {/* Cabecera */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Scissors className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Acceso Equipo · Ohana</h1>
          <p className="text-gray-500 text-sm mt-1">Panel de gestión interna del salón</p>
        </div>

        {/* Tarjeta de credenciales para CV / Demo */}
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 mb-6 text-xs text-amber-950 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              Credenciales Demo / CV:
            </div>
            <div className="text-amber-800">
              Usuario: <code className="bg-amber-100/80 font-bold px-1.5 py-0.5 rounded text-amber-950">admin</code>
              {' '}·{' '}
              Clave: <code className="bg-amber-100/80 font-bold px-1.5 py-0.5 rounded text-amber-950">admin</code>
            </div>
          </div>
          <button
            type="button"
            onClick={fillDemoCredentials}
            className="text-[11px] font-bold bg-amber-200/90 hover:bg-amber-300 text-amber-950 px-2.5 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1 shadow-sm"
          >
            <CheckCircle2 className="w-3 h-3" />
            Autocompletar
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl mb-4 text-center font-medium leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Usuario o Email</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              placeholder="admin"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-gray-700">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              placeholder="admin"
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full mt-3 h-12 text-base font-bold shadow-md shadow-primary/20">
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </Button>
        </form>

      </div>
    </div>
  )
}
