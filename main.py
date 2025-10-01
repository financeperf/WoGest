import os
import logging
import threading
import time
import base64
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from bottle import Bottle, static_file, template, TEMPLATE_PATH
import webview
import pandas as pd
import json
import subprocess
import ctypes
import platform
import tempfile
import sys
import io
# Forzar codificación UTF-8 solo si hay consola
if sys.stdout and hasattr(sys.stdout, "buffer") and sys.stdout.isatty():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# --------------------------------------
# IMPORTAR COMPONENTES DEL SISTEMA
# --------------------------------------
from controlador import (
    controlador,
    obtener_resumen_validacion,
    exportar_resultado_validacion,
    limpiar_estado_validacion,
    obtener_estadisticas_validacion
)
from procesamiento.db_sqlite import init_db, get_db_path

# --- util JSON safe ---
import math
from datetime import datetime, date

def _json_safe(value):
    try:
        import pandas as pd, numpy as np
    except Exception:
        pd = None; np = None

    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if pd is not None:
        try:
            if pd.isna(value):
                return None
        except Exception:
            pass
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value

# --------------------------------------
# CONFIGURACIÓN GENERAL
# --------------------------------------
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(__file__)

TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

EXPORTS_DIR = os.path.join(BASE_DIR, 'datos', 'exports')
TEMP_DIR = os.path.join(BASE_DIR, 'datos', 'temp')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

os.makedirs(EXPORTS_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

TEMPLATE_PATH.insert(0, TEMPLATES_DIR)

handlers = [
    logging.FileHandler(os.path.join(LOG_DIR, 'wogest.log'), encoding='utf-8')
]
if sys.stdout and not sys.stdout.closed:
    try:
        if sys.stdout.isatty():
            handlers.append(logging.StreamHandler(sys.stdout))
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=handlers
)

logger = logging.getLogger(__name__)

# --------------------------------------
# SERVIDOR BOTTLE
# --------------------------------------
app_web = Bottle()

@app_web.route('/')
def index():
    return template('components/home.html')

@app_web.route('/home')
def home():
    return template('components/home.html')

@app_web.route('/step1')
def step1():
    return template('components/step1.html')

@app_web.route('/step2')
def step2():
    return template('components/step2.html')

@app_web.route('/step3')
def step3():
    return template('components/step3.html')

@app_web.route('/step4')
def step4():
    return template('components/step4.html')

@app_web.route('/static/<filepath:path>')
def serve_static(filepath):
    logger.debug(f"Sirviendo archivo estático: {filepath}")
    return static_file(filepath, root=STATIC_DIR)

@app_web.route('/health')
def health():
    return {
        "status": "OK",
        "templates": TEMPLATES_DIR,
        "static": STATIC_DIR
    }

# --------------------------------------
# CONFIGURACIÓN DE APLICACIÓN
# --------------------------------------
@dataclass
class ConfiguracionApp:
    titulo: str = "WOGest – Validación de Renovaciones"
    width: int = 1200
    height: int = 800
    template_principal: str = "http://127.0.0.1:58833/"
    directorio_temp: str = TEMP_DIR
    directorio_logs: str = LOG_DIR
    directorio_exports: str = EXPORTS_DIR
    max_file_size: int = 50 * 1024 * 1024
    extensiones_permitidas: Optional[List[str]] = None

    def __post_init__(self):
        if self.extensiones_permitidas is None:
            self.extensiones_permitidas = ['.xlsx', '.xls', '.csv', '.txt', '']

# --------------------------------------
# API JS PARA WEBVIEW
# --------------------------------------
class WOGestAPI:
    def obtener_estado_global(self):
        try:
            from procesamiento.db_sqlite import leer_temp_paso1, leer_temp_paso2
            df1 = leer_temp_paso1()
            df2 = leer_temp_paso2()
            
            # Calcular estadísticas para paso1 y paso2
            total_registros_paso1 = len(df1) if not df1.empty else 0
            total_registros_paso2 = len(df2) if not df2.empty else 0
            
            return {
                "paso1_procesado": not df1.empty,
                "paso2_procesado": not df2.empty,
                "total_registros_paso1": total_registros_paso1,
                "total_registros_paso2": total_registros_paso2
            }
        except Exception as e:
            return {
                "paso1_procesado": False,
                "paso2_procesado": False,
                "total_registros_paso1": 0,
                "total_registros_paso2": 0,
                "error": str(e)
            }
    def obtener_datos_para_rpa(self) -> dict:
        try:
            from procesamiento.db_sqlite import leer_temp_paso1, leer_temp_paso2
            from procesamiento.paso3 import realizar_cruce_datos as cruce_p3

            df1 = leer_temp_paso1()
            df2 = leer_temp_paso2()

            if df1.empty:
                return {"success": False, "message": "No hay datos del Paso 1 (WorkOrder)"}
            if df2.empty:
                return {"success": False, "message": "No hay datos del Paso 2 (WOQ)"}

            datos_p1 = df1.to_dict(orient="records")
            datos_p2 = df2.to_dict(orient="records")
            resultado = cruce_p3(datos_p1, datos_p2)

            if not resultado.get("success"):
                return {"success": False, "message": resultado.get("message", "Error en cruce")}

            datos = resultado.get("datos_cruzados", [])
            return _json_safe({
                "success": True,
                "registros_rpa": datos,
                "estadisticas": resultado.get("estadisticas", {}),
                "total_registros": len(datos)
            })
        except Exception as e:
            return {"success": False, "message": str(e)}

    def __init__(self, config: ConfiguracionApp):
        self.config = config
        self._archivos_temporales = []
        self._inicializar_directorios()
        app_web.route('/procesar_paso2', method='POST')(self.procesar_paso2)
        logger.info("API inicializada")

    def _inicializar_directorios(self):
        for d in [self.config.directorio_temp, self.config.directorio_logs, self.config.directorio_exports]:
            Path(d).mkdir(parents=True, exist_ok=True)

    def _convertir_dataframe_a_detalle(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        if df is None or df.empty:
            return []

        detalle = []
        for index, row in df.iterrows():
            registro = {}
            for col in df.columns:
                value = row.get(col, "")
                if pd.notna(value):
                    if col.lower() in ['cantidad', 'precio', 'cuota'] and isinstance(value, (int, float)):
                        registro[col.lower()] = float(value) if value != 0 else 0.0
                    elif col.lower() == 'fecha' and isinstance(value, (pd.Timestamp, datetime)):
                        registro[col.lower()] = value.strftime('%Y-%m-%d')
                    elif col.lower() == 'fecha' and isinstance(value, str):
                        try:
                            fecha_obj = pd.to_datetime(value)
                            registro[col.lower()] = fecha_obj.strftime('%Y-%m-%d')
                        except:
                            registro[col.lower()] = str(value)
                    else:
                        registro[col.lower()] = str(value)
                else:
                    if col.lower() in ['cantidad', 'precio', 'cuota']:
                        registro[col.lower()] = 0.0
                    else:
                        registro[col.lower()] = ""
            registro["rpa"] = "Sí" if row.get("estado") == "Correcto" else "No"
            detalle.append(registro)
        return detalle

    def _generar_estadisticas_frontend(self, df: pd.DataFrame) -> Dict[str, Any]:
        if df is None or df.empty:
            return {"total": 0, "correctos": 0, "incorrectos": 0, "advertencias": 0}

        total = len(df)
        correctos = len(df[df["estado"] == "Correcto"])
        incorrectos = len(df[df["estado"] == "Incorrecto"])
        advertencias = len(df[df["estado"] == "Advertencia"]) if "Advertencia" in df["estado"].values else 0

        return {"total": total, "correctos": correctos, "incorrectos": incorrectos, "advertencias": advertencias}

    def validar_archivo_workorder(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            nombre = payload.get("nombre")
            base64_data = payload.get("base64")
            logger.info("📥 Recibido archivo WorkOrder: %s", nombre)

            if not nombre or not base64_data:
                logger.warning("⚠️ Nombre o contenido faltante")
                return {"success": False, "message": "Nombre o contenido faltante"}

            extension = Path(nombre).suffix.lower()
            extensiones_permitidas = self.config.extensiones_permitidas or []
            if extension not in extensiones_permitidas:
                if extension == '':
                    logger.info("📝 No hay extensión. Se asignará '.xlsx' por defecto")
                    extension = '.xlsx'
                else:
                    logger.warning("⚠️ Extensión no permitida: %s", extension)
                    return {"success": False, "message": "Extensión no permitida"}

            decoded = base64.b64decode(base64_data)
            if len(decoded) > self.config.max_file_size:
                logger.warning("⚠️ Archivo demasiado grande: %s bytes", len(decoded))
                return {"success": False, "message": "Archivo demasiado grande"}

            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            temp_file = os.path.join(
                self.config.directorio_temp,
                f"{Path(nombre).stem}_{timestamp}{extension}"
            )
            with open(temp_file, 'wb') as f:
                f.write(decoded)
            logger.info("📄 Archivo temporal guardado en: %s", temp_file)
            self._archivos_temporales.append(temp_file)

            logger.info("🚀 Validando archivo con controlador...")
            success, msg, backend_stats = controlador.validar_archivo_workorder(temp_file)
            logger.info("✅ Validación WorkOrder completada: %s - %s", success, msg)

            if not success:
                return {"success": False, "message": msg, "detalle": [],
                        "estadisticas": {"total": 0, "correctos": 0, "incorrectos": 0, "advertencias": 0}}

            df_validado = controlador.obtener_dataframe_validado()
            if df_validado is None:
                logger.warning("⚠️ No se pudo obtener DataFrame validado")
                return {"success": False, "message": "Error: No se pudieron obtener los datos validados",
                        "detalle": [], "estadisticas": {"total": 0, "correctos": 0, "incorrectos": 0, "advertencias": 0}}

            detalle = self._convertir_dataframe_a_detalle(df_validado)
            estadisticas = self._generar_estadisticas_frontend(df_validado)
            logger.info("📊 Total registros procesados: %d", len(detalle))
            return {"success": True, "message": msg, "detalle": detalle, "estadisticas": estadisticas}

        except Exception as e:
            logger.exception("❌ Error inesperado durante validación")
            return {"success": False, "message": f"Error: {str(e)}", "detalle": [],
                    "estadisticas": {"total": 0, "correctos": 0, "incorrectos": 0, "advertencias": 0}}
    def guardar_estado_paso1(self, datos_validacion: Dict[str, Any]) -> Dict[str, Any]:
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            archivo_estado = os.path.join(
                self.config.directorio_temp,
                f"estado_paso1_{timestamp}.json"
            )
            with open(archivo_estado, 'w', encoding='utf-8') as f:
                json.dump(datos_validacion, f, ensure_ascii=False, indent=2)

            logger.info("💾 Estado del paso 1 guardado en: %s", archivo_estado)
            return {"success": True, "message": "Estado guardado correctamente", "archivo": archivo_estado}

        except Exception as e:
            logger.exception("❌ Error al guardar estado del paso 1")
            return {"success": False, "message": f"Error al guardar estado: {str(e)}"}

    def exportar_excel(self, datos_validacion: Dict[str, Any]) -> Dict[str, Any]:
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            nombre_archivo = f"validacion_resultado_{timestamp}.xlsx"
            ruta_destino = os.path.join(self.config.directorio_exports, nombre_archivo)

            success, message = exportar_resultado_validacion(ruta_destino, 'xlsx')
            if success:
                logger.info("📊 Excel exportado exitosamente: %s", ruta_destino)
                return {"success": True, "message": f"Archivo exportado como {nombre_archivo}", "archivo": ruta_destino}
            else:
                return {"success": False, "message": message}

        except Exception as e:
            logger.exception("❌ Error al exportar Excel")
            return {"success": False, "message": f"Error al exportar Excel: {str(e)}"}

    def limpiar_estado(self) -> Dict[str, Any]:
        try:
            limpiar_estado_validacion()
            for archivo in self._archivos_temporales:
                if os.path.exists(archivo):
                    os.remove(archivo)
            self._archivos_temporales.clear()
            return {"success": True, "message": "Estado limpiado"}
        except Exception as e:
            logger.exception("Error limpiando estado")
            return {"success": False, "message": str(e)}

    def seleccionar_directorio_exportacion(self) -> dict:
        try:
            carpeta = webview.windows[0].create_file_dialog(
                webview.FOLDER_DIALOG,
                allow_multiple=False,
                directory=self.config.directorio_exports
            )
            if carpeta and len(carpeta) > 0:
                return {"success": True, "ruta": carpeta[0]}
            else:
                return {"success": False, "message": "Selección cancelada"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def exportar_excel_con_ruta(self, payload: dict) -> dict:
        import pandas as pd
        from datetime import datetime
        import os
        try:
            datos = payload.get("datos", {}) or {}
            detalle = datos.get("detalle", [])
            if not detalle:
                return {"success": False, "message": "No hay datos para exportar"}

            carpeta_destino = payload.get("carpeta_destino") or os.path.join(os.path.expanduser("~"), "Downloads")
            contexto = (datos.get("contexto") or "").lower()
            prefix_map = {"step1_p1": "WorkOrder_P1_", "step2_p2": "WOQ_P2_", "step3_p3": "Cruce_P3_", "step4_rpa": "Aptos_RPA_P4_"}
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")

            if contexto == "step4_rpa":
                def _val(dic, *keys):
                    for k in keys:
                        if k in dic and dic[k] is not None:
                            return str(dic[k]).strip()
                    return ""

                def _es_cerrado(dic):
                    v = _val(dic, "es_cerrado", "ES_CERRADO", "woq_es_cerrado", "WOQ_ES_CERRADO", "woq_cerrado", "WOQ_CERRADO").upper()
                    if v in ("1", "SI", "SÍ", "TRUE", "YES"): return 1
                    if v in ("0", "NO", "FALSE"): return 0
                    return 0

                def _apto(dic):
                    v = _val(dic, "Apto RPA", "APTO_RPA", "apto_rpa").upper()
                    if v in ("SI", "SÍ", "TRUE", "YES", "1"): return "SÍ"
                    if v in ("NO", "FALSE", "0"): return "NO"
                    return ""

                def _estado(dic):
                    return _val(dic, "Estado_Paso1", "estado_paso1").upper()

                def _wo(dic):
                    return _val(dic, "WO", "wo", "N_WO", "N°_WO", "N_WO2")

                def _orden(dic):
                    return _val(dic, "ORDEN_CONTRATO", "CONTRATO", "woq_contrato", "WOQ_CONTRATO")

                filas = []
                for r in detalle:
                    if _es_cerrado(r) != 0: continue
                    if _estado(r) != "CORRECTO": continue
                    if _apto(r) != "SÍ": continue
                    filas.append({"WO": _wo(r), "ORDEN_CONTRATO": _orden(r)})

                if not filas:
                    return {"success": False, "message": "No hay registros que cumplan las condiciones del Paso 4."}

                df = pd.DataFrame(filas)
                nombre_archivo = f"{prefix_map['step4_rpa']}{ts}.xlsx"
                ruta_final = os.path.join(carpeta_destino, nombre_archivo)
                df.to_excel(ruta_final, index=False)
                try:
                    from procesamiento.db_sqlite import limpiar_tablas_temporales
                    limpiar_tablas_temporales()
                except Exception as e:
                    logging.getLogger(__name__).warning(f"No se pudieron limpiar temporales: {e}")

                return {"success": True, "archivo": ruta_final, "message": f"Archivo exportado: {nombre_archivo}",
                        "total_registros": len(filas), "redirect_home": True}

            df = pd.DataFrame(detalle)
            nombre_archivo = f"{prefix_map.get(contexto, 'validacion_resultado_')}{ts}.xlsx"
            ruta_final = os.path.join(carpeta_destino, nombre_archivo)
            df.to_excel(ruta_final, index=False)
            return {"success": True, "archivo": ruta_final, "message": f"Archivo exportado como: {nombre_archivo}"}

        except Exception as e:
            return {"success": False, "message": f"Error al exportar: {str(e)}"}

    def abrir_carpeta_archivo(self, ruta_archivo: str) -> dict:
        try:
            import subprocess
            import platform
            carpeta = os.path.dirname(ruta_archivo)
            sistema = platform.system()
            if sistema == "Windows":
                subprocess.run(["explorer", carpeta])
            elif sistema == "Darwin":
                subprocess.run(["open", carpeta])
            else:
                subprocess.run(["xdg-open", carpeta])
            return {"success": True, "message": "Carpeta abierta"}
        except Exception as e:
            return {"success": False, "message": f"Error al abrir carpeta: {str(e)}"}

    def procesar_paso2(self):
        try:
            upload = app_web.request.files.get('archivo')
            if not upload:
                return {"error": "No se recibió archivo"}

            nombre_archivo = upload.filename
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            nombre_archivo_unico = f"{Path(nombre_archivo).stem}_{timestamp}{Path(nombre_archivo).suffix}"
            ruta_guardado = os.path.join(self.config.directorio_temp, nombre_archivo_unico)
            upload.save(ruta_guardado)

            from procesamiento.paso2 import procesar_woq
            df = procesar_woq(ruta_guardado)
            if df is None:
                return {"error": "Error al procesar el archivo"}

            return _json_safe({"data": df.to_dict(orient='records')})

        except Exception as e:
            return {"error": str(e)}

    def procesar_archivo_woq(self, payload: dict) -> dict:
        logger.info("✅ [procesar_archivo_woq] llamado desde frontend")
        try:
            nombre = payload.get("nombre")
            base64_data = payload.get("base64")
            if not nombre or not base64_data:
                return {"success": False, "message": "Nombre o contenido faltante", "detalle": []}

            decoded = base64.b64decode(base64_data)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            extension = Path(nombre).suffix.lower()
            nombre_archivo = f"woq_{timestamp}{extension or '.csv'}"
            ruta = os.path.join(self.config.directorio_temp, nombre_archivo)
            with open(ruta, 'wb') as f:
                f.write(decoded)

            from procesamiento.paso2 import procesar_woq
            df = procesar_woq(ruta)
            if df is None or df.empty:
                return {"success": False, "message": "Archivo sin datos", "detalle": []}

            if "ES_CERRADO" in df.columns:
                df["ES_CERRADO"] = df["ES_CERRADO"].map({True: "SI", False: "NO"})
                df.rename(columns={"ES_CERRADO": "es_cerrado"}, inplace=True)

            detalle = df.fillna("").to_dict(orient="records")
            return _json_safe({"success": True, "message": f"Archivo procesado: {len(detalle)} registros", "detalle": detalle})

        except Exception as e:
            logger.exception("❌ Error en procesar_archivo_woq")
            return {"success": False, "message": str(e), "detalle": []}

    def exportar_woq(self, datos_woq: list) -> dict:
        try:
            logger.info("✅ [exportar_woq] llamado desde frontend")
            if not datos_woq or len(datos_woq) == 0:
                return {"success": False, "message": "No hay datos para exportar"}

            df = pd.DataFrame(datos_woq)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            nombre_archivo = f"woq_exportado_{timestamp}.xlsx"
            carpeta_destino = os.path.join(os.path.expanduser("~"), "Downloads")
            ruta_final = os.path.join(carpeta_destino, nombre_archivo)
            df.to_excel(ruta_final, index=False)

            logger.info("📊 WOQ exportado exitosamente: %s", ruta_final)
            return {"success": True, "filepath": ruta_final, "message": f"Archivo exportado exitosamente como: {nombre_archivo}"}

        except Exception as e:
            logger.exception("❌ Error en exportar_woq")
            return {"success": False, "message": f"Error al exportar: {str(e)}"}

    def realizar_cruce_datos(self) -> dict:
        try:
            logger.info("✅ [realizar_cruce_datos] Iniciando cruce de datos")
            from procesamiento.db_sqlite import leer_temp_paso1, leer_temp_paso2
            df1 = leer_temp_paso1()
            df2 = leer_temp_paso2()

            if df1.empty:
                return {"success": False, "message": "No hay datos del Paso 1 (WorkOrder)"}
            if df2.empty:
                return {"success": False, "message": "No hay datos del Paso 2 (WOQ)"}

            logger.info(f"📊 Datos paso1: {len(df1)} registros, paso2: {len(df2)} registros")
            from procesamiento.paso3 import realizar_cruce_datos as cruce_p3
            datos_paso1 = df1.to_dict(orient="records")
            datos_paso2 = df2.to_dict(orient="records")
            resultado = cruce_p3(datos_paso1, datos_paso2)
            return _json_safe(resultado)

        except Exception as e:
            logger.exception("❌ Error en realizar_cruce_datos")
            return {"success": False, "message": f"Error al realizar el cruce: {str(e)}", "datos_cruzados": [], "estadisticas": {}}
# --------------------------------------
# FUNCIÓN PRINCIPAL
# --------------------------------------
def aplicar_icono_con_reintentos():
    """Aplica el ícono con múltiples reintentos."""
    max_intentos = 3
    for intento in range(1, max_intentos + 1):
        try:
            result = aplicar_icono_directo()
            if result:
                logger.info(f"✅ Ícono aplicado exitosamente en intento {intento}")
                return True
        except Exception as e:
            logger.error(f"❌ Error en intento {intento}: {e}")

        if intento < max_intentos:
            time.sleep(1)

    logger.info("❌ No se pudo aplicar el ícono después de todos los intentos")
    return False

def aplicar_icono_directo():
    """Función principal que aplica el ícono - devuelve True si tiene éxito."""
    try:
        if platform.system() != "Windows":
            return False

        if not webview.windows:
            logger.info("❌ No hay ventanas disponibles")
            return False

        window = webview.windows[0]
        icon_path = os.path.join(STATIC_DIR, "img", "icon.ico")

        if not os.path.exists(icon_path):
            logger.info(f"❌ No se encontró el archivo de ícono: {icon_path}")
            return False

        logger.info(f"🔍 Intentando aplicar ícono desde: {icon_path}")

        try:
            if hasattr(window, 'gui') and window.gui:
                if hasattr(window.gui, 'form'):
                    form = window.gui.form
                    if form and hasattr(form, 'Icon'):
                        import clr
                        clr.AddReference("System.Drawing")
                        from System.Drawing import Icon
                        form.Icon = Icon(icon_path)
                        logger.info("✅ Ícono aplicado usando WinForms Icon")
                        return True
                elif hasattr(window.gui, 'window'):
                    hwnd = None
                    if hasattr(window.gui.window, 'hwnd'):
                        hwnd = window.gui.window.hwnd
                    elif hasattr(window.gui.window, 'Handle'):
                        hwnd = int(window.gui.window.Handle)

                    if hwnd:
                        logger.info(f"🔍 Handle de ventana encontrado: {hwnd}")
                        hicon_large = ctypes.windll.user32.LoadImageW(
                            0, icon_path, 1, 32, 32, 0x00000010
                        )
                        hicon_small = ctypes.windll.user32.LoadImageW(
                            0, icon_path, 1, 16, 16, 0x00000010
                        )
                        if hicon_large and hicon_small:
                            ctypes.windll.user32.SendMessageW(hwnd, 0x80, 1, hicon_large)
                            ctypes.windll.user32.SendMessageW(hwnd, 0x80, 0, hicon_small)
                            logger.info("✅ Ícono aplicado con SendMessage")
                            return True
                        else:
                            logger.info("❌ No se pudieron cargar los íconos con LoadImage")
                    else:
                        logger.info("❌ No se pudo obtener el handle de la ventana")
                else:
                    logger.info("❌ No se encontró form o window en gui")
            else:
                logger.info("❌ No se pudo acceder al objeto gui de la ventana")
        except ImportError as e:
            logger.warning(f"⚠️ No se pudo importar .NET Framework: {e}")
        except Exception as e:
            logger.error(f"❌ Error en método WinForms: {e}")

        try:
            logger.info("🔍 Intentando método de respaldo con FindWindow...")
            window_title = "WOGest – Validación de Renovaciones"
            hwnd = ctypes.windll.user32.FindWindowW(None, window_title)
            if hwnd:
                logger.info(f"🔍 Ventana encontrada con FindWindow: {hwnd}")
                hicon = ctypes.windll.user32.LoadImageW(
                    0, icon_path, 1, 0, 0, 0x00000010
                )
                if hicon:
                    ctypes.windll.user32.SetClassLongPtrW(hwnd, -14, hicon)
                    ctypes.windll.user32.SendMessageW(hwnd, 0x80, 1, hicon)
                    ctypes.windll.user32.SendMessageW(hwnd, 0x80, 0, hicon)
                    logger.info("✅ Ícono aplicado con SetClassLongPtr y SendMessage")
                    return True
                else:
                    logger.info("❌ No se pudo cargar el ícono con LoadImage")
            else:
                logger.info("❌ No se encontró la ventana con FindWindow")
        except Exception as e:
            logger.error(f"❌ Error en método de respaldo: {e}")

    except Exception as e:
        logger.error(f"❌ Error general aplicando ícono: {e}")

    return False

def main():
    config = ConfiguracionApp()
    api = WOGestAPI(config)

    def lanzar_servidor():
        app_web.run(host='localhost', port=58833, quiet=True)

    threading.Thread(target=lanzar_servidor, daemon=True).start()
    time.sleep(1.5)

    icon_path = os.path.join(STATIC_DIR, "img", "icon.ico")

    logger.info(f"[WOGest] SQLite en: {get_db_path()}")
    init_db()

    webview.create_window(
        config.titulo,
        config.template_principal,
        width=config.width,
        height=config.height,
        resizable=True,
        confirm_close=True,
        on_top=False,
        js_api=api,
        shadow=True
    )

    if platform.system() == "Windows" and os.path.exists(icon_path):
        logger.info(f"📁 Ruta del ícono: {icon_path}")
        timer = threading.Timer(2.5, aplicar_icono_con_reintentos)
        timer.start()
    else:
        logger.info("⚠️ No se aplicará ícono: Sistema no Windows o archivo no encontrado")

    webview.start(debug=True, gui='edgechromium')

if __name__ == "__main__":
    main()
