const SUPABASE_URL = "https://rkwkcszbsyehwlchmtku.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_NWBJ9Z-Wt3w6sqt4DZMM8g_4oNst3oQ";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

console.log("Supabase client initialized successfully!");