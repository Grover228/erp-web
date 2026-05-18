import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jjwmaibsqdaofilxuvaw.supabase.co";
const supabaseKey = "sb_publishable_QjURA4bOa7N1REuEQyIXhg_n-5vdqs3";

export const supabase = createClient(supabaseUrl, supabaseKey);