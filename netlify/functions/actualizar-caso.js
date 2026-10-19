// netlify/functions/actualizar-caso.js
// ─────────────────────────────────────────────────────────────────────────
// Actualiza un caso en Supabase. Verifica el token antes de modificar.
// "recordId" contiene el UUID devuelto por obtener-caso.js (campo "id").
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

// Mismo mapa que guardar-caso.js: campo frontend → columna Supabase
const FIELD_MAP = {
  'Ticket':               'ticket',
  'Estado':               'estado',
  'Cliente nombre':       'cliente_nombre',
  'Cliente_ID':           'cliente_id',
  'Terminal nombre':      'terminal_nombre',
  'Terminal_ID':          'terminal_id',
  'Tipo falla':           'tipo_falla',
  'Descripcion falla':    'descripcion_falla',
  'Urgencia':             'urgencia',
  'Garantia':             'garantia',
  'Tecnico nombre':       'tecnico_nombre',
  'Contratista nombre':   'contratista_nombre',
  'Supervisor':           'supervisor',
  'Fecha apertura':       'fecha_apertura',
  'Hora apertura':        'hora_apertura',
  'Fecha cierre':         'fecha_cierre',
  'HH total':             'hh_total',
  'Resultado garantia':   'resultado_garantia',
  'Token caso':           'token_caso',
  'Observaciones':        'observaciones',
};

function mapCampos(campos) {
  const updates = {};
  const extra   = {};
  for (const [key, val] of Object.entries(campos)) {
    if (FIELD_MAP[key]) {
      updates[FIELD_MAP[key]] = val;
    } else {
      extra[key] = val;
    }
  }
  return { updates, extra };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) }; }

  const { recordId, token, campos } = body;
  if (!recordId || !token || !campos) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Faltan parámetros: recordId, token, campos' }) };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Verificar que el registro existe y el token coincide
    const { data: rows, error: getError } = await supabase
      .from('casos')
      .select('id, token_caso, campos_extra')
      .eq('id', recordId)
      .limit(1);

    if (getError) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: getError.message }) };
    }
    if (!rows || rows.length === 0) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Registro no encontrado' }) };
    }

    const caso = rows[0];
    if (caso.token_caso !== token) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Token inválido' }) };
    }

    // Mapear campos al schema Supabase
    const { updates, extra } = mapCampos(campos);

    // Fusionar campos_extra existentes con los nuevos
    if (Object.keys(extra).length > 0) {
      updates.campos_extra = { ...(caso.campos_extra || {}), ...extra };
    }

    if (Object.keys(updates).length === 0) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, noop: true }) };
    }

    const { error: updateError } = await supabase
      .from('casos')
      .update(updates)
      .eq('id', recordId);

    if (updateError) {
      console.error('Supabase error actualizar-caso:', updateError);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: updateError.message }) };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true }),
    };

  } catch (err) {
    console.error('Error actualizar-caso:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
