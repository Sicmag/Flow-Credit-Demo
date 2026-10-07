"""
FlowCredit Digital - Prototipo
Motor de decision crediticia con IA para emprendedores digitales.
Proyecto SENA 2026.
"""

import io
import random
import string
import time
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st
from PIL import Image
from supabase import create_client


st.set_page_config(
    page_title="FlowCredit Digital",
    page_icon="💳",
    layout="wide",
)


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
    st.error("Falta configurar GEMINI_API_KEY o GROQ_API_KEY.")
    st.stop()

if not SUPABASE_URL or not SUPABASE_KEY:
    st.error("Falta configurar Supabase.")
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

REGLAS CRITICAS:
- RECHAZADO: MONTO_APROBADO = 0 y TASA = 0
- REVISION: monto maximo 1x ingresos, tasa 18-22%
- APROBADO: monto entre 1x y 5x ingresos, tasa 8-16%
- Score: rechazado menor 500, revision 500-700, aprobado mayor 700

CRITERIOS:
- Menos de 6 meses: REVISION o RECHAZADO
- Sin historial y sin fuentes: REVISION
- Monto mayor a 3x ingresos: reducir o REVISION
- Ingresos verificables + 12+ meses + historial: APROBADO
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
    errores = []
    for intento in range(2):
        try:
            return _groq(prompt)
        except Exception as e:
            errores.append("Groq " + str(intento + 1) + ": " + str(e))
            if intento == 0:
                time.sleep(3)
    for intento in range(2):
        try:
            return _gemini(prompt)
        except Exception as e:
            errores.append("Gemini " + str(intento + 1) + ": " + str(e))
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
        r = supabase_client.table("solicitudes").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
        return r.data or []
    except Exception:
        return []


# ============ BD: CLIENTES DEMO ============

def obtener_cliente_demo(email):
    restaurar_sesion()
    try:
        r = supabase_client.table("clientes_demo").select("*").eq("email", email).execute()
        return r.data[0] if r.data else None
    except Exception:
        return None


# ============ BD: CODIGO RECUPERACION ============

def generar_codigo_recuperacion():
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
        r = supabase_client.table("profiles").select("recovery_code, verificado").eq("id", uid).execute()
        return r.data[0] if r.data else None
    except Exception:
        return None


# ============ RECONOCIMIENTO FACIAL ============

def detectar_rostro(imagen_bytes):
    """Detecta si hay un rostro en la imagen usando OpenCV."""
    try:
        import cv2

        img = Image.open(io.BytesIO(imagen_bytes)).convert("RGB")
        arr = np.array(img)
        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)

        clasificador = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        rostros = clasificador.detectMultiScale(gray, 1.1, 4)
        return len(rostros) > 0, len(rostros)
    except Exception:
        return False, 0


def subir_foto_verificacion(uid, imagen_bytes):
    """Sube la foto al Storage de Supabase."""
    restaurar_sesion()
    try:
        nombre_archivo = str(uid) + "_" + datetime.now().strftime("%Y%m%d_%H%M%S") + ".jpg"
        supabase_client.storage.from_("verificaciones").upload(
            nombre_archivo,
            imagen_bytes,
            {"content-type": "image/jpeg"},
        )
        url = supabase_client.storage.from_("verificaciones").get_public_url(nombre_archivo)
        return url
    except Exception:
        return None


def guardar_verificacion(uid, url_foto, estado):
    """Guarda el resultado de la verificacion en profiles."""
    restaurar_sesion()
    try:
        supabase_client.table("profiles").update({
            "foto_verificacion_url": url_foto,
            "verificacion_estado": estado,
            "verificacion_fecha": datetime.now().isoformat(),
        }).eq("id", uid).execute()
        return True
    except Exception:
        return False


# ============ ESTADO ============

if "user" not in st.session_state:
    st.session_state["user"] = None
if "resultado_actual" not in st.session_state:
    st.session_state["resultado_actual"] = None
if "datos_actuales" not in st.session_state:
    st.session_state["datos_actuales"] = None


# ============ LOGIN ============

if st.session_state["user"] is None:
    st.title("💳 FlowCredit Digital")
    st.caption("Solucion financiera innovadora para emprendedores digitales")
    st.divider()

    tab1, tab2 = st.tabs(["🔐 Iniciar sesion", "✨ Crear cuenta"])

    with tab1:
        with st.form("login"):
            email = st.text_input("Correo")
            pwd = st.text_input("Contrasena", type="password")
            ok = st.form_submit_button("Iniciar sesion", use_container_width=True)
        if ok:
            try:
                resp = supabase_client.auth.sign_in_with_password({"email": email, "password": pwd})
                if resp.user:
                    st.session_state["user"] = {"id": resp.user.id, "email": resp.user.email}
                    st.session_state["access_token"] = resp.session.access_token
                    st.session_state["refresh_token"] = resp.session.refresh_token
                    st.rerun()
            except Exception as e:
                st.error("Error: " + str(e))

    with tab2:
        st.caption("Minimo 8 caracteres con mayuscula, minuscula, numero y un simbolo.")
        st.info("Correos demo: carlosandres3341@gmail.com | jesusviloria@gmail.com | juan@test.com")
        with st.form("registro"):
            email_r = st.text_input("Correo", key="r_email")
            pwd_r = st.text_input("Contrasena", type="password", key="r_pwd")
            pwd_r2 = st.text_input("Repite contrasena", type="password", key="r_pwd2")
            ok_r = st.form_submit_button("Crear cuenta", use_container_width=True)
        if ok_r:
            if pwd_r != pwd_r2:
                st.error("Las contrasenas no coinciden.")
            elif len(pwd_r) < 8:
                st.error("Minimo 8 caracteres.")
            else:
                try:
                    supabase_client.auth.sign_up({"email": email_r, "password": pwd_r})
                    st.success("Cuenta creada. Revisa tu correo para confirmar.")
                except Exception as e:
                    st.error("Error: " + str(e))
    st.stop()


# ============ VARIABLES GLOBALES ============

uid = st.session_state["user"]["id"]
email = st.session_state["user"]["email"]
nombre = email.split("@")[0] if email else "Emprendedor"


# ============ SIDEBAR ============

with st.sidebar:
    st.markdown("### 👤 " + nombre)
    st.caption(email)
    st.divider()

    menu = st.radio(
        "Menu",
        ["📊 Dashboard", "🛡️ Verificacion", "💳 Solicitar credito", "📋 Historial"],
        label_visibility="collapsed",
    )

    st.divider()
    if st.button("Cerrar sesion", use_container_width=True):
        try:
            supabase_client.auth.sign_out()
        except Exception:
            pass
        for k in ["user", "access_token", "refresh_token", "resultado_actual", "datos_actuales"]:
            st.session_state.pop(k, None)
        st.rerun()

# ⬇️ CONTINUA EN LA PARTE 2 ⬇️
# ============ DASHBOARD ============

if menu == "📊 Dashboard":
    st.title("📊 Dashboard")
    st.caption("Vista general de tu linea de credito digital")

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
        st.metric("Linea disponible", "$" + "{:,.0f}".format(linea_disponible).replace(",", "."))
    with col2:
        st.metric("Score crediticio", str(score_actual) + "/1000")
    with col3:
        st.metric("Solicitudes", len(solicitudes))
    with col4:
        activas = sum(1 for s in solicitudes if s.get("decision") == "APROBADO")
        st.metric("Creditos activos", activas)

    st.divider()
    st.subheader("📈 Flujo de caja ultimos 12 meses")

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
    )
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("🔗 Fuentes digitales conectadas")
    col_a, col_b, col_c, col_d = st.columns(4)
    with col_a:
        st.success("💳 Stripe - Conectado")
    with col_b:
        st.success("🟣 Nequi - Conectado")
    with col_c:
        st.success("🔵 PayPal - Conectado")
    with col_d:
        st.warning("🟢 Daviplata - Pendiente")


# ============ VERIFICACION ============

elif menu == "🛡️ Verificacion":
    st.title("🛡️ Verificacion de identidad")
    st.caption("Consulta tus datos verificados y completa tu verificacion biometrica")

    cliente = obtener_cliente_demo(email)

    if not cliente:
        st.warning("No se encontraron datos verificados para tu correo.")
        st.info("Correos demo disponibles:")
        st.code("carlosandres3341@gmail.com")
        st.code("jesusviloria@gmail.com")
        st.code("juan@test.com")
        st.code("maria@test.com")
        st.code("ana@test.com")
    else:
        st.success("✅ Identidad Verificada - Datos consultados en bases oficiales")
        st.divider()

        col1, col2 = st.columns(2)

        with col1:
            st.metric("Nombre completo", cliente["nombre_completo"])
            st.metric("Cedula", cliente["cedula"])
            st.metric("Fecha de nacimiento", str(cliente["fecha_nacimiento"]))
            st.metric("Telefono", cliente["telefono"])

        with col2:
            st.metric("Direccion", cliente["direccion"])
            st.metric("Ciudad", cliente["ciudad"])
            st.metric("Ocupacion", cliente["ocupacion"])
            st.metric("Score Datacredito", cliente["score_datacredito"])

        st.divider()
        st.subheader("🔐 Verificacion biometrica con reconocimiento facial")
        st.info("Toma una foto de tu rostro. El sistema verificara que sea una persona real y guardara la evidencia.")

        foto = st.camera_input("📸 Toma una foto de tu rostro")

        if foto is not None:
            imagen_bytes = foto.getvalue()

            with st.spinner("Analizando rostro..."):
                tiene_rostro, cantidad = detectar_rostro(imagen_bytes)

            if not tiene_rostro:
                st.error("❌ No se reconoce un rostro en la imagen. Asegurate de estar frente a la camara, con buena luz y sin obstaculos.")
            else:
                st.success("✅ Rostro detectado (" + str(cantidad) + " rostro(s))")

                with st.spinner("Guardando verificacion..."):
                    url = subir_foto_verificacion(uid, imagen_bytes)
                    if url:
                        guardar_verificacion(uid, url, "verificado")
                        st.success("🎉 Identidad verificada correctamente")
                        st.caption("Foto guardada y verificacion registrada.")
                        st.balloons()
                    else:
                        st.warning("Rostro detectado, pero no se pudo guardar la foto.")

        st.divider()
        st.subheader("🔑 Codigo de recuperacion")
        st.caption("Sistema de recuperacion basado en claves criptograficas.")

        codigo_info = obtener_codigo_recuperacion(uid)

        if codigo_info and codigo_info.get("recovery_code"):
            st.warning("⚠️ Guarda este codigo en un lugar seguro. Es la unica forma de recuperar tu cuenta.")
            st.code(codigo_info["recovery_code"], language=None)
        else:
            st.info("Aun no has generado tu codigo de recuperacion.")
            if st.button("🔐 Generar codigo de recuperacion", use_container_width=True, type="primary"):
                with st.spinner("Generando..."):
                    codigo = guardar_codigo_recuperacion(uid)
                if codigo:
                    st.success("✅ Codigo generado")
                    st.rerun()
                else:
                    st.error("No se pudo generar el codigo.")


# ============ SOLICITAR CREDITO ============

elif menu == "💳 Solicitar credito":
    st.title("💳 Solicitar credito")
    st.caption("Analisis con IA en menos de 24 horas")

    cliente = obtener_cliente_demo(email)
    if cliente:
        st.success("✅ Cliente verificado: " + cliente["nombre_completo"] + " | Cedula " + cliente["cedula"] + " | Score " + str(cliente["score_datacredito"]))
    else:
        st.warning("⚠️ No tienes verificacion previa. Ve a la seccion Verificacion.")

    if st.session_state["resultado_actual"] is None:
        ingresos_default = int(cliente["ingresos_declarados"]) if cliente else 3000000

        with st.form("solicitud"):
            col1, col2 = st.columns(2)

            with col1:
                tipo = st.selectbox(
                    "Tipo de negocio digital",
                    ["E-commerce", "Creador de contenido", "Servicios digitales", "SaaS / App", "Marketing digital", "Otro"],
                )
                ingresos = st.number_input(
                    "Ingresos mensuales promedio (COP)",
                    min_value=500000, max_value=50000000,
                    value=ingresos_default, step=100000,
                )
                meses = st.number_input("Meses con el negocio", min_value=1, max_value=120, value=12)

            with col2:
                monto = st.number_input(
                    "Monto solicitado (COP)",
                    min_value=100000, max_value=5000000,
                    value=1000000, step=100000,
                )
                plazo = st.selectbox(
                    "Plazo",
                    [30, 60, 90, 120, 180],
                    format_func=lambda x: str(x) + " dias",
                )
                historial = st.selectbox(
                    "Historial de pagos previos",
                    ["Sin historial", "1 credito pagado", "2-3 creditos pagados", "Mas de 3 creditos"],
                )

            fuentes = st.multiselect(
                "Fuentes digitales conectadas",
                ["Stripe", "Nequi", "Daviplata", "PayPal", "Wompi", "Mercado Pago"],
                default=["Stripe", "Nequi"],
            )

            enviado = st.form_submit_button("🔍 Analizar con IA", use_container_width=True, type="primary")

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
                        resultado = parsear_respuesta(texto_ia, ingresos=ingresos)
                    except Exception as e:
                        st.error("Error al analizar: " + str(e))
                        st.stop()

                guardar_solicitud(uid, datos, resultado)
                st.session_state["resultado_actual"] = resultado
                st.session_state["datos_actuales"] = datos
                st.rerun()

    else:
        resultado = st.session_state["resultado_actual"]
        decision = resultado["decision"]

        if decision == "APROBADO":
            st.success("✅ APROBADO - Tu credito ha sido aprobado automaticamente")
        elif decision == "RECHAZADO":
            st.error("❌ RECHAZADO - No pudimos aprobar tu solicitud en este momento")
        else:
            st.warning("⏳ EN REVISION - Un analista revisara tu caso en las proximas 24 horas")

        st.divider()
        col1, col2, col3 = st.columns(3)

        with col1:
            st.metric("Score crediticio", str(resultado["score"]) + "/1000")
        with col2:
            st.metric("Monto aprobado", "$" + "{:,.0f}".format(resultado["monto_aprobado"]).replace(",", "."))
        with col3:
            st.metric("Tasa anual", str(resultado["tasa_anual"]) + "%")

        st.divider()

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

        st.subheader("📋 Razones de la decision")
        for i, razon in enumerate(resultado["razones"], 1):
            st.markdown("**" + str(i) + ".** " + razon)

        st.divider()
        if st.button("🔄 Solicitar otro credito", use_container_width=True):
            st.session_state["resultado_actual"] = None
            st.session_state["datos_actuales"] = None
            st.rerun()


# ============ HISTORIAL ============

elif menu == "📋 Historial":
    st.title("📋 Historial de solicitudes")
    st.caption("Todas tus solicitudes anteriores")

    solicitudes = obtener_solicitudes(uid)

    if not solicitudes:
        st.info("Aun no has realizado ninguna solicitud de credito.")
    else:
        filas = []
        for s in solicitudes:
            filas.append({
                "Fecha": (s.get("created_at") or "")[:10],
                "Monto solicitado": "$" + "{:,.0f}".format(s["monto_solicitado"]).replace(",", "."),
                "Monto aprobado": "$" + "{:,.0f}".format(s.get("monto_aprobado") or 0).replace(",", "."),
                "Score": s.get("score", 0),
                "Decision": s.get("decision", ""),
                "Tasa": str(s.get("tasa_sugerida", 0)) + "%",
            })
        df = pd.DataFrame(filas)
        st.dataframe(df, use_container_width=True, hide_index=True)
