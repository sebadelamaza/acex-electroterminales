// netlify/functions/get-terminales.js
// Retorna la lista de terminales activos desde Airtable para poblar dropdowns dinámicos

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    // Cache 5 minutos en CDN para no saturar Airtable
    'Cache-Control': 'public, max-age=300, s-maxage=300',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Token de Airtable no configurado' }) };
  }

  const BASE_ID = 'appmEbDwIFMLp0W3I';
  const TABLE   = 'Terminales';

  // Campos que necesitamos para los dropdowns
  const fields = ['Terminal_ID', 'Nombre', 'Cliente', 'Cliente_ID', 'Direccion', 'Num_Cargadores', 'Estado'];
  const fieldsParam = fields.map(f => `fields%5B%5D=${encodeURIComponent(f)}`).join('&');

  // Solo traemos terminales Activos, ordenados por cliente y nombre
  const filterFormula = encodeURIComponent("Estado='Activo'");
  const sortParam = 'sort%5B0%5D%5Bfield%5D=Cliente&sort%5B0%5D%5Bdirection%5D=asc&sort%5B1%5D%5Bfield%5D=Nombre&sort%5B1%5D%5Bdirection%5D=asc';

  let allRecords = [];
  let offset = '';

  try {
    // Paginación: Airtable devuelve máx 100 por página
    do {
      const offsetParam = offset ? `&offset=${offset}` : '';
      const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE}?${fieldsParam}&filterByFormula=${filterFormula}&${sortParam}${offsetParam}`;

      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error('Error Airtable get-terminales:', errBody);
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: 'Error consultando Airtable', detail: errBody }),
        };
      }

      const data = await resp.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || '';
    } while (offset);

  } catch (err) {
    console.error('Error fetch get-terminales:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }

  // Transformar registros a formato útil para los dropdowns
  const terminales = allRecords.map(r => ({
    id:           r.id,
    terminalId:   r.fields['Terminal_ID']    || '',
    nombre:       r.fields['Nombre']         || '',
    cliente:      r.fields['Cliente']        || '',
    clienteId:    r.fields['Cliente_ID']     || '',
    direccion:    r.fields['Direccion']      || '',
    numCargadores: r.fields['Num_Cargadores'] || 0,
    estado:       r.fields['Estado']         || 'Activo',
  }));

  // Agrupar por cliente para los <optgroup> de los selects
  const byCliente = {};
  terminales.forEach(t => {
    const key = t.clienteId || t.cliente;
    if (!byCliente[key]) {
      byCliente[key] = { clienteId: t.clienteId, clienteNombre: t.cliente, terminales: [] };
    }
    byCliente[key].terminales.push(t);
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      total: terminales.length,
      terminales,                         // lista plana
      byCliente: Object.values(byCliente), // agrupado por cliente
    }),
  };
};
