// functions/api/get-next-ticket.js — Cloudflare Pages Function
// Devuelve el próximo número de secuencia para un ticket del día.
// Query params: fecha (YYYYMMDD), clienteId
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: HEADERS });

  const url    = new URL(request.url);
  const fecha  = url.searchParams.get('fecha');
  const cid    = url.searchParams.get('clienteId');

  if (!fecha || !cid) {
    return new Response(JSON.stringify({ error: 'Faltan parámetros: fecha, clienteId' }), { status: 400, headers: HEADERS });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ seq: 1 }), { status: 200, headers: HEADERS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const prefix   = `TKT-${fecha}-${cid}-`;

    const { count, error } = await supabase
      .from('casos')
      .select('id', { count: 'exact', head: true })
      .like('ticket', `${prefix}%`);

    if (error) {
      console.error('get-next-ticket error:', error);
      return new Response(JSON.stringify({ seq: 1 }), { status: 200, headers: HEADERS });
    }

    return new Response(JSON.stringify({ seq: (count || 0) + 1 }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('get-next-ticket catch:', err);
    return new Response(JSON.stringify({ seq: 1 }), { status: 200, headers: HEADERS });
  }
}
