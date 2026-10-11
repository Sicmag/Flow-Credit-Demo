
// config.js
// Claves publicas. La seguridad real esta en las RLS de Supabase.

const CONFIG = {
  SUPABASE_URL: "https://kvtrpdjqqciieljsguerp.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFveWZneHFzc3dsenBpcmlpZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzUzMTIsImV4cCI6MjEwNjkxMTMxMn0.Ml2Qpfd3ct6du_QdV5CfSFvHCAuIil0xo8r84wEPHiw",

  GEMINI_API_KEY: "PEGA_AQUI_TU_GEMINI_KEY",
  GROQ_API_KEY: "PEGA_AQUI_TU_GROQ_KEY",

  MODELO_GEMINI: "gemini-3.8-flash",
  MODELO_GROQ: "qwen/qwen3.8-27b",

  URL_GEMINI: "https://generativelanguage.googleapis.com/v1beta/models/",
  URL_GROQ: "https://api.groq.com/openai/v1/chat/completions",
};
