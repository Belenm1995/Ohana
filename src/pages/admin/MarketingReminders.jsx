import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  CalendarClock, Calendar, MessageCircle, CheckCircle, Clock,
  AlertCircle, Copy, Check, Sparkles,
  RefreshCw, UserCheck, Star
} from 'lucide-react'

// Plantillas predefinidas
const TEMPLATE_PRESETS = [
  {
    id: 'reminder_24h',
    name: 'Recordatorio 24h (Confirmación)',
    icon: CalendarClock,
    text: "¡Hola [Nombre]! ✨ Te recordamos que tienes una cita en Ohana el [Fecha] a las [Hora] para [Servicio]. Por favor, confírmanos si podrás asistir para tenerlo todo preparado para ti. ¡Te esperamos! ☕"
  },
  {
    id: 'reminder_today',
    name: 'Aviso de Cita Hoy',
    icon: Clock,
    text: "¡Hola [Nombre]! ☕ Te esperamos hoy en Ohana a las [Hora] para tu cita de [Servicio]. Si necesitas cualquier cosa antes de venir o surge algún imprevisto, avísanos por aquí. ¡Hasta ahora!"
  },
  {
    id: 'google_review',
    name: '⭐ Pedir Reseña en Google',
    icon: Star,
    text: "¡Hola [Nombre]! 💖 Esperamos que hayas disfrutado mucho de tu visita a Ohana para [Servicio]. Tu opinión nos ayuda muchísimo: si nos dejas una valoración rápida en Google te lo agradeceremos un montón: [Enlace Google]. ¡Un abrazo y feliz día!"
  }
]

export default function MarketingReminders() {
  const getInitialTargetDate = () => {
    const d = new Date()
    const day = d.getDay() // 0: Sun, 5: Fri, 6: Sat
    let addDays = 1
    if (day === 5) addDays = 3 // Friday -> Monday
    if (day === 6) addDays = 2 // Saturday -> Monday
    d.setDate(d.getDate() + addDays)
    return d.toISOString().split('T')[0]
  }

  const [targetDate, setTargetDate] = useState(getInitialTargetDate())
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedAppId, setCopiedAppId] = useState(null)
  const [googleReviewUrl, setGoogleReviewUrl] = useState(() => {
    return localStorage.getItem('ohana_google_review_url') || 'https://g.page/r/ohana/review'
  })

  // Plantilla editable
  const [messageTemplate, setMessageTemplate] = useState(TEMPLATE_PRESETS[0].text)

  useEffect(() => {
    fetchAppointments()
  }, [targetDate])

  async function fetchAppointments() {
    setLoading(true)
    try {
      const targetStart = new Date(`${targetDate}T00:00:00`)
      const targetEnd = new Date(`${targetDate}T23:59:59.999`)

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, start_time, end_time, status, reminder_sent, items,
          client:clients (id, name, phone),
          service:services (id, name)
        `)
        .neq('status', 'cancelled')
        .gte('start_time', targetStart.toISOString())
        .lte('start_time', targetEnd.toISOString())
        .order('start_time', { ascending: true })

      if (error) throw error

      // Cargar confirmaciones locales como fallback
      const localConfirmations = JSON.parse(localStorage.getItem('ohana_confirmed_appts') || '{}')
      const enriched = (data || []).map(app => ({
        ...app,
        is_confirmed_by_client: !!localConfirmations[app.id]
      }))

      setAppointments(enriched)
    } catch (err) {
      console.error('Error fetching appointments:', err)
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  // Guardar URL de reseñas en localStorage
  const handleSaveReviewUrl = (val) => {
    setGoogleReviewUrl(val)
    localStorage.setItem('ohana_google_review_url', val)
  }

  // Generar mensaje final para una cita
  const buildFinalMessage = (app) => {
    const client = app.client || app.clients
    const clientName = client?.name ? client.name.split(' ')[0] : 'Cliente'
    const appDate = new Date(app.start_time)
    const timeString = appDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    const dateString = appDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

    // Extraer servicio(s)
    let serviceName = 'su servicio'
    if (app.items && Array.isArray(app.items) && app.items.length > 0) {
      serviceName = app.items.map(i => i.name || i.item_name).filter(Boolean).join(' + ')
    } else if (app.service?.name) {
      serviceName = app.service.name
    }

    return messageTemplate
      .replace(/\[Nombre\]/g, clientName)
      .replace(/\[Hora\]/g, timeString)
      .replace(/\[Fecha\]/g, dateString)
      .replace(/\[Servicio\]/g, serviceName)
      .replace(/\[Enlace Google\]/g, googleReviewUrl || '')
  }

  // Enviar WhatsApp individual 1-Clic
  const handleSendSingleWhatsApp = async (app) => {
    const client = app.client || app.clients
    const phone = client?.phone
    if (!phone) return alert('El cliente no tiene teléfono registrado.')

    let cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length === 9) cleanPhone = '34' + cleanPhone

    const finalMessage = buildFinalMessage(app)

    // 1. Marcar como enviado en Supabase
    try {
      await supabase.from('appointments').update({ reminder_sent: true }).eq('id', app.id)
      setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, reminder_sent: true } : a))
    } catch (err) {
      console.warn('Error actualizando reminder_sent:', err)
    }

    // 2. Abrir WhatsApp directamente
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(finalMessage)}`
    window.open(url, '_blank')
  }

  // Copiar mensaje al portapapeles
  const handleCopyMessage = (app) => {
    const finalMessage = buildFinalMessage(app)
    navigator.clipboard.writeText(finalMessage)
    setCopiedAppId(app.id)
    setTimeout(() => setCopiedAppId(null), 2500)
  }

  // Alternar estado de confirmación por la clienta
  const toggleClientConfirmation = async (app) => {
    const current = !!app.is_confirmed_by_client
    const nextVal = !current

    // Guardar en localStorage para persistencia inmediata
    const localConfirmations = JSON.parse(localStorage.getItem('ohana_confirmed_appts') || '{}')
    localConfirmations[app.id] = nextVal
    localStorage.setItem('ohana_confirmed_appts', JSON.stringify(localConfirmations))

    setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, is_confirmed_by_client: nextVal } : a))

    try {
      await supabase
        .from('appointments')
        .update({ is_confirmed_by_client: nextVal })
        .eq('id', app.id)
    } catch {
      // Ignorar si la columna no existe en Supabase
    }
  }

  // Alternar estado de recordatorio enviado manualmente
  const toggleReminderSent = async (app) => {
    const current = !!app.reminder_sent
    const nextVal = !current

    try {
      await supabase
        .from('appointments')
        .update({ reminder_sent: nextVal })
        .eq('id', app.id)

      setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, reminder_sent: nextVal } : a))
    } catch (err) {
      console.error('Error toggling reminder_sent:', err)
    }
  }

  // Insertar variable en la plantilla
  const handleInsertVariable = (variable) => {
    setMessageTemplate(prev => prev + ' ' + variable)
  }

  // Fechas rápidas
  const setQuickDate = (offsetDays) => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    setTargetDate(d.toISOString().split('T')[0])
  }

  // Fechas de referencia para resaltar botones activos
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const tomorrowStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }, [])
  const pastTomorrowStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().split('T')[0]
  }, [])
  const yesterdayStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }, [])

  // Métricas
  const metrics = useMemo(() => {
    const total = appointments.length
    const sent = appointments.filter(a => a.reminder_sent).length
    const pending = total - sent
    const confirmed = appointments.filter(a => a.is_confirmed_by_client).length
    return { total, sent, pending, confirmed }
  }, [appointments])

  return (
    <div className="flex flex-col gap-6">

      {/* CABECERA Y SELECTOR DE FECHAS */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-primary" /> Recordatorios de Citas por WhatsApp
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Envía recordatorios a tus clientas con 1 solo clic y controla quién ha confirmado su asistencia.
          </p>
        </div>

        {/* Botones rápidos de fecha */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setQuickDate(-1)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              targetDate === yesterdayStr ? 'bg-gray-900 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Ayer (Reseñas)
          </button>
          <button
            type="button"
            onClick={() => setQuickDate(0)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              targetDate === todayStr ? 'bg-gray-900 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setQuickDate(1)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              targetDate === tomorrowStr ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            Mañana ⭐
          </button>
          <button
            type="button"
            onClick={() => setQuickDate(2)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              targetDate === pastTomorrowStr ? 'bg-gray-900 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Pasado Mañana
          </button>

          <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-xl px-2.5 py-1">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="text-xs font-semibold text-gray-800 outline-none cursor-pointer bg-transparent"
            />
          </div>

          <button
            type="button"
            onClick={fetchAppointments}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition cursor-pointer"
            title="Recargar citas"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* BARRA DE MÉTRICAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase">Citas del Día</span>
            <div className="text-xl font-black text-gray-900 mt-0.5">{metrics.total}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center font-bold">
            <Calendar className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-600 uppercase">Sin Enviar</span>
            <div className="text-xl font-black text-amber-700 mt-0.5">{metrics.pending}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 uppercase">Recordatorio Enviado</span>
            <div className="text-xl font-black text-emerald-700 mt-0.5">{metrics.sent}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-indigo-600 uppercase">Confirmadas Clienta</span>
            <div className="text-xl font-black text-indigo-700 mt-0.5">{metrics.confirmed}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* PLANTILLA Y PERSONALIZACIÓN */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" /> Mensaje para WhatsApp
            </h3>
            <span className="text-[11px] text-gray-500">
              Elige una plantilla rápida o edita el texto a tu gusto.
            </span>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {TEMPLATE_PRESETS.map(preset => {
              const Icon = preset.icon
              const isSelected = messageTemplate === preset.text
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setMessageTemplate(preset.text)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {preset.name}
                </button>
              )
            })}
          </div>
        </div>

        <textarea
          rows={3}
          value={messageTemplate}
          onChange={(e) => setMessageTemplate(e.target.value)}
          className="w-full p-3 rounded-xl border border-gray-200 text-xs text-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition resize-y font-normal"
        />

        {/* Variables clicables y enlace Google */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-400 text-[11px] font-semibold">Variables:</span>
            {['[Nombre]', '[Hora]', '[Fecha]', '[Servicio]', '[Enlace Google]'].map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => handleInsertVariable(tag)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition"
                title={`Insertar ${tag}`}
              >
                + {tag}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="text-[11px] font-medium shrink-0">Tu Enlace de Google:</span>
            <input
              type="text"
              value={googleReviewUrl}
              onChange={(e) => handleSaveReviewUrl(e.target.value)}
              placeholder="https://g.page/r/.../review"
              className="border border-gray-200 px-2 py-1 rounded-lg text-[11px] font-mono w-48 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* TABLA DE CITAS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="font-bold text-gray-800 text-xs">
            Citas programadas ({appointments.length})
          </div>
          <div className="text-[11px] text-gray-500">
            Al pulsar <strong>Enviar WhatsApp</strong> se abre el chat directo con el texto listo.
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            Cargando citas...
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center">
            <CalendarClock className="w-12 h-12 mb-2 text-gray-300 stroke-1" />
            <p className="font-semibold text-gray-700 text-sm">No hay citas programadas para este día.</p>
            <p className="text-xs text-gray-400 mt-1">Prueba a seleccionar otra fecha arriba.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-600 font-semibold">
                  <th className="p-3.5 whitespace-nowrap">Hora</th>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Servicio(s)</th>
                  <th className="p-3.5 text-center">Recordatorio</th>
                  <th className="p-3.5 text-center">Confirmación</th>
                  <th className="p-3.5 text-right">Acciones WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map((app) => {
                  const client = app.client || app.clients
                  const phone = client?.phone
                  const appDate = new Date(app.start_time)
                  const timeStr = appDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

                  // Servicios
                  let serviceLabel = '-'
                  if (app.items && Array.isArray(app.items) && app.items.length > 0) {
                    serviceLabel = app.items.map(i => i.name || i.item_name).filter(Boolean).join(' + ')
                  } else if (app.service?.name) {
                    serviceLabel = app.service.name
                  }

                  const isSent = !!app.reminder_sent
                  const isConfirmed = !!app.is_confirmed_by_client
                  const isCopied = copiedAppId === app.id

                  return (
                    <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* HORA */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-black text-gray-900 text-sm">{timeStr}</span>
                      </td>

                      {/* CLIENTE */}
                      <td className="p-3.5">
                        <div className="font-bold text-gray-900 text-xs">{client?.name || 'Cliente sin nombre'}</div>
                        {phone ? (
                          <div className="text-[11px] text-gray-500 font-mono mt-0.5">{phone}</div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            <AlertCircle className="w-3 h-3" /> Sin teléfono
                          </span>
                        )}
                      </td>

                      {/* SERVICIO */}
                      <td className="p-3.5">
                        <span className="font-medium text-gray-800 block truncate max-w-[240px]" title={serviceLabel}>
                          {serviceLabel}
                        </span>
                      </td>

                      {/* ESTADO RECORDATORIO */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleReminderSent(app)}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer transition ${
                            isSent
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
                          }`}
                          title="Haz clic para cambiar manualmente"
                        >
                          {isSent ? <CheckCircle className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-amber-600" />}
                          {isSent ? 'Enviado' : 'Pendiente'}
                        </button>
                      </td>

                      {/* CONFIRMACIÓN CLIENTA */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleClientConfirmation(app)}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer transition ${
                            isConfirmed
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title="Haz clic cuando la clienta confirme que viene"
                        >
                          {isConfirmed ? <Check className="w-3 h-3 text-indigo-700 stroke-[3]" /> : null}
                          {isConfirmed ? 'Confirmada' : 'Por confirmar'}
                        </button>
                      </td>

                      {/* ACCIONES */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Copiar */}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(app)}
                            disabled={!phone}
                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 rounded-xl font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            title="Copiar texto con datos de la clienta al portapapeles"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700">¡Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-gray-500" />
                                Copiar
                              </>
                            )}
                          </button>

                          {/* Enviar WhatsApp 1-Clic */}
                          <button
                            type="button"
                            onClick={() => handleSendSingleWhatsApp(app)}
                            disabled={!phone}
                            className="px-3.5 py-1.5 bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                            title="Abrir WhatsApp con mensaje personalizado listo para enviar"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Enviar WhatsApp</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
