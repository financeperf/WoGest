document.addEventListener('DOMContentLoaded', function () {
    const botonInicio = document.getElementById('start-btn');

    if (botonInicio) {
        botonInicio.addEventListener('click', async () => {
            await cargarPaso1();
        });
    }
});

/**
 * Carga dinámicamente el contenido de step1.html
 * sin recargar completamente la ventana del WebView.
 */
async function cargarPaso1() {
    try {
        // Llamada al backend Bottle para obtener el HTML del paso 1
        const response = await fetch('/step1');

        if (!response.ok) {
            throw new Error(`Error al cargar step1.html: ${response.status}`);
        }

        const html = await response.text();

        // Reemplaza completamente el contenido actual de la ventana
        document.open();
        document.write(html);
        document.close();

        // 🔁 Volver a inyectar step1.js después de reescribir el HTML (evita caché)
        setTimeout(() => {
            const script = document.createElement('script');
            script.src = '/static/js/step1.js?v=' + new Date().getTime(); // ← esto evita el caché del navegador
            script.type = 'text/javascript';
            document.body.appendChild(script);
        }, 100);

    } catch (error) {
        console.error('Error cargando la vista del Paso 1:', error);
        alert('Ocurrió un error al intentar iniciar el procesamiento. Intenta nuevamente.');
    }
}
