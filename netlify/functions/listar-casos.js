// netlify/functions/listar-casos.js
// ─────────────────────────────────────────────────────────────────────────
// Devuelve casos desde Supabase para el dashboard supervisor.
// Protegido por PIN (DASHBOARD_PIN, default "acex2024").
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const SUPABASE_URL  = process.env.SUPABASE_URL;
  const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
  const DASHBOARD_PIN = process.env.DASHBOARD_PIN || 'acex2024';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }) };
  }

  const { pin, estado, cliente, desde, hasta } = event.queryStringParameters || {};

  if (!pin || pin !== DASHBOARD_PIN) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'PIN incorrecto' }) };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    let query = supabase
      .from('casos')
      .select('id, ticket, estado, cliente_nombre, terminal_nombre, tipo_falla, urgencia, garantia, resultado_garantia, tecnico_nombre, contratista_nombre, fecha_apertura, fecha_cierre, hh_total, token_caso')
      .order('fecha_apertura', { ascending: false })
      .limit(200);

    if (estado && estado !== 'todos') query = query.eq('estado', estado);
    if (cliente) query = query.ilike('cliente_nombre', `%${cliente}%`);
    if (desde)   query = query.gte('fecha_apertura', desde);
    if (hasta)   query = query.lte('fecha_apertura', hasta);

    const { data: rows, error } = await query;

    if (error) {
      console.error('Supabase error listar-casos:', error);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    }

    // Formato compatible con el frontend existente (mismos nombres de campo)
    const casos = (rows || []).map(r => ({
      id:        r.id,
      ticket:    r.ticket,
      estado:    r.estado,
      cliente:   r.cliente_nombre,
      terminal:  r.terminal_nombre,
      falla:     r.tipo_falla,
      urgencia:  r.urgencia,
      garantia:  r.resultado_garantia,
      tecnico:   r.tecnico_nombre || r.contratista_nombre,
      apertura:  r.fecha_apertura,
      cierre:    r.fecha_cierre,
      hhTotal:   r.hh_total,
      tokenCaso: r.token_caso,
    }));

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: true, total: casos.length, casos }),
    };

  } catch (err) {
    console.error('Error listar-casos:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
