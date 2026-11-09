import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, MessageCircle, Clock, Menu, X, Gift, ChevronRight } from 'lucide-react';

function InstagramIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-foreground font-sans selection:bg-primary/20">

      {/* HEADER / NAV */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-4">
          
          {/* LOGO */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0" onClick={() => setMobileMenuOpen(false)}>
            <img src="/logo.png" alt="Ohana" className="h-10 sm:h-14 md:h-20 w-auto object-contain group-hover:scale-105 transition-transform" />
            <span className="font-normal text-4xl sm:text-5xl md:text-7xl tracking-normal text-gray-900 leading-none inline-block -translate-y-0.5 sm:-translate-y-1.5 pr-1" style={{ fontFamily: "'MonteCarlo', cursive" }}>Ohana</span>
          </Link>

          {/* NAVEGACIÓN ESCRITORIO (md y superior) */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 xl:gap-10">
            <a href="#servicios" className="text-base lg:text-lg font-medium text-gray-600 hover:text-primary transition-colors py-1 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-primary after:absolute after:bottom-0 after:left-0 after:transition-all whitespace-nowrap">
              Tratamientos
            </a>
            <a href="#galeria" className="text-base lg:text-lg font-medium text-gray-600 hover:text-primary transition-colors py-1 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-primary after:absolute after:bottom-0 after:left-0 after:transition-all whitespace-nowrap">
              Galería
            </a>
            <a href="#equipo" className="text-base lg:text-lg font-medium text-gray-600 hover:text-primary transition-colors py-1 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-primary after:absolute after:bottom-0 after:left-0 after:transition-all whitespace-nowrap">
              Equipo
            </a>
            <a href="#estilistas" className="text-base lg:text-lg font-medium text-gray-600 hover:text-primary transition-colors py-1 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-primary after:absolute after:bottom-0 after:left-0 after:transition-all whitespace-nowrap">
              Estilistas
            </a>
            <a href="#contacto" className="text-base lg:text-lg font-medium text-gray-600 hover:text-primary transition-colors py-1 relative hover:after:w-full after:w-0 after:h-0.5 after:bg-primary after:absolute after:bottom-0 after:left-0 after:transition-all whitespace-nowrap">
              Contacto
            </a>
          </nav>

          {/* ACCIONES DERECHA */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-5 shrink-0">
            <a
              href="https://instagram.com/ohanapeluqueria"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-pink-600 transition-colors p-1.5 sm:p-2 rounded-full hover:bg-pink-50"
              title="Síguenos en Instagram @ohanapeluqueria"
            >
              <InstagramIcon className="w-5 h-5 text-pink-600" />
            </a>

            <Link
              to="/booking"
              className="bg-primary text-primary-foreground px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-base font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap"
            >
              Reservar Cita
            </Link>

            {/* BOTÓN MENÚ MÓVIL (Hamburguesa) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none"
              aria-label="Abrir menú de navegación"
            >
              {mobileMenuOpen ? <X className="w-6 h-6 text-gray-900" /> : <Menu className="w-6 h-6 text-gray-900" />}
            </button>
          </div>
        </div>

        {/* MENÚ MÓVIL DESPLEGABLE */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white/98 backdrop-blur-xl px-5 py-6 shadow-2xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-1.5 text-base font-medium">
              <a
                href="#servicios"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 text-gray-800 transition"
              >
                <span>Tratamientos</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </a>
              <a
                href="#galeria"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 text-gray-800 transition"
              >
                <span>Galería de Trabajos</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </a>
              <a
                href="#equipo"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 text-gray-800 transition"
              >
                <span>El alma de Ohana</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </a>
              <a
                href="#estilistas"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 text-gray-800 transition"
              >
                <span>Nuestras Estilistas (Marina & Mery)</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </a>
              <a
                href="#contacto"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 text-gray-800 transition"
              >
                <span>Horarios y Ubicación</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </a>

              <div className="pt-4 mt-2 border-t border-gray-100 flex flex-col gap-2.5">
                <Link
                  to="/booking"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-center shadow-md shadow-primary/20 text-base"
                >
                  Reservar Cita Online
                </Link>
                <Link
                  to="/gift"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full bg-gray-50 text-gray-800 border border-gray-200 py-3 rounded-xl font-semibold text-center text-sm flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4" />
                  Regalar un Tratamiento
                </Link>
              </div>

              <div className="pt-3 mt-1 flex items-center justify-around text-xs text-gray-500">
                <a href="tel:957265442" className="flex items-center gap-1.5 hover:text-primary font-medium py-1">
                  <Phone className="w-3.5 h-3.5 text-primary" /> 957 26 54 42
                </a>
                <a
                  href="https://wa.me/34639866179"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-emerald-600 font-medium py-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <a
                  href="https://instagram.com/ohanapeluqueria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-pink-600 font-medium py-1"
                >
                  <InstagramIcon className="w-3.5 h-3.5" /> @ohana
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 md:pt-16 pb-16 md:pb-24 text-center">

        {/* Contenedor responsivo proporcional - Nunca se corta ni en móvil ni en PC */}
        <div className="relative w-full max-w-4xl mx-auto h-[260px] sm:h-[360px] md:h-[450px] bg-gray-100 rounded-2xl md:rounded-[2rem] overflow-hidden mb-8 md:mb-12 shadow-sm border border-gray-100">
          {/* Fondo del salón */}
          <img
            src="https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&q=80&w=2000"
            alt="Interior del salón"
            className="w-full h-full object-cover opacity-80"
          />
          {/* Tarjeta flotante escalable y centrada */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md px-5 py-4 sm:px-8 sm:py-6 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl flex flex-col items-center justify-center max-w-[88%] max-h-[88%] transition-all">
            <img src="/logo.png" alt="Ohana Logo" className="w-24 h-24 sm:w-44 sm:h-44 md:w-72 md:h-72 object-contain" />
            <h2 className="text-4xl sm:text-7xl md:text-[130px] font-normal tracking-normal text-gray-900 -mt-2 sm:-mt-4 md:-mt-8" style={{ fontFamily: "'MonteCarlo', cursive", lineHeight: 0.8 }}>Ohana</h2>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <a
            href="https://www.google.com/maps/search/?api=1&query=Ohana+Peluqueria+Palma+del+Rio"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mb-4 bg-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-sm border border-gray-100 hover:shadow-md hover:scale-105 transition-all cursor-pointer text-xs sm:text-sm"
            title="Ver ubicación y reseñas en Google"
          >
            <div className="flex text-orange-400 text-xs sm:text-sm">★★★★★</div>
            <span className="font-bold text-gray-800">4.9</span>
            <span className="text-gray-500 underline decoration-gray-300 hover:text-gray-900 transition-colors">Ver nuestras reseñas en Google</span>
          </a>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-4 sm:mb-6 text-gray-900 leading-tight">
            Descubre tu <br /> mejor versión.
          </h1>
          <p className="text-gray-500 text-sm sm:text-lg max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
            Especialistas en tratamientos capilares, colorimetría y diseño de imagen.
            Reserva tu momento de desconexión en menos de 1 minuto.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none">
            <Link
              to="/booking"
              className="w-full sm:w-auto bg-primary text-primary-foreground px-8 sm:px-10 py-3.5 sm:py-5 rounded-full text-base sm:text-xl md:text-2xl font-medium shadow-[0_8px_20px_rgb(20,184,166,0.3)] hover:shadow-[0_8px_25px_rgb(20,184,166,0.5)] hover:-translate-y-1 transition-all text-center"
            >
              Reservar mi momento
            </Link>
            
            <Link
              to="/gift"
              className="w-full sm:w-auto bg-white text-gray-900 border-2 border-gray-900 px-8 sm:px-10 py-3.5 sm:py-5 rounded-full text-base sm:text-xl md:text-2xl font-medium hover:bg-gray-50 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 text-center"
            >
              <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
              Regalar a alguien
            </Link>
          </div>
        </div>
      </main>

      {/* TRATAMIENTOS SECTION */}
      <section id="servicios" className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4 text-gray-900">Nuestros Tratamientos</h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-base sm:text-lg md:text-xl">Experiencias personalizadas para sacar lo mejor de ti.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-5 sm:mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-gray-900">Colorimetría Avanzada</h3>
              <p className="text-gray-500 text-sm sm:text-base leading-relaxed">Balayage, babylights, corrección de color y mechas tradicionales. Trabajamos con los mejores productos para cuidar tu cabello.</p>
            </div>
            <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-5 sm:mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-gray-900">Tratamientos Capilares</h3>
              <p className="text-gray-500 text-sm sm:text-base leading-relaxed">Hidratación profunda, alisados orgánicos, botox capilar y recuperación de fibras dañadas.</p>
            </div>
            <div className="bg-gray-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-5 sm:mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3 text-gray-900">Diseño de Corte</h3>
              <p className="text-gray-500 text-sm sm:text-base leading-relaxed">Cortes en tendencia, visagismo y asesoría de imagen personalizada para encontrar tu estilo ideal.</p>
            </div>
          </div>
        </div>
      </section>

      {/* GALERIA / PUBLICIDAD SECTION */}
      <section id="galeria" className="py-12 sm:py-16 md:py-20 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4 text-gray-900">Nuestro Trabajo</h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-base sm:text-lg md:text-xl">
              Descubre los resultados y déjate inspirar.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Foto 1 */}
            <div className="aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow group relative">
              <img src="/tocado.JPG" alt="Tocado" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            {/* Foto 2 */}
            <div className="aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow group relative mt-0 md:mt-12">
              <img src="/labios.JPG" alt="Maquillaje Labios" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            {/* Foto 3 */}
            <div className="aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow group relative">
              <img src="/pelu.JPG" alt="Peluquería" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            {/* Foto 4 */}
            <div className="aspect-[4/5] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow group relative mt-0 md:mt-12">
              <img src="/rimel.JPG" alt="Maquillaje Rímel" className="w-full h-full object-cover object-left group-hover:scale-105 transition-transform duration-700" />
            </div>
          </div>
        </div>
      </section>

      {/* EQUIPO SECTION */}
      <section id="equipo" className="py-12 sm:py-16 md:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 h-[250px] sm:h-[350px] md:h-[500px]">
              <div className="relative rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-lg h-[92%] mt-auto">
                <img src="https://images.unsplash.com/photo-1562322140-8baeececf3df?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Estilista trabajando" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="relative rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-lg h-[92%] mb-auto">
                <img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Detalle salón" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 sm:mb-6 text-gray-900">El alma de Ohana</h2>
              <p className="text-gray-500 text-base sm:text-lg md:text-xl mb-4 sm:mb-6 leading-relaxed">
                Creemos que cada persona es única y merece un trato excepcional. Nuestro equipo de estilistas está en constante formación para traerte las últimas tendencias y técnicas del mundo de la belleza.
              </p>
              <p className="text-gray-500 text-base sm:text-lg md:text-xl mb-6 sm:mb-8 leading-relaxed">
                No solo cortamos el pelo, creamos experiencias donde tú eres el protagonista. Siéntate, relájate y déjate mimar.
              </p>
              <button 
                onClick={() => document.getElementById('estilistas')?.scrollIntoView({ behavior: 'smooth' })} 
                className="inline-flex bg-gray-900 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full text-base sm:text-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Conoce a nuestras estilistas
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ESTILISTAS SECTION */}
      <section id="estilistas" className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4 text-gray-900">Nuestras Estilistas</h2>
            <p className="text-gray-500 text-base sm:text-xl max-w-2xl mx-auto">
              Conoce a las expertas que darán vida a tu mejor versión.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 max-w-4xl mx-auto">
            {/* Marina */}
            <div className="flex flex-col items-center text-center bg-gray-50 rounded-2xl sm:rounded-[2rem] p-6 sm:p-8 hover:shadow-lg transition-shadow">
              <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full overflow-hidden mb-5 sm:mb-6 bg-white shadow-sm border-4 border-white">
                <img src="/Caricatura Marina.jpeg" alt="Marina" className="w-full h-full object-contain p-2 hover:scale-105 transition-transform duration-500" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Marina</h3>
              <p className="text-gray-500 text-sm sm:text-lg leading-relaxed mb-6">
                Especialista en colorimetría y tratamientos capilares. Su pasión es encontrar el tono perfecto que ilumine tu rostro.
              </p>
              <Link to="/booking" state={{ staffName: 'Marina' }} className="inline-flex bg-gray-900 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-base sm:text-lg font-medium hover:bg-gray-800 transition-colors">
                Reserva con Marina
              </Link>
            </div>
            
            {/* Mery */}
            <div className="flex flex-col items-center text-center bg-gray-50 rounded-2xl sm:rounded-[2rem] p-6 sm:p-8 hover:shadow-lg transition-shadow">
              <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full overflow-hidden mb-5 sm:mb-6 bg-white shadow-sm border-4 border-white">
                <img src="/Caricatura Mery.jpeg" alt="Mery" className="w-full h-full object-contain p-2 hover:scale-105 transition-transform duration-500" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Mery</h3>
              <p className="text-gray-500 text-sm sm:text-lg leading-relaxed mb-6">
                Experta en cortes de tendencia y peinados. Transforma cualquier idea en un estilo único y favorecedor que te encantará.
              </p>
              <Link to="/booking" state={{ staffName: 'Mery' }} className="inline-flex bg-gray-900 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-base sm:text-lg font-medium hover:bg-gray-800 transition-colors">
                Reserva con Mery
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIOS SECTION */}
      <section id="testimonios" className="py-12 sm:py-16 md:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4 text-gray-900">Lo que dicen de nosotras</h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-base sm:text-lg md:text-xl">
              Nuestra mayor recompensa es verte sonreír al mirarte al espejo.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              { name: "Lucía M.", text: "Marina consiguió exactamente el rubio que quería sin estropearme el pelo. El trato es increíble, te hacen sentir como en casa desde que entras.", role: "Clienta habitual" },
              { name: "Carmen G.", text: "Mery tiene unas manos maravillosas para el corte. Supo asesorarme súper bien y el resultado me encantó. Ya no cambio de peluquería.", role: "Primera visita" },
              { name: "Ana R.", text: "Fui para un peinado y maquillaje de invitada y fue todo un acierto. Los productos que usan son de primerísima calidad y aguanté perfecta todo el día.", role: "Clienta habitual" }
            ].map((review, i) => (
              <div key={i} className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 relative hover:shadow-md transition-shadow">
                <div className="flex text-orange-400 mb-3 text-base sm:text-lg">★★★★★</div>
                <p className="text-gray-600 mb-5 italic text-sm sm:text-base leading-relaxed">"{review.text}"</p>
                <div>
                  <h4 className="font-bold text-gray-900 text-base">{review.name}</h4>
                  <span className="text-xs sm:text-sm text-gray-500">{review.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4 text-gray-900">Preguntas Frecuentes</h2>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {[
              { q: "¿Con cuánta antelación debo pedir cita?", a: "Te recomendamos reservar con al menos 1-2 semanas de antelación si buscas una cita de tarde o en sábado, ya que son los tramos más solicitados." },
              { q: "¿Qué marca de productos utilizáis?", a: "Trabajamos exclusivamente con marcas profesionales premium que cuidan y protegen tu cabello, garantizando resultados duraderos sin dañar la fibra capilar." },
              { q: "¿Puedo cancelar o cambiar mi cita?", a: "¡Claro! Puedes gestionar tu reserva desde el enlace que te llega por email al reservar, o avisándonos por WhatsApp con al menos 24 horas de antelación." },
              { q: "¿Hacéis pruebas de novia?", a: "Sí, disponemos de packs especiales para novias que incluyen pruebas previas de peinado y maquillaje. Consúltanos para más información." }
            ].map((faq, i) => (
              <div key={i} className="bg-gray-50 p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-500 text-sm sm:text-base leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACTO SECTION */}
      <section id="contacto" className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-gray-900 text-white rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-10 md:p-16 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 sm:mb-6">¿Lista para tu cambio?</h2>
            <p className="text-gray-400 max-w-2xl mx-auto mb-8 sm:mb-10 text-base sm:text-lg md:text-xl">
              Estamos en pleno centro de la ciudad. Ven a visitarnos y descubre todo lo que podemos hacer por tu imagen.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-10 sm:mb-12 text-left">
              {/* Dónde estamos */}
              <div className="bg-gray-800/60 p-6 sm:p-8 rounded-2xl flex flex-col justify-between border border-gray-700/50">
                <div>
                  <div className="flex items-center gap-2 mb-4 text-primary">
                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                    <h3 className="font-semibold text-xl sm:text-2xl text-white">Dónde estamos</h3>
                  </div>
                  <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-4">
                    C/ Colombia, 3-local <br />
                    <span className="text-xs sm:text-sm text-gray-400">(entrada por C/ Veracruz, esquina con C/ Ecuador)</span><br />
                    14700 Palma del Río (Córdoba)
                  </p>
                </div>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=C%2F+Veracruz%2C+3%2C+14700+Palma+del+R%C3%ADo%2C+C%C3%B3rdoba"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-3 rounded-xl transition-all border border-white/10 text-xs sm:text-sm mt-3 w-full"
                >
                  <MapPin className="w-4 h-4 text-primary" />
                  Cómo llegar en Google Maps
                </a>
              </div>

              {/* Horario */}
              <div className="bg-gray-800/60 p-6 sm:p-8 rounded-2xl border border-gray-700/50">
                <div className="flex items-center gap-2 mb-4 text-primary">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                  <h3 className="font-semibold text-xl sm:text-2xl text-white">Horario</h3>
                </div>
                <ul className="text-gray-300 text-xs sm:text-sm md:text-base space-y-2.5 sm:space-y-3">
                  <li className="flex justify-between border-b border-gray-700/40 pb-2">
                    <span className="text-white font-medium">Lunes:</span>
                    <span className="text-gray-300">09:00 - 14:00</span>
                  </li>
                  <li className="flex justify-between border-b border-gray-700/40 pb-2">
                    <span className="text-white font-medium">Martes a Jueves:</span>
                    <span className="text-gray-300">09:00 - 19:00</span>
                  </li>
                  <li className="flex justify-between border-b border-gray-700/40 pb-2">
                    <span className="text-white font-medium">Viernes:</span>
                    <span className="text-gray-300">09:00 - 17:00</span>
                  </li>
                  <li className="flex justify-between border-b border-gray-700/40 pb-2">
                    <span className="text-white font-medium">Sábado:</span>
                    <span className="text-gray-300">09:00 - 14:00</span>
                  </li>
                  <li className="flex justify-between pt-1">
                    <span className="text-red-400 font-medium">Domingo:</span>
                    <span className="text-gray-400">Cerrado</span>
                  </li>
                </ul>
              </div>

              {/* Contacto */}
              <div className="bg-gray-800/60 p-6 sm:p-8 rounded-2xl flex flex-col justify-between border border-gray-700/50">
                <div>
                  <div className="flex items-center gap-2 mb-4 text-primary">
                    <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                    <h3 className="font-semibold text-xl sm:text-2xl text-white">Contacto</h3>
                  </div>
                  <div className="space-y-3 text-sm sm:text-base">
                    <div>
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Teléfono Fijo</span>
                      <a href="tel:957265442" className="text-white font-bold hover:text-primary transition flex items-center gap-2">
                        <Phone className="w-4 h-4 text-primary" /> 957 26 54 42
                      </a>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Móvil y WhatsApp</span>
                      <a 
                        href="https://wa.me/34639866179?text=Hola%20Ohana,%20me%20gustar%C3%ADa%20hacer%20una%20consulta" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-white font-bold hover:text-emerald-400 transition flex items-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-400" /> 639 86 61 79
                      </a>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Instagram</span>
                      <a 
                        href="https://instagram.com/ohanapeluqueria" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-white font-bold hover:text-pink-400 transition flex items-center gap-2"
                      >
                        <InstagramIcon className="w-4 h-4 text-pink-400" /> @ohanapeluqueria
                      </a>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Email</span>
                      <a href="mailto:ohana.palmadelrio@gmail.com" className="text-gray-300 text-xs sm:text-sm hover:underline">
                        ohana.palmadelrio@gmail.com
                      </a>
                    </div>
                  </div>
                </div>
                <a
                  href="https://wa.me/34639866179?text=Hola%20Ohana,%20me%20gustar%C3%ADa%20hacer%20una%20consulta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-3 rounded-xl transition-all text-xs sm:text-sm mt-5 w-full shadow-lg shadow-emerald-900/40"
                >
                  <MessageCircle className="w-4 h-4" />
                  Escribir por WhatsApp
                </a>
              </div>
            </div>

            <Link
              to="/booking"
              className="bg-primary text-primary-foreground px-8 sm:px-10 py-3.5 sm:py-5 rounded-full text-base sm:text-xl md:text-2xl font-medium hover:bg-teal-400 transition-colors inline-block w-full sm:w-auto"
            >
              Reservar mi cita ahora
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-8 sm:py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-center sm:text-left">
            <img src="/logo.png" alt="Ohana" className="h-10 w-auto opacity-70 grayscale hover:grayscale-0 transition" />
            <div className="text-xs text-gray-500">
              <p className="font-semibold text-gray-700">Ohana Peluquería y Estética</p>
              <p>C/ Colombia, 3 · 14700 Palma del Río (Córdoba)</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-500">
            <a href="tel:957265442" className="hover:text-primary transition flex items-center gap-1.5 font-medium">
              <Phone className="w-3.5 h-3.5 text-primary" /> 957 26 54 42
            </a>
            <a 
              href="https://wa.me/34639866179?text=Hola%20Ohana,%20me%20gustar%C3%ADa%20hacer%20una%20consulta" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-emerald-600 transition flex items-center gap-1.5 font-medium"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> 639 86 61 79
            </a>
            <a 
              href="https://instagram.com/ohanapeluqueria" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-pink-600 transition flex items-center gap-1.5 font-medium"
            >
              <InstagramIcon className="w-3.5 h-3.5 text-pink-600" /> @ohanapeluqueria
            </a>
          </div>
          <p className="text-[11px] sm:text-xs text-gray-400 text-center md:text-right">
            © {new Date().getFullYear()} Ohana. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      {/* BOTÓN FLOTANTE DE WHATSAPP */}
      <aside aria-label="Contacto por WhatsApp" className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
        <a
          href="https://wa.me/34639866179?text=Hola%20Ohana,%20me%20gustar%C3%ADa%20hacer%20una%20consulta"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2.5 sm:gap-3 bg-emerald-500 hover:bg-emerald-600 text-white pl-3.5 pr-4 sm:pl-4 sm:pr-5 py-2.5 sm:py-3 rounded-full shadow-2xl hover:shadow-emerald-500/40 transition-all transform hover:-translate-y-1"
          aria-label="Contactar por WhatsApp"
        >
          <div className="relative">
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-white"></span>
            </span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[9px] sm:text-[10px] font-medium leading-none text-emerald-100">¿Tienes dudas?</span>
            <span className="text-xs sm:text-sm font-bold leading-tight">Escríbenos</span>
          </div>
        </a>
      </aside>

    </div>
  );
}
