// functions/api/actualizar-caso.js — Cloudflare Pages Function
// Actualiza un caso en Supabase. Verifica el token antes de modificar.
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

function mapCampos(campos) {
  const updates = {};
  const extra   = {};
  for (const [key, val] of Object.entries(campos)) {
    if (FIELD_MAP[key]) {
      updates[FIELD_MAP[key]] = val;
    } else {
      extra[key] = val;
    }
  }
  return { updates, extra };
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

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: HEADERS }); }

  const { recordId, token, campos } = body;
  if (!recordId || !token || !campos) {
    return new Response(JSON.stringify({ error: 'Faltan parámetros: recordId, token, campos' }), { status: 400, headers: HEADERS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: rows, error: getError } = await supabase
      .from('casos')
      .select('id, token_caso, campos_extra')
      .eq('id', recordId)
      .limit(1);

    if (getError) {
      return new Response(JSON.stringify({ error: getError.message }), { status: 500, headers: HEADERS });
    }
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Registro no encontrado' }), { status: 404, headers: HEADERS });
    }

    const caso = rows[0];
    if (caso.token_caso !== token) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 403, headers: HEADERS });
    }

    const { updates, extra } = mapCampos(campos);
    if (Object.keys(extra).length > 0) {
      updates.campos_extra = { ...(caso.campos_extra || {}), ...extra };
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ ok: true, noop: true }), { status: 200, headers: HEADERS });
    }

    const { error: updateError } = await supabase
      .from('casos')
      .update(updates)
      .eq('id', recordId);

    if (updateError) {
      console.error('Supabase error actualizar-caso:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: HEADERS });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('Error actualizar-caso:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}
