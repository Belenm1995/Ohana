import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Gift, Search, RefreshCw, CheckCircle, XCircle, Eye, Calendar, MessageSquare } from 'lucide-react';

export default function AdminGiftCards() {
  const [giftCards, setGiftCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Modales
  const [activatingCard, setActivatingCard] = useState(null);
  const [selectedCardDetails, setSelectedCardDetails] = useState(null);

  useEffect(() => {
    fetchGiftCards();
  }, []);

  async function fetchGiftCards() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select(`
          *,
          service:services(name),
          product:products(name)
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setGiftCards(data || []);
    } catch (e) {
      console.error(e);
      alert('Error cargando tarjetas regalo');
    } finally {
      setLoading(false);
    }
  }

  const filteredCards = giftCards.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = c.code.toLowerCase().includes(term) || 
                          (c.sender_name && c.sender_name.toLowerCase().includes(term)) || 
                          (c.recipient_name && c.recipient_name.toLowerCase().includes(term));
                          
    const cardDate = new Date(c.created_at);
    let matchesDate = true;
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      if (cardDate < s) matchesDate = false;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      if (cardDate > e) matchesDate = false;
    }

    return matchesSearch && matchesDate;
  });

  async function handleActivate() {
    if (!activatingCard) return;
    
    try {
      const { error } = await supabase
        .from('gift_cards')
        .update({ status: 'active' })
        .eq('id', activatingCard.id);
        
      if (error) throw error;
      
      setGiftCards(prev => prev.map(c => c.id === activatingCard.id ? { ...c, status: 'active' } : c));
      if (selectedCardDetails && selectedCardDetails.id === activatingCard.id) {
        setSelectedCardDetails(prev => ({ ...prev, status: 'active' }));
      }
      setActivatingCard(null);
    } catch (e) {
      console.error(e);
      alert('Error al activar tarjeta');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Gift className="w-8 h-8 text-primary" />
            Tarjetas Regalo
          </h1>
          <p className="text-gray-500 mt-1">Gestiona los regalos pendientes, activos y canjeados</p>
        </div>
        
        <button 
          onClick={fetchGiftCards}
          className="p-3 bg-white border rounded-xl hover:bg-gray-50 transition"
          title="Actualizar lista"
        >
          <RefreshCw className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por código, remitente o destinatario..." 
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium text-gray-500">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm text-gray-700"
            />
            <span className="text-sm font-medium text-gray-500">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-sm text-gray-700"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-gray-400 hover:text-gray-600 p-2"
                title="Limpiar fechas"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando tarjetas...</div>
        ) : filteredCards.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl">No hay tarjetas regalo encontradas</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-4 font-medium">Código</th>
                  <th className="pb-4 font-medium">Fecha</th>
                  <th className="pb-4 font-medium">De → Para</th>
                  <th className="pb-4 font-medium">Regalo</th>
                  <th className="pb-4 font-medium">Estado</th>
                  <th className="pb-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCards.map(card => (
                  <tr key={card.id} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="py-4">
                      <span className="font-mono font-bold bg-gray-100 px-2 py-1 rounded text-gray-800">{card.code}</span>
                    </td>
                    <td className="py-4 text-gray-500">
                      {new Date(card.created_at).toLocaleString('es-ES', { 
                        day: '2-digit', month: '2-digit', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                      })}
                    </td>
                    <td className="py-4">
                      <div className="font-medium">{card.sender_name || 'Anónimo'}</div>
                      <div className="text-sm text-gray-500">→ {card.recipient_name || 'Destinatario'}</div>
                    </td>
                    <td className="py-4">
                      {card.type === 'amount' && (
                        <div className="flex flex-col">
                          <span className="font-bold text-green-600">{card.amount_remaining}€ <span className="text-xs font-normal text-gray-400">/ {card.amount_initial}€</span></span>
                        </div>
                      )}
                      {card.type === 'service' && <span>Servicio: {card.service?.name || 'Servicio específico'}</span>}
                      {card.type === 'product' && <span>Producto: {card.product?.name || 'Producto específico'}</span>}
                    </td>
                    <td className="py-4">
                      {card.status === 'pending_payment' && (
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">
                          Pendiente Pago
                        </span>
                      )}
                      {card.status === 'active' && (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1">
                          <CheckCircle className="w-3 h-3" /> Activo
                        </span>
                      )}
                      {(card.status === 'used' || card.status === 'redeemed') && (
                        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">
                          Canjeado
                        </span>
                      )}
                      {card.expires_at && (
                        <div className={`text-xs mt-2 font-medium ${new Date(card.expires_at) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                          {new Date(card.expires_at) < new Date() ? 'Caducada' : 'Caduca: ' + new Date(card.expires_at).toLocaleDateString('es-ES')}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedCardDetails(card)}
                          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                          title="Ver detalle de la tarjeta"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {card.status === 'pending_payment' && (
                          <button 
                            onClick={() => setActivatingCard(card)}
                            className="bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg font-semibold transition text-xs flex items-center gap-1 shadow-sm"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Marcar Pagado
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle de Tarjeta */}
      {selectedCardDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Gift className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold text-gray-900">Detalle de Tarjeta</h3>
              </div>
              <button 
                onClick={() => setSelectedCardDetails(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 py-4 text-sm">
              <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">Código</span>
                  <span className="font-mono text-xl font-black text-gray-900">{selectedCardDetails.code}</span>
                </div>
                <div>
                  {selectedCardDetails.status === 'pending_payment' && (
                    <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">Pendiente Pago</span>
                  )}
                  {selectedCardDetails.status === 'active' && (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Activa
                    </span>
                  )}
                  {(selectedCardDetails.status === 'used' || selectedCardDetails.status === 'redeemed') && (
                    <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">Canjeada</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-xs text-gray-400 font-semibold block">De:</span>
                  <span className="font-semibold text-gray-800">{selectedCardDetails.sender_name || 'Anónimo'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-xs text-gray-400 font-semibold block">Para:</span>
                  <span className="font-semibold text-gray-800">{selectedCardDetails.recipient_name || 'Destinatario'}</span>
                </div>
              </div>

              {selectedCardDetails.message && (
                <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                  <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-1">
                    <MessageSquare className="w-3.5 h-3.5" /> Mensaje / Dedicatoria:
                  </span>
                  <p className="text-gray-700 italic text-sm">"{selectedCardDetails.message}"</p>
                </div>
              )}

              <div className="p-3 bg-gray-50 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Tipo de regalo:</span>
                  <span className="font-bold uppercase text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-800">
                    {selectedCardDetails.type === 'amount' ? 'Saldo en Salón' : selectedCardDetails.type === 'service' ? 'Servicio' : 'Producto'}
                  </span>
                </div>
                {selectedCardDetails.type === 'amount' ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Importe Inicial:</span>
                      <span className="font-medium text-gray-700">{selectedCardDetails.amount_initial}€</span>
                    </div>
                    <div className="flex justify-between items-center text-base">
                      <span className="text-gray-700 font-semibold">Saldo Disponible:</span>
                      <span className="font-black text-emerald-600">{selectedCardDetails.amount_remaining}€</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Artículo:</span>
                    <span className="font-bold text-gray-900">
                      {selectedCardDetails.service?.name || selectedCardDetails.product?.name || 'Artículo asignado'}
                    </span>
                  </div>
                )}
                {selectedCardDetails.expires_at && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200/60 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Fecha de caducidad:</span>
                    <span className="font-semibold text-gray-700">{new Date(selectedCardDetails.expires_at).toLocaleDateString('es-ES')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {selectedCardDetails.status === 'pending_payment' && (
                <button 
                  onClick={() => {
                    setActivatingCard(selectedCardDetails);
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Marcar como Pagado
                </button>
              )}
              <button 
                onClick={() => setSelectedCardDetails(null)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de activación */}
      {activatingCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold mb-2">Confirmar Activación</h3>
            <p className="text-gray-500 mb-6 text-sm">
              ¿Has recibido el pago para la tarjeta <strong>{activatingCard.code}</strong>?<br/><br/>
              Una vez activada, podrá ser canjeada en el TPV o en reservas.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setActivatingCard(null)}
                className="flex-1 py-3 bg-gray-100 rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleActivate}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium"
              >
                Sí, activar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
