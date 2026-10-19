// netlify/functions/obtener-caso.js
// ─────────────────────────────────────────────────────────────────────────
// Recibe ticket + token, busca el caso en Supabase y lo devuelve.
// Solo devuelve el caso si el token coincide — seguridad para contratistas.
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

// Devuelve los campos en formato compatible con el frontend (nombres Airtable)
function toAirtableFields(r) {
  return {
    'Ticket':              r.ticket,
    'Estado':              r.estado,
    'Cliente nombre':      r.cliente_nombre,
    'Cliente_ID':          r.cliente_id,
    'Terminal nombre':     r.terminal_nombre,
    'Terminal_ID':         r.terminal_id,
    'Tipo falla':          r.tipo_falla,
    'Descripcion falla':   r.descripcion_falla,
    'Urgencia':            r.urgencia,
    'Garantia':            r.garantia,
    'Tecnico nombre':      r.tecnico_nombre,
    'Contratista nombre':  r.contratista_nombre,
    'Supervisor':          r.supervisor,
    'Fecha apertura':      r.fecha_apertura,
    'Hora apertura':       r.hora_apertura,
    'Fecha cierre':        r.fecha_cierre,
    'HH total':            r.hh_total,
    'Resultado garantia':  r.resultado_garantia,
    'Token caso':          r.token_caso,
    'Observaciones':       r.observaciones,
    ...(r.campos_extra || {}),  // campos adicionales guardados dinámicamente
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }) };
  }

  const { ticket, token } = event.queryStringParameters || {};
  if (!ticket || !token) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Faltan parámetros ticket o token' }) };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: rows, error } = await supabase
      .from('casos')
      .select('*')
      .eq('ticket', ticket)
      .limit(1);

    if (error) {
      console.error('Supabase error obtener-caso:', error);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    }

    if (!rows || rows.length === 0) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Caso no encontrado' }) };
    }

    const caso = rows[0];

    if (caso.token_caso !== token) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Token inválido' }) };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        id:     caso.id,      // UUID — el frontend usa este valor como "recordId" en actualizar-caso
        ticket: caso.ticket,
        fields: toAirtableFields(caso),
      }),
    };

  } catch (err) {
    console.error('Error obtener-caso:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
