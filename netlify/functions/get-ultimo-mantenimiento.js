// netlify/functions/get-ultimo-mantenimiento.js
// ─────────────────────────────────────────────────────────────────────────
// Devuelve la fecha del último mantenimiento preventivo de un terminal.
// Query param: terminalId (string, ej: "T001" o UUID de Supabase)
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
  'Cache-Control':                'public, max-age=300, s-maxage=300',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }) };
  }

  const { terminalId } = event.queryStringParameters || {};
  if (!terminalId) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Falta parámetro terminalId' }) };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: rows, error } = await supabase
      .from('mantenimientos')
      .select('fecha, ticket, tecnico, cargadores_json')
      .eq('terminal_id', terminalId)
      .order('fecha', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Supabase error get-ultimo-mantenimiento:', error);
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: error.message }) };
    }

    const ultimo = rows && rows.length > 0 ? rows[0] : null;

    // Parsear cargadores_json para devolver datos de equipos (marca, modelo, potencia, sn)
    let cargadoresData = null;
    if (ultimo?.cargadores_json) {
      try {
        const parsed = typeof ultimo.cargadores_json === 'string'
          ? JSON.parse(ultimo.cargadores_json)
          : ultimo.cargadores_json;
        // Extraer solo los campos de identidad del equipo
        cargadoresData = (Array.isArray(parsed) ? parsed : []).map(c => ({
          num:    c.num,
          sn:     c.sn     || '',
          marca:  c.marca  || '',
          modelo: c.modelo || '',
          potencia: c.potencia || '',
        }));
      } catch (_) { /* ignore parse error */ }
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        ok: true,
        ultimoMantenimiento: ultimo ? {
          fecha:   ultimo.fecha,
          ticket:  ultimo.ticket,
          tecnico: ultimo.tecnico,
        } : null,
        cargadoresData,
      }),
    };

  } catch (err) {
    console.error('Error get-ultimo-mantenimiento:', err);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
