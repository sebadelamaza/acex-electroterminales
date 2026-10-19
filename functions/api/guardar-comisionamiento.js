// functions/api/guardar-comisionamiento.js — Cloudflare Pages Function
// Guarda un comisionamiento: crea registro en terminales + comisionamientos.
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }), { status: 500, headers: HEADERS });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: HEADERS }); }

  const {
    ticket, clienteId, clienteNombre,
    terminalNombre, terminalDireccion,
    numCargadores, marcaCargador, modeloCargador,
    potenciaKw, tipoConector, protocolo, certElectrico,
    tecnico, fecha, obsGenerales,
    cargadoresJson,
    firmaNombre, firmaRut, firmaCargo, firmaImg,
  } = body;

  if (!ticket || !clienteNombre || !terminalNombre || !tecnico || !fecha) {
    return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), { status: 400, headers: HEADERS });
  }

  let cargadoresObj;
  try {
    cargadoresObj = typeof cargadoresJson === 'string' ? JSON.parse(cargadoresJson) : cargadoresJson;
  } catch { cargadoresObj = []; }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── 1. Crear registro en terminales ──────────────────────────────────────
  const terminalRow = {
    terminal_id:            ticket,
    nombre:                 terminalNombre,
    cliente_id:             clienteId   || null,
    cliente_nombre:         clienteNombre,
    direccion:              terminalDireccion || null,
    num_cargadores:         numCargadores ? Number(numCargadores) : null,
    marca_cargador:         marcaCargador   || null,
    modelo_cargador:        modeloCargador  || null,
    potencia_kw:            potenciaKw      || null,
    tipo_conector:          tipoConector    || null,
    protocolo:              protocolo       || 'OCPP 1.6',
    cert_electrico:         certElectrico   || null,
    fecha_comisionamiento:  fecha,
    estado:                 'Activo',
  };

  const { data: termData, error: termError } = await supabase
    .from('terminales')
    .insert(terminalRow)
    .select('id, terminal_id')
    .single();

  if (termError) {
    console.error('Supabase error terminales:', termError);
    return new Response(JSON.stringify({ error: 'Error al crear terminal', detail: termError.message }), { status: 502, headers: HEADERS });
  }

  // ── 2. Crear registro en comisionamientos ────────────────────────────────
  const comisionRow = {
    ticket,
    terminal_id:     ticket,
    terminal_nombre: terminalNombre,
    cliente_id:      clienteId    || null,
    cliente_nombre:  clienteNombre,
    tecnico,
    fecha,
    cargadores_json: cargadoresObj || [],
    firma_nombre:    firmaNombre   || null,
    firma_rut:       firmaRut      || null,
    firma_cargo:     firmaCargo    || null,
    firma_img:       firmaImg      || null,
    observaciones:   obsGenerales  || null,
    estado:          'Entregado',
  };

  const { data: comData, error: comError } = await supabase
    .from('comisionamientos')
    .insert(comisionRow)
    .select('id, ticket')
    .single();

  if (comError) {
    console.error('Supabase error comisionamientos:', comError);
    return new Response(JSON.stringify({
      ok: true,
      partial: true,
      terminalId: termData.id,
      ticket,
      warning: 'Terminal creado pero error al guardar comisionamiento: ' + comError.message,
    }), { status: 207, headers: HEADERS });
  }

  return new Response(JSON.stringify({
    ok: true,
    ticket,
    terminalId: termData.id,
    comisionId: comData.id,
  }), { status: 200, headers: HEADERS });
}
