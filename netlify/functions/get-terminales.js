// netlify/functions/get-terminales.js
// ─────────────────────────────────────────────────────────────────────────
// Devuelve terminales activos desde Supabase para poblar dropdowns.
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY
// ─────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
    // Cache 5 minutos en CDN
    'Cache-Control': 'public, max-age=300, s-maxage=300',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }) };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: rows, error } = await supabase
      .from('terminales')
      .select('id, terminal_id, nombre, cliente_id, cliente_nombre, direccion, num_cargadores, estado')
      .eq('estado', 'Activo')
      .order('cliente_nombre', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Supabase error get-terminales:', error);
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    // Transformar a formato compatible con el frontend existente
    const terminales = (rows || []).map(r => ({
      id:            r.id,
      terminalId:    r.terminal_id,
      nombre:        r.nombre,
      cliente:       r.cliente_nombre || '',
      clienteId:     r.cliente_id     || '',
      direccion:     r.direccion      || '',
      numCargadores: r.num_cargadores || 0,
      estado:        r.estado         || 'Activo',
    }));

    // Agrupar por cliente para los <optgroup>
    const byClienteMap = {};
    terminales.forEach(t => {
      const key = t.clienteId || t.cliente;
      if (!byClienteMap[key]) {
        byClienteMap[key] = { clienteId: t.clienteId, clienteNombre: t.cliente, terminales: [] };
      }
      byClienteMap[key].terminales.push(t);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        total: terminales.length,
        terminales,
        byCliente: Object.values(byClienteMap),
      }),
    };

  } catch (err) {
    console.error('Error get-terminales:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
