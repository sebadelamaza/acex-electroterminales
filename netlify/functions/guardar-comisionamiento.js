// netlify/functions/guardar-comisionamiento.js
// ─────────────────────────────────────────────────────────────────────────
// Guarda un comisionamiento: crea registro en terminales + comisionamientos.
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'JSON inválido' }) }; }

  const {
    ticket, clienteId, clienteNombre,
    terminalNombre, terminalDireccion,
    numCargadores, marcaCargador, modeloCargador,
    potenciaKw, tipoConector, protocolo, certElectrico,
    tecnico, fecha, obsGenerales,
    cargadoresJson,
    firmaNombre, firmaRut, firmaCargo, firmaImg,
  } = body;

  if (!ticket || !clienteNombre || !terminalNombre || !tecnico || !fecha) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Faltan campos obligatorios' }) };
  }

  let cargadoresObj;
  try {
    cargadoresObj = typeof cargadoresJson === 'string' ? JSON.parse(cargadoresJson) : cargadoresJson;
  } catch { cargadoresObj = []; }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── 1. Crear registro en terminales ──────────────────────────────────────
  const terminalRow = {
    terminal_id:            ticket,       // ticket CMN-YYYYMMDD-XXX como ID del terminal
    nombre:                 terminalNombre,
    cliente_id:             clienteId   || null,
    cliente_nombre:         clienteNombre,
    direccion:              terminalDireccion || null,
    num_cargadores:         numCargadores ? Number(numCargadores) : null,
    marca_cargador:         marcaCargador   || null,
    modelo_cargador:        modeloCargador  || null,
    potencia_kw:            potenciaKw      || null,
    tipo_conector:          tipoConector    || null,
    protocolo:              protocolo       || 'OCPP 1.6',
    cert_electrico:         certElectrico   || null,
    fecha_comisionamiento:  fecha,
    estado:                 'Activo',
  };

  const { data: termData, error: termError } = await supabase
    .from('terminales')
    .insert(terminalRow)
    .select('id, terminal_id')
    .single();

  if (termError) {
    console.error('Supabase error terminales:', termError);
    return {
      statusCode: 502,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Error al crear terminal', detail: termError.message }),
    };
  }

  // ── 2. Crear registro en comisionamientos ────────────────────────────────
  const comisionRow = {
    ticket,
    terminal_id:     ticket,
    terminal_nombre: terminalNombre,
    cliente_id:      clienteId    || null,
    cliente_nombre:  clienteNombre,
    tecnico,
    fecha,
    cargadores_json: cargadoresObj || [],
    firma_nombre:    firmaNombre   || null,
    firma_rut:       firmaRut      || null,
    firma_cargo:     firmaCargo    || null,
    firma_img:       firmaImg      || null,
    observaciones:   obsGenerales  || null,
    estado:          'Entregado',
  };

  const { data: comData, error: comError } = await supabase
    .from('comisionamientos')
    .insert(comisionRow)
    .select('id, ticket')
    .single();

  if (comError) {
    console.error('Supabase error comisionamientos:', comError);
    // Terminal creado; retornamos éxito parcial con advertencia
    return {
      statusCode: 207,
      headers: HEADERS,
      body: JSON.stringify({
        ok: true,
        partial: true,
        terminalId: termData.id,
        ticket,
        warning: 'Terminal creado pero error al guardar comisionamiento: ' + comError.message,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      ok: true,
      ticket,
      terminalId:   termData.id,
      comisionId:   comData.id,
    }),
  };
};
