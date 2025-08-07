import { exportarExcel } from './export-utils.js';

// Función para formatear valores según su tipo
function formatearValor(valor, columna) {
  // Manejo especial para PRECIO y CUOTA: mostrar 0 en lugar de N/A
  if (['precio', 'cuota'].includes(columna.toLowerCase())) {
    if (valor === null || valor === undefined || valor === '' || valor === 'N/A') {
      return '0';
    }
    const num = parseFloat(valor);
    if (!isNaN(num)) {
      return num.toFixed(2);
    }
    return '0';
  }
  
  // Para otros campos numéricos
  if (columna.toLowerCase() === 'cantidad') {
    if (valor === null || valor === undefined) return 'N/A';
    const num = parseFloat(valor);
    if (!isNaN(num)) {
      return num.toString();
    }
    return 'N/A';
  }
  
  // Formatear fechas
  if (columna.toLowerCase() === 'fecha') {
    if (valor === null || valor === undefined || valor === '' || valor === 'N/A') return 'N/A';
    try {
      const fecha = new Date(valor);
      if (!isNaN(fecha.getTime())) {
        return fecha.toLocaleDateString('es-ES');
      }
    } catch (e) {
      // Si no se puede parsear, devolver el valor original
    }
  }
  
  // Si el valor está vacío o es una cadena vacía
  if (valor === null || valor === undefined || valor === '') return 'N/A';
  if (valor === 'N/A') return 'N/A';
  
  return valor;
}

// Estado global de la aplicación
window.appState = window.appState || {
  selectedFile: null,
  validationResult: null,
  pywebviewReady: false,
  filtrosActivos: {
    cliente: '',
    wo: '',
    mant: '',
    referencia: '',
    tipo: '',
    estado: ''
  },
  paginacion: {
    paginaActual: 1,
    registrosPorPagina: 50,
    totalPaginas: 1,
    totalRegistros: 0
  },
  datosFiltrados: []
};

function verDetalles(index) {
  const datosPagina = obtenerDatosPaginaActual();
  const registro = datosPagina[index];

  if (!registro) return;

  // Obtener todas las columnas disponibles
  const columnas = Object.keys(registro);
  
  // Columnas preferidas que aparecen primero
  const columnasPreferidas = ['wo', 'mant', 'cliente', 'referencia', 'tipo', 'cantidad'];
  
  // Crear el contenido de los campos dinámicamente
  let camposHtml = '';
  
  // Primero las columnas preferidas
  columnasPreferidas.forEach(col => {
    if (columnas.includes(col)) {
      const valor = registro[col] || 'N/A';
      const valorFormateado = formatearValor(valor, col);
      if (col === 'estado') {
        camposHtml += `<div><strong>${col.toUpperCase()}:</strong> ${generarChipEstado(valor)}</div>`;
      } else if (col === 'rpa') {
        camposHtml += `<div><strong>${col.toUpperCase()}:</strong> ${generarChipRPA(valor)}</div>`;
      } else {
        camposHtml += `<div><strong>${col.toUpperCase()}:</strong> ${valorFormateado}</div>`;
      }
    }
  });
  
  // Luego las columnas adicionales
  const columnasRestantes = columnas.filter(col => !columnasPreferidas.includes(col));
  columnasRestantes.forEach(col => {
    const valor = registro[col] || 'N/A';
    const valorFormateado = formatearValor(valor, col);
    if (col === 'estado') {
      camposHtml += `<div><strong>${col.toUpperCase()}:</strong> ${generarChipEstado(valor)}</div>`;
    } else if (col === 'rpa') {
      camposHtml += `<div><strong>${col.toUpperCase()}:</strong> ${generarChipRPA(valor)}</div>`;
    } else if (col === 'observaciones') {
      camposHtml += `<div><strong>${col.toUpperCase()}:</strong><br>${valor}</div>`;
    } else {
      camposHtml += `<div><strong>${col.toUpperCase()}:</strong> ${valorFormateado}</div>`;
    }
  });

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Detalles del Registro</h3>
        <button onclick="cerrarModal()" class="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-4">
          ${camposHtml}
        </div>
      </div>
      <div class="mt-6 flex justify-end">
        <button onclick="cerrarModal()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  window.cerrarModal = function() {
    document.body.removeChild(modal);
    delete window.cerrarModal;
  };
}

function editarFila(index) {
  const datosPagina = obtenerDatosPaginaActual();
  const registro = datosPagina[index];

  if (!registro) return;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Editar Registro</h3>
        <button onclick="cerrarModalEdicion()" class="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      <form id="form-edicion" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">WO</label>
            <input type="text" id="edit-wo" value="${registro.wo || ''}" class="w-full border rounded px-3 py-2" readonly>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">MANT</label>
            <input type="text" id="edit-mant" value="${registro.mant || ''}" class="w-full border rounded px-3 py-2" readonly>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">CLIENTE</label>
            <input type="text" id="edit-cliente" value="${registro.cliente || ''}" class="w-full border rounded px-3 py-2">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">REFERENCIA</label>
            <input type="text" id="edit-referencia" value="${registro.referencia || ''}" class="w-full border rounded px-3 py-2">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">TIPO</label>
            <select id="edit-tipo" class="w-full border rounded px-3 py-2">
              <option value="DMCE" ${registro.tipo === 'DMCE' ? 'selected' : ''}>DMCE</option>
              <option value="AMCE" ${registro.tipo === 'AMCE' ? 'selected' : ''}>AMCE</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">CANTIDAD</label>
            <input type="number" id="edit-cantidad" value="${registro.cantidad || 0}" class="w-full border rounded px-3 py-2">
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">OBSERVACIONES</label>
          <textarea id="edit-observaciones" class="w-full border rounded px-3 py-2" rows="3">${registro.observaciones || ''}</textarea>
        </div>
      </form>
      <div class="mt-6 flex justify-end space-x-3">
        <button onclick="cerrarModalEdicion()" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Cancelar
        </button>
        <button onclick="guardarEdicion(${index})" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Guardar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  window.cerrarModalEdicion = function() {
    document.body.removeChild(modal);
    delete window.cerrarModalEdicion;
    delete window.guardarEdicion;
  };

  window.guardarEdicion = function(index) {
    const datosEditados = {
      wo: document.getElementById('edit-wo').value,
      mant: document.getElementById('edit-mant').value,
      cliente: document.getElementById('edit-cliente').value,
      referencia: document.getElementById('edit-referencia').value,
      tipo: document.getElementById('edit-tipo').value,
      cantidad: parseFloat(document.getElementById('edit-cantidad').value) || 0,
      observaciones: document.getElementById('edit-observaciones').value
    };

    const datosPagina = obtenerDatosPaginaActual();
    const registroOriginal = datosPagina[index];

    const indiceReal = window.appState.validationResult.detalle.findIndex(item =>
      item.wo === registroOriginal.wo &&
      item.mant === registroOriginal.mant &&
      item.cliente === registroOriginal.cliente
    );

    if (indiceReal !== -1) {
      window.appState.validationResult.detalle[indiceReal] = {
        ...window.appState.validationResult.detalle[indiceReal],
        ...datosEditados
      };

      const indiceFiltrado = window.appState.datosFiltrados.findIndex(item =>
        item.wo === registroOriginal.wo &&
        item.mant === registroOriginal.mant &&
        item.cliente === registroOriginal.cliente
      );

      if (indiceFiltrado !== -1) {
        window.appState.datosFiltrados[indiceFiltrado] = {
          ...window.appState.datosFiltrados[indiceFiltrado],
          ...datosEditados
        };
      }

      mostrarPaginaActual();
    }

    cerrarModalEdicion();
    console.log("✅ Registro editado:", datosEditados);
  };
}

function irAPaso2() {
  if (!window.appState.validationResult) {
    alert("❌ No hay datos validados para continuar");
    return;
  }

  if (window.pywebview && window.pywebview.api) {
    updateProcessStatus('Guardando estado...', 'validating');

    window.pywebview.api.guardar_estado_paso1(window.appState.validationResult)
      .then(() => {
        console.log("✅ Estado guardado para paso 2");
        updateProcessStatus('Redirigiendo al paso 2...', 'success');

        setTimeout(() => {
          window.location.href = '/step2';
        }, 1000);
      })
      .catch(error => {
        console.error("❌ Error al guardar estado:", error);
        alert("❌ Error al guardar el estado para el paso 2");
        updateProcessStatus('Error al guardar estado', 'error');
      });
  } else {
    console.log("⚠️ Redirección directa al paso 2 (sin guardar estado)");
    window.location.href = '/step2';
  }
}

function setupBeforeUnload() {
  window.addEventListener('beforeunload', (event) => {
    if (window.appState.validationResult) {
      event.preventDefault();
      event.returnValue = '¿Estás seguro de que quieres salir? Los datos de validación se perderán.';
    }
  });
}

function clearFile() {
  const input = document.getElementById('archivo1');
  if (input) {
    input.value = '';
  }
  document.getElementById('file-info')?.classList.add('hidden');
  appState.selectedFile = null;
  appState.validationResult = null;
  appState.datosFiltrados = [];

  appState.paginacion = {
    paginaActual: 1,
    registrosPorPagina: 50,
    totalPaginas: 1,
    totalRegistros: 0
  };

  disableValidationButton();
  updateProcessStatus('Esperando archivo...', 'waiting');
  hideValidationResult();

  const statsPanel = document.getElementById('statistics-summary');
  if (statsPanel) statsPanel.classList.add('hidden');

  const quickActions = document.getElementById('quick-actions');
  if (quickActions) quickActions.classList.add('hidden');
}

function enableValidationButton() {
  const btn = document.getElementById('btn-validar');
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('disabled');
    console.log("✅ Botón validar habilitado");
  }
}

function disableValidationButton() {
  const btn = document.getElementById('btn-validar');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('disabled');
    console.log("❌ Botón validar deshabilitado");
  }
}

function updateProcessStatus(text, status) {
  // Actualizar el estado en el header
  const estadoHeader = document.getElementById('estado-proceso-header');
  if (estadoHeader) {
    estadoHeader.textContent = text;
  }
  
  // Actualizar el estado en el panel lateral
  const estadoLateral = document.getElementById('estado-proceso-lateral');
  if (estadoLateral) {
    estadoLateral.textContent = text;
  }
  
  console.log("📊 Estado actualizado:", text, "(" + status + ")");
  
  // Aplicar estilos al elemento lateral (principal)
  if (estadoLateral) {
    estadoLateral.classList.remove('text-gray-500', 'text-green-700', 'text-red-600', 'text-blue-600');
    switch (status) {
      case 'waiting':
        estadoLateral.classList.add('text-gray-500');
        break;
      case 'validating':
        estadoLateral.classList.add('text-blue-600');
        break;
      case 'success':
        estadoLateral.classList.add('text-green-700');
        break;
      case 'error':
        estadoLateral.classList.add('text-red-600');
        break;
    }
  }
}

function hideValidationResult() {
  const resultado = document.getElementById('validation-content');
  if (resultado) resultado.classList.add('hidden');
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  if (errorDiv) {
    errorDiv.classList.remove('hidden');
    errorDiv.textContent = message;
  }
}

function setupFileInput() {
  const input = document.getElementById('archivo1');
  if (!input) return;

  input.addEventListener('change', (event) => {
    const archivo = input.files[0];
    if (!event.isTrusted) {
      console.warn("⚠️ Cambio de archivo no generado por el usuario, ignorado.");
      return;
    }
    if (!archivo || archivo.name === "") {
      console.warn("⚠️ Evento de cambio detectado, pero sin archivo válido.");
      return;
    }
    console.log("📂 Archivo seleccionado manualmente:", archivo.name);
    appState.selectedFile = archivo;
    const fileInfo = document.getElementById('file-info');
    if (fileInfo) fileInfo.classList.remove('hidden');
    const fileName = document.getElementById('file-name');
    if (fileName) fileName.textContent = archivo.name;
    if (window.appState.pywebviewReady) {
      enableValidationButton();
    } else {
      console.warn("⚠️ pywebview aún no está listo. Botón no habilitado.");
    }
    updateProcessStatus('Archivo listo para validar', 'waiting');
  });
}

function setupDragAndDrop() {
  const dropArea = document.getElementById('drop-area');
  if (!dropArea) return;
  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('border-blue-400');
  });
  dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('border-blue-400');
  });
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('border-blue-400');
    const file = e.dataTransfer.files[0];
    if (file) {
      document.getElementById('archivo1').files = e.dataTransfer.files;
      const fileInfo = document.getElementById('file-info');
      if (fileInfo) fileInfo.classList.remove('hidden');
      const fileName = document.getElementById('file-name');
      if (fileName) fileName.textContent = file.name;

      if (window.appState.pywebviewReady) {
        enableValidationButton();
      }
      appState.selectedFile = file;
      updateProcessStatus('Archivo listo para validar', 'waiting');
    }
  });
}

function initializeApp() {
  console.log("🚀 Inicializando aplicación...");

  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('hidden');
  clearFile();
  setupFileInput();
  setupDragAndDrop();
  setupBeforeUnload();
  updateProcessStatus('Esperando archivo...', 'waiting');

  const btnValidar = document.getElementById('btn-validar');
  if (btnValidar) {
    btnValidar.addEventListener('click', (event) => {
      console.log("🔘 Botón validar clickeado");
      if (!window.appState.pywebviewReady) {
        alert("❌ pywebview no está disponible.");
        return;
      }

      const loading = document.getElementById('loading');
      if (loading) loading.classList.remove('hidden');

      validarCarga(event);
    });
  }

  const btnSiguiente = document.getElementById('btn-siguiente');
  if (btnSiguiente) {
    btnSiguiente.addEventListener('click', irAPaso2);
  }

  const btnExportar = document.getElementById('btn-exportar-excel');
  if (btnExportar) {
    btnExportar.addEventListener('click', handleExportarExcelPaso1);
  }

  const btnReporte = document.getElementById('btn-generar-reporte');
  if (btnReporte) {
  }

  console.log("✅ App inicializada correctamente. Esperando pywebview...");
}

window.addEventListener('_pywebviewready', () => {
  console.log("🎉 _pywebviewready disparado!");
  window.appState.pywebviewReady = true;

  if (window.appState.selectedFile) {
    enableValidationButton();
  }
});

function checkPywebviewReady() {
  if (window.pywebview && window.pywebview.api && !window.appState.pywebviewReady) {
    console.log("🎉 pywebview detectado directamente!");
    window.appState.pywebviewReady = true;

    if (window.appState.selectedFile) {
      enableValidationButton();
    }
  }
}

if (!window.pywebviewChecker) {
  window.pywebviewChecker = setInterval(() => {
    checkPywebviewReady();
    if (window.appState.pywebviewReady) {
      clearInterval(window.pywebviewChecker);
      window.pywebviewChecker = null;
      console.log("✅ pywebview listo - deteniendo verificación");
    }
  }, 500);
}

setTimeout(checkPywebviewReady, 100);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

  const fin = inicio + window.appState.paginacion.registrosPorPagina;
  return window.appState.datosFiltrados.slice(inicio, fin);
}

function mostrarControlesPaginacion() {
  const { paginaActual, totalPaginas, totalRegistros, registrosPorPagina } = window.appState.paginacion;

  const inicio = (paginaActual - 1) * registrosPorPagina + 1;
  const fin = Math.min(paginaActual * registrosPorPagina, totalRegistros);

  const controlsHtml = `
    <div class="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 border-t">
      <div class="flex items-center gap-4">
        <span class="text-sm text-gray-700">
          Mostrando ${inicio} a ${fin} de ${totalRegistros} registros
        </span>
        <select id="registros-por-pagina" class="form-input text-sm" style="width: auto; min-width: 100px;">
          <option value="10" ${registrosPorPagina === 10 ? 'selected' : ''}>10 por página</option>
          <option value="25" ${registrosPorPagina === 25 ? 'selected' : ''}>25 por página</option>
          <option value="50" ${registrosPorPagina === 50 ? 'selected' : ''}>50 por página</option>
          <option value="100" ${registrosPorPagina === 100 ? 'selected' : ''}>100 por página</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="irPaginaAnterior()" ${paginaActual <= 1 ? 'disabled' : ''} class="btn btn-outline btn-sm">
          ← Anterior
        </button>
        <span class="text-sm text-gray-700">
          Página ${paginaActual} de ${totalPaginas}
        </span>
        <button onclick="irPaginaSiguiente()" ${paginaActual >= totalPaginas ? 'disabled' : ''} class="btn btn-outline btn-sm">
          Siguiente →
        </button>
      </div>
    </div>
  `;

  const tablaContainer = document.getElementById('tabla-resultados');
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
    const selector = document.getElementById('registros-por-pagina');
    if (selector) {
      selector.addEventListener('change', (e) => {
        window.appState.paginacion.registrosPorPagina = parseInt(e.target.value);
        window.appState.paginacion.paginaActual = 1;
        window.appState.paginacion.totalPaginas = Math.ceil(
          window.appState.datosFiltrados.length / window.appState.paginacion.registrosPorPagina
        );
        mostrarPaginaActual();
        mostrarControlesPaginacion();
      });
    }
  }
}

function irPaginaAnterior() {
  if (window.appState.paginacion.paginaActual > 1) {
    window.appState.paginacion.paginaActual--;
    mostrarPaginaActual();
    mostrarControlesPaginacion();
  }
}

function irPaginaSiguiente() {
  if (window.appState.paginacion.paginaActual < window.appState.paginacion.totalPaginas) {
    window.appState.paginacion.paginaActual++;
    mostrarPaginaActual();
    mostrarControlesPaginacion();
  }
}

function generarTablaHtml(datos) {
  if (!datos || datos.length === 0) {
    return '<div class="text-center py-8 text-gray-500">No hay datos para mostrar en esta página</div>';
  }

  // Obtener todas las columnas disponibles del primer registro
  const columnasDisponibles = Object.keys(datos[0]);
  
  // Definir columnas principales y su orden preferido EXACTO
  const columnasPreferidas = ['wo', 'mant', 'fecha', 'cliente', 'referencia', 'tipo', 'precio', 'cantidad', 'cuota', 'tecnico', 'pago', 'cant_antiguo', 'cant_nuevo', 'cant_total', 'estado', 'observaciones'];
  
  // Crear lista de columnas ordenadas: primero las preferidas, luego las adicionales
  const columnasOrdenadas = [];
  
  // Agregar columnas preferidas que existan
  columnasPreferidas.forEach(col => {
    if (columnasDisponibles.includes(col)) {
      columnasOrdenadas.push(col);
    }
  });
  
  // Agregar columnas adicionales que no estén en las preferidas
  columnasDisponibles.forEach(col => {
    if (!columnasPreferidas.includes(col)) {
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
    if (col === 'rpa') return; // Omitir RPA del header, se añadirá después
    const nombreColumna = col.toUpperCase();
    html += `<th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">${nombreColumna}</th>`;
  });
  
  html += `
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">ACCIONES</th>
            <th class="px-3 py-2 border-b text-left text-xs font-medium text-gray-700">RPA</th>
          </tr>
        </thead>
        <tbody>
  `;

  datos.forEach((fila, index) => {
    const estadoChip = generarChipEstado(fila.estado);
    const rpaChip = generarChipRPA(fila.rpa);
    const clasesFila = fila.estado === 'Incorrecto' ? 'bg-red-50' :
                      fila.estado === 'Correcto' ? 'bg-green-50' : '';

    html += `
      <tr class="hover:bg-gray-50 ${clasesFila}" data-index="${index}">
    `;
    
    // Generar celdas dinámicamente
    columnasOrdenadas.forEach(col => {
      if (col === 'rpa') return; // Omitir RPA, se añadirá después
      
      let valor = fila[col] || '';
      let atributoFiltro = '';
      
      // Agregar atributos de filtro para columnas específicas
      if (['wo', 'mant', 'cliente', 'referencia', 'tipo', 'estado'].includes(col)) {
        atributoFiltro = `data-filtro="${col}"`;
      }
      
      // Formatear valores especiales
      if (col === 'estado') {
        html += `<td class="px-3 py-2 border-b text-xs" ${atributoFiltro}>
          <span class="sr-only">${valor}</span>
          ${generarChipEstado(valor)}
        </td>`;
      } else if (col === 'observaciones') {
        html += `<td class="px-3 py-2 border-b text-xs max-w-xs truncate" title="${valor}">${valor}</td>`;
      } else {
        // Formatear valor según su tipo
        const valorFormateado = formatearValor(valor, col);
        html += `<td class="px-3 py-2 border-b text-xs" ${atributoFiltro}>${valorFormateado}</td>`;
      }
    });
    
    // Agregar columnas fijas al final
    html += `
        <td class="px-3 py-2 border-b text-xs">
          <div class="flex space-x-2">
            <button onclick="verDetalles(${index})" class="text-blue-600 hover:text-blue-800 text-xs">
              👁️ Ver
            </button>
            ${fila.estado === 'Incorrecto' ? `<button onclick="editarFila(${index})" class="text-orange-600 hover:text-orange-800 text-xs">✏️ Editar</button>` : ''}
          </div>
        </td>
        <td class="px-3 py-2 border-b text-xs">${generarChipRPA(fila.rpa)}</td>
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

function configurarFiltros() {
  const campos = ['cliente', 'wo', 'mant', 'referencia', 'tipo', 'estado'];

  campos.forEach(filtro => {
    const input = document.getElementById(`filtro-${filtro}`);
    if (input) {
      const tipoElemento = input.tagName.toLowerCase();

      if (tipoElemento === 'select') {
        input.addEventListener('change', (e) => {
          window.appState.filtrosActivos[filtro] = e.target.value;
          aplicarFiltros();
        });
      } else {
        input.addEventListener('input', (e) => {
          window.appState.filtrosActivos[filtro] = e.target.value;
          aplicarFiltros();
        });
      }
    }
  });

  const btnLimpiar = document.getElementById('btn-limpiar-filtros');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', limpiarFiltros);
  }
}


function aplicarFiltros() {
  const datosOriginales = window.appState.validationResult?.detalle || [];

  const filtros = {
    cliente: window.appState.filtrosActivos.cliente.toLowerCase(),
    wo: window.appState.filtrosActivos.wo.toLowerCase(),
    mant: window.appState.filtrosActivos.mant.toLowerCase(),
    tipo: window.appState.filtrosActivos.tipo.toLowerCase(),
    estado: window.appState.filtrosActivos.estado.toLowerCase()
  };

  const datosFiltrados = datosOriginales.filter(fila => {
    return (fila.cliente || '').toLowerCase().includes(filtros.cliente) &&
           (fila.wo || '').toLowerCase().includes(filtros.wo) &&
           (fila.mant || '').toLowerCase().includes(filtros.mant) &&
           (fila.tipo || '').toLowerCase().includes(filtros.tipo) &&
           (filtros.estado === '' || (fila.estado || '').toLowerCase() === filtros.estado);
  });

  window.appState.datosFiltrados = datosFiltrados;
  window.appState.paginacion.totalRegistros = datosFiltrados.length;
  window.appState.paginacion.totalPaginas = Math.ceil(
    datosFiltrados.length / window.appState.paginacion.registrosPorPagina
  );
  window.appState.paginacion.paginaActual = 1;

  mostrarPaginaActual();
  mostrarControlesPaginacion();
  actualizarContadorFiltros();
}

function actualizarContadorFiltros() {
  const contador = document.getElementById('contador-filtrados');
  if (contador) {
    contador.textContent = `${window.appState.datosFiltrados.length} registros mostrados`;
  }
}

function limpiarFiltros() {
  window.appState.filtrosActivos = {
    cliente: '',
    wo: '',
    mant: '',
    referencia: '',
    tipo: '',
    estado: ''
  };

  ['cliente', 'wo', 'mant', 'referencia', 'tipo', 'estado'].forEach(filtro => {
    const input = document.getElementById(`filtro-${filtro}`);
    if (input) {
      if (input.tagName === 'SELECT') input.selectedIndex = 0;
      else input.value = '';
    }
  });

  window.appState.datosFiltrados = [...(window.appState.validationResult?.detalle || [])];
  window.appState.paginacion.totalRegistros = window.appState.datosFiltrados.length;
  window.appState.paginacion.totalPaginas = Math.ceil(
    window.appState.datosFiltrados.length / window.appState.paginacion.registrosPorPagina
  );
  window.appState.paginacion.paginaActual = 1;

  mostrarPaginaActual();
  mostrarControlesPaginacion();
  actualizarContadorFiltros();
}


function generarChipEstado(estado) {
  const chips = {
    'Correcto': '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">✅ Correcto</span>',
    'Incorrecto': '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">❌ Incorrecto</span>',
    'Advertencia': '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">⚠️ Advertencia</span>'
  };

  return chips[estado] || `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">${estado}</span>`;
}

function generarChipRPA(rpa) {
  if (rpa === 'Sí') {
    return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">🤖 Sí</span>';
  } else {
    return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">👤 No</span>';
  }
}

function actualizarEstadisticas(stats) {
  const elementos = {
    'total-registros': stats.total || 0,
    'correctos': stats.correctos || 0,
    'incorrectos': stats.incorrectos || 0,
    'advertencias': stats.advertencias || 0
  };

  Object.entries(elementos).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.textContent = valor;
    }
  });

  const statElements = {
    'stat-total': stats.total || 0,
    'stat-correct': stats.correctos || 0,
    'stat-incorrect': stats.incorrectos || 0,
    'stat-success-rate': stats.total > 0 ? Math.round((stats.correctos / stats.total) + 100) + '%' : '0%'
  };

  Object.entries(statElements).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.textContent = valor;
    }
  });

  const statsPanel = document.getElementById('statistics-summary');
  if (statsPanel) {
    statsPanel.classList.remove('hidden');
  }

  const quickActions = document.getElementById('quick-actions');
  if (quickActions) {
    quickActions.classList.remove('hidden');
  }
}

// Reemplazar función de exportación por la centralizada
function handleExportarExcelPaso1() {
  if (!window.appState.validationResult?.detalle) {
    alert('❌ No hay datos para exportar');
    return;
  }
  exportarExcel(
    window.appState.validationResult,
    window.appState.selectedFile?.name || 'N/A'
  );
}

// Modal para seleccionar opciones de exportación
function mostrarOpcionesExportacion() {
  return new Promise((resolve) => {
    // Eliminar modal existente si existe
    const modalExistente = document.getElementById('modal-opciones-exportacion');
    if (modalExistente) {
      modalExistente.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'modal-opciones-exportacion';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex items-center mb-4">
          <div class="bg-blue-100 rounded-full p-2 mr-3">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Exportar Excel</h3>
        </div>
        <p class="text-gray-600 mb-4">¿Dónde deseas guardar el archivo?</p>
        
        <div class="space-y-3">
          <button id="btn-descargas-modal" class="w-full bg-green-600 text-white px-4 py-3 rounded hover:bg-green-700 flex items-center justify-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
            </svg>
            📥 Carpeta de Descargas
          </button>
          
          <button id="btn-personalizada-modal" class="w-full bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700 flex items-center justify-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            📂 Elegir Carpeta
          </button>
        </div>
        
        <button id="btn-cancelar-modal" class="w-full mt-3 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Cancelar
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners usando IDs únicos
    document.getElementById('btn-descargas-modal').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('descargas');
    });

    document.getElementById('btn-personalizada-modal').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('personalizada');
    });

    document.getElementById('btn-cancelar-modal').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(null);
    });

    // Cerrar con ESC
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
        document.removeEventListener('keydown', handleEsc);
        resolve(null);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}

// Modal de éxito de exportación
function mostrarModalExitoExportacion(resultado) {
  // Eliminar modal existente si existe
  const modalExistente = document.getElementById('modal-exito-exportacion');
  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'modal-exito-exportacion';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
      <div class="flex items-center mb-4">
        <div class="bg-green-100 rounded-full p-2 mr-3">
          <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900">¡Exportación Exitosa!</h3>
      </div>
      
      <p class="text-gray-600 mb-4">${resultado.message}</p>
      
      <div class="bg-gray-50 p-3 rounded-lg mb-4">
        <p class="text-sm text-gray-700 font-medium mb-1">📁 Ubicación:</p>
        <p class="text-xs text-gray-600 break-all">${resultado.archivo}</p>
      </div>
      
      <div class="flex gap-2">
        <button id="btn-abrir-carpeta-exito" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center justify-center">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
          Abrir Carpeta
        </button>
        <button id="btn-cerrar-modal-exito" class="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners con IDs únicos
  document.getElementById('btn-abrir-carpeta-exito').addEventListener('click', async () => {
    try {
      if (window.pywebview && window.pywebview.api) {
        console.log("Abriendo carpeta:", resultado.archivo);
        const resp = await window.pywebview.api.abrir_carpeta_archivo(resultado.archivo);
        if (!resp.success) {
          console.error("Error al abrir carpeta:", resp.message);
          alert("❌ Error al abrir carpeta: " + resp.message);
        }
      }
    } catch (error) {
      console.error("Error al abrir carpeta:", error);
      alert("❌ Error al abrir carpeta: " + error.message);
    }
    
    if (document.body.contains(modal)) {
      document.body.removeChild(modal);
    }
  });

  document.getElementById('btn-cerrar-modal-exito').addEventListener('click', () => {
    if (document.body.contains(modal)) {
      document.body.removeChild(modal);
    }
  });

  // Cerrar con ESC
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
}

// Nueva función generarReporte() usando el backend
async function generarReporte() {
  console.log("📄 Iniciando generación de reporte con backend");
  
  if (!window.appState.validationResult) {
    alert("❌ No hay datos para generar reporte");
    return;
  }

  // Validar que pywebview está disponible
  if (!window.pywebview || !window.pywebview.api) {
    alert("❌ Función de generación de reporte no disponible");
    return;
  }

  try {
    // Mostrar opciones al usuario (igual que Excel)
    const opcion = await mostrarOpcionesReporte();
    
    if (!opcion) {
      console.log("Usuario canceló la generación de reporte");
      return;
    }

    let carpetaDestino = null;
    
    // Si eligió carpeta personalizada, abrir diálogo
    if (opcion === 'personalizada') {
      const seleccion = await window.pywebview.api.seleccionar_directorio_exportacion();
      
      if (!seleccion.success) {
        if (seleccion.message !== "Selección cancelada") {
          alert("❌ " + seleccion.message);
        }
        return;
      }
      
      carpetaDestino = seleccion.ruta;
      console.log("Carpeta seleccionada para reporte:", carpetaDestino);
    } else {
      console.log("Usuario eligió carpeta de Descargas para reporte");
    }

    console.log("Generando reporte...");
    
    // Realizar generación del reporte
    const resultado = await window.pywebview.api.generar_reporte_con_ruta({
      datos: window.appState.validationResult,
      carpeta_destino: carpetaDestino,
      nombre_archivo_original: window.appState.selectedFile?.name || "N/A"
    });

    console.log("Resultado del backend para reporte:", resultado);

    if (resultado.success) {
      mostrarModalExitoReporte(resultado);
    } else {
      alert("❌ Error al generar reporte: " + resultado.message);
    }

  } catch (error) {
    console.error("❌ Error al generar reporte:", error);
    alert("❌ Error inesperado al generar reporte: " + error.message);
  }
}

// Modal para opciones de reporte
function mostrarOpcionesReporte() {
  return new Promise((resolve) => {
    const modalExistente = document.getElementById('modal-opciones-reporte');
    if (modalExistente) {
      modalExistente.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'modal-opciones-reporte';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex items-center mb-4">
          <div class="bg-purple-100 rounded-full p-2 mr-3">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Generar Reporte</h3>
        </div>
        <p class="text-gray-600 mb-4">¿Dónde deseas guardar el reporte?</p>
        
        <div class="space-y-3">
          <button id="btn-descargas-reporte" class="w-full bg-green-600 text-white px-4 py-3 rounded hover:bg-green-700 flex items-center justify-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
            </svg>
            📥 Carpeta de Descargas
          </button>
          
          <button id="btn-personalizada-reporte" class="w-full bg-purple-600 text-white px-4 py-3 rounded hover:bg-purple-700 flex items-center justify-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            📂 Elegir Carpeta
          </button>
        </div>
        
        <button id="btn-cancelar-reporte" class="w-full mt-3 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Cancelar
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-descargas-reporte').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('descargas');
    });

    document.getElementById('btn-personalizada-reporte').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('personalizada');
    });

    document.getElementById('btn-cancelar-reporte').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(null);
    });

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
        document.removeEventListener('keydown', handleEsc);
        resolve(null);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}

// Modal de éxito para reporte
function mostrarModalExitoReporte(resultado) {
  const modalExistente = document.getElementById('modal-exito-reporte');
  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'modal-exito-reporte';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
      <div class="flex items-center mb-4">
        <div class="bg-green-100 rounded-full p-2 mr-3">
          <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900">¡Reporte Generado!</h3>
      </div>
      
      <p class="text-gray-600 mb-4">${resultado.message}</p>
      
      <div class="bg-gray-50 p-3 rounded-lg mb-4">
        <p class="text-sm text-gray-700 font-medium mb-1">📁 Ubicación:</p>
        <p class="text-xs text-gray-600 break-all">${resultado.archivo}</p>
      </div>
      
      <div class="flex gap-2">
        <button id="btn-abrir-carpeta-reporte" class="flex-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center justify-center">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
          Abrir Carpeta
        </button>
        <button id="btn-cerrar-modal-reporte" class="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('btn-abrir-carpeta-reporte').addEventListener('click', async () => {
    try {
      if (window.pywebview && window.pywebview.api) {
        console.log("Abriendo carpeta del reporte:", resultado.archivo);
        const resp = await window.pywebview.api.abrir_carpeta_archivo(resultado.archivo);
        if (!resp.success) {
          console.error("Error al abrir carpeta:", resp.message);
          alert("❌ Error al abrir carpeta: " + resp.message);
        }
      }
    } catch (error) {
      console.error("Error al abrir carpeta:", error);
      alert("❌ Error al abrir carpeta: " + error.message);
    }
    
    if (document.body.contains(modal)) {
      document.body.removeChild(modal);
    }
  });

  document.getElementById('btn-cerrar-modal-reporte').addEventListener('click', () => {
    if (document.body.contains(modal)) {
      document.body.removeChild(modal);
    }
  });

  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
}

// Modal para opciones de reporte (similar al de Excel)
function mostrarOpcionesReporte() {
  return new Promise((resolve) => {
    const modalExistente = document.getElementById('modal-opciones-reporte');
    if (modalExistente) {
      modalExistente.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'modal-opciones-reporte';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex items-center mb-4">
          <div class="bg-purple-100 rounded-full p-2 mr-3">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Generar Reporte</h3>
        </div>
        <p class="text-gray-600 mb-4">¿Dónde deseas guardar el reporte?</p>
        
        <div class="space-y-3">
          <button id="btn-descargas-reporte" class="w-full bg-green-600 text-white px-4 py-3 rounded hover:bg-green-700 flex items-center justify-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
            </svg>
            📥 Carpeta de Descargas
          </button>
          
          <button id="btn-personalizada-reporte" class="w-full bg-purple-600 text-white px-4 py-3 rounded hover:bg-purple-700 flex items-center justify-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            📂 Elegir Carpeta
          </button>
        </div>
        
        <button id="btn-cancelar-reporte" class="w-full mt-3 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
          Cancelar
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-descargas-reporte').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('descargas');
    });

    document.getElementById('btn-personalizada-reporte').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve('personalizada');
    });

    document.getElementById('btn-cancelar-reporte').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(null);
    });

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
        document.removeEventListener('keydown', handleEsc);
        resolve(null);
      }
    };
    document.addEventListener('keydown', handleEsc);
  });
}

// Modal de éxito para reporte - VERSIÓN CORREGIDA
function mostrarModalExitoReporte(resultado) {
  const modalExistente = document.getElementById('modal-exito-reporte');
  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'modal-exito-reporte';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
      <div class="flex items-center mb-4">
        <div class="bg-green-100 rounded-full p-2 mr-3">
          <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900">¡Reporte Generado!</h3>
      </div>
      
      <p class="text-gray-600 mb-4">${resultado.message}</p>
      
      <div class="bg-gray-50 p-3 rounded-lg mb-4">
        <p class="text-sm text-gray-700 font-medium mb-1">📁 Ubicación:</p>
        <p class="text-xs text-gray-600 break-all">${resultado.archivo}</p>
        <p class="text-xs text-gray-500 mt-1">💡 Revisa tu carpeta de Descargas</p>
      </div>
      
      <div class="flex gap-2">
        <button id="btn-cerrar-modal-reporte" class="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center justify-center">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          Entendido
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('btn-cerrar-modal-reporte').addEventListener('click', () => {
    if (document.body.contains(modal)) {
      document.body.removeChild(modal);
    }
  });

  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
}