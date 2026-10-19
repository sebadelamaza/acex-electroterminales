// functions/api/obtener-caso.js — Cloudflare Pages Function
// Recibe ticket + token, busca el caso en Supabase y lo devuelve.
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

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
    ...(r.campos_extra || {}),
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: HEADERS });
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: HEADERS });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }), { status: 500, headers: HEADERS });
  }

  const url = new URL(request.url);
  const ticket = url.searchParams.get('ticket');
  const token  = url.searchParams.get('token');

  if (!ticket || !token) {
    return new Response(JSON.stringify({ error: 'Faltan parámetros ticket o token' }), { status: 400, headers: HEADERS });
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
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
    }

    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Caso no encontrado' }), { status: 404, headers: HEADERS });
    }

    const caso = rows[0];
    if (caso.token_caso !== token) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 403, headers: HEADERS });
    }

    return new Response(JSON.stringify({
      id:     caso.id,
      ticket: caso.ticket,
      fields: toAirtableFields(caso),
    }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('Error obtener-caso:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}
