// functions/api/guardar-mantencion.js — Cloudflare Pages Function
// Guarda el registro final de mantención.
//   - Con `token`: UPDATE sobre la orden existente (flujo técnico desde link)
//   - Sin `token`:  INSERT nuevo (flujo legado directo)
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
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: HEADERS });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }), { status: 500, headers: HEADERS });
  }

  let payload;
  try { payload = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: HEADERS }); }

  const {
    token,
    ticket, terminal, terminalId, cliente, clienteId,
    fecha, tecnico, cargadoresJson, observacionesGen, tieneCorrectivos, estado,
  } = payload;

  let cargadoresObj;
  try {
    cargadoresObj = typeof cargadoresJson === 'string' ? JSON.parse(cargadoresJson) : cargadoresJson;
  } catch { cargadoresObj = []; }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // ── FLUJO TÉCNICO: UPDATE por token ──
    if (token) {
      const updateData = {
        cargadores_json:   cargadoresObj || [],
        observaciones:     observacionesGen || null,
        tiene_correctivos: tieneCorrectivos === true,
        estado:            estado || 'Completado',
        datos_borrador:    null,             // limpiar borrador al completar
      };

      // Si se recibieron datos de terminal/cliente, actualizar también
      if (terminal)  updateData.terminal   = terminal;
      if (terminalId) updateData.terminal_id = terminalId;
      if (cliente)   updateData.cliente    = cliente;
      if (clienteId) updateData.cliente_id = clienteId;
      if (fecha)     updateData.fecha_visita = fecha;
      if (tecnico)   updateData.tecnico    = tecnico;

      const { data, error } = await supabase
        .from('mantenimientos')
        .update(updateData)
        .eq('token', token)
        .select('id, ticket')
        .single();

      if (error) {
        console.error('Supabase UPDATE error guardar-mantencion:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
      }

      return new Response(JSON.stringify({ ok: true, recordId: data.id, ticket: data.ticket }), { status: 200, headers: HEADERS });
    }

    // ── FLUJO LEGADO: INSERT nuevo ──
    if (!ticket || !terminal || !tecnico || !fecha) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos: ticket, terminal, tecnico, fecha' }), { status: 400, headers: HEADERS });
    }

    const row = {
      ticket,
      terminal,
      terminal_id:       terminalId       || null,
      cliente:           cliente          || null,
      cliente_id:        clienteId        || null,
      fecha_visita:      fecha,
      tecnico,
      cargadores_json:   cargadoresObj    || [],
      observaciones:     observacionesGen || null,
      tiene_correctivos: tieneCorrectivos === true,
      estado:            'Registrado',
    };

    const { data, error } = await supabase
      .from('mantenimientos')
      .insert(row)
      .select('id, ticket')
      .single();

    if (error) {
      console.error('Supabase INSERT error guardar-mantencion:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
    }

    return new Response(JSON.stringify({ ok: true, recordId: data.id, ticket: data.ticket }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('Error guardar-mantencion:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}
