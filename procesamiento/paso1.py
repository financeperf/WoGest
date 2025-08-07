import pandas as pd
import logging
import os
import shutil
import tempfile
from typing import Tuple, Optional, List, Dict, Any
from dataclasses import dataclass
from pathlib import Path
import sys
import pkgutil
import sqlite3  # <-- Importa sqlite3 aquí
from procesamiento.db_sqlite import guardar_paso1_sqlite  # Importar función de guardado
# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ValidationResult:
    """Clase para encapsular los resultados de validación"""
    success: bool
    data: Optional[pd.DataFrame]
    message: str
    stats: Dict[str, Any]

def resource_path(relative_path: str) -> str:
    """Obtiene la ruta al recurso, incluso dentro de un ejecutable (.exe)"""
    try:
        base_path = sys._MEIPASS  # Ruta temporal usada por PyInstaller
    except AttributeError:
        base_path = os.path.abspath(".")  # Ruta normal cuando se ejecuta como .py

    return os.path.join(base_path, relative_path)

def get_temp_copy_of_resource(resource: str) -> str:
    """
    Devuelve la ruta absoluta al recurso extraído por PyInstaller (sin copiar),
    solo para lectura.
    """
    import sys
    import os

    try:
        if getattr(sys, 'frozen', False):
            base_path = sys._MEIPASS
        else:
            base_path = os.path.abspath(".")

        source_path = os.path.join(base_path, resource)

        if not os.path.exists(source_path):
            raise FileNotFoundError(f"No se encontró el recurso empaquetado: {resource}")

        return source_path

    except Exception as e:
        raise FileNotFoundError(f"No se pudo acceder al recurso {resource}: {str(e)}")


class RenovacionValidator:
    """Validador de renovaciones con reglas de negocio"""
    
    def __init__(self):
        import pandas as pd

        # --- CAMBIO: Usar SQLite en vez de Excel ---
        db_path = resource_path("config/combinaciones.db")
        conn = sqlite3.connect(db_path)
        validas_df = pd.read_sql_query("SELECT * FROM validas WHERE ACTIVO = 1", conn)
        individuales_df = pd.read_sql_query("SELECT * FROM individuales WHERE ACTIVO = 1", conn)
        # --- NUEVO: cargar referencias especiales por motivo "pilas" ---
        pilas_df = pd.read_sql_query("SELECT * FROM pilas WHERE ACTIVO = 1", conn)
        self.referencias_pilas_amce = set(
            pilas_df[pilas_df["TIPO"].str.upper() == "AMCE"]["REFERENCIA"].str.strip().str.upper()
        )
        conn.close()
        # --- FIN CAMBIO ---

        self.combinaciones_validas = set(
            zip(
                validas_df[validas_df["ACTIVO"] == 1]["REFERENCIA_ANTIGUA"].str.strip().str.upper(),
                validas_df[validas_df["ACTIVO"] == 1]["REFERENCIA_NUEVA"].str.strip().str.upper()
            )
        )

        self.referencias_prohibidas_dmce = set(
            individuales_df[
                (individuales_df["ACTIVO"] == 1) & 
                (individuales_df["TIPO"].str.upper() == "DMCE")
            ]["REFERENCIA"].str.strip().str.upper()
        )

        self.referencias_prohibidas_amce = set(
            individuales_df[
                (individuales_df["ACTIVO"] == 1) & 
                (individuales_df["TIPO"].str.upper() == "AMCE")
            ]["REFERENCIA"].str.strip().str.upper()
        )

        self.columnas_requeridas = [
            'WO', 'MANT', 'FECHA', 'CLIENTE', 'REFERENCIA', 'TIPO',
            'PRECIO', 'CANTIDAD', 'CUOTA', 'TECNICO', 'PAGO'
        ]
        self.tipos_validos = ['AMCE', 'DMCE']


   
    def _validar_archivo(self, path_excel: str) -> Tuple[bool, str]:
        """Valida que el archivo exista y sea accesible"""
        try:
            archivo = Path(path_excel)
            if not archivo.exists():
                return False, f"El archivo '{path_excel}' no existe"
            
            if not archivo.suffix.lower() in ['.xlsx', '.xls']:
                return False, "El archivo debe ser un archivo Excel (.xlsx o .xls)"
            
            return True, "Archivo válido"
        
        except Exception as e:
            return False, f"Error al validar archivo: {str(e)}"
    
    def _leer_excel(self, path_excel: str) -> Tuple[Optional[pd.DataFrame], str]:
        """Lee el archivo Excel con manejo de errores robusto"""
        try:
            # Leer desde la fila 4 (header=3) sin incluir la columna de índice
            df = pd.read_excel(path_excel, header=3, engine="openpyxl", index_col=None)
            
            if df.empty:
                return None, "El archivo está vacío"
            
            # Limpiar nombres de columnas (quitar espacios extra)
            df.columns = df.columns.str.strip()
            
            # Validar columnas requeridas
            columnas_faltantes = [col for col in self.columnas_requeridas if col not in df.columns]
            if columnas_faltantes:
                return None, f"Columnas faltantes: {', '.join(columnas_faltantes)}"
            
            return df, "Archivo leído correctamente"
        
        except FileNotFoundError:
            return None, f"No se encontró el archivo: {path_excel}"
        except PermissionError:
            return None, f"Sin permisos para acceder al archivo: {path_excel}"
        except Exception as e:
            return None, f"Error al leer archivo Excel: {str(e)}"
    
    def _limpiar_datos(self, df: pd.DataFrame) -> pd.DataFrame:
        """Limpia y filtra los datos según las reglas de negocio"""
        # Mantener todas las columnas del archivo original
        df_limpio = df.copy()
        
        # Eliminar columnas "Unnamed" que aparecen cuando hay columnas vacías en Excel
        columnas_unnamed = [col for col in df_limpio.columns if str(col).startswith('Unnamed')]
        if columnas_unnamed:
            df_limpio = df_limpio.drop(columns=columnas_unnamed)
            logger.info(f"Columnas 'Unnamed' eliminadas: {columnas_unnamed}")
        
        # Verificar que existan las columnas requeridas para el procesamiento
        columnas_faltantes = [col for col in self.columnas_requeridas if col not in df_limpio.columns]
        if columnas_faltantes:
            raise ValueError(f"Columnas faltantes para procesamiento: {', '.join(columnas_faltantes)}")
        
        # Filtrar por tipos válidos
        df_limpio = df_limpio[df_limpio['TIPO'].isin(self.tipos_validos)]
        
        # Eliminar filas con valores nulos en campos críticos
        df_limpio = df_limpio.dropna(subset=['WO', 'REFERENCIA', 'MANT', 'CLIENTE'])
        
        # Convertir campos numéricos a tipos apropiados
        campos_numericos = ['CANTIDAD', 'PRECIO', 'CUOTA']
        for campo in campos_numericos:
            if campo in df_limpio.columns:
                df_limpio[campo] = pd.to_numeric(df_limpio[campo], errors='coerce')
        
        # Eliminar filas con CANTIDAD nula (crítico para validación)
        df_limpio = df_limpio.dropna(subset=['CANTIDAD'])
        
        # Limpiar espacios en blanco en campos de texto
        campos_texto = ['REFERENCIA', 'MANT', 'CLIENTE', 'TIPO']
        for campo in campos_texto:
            if campo in df_limpio.columns:
                df_limpio[campo] = df_limpio[campo].astype(str).str.strip()
        
        return df_limpio
    
    def _validar_signo_cantidad(self, row: pd.Series) -> str:
        """Valida que el signo de la cantidad sea correcto según el tipo"""
        if row['TIPO'] == 'DMCE' and row['CANTIDAD'] >= 0:
            return "DMCE debe tener cantidad negativa"
        elif row['TIPO'] == 'AMCE' and row['CANTIDAD'] <= 0:
            return "AMCE debe tener cantidad positiva"
        return ""
    
    def _validar_referencia_prohibida(self, referencia: str, tipo: str) -> str:
        """Valida si la referencia está prohibida para su tipo"""
        if tipo == "DMCE" and referencia in self.referencias_prohibidas_dmce:
            return "Producto prohibido en desmontaje"
        elif tipo == "AMCE" and referencia in self.referencias_prohibidas_amce:
            return "Producto prohibido en instalación"
        return ""
    
    def _validar_f057_sin_panel(self, referencia: str, dmce_grupo: pd.DataFrame) -> str:
        """Valida el caso especial F057 sin panel"""
        if referencia == "F057" and dmce_grupo.empty:
            return "F057 sin panel (debe tener DMCE asociado)"
        return ""
    
    def _validar_combinaciones_validas(self, dmce_grupo: pd.DataFrame, amce_grupo: pd.DataFrame) -> Optional[str]:
        """Valida si al menos una combinación DMCE ➜ AMCE está permitida según Excel"""
        for _, dmce_row in dmce_grupo.iterrows():
            for _, amce_row in amce_grupo.iterrows():
                par = (dmce_row["REFERENCIA"].strip().upper(), amce_row["REFERENCIA"].strip().upper())
                if par in self.combinaciones_validas:
                    return None  # Al menos una combinación válida encontrada
        return "No se encontró una combinación DMCE → AMCE permitida"    

    def _procesar_grupo(self, grupo: pd.DataFrame, mant: str, cliente: str) -> Dict[str, Any]:
        """Procesa un grupo de renovaciones y aplica todas las validaciones"""
        amce_grupo = grupo[grupo['TIPO'] == 'AMCE']
        dmce_grupo = grupo[grupo['TIPO'] == 'DMCE']

        # Excluir pilas del conteo de cantidad
        amce_grupo_filtrado = amce_grupo[~amce_grupo["REFERENCIA"].str.upper().isin(self.referencias_pilas_amce)]
        cant_amce = amce_grupo_filtrado['CANTIDAD'].sum() if not amce_grupo_filtrado.empty else 0
        cant_dmce = dmce_grupo['CANTIDAD'].sum() if not dmce_grupo.empty else 0
        cant_total = cant_amce + cant_dmce

        errores = []

        # Validar signos de cantidad
        for _, row in grupo.iterrows():
            error_signo = self._validar_signo_cantidad(row)
            if error_signo:
                errores.append(error_signo)

        # Validar referencias prohibidas en cada fila
        for _, row in grupo.iterrows():
            ref = row["REFERENCIA"].strip().upper()
            tipo = row["TIPO"].strip().upper()
            error_ref = self._validar_referencia_prohibida(ref, tipo)
            if error_ref:
                errores.append(f"{ref} ({tipo}): {error_ref}")

        # Validar F057 sin panel (buscar en todas las filas AMCE)
        tiene_f057_amce = any((grupo["REFERENCIA"].str.upper() == "F057") & (grupo["TIPO"].str.upper() == "AMCE"))
        if tiene_f057_amce and dmce_grupo.empty:
            errores.append("F057 sin panel (debe tener DMCE asociado)")

        # Validar contra combinaciones válidas (desde Excel)
        if not dmce_grupo.empty and not amce_grupo.empty:
            error_combinacion = self._validar_combinaciones_validas(dmce_grupo, amce_grupo)
            if error_combinacion:
                errores.append(error_combinacion)

        # --- REEMPLAZO AQUÍ ---
        # Verificar si hay F057 como AMCE
        tiene_f057_amce = any(amce_grupo["REFERENCIA"].str.upper() == "F057")

        # Verificar si hay referencias especiales tipo "pilas"
        referencias_amce_set = set(amce_grupo["REFERENCIA"].str.strip().str.upper())
        tiene_pilas_amce = not referencias_amce_set.isdisjoint(self.referencias_pilas_amce)
        # --- FIN REEMPLAZO ---

        # Combinaciones que justifican presencia de F057
        referencias_dmce = dmce_grupo["REFERENCIA"].str.upper().tolist()
        referencias_amce = amce_grupo["REFERENCIA"].str.upper().tolist()

        combinacion_justificable = any(
            dmce in ["BF039", "BF039M"] and amce in ["BF145", "BF149"]
            for dmce in referencias_dmce
            for amce in referencias_amce
        )

        if tiene_f057_amce:
            if not combinacion_justificable:
                errores.append("F057 sin combinación de renovación válida (requiere BF039 → BF145 o BF149)")

        # 🚫 No se permite grupo solo con PILAS sin DMCE ni F057
        if not errores and dmce_grupo.empty and not tiene_f057_amce and tiene_pilas_amce:
            errores.append("Grupo inválido: PILAS sin renovación asociada")

        if not errores:
            if cant_total == 0:
                estado = "Correcto"
            elif cant_total == 1 and (
                (tiene_f057_amce and combinacion_justificable) or tiene_pilas_amce
            ):
                estado = "Correcto"  # Se permite F057 como base extra o pilas
            elif cant_total == 1 and not tiene_f057_amce:
                estado = "Advertencia"
                errores.append("Cantidades desbalanceadas sin F057 (Total: +1)")
            else:
                estado = "Incorrecto"
                errores.append(f"Desbalance crítico (Total: {cant_total})")
        else:
            estado = "Incorrecto"

        # Observaciones personalizadas
        if errores:
            observaciones = "; ".join(set(errores))
        else:
            observaciones = "Renovación completa"
            if tiene_pilas_amce:
                observaciones += " + Incluye Pilas"

        rpa = "Sí" if estado == "Correcto" else "No"

        return {
            'cant_amce': cant_amce,
            'cant_dmce': cant_dmce,
            'cant_total': cant_total,
            'estado': estado,
            'observaciones': observaciones,
            'rpa': rpa
        }
    
    def validar_renovaciones(self, path_excel: str) -> ValidationResult:
        """Función principal que valida las renovaciones"""
        try:
            logger.info(f"Iniciando validación de renovaciones para: {path_excel}")
            
            # Validar archivo
            archivo_valido, mensaje_archivo = self._validar_archivo(path_excel)
            if not archivo_valido:
                return ValidationResult(False, None, mensaje_archivo, {})
            
            # Leer Excel
            df, mensaje_lectura = self._leer_excel(path_excel)
            if df is None:
                return ValidationResult(False, None, mensaje_lectura, {})
            
            # Limpiar datos
            df_limpio = self._limpiar_datos(df)
            
            if df_limpio.empty:
                return ValidationResult(
                    False, None, 
                    "No se encontraron registros válidos con tipo AMCE o DMCE",
                    {}
                )
            
            # Procesar grupos AQUI PUEDO CAMBIAR  CONSULTANDO LA LOGICA
            agrupado = df_limpio.groupby(['CLIENTE', 'MANT']) 
            resultados = []
            
            stats = {
                'total_registros': 0,
                'registros_correctos': 0,
                'registros_incorrectos': 0,
                'grupos_procesados': 0
            }
            
            for (cliente, mant), grupo in agrupado:
                stats['grupos_procesados'] += 1

                # Procesar validaciones del grupo completo
                resultado_grupo = self._procesar_grupo(grupo, mant, cliente)

                # Agregar resultados para cada fila del grupo
                for _, row in grupo.iterrows():
                    resultado_fila = {
                        **row.to_dict(),
                        'Cant_Antiguo': resultado_grupo['cant_dmce'],
                        'Cant_Nuevo': resultado_grupo['cant_amce'],
                        'Cant_Total': resultado_grupo['cant_total'],
                        'Estado': resultado_grupo['estado'],
                        'Observaciones': resultado_grupo['observaciones'],
                        'RPA': resultado_grupo['rpa']
                    }
                    resultados.append(resultado_fila)

                    stats['total_registros'] += 1
                    if resultado_grupo['estado'] == 'Correcto':
                        stats['registros_correctos'] += 1
                    else:
                        stats['registros_incorrectos'] += 1
                       
            
            df_resultado = pd.DataFrame(resultados)
            
            # 🔧 Eliminar columnas "Unnamed" antes de normalizar nombres
            columnas_unnamed = [col for col in df_resultado.columns if str(col).startswith('Unnamed')]
            if columnas_unnamed:
                df_resultado = df_resultado.drop(columns=columnas_unnamed)
                logger.info(f"Columnas 'Unnamed' eliminadas del resultado final: {columnas_unnamed}")
            
            # 🔧 Normalizar nombres de columna a minúsculas
            df_resultado.columns = [col.lower() for col in df_resultado.columns]
            
            # 💾 INSERTAR REGISTROS A LA BASE DE DATOS - Solo registros correctos
            try:
                # Filtrar solo registros correctos
                df_correctos = df_resultado[df_resultado['estado'] == 'Correcto'].copy()
                
                if not df_correctos.empty:
                    # Normalizar nombres de columnas para la BD
                    df_correctos_bd = df_correctos.rename(columns={
                        'wo': 'wo',
                        'mant': 'mant', 
                        'fecha': 'fecha',
                        'cliente': 'cliente',
                        'referencia': 'referencia',
                        'tipo': 'tipo',
                        'precio': 'precio',
                        'cantidad': 'cantidad',
                        'cuota': 'cuota',
                        'tecnico': 'tecnico',
                        'pago': 'pago',
                        'cant_antiguo': 'cant_antiguo',
                        'cant_nuevo': 'cant_nuevo', 
                        'cant_total': 'cant_total',
                        'estado': 'estado',
                        'observaciones': 'observaciones',
                        'rpa': 'rpa'
                    })
                    
                    # Guardar en SQLite
                    guardar_paso1_sqlite(df_correctos_bd)
                    logger.info(f"✅ {len(df_correctos)} registros correctos guardados en SQLite")
                else:
                    logger.info("⚠️ No hay registros correctos para guardar en SQLite")
                    
            except Exception as e:
                logger.error(f"❌ Error al guardar registros en SQLite: {str(e)}")
                # No interrumpir el flujo principal, solo registrar el error
            
            mensaje_final = (
                f"Validación completada exitosamente. "
                f"Procesados: {stats['total_registros']} registros, "
                f"Correctos: {stats['registros_correctos']}, "
                f"Incorrectos: {stats['registros_incorrectos']}"
            )
           
            logger.info(mensaje_final)
            
            return ValidationResult(
                success=True,
                data=df_resultado,
                message=mensaje_final,
                stats=stats
            )
            
        except Exception as e:
            error_msg = f"Error inesperado durante la validación: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return ValidationResult(False, None, error_msg, {})

# Instancia global del validador
validator = RenovacionValidator()


def validar_renovaciones(path_excel: str) -> Tuple[Optional[pd.DataFrame], str]:
    """
    Función de compatibilidad para mantener la interfaz original
    
    Args:
        path_excel: Ruta al archivo Excel a validar
        
    Returns:
        Tuple con (DataFrame resultado, mensaje)
    """
    resultado = validator.validar_renovaciones(path_excel)
    return resultado.data, resultado.message

def obtener_estadisticas_validacion(path_excel: str) -> Dict[str, Any]:
    """
    Función adicional para obtener estadísticas detalladas
    
    Args:
        path_excel: Ruta al archivo Excel a validar
        
    Returns:
        Diccionario con estadísticas de validación
    """
    resultado = validator.validar_renovaciones(path_excel)
    return resultado.stats

# Ejemplo de uso
if __name__ == "__main__":
    # Ejemplo de uso del validador
    ruta_archivo = "ejemplo_renovaciones.xlsx"
    
    # Usar la función original
    df_resultado, mensaje = validar_renovaciones(ruta_archivo)
    
    if df_resultado is not None:
        print(f"✅ {mensaje}")
        print(f"Registros procesados: {len(df_resultado)}")
        print(f"Registros correctos: {len(df_resultado[df_resultado['estado'] == 'Correcto'])}")
    else:
        print(f"❌ {mensaje}")
    
    # Usar la nueva interfaz con estadísticas
    resultado_completo = validator.validar_renovaciones(ruta_archivo)
    if resultado_completo.success:
        print(f"\n📊 Estadísticas detalladas:")
        for key, value in resultado_completo.stats.items():
            print(f"  {key}: {value}")