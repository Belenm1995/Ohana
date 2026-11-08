import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Scissors, Clock, CreditCard, ShieldCheck, Gift, Check, AlertCircle, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PaymentModal from '../../components/PaymentModal';

import { getStaffScheduleForDate } from '../../lib/scheduleUtils';

export default function BookingFlow() {
  const location = useLocation();
  const initialStaffName = location.state?.staffName;
  const [step, setStep] = useState(1);
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [globalSettings, setGlobalSettings] = useState({ online_payments_enabled: false });

  // Helper para inicializar la fecha en un día laborable (si hoy es domingo, sugiere lunes)
  const getInitialBookingDate = () => {
    const d = new Date();
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Selección del usuario
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('any');
  const [selectedDate, setSelectedDate] = useState(getInitialBookingDate());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Datos del cliente
  const [clientData, setClientData] = useState({ name: '', phone: '', email: '' });
  const [consents, setConsents] = useState({ privacy: false, marketing: false, image: false });
  const [existingClientConsent, setExistingClientConsent] = useState(null); // Registro previo del cliente si ya existe
  const [paymentChoice, setPaymentChoice] = useState('later'); // 'now' or 'later'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Tarjeta Regalo
  const [giftCardCode, setGiftCardCode] = useState(location.state?.giftCode || '');
  const [appliedGiftCard, setAppliedGiftCard] = useState(null);
  const [giftCardLoading, setGiftCardLoading] = useState(false);
  const [giftCardMessage, setGiftCardMessage] = useState(null); // { type: 'success' | 'error', text: '' }

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (staffList.length > 0 && initialStaffName) {
      const match = staffList.find(s => s.name.toLowerCase().includes(initialStaffName.toLowerCase()));
      if (match) {
        setSelectedStaff(match.id);
      }
    }
  }, [staffList, initialStaffName]);

  // Fetch slots whenever date, services or staff changes
  useEffect(() => {
    if (step === 3 && selectedServices.length > 0) {
      calculateAvailableSlots();
    }
  }, [step, selectedDate, selectedServices, selectedStaff]);

  async function fetchServices() {
    try {
      const { data: servicesData, error: servicesErr } = await supabase.from('services').select('*').order('category').order('name');
      if (servicesErr) throw servicesErr;
      
      // Filtramos los inactivos de forma segura por si la columna es null (asumimos true)
      const activeServices = (servicesData || []).filter(s => s.is_active !== false);
      setServices(activeServices);

      const { data: productsData, error: productsErr } = await supabase.from('products').select('*').gt('stock', 0).order('name');
      if (productsErr) throw productsErr;
      setProducts(productsData || []);

      const { data: staffData, error: staffErr } = await supabase.from('staff').select('id, name, role, schedule').order('name');
      if (staffErr) {
        console.error('Error fetching staff:', staffErr);
      } else {
        // Excluir a Valentín (o a los gerentes) y al personal inactivo de la lista pública de reservas
        const bookableStaff = staffData.filter(s =>
          !s.name.toLowerCase().includes('valentin') &&
          !s.name.toLowerCase().includes('valentín') &&
          s.role?.toLowerCase() !== 'gerente' &&
          s.role?.toLowerCase() !== 'inactivo'
        );
        setStaffList(bookableStaff);
      }

      const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (settingsData) {
        setGlobalSettings(settingsData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingServices(false);
    }
  }

  async function calculateAvailableSlots() {
    setLoadingSlots(true);
    try {
      const staffToFilter = selectedStaff === 'any' ? staffList : staffList.filter(s => s.id === selectedStaff);

      // 2. Obtener todas las citas para ese día
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());

      // Lógica hiper simplificada para el MVP:
      // Buscamos horas en punto o a y media (9:00, 9:30, 10:00...) 
      // y comprobamos si hay ALGÚN empleado libre durante la duración TOTAL.

      const selectedSvcs = services.filter(s => selectedServices.includes(s.id));
      if (selectedSvcs.length === 0 || staffToFilter.length === 0) {
        setAvailableSlots([]);
        return;
      }

      const totalDurationMins = selectedSvcs.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const durationMs = totalDurationMins * 60 * 1000;
      const slots = [];

      // Exploramos desde las 7:00 hasta las 21:00
      for (let h = 7; h <= 21; h++) {
        for (let m of [0, 30]) {
          const slotStart = new Date(`${selectedDate}T00:00:00`);
          slotStart.setHours(h, m, 0, 0);

          const slotEnd = new Date(slotStart.getTime() + durationMs);

          // No permitir citas que ya han pasado (si es hoy)
          const now = new Date();
          if (slotStart <= now) continue;

          const startMins = slotStart.getHours() * 60 + slotStart.getMinutes();
          const endMins = slotEnd.getHours() * 60 + slotEnd.getMinutes();

          // Buscar un empleado que esté trabajando y no tenga citas solapadas
          let availableStaff = null;

          for (let person of staffToFilter) {
            const schedules = getStaffScheduleForDate(person, selectedDate, globalSettings?.opening_date);
            if (schedules.length === 0) continue; // Este empleado no trabaja hoy

            // Verificar si el bloque completo entra dentro del turno del empleado
            let isValidTimeForPerson = false;
            for (const [sh, sm, eh, em] of schedules) {
              const rangeStart = sh * 60 + sm;
              const rangeEnd = eh * 60 + em; // Terminar dentro del turno de trabajo
              if (startMins >= rangeStart && endMins <= rangeEnd) {
                isValidTimeForPerson = true;
                break;
              }
            }

            if (!isValidTimeForPerson) continue;
            const hasConflict = appointments.some(appt => {
              if (appt.staff_id !== person.id) return false;
              if (appt.status === 'cancelled') return false;

              const apptStart = new Date(appt.start_time);
              const apptEnd = new Date(appt.end_time);

              // Verifica solapamiento (A < B_end && A_end > B)
              return (slotStart < apptEnd && slotEnd > apptStart);
            });

            if (!hasConflict) {
              availableStaff = person;
              break;
            }
          }

          if (availableStaff) {
            slots.push({
              time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
              staffId: availableStaff.id,
              staffName: availableStaff.name,
              startDateTime: slotStart,
              endDateTime: slotEnd
            });
          }
        }
      }

      setAvailableSlots(slots);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingSlots(false);
    }
  }

  // Comprobar si el cliente ya aceptó previamente marketing e imagen
  async function checkExistingConsents(email, phone) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/\D/g, '');

    if (!cleanEmail.includes('@') && cleanPhone.length < 9) {
      setExistingClientConsent(null);
      return;
    }

    try {
      let match = null;

      // 1. Buscar por email
      if (cleanEmail.includes('@') && cleanEmail.includes('.')) {
        const { data } = await supabase
          .from('clients')
          .select('id, name, marketing_consent, image_consent, privacy_accepted')
          .eq('email', cleanEmail)
          .limit(1);
        if (data && data.length > 0) {
          match = data[0];
        }
      }

      // 2. Si no se encontró por email, buscar por teléfono
      if (!match && cleanPhone.length >= 9) {
        const last9 = cleanPhone.slice(-9);
        const { data } = await supabase
          .from('clients')
          .select('id, name, phone, marketing_consent, image_consent, privacy_accepted')
          .limit(100);

        match = data?.find(c => c.phone && c.phone.replace(/\D/g, '').endsWith(last9));
      }

      setExistingClientConsent(match || null);
      if (match?.name && !clientData.name) {
        setClientData(prev => ({ ...prev, name: match.name }));
      }
    } catch (err) {
      console.error('Error al comprobar consentimientos del cliente:', err);
    }
  }

  useEffect(() => {
    if (step === 4) {
      const timer = setTimeout(() => {
        checkExistingConsents(clientData.email, clientData.phone);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [step, clientData.email, clientData.phone]);

  const totalServicesPrice = services
    .filter(s => selectedServices.includes(s.id))
    .reduce((acc, s) => acc + Number(s.price || 0), 0);

  const totalProductsPrice = products
    .filter(p => selectedProducts.includes(p.id))
    .reduce((acc, p) => acc + Number(p.price || 0), 0);

  const totalBookingPrice = totalServicesPrice + totalProductsPrice;

  // Cálculo de descuento por tarjeta regalo
  let giftCardDiscount = 0;
  if (appliedGiftCard) {
    if (appliedGiftCard.type === 'amount') {
      giftCardDiscount = Math.min(Number(appliedGiftCard.amount_remaining || 0), totalBookingPrice);
    } else if (appliedGiftCard.type === 'service') {
      const isServiceSelected = selectedServices.includes(appliedGiftCard.service_id);
      if (isServiceSelected) {
        giftCardDiscount = Math.min(Number(appliedGiftCard.service?.price ?? 0), totalBookingPrice);
      }
    } else if (appliedGiftCard.type === 'product') {
      const isProductSelected = selectedProducts.includes(appliedGiftCard.product_id);
      if (isProductSelected) {
        giftCardDiscount = Math.min(Number(appliedGiftCard.product?.price ?? 0), totalBookingPrice);
      }
    }
  }

  const finalBookingPrice = Math.max(0, totalBookingPrice - giftCardDiscount);

  async function applyGiftCard() {
    if (!giftCardCode || !giftCardCode.trim()) return;
    setGiftCardLoading(true);
    setGiftCardMessage(null);

    try {
      const formattedCode = giftCardCode.trim().toUpperCase();
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*, service:services(*), product:products(*)')
        .eq('code', formattedCode)
        .single();

      if (error || !data) {
        setGiftCardMessage({ type: 'error', text: 'Código de tarjeta regalo no encontrado.' });
        return;
      }

      if (data.status !== 'active') {
        const statusText = data.status === 'pending_payment' ? 'pendiente de pago' : data.status === 'used' ? 'ya canjeada' : data.status;
        setGiftCardMessage({ type: 'error', text: `Esta tarjeta no está activa (${statusText}).` });
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setGiftCardMessage({ type: 'error', text: 'Esta tarjeta regalo ha caducado.' });
        return;
      }

      if (data.type === 'amount' && Number(data.amount_remaining || 0) <= 0) {
        setGiftCardMessage({ type: 'error', text: 'Esta tarjeta regalo no tiene saldo disponible.' });
        return;
      }

      if (data.type === 'service') {
        const isSelected = selectedServices.includes(data.service_id);
        if (!isSelected) {
          setGiftCardMessage({ 
            type: 'error', 
            text: `Esta tarjeta regalo es para el servicio "${data.service?.name || 'específico'}". Debes añadirlo a tu reserva para poder canjearla.` 
          });
          return;
        }
      }

      if (data.type === 'product') {
        const isSelected = selectedProducts.includes(data.product_id);
        if (!isSelected) {
          setGiftCardMessage({ 
            type: 'error', 
            text: `Esta tarjeta regalo es para el producto "${data.product?.name || 'específico'}". Debes añadirlo a tu reserva para poder canjearla.` 
          });
          return;
        }
      }

      setAppliedGiftCard(data);
      setGiftCardCode('');
      setGiftCardMessage({ 
        type: 'success', 
        text: `¡Tarjeta aplicada! ${data.type === 'amount' ? `Saldo disponible: ${data.amount_remaining} €` : `Cubre: ${data.service?.name || data.product?.name}`}` 
      });
    } catch (e) {
      console.error(e);
      setGiftCardMessage({ type: 'error', text: 'Error al verificar la tarjeta. Inténtalo de nuevo.' });
    } finally {
      setGiftCardLoading(false);
    }
  }

  function removeGiftCard() {
    setAppliedGiftCard(null);
    setGiftCardMessage(null);
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    if (!consents.privacy) {
      alert('Debes aceptar la política de privacidad para continuar.');
      return;
    }

    // Si la tarjeta cubre el 100% de la cita, se confirma directamente pagada
    if (finalBookingPrice === 0) {
      executeBookingConfirmation('paid');
    } else if (globalSettings.online_payments_enabled && paymentChoice === 'now') {
      setIsPaymentModalOpen(true);
    } else {
      executeBookingConfirmation('pending');
    }
  }

  async function handlePaymentSuccess(paymentData) {
    setIsPaymentModalOpen(false);
    await executeBookingConfirmation('paid', paymentData);
  }

  async function executeBookingConfirmation(finalPaymentStatus = 'pending', _paymentData = null) {
    setIsSubmitting(true);
    try {
      // 1. Buscar si el cliente existe por email o por teléfono para evitar duplicados
      let clientId;
      if (clientData.email) {
        const { data: byEmail } = await supabase
          .from('clients')
          .select('id')
          .eq('email', clientData.email.trim().toLowerCase())
          .limit(1);
        if (byEmail && byEmail.length > 0) {
          clientId = byEmail[0].id;
        }
      }

      if (!clientId && clientData.phone) {
        const cleanPhone = clientData.phone.replace(/\D/g, '');
        const { data: byPhone } = await supabase
          .from('clients')
          .select('id, phone')
          .limit(100);
        const match = byPhone?.find(c => c.phone && c.phone.replace(/\D/g, '') === cleanPhone);
        if (match) {
          clientId = match.id;
        }
      }

      if (clientId) {
        const updatePayload = {
          name: clientData.name,
          phone: clientData.phone,
          consent_date: new Date().toISOString(),
          privacy_accepted: true
        };
        // Mantener consentimientos previos si ya estaban aceptados, o activar si se marcaron ahora
        if (consents.marketing || existingClientConsent?.marketing_consent) {
          updatePayload.marketing_consent = true;
        }
        if (consents.image || existingClientConsent?.image_consent) {
          updatePayload.image_consent = true;
        }

        await supabase.from('clients').update(updatePayload).eq('id', clientId);
      } else {
        const { data: newClient, error: clientErr } = await supabase
          .from('clients')
          .insert([{
            name: clientData.name,
            phone: clientData.phone,
            email: clientData.email.trim().toLowerCase(),
            privacy_accepted: true,
            marketing_consent: consents.marketing,
            image_consent: consents.image,
            consent_date: new Date().toISOString()
          }])
          .select()
          .single();

        if (clientErr) throw clientErr;
        clientId = newClient.id;
      }

      // 2. Crear la cita
      const apptItems = [
        ...services.filter(s => selectedServices.includes(s.id)).map(s => ({
          type: 'service', id: s.id, name: s.name, price: s.price, duration_minutes: s.duration_minutes, qty: 1
        })),
        ...products.filter(p => selectedProducts.includes(p.id)).map(p => ({
          type: 'product', id: p.id, name: p.name, price: p.price, qty: 1
        }))
      ];

      if (appliedGiftCard && giftCardDiscount > 0) {
        apptItems.push({
          type: 'gift_card_redemption',
          id: appliedGiftCard.id,
          name: `Tarjeta Regalo (${appliedGiftCard.code})`,
          price: -giftCardDiscount,
          qty: 1
        });
      }

      const effectivePaymentStatus = finalBookingPrice === 0 ? 'paid' : finalPaymentStatus;

      const { error: apptErr } = await supabase
        .from('appointments')
        .insert([{
          client_id: clientId,
          staff_id: selectedSlot.staffId,
          service_id: selectedServices[0] || null,
          items: apptItems,
          start_time: selectedSlot.startDateTime.toISOString(),
          end_time: selectedSlot.endDateTime.toISOString(),
          status: 'confirmed',
          payment_status: effectivePaymentStatus
        }]);

      if (apptErr) throw apptErr;

      // 3. Consumir el saldo / estado de la tarjeta regalo en Supabase
      if (appliedGiftCard && giftCardDiscount > 0) {
        if (appliedGiftCard.type === 'amount') {
          const newBalance = Math.max(0, Number(appliedGiftCard.amount_remaining || 0) - giftCardDiscount);
          await supabase
            .from('gift_cards')
            .update({
              amount_remaining: newBalance,
              status: newBalance <= 0 ? 'used' : 'active'
            })
            .eq('id', appliedGiftCard.id);
        } else {
          await supabase
            .from('gift_cards')
            .update({ status: 'used' })
            .eq('id', appliedGiftCard.id);
        }
      }

      setStep(5); // Completado
    } catch (error) {
      console.error(error);
      alert('Hubo un error al confirmar la cita. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-foreground pb-24">

      {/* Header */}
      <header className="bg-white sticky top-0 z-10 border-b border-gray-100 px-4 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-gray-800 transition">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-2">
            <Scissors className="w-6 h-6 text-primary" />
            <span className="font-semibold">Ohana</span>
          </div>
        </div>
        <div className="text-sm font-medium text-gray-500 hidden sm:block">Paso {Math.min(step, 4)} de 4</div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8">

        {/* PASO 1: SELECCIONAR SERVICIO(S) Y PRODUCTO(S) */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-2 tracking-tight">Selecciona lo que necesites</h1>
            <p className="text-gray-500 mb-8">Elige todos los servicios y productos que quieras para tu cita.</p>

            {loadingServices ? (
              <div className="text-center p-8 text-gray-500">Cargando catálogo...</div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-4">Servicios (Selecciona 1 o más)</h2>
                <div className="mb-8">
                  {services.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
                      No hay servicios disponibles en este momento.
                    </div>
                  ) : (
                    Array.from(new Set(services.map(s => s.category || 'Otros'))).map(category => (
                      <div key={category} className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-3 px-1">{category}</h3>
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {services.filter(s => (s.category || 'Otros') === category).map(svc => {
                              const isSelected = selectedServices.includes(svc.id);
                              return (
                                <div
                                  key={svc.id}
                                  className={`border rounded-xl p-5 transition-all hover:border-primary/50 hover:shadow-md flex flex-col justify-between cursor-pointer
                                    ${isSelected ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-gray-200 bg-white'}`}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedServices(selectedServices.filter(id => id !== svc.id));
                                    } else {
                                      setSelectedServices([...selectedServices, svc.id]);
                                    }
                                  }}
                                >
                                  <div>
                                    <div className="flex justify-between items-start mb-1">
                                      <h3 className="font-semibold text-gray-900">{svc.name}</h3>
                                      {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                                    </div>
                                    <div className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {svc.duration_minutes} min
                                    </div>
                                    <div className="font-bold text-gray-900 mb-4">{Number(svc.price).toLocaleString()}€</div>
                                    {svc.description && <p className="text-xs text-gray-500 mb-6 leading-relaxed line-clamp-3">{svc.description}</p>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <h2 className="text-xl font-bold mb-4">Productos (Opcional)</h2>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {products.map(prod => {
                      const isSelected = selectedProducts.includes(prod.id);
                      return (
                        <div
                          key={prod.id}
                          className={`border rounded-xl p-5 transition-all hover:border-primary/50 hover:shadow-md flex flex-col justify-between cursor-pointer
                            ${isSelected ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-gray-200 bg-white'}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedProducts(selectedProducts.filter(id => id !== prod.id));
                            } else {
                              setSelectedProducts([...selectedProducts, prod.id]);
                            }
                          }}
                        >
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-semibold text-gray-900">{prod.name}</h3>
                              {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                            </div>
                            <div className="font-bold text-gray-900 mb-4">{Number(prod.price).toLocaleString()}€</div>
                            {prod.description && <p className="text-xs text-gray-500 mb-6 leading-relaxed line-clamp-3">{prod.description}</p>}
                          </div>
                        </div>
                      )
                    })}
                    {products.length === 0 && (
                      <div className="col-span-full p-8 text-center text-gray-500">
                        No hay productos disponibles en este momento.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {selectedServices.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-lg flex justify-center z-20 animate-in slide-in-from-bottom-full">
                <div className="w-full max-w-md flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs text-gray-500 font-medium block">
                      {selectedServices.length} {selectedServices.length === 1 ? 'servicio' : 'servicios'} • {services.filter(s => selectedServices.includes(s.id)).reduce((sum, s) => sum + (s.duration_minutes || 0), 0)} min
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {totalBookingPrice.toFixed(2)} €
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (initialStaffName && selectedStaff !== 'any') {
                        setStep(3);
                      } else {
                        setStep(2);
                      }
                    }}
                    className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-xl font-medium shadow-md hover:bg-black transition flex justify-center items-center cursor-pointer"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 2: SELECCIONAR PROFESIONAL */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 tracking-tight">¿Con quién te gustaría reservar?</h1>
            <p className="text-gray-500 mb-6">Puedes elegir a tu profesional favorito o buscar el primer hueco disponible.</p>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setSelectedStaff('any')}
                  className={`py-4 px-5 rounded-xl border text-left font-medium transition-all
                    ${selectedStaff === 'any'
                      ? 'border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20'
                      : 'border-gray-200 hover:border-primary/50 text-gray-700 hover:bg-gray-50'}`}
                >
                  Cualquiera (Ver todos los huecos libres)
                </button>

                {staffList.map(person => (
                  <button
                    key={person.id}
                    onClick={() => setSelectedStaff(person.id)}
                    className={`py-4 px-5 rounded-xl border text-left font-medium transition-all
                      ${selectedStaff === person.id
                        ? 'border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20'
                        : 'border-gray-200 hover:border-primary/50 text-gray-700 hover:bg-gray-50'}`}
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3.5 rounded-xl font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition">Volver</button>
              <button
                onClick={() => setStep(3)}
                className="flex-[2] py-3.5 rounded-xl font-medium bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition"
              >
                Ver Horarios
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: FECHA Y HORA */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 tracking-tight">Fecha y hora</h1>
            <p className="text-gray-500 mb-6">Selecciona cuándo te gustaría venir.</p>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700">Día</label>
              <input
                type="date"
                min={
                  globalSettings?.opening_date && new Date(globalSettings.opening_date) > new Date()
                    ? globalSettings.opening_date
                    : new Date().toISOString().split('T')[0]
                }
                className="w-full border-gray-200 border rounded-xl p-3 mb-6 bg-gray-50 focus:bg-white transition-colors"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot(null);
                }}
              />

              <label className="block text-sm font-medium mb-3 text-gray-700">Horas disponibles</label>
              {loadingSlots ? (
                <div className="text-center p-4 text-gray-500 text-sm">Buscando huecos...</div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center p-4 bg-orange-50 text-orange-600 rounded-lg text-sm border border-orange-100">
                  {new Date(selectedDate + "T00:00:00").getDay() === 0
                    ? "Los domingos estamos cerrados."
                    : "No hay horas disponibles este día. Prueba seleccionando otra fecha."}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {availableSlots.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-3 rounded-xl border text-sm font-medium transition-all
                        ${selectedSlot === slot
                          ? 'border-primary bg-primary text-white shadow-md'
                          : 'border-gray-200 hover:border-primary/50 text-gray-700 hover:bg-gray-50'}`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}

              {selectedSlot && (
                <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-xl text-center text-sm font-semibold text-primary flex items-center justify-center gap-2 animate-in fade-in">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Hueco seleccionado: <strong>{selectedSlot.time}</strong> con <strong>{selectedSlot.staffName}</strong></span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3.5 rounded-xl font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition">Volver</button>
              <button
                disabled={!selectedSlot}
                onClick={() => setStep(4)}
                className="flex-1 py-3.5 rounded-xl font-medium bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar hora
              </button>
            </div>
          </div>
        )}

        {/* PASO 4: TUS DATOS */}
        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 tracking-tight text-gray-900">Tus datos</h1>
            <p className="text-gray-500 mb-6">Déjanos tus datos para confirmar la reserva.</p>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">

              {/* Resumen de la cita */}
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 mb-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-primary">Resumen de tu cita</h3>
                  <div className="text-right">
                    {appliedGiftCard && giftCardDiscount > 0 ? (
                      <>
                        <span className="text-xs text-gray-400 line-through block">{totalBookingPrice.toFixed(2)} €</span>
                        <span className="text-xl font-black text-gray-900">{finalBookingPrice.toFixed(2)} €</span>
                      </>
                    ) : (
                      <span className="text-lg font-black text-gray-900">{totalBookingPrice.toFixed(2)} €</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700"><strong>Servicios:</strong> {services.filter(s => selectedServices.includes(s.id)).map(s => s.name).join(' + ')}</p>
                {selectedProducts.length > 0 && (
                  <p className="text-sm text-gray-700 mt-1"><strong>Productos:</strong> {products.filter(p => selectedProducts.includes(p.id)).map(p => p.name).join(' + ')}</p>
                )}
                <p className="text-sm text-gray-700 mt-1 capitalize"><strong>Día:</strong> {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="text-sm text-gray-700"><strong>Hora:</strong> {selectedSlot?.time} (con {selectedSlot?.staffName})</p>

                {/* Desglose de tarjeta regalo si está aplicada */}
                {appliedGiftCard && giftCardDiscount > 0 && (
                  <div className="mt-3 pt-3 border-t border-primary/15 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary text-white font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                        {appliedGiftCard.code}
                      </span>
                      <span className="text-emerald-700 font-bold">
                        -{giftCardDiscount.toFixed(2)} € aplicados
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={removeGiftCard}
                      className="text-red-500 hover:text-red-700 font-bold hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              {/* Canjear Tarjeta Regalo */}
              <div className="mb-6 p-4 bg-gray-50/70 border border-gray-200/80 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">¿Tienes una Tarjeta Regalo?</h4>
                </div>
                {appliedGiftCard ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Tarjeta {appliedGiftCard.code} activada
                      </p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        {appliedGiftCard.type === 'amount'
                          ? `Saldo inicial: ${appliedGiftCard.amount_initial} € • Restará: ${Math.max(0, appliedGiftCard.amount_remaining - giftCardDiscount).toFixed(2)} € tras la cita`
                          : `Cubre el importe del servicio`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeGiftCard}
                      className="text-xs font-bold text-gray-500 hover:text-red-600 px-2 py-1 transition"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej. GIFT-XXXXXX"
                        value={giftCardCode}
                        onChange={e => setGiftCardCode(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyGiftCard(); } }}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm uppercase font-mono tracking-wider focus:outline-none focus:border-primary bg-white transition"
                      />
                      <button
                        type="button"
                        onClick={applyGiftCard}
                        disabled={giftCardLoading || !giftCardCode.trim()}
                        className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {giftCardLoading ? 'Comprobando...' : 'Aplicar'}
                      </button>
                    </div>
                    {giftCardMessage && (
                      <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${giftCardMessage.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                        {giftCardMessage.type === 'error' ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <Check className="w-3.5 h-3.5 shrink-0" />}
                        {giftCardMessage.text}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <form id="booking-form" onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Nombre Completo *</label>
                  <input required type="text" className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white text-sm outline-none"
                    value={clientData.name} onChange={e => setClientData({ ...clientData, name: e.target.value })} placeholder="Ej. Ana Gómez" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Email *</label>
                  <input
                    required
                    type="email"
                    className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white text-sm outline-none transition"
                    value={clientData.email}
                    onChange={e => setClientData({ ...clientData, email: e.target.value })}
                    onBlur={() => checkExistingConsents(clientData.email, clientData.phone)}
                    placeholder="tu@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Teléfono Móvil (WhatsApp) *</label>
                  <input
                    required
                    type="tel"
                    className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white text-sm outline-none transition"
                    value={clientData.phone}
                    onChange={e => setClientData({ ...clientData, phone: e.target.value })}
                    onBlur={() => checkExistingConsents(clientData.email, clientData.phone)}
                    placeholder="Ej: 639 866 179"
                  />
                </div>

                <div className="mt-4 space-y-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Consentimientos Legales</h4>
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      required
                      type="checkbox"
                      className="mt-1 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                      checked={consents.privacy}
                      onChange={e => setConsents({ ...consents, privacy: e.target.checked })}
                    />
                    <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                      He leído y acepto la <a href="/politica-privacidad.pdf.pdf" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>Política de Privacidad</a> *
                    </span>
                  </label>

                  {/* Solo se muestran si el cliente NO los ha aceptado anteriormente */}
                  {(!existingClientConsent || !existingClientConsent.marketing_consent) && (
                    <label className="flex items-start gap-3 cursor-pointer group animate-in fade-in">
                      <input
                        type="checkbox"
                        className="mt-1 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                        checked={consents.marketing}
                        onChange={e => setConsents({ ...consents, marketing: e.target.checked })}
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                        Acepto recibir comunicaciones y recordatorios sobre mis citas
                      </span>
                    </label>
                  )}

                  {(!existingClientConsent || !existingClientConsent.image_consent) && (
                    <label className="flex items-start gap-3 cursor-pointer group animate-in fade-in">
                      <input
                        type="checkbox"
                        className="mt-1 w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                        checked={consents.image}
                        onChange={e => setConsents({ ...consents, image: e.target.checked })}
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                        Autorizo el uso de imágenes de mi tratamiento para las redes sociales de Ohana
                      </span>
                    </label>
                  )}
                </div>

                {/* Métodos de Pago */}
                {finalBookingPrice === 0 ? (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-900">¡Tu cita queda 100% pagada con tu Tarjeta Regalo!</p>
                      <p className="text-xs text-emerald-700">El importe total de los servicios queda cubierto. No tendrás que abonar nada al reservar.</p>
                    </div>
                  </div>
                ) : (
                  globalSettings.online_payments_enabled && (
                    <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                      <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
                        {appliedGiftCard ? 'Método de Pago para el importe restante' : 'Método de Pago'}
                      </h4>
                      <div className="space-y-2.5">
                        <label className={`flex items-start gap-3 cursor-pointer p-3.5 rounded-xl border-2 transition ${paymentChoice === 'now' ? 'border-primary bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                          <input type="radio" name="payment_choice" value="now" className="mt-1 w-4 h-4 text-primary focus:ring-primary"
                            checked={paymentChoice === 'now'} onChange={() => setPaymentChoice('now')} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4 text-primary" /> Pagar ahora con Tarjeta ({finalBookingPrice.toFixed(2)} €)
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                Simulación Stripe
                              </span>
                            </div>
                            <span className="block text-xs text-gray-500 mt-0.5">Paga online de forma segura con tarjeta bancaria.</span>
                          </div>
                        </label>

                        <label className={`flex items-start gap-3 cursor-pointer p-3.5 rounded-xl border-2 transition ${paymentChoice === 'later' ? 'border-primary bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                          <input type="radio" name="payment_choice" value="later" className="mt-1 w-4 h-4 text-primary focus:ring-primary"
                            checked={paymentChoice === 'later'} onChange={() => setPaymentChoice('later')} />
                          <div className="flex-1">
                            <span className="block text-sm font-bold text-gray-900">Pagar en el Salón</span>
                            <span className="block text-xs text-gray-500 mt-0.5">Abona los {finalBookingPrice.toFixed(2)} € el día de tu cita en efectivo o tarjeta.</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )
                )}
              </form>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(3)} className="flex-1 py-4 rounded-xl font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition cursor-pointer">Atrás</button>
              <button
                form="booking-form"
                type="submit"
                disabled={isSubmitting || !consents.privacy}
                className="flex-[2] py-4 rounded-xl font-bold bg-gray-900 text-white shadow-xl shadow-gray-900/20 hover:bg-black transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting
                  ? 'Confirmando reserva...'
                  : finalBookingPrice === 0
                    ? 'Confirmar Cita con Tarjeta Regalo (0.00 €)'
                    : ((globalSettings.online_payments_enabled && paymentChoice === 'now') 
                        ? `Pagar con Tarjeta (${finalBookingPrice.toFixed(2)} €)` 
                        : `Confirmar Reserva (${finalBookingPrice.toFixed(2)} €)`)}
              </button>
            </div>
          </div>
        )}

        {/* PASO 5: ÉXITO */}
        {step === 5 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto text-center py-12">
            <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-black mb-2 tracking-tight text-gray-900">¡Cita confirmada!</h1>
            <p className="text-gray-500 mb-6 text-sm">Hemos guardado tu reserva en Ohana. ¡Te esperamos con muchas ganas!</p>

            {/* Badge de estado del pago */}
            {appliedGiftCard ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 text-left shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest block">
                    {finalBookingPrice === 0 ? 'PAGADO CON TARJETA REGALO' : 'PAGO PARCIAL CON TARJETA REGALO'}
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                    {appliedGiftCard.code}
                  </span>
                </div>
                <div className="flex justify-between items-end mt-2">
                  <div className="text-xs text-emerald-800 space-y-0.5">
                    <p>Descuento aplicado: <strong>-{giftCardDiscount.toFixed(2)} €</strong></p>
                    {appliedGiftCard.type === 'amount' && (
                      <p className="text-[11px] text-emerald-700 italic">
                        Saldo restante en tarjeta: <strong>{Math.max(0, appliedGiftCard.amount_remaining - giftCardDiscount).toFixed(2)} €</strong>
                      </p>
                    )}
                    {finalBookingPrice > 0 && (
                      <p className="text-xs font-semibold text-gray-800 pt-1">
                        Restante {paymentChoice === 'now' ? 'pagado con tarjeta' : 'a abonar en el salón'}: <strong>{finalBookingPrice.toFixed(2)} €</strong>
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-emerald-950">{totalBookingPrice.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            ) : globalSettings.online_payments_enabled && paymentChoice === 'now' ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 flex items-center justify-between text-left shadow-sm">
                <div>
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest block">PAGO CONFIRMADO</span>
                  <span className="text-sm font-bold text-emerald-900 flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Tarjeta bancaria (Stripe)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-900">{totalBookingPrice.toFixed(2)} €</span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6 flex items-center justify-between text-left">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">PAGO EN EL SALÓN</span>
                  <span className="text-xs text-gray-600 mt-0.5">Abonarás al finalizar el servicio</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-gray-900">{totalBookingPrice.toFixed(2)} €</span>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-left mb-8 space-y-3">
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cita para</p>
                <p className="font-bold text-gray-900 text-base">{clientData.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cuándo</p>
                  <p className="font-semibold text-gray-800 text-sm capitalize">
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} a las {selectedSlot?.time}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Con quién</p>
                  <p className="font-semibold text-gray-800 text-sm">{selectedSlot?.staffName}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`https://wa.me/34639866179?text=${encodeURIComponent(`Hola Ohana, acabo de reservar cita a nombre de ${clientData.name} para el ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} a las ${selectedSlot?.time} con ${selectedSlot?.staffName}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                <MessageCircle className="w-5 h-5" />
                Avisar por WhatsApp
              </a>
              <Link to="/" className="flex-1 py-4 px-6 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition text-center shadow-lg shadow-gray-900/20">
                Volver a la portada
              </Link>
            </div>
          </div>
        )}

      </main>

      {/* Modal de Pago con Tarjeta (Stripe Simulado) */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
        amount={finalBookingPrice}
        title="Pago de Reserva"
        description={`Cita con ${selectedSlot?.staffName || 'Ohana'}`}
        itemSummary={services.filter(s => selectedServices.includes(s.id)).map(s => s.name).join(' + ')}
      />
    </div>
  );
}
