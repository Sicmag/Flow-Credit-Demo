"""
FlowCredit Digital - Prototipo completo (Parte 1/2)
Base, funciones y login.
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
from PIL import Image, ImageOps
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
    try:
        import cv2

        img = Image.open(io.BytesIO(imagen_bytes))
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        arr = np.array(img)

        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        gray = cv2.equalizeHist(gray)

        ruta = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        clasificador = cv2.CascadeClassifier(ruta)

        rostros = clasificador.detectMultiScale(gray, 1.1, 4)
        if len(rostros) > 0:
            return True, len(rostros)

        rostros = clasificador.detectMultiScale(gray, 1.05, 3, minSize=(30, 30))
        if len(rostros) > 0:
            return True, len(rostros)

        alto, ancho = gray.shape
        gray2 = cv2.resize(gray, (ancho * 2, alto * 2))
        rostros = clasificador.detectMultiScale(gray2, 1.1, 4)
        return len(rostros) > 0, len(rostros)
    except Exception as e:
        st.error("Error en detector: " + str(e))
        return False, 0


def subir_foto_verificacion(uid, imagen_bytes):
    restaurar_sesion()
    try:
        nombre = str(uid) + "_" + datetime.now().strftime("%Y%m%d_%H%M%S") + ".jpg"
        supabase_client.storage.from_("verificaciones").upload(
            nombre, imagen_bytes, {"content-type": "image/jpeg"}
        )
        return supabase_client.storage.from_("verificaciones").get_public_url(nombre)
    except Exception:
        return None


def guardar_verificacion(uid, url_foto, estado):
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


# ============ CREDITOS Y CUOTAS ============

def calcular_plan_pagos(monto, tasa_anual, plazo_dias):
    if plazo_dias <= 30:
        num_cuotas = 1
    elif plazo_dias <= 60:
        num_cuotas = 2
    elif plazo_dias <= 90:
        num_cuotas = 3
    elif plazo_dias <= 120:
        num_cuotas = 4
    else:
        num_cuotas = 6

    tasa_mensual = (tasa_anual / 100.0) / 12.0
    if tasa_mensual <= 0:
        valor_cuota = monto / num_cuotas
    else:
        factor = (1 + tasa_mensual) ** num_cuotas
        valor_cuota = monto * (tasa_mensual * factor) / (factor - 1)

    total_pagar = valor_cuota * num_cuotas
    total_intereses = total_pagar - monto

    return {
        "num_cuotas": num_cuotas,
        "valor_cuota": round(valor_cuota, 2),
        "total_pagar": round(total_pagar, 2),
        "total_intereses": round(total_intereses, 2),
        "tasa_mensual": round(tasa_mensual * 100, 4),
    }


def crear_credito(uid, solicitud_id, monto, tasa, plazo):
    restaurar_sesion()
    plan = calcular_plan_pagos(monto, tasa, plazo)
    try:
        resp = supabase_client.table("creditos").insert({
            "user_id": uid,
            "solicitud_id": solicitud_id,
            "monto_aprobado": float(monto),
            "tasa_anual": float(tasa),
            "plazo_dias": int(plazo),
            "num_cuotas": plan["num_cuotas"],
            "valor_cuota": plan["valor_cuota"],
            "total_intereses": plan["total_intereses"],
            "total_pagar": plan["total_pagar"],
            "saldo_pendiente": plan["total_pagar"],
            "estado": "activo",
        }).execute()

        if not resp.data:
            return None

        credito_id = resp.data[0]["id"]
        hoy = datetime.now()
        cuotas = []
        for i in range(1, plan["num_cuotas"] + 1):
            dias_adelanto = int((plazo / plan["num_cuotas"]) * i)
            fecha_venc = (hoy + timedelta(days=dias_adelanto)).date().isoformat()
            capital_cuota = monto / plan["num_cuotas"]
            interes_cuota = plan["valor_cuota"] - capital_cuota

            cuotas.append({
                "credito_id": credito_id,
                "user_id": uid,
                "numero": i,
                "valor": plan["valor_cuota"],
                "capital": round(capital_cuota, 2),
                "intereses": round(interes_cuota, 2),
                "fecha_vencimiento": fecha_venc,
                "estado": "pendiente",
            })

        supabase_client.table("cuotas").insert(cuotas).execute()
        return credito_id
    except Exception as e:
        st.error("Error creando credito: " + str(e))
        return None


def obtener_creditos_activos(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("creditos").select("*") \
            .eq("user_id", uid).eq("estado", "activo") \
            .order("created_at", desc=True).execute()
        return r.data or []
    except Exception:
        return []


def obtener_todos_creditos(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("creditos").select("*") \
            .eq("user_id", uid).order("created_at", desc=True).execute()
        return r.data or []
    except Exception:
        return []


def obtener_cuotas(credito_id):
    restaurar_sesion()
    try:
        r = supabase_client.table("cuotas").select("*") \
            .eq("credito_id", credito_id).order("numero").execute()
        return r.data or []
    except Exception:
        return []


def pagar_cuota(cuota_id, credito_id):
    restaurar_sesion()
    try:
        supabase_client.table("cuotas").update({
            "estado": "pagada",
            "fecha_pago": datetime.now().isoformat(),
        }).eq("id", cuota_id).execute()

        cuotas = obtener_cuotas(credito_id)
        pagadas = sum(1 for c in cuotas if c["estado"] == "pagada")
        saldo = sum(c["valor"] for c in cuotas if c["estado"] == "pendiente")

        estado = "pagado" if pagadas >= len(cuotas) else "activo"

        supabase_client.table("creditos").update({
            "cuotas_pagadas": pagadas,
            "saldo_pendiente": round(saldo, 2),
            "estado": estado,
        }).eq("id", credito_id).execute()

        return True
    except Exception:
        return False


def obtener_estado_onboarding(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("profiles") \
            .select("onboarding_completado, terminos_aceptados") \
            .eq("id", uid).execute()
        return r.data[0] if r.data else {"onboarding_completado": False, "terminos_aceptados": False}
    except Exception:
        return {"onboarding_completado": False, "terminos_aceptados": False}


def completar_onboarding(uid):
    restaurar_sesion()
    try:
        supabase_client.table("profiles").update({
            "onboarding_completado": True,
        }).eq("id", uid).execute()
        return True
    except Exception:
        return False


def aceptar_terminos(uid):
    restaurar_sesion()
    try:
        supabase_client.table("profiles").update({
            "terminos_aceptados": True,
            "terminos_fecha": datetime.now().isoformat(),
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
if "onboarding_paso" not in st.session_state:
    st.session_state["onboarding_paso"] = 1
if "credito_creado" not in st.session_state:
    st.session_state["credito_creado"] = False


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


# ============ ONBOARDING ============

estado_onb = obtener_estado_onboarding(uid)
if not estado_onb.get("onboarding_completado"):
    st.title("👋 Bienvenido a FlowCredit Digital")
    st.caption("Tu solucion de credito para emprendedores digitales")
    st.divider()

    paso = st.session_state.get("onboarding_paso", 1)

    if paso == 1:
        st.subheader("💳 Que es FlowCredit?")
        st.write("FlowCredit Digital es una plataforma que analiza tu flujo de caja digital y te ofrece credito personalizado en menos de 24 horas.")
        if st.button("Siguiente", use_container_width=True, type="primary"):
            st.session_state["onboarding_paso"] = 2
            st.rerun()
    elif paso == 2:
        st.subheader("🤖 Inteligencia artificial")
        st.write("Nuestro motor de IA analiza tus ingresos digitales y calcula tu score crediticio en segundos.")
        if st.button("Siguiente", use_container_width=True, type="primary"):
            st.session_state["onboarding_paso"] = 3
            st.rerun()
    elif paso == 3:
        st.subheader("📋 Solo 3 pasos")
        st.write("1. Verifica tu identidad con reconocimiento facial")
        st.write("2. Solicita tu credito en 1 minuto")
        st.write("3. Recibe el desembolso en menos de 24 horas")
        if st.button("Empezar ahora", use_container_width=True, type="primary"):
            completar_onboarding(uid)
            st.session_state["onboarding_paso"] = 1
            st.rerun()

    st.stop()


# ============ SIDEBAR ============

with st.sidebar:
    st.markdown("### 👤 " + nombre)
    st.caption(email)
    st.divider()

    menu = st.radio(
        "Menu",
        [
            "📊 Dashboard",
            "🛡️ Verificacion",
            "💳 Solicitar credito",
            "💼 Mis creditos",
            "📋 Historial",
            "📜 Terminos",
        ],
        label_visibility="collapsed",
    )

    st.divider()
    if st.button("Cerrar sesion", use_container_width=True):
        try:
            supabase_client.auth.sign_out()
        except Exception:
            pass
        for k in ["user", "access_token", "refresh_token", "resultado_actual", "datos_actuales", "credito_creado"]:
            st.session_state.pop(k, None)
        st.rerun()

# ⬇️ AQUI CONTINUA LA PARTE 2 ⬇️


# ============ DASHBOARD ============

if menu == "📊 Dashboard":
    st.title("📊 Dashboard")
    st.caption("Vista general de tu linea de credito digital")

    solicitudes = obtener_solicitudes(uid)
    creditos = obtener_creditos_activos(uid)

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
        st.metric("Creditos activos", len(creditos))

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
        st.info("Toma una foto de tu rostro de frente, con buena luz.")

        foto = st.camera_input("📸 Toma una foto de tu rostro")

        if foto is not None:
            imagen_bytes = foto.getvalue()
            with st.spinner("Analizando rostro..."):
                tiene_rostro, cantidad = detectar_rostro(imagen_bytes)

            if not tiene_rostro:
                st.error("❌ No se reconoce un rostro. Intenta con mejor luz y rostro de frente.")
            else:
                st.success("✅ Rostro detectado (" + str(cantidad) + " rostro(s))")
                with st.spinner("Guardando verificacion..."):
                    url = subir_foto_verificacion(uid, imagen_bytes)
                    if url:
                        guardar_verificacion(uid, url, "verificado")
                        st.success("🎉 Identidad verificada correctamente")
                        st.balloons()
                    else:
                        st.warning("Rostro detectado, pero no se pudo guardar la foto.")

        st.divider()
        st.subheader("🔑 Codigo de recuperacion")
        st.caption("Sistema de recuperacion basado en claves criptograficas.")

        codigo_info = obtener_codigo_recuperacion(uid)
        if codigo_info and codigo_info.get("recovery_code"):
            st.warning("⚠️ Guarda este codigo en un lugar seguro.")
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
        st.warning("⚠️ No tienes verificacion previa.")

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

                with st.spinner("🤖 Analizando tu perfil..."):
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
        datos = st.session_state["datos_actuales"]
        decision = resultado["decision"]

        if decision == "APROBADO":
            st.success("✅ APROBADO - Tu credito ha sido aprobado automaticamente")
        elif decision == "RECHAZADO":
            st.error("❌ RECHAZADO - No pudimos aprobar tu solicitud")
        else:
            st.warning("⏳ EN REVISION - Un analista revisara tu caso")

        if decision == "APROBADO" and not st.session_state.get("credito_creado", False):
            solicitudes = obtener_solicitudes(uid)
            if solicitudes:
                ultima = solicitudes[0]
                credito_id = crear_credito(
                    uid, ultima["id"], resultado["monto_aprobado"],
                    resultado["tasa_anual"], datos["plazo"],
                )
                if credito_id:
                    st.session_state["credito_creado"] = True
                    st.info("💼 Tu credito fue registrado. Ve a 'Mis creditos' para ver el plan de pagos.")

        st.divider()
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Score crediticio", str(resultado["score"]) + "/1000")
        with col2:
            st.metric("Monto aprobado", "$" + "{:,.0f}".format(resultado["monto_aprobado"]).replace(",", "."))
        with col3:
            st.metric("Tasa anual", str(resultado["tasa_anual"]) + "%")

        if decision == "APROBADO" and resultado["monto_aprobado"] > 0:
            plan = calcular_plan_pagos(resultado["monto_aprobado"], resultado["tasa_anual"], datos["plazo"])
            st.divider()
            st.subheader("📋 Plan de pagos")
            col_a, col_b, col_c = st.columns(3)
            with col_a:
                st.metric("Cuotas", plan["num_cuotas"])
            with col_b:
                st.metric("Valor por cuota", "$" + "{:,.0f}".format(plan["valor_cuota"]).replace(",", "."))
            with col_c:
                st.metric("Total a pagar", "$" + "{:,.0f}".format(plan["total_pagar"]).replace(",", "."))

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
            st.session_state["credito_creado"] = False
            st.rerun()


# ============ MIS CREDITOS ============

elif menu == "💼 Mis creditos":
    st.title("💼 Mis creditos")
    st.caption("Gestiona tus creditos y pagos")

    creditos = obtener_todos_creditos(uid)

    if not creditos:
        st.info("No tienes creditos registrados. Ve a 'Solicitar credito' para empezar.")
    else:
        for cred in creditos:
            icono = "🟢" if cred["estado"] == "activo" else "✅"
            st.subheader(icono + " Credito #" + str(cred["id"]))

            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Monto", "$" + "{:,.0f}".format(cred["monto_aprobado"]).replace(",", "."))
            with col2:
                st.metric("Tasa anual", str(cred["tasa_anual"]) + "%")
            with col3:
                st.metric("Saldo pendiente", "$" + "{:,.0f}".format(cred["saldo_pendiente"]).replace(",", "."))
            with col4:
                st.metric("Cuotas pagadas", str(cred["cuotas_pagadas"]) + "/" + str(cred["num_cuotas"]))

            progreso = cred["cuotas_pagadas"] / cred["num_cuotas"]
            st.progress(progreso)

            cuotas = obtener_cuotas(cred["id"])

            with st.expander("📋 Ver plan de pagos completo"):
                filas = []
                for c in cuotas:
                    filas.append({
                        "N": c["numero"],
                        "Valor": "$" + "{:,.0f}".format(c["valor"]).replace(",", "."),
                        "Capital": "$" + "{:,.0f}".format(c["capital"]).replace(",", "."),
                        "Intereses": "$" + "{:,.0f}".format(c["intereses"]).replace(",", "."),
                        "Vencimiento": c["fecha_vencimiento"],
                        "Estado": "✅ Pagada" if c["estado"] == "pagada" else "⏳ Pendiente",
                    })
                st.dataframe(pd.DataFrame(filas), use_container_width=True, hide_index=True)

            pendientes = [c for c in cuotas if c["estado"] == "pendiente"]
            if pendientes:
                siguiente = pendientes[0]
                st.info(
                    "📅 Proxima cuota: **" + str(siguiente["numero"]) + "** · "
                    "Vence el " + siguiente["fecha_vencimiento"] + " · "
                    "Valor: $" + "{:,.0f}".format(siguiente["valor"]).replace(",", ".")
                )
                if st.button("💳 Pagar cuota " + str(siguiente["numero"]), key="pagar_" + str(cred["id"])):
                    if pagar_cuota(siguiente["id"], cred["id"]):
                        st.success("✅ Cuota pagada correctamente")
                        st.balloons()
                        st.rerun()
                    else:
                        st.error("No se pudo procesar el pago")
            else:
                st.success("🎉 Credito pagado completamente")

            st.divider()


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
        st.dataframe(pd.DataFrame(filas), use_container_width=True, hide_index=True)


# ============ TERMINOS ============

elif menu == "📜 Terminos":
    st.title("📜 Terminos y politica de privacidad")
    st.caption("Documento legal de uso de la plataforma")

    with st.expander("Terminos de uso", expanded=True):
        st.markdown("""
        **1. Aceptacion**
        Al usar FlowCredit Digital aceptas los presentes terminos.

        **2. Naturaleza del servicio**
        FlowCredit Digital es un prototipo demostrativo. No presta dinero real.
        Las decisiones de credito mostradas son simulaciones con fines academicos.

        **3. Datos personales**
        Tratamos tus datos conforme a la Ley 1581 de 2012. Los datos biometricos
        se almacenan solo como evidencia de verificacion.

        **4. Uso de IA**
        El motor de decision usa modelos de inteligencia artificial. Los resultados
        pueden variar segun la informacion proporcionada.
        """)

    with st.expander("Politica de tratamiento de datos"):
        st.markdown("""
        **Responsable:** FlowCredit Digital - Proyecto SENA 2026

        **Finalidad:** Analisis de credito y verificacion de identidad.

        **Datos recolectados:**
        - Nombre y correo electronico
        - Documento de identidad (simulado)
        - Datos financieros declarados
        - Fotografia de verificacion facial

        **Derechos del titular (Ley 1581):**
        - Conocer, actualizar y rectificar tus datos
        - Solicitar prueba de la autorizacion
        - Revocar la autorizacion
        - Presentar quejas ante la SIC

        **Contacto:** privacidad@flowcredit.com
        """)

    estado = obtener_estado_onboarding(uid)
    if not estado.get("terminos_aceptados"):
        if st.button("✅ Acepto los terminos y politica de privacidad", use_container_width=True, type="primary"):
            if aceptar_terminos(uid):
                st.success("Terminos aceptados")
                st.rerun()
    else:
        st.success("✅ Ya aceptaste los terminos")
