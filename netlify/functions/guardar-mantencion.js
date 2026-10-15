// netlify/functions/guardar-mantencion.js
// ─────────────────────────────────────────────────────────────────────────────
// Guarda un registro de mantención preventiva en Airtable.
//
// Variables de entorno requeridas (ya configuradas en Netlify):
//   AIRTABLE_TOKEN  → token de Airtable (Personal Access Token)
//
// Tabla requerida en Airtable (base appmEbDwIFMLp0W3I):
//   "Mantenimientos" con los siguientes campos:
//     - Ticket            (Single line text)
//     - Terminal          (Single line text)
//     - Terminal_ID       (Single line text)
//     - Cliente           (Single line text)
//     - Cliente_ID        (Single line text)
//     - Fecha_Visita      (Date)
//     - Tecnico           (Single line text)
//     - Cargadores_JSON   (Long text)
//     - Observaciones     (Long text)
//     - Tiene_Correctivos (Checkbox)
//     - Estado            (Single select: Registrado / Revisado)
// ─────────────────────────────────────────────────────────────────────────────

const AIRTABLE_BASE = 'appmEbDwIFMLp0W3I';
const AIRTABLE_TABLE = 'Mantenimientos';

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  if (!AIRTABLE_TOKEN) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: 'AIRTABLE_TOKEN no configurado' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'JSON inválido' }) }; }

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

  const fields = {
    'Ticket':            ticket,
    'Terminal':          terminal,
    'Terminal_ID':       terminalId || '',
    'Cliente':           cliente || '',
    'Cliente_ID':        clienteId || '',
    'Fecha_Visita':      fecha,
    'Tecnico':           tecnico,
    'Cargadores_JSON':   cargadoresJson || '[]',
    'Observaciones':     observacionesGen || '',
    'Tiene_Correctivos': tieneCorrectivos === true,
    'Estado':            'Registrado',
  };

  try {
    const resp = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Airtable error:', data);
      return { statusCode: resp.status, headers: corsHeaders(), body: JSON.stringify({ error: data.error?.message || 'Error de Airtable' }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, recordId: data.id, ticket }),
    };

  } catch(err) {
    console.error('Error de red:', err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: err.message }) };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };
}
