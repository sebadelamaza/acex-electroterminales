// functions/api/listar-casos.js — Cloudflare Pages Function
// Devuelve casos desde Supabase para el dashboard supervisor.
// Protegido por PIN (DASHBOARD_PIN env var, default "acex2024").
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY, DASHBOARD_PIN

import { createClient } from '@supabase/supabase-js';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: HEADERS });
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: HEADERS });
  }

  const SUPABASE_URL  = env.SUPABASE_URL;
  const SUPABASE_KEY  = env.SUPABASE_SERVICE_KEY;
  const DASHBOARD_PIN = env.DASHBOARD_PIN || 'acex2024';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }), { status: 500, headers: HEADERS });
  }

  const url    = new URL(request.url);
  const pin    = url.searchParams.get('pin');
  const estado = url.searchParams.get('estado');
  const cliente = url.searchParams.get('cliente');
  const desde  = url.searchParams.get('desde');
  const hasta  = url.searchParams.get('hasta');

  if (!pin || pin !== DASHBOARD_PIN) {
    return new Response(JSON.stringify({ error: 'PIN incorrecto' }), { status: 401, headers: HEADERS });
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
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
    }

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

    return new Response(JSON.stringify({ ok: true, total: casos.length, casos }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('Error listar-casos:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}
