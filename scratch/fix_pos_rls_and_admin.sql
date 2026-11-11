-- 1. Confirmar el usuario admin demo para que Supabase emita sesión autenticada
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'admin@ohana.com';

-- 2. Permitir operaciones de cobro en TPV (sales y sale_items) igual que en el resto de tablas del CRM
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sales' AND policyname = 'Allow all access to sales'
  ) THEN
    CREATE POLICY "Allow all access to sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sale_items' AND policyname = 'Allow all access to sale_items'
  ) THEN
    CREATE POLICY "Allow all access to sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
