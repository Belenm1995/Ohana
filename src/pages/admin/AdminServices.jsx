import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Edit2, Search, Filter, Power, Scissors } from 'lucide-react'

export default function AdminServices() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [formData, setFormData] = useState({ 
    name: '', 
    duration_minutes: 30, 
    price: 0, 
    category: '', 
    description: '',
    is_active: true
  })
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todas')

  useEffect(() => {
    fetchServices()
  }, [])

  async function fetchServices() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('category')
        .order('name')

      if (error) throw error
      if (data) setServices(data)
    } catch (error) {
      console.error('Error fetching services:', error)
      alert('Error al cargar servicios. ¿Has ejecutado el script SQL para añadir las nuevas columnas?')
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const cats = new Set(services.map(s => s.category).filter(Boolean))
    return ['Todas', ...Array.from(cats)]
  }, [services])

  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = selectedCategory === 'Todas' || service.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [services, searchTerm, selectedCategory])

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingService(service)
      setFormData({
        name: service.name,
        duration_minutes: service.duration_minutes,
        price: service.price,
        category: service.category || '',
        description: service.description || '',
        is_active: service.is_active !== false // por si es null asume true
      })
    } else {
      setEditingService(null)
      setFormData({ 
        name: '', 
        duration_minutes: 30, 
        price: 0, 
        category: '', 
        description: '',
        is_active: true
      })
    }
    setIsModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(formData)
          .eq('id', editingService.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('services')
          .insert([formData])
        if (error) throw error
      }

      setIsModalOpen(false)
      fetchServices()
    } catch (error) {
      console.error('Error saving service:', error)
      alert('Error al guardar el servicio')
    }
  }

  async function handleToggleActive(service) {
    try {
      const newStatus = service.is_active === false ? true : false
      const { error } = await supabase
        .from('services')
        .update({ is_active: newStatus })
        .eq('id', service.id)

      if (error) throw error
      // Actualizar estado local
      setServices(services.map(s => s.id === service.id ? { ...s, is_active: newStatus } : s))
    } catch (error) {
      console.error('Error toggling status:', error)
      alert('Error al cambiar el estado del servicio')
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Estás seguro de eliminar este servicio permanentemente? (Recomendamos simplemente desactivarlo si ya no se ofrece)')) return

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchServices()
    } catch (error) {
      console.error('Error deleting service:', error)
      alert('Error al eliminar servicio')
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Scissors className="w-8 h-8 text-primary" /> Catálogo de Servicios
          </h1>
          <p className="text-gray-500 mt-1">Gestiona los servicios, precios, categorías y duraciones.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-black transition-colors shadow-sm flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Nuevo Servicio
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o descripción..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64 relative">
          <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none bg-white"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando catálogo...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredServices.map(service => {
            const isActive = service.is_active !== false // Default true
            return (
              <div 
                key={service.id} 
                className={`bg-white rounded-2xl border transition-all flex flex-col overflow-hidden group
                  ${isActive ? 'border-gray-200 shadow-sm hover:shadow-md hover:border-primary/30' : 'border-gray-200 opacity-60 bg-gray-50'}`}
              >
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-3">
                    {service.category ? (
                      <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {service.category}
                      </span>
                    ) : (
                      <span className="bg-orange-50 text-orange-600 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Sin categoría
                      </span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleToggleActive(service)} 
                        className={`p-1.5 rounded-lg transition-colors ${isActive ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50' : 'text-gray-400 hover:text-green-500 hover:bg-green-50'}`}
                        title={isActive ? 'Pausar servicio' : 'Activar servicio'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(service)} 
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(service.id)} 
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className={`text-lg font-bold mb-1 ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    {service.name}
                  </h3>
                  
                  {service.description && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed">
                      {service.description}
                    </p>
                  )}
                  
                </div>
                
                <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
                  <div className={`text-2xl font-black ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                    {Number(service.price).toLocaleString()}€
                  </div>
                  <div className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
                    ⏱ {service.duration_minutes} min
                  </div>
                </div>
              </div>
            )
          })}
          {filteredServices.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-gray-200 border-dashed">
              <p className="text-gray-500 text-lg font-medium">No se encontraron servicios</p>
              <p className="text-gray-400 mt-1">Prueba cambiando los filtros o añade un nuevo servicio.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Crear/Editar Servicio */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre del Servicio *</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Ej: Corte de Pelo Caballero"
                  className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Categoría (Texto libre)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Peluquería, Estética, Masajes..."
                  className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                  value={formData.category} 
                  onChange={e => setFormData({ ...formData, category: e.target.value })} 
                />
                <p className="text-xs text-gray-500 mt-1">Usa exactamente el mismo nombre para agrupar servicios (Ej: "Peluquería").</p>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Precio (€) *</label>
                  <input 
                    required 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none text-lg font-bold" 
                    value={formData.price} 
                    onChange={e => setFormData({ ...formData, price: e.target.value })} 
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Duración (min) *</label>
                  <input 
                    required 
                    type="number" 
                    min="5" 
                    step="5" 
                    className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                    value={formData.duration_minutes} 
                    onChange={e => setFormData({ ...formData, duration_minutes: e.target.value })} 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción (Opcional)</label>
                <textarea 
                  placeholder="Explica qué incluye este servicio para que el cliente lo vea en la web..."
                  className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none min-h-[100px]" 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                />
              </div>

              <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <div>
                  <div className="font-semibold text-gray-900">Servicio Activo</div>
                  <div className="text-sm text-gray-500">Si lo desmarcas, no aparecerá en la web de reservas.</div>
                </div>
              </label>

              <div className="flex justify-end gap-3 mt-2 border-t border-gray-100 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-6 py-3 rounded-xl font-bold text-white bg-gray-900 hover:bg-black transition-colors"
                >
                  {editingService ? 'Actualizar Servicio' : 'Guardar Servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
