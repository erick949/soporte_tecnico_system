const { z } = require('zod');
const pool = require('../db/pool');
const generarFolio = require('../utils/generarFolio');

const BASE = `
  SELECT s.id, s.folio, s.nombre_solicitante, s.correo, s.descripcion, s.estado,
         s.fecha_creacion, s.fecha_actualizacion,
         s.categoria_id, c.nombre AS categoria,
         s.prioridad_id, p.nombre AS prioridad
  FROM solicitudes s
  JOIN categorias c ON c.id = s.categoria_id
  JOIN prioridades p ON p.id = s.prioridad_id`;

const ESTADOS = ['pendiente', 'en_proceso', 'resuelta'];

const crearSchema = z.object({
  nombre_solicitante: z.string().trim().min(2).max(150),
  correo: z.string().trim().email().max(150),
  categoria: z.string().trim().optional(),
  categoria_id: z.coerce.number().int().positive().optional(),
  prioridad: z.string().trim().optional(),
  prioridad_id: z.coerce.number().int().positive().optional(),
  descripcion: z.string().trim().min(5)
})
  .refine((d) => d.categoria || d.categoria_id, { message: 'Indica categoria o categoria_id', path: ['categoria'] })
  .refine((d) => d.prioridad || d.prioridad_id, { message: 'Indica prioridad o prioridad_id', path: ['prioridad'] });

// Busca el id de un catálogo por id o por nombre (sin distinguir mayúsculas)
async function resolverCatalogo(tabla, id, nombre) {
  const { rows } = id
    ? await pool.query(`SELECT id FROM ${tabla} WHERE id = $1`, [id])
    : await pool.query(`SELECT id FROM ${tabla} WHERE LOWER(nombre) = LOWER($1)`, [nombre]);
  return rows[0]?.id;
}

async function buscar({ categoria, prioridad, estado } = {}) {
  const w = [], v = [];
  if (categoria) { v.push(categoria); w.push(`(c.id::text = $${v.length} OR LOWER(c.nombre) = LOWER($${v.length}))`); }
  if (prioridad) { v.push(prioridad); w.push(`(p.id::text = $${v.length} OR LOWER(p.nombre) = LOWER($${v.length}))`); }
  if (estado) { v.push(estado); w.push(`s.estado = $${v.length}`); }
  const { rows } = await pool.query(
    `${BASE} ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY s.fecha_creacion DESC, s.id DESC`, v);
  return rows;
}

async function resumen() {
  const q = (sql) => pool.query(sql).then((r) => r.rows);
  const [[{ total }], por_categoria, por_prioridad, por_estado] = await Promise.all([
    q('SELECT COUNT(*)::int AS total FROM solicitudes'),
    q(`SELECT c.nombre AS categoria, COUNT(s.id)::int AS total FROM categorias c
       LEFT JOIN solicitudes s ON s.categoria_id = c.id GROUP BY c.id ORDER BY c.id`),
    q(`SELECT p.nombre AS prioridad, COUNT(s.id)::int AS total FROM prioridades p
       LEFT JOIN solicitudes s ON s.prioridad_id = p.id GROUP BY p.id ORDER BY p.nivel`),
    q('SELECT estado, COUNT(*)::int AS total FROM solicitudes GROUP BY estado')
  ]);
  return { total, por_categoria, por_prioridad, por_estado };
}

const idValido = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) { res.status(400).json({ error: 'ID inválido' }); return null; }
  return id;
};

const listar = async (req, res) => res.json(await buscar(req.query));

const detalle = async (req, res) => {
  const id = idValido(req, res); if (!id) return;
  const { rows } = await pool.query(`${BASE} WHERE s.id = $1`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada' });
  res.json(rows[0]);
};

const crear = async (req, res) => {
  const d = crearSchema.parse(req.body);
  const categoriaId = await resolverCatalogo('categorias', d.categoria_id, d.categoria);
  if (!categoriaId) return res.status(400).json({ error: 'Categoría no existe' });
  const prioridadId = await resolverCatalogo('prioridades', d.prioridad_id, d.prioridad);
  if (!prioridadId) return res.status(400).json({ error: 'Prioridad no existe' });

  const { rows: [{ n }] } = await pool.query("SELECT nextval('solicitudes_folio_seq') AS n");
  const folio = generarFolio(n);
  const { rows } = await pool.query(
    `INSERT INTO solicitudes (folio, nombre_solicitante, correo, categoria_id, prioridad_id, descripcion)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, folio, estado`,
    [folio, d.nombre_solicitante, d.correo, categoriaId, prioridadId, d.descripcion]
  );
  res.status(201).json(rows[0]); // n8n usa { folio } para Sheets y Gmail
};

const actualizarEstado = async (req, res) => {
  const id = idValido(req, res); if (!id) return;
  const { estado } = z.object({ estado: z.enum(ESTADOS) }).parse(req.body);
  const { rows } = await pool.query(
    `UPDATE solicitudes SET estado = $1, fecha_actualizacion = now() WHERE id = $2
     RETURNING id, folio, estado, fecha_actualizacion`, [estado, id]);
  if (!rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada' });
  res.json(rows[0]);
};

// n8n puede registrar aquí si el correo se envió (trazabilidad)
const registrarNotificacion = async (req, res) => {
  const id = idValido(req, res); if (!id) return;
  const { correo_enviado } = z.object({ correo_enviado: z.boolean().default(true) }).parse(req.body);
  const existe = await pool.query('SELECT 1 FROM solicitudes WHERE id = $1', [id]);
  if (!existe.rowCount) return res.status(404).json({ error: 'Solicitud no encontrada' });
  const { rows } = await pool.query(
    'INSERT INTO notificaciones (solicitud_id, correo_enviado) VALUES ($1, $2) RETURNING *',
    [id, correo_enviado]);
  res.status(201).json(rows[0]);
};

const categorias = async (_req, res) =>
  res.json((await pool.query('SELECT id, nombre FROM categorias ORDER BY id')).rows);

const prioridades = async (_req, res) =>
  res.json((await pool.query('SELECT id, nombre, nivel FROM prioridades ORDER BY nivel')).rows);

const dashboard = async (_req, res) => res.json(await resumen());

module.exports = {
  buscar, resumen, ESTADOS,
  listar, detalle, crear, actualizarEstado, registrarNotificacion,
  categorias, prioridades, dashboard
};
