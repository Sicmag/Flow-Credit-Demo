"""
FlowCredit Digital - Prototipo
Motor de decisión crediticia con IA para emprendedores digitales.

Prototipo demostrativo. No procesa dinero real.
Proyecto SENA 2026.
"""

import random
from datetime import datetime, timedelta

import pandas as pd
import plotly.express as px
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


# ============ IA ============

MODELO_GEMINI = "gemini-3.8-flash"
MODELO_GROQ = "qwen/qwen3.8-27b"

URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/" + MODELO_GEMINI + ":generateContent"
URL_GROQ = "https://api.groq.com/openai/v1/chat/completions"


PROMPT_SCORING = """Eres un analista de riesgo crediticio. Analiza esta solicitud
de microcrédito para un emprendedor digital colombiano.

DATOS DEL SOLICITANTE:
- Tipo de negocio: {tipo}
- Ingresos mensuales promedio: {ingresos} COP
- Meses con el negocio: {meses}
- Monto solicitado: {monto} COP
- Plazo: {plazo} días
- Historial de pagos previos: {historial}
- Fuentes digitales conectadas: {fuentes}

Tu tarea:
1. Asignar un score crediticio de 0 a 1000
2. Decidir: APROBADO, REVISION o RECHAZADO
3. Definir monto aprobado (entre 0 y el solicitado)
4. Sugerir tasa anual (8% a 22%)
5. Explicar la decisión en 3 razones cortas

Responde SOLO con este formato, sin markdown:

SCORE: <numero 0-1000>
DECISION: <APROBADO | REVISION | RECHAZADO>
MONTO_APROBADO: <numero>
TASA_ANUAL: <numero>
RAZON_1: <texto corto>
RAZON_2: <texto corto>
RAZON_3: <texto corto>

Reglas:
- Sé realista. Emprendedores con menos de 6 meses e ingresos bajos → REVISION o RECHAZADO.
- Máximo 5x los ingresos mensuales como monto aprobado.
- Tasas más bajas para mejor score.
"""


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
    try:
        return _groq(prompt)
    except Exception:
        return _gemini(prompt)


def parsear_respuesta(texto):
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
    return resultado


# ============ DATOS SIMULADOS ============

def generar_flujo_caja(meses=12, base=3000000):
    """Genera un flujo de caja simulado para el dashboard."""
    hoy = datetime.now()
    datos = []
    for i in range(meses):
        fecha = hoy - timedelta(days=30 * (meses - i - 1))
        variacion = random.uniform(0.7, 1.4)
        ingresos = int(base * variacion)
        datos.append({
            "mes": fecha.strftime("%b %Y"),
            "ingresos": ingresos,
            "egresos": int(ingresos * random.uniform(0.5, 0.75)),
        })
    return pd.DataFrame(datos)


# ============ BD ============

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
        ["📊 Dashboard", "💳 Solicitar crédito", "📋 Historial"],
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

    # Métricas
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

    # Gráfico de flujo de caja
    st.subheader("📈 Flujo de caja últimos 12 meses")
    df = generar_flujo_caja(12, base=3000000)

    fig = go.Figure()
    fig.add_trace(go.Bar(
        x=df["mes"], y=df["ingresos"],
        name="Ingresos",
        marker_color="#10b981",
    ))
    fig.add_trace(go.Bar(
        x=df["mes"], y=df["egresos"],
        name="Egresos",
        marker_color="#ef4444",
    ))
    fig.update_layout(
        barmode="group",
        plot_bgcolor="white",
        height=350,
        margin=dict(l=0, r=0, t=10, b=0),
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
    )
    st.plotly_chart(fig, use_container_width=True)

    # Fuentes conectadas
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


# ============ SOLICITAR CRÉDITO ============

elif menu == "💳 Solicitar crédito":
    st.markdown("""
    <div class="main-header">
        <h1>💳 Solicitar crédito</h1>
        <p>Análisis con IA en menos de 24 horas</p>
    </div>
    """, unsafe_allow_html=True)

    if st.session_state["resultado_actual"] is None:
        with st.form("solicitud"):
            col1, col2 = st.columns(2)

            with col1:
                tipo = st.selectbox(
                    "Tipo de negocio digital",
                    ["E-commerce", "Creador de contenido", "Servicios digitales",
                     "SaaS / App", "Marketing digital", "Otro"],
                )
                ingresos = st.number_input(
                    "Ingresos mensuales promedio (COP)",
                    min_value=500000, max_value=50000000,
                    value=3000000, step=100000,
                )
                meses = st.number_input(
                    "Meses con el negocio",
                    min_value=1, max_value=120, value=12,
                )

            with col2:
                monto = st.number_input(
                    "Monto solicitado (COP)",
                    min_value=100000, max_value=5000000,
                    value=1000000, step=100000,
                )
                plazo = st.selectbox(
                    "Plazo",
                    [30, 60, 90, 120, 180],
                    format_func=lambda x: f"{x} días",
                )
                historial = st.selectbox(
                    "Historial de pagos previos",
                    ["Sin historial", "1 crédito pagado", "2-3 créditos pagados", "Más de 3 créditos"],
                )

            fuentes = st.multiselect(
                "Fuentes digitales conectadas",
                ["Stripe", "Nequi", "Daviplata", "PayPal", "Wompi", "Mercado Pago"],
                default=["Stripe", "Nequi"],
            )

            enviado = st.form_submit_button(
                "🔍 Analizar con IA", use_container_width=True, type="primary"
            )

        if enviado:
            if not fuentes:
                st.warning("Debes conectar al menos una fuente digital.")
            else:
                datos = {
                    "tipo": tipo,
                    "ingresos": ingresos,
                    "meses": meses,
                    "monto": monto,
                    "plazo": plazo,
                    "historial": historial,
                    "fuentes": ", ".join(fuentes),
                }

                with st.spinner("🤖 Analizando tu perfil con inteligencia artificial..."):
                    try:
                        texto_ia = analizar_con_ia(datos)
                        resultado = parsear_respuesta(texto_ia)
                    except Exception as e:
                        st.error(f"Error al analizar: {e}")
                        st.stop()

                # Guardar en BD
                guardar_solicitud(uid, datos, resultado)

                st.session_state["resultado_actual"] = resultado
                st.session_state["datos_actuales"] = datos
                st.rerun()

    else:
        resultado = st.session_state["resultado_actual"]
        datos = st.session_state["datos_actuales"]

        # Mostrar decisión
        decision = resultado["decision"]
        if decision == "APROBADO":
            st.markdown(f"""
            <div class="decision-aprobado">
                <h1>✅ APROBADO</h1>
                <p>Tu crédito ha sido aprobado automáticamente</p>
            </div>
            """, unsafe_allow_html=True)
        elif decision == "RECHAZADO":
            st.markdown(f"""
            <div class="decision-rechazado">
                <h1>❌ RECHAZADO</h1>
                <p>No pudimos aprobar tu solicitud en este momento</p>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="decision-revision">
                <h1>⏳ EN REVISIÓN</h1>
                <p>Un analista revisará tu caso en las próximas 24 horas</p>
            </div>
            """, unsafe_allow_html=True)

        st.markdown("<br>", unsafe_allow_html=True)

        # Métricas del resultado
        col1, col2, col3 = st.columns(3)

        with col1:
            st.markdown(f"""
            <div class="metric-card">
                <p class="metric-label">Score crediticio</p>
                <p class="metric-value">{resultado['score']}/1000</p>
            </div>
            """, unsafe_allow_html=True)

        with col2:
            st.markdown(f"""
            <div class="metric-card">
                <p class="metric-label">Monto aprobado</p>
                <p class="metric-value">${int(resultado['monto_aprobado']):,}</p>
            </div>
            """.replace(",", "."), unsafe_allow_html=True)

        with col3:
            st.markdown(f"""
            <div class="metric-card">
                <p class="metric-label">Tasa anual sugerida</p>
                <p class="metric-value">{resultado['tasa_anual']}%</p>
            </div>
            """, unsafe_allow_html=True)

        st.markdown("<br>", unsafe_allow_html=True)

        # Gauge del score
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number",
            value=resultado["score"],
            domain={"x": [0, 1], "y": [0, 1]},
            title={"text": "Score Crediticio"},
            gauge={
                "axis": {"range": [0, 1000]},
                "bar": {"color": "#0f172a"},
                "steps": [
                    {"range": [0, 400], "color": "#fee2e2"},
                    {"range": [400, 650], "color": "#fef3c7"},
                    {"range": [650, 850], "color": "#d1fae5"},
                    {"range": [850, 1000], "color": "#a7f3d0"},
                ],
            },
        ))
        fig_gauge.update_layout(height=280, margin=dict(l=20, r=20, t=40, b=20))
        st.plotly_chart(fig_gauge, use_container_width=True)

        # Razones
        st.subheader("📋 Razones de la decisión")
        for i, razon in enumerate(resultado["razones"], 1):
            st.markdown(f"**{i}.** {razon}")

        st.divider()

        if st.button("🔄 Solicitar otro crédito", use_container_width=True):
            st.session_state["resultado_actual"] = None
            st.session_state["datos_actuales"] = None
            st.rerun()


# ============ HISTORIAL ============

elif menu == "📋 Historial":
    st.markdown("""
    <div class="main-header">
        <h1>📋 Historial de solicitudes</h1>
        <p>Todas tus solicitudes anteriores</p>
    </div>
    """, unsafe_allow_html=True)

    solicitudes = obtener_solicitudes(uid)

    if not solicitudes:
        st.info("Aún no has realizado ninguna solicitud de crédito.")
    else:
        df = pd.DataFrame([{
            "Fecha": (s.get("created_at") or "")[:10],
            "Monto solicitado": f"${int(s['monto_solicitado']):,}".replace(",", "."),
            "Monto aprobado": f"${int(s.get('monto_aprobado') or 0):,}".replace(",", "."),
            "Score": s.get("score", 0),
            "Decisión": s.get("decision", ""),
            "Tasa": f"{s.get('tasa_sugerida', 0)}%",
        } for s in solicitudes])

        st.dataframe(df, use_container_width=True, hide_index=True)
