import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { BarChart, CreditCard, Calendar as CalendarIcon, TrendingUp, DollarSign, Package, AlertTriangle, Users, Clock } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Link } from 'react-router-dom'
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, PieChart, Pie, Cell } from 'recharts'

export default function AdminDashboard() {
  const [period, setPeriod] = useState('today') // 'today', 'week', 'month'
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    totalRevenue: 0,
    servicesRevenue: 0,
    productsRevenue: 0,
    appointmentsCount: 0,
    payments: { cash: 0, card: 0, bizum: 0 },
    topItems: [],
    revenueOverTime: [],
    peakHours: [],
    staffPerformance: []
  })

  const [lowStockProducts, setLowStockProducts] = useState([])
  const [settings, setSettings] = useState({ staff_ranking_enabled: true })

  useEffect(() => {
    fetchDashboardData()
    fetchSettings()
  }, [period])

  async function fetchSettings() {
    try {
      const { data } = await supabase.from('settings').select('staff_ranking_enabled').eq('id', 1).single()
      if (data) {
        setSettings({ staff_ranking_enabled: data.staff_ranking_enabled ?? true })
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
    }
  }

  async function fetchDashboardData() {
    setLoading(true)
    try {
      const now = new Date()
      const startDate = new Date()
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date()
      endDate.setHours(23, 59, 59, 999)

      if (period === 'week') {
        const day = startDate.getDay() || 7 // 1 is Monday, 7 is Sunday
        startDate.setDate(startDate.getDate() - day + 1)
      } else if (period === 'month') {
        startDate.setDate(1)
      }

      const isoStart = startDate.toISOString()
      const isoEnd = endDate.toISOString()

      // 0. Fetch Staff for mapping names
      const { data: staffData } = await supabase.from('staff').select('id, name')
      const staffMap = {}
      if (staffData) {
        staffData.forEach(s => staffMap[s.id] = s.name)
      }

      // 1. Fetch Sales
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          total_amount,
          payment_method,
          created_at,
          staff_id,
          sale_items (
            item_name,
            quantity,
            price,
            item_type
          )
        `)
        .gte('created_at', isoStart)
        .lte('created_at', isoEnd)

      if (salesError) throw salesError

      // 2. Fetch Appointments
      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .select('id, status, start_time')
        .gte('start_time', isoStart)
        .lte('start_time', isoEnd)
        .eq('status', 'completed')

      if (apptError) throw apptError

      // 3. Fetch Low Stock Products
      const { data: stockData, error: stockError } = await supabase
        .from('products')
        .select('id, name, stock')
        .lte('stock', 5)
        .order('stock', { ascending: true })

      if (stockError) throw stockError
      setLowStockProducts(stockData || [])

      // Process Data
      let total = 0
      let srvRevenue = 0
      let prdRevenue = 0
      let payments = { cash: 0, card: 0, bizum: 0 }
      let itemCounts = {}
      let dailyRevenue = {}
      let staffStats = {}

      if (salesData) {
        salesData.forEach(sale => {
          total += Number(sale.total_amount)

          if (sale.payment_method === 'cash') payments.cash += Number(sale.total_amount)
          if (sale.payment_method === 'card') payments.card += Number(sale.total_amount)
          if (sale.payment_method === 'bizum') payments.bizum += Number(sale.total_amount)

          // Daily Revenue for chart
          const day = sale.created_at.split('T')[0]
          dailyRevenue[day] = (dailyRevenue[day] || 0) + Number(sale.total_amount)

          // Staff Performance
          if (sale.staff_id) {
            if (!staffStats[sale.staff_id]) staffStats[sale.staff_id] = { revenue: 0, count: 0 }
            staffStats[sale.staff_id].revenue += Number(sale.total_amount)
            staffStats[sale.staff_id].count += 1
          }

          if (sale.sale_items && sale.sale_items.length > 0) {
            sale.sale_items.forEach(item => {
              if (!itemCounts[item.item_name]) {
                itemCounts[item.item_name] = { count: 0, revenue: 0, type: item.item_type }
              }
              itemCounts[item.item_name].count += item.quantity

              const lineTotal = item.price * item.quantity
              itemCounts[item.item_name].revenue += lineTotal

              if (item.item_type === 'service') srvRevenue += lineTotal
              else if (item.item_type === 'product') prdRevenue += lineTotal
            })
          } else {
            // Retrocompatibilidad: Si no hay items asume servicio
            srvRevenue += Number(sale.total_amount)
          }
        })
      }

      const topItems = Object.entries(itemCounts)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      const revenueOverTime = Object.entries(dailyRevenue)
        .map(([date, amount]) => {
          // Format date for chart (e.g., "DD/MM")
          const d = new Date(date)
          const formatted = `${d.getDate()}/${d.getMonth() + 1}`
          return { date: formatted, rawDate: date, amount }
        })
        .sort((a, b) => a.rawDate.localeCompare(b.rawDate))

      const staffPerformance = Object.entries(staffStats)
        .map(([id, s]) => ({
          name: staffMap[id] || 'Desconocido',
          revenue: s.revenue,
          count: s.count
        }))
        .sort((a, b) => b.revenue - a.revenue)

      // Peak Hours
      const hourCounts = {}
      if (apptData) {
        apptData.forEach(appt => {
          const hour = new Date(appt.start_time).getHours()
          hourCounts[hour] = (hourCounts[hour] || 0) + 1
        })
      }

      const peakHours = Object.entries(hourCounts)
        .map(([hour, count]) => ({ hour: `${hour}:00`, rawHour: parseInt(hour), count }))
        .sort((a, b) => a.rawHour - b.rawHour)

      setStats({
        totalRevenue: total,
        servicesRevenue: srvRevenue,
        productsRevenue: prdRevenue,
        appointmentsCount: apptData ? apptData.length : 0,
        payments,
        topItems,
        revenueOverTime,
        peakHours,
        staffPerformance
      })

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      <header className="p-6 border-b bg-white flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Estadísticas</h1>
          <p className="text-sm text-gray-500">Resumen de rendimiento de tu negocio</p>
        </div>

        <div className="bg-gray-100 p-1 rounded-lg flex items-center">
          <button
            onClick={() => setPeriod('today')}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-all", period === 'today' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            Hoy
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-all", period === 'week' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            Esta Semana
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-all", period === 'month' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            Este Mes
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-500">Cargando datos...</div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">

            {/* ALERTA DE STOCK */}
            {lowStockProducts.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-orange-800 font-bold">Alerta de Stock</h3>
                  <p className="text-orange-700 text-sm mt-1">
                    Tienes {lowStockProducts.length} producto(s) con stock bajo o agotado.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lowStockProducts.map(p => (
                      <span key={p.id} className="bg-white border border-orange-200 text-orange-800 text-xs font-semibold px-2 py-1 rounded-md shadow-sm">
                        {p.name}: <span className={p.stock === 0 ? "text-red-600" : ""}>{p.stock} uds</span>
                      </span>
                    ))}
                  </div>
                </div>
                <Link to="/admin/products" className="text-sm font-bold text-orange-700 hover:text-orange-800 underline">
                  Ir al inventario
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* Facturación Total */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-gray-300" />
                </div>
                <h3 className="text-gray-500 text-sm font-medium">Facturación Total</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalRevenue.toFixed(2)} €</p>
              </div>

              {/* Ingresos Servicios */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">Ingresos por Servicios</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.servicesRevenue.toFixed(2)} €</p>
              </div>

              {/* Ingresos Productos */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                    <Package className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">Ingresos por Productos</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.productsRevenue.toFixed(2)} €</p>
              </div>

              {/* Citas Completadas */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">Citas Completadas</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.appointmentsCount}</p>
              </div>

              {/* Ticket Medio */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                    <BarChart className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">Ticket Medio</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.appointmentsCount > 0 ? (stats.totalRevenue / stats.appointmentsCount).toFixed(2) : '0.00'} €
                </p>
              </div>

              {/* Mejor Empleado */}
              {settings.staff_ranking_enabled && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-gray-500 text-sm font-medium">Mejor Empleado</h3>
                  <p className="text-xl font-bold text-gray-900 mt-1 truncate">
                    {stats.staffPerformance.length > 0 ? stats.staffPerformance[0].name : '-'}
                  </p>
                </div>
              )}
            </div>

            {/* Gráficos de Evolución y Horas Pico */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-gray-400" /> Evolución de Ingresos
                </h3>
                <div className="h-64">
                  {stats.revenueOverTime.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.revenueOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `€${val}`} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <RechartsTooltip
                          formatter={(value) => [`${value.toFixed(2)} €`, 'Ingresos']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">No hay datos suficientes</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" /> Horas Pico
                </h3>
                <div className="h-64">
                  {stats.peakHours.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={stats.peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <RechartsTooltip
                          formatter={(value) => [value, 'Citas']}
                          cursor={{ fill: '#f3f4f6' }}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">No hay citas en este periodo</div>
                  )}
                </div>
              </div>

              {/* Gráfico 3: Servicios vs Productos (Pie) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-400" /> Distribución
                </h3>
                <div className="h-64 relative">
                  {(stats.servicesRevenue > 0 || stats.productsRevenue > 0) ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Servicios', value: stats.servicesRevenue },
                              { name: 'Productos', value: stats.productsRevenue }
                            ].filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#8b5cf6" />
                            <Cell fill="#f43f5e" />
                          </Pie>
                          <RechartsTooltip 
                            formatter={(value) => [`${value.toFixed(2)} €`, 'Ingresos']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-sm text-gray-500 font-medium">Total</span>
                        <span className="text-xl font-bold text-gray-900">{stats.totalRevenue.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                          <div className="w-3 h-3 rounded-full bg-[#8b5cf6]"></div> Servicios
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                          <div className="w-3 h-3 rounded-full bg-[#f43f5e]"></div> Productos
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin ventas registradas</div>
                  )}
                </div>
              </div>
            </div>

            {/* Listas Inferiores */}
            <div className={`grid grid-cols-1 gap-6 ${settings.staff_ranking_enabled ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>

              {/* Rendimiento Empleados */}
              {settings.staff_ranking_enabled && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-400" /> Rendimiento de Empleados
                  </h3>
                  {stats.staffPerformance.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">No hay ventas registradas a empleados.</p>
                  ) : (
                    <div className="space-y-4">
                      {stats.staffPerformance.map((staff, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{staff.name}</span>
                            <span className="text-xs text-gray-500">{staff.count} tickets cobrados</span>
                          </div>
                          <span className="font-bold text-green-600">{staff.revenue.toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Desglose de Cobros */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-gray-400" /> Desglose de Cobros
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
                    <span className="font-medium text-gray-700">Tarjeta</span>
                    <span className="font-bold text-gray-900">{stats.payments.card.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
                    <span className="font-medium text-gray-700">Efectivo</span>
                    <span className="font-bold text-gray-900">{stats.payments.cash.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
                    <span className="font-medium text-gray-700">Bizum</span>
                    <span className="font-bold text-gray-900">{stats.payments.bizum.toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {/* Top Productos / Servicios */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-400" /> Top Servicios y Productos
                </h3>
                {stats.topItems.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No hay ventas en este periodo.</p>
                ) : (
                  <div className="space-y-4">
                    {stats.topItems.map((item, i) => (
                      <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 truncate max-w-[150px]">{item.name}</span>
                          <span className="text-xs text-gray-500 capitalize">{item.type === 'service' ? 'Servicio' : 'Producto'} • {item.count} ud(s)</span>
                        </div>
                        <span className="font-bold text-gray-900">{item.revenue.toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
