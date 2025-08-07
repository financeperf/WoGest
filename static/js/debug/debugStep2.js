// ===================================================================
// debugStep2.js - Simulador de datos para Step 2 (WOGest)
// Archivo para pruebas locales - No usar en producción
// ===================================================================

/**
 * Función para cargar datos simulados en el Step 2 y mostrar la UI
 * Permite probar el flujo visual completo sin necesidad de backend
 * Modo de uso: 
 * 1. Activar debug: window.DEBUG_MODE_STEP2 = true;
 * 2. Llamar a la función: cargarDatosDebugStep2();
 */
function cargarDatosDebugStep2() {
  // Solo ejecutar si estamos en modo debug
  if (!window.DEBUG_MODE_STEP2) {
    console.warn("❌ Modo debug para Step 2 no activado. Para activar: window.DEBUG_MODE_STEP2 = true;");
    return;
  }

  console.log("🔍 Modo debug Step 2 activado - Cargando datos simulados...");
  
  try {
    // Verificar que el estado global existe
    if (!window.appStateStep2) {
      console.error("❌ Error: window.appStateStep2 no está definido");
      alert("Error: No se puede acceder al estado de Step 2. ¿Estás en la página correcta?");
      return;
    }
    
    // Crear respuesta simulada similar a la que enviaría Python
    const respuestaSimulada = {
      success: true,
      message: "Procesamiento exitoso (SIMULADO)",
      detalle: generarDatosPrueba(100),  // Generar 100 registros de prueba
      timestamp: new Date().toISOString()
    };
    
    console.log("📊 Datos simulados generados:", respuestaSimulada);
    
    // Asignar al estado global
    window.appStateStep2.validationResult = respuestaSimulada;
    window.appStateStep2.yaMostroResultados = false; // Reset para permitir mostrar resultados
    
    // Ocultar errores y advertencias que pudieran estar visibles
    if (typeof ocultarErrorStep2 === "function") {
      ocultarErrorStep2();
    }
    
    // Definir funciones auxiliares para debug si no existen
    if (typeof actualizarEstadisticasLaterales !== "function") {
      window.actualizarEstadisticasLaterales = function(datos) {
        console.log("📊 Mock: actualizarEstadisticasLaterales", datos ? `(${datos.length} registros)` : "");
        return true;
      };
    }
    
    if (typeof conectarFiltrosStep2 !== "function") {
      window.conectarFiltrosStep2 = function() {
        console.log("🔍 Mock: conectarFiltrosStep2 - Simulando conexión de filtros");
        return true;
      };
    }

    // Mostrar resultados llamando a la función principal
    if (typeof mostrarResultadosStep2 === "function") {
      console.log("🎬 Mostrando UI con datos simulados...");
      mostrarResultadosStep2(respuestaSimulada);
      
      // Mostrar botón siguiente
      if (typeof mostrarBotonSiguiente === "function") {
        mostrarBotonSiguiente();
      } else {
        console.warn("⚠️ Función mostrarBotonSiguiente no disponible");
        const btnSiguiente = document.getElementById('btn-siguiente');
        if (btnSiguiente) {
          btnSiguiente.style.display = 'flex';
        }
      }
      
      console.log("✅ Simulación completada exitosamente");
    } else {
      console.error("❌ Error: Función mostrarResultadosStep2 no encontrada");
      alert("Error: No se puede mostrar los resultados. ¿Estás en la página correcta?");
    }
  } catch (error) {
    console.error("❌ Error al cargar datos simulados:", error);
    alert("Error al cargar datos simulados: " + error.message);
  }
}

/**
 * Genera datos de prueba aleatorios pero realistas para WOQ
 * @param {number} cantidad - Cantidad de registros a generar
 * @returns {Array} - Array con los registros generados
 */
function generarDatosPrueba(cantidad = 50) {
  const datos = [];
  const tiposWO = ["MNTO", "INST", "SERV", "REVI"];
  const estados = ["SI", "NO"];
  const dealerIds = [61, 72, 83, 94, 105];
  const dc = ["PE151", "PE245", "PE920", "PE500", "PE600"];
  
  // Nombres ficticios para generar datos más realistas
  const nombres = [
    "JUAN PÉREZ LÓPEZ", "MARÍA GARCÍA RODRÍGUEZ", "CARLOS MARTÍNEZ SÁNCHEZ", 
    "ANA LÓPEZ GONZÁLEZ", "LUIS RODRÍGUEZ FERNÁNDEZ", "LAURA GONZÁLEZ DÍAZ",
    "JOSÉ SÁNCHEZ MARTÍN", "CARMEN DÍAZ PÉREZ", "MANUEL MARTÍN GARCÍA",
    "ISABEL PÉREZ LÓPEZ", "JAVIER GARCÍA RODRÍGUEZ", "PATRICIA MARTÍNEZ SÁNCHEZ",
    "FRANCISCO LÓPEZ GONZÁLEZ", "ELENA RODRÍGUEZ FERNÁNDEZ", "MIGUEL GONZÁLEZ DÍAZ"
  ];
  
  // Status ficticios
  const status1 = ["OP", "CL", "PG", "PE", "CA"];
  const status2 = ["CUOP", "COPE", "ATCL", "SUPE", "CUCE"];
  
  for (let i = 0; i < cantidad; i++) {
    // Determinar si está cerrado
    const cerradoFlag = Math.random() > 0.4;  // 60% cerrados, 40% pendientes
    
    datos.push({
      DC: dc[Math.floor(Math.random() * dc.length)],
      n_wo: 5000000 + Math.floor(Math.random() * 1000000),
      n_wo_alt: `WO${5000000 + Math.floor(Math.random() * 1000000)}`,
      TIPO: tiposWO[Math.floor(Math.random() * tiposWO.length)],
      contrato: 1500000 + Math.floor(Math.random() * 100000),
      DEALER: dealerIds[Math.floor(Math.random() * dealerIds.length)],
      STATUS1: status1[Math.floor(Math.random() * status1.length)],
      STATUS2: status2[Math.floor(Math.random() * status2.length)],
      cerrado: cerradoFlag ? "X" : "",
      cliente: nombres[Math.floor(Math.random() * nombres.length)],
      es_cerrado: cerradoFlag ? "SI" : "NO",
      orden: i + 1,
      estado: cerradoFlag ? "CERRADO" : "PENDIENTE",
      fecha_creacion: generarFechaAleatoria(),
      fecha_cierre: cerradoFlag ? generarFechaAleatoria() : "",
      timestamp: new Date().toISOString()
    });
  }
  
  return datos;
}

/**
 * Genera una fecha aleatoria de los últimos 60 días
 * @returns {string} - Fecha en formato DD/MM/YYYY
 */
function generarFechaAleatoria() {
  const hoy = new Date();
  const diasAtras = Math.floor(Math.random() * 60); // Hasta 60 días atrás
  
  const fecha = new Date(hoy);
  fecha.setDate(hoy.getDate() - diasAtras);
  
  return `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}/${fecha.getFullYear()}`;
}

/**
 * Funciones de soporte para debugging adicionales
 */
function configurarFuncionesDebugStep2() {
  // Estas funciones solo se definen si no existen ya
  const funcionesAuxiliares = {
    // Funciones para estadísticas
    cargarDatosDebugStep2,
    actualizarEstadisticasLaterales: (datos) => {
      console.log("📊 Mock: actualizarEstadisticasLaterales", datos ? `(${datos.length} registros)` : "");
      return true;
    },
    
    // Funciones para filtros
    conectarFiltrosStep2: () => {
      console.log("🔍 Mock: conectarFiltrosStep2 - Simulando conexión de filtros");
      return true;
    },
    
    // Funciones para UI y navegación
    ocultarErrorStep2: () => {
      console.log("🛠️ Mock: ocultarErrorStep2");
      const elementosError = document.querySelectorAll('.alert-danger, .error-message');
      elementosError.forEach(el => el.style.display = 'none');
    },
    mostrarBotonSiguiente: () => {
      console.log("▶️ Mock: mostrarBotonSiguiente");
      const btnSiguiente = document.getElementById('btn-siguiente');
      if (btnSiguiente) btnSiguiente.style.display = 'flex';
    },
    
    // Solo para log en consola
    logDebugStep2: (mensaje) => {
      console.log(`🐛 Debug Step2: ${mensaje}`);
    }
  };
  
  // Registrar todas las funciones auxiliares en window
  Object.entries(funcionesAuxiliares).forEach(([nombre, funcion]) => {
    if (typeof window[nombre] !== "function") {
      window[nombre] = funcion;
      console.log(`✅ Registrada función auxiliar debug: ${nombre}`);
    }
  });
}

// Configurar funciones auxiliares y exponer la función principal para uso global
configurarFuncionesDebugStep2();
window.cargarDatosDebugStep2 = cargarDatosDebugStep2;

// Mensaje informativo en consola
console.log(
  "%c🔧 Debug Step 2 disponible: " + 
  "%cPara activar, ejecuta en consola:" +
  "%c\n\nwindow.DEBUG_MODE_STEP2 = true;\ncargarDatosDebugStep2();", 
  "color: #0066ff; font-weight: bold;", 
  "color: #444;",
  "color: #008800; font-weight: bold;"
);
