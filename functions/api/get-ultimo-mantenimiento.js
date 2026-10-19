// functions/api/get-ultimo-mantenimiento.js — Cloudflare Pages Function
// Devuelve la fecha del último mantenimiento preventivo de un terminal.
// Query param: terminalId
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
  'Cache-Control':                'public, max-age=300, s-maxage=300',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: HEADERS });
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }), { status: 500, headers: HEADERS });
  }

  const url = new URL(request.url);
  const terminalId = url.searchParams.get('terminalId');
  if (!terminalId) {
    return new Response(JSON.stringify({ error: 'Falta parámetro terminalId' }), { status: 400, headers: HEADERS });
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
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
    }

    const ultimo = rows && rows.length > 0 ? rows[0] : null;

    let cargadoresData = null;
    if (ultimo?.cargadores_json) {
      try {
        const parsed = typeof ultimo.cargadores_json === 'string'
          ? JSON.parse(ultimo.cargadores_json)
          : ultimo.cargadores_json;
        cargadoresData = (Array.isArray(parsed) ? parsed : []).map(c => ({
          num:      c.num,
          sn:       c.sn       || '',
          marca:    c.marca    || '',
          modelo:   c.modelo   || '',
          potencia: c.potencia || '',
        }));
      } catch (_) { /* ignore parse error */ }
    }

    return new Response(JSON.stringify({
      ok: true,
      ultimoMantenimiento: ultimo ? {
        fecha:   ultimo.fecha,
        ticket:  ultimo.ticket,
        tecnico: ultimo.tecnico,
      } : null,
      cargadoresData,
    }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('Error get-ultimo-mantenimiento:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}
