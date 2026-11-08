import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Pencil, Calendar, Clock, DollarSign, CheckCircle2, XCircle } from 'lucide-react'

// Utilidades para los horarios
const defaultDaySchedule = [[9, 19]]

// Opciones cada 30 minutos (07:00 a 22:00)
const TIME_OPTIONS = [];
for (let h = 7; h <= 22; h++) {
  TIME_OPTIONS.push({ value: h, label: `${h.toString().padStart(2, '0')}:00` });
  if (h < 22) {
    TIME_OPTIONS.push({ value: h + 0.5, label: `${h.toString().padStart(2, '0')}:30` });
  }
}

const emptySchedule = {
  type: 'fixed', // 'fixed' o 'rotating'
  weekA: {
    1: [[9, 14]],
    2: [[9, 19]],
    3: [[9, 19]],
    4: [[9, 19]],
    5: [[9, 17]],
    6: [[9, 14]],
    0: [] // Domingo
  },
  weekB: {
    1: [[9, 14]],
    2: [[9, 19]],
    3: [[9, 19]],
    4: [[9, 19]],
    5: [[9, 17]],
    6: [[9, 14]],
    0: []
  }
}

export default function AdminStaff() {
  const [staff, setStaff] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [activeTab, setActiveTab] = useState('profile') // profile, schedule, commissions
  
  // Form Data
  const [formData, setFormData] = useState({ 
    name: '', 
    role: 'Trabajador', 
    color: '#000000', 
    commission_percentage: 0, 
    commission_products_percentage: 0,
    schedule: JSON.parse(JSON.stringify(emptySchedule)),
    services_commission_config: {}
  })

  // Rendimiento modal states
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [selectedStaffStats, setSelectedStaffStats] = useState(null)
  const [statsData, setStatsData] = useState({ totalRevenue: 0, servicesRevenue: 0, productsRevenue: 0, totalCommission: 0, commissionServices: 0, commissionProducts: 0, sales: [] })
  const [statsMonth, setStatsMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [loadingStats, setLoadingStats] = useState(false)
  const [commissionsEnabled, setCommissionsEnabled] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // Configuracion global de comisiones
      const { data: settingsData } = await supabase.from('settings').select('commissions_enabled').eq('id', 1).single()
      if (settingsData && settingsData.commissions_enabled === false) {
        setCommissionsEnabled(false)
      }

      // Empleados
      const { data: staffData, error: staffError } = await supabase.from('staff').select('*').order('name')
      if (staffError) throw staffError
      
      // Asegurar que todos tengan un schedule y config si no lo tienen (retrocompatibilidad)
      const mappedStaff = staffData.map(s => ({
        ...s,
        schedule: s.schedule || JSON.parse(JSON.stringify(emptySchedule)),
        services_commission_config: s.services_commission_config || {}
      }))
      setStaff(mappedStaff)

      // Servicios (para la pestaña de comisiones)
      const { data: servicesData, error: servicesError } = await supabase.from('services').select('id, name, category, is_active').order('category').order('name')
      if (servicesError) throw servicesError
      if (servicesData) setServices(servicesData)

    } catch (error) {
      console.error('Error fetching data:', error)
      alert('Error al cargar datos. Asegúrate de ejecutar el código SQL para añadir la columna schedule.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (person = null) => {
    if (person) {
      setEditingId(person.id)
      setFormData({
        name: person.name,
        role: person.role || 'Trabajador',
        color: person.color || '#000000',
        commission_percentage: person.commission_percentage || 0,
        commission_products_percentage: person.commission_products_percentage || 0,
        schedule: person.schedule || JSON.parse(JSON.stringify(emptySchedule)),
        services_commission_config: person.services_commission_config || {}
      })
    } else {
      setEditingId(null)
      setFormData({ 
        name: '', 
        role: 'Trabajador', 
        color: '#000000', 
        commission_percentage: 0, 
        commission_products_percentage: 0,
        schedule: JSON.parse(JSON.stringify(emptySchedule)),
        services_commission_config: {}
      })
    }
    setActiveTab('profile')
    setIsModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingId) {
        const { error } = await supabase
          .from('staff')
          .update(formData)
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('staff')
          .insert([formData])
        if (error) throw error
      }

      setIsModalOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error saving staff:', error)
      alert('Error al guardar el empleado')
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Estás seguro de eliminar este empleado?')) return
    try {
      const { error } = await supabase.from('staff').delete().eq('id', id)
      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error deleting staff:', error)
      alert('Error al eliminar empleado')
    }
  }

  // Lógica Rendimiento (Mantenemos la que tenías pero aplicando la config por servicio)
  const openStatsModal = (person) => {
    setSelectedStaffStats(person)
    setStatsModalOpen(true)
    fetchStats(person.id, statsMonth, person)
  }

  const handleMonthChange = (e) => {
    const newMonth = e.target.value
    setStatsMonth(newMonth)
    if (selectedStaffStats) {
      fetchStats(selectedStaffStats.id, newMonth, selectedStaffStats)
    }
  }

  const fetchStats = async (staffId, monthStr, staffData) => {
    try {
      setLoadingStats(true)
      const year = parseInt(monthStr.split('-')[0])
      const month = parseInt(monthStr.split('-')[1])

      const startOfMonth = new Date(year, month - 1, 1).toISOString()
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString()

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id, total_amount, created_at, notes, payment_method,
          appointment:appointments(service:services(id, name)),
          items:sale_items(item_type, item_id, quantity, price)
        `)
        .eq('staff_id', staffId)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth)
        .order('created_at', { ascending: false })

      if (error) throw error

      let servicesRev = 0
      let productsRev = 0
      let totalRev = 0
      
      let commServicesAcc = 0
      let commProductsAcc = 0

      const commServicesPct = staffData?.commission_percentage || 0
      const commProductsPct = staffData?.commission_products_percentage || 0
      const config = staffData?.services_commission_config || {}

      data.forEach(sale => {
        totalRev += Number(sale.total_amount)
        if (sale.items && sale.items.length > 0) {
          sale.items.forEach(item => {
            const lineTotal = item.quantity * item.price
            if (item.item_type === 'service') {
              servicesRev += lineTotal
              // Verificar si este servicio específico tiene comisión habilitada (por defecto es true)
              const givesCommission = config[item.item_id] !== false
              if (givesCommission) {
                commServicesAcc += (lineTotal * commServicesPct) / 100
              }
            } else if (item.item_type === 'product') {
              productsRev += lineTotal
              commProductsAcc += (lineTotal * commProductsPct) / 100
            }
          })
        } else {
          // Retrocompatibilidad (Ventas antiguas sin sale_items)
          if (sale.notes === 'Venta directa') {
            productsRev += Number(sale.total_amount)
            commProductsAcc += (Number(sale.total_amount) * commProductsPct) / 100
          } else {
            servicesRev += Number(sale.total_amount)
            // Asumimos que da comisión si no tenemos el ID
            commServicesAcc += (Number(sale.total_amount) * commServicesPct) / 100
          }
        }
      })

      setStatsData({
        totalRevenue: totalRev,
        servicesRevenue: servicesRev,
        productsRevenue: productsRev,
        commissionServices: commServicesAcc,
        commissionProducts: commProductsAcc,
        totalCommission: commServicesAcc + commProductsAcc,
        sales: data
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  // Helpers para pintar horarios
  const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const mapDay = (idx) => idx === 6 ? 0 : idx + 1 // 0=Lunes...6=Domingo -> JS: 0=Domingo, 1=Lunes
  
  const handleToggleDay = (week, dayIndex) => {
    const newSchedule = { ...formData.schedule }
    const currentBlocks = newSchedule[week][dayIndex]
    if (currentBlocks.length > 0) {
      newSchedule[week][dayIndex] = [] // Libramos
    } else {
      newSchedule[week][dayIndex] = [[9, 14]] // Turno por defecto
    }
    setFormData({ ...formData, schedule: newSchedule })
  }

  const handleUpdateBlock = (week, dayIndex, blockIndex, startOrEnd, value) => {
    const newSchedule = { ...formData.schedule }
    newSchedule[week][dayIndex][blockIndex][startOrEnd] = Number(value)
    setFormData({ ...formData, schedule: newSchedule })
  }

  const handleAddBlock = (week, dayIndex) => {
    const newSchedule = { ...formData.schedule }
    newSchedule[week][dayIndex].push([15, 19])
    setFormData({ ...formData, schedule: newSchedule })
  }

  const handleRemoveBlock = (week, dayIndex, blockIndex) => {
    const newSchedule = { ...formData.schedule }
    newSchedule[week][dayIndex].splice(blockIndex, 1)
    setFormData({ ...formData, schedule: newSchedule })
  }

  const renderScheduleEditor = (weekKey, title) => (
    <div className="mt-6 p-5 border border-gray-100 bg-gray-50/50 rounded-xl">
      <h3 className="font-bold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4">
        {daysOfWeek.map((dayName, idx) => {
          const jsDayIndex = mapDay(idx)
          const blocks = formData.schedule[weekKey][jsDayIndex] || []
          const isWorking = blocks.length > 0

          return (
            <div key={dayName} className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="w-28 flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={isWorking} 
                  onChange={() => handleToggleDay(weekKey, jsDayIndex)}
                  className="w-4 h-4 text-primary rounded focus:ring-primary cursor-pointer"
                />
                <span className={`font-semibold ${isWorking ? 'text-gray-900' : 'text-gray-400'}`}>{dayName}</span>
              </div>
              
              <div className="flex-1 flex flex-wrap gap-2 items-center">
                {!isWorking ? (
                  <span className="text-gray-400 text-sm font-medium">Libre / Descanso</span>
                ) : (
                  <>
                    {blocks.map((block, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                        <select 
                          value={block[0]} 
                          onChange={(e) => handleUpdateBlock(weekKey, jsDayIndex, bIdx, 0, e.target.value)}
                          className="text-sm bg-transparent font-medium text-gray-700 outline-none cursor-pointer"
                        >
                          {TIME_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <span className="text-gray-400">-</span>
                        <select 
                          value={block[1]} 
                          onChange={(e) => handleUpdateBlock(weekKey, jsDayIndex, bIdx, 1, e.target.value)}
                          className="text-sm bg-transparent font-medium text-gray-700 outline-none cursor-pointer"
                        >
                          {TIME_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => handleRemoveBlock(weekKey, jsDayIndex, bIdx)} className="text-gray-400 hover:text-red-500 ml-1 cursor-pointer">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => handleAddBlock(weekKey, jsDayIndex)} className="text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Turno
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const handleToggleCommission = (serviceId) => {
    const config = { ...formData.services_commission_config }
    // Por defecto es true. Si en el mapa es false, lo cambiamos a true (lo quitamos). Si es undefined/true, lo ponemos a false.
    if (config[serviceId] === false) {
      delete config[serviceId]
    } else {
      config[serviceId] = false
    }
    setFormData({ ...formData, services_commission_config: config })
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            Equipo (Staff)
          </h1>
          <p className="text-gray-500 mt-1">Gestiona los perfiles, horarios, turnos y comisiones.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-black transition-colors shadow-sm flex items-center gap-2">
          <Plus className="w-5 h-5" /> Nuevo Empleado
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando equipo...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {staff.map(person => (
            <div key={person.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-inner" style={{ backgroundColor: person.color }}>
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 leading-tight">{person.name}</h3>
                    <div className="text-xs font-semibold text-gray-500 mt-0.5">{person.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleOpenModal(person)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(person.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>
                    {person.schedule.type === 'fixed' ? 'Horario Fijo Semanal' : 'Turnos Rotativos (A/B)'}
                  </span>
                </div>
                
                {commissionsEnabled && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm">
                    <div className="flex items-center gap-1.5 font-bold text-gray-900 mb-2">
                      <DollarSign className="w-4 h-4 text-green-600" /> Comisiones Globales
                    </div>
                    <div className="flex justify-between items-center text-gray-600 mb-1">
                      <span>Servicios:</span>
                      <span className="font-semibold">{person.commission_percentage || 0}%</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Productos:</span>
                      <span className="font-semibold">{person.commission_products_percentage || 0}%</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-gray-50/50 border-t border-gray-100">
                <button 
                  onClick={() => openStatsModal(person)}
                  className="w-full py-2 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  Ver Rendimiento
                </button>
              </div>
            </div>
          ))}
          {staff.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-gray-200 border-dashed">
              <p className="text-gray-500 text-lg font-medium">No hay empleados registrados</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Nuevo/Editar Empleado */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingId ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="flex border-b border-gray-200 bg-white px-6 pt-2">
              <button 
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Perfil y Comisiones
              </button>
              <button 
                onClick={() => setActiveTab('schedule')}
                className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'schedule' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Horarios y Turnos
              </button>
              <button 
                onClick={() => setActiveTab('commission_exceptions')}
                className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'commission_exceptions' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Excepciones de Comisión
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 bg-white">
              {activeTab === 'profile' && (
                <div className="space-y-6 max-w-2xl">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre Completo *</label>
                      <input required type="text" className="w-full border p-3 rounded-xl focus:ring-primary outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Puesto / Especialidad</label>
                      <input
                        type="text"
                        placeholder="Ej: Colorista, Esteticista, Estilista..."
                        className="w-full border p-3 rounded-xl bg-white focus:ring-primary outline-none"
                        value={formData.role === 'Gerente' ? 'Gerente' : formData.role === 'Inactivo' ? 'Inactivo' : (formData.role || '')}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Estado en la Agenda</label>
                      <select
                        className="w-full border p-3 rounded-xl bg-white focus:ring-primary outline-none cursor-pointer"
                        value={formData.role?.toLowerCase() === 'gerente' ? 'Gerente' : formData.role?.toLowerCase() === 'inactivo' ? 'Inactivo' : 'Activo'}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'Gerente') {
                            setFormData({ ...formData, role: 'Gerente' });
                          } else if (val === 'Inactivo') {
                            setFormData({ ...formData, role: 'Inactivo' });
                          } else {
                            const prevRole = formData.role;
                            const newRole = (prevRole?.toLowerCase() === 'gerente' || prevRole?.toLowerCase() === 'inactivo') ? 'Estilista' : prevRole;
                            setFormData({ ...formData, role: newRole || 'Estilista' });
                          }
                        }}
                      >
                        <option value="Activo">Activo (Visible en Agenda y Reservas online)</option>
                        <option value="Gerente">Gerencia (Oculto en Agenda y Reservas online)</option>
                        <option value="Inactivo">Inactivo / Baja (Desactivado)</option>
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Color (Para el Calendario)</label>
                      <div className="flex gap-4 items-center">
                        <input type="color" className="w-16 h-12 p-1 border rounded-lg cursor-pointer" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                        <span className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 font-mono">{formData.color}</span>
                      </div>
                    </div>
                  </div>

                  {commissionsEnabled && (
                    <div className="bg-green-50/50 p-5 rounded-2xl border border-green-100">
                      <h3 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5" /> Comisiones Globales (%)
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">% Por Servicios</label>
                          <input type="number" min="0" max="100" className="w-full border p-3 rounded-xl focus:ring-primary outline-none" value={formData.commission_percentage} onChange={e => setFormData({ ...formData, commission_percentage: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">% Por Productos</label>
                          <input type="number" min="0" max="100" className="w-full border p-3 rounded-xl focus:ring-primary outline-none" value={formData.commission_products_percentage} onChange={e => setFormData({ ...formData, commission_products_percentage: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'schedule' && (
                <div>
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.schedule.type === 'rotating'}
                        onChange={(e) => setFormData({
                          ...formData,
                          schedule: { ...formData.schedule, type: e.target.checked ? 'rotating' : 'fixed' }
                        })}
                        className="w-5 h-5 text-primary rounded"
                      />
                      <div>
                        <span className="font-bold text-blue-900 block">Este empleado tiene turnos rotativos (Semana A / Semana B)</span>
                        <span className="text-sm text-blue-700">Por ejemplo: Rota los miércoles por la mañana y los sábados cada semana.</span>
                      </div>
                    </label>
                  </div>

                  {formData.schedule.type === 'fixed' ? (
                    renderScheduleEditor('weekA', 'Horario Semanal')
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {renderScheduleEditor('weekA', 'Horario Semana A')}
                      {renderScheduleEditor('weekB', 'Horario Semana B')}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'commission_exceptions' && (
                <div>
                  <p className="text-gray-500 mb-6">
                    Por defecto, este empleado gana su comisión global ({formData.commission_percentage}%) por todos los servicios que realiza.
                    Usa esta lista para desactivar la comisión en servicios específicos.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {services.map(svc => {
                      // isCommissionEnabled is true unless explicitly false in config
                      const isCommissionEnabled = formData.services_commission_config[svc.id] !== false
                      
                      return (
                        <div key={svc.id} onClick={() => handleToggleCommission(svc.id)} className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between
                          ${isCommissionEnabled ? 'bg-white border-gray-200 hover:border-green-300' : 'bg-gray-50 border-gray-200 opacity-60 grayscale'}`}>
                          <div>
                            <div className="text-xs text-gray-400 font-bold uppercase mb-1">{svc.category || 'Sin categoría'}</div>
                            <div className="font-semibold text-gray-900">{svc.name}</div>
                          </div>
                          <div>
                            {isCommissionEnabled 
                              ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                              : <XCircle className="w-6 h-6 text-gray-400" />
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </form>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSubmit} className="px-6 py-3 rounded-xl font-bold text-white bg-gray-900 hover:bg-black transition-colors">
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rendimiento */}
      {statsModalOpen && selectedStaffStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold">Rendimiento: {selectedStaffStats.name}</h2>
                {commissionsEnabled && (
                  <p className="text-sm text-gray-500">
                    Servicios: {selectedStaffStats.commission_percentage}% | Productos: {selectedStaffStats.commission_products_percentage}%
                  </p>
                )}
              </div>
              <input
                type="month"
                className="border border-gray-200 p-2.5 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
                value={statsMonth}
                onChange={handleMonthChange}
              />
            </div>

            <div className={commissionsEnabled ? "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" : "grid grid-cols-1 gap-4 mb-6"}>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-500 font-medium">Facturado Total</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.totalRevenue.toFixed(2)}€</p>
                <div className="text-xs text-gray-500 mt-1">Srv: {statsData.servicesRevenue.toFixed(2)}€ | Prod: {statsData.productsRevenue.toFixed(2)}€</div>
              </div>
              {commissionsEnabled && (
                <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 md:col-span-2 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-primary font-medium">Comisión Total Acumulada</p>
                    <p className="text-2xl font-bold text-primary">{statsData.totalCommission.toFixed(2)}€</p>
                    <div className="text-xs text-primary/70 mt-1">Srv: {statsData.commissionServices.toFixed(2)}€ | Prod: {statsData.commissionProducts.toFixed(2)}€</div>
                  </div>
                  <DollarSign className="w-12 h-12 text-primary opacity-20" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto border border-gray-100 rounded-xl shadow-inner bg-gray-50">
              <table className="w-full text-sm text-left">
                <thead className="bg-white border-b sticky top-0">
                  <tr>
                    <th className="p-3 font-semibold text-gray-600">Fecha</th>
                    <th className="p-3 font-semibold text-gray-600">Origen / Servicio</th>
                    <th className="p-3 font-semibold text-gray-600 text-right">Importe</th>
                    <th className="p-3 font-semibold text-gray-600 text-center">Comisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingStats ? (
                    <tr><td colSpan="4" className="p-8 text-center text-gray-500">Calculando rendimiento...</td></tr>
                  ) : statsData.sales.length === 0 ? (
                    <tr><td colSpan="4" className="p-8 text-center text-gray-500">No hay ventas registradas en este periodo.</td></tr>
                  ) : (
                    statsData.sales.map(s => {
                      const commS = selectedStaffStats.commission_percentage || 0
                      const commP = selectedStaffStats.commission_products_percentage || 0
                      const config = selectedStaffStats.services_commission_config || {}
                      
                      let saleCommission = 0
                      let detailText = []
                      
                      if (s.items && s.items.length > 0) {
                        s.items.forEach(item => {
                          const lineT = item.quantity * item.price
                          if (item.item_type === 'service' && config[item.item_id] !== false) {
                            saleCommission += (lineT * commS) / 100
                            detailText.push(`${commS}%`)
                          } else if (item.item_type === 'product') {
                            saleCommission += (lineT * commP) / 100
                            detailText.push(`${commP}%`)
                          } else if (item.item_type === 'service' && config[item.item_id] === false) {
                            detailText.push(`0% (Exento)`)
                          }
                        })
                      } else {
                         // Fallback old sales
                         if (s.notes === 'Venta directa') {
                           saleCommission = (Number(s.total_amount) * commP) / 100
                           detailText.push(`${commP}%`)
                         } else {
                           saleCommission = (Number(s.total_amount) * commS) / 100
                           detailText.push(`${commS}%`)
                         }
                      }

                      return (
                        <tr key={s.id} className="hover:bg-white transition-colors bg-gray-50/30">
                          <td className="p-3 whitespace-nowrap text-gray-600">
                            {new Date(s.created_at).toLocaleDateString()} <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="p-3 font-medium text-gray-900">
                            {s.appointment?.service?.name ? `Cita: ${s.appointment.service.name}` : 'Venta de Productos (TPV)'}
                            {s.notes && <div className="text-xs text-gray-500 font-normal mt-0.5">{s.notes}</div>}
                          </td>
                          <td className="p-3 font-bold text-gray-900 text-right">{Number(s.total_amount).toFixed(2)}€</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${saleCommission > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              +{saleCommission.toFixed(2)}€
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setStatsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
