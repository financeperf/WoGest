import os, sys, sqlite3
from pathlib import Path
import pandas as pd

# === Ruta segura para la BD ===
def get_db_path() -> str:
    """
    Devuelve una ruta ABSOLUTA y escribible para la BD SQLite.
    En ejecutable (PyInstaller) usa ~/.wogest/temp_wogest.sqlite3
    En desarrollo usa <proyecto>/.wogest/temp_wogest.sqlite3
    """
    if getattr(sys, "frozen", False):  # ejecutable PyInstaller
        base = Path(os.path.expanduser("~")) / ".wogest"
    else:
        base = Path(__file__).resolve().parent.parent / ".wogest"
    base.mkdir(parents=True, exist_ok=True)
    return str(base / "temp_wogest.sqlite3")

# === Conexión centralizada ===
def get_connection():
    """
    Usa siempre la ruta de get_db_path() y habilita acceso multi-hilo.
    """
    return sqlite3.connect(get_db_path(), check_same_thread=False)

# === Inicialización mínima ===
def init_db():
    """
    Garantiza que el archivo se pueda crear/abrir.
    No define esquemas aquí (los crean las funciones de tu flujo).
    """
    Path(get_db_path()).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(get_db_path()) as _:
        pass

def guardar_paso1_sqlite(df, db_path="config/combinaciones.db"):
    conn = None
    try:
        # ✅ Convertir todas las columnas datetime en strings
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].astype(str)

        conn = sqlite3.connect(get_db_path(), check_same_thread=False)
        cursor = conn.cursor()

        # ✅ Tabla con ID autoincremental
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS temp_paso1 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wo INTEGER,
                mant INTEGER,
                fecha TEXT,
                cliente INTEGER,
                referencia TEXT,
                tipo TEXT,
                precio REAL,
                cantidad INTEGER,
                cuota INTEGER,
                tecnico INTEGER,
                pago INTEGER,
                cant_antiguo INTEGER,
                cant_nuevo INTEGER,
                cant_total INTEGER,
                estado TEXT,
                observaciones TEXT,
                rpa TEXT
            )
        ''')

        # Limpiar tabla
        cursor.execute('DELETE FROM temp_paso1')

        for _, row in df.iterrows():
            cursor.execute('''
                INSERT INTO temp_paso1 (
                    wo, mant, fecha, cliente, referencia, tipo, precio,
                    cantidad, cuota, tecnico, pago, cant_antiguo,
                    cant_nuevo, cant_total, estado, observaciones, rpa
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                row["wo"], row["mant"], row["fecha"], row["cliente"], row["referencia"],
                row["tipo"], row["precio"], row["cantidad"], row["cuota"],
                row["tecnico"], row["pago"], row["cant_antiguo"],
                row["cant_nuevo"], row["cant_total"], row["estado"],
                row["observaciones"], row["rpa"]
            ))

        conn.commit()

    except Exception as e:
        print("❌ Error al guardar en SQLite:", e)
        raise
    finally:
        if conn:
            conn.close()

def guardar_paso2_sqlite(df, db_path="config/combinaciones.db"):
    import sqlite3
    import pandas as pd

    conn = None
    try:
        # Convertir datetime a string
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df.loc[:, col] = df[col].astype(str)

        conn = sqlite3.connect(get_db_path(), check_same_thread=False)
        cursor = conn.cursor()

        # Crear tabla sin restricciones conflictivas
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS temp_paso2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                DC TEXT,
                N_WO INTEGER,
                TIPO TEXT,
                CONTRATO INTEGER,
                DEALER INTEGER,
                STATUS1 TEXT,
                STATUS2 TEXT,
                CERRADO TEXT,
                F_SIST TEXT,
                CLIENTE TEXT,
                TIPO2 TEXT,
                F_RECEP TEXT,
                MARCA TEXT,
                MODELO TEXT,
                SERIE TEXT,
                S_SERIE TEXT,
                CA TEXT,
                LEC_ANT INTEGER,
                LEC_NUE INTEGER,
                T_PRICE TEXT,
                F_F TEXT,
                CERRADO2 TEXT,
                MTRIC TEXT,
                INSTALACION INTEGER,
                N_CONTRATO TEXT,
                MATRI_CERRADO TEXT,
                N_WO2 INTEGER,
                ORDEN_CONTRATO INTEGER,
                es_cerrado TEXT
            )
        ''')

        # Limpiar datos anteriores
        cursor.execute('DELETE FROM temp_paso2')

        for _, row in df.iterrows():
            cursor.execute('''
                INSERT INTO temp_paso2 (
                    DC, N_WO, TIPO, CONTRATO, DEALER, STATUS1, STATUS2,
                    CERRADO, F_SIST, CLIENTE, TIPO2, F_RECEP, MARCA,
                    MODELO, SERIE, S_SERIE, CA, LEC_ANT, LEC_NUE,
                    T_PRICE, F_F, CERRADO2, MTRIC, INSTALACION,
                    N_CONTRATO, MATRI_CERRADO, N_WO2, ORDEN_CONTRATO, es_cerrado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                row.get("DC", ""), row.get("N_WO", 0), row.get("TIPO", ""),
                row.get("CONTRATO", 0), row.get("DEALER", 0), row.get("STATUS1", ""),
                row.get("STATUS2", ""), row.get("CERRADO", ""), row.get("F_SIST", ""),
                row.get("CLIENTE", ""), row.get("TIPO2", ""), row.get("F_RECEP", ""),
                row.get("MARCA", ""), row.get("MODELO", ""), row.get("SERIE", ""),
                row.get("S_SERIE", ""), row.get("CA", ""), row.get("LEC_ANT", 0),
                row.get("LEC_NUE", 0), row.get("T_PRICE", ""), row.get("F_F", ""),
                row.get("CERRADO2", ""), row.get("MTRIC", ""), row.get("INSTALACION", 0),
                row.get("N_CONTRATO", ""), row.get("MATRI_CERRADO", ""),
                row.get("N_WO2", 0), row.get("ORDEN_CONTRATO", 0), row.get("es_cerrado", "")
            ))

        conn.commit()

    except Exception as e:
        print("❌ Error al guardar paso2 en SQLite:", e)
        raise

    finally:
        if conn:
            conn.close()

def leer_temp_paso1(db_path="config/combinaciones.db"):
    conn = get_connection()
    df = pd.read_sql_query("SELECT * FROM temp_paso1", conn)
    conn.close()
    return df

def leer_temp_paso2(db_path="config/combinaciones.db"):
    conn = get_connection()
    df = pd.read_sql_query("SELECT * FROM temp_paso2", conn)
    conn.close()
    return df
def limpiar_tablas_temporales(db_path="config/combinaciones.db"):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM temp_paso1")
    cursor.execute("DELETE FROM temp_paso2")
    conn.commit()
    conn.close()
