// ===================================================================
// WOGest - Step 2 JavaScript Mejorado v2.0
// Basado en step1.js con todas las funcionalidades implementadas
// ===================================================================

// Cargar script de depuración solo en desarrollo (solo funcionará si el archivo existe)
// No se ejecutará automáticamente, requiere activación manual con: window.DEBUG_MODE_STEP2 = true;
(function() {
  // Verificar si estamos en desarrollo (esto puede ajustarse según tu entorno)
  const isDevelopment = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('.local');
  
  if (isDevelopment) {
    const debugScript = document.createElement('script');
    debugScript.src = '/static/js/debug/debugStep2.js';
    debugScript.async = true;
    debugScript.onload = () => console.log("🛠️ Script de debug Step 2 cargado");
    debugScript.onerror = () => console.log("⚠️ No se pudo cargar el script de debug Step 2");
    document.body.appendChild(debugScript);
  }
})();

// Estado global de la aplicación para el paso 2
window.appStateStep2 = window.appStateStep2 || {
  selectedFile: null,
  validationResult: null,
  pywebviewReady: false,
  isProcessing: false,  // Bandera para evitar múltiples ejecuciones
  filtrosActivos: {
    contrato: '',
    n_wo: '',
    n_wo_alt: '',
    orden: '',
    cliente: '',
    cerrado: '',
    es_cerrado: ''
  },
  paginacion: {
    paginaActual: 1,
    registrosPorPagina: 50,
    totalPaginas: 1,
    totalRegistros: 0
  },
  datosFiltrados: [],
  dataTableInstance: null,
  yaMostroResultados: false
};

// ===================================================================
// FUNCIONES DE INICIALIZACIÓN
// ===================================================================


function initializeStep2App() {
  console.log("🚀 Inicializando aplicación Step 2...");
  
  // Limpiar estado inicial
  clearStep2File();
  
  // Configurar eventos
  setupStep2FileInput();
  setupStep2DragAndDrop();
  setupStep2BeforeUnload();
  
  // Configurar botones
  setupStep2Buttons();
  
  // Verificar pywebview
  checkStep2PywebviewReady();
  
  console.log("✅ Step 2 inicializado correctamente");
}

function setupStep2Buttons() {
  // Botón procesar
  const btnProcesar = document.getElementById('btn-procesar');
  if (btnProcesar) {
    btnProcesar.addEventListener('click', (event) => {
      event.preventDefault();
      console.log("🔘 Botón procesar clickeado");
      
      if (!window.appStateStep2.pywebviewReady) {
        alert("❌ pywebview no está disponible.");
        return;
      }
        console.log("📡 Enviando a pywebview.api.procesar_archivo_woq");
        clearStep2File();
        window.appStateStep2.isProcessing = true;
      procesarArchivoWOQ(event);
    });
  }
  
  // Botón volver
  const btnVolver = document.getElementById('btn-volver');
  if (btnVolver) {
    btnVolver.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/step1';
    });
  }
  
  // Botón siguiente
  const btnSiguiente = document.getElementById('btn-siguiente');
  if (btnSiguiente) {
    btnSiguiente.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.appStateStep2.validationResult && window.appStateStep2.validationResult.detalle.length > 0) {
        window.location.href = '/step3';
      } else {
        alert('Debe procesar un archivo antes de continuar');
      }
    });
    // Ocultar por defecto
    btnSiguiente.style.display = 'none';
  }
}

// ===================================================================
// MANEJO DE ARCHIVOS
// ===================================================================

function setupStep2FileInput() {
  const input = document.getElementById('archivo-woq');
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
    
    console.log("📂 Archivo seleccionado:", archivo.name);
    window.appStateStep2.selectedFile = archivo;
    
    // Mostrar información del archivo
    mostrarInfoArchivo(archivo);
    
    // Habilitar botón si pywebview está listo
    if (window.appStateStep2.pywebviewReady) {
      habilitarBotonProcesar();
    }
  });
}

function setupStep2DragAndDrop() {
  const dropArea = document.getElementById('archivo-woq');
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
      dropArea.files = e.dataTransfer.files;
      window.appStateStep2.selectedFile = file;
      mostrarInfoArchivo(file);
      
      if (window.appStateStep2.pywebviewReady) {
        habilitarBotonProcesar();
      }
    }
  });
}

function setupStep2BeforeUnload() {
  console.log("🔒 Configurando evento beforeunload para Step 2...");
  
  window.addEventListener('beforeunload', (event) => {
    // Solo mostrar advertencia si hay datos procesados
    if (window.appStateStep2 && window.appStateStep2.validationResult) {
      const message = "¿Está seguro de que desea salir? Los datos procesados no se guardarán.";
      event.preventDefault();
      event.returnValue = message;
      return message;
    }
  });
  
  console.log("✅ Evento beforeunload configurado");
}

function checkStep2PywebviewReady() {
  console.log("🔍 Verificando disponibilidad de pywebview...");
  
  // Verificar si pywebview está disponible
  if (window.pywebview && window.pywebview.api && !window.appStateStep2.pywebviewReady) {
    console.log("✅ pywebview está disponible!");
    window.appStateStep2.pywebviewReady = true;
    
    // Si hay un archivo seleccionado, habilitar el botón procesar
    if (window.appStateStep2.selectedFile) {
      console.log("📂 Hay un archivo seleccionado, habilitando botón procesar");
      habilitarBotonProcesar();
    }
  } else if (!window.pywebview || !window.pywebview.api) {
    console.warn("⚠️ pywebview no está disponible aún");
  }
}

// Registrar evento para cuando pywebview esté disponible
window.addEventListener('_pywebviewready', () => {
  console.log("🎉 _pywebviewready disparado en step2!");
  window.appStateStep2.pywebviewReady = true;
  
  // Si hay un archivo seleccionado, habilitar el botón procesar
  if (window.appStateStep2.selectedFile) {
    console.log("📂 Hay un archivo seleccionado, habilitando botón procesar");
    habilitarBotonProcesar();
  }
});

function mostrarInfoArchivo(archivo) {
  console.log("📄 Mostrando información del archivo:", archivo.name);
  
  // Obtener elementos del DOM
  const fileInfo = document.getElementById('file-info-woq');
  const fileName = document.getElementById('file-name-woq');
  const fileDetails = document.getElementById('file-details-woq');
  const fileSize = document.getElementById('file-size-woq');
  
  if (!fileInfo || !fileName || !fileDetails || !fileSize) {
    console.warn("⚠️ No se encontraron todos los elementos para mostrar información del archivo");
    return;
  }
  
  // Formatear tamaño del archivo
  let tamaño = '';
  if (archivo.size < 1024) {
    tamaño = `${archivo.size} bytes`;
  } else if (archivo.size < 1024 * 1024) {
    tamaño = `${(archivo.size / 1024).toFixed(2)} KB`;
  } else {
    tamaño = `${(archivo.size / (1024 * 1024)).toFixed(2)} MB`;
  }
  
  // Verificar extensión
  const extension = archivo.name.includes('.') ? archivo.name.split('.').pop().toLowerCase() : '';
  const esExtensionValida = ['csv', 'txt', ''].includes(extension);
  
  // Mostrar información
  fileName.textContent = archivo.name;
  fileDetails.textContent = `${tamaño} • Última modificación: ${new Date(archivo.lastModified).toLocaleString()}`;
  fileSize.textContent = tamaño;
  fileInfo.classList.remove('hidden');
  
  // Cambiar estado del proceso
  const estadoProceso = document.getElementById('estado-proceso');
  if (estadoProceso) {
    estadoProceso.textContent = "Archivo WOQ cargado, listo para procesar";
    estadoProceso.className = "text-blue-600";
  }
  
  const estadoProcesoLateral = document.getElementById('estado-proceso-lateral');
  if (estadoProcesoLateral) {
    estadoProcesoLateral.textContent = "Archivo WOQ cargado, listo para procesar";
  }
  
  // Advertir si la extensión no es válida
  if (!esExtensionValida) {
    console.warn("⚠️ Extensión de archivo no reconocida:", extension);
    const alerta = document.createElement('div');
    alerta.className = 'mt-2 text-yellow-800 text-sm';
    alerta.innerHTML = `
      <div class="flex items-center">
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        Extensión de archivo no estándar. El procesamiento puede fallar.
      </div>
    `;
    fileInfo.appendChild(alerta);
  }
  
  console.log("✅ Información del archivo mostrada en UI");
}

function clearStep2File() {
  console.log("🧹 Iniciando limpieza de estado Step 2");

  // Limpiar input de archivo
  const input = document.getElementById('archivo-woq');
  if (input) {
    input.value = '';
  }

  // Limpiar información visual del archivo
  const fileInfo = document.getElementById('file-info-woq');
  if (fileInfo) {
    fileInfo.classList.add('hidden');
  }

  // 🔄 NO reiniciamos selectedFile aquí para mantenerlo durante el procesamiento
  // window.appStateStep2.selectedFile = null;
  window.appStateStep2.validationResult = null;
  window.appStateStep2.datosFiltrados = [];
  window.appStateStep2.yaMostroResultados = false;
  window.appStateStep2.isProcessing = false;

  // Resetear paginación
  window.appStateStep2.paginacion = {
    paginaActual: 1,
    registrosPorPagina: 50,
    totalPaginas: 1,
    totalRegistros: 0
  };

  // Resetear filtros activos
  window.appStateStep2.filtrosActivos = {
    contrato: '',
    n_wo: '',
    contrato: '',
    es_cerrado: ''
  };

  // Resetear inputs de filtros
  const filtros = [
    { id: 'filtro-contrato-step2' },
    { id: 'filtro-wo-step2' },
    { id: 'filtro-estado-step2' }
  ];

  filtros.forEach(filtro => {
    const elemento = document.getElementById(filtro.id);
    if (elemento) {
      if (elemento.tagName.toLowerCase() === 'select') {
        elemento.selectedIndex = 0;
      } else {
        elemento.value = '';
      }
    }
  });

  // Destruir DataTable si existe
  if (window.appStateStep2.dataTableInstance) {
    try {
      window.appStateStep2.dataTableInstance.destroy();
      window.appStateStep2.dataTableInstance = null;
    } catch (error) {
      console.warn("⚠️ Error al destruir DataTable:", error);
    }
  }

  // Ocultar resultados y errores
  ocultarResultadosStep2();
  ocultarErrorStep2();

  // Ocultar botón siguiente
  const btnSiguiente = document.getElementById('btn-siguiente');
  if (btnSiguiente) {
    btnSiguiente.style.display = 'none';
  }

  // Ocultar botón siguiente superior
  const btnSiguienteTop = document.getElementById('btn-siguiente-top');
  if (btnSiguienteTop) {
    btnSiguienteTop.classList.add('hidden');
  }

  // Desactivar botón procesar
  deshabilitarBotonProcesar();

  // Resetear estado del proceso en la UI
  const estadoProceso = document.getElementById('estado-proceso');
  if (estadoProceso) {
    estadoProceso.textContent = "Esperando archivo WOQ";
    estadoProceso.className = "text-gray-600";
  }

  const estadoProcesoLateral = document.getElementById('estado-proceso-lateral');
  if (estadoProcesoLateral) {
    estadoProcesoLateral.textContent = "Esperando archivo WOQ";
  }

  console.log("✅ Limpieza de estado completada");
} 


// ===================================================================
// PROCESAMIENTO DE ARCHIVOS
// ===================================================================

// ✅ Versión corregida y robusta de procesarArchivoWOQ
function procesarArchivoWOQ(event) {
  console.log("🔍 Iniciando procesarArchivoWOQ()");

 // if (window.appStateStep2.isProcessing) {
   // console.warn("⚠️ Ya hay un proceso en ejecución, se ignora esta solicitud");
   // return;
  //}

// No borramos el archivo seleccionado al iniciar el proceso.
// Solo reseteamos resultados y errores previos.
  ocultarErrorStep2();
  ocultarResultadosStep2();
  window.appStateStep2.yaMostroResultados = false;

  const archivo = window.appStateStep2.selectedFile || document.getElementById("archivo-woq").files[0];

  if (!archivo || archivo.name === "") {
    alert("Debes seleccionar un archivo");
    mostrarStep2Loading(false);
    window.appStateStep2.isProcessing = false;
    return;
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (archivo.size > MAX_FILE_SIZE) {
    alert(`El archivo es demasiado grande (${(archivo.size / (1024 * 1024)).toFixed(2)} MB). Máximo permitido: 10MB.`);
    mostrarStep2Loading(false);
    window.appStateStep2.isProcessing = false;
    return;
  }

  const nombreArchivo = archivo.name || '';
  const extension = nombreArchivo.includes('.') ? nombreArchivo.split('.').pop().toLowerCase() : '';

  if (!extension) {
    console.warn("⚠️ El archivo no tiene extensión. Se procesará como CSV.");
    mostrarAdvertenciaExtension("El archivo no tiene extensión. Se procesará como CSV.");
  } else if (!['csv', 'txt'].includes(extension)) {
    console.warn("⚠️ Extensión no estándar:", extension);
    mostrarAdvertenciaExtension(`Extensión de archivo no estándar (${extension}). El procesamiento podría fallar.`);
  }

  if (!window.pywebview || !window.pywebview.api) {
    console.error("❌ pywebview no está disponible");
    alert("❌ Error: La conexión con Python no está disponible");
    mostrarStep2Loading(false);
    window.appStateStep2.isProcessing = false;
    return;
  }

  deshabilitarBotonProcesar();
  mostrarStep2Loading(true);
  ocultarErrorStep2();
  ocultarResultadosStep2();

  const estadoProceso = document.getElementById('estado-proceso');
  if (estadoProceso) {
    estadoProceso.textContent = "Procesando archivo WOQ...";
    estadoProceso.className = "text-blue-600";
  }

  const reader = new FileReader();

  reader.onload = function () {
    try {
      const base64Parts = reader.result.split(',');
      if (base64Parts.length < 2) throw new Error("Formato de base64 inválido");

      const base64Data = base64Parts[1];

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Tiempo de espera agotado")), 60000);
      });

      console.log("📡 Enviando a pywebview.api.procesar_archivo_woq");

      Promise.race([
        window.pywebview.api.procesar_archivo_woq({ nombre: archivo.name, base64: base64Data }),
        timeoutPromise
      ])
      .then(resp => {
        console.log("📥 Respuesta recibida:", resp);
        window.appStateStep2.isProcessing = false;
        mostrarStep2Loading(false);

        if (!resp) {
          console.warn("⚠️ Respuesta nula del backend");
          mostrarErrorStep2("Error: No se recibió respuesta del servidor");
          return;
        }

        if (!resp.success) {
          console.warn("⚠️ Error reportado por backend:", resp.message);
          mostrarErrorStep2(resp.message || "Error desconocido al procesar archivo");
          return;
        }

        if (!resp.detalle || !Array.isArray(resp.detalle) || resp.detalle.length === 0) {
          console.warn("⚠️ Detalle vacío o inválido en respuesta");
          mostrarErrorStep2("El archivo no contiene datos válidos para procesar");
          return;
        }

        // ✅ Asignar los datos correctamente
        window.appStateStep2.validationResult = resp;
        window.appStateStep2.datosFiltrados = [...resp.detalle];
        window.appStateStep2.yaMostroResultados = false;

        // ✅ Mostrar resultados en UI
        mostrarResultadosStep2(resp);
        mostrarBotonSiguiente();

        // 🔍 Verificación (solo para depuración)
        console.log("✅ Resultado guardado:", window.appStateStep2.validationResult);
        console.log("✅ Tabla HTML generada:", document.getElementById('tabla-woq-resultados').innerHTML);
      })
      .catch(error => {
        window.appStateStep2.isProcessing = false;
        mostrarStep2Loading(false);

        console.error("❌ Error al llamar a procesar_archivo_woq:", error);

        if (error.message === "Tiempo de espera agotado") {
          mostrarErrorStep2("El procesamiento está tomando demasiado tiempo. Intente con un archivo más pequeño o contacte al soporte.");
        } else {
          mostrarErrorStep2("Error al procesar el archivo: " + (error.message || "Error desconocido"));
        }

        habilitarBotonProcesar();
      });

    } catch (error) {
      window.appStateStep2.isProcessing = false;
      mostrarStep2Loading(false);
      console.error("❌ Error general durante lectura del archivo:", error);
      mostrarErrorStep2("Error al leer el archivo: " + (error.message || "Error desconocido"));
      habilitarBotonProcesar();
    }
  };


  reader.onerror = function () {
    window.appStateStep2.isProcessing = false;
    mostrarStep2Loading(false);
    mostrarErrorStep2("Error al leer el archivo. Verifique el formato del archivo e intente nuevamente.");
    habilitarBotonProcesar();
  };

  reader.readAsDataURL(archivo);
}


// ===================================================================
// MOSTRAR RESULTADOS
// ===================================================================

function mostrarResultadosStep2(resultado) {
  console.log("🚀 Iniciando mostrarResultadosStep2");
  
  // Validación y protección para evitar doble ejecución
  if (window.appStateStep2.yaMostroResultados) {
    console.warn("⚠️ Los resultados ya fueron mostrados. Evitando doble ejecución.");
    return;
  }
  
  // Verificar estructura del resultado
  if (!resultado) {
    console.error("❌ Resultado es null o undefined");
    mostrarErrorStep2("Error: No se recibieron datos de validación");
    return;
  }

  if (!resultado.detalle || !Array.isArray(resultado.detalle)) {
    console.error("❌ Resultado no tiene detalle válido:", resultado);
    mostrarErrorStep2("Error: Estructura de datos inválida");
    return;
  }

  if (resultado.detalle.length === 0) {
    console.warn("⚠️ El resultado no contiene registros");
    mostrarErrorStep2("Advertencia: El archivo no contiene registros válidos");
    return;
  }

  // Llegado a este punto, hay datos válidos para mostrar
  console.log("📊 Detalle válido con", resultado.detalle.length, "registros");
  
  // Establecer bandera para evitar llamadas múltiples
  window.appStateStep2.yaMostroResultados = true;

  try {
    // Ocultar errores y mensajes previos
    ocultarErrorStep2();
    
    // Buscar el contenedor principal de resultados
    const contenedor = document.getElementById('resultado-woq');
    if (contenedor) {
      contenedor.classList.remove('hidden');
      contenedor.style.display = 'block';
    } else {
      console.error("❌ No se encontró el contenedor 'resultado-woq'");
    }
    
    // Mostrar el contenedor
    contenedor.style.display = 'block';
    console.log("✅ Contenedor principal mostrado");

    // Actualizar estado global con los datos (copia profunda para evitar referencias)
    const detalle = JSON.parse(JSON.stringify(resultado.detalle));
    window.appStateStep2.datosFiltrados = [...detalle];
    window.appStateStep2.paginacion.totalRegistros = detalle.length;
    window.appStateStep2.paginacion.totalPaginas = Math.ceil(detalle.length / window.appStateStep2.paginacion.registrosPorPagina);
    console.log("✅ Estado global actualizado");

    // 1. Mostrar estadísticas principales
    try {
      mostrarEstadisticasStep2(detalle);
      const resumenEstadisticas = document.getElementById('resumen-estadisticas');
      if (resumenEstadisticas) {
        resumenEstadisticas.style.display = 'block';
      }
      console.log("✅ Estadísticas principales mostradas");
    } catch (statsError) {
      console.error("❌ Error al mostrar estadísticas:", statsError);
      // No fallar todo el proceso por un error en estadísticas
    }
    
    // 2. Actualizar panel lateral de estadísticas
    try {
      actualizarEstadisticasLaterales(detalle);
      console.log("✅ Panel lateral actualizado");
    } catch (lateralError) {
      console.error("❌ Error al actualizar panel lateral:", lateralError);
      // No fallar todo el proceso por un error en panel lateral
    }

    // 3. Configurar filtros 
    try {
      setTimeout(() => {
        configurarFiltrosStep2();
        console.log("✅ Filtros conectados correctamente");
      }, 50);
    } catch (filtrosError) {
      console.error("❌ Error al conectar filtros:", filtrosError);
    }
    
    // 4. Mostrar tabla nativa HTML en lugar de DataTable
    try {
      // Renderizar tabla con paginación nativa
      mostrarPaginaActual();
      mostrarControlesPaginacion();
      console.log("✅ Tabla HTML nativa inicializada");
      
      // Mostrar botón siguiente
      const btnSiguiente = document.getElementById('btn-siguiente');
      if (btnSiguiente) {
        btnSiguiente.style.display = 'flex';
      }
    } catch (tablaError) {
      console.error("❌ Error al renderizar tabla nativa:", tablaError);
      mostrarErrorStep2("Error al mostrar tabla de resultados");
    }
    
    // 5. Actualizar contador de filtros
    try {
      actualizarContadorFiltrosStep2();
      console.log("✅ Contador de filtros actualizado");
    } catch (contadorError) {
      console.error("❌ Error al actualizar contador de filtros:", contadorError);
    }
    
    // 6. Mostrar botón siguiente
    try {
      mostrarBotonSiguiente();
      
      // ✅ Mostrar y conectar botón superior
      const btnSiguienteTop = document.getElementById('btn-siguiente-top');
      if (btnSiguienteTop && window.appStateStep2.validationResult?.detalle?.length > 0) {
        btnSiguienteTop.classList.remove('hidden');

        // ✅ Navegar al paso 3 al hacer clic (solo si no tiene listener ya)
        if (!btnSiguienteTop.hasAttribute('data-listener-added')) {
          btnSiguienteTop.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.appStateStep2.validationResult && window.appStateStep2.validationResult.detalle.length > 0) {
              window.location.href = '/step3';
            } else {
              alert('Debe procesar un archivo antes de continuar');
            }
          });
          btnSiguienteTop.setAttribute('data-listener-added', 'true');
        }
      }
      
      console.log("✅ Botón siguiente mostrado");
    } catch (btnError) {
      console.error("❌ Error al mostrar botón siguiente:", btnError);
    }
    
    // 7. Actualizar estado del proceso en la barra de estado
    try {
      const estadoProceso = document.getElementById('estado-proceso');
      if (estadoProceso) {
        // estadoProceso.textContent = `${detalle.length} registros WOQ procesados`;
        estadoProceso.className = "text-green-600";
      }
      
      const estadoProcesoLateral = document.getElementById('estado-proceso-lateral');
      if (estadoProcesoLateral) {
        estadoProcesoLateral.textContent = `${detalle.length} registros WOQ procesados`;
      }
    } catch (estadoError) {
      console.error("❌ Error al actualizar estado del proceso:", estadoError);
    }
    
    // 8. Habilitar botón procesar para permitir nuevos procesamientos
    habilitarBotonProcesar();
    
    console.log("✅ Proceso de mostrar resultados completado exitosamente");
    
  } catch (error) {
    console.error("❌ Error al mostrar resultados:", error);
    window.appStateStep2.yaMostroResultados = false;
    mostrarErrorStep2("Error al mostrar resultados: " + error.message);
  }
}

function configurarFiltrosStep2() {
  const mapeo = {
    'filtro-wo-step2': 'n_wo',
    'filtro-contrato-step2': 'contrato',
    'filtro-estado-step2': 'es_cerrado'
  };

  Object.entries(mapeo).forEach(([id, campo]) => {
    const input = document.getElementById(id);
    if (input) {
      const evento = input.tagName.toLowerCase() === 'select' ? 'change' : 'input';
      input.addEventListener(evento, (e) => {
        window.appStateStep2.filtrosActivos[campo] = e.target.value === "todos" ? "" : e.target.value;
        aplicarFiltrosStep2();
      });
    }
  });

  const limpiar = document.getElementById('btn-limpiar-filtros-step2');
  if (limpiar) {
    limpiar.addEventListener('click', () => {
      window.appStateStep2.filtrosActivos = {
        n_wo: '',
        contrato: '',
        es_cerrado: ''
      };
      Object.keys(mapeo).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (el.tagName.toLowerCase() === 'select') el.selectedIndex = 0;
          else el.value = '';
        }
      });
      aplicarFiltrosStep2();
    });
  }
}


function mostrarEstadisticasStep2(data) {
  if (!data || !Array.isArray(data)) {
    console.warn("❌ Datos inválidos para estadísticas");
    return;
  }

  const total = data.length;
  let cerrados = 0;

  if (data[0].hasOwnProperty("es_cerrado")) {
    cerrados = data.filter(r => r.es_cerrado === "SI").length;
  } else if (data[0].hasOwnProperty("cerrado")) {
    cerrados = data.filter(r => r.cerrado === "X").length;
  }

  const pendientes = total - cerrados;
  const porcentaje = total > 0 ? Math.round((cerrados / total) * 100) : 0;

  // Actualizar elementos con ID individuales
  document.getElementById("stat-step2-total").textContent = total;
  document.getElementById("stat-step2-cerrados").textContent = cerrados;
  document.getElementById("stat-step2-pendientes").textContent = pendientes;
  document.getElementById("stat-step2-porcentaje").textContent = porcentaje + "%";

  // Asegurar que el panel esté visible
  document.getElementById("estadisticas-step2")?.classList.remove("hidden");

  console.log("📊 Estadísticas actualizadas para Step 2");
}


// ===================================================================
// DATATABLE
// ===================================================================

// Esta función está obsoleta y se mantiene por compatibilidad con código existente
// Ya que ahora usamos la tabla nativa HTML en lugar de DataTables
function inicializarDataTableStep2(data) {
  console.log("📊 Esta función está obsoleta - Ahora usamos tablas HTML nativas");
  
  // Asegurar que todo el contenedor de resultados sea visible
  setTimeout(() => {
    const resultadoWoq = document.getElementById('resultado-woq');
    if (resultadoWoq) {
      resultadoWoq.style.display = 'block';
    }
  }, 100);
  
  return;
}

// ===================================================================
// MANEJO DE TABLAS Y PAGINACIÓN NATIVO
// ===================================================================

function mostrarPaginaActual() {
  const datosPagina = obtenerDatosPaginaActual();
  const tablaHtml = generarTablaHtml(datosPagina);

  const tablaContainer = document.getElementById('tabla-woq-resultados');
  if (tablaContainer) {
    tablaContainer.innerHTML = tablaHtml;
  }
}

function obtenerDatosPaginaActual() {
  const inicio = (window.appStateStep2.paginacion.paginaActual - 1) * window.appStateStep2.paginacion.registrosPorPagina;
  const fin = inicio + window.appStateStep2.paginacion.registrosPorPagina;
  return window.appStateStep2.datosFiltrados.slice(inicio, fin);
}

function mostrarControlesPaginacion() {
  const { paginaActual, totalPaginas, totalRegistros, registrosPorPagina } = window.appStateStep2.paginacion;

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

  const paginationContainer = document.getElementById('paginacion-woq');
  if (paginationContainer) {
    paginationContainer.innerHTML = controlsHtml;
    
    // Configurar el evento del selector de registros por página
    const selector = document.getElementById('registros-por-pagina');
    if (selector) {
      selector.addEventListener('change', (e) => {
        window.appStateStep2.paginacion.registrosPorPagina = parseInt(e.target.value);
        window.appStateStep2.paginacion.paginaActual = 1;
        window.appStateStep2.paginacion.totalPaginas = Math.ceil(
          window.appStateStep2.datosFiltrados.length / window.appStateStep2.paginacion.registrosPorPagina
        );
        mostrarPaginaActual();
        mostrarControlesPaginacion();
      });
    }
  }
}

function irPaginaAnterior() {
  if (window.appStateStep2.paginacion.paginaActual > 1) {
    window.appStateStep2.paginacion.paginaActual--;
    mostrarPaginaActual();
    mostrarControlesPaginacion();
  }
}

function irPaginaSiguiente() {
  if (window.appStateStep2.paginacion.paginaActual < window.appStateStep2.paginacion.totalPaginas) {
    window.appStateStep2.paginacion.paginaActual++;
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
  
  // Definir columnas principales y su orden preferido EXACTO para WOQ
  const columnasPreferidas = ['contrato', 'n_wo', 'n_wo_alt', 'orden', 'cliente', 'cerrado', 'es_cerrado', 'estado'];
  
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
    // Nombres de columnas más legibles para mostrar
    let nombreColumna = col.toUpperCase();
    switch(col) {
      case 'n_wo': nombreColumna = 'N° WO'; break;
      case 'n_wo_alt': nombreColumna = 'N WO'; break;
      case 'es_cerrado': nombreColumna = 'ESTADO CIERRE'; break;
      default: nombreColumna = col.toUpperCase();
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
    const estadoChip = generarChipEstadoWoq(fila.es_cerrado || 'Desconocido');
    const clasesFila = fila.es_cerrado === 'NO' ? 'bg-yellow-50' : '';

    html += `
      <tr class="hover:bg-gray-50 ${clasesFila}" data-index="${index}">
    `;
    
    // Generar celdas dinámicamente
    columnasOrdenadas.forEach(col => {
      let valor = fila[col] !== undefined && fila[col] !== null ? fila[col] : '';
      let atributoFiltro = '';
      
      // Agregar atributos de filtro para columnas específicas
      if (['contrato', 'n_wo', 'n_wo_alt', 'cliente', 'cerrado', 'es_cerrado'].includes(col)) {
        atributoFiltro = `data-filtro="${col}"`;
      }
      
      // Formatear valores especiales
      if (col === 'es_cerrado') {
        html += `<td class="px-3 py-2 border-b text-xs" ${atributoFiltro}>
          <span class="sr-only">${valor}</span>
          ${generarChipEstadoWoq(valor)}
        </td>`;
      } else {
        // Formatear valor según su tipo
        const valorFormateado = formatearValorWoq(valor, col);
        html += `<td class="px-3 py-2 border-b text-xs" ${atributoFiltro}>${valorFormateado}</td>`;
      }
    });
    
    // Agregar columna de acciones
    html += `
      <td class="px-3 py-2 border-b text-xs">
        <div class="flex space-x-2">
          <button class="text-blue-600 hover:text-blue-800" onclick="verDetalleWoq(${index})" title="Ver detalle">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
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

function generarChipEstadoWoq(estado) {
  if (!estado) return '<span class="badge badge-secondary">Desconocido</span>';
  
  switch(String(estado).toUpperCase()) {
    case 'SI':
      return '<span class="badge badge-success">SI</span>';
    case 'NO':
      return '<span class="badge badge-warning">NO</span>';
    case 'CERRADO':
      return '<span class="badge badge-success">CERRADO</span>';
    case 'ABIERTO':
      return '<span class="badge badge-warning">ABIERTO</span>';
    default:
      return `<span class="badge badge-secondary">${estado}</span>`;
  }
}

function formatearValorWoq(valor, columna) {
  if (valor === null || valor === undefined) return '';
  
  // Formateo específico según el tipo de columna
  switch(columna) {
    case 'contrato':
    case 'n_wo':
    case 'n_wo_alt':
      return `<span class="font-semibold">${valor}</span>`;
    case 'cerrado':
      return valor ? '<span class="badge badge-success">SI</span>' : '<span class="badge badge-warning">NO</span>';
    default:
      return String(valor);
  }
}

// ===================================================================
// UTILIDADES DE UI
// ===================================================================

function habilitarBotonProcesar() {
  const btnProcesar = document.getElementById('btn-procesar');
  if (btnProcesar) {
    btnProcesar.disabled = false;
    btnProcesar.classList.remove('btn-disabled');
    btnProcesar.classList.add('btn-primary');
  }
}

function deshabilitarBotonProcesar() {
  const btnProcesar = document.getElementById('btn-procesar');
  if (btnProcesar) {
    btnProcesar.disabled = true;
    btnProcesar.classList.add('btn-disabled');
    btnProcesar.classList.remove('btn-primary');
  }
}

function mostrarStep2Loading(mostrar) {
  // Actualizar spinner de carga
  const loadingSpinner = document.getElementById('loading-spinner');
  if (loadingSpinner) {
    loadingSpinner.style.display = mostrar ? 'block' : 'none';
  }
  
  // Actualizar botón procesar
  const btnProcesar = document.getElementById('btn-procesar');
  if (btnProcesar) {
    btnProcesar.disabled = mostrar;
    if (mostrar) {
      btnProcesar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Procesando...';
      btnProcesar.classList.add('disabled');
    } else {
      btnProcesar.innerHTML = '<i class="fas fa-play me-2"></i>Procesar archivo';
      btnProcesar.classList.remove('disabled');
    }
  }
  
  // Si estamos mostrando carga, desactivar también el botón volver
  const btnVolver = document.getElementById('btn-volver');
  if (btnVolver) {
    btnVolver.disabled = mostrar;
    if (mostrar) {
      btnVolver.classList.add('disabled');
    } else {
      btnVolver.classList.remove('disabled');
    }
  }
  
  // Actualizar mensaje de estado
  const estadoProceso = document.getElementById('estado-proceso');
  if (estadoProceso && mostrar) {
    estadoProceso.textContent = "Procesando archivo WOQ...";
    estadoProceso.className = "text-blue-600";
  }
  
  const estadoProcesoLateral = document.getElementById('estado-proceso-lateral');
  if (estadoProcesoLateral && mostrar) {
    estadoProcesoLateral.textContent = "Procesando archivo WOQ...";
  }
  
  // Actualizar estado global
  window.appStateStep2.isProcessing = mostrar;
}

function mostrarErrorStep2(mensaje) {
  const errorDiv = document.getElementById('error-woq');
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
  ocultarResultadosStep2();
}

function ocultarErrorStep2() {
  const errorDiv = document.getElementById('error-woq');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
  
  // También ocultamos advertencias de extensión si existen
  const advertenciaDiv = document.getElementById('advertencia-extension');
  if (advertenciaDiv) {
    advertenciaDiv.style.display = 'none';
  }
}

function mostrarAdvertenciaExtension(mensaje) {
  // Buscar o crear el div de advertencia
  let advertenciaDiv = document.getElementById('advertencia-extension');
  
  if (!advertenciaDiv) {
    // Si no existe, crearlo
    advertenciaDiv = document.createElement('div');
    advertenciaDiv.id = 'advertencia-extension';
    advertenciaDiv.className = 'alert alert-warning mb-3';
    advertenciaDiv.style.display = 'none';
    
    // Encontrar un lugar adecuado para insertarlo
    const fileInfo = document.getElementById('file-info-woq');
    if (fileInfo && fileInfo.parentNode) {
      fileInfo.parentNode.insertBefore(advertenciaDiv, fileInfo.nextSibling);
    } else {
      // Si no encontramos el lugar ideal, buscar otra ubicación
      const contenedor = document.querySelector('.card-body');
      if (contenedor) {
        contenedor.appendChild(advertenciaDiv);
      }
    }
  }
  
  // Actualizar mensaje y mostrar
  if (advertenciaDiv) {
    advertenciaDiv.innerHTML = `
      <div class="flex items-center">
        <svg class="w-5 h-5 mr-2 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <span>${mensaje}</span>
      </div>
    `;
    advertenciaDiv.style.display = 'block';
  }
}

function ocultarResultadosStep2() {
  const resultado = document.getElementById('resultado-woq');
  const resumen = document.getElementById('resumen-estadisticas');
  
  if (resultado) {
    resultado.style.display = 'none';
    console.log("✅ Contenedor resultado-woq ocultado");
  }
  if (resumen) {
    resumen.style.display = 'none';
    console.log("✅ Contenedor resumen-estadisticas ocultado");
  }
}

function mostrarBotonSiguiente() {
  const btnSiguiente = document.getElementById('btn-siguiente');
  if (btnSiguiente) {
    btnSiguiente.style.display = 'flex'; // Usar flex para mantener alineación con iconos
  }
}

function actualizarContadorFiltrosStep2() {
  const totalRegistros = window.appStateStep2.datosFiltrados.length;
  const totalFiltrados = window.appStateStep2.paginacion.totalRegistros;
  
  const contadorFiltros = document.getElementById('contador-filtros');
  if (contadorFiltros) {
    if (totalFiltrados < totalRegistros) {
      contadorFiltros.textContent = `Mostrando ${totalFiltrados} de ${totalRegistros} registros`;
      contadorFiltros.classList.remove('hidden');
    } else {
      contadorFiltros.classList.add('hidden');
    }
  }
}

function mostrarModal(options) {
  const modalExistente = document.getElementById('modal-global');
  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'modal-global';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  
  const sizeClass = options.size || 'max-w-md';
  
  let buttonsHtml = '';
  if (options.buttons && options.buttons.length > 0) {
    buttonsHtml = '<div class="modal-footer flex gap-2 mt-4">';
    options.buttons.forEach(button => {
      const buttonClass = button.action === 'close' ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700';
      buttonsHtml += `<button class="${buttonClass} text-white px-4 py-2 rounded flex-1" onclick="this.closest('#modal-global').remove()">${button.text}</button>`;
    });
    buttonsHtml += '</div>';
  }
  
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 ${sizeClass} w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="modal-title">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">${options.title || 'Modal'}</h3>
      </div>
      <div class="modal-body">
        ${options.content || ''}
      </div>
      ${buttonsHtml}
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  document.addEventListener('keydown', function handleEsc(e) {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEsc);
    }
  });
}

function verDetalleWoq(index) {
  const registro = window.appStateStep2.datosFiltrados[index];
  if (!registro) {
    console.error("❌ No se encontró el registro en el índice", index);
    return;
  }
  
  // Crear contenido de modal con los datos del registro
  let contenidoHtml = `<div class="p-4">`;
  
  // Cabecera con datos principales
  contenidoHtml += `
    <div class="mb-4 pb-3 border-b">
      <h3 class="text-lg font-bold">Detalle del registro WOQ</h3>
      <div class="flex flex-wrap gap-2 mt-2">
        <span class="badge badge-info">Contrato: ${registro.contrato || 'N/A'}</span>
        <span class="badge badge-info">N° WO: ${registro.n_wo || 'N/A'}</span>
        <span class="badge ${registro.es_cerrado === 'NO' ? 'badge-warning' : 'badge-success'}">
          ${registro.es_cerrado || 'Estado desconocido'}
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
  
  // Agregar filas para cada campo del registro
  Object.keys(registro).forEach(campo => {
    let valor = registro[campo] !== null && registro[campo] !== undefined ? registro[campo] : '';
    
    contenidoHtml += `
      <tr>
        <td class="px-3 py-2 border-b text-xs font-medium text-gray-700">${campo}</td>
        <td class="px-3 py-2 border-b text-xs">${valor}</td>
      </tr>
    `;
  });
  
  contenidoHtml += `
      </tbody>
    </table>
  </div>`;
  
  // Mostrar en un modal
  mostrarModal({
    title: 'Detalle del Registro WOQ',
    content: contenidoHtml,
    size: 'max-w-4xl',
    buttons: [
      { text: 'Cerrar', action: 'close' }
    ]
  });
}

// ===================================================================
// EXPORTACIÓN DE DATOS
// ===================================================================

function exportarStep2() {
  console.log("📊 Iniciando exportación de datos");
  
  if (!window.appStateStep2.datosFiltrados || window.appStateStep2.datosFiltrados.length === 0) {
    alert("No hay datos para exportar");
    return;
  }
  
  console.log("📊 Datos a exportar:", window.appStateStep2.datosFiltrados.length, "registros");
  
  try {
    // Verificar si pywebview está disponible
    if (!window.pywebview || !window.pywebview.api) {
      alert("La conexión con Python no está disponible");
      return;
    }
    
    console.log("🔗 pywebview disponible, llamando a exportar_woq...");
    
    // Llamar a la API de Python para exportar los datos
    window.pywebview.api.exportar_woq(window.appStateStep2.datosFiltrados)
      .then(result => {
        console.log("📥 Respuesta de exportar_woq:", result);
        
        if (result && result.success) {
          console.log("✅ Exportación exitosa, mostrando modal...");
          mostrarModalExitoExportacionStep2(result);
        } else {
          console.error("❌ Error en exportación:", result);
          alert("Error al exportar los datos: " + (result.message || "Error desconocido"));
        }
      })
      .catch(error => {
        console.error("❌ Error al exportar:", error);
        alert("Error al exportar: " + (error.message || "Error desconocido"));
      });
  } catch (error) {
    console.error("❌ Error general al exportar:", error);
    alert("Error al exportar: " + (error.message || "Error desconocido"));
  }
}

// Función para mostrar modal de éxito en la exportación (Step 2)
function mostrarModalExitoExportacionStep2(resultado) {
  console.log("📋 ENTRANDO en mostrarModalExitoExportacionStep2");
  console.log("📋 Resultado recibido:", resultado);
  
  // Verificar que el resultado tenga filepath
  if (!resultado || !resultado.filepath) {
    console.error("❌ No se recibió filepath en el resultado");
    alert("Error: No se recibió información del archivo exportado");
    return;
  }
  
  console.log("📋 Creando modal overlay...");
  
  // Crear overlay modal
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.id = 'modal-overlay-exito-exportacion-step2';
  
  console.log("📋 Configurando HTML del modal...");
  
  modalOverlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" style="color: #28a745; display: flex; align-items: center;">
          <i class="fas fa-check-circle" style="margin-right: 10px;"></i>
          Exportación Exitosa
        </div>
        <button class="modal-close" id="btn-cerrar-modal-x-step2">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 15px;">Los datos se han exportado correctamente.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <strong>Archivo generado:</strong><br>
          <code style="font-size: 12px; word-break: break-all;">${resultado.filepath}</code>
        </div>
      </div>
      <div class="modal-footer">
        <button id="btn-abrir-carpeta-exito-step2" class="btn btn-primary">
          <i class="fas fa-folder-open"></i>
          Abrir Carpeta
        </button>
        <button id="btn-cerrar-modal-exito-step2" class="btn btn-secondary">
          <i class="fas fa-times"></i>
          Cerrar
        </button>
      </div>
    </div>
  `;

  console.log("📋 Agregando modal al DOM...");
  document.body.appendChild(modalOverlay);
  console.log("📋 Modal agregado al DOM exitosamente");

  console.log("📋 Configurando event listeners...");

  // Event listeners con IDs únicos
  document.getElementById('btn-abrir-carpeta-exito-step2').addEventListener('click', async () => {
    console.log("🗂️ Botón abrir carpeta clickeado");
    try {
      if (window.pywebview && window.pywebview.api) {
        console.log("Abriendo carpeta:", resultado.filepath);
        const resp = await window.pywebview.api.abrir_carpeta_archivo(resultado.filepath);
        if (!resp.success) {
          console.error("Error al abrir carpeta:", resp.message);
          alert("❌ Error al abrir carpeta: " + resp.message);
        }
      }
    } catch (error) {
      console.error("Error al abrir carpeta:", error);
      alert("❌ Error al abrir carpeta: " + error.message);
    }
    
    if (document.body.contains(modalOverlay)) {
      document.body.removeChild(modalOverlay);
    }
  });

  document.getElementById('btn-cerrar-modal-exito-step2').addEventListener('click', () => {
    console.log("❌ Botón cerrar clickeado");
    if (document.body.contains(modalOverlay)) {
      document.body.removeChild(modalOverlay);
    }
  });

  document.getElementById('btn-cerrar-modal-x-step2').addEventListener('click', () => {
    console.log("❌ X de cerrar clickeado");
    if (document.body.contains(modalOverlay)) {
      document.body.removeChild(modalOverlay);
    }
  });

  // Cerrar al hacer clic en el overlay
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      console.log("❌ Click en overlay para cerrar");
      if (document.body.contains(modalOverlay)) {
        document.body.removeChild(modalOverlay);
      }
    }
  });

  // Cerrar con ESC
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      console.log("❌ ESC presionado para cerrar");
      if (document.body.contains(modalOverlay)) {
        document.body.removeChild(modalOverlay);
      }
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
  
  console.log("✅ Modal configurado completamente y debería estar visible");
}

window.aplicarFiltrosStep2 = function () {
  const original = window.appStateStep2.validationResult?.detalle || [];
  const filtros = window.appStateStep2.filtrosActivos;

  const filtrados = original.filter(fila =>
    (fila["N°_WO"] || '').toString().includes((filtros.n_wo || '').toString()) &&
    (fila["CONTRATO"] || '').toString().includes((filtros.contrato || '').toString()) &&
    (
      filtros.es_cerrado === '' || // "Todos los estados"
      (fila["es_cerrado"] || '').toLowerCase() === filtros.es_cerrado.toLowerCase()
    )
  );

  window.appStateStep2.datosFiltrados = filtrados;
  window.appStateStep2.paginacion.totalRegistros = filtrados.length;
  window.appStateStep2.paginacion.totalPaginas = Math.ceil(filtrados.length / window.appStateStep2.paginacion.registrosPorPagina);
  window.appStateStep2.paginacion.paginaActual = 1;

  // 👇 Re-renderiza directamente la tabla y el contador SIN volver a mostrar resultados completos
  mostrarPaginaActual();
  mostrarControlesPaginacion();
  actualizarContadorFiltrosStep2();

  console.log("🔎 Filtrados:", filtrados.length);
};



