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
    wo: '',
    cliente: '',
    tipo: '',
    estado_cruce: '',
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
        { detalle: datos },
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
        { detalle: datos },
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

  let html = `
    <div class="overflow-x-auto max-h-96 overflow-y-auto">
      <table class="min-w-full bg-white border border-gray-300 rounded-lg">
        <thead class="bg-gray-50 sticky top-0">
          <tr>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">WO</th>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">CLIENTE</th>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">TIPO</th>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">CANTIDAD</th>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">WOQ CLIENTE</th>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">ESTADO CRUCE</th>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">APTO RPA</th>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">WOQ CONTRATO</th>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">WOQ ES CERRADO</th>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">ACCIONES</th>
          </tr>
        </thead>
        <tbody>
  `;

  datos.forEach((fila, index) => {
    const estadoChip = generarChipEstadoCruce(fila.estado_cruce);
    const rpaChip = generarChipAptoRPA(fila.apto_rpa);

    html += `
      <tr class="hover:bg-gray-50" data-index="${index}">
        <td class="px-3 py-2 border-b text-xs">${fila.wo || ''}</td>
        <td class="px-3 py-2 border-b text-xs">${fila.cliente || ''}</td>
        <td class="px-3 py-2 border-b text-xs">${fila.tipo || ''}</td>
        <td class="px-3 py-2 border-b text-xs text-center">${fila.cantidad || 0}</td>
        <td class="px-3 py-2 border-b text-xs">${fila.woq_cliente || 'N/A'}</td>
        <td class="px-3 py-2 border-b text-xs text-center">${estadoChip}</td>
        <td class="px-3 py-2 border-b text-xs text-center">${rpaChip}</td>
        <td class="px-3 py-2 border-b text-xs">${fila.woq_contrato || ''}</td>
        <td class="px-3 py-2 border-b text-xs">${fila.woq_es_cerrado || ''}</td>
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

function generarChipAptoRPA(apto) {
  const esApto = apto === true;
  const clase = esApto ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  const icono = esApto ? '🤖' : '🚫';
  const texto = esApto ? 'Sí' : 'No';
  
  return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${clase}">
    ${icono} ${texto}
  </span>`;
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
            <label class="form-label text-sm">WO</label>
            <input type="text" id="filtro-wo-cruce" placeholder="Filtrar por WO..." class="form-input text-sm">
          </div>
          <div>
            <label class="form-label text-sm">Cliente</label>
            <input type="text" id="filtro-cliente-cruce" placeholder="Filtrar por cliente..." class="form-input text-sm">
          </div>
          <div>
            <label class="form-label text-sm">Tipo</label>
            <select id="filtro-tipo-cruce" class="form-input text-sm">
              <option value="">Todos</option>
              <option value="AMCE">AMCE</option>
              <option value="DMCE">DMCE</option>
            </select>
          </div>
          <div>
            <label class="form-label text-sm">Estado Cruce</label>
            <select id="filtro-estado-cruce" class="form-input text-sm">
              <option value="">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Cerrado">Cerrado</option>
              <option value="Sin WOQ">Sin WOQ</option>
            </select>
          </div>
          <div>
            <label class="form-label text-sm">Apto RPA</label>
            <select id="filtro-apto-rpa" class="form-input text-sm">
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
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
  
  // Configurar eventos de filtros
  const campos = ['wo-cruce', 'cliente-cruce', 'tipo-cruce', 'estado-cruce', 'apto-rpa'];
  
  campos.forEach(filtro => {
    const input = document.getElementById(`filtro-${filtro}`);
    if (input) {
      const tipoElemento = input.tagName.toLowerCase();
      // Mapear correctamente los nombres de filtros
      let nombreFiltro;
      if (filtro === 'estado-cruce') {
        nombreFiltro = 'estado_cruce';
      } else if (filtro === 'apto-rpa') {
        nombreFiltro = 'apto_rpa';
      } else {
        nombreFiltro = filtro.replace('-cruce', '');
      }
      
      if (tipoElemento === 'select') {
        input.addEventListener('change', (e) => {
          window.appStateStep3.filtrosActivos[nombreFiltro] = e.target.value;
          aplicarFiltrosCruce();
        });
      } else {
        input.addEventListener('input', (e) => {
          window.appStateStep3.filtrosActivos[nombreFiltro] = e.target.value;
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
    wo: window.appStateStep3.filtrosActivos.wo.toLowerCase(),
    cliente: window.appStateStep3.filtrosActivos.cliente.toLowerCase(),
    tipo: window.appStateStep3.filtrosActivos.tipo, // Sin toLowerCase para select
    estado_cruce: window.appStateStep3.filtrosActivos.estado_cruce,
    apto_rpa: window.appStateStep3.filtrosActivos.apto_rpa
  };
  
  // Debug temporal
  console.log('🔍 Filtros aplicados:', filtros);
  
  const datosFiltrados = datosOriginales.filter(fila => {
    const cumpleWO = (fila.wo || '').toLowerCase().includes(filtros.wo);
    const cumpleCliente = (fila.cliente || '').toLowerCase().includes(filtros.cliente);
    const cumpleTipo = filtros.tipo === '' || fila.tipo === filtros.tipo; // Comparación exacta para select
    const cumpleEstado = filtros.estado_cruce === '' || fila.estado_cruce === filtros.estado_cruce;
    const cumpleRPA = filtros.apto_rpa === '' || 
                      (filtros.apto_rpa === 'true' && fila.apto_rpa === true) ||
                      (filtros.apto_rpa === 'false' && fila.apto_rpa === false);
    
    return cumpleWO && cumpleCliente && cumpleTipo && cumpleEstado && cumpleRPA;
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
  
  actualizarContadorFiltrosCruce();
}

function limpiarFiltrosCruce() {
  window.appStateStep3.filtrosActivos = {
    wo: '',
    cliente: '',
    tipo: '',
    estado_cruce: '',
    apto_rpa: ''
  };
  
  // Limpiar inputs
  ['wo-cruce', 'cliente-cruce', 'tipo-cruce', 'estado-cruce', 'apto-rpa'].forEach(filtro => {
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

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Detalles del Registro Cruzado</h3>
        <button onclick="cerrarModalCruce()" class="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-6">
          <div class="border-r pr-6">
            <h4 class="font-semibold text-gray-800 mb-3">Datos del Paso 1 (WorkOrder)</h4>
            <div class="space-y-2 text-sm">
              <div><strong>WO:</strong> ${registro.wo || 'N/A'}</div>
              <div><strong>MANT:</strong> ${registro.mant || 'N/A'}</div>
              <div><strong>CLIENTE:</strong> ${registro.cliente || 'N/A'}</div>
              <div><strong>REFERENCIA:</strong> ${registro.referencia || 'N/A'}</div>
              <div><strong>TIPO:</strong> ${registro.tipo || 'N/A'}</div>
              <div><strong>CANTIDAD:</strong> ${registro.cantidad || 0}</div>
              <div><strong>ESTADO:</strong> ${registro.estado || 'N/A'}</div>
            </div>
          </div>
          <div class="pl-6">
            <h4 class="font-semibold text-gray-800 mb-3">Datos del Paso 2 (WOQ)</h4>
            <div class="space-y-2 text-sm">
              <div><strong>CONTRATO:</strong> ${registro.woq_contrato || 'N/A'}</div>
              <div><strong>N° WO:</strong> ${registro.woq_n_wo || 'N/A'}</div>
              <div><strong>CLIENTE WOQ:</strong> ${registro.woq_cliente || 'N/A'}</div>
              <div><strong>ORDEN:</strong> ${registro.woq_orden || 'N/A'}</div>
              <div><strong>CERRADO:</strong> ${registro.woq_cerrado || 'N/A'}</div>
              <div><strong>ES CERRADO:</strong> ${registro.woq_es_cerrado ? 'Sí' : 'No'}</div>
            </div>
          </div>
        </div>
        <div class="border-t pt-4">
          <h4 class="font-semibold text-gray-800 mb-3">Resultado del Cruce</h4>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div><strong>ESTADO CRUCE:</strong> ${generarChipEstadoCruce(registro.estado_cruce)}</div>
            <div><strong>APTO RPA:</strong> ${generarChipAptoRPA(registro.apto_rpa)}</div>
            <div><strong>OBSERVACIONES:</strong> ${registro.observaciones || 'Sin observaciones'}</div>
          </div>
        </div>
      </div>
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
  const btnSiguiente = document.getElementById('btn-siguiente');
  if (btnSiguiente) {
    btnSiguiente.style.display = 'inline-block';
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
    { detalle: datos },
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

