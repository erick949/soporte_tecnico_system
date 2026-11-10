CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS prioridades (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  nivel INT NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS solicitudes_folio_seq START 1;

CREATE TABLE IF NOT EXISTS solicitudes (
  id SERIAL PRIMARY KEY,
  folio VARCHAR(20) NOT NULL UNIQUE,
  nombre_solicitante VARCHAR(150) NOT NULL,
  correo VARCHAR(150) NOT NULL,
  categoria_id INT NOT NULL REFERENCES categorias(id),
  prioridad_id INT NOT NULL REFERENCES prioridades(id),
  descripcion TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_proceso','resuelta')),
  fecha_creacion TIMESTAMP NOT NULL DEFAULT now(),
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  solicitud_id INT NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
  correo_enviado BOOLEAN NOT NULL DEFAULT false,
  fecha_envio TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_categoria ON solicitudes(categoria_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_prioridad ON solicitudes(prioridad_id);
