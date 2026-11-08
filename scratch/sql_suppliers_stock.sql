-- SPRINT: CONTROL AVANZADO DE STOCK, PROVEEDORES Y CIERRES DE CAJA

-- 1. Ampliar campos de la tabla products
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS cost_price decimal(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS barcode text;

-- 2. Tabla de Proveedores (Agenda comercial y pedidos)
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to suppliers" ON public.suppliers FOR ALL USING (true);

-- 3. Tabla cash_closures: habilitar acceso completo (incluyendo borrado y reapertura)
ALTER TABLE cash_closures DISABLE ROW LEVEL SECURITY;
