// functions/api/get-terminales.js — Cloudflare Pages Function
// Devuelve terminales activos desde Supabase para poblar dropdowns.
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY (en Cloudflare dashboard)

import { createClient } from '@supabase/supabase-js';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
  'Cache-Control':                'public, max-age=300, s-maxage=300',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: HEADERS });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: HEADERS });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Variables de entorno Supabase no configuradas' }), { status: 500, headers: HEADERS });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: rows, error } = await supabase
      .from('terminales')
      .select('id, terminal_id, nombre, cliente_id, cliente_nombre, direccion, num_cargadores, estado, marca_cargador, modelo_cargador, potencia_kw, tipo_conector, protocolo, fecha_comisionamiento')
      .eq('estado', 'Activo')
      .order('cliente_nombre', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Supabase error get-terminales:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
    }

    const terminales = (rows || []).map(r => ({
      id:                   r.id,
      terminalId:           r.terminal_id,
      nombre:               r.nombre,
      cliente:              r.cliente_nombre        || '',
      clienteId:            r.cliente_id            || '',
      direccion:            r.direccion             || '',
      numCargadores:        r.num_cargadores        || 0,
      estado:               r.estado                || 'Activo',
      marcaCargador:        r.marca_cargador         || null,
      modeloCargador:       r.modelo_cargador        || null,
      potenciaKw:           r.potencia_kw            || null,
      tipoConector:         r.tipo_conector          || null,
      protocolo:            r.protocolo              || null,
      fechaComisionamiento: r.fecha_comisionamiento  || null,
    }));

    const byClienteMap = {};
    terminales.forEach(t => {
      const key = t.clienteId || t.cliente;
      if (!byClienteMap[key]) {
        byClienteMap[key] = { clienteId: t.clienteId, clienteNombre: t.cliente, terminales: [] };
      }
      byClienteMap[key].terminales.push(t);
    });

    return new Response(JSON.stringify({
      ok: true,
      total: terminales.length,
      terminales,
      byCliente: Object.values(byClienteMap),
    }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('Error get-terminales:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}
