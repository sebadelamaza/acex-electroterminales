// functions/api/guardar-caso.js — Cloudflare Pages Function
// Guarda un ticket de asistencia en Supabase (tabla: casos).
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY

import { createClient } from '@supabase/supabase-js';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const FIELD_MAP = {
  'Ticket':               'ticket',
  'Estado':               'estado',
  'Cliente nombre':       'cliente_nombre',
  'Cliente_ID':           'cliente_id',
  'Terminal nombre':      'terminal_nombre',
  'Terminal_ID':          'terminal_id',
  'Tipo falla':           'tipo_falla',
  'Descripcion falla':    'descripcion_falla',
  'Urgencia':             'urgencia',
  'Garantia':             'garantia',
  'Tecnico nombre':       'tecnico_nombre',
  'Contratista nombre':   'contratista_nombre',
  'Supervisor':           'supervisor',
  'Fecha apertura':       'fecha_apertura',
  'Hora apertura':        'hora_apertura',
  'Fecha cierre':         'fecha_cierre',
  'HH total':             'hh_total',
  'Resultado garantia':   'resultado_garantia',
  'Token caso':           'token_caso',
  'Observaciones':        'observaciones',
};

function mapFields(datos) {
  const row = {};
  const extra = {};
  for (const [key, val] of Object.entries(datos)) {
    if (FIELD_MAP[key]) {
      row[FIELD_MAP[key]] = val;
    } else {
      extra[key] = val;
    }
  }
  if (Object.keys(extra).length > 0) row.campos_extra = extra;
  return row;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: HEADERS });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: HEADERS });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }), { status: 500, headers: HEADERS });
  }

  let datos;
  try { datos = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: HEADERS }); }

  const row = mapFields(datos);
  if (!row.ticket) {
    return new Response(JSON.stringify({ error: 'Falta campo Ticket' }), { status: 400, headers: HEADERS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from('casos')
      .insert(row)
      .select('id, ticket')
      .single();

    if (error) {
      console.error('Supabase error guardar-caso:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id, ticket: data.ticket }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('Error guardar-caso:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}
