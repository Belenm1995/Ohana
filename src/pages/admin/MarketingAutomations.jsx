import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Gift, UserMinus, Star, MessageCircle, Copy, Check,
  RefreshCw, Sparkles
} from 'lucide-react'

export default function MarketingAutomations() {
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('birthdays') // 'birthdays' | 'sleeping' | 'reviews'

  // Datos
  const [clients, setClients] = useState([])
  const [recentAppointments, setRecentAppointments] = useState([])
  const [copiedId, setCopiedId] = useState(null)

  // Filtros
  const [birthdayFilter, setBirthdayFilter] = useState('today') // 'today' | 'week' | 'month'
  const [sleepingDays, setSleepingDays] = useState(60) // 30, 60, 90, 180
  const [reviewDays, setReviewDays] = useState(3) // 1, 3, 7 días atrás

  // Enlace de Google Reviews (persistido)
  const [googleReviewUrl, setGoogleReviewUrl] = useState(() => {
    return localStorage.getItem('ohana_google_review_url') || 'https://g.page/r/ohana/review'
  })

  // Plantillas
  const [birthdayTemplate, setBirthdayTemplate] = useState(
    "¡Feliz cumpleaños [Nombre]! 🎂🎉 De parte de todo el equipo de Ohana te deseamos un día maravilloso. Para celebrarlo, tienes un 10% de descuento de regalo en tu próxima visita este mes. ¡Ven a consentirte cuando quieras! 💖"
  )
  const [sleepingTemplate, setSleepingTemplate] = useState(
    "¡Hola [Nombre]! 🌸 Te echamos de menos en Ohana. Hace ya un tiempo desde tu última visita y nos encantaría volver a verte. Si te apetece retocar tu look o un momento de relax, escríbenos y te guardamos cita. ¡Un abrazo!"
  )
  const [reviewTemplate, setReviewTemplate] = useState(
    "¡Hola [Nombre]! ✨ Esperamos que hayas disfrutado mucho de tu experiencia en Ohana para [Servicio]. Si te ha gustado el resultado, nos harías muy felices si nos dejas una valoración rápida en Google: [Enlace Google]. ¡Muchísimas gracias por confiar en nosotras! 💖"
  )

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // 1. Cargar clientes con citas y ventas
      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select(`
          id, name, phone, email, birth_date,
          appointments ( id, start_time, status, service:services(name), items )
        `)
      if (clientErr) throw clientErr

      // 2. Cargar citas completadas recientes para la sección de Reseñas Google
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - 14) // últimos 14 días

      const { data: apptData, error: apptErr } = await supabase
        .from('appointments')
        .select(`
          id, start_time, status,
          client:clients (id, name, phone),
          service:services (name),
          items
        `)
        .in('status', ['completed', 'confirmed'])
        .gte('start_time', sinceDate.toISOString())
        .lte('start_time', new Date().toISOString())
        .order('start_time', { ascending: false })

      if (apptErr) console.warn('Error cargando citas recientes para reseñas:', apptErr)

      setClients(clientsData || [])
      setRecentAppointments(apptData || [])
    } catch (err) {
      console.error('Error fetching marketing automations:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveReviewUrl = (val) => {
    setGoogleReviewUrl(val)
    localStorage.setItem('ohana_google_review_url', val)
  }

  // --- 1. CUMPLEAÑOS ---
  const birthdayClients = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentDay = now.getDate()

    return clients.filter(c => {
      if (!c.birth_date) return false
      const parts = c.birth_date.split('-')
      if (parts.length !== 3) return false
      const bMonth = parseInt(parts[1], 10)
      const bDay = parseInt(parts[2], 10)

      if (birthdayFilter === 'today') {
        return bMonth === currentMonth && bDay === currentDay
      }

      if (birthdayFilter === 'week') {
        // En los próximos 7 días
        for (let i = 0; i < 7; i++) {
          const d = new Date()
          d.setDate(d.getDate() + i)
          if (bMonth === (d.getMonth() + 1) && bDay === d.getDate()) return true
        }
        return false
      }

      if (birthdayFilter === 'month') {
        return bMonth === currentMonth
      }

      return false
    }).sort((a, b) => {
      const dayA = parseInt(a.birth_date.split('-')[2], 10) || 0
      const dayB = parseInt(b.birth_date.split('-')[2], 10) || 0
      return dayA - dayB
    })
  }, [clients, birthdayFilter])

  // --- 2. CLIENTAS INACTIVAS (DORMIDAS) ---
  const sleepingClients = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - sleepingDays)

    return clients.map(client => {
      // Encontrar la última cita completada o confirmada
      const appts = (client.appointments || [])
        .filter(a => a.status === 'completed' || a.status === 'confirmed')
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))

      if (appts.length === 0) return null // No ha venido nunca

      const lastAppt = appts[0]
      const lastDate = new Date(lastAppt.start_time)
      if (lastDate > cutoffDate) return null // Ha venido recientemente

      // Días inactivo
      const diffMs = now.getTime() - lastDate.getTime()
      const daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      // Extraer servicio
      let lastService = 'un servicio'
      if (lastAppt.items && Array.isArray(lastAppt.items) && lastAppt.items.length > 0) {
        lastService = lastAppt.items.map(i => i.name || i.item_name).filter(Boolean).join(' + ')
      } else if (lastAppt.service?.name) {
        lastService = lastAppt.service.name
      }

      return {
        ...client,
        lastDate,
        daysInactive,
        lastService
      }
    }).filter(Boolean).sort((a, b) => b.daysInactive - a.daysInactive)
  }, [clients, sleepingDays])

  // --- 3. RESEÑAS DE GOOGLE (POST-CITA) ---
  const reviewCandidates = useMemo(() => {
    const now = new Date()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - reviewDays)

    // Agrupar por client_id para no repetir el mismo cliente
    const map = new Map()
    recentAppointments.forEach(app => {
      const client = app.client || app.clients
      if (!client || !client.id) return
      const appDate = new Date(app.start_time)

      if (appDate >= cutoff && appDate <= now) {
        if (!map.has(client.id)) {
          let serviceName = 'tu servicio'
          if (app.items && Array.isArray(app.items) && app.items.length > 0) {
            serviceName = app.items.map(i => i.name || i.item_name).filter(Boolean).join(' + ')
          } else if (app.service?.name) {
            serviceName = app.service.name
          }

          map.set(client.id, {
            client,
            appointmentDate: appDate,
            serviceName
          })
        }
      }
    })

    return Array.from(map.values())
  }, [recentAppointments, reviewDays])

  // Helper para abrir WhatsApp
  const openWhatsApp = (phone, text) => {
    if (!phone) return alert('El cliente no tiene teléfono')
    let cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length === 9) cleanPhone = '34' + cleanPhone

    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  // Helper para copiar al portapapeles
  const copyText = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-2 text-gray-500 text-xs">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        Analizando clientes para automatizaciones...
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* SUB-TABS SELECTOR */}
      <div className="bg-white p-2 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveSection('birthdays')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSection === 'birthdays'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Gift className="w-4 h-4" /> Cumpleaños ({birthdayClients.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('sleeping')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSection === 'sleeping'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <UserMinus className="w-4 h-4" /> Recuperación Inactivos ({sleepingClients.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('reviews')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeSection === 'reviews'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Star className="w-4 h-4" /> Reseñas Google Post-Cita ({reviewCandidates.length})
          </button>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition cursor-pointer"
          title="Actualizar datos"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* --- SECCIÓN 1: CUMPLEAÑOS --- */}
      {activeSection === 'birthdays' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-pink-100 text-pink-600 rounded-2xl">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Cumpleaños de Clientas</h3>
                <p className="text-xs text-gray-500 mt-0.5">Felicita a tus clientas y envíales un regalo o descuento para su mes especial.</p>
              </div>
            </div>

            {/* Filtros de Cumpleaños */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setBirthdayFilter('today')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  birthdayFilter === 'today' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setBirthdayFilter('week')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  birthdayFilter === 'week' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Próximos 7 días
              </button>
              <button
                type="button"
                onClick={() => setBirthdayFilter('month')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  birthdayFilter === 'month' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Este Mes
              </button>
            </div>
          </div>

          {/* Plantilla */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-500" /> Mensaje de Felicitación para WhatsApp
            </label>
            <textarea
              rows={3}
              value={birthdayTemplate}
              onChange={(e) => setBirthdayTemplate(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-none"
            />
            <p className="text-[11px] text-gray-400">
              Usa <strong>[Nombre]</strong> para personalizar con el nombre de cada clienta.
            </p>
          </div>

          {/* Lista de Cumpleañeras */}
          {birthdayClients.length === 0 ? (
            <div className="text-center py-12 bg-pink-50/50 rounded-2xl border border-dashed border-pink-200 text-pink-900">
              <Gift className="w-8 h-8 mx-auto text-pink-300 mb-2 stroke-1" />
              <p className="text-xs font-bold">No hay clientas que cumplan años en este período seleccionado.</p>
              <p className="text-[11px] text-pink-600 mt-0.5">Prueba a seleccionar "Próximos 7 días" o "Este Mes".</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700 mb-2">
                {birthdayClients.length} {birthdayClients.length === 1 ? 'clienta cumple años' : 'clientas cumplen años'}:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {birthdayClients.map(client => {
                  const firstName = client.name ? client.name.split(' ')[0] : 'Cliente'
                  const message = birthdayTemplate.replace(/\[Nombre\]/g, firstName)
                  const birthParts = (client.birth_date || '').split('-')
                  const birthFormatted = birthParts.length === 3 ? `${birthParts[2]}/${birthParts[1]}` : client.birth_date
                  const isCopied = copiedId === client.id

                  return (
                    <div
                      key={client.id}
                      className="p-3.5 bg-gray-50/70 border border-gray-200 rounded-xl flex items-center justify-between gap-3 hover:bg-pink-50/30 hover:border-pink-200 transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900">{client.name}</span>
                          <span className="text-[10px] font-bold bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full">
                            🎂 {birthFormatted}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                          {client.phone || 'Sin teléfono'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyText(client.id, message)}
                          disabled={!client.phone}
                          className="px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-100 transition cursor-pointer"
                          title="Copiar texto"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => openWhatsApp(client.phone, message)}
                          disabled={!client.phone}
                          className="px-3 py-1.5 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-40 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Felicitar</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SECCIÓN 2: RECUPERACIÓN DE CLIENTAS DORMIDAS --- */}
      {activeSection === 'sleeping' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                <UserMinus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Recuperación de Clientas Inactivas</h3>
                <p className="text-xs text-gray-500 mt-0.5">Escribe a las clientas habituales que llevan semanas o meses sin pasar por el salón.</p>
              </div>
            </div>

            {/* Selector de días sin visita */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-bold">
              {[
                { label: '+30 días', val: 30 },
                { label: '+60 días (2m)', val: 60 },
                { label: '+90 días (3m)', val: 90 },
                { label: '+180 días (6m)', val: 180 }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setSleepingDays(opt.val)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    sleepingDays === opt.val ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plantilla */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Mensaje de Recuperación para WhatsApp
            </label>
            <textarea
              rows={3}
              value={sleepingTemplate}
              onChange={(e) => setSleepingTemplate(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
            />
            <p className="text-[11px] text-gray-400">
              Usa <strong>[Nombre]</strong> para el nombre y <strong>[Servicio]</strong> para el servicio de su última visita.
            </p>
          </div>

          {/* Lista de Clientas Inactivas */}
          {sleepingClients.length === 0 ? (
            <div className="text-center py-12 bg-purple-50/50 rounded-2xl border border-dashed border-purple-200 text-purple-900">
              <UserMinus className="w-8 h-8 mx-auto text-purple-300 mb-2 stroke-1" />
              <p className="text-xs font-bold">¡Genial! No hay clientas que lleven más de {sleepingDays} días sin visitarte.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700 mb-2">
                {sleepingClients.length} {sleepingClients.length === 1 ? 'clienta pendiente de reactivar' : 'clientas pendientes de reactivar'}:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {sleepingClients.map(client => {
                  const firstName = client.name ? client.name.split(' ')[0] : 'Cliente'
                  const message = sleepingTemplate
                    .replace(/\[Nombre\]/g, firstName)
                    .replace(/\[Servicio\]/g, client.lastService || 'tu cita')

                  const isCopied = copiedId === client.id

                  return (
                    <div
                      key={client.id}
                      className="p-3.5 bg-gray-50/70 border border-gray-200 rounded-xl flex items-center justify-between gap-3 hover:bg-purple-50/30 hover:border-purple-200 transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900">{client.name}</span>
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                            Hace {client.daysInactive} días
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[260px]">
                          Última visita: {client.lastDate.toLocaleDateString('es-ES')} ({client.lastService})
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {client.phone || 'Sin teléfono'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyText(client.id, message)}
                          disabled={!client.phone}
                          className="px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-100 transition cursor-pointer"
                          title="Copiar texto"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => openWhatsApp(client.phone, message)}
                          disabled={!client.phone}
                          className="px-3 py-1.5 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-40 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Escribir</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SECCIÓN 3: SOLICITUD DE RESEÑAS DE GOOGLE (POST-CITA) --- */}
      {activeSection === 'reviews' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Solicitud de Reseñas en Google Maps</h3>
                <p className="text-xs text-gray-500 mt-0.5">Pide una valoración a las clientas que han salido satisfechas de su cita reciente.</p>
              </div>
            </div>

            {/* Selector de días transcurridos */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-bold">
              {[
                { label: 'Ayer / Hoy (1d)', val: 1 },
                { label: 'Últimos 3 días', val: 3 },
                { label: 'Últimos 7 días', val: 7 }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setReviewDays(opt.val)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    reviewDays === opt.val ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Enlace y Plantilla */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/80">
              <div>
                <span className="text-xs font-bold text-amber-900 block">Enlace directo a tu perfil de Google Reviews</span>
                <span className="text-[11px] text-amber-700">Pega aquí el enlace corto de tu ficha de Google Maps para que la clienta abra directamente el diálogo de 5 estrellas.</span>
              </div>
              <input
                type="text"
                value={googleReviewUrl}
                onChange={(e) => handleSaveReviewUrl(e.target.value)}
                placeholder="https://g.page/r/.../review"
                className="w-full sm:w-80 px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Mensaje para pedir Reseña
              </label>
              <textarea
                rows={3}
                value={reviewTemplate}
                onChange={(e) => setReviewTemplate(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
              <p className="text-[11px] text-gray-400">
                Usa <strong>[Nombre]</strong>, <strong>[Servicio]</strong> y <strong>[Enlace Google]</strong> para completar el texto.
              </p>
            </div>
          </div>

          {/* Lista de Candidatas a Reseña */}
          {reviewCandidates.length === 0 ? (
            <div className="text-center py-12 bg-amber-50/50 rounded-2xl border border-dashed border-amber-200 text-amber-900">
              <Star className="w-8 h-8 mx-auto text-amber-300 mb-2 stroke-1" />
              <p className="text-xs font-bold">No hay clientas con citas completadas en los últimos {reviewDays} días.</p>
              <p className="text-[11px] text-amber-600 mt-0.5">Prueba a seleccionar "Últimos 7 días".</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700 mb-2">
                {reviewCandidates.length} {reviewCandidates.length === 1 ? 'clienta visitó el salón recientemente' : 'clientas visitaron el salón recientemente'}:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {reviewCandidates.map(item => {
                  const client = item.client
                  const firstName = client.name ? client.name.split(' ')[0] : 'Cliente'
                  const message = reviewTemplate
                    .replace(/\[Nombre\]/g, firstName)
                    .replace(/\[Servicio\]/g, item.serviceName || 'su servicio')
                    .replace(/\[Enlace Google\]/g, googleReviewUrl || '')

                  const isCopied = copiedId === client.id

                  return (
                    <div
                      key={client.id}
                      className="p-3.5 bg-gray-50/70 border border-gray-200 rounded-xl flex items-center justify-between gap-3 hover:bg-amber-50/30 hover:border-amber-200 transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900">{client.name}</span>
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                            {item.appointmentDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[260px]">
                          Servicio: {item.serviceName}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {client.phone || 'Sin teléfono'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyText(client.id, message)}
                          disabled={!client.phone}
                          className="px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-100 transition cursor-pointer"
                          title="Copiar texto"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => openWhatsApp(client.phone, message)}
                          disabled={!client.phone}
                          className="px-3 py-1.5 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-40 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Pedir Reseña</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
