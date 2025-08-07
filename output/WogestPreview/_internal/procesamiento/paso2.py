import pandas as pd

# Diccionario de columnas a conservar y renombrar
def get_column_map():
    return {
        "Column1": "DC",
        "Column2": "N°_WO",
        "Column3": "TIPO",
        "Column6": "CONTRATO",
        "Column7": "DEALER",
        "Column8": "STATUS1",
        "Column9": "STATUS2",
        "Column11": "CERRADO",
        "Column13": "F_SIST",
        "Column14": "CLIENTE",
        "Column15": "PERU",
        "Column16": "IMP_INST",
        "Column17": "IMP_2",
        "Column18": "IMP_3",
        "Column19": "IMP_4",
        "Column21": "M_CREADOR",
        "Column27": "F_FACT",
        "Column32": "T_PRICE",
        "Column33": "F_F",
        "Column41": "CERRADO2",
        "Column42": "MTRIC",
        "Column43": "INSTALACION",
        "Column44": "N°_CONTRATO",
        "Column45": "MATRI_CERRADO"
    }

def procesar_woq(ruta_archivo):
    import os
    try:
        print(f"📥 Procesando archivo WOQ: {ruta_archivo}")
        
        # Validar que el archivo existe
        if not os.path.exists(ruta_archivo):
            raise ValueError(f"El archivo no existe: {ruta_archivo}")
            
        # Validar que el archivo tiene tamaño > 0
        if os.path.getsize(ruta_archivo) == 0:
            raise ValueError("El archivo está vacío o tiene tamaño cero.")
            
        # Validar extensión del archivo
        extension = os.path.splitext(ruta_archivo)[1].lower()
        if extension not in ['.csv', '.txt', '']:  # '' para archivos sin extensión
            print(f"⚠️ Advertencia: Extensión de archivo no estándar: {extension}. Intentando procesar de todos modos.")
            # No interrumpimos el proceso, solo advertimos
            
        # Intentar abrir el archivo para verificar si se puede leer
        try:
            with open(ruta_archivo, 'r', encoding='latin1') as f:
                # Leer primeras líneas para verificar que tiene contenido
                primeras_lineas = ''.join([f.readline() for _ in range(5)])
                if not primeras_lineas.strip():
                    raise ValueError("El archivo está vacío o no contiene columnas legibles.")
        except UnicodeDecodeError:
            # Si falla con latin1, intentar con otras codificaciones
            try:
                with open(ruta_archivo, 'r', encoding='utf-8') as f:
                    pass  # Solo verificar que se puede abrir
            except UnicodeDecodeError:
                raise ValueError("No se puede determinar la codificación del archivo. Asegúrese de que sea un CSV válido.")
        except Exception as e:
            raise ValueError(f"Error al leer el archivo: {str(e)}")
        
        # Permitir leer aunque no tenga extensión, forzando encoding latin1
        try:
            # Intentar primero con delimitador punto y coma (estándar)
            # Nota: pandas > 1.0 usa on_bad_lines en vez de error_bad_lines/warn_bad_lines
            try:
                # Para versiones modernas de pandas
                df = pd.read_csv(ruta_archivo, delimiter=';', encoding='latin1', header=None, 
                                on_bad_lines='warn')
            except TypeError:
                # Para versiones antiguas de pandas
                # Para versiones antiguas de pandas (usar on_bad_lines para compatibilidad)
                df = pd.read_csv(ruta_archivo, delimiter=';', encoding='latin1', header=None, 
                                on_bad_lines='warn')
            # Si solo hay una columna, podría ser que el delimitador sea incorrecto
            if df.shape[1] == 1:
                # Intentar con otros delimitadores comunes
                for delim in [',', '\t', '|']:
                    try:
                        # Para versiones modernas de pandas
                        try:
                            temp_df = pd.read_csv(ruta_archivo, delimiter=delim, encoding='latin1', 
                                                header=None, on_bad_lines='warn')
                        except TypeError:
                            # Para versiones antiguas de pandas
                            # Para versiones antiguas de pandas (usar on_bad_lines para compatibilidad)
                            temp_df = pd.read_csv(ruta_archivo, delimiter=delim, encoding='latin1', 
                                                header=None, on_bad_lines='warn')
                        if temp_df.shape[1] > 1:
                            print(f"✅ El archivo usa delimitador '{delim}' en lugar de ';'")
                            df = temp_df
                            break
                    except Exception as delim_error:
                        print(f"⚠️ Error al probar con delimitador '{delim}': {str(delim_error)}")
                        continue
            
            # Validar que tiene al menos una columna y filas
            if df.shape[1] == 0 or df.shape[0] == 0:
                raise ValueError("El archivo está vacío o no contiene columnas legibles.")
                
            # Si hay muy pocas columnas, es probable que el formato sea incorrecto
            min_columnas_requeridas = 5  # Ejemplo: necesitamos al menos estas columnas
            if df.shape[1] < min_columnas_requeridas:
                print(f"⚠️ Advertencia: El archivo tiene muy pocas columnas ({df.shape[1]}). " +
                      f"Se esperaban al menos {min_columnas_requeridas}.")
                
        except pd.errors.EmptyDataError:
            raise ValueError("El archivo CSV está vacío.")
        except pd.errors.ParserError:
            raise ValueError("Error al analizar el archivo CSV. Formato incorrecto.")
        except Exception as e:
            raise ValueError(f"No se pudo procesar el archivo WOQ: {str(e)}")
            
        print(f"✅ CSV cargado, shape: {df.shape}")

        # Paso 1: Asignar nombres genéricos
        df.columns = [f"Column{i+1}" for i in range(df.shape[1])]
        print(f"🧩 Columnas renombradas: {list(df.columns)}")

        # Paso 2: Obtener mapeo y validar columnas
        renombrar = get_column_map()
        columnas_validas = list(renombrar.keys())
        columnas_presentes = [col for col in df.columns if col in columnas_validas]
        print(f"🧪 Columnas válidas detectadas: {len(columnas_presentes)} / {len(columnas_validas)}")
        df = df[columnas_presentes]

        # Paso 3: Renombrar columnas
        df = df.rename(columns=renombrar)

        # Paso 4: Crear columna derivada N_WO
        if "N°_WO" in df.columns:
            df["N_WO"] = df["N°_WO"].astype(str)

        # Paso 5: Ordenar por CONTRATO y N_WO
        if "CONTRATO" in df.columns and "N_WO" in df.columns:
            df = df.sort_values(by=["CONTRATO", "N_WO"], ascending=[True, True])
            df["ORDEN_CONTRATO"] = df.groupby("CONTRATO").cumcount() + 1

        # Paso 6: Marcar si está cerrado (adaptativo a diferentes formatos)
        if "CERRADO" in df.columns:
            # Intentamos detectar el formato de la columna CERRADO
            valores_unicos = df["CERRADO"].astype(str).str.upper().str.strip().unique()
            print(f"🔍 Valores únicos en columna CERRADO: {valores_unicos}")
            
            # Verificamos si usa 'X' para marcar cerrados
            if "X" in valores_unicos:
                df["ES_CERRADO"] = df["CERRADO"].astype(str).str.upper().str.strip() == "X"
            # Si no, verificamos si usa 'SI'/'SÍ'
            elif any(x in ["SI", "SÍ", "S"] for x in valores_unicos):
                df["ES_CERRADO"] = df["CERRADO"].astype(str).str.upper().str.strip().isin(["SI", "SÍ", "S"])
            # Si no, verificamos si usa 'TRUE'/'1'
            elif any(x in ["TRUE", "1"] for x in valores_unicos):
                df["ES_CERRADO"] = df["CERRADO"].astype(str).str.upper().str.strip().isin(["TRUE", "1"])
            else:
                # Si no podemos determinar el formato, asumimos que no hay cerrados
                print("⚠️ No se pudo determinar el formato de la columna CERRADO. Asumiendo todos NO.")
                df["ES_CERRADO"] = False
            
        else:
            # Si no existe la columna CERRADO, la creamos con valores NO
            print("⚠️ No se encontró columna CERRADO. Creando con valores NO.")
            df["CERRADO"] = "NO_DATA"
            df["ES_CERRADO"] = False

        # Verificación final de columnas críticas
        columnas_criticas = ["CONTRATO", "N°_WO", "N_WO", "CLIENTE"]
        columnas_faltantes = [col for col in columnas_criticas if col not in df.columns]
        
        if columnas_faltantes:
            print(f"⚠️ Advertencia: Faltan columnas críticas: {columnas_faltantes}")
            # Agregamos las columnas faltantes con valores vacíos para evitar errores
            for col in columnas_faltantes:
                df[col] = ""
                
        # Asegurar que existan todas las columnas necesarias para la UI
        if "ORDEN_CONTRATO" not in df.columns:
            df["ORDEN_CONTRATO"] = range(1, len(df) + 1)

        print(f"✅ DataFrame final listo: {df.shape}")
        return df

    except Exception as e:
        print(f"❌ Error al procesar WOQ: {e}")
        # Registrar stack trace para diagnóstico
        import traceback
        print(traceback.format_exc())
        return None
