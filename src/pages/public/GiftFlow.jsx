import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, Gift, Scissors, Package, Banknote, CheckCircle2, 
  CreditCard, Copy, Check, Share2, Printer, Building2, Download, Clock
} from 'lucide-react';
import jsPDF from 'jspdf';
import { supabase } from '../../lib/supabase';
import PaymentModal from '../../components/PaymentModal';

export default function GiftFlow() {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [giftType, setGiftType] = useState('amount'); // 'amount', 'service', 'product'
  const [selectedAmount, setSelectedAmount] = useState(50);
  const [selectedItem, setSelectedItem] = useState(null); // id of service or product

  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  
  // Payment choice: 'card' (Stripe simulation) or 'manual' (Bizum / in salon)
  const [paymentMethodChoice, setPaymentMethodChoice] = useState('card');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaidOnline, setIsPaidOnline] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  async function fetchData() {
    try {
      const { data: servicesData } = await supabase.from('services').select('*').order('category').order('name');
      setServices((servicesData || []).filter(s => s.is_active !== false));

      const { data: productsData } = await supabase.from('products').select('*').gt('stock', 0).order('name');
      setProducts(productsData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function generateGiftCode() {
    return 'GIFT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Get current item name and price
  function getItemSummary() {
    if (giftType === 'amount') {
      return {
        title: `Tarjeta Regalo (${selectedAmount} €)`,
        price: Number(selectedAmount),
        detail: `Saldo canjeable en cualquier servicio o producto de Ohana.`
      };
    } else if (giftType === 'service') {
      const s = services.find(x => x.id === selectedItem);
      return {
        title: s ? s.name : 'Servicio Ohana',
        price: s ? Number(s.price) : 0,
        detail: s ? `Tratamiento: ${s.name} (${s.duration_minutes} min)` : ''
      };
    } else if (giftType === 'product') {
      const p = products.find(x => x.id === selectedItem);
      return {
        title: p ? p.name : 'Producto Ohana',
        price: p ? Number(p.price) : 0,
        detail: p ? `Producto cosmético profesional: ${p.name}` : ''
      };
    }
    return { title: 'Tarjeta Regalo', price: 0, detail: '' };
  }

  async function saveGiftCard(finalStatus = 'pending_payment') {
    setIsSubmitting(true);
    try {
      const code = generateGiftCode();
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 12);
      
      const payload = {
        code,
        sender_name: senderName,
        recipient_name: recipientName,
        message,
        type: giftType,
        status: finalStatus,
        expires_at: expirationDate.toISOString()
      };

      if (giftType === 'amount') {
        payload.amount_initial = selectedAmount;
        payload.amount_remaining = selectedAmount;
      } else if (giftType === 'service') {
        payload.service_id = selectedItem;
      } else if (giftType === 'product') {
        payload.product_id = selectedItem;
      }

      const { error } = await supabase.from('gift_cards').insert([payload]);
      
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      setGeneratedCode(code);
      setIsPaidOnline(finalStatus === 'active');
      setStep(3);
    } catch (err) {
      console.error(err);
      alert('Hubo un error al generar la tarjeta regalo. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    if (paymentMethodChoice === 'card') {
      // Open Payment Modal
      setIsPaymentModalOpen(true);
    } else {
      // Manual payment
      saveGiftCard('pending_payment');
    }
  }

  async function handlePaymentSuccess() {
    setIsPaymentModalOpen(false);
    await saveGiftCard('active');
  }

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const summary = getItemSummary();
    const text = `🎁 ¡Hola ${recipientName}! ${senderName} te ha hecho un regalo especial en Ohana Peluquería: "${summary.title}".\n\nTu código de regalo es: ${generatedCode}\n${message ? `\n"${message}"\n` : ''}\nPuedes canjearlo cuando quieras reservando en Ohana o acudiendo al salón. ¡Que lo disfrutes mucho! ✨`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const currentSummary = getItemSummary();

  const handleDownloadPDF = async () => {
    try {
      const toDataUrl = async (url) => {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      };

      // Cargar fondo y logo oficiales
      const [bgData, logoData] = await Promise.all([
        toDataUrl('/ohana-card-bg.jpg'),
        toDataUrl('/ohana-card-logo.png')
      ]);

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [210, 130]
      });

      const width = 210;
      const height = 130;

      // 1. Fondo de acuarela turquesa y cintas doradas original
      doc.addImage(bgData, 'JPEG', 0, 0, width, height);

      // 2. Marco exterior sutil dorado
      doc.setDrawColor(201, 162, 102);
      doc.setLineWidth(0.8);
      doc.rect(7, 7, width - 14, height - 14);

      doc.setDrawColor(225, 203, 160);
      doc.setLineWidth(0.3);
      doc.rect(9, 9, width - 18, height - 18);

      // 3. Logo Ohana original con flores y corazón
      const logoW = 74;
      const logoH = 74 / 2.22; // ~33.3 mm
      const logoX = (width - logoW) / 2;
      doc.addImage(logoData, 'PNG', logoX, 11, logoW, logoH);

      // 4. "Tarjeta de regalo exclusivo" CENTRADO y sin ampersands
      let currentY = 11 + logoH + 3.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(160, 115, 50);
      doc.text('TARJETA DE REGALO EXCLUSIVO', width / 2, currentY, { align: 'center' });

      // 5. Tratamiento o Saldo (en Teal Ohana #0f606a)
      currentY += 7.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(15, 96, 106);
      const giftTitle = currentSummary.title.toUpperCase();
      doc.text(giftTitle, width / 2, currentY, { align: 'center' });

      if (currentSummary.detail) {
        currentY += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(currentSummary.detail, width / 2, currentY, { align: 'center' });
      }

      // 6. Para / De parte de
      currentY += 6.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 110, 80);
      doc.text('PARA:', 36, currentY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(recipientName || 'Alguien muy especial', 48, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 110, 80);
      doc.text('DE PARTE DE:', 116, currentY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(senderName || 'Ohana Peluquería y Estética', 142, currentY);

      // 7. Dedicatoria si existe (letras más grandes: 9.5 pt)
      if (message) {
        currentY += 4.5;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(229, 213, 189);
        doc.setLineWidth(0.3);
        doc.roundedRect(28, currentY, width - 56, 11, 2, 2, 'FD');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9.5);
        doc.setTextColor(60, 60, 60);
        const splitMsg = doc.splitTextToSize(`"${message}"`, width - 64);
        doc.text(splitMsg, width / 2, currentY + 7, { align: 'center' });
        currentY += 13.5;
      } else {
        currentY += 5;
      }

      // 8. Caja del Código de Canje
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(201, 162, 102);
      doc.setLineWidth(0.6);
      doc.roundedRect(width / 2 - 40, currentY, 80, 12, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(140, 120, 90);
      doc.text('CÓDIGO DE CANJE', width / 2, currentY + 3.8, { align: 'center' });

      doc.setFont('courier', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 96, 106);
      doc.text(generatedCode, width / 2, currentY + 9.5, { align: 'center' });

      // Estado (insignia perfectamente centrada)
      const statusText = isPaidOnline 
        ? 'TARJETA ACTIVADA Y ABONADA (ONLINE)' 
        : 'PENDIENTE DE ACTIVACION EN SALON';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const textW = doc.getTextWidth(statusText);
      const badgeW = textW + 8;
      const badgeH = 5.5;
      const badgeX = (width - badgeW) / 2;
      const badgeY = currentY + 15;

      if (isPaidOnline) {
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(110, 231, 183);
        doc.setLineWidth(0.3);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, 'FD');
        doc.setTextColor(6, 120, 70);
      } else {
        doc.setFillColor(254, 252, 232);
        doc.setDrawColor(252, 211, 77);
        doc.setLineWidth(0.3);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, 'FD');
        doc.setTextColor(180, 120, 20);
      }
      doc.text(statusText, width / 2, badgeY + 3.8, { align: 'center' });

      // Línea divisoria decorativa antes de la validez
      doc.setDrawColor(230, 215, 185);
      doc.setLineWidth(0.3);
      doc.line(width / 2 - 45, 107, width / 2 + 45, 107);

      // Validez y datos del salón (elevado a 112mm y 116.5mm, lejos del borde inferior a 121mm)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);
      doc.text('Validez: 12 meses desde la fecha de emisión en Ohana Peluquería y Estética', width / 2, 112, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      doc.text('Palma del Río (Córdoba) • Teléfonos: 957 26 54 42 / 639 86 61 79', width / 2, 116.5, { align: 'center' });

      doc.save(`Tarjeta_Regalo_Ohana_${generatedCode}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error al generar el PDF de la tarjeta.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-foreground pb-24">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 border-b border-gray-100 px-4 py-4 flex items-center justify-between shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-gray-800 transition">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg text-gray-900">Regala Ohana</span>
          </div>
        </div>
        <div className="text-sm font-medium text-gray-500 hidden sm:block">Paso {Math.min(step, 2)} de 2</div>
      </header>

      <main className="max-w-3xl mx-auto p-4 py-8 print:p-0 print:m-0 print:max-w-none print:static">
        
        {/* PASO 1: TIPO DE REGALO */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-2 tracking-tight text-gray-900">¿Qué quieres regalar?</h1>
            <p className="text-gray-500 mb-8">Elige el tipo de detalle perfecto para esa persona especial.</p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <button
                onClick={() => { setGiftType('amount'); setSelectedItem(null); }}
                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all cursor-pointer
                  ${giftType === 'amount' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}
              >
                <Banknote className="w-8 h-8" />
                <span className="font-semibold">Saldo</span>
              </button>
              
              <button
                onClick={() => { setGiftType('service'); setSelectedItem(null); }}
                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all cursor-pointer
                  ${giftType === 'service' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}
              >
                <Scissors className="w-8 h-8" />
                <span className="font-semibold">Servicio</span>
              </button>
              
              <button
                onClick={() => { setGiftType('product'); setSelectedItem(null); }}
                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all cursor-pointer
                  ${giftType === 'product' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}
              >
                <Package className="w-8 h-8" />
                <span className="font-semibold">Producto</span>
              </button>
            </div>

            {giftType === 'amount' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 animate-in fade-in">
                <h2 className="text-lg font-bold mb-4 text-gray-900">Selecciona el importe</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[30, 50, 100, 150].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setSelectedAmount(amt)}
                      className={`py-4 rounded-xl border-2 font-bold text-lg transition-all cursor-pointer
                        ${selectedAmount === amt ? 'border-primary bg-primary text-white shadow-md' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                    >
                      {amt} €
                    </button>
                  ))}
                </div>
              </div>
            )}

            {giftType === 'service' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 animate-in fade-in">
                <h2 className="text-lg font-bold mb-4 text-gray-900">Selecciona el servicio</h2>
                {loading ? <p className="text-gray-500">Cargando catálogo...</p> : (
                  <select
                    className="w-full border-2 border-gray-200 rounded-xl p-4 font-medium focus:border-primary outline-none bg-white"
                    value={selectedItem || ''}
                    onChange={(e) => setSelectedItem(e.target.value)}
                  >
                    <option value="" disabled>-- Elige un servicio --</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name} - {s.price} € ({s.duration_minutes} min)</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {giftType === 'product' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 animate-in fade-in">
                <h2 className="text-lg font-bold mb-4 text-gray-900">Selecciona el producto</h2>
                {loading ? <p className="text-gray-500">Cargando inventario...</p> : (
                  <select
                    className="w-full border-2 border-gray-200 rounded-xl p-4 font-medium focus:border-primary outline-none bg-white"
                    value={selectedItem || ''}
                    onChange={(e) => setSelectedItem(e.target.value)}
                  >
                    <option value="" disabled>-- Elige un producto --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {p.price} €</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex justify-center animate-in slide-in-from-bottom-full">
              <button
                disabled={giftType !== 'amount' && !selectedItem}
                onClick={() => setStep(2)}
                className="w-full max-w-md bg-gray-900 text-white py-4 rounded-xl font-bold shadow-xl shadow-gray-900/20 hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Continuar ({currentSummary.price.toFixed(2)} €)</span>
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: DATOS Y MÉTODO DE PAGO */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 tracking-tight text-gray-900">Personaliza tu regalo</h1>
            <p className="text-gray-500 mb-6">Indícanos de parte de quién es y escribe una dedicatoria.</p>

            {/* Resumen del regalo */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-primary tracking-wider block">Regalo seleccionado</span>
                <span className="text-base font-bold text-gray-900">{currentSummary.title}</span>
                {currentSummary.detail && (
                  <span className="text-xs text-gray-600 block mt-0.5">{currentSummary.detail}</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-gray-900">{currentSummary.price.toFixed(2)} €</span>
              </div>
            </div>

            <form id="gift-form" onSubmit={handleFormSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Tu Nombre (De parte de) *</label>
                <input required type="text" className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none text-sm transition"
                  value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Ej: Carlos Gómez" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Nombre del Destinatario (Para) *</label>
                <input required type="text" className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none text-sm transition"
                  value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Ej: Laura Martínez" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Mensaje o Dedicatoria (Opcional)</label>
                <textarea className="w-full border p-3 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none min-h-[90px] text-sm transition"
                  value={message} onChange={e => setMessage(e.target.value)} placeholder="¡Feliz cumpleaños! Espero que disfrutes de tu momento de mimos en Ohana." />
              </div>

              {/* Selector de Método de Pago */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">¿Cómo deseas abonar la tarjeta?</label>
                <div className="space-y-3">
                  
                  {/* Opción 1: Tarjeta Online (Stripe Simulado) */}
                  <label 
                    onClick={() => setPaymentMethodChoice('card')}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer
                      ${paymentMethodChoice === 'card' ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  >
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="card" 
                      checked={paymentMethodChoice === 'card'} 
                      onChange={() => setPaymentMethodChoice('card')} 
                      className="mt-1 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-primary" /> Pagar ahora con Tarjeta
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Activación Inmediata
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Pago seguro encriptado SSL con garantía Stripe. La tarjeta regalo se activará al instante con su código.
                      </p>
                    </div>
                  </label>

                  {/* Opción 2: Bizum / En Salón */}
                  <label 
                    onClick={() => setPaymentMethodChoice('manual')}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer
                      ${paymentMethodChoice === 'manual' ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  >
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="manual" 
                      checked={paymentMethodChoice === 'manual'} 
                      onChange={() => setPaymentMethodChoice('manual')} 
                      className="mt-1 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-gray-500" /> Pagar por Bizum o en el Salón
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Activación Manual
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Genera el código de reserva y abónalo más tarde mediante Bizum o directamente en la peluquería.
                      </p>
                    </div>
                  </label>

                </div>
              </div>

            </form>

            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="flex-1 py-4 rounded-xl font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition cursor-pointer"
              >
                Atrás
              </button>
              <button
                form="gift-form"
                type="submit"
                disabled={isSubmitting}
                className="flex-[2] py-4 rounded-xl font-bold bg-gray-900 text-white shadow-xl shadow-gray-900/20 hover:bg-black transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  'Generando tarjeta...'
                ) : paymentMethodChoice === 'card' ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Pagar con Tarjeta ({currentSummary.price.toFixed(2)} €)</span>
                  </>
                ) : (
                  <span>Generar Tarjeta (Pago Manual)</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: TARJETA GENERADA / ÉXITO */}
        {step === 3 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 max-w-xl mx-auto py-6 print:py-0 print:max-w-none">
            
            <div className="text-center mb-6 print:hidden">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ${isPaidOnline ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-gray-900">
                {isPaidOnline ? '¡Tarjeta Regalo Activa!' : '¡Tarjeta Generada!'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {isPaidOnline 
                  ? 'El pago se ha procesado con éxito y la tarjeta ya está lista para usarse.' 
                  : 'Tu tarjeta ha sido registrada. Sigue las instrucciones para activarla.'}
              </p>
            </div>

            {/* Vale Regalo Visual Impresionable (Fondo acuarela original y Logo oficial Ohana) */}
            <div 
              id="printable-voucher" 
              className="relative bg-[#FAF8F5] text-stone-900 rounded-3xl p-6 sm:p-8 pb-10 sm:pb-12 shadow-xl mb-6 border-2 border-[#D4AF37] print:border-[#B48C36] print:m-0 print:p-8 print:shadow-none print:w-full print:max-w-none overflow-hidden"
              style={{
                backgroundImage: "url('/ohana-card-bg.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}
            >
              {/* Marco interior dorado fino de elegancia */}
              <div className="absolute inset-2 sm:inset-3 border border-[#E5C985]/70 rounded-2xl pointer-events-none print:border-[#C9A266]" />

              {/* Logo Oficial Ohana de la imagen (con flores, letras verde esmeralda y corazón) */}
              <div className="relative text-center mb-2">
                <img 
                  src="/ohana-card-logo.png" 
                  alt="Ohana Peluquería y Estética" 
                  className="h-20 sm:h-24 w-auto mx-auto object-contain drop-shadow-xs"
                />
              </div>

              {/* Tarjeta de regalo exclusivo CENTRADO y sin ampersands */}
              <div className="relative text-center mb-4">
                <span className="inline-block text-[11px] sm:text-xs font-extrabold tracking-[0.2em] uppercase text-[#8C6D37] bg-white/85 backdrop-blur-xs px-4 py-1 rounded-full border border-[#DFCBB0] shadow-2xs">
                  TARJETA DE REGALO EXCLUSIVO
                </span>
              </div>

              {/* Contenido Principal: Tratamiento / Saldo (en Teal Ohana) */}
              <div className="relative text-center mb-5">
                <h2 className="text-2xl sm:text-3xl font-black text-[#0f606a] tracking-tight">
                  {currentSummary.title}
                </h2>
                {currentSummary.detail && (
                  <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-md mx-auto">
                    {currentSummary.detail}
                  </p>
                )}
              </div>

              {/* Destinatario y Remitente */}
              <div className="relative grid grid-cols-2 gap-4 bg-white/85 backdrop-blur-xs rounded-2xl p-4 border border-[#E5D5BD] shadow-2xs mb-4">
                <div className="border-r border-[#DFCAB0] pr-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#8C7654] block mb-0.5">
                    Para
                  </span>
                  <span className="text-sm sm:text-base font-bold text-stone-900 block truncate">
                    {recipientName || 'Alguien muy especial'}
                  </span>
                </div>
                <div className="pl-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#8C7654] block mb-0.5">
                    De parte de
                  </span>
                  <span className="text-sm sm:text-base font-bold text-stone-900 block truncate">
                    {senderName || 'Ohana Peluquería y Estética'}
                  </span>
                </div>
              </div>

              {/* Dedicatoria opcional (letras más grandes y destacadas) */}
              {message && (
                <div className="relative bg-white/85 backdrop-blur-xs border border-[#E5D5BD] rounded-2xl px-5 py-3.5 mb-4 text-center italic text-sm sm:text-base md:text-lg font-serif text-stone-800 leading-relaxed shadow-2xs">
                  "{message}"
                </div>
              )}

              {/* Código de Canje */}
              <div className="relative bg-white/95 border-2 border-dashed border-[#C9A266] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm mb-3">
                <div className="text-center sm:text-left">
                  <span className="text-[9px] uppercase font-extrabold tracking-widest text-[#8C6D37] block mb-0.5">
                    CÓDIGO DE CANJE
                  </span>
                  <span className="font-mono text-2xl sm:text-3xl font-black text-[#0f606a] tracking-wider">
                    {generatedCode}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="print:hidden px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Copiar código"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? '¡Copiado!' : 'Copiar Código'}</span>
                </button>
              </div>

              {/* Estado de la tarjeta (completamente centrado) */}
              <div className="w-full flex justify-center items-center my-3 text-center">
                <div className={`inline-flex items-center justify-center gap-1.5 text-xs font-bold uppercase px-4 py-1.5 rounded-full shadow-2xs mx-auto ${
                  isPaidOnline 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {isPaidOnline ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Tarjeta Activada y Abonada (Online)</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Pendiente de Activación en Salón</span>
                    </>
                  )}
                </div>
              </div>

              {/* Validez de la tarjeta y datos del salón (elevado y con letras más grandes) */}
              <div className="relative text-center space-y-1.5 pt-4 pb-2 mb-2 border-t border-[#EAD7B0]/80">
                <p className="text-xs sm:text-sm font-bold text-stone-700 tracking-wide">
                  Validez: 12 meses desde la fecha de emisión en Ohana Peluquería y Estética
                </p>
                <p className="text-[11px] sm:text-xs font-semibold text-stone-600">
                  Palma del Río (Córdoba) • Teléfonos: 957 26 54 42 / 639 86 61 79
                </p>
              </div>
            </div>

            {/* Instrucciones si es pago manual */}
            {!isPaidOnline && (
              <div className="bg-white rounded-2xl p-6 border border-amber-200 shadow-sm mb-6 text-left print:hidden">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-500" /> Pasos para activar esta tarjeta:
                </h3>
                <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-2">
                  <li>Realiza un Bizum indicando en el concepto <strong>{generatedCode}</strong> al número de Ohana: <span className="font-bold text-gray-900">639 86 61 79</span>.</li>
                  <li>O acércate al salón de Ohana para abonarlo en efectivo o tarjeta física.</li>
                  <li>En cuanto recibamos el aviso, activaremos la tarjeta en el sistema para que {recipientName} pueda utilizarla.</li>
                </ol>
              </div>
            )}

            {/* Botones de Acción (Descargar PDF, Imprimir, Compartir, Inicio) */}
            <div className="space-y-3 print:hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="w-full py-3.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full py-3.5 px-3 rounded-xl bg-white border border-gray-300 text-gray-800 font-bold text-sm shadow-sm hover:bg-gray-50 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-gray-600" />
                  <span>Imprimir Tarjeta</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="w-full py-3.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Por WhatsApp</span>
                </button>
              </div>

              <Link 
                to="/" 
                className="w-full block text-center py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm transition"
              >
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
        amount={currentSummary.price}
        title="Pago de Tarjeta Regalo"
        description={`Pago para ${recipientName}`}
        itemSummary={currentSummary.title}
      />
    </div>
  );
}
