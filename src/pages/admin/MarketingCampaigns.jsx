import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Megaphone, Search, Filter, MessageCircle, Copy, AlertCircle, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function MarketingCampaigns() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthsInactive, setMonthsInactive] = useState(2)
  const [serviceKeyword, setServiceKeyword] = useState('')
  const [messageTemplate, setMessageTemplate] = useState('¡Hola [Nombre]! Te echamos de menos en Ohana. ¿Te gustaría reservar tu próxima cita?')

  const [isSending, setIsSending] = useState(false)
  const [campaignProgress, setCampaignProgress] = useState({ current: 0, total: 0, campaignId: null })
  const [sendLogs, setSendLogs] = useState({}) // { [clientId]: { status, error } }

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // Fetch clients with marketing consent + appointments + sales
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id, name, phone, email,
          appointments (start_time, status, items, services(name)),
          sales (created_at, sale_items(item_name, item_type))
        `)
        .neq('marketing_consent', false)

      if (error) throw error
      setClients(data || [])
    } catch (err) {
      console.error('Error fetching marketing data:', err)
      alert('Error al cargar datos de clientes para marketing')
    } finally {
      setLoading(false)
    }
  }

  const filteredClients = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsInactive)

    return clients.filter(client => {
      let lastRelevantDate = null
      let hasFutureAppointment = false

      // Check Appointments
      if (client.appointments && client.appointments.length > 0) {
        client.appointments.forEach(app => {
          const appDate = new Date(app.start_time)

          if (appDate > now && app.status !== 'cancelled') {
            hasFutureAppointment = true
          }

          if (appDate <= now && (app.status === 'completed' || app.status === 'confirmed')) {
            let appServiceText = app.services?.name || ''
            if (app.items && Array.isArray(app.items)) {
              appServiceText += ' ' + app.items.map(i => i.name || i.item_name || '').join(' ')
            }
            const matchKeyword = serviceKeyword ? appServiceText.toLowerCase().includes(serviceKeyword.toLowerCase()) : true
            if (matchKeyword) {
              if (!lastRelevantDate || appDate > lastRelevantDate) {
                lastRelevantDate = appDate
              }
            }
          }
        })
      }

      // Check Sales
      if (client.sales && client.sales.length > 0) {
        client.sales.forEach(sale => {
          const saleDate = new Date(sale.created_at)

          if (saleDate <= now) {
            let matchKeyword = false
            if (serviceKeyword) {
              matchKeyword = sale.sale_items?.some(item =>
                item.item_type === 'service' &&
                item.item_name.toLowerCase().includes(serviceKeyword.toLowerCase())
              )
            } else {
              matchKeyword = true
            }

            if (matchKeyword) {
              if (!lastRelevantDate || saleDate > lastRelevantDate) {
                lastRelevantDate = saleDate
              }
            }
          }
        })
      }

      // Filter Logic
      if (monthsInactive === 0) {
        if (serviceKeyword && !lastRelevantDate) return false;
        client.lastRelevantDate = lastRelevantDate || null;
        return true;
      }

      if (hasFutureAppointment) return false
      if (serviceKeyword && !lastRelevantDate) return false

      if (lastRelevantDate && lastRelevantDate < cutoffDate) {
        client.lastRelevantDate = lastRelevantDate
        return true
      }

      if (!serviceKeyword && !lastRelevantDate) {
        client.lastRelevantDate = null
        return true
      }

      return false
    }).sort((a, b) => {
      if (!a.lastRelevantDate) return 1
      if (!b.lastRelevantDate) return -1
      return b.lastRelevantDate - a.lastRelevantDate
    })
  }, [clients, monthsInactive, serviceKeyword])

  const copyEmails = () => {
    const emails = filteredClients.map(c => c.email).filter(Boolean).join(', ')
    if (emails) {
      navigator.clipboard.writeText(emails)
      alert('Emails copiados al portapapeles')
    } else {
      alert('No hay emails para copiar')
    }
  }

  const copyPhones = () => {
    const phones = filteredClients.map(c => c.phone).filter(Boolean).join(', ')
    if (phones) {
      navigator.clipboard.writeText(phones)
      alert('Teléfonos copiados al portapapeles')
    } else {
      alert('No hay teléfonos para copiar')
    }
  }

  const openWhatsApp = (phone, name) => {
    if (!phone) {
      alert('El cliente no tiene teléfono')
      return
    }
    let cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length === 9) {
      cleanPhone = '34' + cleanPhone
    }

    // Replace variables in template
    let finalMessage = messageTemplate
      .replace(/\[Nombre\]/g, name || '')
      .replace(/\[Servicio\]/g, serviceKeyword || '')

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalMessage)}`
    window.open(url, '_blank')
  }

  // Pre-fill helper based on keyword
  useEffect(() => {
    if (serviceKeyword) {
      setMessageTemplate('¡Hola [Nombre]! Hace tiempo que no vienes a hacerte [Servicio] en Ohana. ¿Te gustaría reservar tu próxima cita?')
    } else {
      setMessageTemplate('¡Hola [Nombre]! Te echamos de menos en Ohana. Tenemos una promoción especial para ti. ¿Te gustaría reservar tu próxima cita?')
    }
  }, [serviceKeyword])

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  const startCampaign = async () => {
    if (filteredClients.length === 0) return alert('No hay clientes seleccionados');
    if (!messageTemplate) return alert('Escribe una plantilla de mensaje');

    const confirmed = window.confirm(`Vas a enviar un mensaje automatizado a ${filteredClients.length} clientes.\nEl proceso puede tardar unos minutos debido al retraso anti-spam entre mensajes.\n\nPor favor, NO CIERRES ESTA PESTAÑA hasta que termine.\n\n¿Estás seguro de continuar?`);
    if (!confirmed) return;

    setIsSending(true);
    setSendLogs({});
    
    // Create Campaign
    let currentCampaignId = null;
    try {
      const { data: campaign, error: campError } = await supabase
        .from('marketing_campaigns')
        .insert({
          name: monthsInactive === 0 ? 'Campaña General' : `Campaña Inactivos - ${monthsInactive}m`,
          message_template: messageTemplate,
          target_audience_desc: monthsInactive === 0 ? `Todos los clientes. ${serviceKeyword ? `Servicio: ${serviceKeyword}` : ''}` : `Inactivos ${monthsInactive} meses. ${serviceKeyword ? `Servicio: ${serviceKeyword}` : 'Sin filtro servicio'}`,
          total_sent: 0
        })
        .select()
        .single();
      
      if (campError) throw campError;
      currentCampaignId = campaign.id;
      setCampaignProgress({ current: 0, total: filteredClients.length, campaignId: currentCampaignId });
    } catch (err) {
      console.error('Error creating campaign', err);
      alert('Error al crear la campaña en BD. Asegúrate de haber ejecutado el SQL en Supabase.');
      setIsSending(false);
      return;
    }

    let successCount = 0;
    for (let i = 0; i < filteredClients.length; i++) {
      const client = filteredClients[i];
      setCampaignProgress(p => ({ ...p, current: i + 1 }));

      let status = 'failed';
      let errorMsg = null;

      if (!client.phone) {
        errorMsg = 'No tiene teléfono';
      } else {
        try {
          // Log as pending
          const { data: logData } = await supabase.from('marketing_campaign_logs').insert({
            campaign_id: currentCampaignId,
            client_id: client.id,
            status: 'pending'
          }).select().single();

          const logId = logData?.id;

          // Prepare Message
          let finalMessage = messageTemplate
            .replace(/\[Nombre\]/g, client.name || '')
            .replace(/\[Servicio\]/g, serviceKeyword || '');
          
          let cleanPhone = client.phone.replace(/\D/g, '');
          if (cleanPhone.length === 9) cleanPhone = '34' + cleanPhone;

          // Send HTTP request to local server
          const response = await fetch('http://localhost:3001/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: cleanPhone, message: finalMessage })
          });

          const result = await response.json();
          if (result.success) {
            status = 'sent';
            successCount++;
          } else {
            errorMsg = result.error || 'Error desconocido';
          }

          // Update Log
          if (logId) {
            await supabase.from('marketing_campaign_logs').update({
              status,
              error_message: errorMsg,
              sent_at: status === 'sent' ? new Date().toISOString() : null
            }).eq('id', logId);
          }

        } catch (err) {
          errorMsg = err.message || 'Error de conexión con bot local';
          if (i === 0) {
            alert('Aviso: El bot automático no está activo. Puedes enviar los mensajes directamente con 1 clic usando el botón verde de WhatsApp al lado de cada cliente de la lista.');
            setIsSending(false);
            return;
          }
        }
      }

      setSendLogs(prev => ({
        ...prev,
        [client.id]: { status, error: errorMsg }
      }));

      // Wait between 2s and 4s before next message (if not the last one)
      if (i < filteredClients.length - 1) {
        const waitTime = Math.floor(Math.random() * 2000) + 2000;
        await delay(waitTime);
      }
    }

    // Final update to campaign
    await supabase.from('marketing_campaigns').update({
      total_sent: successCount
    }).eq('id', currentCampaignId);

    alert(`Campaña finalizada.\n\nMensajes enviados con éxito: ${successCount} de ${filteredClients.length}`);
    setIsSending(false);
  }

  return (
    <div className="flex flex-col h-full gap-6">


      {/* Controles de Filtro */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 shrink-0 flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Meses de Inactividad
          </label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={monthsInactive}
              onChange={(e) => setMonthsInactive(Number(e.target.value))}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            >
              <option value={0}>Todos (Sin filtro de tiempo)</option>
              <option value={1}>Inactivos más de 1 mes</option>
              <option value={2}>Inactivos más de 2 meses</option>
              <option value={3}>Inactivos más de 3 meses</option>
              <option value={6}>Inactivos más de 6 meses</option>
              <option value={12}>Inactivos más de 1 año</option>
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Servicio específico (Opcional)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Ej. Tinte, Mechas, Corte..."
              value={serviceKeyword}
              onChange={(e) => setServiceKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        <div className="w-full">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Plantilla del Mensaje de WhatsApp
          </label>
          <div className="flex flex-col gap-2">
            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-y min-h-[100px]"
              placeholder="Escribe el mensaje que quieres enviar..."
            />
            <p className="text-xs text-gray-500">
              Puedes usar <strong>[Nombre]</strong> para el nombre del cliente y <strong>[Servicio]</strong> para el servicio filtrado.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4 shrink-0 justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={copyEmails}
            disabled={isSending}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-sm text-sm disabled:opacity-50"
          >
            <Copy className="w-4 h-4" /> Copiar Emails ({filteredClients.filter(c => c.email).length})
          </button>
          <button
            onClick={copyPhones}
            disabled={isSending}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm text-sm disabled:opacity-50"
          >
            <Copy className="w-4 h-4" /> Copiar Teléfonos ({filteredClients.filter(c => c.phone).length})
          </button>
        </div>
        
        <button
          onClick={startCampaign}
          disabled={isSending || filteredClients.length === 0}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50"
        >
          {isSending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Enviando ({campaignProgress.current}/{campaignProgress.total})...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" /> 
              Enviar Campaña por WhatsApp
            </>
          )}
        </button>
      </div>

      {isSending && (
        <div className="mb-4 bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
          <div>
            <h3 className="font-bold text-blue-900 text-sm">Campaña en progreso</h3>
            <p className="text-blue-700 text-xs mt-1">Por favor, no cierres esta pestaña. Aplicando retraso anti-spam entre mensajes...</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-blue-900">{Math.round((campaignProgress.current / campaignProgress.total) * 100)}%</span>
          </div>
        </div>
      )}

      {/* Resultados */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8 text-gray-500">Cargando datos...</div>
        ) : filteredClients.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-400">
            <Megaphone className="w-12 h-12 mb-4 opacity-20" />
            <p>No hay clientes inactivos que cumplan este filtro.</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 sticky top-0 backdrop-blur-sm">
                  <th className="p-4 font-semibold text-gray-600 text-sm">Cliente</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm">Contacto</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm">Último Servicio (Filtro)</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm">Estado Envío</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{client.name}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-600 flex flex-col">
                        {client.phone && <span>{client.phone}</span>}
                        {client.email && <span className="text-gray-400">{client.email}</span>}
                        {!client.phone && !client.email && <span className="text-gray-300 italic">Sin contacto</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      {client.lastRelevantDate ? (
                        <div className="text-sm font-medium text-gray-700">
                          {client.lastRelevantDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </div>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">Nunca</span>
                      )}
                    </td>
                    <td className="p-4">
                      {sendLogs[client.id] ? (
                        sendLogs[client.id].status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Enviado
                          </span>
                        ) : (
                          <div className="flex flex-col items-start">
                            <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded-full">
                              <XCircle className="w-3 h-3" /> Fallo
                            </span>
                            <span className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={sendLogs[client.id].error}>
                              {sendLogs[client.id].error}
                            </span>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {client.phone ? (
                        <button
                          onClick={() => openWhatsApp(client.phone, client.name)}
                          disabled={isSending}
                          className="inline-flex items-center gap-2 bg-[#25D366] text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#128C7E] transition-colors shadow-sm disabled:opacity-50"
                        >
                          <MessageCircle className="w-4 h-4" /> WhatsApp
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <AlertCircle className="w-3 h-3" /> Sin móvil
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
