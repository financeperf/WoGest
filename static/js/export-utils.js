// Utilidad para exportar datos a Excel desde cualquier paso
// Requiere que el backend exponga una función exportar_excel_con_ruta compatible

/**
 * Exporta datos a Excel usando el backend (pywebview).
 * @param {Object} datosValidacion - Objeto con los datos a exportar (estructura igual a paso 1)
 * @param {string} [nombreArchivoOriginal] - Nombre del archivo original (opcional)
 * @param {Function} [onSuccess] - Callback en caso de éxito
 * @param {Function} [onError] - Callback en caso de error
 */
export async function exportarExcel(datosValidacion, nombreArchivoOriginal = "N/A", onSuccess, onError) {
  if (!window.pywebview || !window.pywebview.api) {
    alert("❌ Función de exportar Excel no disponible");
    if (onError) onError("pywebview no disponible");
    return;
  }

  try {
    // Preguntar al usuario dónde exportar
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

    // Llamar al backend
    const resultado = await window.pywebview.api.exportar_excel_con_ruta({
      datos: datosValidacion,
      carpeta_destino: carpetaDestino,
      nombre_archivo_original: nombreArchivoOriginal
    });

    if (resultado.success) {
      if (onSuccess) onSuccess(resultado);
      else alert("✅ Archivo Excel exportado correctamente: " + resultado.archivo);
    } else {
      alert("❌ Error al exportar Excel: " + resultado.message);
      if (onError) onError(resultado.message);
    }
  } catch (error) {
    alert("❌ Error inesperado al exportar Excel: " + error.message);
    if (onError) onError(error.message);
  }
}

// Modal para opciones de exportación (Descargas o Carpeta personalizada)
async function mostrarOpcionesExportacion() {
  return new Promise((resolve) => {
    const modalExistente = document.getElementById('modal-opciones-exportacion');
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-opciones-exportacion';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div class="flex items-center mb-4">
          <div class="bg-green-100 rounded-full p-2 mr-3">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900">Exportar Excel</h3>
        </div>
        <p class="text-gray-600 mb-4">¿Dónde deseas guardar el archivo Excel?</p>
        <div class="space-y-3">
          <button id="btn-descargas-excel" class="w-full bg-green-600 text-white px-4 py-3 rounded hover:bg-green-700 flex items-center justify-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
            </svg>
            📥 Carpeta de Descargas
          </button>
          <button id="btn-personalizada-excel" class="w-full bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700 flex items-center justify-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            📂 Elegir Carpeta
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('btn-descargas-excel').onclick = () => {
      modal.remove();
      resolve('descargas');
    };
    document.getElementById('btn-personalizada-excel').onclick = () => {
      modal.remove();
      resolve('personalizada');
    };
  });
}
