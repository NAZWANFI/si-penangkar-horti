// Konfigurasi Supabase SI PENANGKAR HORTI
// Publishable key aman digunakan di aplikasi client selama RLS aktif.
const SUPABASE_URL = "https://yrnvvgwxpraodrbldahr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dJQOZRSz3m6iu3aUTqA4Pw_AP3uWX70";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
