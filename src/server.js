require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { ZodError } = require('zod');
const { initDb } = require('./db/init');
const c = require('./controllers/solicitudes.controller');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api', require('./routes'));

// Panel de administración
app.get('/', async (req, res, next) => {
  try {
    const filtros = {
      categoria: req.query.categoria || '',
      prioridad: req.query.prioridad || '',
      estado: req.query.estado || ''
    };
    const pool = require('./db/pool');
    const [stats, solicitudes, cats, pris] = await Promise.all([
      c.resumen(),
      c.buscar(filtros),
      pool.query('SELECT nombre FROM categorias ORDER BY id'),
      pool.query('SELECT nombre FROM prioridades ORDER BY nivel')
    ]);
    res.render('index', {
      stats, solicitudes, filtros, estados: c.ESTADOS,
      categorias: cats.rows, prioridades: pris.rows
    });
  } catch (e) { next(e); }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }))
    });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(PORT, () => console.log(`Servidor listo en http://localhost:${PORT}`)))
  .catch((e) => { console.error('No se pudo inicializar la base de datos:', e.message); process.exit(1); });
