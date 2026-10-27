-- Supabase default function privileges explicitly grant EXECUTE to anon.
-- The posting RPC is for signed-in ERP staff only.
REVOKE ALL ON FUNCTION public.post_supplier_receipt_safe(uuid) FROM anon;
