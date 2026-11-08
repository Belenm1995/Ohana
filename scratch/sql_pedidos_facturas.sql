-- 1. TABLA DE PEDIDOS A PROVEEDOR
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number text NOT NULL,
  supplier_name text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'partial', 'cancelled')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_estimated decimal(10,2) DEFAULT 0,
  notes text,
  albaran_number text,
  received_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'Allow all access to purchase_orders'
  ) THEN
    CREATE POLICY "Allow all access to purchase_orders" ON public.purchase_orders FOR ALL USING (true);
  END IF;
END $$;

-- 2. TABLA DE FACTURAS Y GASTOS DE PROVEEDORES
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number text NOT NULL,
  supplier_name text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'Productos y Cosmética (Inventario)',
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  base_amount decimal(10,2) NOT NULL DEFAULT 0,
  tax_rate decimal(5,2) NOT NULL DEFAULT 21,
  tax_amount decimal(10,2) NOT NULL DEFAULT 0,
  total_amount decimal(10,2) NOT NULL DEFAULT 0,
  irpf_rate decimal(5,2) DEFAULT 0,
  irpf_amount decimal(10,2) DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'transfer' CHECK (payment_method IN ('cash', 'card', 'transfer', 'direct_debit', 'promissory_note')),
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending')),
  notes text,
  order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  albaran_number text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoices' AND policyname = 'Allow all access to supplier_invoices'
  ) THEN
    CREATE POLICY "Allow all access to supplier_invoices" ON public.supplier_invoices FOR ALL USING (true);
  END IF;
END $$;

-- 3. ACTUALIZACIÓN DE FORMAS DE PAGO (EJECUTAR PARA AÑADIR 'PAGARÉ')
ALTER TABLE supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_payment_method_check;
ALTER TABLE supplier_invoices ADD CONSTRAINT supplier_invoices_payment_method_check 
  CHECK (payment_method IN ('cash', 'card', 'transfer', 'direct_debit', 'promissory_note'));
