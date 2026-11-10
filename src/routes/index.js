const router = require('express').Router();
const c = require('../controllers/solicitudes.controller');

// Envuelve handlers async para que los errores lleguen al middleware de errores
const w = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/solicitudes', w(c.crear));
router.get('/solicitudes', w(c.listar));
router.get('/solicitudes/:id', w(c.detalle));
router.put('/solicitudes/:id', w(c.actualizarEstado));
router.post('/solicitudes/:id/notificacion', w(c.registrarNotificacion));
router.get('/categorias', w(c.categorias));
router.get('/prioridades', w(c.prioridades));
router.get('/dashboard/resumen', w(c.dashboard));

module.exports = router;
