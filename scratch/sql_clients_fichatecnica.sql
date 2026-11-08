-- ========================================================
-- OHANA PELUQUERÍA Y ESTÉTICA - FICHA TÉCNICA Y DIAGNÓSTICO
-- Ejecutar en Supabase -> SQL Editor si deseas columnas nativas
-- ========================================================

-- 1. Añadir columnas de diagnóstico capilar, estética y alertas médicas a clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS allergies TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hair_type TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS scalp_type TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gray_percentage TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hair_condition TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS skin_type TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS patch_test_date TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS patch_test_result TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_stylist TEXT DEFAULT NULL;

-- 2. Asegurar que las políticas de seguridad permitan lectura y edición
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes DISABLE ROW LEVEL SECURITY;

-- 3. Crear bucket para fotos de antes/después si no existe (opcional)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client_media', 'client_media', true)
ON CONFLICT (id) DO NOTHING;
