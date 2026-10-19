// netlify/functions/guardar-caso.js
// ─────────────────────────────────────────────────────────────────────────
// Guarda un ticket de asistencia en Supabase (tabla: casos).
// SUPABASE_URL y SUPABASE_SERVICE_KEY viven como variables de entorno en
// Netlify — NUNCA se hardcodean en este archivo.
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

// Mapeo: nombres de campo del frontend (Airtable-style) → columnas Supabase
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

function mapFields(datos) {
  const row = {};
  const extra = {};
  for (const [key, val] of Object.entries(datos)) {
    if (FIELD_MAP[key]) {
      row[FIELD_MAP[key]] = val;
    } else {
      extra[key] = val;
    }
  }
  if (Object.keys(extra).length > 0) row.campos_extra = extra;
  return row;
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }) };
  }

  let datos;
  try { datos = JSON.parse(event.body); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) }; }

  const row = mapFields(datos);

  if (!row.ticket) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta campo Ticket' }) };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from('casos')
      .insert(row)
      .select('id, ticket')
      .single();

    if (error) {
      console.error('Supabase error guardar-caso:', error);
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, id: data.id, ticket: data.ticket }),
    };

  } catch (err) {
    console.error('Error guardar-caso:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
