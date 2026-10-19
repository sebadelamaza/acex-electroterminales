// netlify/functions/guardar-mantencion.js
// ─────────────────────────────────────────────────────────────────────────
// Guarda un registro de mantención preventiva en Supabase (tabla: mantenimientos).
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'JSON inválido' }) }; }

  const {
    ticket,
    terminal,
    terminalId,
    cliente,
    clienteId,
    fecha,
    tecnico,
    cargadoresJson,
    observacionesGen,
    tieneCorrectivos,
  } = payload;

  if (!ticket || !terminal || !tecnico || !fecha) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Faltan campos requeridos: ticket, terminal, tecnico, fecha' }) };
  }

  // cargadoresJson puede llegar como string o como objeto
  let cargadoresObj;
  try {
    cargadoresObj = typeof cargadoresJson === 'string' ? JSON.parse(cargadoresJson) : cargadoresJson;
  } catch { cargadoresObj = []; }

  const row = {
    ticket,
    terminal,
    terminal_id:       terminalId   || null,
    cliente:           cliente      || null,
    cliente_id:        clienteId    || null,
    fecha_visita:      fecha,
    tecnico,
    cargadores_json:   cargadoresObj || [],
    observaciones:     observacionesGen || null,
    tiene_correctivos: tieneCorrectivos === true,
    estado:            'Registrado',
  };

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from('mantenimientos')
      .insert(row)
      .select('id, ticket')
      .single();

    if (error) {
      console.error('Supabase error guardar-mantencion:', error);
      return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: error.message }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, recordId: data.id, ticket: data.ticket }),
    };

  } catch (err) {
    console.error('Error guardar-mantencion:', err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: err.message }) };
  }
};
