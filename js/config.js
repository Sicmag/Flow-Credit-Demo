// config.js
// Configuracion central de NexusPay

const CONFIG = {
  // ============ SUPABASE ============
  SUPABASE_URL: "https://qoyfgxqsswlzpiriidwy.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFveWZneHFzc3dsenBpcmlpZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzUzMTIsImV4cCI6MjEwNjkxMTMxMn0.Ml2Qpfd3ct6du_QdV5CfSFvHCAuIil0xo8r84wEPHiw",

  // ============ API KEYS ============
  GEMINI_API_KEY: "AQ.Ab8RN6JmubjqgApHOaHJfmSz4x13IdgG7keieh7mJ3D4m_MmfA",
  GROQ_API_KEY: "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",

  // ============ MODELOS (nombres validos) ============
  MODELO_GEMINI: "gemini-1.5-flash",
  MODELO_GROQ: "llama-3.3-70b-versatile",

  // ============ URLs ============
  URL_GEMINI: "https://generativelanguage.googleapis.com/v1beta/models/",
  URL_GROQ: "https://api.groq.com/openai/v1/chat/completions",

  // ============ ASISTENTE ============
  ASISTENTE_NOMBRE: "Luci",
  ASISTENTE_ROL: "Asistente virtual de NexusPay",
  ASISTENTE_AVATAR: "💜",
  ASISTENTE_SALUDO: "Hola! Soy Luci, tu asistente de NexusPay. ¿En qué te ayudo hoy?",
};
