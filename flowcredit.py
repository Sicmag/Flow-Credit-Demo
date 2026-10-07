"""
FlowCredit Digital - Prototipo completo
Motor de decisión crediticia con IA para emprendedores digitales.

Incluye: Dashboard, Verificación KYC simulada, Solicitud de crédito,
Historial, Reconocimiento facial demo, Código de recuperación.

Prototipo demostrativo. No procesa dinero real.
Proyecto SENA 2026.
"""

import random
import time
from datetime import datetime, timedelta

import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st
from supabase import create_client


# ============ CONFIGURACIÓN DE PÁGINA ============

st.set_page_config(
    page_title="FlowCredit Digital",
    page_icon="💳",
    layout="wide",
)


# ============ CSS PERSONALIZADO ============

st.markdown("""
<style>
    .main-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
        padding: 2rem;
        border-radius: 16px;
        color: white;
        margin-bottom: 1.5rem;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    }
    .main-header h1 {
        color: white;
        margin: 0;
        font-size: 2.2rem;
        font-weight: 800;
        letter-spacing: -0.5px;
    }
    .main-header p {
        color: #94a3b8;
        margin: 0.5rem 0 0 0;
        font-size: 1rem;
    }

    .metric-card {
        background: white;
        border-radius: 14px;
        padding: 1.5rem;
        box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        border: 1px solid #e2e8f0;
        height: 100%;
    }
    .metric-label {
        color: #64748b;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 600;
        margin-bottom: 0.4rem;
    }
    .metric-value {
        font-size: 1.9rem;
        font-weight: 800;
        color: #0f172a;
        margin: 0;
        line-height: 1.1;
    }
    .metric-sub {
        color: #10b981;
        font-size: 0.85rem;
        font-weight: 600;
        margin-top: 0.3rem;
    }

    .decision-aprobado {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 2rem;
        border-radius: 16px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(16,185,129,0.3);
    }
    .decision-rechazado {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        padding: 2rem;
        border-radius: 16px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(239,68,68,0.3);
    }
    .decision-revision {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        padding: 2rem;
        border-radius: 16px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(245,158,11,0.3);
    }
    .decision-aprobado h1,
    .decision-rechazado h1,
    .decision-revision h1 {
        color: white;
        font-size: 2.5rem;
        margin: 0;
    }
    .decision-aprobado p,
    .decision-rechazado p,
    .decision-revision p {
        color: rgba(255,255,255,0.9);
        margin: 0.5rem 0 0 0;
        font-size: 1.05rem;
    }

    .stButton > button {
        border-radius: 10px;
        font-weight: 700;
        padding: 0.6rem 1.2rem;
    }
</style>
""", unsafe_allow_html=True)


# ============ CLAVES ============

def _leer_clave(nombre):
    try:
        return st.secrets[nombre]
    except Exception:
        pass
    try:
        import config
        return getattr(config, nombre)
    except Exception:
        return None


GEMINI_API_KEY = _leer_clave("GEMINI_API_KEY")
GROQ_API_KEY = _leer_clave("GROQ_API_KEY")
SUPABASE_URL = _leer_clave("SUPABASE_URL")
SUPABASE_KEY = _leer_clave("SUPABASE_KEY")

if not GEMINI_API_KEY and not GROQ_API_KEY:
    st.error("⚠️ Falta configurar GEMINI_API_KEY o GROQ_API_KEY.")
    st.stop()

if not SUPABASE_URL or not SUPABASE_KEY:
    st.error("⚠️ Falta configurar Supabase.")
    st.stop()


# ============ SUPABASE ============

def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


supabase_client = get_supabase()


def restaurar_sesion():
    if st.session_state.get("access_token") and st.session_state.get("refresh_token"):
        try:
            supabase_client.auth.set_session(
                st.session_state["access_token"],
                st.session_state["refresh_token"],
            )
        except Exception:
            pass


restaurar_sesion()


# ============ CONFIGURACIÓN IA ============

MODELO_GEMINI = "gemini-3.8-flash"
MODELO_GROQ = "qwen/qwen3.8-27b"

URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/" + MODELO_GEMINI + ":generateContent"
URL_GROQ = "https://api.groq.com/openai/v1/chat/completions"


PROMPT_SCORING = """Eres un analista de riesgo crediticio. Analiza esta solicitud
de microcredito para un emprendedor digital colombiano.

DATOS DEL SOLICITANTE:
- Tipo de negocio: {tipo}
- Ingresos mensuales promedio: {ingresos} COP
- Meses con el negocio: {meses}
- Monto solicitado: {monto} COP
- Plazo: {plazo} dias
- Historial de pagos previos: {historial}
- Fuentes digitales conectadas: {fuentes}

Tu tarea:
1. Asignar un score crediticio de 0 a 1000
2. Decidir: APROBADO, REVISION o RECHAZADO
3. Definir monto aprobado (entre 0 y el solicitado)
4. Sugerir tasa anual
5. Explicar la decision en 3 razones cortas

Responde SOLO con este formato, sin markdown:

SCORE: <numero 0-1000>
DECISION: <APROBADO | REVISION | RECHAZADO>
MONTO_APROBADO: <numero>
TASA_ANUAL: <numero>
RAZON_1: <texto corto>
RAZON_2: <texto corto>
RAZON_3: <texto corto>

REGLAS CRITICAS DE COHERENCIA:
- Si DECISION es RECHAZADO: MONTO_APROBADO = 0 y TASA_ANUAL = 0
- Si DECISION es REVISION: MONTO_APROBADO maximo 1x ingresos, TASA 18-22%
- Si DECISION es APROBADO: MONTO entre 1x y 5x ingresos, TASA 8-16%
- El MONTO_APROBADO nunca puede exceder el monto solicitado
- El score debe coincidir: rechazado menor a 500, revision 500-700, aprobado mayor a 700
- Las razones deben justificar el score y la decision

CRITERIOS DE EVALUACION:
- Menos de 6 meses de negocio: REVISION o RECHAZADO
- Sin historial y sin fuentes digitales: REVISION
- Monto solicitado mayor a 3x ingresos: reducir aprobado o REVISION
- Ingresos verificables + 12+ meses + historial: APROBADO
"""


# ============ MOTOR IA ============

def _groq(prompt):
    headers = {"Authorization": "Bearer " + GROQ_API_KEY}
    payload = {
        "model": MODELO_GROQ,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 500,
    }
    r = requests.post(URL_GROQ, headers=headers, json=payload, timeout=60)
    if r.status_code != 200:
        raise RuntimeError("Groq " + str(r.status_code))
    return r.json()["choices"][0]["message"]["content"]


def _gemini(prompt):
    url = URL_GEMINI + "?key=" + GEMINI_API_KEY
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    r = requests.post(url, json=payload, timeout=60)
    if r.status_code != 200:
        raise RuntimeError("Gemini " + str(r.status_code))
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


def analizar_con_ia(datos):
    prompt = PROMPT_SCORING.format(**datos)
    errores = []

    for intento in range(2):
        try:
            return _groq(prompt)
        except Exception as e:
            errores.append("Groq intento " + str(intento + 1) + ": " + str(e))
            if intento == 0:
                time.sleep(3)

    for intento in range(2):
        try:
            return _gemini(prompt)
        except Exception as e:
            errores.append("Gemini intento " + str(intento + 1) + ": " + str(e))
            if intento == 0:
                time.sleep(5)

    raise RuntimeError(" | ".join(errores))


def parsear_respuesta(texto, ingresos=0):
    resultado = {
        "score": 0,
        "decision": "REVISION",
        "monto_aprobado": 0,
        "tasa_anual": 18.0,
        "razones": [],
    }
    for linea in texto.split("\n"):
        l = linea.strip()
        up = l.upper()
        if up.startswith("SCORE:"):
            try:
                resultado["score"] = int(l.split(":", 1)[1].strip())
            except Exception:
                pass
        elif up.startswith("DECISION:"):
            val = l.split(":", 1)[1].strip().upper()
            if val in ("APROBADO", "REVISION", "RECHAZADO"):
                resultado["decision"] = val
        elif up.startswith("MONTO_APROBADO:"):
            try:
                resultado["monto_aprobado"] = float(l.split(":", 1)[1].strip())
            except Exception:
                pass
        elif up.startswith("TASA_ANUAL:"):
            try:
                resultado["tasa_anual"] = float(l.split(":", 1)[1].strip())
            except Exception:
                pass
        elif up.startswith("RAZON_"):
            razon = l.split(":", 1)[1].strip()
            if razon:
                resultado["razones"].append(razon)

    # Coherencia forzada
    if resultado["decision"] == "RECHAZADO":
        resultado["monto_aprobado"] = 0
        resultado["tasa_anual"] = 0
    elif resultado["decision"] == "REVISION":
        if ingresos > 0 and resultado["monto_aprobado"] > ingresos:
            resultado["monto_aprobado"] = ingresos
        if resultado["tasa_anual"] < 18:
            resultado["tasa_anual"] = 18.0
    elif resultado["decision"] == "APROBADO":
        if ingresos > 0 and resultado["monto_aprobado"] > ingresos * 5:
            resultado["monto_aprobado"] = ingresos * 5

    return resultado


# ============ DATOS SIMULADOS ============

def generar_flujo_caja(meses=12, base=3000000):
    hoy = datetime.now()
    datos = []
    for i in range(meses):
        fecha = hoy - timedelta(days=30 * (meses - i - 1))
        tendencia = 1 + (i * 0.04)
        variacion = random.uniform(0.7, 1.3)
        ingresos = int(base * tendencia * variacion)
        egresos = int(ingresos * random.uniform(0.55, 0.8))
        datos.append({
            "mes": fecha.strftime("%b"),
            "ingresos": ingresos,
            "egresos": egresos,
        })
    return pd.DataFrame(datos)


# ============ BD: SOLICITUDES ============

def guardar_solicitud(uid, datos, resultado):
    restaurar_sesion()
    try:
        supabase_client.table("solicitudes").insert({
            "user_id": uid,
            "monto_solicitado": float(datos["monto"]),
            "plazo_dias": int(datos["plazo"]),
            "tipo_negocio": datos["tipo"],
            "ingresos_mensuales": float(datos["ingresos"]),
            "score": resultado["score"],
            "decision": resultado["decision"],
            "monto_aprobado": resultado["monto_aprobado"],
            "tasa_sugerida": resultado["tasa_anual"],
            "razones": " | ".join(resultado["razones"]),
        }).execute()
        return True
    except Exception:
        return False


def obtener_solicitudes(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("solicitudes") \
            .select("*").eq("user_id", uid) \
            .order("created_at", desc=True).execute()
        return r.data or []
    except Exception:
        return []


# ============ BD: CLIENTES DEMO ============

def obtener_cliente_demo(email):
    restaurar_sesion()
    try:
        r = supabase_client.table("clientes_demo") \
            .select("*").eq("email", email).execute()
        return r.data[0] if r.data else None
    except Exception:
        return None


# ============ BD: CÓDIGO DE RECUPERACIÓN ============

def generar_codigo_recuperacion():
    import string
    chars = string.ascii_uppercase + string.digits
    bloques = []
    for _ in range(6):
        bloque = "".join(random.choices(chars, k=4))
        bloques.append(bloque)
    return "-".join(bloques)


def guardar_codigo_recuperacion(uid):
    restaurar_sesion()
    codigo = generar_codigo_recuperacion()
    try:
        supabase_client.table("profiles").update({
            "recovery_code": codigo,
            "recovery_generated_at": datetime.now().isoformat(),
            "verificado": True,
        }).eq("id", uid).execute()
        return codigo
    except Exception:
        return None


def obtener_codigo_recuperacion(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("profiles") \
            .select("recovery_code, verificado") \
            .eq("id", uid).execute()
        return r.data[0] if r.data else None
    except Exception:
        return None


# ============ ESTADO ============

if "user" not in st.session_state:
    st.session_state["user"] = None
if "resultado_actual" not in st.session_state:
    st.session_state["resultado_actual"] = None
if "datos_actuales" not in st.session_state:
    st.session_state["datos_actuales"] = None


# ============ LOGIN ============

if st.session_state["user"] is None:
    st.markdown("""
    <div class="main-header">
        <h1>💳 FlowCredit Digital</h1>
        <p>Solución financiera innovadora para emprendedores digitales</p>
    </div>
    """, unsafe_allow_html=True)

    tab1, tab2 = st.tabs(["🔐 Iniciar sesión", "✨ Crear cuenta"])

    with tab1:
        with st.form("login"):
            email = st.text_input("Correo")
            pwd = st.text_input("Contraseña", type="password")
            ok = st.form_submit_button("Iniciar sesión", use_container_width=True)
        if ok:
            try:
                resp = supabase_client.auth.sign_in_with_password(
                    {"email": email, "password": pwd}
                )
                if resp.user:
                    st.session_state["user"] = {
                        "id": resp.user.id,
                        "email": resp.user.email,
                    }
                    st.session_state["access_token"] = resp.session.access_token
                    st.session_state["refresh_token"] = resp.session.refresh_token
                    st.rerun()
            except Exception as e:
                st.error("Error: " + str(e))

    with tab2:
        st.caption("Mínimo 8 caracteres con mayúscula, minúscula, número y un símbolo.")
        st.info("💡 Correos demo disponibles: carlosandres3341@gmail.com, jesusviloria@gmail.com, juan@test.com")
        with st.form("registro"):
            email_r = st.text_input("Correo", key="r_email")
            pwd_r = st.text_input("Contraseña", type="password", key="r_pwd")
            pwd_r2 = st.text_input("Repite contraseña", type="password", key="r_pwd2")
            ok_r = st.form_submit_button("Crear cuenta", use_container_width=True)
        if ok_r:
            if pwd_r != pwd_r2:
                st.error("Las contraseñas no coinciden.")
            elif len(pwd_r) < 8:
                st.error("Mínimo 8 caracteres.")
            else:
                try:
                    supabase_client.auth.sign_up({"email": email_r, "password": pwd_r})
                    st.success("✅ Cuenta creada. Revisa tu correo para confirmar.")
                except Exception as e:
                    st.error("Error: " + str(e))
    st.stop()


# ============ APP PRINCIPAL ============

uid = st.session_state["user"]["id"]
email = st.session_state["user"]["email"]
nombre = email.split("@")[0] if email else "Emprendedor"


with st.sidebar:
    st.markdown("### 👤 " + nombre)
    st.caption(email)
    st.divider()

    menu = st.radio(
        "Menú",
        [
            "📊 Dashboard",
            "🛡️ Verificación",
            "💳 Solicitar crédito",
            "📋 Historial",
        ],
        label_visibility="collapsed",
    )

    st.divider()
    if st.button("🚪 Cerrar sesión", use_container_width=True):
        try:
            supabase_client.auth.sign_out()
        except Exception:
            pass
        for k in ["user", "access_token", "refresh_token", "resultado_actual", "datos_actuales"]:
            st.session_state.pop(k, None)
        st.rerun()


# ============ DASHBOARD ============

if menu == "📊 Dashboard":
    st.markdown("""
    <div class="main-header">
        <h1>📊 Dashboard</h1>
        <p>Vista general de tu línea de crédito digital</p>
    </div>
    """, unsafe_allow_html=True)

    solicitudes = obtener_solicitudes(uid)

    linea_disponible = 2500000
    score_actual = 742
    if solicitudes:
        aprobadas = [s for s in solicitudes if s.get("decision") == "APROBADO"]
        if aprobadas:
            score_actual = aprobadas[0]["score"]
            linea_disponible = int(aprobadas[0]["monto_aprobado"])

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.markdown(f"""
        <div class="metric-card">
            <p class="metric-label">Línea disponible</p>
            <p class="metric-value">${linea_disponible:,}</p>
            <p class="metric-sub">↑ Actualizable</p>
        </div>
        """.replace(",", "."), unsafe_allow_html=True)

    with col2:
        st.markdown(f"""
        <div class="metric-card">
            <p class="metric-label">Score crediticio</p>
            <p class="metric-value">{score_actual}/1000</p>
            <p class="metric-sub">Buen perfil</p>
        </div>
        """, unsafe_allow_html=True)

    with col3:
        st.markdown(f"""
        <div class="metric-card">
            <p class="metric-label">Solicitudes</p>
            <p class="metric-value">{len(solicitudes)}</p>
            <p class="metric-sub">Historial total</p>
        </div>
        """, unsafe_allow_html=True)

    with col4:
        activas = sum(1 for s in solicitudes if s.get("decision") == "APROBADO")
        st.markdown(f"""
        <div class="metric-card">
            <p class="metric-label">Créditos activos</p>
            <p class="metric-value">{activas}</p>
            <p class="metric-sub">Vigentes</p>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    st.subheader("📈 Flujo de caja últimos 12 meses")
    df = generar_flujo_caja(12, base=3000000)

    fig = go.Figure()
    fig.add_trace(go.Bar(x=df["mes"], y=df["ingresos"], name="Ingresos", marker_color="#10b981"))
    fig.add_trace(go.Bar(x=df["mes"], y=df["egresos"], name="Egresos", marker_color="#ef4444"))
    fig.update_layout(
        barmode="group",
        plot_bgcolor="white",
        paper_bgcolor="white",
        height=380,
        margin=dict(l=10, r=10, t=30, b=10),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, x=0),
        xaxis=dict(tickfont=dict(size=10)),
    )
    fig.update_yaxes(tickformat=",.0f", rangemode="tozero", tickfont=dict(size=10), gridcolor="#e2e8f0")
    fig.update_xaxes(gridcolor="#f1f5f9")
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("🔗 Fuentes digitales conectadas")
    col_a, col_b, col_c, col_d = st.columns(4)

    fuentes = [
        ("💳 Stripe", "Conectado", "#10b981"),
        ("🟣 Nequi", "Conectado", "#10b981"),
        ("🔵 PayPal", "Conectado", "#10b981"),
        ("🟢 Daviplata", "Pendiente", "#f59e0b"),
    ]
    for col, (nombre_f, estado, color) in zip([col_a, col_b, col_c, col_d], fuentes):
        with col:
            st.markdown(f"""
            <div class="metric-card" style="text-align:center;">
                <p style="font-size:1.8rem;margin:0;">{nombre_f.split()[0]}</p>
                <p style="font-weight:700;margin:0.5rem 0 0 0;">{nombre_f.split()[1]}</p>
                <p style="color:{color};font-size:0.85rem;font-weight:600;margin:0.3rem 0 0 0;">{estado}</p>
            </div>
            """, unsafe_allow_html=True)


# ============ VERIFICACIÓN ============

elif menu == "🛡️ Verificación":
    st.markdown("""
    <div class="main-header">
        <h1>🛡️ Verificación de identidad</h1>
        <p>Consulta tus datos verificados en bases oficiales</p>
    </div>
    """, unsafe_allow_html=True)

    cliente = obtener_cliente_demo(email)

    if not cliente:
        st.warning(
            "No se encontraron datos verificados para tu correo. "
            "Esta es una demo. Prueba con alguno de estos correos:"
        )
        st.code(
            "carl
