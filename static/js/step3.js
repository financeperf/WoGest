// ===================================================================
// WOGest - Step 3 JavaScript v2.1 - ERROR TRACKING MEJORADO
// Cruce de datos entre Paso 1 y Paso 2
// ===================================================================

// ===================================================================
// DEBUG Y ERROR TRACKING
// ===================================================================

function debugStep3(message, data = null) {
  const timestamp = new Date().toISOString().substr(11, 8);
  console.log(`[STEP3-${timestamp}] ${message}`, data || '');
}

function trackDataTableState() {
  const tabla = document.getElementById('tabla-cruce');
  const isDataTable = tabla && $.fn.DataTable.isDataTable('#tabla-cruce');
  const hasInstance = !!(window.appStateStep3?.dataTableInstance);
  
  debugStep3('📊 Estado DataTable:', {
    elementExists: !!tabla,
    isDataTable: isDataTable,
    hasInstance: hasInstance,
    tableHTML: tabla ? 'exists' : 'missing'
  });
  
  return { tabla, isDataTable, hasInstance };
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
  dataTableInstance: null
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
  
  // Ocultar errores y mostrar resultados
  ocultarErrorStep3();
  contenedor.style.display = 'block';
  
  const datosCruzados = resultado.datos_cruzados || [];
  
  // Actualizar estado global
  window.appStateStep3.datosFiltrados = [...datosCruzados];
  
  // Mostrar estadísticas del cruce
  mostrarEstadisticasCruce(resultado.estadisticas);
  
  // Configurar filtros
  configurarFiltrosCruce();
  
  // Inicializar DataTable
  inicializarDataTableCruce(datosCruzados);
  
  // Actualizar contador de filtros
  actualizarContadorFiltrosCruce();
  
  // Actualizar panel lateral
  actualizarPanelLateral(resultado.estadisticas);
}

function mostrarEstadisticasCruce(estadisticas) {
  const resumenEstadisticas = document.getElementById('resumen-estadisticas-cruce');
  if (!resumenEstadisticas) return;
  
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
          <svg class="w-6 h-6 mr-2 text-verisure-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          Estadísticas del Cruce de Datos
        </h2>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div class="text-center p-4 bg-blue-50 rounded-lg">
            <div class="text-2xl font-bold text-blue-600">${totalCruzados}</div>
            <div class="text-sm text-blue-700">Cruzados</div>
          </div>
          <div class="text-center p-4 bg-yellow-50 rounded-lg">
            <div class="text-2xl font-bold text-yellow-600">${pendientes}</div>
            <div class="text-sm text-yellow-700">Pendientes</div>
          </div>
          <div class="text-center p-4 bg-green-50 rounded-lg">
            <div class="text-2xl font-bold text-green-600">${cerrados}</div>
            <div class="text-sm text-green-700">Cerrados</div>
          </div>
          <div class="text-center p-4 bg-purple-50 rounded-lg">
            <div class="text-2xl font-bold text-purple-600">${aptosRPA}</div>
            <div class="text-sm text-purple-700">Aptos RPA</div>
          </div>
          <div class="text-center p-4 bg-red-50 rounded-lg">
            <div class="text-2xl font-bold text-red-600">${sinWOQ}</div>
            <div class="text-sm text-red-700">Sin WOQ</div>
          </div>
          <div class="text-center p-4 bg-indigo-50 rounded-lg">
            <div class="text-2xl font-bold text-indigo-600">${porcentajeCruce}%</div>
            <div class="text-sm text-indigo-700">% Cruce</div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  resumenEstadisticas.style.display = 'block';
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
// DATATABLE
// ===================================================================

function inicializarDataTableCruce(data) {
  debugStep3("📊 Inicializando DataTable Step 3", { registros: data.length });
  
  // Verificar estado inicial
  const estadoInicial = trackDataTableState();
  
  if (!estadoInicial.tabla) {
    console.error("❌ No se encontró la tabla #tabla-cruce");
    return;
  }
  
  // ✅ SOLUCIÓN ROBUSTA para destruir instancia previa de DataTable
  try {
    debugStep3("🔍 Verificando instancia previa de DataTable");
    
    // Verificar si ya existe una instancia de DataTable
    if ($.fn.DataTable.isDataTable('#tabla-cruce')) {
      debugStep3("🔄 Destruyendo instancia previa de DataTable");
      $('#tabla-cruce').DataTable().clear().destroy();
      debugStep3("✅ Instancia destruida correctamente");
    }
    
    // Limpiar referencias independientemente del estado
    window.appStateStep3.dataTableInstance = null;
    
  } catch (err) {
    debugStep3('⚠️ Error al destruir instancia previa:', err.message);
    // Forzar limpieza de instancia en caso de error
    window.appStateStep3.dataTableInstance = null;
  }
  
  // Limpiar completamente la tabla
  const tbody = estadoInicial.tabla.querySelector('tbody');
  if (tbody) {
    tbody.innerHTML = '';
    debugStep3("🧹 Tabla tbody limpiado");
  }
  
  // Llenar tabla con datos
  debugStep3("📝 Llenando tabla con datos");
  data.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-4 py-2 border-b text-sm">${row.wo || ''}</td>
      <td class="px-4 py-2 border-b text-sm">${row.cliente || ''}</td>
      <td class="px-4 py-2 border-b text-sm">${row.tipo || ''}</td>
      <td class="px-4 py-2 border-b text-sm text-center">${row.cantidad || 0}</td>
      <td class="px-4 py-2 border-b text-sm">${row.woq_cliente || 'N/A'}</td>
      <td class="px-4 py-2 border-b text-sm text-center">${generarChipEstadoCruce(row.estado_cruce)}</td>
      <td class="px-4 py-2 border-b text-sm text-center">${generarChipAptoRPA(row.apto_rpa)}</td>
      <td class="px-4 py-2 border-b text-sm">${row.woq_contrato ?? ''}</td>
      <td class="px-4 py-2 border-b text-sm">${row.woq_cliente ?? ''}</td>
      <td class="px-4 py-2 border-b text-sm">${row.woq_es_cerrado ?? ''}</td>
      <td class="px-4 py-2 border-b text-sm text-center">
        <button onclick="verDetallesCruce(${index})" class="btn-icon btn-info" title="Ver detalles">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  debugStep3("📊 Datos insertados en tabla", { filas: tbody.children.length });
  
  // ✅ Inicializar DataTable con manejo de errores mejorado
  try {
    // Verificar nuevamente que no exista instancia antes de crear una nueva
    const estadoFinal = trackDataTableState();
    
    if (!estadoFinal.isDataTable) {
      debugStep3("🚀 Creando nueva instancia de DataTable");
      
      window.appStateStep3.dataTableInstance = $('#tabla-cruce').DataTable({
        scrollX: true,
        scrollY: '400px',
        scrollCollapse: true,
        pageLength: 25,
        responsive: true,
        dom: 'Bfrtip',
        buttons: [
          {
            extend: 'excel',
            text: '<i class="fas fa-file-excel me-2"></i>Exportar Excel',
            className: 'btn btn-success btn-sm'
          },
          {
            extend: 'copy',
            text: '<i class="fas fa-copy me-2"></i>Copiar',
            className: 'btn btn-secondary btn-sm'
          },
          {
            extend: 'csv',
            text: '<i class="fas fa-file-csv me-2"></i>Exportar CSV',
            className: 'btn btn-info btn-sm'
          }
        ],
        language: {
          url: '//cdn.datatables.net/plug-ins/1.10.24/i18n/Spanish.json'
        },
        columnDefs: [
          { targets: '_all', className: 'text-center' },
          { targets: [10], orderable: false } // Columna de acciones
        ],
        order: [[0, 'asc']] // Ordenar por WO por defecto
      });
      
      debugStep3("✅ DataTable inicializado correctamente");
    } else {
      debugStep3("⚠️ Ya existe una instancia de DataTable, omitiendo inicialización");
    }
  } catch (error) {
    debugStep3("❌ Error al inicializar DataTable:", error.message);
    console.error("Error completo:", error);
    // En caso de error, intentar limpiar y reinicializar
    window.appStateStep3.dataTableInstance = null;
  }
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
            <input type="text" id="filtro-tipo-cruce" placeholder="Filtrar por tipo..." class="form-input text-sm">
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
      const nombreFiltro = filtro.replace('-cruce', '').replace('-', '_');
      
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
    tipo: window.appStateStep3.filtrosActivos.tipo.toLowerCase(),
    estado_cruce: window.appStateStep3.filtrosActivos.estado_cruce,
    apto_rpa: window.appStateStep3.filtrosActivos.apto_rpa
  };
  
  const datosFiltrados = datosOriginales.filter(fila => {
    const cumpleWO = (fila.wo || '').toLowerCase().includes(filtros.wo);
    const cumpleCliente = (fila.cliente || '').toLowerCase().includes(filtros.cliente);
    const cumpleTipo = (fila.tipo || '').toLowerCase().includes(filtros.tipo);
    const cumpleEstado = filtros.estado_cruce === '' || fila.estado_cruce === filtros.estado_cruce;
    const cumpleRPA = filtros.apto_rpa === '' || 
                      (filtros.apto_rpa === 'true' && fila.apto_rpa === true) ||
                      (filtros.apto_rpa === 'false' && fila.apto_rpa === false);
    
    return cumpleWO && cumpleCliente && cumpleTipo && cumpleEstado && cumpleRPA;
  });
  
  window.appStateStep3.datosFiltrados = datosFiltrados;
  
  // Actualizar DataTable
  if (window.appStateStep3.dataTableInstance) {
    window.appStateStep3.dataTableInstance.clear();
    
    datosFiltrados.forEach((row, index) => {
      window.appStateStep3.dataTableInstance.row.add([
        row.wo || '',
        row.cliente || '',
        row.tipo || '',
        row.cantidad || 0,
        row.woq_cliente || 'N/A',
        generarChipEstadoCruce(row.estado_cruce),
        generarChipAptoRPA(row.apto_rpa),
        `<button onclick="verDetallesCruce(${index})" class="btn-icon btn-info" title="Ver detalles">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        </button>`
      ]);
    });
    
    window.appStateStep3.dataTableInstance.draw();
  }
  
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
  
  // Actualizar DataTable
  if (window.appStateStep3.dataTableInstance) {
    inicializarDataTableCruce(window.appStateStep3.datosFiltrados);
  }
  
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
  
  if (!window.appStateStep3.datosCruzados || window.appStateStep3.datosCruzados.length === 0) {
    alert("❌ No hay datos del cruce para exportar");
    return;
  }
  
  if (!window.pywebview || !window.pywebview.api) {
    alert("❌ Función de exportación no disponible");
    return;
  }
  
  // Usar la función de exportación con ruta personalizada
  window.pywebview.api.seleccionar_directorio_exportacion()
    .then(respuesta => {
      if (respuesta.success) {
        const payload = {
          datos: {
            detalle: window.appStateStep3.datosCruzados,
            estadisticas: window.appStateStep3.estadisticasCruce
          },
          carpeta_destino: respuesta.ruta
        };
        
        return window.pywebview.api.exportar_excel_con_ruta(payload);
      } else {
        throw new Error(respuesta.message || "Selección cancelada");
      }
    })
    .then(respuesta => {
      if (respuesta && respuesta.success) {
        alert(`✅ Cruce exportado exitosamente: ${respuesta.message}`);
        // Opcional: abrir carpeta
        if (window.pywebview.api.abrir_carpeta_archivo) {
          window.pywebview.api.abrir_carpeta_archivo(respuesta.archivo);
        }
      } else {
        throw new Error(respuesta?.message || "Error desconocido");
      }
    })
    .catch(error => {
      console.error('❌ Error al exportar cruce:', error);
      if (error.message !== "Selección cancelada") {
        alert('❌ Error al exportar el cruce: ' + error.message);
      }
    });
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
window.exportarCruce = exportarCruce;
window.reiniciarSistema = reiniciarSistema;
window.verDetallesCruce = verDetallesCruce;
window.initializeStep3App = initializeStep3App;

console.log("📄 Step 3 JavaScript cargado completamente");

