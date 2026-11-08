import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Plus, Trash2, ArrowLeft, History, CalendarClock, Save, MessageSquare, Phone, Mail,
  UserCircle, Edit3, Image as ImageIcon, X, Search, AlertTriangle, ShieldAlert,
  Scissors, Sparkles, Copy, FileText, Calendar,
  ZoomIn, ShieldCheck, Clock, Star
} from 'lucide-react'

// Paleta de colores armoniosa para los avatares según el nombre
const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-teal-600', 'bg-rose-500', 'bg-indigo-600',
  'bg-amber-600', 'bg-sky-600', 'bg-purple-600', 'bg-fuchsia-600'
]

function getAvatarColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// Opciones estándar para el diagnóstico de salón
const HAIR_TYPES = ['Liso (1A-1C)', 'Ondulado (2A-2C)', 'Rizado (3A-3C)', 'Afro / Muy Rizado (4A-4C)']
const HAIR_THICKNESS = ['Fino', 'Medio', 'Grueso']
const HAIR_CONDITIONS = ['Virgen', 'Sano / Normal', 'Poroso / Seco', 'Sensibilizado / Dañado', 'Muy Castigado (Químicos)']
const SCALP_TYPES = ['Normal', 'Sensible / Reactivo', 'Graso', 'Seco / Tirante', 'Con Caspa / Descamación']
const GRAY_PERCENTAGES = ['0% (Sin canas)', '10% - 25%', '30% - 50%', '60% - 75%', '80% - 100%']
const SKIN_TYPES = ['Normal', 'Seca', 'Mixta', 'Grasa', 'Sensible / Rosácea', 'Madura']
const COMMON_ALLERGIES = ['PPD (Parafenilendiamina)', 'Amoníaco', 'Decolorante / Persulfatos', 'Látex', 'Cosméticos / Perfumes', 'Níquel', 'Embarazo / Lactancia', 'Piel Atópica']

// Helper para extraer ficha técnica desde columnas nativas o fallback en notes
function parseTechnicalData(client) {
  let fromNotes = {}
  if (client?.notes && client.notes.includes('<!--FICHA_JSON:')) {
    try {
      const match = client.notes.match(/<!--FICHA_JSON:(.*?)-->/)
      if (match && match[1]) {
        fromNotes = JSON.parse(match[1])
      }
    } catch (e) {
      console.warn('Error al deserializar ficha técnica de notes:', e)
    }
  }

  return {
    allergies: client?.allergies || fromNotes.allergies || '',
    hair_type: client?.hair_type || fromNotes.hair_type || '',
    hair_thickness: client?.hair_thickness || fromNotes.hair_thickness || '',
    hair_condition: client?.hair_condition || fromNotes.hair_condition || '',
    scalp_type: client?.scalp_type || fromNotes.scalp_type || '',
    gray_percentage: client?.gray_percentage || fromNotes.gray_percentage || '',
    skin_type: client?.skin_type || fromNotes.skin_type || '',
    patch_test_date: client?.patch_test_date || fromNotes.patch_test_date || '',
    patch_test_result: client?.patch_test_result || fromNotes.patch_test_result || 'Negativo (Apto)',
    preferred_stylist: client?.preferred_stylist || fromNotes.preferred_stylist || ''
  }
}

export default function AdminClients() {
  const [clients, setClients] = useState([])
  const [staffList, setStaffList] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  // Búsqueda y Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all' | 'allergies' | 'formula' | 'loyalty' | 'no_rgpd'

  // Modal Crear / Editar Datos Base
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', birth_date: '', color_formula: '', notes: '',
    privacy_accepted: false, marketing_consent: false, image_consent: false,
    allergies: '', hair_type: '', skin_type: ''
  })

  // Ficha Técnica Seleccionada
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientTechnical, setClientTechnical] = useState(parseTechnicalData(null))
  const [savingTechnical, setSavingTechnical] = useState(false)
  const [technicalSavedOk, setTechnicalSavedOk] = useState(false)

  // Historiales del cliente
  const [clientNotes, setClientNotes] = useState([])
  const [clientAppointments, setClientAppointments] = useState([])
  const [activeProfileTab, setActiveProfileTab] = useState('notes') // 'notes' | 'gallery' | 'appointments'
  const [loadingProfile, setLoadingProfile] = useState(false)

  // Nueva Nota / Historial
  const [newNote, setNewNote] = useState('')
  const [noteTag, setNoteTag] = useState('Fórmula Color')
  const [isFormulaNote, setIsFormulaNote] = useState(true)
  const [newImage, setNewImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Desglose de Fórmula Activa
  const [editingFormula, setEditingFormula] = useState(false)
  const [formulaBreakdown, setFormulaBreakdown] = useState({
    root: '',
    lengths: '',
    bleach: '',
    toner: '',
    time: '',
    notes: ''
  })

  // Zoom de fotos
  const [zoomImage, setZoomImage] = useState(null)

  function handleSelectClient(client) {
    if (!client) {
      setSelectedClient(null)
      return
    }
    const tech = parseTechnicalData(client)
    setClientTechnical(tech)
    parseFormulaToBreakdown(client.color_formula || '')
    setEditingFormula(false)
    setTechnicalSavedOk(false)
    setSelectedClient(client)
  }

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (selectedClient?.id) {
      fetchClientProfile(selectedClient.id)
    }
  }, [selectedClient?.id])

  async function fetchInitialData() {
    try {
      setLoading(true)
      const [clientsRes, staffRes, settingsRes] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('staff').select('id, name, role').order('name'),
        supabase.from('settings').select('*').limit(1).maybeSingle()
      ])

      if (clientsRes.error) throw clientsRes.error
      if (clientsRes.data) setClients(clientsRes.data)
      if (staffRes.data) setStaffList(staffRes.data)
      if (settingsRes.data) setSettings(settingsRes.data)
    } catch (error) {
      console.error('Error fetching initial clients data:', error)
      alert('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }

  async function fetchClientProfile(clientId) {
    setLoadingProfile(true)
    try {
      const { data: notes } = await supabase
        .from('client_notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (notes) setClientNotes(notes)

      const { data: appts } = await supabase
        .from('appointments')
        .select('*, service:services(name, price), staff:staff(name)')
        .eq('client_id', clientId)
        .order('start_time', { ascending: false })
      if (appts) setClientAppointments(appts)
    } catch (err) {
      console.error('Error fetching client profile:', err)
    } finally {
      setLoadingProfile(false)
    }
  }

  // Parsear texto de fórmula libre a campos estructurados si coincide el patrón
  function parseFormulaToBreakdown(formulaText) {
    if (!formulaText) {
      setFormulaBreakdown({ root: '', lengths: '', bleach: '', toner: '', time: '', notes: '' })
      return
    }

    // Si tiene formato de secciones
    const getSection = (key) => {
      const regex = new RegExp(`${key}:\\s*([^|\\n]+)`, 'i')
      const match = formulaText.match(regex)
      return match ? match[1].trim() : ''
    }

    const root = getSection('Raíz')
    const lengths = getSection('Medios/Puntas') || getSection('Puntas')
    const bleach = getSection('Decoloración') || getSection('Mechas')
    const toner = getSection('Matiz')
    const time = getSection('Tiempo')

    if (root || lengths || bleach || toner || time) {
      setFormulaBreakdown({
        root,
        lengths,
        bleach,
        toner,
        time,
        notes: formulaText.replace(/(Raíz|Medios\/Puntas|Puntas|Decoloración|Mechas|Matiz|Tiempo):[^|\n]+(\||\n)?/gi, '').trim()
      })
    } else {
      setFormulaBreakdown({
        root: '',
        lengths: '',
        bleach: '',
        toner: '',
        time: '',
        notes: formulaText
      })
    }
  }

  function compileBreakdownToText(bd) {
    const parts = []
    if (bd.root) parts.push(`Raíz: ${bd.root}`)
    if (bd.lengths) parts.push(`Medios/Puntas: ${bd.lengths}`)
    if (bd.bleach) parts.push(`Decoloración: ${bd.bleach}`)
    if (bd.toner) parts.push(`Matiz: ${bd.toner}`)
    if (bd.time) parts.push(`Tiempo: ${bd.time}`)
    if (bd.notes) parts.push(bd.notes)
    return parts.join(' | ')
  }

  // Guardar Ficha Técnica y Alergias (con fallback transparente a notes si no existen las columnas)
  // Guardar Ficha Técnica, Diagnóstico, Alergias y Fórmula (unificado y sincronizado)
  async function handleSaveTechnicalData() {
    if (!selectedClient) return
    try {
      setSavingTechnical(true)
      const techPayload = { ...clientTechnical }

      // Si se estaba editando la fórmula o hay datos en formulaBreakdown, compilar
      let formulaText = selectedClient.color_formula || ''
      if (editingFormula || formulaBreakdown.root || formulaBreakdown.lengths || formulaBreakdown.bleach || formulaBreakdown.toner || formulaBreakdown.time || formulaBreakdown.notes) {
        formulaText = compileBreakdownToText(formulaBreakdown)
      }

      // 1. Serializar ficha técnica completa en notes
      let baseNotes = (selectedClient.notes || '').replace(/<!--FICHA_JSON:.*?-->/g, '').trim()
      const serializedNotes = `${baseNotes ? baseNotes + '\n' : ''}<!--FICHA_JSON:${JSON.stringify(techPayload)}-->`

      const updatePayload = {
        notes: serializedNotes,
        color_formula: formulaText
      }

      // 2. Guardar en Supabase
      const { error: updateErr } = await supabase
        .from('clients')
        .update(updatePayload)
        .eq('id', selectedClient.id)

      if (updateErr) throw updateErr

      // 3. Si existen columnas nativas en Supabase, intentar actualizarlas silenciosamente
      try {
        await supabase.from('clients').update(techPayload).eq('id', selectedClient.id)
      } catch {
        // Tolerante si la base de datos no tiene aún esas columnas nativas
      }

      // 4. Re-obtener el cliente fresco directamente desde la base de datos
      const { data: freshClient } = await supabase
        .from('clients')
        .select('*')
        .eq('id', selectedClient.id)
        .single()

      if (freshClient) {
        setSelectedClient(freshClient)
        const freshTech = parseTechnicalData(freshClient)
        setClientTechnical(freshTech)
        setClients(prev => prev.map(c => c.id === freshClient.id ? freshClient : c))
      }

      // Si la fórmula cambió y tiene texto, registrar nota en el historial si es diferente
      if (formulaText.trim() && formulaText !== (selectedClient.color_formula || '')) {
        await supabase.from('client_notes').insert([{
          client_id: selectedClient.id,
          content: `🎨 [FÓRMULA ACTUALIZADA]: ${formulaText}`
        }])
        fetchClientProfile(selectedClient.id)
      }

      setEditingFormula(false)
      setTechnicalSavedOk(true)
      setTimeout(() => setTechnicalSavedOk(false), 3000)
    } catch (err) {
      console.error('Error guardando ficha técnica:', err)
      alert('Error al guardar la ficha técnica: ' + (err.message || 'Error desconocido'))
    } finally {
      setSavingTechnical(false)
    }
  }

  // Alias para guardar fórmula específicamente
  async function handleSaveFormula() {
    return handleSaveTechnicalData()
  }

  // Reutilizar una fórmula anterior del historial con 1 clic
  async function handleReuseFormula(formulaContent) {
    if (!window.confirm('¿Deseas restaurar esta fórmula como la Fórmula Actual de la clienta?')) return
    const cleanFormula = formulaContent.replace(/^🎨\s*\[FÓRMULA ACTUALIZADA\]:\s*/, '').trim()
    try {
      const { error } = await supabase
        .from('clients')
        .update({ color_formula: cleanFormula })
        .eq('id', selectedClient.id)

      if (error) throw error

      const updated = { ...selectedClient, color_formula: cleanFormula }
      setSelectedClient(updated)
      setClients(clients.map(c => c.id === updated.id ? updated : c))
      parseFormulaToBreakdown(cleanFormula)

      await supabase.from('client_notes').insert([{
        client_id: selectedClient.id,
        content: `🔄 [FÓRMULA REUTILIZADA]: Restaurada fórmula anterior: ${cleanFormula}`
      }])
      fetchClientProfile(selectedClient.id)
      alert('¡Fórmula restaurada con éxito como actual!')
    } catch (err) {
      console.error(err)
      alert('Error al reutilizar fórmula')
    }
  }

  // Añadir nueva nota / foto a la línea de tiempo
  async function handleAddNote(e) {
    e.preventDefault()
    if (!newNote.trim() && !newImage) return
    try {
      setIsUploading(true)
      let imageUrl = null

      if (newImage) {
        try {
          const fileExt = newImage.name.split('.').pop()
          const fileName = `${selectedClient.id}_${Date.now()}.${fileExt}`
          const filePath = `${selectedClient.id}/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('client_media')
            .upload(filePath, newImage)

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('client_media')
            .getPublicUrl(filePath)

          imageUrl = publicUrl
        } catch (storageErr) {
          console.warn('Storage upload failed or bucket client_media unavailable. Fallback to base64 preview.', storageErr)
          imageUrl = imagePreview
        }
      }

      const formattedContent = `${noteTag !== 'General' ? `[${noteTag}] ` : ''}${newNote.trim() || 'Foto de trabajo adjunta'}`

      const { error } = await supabase
        .from('client_notes')
        .insert([{
          client_id: selectedClient.id,
          content: formattedContent,
          image_url: imageUrl
        }])

      if (error) throw error

      if (isFormulaNote && newNote.trim()) {
        const { error: updateErr } = await supabase
          .from('clients')
          .update({ color_formula: newNote.trim() })
          .eq('id', selectedClient.id)

        if (!updateErr) {
          const updated = { ...selectedClient, color_formula: newNote.trim() }
          setSelectedClient(updated)
          setClients(clients.map(c => c.id === updated.id ? updated : c))
          parseFormulaToBreakdown(newNote.trim())
        }
      }

      setNewNote('')
      setNewImage(null)
      setImagePreview(null)
      fetchClientProfile(selectedClient.id)
    } catch (err) {
      console.error(err)
      alert(err.message || 'Error al guardar nota')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDeleteNote(noteId) {
    if (!window.confirm('¿Deseas eliminar esta anotación del historial?')) return
    try {
      const { error } = await supabase.from('client_notes').delete().eq('id', noteId)
      if (error) throw error
      fetchClientProfile(selectedClient.id)
    } catch (err) {
      console.error(err)
      alert('Error al eliminar la nota')
    }
  }

  // Generar Ficha Técnica Oficial en PDF para imprimir
  function handleGenerateClientPDF() {
    if (!selectedClient) return
    const doc = new jsPDF()
    const company = settings?.company_name || 'Ohana Peluquería y Estética'
    const nif = settings?.company_nif || ''
    const phone = settings?.company_phone || ''
    const address = settings?.company_address ? `${settings.company_address}, ${settings.company_city || ''}` : ''

    // Membrete
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(company, 105, 18, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    if (nif) doc.text(`CIF/NIF: ${nif}  |  Tel: ${phone}`, 105, 24, { align: 'center' })
    if (address) doc.text(address, 105, 29, { align: 'center' })

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.4)
    doc.line(14, 33, 196, 33)

    // Título Ficha
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('FICHA TÉCNICA Y DIAGNÓSTICO DEL CLIENTE', 14, 42)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-ES')}`, 14, 48)

    // Cuadro 1: Datos de Contacto
    const clientData = [
      ['Nombre:', selectedClient.name, 'Teléfono:', selectedClient.phone || 'Sin teléfono'],
      ['Email:', selectedClient.email || 'Sin email', 'Nacimiento / Edad:', selectedClient.birth_date || 'No indicada'],
      ['Puntos Fidelización:', `${selectedClient.loyalty_points || 0} pts`, 'RGPD Aceptado:', selectedClient.privacy_accepted ? 'Sí (Conforme)' : 'Pendiente']
    ]

    autoTable(doc, {
      startY: 52,
      body: clientData,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', width: 35 },
        1: { width: 60 },
        2: { fontStyle: 'bold', width: 35 },
        3: { width: 60 }
      }
    })

    let currentY = doc.lastAutoTable.finalY + 6

    // Cuadro 2: ALERGIAS Y PRECAUCIONES MÉDICAS (Destacado)
    const allergiesText = clientTechnical.allergies || 'Ninguna alergia registrada.'
    const isAllergic = !!clientTechnical.allergies

    doc.setFillColor(isAllergic ? 254 : 248, isAllergic ? 242 : 250, isAllergic ? 242 : 252)
    doc.setDrawColor(isAllergic ? 239 : 226, isAllergic ? 68 : 232, isAllergic ? 68 : 240)
    doc.roundedRect(14, currentY, 182, 22, 2, 2, 'FD')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(isAllergic ? 185 : 30, isAllergic ? 28 : 41, isAllergic ? 28 : 59)
    doc.text(isAllergic ? '⚠️ ALERGIAS Y SENSIBILIDADES REGISTRADAS:' : '✓ ESTADO DE ALERGIAS:', 18, currentY + 7)

    doc.setFontSize(9)
    doc.setFont('helvetica', isAllergic ? 'bold' : 'normal')
    doc.setTextColor(isAllergic ? 153 : 71, isAllergic ? 27 : 85, isAllergic ? 27 : 105)
    doc.text(allergiesText, 18, currentY + 14, { maxWidth: 174 })

    currentY += 28

    // Cuadro 3: Diagnóstico Capilar y Estética
    const diagnosticData = [
      ['Tipo de Cabello:', clientTechnical.hair_type || 'No especificado', 'Grosor / Textura:', clientTechnical.hair_thickness || 'No especificado'],
      ['Estado / Porosidad:', clientTechnical.hair_condition || 'No especificado', 'Porcentaje Canas:', clientTechnical.gray_percentage || 'No especificado'],
      ['Cuero Cabelludo:', clientTechnical.scalp_type || 'No especificado', 'Tipo de Piel (Estética):', clientTechnical.skin_type || 'No especificado'],
      ['Test del Parche:', `${clientTechnical.patch_test_result || 'No realizado'} ${clientTechnical.patch_test_date ? `(${clientTechnical.patch_test_date})` : ''}`, 'Estilista Preferido/a:', clientTechnical.preferred_stylist || 'Sin preferencia']
    ]

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('DIAGNÓSTICO CAPILAR Y ESTÉTICA', 14, currentY)

    autoTable(doc, {
      startY: currentY + 3,
      body: diagnosticData,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [248, 250, 252], width: 40 },
        1: { width: 55 },
        2: { fontStyle: 'bold', fillColor: [248, 250, 252], width: 40 },
        3: { width: 55 }
      }
    })

    currentY = doc.lastAutoTable.finalY + 8

    // Cuadro 4: Fórmula Actual
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('FÓRMULA DE COLOR / TRATAMIENTO ACTUAL', 14, currentY)

    const formulaBoxText = selectedClient.color_formula || 'Sin fórmula registrada actualmente.'
    doc.setFillColor(245, 243, 255)
    doc.setDrawColor(221, 214, 254)
    doc.roundedRect(14, currentY + 3, 182, 18, 2, 2, 'FD')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(76, 29, 149)
    doc.text(formulaBoxText, 18, currentY + 11, { maxWidth: 174 })

    currentY += 28

    // Cuadro 5: Últimas Visitas y Notas Técnicas
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('HISTORIAL DE OBSERVACIONES Y TRABAJOS RECIENTES', 14, currentY)

    const recentNotes = clientNotes.slice(0, 5).map(n => [
      new Date(n.created_at).toLocaleDateString('es-ES'),
      n.content
    ])

    if (recentNotes.length > 0) {
      autoTable(doc, {
        startY: currentY + 3,
        head: [['Fecha', 'Observación / Fórmula Aplicada']],
        body: recentNotes,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 0: { width: 30, fontStyle: 'bold' } }
      })
    } else {
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(150, 150, 150)
      doc.text('No hay observaciones registradas en el historial.', 14, currentY + 8)
    }

    // Pie de página
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text('Documento Confidencial - Uso Interno Exclusivo de Ohana Peluquería y Estética', 105, pageHeight - 10, { align: 'center' })

    const fileName = `Ficha_Tecnica_${selectedClient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
  }

  // Enviar mensaje de WhatsApp al cliente
  function handleOpenWhatsAppChat(phone, clientName) {
    if (!phone) return alert('El cliente no tiene teléfono registrado.')
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const fullPhone = cleanPhone.length === 9 ? `34${cleanPhone}` : cleanPhone
    const msg = `¡Hola ${clientName}! Te escribimos desde Ohana Peluquería y Estética 😊`
    window.open(`https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(msg)}`, '_blank')
  }

  // CRUD Crear / Editar Cliente Base
  function openEditBaseModal(client) {
    setEditingClient(client.id)
    const tech = parseTechnicalData(client)
    setFormData({
      name: client.name || '',
      phone: client.phone || '',
      email: client.email || '',
      birth_date: client.birth_date || '',
      color_formula: client.color_formula || '',
      notes: client.notes || '',
      privacy_accepted: client.privacy_accepted || false,
      marketing_consent: client.marketing_consent || false,
      image_consent: client.image_consent || false,
      allergies: tech.allergies,
      hair_type: tech.hair_type,
      skin_type: tech.skin_type
    })
    setIsModalOpen(true)
  }

  async function handleBaseSubmit(e) {
    e.preventDefault()
    try {
      const payload = { ...formData }
      if (payload.privacy_accepted || payload.marketing_consent || payload.image_consent) {
        if (!payload.consent_date) payload.consent_date = new Date().toISOString()
      }

      const { allergies, hair_type, skin_type, ...basePayload } = payload

      if (editingClient) {
        try {
          const { error } = await supabase.from('clients').update(payload).eq('id', editingClient)
          if (error) throw error
        } catch {
          const currentClientObj = clients.find(c => c.id === editingClient)
          const currentTech = parseTechnicalData(currentClientObj)
          const techObj = { ...currentTech, allergies: allergies || currentTech.allergies, hair_type: hair_type || currentTech.hair_type, skin_type: skin_type || currentTech.skin_type }
          let cleanNotes = (basePayload.notes || '').replace(/<!--FICHA_JSON:.*?-->/g, '').trim()
          basePayload.notes = `${cleanNotes ? cleanNotes + '\n' : ''}<!--FICHA_JSON:${JSON.stringify(techObj)}-->`
          const { error: fErr } = await supabase.from('clients').update(basePayload).eq('id', editingClient)
          if (fErr) throw fErr
        }
      } else {
        try {
          const { error } = await supabase.from('clients').insert([payload])
          if (error) throw error
        } catch {
          let cleanNotes = (basePayload.notes || '').replace(/<!--FICHA_JSON:.*?-->/g, '').trim()
          const techObj = { allergies, hair_type, skin_type }
          basePayload.notes = `${cleanNotes ? cleanNotes + '\n' : ''}<!--FICHA_JSON:${JSON.stringify(techObj)}-->`
          const { error: fErr } = await supabase.from('clients').insert([basePayload])
          if (fErr) throw fErr
        }
      }

      setIsModalOpen(false)
      setEditingClient(null)
      fetchInitialData()
      if (selectedClient && editingClient === selectedClient.id) {
        const refreshed = await supabase.from('clients').select('*').eq('id', editingClient).single()
        if (refreshed.data) handleSelectClient(refreshed.data)
      }
    } catch (error) {
      console.error('Error saving client:', error)
      alert('Error al guardar el cliente: ' + error.message)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Estás seguro de eliminar este cliente? Se borrarán sus datos e historial.')) return
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id)
      if (error) throw error
      if (selectedClient && selectedClient.id === id) setSelectedClient(null)
      fetchInitialData()
    } catch (error) {
      console.error('Error deleting client:', error)
      alert('Error al eliminar cliente')
    }
  }

  // Filtrado de clientes en tiempo real
  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase().trim()
    const tech = parseTechnicalData(c)
    const matchesSearch = !term ||
      c.name?.toLowerCase().includes(term) ||
      c.phone?.includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      tech.allergies?.toLowerCase().includes(term) ||
      c.color_formula?.toLowerCase().includes(term)

    if (!matchesSearch) return false

    if (filterType === 'allergies') return !!tech.allergies
    if (filterType === 'formula') return !!c.color_formula
    if (filterType === 'loyalty') return (c.loyalty_points || 0) > 0
    if (filterType === 'no_rgpd') return !c.privacy_accepted

    return true
  })

  // Conteo de filtros
  const counts = {
    all: clients.length,
    allergies: clients.filter(c => !!parseTechnicalData(c).allergies).length,
    formula: clients.filter(c => !!c.color_formula).length,
    loyalty: clients.filter(c => (c.loyalty_points || 0) > 0).length,
    no_rgpd: clients.filter(c => !c.privacy_accepted).length
  }

  // =========================================================================
  // VISTA 1: FICHA TÉCNICA E HISTORIAL CLÍNICO DETALLADO (PERFIL CLIENTE)
  // =========================================================================
  if (selectedClient) {
    const hasAllergies = !!clientTechnical.allergies
    const galleryNotes = clientNotes.filter(n => !!n.image_url)

    return (
      <div className="p-6 md:p-8 min-h-screen bg-gray-50 flex flex-col">
        {/* Barra Superior de Navegación de la Ficha */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleSelectClient(null)}
              className="p-2 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition shadow-sm text-gray-700 cursor-pointer"
              title="Volver al listado"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl ${getAvatarColor(selectedClient.name)} flex items-center justify-center text-white font-black text-lg shadow-sm`}>
                {selectedClient.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                  {selectedClient.name}
                  {hasAllergies && (
                    <span className="bg-red-100 text-red-700 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> ALERGIA
                    </span>
                  )}
                </h1>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Ficha Técnica, Historial de Color y Diagnóstico Clínico
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSaveTechnicalData}
              disabled={savingTechnical}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {savingTechnical ? 'Guardando...' : technicalSavedOk ? '¡Guardado Correctamente!' : 'Guardar Ficha'}
            </button>

            <button
              onClick={handleGenerateClientPDF}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-primary" /> Descargar Ficha PDF
            </button>

            <button
              onClick={() => openEditBaseModal(selectedClient)}
              className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" /> Editar Datos
            </button>
          </div>
        </div>

        {/* ALERTA CRÍTICA DE ALERGIAS (SI TIENE) */}
        {hasAllergies && (
          <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in">
            <div className="p-2 bg-red-100 text-red-700 rounded-xl shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-extrabold text-red-900 text-sm flex items-center gap-2">
                ¡PRECAUCIÓN MÉDICA ANTES DE APLICAR PRODUCTOS QUÍMICOS!
              </h3>
              <p className="text-xs text-red-800 font-semibold mt-1">
                Alergias o sensibilidades declaradas: <span className="underline">{clientTechnical.allergies}</span>
              </p>
              <p className="text-[11px] text-red-600 mt-0.5">
                Verifica siempre la fórmula y realiza test de compatibilidad en caso de tintes, decoloración o tratamientos agresivos.
              </p>
            </div>
          </div>
        )}

        {/* CUERPO EN DOS COLUMNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMNA IZQUIERDA: DIAGNÓSTICO, ALERGIAS Y DATOS (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. ALERGIAS Y TEST DEL PARCHE */}
            <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-red-50/60 border-b border-red-100 py-3.5 px-5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-red-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600" /> Alertas Médicas y Alergias
                </CardTitle>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${hasAllergies ? 'bg-red-200 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {hasAllergies ? 'Alergias Detectadas' : 'Sin Alergias'}
                </span>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Alergias o Sensibilidades a Químicos:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej: Alergia a PPD (tinte negro), amoníaco, picores con decolorante..."
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 font-medium"
                    value={clientTechnical.allergies}
                    onChange={e => setClientTechnical({ ...clientTechnical, allergies: e.target.value })}
                  />
                  {/* Tags rápidos de alergias comunes */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {COMMON_ALLERGIES.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const current = clientTechnical.allergies ? clientTechnical.allergies.trim() : ''
                          if (!current.includes(tag)) {
                            setClientTechnical({
                              ...clientTechnical,
                              allergies: current ? `${current}, ${tag}` : tag
                            })
                          }
                        }}
                        className="text-[10px] bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-600 font-semibold px-2 py-1 rounded-lg transition"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Fecha Test Parche 48h:</label>
                    <input
                      type="date"
                      className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                      value={clientTechnical.patch_test_date ? clientTechnical.patch_test_date.split('T')[0] : ''}
                      onChange={e => setClientTechnical({ ...clientTechnical, patch_test_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Resultado Test:</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                      value={clientTechnical.patch_test_result}
                      onChange={e => setClientTechnical({ ...clientTechnical, patch_test_result: e.target.value })}
                    >
                      <option value="Negativo (Apto)">Negativo (Sin Reacción)</option>
                      <option value="Positivo (Reacción)">⚠️ Positivo (Reacción)</option>
                      <option value="Pendiente">Pendiente de realizar</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSaveTechnicalData}
                  disabled={savingTechnical}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {savingTechnical ? 'Guardando...' : technicalSavedOk ? '¡Guardado Correctamente!' : 'Guardar Alergias y Test'}
                </button>
              </CardContent>
            </Card>

            {/* 2. DIAGNÓSTICO CAPILAR Y ESTÉTICA */}
            <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-gray-50 border-b border-gray-100 py-3.5 px-5 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-primary" /> Diagnóstico Capilar y Estética
                </CardTitle>
                <span className="text-[11px] text-gray-400">Perfil Técnico</span>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Tipo de Cabello:</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                      value={clientTechnical.hair_type}
                      onChange={e => setClientTechnical({ ...clientTechnical, hair_type: e.target.value })}
                    >
                      <option value="">Seleccionar...</option>
                      {HAIR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Grosor de Hebra:</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                      value={clientTechnical.hair_thickness}
                      onChange={e => setClientTechnical({ ...clientTechnical, hair_thickness: e.target.value })}
                    >
                      <option value="">Seleccionar...</option>
                      {HAIR_THICKNESS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Porosidad / Estado:</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                      value={clientTechnical.hair_condition}
                      onChange={e => setClientTechnical({ ...clientTechnical, hair_condition: e.target.value })}
                    >
                      <option value="">Seleccionar...</option>
                      {HAIR_CONDITIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">% de Canas:</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                      value={clientTechnical.gray_percentage}
                      onChange={e => setClientTechnical({ ...clientTechnical, gray_percentage: e.target.value })}
                    >
                      <option value="">Seleccionar...</option>
                      {GRAY_PERCENTAGES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Cuero Cabelludo:</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                      value={clientTechnical.scalp_type}
                      onChange={e => setClientTechnical({ ...clientTechnical, scalp_type: e.target.value })}
                    >
                      <option value="">Seleccionar...</option>
                      {SCALP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Tipo de Piel (Facial):</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                      value={clientTechnical.skin_type}
                      onChange={e => setClientTechnical({ ...clientTechnical, skin_type: e.target.value })}
                    >
                      <option value="">Seleccionar...</option>
                      {SKIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Estilista / Especialista Habitual:</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                    value={clientTechnical.preferred_stylist}
                    onChange={e => setClientTechnical({ ...clientTechnical, preferred_stylist: e.target.value })}
                  >
                    <option value="">Sin preferencia / Cualquiera</option>
                    {staffList.map(s => <option key={s.id} value={s.name}>{s.name} ({s.role || 'Estilista'})</option>)}
                  </select>
                </div>

                <button
                  onClick={handleSaveTechnicalData}
                  disabled={savingTechnical}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-xs py-2 rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {savingTechnical ? 'Guardando...' : technicalSavedOk ? '¡Diagnóstico Guardado!' : 'Guardar Diagnóstico'}
                </button>
              </CardContent>
            </Card>

            {/* 3. CONTACTO, PUNTOS Y RGPD */}
            <Card className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-gray-50 border-b border-gray-100 py-3.5 px-5">
                <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-gray-500" /> Contacto y Fidelización
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3.5 text-xs">
                <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold">{selectedClient.phone || 'Sin teléfono'}</span>
                  </div>
                  {selectedClient.phone && (
                    <button
                      onClick={() => handleOpenWhatsAppChat(selectedClient.phone, selectedClient.name)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-gray-700 px-1">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{selectedClient.email || 'Sin email registrado'}</span>
                </div>

                {selectedClient.birth_date && (
                  <div className="flex items-center gap-2 text-gray-700 px-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Cumpleaños: {new Date(selectedClient.birth_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                )}

                {/* Saldo de Puntos */}
                <div className="flex items-center justify-between bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                  <div>
                    <span className="text-[11px] font-bold text-amber-900 block flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" /> Club Fidelización
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-xl font-black text-amber-950">{selectedClient.loyalty_points || 0} pts</span>
                      <span className="text-xs font-semibold text-amber-800/80">
                        (~{(((selectedClient.loyalty_points || 0) / (settings?.loyalty_points_for_discount || 100))).toFixed(2)}€ de descuento)
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const current = selectedClient.loyalty_points || 0
                      const ptsRate = settings?.loyalty_points_for_discount || 100
                      const euroVal = (current / ptsRate).toFixed(2)
                      const val = prompt(
                        `CLUB FIDELIZACIÓN - ${selectedClient.name}\n\nSaldo actual: ${current} pts (${euroVal}€)\n\nIntroduce el nuevo saldo (ej: 250)\no suma/resta con +/- (ej: +50 para regalar, -20 para descontar):`,
                        current
                      )
                      if (val === null) return
                      const trimmed = val.trim()
                      let num = current
                      let explanation = ''
                      if (trimmed.startsWith('+')) {
                        const delta = parseInt(trimmed.slice(1), 10)
                        if (isNaN(delta) || delta <= 0) return alert('Valor numérico a sumar no válido')
                        num = current + delta
                        explanation = `Ajuste de puntos (+${delta} pts): de ${current} a ${num} pts`
                      } else if (trimmed.startsWith('-')) {
                        const delta = parseInt(trimmed.slice(1), 10)
                        if (isNaN(delta) || delta <= 0) return alert('Valor numérico a restar no válido')
                        num = Math.max(0, current - delta)
                        explanation = `Ajuste de puntos (-${delta} pts): de ${current} a ${num} pts`
                      } else {
                        num = parseInt(trimmed, 10)
                        if (isNaN(num) || num < 0) return alert('Número inválido')
                        explanation = `Ajuste manual de puntos: de ${current} a ${num} pts`
                      }
                      try {
                        await supabase.from('clients').update({ loyalty_points: num }).eq('id', selectedClient.id)
                        await supabase.from('client_notes').insert([{
                          client_id: selectedClient.id,
                          content: `⭐ ${explanation}`
                        }])
                        setSelectedClient({ ...selectedClient, loyalty_points: num })
                        fetchClientProfile(selectedClient.id)
                        fetchInitialData()
                      } catch (err) {
                        console.error(err)
                        alert('Error al actualizar puntos')
                      }
                    }}
                    className="bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/70 font-bold p-2 rounded-lg transition shadow-sm cursor-pointer"
                    title="Ajustar puntos"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                {/* RGPD */}
                <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2">
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 ${selectedClient.privacy_accepted ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    <ShieldCheck className="w-3.5 h-3.5" /> {selectedClient.privacy_accepted ? 'RGPD Aceptado' : 'Sin RGPD'}
                  </span>
                  {selectedClient.marketing_consent && (
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded-full">
                      Promociones Permitidas
                    </span>
                  )}
                  {selectedClient.image_consent && (
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-1 rounded-full">
                      Fotos en Redes OK
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* COLUMNA DERECHA: FÓRMULA ACTUAL Y PESTAÑAS DE HISTORIAL (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* TARJETA DE FÓRMULA ACTUAL ACTIVA */}
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-indigo-100/60 border-b border-indigo-200/80 py-3.5 px-5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black text-indigo-950 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" /> Fórmula de Color / Tratamiento Activa
                  </CardTitle>
                  <p className="text-[11px] text-indigo-700 font-medium mt-0.5">
                    Fórmula que se aplicará en la próxima visita de la clienta
                  </p>
                </div>
                {!editingFormula && (
                  <button
                    onClick={() => setEditingFormula(true)}
                    className="bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editar Fórmula
                  </button>
                )}
              </CardHeader>

              <CardContent className="p-5">
                {editingFormula ? (
                  <div className="space-y-3 bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                    <p className="text-xs font-bold text-indigo-900 mb-2">Desglose de la Mezcla y Tiempos:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Raíz:</label>
                        <input
                          type="text"
                          placeholder="Ej: 6.0 (30g) + 6.1 (15g) a 20 Vol."
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                          value={formulaBreakdown.root}
                          onChange={e => setFormulaBreakdown({ ...formulaBreakdown, root: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Medios y Puntas / Baño de Color:</label>
                        <input
                          type="text"
                          placeholder="Ej: 7.12 Gloss con emulsión 10 Vol."
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                          value={formulaBreakdown.lengths}
                          onChange={e => setFormulaBreakdown({ ...formulaBreakdown, lengths: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Decoloración / Mechas:</label>
                        <input
                          type="text"
                          placeholder="Ej: Polvo Deco 1:2 a 20 Vol con Plex"
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                          value={formulaBreakdown.bleach}
                          onChange={e => setFormulaBreakdown({ ...formulaBreakdown, bleach: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Matiz / Toner:</label>
                        <input
                          type="text"
                          placeholder="Ej: 9.1 + 9.02 a 5 Vol (10 min)"
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                          value={formulaBreakdown.toner}
                          onChange={e => setFormulaBreakdown({ ...formulaBreakdown, toner: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Tiempo de Exposición:</label>
                        <input
                          type="text"
                          placeholder="Ej: 35 min exposición normal"
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                          value={formulaBreakdown.time}
                          onChange={e => setFormulaBreakdown({ ...formulaBreakdown, time: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">Observaciones / Notas Extras:</label>
                        <input
                          type="text"
                          placeholder="Ej: Aclarar con champú post-color pH ácido"
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                          value={formulaBreakdown.notes}
                          onChange={e => setFormulaBreakdown({ ...formulaBreakdown, notes: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                      <Button variant="ghost" size="sm" onClick={() => setEditingFormula(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveFormula} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                        <Save className="w-3.5 h-3.5" /> Guardar Fórmula
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {selectedClient.color_formula ? (
                      <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-indigo-100 text-xs font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">
                        {selectedClient.color_formula}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-gray-400 bg-white/50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-xs italic">No hay fórmula activa registrada todavía para esta clienta.</p>
                        <button
                          onClick={() => setEditingFormula(true)}
                          className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                        >
                          + Definir primera fórmula
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PESTAÑAS DE HISTORIAL (LÍNEA DE TIEMPO, GALERÍA, CITAS) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-200 bg-gray-50/80">
                <button
                  onClick={() => setActiveProfileTab('notes')}
                  className={`flex-1 py-3.5 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${activeProfileTab === 'notes' ? 'text-primary border-b-2 border-primary bg-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <History className="w-4 h-4" /> Línea de Tiempo y Visitas ({clientNotes.length})
                </button>
                <button
                  onClick={() => setActiveProfileTab('gallery')}
                  className={`flex-1 py-3.5 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${activeProfileTab === 'gallery' ? 'text-primary border-b-2 border-primary bg-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <ImageIcon className="w-4 h-4" /> Galería de Trabajos ({galleryNotes.length})
                </button>
                <button
                  onClick={() => setActiveProfileTab('appointments')}
                  className={`flex-1 py-3.5 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${activeProfileTab === 'appointments' ? 'text-primary border-b-2 border-primary bg-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <CalendarClock className="w-4 h-4" /> Historial Citas ({clientAppointments.length})
                </button>
              </div>

              <div className="p-5">
                {/* SUBPESTAÑA 1: LÍNEA DE TIEMPO / NOTAS */}
                {activeProfileTab === 'notes' && (
                  <div>
                    {/* FORMULARIO AÑADIR NUEVA NOTA / TRABAJO */}
                    <form onSubmit={handleAddNote} className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-gray-800 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-primary" /> Registrar Nuevo Trabajo u Observación
                        </span>
                        <select
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white text-gray-700 font-semibold"
                          value={noteTag}
                          onChange={e => setNoteTag(e.target.value)}
                        >
                          <option value="Fórmula Color">🎨 Fórmula Color</option>
                          <option value="Tratamiento">💆 Tratamiento Capilar</option>
                          <option value="Corte / Peinado">✂️ Corte / Peinado</option>
                          <option value="Estética / Uñas">💅 Estética / Uñas</option>
                          <option value="General">📝 Observación General</option>
                          <option value="Incidencia">⚠️ Incidencia / Sensibilidad</option>
                        </select>
                      </div>

                      <textarea
                        rows={2}
                        placeholder={newImage ? "Comentario o descripción del trabajo en la foto..." : "Escribe la fórmula aplicada, tiempo de pose o notas técnicas..."}
                        className="w-full border border-gray-200 bg-white rounded-xl p-2.5 text-xs text-gray-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        required={!newImage}
                      />

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <label className="flex items-center gap-2 p-2 px-3 border border-gray-200 bg-white hover:bg-gray-100 rounded-xl text-xs text-gray-600 font-semibold cursor-pointer transition shadow-sm" title="Subir foto Antes/Después">
                            <ImageIcon className="w-4 h-4 text-primary" />
                            <span>{newImage ? 'Cambiar foto' : 'Adjuntar foto'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => {
                                if (e.target.files && e.target.files[0]) {
                                  const file = e.target.files[0]
                                  setNewImage(file)
                                  const reader = new FileReader()
                                  reader.onload = ev => setImagePreview(ev.target.result)
                                  reader.readAsDataURL(file)
                                }
                              }}
                            />
                          </label>

                          {newImage && (
                            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-xl text-xs font-semibold">
                              <span>Foto seleccionada</span>
                              <button type="button" onClick={() => { setNewImage(null); setImagePreview(null) }} className="hover:text-red-500">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-600 font-semibold">
                            <input
                              type="checkbox"
                              className="rounded text-primary"
                              checked={isFormulaNote}
                              onChange={e => setIsFormulaNote(e.target.checked)}
                            />
                            <span>Guardar como Fórmula Actual</span>
                          </label>

                          <Button type="submit" disabled={isUploading} className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2 rounded-xl shrink-0">
                            {isUploading ? 'Subiendo...' : 'Añadir al Historial'}
                          </Button>
                        </div>
                      </div>

                      {imagePreview && (
                        <div className="mt-2 relative inline-block border border-gray-200 rounded-xl overflow-hidden max-h-36">
                          <img src={imagePreview} alt="Preview" className="h-36 object-cover" />
                        </div>
                      )}
                    </form>

                    {/* LÍNEA DE TIEMPO CRONOLÓGICA */}
                    {loadingProfile ? (
                      <p className="text-center text-xs text-gray-400 py-10">Cargando historial...</p>
                    ) : clientNotes.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <History className="w-10 h-10 mx-auto stroke-1 mb-2 text-gray-300" />
                        <p className="text-xs font-medium">No hay entradas en el historial todavía.</p>
                        <p className="text-[11px] text-gray-400">Las fórmulas y trabajos que registres se guardarán aquí con fecha.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 relative before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
                        {clientNotes.map(note => {
                          const isFormulaType = note.content.includes('[FÓRMULA') || note.content.includes('Raíz') || note.content.includes('Tinte')
                          return (
                            <div key={note.id} className="relative pl-10">
                              <div className="absolute left-2.5 top-2 w-3.5 h-3.5 rounded-full bg-primary ring-4 ring-white shadow-xs"></div>
                              <div className="bg-white p-4 rounded-2xl border border-gray-200 hover:border-gray-300 transition shadow-xs">
                                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                                  <span className="font-semibold text-gray-600 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                    {new Date(note.created_at).toLocaleDateString('es-ES', {
                                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                                      hour: '2-digit', minute: '2-digit'
                                    })}
                                  </span>

                                  <div className="flex items-center gap-2">
                                    {isFormulaType && (
                                      <button
                                        onClick={() => handleReuseFormula(note.content)}
                                        className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                                        title="Copiar esta fórmula a la Fórmula Actual de la clienta"
                                      >
                                        <Copy className="w-3 h-3" /> Reutilizar fórmula
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteNote(note.id)}
                                      className="text-gray-400 hover:text-red-600 p-1 transition"
                                      title="Eliminar anotación"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {note.image_url && (
                                  <div className="mb-3 rounded-xl overflow-hidden border border-gray-100 max-w-sm group relative cursor-pointer" onClick={() => setZoomImage(note.image_url)}>
                                    <img src={note.image_url} alt="Foto trabajo" className="w-full h-44 object-cover group-hover:scale-105 transition" />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                                      <ZoomIn className="w-4 h-4" /> Ampliar foto
                                    </div>
                                  </div>
                                )}

                                <p className="text-xs text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">
                                  {note.content}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* SUBPESTAÑA 2: GALERÍA DE TRABAJOS */}
                {activeProfileTab === 'gallery' && (
                  <div>
                    {galleryNotes.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <ImageIcon className="w-10 h-10 mx-auto stroke-1 mb-2 text-gray-300" />
                        <p className="text-xs font-medium">No hay fotos registradas para este cliente.</p>
                        <p className="text-[11px] text-gray-400 mt-1">Adjunta fotos en la línea de tiempo para crear su portafolio antes/después.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {galleryNotes.map(n => (
                          <div
                            key={n.id}
                            className="group relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer aspect-square shadow-sm"
                            onClick={() => setZoomImage(n.image_url)}
                          >
                            <img src={n.image_url} alt="Trabajo" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition p-3 flex flex-col justify-end text-white">
                              <span className="text-[10px] text-gray-300 font-medium">
                                {new Date(n.created_at).toLocaleDateString('es-ES')}
                              </span>
                              <p className="text-xs font-bold truncate">{n.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUBPESTAÑA 3: CITAS PASADAS Y FACTURACIÓN */}
                {activeProfileTab === 'appointments' && (
                  <div>
                    {clientAppointments.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <CalendarClock className="w-10 h-10 mx-auto stroke-1 mb-2 text-gray-300" />
                        <p className="text-xs font-medium">El cliente no tiene citas registradas.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <span>Total de Citas Realizadas: {clientAppointments.length}</span>
                          <span className="text-primary font-black">
                            Total Facturado: {clientAppointments.reduce((sum, a) => sum + Number(a.service?.price || 0), 0).toFixed(2)} €
                          </span>
                        </div>

                        {clientAppointments.map(appt => (
                          <div key={appt.id} className="bg-white p-3.5 rounded-xl border border-gray-200 hover:border-gray-300 transition shadow-xs flex items-center justify-between">
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{appt.service?.name || 'Servicio'}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-primary" />
                                {new Date(appt.start_time).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                {appt.staff?.name && ` • Con ${appt.staff.name}`}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="font-black text-gray-900 text-xs">{appt.service?.price ? `${Number(appt.service.price).toFixed(2)} €` : '-'}</p>
                              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${appt.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : appt.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                {appt.status === 'completed' ? 'Completada' : appt.status === 'cancelled' ? 'Cancelada' : 'Confirmada'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MODAL ZOOM DE IMÁGENES */}
        {zoomImage && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in cursor-pointer" onClick={() => setZoomImage(null)}>
            <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2" onClick={e => e.stopPropagation()}>
              <button onClick={() => setZoomImage(null)} className="absolute top-3 right-3 bg-black/60 hover:bg-black text-white p-1.5 rounded-full transition z-10 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
              <img src={zoomImage} alt="Zoom" className="max-h-[85vh] w-auto object-contain mx-auto rounded-xl" />
            </div>
          </div>
        )}
      </div>
    )
  }

  // =========================================================================
  // VISTA 2: LISTADO DE CLIENTES, BUSCADOR Y FILTROS RÁPIDOS
  // =========================================================================
  return (
    <div className="p-6 md:p-8 min-h-screen bg-gray-50">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <UserCircle className="w-8 h-8 text-primary" /> Clientes y Fichas Técnicas
          </h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">
            Diagnóstico capilar y estética, alertas médicas, fórmulas de color e historial clínico.
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingClient(null)
            setFormData({
              name: '', phone: '', email: '', birth_date: '', color_formula: '', notes: '',
              privacy_accepted: false, marketing_consent: false, image_consent: false,
              allergies: '', hair_type: '', skin_type: ''
            })
            setIsModalOpen(true)
          }}
          className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* Buscador y Filtros Rápidos */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono, email, fórmula o alergia..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm focus:outline-none focus:border-primary focus:bg-white transition"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3.5 top-2.5 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          <button
            onClick={() => setFilterType('all')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${filterType === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            👥 Todos ({counts.all})
          </button>

          <button
            onClick={() => setFilterType('allergies')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${filterType === 'allergies' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Con Alergias ({counts.allergies})
          </button>

          <button
            onClick={() => setFilterType('formula')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${filterType === 'formula' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Con Fórmula ({counts.formula})
          </button>

          <button
            onClick={() => setFilterType('loyalty')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${filterType === 'loyalty' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
          >
            ⭐ Fidelizados ({counts.loyalty})
          </button>

          <button
            onClick={() => setFilterType('no_rgpd')}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${filterType === 'no_rgpd' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
          >
            📋 RGPD Pendiente ({counts.no_rgpd})
          </button>
        </div>
      </div>

      {/* Grid de Clientes */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm font-semibold">Cargando base de clientes...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
          <UserCircle className="w-12 h-12 mx-auto stroke-1 mb-2 text-gray-300" />
          <p className="font-bold text-gray-700 text-sm">No se encontraron clientes.</p>
          <p className="text-xs text-gray-500 mt-1">Prueba a cambiar el término de búsqueda o el filtro seleccionado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.map(client => {
            const tech = parseTechnicalData(client)
            const hasAllergy = !!tech.allergies

            return (
              <Card
                key={client.id}
                className="hover:shadow-md transition-all duration-200 border-gray-200 rounded-2xl overflow-hidden flex flex-col justify-between group bg-white"
              >
                <div>
                  {/* Banner de alerta de alergias si las tiene */}
                  {hasAllergy && (
                    <div className="bg-red-50 border-b border-red-100 px-4 py-1.5 flex items-center gap-1.5 text-red-700 text-[11px] font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Alergia: {tech.allergies}</span>
                    </div>
                  )}

                  <CardHeader className="p-5 pb-3 flex flex-row items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${getAvatarColor(client.name)} flex items-center justify-center text-white font-extrabold text-sm shadow-xs`}>
                        {client.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2
                          className="font-black text-gray-900 text-base group-hover:text-primary transition cursor-pointer"
                          onClick={() => handleSelectClient(client)}
                        >
                          {client.name}
                        </h2>
                        <p className="text-xs text-gray-500 font-medium">{client.phone || 'Sin teléfono'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditBaseModal(client)}
                        className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg transition cursor-pointer"
                        title="Editar datos básicos"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg transition cursor-pointer"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 pb-4 space-y-3">
                    {/* Fórmula actual si la tiene */}
                    {client.color_formula ? (
                      <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 text-xs">
                        <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block mb-0.5">
                          Fórmula Actual:
                        </span>
                        <p className="text-gray-800 font-semibold truncate">
                          {client.color_formula}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-400 italic px-1">
                        Sin fórmula técnica guardada
                      </div>
                    )}

                    {/* Badges de estado */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${client.privacy_accepted ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {client.privacy_accepted ? 'RGPD ✓' : 'Sin RGPD'}
                      </span>

                      {(client.loyalty_points || 0) > 0 && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                          {client.loyalty_points} pts
                        </span>
                      )}

                      {tech.hair_type && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full truncate max-w-[140px]">
                          {tech.hair_type}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </div>

                {/* Botón de Ficha Técnica */}
                <div className="p-5 pt-0">
                  <Button
                    onClick={() => handleSelectClient(client)}
                    className="w-full bg-gray-900 hover:bg-black text-white font-bold text-xs py-2 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <History className="w-4 h-4 text-primary" /> Ver Ficha Técnica e Historial
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL CREAR / EDITAR CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-primary" />
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBaseSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Completo *</label>
                <input
                  required
                  type="text"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs focus:border-primary"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Fecha de Nacimiento</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs"
                  value={formData.birth_date}
                  onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Alergias / Sensibilidades Médicas:
                </label>
                <input
                  type="text"
                  placeholder="Ej: PPD, decoloración, cosméticos..."
                  className="w-full border border-red-200 bg-red-50/40 rounded-xl p-2.5 text-xs text-red-900 font-semibold"
                  value={formData.allergies}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Fórmula Inicial de Color</label>
                <textarea
                  rows={2}
                  placeholder="Ej: 6.0 raíz + 7.1 medios y puntas..."
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs"
                  value={formData.color_formula}
                  onChange={e => setFormData({ ...formData, color_formula: e.target.value })}
                />
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <span className="text-xs font-extrabold text-gray-700 block">Consentimientos Legales (RGPD)</span>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded text-primary"
                    checked={formData.privacy_accepted}
                    onChange={e => setFormData({ ...formData, privacy_accepted: e.target.checked })}
                  />
                  <span>Privacidad y Protección de Datos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded text-primary"
                    checked={formData.marketing_consent}
                    onChange={e => setFormData({ ...formData, marketing_consent: e.target.checked })}
                  />
                  <span>Comunicaciones Comerciales (WhatsApp / Promos)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded text-primary"
                    checked={formData.image_consent}
                    onChange={e => setFormData({ ...formData, image_consent: e.target.checked })}
                  />
                  <span>Derechos de Imagen (Fotos para redes sociales)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer">
                  {editingClient ? 'Actualizar Cliente' : 'Guardar Cliente'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
