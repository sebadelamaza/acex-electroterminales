// netlify/functions/guardar-comisionamiento.js
// Guarda un comisionamiento: crea registro en Terminales + Comisionamientos

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Token de Airtable no configurado' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const {
    ticket, clienteId, clienteNombre,
    terminalNombre, terminalDireccion,
    numCargadores, modeloCargador,
    potenciaKw, protocolo, certElectrico,
    tecnico, fecha, obsGenerales,
    cargadoresJson,
    firmaNombre, firmaRut, firmaCargo, firmaImg,
  } = body;

  // Validaciones mínimas
  if (!ticket || !clienteNombre || !terminalNombre || !tecnico || !fecha) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan campos obligatorios' }) };
  }

  const BASE_ID = 'appmEbDwIFMLp0W3I';
  const AT_BASE = `https://api.airtable.com/v0/${BASE_ID}`;
  const AT_HEADERS = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // ── 1. Crear registro en tabla Terminales ──
  let terminalRecordId;
  try {
    const terminalPayload = {
      fields: {
        Terminal_ID:            ticket,           // usamos el ticket como ID único del terminal
        Nombre:                 terminalNombre,
        Cliente:                clienteNombre,
        Cliente_ID:             clienteId || '',
        Direccion:              terminalDireccion || '',
        Num_Cargadores:         numCargadores ? Number(numCargadores) : null,
        Modelo_Cargador:        modeloCargador || '',
        Potencia_kW:            potenciaKw || '',
        Protocolo:              protocolo || 'OCPP 1.6',
        Cert_Electrico:         certElectrico || '',
        Fecha_Comisionamiento:  fecha,
        Estado:                 'Activo',
      },
    };

    const terminalResp = await fetch(`${AT_BASE}/Terminales`, {
      method: 'POST',
      headers: AT_HEADERS,
      body: JSON.stringify(terminalPayload),
    });

    if (!terminalResp.ok) {
      const errBody = await terminalResp.text();
      console.error('Error Airtable Terminales:', errBody);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Error al crear terminal en Airtable', detail: errBody }),
      };
    }

    const terminalData = await terminalResp.json();
    terminalRecordId = terminalData.id;

  } catch (err) {
    console.error('Error creando terminal:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }

  // ── 2. Crear registro en tabla Comisionamientos ──
  let comisionRecordId;
  try {
    const comisionPayload = {
      fields: {
        Ticket:           ticket,
        Terminal_ID:      ticket,
        Terminal_Nombre:  terminalNombre,
        Cliente:          clienteNombre,
        Cliente_ID:       clienteId || '',
        Tecnico:          tecnico,
        Fecha:            fecha,
        Cargadores_JSON:  cargadoresJson || '[]',
        Firma_Nombre:     firmaNombre || '',
        Firma_RUT:        firmaRut || '',
        Firma_Cargo:      firmaCargo || '',
        Firma_IMG:        firmaImg || '',     // base64 data URL de la firma canvas
        Observaciones:    obsGenerales || '',
        Estado:           'Entregado',
      },
    };

    const comisionResp = await fetch(`${AT_BASE}/Comisionamientos`, {
      method: 'POST',
      headers: AT_HEADERS,
      body: JSON.stringify(comisionPayload),
    });

    if (!comisionResp.ok) {
      const errBody = await comisionResp.text();
      console.error('Error Airtable Comisionamientos:', errBody);
      // El terminal ya fue creado; retornamos éxito parcial con advertencia
      return {
        statusCode: 207,
        headers,
        body: JSON.stringify({
          ok: true,
          partial: true,
          terminalRecordId,
          ticket,
          warning: 'Terminal creado pero error al guardar comisionamiento: ' + errBody,
        }),
      };
    }

    const comisionData = await comisionResp.json();
    comisionRecordId = comisionData.id;

  } catch (err) {
    console.error('Error creando comisionamiento:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      ticket,
      terminalRecordId,
      comisionRecordId,
    }),
  };
};
