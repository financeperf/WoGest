// Esperar a que cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    const botonInicio = document.getElementById('start-btn');
    if (botonInicio) {
        botonInicio.addEventListener('click', cargarPaso1);
    }
});

/**
 * Carga dinámicamente el contenido de step1.html
 * y después inyecta step1.js para inicializar la app.
 */
async function cargarPaso1() {
    try {
        // Pedir el HTML del paso 1 al backend
        const response = await fetch('/step1');
        if (!response.ok) {
            throw new Error(`Error al cargar step1.html: ${response.status}`);
        }

        // Reemplazar el contenido actual con el nuevo HTML
        const html = await response.text();
        document.open();
        document.write(html);
        document.close();

        // Inyectar dinámicamente step1.js con anti-caché
        const script = document.createElement('script');
        script.src = '/static/js/step1.js?v=' + Date.now();
        script.type = 'text/javascript';
        script.onload = () => {
            if (typeof initializeApp === "function") {
                initializeApp();
            } else {
                console.error("❌ initializeApp no está definida en step1.js");
            }
        };
        document.body.appendChild(script);

    } catch (error) {
        console.error("Error cargando la vista del Paso 1:", error);
        alert("Ocurrió un error al intentar iniciar el procesamiento. Intenta nuevamente.");
    }
}
