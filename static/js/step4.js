// ===================================================================
// WOGest - Step 4 JavaScript v2.0
// Visualización y exportación RPA
// ===================================================================

// Estado global de la aplicación para el paso 4
window.appStateStep4 = window.appStateStep4 || {
  datosRPA: null,
  estadisticasRPA: null,
  pywebviewReady: false,
  filtrosActivos: {
    wo: '',
    cliente: '',
    tipo: '',
    referencia: '',
    contrato: ''
  },
  datosFiltrados: [],
  dataTableInstance: null
};

// Carga diferida de export-utils sin usar <script type="module">
let __exportUtilsPromise = null;
function loadExportUtils() {
  if (!__exportUtilsPromise) {
    __exportUtilsPromise = import('/static/js/export-utils.js'); // ruta absoluta
  }
  return __exportUtilsPromise;
}

// ===================================================================
// FUNCIONES DE INICIALIZACIÓN
// ===================================================================

function initializeStep4App() {
  console.log("🚀 Inicializando aplicación Step 4...");
  
  // Configurar eventos
  setupStep4Buttons();
  
  // Verificar pywebview
  checkStep4PywebviewReady();
  
  // Cargar datos RPA
  cargarDatosRPA();
  
  console.log("✅ Step 4 inicializado correctamente");
}

function setupStep4Buttons() {
  // Botón exportar RPA
  const btnExportarRPA = document.getElementById('btn-exportar-rpa');
  if (btnExportarRPA) {
    btnExportarRPA.addEventListener('click', handleExportarRPA);
  }
  
  // Botón volver
  const btnVolver = document.getElementById('btn-volver');
  if (btnVolver) {
    btnVolver.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/step3';
    });
  }
  
  // Botón finalizar
  const btnFinalizar = document.getElementById('btn-finalizar');
  if (btnFinalizar) {
    btnFinalizar.addEventListener('click', (e) => {
      e.preventDefault();
      // Mostrar mensaje de proceso completado
      alert('¡Proceso completado exitosamente!');
      // Opcional: redireccionar al inicio
      // window.location.href = '/';
    });
    // Ocultar por defecto
    btnFinalizar.style.display = 'none';
  }
}

// ===================================================================
// CARGA DE DATOS RPA
// ===================================================================

function cargarDatosRPA() {
  console.log("🔍 Cargando datos RPA...");
  
  if (!window.pywebview || !window.pywebview.api) {
    console.warn("⚠️ pywebview no disponible para cargar datos RPA");
    setTimeout(cargarDatosRPA, 1000); // Reintentar en 1 segundo
    return;
  }
  
  window.pywebview.api.obtener_datos_para_rpa()
    .then(respuesta => {
      console.log("📥 Datos RPA recibidos:", respuesta);
      
      if (respuesta.success) {
        window.appStateStep4.datosRPA = respuesta.registros_rpa;
        window.appStateStep4.estadisticasRPA = respuesta.estadisticas;
        
        actualizarEstadoRPA(respuesta);
        mostrarDatosRPA(respuesta);
        
        if (respuesta.registros_rpa && respuesta.registros_rpa.length > 0) {
          habilitarBotonExportar();
        } else {
          deshabilitarBotonExportar();
        }
      } else {
        console.error("❌ Error al cargar datos RPA:", respuesta.message);
        mostrarErrorStep4("Error al cargar datos RPA: " + respuesta.message);
      }
    })
    .catch(error => {
      console.error("❌ Error al cargar datos RPA:", error);
      mostrarErrorStep4("Error de conexión al cargar datos RPA");
    });
}

function actualizarEstadoRPA(datosRPA) {
  const totalRegistros = datosRPA.total_registros || 0;
  
  // Actualizar estado RPA
  const dotRPA = document.getElementById('dot-rpa');
  const infoRPA = document.getElementById('info-rpa');
  
  if (totalRegistros > 0) {
    dotRPA.className = 'status-dot success mr-3';
    infoRPA.innerHTML = `
      <div class="text-green-600 font-medium">✅ Datos listos</div>
      <div class="text-xs text-gray-500">${totalRegistros} registros aptos para RPA</div>
    `;
  } else {
    dotRPA.className = 'status-dot warning mr-3';
    infoRPA.innerHTML = '<div class="text-yellow-600">⚠️ No hay registros aptos para RPA</div>';
  }
  
  // Actualizar estado del proceso
  const estadoProceso = document.getElementById('estado-proceso');
  const estadoProcesoLateral = document.getElementById('estado-proceso-lateral');
  
  if (totalRegistros > 0) {
    if (estadoProceso) estadoProceso.textContent = 'Listo para exportar';
    if (estadoProcesoLateral) estadoProcesoLateral.textContent = `${totalRegistros} registros listos para RPA`;
  } else {
    if (estadoProceso) estadoProceso.textContent = 'Sin datos RPA';
    if (estadoProcesoLateral) estadoProcesoLateral.textContent = 'No hay registros aptos para RPA';
  }
}

// ===================================================================
// MOSTRAR DATOS RPA
// ===================================================================

function mostrarDatosRPA(resultado) {
  console.log("📊 Mostrando datos RPA:", resultado);
  
  const contenedor = document.getElementById('datos-rpa');
  if (!contenedor) return;
  
  // Ocultar errores y mostrar resultados
  ocultarErrorStep4();
  contenedor.style.display = 'block';
  
  const registrosRPA = resultado.registros_rpa || [];
  
  // Actualizar estado global
  window.appStateStep4.datosFiltrados = [...registrosRPA];
  
  // Mostrar estadísticas RPA
  mostrarEstadisticasRPA(resultado);
  
  // Configurar filtros
  configurarFiltrosRPA();
  
  // Inicializar DataTable
  inicializarDataTableRPA(registrosRPA);
  
  // Actualizar contador de filtros
  actualizarContadorFiltrosRPA();
  
  // Actualizar panel lateral
  actualizarPanelLateralRPA(resultado);
}

function mostrarEstadisticasRPA(resultado) {
  const resumenEstadisticas = document.getElementById('resumen-estadisticas-rpa');
  if (!resumenEstadisticas) return;
  
  const registrosRPA = resultado.registros_rpa || [];
  const totalRPA = registrosRPA.length;
  
  // Calcular estadísticas adicionales
  const tiposUnicos = [...new Set(registrosRPA.map(r => r.tipo))].length;
  const clientesUnicos = [...new Set(registrosRPA.map(r => r.cliente))].length;
  const cantidadTotal = registrosRPA.reduce((sum, r) => sum + (r.cantidad || 0), 0);
  
  resumenEstadisticas.innerHTML = `
    <div class="card mb-6 animate-fade-in">
      <div class="card-header">
        <h2 class="text-xl font-semibold text-verisure-dark flex items-center">
          <svg class="w-6 h-6 mr-2 text-verisure-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
          </svg>
          Estadísticas de Exportación RPA
        </h2>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="text-center p-4 bg-blue-50 rounded-lg">
            <div class="text-2xl font-bold text-blue-600">${totalRPA}</div>
            <div class="text-sm text-blue-700">Total RPA</div>
          </div>
          <div class="text-center p-4 bg-green-50 rounded-lg">
            <div class="text-2xl font-bold text-green-600">${tiposUnicos}</div>
            <div class="text-sm text-green-700">Tipos</div>
          </div>
          <div class="text-center p-4 bg-purple-50 rounded-lg">
            <div class="text-2xl font-bold text-purple-600">${clientesUnicos}</div>
            <div class="text-sm text-purple-700">Clientes</div>
          </div>
          <div class="text-center p-4 bg-yellow-50 rounded-lg">
            <div class="text-2xl font-bold text-yellow-600">${cantidadTotal}</div>
            <div class="text-sm text-yellow-700">Cantidad Total</div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  resumenEstadisticas.style.display = 'block';
}

function actualizarPanelLateralRPA(resultado) {
  const panel = document.getElementById('statistics-summary-step4');
  const acciones = document.getElementById('quick-actions-step4');
  
  if (panel) {
    panel.style.display = 'block';
    
    const registrosRPA = resultado.registros_rpa || [];
    const tiposUnicos = [...new Set(registrosRPA.map(r => r.tipo))].length;
    const clientesUnicos = [...new Set(registrosRPA.map(r => r.cliente))].length;
    
    document.getElementById('stat-total-rpa').textContent = registrosRPA.length;
    document.getElementById('stat-pendientes-rpa').textContent = registrosRPA.length; // Todos son pendientes
    document.getElementById('stat-tipos-rpa').textContent = tiposUnicos;
    document.getElementById('stat-clientes-rpa').textContent = clientesUnicos;
  }
  
  if (acciones) {
    acciones.style.display = 'block';
  }
}

// ===================================================================
// DATATABLE
// ===================================================================

function inicializarDataTableRPA(data) {
  console.log("📊 Inicializando DataTable Step 4 con", data.length, "registros");
  
  const tabla = document.getElementById('tabla-rpa');
  if (!tabla) return;
  
  // Destruir instancia previa si existe
  if (window.appStateStep4.dataTableInstance) {
    window.appStateStep4.dataTableInstance.destroy();
    window.appStateStep4.dataTableInstance = null;
  }
  
  // Limpiar tabla
  const tbody = tabla.querySelector('tbody');
  if (tbody) tbody.innerHTML = '';
  
  // Llenar tabla con datos
  data.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-4 py-2 border-b text-sm">${row.wo || ''}</td>
      <td class="px-4 py-2 border-b text-sm">${row.cliente || ''}</td>
      <td class="px-4 py-2 border-b text-sm">${row.tipo || ''}</td>
      <td class="px-4 py-2 border-b text-sm text-center">${row.cantidad || 0}</td>
      <td class="px-4 py-2 border-b text-sm">${row.referencia || ''}</td>
      <td class="px-4 py-2 border-b text-sm">${row.woq_contrato || 'N/A'}</td>
      <td class="px-4 py-2 border-b text-sm text-center">${generarChipEstadoRPA(row.estado_cruce)}</td>
      <td class="px-4 py-2 border-b text-sm text-center">
        <button onclick="verDetallesRPA(${index})" class="btn-icon btn-info" title="Ver detalles">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Inicializar DataTable con jQuery
  try {
    window.appStateStep4.dataTableInstance = $('#tabla-rpa').DataTable({
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
      destroy: true,
      language: {
        url: '/static/js/i18n/Spanish.json'
      },
      columnDefs: [
        { targets: '_all', className: 'text-center' },
        { targets: [7], orderable: false }
      ]
    });
    
    console.log("✅ DataTable inicializado correctamente");
  } catch (error) {
    console.error("❌ Error al inicializar DataTable:", error);
  }
}

function generarChipEstadoRPA(estado) {
  const clases = {
    'Pendiente': 'bg-yellow-100 text-yellow-800',
    'Cerrado': 'bg-green-100 text-green-800',
    'Sin WOQ': 'bg-red-100 text-red-800'
  };
  
  const iconos = {
    'Pendiente': '🤖',
    'Cerrado': '✅',
    'Sin WOQ': '❌'
  };
  
  const clase = clases[estado] || 'bg-gray-100 text-gray-800';
  const icono = iconos[estado] || '❓';
  
  return `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${clase}">
    ${icono} ${estado}
  </span>`;
}

// ===================================================================
// FILTROS
// ===================================================================

function configurarFiltrosRPA() {
  // Crear panel de filtros dinámicamente
  const contenedor = document.getElementById('datos-rpa');
  if (!contenedor) return;
  
  // Buscar si ya existe el panel de filtros
  let panelFiltros = document.getElementById('panel-filtros-rpa');
  if (!panelFiltros) {
    // Crear panel de filtros
    panelFiltros = document.createElement('div');
    panelFiltros.id = 'panel-filtros-rpa';
    panelFiltros.className = 'card mb-6 animate-fade-in';
    panelFiltros.innerHTML = `
      <div class="card-header">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-verisure-dark flex items-center">
            <svg class="w-5 h-5 mr-2 text-verisure-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"/>
            </svg>
            Filtros de Búsqueda RPA
          </h3>
          <span id="contador-filtrados-rpa" class="text-sm text-gray-500">0 registros mostrados</span>
        </div>
      </div>
      <div class="card-body">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label class="form-label text-sm">WO</label>
            <input type="text" id="filtro-wo-rpa" placeholder="Filtrar por WO..." class="form-input text-sm">
          </div>
          <div>
            <label class="form-label text-sm">Cliente</label>
            <input type="text" id="filtro-cliente-rpa" placeholder="Filtrar por cliente..." class="form-input text-sm">
          </div>
          <div>
            <label class="form-label text-sm">Tipo</label>
            <input type="text" id="filtro-tipo-rpa" placeholder="Filtrar por tipo..." class="form-input text-sm">
          </div>
          <div>
            <label class="form-label text-sm">Referencia</label>
            <input type="text" id="filtro-referencia-rpa" placeholder="Filtrar por referencia..." class="form-input text-sm">
          </div>
          <div>
            <label class="form-label text-sm">Contrato</label>
            <input type="text" id="filtro-contrato-rpa" placeholder="Filtrar por contrato..." class="form-input text-sm">
          </div>
        </div>
        <div class="flex justify-end">
          <button id="btn-limpiar-filtros-rpa" class="btn btn-outline btn-sm">
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
  const campos = ['wo-rpa', 'cliente-rpa', 'tipo-rpa', 'referencia-rpa', 'contrato-rpa'];
  
  campos.forEach(filtro => {
    const input = document.getElementById(`filtro-${filtro}`);
    if (input) {
      const nombreFiltro = filtro.replace('-rpa', '');
      
      input.addEventListener('input', (e) => {
        window.appStateStep4.filtrosActivos[nombreFiltro] = e.target.value;
        aplicarFiltrosRPA();
      });
    }
  });
  
  // Configurar botón limpiar filtros
  const btnLimpiar = document.getElementById('btn-limpiar-filtros-rpa');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', limpiarFiltrosRPA);
  }
}

function aplicarFiltrosRPA() {
  const datosOriginales = window.appStateStep4.datosRPA || [];
  
  const filtros = {
    wo: window.appStateStep4.filtrosActivos.wo.toLowerCase(),
    cliente: window.appStateStep4.filtrosActivos.cliente.toLowerCase(),
    tipo: window.appStateStep4.filtrosActivos.tipo.toLowerCase(),
    referencia: window.appStateStep4.filtrosActivos.referencia.toLowerCase(),
    contrato: window.appStateStep4.filtrosActivos.contrato.toLowerCase()
  };
  
  const datosFiltrados = datosOriginales.filter(fila => {
    const cumpleWO = (fila.wo || '').toLowerCase().includes(filtros.wo);
    const cumpleCliente = (fila.cliente || '').toLowerCase().includes(filtros.cliente);
    const cumpleTipo = (fila.tipo || '').toLowerCase().includes(filtros.tipo);
    const cumpleReferencia = (fila.referencia || '').toLowerCase().includes(filtros.referencia);
    const cumpleContrato = (fila.woq_contrato || '').toLowerCase().includes(filtros.contrato);
    
    return cumpleWO && cumpleCliente && cumpleTipo && cumpleReferencia && cumpleContrato;
  });
  
  window.appStateStep4.datosFiltrados = datosFiltrados;
  
  // Actualizar DataTable
  if (window.appStateStep4.dataTableInstance) {
    window.appStateStep4.dataTableInstance.clear();
    
    datosFiltrados.forEach((row, index) => {
      window.appStateStep4.dataTableInstance.row.add([
        row.wo || '',
        row.cliente || '',
        row.tipo || '',
        row.cantidad || 0,
        row.referencia || '',
        row.woq_contrato || 'N/A',
        generarChipEstadoRPA(row.estado_cruce),
        `<button onclick="verDetallesRPA(${index})" class="btn-icon btn-info" title="Ver detalles">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
        </button>`
      ]);
    });
    
    window.appStateStep4.dataTableInstance.draw();
  }
  
  actualizarContadorFiltrosRPA();
}

function limpiarFiltrosRPA() {
  window.appStateStep4.filtrosActivos = {
    wo: '',
    cliente: '',
    tipo: '',
    referencia: '',
    contrato: ''
  };
  
  // Limpiar inputs
  ['wo-rpa', 'cliente-rpa', 'tipo-rpa', 'referencia-rpa', 'contrato-rpa'].forEach(filtro => {
    const input = document.getElementById(`filtro-${filtro}`);
    if (input) {
      input.value = '';
    }
  });
  
  // Restaurar datos originales
  window.appStateStep4.datosFiltrados = [...(window.appStateStep4.datosRPA || [])];
  
  // Actualizar DataTable
  if (window.appStateStep4.dataTableInstance) {
    inicializarDataTableRPA(window.appStateStep4.datosFiltrados);
  }
  
  actualizarContadorFiltrosRPA();
}

function actualizarContadorFiltrosRPA() {
  const contador = document.getElementById('contador-filtrados-rpa');
  if (contador) {
    contador.textContent = `${window.appStateStep4.datosFiltrados.length} registros mostrados`;
  }
}

// ===================================================================
// MODALES Y DETALLES
// ===================================================================

function verDetallesRPA(index) {
  const registro = window.appStateStep4.datosFiltrados[index];

  if (!registro) return;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Detalles del Registro RPA</h3>
        <button onclick="cerrarModalRPA()" class="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-6">
          <div class="border-r pr-6">
            <h4 class="font-semibold text-gray-800 mb-3">Datos Principales</h4>
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
            <h4 class="font-semibold text-gray-800 mb-3">Datos WOQ</h4>
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
          <h4 class="font-semibold text-gray-800 mb-3">Estado RPA</h4>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div><strong>ESTADO CRUCE:</strong> ${generarChipEstadoRPA(registro.estado_cruce)}</div>
            <div><strong>APTO RPA:</strong> <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">🤖 Sí</span></div>
            <div><strong>OBSERVACIONES:</strong> ${registro.observaciones || 'Sin observaciones'}</div>
          </div>
        </div>
      </div>
      <div class="mt-6 flex justify-end">
        <button onclick="cerrarModalRPA()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  window.cerrarModalRPA = function() {
    document.body.removeChild(modal);
    delete window.cerrarModalRPA;
  };
}

// ===================================================================
// UTILIDADES DE UI
// ===================================================================

function mostrarStep4Loading(mostrar) {
  const loadingSpinner = document.getElementById('loading-spinner');
  const btnExportarRPA = document.getElementById('btn-exportar-rpa');
  
  if (loadingSpinner) {
    loadingSpinner.style.display = mostrar ? 'block' : 'none';
  }
  
  if (btnExportarRPA) {
    btnExportarRPA.disabled = mostrar;
    if (mostrar) {
      btnExportarRPA.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Exportando...';
    } else {
      btnExportarRPA.innerHTML = '<i class="fas fa-download me-2"></i>Exportar RPA';
    }
  }
}

function mostrarErrorStep4(mensaje) {
  const errorDiv = document.getElementById('error-rpa');
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
  ocultarResultadosStep4();
}

function mostrarExitoStep4(mensaje) {
  const successDiv = document.getElementById('success-rpa');
  if (successDiv) {
    successDiv.style.display = 'block';
    const successMessage = successDiv.querySelector('.success-message');
    if (successMessage) {
      successMessage.textContent = mensaje;
    } else {
      successDiv.innerHTML = `<i class="fas fa-check-circle me-2"></i><span class="success-message">${mensaje}</span>`;
    }
  }
  
  // Mostrar botón finalizar
  mostrarBotonFinalizar();
}

function ocultarErrorStep4() {
  const errorDiv = document.getElementById('error-rpa');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

function ocultarResultadosStep4() {
  const resultado = document.getElementById('datos-rpa');
  const resumen = document.getElementById('resumen-estadisticas-rpa');
  
  if (resultado) resultado.style.display = 'none';
  if (resumen) resumen.style.display = 'none';
}

function mostrarBotonFinalizar() {
  const btnFinalizar = document.getElementById('btn-finalizar');
  if (btnFinalizar) {
    btnFinalizar.style.display = 'inline-block';
  }
}

function habilitarBotonExportar() {
  const btn = document.getElementById('btn-exportar-rpa');
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('disabled');
    console.log("✅ Botón exportar RPA habilitado");
  }
}

function deshabilitarBotonExportar() {
  const btn = document.getElementById('btn-exportar-rpa');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('disabled');
    console.log("❌ Botón exportar RPA deshabilitado");
  }
}

// ===================================================================
// EXPORTACIÓN
// ===================================================================

async function handleExportarRPA(e) {
  if (e?.preventDefault) e.preventDefault();
  console.log("🔘 Exportar RPA (Step 4)");

  if (!window.pywebview || !window.pywebview.api) {
    alert("❌ pywebview no está disponible.");
    return;
  }

  const detalle = window.appStateStep4?.datosRPA || [];
  if (!Array.isArray(detalle) || detalle.length === 0) {
    alert("❌ No hay datos para exportar");
    return;
  }

  try {
    mostrarStep4Loading(true);

    const { exportarExcel } = await loadExportUtils();
    await exportarExcel(
      {
        contexto: 'step4_rpa', // para que el backend ejecute la rama del Paso 4
        detalle,
        estadisticas: window.appStateStep4.estadisticasRPA
      },
      "Aptos_RPA_P4.xlsx",
      // onSuccess
      (resultado) => {
        console.log("✅ Exportación completada:", resultado);
        if (resultado?.redirect_home) {
          window.location.href = "/";
        } else {
          mostrarExitoStep4(`Exportación completada: ${resultado.total_registros} registros`);
          mostrarBotonFinalizar();
        }
      },
      // onError
      (msg) => {
        mostrarErrorStep4("Error al exportar: " + msg);
      }
    );
  } catch (err) {
    console.error("❌ Error inesperado exportando:", err);
    mostrarErrorStep4("Error inesperado: " + (err?.message || err));
  } finally {
    mostrarStep4Loading(false);
  }
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

function checkStep4PywebviewReady() {
  if (window.pywebview && window.pywebview.api && !window.appStateStep4.pywebviewReady) {
    console.log("🎉 pywebview detectado directamente en Step 4!");
    window.appStateStep4.pywebviewReady = true;
    
    // Cargar datos RPA una vez que pywebview esté listo
    cargarDatosRPA();
  }
}

// Verificación periódica de pywebview
if (!window.pywebviewCheckerStep4) {
  window.pywebviewCheckerStep4 = setInterval(() => {
    checkStep4PywebviewReady();
    if (window.appStateStep4.pywebviewReady) {
      clearInterval(window.pywebviewCheckerStep4);
      window.pywebviewCheckerStep4 = null;
      console.log("✅ pywebview listo en Step 4 - deteniendo verificación");
    }
  }, 500);
}

// Event listener para pywebview ready
window.addEventListener('_pywebviewready', () => {
  console.log("🎉 _pywebviewready disparado en Step 4!");
  window.appStateStep4.pywebviewReady = true;
  
  // Cargar datos RPA
  cargarDatosRPA();
});

// ===================================================================
// INICIALIZACIÓN
// ===================================================================

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeStep4App);
} else {
  initializeStep4App();
}

// Verificación inicial de pywebview
setTimeout(checkStep4PywebviewReady, 100);

// Exponer funciones globales necesarias
window.reiniciarSistema = reiniciarSistema;
window.verDetallesRPA = verDetallesRPA;
window.initializeStep4App = initializeStep4App;

console.log("📄 Step 4 JavaScript cargado completamente");


