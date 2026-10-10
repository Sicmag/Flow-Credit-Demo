"""
FlowCredit Digital - Banco digital completo
Fintech para emprendedores digitales.
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


# ============ BD: DATOS PERSONALES ============

def guardar_datos_personales(uid, nombres, apellidos, cedula, telefono):
    """Guarda los datos personales del usuario en profiles."""
    restaurar_sesion()
    try:
        supabase_client.table("profiles").update({
            "nombres": nombres,
            "apellidos": apellidos,
            "cedula": cedula,
            "telefono": telefono,
        }).eq("id", uid).execute()
        return True
    except Exception:
        return False


def obtener_datos_personales(uid):
    """Obtiene los datos personales del usuario desde profiles."""
    restaurar_sesion()
    try:
        r = supabase_client.table("profiles") \
            .select("nombres, apellidos, cedula, telefono") \
            .eq("id", uid).execute()
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


# ============ SIMULADOR Y CAPACIDAD ============

def simular_credito(monto, plazo_dias, tasa_anual):
    return calcular_plan_pagos(monto, tasa_anual, plazo_dias)


def calcular_capacidad_pago(ingresos_mensuales):
    egresos = ingresos_mensuales * 0.6
    disponible = ingresos_mensuales - egresos
    capacidad_maxima = disponible * 0.3

    if capacidad_maxima >= 500000:
        semaforo = "verde"
        mensaje = "Tienes buena capacidad de pago"
    elif capacidad_maxima >= 200000:
        semaforo = "amarillo"
        mensaje = "Capacidad moderada, considera plazos mas largos"
    else:
        semaforo = "rojo"
        mensaje = "Capacidad limitada, te recomendamos esperar"

    return {
        "egresos_estimados": round(egresos, 2),
        "disponible": round(disponible, 2),
        "capacidad_maxima": round(capacidad_maxima, 2),
        "semaforo": semaforo,
        "mensaje": mensaje,
    }


# ============ NOTIFICACIONES ============

def crear_notificacion(uid, titulo, mensaje, tipo="info"):
    restaurar_sesion()
    try:
        supabase_client.table("notificaciones").insert({
            "user_id": uid,
            "titulo": titulo,
            "mensaje": mensaje,
            "tipo": tipo,
        }).execute()
        return True
    except Exception:
        return False


def obtener_notificaciones(uid, solo_no_leidas=False):
    restaurar_sesion()
    try:
        query = supabase_client.table("notificaciones").select("*").eq("user_id", uid)
        if solo_no_leidas:
            query = query.eq("leida", False)
        r = query.order("created_at", desc=True).limit(50).execute()
        return r.data or []
    except Exception:
        return []


def marcar_notificacion_leida(notif_id):
    restaurar_sesion()
    try:
        supabase_client.table("notificaciones").update({
            "leida": True,
        }).eq("id", notif_id).execute()
        return True
    except Exception:
        return False


def marcar_todas_leidas(uid):
    restaurar_sesion()
    try:
        supabase_client.table("notificaciones").update({
            "leida": True,
        }).eq("user_id", uid).eq("leida", False).execute()
        return True
    except Exception:
        return False


# ============ CONTRATO PDF ============

def generar_contrato_pdf(cliente, credito, cuotas, datos_personales=None):
    try:
        from fpdf import FPDF

        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 12, "FLOWCREDIT DIGITAL", ln=True, align="C")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(0, 5, "Contrato de Microcredito Digital", ln=True, align="C")
        pdf.ln(5)

        pdf.set_draw_color(16, 185, 129)
        pdf.set_line_width(0.8)
        pdf.line(20, pdf.get_y(), 190, pdf.get_y())
        pdf.ln(8)

        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 8, "INFORMACION DEL CLIENTE", ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(51, 65, 85)

        # Datos personales reales del usuario
        nombres_c = str((datos_personales or {}).get("nombres", "") or "")
        apellidos_c = str((datos_personales or {}).get("apellidos", "") or "")
        cedula_c = str((datos_personales or {}).get("cedula", "") or "")
        telefono_c = str((datos_personales or {}).get("telefono", "") or "")

        # Si no hay datos del usuario registrado, usar cliente demo
        if cliente:
            if not nombres_c:
                nombres_c = str(cliente.get("nombre_completo", "") or "")
            if not cedula_c:
                cedula_c = str(cliente.get("cedula", "") or "")
            if not telefono_c:
                telefono_c = str(cliente.get("telefono", "") or "")

        nombre_completo = (nombres_c + " " + apellidos_c).strip()

        pdf.cell(0, 6, "Nombre: " + nombre_completo, ln=True)
        pdf.cell(0, 6, "Cedula: " + cedula_c, ln=True)
        pdf.cell(0, 6, "Telefono: " + telefono_c, ln=True)

        if cliente:
            pdf.cell(0, 6, "Ciudad: " + str(cliente.get("ciudad", "")), ln=True)
            pdf.cell(0, 6, "Ocupacion: " + str(cliente.get("ocupacion", "")), ln=True)
            ing = int(cliente.get("ingresos_declarados", 0) or 0)
            pdf.cell(0, 6, "Ingresos declarados: $" + "{:,.0f}".format(ing).replace(",", ".") + " COP", ln=True)

        pdf.ln(5)

        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 8, "CONDICIONES DEL CREDITO", ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(51, 65, 85)

        pdf.cell(0, 6, "Monto aprobado: $" + "{:,.0f}".format(credito["monto_aprobado"]).replace(",", ".") + " COP", ln=True)
        pdf.cell(0, 6, "Tasa anual: " + str(credito["tasa_anual"]) + "%", ln=True)
        pdf.cell(0, 6, "Plazo: " + str(credito["plazo_dias"]) + " dias", ln=True)
        pdf.cell(0, 6, "Numero de cuotas: " + str(credito["num_cuotas"]), ln=True)
        pdf.cell(0, 6, "Valor por cuota: $" + "{:,.0f}".format(credito["valor_cuota"]).replace(",", ".") + " COP", ln=True)
        pdf.cell(0, 6, "Total intereses: $" + "{:,.0f}".format(credito["total_intereses"]).replace(",", ".") + " COP", ln=True)
        pdf.cell(0, 6, "Total a pagar: $" + "{:,.0f}".format(credito["total_pagar"]).replace(",", ".") + " COP", ln=True)
        pdf.ln(5)

        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 8, "PLAN DE PAGOS", ln=True)

        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(30, 41, 59)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(15, 7, "No.", 1, 0, "C", True)
        pdf.cell(35, 7, "Vencimiento", 1, 0, "C", True)
        pdf.cell(35, 7, "Valor", 1, 0, "C", True)
        pdf.cell(35, 7, "Capital", 1, 0, "C", True)
        pdf.cell(35, 7, "Intereses", 1, 1, "C", True)

        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(51, 65, 85)
        for c in cuotas:
            pdf.cell(15, 6, str(c["numero"]), 1, 0, "C")
            pdf.cell(35, 6, str(c["fecha_vencimiento"]), 1, 0, "C")
            pdf.cell(35, 6, "$" + "{:,.0f}".format(c["valor"]).replace(",", "."), 1, 0, "R")
            pdf.cell(35, 6, "$" + "{:,.0f}".format(c["capital"]).replace(",", "."), 1, 0, "R")
            pdf.cell(35, 6, "$" + "{:,.0f}".format(c["intereses"]).replace(",", "."), 1, 1, "R")

        pdf.ln(8)

        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 8, "TERMINOS Y CONDICIONES", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(71, 85, 105)
        terminos = (
            "El presente contrato se celebra bajo la modalidad de microcredito digital. "
            "El cliente se compromete a pagar las cuotas en las fechas establecidas. "
            "El incumplimiento genera intereses de mora segun la legislacion colombiana. "
            "Este es un documento demostrativo generado por un prototipo academico. "
            "No representa una obligacion financiera real."
        )
        pdf.multi_cell(0, 5, terminos)

        pdf.ln(10)
        pdf.set_draw_color(15, 23, 42)
        pdf.line(20, pdf.get_y() + 15, 90, pdf.get_y() + 15)
        pdf.line(110, pdf.get_y() + 15, 180, pdf.get_y() + 15)
        pdf.ln(20)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(70, 5, "Firma del Cliente", 0, 0, "C")
        pdf.cell(70, 5, "FlowCredit Digital", 0, 1, "C")

        pdf.ln(10)
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(148, 163, 184)
        pdf.cell(0, 5, "Generado el " + datetime.now().strftime("%d/%m/%Y %H:%M"), ln=True, align="C")
        pdf.cell(0, 5, "FlowCredit Digital - Proyecto SENA 2026", ln=True, align="C")

        resultado = pdf.output()
        if isinstance(resultado, str):
            return resultado.encode("latin-1", errors="replace")
        return bytes(resultado)
    except Exception as e:
        st.error("Error generando PDF: " + str(e))
        return None


# ============ CUENTAS Y TRANSFERENCIAS ============

def obtener_cuenta(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("cuentas").select("*").eq("user_id", uid).execute()
        if r.data:
            return r.data[0]
        numero = "FC-" + str(uid)[:8]
        resp = supabase_client.table("cuentas").insert({
            "user_id": uid,
            "numero_cuenta": numero,
            "saldo": 1000000,
        }).execute()
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def obtener_saldo(uid):
    cuenta = obtener_cuenta(uid)
    if cuenta:
        return float(cuenta.get("saldo", 0))
    return 0


def transferir(receptor_email, monto, concepto):
    restaurar_sesion()
    try:
        resp = supabase_client.rpc("transferir_dinero", {
            "p_receptor_email": receptor_email,
            "p_monto": float(monto),
            "p_concepto": concepto,
        }).execute()
        return resp.data
    except Exception as e:
        return {"success": False, "message": str(e)}


def obtener_transferencias(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("transferencias").select("*").or_(
            "emisor_id.eq." + str(uid) + ",receptor_id.eq." + str(uid)
        ).order("created_at", desc=True).limit(50).execute()
        return r.data or []
    except Exception:
        return []


def obtener_usuarios_registrados():
    restaurar_sesion()
    try:
        r = supabase_client.table("usuarios_registrados").select("*").execute()
        return r.data or []
    except Exception:
        return []


# ============ FLOWCARD ============

def obtener_tarjeta(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("tarjetas").select("*").eq("user_id", uid).execute()
        if r.data:
            return r.data[0]
        numero = "4000 " + " ".join([str(random.randint(1000, 9999)) for _ in range(3)])
        cvv = str(random.randint(100, 999))
        fecha = str(random.randint(1, 12)).zfill(2) + "/" + str(datetime.now().year + 4)[-2:]
        resp = supabase_client.table("tarjetas").insert({
            "user_id": uid,
            "numero": numero,
            "cvv": cvv,
            "fecha_expiracion": fecha,
            "cupo_total": 3000000,
            "cupo_disponible": 3000000,
        }).execute()
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def cambiar_estado_tarjeta(tarjeta_id, nuevo_estado):
    restaurar_sesion()
    try:
        supabase_client.table("tarjetas").update({
            "estado": nuevo_estado,
        }).eq("id", tarjeta_id).execute()
        return True
    except Exception:
        return False


# ============ FLOWSAVE ============

def crear_meta(uid, nombre, objetivo, fecha_limite, icono):
    restaurar_sesion()
    try:
        resp = supabase_client.table("metas_ahorro").insert({
            "user_id": uid,
            "nombre": nombre,
            "monto_objetivo": float(objetivo),
            "fecha_limite": fecha_limite,
            "icono": icono,
        }).execute()
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def obtener_metas(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("metas_ahorro").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
        return r.data or []
    except Exception:
        return []


def aportar_meta(meta_id, monto):
    restaurar_sesion()
    try:
        r = supabase_client.table("metas_ahorro").select("monto_actual").eq("id", meta_id).execute()
        if not r.data:
            return False
        actual = float(r.data[0]["monto_actual"])
        supabase_client.table("metas_ahorro").update({
            "monto_actual": actual + float(monto),
        }).eq("id", meta_id).execute()
        return True
    except Exception:
        return False


# ============ FLOWINVEST ============

def crear_inversion(uid, producto, monto, rendimiento):
    restaurar_sesion()
    try:
        resp = supabase_client.table("inversiones").insert({
            "user_id": uid,
            "producto": producto,
            "monto_invertido": float(monto),
            "rendimiento_anual": float(rendimiento),
            "valor_actual": float(monto),
            "estado": "activo",
        }).execute()
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def obtener_inversiones(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("inversiones").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
        return r.data or []
    except Exception:
        return []


# ============ FLOWSHIELD ============

def contratar_seguro(uid, tipo, cobertura, prima):
    restaurar_sesion()
    try:
        resp = supabase_client.table("seguros").insert({
            "user_id": uid,
            "tipo": tipo,
            "cobertura": float(cobertura),
            "prima_mensual": float(prima),
            "estado": "activo",
        }).execute()
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def obtener_seguros(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("seguros").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
        return r.data or []
    except Exception:
        return []


# ============ FLOWBUSINESS ============

def crear_cuenta_empresarial(uid, nombre_negocio, nit, categoria):
    restaurar_sesion()
    try:
        resp = supabase_client.table("cuentas_empresariales").insert({
            "user_id": uid,
            "nombre_negocio": nombre_negocio,
            "nit": nit,
            "categoria": categoria,
            "saldo": 0,
        }).execute()
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def obtener_cuentas_empresariales(uid):
    restaurar_sesion()
    try:
        r = supabase_client.table("cuentas_empresariales").select("*").eq("user_id", uid).order("created_at", desc=True).execute()
        return r.data or []
    except Exception:
        return []


# ============ MOVIMIENTOS ============

def obtener_movimientos(uid, limite=100):
    restaurar_sesion()
    try:
        r = supabase_client.table("movimientos").select("*").eq("user_id", uid).order("created_at", desc=True).limit(limite).execute()
        return r.data or []
    except Exception:
        return []


# ============ RECARGAR Y RETIRAR ============

def recargar_saldo(monto):
    restaurar_sesion()
    try:
        resp = supabase_client.rpc("recargar_saldo", {"p_monto": float(monto)}).execute()
        return resp.data
    except Exception as e:
        return {"success": False, "message": str(e)}


def retirar_saldo(monto):
    restaurar_sesion()
    try:
        resp = supabase_client.rpc("retirar_saldo", {"p_monto": float(monto)}).execute()
        return resp.data
    except Exception as e:
        return {"success": False, "message": str(e)}


def pagar_servicio(servicio, monto):
    restaurar_sesion()
    try:
        resp = supabase_client.rpc("pagar_servicio", {
            "p_servicio": servicio,
            "p_monto": float(monto),
        }).execute()
        return resp.data
    except Exception as e:
        return {"success": False, "message": str(e)}


# ============ ANALYTICS ============

def obtener_estadisticas_analytics(uid):
    restaurar_sesion()
    try:
        movs = obtener_movimientos(uid, 500)
        ingresos = sum(m["monto"] for m in movs if m["tipo"] == "ingreso")
        egresos = sum(m["monto"] for m in movs if m["tipo"] == "egreso")
        return {
            "total_ingresos": ingresos,
            "total_egresos": egresos,
            "balance": ingresos - egresos,
            "num_movimientos": len(movs),
        }
    except Exception:
        return {"total_ingresos": 0, "total_egresos": 0, "balance": 0, "num_movimientos": 0}


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
if "onboarding_ok" not in st.session_state:
    st.session_state["onboarding_ok"] = None


# ============ LOGIN ============

if st.session_state["user"] is None:
    st.title("💳 FlowCredit Digital")
    st.caption("Tu banco digital para emprendedores")
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
                    st.session_state["onboarding_ok"] = None

                    try:
                        meta = resp.user.user_metadata or {}
                        nombres_meta = meta.get("nombres", "")
                        apellidos_meta = meta.get("apellidos", "")
                        cedula_meta = meta.get("cedula", "")
                        telefono_meta = meta.get("telefono", "")

                        if nombres_meta or apellidos_meta:
                            guardar_datos_personales(
                                resp.user.id,
                                nombres_meta,
                                apellidos_meta,
                                cedula_meta,
                                telefono_meta,
                            )
                    except Exception:
                        pass

                    st.rerun()
            except Exception as e:
                st.error("Error: " + str(e))

    with tab2:
        st.caption("Minimo 8 caracteres con mayuscula, minuscula, numero y un simbolo.")
        with st.form("registro"):
            col_n1, col_n2 = st.columns(2)
            with col_n1:
                nombres_r = st.text_input("Nombres", key="r_nombres")
            with col_n2:
                apellidos_r = st.text_input("Apellidos", key="r_apellidos")

            col_c1, col_c2 = st.columns(2)
            with col_c1:
                cedula_r = st.text_input("Cedula", key="r_cedula", max_chars=15)
            with col_c2:
                telefono_r = st.text_input("Telefono", key="r_telefono", max_chars=15)

            email_r = st.text_input("Correo", key="r_email")
            pwd_r = st.text_input("Contrasena", type="password", key="r_pwd")
            pwd_r2 = st.text_input("Repite contrasena", type="password", key="r_pwd2")

            ok_r = st.form_submit_button("Crear cuenta", use_container_width=True)

        if ok_r:
            if not nombres_r or not apellidos_r:
                st.error("Debes escribir nombres y apellidos.")
            elif not cedula_r or not telefono_r:
                st.error("Debes escribir cedula y telefono.")
            elif not email_r:
                st.error("Debes escribir un correo.")
            elif pwd_r != pwd_r2:
                st.error("Las contrasenas no coinciden.")
            elif len(pwd_r) < 8:
                st.error("Minimo 8 caracteres.")
            else:
                try:
                    resp = supabase_client.auth.sign_up({
                        "email": email_r,
                        "password": pwd_r,
                        "options": {
                            "data": {
                                "nombres": nombres_r,
                                "apellidos": apellidos_r,
                                "cedula": cedula_r,
                                "telefono": telefono_r,
                            }
                        }
                    })
                    st.success("Cuenta creada. Revisa tu correo para confirmar.")
                except Exception as e:
                    st.error("Error: " + str(e))
    st.stop()


# ============ VARIABLES GLOBALES ============

uid = st.session_state["user"]["id"]
email = st.session_state["user"]["email"]
nombre = email.split("@")[0] if email else "Emprendedor"

# Datos personales del usuario
datos_personales = obtener_datos_personales(uid) or {}
nombre_real = (
    (datos_personales.get("nombres", "") or "") + " " +
    (datos_personales.get("apellidos", "") or "")
).strip()
nombre_display = nombre_real if nombre_real else nombre


# ============ ONBOARDING ============

if st.session_state["onboarding_ok"] is None:
    estado_onb = obtener_estado_onboarding(uid)
    st.session_state["onboarding_ok"] = estado_onb.get("onboarding_completado", False)

if not st.session_state["onboarding_ok"]:
    st.title("👋 Bienvenido a FlowCredit Digital")
    st.caption("Tu banco digital para emprendedores")
    st.divider()

    paso = st.session_state.get("onboarding_paso", 1)

    if paso == 1:
        st.subheader("💳 Todo un banco en tu bolsillo")
        st.write("FlowCredit Digital es tu banco digital completo: transferencias, tarjeta, ahorro, inversiones, seguros y creditos con IA.")
        if st.button("Siguiente", use_container_width=True, type="primary"):
            st.session_state["onboarding_paso"] = 2
            st.rerun()
    elif paso == 2:
        st.subheader("🤖 Inteligencia artificial")
        st.write("Analizamos tu flujo de caja digital y te damos creditos personalizados en menos de 24 horas.")
        if st.button("Siguiente", use_container_width=True, type="primary"):
            st.session_state["onboarding_paso"] = 3
            st.rerun()
    elif paso == 3:
        st.subheader("📋 7 productos Flow")
        st.write("FlowPay, FlowCard, FlowSave, FlowInvest, FlowShield, FlowBusiness y FlowCredit.")
        st.write("Todo en una sola app, disenada para emprendedores digitales.")
        if st.button("Empezar ahora", use_container_width=True, type="primary"):
            completar_onboarding(uid)
            st.session_state["onboarding_ok"] = True
            st.session_state["onboarding_paso"] = 1
            st.rerun()

    st.stop()


# ============ SIDEBAR ============

with st.sidebar:
    st.markdown("### 👤 " + nombre_display)
    st.caption(email)

    saldo_actual = obtener_saldo(uid)
    st.markdown("**Saldo:** $" + "{:,.0f}".format(saldo_actual).replace(",", "."))
    st.divider()

    no_leidas = len(obtener_notificaciones(uid, solo_no_leidas=True))
    etiqueta_notif = "🔔 Notificaciones"
    if no_leidas > 0:
        etiqueta_notif = "🔔 Notificaciones (" + str(no_leidas) + ")"

    menu = st.radio(
        "Menu",
        [
            "📊 Dashboard",
            "💸 FlowPay",
            "💳 FlowCard",
            "🏦 FlowSave",
            "📈 FlowInvest",
            "🛡️ FlowShield",
            "💼 FlowBusiness",
            "📊 FlowAnalytics",
            "🧮 Simulador",
            "🛡️ Verificacion",
            "💳 Solicitar credito",
            "💼 Mis creditos",
            "📄 Contrato",
            "📋 Movimientos",
            "📋 Historial",
            etiqueta_notif,
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
        for k in ["user", "access_token", "refresh_token", "resultado_actual", "datos_actuales", "credito_creado", "onboarding_ok"]:
            st.session_state.pop(k, None)
        st.rerun()


# ============ DASHBOARD ============

if menu == "📊 Dashboard":
    st.title("📊 Dashboard")
    st.caption("Vista general de tu banco digital")

    solicitudes = obtener_solicitudes(uid)
    creditos = obtener_creditos_activos(uid)
    saldo = obtener_saldo(uid)
    movs = obtener_movimientos(uid, 5)

    score_actual = 742
    if solicitudes:
        aprobadas = [s for s in solicitudes if s.get("decision") == "APROBADO"]
        if aprobadas:
            score_actual = aprobadas[0]["score"]

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Saldo disponible", "$" + "{:,.0f}".format(saldo).replace(",", "."))
    with col2:
        st.metric("Score crediticio", str(score_actual) + "/1000")
    with col3:
        st.metric("Creditos activos", len(creditos))
    with col4:
        st.metric("Solicitudes", len(solicitudes))

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

    if movs:
        st.subheader("📋 Ultimos movimientos")
        filas = []
        for m in movs:
            signo = "+" if m["tipo"] == "ingreso" else "-"
            monto_fmt = signo + "$" + "{:,.0f}".format(m["monto"]).replace(",", ".")
            filas.append({
                "Fecha": (m.get("created_at") or "")[:16].replace("T", " "),
                "Descripcion": m["descripcion"],
                "Monto": monto_fmt,
            })
        st.dataframe(pd.DataFrame(filas), use_container_width=True, hide_index=True)


# ============ FLOWPAY ============

elif menu == "💸 FlowPay":
    st.title("💸 FlowPay")
    st.caption("Transferencias digitales instantaneas")

    cuenta = obtener_cuenta(uid)
    saldo = float(cuenta["saldo"]) if cuenta else 0

    st.markdown("#### Tu cuenta")
    col_a, col_b, col_c = st.columns(3)
    with col_a:
        st.metric("Numero de cuenta", cuenta["numero_cuenta"] if cuenta else "N/A")
    with col_b:
        st.metric("Saldo disponible", "$" + "{:,.0f}".format(saldo).replace(",", "."))
    with col_c:
        st.metric("Estado", "🟢 Activa")

    st.divider()

    tab_enviar, tab_recargar, tab_retirar, tab_servicios, tab_historial = st.tabs([
        "📤 Enviar", "📥 Recargar", "💸 Retirar", "💡 Servicios", "📜 Historial"
    ])

    with tab_enviar:
        if saldo <= 0:
            st.warning("No tienes saldo disponible.")
        else:
            usuarios_reg = obtener_usuarios_registrados()
            otros = [u for u in usuarios_reg if u.get("user_id") != uid and u.get("email")]
            opciones_emails = [u["email"] for u in otros]

            with st.form("form_transferir"):
                modo = st.radio("Como elegir destinatario", ["De la lista", "Escribir correo"], horizontal=True)
                if modo == "De la lista":
                    if not opciones_emails:
                        st.warning("Aun no hay otros usuarios registrados.")
                        receptor = None
                    else:
                        receptor = st.selectbox("Destinatario", opciones_emails)
                else:
                    receptor = st.text_input("Correo del destinatario")

                monto = st.number_input("Monto (COP)", min_value=1000, max_value=int(saldo), value=min(100000, int(saldo)), step=1000)
                concepto = st.text_input("Concepto (opcional)", max_chars=80)
                enviar = st.form_submit_button("📤 Transferir", use_container_width=True, type="primary")

            if enviar:
                if not receptor:
                    st.error("Selecciona o escribe un destinatario.")
                elif receptor.strip().lower() == email.lower():
                    st.error("No puedes transferirte a ti mismo.")
                else:
                    with st.spinner("Procesando..."):
                        resultado = transferir(receptor.strip().lower(), monto, concepto or "Sin concepto")
                    if resultado and resultado.get("success"):
                        monto_fmt = "{:,.0f}".format(monto).replace(",", ".")
                        st.success("✅ Transferencia exitosa")
                        crear_notificacion(uid, "💸 Transferencia enviada", "Enviaste $" + monto_fmt + " a " + receptor, "success")
                        st.balloons()
                        st.rerun()
                    else:
                        st.error("❌ " + (resultado.get("message", "Error") if resultado else "Error"))

    with tab_recargar:
        st.subheader("Recargar saldo")
        with st.form("form_recargar"):
            monto_rec = st.number_input("Monto a recargar (COP)", min_value=10000, max_value=10000000, value=100000, step=10000)
            rec = st.form_submit_button("📥 Recargar", use_container_width=True, type="primary")
        if rec:
            resultado = recargar_saldo(monto_rec)
            if resultado and resultado.get("success"):
                st.success("✅ Recarga exitosa")
                st.rerun()
            else:
                st.error(resultado.get("message", "Error") if resultado else "Error")

    with tab_retirar:
        st.subheader("Retirar a banco externo")
        if saldo <= 0:
            st.warning("No tienes saldo disponible.")
        else:
            with st.form("form_retirar"):
                monto_ret = st.number_input("Monto a retirar (COP)", min_value=10000, max_value=int(saldo), value=min(50000, int(saldo)), step=10000)
                ret = st.form_submit_button("💸 Retirar", use_container_width=True, type="primary")
            if ret:
                resultado = retirar_saldo(monto_ret)
                if resultado and resultado.get("success"):
                    st.success("✅ Retiro exitoso")
                    st.rerun()
                else:
                    st.error(resultado.get("message", "Error") if resultado else "Error")

    with tab_servicios:
        st.subheader("Pagar servicios")
        servicios = [
            ("Claro", 45000), ("Movistar", 52000), ("Tigo", 38000),
            ("EPM", 85000), ("Netflix", 32000), ("Spotify", 18000),
        ]
        with st.form("form_servicio"):
            servicio_sel = st.selectbox("Servicio", [s[0] for s in servicios])
            monto_pago = st.number_input("Monto (COP)", min_value=1000, max_value=500000, value=45000, step=1000)
            pagar = st.form_submit_button("💡 Pagar", use_container_width=True, type="primary")
        if pagar:
            resultado = pagar_servicio(servicio_sel, monto_pago)
            if resultado and resultado.get("success"):
                st.success("✅ Pago exitoso")
                st.rerun()
            else:
                st.error(resultado.get("message", "Error") if resultado else "Error")

    with tab_historial:
        st.subheader("Movimientos recientes")
        transferencias = obtener_transferencias(uid)
        if not transferencias:
            st.info("Aun no has realizado transferencias.")
        else:
            filas = []
            for t in transferencias:
                es_emisor = t["emisor_id"] == uid
                monto_fmt = "{:,.0f}".format(t["monto"]).replace(",", ".")
                prefijo = "-$" if es_emisor else "+$"
                filas.append({
                    "Fecha": (t.get("created_at") or "")[:16].replace("T", " "),
                    "Tipo": "Enviado" if es_emisor else "Recibido",
                    "Contraparte": t["receptor_email"] if es_emisor else t["emisor_email"],
                    "Monto": prefijo + monto_fmt,
                    "Concepto": t.get("concepto", ""),
                })
            st.dataframe(pd.DataFrame(filas), use_container_width=True, hide_index=True)


# ============ FLOWCARD ============

elif menu == "💳 FlowCard":
    st.title("💳 FlowCard")
    st.caption("Tu tarjeta digital FlowCredit")

    tarjeta = obtener_tarjeta(uid)

    if not tarjeta:
        st.error("No se pudo cargar tu tarjeta.")
    else:
        estado = tarjeta.get("estado", "activa")
        color_bg = "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)" if estado == "activa" else "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)"

        st.markdown(
            '<div style="background:' + color_bg + ';color:white;border-radius:20px;padding:32px;max-width:420px;margin:auto;box-shadow:0 20px 60px rgba(15,23,42,0.4);">'
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:40px;">'
            '<span style="font-weight:900;font-size:18px;letter-spacing:1px;">FLOWCREDIT</span>'
            '<span style="font-size:26px;">💳</span>'
            '</div>'
            '<div style="font-size:22px;letter-spacing:3px;font-family:monospace;margin-bottom:32px;">' + tarjeta["numero"] + '</div>'
            '<div style="display:flex;justify-content:space-between;font-size:12px;">'
            '<div><div style="opacity:0.6;margin-bottom:4px;">TITULAR</div><div style="font-weight:700;">' + nombre_display.upper() + '</div></div>'
            '<div><div style="opacity:0.6;margin-bottom:4px;">VENCE</div><div style="font-weight:700;">' + str(tarjeta.get("fecha_expiracion", "")) + '</div></div>'
            '<div><div style="opacity:0.6;margin-bottom:4px;">CVV</div><div style="font-weight:700;">' + str(tarjeta.get("cvv", "")) + '</div></div>'
            '</div>'
            '<div style="margin-top:24px;text-align:right;font-weight:900;font-size:18px;">VISA</div>'
            '</div>',
            unsafe_allow_html=True
        )

        st.markdown("<br>", unsafe_allow_html=True)

        col_a, col_b = st.columns(2)
        with col_a:
            st.metric("Cupo total", "$" + "{:,.0f}".format(tarjeta["cupo_total"]).replace(",", "."))
        with col_b:
            st.metric("Cupo disponible", "$" + "{:,.0f}".format(tarjeta["cupo_disponible"]).replace(",", "."))

        st.divider()

        if estado == "activa":
            if st.button("🔒 Congelar tarjeta", use_container_width=True, type="primary"):
                if cambiar_estado_tarjeta(tarjeta["id"], "congelada"):
                    st.success("Tarjeta congelada")
                    st.rerun()
        else:
            if st.button("🔓 Descongelar tarjeta", use_container_width=True, type="primary"):
                if cambiar_estado_tarjeta(tarjeta["id"], "activa"):
                    st.success("Tarjeta activada")
                    st.rerun()


# ============ FLOWSAVE ============

elif menu == "🏦 FlowSave":
    st.title("🏦 FlowSave")
    st.caption("Ahorro programado para tus metas")

    saldo = obtener_saldo(uid)

    tab_ver, tab_crear = st.tabs(["🎯 Mis metas", "➕ Nueva meta"])

    with tab_ver:
        metas = obtener_metas(uid)
        if not metas:
            st.info("Aun no tienes metas de ahorro.")
        else:
            for meta in metas:
                progreso = meta["monto_actual"] / meta["monto_objetivo"] if meta["monto_objetivo"] > 0 else 0
                st.subheader(meta.get("icono", "🎯") + " " + meta["nombre"])
                col_a, col_b, col_c = st.columns(3)
                with col_a:
                    st.metric("Meta", "$" + "{:,.0f}".format(meta["monto_objetivo"]).replace(",", "."))
                with col_b:
                    st.metric("Ahorrado", "$" + "{:,.0f}".format(meta["monto_actual"]).replace(",", "."))
                with col_c:
                    st.metric("Progreso", "{:.1f}%".format(progreso * 100))
                st.progress(min(progreso, 1.0))

                if meta.get("fecha_limite"):
                    st.caption("📅 Fecha limite: " + str(meta["fecha_limite"]))

                if saldo > 0:
                    with st.form("aportar_" + str(meta["id"])):
                        monto_aporte = st.number_input("Aportar (COP)", min_value=10000, max_value=int(saldo), value=min(50000, int(saldo)), step=10000, key="ap_" + str(meta["id"]))
                        aportar = st.form_submit_button("💰 Aportar", use_container_width=True)
                    if aportar:
                        if aportar_meta(meta["id"], monto_aporte):
                            st.success("Aporte registrado")
                            st.rerun()

                st.divider()

    with tab_crear:
        with st.form("nueva_meta"):
            nombre_meta = st.text_input("Nombre de la meta")
            objetivo = st.number_input("Monto objetivo (COP)", min_value=50000, max_value=50000000, value=500000, step=50000)
            fecha_lim = st.date_input("Fecha limite")
            icono_meta = st.selectbox("Icono", ["🎯", "✈️", "🏠", "🚗", "💻", "📱", "🎓", "💍", "🏖️"])
            crear = st.form_submit_button("Crear meta", use_container_width=True, type="primary")
        if crear:
            if not nombre_meta:
                st.error("Escribe un nombre")
            else:
                if crear_meta(uid, nombre_meta, objetivo, str(fecha_lim), icono_meta):
                    st.success("Meta creada")
                    st.rerun()


# ============ FLOWINVEST ============

elif menu == "📈 FlowInvest":
    st.title("📈 FlowInvest")
    st.caption("Haz crecer tu dinero")

    inversiones = obtener_inversiones(uid)
    saldo = obtener_saldo(uid)

    productos_disponibles = [
        ("CDT Digital", 10.5, "Bajo riesgo, plazo 90 dias"),
        ("Fondo Conservador", 12.0, "Riesgo medio, liquidez inmediata"),
        ("Fondo Crecimiento", 15.5, "Riesgo alto, plazo 1 ano"),
        ("Portafolio Emprendedor", 18.0, "Diversificado, riesgo alto"),
    ]

    tab_ver, tab_invertir = st.tabs(["💼 Mis inversiones", "➕ Invertir"])

    with tab_ver:
        if not inversiones:
            st.info("Aun no tienes inversiones activas.")
        else:
            total_invertido = sum(i["monto_invertido"] for i in inversiones)
            total_actual = sum(i["valor_actual"] for i in inversiones)
            rendimiento = total_actual - total_invertido

            col_a, col_b, col_c = st.columns(3)
            with col_a:
                st.metric("Total invertido", "$" + "{:,.0f}".format(total_invertido).replace(",", "."))
            with col_b:
                st.metric("Valor actual", "$" + "{:,.0f}".format(total_actual).replace(",", "."))
            with col_c:
                st.metric("Rendimiento", "$" + "{:,.0f}".format(rendimiento).replace(",", "."))

            st.divider()

            for inv in inversiones:
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric(inv["producto"], "$" + "{:,.0f}".format(inv["monto_invertido"]).replace(",", "."))
                with col2:
                    st.metric("Rendimiento anual", str(inv["rendimiento_anual"]) + "%")
                with col3:
                    st.metric("Valor actual", "$" + "{:,.0f}".format(inv["valor_actual"]).replace(",", "."))
                st.divider()

    with tab_invertir:
        st.subheader("Productos disponibles")

        for nombre_prod, rend, desc in productos_disponibles:
            st.markdown("**" + nombre_prod + "** — " + str(rend) + "% anual")
            st.caption(desc)

        st.divider()

        if saldo <= 0:
            st.warning("No tienes saldo para invertir.")
        else:
            with st.form("nueva_inversion"):
                producto_sel = st.selectbox("Producto", [p[0] for p in productos_disponibles])
                monto_inv = st.number_input("Monto (COP)", min_value=100000, max_value=int(saldo), value=min(100000, int(saldo)), step=100000)
                invertir = st.form_submit_button("💰 Invertir", use_container_width=True, type="primary")

            if invertir:
                rend_sel = [p[1] for p in productos_disponibles if p[0] == producto_sel][0]
                if crear_inversion(uid, producto_sel, monto_inv, rend_sel):
                    retirar_saldo(monto_inv)
                    st.success("Inversion creada")
                    st.rerun()


# ============ FLOWSHIELD ============

elif menu == "🛡️ FlowShield":
    st.title("🛡️ FlowShield")
    st.caption("Seguros digitales para emprendedores")

    seguros = obtener_seguros(uid)

    tipos_seguro = [
        ("Vida", 50000000, 45000),
        ("Negocio", 20000000, 28000),
        ("Fraude digital", 5000000, 12000),
        ("Incendio/Hurto", 15000000, 22000),
        ("Salud", 10000000, 35000),
    ]

    tab_ver, tab_contratar = st.tabs(["📋 Mis polizas", "➕ Contratar"])

    with tab_ver:
        if not seguros:
            st.info("No tienes polizas activas.")
        else:
            for s in seguros:
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Tipo", s["tipo"])
                with col2:
                    st.metric("Cobertura", "$" + "{:,.0f}".format(s["cobertura"]).replace(",", "."))
                with col3:
                    st.metric("Prima mensual", "$" + "{:,.0f}".format(s["prima_mensual"]).replace(",", "."))
                st.divider()

    with tab_contratar:
        for tipo, cobertura, prima in tipos_seguro:
            st.markdown("**Seguro de " + tipo + "** — Cobertura hasta $" + "{:,.0f}".format(cobertura).replace(",", ".") + " — $" + "{:,.0f}".format(prima).replace(",", ".") + "/mes")

        st.divider()

        with st.form("contratar_seguro"):
            tipo_sel = st.selectbox("Tipo de seguro", [t[0] for t in tipos_seguro])
            contratar = st.form_submit_button("Contratar poliza", use_container_width=True, type="primary")

        if contratar:
            info = [t for t in tipos_seguro if t[0] == tipo_sel][0]
            if contratar_seguro(uid, tipo_sel, info[1], info[2]):
                st.success("Poliza contratada")
                st.rerun()


# ============ FLOWBUSINESS ============

elif menu == "💼 FlowBusiness":
    st.title("💼 FlowBusiness")
    st.caption("Cuenta empresarial para tu negocio")

    cuentas_emp = obtener_cuentas_empresariales(uid)

    tab_ver, tab_crear = st.tabs(["🏢 Mis cuentas", "➕ Nueva cuenta"])

    with tab_ver:
        if not cuentas_emp:
            st.info("Aun no tienes cuentas empresariales.")
        else:
            for c in cuentas_emp:
                st.subheader("🏢 " + c["nombre_negocio"])
                col_a, col_b, col_c = st.columns(3)
                with col_a:
                    st.metric("NIT", c.get("nit", "N/A"))
                with col_b:
                    st.metric("Categoria", c.get("categoria", "General"))
                with col_c:
                    st.metric("Saldo", "$" + "{:,.0f}".format(c["saldo"]).replace(",", "."))
                st.divider()

    with tab_crear:
        with st.form("nueva_empresa"):
            nombre_neg = st.text_input("Nombre del negocio")
            nit_neg = st.text_input("NIT (opcional)")
            categoria_neg = st.selectbox("Categoria", ["E-commerce", "Servicios", "Tecnologia", "Alimentos", "Moda", "Educacion", "Otro"])
            crear_c = st.form_submit_button("Crear cuenta empresarial", use_container_width=True, type="primary")
        if crear_c:
            if not nombre_neg:
                st.error("Escribe el nombre del negocio")
            else:
                if crear_cuenta_empresarial(uid, nombre_neg, nit_neg, categoria_neg):
                    st.success("Cuenta empresarial creada")
                    st.rerun()


# ============ FLOWANALYTICS ============

elif menu == "📊 FlowAnalytics":
    st.title("📊 FlowAnalytics")
    st.caption("Analisis financiero de tu actividad")

    stats = obtener_estadisticas_analytics(uid)

    col_a, col_b, col_c, col_d = st.columns(4)
    with col_a:
        st.metric("Ingresos", "$" + "{:,.0f}".format(stats["total_ingresos"]).replace(",", "."))
    with col_b:
        st.metric("Egresos", "$" + "{:,.0f}".format(stats["total_egresos"]).replace(",", "."))
    with col_c:
        st.metric("Balance", "$" + "{:,.0f}".format(stats["balance"]).replace(",", "."))
    with col_d:
        st.metric("Movimientos", stats["num_movimientos"])

    st.divider()

    movs = obtener_movimientos(uid, 100)

    if movs:
        df = pd.DataFrame(movs)
        df["fecha"] = df["created_at"].str[:10]

        agrupado = df.groupby(["fecha", "tipo"])["monto"].sum().reset_index()

        fig = go.Figure()
        for tipo in ["ingreso", "egreso"]:
            datos_tipo = agrupado[agrupado["tipo"] == tipo]
            color = "#10b981" if tipo == "ingreso" else "#ef4444"
            fig.add_trace(go.Bar(
                x=datos_tipo["fecha"],
                y=datos_tipo["monto"],
                name=tipo.capitalize(),
                marker_color=color,
            ))
        fig.update_layout(barmode="group", title="Flujo de movimientos", plot_bgcolor="white", height=400)
        st.plotly_chart(fig, use_container_width=True)

        st.subheader("Por categoria")
        if "categoria" in df.columns:
            df_cat = df[df["categoria"].notna()]
            if not df_cat.empty:
                por_cat = df_cat.groupby("categoria")["monto"].sum().sort_values(ascending=False)
                fig2 = go.Figure(data=[go.Pie(labels=por_cat.index, values=por_cat.values, hole=0.4)])
                fig2.update_layout(height=400)
                st.plotly_chart(fig2, use_container_width=True)
    else:
        st.info("No hay movimientos para analizar.")


# ============ SIMULADOR ============

elif menu == "🧮 Simulador":
    st.title("🧮 Simulador de credito")
    st.caption("Calcula tu cuota antes de solicitarla")

    cliente = obtener_cliente_demo(email)
    ingresos_base = int(cliente["ingresos_declarados"]) if cliente else 3000000

    col1, col2 = st.columns(2)
    with col1:
        monto_sim = st.slider("Monto (COP)", min_value=100000, max_value=5000000, value=1000000, step=100000)
    with col2:
        plazo_sim = st.select_slider("Plazo (dias)", options=[30, 60, 90, 120, 180], value=90)

    if cliente:
        score = cliente["score_datacredito"]
        if score >= 800:
            tasa_est = 10.0
        elif score >= 700:
            tasa_est = 13.0
        elif score >= 600:
            tasa_est = 16.0
        else:
            tasa_est = 19.0
    else:
        tasa_est = 16.0

    st.info("📊 Tasa estimada: **" + str(tasa_est) + "% anual**")

    plan = simular_credito(monto_sim, plazo_sim, tasa_est)

    st.divider()
    col_a, col_b, col_c = st.columns(3)
    with col_a:
        st.metric("Cuotas", plan["num_cuotas"])
    with col_b:
        st.metric("Valor por cuota", "$" + "{:,.0f}".format(plan["valor_cuota"]).replace(",", "."))
    with col_c:
        st.metric("Total a pagar", "$" + "{:,.0f}".format(plan["total_pagar"]).replace(",", "."))

    col_d, col_e = st.columns(2)
    with col_d:
        st.metric("Total intereses", "$" + "{:,.0f}".format(plan["total_intereses"]).replace(",", "."))
    with col_e:
        porcentaje_ingresos = (plan["valor_cuota"] / ingresos_base * 100) if ingresos_base > 0 else 0
        st.metric("Cuota / Ingresos", "{:.1f}%".format(porcentaje_ingresos))

    if porcentaje_ingresos > 30:
        st.warning("⚠️ La cuota supera el 30% de tus ingresos.")
    else:
        st.success("✅ La cuota esta dentro de tu capacidad de pago")

    st.divider()
    st.subheader("📊 Calculadora de capacidad de pago")
    cap = calcular_capacidad_pago(ingresos_base)

    col_f, col_g, col_h = st.columns(3)
    with col_f:
        st.metric("Ingresos", "$" + "{:,.0f}".format(ingresos_base).replace(",", "."))
    with col_g:
        st.metric("Egresos est.", "$" + "{:,.0f}".format(int(cap["egresos_estimados"])).replace(",", "."))
    with col_h:
        st.metric("Capacidad max.", "$" + "{:,.0f}".format(int(cap["capacidad_maxima"])).replace(",", "."))

    if cap["semaforo"] == "verde":
        st.success("🟢 " + cap["mensaje"])
    elif cap["semaforo"] == "amarillo":
        st.warning("🟡 " + cap["mensaje"])
    else:
        st.error("🔴 " + cap["mensaje"])


# ============ VERIFICACION ============

elif menu == "🛡️ Verificacion":
    st.title("🛡️ Verificacion de identidad")
    st.caption("Verifica tu identidad con reconocimiento facial")

    cliente = obtener_cliente_demo(email)

    if not cliente:
        st.warning("No se encontraron datos demo precargados para tu correo.")
    else:
        st.success("✅ Identidad Verificada")
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Nombre", cliente["nombre_completo"])
            st.metric("Cedula", cliente["cedula"])
            st.metric("Telefono", cliente["telefono"])
        with col2:
            st.metric("Ciudad", cliente["ciudad"])
            st.metric("Ocupacion", cliente["ocupacion"])
            st.metric("Score", cliente["score_datacredito"])

    st.divider()
    st.subheader("🔐 Verificacion biometrica")
    st.info("Toma una foto de tu rostro de frente, con buena luz.")

    foto = st.camera_input("📸 Toma una foto")

    if foto is not None:
        imagen_bytes = foto.getvalue()
        with st.spinner("Analizando rostro..."):
            tiene_rostro, cantidad = detectar_rostro(imagen_bytes)

        if not tiene_rostro:
            st.error("❌ No se reconoce un rostro.")
        else:
            st.success("✅ Rostro detectado (" + str(cantidad) + ")")
            with st.spinner("Guardando..."):
                url = subir_foto_verificacion(uid, imagen_bytes)
                if url:
                    guardar_verificacion(uid, url, "verificado")
                    st.success("🎉 Identidad verificada")
                    st.balloons()

    st.divider()
    st.subheader("🔑 Codigo de recuperacion")

    codigo_info = obtener_codigo_recuperacion(uid)
    if codigo_info and codigo_info.get("recovery_code"):
        st.warning("⚠️ Guarda este codigo.")
        st.code(codigo_info["recovery_code"], language=None)
    else:
        if st.button("🔐 Generar codigo de recuperacion", use_container_width=True, type="primary"):
            codigo = guardar_codigo_recuperacion(uid)
            if codigo:
                st.success("Codigo generado")
                st.rerun()


# ============ SOLICITAR CREDITO ============

elif menu == "💳 Solicitar credito":
    st.title("💳 Solicitar credito")
    st.caption("Analisis con IA en menos de 24 horas")

    cliente = obtener_cliente_demo(email)
    if cliente:
        st.success("✅ " + cliente["nombre_completo"] + " | " + cliente["cedula"] + " | Score " + str(cliente["score_datacredito"]))
    elif nombre_real:
        st.success("✅ " + nombre_real + " | " + str(datos_personales.get("cedula", "")))

    if st.session_state["resultado_actual"] is None:
        ingresos_default = int(cliente["ingresos_declarados"]) if cliente else 3000000

        with st.form("solicitud"):
            col1, col2 = st.columns(2)
            with col1:
                tipo = st.selectbox("Tipo de negocio", ["E-commerce", "Creador de contenido", "Servicios digitales", "SaaS / App", "Marketing digital", "Otro"])
                ingresos = st.number_input("Ingresos mensuales (COP)", min_value=500000, max_value=50000000, value=ingresos_default, step=100000)
                meses = st.number_input("Meses con el negocio", min_value=1, max_value=120, value=12)
            with col2:
                monto = st.number_input("Monto solicitado (COP)", min_value=100000, max_value=5000000, value=1000000, step=100000)
                plazo = st.selectbox("Plazo", [30, 60, 90, 120, 180], format_func=lambda x: str(x) + " dias")
                historial = st.selectbox("Historial", ["Sin historial", "1 credito pagado", "2-3 creditos pagados", "Mas de 3 creditos"])

            fuentes = st.multiselect("Fuentes digitales", ["Stripe", "Nequi", "Daviplata", "PayPal", "Wompi", "Mercado Pago"], default=["Stripe", "Nequi"])
            enviado = st.form_submit_button("🔍 Analizar con IA", use_container_width=True, type="primary")

        if enviado:
            if not fuentes:
                st.warning("Conecta al menos una fuente.")
            else:
                datos = {"tipo": tipo, "ingresos": ingresos, "meses": meses, "monto": monto, "plazo": plazo, "historial": historial, "fuentes": ", ".join(fuentes)}
                with st.spinner("Analizando..."):
                    try:
                        texto_ia = analizar_con_ia(datos)
                        resultado = parsear_respuesta(texto_ia, ingresos=ingresos)
                    except Exception as e:
                        st.error("Error: " + str(e))
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
            st.success("✅ APROBADO")
        elif decision == "RECHAZADO":
            st.error("❌ RECHAZADO")
        else:
            st.warning("⏳ EN REVISION")

        if decision == "APROBADO" and not st.session_state.get("credito_creado", False):
            solicitudes = obtener_solicitudes(uid)
            if solicitudes:
                ultima = solicitudes[0]
                credito_id = crear_credito(uid, ultima["id"], resultado["monto_aprobado"], resultado["tasa_anual"], datos["plazo"])
                if credito_id:
                    st.session_state["credito_creado"] = True
                    monto_str = "{:,.0f}".format(resultado["monto_aprobado"]).replace(",", ".")
                    crear_notificacion(uid, "🎉 Credito aprobado", "Tu credito por $" + monto_str + " fue aprobado.", "success")
                    st.info("💼 Credito registrado.")

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Score", str(resultado["score"]) + "/1000")
        with col2:
            st.metric("Monto", "$" + "{:,.0f}".format(resultado["monto_aprobado"]).replace(",", "."))
        with col3:
            st.metric("Tasa", str(resultado["tasa_anual"]) + "%")

        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number",
            value=resultado["score"],
            title={"text": "Score"},
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
        fig_gauge.update_layout(height=280)
        st.plotly_chart(fig_gauge, use_container_width=True)

        st.subheader("📋 Razones")
        for i, razon in enumerate(resultado["razones"], 1):
            st.markdown("**" + str(i) + ".** " + razon)

        if st.button("🔄 Solicitar otro credito", use_container_width=True):
            st.session_state["resultado_actual"] = None
            st.session_state["datos_actuales"] = None
            st.session_state["credito_creado"] = False
            st.rerun()


# ============ MIS CREDITOS ============

elif menu == "💼 Mis creditos":
    st.title("💼 Mis creditos")

    creditos = obtener_todos_creditos(uid)

    if not creditos:
        st.info("No tienes creditos registrados.")
    else:
        for cred in creditos:
            icono = "🟢" if cred["estado"] == "activo" else "✅"
            st.subheader(icono + " Credito #" + str(cred["id"]))

            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Monto", "$" + "{:,.0f}".format(cred["monto_aprobado"]).replace(",", "."))
            with col2:
                st.metric("Tasa", str(cred["tasa_anual"]) + "%")
            with col3:
                st.metric("Saldo", "$" + "{:,.0f}".format(cred["saldo_pendiente"]).replace(",", "."))
            with col4:
                st.metric("Cuotas", str(cred["cuotas_pagadas"]) + "/" + str(cred["num_cuotas"]))

            st.progress(cred["cuotas_pagadas"] / cred["num_cuotas"])

            cuotas = obtener_cuotas(cred["id"])

            with st.expander("📋 Plan de pagos"):
                filas = []
                for c in cuotas:
                    filas.append({
                        "N": c["numero"],
                        "Valor": "$" + "{:,.0f}".format(c["valor"]).replace(",", "."),
                        "Vencimiento": c["fecha_vencimiento"],
                        "Estado": "✅" if c["estado"] == "pagada" else "⏳",
                    })
                st.dataframe(pd.DataFrame(filas), use_container_width=True, hide_index=True)

            pendientes = [c for c in cuotas if c["estado"] == "pendiente"]
            if pendientes:
                siguiente = pendientes[0]
                st.info("📅 Proxima cuota: " + str(siguiente["numero"]) + " - Vence " + siguiente["fecha_vencimiento"] + " - $" + "{:,.0f}".format(siguiente["valor"]).replace(",", "."))
                if st.button("💳 Pagar cuota " + str(siguiente["numero"]), key="pagar_" + str(cred["id"])):
                    if pagar_cuota(siguiente["id"], cred["id"]):
                        valor_str = "{:,.0f}".format(siguiente["valor"]).replace(",", ".")
                        crear_notificacion(uid, "✅ Pago recibido", "Pago cuota " + str(siguiente["numero"]) + " por $" + valor_str, "success")
                        st.success("✅ Pagada")
                        st.balloons()
                        st.rerun()
            else:
                st.success("🎉 Pagado completamente")

            st.divider()


# ============ CONTRATO ============

elif menu == "📄 Contrato":
    st.title("📄 Contratos")

    creditos = obtener_todos_creditos(uid)

    if not creditos:
        st.info("No tienes creditos.")
    else:
        cliente = obtener_cliente_demo(email)
        for cred in creditos:
            st.subheader("Contrato Credito #" + str(cred["id"]))
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Monto", "$" + "{:,.0f}".format(cred["monto_aprobado"]).replace(",", "."))
            with col2:
                st.metric("Tasa", str(cred["tasa_anual"]) + "%")
            with col3:
                st.metric("Cuotas", str(cred["num_cuotas"]))

            cuotas = obtener_cuotas(cred["id"])

            if st.button("📥 Generar contrato PDF", key="pdf_" + str(cred["id"]), type="primary"):
                with st.spinner("Generando..."):
                    pdf_bytes = generar_contrato_pdf(cliente, cred, cuotas, datos_personales)
                if pdf_bytes:
                    st.download_button(
                        "⬇️ Descargar contrato",
                        data=pdf_bytes,
                        file_name="contrato_" + str(cred["id"]) + ".pdf",
                        mime="application/pdf",
                        key="dl_" + str(cred["id"]),
                    )
            st.divider()


# ============ MOVIMIENTOS ============

elif menu == "📋 Movimientos":
    st.title("📋 Movimientos")

    movs = obtener_movimientos(uid, 200)

    if not movs:
        st.info("Aun no tienes movimientos.")
    else:
        filas = []
        for m in movs:
            signo = "+" if m["tipo"] == "ingreso" else "-"
            monto_fmt = signo + "$" + "{:,.0f}".format(m["monto"]).replace(",", ".")
            filas.append({
                "Fecha": (m.get("created_at") or "")[:16].replace("T", " "),
                "Tipo": "🟢 Ingreso" if m["tipo"] == "ingreso" else "🔴 Egreso",
                "Descripcion": m["descripcion"],
                "Monto": monto_fmt,
            })
        st.dataframe(pd.DataFrame(filas), use_container_width=True, hide_index=True)


# ============ HISTORIAL ============

elif menu == "📋 Historial":
    st.title("📋 Historial de solicitudes")

    solicitudes = obtener_solicitudes(uid)

    if not solicitudes:
        st.info("Aun no hay solicitudes.")
    else:
        filas = []
        for s in solicitudes:
            filas.append({
                "Fecha": (s.get("created_at") or "")[:10],
                "Solicitado": "$" + "{:,.0f}".format(s["monto_solicitado"]).replace(",", "."),
                "Aprobado": "$" + "{:,.0f}".format(s.get("monto_aprobado") or 0).replace(",", "."),
                "Score": s.get("score", 0),
                "Decision": s.get("decision", ""),
                "Tasa": str(s.get("tasa_sugerida", 0)) + "%",
            })
        st.dataframe(pd.DataFrame(filas), use_container_width=True, hide_index=True)


# ============ NOTIFICACIONES ============

elif menu.startswith("🔔"):
    st.title("🔔 Notificaciones")

    notifs = obtener_notificaciones(uid)

    if not notifs:
        st.info("No tienes notificaciones.")
    else:
        no_leidas = sum(1 for n in notifs if not n.get("leida"))
        if no_leidas > 0:
            st.warning("Tienes " + str(no_leidas) + " sin leer")
            if st.button("✅ Marcar todas", use_container_width=True):
                marcar_todas_leidas(uid)
                st.rerun()

        st.divider()

        for n in notifs:
            icono = "📬" if not n.get("leida") else "📭"
            col_a, col_b = st.columns([5, 1])
            with col_a:
                titulo_estilo = "**" + n["titulo"] + "**" if not n.get("leida") else n["titulo"]
                st.markdown(icono + " " + titulo_estilo)
                st.caption(n["mensaje"])
                st.caption("🕒 " + (n.get("created_at") or "")[:16].replace("T", " "))
            with col_b:
                if not n.get("leida"):
                    if st.button("✓", key="leer_" + str(n["id"])):
                        marcar_notificacion_leida(n["id"])
                        st.rerun()
            st.divider()


# ============ TERMINOS ============

elif menu == "📜 Terminos":
    st.title("📜 Terminos y privacidad")

    with st.expander("Terminos de uso", expanded=True):
        st.markdown("""
        **1. Aceptacion**
        Al usar FlowCredit Digital aceptas los presentes terminos.

        **2. Naturaleza**
        Prototipo demostrativo. No presta dinero real.

        **3. Datos**
        Tratamos tus datos conforme a la Ley 1581 de 2012.

        **4. Uso de IA**
        Motor de decision con inteligencia artificial.
        """)

    with st.expander("Politica de datos"):
        st.markdown("""
        **Responsable:** FlowCredit Digital - SENA 2026

        **Datos recolectados:** Nombre, email, datos financieros, foto facial.

        **Derechos:** Conocer, actualizar, rectificar, revocar.

        **Contacto:** privacidad@flowcredit.com
        """)

    estado = obtener_estado_onboarding(uid)
    if not estado.get("terminos_aceptados"):
        if st.button("✅ Acepto los terminos", use_container_width=True, type="primary"):
            if aceptar_terminos(uid):
                st.success("Terminos aceptados")
                st.rerun()
    else:
        st.success("✅ Ya aceptaste los terminos")
