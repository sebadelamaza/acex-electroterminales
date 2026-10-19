-- ═══════════════════════════════════════════════════════════════════════════
-- ACEX eTransport — Schema Supabase (PostgreSQL)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── EXTENSIONES ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── CLIENTES (maestro) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id             TEXT        PRIMARY KEY,          -- CL001, CL002…
  nombre         TEXT        NOT NULL,
  rut            TEXT,
  email_contacto TEXT,
  telefono       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TERMINALES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS terminales (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id             TEXT        UNIQUE NOT NULL,  -- CMN-YYYYMMDD-XXX o T001…
  nombre                  TEXT        NOT NULL,
  cliente_id              TEXT        REFERENCES clientes(id),
  cliente_nombre          TEXT,
  direccion               TEXT,
  num_cargadores          INT,
  modelo_cargador         TEXT,
  potencia_kw             TEXT,
  protocolo               TEXT        DEFAULT 'OCPP 1.6',
  cert_electrico          TEXT,
  fecha_comisionamiento   DATE,
  estado                  TEXT        DEFAULT 'Activo',
  created_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS terminales_cliente_id_idx ON terminales(cliente_id);
CREATE INDEX IF NOT EXISTS terminales_estado_idx     ON terminales(estado);

-- ─── CASOS (tickets de asistencia) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS casos (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket              TEXT        UNIQUE NOT NULL,    -- TKT-YYYYMMDD-XXX
  estado              TEXT        DEFAULT 'Abierto',
  cliente_nombre      TEXT,
  cliente_id          TEXT,
  terminal_nombre     TEXT,
  terminal_id         TEXT,
  tipo_falla          TEXT,
  descripcion_falla   TEXT,
  urgencia            TEXT,
  garantia            BOOLEAN     DEFAULT FALSE,
  tecnico_nombre      TEXT,
  contratista_nombre  TEXT,
  supervisor          TEXT,
  fecha_apertura      DATE,
  hora_apertura       TEXT,
  fecha_cierre        DATE,
  hh_total            NUMERIC(6,2),
  resultado_garantia  TEXT,
  token_caso          TEXT,
  observaciones       TEXT,
  campos_extra        JSONB,                          -- campos adicionales del form
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS casos_ticket_idx         ON casos(ticket);
CREATE INDEX IF NOT EXISTS casos_estado_idx         ON casos(estado);
CREATE INDEX IF NOT EXISTS casos_fecha_apertura_idx ON casos(fecha_apertura DESC);
CREATE INDEX IF NOT EXISTS casos_cliente_nombre_idx ON casos(cliente_nombre);
CREATE INDEX IF NOT EXISTS casos_token_caso_idx     ON casos(token_caso);

-- ─── MANTENIMIENTOS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mantenimientos (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket             TEXT        UNIQUE NOT NULL,    -- MNT-YYYYMMDD-XXX
  terminal           TEXT,
  terminal_id        TEXT,
  cliente            TEXT,
  cliente_id         TEXT,
  fecha_visita       DATE,
  tecnico            TEXT        NOT NULL,
  cargadores_json    JSONB,
  observaciones      TEXT,
  tiene_correctivos  BOOLEAN     DEFAULT FALSE,
  estado             TEXT        DEFAULT 'Registrado',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mantenimientos_ticket_idx  ON mantenimientos(ticket);
CREATE INDEX IF NOT EXISTS mantenimientos_cliente_idx ON mantenimientos(cliente);

-- ─── COMISIONAMIENTOS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comisionamientos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket         TEXT        UNIQUE NOT NULL,        -- CMN-YYYYMMDD-XXX
  terminal_id    TEXT        REFERENCES terminales(terminal_id),
  terminal_nombre TEXT,
  cliente_id     TEXT,
  cliente_nombre TEXT,
  tecnico        TEXT,
  fecha          DATE,
  cargadores_json JSONB,
  firma_nombre   TEXT,
  firma_rut      TEXT,
  firma_cargo    TEXT,
  firma_img      TEXT,                               -- base64 data URL canvas
  observaciones  TEXT,
  estado         TEXT        DEFAULT 'Entregado',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS comisionamientos_terminal_id_idx ON comisionamientos(terminal_id);

-- ─── TRIGGER: updated_at automático en casos ────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER casos_updated_at
  BEFORE UPDATE ON casos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────
-- Las funciones Netlify usan service_role key que bypasea RLS.
-- Si en el futuro se exponen endpoints públicos, agregar policies acá.
ALTER TABLE clientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE casos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mantenimientos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE comisionamientos ENABLE ROW LEVEL SECURITY;

-- ─── SEED: CLIENTES MAESTRO ─────────────────────────────────────────────────
INSERT INTO clientes (id, nombre) VALUES
  ('CL001', 'RBU'),
  ('CL002', 'METBUS'),
  ('CL003', 'VOY SANTIAGO SPA'),
  ('CL004', 'VOY SANTIAGO 14'),
  ('CL005', 'VOY SANTIAGO 15'),
  ('CL006', 'TRANSPORTES ALEJANDRO IBAÑEZ'),
  ('CL007', 'CORP. MUNICIPAL COLINA'),
  ('CL008', 'ESERCO'),
  ('CL009', 'EXPRESO RANCAGUA'),
  ('CL010', 'YANGUAS'),
  ('CL011', 'EFRABUS'),
  ('CL012', 'GALAXIAS SUSTENTABLE'),
  ('CL013', 'OK BUSES')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

-- ─── SEED: TERMINALES FALLBACK ───────────────────────────────────────────────
-- Terminals from DB_FALLBACK in mantencion.html (pre-Comisionamiento)
INSERT INTO terminales (terminal_id, nombre, cliente_id, cliente_nombre, direccion, num_cargadores, estado) VALUES
  ('T001', 'Terminal Pudahuel Norte',          'CL001', 'RBU',               'Av. El Colorado 1240, Pudahuel',               12, 'Activo'),
  ('T002', 'Terminal Lo Espejo',               'CL001', 'RBU',               'Av. Central 890, Lo Espejo',                    8, 'Activo'),
  ('T003', 'Terminal Maipú',                   'CL002', 'METBUS',            'Av. Rinconada 1500, Maipú',                    16, 'Activo'),
  ('T004', 'Terminal Quilicura',               'CL002', 'METBUS',            'Av. Matta 2300, Quilicura',                    10, 'Activo'),
  ('T005', 'ET La Estrella',                   'CL003', 'VOY SANTIAGO SPA',  'Cerro Navia',                                  13, 'Activo'),
  ('T006', 'ET Los Almendros (Pudahuel)',       'CL010', 'YANGUAS',           'Av. José Guzmán Riesco 1343, Pudahuel',        13, 'Activo'),
  ('T007', 'Terminal Horcón',                  'CL011', 'EFRABUS',           'Horcón, V Región',                              6, 'Activo'),
  ('T008', 'Terminal Colina',                  'CL013', 'OK BUSES',          'Colina, RM',                                    8, 'Activo')
ON CONFLICT (terminal_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- VISTAS ÚTILES PARA REPORTES
-- ═══════════════════════════════════════════════════════════════════════════

-- KPIs por terminal
CREATE OR REPLACE VIEW v_kpis_terminal AS
SELECT
  t.terminal_id,
  t.nombre                              AS terminal_nombre,
  t.cliente_nombre,
  t.num_cargadores,
  COUNT(DISTINCT c.id)                  AS total_casos,
  COUNT(DISTINCT c.id) FILTER (WHERE c.estado = 'Cerrado')  AS casos_cerrados,
  COUNT(DISTINCT c.id) FILTER (WHERE c.estado = 'Abierto')  AS casos_abiertos,
  AVG(c.hh_total)                       AS hh_promedio,
  COUNT(DISTINCT m.id)                  AS total_mantenimientos,
  MAX(m.fecha_visita)                   AS ultimo_mantenimiento
FROM terminales t
LEFT JOIN casos c          ON c.terminal_id = t.terminal_id
LEFT JOIN mantenimientos m ON m.terminal_id = t.terminal_id
GROUP BY t.terminal_id, t.nombre, t.cliente_nombre, t.num_cargadores;

-- Casos abiertos con antigüedad
CREATE OR REPLACE VIEW v_casos_abiertos AS
SELECT
  id, ticket, cliente_nombre, terminal_nombre,
  tipo_falla, urgencia, tecnico_nombre,
  fecha_apertura,
  NOW()::DATE - fecha_apertura           AS dias_abierto,
  token_caso,
  created_at
FROM casos
WHERE estado = 'Abierto'
ORDER BY fecha_apertura ASC;
