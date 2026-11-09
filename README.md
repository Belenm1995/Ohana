# Ohana Salón · Sistema Integral de Gestión (SaaS / ERP)

![React](https://img.shields.io/badge/React-18-blue?logo=react)
![Vite](https://img.shields.io/badge/Vite-8.2-purple?logo=vite)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)
![Compliance](https://img.shields.io/badge/Fiscal-VeriFactu%20Ready-green)

Aplicación web integral para la digitalización y gestión operativa completa de salones de peluquería y estética. Desarrollada con un stack moderno, modular y reactivo para cubrir desde la captación online de clientes hasta el cierre fiscal de caja y facturación simplificada.

---

## 🚀 Acceso a la Demostración en Vivo (Evaluadores / CV)

La plataforma cuenta con dos entornos totalmente diferenciados para garantizar la privacidad operativa:

1. **🌐 Web Pública de Clientes (`/`):** https://ohana-phi.vercel.app/
   - Página principal orientada al cliente final (carta de servicios, información del salón, galería y reserva de citas online).
   - Por diseño comercial y privacidad, **no muestra accesos visibles al software de gestión**.
   
2. **🔐 Panel de Gestión Interna / CRM (`/crm`):**
   - Módulo privado para las especialistas y dirección del salón (Agenda semanal con Drag & Drop, Fichas técnicas capilares, TPV, Facturación VeriFactu, Caja y Stock).

### 🔑 Credenciales para probar el CRM:
Para acceder a la demostración interactiva (tanto en la web desplegada en Vercel como en local):
- **Enlace de acceso:** Añade `/crm` al final de la dirección web (https://ohana-phi.vercel.app/crm o https://ohana-phi.vercel.app/login).
- **Usuario:** `admin`
- **Contraseña:** `admin`
- *(En la propia pantalla de inicio de sesión dispones además de un botón de **Autocompletar** para acceder en 1 solo clic).*

---

## 🌟 Módulos y Funcionalidades Principales

### 1. 📅 Agenda Interactiva y Planificación de Citas
- **Vistas Diaria y Semanal:** Visualización en columnas por especialista o por días de la semana.
- **Drag & Drop Inteligente:** Reorganización de citas arrastrando y soltando entre diferentes horas y días.
- **Reprogramación Rápida:** Modal para cambiar día, hora y especialista con botones de salto rápido (`-1 día`, `+1 día`, `+1 semana`).
- **Estados de Cita:** Confirmada, en curso, completada, cancelada o no presentado.

### 2. 🌐 Portal de Reservas Online (`/booking`)
- **Flujo de Reserva Paso a Paso:** Selección de servicios, duración calculada dinámicamente y cálculo de disponibilidad horaria en tiempo real.
- **Consentimientos RGPD Inteligentes:** Si un cliente recurrente ya aceptó las cláusulas de comunicaciones de marketing o imágenes en visitas previas, el sistema solo le muestra la política de privacidad obligatoria, reduciendo la fricción de reserva.
- **Barra de Resumen Flotante:** Seguimiento en vivo de servicios seleccionados, tiempo estimado e importe total.

### 3. 👥 Clientes, Fichas Técnicas y Colorimetría
- **Diagnóstico Capilar Completo:** Registro estructurado de tipo de cabello, grosor, porosidad, % de canas, estado del cuero cabelludo y test de parche.
- **Historial de Fórmulas de Coloración:** Desglose técnico por zonas (Raíz, Medios/Puntas, Decoloración, Matiz/Toner, Tiempos) con botón de 1 clic para reutilizar fórmulas anteriores.
- **Alertas de Alergias:** Detección visual prioritaria (PPD, amoníacos, etc.) para evitar incidentes en cabina.
- **Exportación en PDF:** Generación automática de ficha técnica lista para imprimir o archivar.

### 4. 💳 TPV (Punto de Venta) y Facturación VeriFactu
- **Cobro Rápido:** Carga automática de citas del día con desglose de servicios y profesional asignado.
- **Venta Cruzada:** Venta simultánea de servicios y productos de cosmética con actualización instantánea de stock.
- **Métodos de Pago:** Efectivo (con calculadora de cambio), Tarjeta de crédito y Bizum.
- **Cumplimiento Fiscal VeriFactu:** Generación de números de ticket correlativos y encadenamiento mediante hash SHA-256 (Web Crypto API).
- **Impresión Térmica:** Formato de ticket optimizado para impresoras térmicas de 80mm con desglose de IVA (21%) y variante de Ticket Regalo sin importes.

### 5. 💰 Arqueo Diario y Control de Caja
- **Monitor en Vivo:** Facturación diaria desglosada por efectivo, tarjeta y Bizum.
- **Movimientos de Efectivo:** Control de fondo inicial y gastos menores del día.
- **Cierre y Arqueo:** Calculadora rápida por desglose de monedas y billetes, con detección de descuadres (sobrantes o faltantes).
- **Exportación para Gestoría:** Informes mensuales en PDF y Excel.

### 6. 📦 Inventario, Proveedores y Consumo Interno
- **Precios Dobles:** Control de PVP y Precio de Coste para cálculo de margen comercial.
- **Stock y Alertas:** Avisos visuales en tiempo real para productos por debajo del stock mínimo.
- **Gasto de Cabina / Lavacabezas:** Registro de consumo interno para descontar producto utilizado en tratamientos sin imputarlo como venta.
- **Pedidos a Proveedores:** Generación automática de albaranes y pedidos de reposición.

### 7. 🧾 Gastos y Facturas a Proveedores
- **Gestión de Facturas Recibidas:** Categorización (Alquiler, Suministros, Cosmética, Nóminas, etc.).
- **Desglose Contable:** Cálculo de Base Imponible, IVA Soportado (21%, 10%) y retenciones de IRPF.
- **Filtros Fiscales:** Consulta por trimestres fiscales (1T, 2T, 3T, 4T) para facilitar la liquidación del Modelo 303.

### 8. 🎁 Fidelización, Tarjetas Regalo y Marketing
- **Club de Puntos:** Acumulación automática por cada euro gastado y canje de descuentos en el TPV.
- **Tarjetas Regalo (`/gift`):** Venta pública de cheques regalo con código alfanumérico canjeable en el salón.
- **Automatizaciones y WhatsApp:** Recordatorios automáticos de citas y felicitaciones de cumpleaños.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 18, React Router v6
- **Build Tool:** Vite 8.2
- **Estilos:** Tailwind CSS 3.4, Lucide Icons, clsx / tailwind-merge
- **Backend / Database:** Supabase (PostgreSQL, Row Level Security, Auth, Storage)
- **Generación Documental:** jsPDF, jspdf-autotable
- **Gráficas y Métricas:** Recharts
- **Seguridad Fiscal:** Criptografía en cliente mediante SHA-256 Web Crypto API para VeriFactu

---

## 🚀 Puesta en Marcha en Local

### Prerrequisitos
- Node.js (v18 o superior)
- Cuenta o proyecto en [Supabase](https://supabase.com)

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/ohana-salon.git
cd ohana-salon
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env.local` a partir de `.env.example`:
```bash
cp .env.example .env.local
```
Rellena las claves con los datos de tu proyecto de Supabase:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-publica-anon
```

### 4. Iniciar el servidor de desarrollo
```bash
npm run dev
```
- Web pública de clientes: `http://localhost:5173/` (o https://ohana-phi.vercel.app/)
- Panel CRM de equipo: `http://localhost:5173/crm` (o https://ohana-phi.vercel.app/crm) *(Usuario: `admin` / Clave: `admin`)*

### 5. Compilar para producción
```bash
npm run build
```

---

## 📄 Licencia

Este proyecto es de uso privado desarrollado a medida para Ohana Salón.
