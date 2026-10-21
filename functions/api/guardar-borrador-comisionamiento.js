// functions/api/guardar-borrador-comisionamiento.js — Cloudflare Pages Function
// Guarda el progreso parcial de una orden de comisionamiento (puede llamarse múltiples veces).
// Body: { token, datosBorrador: {...} }

import { createClient } from '@supabase/supabase-js';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: HEADERS });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: HEADERS });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: HEADERS }); }

  const { token, datosBorrador } = body;
  if (!token) {
    return new Response(JSON.stringify({ error: 'Falta token' }), { status: 400, headers: HEADERS });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { error } = await supabase
    .from('comisionamientos')
    .update({ datos_borrador: datosBorrador, estado: 'En progreso' })
    .eq('token', token);

  if (error) {
    console.error('guardar-borrador-comisionamiento error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });
}
