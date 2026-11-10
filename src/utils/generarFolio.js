// Formato: SOL-AAAA-0001 (el consecutivo viene de una secuencia de PostgreSQL)
function generarFolio(consecutivo, fecha = new Date()) {
  return `SOL-${fecha.getFullYear()}-${String(consecutivo).padStart(4, '0')}`;
}

module.exports = generarFolio;
