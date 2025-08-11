// ===================================================================
// WOGest - Step 3 JavaScript v2.1 - ERROR TRACKING MEJORADO
// Cruce de datos entre Paso 1 y Paso 2
// ===================================================================

// Importar función de exportación
import { exportarExcel } from './export-utils.js';

// ===================================================================
// DEBUG Y ERROR TRACKING
// ===================================================================

function debugStep3(message, data = null) {
  const timestamp = new Date().toISOString().substr(11, 8);
  console.log(`[STEP3-${timestamp}] ${message}`, data || '');
}

// Estado global de la aplicación para el paso 3
window.appStateStep3 = window.appStateStep3 || {
  estadoGlobal: null,
  datosCruzados: null,
  estadisticasCruce: null,
  pywebviewReady: false,
  filtrosActivos: {
    n_wo: '',
    cliente: '',
    contrato: '',
    estado_paso1: '',
    apto_rpa: ''
  },
  datosFiltrados: [],
  paginacion: {
    paginaActual: 1,
    registrosPorPagina: 50,
    totalRegistros: 0,
    totalPaginas: 0
  }
};

// ===================================================================
// FUNCIONES DE INICIALIZACIÓN
// ===================================================================

function initializeStep3App() {
  console.log("🚀 Inicializando aplicación Step 3...");
  
  // Configurar eventos
  setupStep3Buttons();
  
  // Verificar pywebview
  checkStep3PywebviewReady();
  
  // Verificar estado de datos previos
  verificarEstadoDatos();
  
  console.log("✅ Step 3 inicializado correctamente");
}

function setupStep3Buttons() {
  // Botón realizar cruce
  const btnRealizarCruce = document.getElementById('btn-realizar-cruce');
  if (btnRealizarCruce) {
    btnRealizarCruce.addEventListener('click', (event) => {
      event.preventDefault();
      console.log("🔘 Botón realizar cruce clickeado");
      
      if (!window.appStateStep3.pywebviewReady) {
        alert("❌ pywebview no está disponible.");
        return;
      }
      
      mostrarStep3Loading(true);
      realizarCruceDatos();
    });
  }
  
  // Botón exportar excel principal
  const btnExportarExcel = document.getElementById('btn-exportar-excel');
  if (btnExportarExcel) {
    btnExportarExcel.addEventListener('click', (e) => {
      e.preventDefault();
      const datos = window.appStateStep3?.datosFiltrados || [];
      
      if (datos.length === 0) {
        alert("❌ No hay datos del cruce para exportar");
        return;
      }

      exportarExcel(
        { contexto: 'step3_p3', detalle: datos },
        "CrucePaso3.xlsx",
        (resp) => console.log("✅ Exportación completada", resp),
        (err) => console.error("❌ Error al exportar", err)
      );
    });
  }
  
  // Botón exportar excel lateral
  const btnExportarExcelLateral = document.getElementById('btn-exportar-excel-lateral');
  if (btnExportarExcelLateral) {
    btnExportarExcelLateral.addEventListener('click', (e) => {
      e.preventDefault();
      const datos = window.appStateStep3?.datosFiltrados || [];
      
      if (datos.length === 0) {
        alert("❌ No hay datos del cruce para exportar");
        return;
      }

      exportarExcel(
        { contexto: 'step3_p3', detalle: datos },
        "CrucePaso3.xlsx",
        (resp) => console.log("✅ Exportación completada", resp),
        (err) => console.error("❌ Error al exportar", err)
      );
    });
  }
  
  // Botón volver
  const btnVolver = document.getElementById('btn-volver');
  if (btnVolver) {
    btnVolver.addEventListener('click', (e) => {
      e.preventDefault();
      // Limpiar recursos antes de navegar
      limpiarStep3();
      window.location.href = '/step2';
    });
  }
  
  // Botón siguiente
  const btnSiguiente = document.getElementById('btn-siguiente');
  if (btnSiguiente) {
    btnSiguiente.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.appStateStep3.datosCruzados && window.appStateStep3.datosCruzados.length > 0) {
        // Limpiar recursos antes de navegar
        limpiarStep3();
        window.location.href = '/step4';
      } else {
        alert('Debe realizar el cruce de datos antes de continuar');
      }
    });
    // Ocultar por defecto
    btnSiguiente.style.display = 'none';
  }

  // Botón siguiente superior (en Estado de los Datos)
  const btnSiguienteSuperior = document.getElementById('btn-siguiente-superior');
  if (btnSiguienteSuperior) {
    btnSiguienteSuperior.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.appStateStep3.datosCruzados && window.appStateStep3.datosCruzados.length > 0) {
        // Limpiar recursos antes de navegar
        limpiarStep3();
        window.location.href = '/step4';
      } else {
        alert('Debe realizar el cruce de datos antes de continuar');
      }
    });
    // Ocultar por defecto
    btnSiguienteSuperior.style.display = 'none';
  }
}

// ===================================================================
// VERIFICACIÓN DE ESTADO DE DATOS
// ===================================================================

function verificarEstadoDatos() {
  console.log("🔍 Verificando estado de datos previos...");
  
  if (!window.pywebview || !window.pywebview.api) {
    console.warn("⚠️ pywebview no disponible para verificar estado");
    return;
  }
  
  window.pywebview.api.obtener_estado_global()
    .then((estado) => {
      try {
        console.log("✅ Estado global recibido:", estado);

        // Validar que existen las claves necesarias
        const p1 = estado?.paso1_procesado === true;
        const p2 = estado?.paso2_procesado === true;

        if (p1 && p2) {
          habilitarBotonCruce?.();
        } else {
          deshabilitarBotonCruce?.();
        }

        // Lógica extra: actualizar el panel de UI si existe
        if (typeof actualizarEstadoUI === 'function') {
          actualizarEstadoUI({ estado });
        }

      } catch (err) {
        console.error("❌ Error interno en verificarEstadoDatos:", err);
        deshabilitarBotonCruce?.();
      }
    })
    .catch((err) => {
      console.error("❌ Error externo al obtener estado global:", err);
      deshabilitarBotonCruce?.();
    });
}

function actualizarEstadoUI(estadoGlobal) {
  const estado = estadoGlobal.estado;
  
  // Actualizar estado Paso 1
  const dotPaso1 = document.getElementById('dot-paso1');
  const infoPaso1 = document.getElementById('info-paso1');
  
  if (estado.paso1_procesado) {
    dotPaso1.className = 'status-dot success mr-3';
    infoPaso1.innerHTML = `
      <div class="text-green-600 font-medium">✅ Procesado</div>
      <div class="text-xs text-gray-500">${estado.total_registros_paso1} registros</div>
    `;
  } else {
    dotPaso1.className = 'status-dot neutral mr-3';
    infoPaso1.innerHTML = '<div class="text-gray-500">❌ No procesado</div>';
  }
  
  // Actualizar estado Paso 2
  const dotPaso2 = document.getElementById('dot-paso2');
  const infoPaso2 = document.getElementById('info-paso2');
  
  if (estado.paso2_procesado) {
    dotPaso2.className = 'status-dot success mr-3';
    infoPaso2.innerHTML = `
      <div class="text-green-600 font-medium">✅ Procesado</div>
      <div class="text-xs text-gray-500">${estado.total_registros_paso2} registros</div>
    `;
  } else {
    dotPaso2.className = 'status-dot neutral mr-3';
    infoPaso2.innerHTML = '<div class="text-gray-500">❌ No procesado</div>';
  }
  
  // Actualizar estado del proceso
  const estadoProceso = document.getElementById('estado-proceso');
  const estadoProcesoLateral = document.getElementById('estado-proceso-lateral');
  
  if (estado.paso1_procesado && estado.paso2_procesado) {
    if (estadoProceso) estadoProceso.textContent = 'Listo para cruce';
    if (estadoProcesoLateral) estadoProcesoLateral.textContent = 'Listo para realizar cruce de datos';
  } else {
    if (estadoProceso) estadoProceso.textContent = 'Datos incompletos';
    if (estadoProcesoLateral) estadoProcesoLateral.textContent = 'Complete el Paso 1 y Paso 2 primero';
  }
}

// ===================================================================
// CRUCE DE DATOS
// ===================================================================

function realizarCruceDatos() {
  console.log("🔍 Iniciando cruce de datos...");
  
  // Actualizar estado del proceso
  const estadoProceso = document.getElementById('estado-proceso');
  if (estadoProceso) {
    estadoProceso.textContent = "Realizando cruce de datos...";
    estadoProceso.className = "text-blue-600";
  }
  
  const estadoProcesoLateral = document.getElementById('estado-proceso-lateral');
  if (estadoProcesoLateral) {
    estadoProcesoLateral.textContent = "Realizando cruce de datos...";
  }
  
  if (!window.pywebview || !window.pywebview.api) {
    console.error("❌ pywebview no está disponible");
    alert("❌ Error: La conexión con Python no está disponible");
    mostrarStep3Loading(false);
    return;
  }
  
  window.pywebview.api.realizar_cruce_datos()
    .then(respuesta => {
      console.log("📥 Respuesta del cruce recibida:", respuesta);
      mostrarStep3Loading(false);
      
      if (respuesta.success) {
        console.log("✅ Cruce exitoso");
        window.appStateStep3.datosCruzados = respuesta.datos_cruzados;
        window.appStateStep3.estadisticasCruce = respuesta.estadisticas;
        
        mostrarResultadosCruce(respuesta);
        mostrarBotonSiguiente();
        
      } else {
        console.error("❌ Error en cruce:", respuesta.message);
        mostrarErrorStep3(respuesta.message || 'Error desconocido en el cruce');
      }
    })
    .catch(error => {
      console.error("❌ ERROR al realizar cruce:", error);
      mostrarStep3Loading(false);
      mostrarErrorStep3("Error al realizar el cruce de datos: " + error.message);
    });
}

// ===================================================================
// MOSTRAR RESULTADOS DEL CRUCE
// ===================================================================

function mostrarResultadosCruce(resultado) {
  console.log("📊 Mostrando resultados del cruce:", resultado);
  
  const contenedor = document.getElementById('resultado-cruce');
  if (!contenedor) return;

  // ✅ Mostrar el contenedor si estaba oculto
  contenedor.classList.remove('hidden');
  contenedor.style.display = 'block';

  // Ocultar errores y mostrar resultados
  ocultarErrorStep3();

  const datosCruzados = resultado.datos_cruzados || [];

  // Actualizar estado global
  window.appStateStep3.datosFiltrados = [...datosCruzados];
  
  // Configurar paginación
  window.appStateStep3.paginacion.totalRegistros = datosCruzados.length;
  window.appStateStep3.paginacion.totalPaginas = Math.ceil(
    datosCruzados.length / window.appStateStep3.paginacion.registrosPorPagina
  );
  window.appStateStep3.paginacion.paginaActual = 1;

  // Mostrar estadísticas del cruce
  mostrarEstadisticasCruce(resultado.estadisticas);

  // Configurar filtros
  configurarFiltrosCruce();

  // Inicializar tabla con paginación personalizada
  mostrarTablaCruce();
  mostrarControlesPaginacionCruce();

  // Actualizar contador de filtros
  actualizarContadorFiltrosCruce();

  // Actualizar panel lateral
  actualizarPanelLateral(resultado.estadisticas);

  // ✅ Actualizar estado del proceso
  actualizarEstadoProceso(resultado.estadisticas);

  // ✅ Mostrar botón "Siguiente paso"
  mostrarBotonSiguiente();
}


function mostrarEstadisticasCruce(estadisticas) {
  const resumenEstadisticas = document.getElementById('resumen-estadisticas-cruce');
  if (!resumenEstadisticas || !estadisticas) return;

  // 🔧 CORRECCIÓN CLAVE:
  resumenEstadisticas.classList.remove('hidden');
  resumenEstadisticas.style.display = 'block';

  const totalCruzados = estadisticas.total_cruzados || 0;
  const pendientes = estadisticas.pendientes_cierre || 0;
  const cerrados = estadisticas.cerrados || 0;
  const aptosRPA = estadisticas.aptos_rpa || 0;
  const sinWOQ = estadisticas.sin_woq || 0;
  const porcentajeCruce = estadisticas.porcentaje_cruce || 0;

  resumenEstadisticas.innerHTML = `
    <div class="card mb-6 animate-fade-in">
      <div class="card-header">
        <h2 class="text-xl font-semibold text-verisure-dark flex items-center">
          <svg class="w-6 h-6 mr-2 text-verisure-red" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 3V21H21" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18 9V19H15V9H18Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13 5V19H10V5H13Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 13V19H5V13H8Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Estadísticas del Cruce de Datos
        </h2>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div class="text-center p-4 bg-blue-50 rounded-lg">
            <div class="text-2xl font-bold text-blue-600">${totalCruzados}</div>
            <div class="text-xs text-blue-700">Total</div>
          </div>
          <div class="text-center p-4 bg-green-50 rounded-lg">
            <div class="text-2xl font-bold text-green-600">${pendientes}</div>
            <div class="text-xs text-green-700">Pendientes</div>
          </div>
          <div class="text-center p-4 bg-red-50 rounded-lg">
            <div class="text-2xl font-bold text-red-600">${cerrados}</div>
            <div class="text-xs text-red-700">Cerrados</div>
          </div>
          <div class="text-center p-4 bg-purple-50 rounded-lg">
            <div class="text-2xl font-bold text-purple-600">${aptosRPA}</div>
            <div class="text-xs text-purple-700">Aptos RPA</div>
          </div>
          <div class="text-center p-4 bg-yellow-50 rounded-lg">
            <div class="text-2xl font-bold text-yellow-600">${sinWOQ}</div>
            <div class="text-xs text-yellow-700">Sin WOQ</div>
          </div>
          <div class="text-center p-4 bg-gray-100 rounded-lg">
            <div class="text-2xl font-bold text-gray-800">${porcentajeCruce}%</div>
            <div class="text-xs text-gray-700">% Cruce</div>
          </div>
        </div>
      </div>
    </div>
  `;
}


function actualizarPanelLateral(estadisticas) {
  const panel = document.getElementById('statistics-summary-step3');
  const acciones = document.getElementById('quick-actions-step3');
  
  if (panel) {
    panel.style.display = 'block';
    
    document.getElementById('stat-total-cruzados').textContent = estadisticas.total_cruzados || 0;
    document.getElementById('stat-pendientes').textContent = estadisticas.pendientes_cierre || 0;
    document.getElementById('stat-cerrados').textContent = estadisticas.cerrados || 0;
    document.getElementById('stat-aptos-rpa').textContent = estadisticas.aptos_rpa || 0;
  }
  
  if (acciones) {
    acciones.style.display = 'block';
  }
}

function actualizarEstadoProceso(estadisticas) {
  const totalCruzados = estadisticas.total_cruzados || 0;
  const aptosRPA = estadisticas.aptos_rpa || 0;
  
  // Actualizar estado del proceso principal
  const estadoProceso = document.getElementById('estado-proceso');
  if (estadoProceso) {
    estadoProceso.textContent = `${totalCruzados} registros cruzados, ${aptosRPA} aptos para RPA`;
    estadoProceso.className = "text-green-600";
  }
  
  // Actualizar estado del proceso lateral
  const estadoProcesoLateral = document.getElementById('estado-proceso-lateral');
  if (estadoProcesoLateral) {
    estadoProcesoLateral.textContent = `${totalCruzados} registros cruzados, ${aptosRPA} aptos para RPA`;
  }
  
  console.log("✅ Estado del proceso actualizado correctamente");
}

// ===================================================================
// PAGINACIÓN PERSONALIZADA (Similar a Step1)
// ===================================================================

function mostrarTablaCruce() {
  const datosPagina = obtenerDatosPaginaActualCruce();
  const tablaHtml = generarTablaHtmlCruce(datosPagina);

  const tablaContainer = document.getElementById('tabla-cruce');
  if (tablaContainer) {
    tablaContainer.innerHTML = tablaHtml;
  }
}

function obtenerDatosPaginaActualCruce() {
  const inicio = (window.appStateStep3.paginacion.paginaActual - 1) * window.appStateStep3.paginacion.registrosPorPagina;
  const fin = inicio + window.appStateStep3.paginacion.registrosPorPagina;
  return window.appStateStep3.datosFiltrados.slice(inicio, fin);
}

function mostrarControlesPaginacionCruce() {
  const { paginaActual, totalPaginas, totalRegistros, registrosPorPagina } = window.appStateStep3.paginacion;

  const inicio = (paginaActual - 1) * registrosPorPagina + 1;
  const fin = Math.min(paginaActual * registrosPorPagina, totalRegistros);

  const controlsHtml = `
    <div class="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 border-t">
      <div class="flex items-center gap-4">
        <span class="text-sm text-gray-700">
          Mostrando ${inicio} a ${fin} de ${totalRegistros} registros
        </span>
        <select id="registros-por-pagina-cruce" class="form-input text-sm" style="width: auto; min-width: 100px;">
          <option value="10" ${registrosPorPagina === 10 ? 'selected' : ''}>10 por página</option>
          <option value="25" ${registrosPorPagina === 25 ? 'selected' : ''}>25 por página</option>
          <option value="50" ${registrosPorPagina === 50 ? 'selected' : ''}>50 por página</option>
          <option value="100" ${registrosPorPagina === 100 ? 'selected' : ''}>100 por página</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="irPaginaAnteriorCruce()" ${paginaActual <= 1 ? 'disabled' : ''} class="btn btn-outline btn-sm">
          ← Anterior
        </button>
        <span class="text-sm text-gray-700">
          Página ${paginaActual} de ${totalPaginas}
        </span>
        <button onclick="irPaginaSiguienteCruce()" ${paginaActual >= totalPaginas ? 'disabled' : ''} class="btn btn-outline btn-sm">
          Siguiente →
        </button>
      </div>
    </div>
  `;

  const tablaContainer = document.getElementById('tabla-cruce');
  if (tablaContainer) {
    // Eliminar controles anteriores si existen
    const existingControls = tablaContainer.querySelector('.paginacion-controls');
    if (existingControls) {
      existingControls.remove();
    }

    // Crear un nuevo div para los controles y agregarlo al contenedor
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'paginacion-controls';
    controlsDiv.innerHTML = controlsHtml;
    tablaContainer.appendChild(controlsDiv);

    // Configurar el evento del selector de registros por página
    const selector = document.getElementById('registros-por-pagina-cruce');
    if (selector) {
      selector.addEventListener('change', (e) => {
        window.appStateStep3.paginacion.registrosPorPagina = parseInt(e.target.value);
        window.appStateStep3.paginacion.paginaActual = 1;
        window.appStateStep3.paginacion.totalPaginas = Math.ceil(
          window.appStateStep3.datosFiltrados.length / window.appStateStep3.paginacion.registrosPorPagina
        );
        mostrarTablaCruce();
        mostrarControlesPaginacionCruce();
      });
    }
  }
}

function irPaginaAnteriorCruce() {
  if (window.appStateStep3.paginacion.paginaActual > 1) {
    window.appStateStep3.paginacion.paginaActual--;
    mostrarTablaCruce();
    mostrarControlesPaginacionCruce();
  }
}

function irPaginaSiguienteCruce() {
  if (window.appStateStep3.paginacion.paginaActual < window.appStateStep3.paginacion.totalPaginas) {
    window.appStateStep3.paginacion.paginaActual++;
    mostrarTablaCruce();
    mostrarControlesPaginacionCruce();
  }
}

function generarTablaHtmlCruce(datos) {
  if (!datos || datos.length === 0) {
    return '<div class="text-center py-8 text-gray-500">No hay datos para mostrar en esta página</div>';
  }

  // Obtener todas las columnas disponibles del primer registro
  const todasLasColumnas = Object.keys(datos[0]);
  
  // Debug: verificar qué columnas están llegando
  console.log("🔍 Columnas disponibles:", todasLasColumnas);
  console.log("🔍 ¿Tiene Estado_Paso1?", todasLasColumnas.includes('Estado_Paso1'));
  console.log("🔍 ¿Tiene Apto RPA?", todasLasColumnas.includes('Apto RPA'));
  
  // Definir columnas principales que queremos mostrar primero (si existen)
  const columnasPreferidas = [
    'CONTRATO', 'N_WO', 'N°_WO', 'CLIENTE', 'DEALER', 
    'STATUS1', 'STATUS2', 'CERRADO', 'F_SIST'
  ];
  
  // Definir columnas que van al final (antes de Acciones)
  const columnasFinales = [
    'N_WO2', 'ORDEN_CONTRATO', 'es_cerrado', 'Estado_Paso1', 'Apto RPA'
  ];
  
  // Crear lista ordenada: primero las preferidas, luego el resto, luego las finales
  const columnasOrdenadas = [];
  
  // Agregar columnas preferidas que existan
  columnasPreferidas.forEach(col => {
    if (todasLasColumnas.includes(col)) {
      columnasOrdenadas.push(col);
    }
  });
  
  // Agregar columnas restantes que no estén en preferidas ni finales
  todasLasColumnas.forEach(col => {
    if (!columnasPreferidas.includes(col) && !columnasFinales.includes(col)) {
      columnasOrdenadas.push(col);
    }
  });
  
  // Agregar columnas finales que existan
  columnasFinales.forEach(col => {
    if (todasLasColumnas.includes(col)) {
      columnasOrdenadas.push(col);
    }
  });

  let html = `
    <div class="overflow-x-auto max-h-96 overflow-y-auto">
      <table class="min-w-full bg-white border border-gray-300 rounded-lg">
        <thead class="bg-gray-50 sticky top-0">
          <tr>
  `;

  // Generar encabezados dinámicamente
  columnasOrdenadas.forEach(col => {
    // Nombres de columnas más legibles
    let nombreColumna = col.toUpperCase();
    switch(col) {
      case 'N_WO': 
      case 'N°_WO': 
      case 'N_WO2': 
        nombreColumna = col; 
        break;
      case 'ES_CERRADO':
      case 'es_cerrado': 
        nombreColumna = 'CERRADO'; 
        break;
      case 'ORDEN_CONTRATO':
        nombreColumna = 'ORDEN CONTRATO'; 
        break;
      case 'Estado_Paso1': 
        nombreColumna = 'ESTADO PASO 1'; 
        break;
      case 'Apto RPA': 
        nombreColumna = 'APTO RPA'; 
        break;
      default: 
        nombreColumna = col.replace(/_/g, ' ');
    }
    html += `<th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">${nombreColumna}</th>`;
  });
  
  html += `
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">ACCIONES</th>
          </tr>
        </thead>
        <tbody>
  `;

  datos.forEach((fila, index) => {
    html += `<tr class="hover:bg-gray-50" data-index="${index}">`;
    
    // Generar celdas dinámicamente
    columnasOrdenadas.forEach(col => {
      let valor = fila[col] !== undefined && fila[col] !== null ? fila[col] : '';
      
      // Formatear valores especiales
      if (col === 'Apto RPA') {
        html += `<td class="px-3 py-2 border-b text-xs text-center">${generarChipAptoRPA(valor)}</td>`;
      } else if (col === 'Estado_Paso1') {
        const estadoChip = generarChipEstadoPaso1(valor);
        html += `<td class="px-3 py-2 border-b text-xs text-center">${estadoChip}</td>`;
      } else if (col === 'ES_CERRADO' || col === 'es_cerrado') {
        const cerradoChip = generarChipCerrado(valor);
        html += `<td class="px-3 py-2 border-b text-xs text-center">${cerradoChip}</td>`;
      } else if (col === 'N_WO2' || col === 'ORDEN_CONTRATO') {
        // Mostrar estos campos importantes sin formateo especial
        html += `<td class="px-3 py-2 border-b text-xs">${valor || 'N/A'}</td>`;
      } else {
        // Formatear valor según su tipo
        const valorFormateado = formatearValorCruce(valor, col);
        html += `<td class="px-3 py-2 border-b text-xs">${valorFormateado}</td>`;
      }
    });
    
    // Agregar columna de acciones
    html += `
      <td class="px-3 py-2 border-b text-xs">
        <button onclick="verDetallesCruce(${index})" class="text-blue-600 hover:text-blue-800 text-xs">
          👁️ Ver
        </button>
      </td>
    </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  return html;
}

// Función helper para formatear valores
function formatearValorCruce(valor, columna) {
  if (valor === null || valor === undefined || valor === '') return '';
  
  // Formateo específico según el tipo de columna
  switch(columna) {
    case 'CONTRATO':
    case 'N_WO':
    case 'N°_WO':
    case 'N_WO2':
      return `<span class="font-semibold">${valor}</span>`;
    default:
      return String(valor);
  }
}

// Función helper para generar chip de estado del Paso 1
function generarChipEstadoPaso1(estado) {
  if (!estado) return '<span class="chip chip-neutral">Sin estado</span>';
  
  switch(String(estado).toLowerCase()) {
    case 'correcto':
      return '<span class="chip chip-success">✅ Correcto</span>';
    case 'error':
      return '<span class="chip chip-danger">❌ Error</span>';
    case 'advertencia':
      return '<span class="chip chip-warning">⚠️ Advertencia</span>';
    default:
      return `<span class="chip chip-neutral">${estado}</span>`;
  }
}

// Función helper para generar chip de cerrado
function generarChipCerrado(valor) {
  if (!valor) return '<span class="chip chip-neutral">No definido</span>';
  
  const valorStr = String(valor).toUpperCase();
  if (['SI', 'SÍ', 'TRUE', '1', 'YES'].includes(valorStr)) {
    return '<span class="chip chip-success">🔒 Cerrado</span>';
  } else if (['NO', 'FALSE', '0'].includes(valorStr)) {
    return '<span class="chip chip-warning">🔓 Abierto</span>';
  }
  
  return `<span class="chip chip-neutral">${valor}</span>`;
}

function generarChipEstadoCruce(estado) {
  const clases = {
    'Pendiente': 'bg-yellow-100 text-yellow-800',
    'Cerrado': 'bg-green-100 text-green-800',
    'Sin WOQ': 'bg-red-100 text-red-800'
  };
  
  const iconos = {
    'Pendiente': '⏳',
    'Cerrado': '✅',
    'Sin WOQ': '❌'
  };
  
  const clase = clases[estado] || 'bg-gray-100 text-gray-800';
  const icono = iconos[estado] || '❓';
  
  return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${clase}">
    ${icono} ${estado}
  </span>`;
}

function generarChipAptoRPA(valor) {
  if (valor === "SÍ") return `<span class="chip chip-blue">🤖 SÍ</span>`;
  if (valor === "NO") return `<span class="chip chip-gray">🚫 NO</span>`;
  return `<span class="chip chip-neutral">❓ NULL</span>`;
}

// ===================================================================
// FILTROS
// ===================================================================

function configurarFiltrosCruce() {
  // Crear panel de filtros dinámicamente
  const contenedor = document.getElementById('resultado-cruce');
  if (!contenedor) return;
  
  // Buscar si ya existe el panel de filtros
  let panelFiltros = document.getElementById('panel-filtros-cruce');
  if (!panelFiltros) {
    // Crear panel de filtros
    panelFiltros = document.createElement('div');
    panelFiltros.id = 'panel-filtros-cruce';
    panelFiltros.className = 'card mb-6 animate-fade-in';
    panelFiltros.innerHTML = `
      <div class="card-header">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-verisure-dark flex items-center">
            <svg class="w-5 h-5 mr-2 text-verisure-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"/>
            </svg>
            Filtros de Búsqueda
          </h3>
          <span id="contador-filtrados-cruce" class="text-sm text-gray-500">0 registros mostrados</span>
        </div>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label class="form-label text-sm">N° WO</label>
            <input type="text" id="filtro-n-wo" placeholder="Filtrar por N° WO..." class="form-input text-sm">
          </div>
          <div>
            <label class="form-label text-sm">Cliente</label>
            <input type="text" id="filtro-cliente" placeholder="Filtrar por cliente..." class="form-input text-sm">
          </div>
          <div>
            <label class="form-label text-sm">Contrato</label>
            <input type="text" id="filtro-contrato" placeholder="Filtrar por contrato..." class="form-input text-sm">
          </div>
          <div>
            <label class="form-label text-sm">Estado Paso 1</label>
            <select id="filtro-estado-paso1" class="form-input text-sm">
              <option value="">Todos</option>
              <option value="Correcto">Correcto</option>
              <option value="Error">Error</option>
              <option value="Advertencia">Advertencia</option>
            </select>
          </div>
          <div>
            <label class="form-label text-sm">Apto RPA</label>
            <select id="filtro-apto-rpa" class="form-input text-sm">
              <option value="">Todos</option>
              <option value="SÍ">Sí</option>
              <option value="NO">No</option>
              <option value="NULL">Sin evaluación</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end">
          <button id="btn-limpiar-filtros-cruce" class="btn btn-outline btn-sm">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Limpiar filtros
          </button>
        </div>
      </div>
    `;
    
    // Insertar antes de la tabla
    const tablaCard = contenedor.querySelector('.card:last-child');
    if (tablaCard) {
      contenedor.insertBefore(panelFiltros, tablaCard);
    }
  }
  
  // Configurar eventos de filtros con los nuevos campos
  const filtros = [
    { id: 'filtro-n-wo', key: 'n_wo' },
    { id: 'filtro-cliente', key: 'cliente' },
    { id: 'filtro-contrato', key: 'contrato' },
    { id: 'filtro-estado-paso1', key: 'estado_paso1' },
    { id: 'filtro-apto-rpa', key: 'apto_rpa' }
  ];
  
  filtros.forEach(filtroConfig => {
    const input = document.getElementById(filtroConfig.id);
    if (input) {
      const tipoElemento = input.tagName.toLowerCase();
      
      if (tipoElemento === 'select') {
        input.addEventListener('change', (e) => {
          window.appStateStep3.filtrosActivos[filtroConfig.key] = e.target.value;
          aplicarFiltrosCruce();
        });
      } else {
        input.addEventListener('input', (e) => {
          window.appStateStep3.filtrosActivos[filtroConfig.key] = e.target.value;
          aplicarFiltrosCruce();
        });
      }
    }
  });
  
  // Configurar botón limpiar filtros
  const btnLimpiar = document.getElementById('btn-limpiar-filtros-cruce');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', limpiarFiltrosCruce);
  }
}

function aplicarFiltrosCruce() {
  const datosOriginales = window.appStateStep3.datosCruzados || [];
  
  const filtros = {
    n_wo: (window.appStateStep3.filtrosActivos.n_wo || '').toLowerCase(),
    cliente: (window.appStateStep3.filtrosActivos.cliente || '').toLowerCase(),
    contrato: (window.appStateStep3.filtrosActivos.contrato || '').toLowerCase(),
    estado_paso1: window.appStateStep3.filtrosActivos.estado_paso1 || '',
    apto_rpa: window.appStateStep3.filtrosActivos.apto_rpa || ''
  };
  
  console.log('🔍 Filtros aplicados:', filtros);
  
  const datosFiltrados = datosOriginales.filter(fila => {
    // Buscar N° WO en varios campos posibles
    const nWoText = [
      fila['N_WO'], fila['N°_WO'], fila['N_WO2']
    ].filter(Boolean).join(' ').toLowerCase();
    const cumpleNWO = filtros.n_wo === '' || nWoText.includes(filtros.n_wo);
    
    // Buscar cliente en campos de cliente
    const clienteText = [
      fila['CLIENTE'], fila['Cliente']
    ].filter(Boolean).join(' ').toLowerCase();
    const cumpleCliente = filtros.cliente === '' || clienteText.includes(filtros.cliente);
    
    // Buscar contrato
    const contratoText = (fila['CONTRATO'] || '').toString().toLowerCase();
    const cumpleContrato = filtros.contrato === '' || contratoText.includes(filtros.contrato);
    
    // Filtrar por Estado Paso 1
    const cumpleEstadoPaso1 = filtros.estado_paso1 === '' || 
      (fila['Estado_Paso1'] === filtros.estado_paso1);
    
    // Filtrar por Apto RPA
    const cumpleRPA = filtros.apto_rpa === '' ||
      (((fila['Apto RPA'] ?? '').toString().toUpperCase() || 'NULL') === filtros.apto_rpa.toUpperCase());
    
    return cumpleNWO && cumpleCliente && cumpleContrato && cumpleEstadoPaso1 && cumpleRPA;
  });
  
  window.appStateStep3.datosFiltrados = datosFiltrados;
  
  // Actualizar paginación
  window.appStateStep3.paginacion.totalRegistros = datosFiltrados.length;
  window.appStateStep3.paginacion.totalPaginas = Math.ceil(
    datosFiltrados.length / window.appStateStep3.paginacion.registrosPorPagina
  );
  window.appStateStep3.paginacion.paginaActual = 1;
  
  // Mostrar tabla actualizada
  mostrarTablaCruce();
  mostrarControlesPaginacionCruce();
  
  // Actualizar contador
  const contador = document.getElementById('contador-filtrados-cruce');
  if (contador) {
    contador.textContent = `${datosFiltrados.length} registros mostrados`;
  }
  
  actualizarContadorFiltrosCruce();
}

function limpiarFiltrosCruce() {
  window.appStateStep3.filtrosActivos = {
    n_wo: '',
    cliente: '',
    contrato: '',
    estado_paso1: '',
    apto_rpa: ''
  };
  
  // Limpiar inputs con los nuevos IDs
  ['n-wo', 'cliente', 'contrato', 'estado-paso1', 'apto-rpa'].forEach(filtro => {
    const input = document.getElementById(`filtro-${filtro}`);
    if (input) {
      if (input.tagName === 'SELECT') {
        input.selectedIndex = 0;
      } else {
        input.value = '';
      }
    }
  });
  
  // Restaurar datos originales
  window.appStateStep3.datosFiltrados = [...(window.appStateStep3.datosCruzados || [])];
  
  // Actualizar paginación
  window.appStateStep3.paginacion.totalRegistros = window.appStateStep3.datosFiltrados.length;
  window.appStateStep3.paginacion.totalPaginas = Math.ceil(
    window.appStateStep3.datosFiltrados.length / window.appStateStep3.paginacion.registrosPorPagina
  );
  window.appStateStep3.paginacion.paginaActual = 1;
  
  // Mostrar tabla actualizada
  mostrarTablaCruce();
  mostrarControlesPaginacionCruce();
  
  actualizarContadorFiltrosCruce();
}

function actualizarContadorFiltrosCruce() {
  const contador = document.getElementById('contador-filtrados-cruce');
  if (contador) {
    contador.textContent = `${window.appStateStep3.datosFiltrados.length} registros mostrados`;
  }
}

// ===================================================================
// MODALES Y DETALLES
// ===================================================================

function verDetallesCruce(index) {
  const registro = window.appStateStep3.datosFiltrados[index];
  if (!registro) return;

  // Crear contenido de modal con todos los datos del registro
  let contenidoHtml = `<div class="p-4">`;
  
  // Cabecera con datos principales
  contenidoHtml += `
    <div class="mb-4 pb-3 border-b">
      <h3 class="text-lg font-bold">Detalle del Registro del Paso 3</h3>
      <div class="flex flex-wrap gap-2 mt-2">
        <span class="badge badge-info">Contrato: ${registro.CONTRATO || 'N/A'}</span>
        <span class="badge badge-info">N° WO: ${registro.N_WO || registro['N°_WO'] || registro.N_WO2 || 'N/A'}</span>
        <span class="badge ${registro['Apto RPA'] === 'SÍ' ? 'badge-success' : registro['Apto RPA'] === 'NO' ? 'badge-warning' : 'badge-neutral'}">
          ${registro['Apto RPA'] || 'Sin evaluación'}
        </span>
      </div>
    </div>
  `;
  
  // Tabla con todos los datos
  contenidoHtml += `<div class="overflow-x-auto">
    <table class="min-w-full">
      <thead>
        <tr>
          <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2">Campo</th>
          <th class="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-2">Valor</th>
        </tr>
      </thead>
      <tbody>`;

      // Mostrar todos los campos del registro
      for (const clave in registro) {
        let valor = registro[clave];
        if (valor === null || valor === undefined) {
          valor = 'N/A';
        }
        
        contenidoHtml += `
          <tr>
            <td class="py-2 font-medium">${clave}</td>
            <td class="py-2">${valor}</td>
          </tr>
        `;
      }

      contenidoHtml += `
          </tbody>
        </table>
      </div>
    </div>`;

  // Crear y mostrar modal
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Detalles del Registro del Cruce</h3>
        <button onclick="cerrarModalCruce()" class="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      ${contenidoHtml}
      <div class="mt-6 flex justify-end">
        <button onclick="cerrarModalCruce()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Cerrar
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);

  window.cerrarModalCruce = function() {
    document.body.removeChild(modal);
    delete window.cerrarModalCruce;
  };
}

// ===================================================================
// UTILIDADES DE UI
// ===================================================================

function mostrarStep3Loading(mostrar) {
  const loadingSpinner = document.getElementById('loading-spinner');
  const btnRealizarCruce = document.getElementById('btn-realizar-cruce');
  
  if (loadingSpinner) {
    loadingSpinner.style.display = mostrar ? 'block' : 'none';
  }
  
  if (btnRealizarCruce) {
    btnRealizarCruce.disabled = mostrar;
    if (mostrar) {
      btnRealizarCruce.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Realizando cruce...';
    } else {
      btnRealizarCruce.innerHTML = '<i class="fas fa-exchange-alt me-2"></i>Realizar Cruce de Datos';
    }
  }
}

function mostrarErrorStep3(mensaje) {
  const errorDiv = document.getElementById('error-cruce');
  if (errorDiv) {
    errorDiv.style.display = 'block';
    const errorMessage = errorDiv.querySelector('.error-message');
    if (errorMessage) {
      errorMessage.textContent = mensaje;
    } else {
      errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i><span class="error-message">${mensaje}</span>`;
    }
  }
  
  // Ocultar resultados
  ocultarResultadosStep3();
}

function ocultarErrorStep3() {
  const errorDiv = document.getElementById('error-cruce');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

function ocultarResultadosStep3() {
  const resultado = document.getElementById('resultado-cruce');
  const resumen = document.getElementById('resumen-estadisticas-cruce');
  
  if (resultado) resultado.style.display = 'none';
  if (resumen) resumen.style.display = 'none';
}

function mostrarBotonSiguiente() {
  // Mostrar botón inferior (en la sección de resultados)
  const btnSiguiente = document.getElementById('btn-siguiente');
  if (btnSiguiente) {
    btnSiguiente.style.display = 'inline-block';
    btnSiguiente.style.visibility = 'visible';
    btnSiguiente.disabled = false;
    console.log("✅ Botón 'Siguiente paso' inferior habilitado y mostrado");
  } else {
    console.warn("⚠️ No se encontró el botón 'btn-siguiente'");
  }

  // Mostrar botón superior (en Estado de los Datos)
  const btnSiguienteSuperior = document.getElementById('btn-siguiente-superior');
  if (btnSiguienteSuperior) {
    btnSiguienteSuperior.style.display = 'inline-block';
    btnSiguienteSuperior.style.visibility = 'visible';
    btnSiguienteSuperior.disabled = false;
    console.log("✅ Botón 'Siguiente paso' superior habilitado y mostrado");
  } else {
    console.warn("⚠️ No se encontró el botón 'btn-siguiente-superior'");
  }
}

function ocultarBotonSiguiente() {
  // Ocultar botón inferior
  const btnSiguiente = document.getElementById('btn-siguiente');
  if (btnSiguiente) {
    btnSiguiente.style.display = 'none';
  }

  // Ocultar botón superior
  const btnSiguienteSuperior = document.getElementById('btn-siguiente-superior');
  if (btnSiguienteSuperior) {
    btnSiguienteSuperior.style.display = 'none';
  }
}

function habilitarBotonCruce() {
  document.getElementById("btn-realizar-cruce")?.removeAttribute("disabled");
}

function deshabilitarBotonCruce() {
  document.getElementById("btn-realizar-cruce")?.setAttribute("disabled", true);
}

// ===================================================================
// EXPORTACIÓN
// ===================================================================

function exportarCruce() {
  console.log("📊 Iniciando exportación del cruce");
  
  if (!window.appStateStep3.datosFiltrados || window.appStateStep3.datosFiltrados.length === 0) {
    alert("❌ No hay datos del cruce para exportar");
    return;
  }

  const datos = window.appStateStep3.datosFiltrados || [];

  exportarExcel(
    { contexto: 'step3_p3', detalle: datos },
    "CrucePaso3.xlsx",
    (resp) => console.log("✅ Exportación completada", resp),
    (err) => console.error("❌ Error al exportar", err)
  );
}

// ===================================================================
// REINICIO DEL SISTEMA
// ===================================================================

function reiniciarSistema() {
  if (!confirm('¿Está seguro de que desea reiniciar completamente el sistema? Se perderán todos los datos procesados.')) {
    return;
  }
  
  console.log("🔄 Iniciando reinicio del sistema");
  
  if (!window.pywebview || !window.pywebview.api) {
    alert("❌ Función de reinicio no disponible");
    return;
  }
  
  window.pywebview.api.limpiar_estado_completo()
    .then(respuesta => {
      if (respuesta.success) {
        alert('✅ Sistema reiniciado correctamente');
        // Redirigir al inicio
        window.location.href = '/';
      } else {
        alert('❌ Error al reiniciar: ' + respuesta.message);
      }
    })
    .catch(error => {
      console.error('❌ Error al reiniciar sistema:', error);
      alert('❌ Error al reiniciar el sistema: ' + error.message);
    });
}

// ===================================================================
// PYWEBVIEW
// ===================================================================

function checkStep3PywebviewReady() {
  if (window.pywebview && window.pywebview.api && !window.appStateStep3.pywebviewReady) {
    console.log("🎉 pywebview detectado directamente en Step 3!");
    window.appStateStep3.pywebviewReady = true;
    
    // Verificar estado de datos una vez que pywebview esté listo
    verificarEstadoDatos();
  }
}

// Verificación periódica de pywebview
if (!window.pywebviewCheckerStep3) {
  window.pywebviewCheckerStep3 = setInterval(() => {
    checkStep3PywebviewReady();
    if (window.appStateStep3.pywebviewReady) {
      clearInterval(window.pywebviewCheckerStep3);
      window.pywebviewCheckerStep3 = null;
      console.log("✅ pywebview listo en Step 3 - deteniendo verificación");
    }
  }, 500);
}

// ===================================================================
// FUNCIONES DE LIMPIEZA Y DESTRUCCIÓN
// ===================================================================

function limpiarStep3() {
  debugStep3("🧹 Iniciando limpieza de recursos del Step 3");
  
  try {
    // Verificar estado inicial
    trackDataTableState();
    
    // Limpiar DataTable si existe
    if ($.fn.DataTable.isDataTable('#tabla-cruce')) {
      $('#tabla-cruce').DataTable().clear().destroy();
      debugStep3("✅ DataTable destruido correctamente");
    }
    
    // Limpiar referencia
    if (window.appStateStep3) {
      window.appStateStep3.dataTableInstance = null;
      debugStep3("🗑️ Referencias DataTable limpiadas");
    }
    
    // Limpiar intervalos si existen
    if (window.pywebviewCheckerStep3) {
      clearInterval(window.pywebviewCheckerStep3);
      window.pywebviewCheckerStep3 = null;
      debugStep3("⏱️ Intervalos de verificación limpiados");
    }

    // Ocultar botones de siguiente paso
    ocultarBotonSiguiente();
    debugStep3("🔲 Botones de siguiente paso ocultados");
    
    debugStep3("✅ Limpieza completada exitosamente");
    
  } catch (error) {
    debugStep3("⚠️ Error durante la limpieza:", error.message);
    console.error("Error completo de limpieza:", error);
  }
}

// Event listeners para limpieza
window.addEventListener('beforeunload', limpiarStep3);

// Event listener para pywebview ready
window.addEventListener('_pywebviewready', () => {
  console.log("🎉 _pywebviewready disparado en Step 3!");
  window.appStateStep3.pywebviewReady = true;
  
  // Verificar estado de datos
  verificarEstadoDatos();
});

// ===================================================================
// INICIALIZACIÓN
// ===================================================================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeStep3App);
} else {
  initializeStep3App();
}

// Verificación inicial de pywebview
setTimeout(checkStep3PywebviewReady, 100);

// Exponer funciones globales necesarias
window.reiniciarSistema = reiniciarSistema;
window.verDetallesCruce = verDetallesCruce;
window.initializeStep3App = initializeStep3App;

// ===================================================================
// FUNCIONES GLOBALES PARA HTML ONCLICK
// ===================================================================

// Hacer las funciones de paginación accesibles globalmente
window.irPaginaAnteriorCruce = irPaginaAnteriorCruce;
window.irPaginaSiguienteCruce = irPaginaSiguienteCruce;

console.log("📄 Step 3 JavaScript cargado completamente");

