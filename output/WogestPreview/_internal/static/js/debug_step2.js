// Función de prueba para verificar el flujo de datos
function pruebaStep2() {
  console.log("🧪 Iniciando prueba de Step 2");
  
  // Simular datos de ejemplo
  const datosPrueba = [
    {
      DC: "PE920",
      "N°_WO": 5450249,
      TIPO: "MNTO",
      CONTRATO: 1500342,
      DEALER: 61,
      STATUS1: "OP",
      STATUS2: "CUOP",
      CERRADO: "",
      CLIENTE: "MIRJIA VILLAR LIENDO",
      ES_CERRADO: "NO"
    },
    {
      DC: "PE151",
      "N°_WO": 5551300,
      TIPO: "MNTO",
      CONTRATO: 1572271,
      DEALER: 61,
      STATUS1: "OP",
      STATUS2: "CUOP",
      CERRADO: "X",
      CLIENTE: "CARLOS MATEO",
      ES_CERRADO: "SI"
    }
  ];
  
  console.log("📊 Datos de prueba:", datosPrueba);
  
  // Probar renderResumen
  renderResumen(datosPrueba);
  
  // Probar renderTabla
  renderTabla(datosPrueba);
  
  console.log("✅ Prueba completada");
}

// Exponer función para testing
window.pruebaStep2 = pruebaStep2;
