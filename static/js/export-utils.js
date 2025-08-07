// Utilidad para exportar datos a Excel desde cualquier paso
// Requiere que el backend exponga una función exportar_excel_con_ruta compatible

/**
 * Exporta datos a Excel usando el backend (pywebview) con interfaz mejorada.
 * @param {Object} datosValidacion - Objeto con los datos a exportar (estructura igual a paso 1)
 * @param {string} [nombreArchivoOriginal] - Nombre del archivo original (opcional)
 * @param {Function} [onSuccess] - Callback en caso de éxito
 * @param {Function} [onError] - Callback en caso de error
 */
export async function exportarExcel(datosValidacion, nombreArchivoOriginal = "N/A", onSuccess, onError) {
  console.log("🔥 Iniciando exportarExcel() - export-utils.js");

  if (!datosValidacion?.detalle) {
    alert("❌ No hay datos para exportar");
    if (onError) onError("No hay datos para exportar");
    return;
  }

  if (!window.pywebview || !window.pywebview.api) {
    alert("❌ Función de exportación no disponible");
    if (onError) onError("pywebview no disponible");
    return;
  }

  try {
    const opcion = await mostrarOpcionesExportacion();
    if (!opcion) return;

    let carpetaDestino = null;

    if (opcion === 'personalizada') {
      const seleccion = await window.pywebview.api.seleccionar_directorio_exportacion();
      if (!seleccion.success) {
        if (seleccion.message !== "Selección cancelada") {
          alert("❌ " + seleccion.message);
        }
        if (onError) onError(seleccion.message);
        return;
      }
      carpetaDestino = seleccion.ruta;
    }

    // Deshabilitar botón y mostrar estado de carga
    const btnExportar = document.getElementById('btn-exportar-excel');
    if (btnExportar) {
      btnExportar.disabled = true;
      btnExportar.innerHTML = '⏳ Exportando...';
    }

    const resultado = await window.pywebview.api.exportar_excel_con_ruta({
      datos: datosValidacion,
      carpeta_destino: carpetaDestino,
      nombre_archivo_original: nombreArchivoOriginal
    });

    if (resultado.success) {
      mostrarModalExitoExportacion(resultado);
      if (onSuccess) onSuccess(resultado);
    } else {
      alert("❌ Error al exportar Excel: " + resultado.message);
      if (onError) onError(resultado.message);
    }

  } catch (error) {
    console.error("❌ Error al exportar Excel:", error);
    alert("❌ Error inesperado: " + error.message);
    if (onError) onError(error.message);
  } finally {
    // Rehabilitar botón
    const btnExportar = document.getElementById('btn-exportar-excel');
    if (btnExportar) {
      btnExportar.disabled = false;
      btnExportar.innerHTML = `
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Exportar Excel
      `;
    }
  }
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
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

    // Event listeners
    document.getElementById('btn-descargas-modal').addEventListener('click', () => {
      modal.remove();
      resolve('descargas');
    });
    document.getElementById('btn-personalizada-modal').addEventListener('click', () => {
      modal.remove();
      resolve('personalizada');
    });
    document.getElementById('btn-cancelar-modal').addEventListener('click', () => {
      modal.remove();
      resolve(null);
    });

    // Cerrar con ESC
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (document.body.contains(modal)) {
          modal.remove();
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

  // Event listeners
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
      modal.remove();
    }
  });

  document.getElementById('btn-cerrar-modal-exito').addEventListener('click', () => {
    if (document.body.contains(modal)) {
      modal.remove();
    }
  });

  // Cerrar con ESC
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      if (document.body.contains(modal)) {
        modal.remove();
      }
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc, { once: true });
}
