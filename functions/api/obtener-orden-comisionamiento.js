// functions/api/obtener-orden-comisionamiento.js — Cloudflare Pages Function
// Devuelve los datos de una orden de comisionamiento por token.

import { createClient } from '@supabase/supabase-js';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: HEADERS });

  const url   = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Falta parámetro: token' }), { status: 400, headers: HEADERS });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('comisionamientos')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'Orden no encontrada' }), { status: 404, headers: HEADERS });
  }

  return new Response(JSON.stringify({ ok: true, orden: data }), { status: 200, headers: HEADERS });
}
