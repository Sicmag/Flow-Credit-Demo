// ============================================================
// FlowBank - App Principal (SPA) - Parte 1/2
// ============================================================

let usuarioActual = null;
let datosPersonales = null;
let streamCamara = null;

// ============ UTILIDADES ============

function formatearDinero(valor) {
  const numero = Math.round(Number(valor) || 0);
  return '$' + numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatearFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatearFechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO');
}

function mostrarAlerta(msg, tipo) {
  return '<div class="alert alert-' + tipo + '">' + msg + '</div>';
}

async function crearNotificacion(userId, titulo, mensaje, tipo) {
  try {
    await supabaseClient.from('notificaciones').insert({
      user_id: userId,
      titulo: titulo,
      mensaje: mensaje,
      tipo: tipo || 'info',
    });
  } catch (e) {
    console.error('Error creando notificacion:', e);
  }
}

// ============ INICIALIZACION ============

document.addEventListener('DOMContentLoaded', async function () {
  const session = await verificarSesion();
  if (!session) return;

  usuarioActual = session.user;
  datosPersonales = await obtenerDatosUsuario();

  await cargarSidebar();

  document.querySelectorAll('.sidebar-link[data-page]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navegarA(btn.getAttribute('data-page'));
    });
  });

  const toggle = document.getElementById('menuMobileToggle');
  const sidebar = document.getElementById('appSidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }

  navegarA('dashboard');
});

// ============ NAVEGACION ============

async function navegarA(page) {
  document.querySelectorAll('.sidebar-link').forEach(function (b) { b.classList.remove('active'); });
  const btnActivo = document.querySelector('.sidebar-link[data-page="' + page + '"]');
  if (btnActivo) btnActivo.classList.add('active');

  const sidebar = document.getElementById('appSidebar');
  if (sidebar) sidebar.classList.remove('open');

  const titulos = {
    dashboard: ['Dashboard', 'Vista general de tu banco digital'],
    flowpay: ['FlowPay', 'Transferencias digitales instantaneas'],
    flowcard: ['FlowCard', 'Tu tarjeta digital FlowBank'],
    flowsave: ['FlowSave', 'Ahorro programado para tus metas'],
    flowinvest: ['FlowInvest', 'Haz crecer tu dinero'],
    flowshield: ['FlowShield', 'Seguros digitales para emprendedores'],
    flowbusiness: ['FlowBusiness', 'Cuenta empresarial para tu negocio'],
    flowanalytics: ['FlowAnalytics', 'Analisis financiero de tu actividad'],
    creditos: ['Creditos', 'Solicita tu credito con IA'],
    verificacion: ['Verificacion', 'Verifica tu identidad'],
    notificaciones: ['Notificaciones', 'Todas las alertas de tu cuenta'],
  };

  document.getElementById('pageTitle').textContent = titulos[page][0];
  document.getElementById('pageSubtitle').textContent = titulos[page][1];

  const content = document.getElementById('pageContent');
  content.innerHTML = '<div class="loading-spinner"></div>';

  try {
    switch (page) {
      case 'dashboard': await renderDashboard(); break;
      case 'flowpay': await renderFlowPay(); break;
      case 'flowcard': if (typeof renderFlowCard === 'function') await renderFlowCard(); else content.innerHTML = '<p>Modulo en construccion</p>'; break;
      case 'flowsave': if (typeof renderFlowSave === 'function') await renderFlowSave(); else content.innerHTML = '<p>Modulo en construccion</p>'; break;
      case 'flowinvest': if (typeof renderFlowInvest === 'function') await renderFlowInvest(); else content.innerHTML = '<p>Modulo en construccion</p>'; break;
      case 'flowshield': if (typeof renderFlowShield === 'function') await renderFlowShield(); else content.innerHTML = '<p>Modulo en construccion</p>'; break;
      case 'flowbusiness': if (typeof renderFlowBusiness === 'function') await renderFlowBusiness(); else content.innerHTML = '<p>Modulo en construccion</p>'; break;
      case 'flowanalytics': if (typeof renderFlowAnalytics === 'function') await renderFlowAnalytics(); else content.innerHTML = '<p>Modulo en construccion</p>'; break;
      case 'creditos': if (typeof renderCreditos === 'function') await renderCreditos(); else content.innerHTML = '<p>Modulo en construccion</p>'; break;
      case 'verificacion': if (typeof renderVerificacion === 'function') await renderVerificacion(); else content.innerHTML = '<p>Modulo en construccion</p>'; break;
      case 'notificaciones': if (typeof renderNotificaciones === 'function') await renderNotificaciones(); else content.innerHTML = '<p>Modulo en construccion</p>'; break;
      default: content.innerHTML = '<p>Pagina no encontrada</p>';
    }
  } catch (error) {
    console.error(error);
    content.innerHTML = mostrarAlerta('Error: ' + error.message, 'error');
  }
}

async function actualizarSaldoSidebar() {
  const saldo = await obtenerSaldo();
  document.getElementById('sidebarSaldo').textContent = formatearDinero(saldo);
}

// ============ DATOS ============

async function obtenerSaldo() {
  const userId = localStorage.getItem('user_id');
  try {
    const { data } = await supabaseClient.from('cuentas').select('saldo').eq('user_id', userId).single();
    if (data) return Number(data.saldo) || 0;

    const numero = 'FC-' + userId.slice(0, 8);
    const { data: nueva } = await supabaseClient.from('cuentas').insert({
      user_id: userId, numero_cuenta: numero, saldo: 1000000
    }).select().single();
    return nueva ? Number(nueva.saldo) : 0;
  } catch (e) {
    return 0;
  }
}

async function obtenerCuenta() {
  const userId = localStorage.getItem('user_id');
  const { data } = await supabaseClient.from('cuentas').select('*').eq('user_id', userId).single();
  return data;
}

async function cargarSidebar() {
  const email = localStorage.getItem('user_email');
  let nombreCompleto = email.split('@')[0];
  if (datosPersonales && datosPersonales.nombres) {
    nombreCompleto = (datosPersonales.nombres + ' ' + (datosPersonales.apellidos || '')).trim();
  }
  document.getElementById('sidebarNombre').textContent = nombreCompleto;
  document.getElementById('sidebarEmail').textContent = email;
  const saldo = await obtenerSaldo();
  document.getElementById('sidebarSaldo').textContent = formatearDinero(saldo);
}

// ============ DASHBOARD ============

async function renderDashboard() {
  const userId = localStorage.getItem('user_id');
  const saldo = await obtenerSaldo();

  const { data: solicitudes } = await supabaseClient.from('solicitudes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  const { data: creditos } = await supabaseClient.from('creditos').select('*').eq('user_id', userId).eq('estado', 'activo');
  const { data: movimientos } = await supabaseClient.from('movimientos').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5);

  let score = 742;
  if (solicitudes && solicitudes.length > 0) {
    const aprobadas = solicitudes.filter(s => s.decision === 'APROBADO');
    if (aprobadas.length > 0) score = aprobadas[0].score;
  }

  const html = `
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-label">Saldo disponible</div><div class="metric-value">${formatearDinero(saldo)}</div></div>
      <div class="metric-card"><div class="metric-label">Score crediticio</div><div class="metric-value">${score}/1000</div></div>
      <div class="metric-card"><div class="metric-label">Creditos activos</div><div class="metric-value">${creditos ? creditos.length : 0}</div></div>
      <div class="metric-card"><div class="metric-label">Solicitudes</div><div class="metric-value">${solicitudes ? solicitudes.length : 0}</div></div>
    </div>

    <div class="app-section">
      <div class="app-section-title">Ultimos movimientos</div>
      ${movimientos && movimientos.length > 0 ? `
        <table class="app-table">
          <thead><tr><th>Fecha</th><th>Descripcion</th><th style="text-align:right;">Monto</th></tr></thead>
          <tbody>
            ${movimientos.map(m => {
              const signo = m.tipo === 'ingreso' ? '+' : '-';
              const clase = m.tipo === 'ingreso' ? 'text-green' : 'text-red';
              return `<tr><td>${formatearFecha(m.created_at)}</td><td>${m.descripcion}</td><td class="${clase}" style="text-align:right;">${signo}${formatearDinero(m.monto)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      ` : '<p style="color:#64748B;">Aun no tienes movimientos registrados.</p>'}
    </div>

    <div class="app-section">
      <div class="app-section-title">Fuentes digitales conectadas</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
        <div style="padding:16px; background:#F0FDF4; border-radius:12px; text-align:center;">
          <div style="font-size:20px; margin-bottom:4px;">💳</div>
          <div style="font-weight:700; font-size:14px;">Stripe</div>
          <div style="font-size:12px; color:#10B981; font-weight:600;">Conectado</div>
        </div>
        <div style="padding:16px; background:#F0FDF4; border-radius:12px; text-align:center;">
          <div style="font-size:20px; margin-bottom:4px;">🟣</div>
          <div style="font-weight:700; font-size:14px;">Nequi</div>
          <div style="font-size:12px; color:#10B981; font-weight:600;">Conectado</div>
        </div>
        <div style="padding:16px; background:#F0FDF4; border-radius:12px; text-align:center;">
          <div style="font-size:20px; margin-bottom:4px;">🔵</div>
          <div style="font-weight:700; font-size:14px;">PayPal</div>
          <div style="font-size:12px; color:#10B981; font-weight:600;">Conectado</div>
        </div>
        <div style="padding:16px; background:#FFFBEB; border-radius:12px; text-align:center;">
          <div style="font-size:20px; margin-bottom:4px;">🟢</div>
          <div style="font-weight:700; font-size:14px;">Daviplata</div>
          <div style="font-size:12px; color:#F59E0B; font-weight:600;">Pendiente</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('pageContent').innerHTML = html;
}

// ============ FLOWPAY ============

async function renderFlowPay() {
  const cuenta = await obtenerCuenta();
  const saldo = cuenta ? Number(cuenta.saldo) : 0;
  const userIdActual = localStorage.getItem('user_id');

  const { data: perfil } = await supabaseClient.from('profiles').select('es_admin').eq('id', userIdActual).single();
  const esAdmin = perfil?.es_admin === true;

  const { data: usuarios } = await supabaseClient.from('usuarios_registrados').select('*');
  const otros = (usuarios || []).filter(u => u.user_id !== userIdActual);

  const { data: transferencias } = await supabaseClient
    .from('transferencias')
    .select('*')
    .or('emisor_id.eq.' + userIdActual + ',receptor_id.eq.' + userIdActual)
    .order('created_at', { ascending: false })
    .limit(20);

  let codigosPendientes = [];
  if (esAdmin) {
    const { data } = await supabaseClient.from('codigos_retiro_admin').select('*').eq('estado', 'pendiente').order('created_at', { ascending: false });
    codigosPendientes = data || [];
  }

  const { data: misCodigos } = await supabaseClient.from('codigos_retiro').select('*').eq('user_id', userIdActual).order('created_at', { ascending: false });

  let html = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Numero de cuenta</div>
        <div class="metric-value" style="font-size:16px;">${cuenta ? cuenta.numero_cuenta : 'N/A'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Saldo disponible</div>
        <div class="metric-value">${formatearDinero(saldo)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Rol</div>
        <div class="metric-value" style="font-size:16px;">${esAdmin ? '👑 Administrador' : '👤 Cliente'}</div>
      </div>
    </div>

    ${esAdmin ? `
      <div class="alert alert-warning">
        <strong>👑 Panel de Administrador</strong><br>
        Tienes ${codigosPendientes.length} codigos de retiro pendientes de validar.
      </div>
    ` : ''}

    <div class="app-tabs">
      <button class="app-tab active" data-tab="enviar">Enviar</button>
      <button class="app-tab" data-tab="recargar">Recargar</button>
      <button class="app-tab" data-tab="retirar">Retirar con codigo</button>
      <button class="app-tab" data-tab="servicios">Servicios</button>
      ${esAdmin ? '<button class="app-tab" data-tab="admin-codigos">Validar codigos</button>' : ''}
      <button class="app-tab" data-tab="historial">Historial</button>
    </div>

    <div class="app-tab-content active" id="tab-enviar">
      <div class="app-section">
        <div class="app-section-title">Nueva transferencia</div>
        <div class="app-form-group">
          <label class="app-form-label">Destinatario</label>
          <select class="app-form-select" id="payReceptor">
            <option value="">Selecciona un destinatario</option>
            ${otros.map(u => `<option value="${u.email}">${u.email}</option>`).join('')}
          </select>
        </div>
        <div class="app-form-group">
          <label class="app-form-label">Monto (COP)</label>
          <input class="app-form-input" type="number" id="payMonto" min="1000" placeholder="100000">
        </div>
        <div class="app-form-group">
          <label class="app-form-label">Concepto (opcional)</label>
          <input class="app-form-input" type="text" id="payConcepto" placeholder="Sin concepto">
        </div>
        <div id="payMessage"></div>
        <button class="btn-primary btn-large" style="width:100%; justify-content:center;" onclick="enviarDinero()">Enviar dinero</button>
      </div>
    </div>

    <div class="app-tab-content" id="tab-recargar">
      <div class="app-section">
        <div class="app-section-title">Recargar saldo</div>
        <p style="color:#64748B; margin-bottom:16px;">Simula una recarga desde banco externo a tu cuenta FlowBank.</p>
        <div class="app-form-group">
          <label class="app-form-label">Monto a recargar (COP)</label>
          <input class="app-form-input" type="number" id="recargarMonto" min="10000" value="100000">
        </div>
        <div id="recargarMessage"></div>
        <button class="btn-primary btn-large" style="width:100%; justify-content:center;" onclick="recargarSaldo()">Recargar</button>
      </div>
    </div>

    <div class="app-tab-content" id="tab-retirar">
      <div class="app-section">
        <div class="app-section-title">Retirar con codigo</div>
        <p style="color:#64748B; margin-bottom:16px;">Genera un codigo para retirar efectivo en un punto autorizado.</p>
        <div class="app-form-group">
          <label class="app-form-label">Monto a retirar (COP)</label>
          <input class="app-form-input" type="number" id="retiroMonto" min="10000" value="50000">
        </div>
        <div id="retiroMessage"></div>
        <button class="btn-primary btn-large" style="width:100%; justify-content:center;" onclick="generarCodigoRetiro()">Generar codigo de retiro</button>
      </div>

      <div class="app-section">
        <div class="app-section-title">Mis codigos de retiro</div>
        ${misCodigos && misCodigos.length > 0 ? `
          <table class="app-table">
            <thead><tr><th>Codigo</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              ${misCodigos.map(c => `
                <tr>
                  <td style="font-family:monospace; font-weight:700; color:#820AD1;">${c.codigo}</td>
                  <td>${formatearDinero(c.monto)}</td>
                  <td><span class="badge ${c.estado === 'pendiente' ? 'badge-yellow' : 'badge-green'}">${c.estado}</span></td>
                  <td>${formatearFechaCorta(c.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="color:#64748B;">No has generado codigos de retiro.</p>'}
      </div>
    </div>

    <div class="app-tab-content" id="tab-servicios">
      <div class="app-section">
        <div class="app-section-title">Pagar servicios</div>
        <p style="color:#64748B; margin-bottom:16px;">Se descuenta directamente de tu saldo disponible.</p>
        <div class="app-form-group">
          <label class="app-form-label">Servicio</label>
          <select class="app-form-select" id="servicioNombre">
            <option value="Claro">Claro</option>
            <option value="Movistar">Movistar</option>
            <option value="Tigo">Tigo</option>
            <option value="EPM">EPM</option>
            <option value="Netflix">Netflix</option>
            <option value="Spotify">Spotify</option>
          </select>
        </div>
        <div class="app-form-group">
          <label class="app-form-label">Monto (COP)</label>
          <input class="app-form-input" type="number" id="servicioMonto" min="1000" value="45000">
        </div>
        <div id="servicioMessage"></div>
        <button class="btn-primary btn-large" style="width:100%; justify-content:center;" onclick="pagarServicio()">Pagar servicio</button>
      </div>
    </div>

    ${esAdmin ? `
      <div class="app-tab-content" id="tab-admin-codigos">
        <div class="app-section">
          <div class="app-section-title">👑 Codigos pendientes de validar</div>
          <p style="color:#64748B; margin-bottom:16px;">Entrega el efectivo al cliente y marca el codigo como usado.</p>
          ${codigosPendientes && codigosPendientes.length > 0 ? `
            <table class="app-table">
              <thead><tr><th>Codigo</th><th>Cliente</th><th>Monto</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                ${codigosPendientes.map(c => `
                  <tr>
                    <td style="font-family:monospace; font-weight:700; color:#820AD1;">${c.codigo}</td>
                    <td>${c.cliente_email}<br><small style="color:#64748B;">${c.cliente_nombre || ''}</small></td>
                    <td style="font-weight:700;">${formatearDinero(c.monto)}</td>
                    <td>${formatearFechaCorta(c.created_at)}</td>
                    <td><button class="btn-primary" style="font-size:12px; padding:6px 12px;" onclick="validarCodigo(${c.id}, '${c.codigo}')">✅ Validar</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color:#64748B;">No hay codigos pendientes.</p>'}
        </div>
      </div>
    ` : ''}

    <div class="app-tab-content" id="tab-historial">
      <div class="app-section">
        <div class="app-section-title">Historial de transferencias</div>
        ${transferencias && transferencias.length > 0 ? `
          <table class="app-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Contraparte</th><th style="text-align:right;">Monto</th><th></th></tr></thead>
            <tbody>
              ${transferencias.map(t => {
                const esEmisor = t.emisor_id === userIdActual;
                const signo = esEmisor ? '-' : '+';
                const clase = esEmisor ? 'text-red' : 'text-green';
                const contraparte = esEmisor ? t.receptor_email : t.emisor_email;
                return `<tr><td>${formatearFecha(t.created_at)}</td><td>${esEmisor ? '📤' : '📥'}</td><td>${contraparte}</td><td class="${clase}" style="text-align:right;">${signo}${formatearDinero(t.monto)}</td><td><button class="btn-secondary-sm" onclick="generarReciboPDF(${t.id})" style="font-size:11px; padding:4px 8px;">📄</button></td></tr>`;
              }).join('')}
            </tbody>
          </table>
        ` : '<p style="color:#64748B;">Aun no has realizado transferencias.</p>'}
      </div>
    </div>
  `;

  document.getElementById('pageContent').innerHTML = html;
  activarTabs();
}

// ============ FUNCIONES FLOWPAY ============

function activarTabs() {
  document.querySelectorAll('.app-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.app-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.getAttribute('data-tab')).classList.add('active');
    });
  });
}

async function enviarDinero() {
  const receptor = document.getElementById('payReceptor').value;
  const monto = parseFloat(document.getElementById('payMonto').value);
  const concepto = document.getElementById('payConcepto').value || 'Sin concepto';
  const msg = document.getElementById('payMessage');

  if (!receptor || !monto || monto <= 0) {
    msg.innerHTML = mostrarAlerta('Completa todos los campos', 'error');
    return;
  }

  msg.innerHTML = '<div class="alert alert-info">Procesando...</div>';

  const { data, error } = await supabaseClient.rpc('transferir_dinero', {
    p_receptor_email: receptor.toLowerCase(),
    p_monto: monto,
    p_concepto: concepto,
  });

  if (error) {
    msg.innerHTML = mostrarAlerta('Error: ' + error.message, 'error');
    return;
  }

  if (data && data.success) {
    const { data: receptorInfo } = await supabaseClient.from('usuarios_registrados').select('user_id').eq('email', receptor.toLowerCase()).single();
    if (receptorInfo) {
      await crearNotificacion(receptorInfo.user_id, '💸 Dinero recibido', 'Recibiste ' + formatearDinero(monto) + ' de ' + localStorage.getItem('user_email'), 'success');
    }
    await crearNotificacion(localStorage.getItem('user_id'), '✅ Transferencia enviada', 'Enviaste ' + formatearDinero(monto) + ' a ' + receptor, 'success');

    msg.innerHTML = mostrarAlerta('✅ Transferencia exitosa', 'success');
    await actualizarSaldoSidebar();
    setTimeout(() => navegarA('flowpay'), 1500);
  } else {
    msg.innerHTML = mostrarAlerta('❌ ' + (data ? data.message : 'Error'), 'error');
  }
}

async function recargarSaldo() {
  const monto = parseFloat(document.getElementById('recargarMonto').value);
  const msg = document.getElementById('recargarMessage');
  if (!monto || monto <= 0) {
    msg.innerHTML = mostrarAlerta('Monto invalido', 'error');
    return;
  }
  const { data } = await supabaseClient.rpc('recargar_saldo', { p_monto: monto });
  if (data && data.success) {
    await crearNotificacion(localStorage.getItem('user_id'), '💰 Recarga exitosa', 'Recargaste ' + formatearDinero(monto) + ' a tu cuenta', 'success');
    msg.innerHTML = mostrarAlerta('✅ Recarga exitosa', 'success');
    await actualizarSaldoSidebar();
    setTimeout(() => navegarA('flowpay'), 1500);
  } else {
    msg.innerHTML = mostrarAlerta('❌ ' + (data ? data.message : 'Error'), 'error');
  }
}

async function pagarServicio() {
  const servicio = document.getElementById('servicioNombre').value;
  const monto = parseFloat(document.getElementById('servicioMonto').value);
  const msg = document.getElementById('servicioMessage');
  if (!monto || monto <= 0) {
    msg.innerHTML = mostrarAlerta('Monto invalido', 'error');
    return;
  }
  const { data } = await supabaseClient.rpc('pagar_servicio', { p_servicio: servicio, p_monto: monto });
  if (data && data.success) {
    await crearNotificacion(localStorage.getItem('user_id'), '💡 Pago exitoso', 'Pagaste ' + servicio + ' por ' + formatearDinero(monto), 'success');
    msg.innerHTML = mostrarAlerta('✅ Pago exitoso', 'success');
    await actualizarSaldoSidebar();
    setTimeout(() => navegarA('flowpay'), 1500);
  } else {
    msg.innerHTML = mostrarAlerta('❌ ' + (data ? data.message : 'Error'), 'error');
  }
}

async function generarCodigoRetiro() {
  const monto = parseFloat(document.getElementById('retiroMonto').value);
  const msg = document.getElementById('retiroMessage');

  if (!monto || monto < 10000) {
    msg.innerHTML = mostrarAlerta('Monto minimo: $10.000 COP', 'error');
    return;
  }

  msg.innerHTML = '<div class="alert alert-info">Generando codigo...</div>';

  const { data } = await supabaseClient.rpc('generar_codigo_retiro', { p_monto: monto });

  if (data && data.success) {
    await crearNotificacion(localStorage.getItem('user_id'), '🎫 Codigo de retiro generado', 'Codigo: ' + data.codigo + ' por ' + formatearDinero(monto), 'info');
    msg.innerHTML = mostrarAlerta('✅ Codigo generado: <strong style="font-family:monospace;">' + data.codigo + '</strong><br>Guardalo y presentalo en un punto autorizado.', 'success');
    await actualizarSaldoSidebar();
    setTimeout(() => navegarA('flowpay'), 3000);
  } else {
    msg.innerHTML = mostrarAlerta('❌ ' + (data ? data.message : 'Error'), 'error');
  }
}

async function validarCodigo(codigoId, codigo) {
  if (!confirm('¿Confirmas que entregaste el efectivo al cliente?\n\nCodigo: ' + codigo)) {
    return;
  }

  const userId = localStorage.getItem('user_id');
  const { error } = await supabaseClient.from('codigos_retiro').update({
    estado: 'usado',
    usado_at: new Date().toISOString(),
    usado_por: userId,
  }).eq('id', codigoId);

  if (error) {
    alert('Error: ' + error.message);
    return;
  }

  await crearNotificacion(userId, '✅ Codigo validado', 'Validaste el codigo ' + codigo + ' correctamente', 'success');
  alert('✅ Codigo validado exitosamente');
  navegarA('flowpay');
}

async function generarReciboPDF(transferenciaId) {
  const { data: t } = await supabaseClient.from('transferencias').select('*').eq('id', transferenciaId).single();
  if (!t) { alert('Transferencia no encontrada'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(130, 10, 209);
  doc.text('FLOWBANK', 105, 30, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Comprobante de Transferencia', 105, 38, { align: 'center' });

  doc.setDrawColor(130, 10, 209);
  doc.setLineWidth(0.8);
  doc.line(20, 44, 190, 44);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Detalles de la operacion', 20, 60);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('Numero: #' + t.id, 20, 75);
  doc.text('Fecha: ' + formatearFecha(t.created_at), 20, 85);
  doc.text('Emisor: ' + t.emisor_email, 20, 95);
  doc.text('Receptor: ' + t.receptor_email, 20, 105);
  doc.text('Monto: ' + formatearDinero(t.monto) + ' COP', 20, 115);
  doc.text('Concepto: ' + (t.concepto || 'Sin concepto'), 20, 125);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Comprobante digital generado por FlowBank.', 105, 260, { align: 'center' });
  doc.text('Proyecto SENA 2026', 105, 266, { align: 'center' });

  doc.save('recibo_flowbank_' + t.id + '.pdf');
}

// ============ FIN PARTE 1 ============
// ⬇️ AQUI CONTINUA LA PARTE 2 ⬇️
