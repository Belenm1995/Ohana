const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const sql = `
-- SPRINT 14: TARJETAS REGALO
CREATE TABLE IF NOT EXISTS gift_cards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  sender_name text NOT NULL,
  recipient_name text NOT NULL,
  message text,
  type text NOT NULL CHECK (type IN ('amount', 'service', 'product')),
  amount_initial decimal(10,2),
  amount_remaining decimal(10,2),
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('pending_payment', 'active', 'redeemed', 'expired')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  expires_at timestamp with time zone
);

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to gift_cards" ON public.gift_cards FOR ALL USING (true);
`;

async function execute() {
  const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.log("No rpc 'exec_sql' found or error:", error.message);
    console.log("We need to insert via REST or create it in UI.");
  } else {
    console.log("Success");
  }
}

execute();
