import os
import logging
import pandas as pd
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
from threading import Lock

from procesamiento.paso1 import validar_renovaciones, validator, ValidationResult

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class EstadoValidacion:
    """Clase para encapsular el estado de validación"""
    archivo_procesado: str
    timestamp: datetime
    df_validado: Optional[pd.DataFrame]
    mensaje: str
    estadisticas: Dict[str, Any]
    success: bool
    
    def to_dict(self) -> Dict[str, Any]:
        """Convierte el estado a diccionario para serialización"""
        return {
            'archivo_procesado': self.archivo_procesado,
            'timestamp': self.timestamp.isoformat(),
            'total_registros': len(self.df_validado) if self.df_validado is not None else 0,
            'mensaje': self.mensaje,
            'estadisticas': self.estadisticas,
            'success': self.success
        }

class ControladorValidacion:
    """Controlador mejorado para validación de archivos WorkOrder"""
    
    def __init__(self):
        self._estado_validacion: Optional[EstadoValidacion] = None
        self._lock = Lock()  # Para thread-safety
        self._historial_validaciones = []  # Historial de validaciones
    
    def validar_archivo_workorder(self, ruta_archivo: str) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Valida un archivo WorkOrder y almacena el resultado
        
        Args:
            ruta_archivo: Ruta al archivo Excel a validar
            
        Returns:
            Tuple con (success, mensaje, estadisticas)
        """
        try:
            logger.info(f"Iniciando validación de archivo: {ruta_archivo}")

            # Validaciones previas
            if not ruta_archivo:
                return False, "Ruta de archivo no proporcionada", {}

            if not os.path.exists(ruta_archivo):
                return False, f"Archivo no encontrado: {ruta_archivo}", {}

            if not self._validar_extension_archivo(ruta_archivo):
                return False, "El archivo debe ser un archivo Excel (.xlsx o .xls)", {}

            # Realizar validación usando el validador mejorado
            df_resultado, mensaje = validar_renovaciones(ruta_archivo)

            if df_resultado is None:
                return False, mensaje, {}

            stats = {
                'total_registros': len(df_resultado),
                'correctos': len(df_resultado[df_resultado["estado"] == "Correcto"]),
                'incorrectos': len(df_resultado[df_resultado["estado"] == "Incorrecto"]),
            }

            with self._lock:
                self._estado_validacion = EstadoValidacion(
                    archivo_procesado=ruta_archivo,
                    timestamp=datetime.now(),
                    df_validado=df_resultado,
                    mensaje=mensaje,
                    estadisticas=stats,
                    success=True
                )
                self._historial_validaciones.append(self._estado_validacion.to_dict())
                # Mantener solo las últimas 10 validaciones
                if len(self._historial_validaciones) > 10:
                    self._historial_validaciones = self._historial_validaciones[-10:]

            logger.info(f"Validación completada - Success: {self._estado_validacion.success}")
            return self._estado_validacion.success, self._estado_validacion.mensaje, self._estado_validacion.estadisticas

        except Exception as e:
            error_msg = f"Error inesperado durante la validación: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg, {}
    
    def obtener_resultado_validacion(self) -> Optional[EstadoValidacion]:
        """
        Obtiene el último resultado de validación
        
        Returns:
            EstadoValidacion o None si no hay validación previa
        """
        with self._lock:
            return self._estado_validacion
    
    def obtener_dataframe_validado(self) -> Optional[pd.DataFrame]:
        """
        Obtiene el DataFrame validado de la última validación exitosa
        
        Returns:
            DataFrame validado o None si no hay validación exitosa
        """
        with self._lock:
            if self._estado_validacion and self._estado_validacion.success:
                return self._estado_validacion.df_validado
            return None
    
    def obtener_estadisticas_actuales(self) -> Dict[str, Any]:
        """
        Obtiene las estadísticas de la última validación
        
        Returns:
            Diccionario con estadísticas
        """
        with self._lock:
            if self._estado_validacion:
                return self._estado_validacion.estadisticas
            return {}
    
    def obtener_historial_validaciones(self) -> list:
        """
        Obtiene el historial de validaciones recientes
        
        Returns:
            Lista con las últimas validaciones
        """
        with self._lock:
            return self._historial_validaciones.copy()
    
    def limpiar_estado(self):
        """Limpia el estado actual de validación"""
        with self._lock:
            self._estado_validacion = None
            logger.info("Estado de validación limpiado")
    
    def exportar_resultado(self, ruta_destino: str, formato: str = 'xlsx') -> Tuple[bool, str]:
        """
        Exporta el resultado de validación a un archivo
        
        Args:
            ruta_destino: Ruta donde guardar el archivo
            formato: Formato de exportación ('xlsx', 'csv')
            
        Returns:
            Tuple con (success, mensaje)
        """
        try:
            df_validado = self.obtener_dataframe_validado()
            if df_validado is None:
                return False, "No hay datos validados para exportar"
            
            # Crear directorio si no existe
            Path(ruta_destino).parent.mkdir(parents=True, exist_ok=True)
            
            if formato.lower() == 'xlsx':
                df_validado.to_excel(ruta_destino, index=False)
            elif formato.lower() == 'csv':
                df_validado.to_csv(ruta_destino, index=False)
            else:
                return False, f"Formato no soportado: {formato}"
            
            logger.info(f"Resultado exportado a: {ruta_destino}")
            return True, f"Archivo exportado exitosamente a {ruta_destino}"
            
        except Exception as e:
            error_msg = f"Error al exportar resultado: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
    
    def _validar_extension_archivo(self, ruta_archivo: str) -> bool:
        """Valida que el archivo tenga una extensión válida"""
        extensiones_validas = ['.xlsx', '.xls']
        extension = Path(ruta_archivo).suffix.lower()
        return extension in extensiones_validas
    
    def obtener_resumen_validacion(self) -> Dict[str, Any]:
        """
        Obtiene un resumen completo de la última validación
        
        Returns:
            Diccionario con resumen detallado
        """
        with self._lock:
            if not self._estado_validacion:
                return {'estado': 'Sin validación previa'}
            
            estado = self._estado_validacion
            resumen = {
                'archivo': os.path.basename(estado.archivo_procesado),
                'fecha_validacion': estado.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'estado': 'Exitosa' if estado.success else 'Fallida',
                'mensaje': estado.mensaje,
                'total_registros': len(estado.df_validado) if estado.df_validado is not None else 0,
                'estadisticas': estado.estadisticas
            }
            
            # Agregar estadísticas adicionales si hay datos
            if estado.df_validado is not None:
                df = estado.df_validado
                resumen.update({
                    'registros_correctos': len(df[df['estado'] == 'Correcto']),
                    'registros_incorrectos': len(df[df['estado'] == 'Incorrecto']),
                    'porcentaje_exito': round(
                        (len(df[df['estado'] == 'Correcto']) / len(df)) * 100, 2
                    ) if len(df) > 0 else 0
                })
            
            return resumen

# Instancia global del controlador
controlador = ControladorValidacion()

# Funciones de compatibilidad para mantener la interfaz original
def validar_archivo_workorder(ruta_archivo: str) -> Tuple[bool, str]:
    """
    Función de compatibilidad para mantener la interfaz original
    
    Args:
        ruta_archivo: Ruta al archivo Excel a validar
        
    Returns:
        Tuple con (success, mensaje)
    """
    success, mensaje, _ = controlador.validar_archivo_workorder(ruta_archivo)
    return success, mensaje

def obtener_resultado_validacion() -> Optional[pd.DataFrame]:
    """
    Función de compatibilidad para obtener el DataFrame validado
    
    Returns:
        DataFrame validado o None
    """
    return controlador.obtener_dataframe_validado()

## Variable global para compatibilidad (deprecated)
def resultado_validacion():
    """Función para compatibilidad con código legacy"""
    return controlador.obtener_dataframe_validado()

# Funciones adicionales para funcionalidades avanzadas
def obtener_estadisticas_validacion() -> Dict[str, Any]:
    """Obtiene estadísticas de la última validación"""
    return controlador.obtener_estadisticas_actuales()

def obtener_resumen_validacion() -> Dict[str, Any]:
    """Obtiene resumen completo de la última validación"""
    return controlador.obtener_resumen_validacion()

def exportar_resultado_validacion(ruta_destino: str, formato: str = 'xlsx') -> Tuple[bool, str]:
    """Exporta el resultado de validación a archivo"""
    return controlador.exportar_resultado(ruta_destino, formato)

def limpiar_estado_validacion():
    """Limpia el estado actual de validación"""
    controlador.limpiar_estado()

# Ejemplo de uso
if __name__ == "__main__":
    # Ejemplo de uso del controlador mejorado
    ruta_test = "ejemplo_workorder.xlsx"
    
    # Usar la función original (compatibilidad)
    success, mensaje = validar_archivo_workorder(ruta_test)
    print(f"Resultado: {success} - {mensaje}")
    
    # Usar funcionalidades avanzadas
    if success:
        resumen = obtener_resumen_validacion()
        print(f"Resumen: {resumen}")
        
        # Exportar resultado
        exportar_success, export_msg = exportar_resultado_validacion(
            "resultado_validacion.xlsx"
        )
        print(f"Exportación: {exportar_success} - {export_msg}")