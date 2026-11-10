const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const generarFolio = require('../utils/generarFolio');

async function initDb() {
  // 1. Crear tablas si no existen
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  // 2. Cargar catálogos y ejemplos desde el JSON
  const seed = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../data/seed.json'), 'utf8')
  );

  for (const nombre of seed.categorias) {
    await pool.query(
      'INSERT INTO categorias (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING',
      [nombre]
    );
  }
  for (const p of seed.prioridades) {
    await pool.query(
      'INSERT INTO prioridades (nombre, nivel) VALUES ($1, $2) ON CONFLICT (nombre) DO NOTHING',
      [p.nombre, p.nivel]
    );
  }

  if (process.env.SEED_EJEMPLOS === 'false') return;

  const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM solicitudes');
  if (rows[0].total > 0) return; // ya hay datos, no duplicar

  for (const s of seed.solicitudes) {
    const { rows: [{ n }] } = await pool.query("SELECT nextval('solicitudes_folio_seq') AS n");
    await pool.query(
      `INSERT INTO solicitudes
        (folio, nombre_solicitante, correo, categoria_id, prioridad_id, descripcion, estado, fecha_creacion, fecha_actualizacion)
       VALUES ($1, $2, $3,
        (SELECT id FROM categorias WHERE nombre = $4),
        (SELECT id FROM prioridades WHERE nombre = $5),
        $6, $7,
        now() - make_interval(days => $8), now() - make_interval(days => $8))`,
      [generarFolio(n), s.nombre_solicitante, s.correo, s.categoria, s.prioridad,
       s.descripcion, s.estado || 'pendiente', s.dias_atras || 0]
    );
  }
  console.log(`Datos de ejemplo cargados: ${seed.solicitudes.length} solicitudes`);
}

module.exports = { initDb };

// Permite ejecutar: npm run db:init
if (require.main === module) {
  initDb()
    .then(() => { console.log('Base de datos lista'); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
