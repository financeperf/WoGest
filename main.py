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
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
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

# --------------------------------------
# CONFIGURACIÓN GENERAL
# --------------------------------------
# Detectar si está ejecutando desde .exe
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS  # Solo para lectura de recursos
else:
    BASE_DIR = os.path.dirname(__file__)

TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

# ✅ Carpetas seguras para lectura/escritura
USER_HOME = os.path.expanduser("~")
EXPORTS_DIR = os.path.join(USER_HOME, 'Documents', 'WOGest', 'exports')
TEMP_DIR = os.path.join(tempfile.gettempdir(), 'WOGest')
LOG_DIR = os.path.join(USER_HOME, 'Documents', 'WOGest', 'logs')
# Asegurar que Bottle pueda encontrar las plantillas
TEMPLATE_PATH.insert(0, TEMPLATES_DIR)

# Configurar logging
os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(LOG_DIR, 'wogest.log')),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# --------------------------------------
# SERVIDOR BOTTLE
# --------------------------------------
app_web = Bottle()

@app_web.route('/') # type: ignore
def index():
    logger.info("Accediendo a ruta raíz (home)")
    return template('components/home.html')

@app_web.route('/home') # type: ignore
def home():
    logger.info("Renderizando home.html")
    return template('components/home.html')

@app_web.route('/step1') # type: ignore
def step1():
    logger.info("Renderizando step1.html")
    return template('components/step1.html')

@app_web.route('/step2') # type: ignore
def step2():
    logger.info("Renderizando step2.html")
    return template('components/step2.html')

@app_web.route('/step3')# type: ignore
def step3():
    logger.info("Renderizando step3.html")
    return template('components/step3.html')

@app_web.route('/step4') # type: ignore
def step4():
    logger.info("Renderizando step4.html")
    return template('components/step4.html')

@app_web.route('/static/<filepath:path>')# type: ignore
def serve_static(filepath):
    logger.debug(f"Sirviendo archivo estático: {filepath}")
    return static_file(filepath, root=STATIC_DIR)

@app_web.route('/health')# type: ignore
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
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    extensiones_permitidas: Optional[List[str]] = None

    def __post_init__(self):
        if self.extensiones_permitidas is None:
            # Permitir .csv, .txt y archivos sin extensión para WOQ
 
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
            return {
                "paso1_procesado": not df1.empty,
                "paso2_procesado": not df2.empty
            }
        except Exception as e:
            return {
                "paso1_procesado": False,
                "paso2_procesado": False,
                "error": str(e)
            }
    def __init__(self, config: ConfiguracionApp):
        self.config = config
        self._archivos_temporales = []
        self._inicializar_directorios()
        # Registro explícito de la ruta POST para procesar_paso2
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
            # Crear registro con todas las columnas del DataFrame
            registro = {}
            
            # Incluir todas las columnas del DataFrame original
            for col in df.columns:
                value = row.get(col, "")
                if pd.notna(value):
                    # Manejar campos numéricos con decimales
                    if col.lower() in ['cantidad', 'precio', 'cuota'] and isinstance(value, (int, float)):
                        registro[col.lower()] = float(value) if value != 0 else 0.0
                    # Manejar fechas - convertir a solo fecha sin hora
                    elif col.lower() == 'fecha' and isinstance(value, (pd.Timestamp, datetime)):
                        registro[col.lower()] = value.strftime('%Y-%m-%d')
                    elif col.lower() == 'fecha' and isinstance(value, str):
                        # Intentar parsear fecha si es string
                        try:
                            fecha_obj = pd.to_datetime(value)
                            registro[col.lower()] = fecha_obj.strftime('%Y-%m-%d')
                        except:
                            registro[col.lower()] = str(value)
                    else:
                        registro[col.lower()] = str(value)
                else:
                    # Valores por defecto para campos importantes
                    if col.lower() in ['cantidad', 'precio', 'cuota']:
                        registro[col.lower()] = 0.0
                    else:
                        registro[col.lower()] = ""
            
            # Asegurar que las columnas principales estén presentes para compatibilidad
            registro["rpa"] = "Sí" if row.get("estado") == "Correcto" else "No"
            
            detalle.append(registro)

        return detalle

    def _generar_estadisticas_frontend(self, df: pd.DataFrame) -> Dict[str, Any]:
        if df is None or df.empty:
            return {
                "total": 0,
                "correctos": 0,
                "incorrectos": 0,
                "advertencias": 0
            }

        total = len(df)
        correctos = len(df[df["estado"] == "Correcto"])
        incorrectos = len(df[df["estado"] == "Incorrecto"])
        advertencias = len(df[df["estado"] == "Advertencia"]) if "Advertencia" in df["estado"].values else 0

        return {
            "total": total,
            "correctos": correctos,
            "incorrectos": incorrectos,
            "advertencias": advertencias
        }

    def validar_archivo_workorder(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        print("🟢 ENTRANDO en validar_archivo_workorder() desde frontend JS")
        try:
            nombre = payload.get("nombre")
            base64_data = payload.get("base64")
            logger.info("📥 Recibido archivo para validación: %s", nombre)

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
            logger.info("🚀 Llamando controlador.validar_archivo_workorder()...")
            success, msg, backend_stats = controlador.validar_archivo_workorder(temp_file)
            logger.info("✅ Validación completa: %s - %s", success, msg)

            if not success:
                return {
                    "success": False,
                    "message": msg,
                    "detalle": [],
                    "estadisticas": {
                        "total": 0,
                        "correctos": 0,
                        "incorrectos": 0,
                        "advertencias": 0
                    }
                }

            df_validado = controlador.obtener_dataframe_validado()

            if df_validado is None:
                logger.warning("⚠️ No se pudo obtener DataFrame validado")
                return {
                    "success": False,
                    "message": "Error: No se pudieron obtener los datos validados",
                    "detalle": [],
                    "estadisticas": {
                        "total": 0,
                        "correctos": 0,
                        "incorrectos": 0,
                        "advertencias": 0
                    }
                }

            detalle = self._convertir_dataframe_a_detalle(df_validado)
            estadisticas = self._generar_estadisticas_frontend(df_validado)
            logger.info("📊 Datos convertidos - Total registros: %d", len(detalle))
            logger.info("📊 Estadísticas: %s", estadisticas)
            return {
                "success": True,
                "message": msg,
                "detalle": detalle,
                "estadisticas": estadisticas
            }

        except Exception as e:
            logger.exception("❌ Error inesperado durante validación:")
            return {
                "success": False,
                "message": f"Error: {str(e)}",
                "detalle": [],
                "estadisticas": {
                    "total": 0,
                    "correctos": 0,
                    "incorrectos": 0,
                    "advertencias": 0
                }
            }

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
            return {
                "success": True,
                "message": "Estado guardado correctamente",
                "archivo": archivo_estado
            }

        except Exception as e:
            logger.exception("❌ Error al guardar estado del paso 1")
            return {
                "success": False,
                "message": f"Error al guardar estado: {str(e)}"
            }

    def exportar_excel(self, datos_validacion: Dict[str, Any]) -> Dict[str, Any]:
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            nombre_archivo = f"validacion_resultado_{timestamp}.xlsx"
            ruta_destino = os.path.join(self.config.directorio_exports, nombre_archivo)

            success, message = exportar_resultado_validacion(ruta_destino, 'xlsx')

            if success:
                logger.info("📊 Excel exportado exitosamente: %s", ruta_destino)
                return {
                    "success": True,
                    "message": f"Archivo exportado como {nombre_archivo}",
                    "archivo": ruta_destino
                }
            else:
                return {
                    "success": False,
                    "message": message
                }

        except Exception as e:
            logger.exception("❌ Error al exportar Excel")
            return {
                "success": False,
                "message": f"Error al exportar Excel: {str(e)}"
            }

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
        """Abre diálogo para seleccionar carpeta de exportación"""
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
        """Exporta Excel a la ruta especificada"""
        try:
            # Obtener datos
            datos = payload.get("datos", {})
            detalle = datos.get("detalle", [])
            
            if not detalle:
                return {"success": False, "message": "No hay datos para exportar"}
            
            # Crear DataFrame
            df = pd.DataFrame(detalle)
            
            # Obtener carpeta destino
            carpeta_destino = payload.get("carpeta_destino")
            if not carpeta_destino:
                # Si no se especifica carpeta, usar Downloads (sin import os duplicado)
                carpeta_destino = os.path.join(os.path.expanduser("~"), "Downloads")
            
            # Crear nombre de archivo con timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            nombre_archivo = f"validacion_resultado_{timestamp}.xlsx"
            ruta_final = os.path.join(carpeta_destino, nombre_archivo)
            
            # Exportar Excel
            df.to_excel(ruta_final, index=False)
            
            return {
                "success": True, 
                "archivo": ruta_final,
                "message": f"Archivo exportado exitosamente como: {nombre_archivo}"
            }
            
        except Exception as e:
            return {"success": False, "message": f"Error al exportar: {str(e)}"}

    def abrir_carpeta_archivo(self, ruta_archivo: str) -> dict:
        """Abre la carpeta que contiene el archivo exportado"""
        try:
            import subprocess
            import platform
            
            # Obtener solo la carpeta del archivo
            carpeta = os.path.dirname(ruta_archivo)
            
            sistema = platform.system()
            if sistema == "Windows":
                subprocess.run(["explorer", carpeta])
            elif sistema == "Darwin":  # macOS
                subprocess.run(["open", carpeta])
            else:  # Linux
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

            return {"data": df.to_dict(orient='records')}

        except Exception as e:
            return {"error": str(e)}
    # Dentro de la clase WOGestAPI

    def procesar_archivo_woq(self, payload: dict) -> dict:
        logger.info("✅ [procesar_archivo_woq] llamado desde frontend")

        try:
            nombre = payload.get("nombre")
            base64_data = payload.get("base64")

            if not nombre or not base64_data:
                return {"success": False, "message": "Nombre o contenido faltante", "detalle": []}

            decoded = base64.b64decode(base64_data)

            # Guardar archivo
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

            # ✅ Asegurar ES_CERRADO → es_cerrado como SI/NO
            if "ES_CERRADO" in df.columns:
                df["ES_CERRADO"] = df["ES_CERRADO"].map({True: "SI", False: "NO"})
                df.rename(columns={"ES_CERRADO": "es_cerrado"}, inplace=True)

            detalle = df.fillna("").to_dict(orient="records")

            return {
                "success": True,
                "message": f"Archivo procesado: {len(detalle)} registros",
                "detalle": detalle
            }

        except Exception as e:
            logger.exception("❌ Error en procesar_archivo_woq")
            return {"success": False, "message": str(e), "detalle": []}

    def exportar_woq(self, datos_woq: list) -> dict:
        """Exporta datos WOQ a Excel"""
        try:
            logger.info("✅ [exportar_woq] llamado desde frontend")
            
            if not datos_woq or len(datos_woq) == 0:
                return {"success": False, "message": "No hay datos para exportar"}
            
            # Crear DataFrame
            df = pd.DataFrame(datos_woq)
            
            # Crear nombre de archivo con timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            nombre_archivo = f"woq_exportado_{timestamp}.xlsx"
            
            # Usar carpeta Downloads del usuario
            carpeta_destino = os.path.join(os.path.expanduser("~"), "Downloads")
            ruta_final = os.path.join(carpeta_destino, nombre_archivo)
            
            # Exportar Excel
            df.to_excel(ruta_final, index=False)
            
            logger.info("📊 WOQ exportado exitosamente: %s", ruta_final)
            
            return {
                "success": True, 
                "filepath": ruta_final,
                "message": f"Archivo exportado exitosamente como: {nombre_archivo}"
            }
            
        except Exception as e:
            logger.exception("❌ Error en exportar_woq")
            return {"success": False, "message": f"Error al exportar: {str(e)}"}

    def realizar_cruce_datos(self) -> dict:
        """Realiza el cruce de datos entre paso1 y paso2"""
        try:
            logger.info("✅ [realizar_cruce_datos] Iniciando cruce de datos")
            
            # Leer datos de ambos pasos desde SQLite
            from procesamiento.db_sqlite import leer_temp_paso1, leer_temp_paso2
            df1 = leer_temp_paso1()  # WorkOrder data
            df2 = leer_temp_paso2()  # WOQ data
            
            if df1.empty:
                return {"success": False, "message": "No hay datos del Paso 1 (WorkOrder)"}
            
            if df2.empty:
                return {"success": False, "message": "No hay datos del Paso 2 (WOQ)"}
            
            logger.info(f"📊 Datos paso1: {len(df1)} registros, paso2: {len(df2)} registros")
            
            # ✅ Delegar al Paso 3 real (paso3.py) para mantener estructura Paso 2 + columnas nuevas
            from procesamiento.paso3 import realizar_cruce_datos as cruce_p3

            datos_paso1 = df1.to_dict(orient="records")
            datos_paso2 = df2.to_dict(orient="records")

            resultado = cruce_p3(datos_paso1, datos_paso2)

            # Retornar tal cual lo que define paso3.py
            return resultado
            
        except Exception as e:
            logger.exception("❌ Error en realizar_cruce_datos")
            return {
                "success": False, 
                "message": f"Error al realizar el cruce: {str(e)}",
                "datos_cruzados": [],
                "estadisticas": {}
            }

# --------------------------------------
# FUNCIÓN PRINCIPAL
# --------------------------------------
def aplicar_icono_con_reintentos():
    """Aplica el ícono con múltiples reintentos."""
    max_intentos = 3
    for intento in range(1, max_intentos + 1):
        logger.info(f"🔄 Intento {intento} de {max_intentos} para aplicar ícono")
        try:
            result = aplicar_icono_directo()
            if result:
                logger.info(f"✅ Ícono aplicado exitosamente en intento {intento}")
                return True
        except Exception as e:
            print(f"❌ Error en intento {intento}: {e}")
        
        if intento < max_intentos:
            import time
            time.sleep(1)  # Esperar 1 segundo antes del siguiente intento
    
    logger.info("❌ No se pudo aplicar el ícono después de todos los intentos")
    return False

def aplicar_icono_directo():
    """Función principal que aplica el ícono - devuelve True si tiene éxito."""
    """Aplica un ícono personalizado a la ventana en Windows."""
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
        
        # Para WinForms/Chromium, necesitamos acceder de manera diferente
        try:
            # Método específico para WinForms
            if hasattr(window, 'gui') and window.gui:
                # Intentar acceso directo al formulario WinForms
                if hasattr(window.gui, 'form'):
                    form = window.gui.form
                    if form and hasattr(form, 'Icon'):
                        # Usar System.Drawing.Icon para cargar el ícono
                        import clr
                        clr.AddReference("System.Drawing")
                        from System.Drawing import Icon
                        
                        form.Icon = Icon(icon_path)
                        logger.info("✅ Ícono aplicado usando WinForms Icon")
                        return True
                elif hasattr(window.gui, 'window'):
                    # Método alternativo para obtener el handle
                    hwnd = None
                    if hasattr(window.gui.window, 'hwnd'):
                        hwnd = window.gui.window.hwnd
                    elif hasattr(window.gui.window, 'Handle'):
                        hwnd = int(window.gui.window.Handle)
                    
                    if hwnd:
                        logger.info(f"🔍 Handle de ventana encontrado: {hwnd}")
                        
                        # Cargar íconos con tamaños específicos
                        hicon_large = ctypes.windll.user32.LoadImageW(
                            0, icon_path, 1, 32, 32, 0x00000010  # IMAGE_ICON, LR_LOADFROMFILE
                        )
                        hicon_small = ctypes.windll.user32.LoadImageW(
                            0, icon_path, 1, 16, 16, 0x00000010
                        )
                        
                        if hicon_large and hicon_small:
                            # WM_SETICON = 0x80, ICON_BIG = 1, ICON_SMALL = 0
                            result1 = ctypes.windll.user32.SendMessageW(hwnd, 0x80, 1, hicon_large)
                            result2 = ctypes.windll.user32.SendMessageW(hwnd, 0x80, 0, hicon_small)
                            logger.info(f"✅ Ícono aplicado con SendMessage. Resultados: {result1}, {result2}")
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
            print(f"⚠️ No se pudo importar .NET Framework: {e}")
        except Exception as e:
            print(f"❌ Error en método WinForms: {e}")
            
        # Método de respaldo usando FindWindow
        try:
            logger.info("🔍 Intentando método de respaldo con FindWindow...")
            
            # Buscar ventana por título
            window_title = "WOGest – Validación de Renovaciones"
            hwnd = ctypes.windll.user32.FindWindowW(None, window_title)
            
            if hwnd:
                logger.info(f"🔍 Ventana encontrada con FindWindow: {hwnd}")
                
                hicon = ctypes.windll.user32.LoadImageW(
                    0, icon_path, 1, 0, 0, 0x00000010  # Usar tamaño por defecto
                )
                
                if hicon:
                    # Aplicar ícono usando SetClassLongPtr
                    result = ctypes.windll.user32.SetClassLongPtrW(hwnd, -14, hicon)  # GCL_HICON
                    logger.info(f"✅ Ícono aplicado con SetClassLongPtr. Resultado: {result}")
                    
                    # También intentar con SendMessage
                    ctypes.windll.user32.SendMessageW(hwnd, 0x80, 1, hicon)
                    ctypes.windll.user32.SendMessageW(hwnd, 0x80, 0, hicon)
                    logger.info("✅ Ícono también aplicado con SendMessage")
                    return True
                else:
                    logger.info("❌ No se pudo cargar el ícono con LoadImage")
            else:
                logger.info("❌ No se encontró la ventana con FindWindow")
                
        except Exception as e:
            print(f"❌ Error en método de respaldo: {e}")
            
    except Exception as e:
        print(f"❌ Error general aplicando ícono: {e}")
    
    return False

def main():
    config = ConfiguracionApp()
    api = WOGestAPI(config)

    def lanzar_servidor():
        app_web.run(host='localhost', port=58833, quiet=True)

    threading.Thread(target=lanzar_servidor, daemon=True).start()
    time.sleep(1.5)

    # Ruta del ícono
    icon_path = os.path.join(STATIC_DIR, "img", "icon.ico")
    
    # Crear la ventana - usar el parámetro shadow para aplicar ícono automáticamente
    webview.create_window(
        config.titulo,
        config.template_principal,
        width=config.width,
        height=config.height,
        resizable=True,
        confirm_close=True,
        on_top=False,
        js_api=api,
        shadow=True  # Esto puede ayudar con la aplicación del ícono
    )

    # Usar un timer para aplicar el ícono después de que la ventana esté lista
    if platform.system() == "Windows" and os.path.exists(icon_path):
        logger.info(f"📁 Ruta del ícono: {icon_path}")
        logger.info(f"✅ Archivo de ícono encontrado: {os.path.exists(icon_path)}")
        # Aplicar ícono con reintentos después de darle tiempo a la ventana de inicializarse
        timer = threading.Timer(2.5, aplicar_icono_con_reintentos)
        timer.start()
    else:
        logger.info("⚠️ No se aplicará ícono: Sistema no Windows o archivo no encontrado")

    # Iniciar webview
    webview.start(debug=True, gui='edgechromium')


if __name__ == "__main__":
    main()
