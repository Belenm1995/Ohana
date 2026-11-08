import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Clock, Trash2, MessageCircle, CheckCircle, Gift, CreditCard, Calendar } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/button'

import { getStaffScheduleForDate } from '../../lib/scheduleUtils'

const START_HOUR = 8;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR); // 8:00 to 20:00

// Helper local para evitar desajustes de zona horaria con toISOString
const getDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Formateador de bloques de horario para badges
const formatTimeBlock = (b) => {
  const sh = String(b[0]).padStart(2, '0') + ':' + String(b[1]).padStart(2, '0');
  const eh = String(b[2]).padStart(2, '0') + ':' + String(b[3]).padStart(2, '0');
  return `${sh} - ${eh}`;
};

export default function AdminCalendar() {
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [view, setView] = useState('day') // 'day', 'week', 'month'
  const [staff, setStaff] = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [draggedAppt, setDraggedAppt] = useState(null)
  const [selectedApptDetails, setSelectedApptDetails] = useState(null)
  const [settings, setSettings] = useState(null)

  // States for New Appointment Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clients, setClients] = useState([])
  const [services, setServices] = useState([])
  const [formData, setFormData] = useState({
    client_id: '',
    staff_id: '',
    service_ids: [],
    start_time: '10:00',
    date: selectedDate.toISOString().split('T')[0]
  })

  // States for Technical History
  const [clientNotes, setClientNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [loadingNotes, setLoadingNotes] = useState(false)

  // Reprogramación de Cita (Cambiar día/hora/estilista)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [rescheduleData, setRescheduleData] = useState({
    date: '',
    time: '',
    staff_id: ''
  })

  useEffect(() => {
    if (selectedApptDetails) {
      const start = new Date(selectedApptDetails.start_time)
      const dateStr = getDateString(start)
      const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setRescheduleData({
        date: dateStr,
        time: timeStr,
        staff_id: selectedApptDetails.staff_id || ''
      })
      setIsRescheduling(false)
    }
  }, [selectedApptDetails])

  useEffect(() => {
    if (selectedApptDetails?.client_id) {
      fetchClientNotes(selectedApptDetails.client_id)
    } else {
      setClientNotes([])
      setNewNote('')
    }
  }, [selectedApptDetails])

  async function fetchClientNotes(clientId) {
    setLoadingNotes(true)
    try {
      const { data } = await supabase
        .from('client_notes')
        .select(`
          id,
          content,
          created_at,
          staff:staff(name)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (data) setClientNotes(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingNotes(false)
    }
  }

  async function handleAddNote() {
    if (!newNote.trim() || !selectedApptDetails?.client_id) return
    try {
      const staffId = selectedApptDetails.staff_id || null;
      const { data, error } = await supabase.from('client_notes').insert([{
        client_id: selectedApptDetails.client_id,
        staff_id: staffId,
        content: newNote.trim()
      }]).select(`
        id,
        content,
        created_at,
        staff:staff(name)
      `).single()
      if (error) throw error
      if (data) {
        setClientNotes(prev => [data, ...prev])
        setNewNote('')
      }
    } catch (error) {
      console.error('Error saving note:', error)
      alert('Error al guardar la nota')
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedDate, view])

  async function fetchData() {
    setLoading(true)
    try {
      // Fetch Staff for columns
      const { data: staffData } = await supabase.from('staff').select('*').order('name')
      if (staffData) {
        // Excluir personal dado de baja y gerentes
        const activeStaff = staffData.filter(s =>
          s.role?.toLowerCase() !== 'inactivo' &&
          s.role?.toLowerCase() !== 'gerente'
        );
        setStaff(activeStaff)
      }

      // Fetch appointments in a wide range (current date +/- 40 days) to cover day/week/month views
      const startRange = new Date(selectedDate)
      startRange.setDate(startRange.getDate() - 40)
      startRange.setHours(0, 0, 0, 0)
      
      const endRange = new Date(selectedDate)
      endRange.setDate(endRange.getDate() + 40)
      endRange.setHours(23, 59, 59, 999)

      const { data: apptData } = await supabase
        .from('appointments')
        .select(`
          *,
          client:clients(name, phone),
          service:services(name, duration_minutes)
        `)
        .gte('start_time', startRange.toISOString())
        .lte('start_time', endRange.toISOString())

      if (apptData) setAppointments(apptData)

      // Fetch Clients and Services for the modal
      const { data: clientsData } = await supabase.from('clients').select('id, name').order('name')
      if (clientsData) setClients(clientsData)

      const { data: servicesData } = await supabase.from('services').select('id, name, duration_minutes').order('name')
      if (servicesData) setServices(servicesData)

      const { data: settingsData } = await supabase.from('settings').select('opening_date').eq('id', 1).single()
      if (settingsData) setSettings(settingsData)

    } catch (error) {
      console.error('Error fetching calendar data:', error)
    } finally {
      setLoading(false)
    }
  }

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate)
    if (view === 'day') newDate.setDate(newDate.getDate() + direction)
    else if (view === 'week') newDate.setDate(newDate.getDate() + direction * 7)
    else if (view === 'month') newDate.setMonth(newDate.getMonth() + direction)
    setSelectedDate(newDate)
    setFormData(prev => ({ ...prev, date: newDate.toISOString().split('T')[0] }))
  }

  const getAppointmentStyle = (appt, personColor) => {
    const start = new Date(appt.start_time)
    const end = new Date(appt.end_time)

    const startHour = start.getHours() + (start.getMinutes() / 60)
    const endHour = end.getHours() + (end.getMinutes() / 60)

    // Ajustado a base START_HOUR (8:00) y tope END_HOUR + 1 (21:00)
    const topHour = Math.max(startHour, START_HOUR)
    const bottomHour = Math.min(endHour, END_HOUR + 1)

    const durationHours = Math.max(bottomHour - topHour, 0.25)

    const top = (topHour - START_HOUR) * 96;
    const height = durationHours * 96;

    return {
      top: `${top}px`,
      height: `${height}px`,
      backgroundColor: personColor ? `${personColor}20` : '#f3f4f6',
      borderColor: personColor || '#e5e7eb',
      borderLeftWidth: '4px'
    };
  };

  async function handleCreateAppointment(e) {
    e.preventDefault()
    try {
      const selectedServices = services.filter(s => formData.service_ids.includes(s.id))
      if (selectedServices.length === 0) return alert('Selecciona al menos un servicio')

      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0)

      const [hours, minutes] = formData.start_time.split(':').map(Number)
      const startDateTime = new Date(formData.date)
      startDateTime.setHours(hours, minutes, 0, 0)

      const endDateTime = new Date(startDateTime)
      endDateTime.setMinutes(endDateTime.getMinutes() + totalDuration)

      const apptItems = selectedServices.map(s => ({
        type: 'service', id: s.id, name: s.name, price: s.price, duration_minutes: s.duration_minutes, qty: 1
      }))

      const { error } = await supabase
        .from('appointments')
        .insert([{
          client_id: formData.client_id,
          staff_id: formData.staff_id,
          items: apptItems,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'confirmed'
        }])

      if (error) throw error

      setIsModalOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error creating appointment:', error)
      alert('Error al crear la cita')
    }
  }

  async function handleDeleteAppt(id) {
    if (!window.confirm('¿Seguro que quieres eliminar esta cita?')) return
    try {
      await supabase.from('appointments').delete().eq('id', id)
      fetchData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleSendWhatsApp = async (appt, type = 'reminder') => {
    const phone = appt.client?.phone;
    if (!phone) return alert('El cliente no tiene teléfono registrado.');

    const clientName = appt.client?.name || 'Cliente';
    const apptDate = new Date(appt.start_time);
    const time = apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = apptDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const service = appt.items
      ? appt.items.filter(i => i.type === 'service').map(i => i.name).join(' + ')
      : (appt.service?.name || 'su servicio');

    let text = '';
    if (type === 'reminder') {
      text = `¡Hola ${clientName}! En Ohana ya estamos preparando todo para tu momento de relax. Te recordamos tu cita el ${dateFormatted} a las ${time} para tu servicio de ${service}. Por favor, confírmanos tu asistencia para tenerlo todo perfecto a tu llegada. ☕✨`;
    } else if (type === 'review') {
      text = `¡Hola ${clientName}! Esperamos que hayas salido de Ohana sintiéndote increíble tras tu visita para ${service}. Si has disfrutado de la experiencia, nos harías muy felices si nos dejas una reseña rápida en Google. ¡Estamos deseando volver a verte! 💖`;
    }

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 9) cleanPhone = '34' + cleanPhone;

    // Actualizar reminder_sent en base de datos si es recordatorio
    if (type === 'reminder') {
      try {
        await supabase.from('appointments').update({ reminder_sent: true }).eq('id', appt.id);
        setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, reminder_sent: true } : a));
      } catch (err) {
        console.warn('No se pudo actualizar reminder_sent en Supabase:', err);
      }
    }

    // Abrir WhatsApp directamente con el mensaje pre-cargado
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  const toggleConfirmation = async (appt) => {
    try {
      const newValue = !appt.is_confirmed_by_client;
      await supabase
        .from('appointments')
        .update({ is_confirmed_by_client: newValue })
        .eq('id', appt.id);

      setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, is_confirmed_by_client: newValue } : a));
      setSelectedApptDetails(prev => prev ? { ...prev, is_confirmed_by_client: newValue } : null);
    } catch (e) {
      console.error(e);
      alert('Error al actualizar la confirmación');
    }
  }

  async function handleDrop(e, staffId) {
    e.preventDefault()
    if (!draggedAppt || view !== 'day') return // Solo D&D en vista día

    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top

    const exactMinutes = (offsetY / 96) * 60
    const roundedMinutes = Math.round(exactMinutes / 15) * 15

    const newStart = new Date(selectedDate)
    newStart.setHours(START_HOUR, roundedMinutes, 0, 0) // Base START_HOUR (8:00)

    const oldStart = new Date(draggedAppt.start_time)
    const oldEnd = new Date(draggedAppt.end_time)
    const durationMs = oldEnd.getTime() - oldStart.getTime()

    const newEnd = new Date(newStart.getTime() + durationMs)

    try {
      setAppointments(prev => prev.map(a =>
        a.id === draggedAppt.id
          ? { ...a, staff_id: staffId, start_time: newStart.toISOString(), end_time: newEnd.toISOString() }
          : a
      ))

      await supabase
        .from('appointments')
        .update({
          staff_id: staffId,
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString()
        })
        .eq('id', draggedAppt.id)
    } catch (err) {
      console.error(err)
      fetchData()
    } finally {
      setDraggedAppt(null)
    }
  }

  async function handleWeekDrop(e, targetDate) {
    e.preventDefault()
    if (!draggedAppt || view !== 'week') return

    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top

    const exactMinutes = (offsetY / 96) * 60
    const roundedMinutes = Math.round(exactMinutes / 15) * 15

    const newStart = new Date(targetDate)
    newStart.setHours(START_HOUR, roundedMinutes, 0, 0)

    const oldStart = new Date(draggedAppt.start_time)
    const oldEnd = new Date(draggedAppt.end_time)
    const durationMs = Math.max(oldEnd.getTime() - oldStart.getTime(), 15 * 60 * 1000)

    const newEnd = new Date(newStart.getTime() + durationMs)

    try {
      setAppointments(prev => prev.map(a =>
        a.id === draggedAppt.id
          ? { ...a, start_time: newStart.toISOString(), end_time: newEnd.toISOString() }
          : a
      ))

      await supabase
        .from('appointments')
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString()
        })
        .eq('id', draggedAppt.id)
    } catch (err) {
      console.error('Error al mover cita en vista semana:', err)
      fetchData()
    } finally {
      setDraggedAppt(null)
    }
  }

  async function handleSaveReschedule() {
    if (!selectedApptDetails || !rescheduleData.date || !rescheduleData.time) return

    try {
      const [hours, minutes] = rescheduleData.time.split(':').map(Number)
      const [y, m, d] = rescheduleData.date.split('-').map(Number)
      const newStart = new Date(y, m - 1, d, hours, minutes, 0, 0)

      const oldStart = new Date(selectedApptDetails.start_time)
      const oldEnd = new Date(selectedApptDetails.end_time)
      const durationMs = Math.max(oldEnd.getTime() - oldStart.getTime(), 15 * 60 * 1000)

      const newEnd = new Date(newStart.getTime() + durationMs)

      const updatedFields = {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        staff_id: rescheduleData.staff_id || selectedApptDetails.staff_id
      }

      const { error } = await supabase
        .from('appointments')
        .update(updatedFields)
        .eq('id', selectedApptDetails.id)

      if (error) throw error

      setAppointments(prev => prev.map(a =>
        a.id === selectedApptDetails.id ? { ...a, ...updatedFields } : a
      ))

      setSelectedApptDetails(prev => ({
        ...prev,
        ...updatedFields
      }))

      setIsRescheduling(false)

      // Centrar el calendario en el nuevo día para visualizar el cambio
      const targetDate = new Date(y, m - 1, d)
      setSelectedDate(targetDate)

    } catch (err) {
      console.error('Error al reprogramar cita:', err)
      alert('Error al reprogramar la cita')
    }
  }

  // Format date for display based on view
  let formattedDate = ''
  if (view === 'day') {
    formattedDate = selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  } else if (view === 'week') {
    const monday = new Date(selectedDate)
    monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1)
    const sunday = new Date(monday)
    sunday.setDate(sunday.getDate() + 6)
    formattedDate = `${monday.toLocaleDateString('es-ES', {day:'numeric', month:'short'})} - ${sunday.toLocaleDateString('es-ES', {day:'numeric', month:'short', year:'numeric'})}`
  } else {
    formattedDate = selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }

  // Renderers para las distintas vistas
  const renderDayView = () => {
    return (
      <div className="min-w-[800px] bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Cabecera de Columnas (Staff) */}
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          <div className="w-20 shrink-0 border-r border-gray-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          {staff.map(person => {
            const dateStr = getDateString(selectedDate);
            const scheduleBlocks = getStaffScheduleForDate(person, dateStr, settings?.opening_date);
            const isOff = scheduleBlocks.length === 0;

            return (
              <div key={person.id} className="flex-1 text-center py-3.5 px-2 border-r border-gray-100 last:border-0 relative">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: person.color }}></div>
                <h3 className="font-semibold text-gray-800 text-sm md:text-base leading-tight">{person.name}</h3>
                <p className="text-xs text-gray-400 font-medium mb-1.5">{person.role || 'Estilista'}</p>
                <div>
                  {isOff ? (
                    <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 bg-gray-100 text-gray-500 rounded-full border border-gray-200">
                      Día libre
                    </span>
                  ) : (
                    <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 shadow-xs">
                      {scheduleBlocks.map(formatTimeBlock).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cuerpo del Grid */}
        <div className="relative flex">
          {/* Columna de Horas */}
          <div className="w-20 shrink-0 flex flex-col border-r border-gray-100 bg-white">
            {HOURS.map(hour => (
              <div key={hour} className="h-24 border-b border-gray-100 text-right pr-3 py-2 text-sm text-gray-400 font-medium relative">
                {hour}:00
              </div>
            ))}
          </div>

          {/* Columnas de Staff */}
          <div className="flex-1 relative flex">
            {/* Líneas horizontales de guía */}
            <div className="absolute inset-0 pointer-events-none flex flex-col">
              {HOURS.map(hour => (
                <div key={hour} className="h-24 border-b border-gray-50/50 w-full" />
              ))}
            </div>

            {staff.map(person => {
              const personAppts = appointments.filter(a => {
                const aDate = new Date(a.start_time);
                return a.staff_id === person.id && 
                       aDate.getDate() === selectedDate.getDate() && 
                       aDate.getMonth() === selectedDate.getMonth() && 
                       aDate.getFullYear() === selectedDate.getFullYear();
              });
              const dateStr = getDateString(selectedDate);
              const scheduleBlocks = getStaffScheduleForDate(person, dateStr, settings?.opening_date);

              return (
                <div
                  key={person.id}
                  className="flex-1 border-r border-gray-100 last:border-0 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0iI2U1ZTdlYiIvPjwvc3ZnPg==')] bg-gray-50/50"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => handleDrop(e, person.id)}
                >
                  {/* Zonas de trabajo (blanco) */}
                  {scheduleBlocks.map((block, idx) => {
                    const sh = Math.max(block[0] + block[1]/60, START_HOUR);
                    const eh = Math.min(block[2] + block[3]/60, END_HOUR + 1);
                    if (sh >= eh) return null; 
                    
                    const top = (sh - START_HOUR) * 96;
                    const height = (eh - sh) * 96;
                    
                    return (
                      <div 
                        key={idx} 
                        className="absolute left-0 right-0 bg-white" 
                        style={{ top: `${top}px`, height: `${height}px`, zIndex: 0 }} 
                      />
                    )
                  })}

                  {personAppts.map(appt => (
                    <div
                      key={appt.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', appt.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedAppt(appt);
                      }}
                      onDragEnd={() => setDraggedAppt(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedApptDetails(appt);
                      }}
                      className={`absolute left-1 right-1 rounded p-2 shadow-sm flex flex-col overflow-hidden transition-transform cursor-pointer group ${draggedAppt?.id === appt.id ? 'opacity-50 ring-2 ring-primary border-dashed' : 'hover:scale-[1.02]'}`}
                      style={{...getAppointmentStyle(appt, person.color), zIndex: 10}}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-sm text-gray-900 truncate flex items-center gap-1">
                          {appt.client?.name || 'Desconocido'}
                          {appt.is_confirmed_by_client && <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />}
                          {appt.items?.some(i => i.type === 'gift_card_redemption') && (
                            <Gift className="w-3.5 h-3.5 text-primary shrink-0" title="Reserva con Tarjeta Regalo" />
                          )}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteAppt(appt.id); }} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs font-medium text-gray-700 truncate mt-0.5">
                        {appt.items
                          ? appt.items.filter(i => i.type === 'service').map(i => i.name).join(' + ')
                          : (appt.service?.name || 'Cita')}
                      </span>
                      <div className="mt-auto text-xs font-semibold text-gray-600">
                        {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                        {new Date(appt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const monday = new Date(selectedDate)
    monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1)
    
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      return d
    })

    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

    return (
      <div className="min-w-[1000px] bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Cabecera Días */}
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          <div className="w-20 shrink-0 border-r border-gray-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          {weekDays.map((date, i) => {
            const isToday = new Date().toDateString() === date.toDateString()
            return (
              <div key={i} className="flex-1 text-center py-3 border-r border-gray-100 last:border-0 relative cursor-pointer hover:bg-gray-100/50 transition-colors"
                   onClick={() => { setSelectedDate(date); setView('day'); }}>
                 <h3 className={`font-bold ${isToday ? 'text-primary' : 'text-gray-800'}`}>{dayNames[i]}</h3>
                 <p className={`text-sm ${isToday ? 'text-primary font-bold' : 'text-gray-500'}`}>{date.getDate()}</p>
                 {isToday && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary"></div>}
              </div>
            )
          })}
        </div>
        {/* Grid */}
        <div className="relative flex">
           {/* Horas */}
           <div className="w-20 shrink-0 flex flex-col border-r border-gray-100 bg-white">
             {HOURS.map(hour => (
               <div key={hour} className="h-24 border-b border-gray-100 text-right pr-3 py-2 text-sm text-gray-400 font-medium relative">
                 {hour}:00
               </div>
             ))}
           </div>
           {/* Columnas Días */}
           <div className="flex-1 relative flex">
              <div className="absolute inset-0 pointer-events-none flex flex-col">
                 {HOURS.map(hour => <div key={hour} className="h-24 border-b border-gray-50/50 w-full" />)}
              </div>
              
              {weekDays.map((date, i) => {
                const dayAppts = appointments.filter(a => {
                   const aDate = new Date(a.start_time);
                   return aDate.getDate() === date.getDate() && 
                          aDate.getMonth() === date.getMonth() && 
                          aDate.getFullYear() === date.getFullYear();
                });

                // Lógica de solapamiento para agrupar en columnas
                const sortedAppts = [...dayAppts].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
                const renderAppts = [];
                let currentGroup = [];
                let groupEnd = new Date(0);

                const processGroup = (group) => {
                  const cols = [];
                  group.forEach(ca => {
                    let placed = false;
                    for (let c = 0; c < cols.length; c++) {
                      if (new Date(cols[c][cols[c].length - 1].end_time) <= new Date(ca.start_time)) {
                        cols[c].push(ca); ca._col = c; placed = true; break;
                      }
                    }
                    if (!placed) { ca._col = cols.length; cols.push([ca]); }
                  });
                  group.forEach(ca => { ca._totalCols = cols.length; renderAppts.push(ca); });
                };

                sortedAppts.forEach(appt => {
                  const start = new Date(appt.start_time);
                  const end = new Date(appt.end_time);
                  if (start >= groupEnd) {
                    if (currentGroup.length > 0) processGroup(currentGroup);
                    currentGroup = [appt];
                    groupEnd = end;
                  } else {
                    currentGroup.push(appt);
                    if (end > groupEnd) groupEnd = end;
                  }
                });
                if (currentGroup.length > 0) processGroup(currentGroup);
                
                return (
                  <div
                    key={i}
                    className="flex-1 border-r border-gray-100 last:border-0 relative bg-white"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(e) => handleWeekDrop(e, date)}
                  >
                     {/* Citas superpuestas con ajuste de columnas */}
                     {renderAppts.map(appt => {
                        const person = staff.find(s => s.id === appt.staff_id)
                        const pColor = person?.color || '#cccccc'
                        
                        const style = getAppointmentStyle(appt, pColor);
                        if (appt._totalCols > 1) {
                           style.left = `calc(${appt._col * (100 / appt._totalCols)}% + 2px)`;
                           style.width = `calc(${100 / appt._totalCols}% - 4px)`;
                        } else {
                           style.left = '4px';
                           style.right = '4px';
                        }

                        return (
                          <div
                            key={appt.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', appt.id)
                              e.dataTransfer.effectAllowed = 'move'
                              setDraggedAppt(appt)
                            }}
                            onDragEnd={() => setDraggedAppt(null)}
                            onClick={(e) => { e.stopPropagation(); setSelectedApptDetails(appt); }}
                            className={`absolute rounded shadow-sm flex flex-col overflow-hidden transition-transform cursor-pointer hover:scale-[1.02] p-1.5 opacity-90 hover:opacity-100 border border-white/50 ${draggedAppt?.id === appt.id ? 'opacity-50 ring-2 ring-primary border-dashed' : ''}`}
                            style={{...style, zIndex: 10}}
                          >
                            <div className="flex items-start gap-1.5">
                               <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{backgroundColor: pColor}}></div>
                               <span className="font-bold text-xs leading-tight text-gray-900 truncate flex items-center gap-1">
                                 {appt.client?.name || 'Desconocido'}
                                 {appt.items?.some(i => i.type === 'gift_card_redemption') && (
                                   <Gift className="w-3 h-3 text-primary shrink-0" title="Reserva con Tarjeta Regalo" />
                                 )}
                               </span>
                            </div>
                            <span className="text-[11px] text-gray-700 truncate ml-4 font-medium">
                               {person?.name || 'Staff'}
                            </span>
                          </div>
                        )
                     })}
                  </div>
                )
              })}
           </div>
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    let startingDay = firstDay.getDay() || 7
    startingDay -= 1 // 0-indexed para empezar en Lunes
    
    const totalDays = lastDay.getDate()
    const calendarDays = []
    
    for (let i = 0; i < startingDay; i++) calendarDays.push(null)
    for (let i = 1; i <= totalDays; i++) calendarDays.push(new Date(year, month, i))
    while (calendarDays.length % 7 !== 0) calendarDays.push(null)

    const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[600px] h-full">
        {/* Cabecera Días */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
          {dayNames.map(d => (
            <div key={d} className="text-center py-3 font-bold text-gray-700 text-sm border-r border-gray-100 last:border-0">{d}</div>
          ))}
        </div>
        {/* Grid de Mes */}
        <div className="grid grid-cols-7 flex-1 auto-rows-[minmax(100px,1fr)]">
          {calendarDays.map((date, idx) => {
            if (!date) return <div key={idx} className="border-r border-b border-gray-50 bg-gray-50/30"></div>
            
            const isToday = new Date().toDateString() === date.toDateString()
            const dayAppts = appointments.filter(a => {
               const aDate = new Date(a.start_time);
               return aDate.getDate() === date.getDate() && 
                      aDate.getMonth() === date.getMonth() && 
                      aDate.getFullYear() === date.getFullYear();
            });

            return (
              <div key={idx} className="border-r border-b border-gray-100 p-2 flex flex-col relative hover:bg-gray-50/50 transition-colors cursor-pointer group"
                   onClick={() => {
                     setSelectedDate(date)
                     setView('day')
                   }}>
                <div className="flex justify-end mb-2">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${isToday ? 'bg-primary text-white' : 'text-gray-700 group-hover:bg-gray-200'}`}>
                    {date.getDate()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {dayAppts.map(appt => {
                     const person = staff.find(s => s.id === appt.staff_id)
                     const pColor = person?.color || '#cccccc'
                     return (
                       <div key={appt.id} className="w-2.5 h-2.5 rounded-full shadow-sm" style={{backgroundColor: pColor}} title={`${person?.name} - ${appt.client?.name || 'Cita'}`}></div>
                     )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Cabecera del Calendario */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 border-b border-gray-100 gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Agenda</h1>
          
          {/* Selector de Vista */}
          <div className="flex bg-gray-100/80 p-1 rounded-lg">
            <button onClick={() => setView('day')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Día</button>
            <button onClick={() => setView('week')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Semana</button>
            <button onClick={() => setView('month')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Mes</button>
          </div>

          <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-100">
            <button onClick={() => navigateDate(-1)} className="p-1.5 text-gray-500 hover:bg-white hover:shadow-sm rounded-md transition"><ChevronLeft className="w-5 h-5" /></button>
            <span className="px-4 font-semibold text-gray-700 capitalize min-w-[180px] text-center">{formattedDate}</span>
            <button onClick={() => navigateDate(1)} className="p-1.5 text-gray-500 hover:bg-white hover:shadow-sm rounded-md transition"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-medium shadow-[0_4px_12px_rgb(20,184,166,0.2)] hover:-translate-y-0.5 transition-all whitespace-nowrap">
          <Plus className="w-5 h-5" /> Nueva Cita
        </button>
      </header>

      {/* Grid del Calendario */}
      <div className="flex-1 overflow-auto bg-gray-50/30 p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-500">Cargando agenda...</div>
        ) : staff.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <p>No hay empleados registrados.</p>
            <p className="text-sm">Ve a "Equipo" para dar de alta a tus estilistas.</p>
          </div>
        ) : (
          <>
            {view === 'day' && renderDayView()}
            {view === 'week' && renderWeekView()}
            {view === 'month' && renderMonthView()}
          </>
        )}
      </div>

      {/* Modal Nueva Cita */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Nueva Cita</h2>
            <form onSubmit={handleCreateAppointment} className="flex flex-col gap-4">

              <div>
                <label className="block text-sm font-medium mb-1">Cliente *</label>
                <select required className="w-full border p-2 rounded" value={formData.client_id} onChange={e => setFormData({ ...formData, client_id: e.target.value })}>
                  <option value="">Selecciona un cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Servicios * (Usa Ctrl/Cmd para elegir varios)</label>
                <select multiple required className="w-full border p-2 rounded h-32" value={formData.service_ids} onChange={e => {
                  const options = [...e.target.selectedOptions];
                  const values = options.map(option => option.value);
                  setFormData({ ...formData, service_ids: values });
                }}>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Especialista *</label>
                <select required className="w-full border p-2 rounded" value={formData.staff_id} onChange={e => setFormData({ ...formData, staff_id: e.target.value })}>
                  <option value="">Selecciona con quién</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Fecha *</label>
                  <input required type="date" className="w-full border p-2 rounded" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Hora Inicio *</label>
                  <input required type="time" min="08:00" max="20:00" step="1800" className="w-full border p-2 rounded" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button type="submit">Guardar Cita</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalles de Cita */}
      {selectedApptDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedApptDetails(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 flex-shrink-0 border-b">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-bold text-gray-900">Detalles de la cita</h2>
                <button onClick={() => setSelectedApptDetails(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="mb-2">
                <p className="font-semibold text-lg text-gray-800">{selectedApptDetails.client?.name}</p>
                <p className="text-sm text-gray-500">{selectedApptDetails.client?.phone || 'Sin teléfono'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-500 text-sm font-medium">Servicios:</span>
                  <span className="font-bold text-sm">
                    {selectedApptDetails.items
                      ? selectedApptDetails.items.filter(i => i.type === 'service').map(i => i.name).join(' + ')
                      : (selectedApptDetails.service?.name || 'Servicio')}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-500 text-sm font-medium">Fecha:</span>
                  <span className="text-sm font-bold text-gray-800 capitalize">
                    {new Date(selectedApptDetails.start_time).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm font-medium">Hora:</span>
                  <span className="text-sm font-medium">
                    {new Date(selectedApptDetails.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedApptDetails.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-200">
                  <span className="text-gray-500 text-sm font-medium">Estilista:</span>
                  <span className="text-sm font-bold text-gray-700">
                    {staff.find(s => s.id === selectedApptDetails.staff_id)?.name || 'Desconocido'}
                  </span>
                </div>
                {selectedApptDetails.items?.some(i => i.type === 'gift_card_redemption') && (
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-200 text-primary">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <Gift className="w-4 h-4 shrink-0" /> Tarjeta Regalo:
                    </span>
                    <span className="text-sm font-bold truncate max-w-[200px]" title={selectedApptDetails.items.find(i => i.type === 'gift_card_redemption')?.name}>
                      {selectedApptDetails.items.find(i => i.type === 'gift_card_redemption')?.name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-200">
                  <span className="text-gray-500 text-sm font-medium">Estado de Pago:</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    selectedApptDetails.payment_status === 'paid'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedApptDetails.payment_status === 'paid' ? 'Pagado' : 'Pendiente en Salón'}
                  </span>
                </div>
              </div>

              {/* Sección Reprogramar Cita (Cambiar día/hora/estilista) */}
              {isRescheduling ? (
                <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 mb-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" /> Cambiar Día y Hora
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(rescheduleData.date + 'T00:00:00');
                          d.setDate(d.getDate() - 1);
                          setRescheduleData(prev => ({ ...prev, date: getDateString(d) }));
                        }}
                        className="text-[11px] px-2 py-0.5 bg-white border border-teal-200 rounded text-teal-700 hover:bg-teal-50 font-medium cursor-pointer"
                        title="Restar 1 día"
                      >
                        -1 día
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(rescheduleData.date + 'T00:00:00');
                          d.setDate(d.getDate() + 1);
                          setRescheduleData(prev => ({ ...prev, date: getDateString(d) }));
                        }}
                        className="text-[11px] px-2 py-0.5 bg-white border border-teal-200 rounded text-teal-700 hover:bg-teal-50 font-medium cursor-pointer"
                        title="Sumar 1 día"
                      >
                        +1 día
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(rescheduleData.date + 'T00:00:00');
                          d.setDate(d.getDate() + 7);
                          setRescheduleData(prev => ({ ...prev, date: getDateString(d) }));
                        }}
                        className="text-[11px] px-2 py-0.5 bg-white border border-teal-200 rounded text-teal-700 hover:bg-teal-50 font-medium cursor-pointer"
                        title="Sumar 1 semana"
                      >
                        +1 sem.
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nueva Fecha</label>
                      <input
                        type="date"
                        className="w-full text-xs font-medium border border-teal-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                        value={rescheduleData.date}
                        onChange={e => setRescheduleData(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Nueva Hora</label>
                      <input
                        type="time"
                        min="08:00"
                        max="20:00"
                        step="900"
                        className="w-full text-xs font-medium border border-teal-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                        value={rescheduleData.time}
                        onChange={e => setRescheduleData(prev => ({ ...prev, time: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Especialista</label>
                    <select
                      className="w-full text-xs font-medium border border-teal-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                      value={rescheduleData.staff_id}
                      onChange={e => setRescheduleData(prev => ({ ...prev, staff_id: e.target.value }))}
                    >
                      {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role || 'Estilista'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsRescheduling(false)}
                      className="flex-1 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveReschedule}
                      className="flex-1 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-teal-700 shadow-sm cursor-pointer"
                    >
                      Guardar Cambio
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsRescheduling(true)}
                  className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-lg font-medium border border-teal-200 bg-teal-50/60 text-teal-800 hover:bg-teal-100/80 transition-colors text-xs cursor-pointer shadow-xs"
                >
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Cambiar Día / Hora / Especialista
                </button>
              )}
              <div className="flex flex-col gap-2">
                {selectedApptDetails.payment_status !== 'paid' ? (
                  <button
                    onClick={() => navigate(`/admin/pos?apptId=${selectedApptDetails.id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_4px_12px_rgba(16,185,129,0.25)] transition-all text-sm cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    Cobrar en TPV
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/admin/pos?apptId=${selectedApptDetails.id}`)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    Ver en TPV (Cita Pagada)
                  </button>
                )}

                <div className="flex gap-2">
                  <button onClick={() => handleSendWhatsApp(selectedApptDetails, 'reminder')} className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white py-2 rounded-lg font-medium hover:bg-[#128C7E] shadow-sm text-sm" title="Enviar recordatorio">
                    <MessageCircle className="w-4 h-4" /> Recordar
                  </button>
                  <button onClick={() => handleSendWhatsApp(selectedApptDetails, 'review')} className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white py-2 rounded-lg font-medium hover:bg-[#128C7E] shadow-sm text-sm" title="Pedir reseña">
                    <MessageCircle className="w-4 h-4" /> Agradecer
                  </button>
                </div>
                <button onClick={() => toggleConfirmation(selectedApptDetails)} className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium border shadow-sm text-sm ${selectedApptDetails.is_confirmed_by_client ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                  <CheckCircle className={`w-4 h-4 ${selectedApptDetails.is_confirmed_by_client ? 'text-green-600' : 'text-gray-400'}`} />
                  {selectedApptDetails.is_confirmed_by_client ? 'Cita Confirmada' : 'Marcar como Confirmada'}
                </button>
              </div>
            </div>

            {/* Fichas / Notas del cliente */}
            <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                Historial Técnico
              </h3>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Ej: Tinte raíz 6.0, 20 vol..."
                  className="flex-1 border p-2 rounded-lg text-sm shadow-sm"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                />
                <Button onClick={handleAddNote} size="sm">Guardar</Button>
              </div>

              <div className="space-y-3">
                {loadingNotes ? (
                  <p className="text-sm text-gray-500 text-center py-4">Cargando historial...</p>
                ) : clientNotes.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4 italic">No hay notas técnicas para este cliente.</p>
                ) : (
                  clientNotes.map(note => (
                    <div key={note.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                      <p className="text-sm text-gray-800">{note.content}</p>
                      <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                        <span>{new Date(note.created_at).toLocaleDateString()}</span>
                        <span>{note.staff?.name || 'Staff'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
