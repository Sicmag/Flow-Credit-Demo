// ============================================================
// FlowBank - App Principal (SPA) - Parte 1 de 2
// Utilidades, navegacion, Dashboard, FlowPay, FlowCard
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
      case 'flowcard': await renderFlowCard(); break;
      case 'flowsave': await renderFlowSave(); break;
      case 'flowinvest': await renderFlowInvest(); break;
      case 'flowshield': await renderFlowShield(); break;
      case 'flowbusiness': await renderFlowBusiness(); break;
      case 'flowanalytics': await renderFlowAnalytics(); break;
      case 'creditos': await renderCreditos(); break;
      case 'verificacion': await renderVerificacion(); break;
      case 'notificaciones': await renderNotificaciones(); break;
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

  const { data: solicitudes } = await supabaseClient
    .from('solicitudes').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data: creditos } = await supabaseClient
    .from('creditos').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data: movimientos } = await supabaseClient
    .from('movimientos').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(200);

  const { data: tarjeta } = await supabaseClient
    .from('tarjetas').select('*').eq('user_id', userId).maybeSingle();

  const { data: notifs } = await supabaseClient
    .from('notificaciones').select('*').eq('user_id', userId)
    .eq('leida', false).order('created_at', { ascending: false }).limit(1);

  let score = 742;
  if (solicitudes && solicitudes.length > 0) {
    const aprobadas = solicitudes.filter(s => s.decision === 'APROBADO');
    if (aprobadas.length > 0) score = aprobadas[0].score;
  }

  const creditosActivos = (creditos || []).filter(c => c.estado === 'activo');
  const creditosCount = creditosActivos.length;

  let proximaCuota = null;
  if (creditosActivos.length > 0) {
    const { data: cuotas } = await supabaseClient
      .from('cuotas').select('*')
      .in('credito_id', creditosActivos.map(c => c.id))
      .eq('estado', 'pendiente')
      .order('fecha_vencimiento', { ascending: true })
      .limit(1);
    if (cuotas && cuotas.length > 0) proximaCuota = cuotas[0];
  }

  const ultimaNotif = notifs && notifs.length > 0 ? notifs[0] : null;

  const html = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Saldo disponible</div>
        <div class="metric-value">${formatearDinero(saldo)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Score crediticio</div>
        <div class="metric-value">${score}/1000</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Creditos activos</div>
        <div class="metric-value">${creditosCount}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Solicitudes</div>
        <div class="metric-value">${solicitudes ? solicitudes.length : 0}</div>
      </div>
    </div>

    <div class="quick-actions">
      <button class="quick-action" onclick="navegarA('flowpay')">
        <div class="quick-action-icon">💸</div>
        <div class="quick-action-label">Enviar</div>
      </button>
      <button class="quick-action" onclick="navegarA('flowpay')">
        <div class="quick-action-icon">📥</div>
        <div class="quick-action-label">Recargar</div>
      </button>
      <button class="quick-action" onclick="navegarA('creditos')">
        <div class="quick-action-icon">💳</div>
        <div class="quick-action-label">Credito</div>
      </button>
      <button class="quick-action" onclick="navegarA('flowcard')">
        <div class="quick-action-icon">🎴</div>
        <div class="quick-action-label">Tarjeta</div>
      </button>
    </div>

    ${ultimaNotif ? `
      <div class="alert alert-info" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div>
          <strong>${ultimaNotif.titulo}</strong>
          <div style="font-size:13px; margin-top:2px;">${ultimaNotif.mensaje}</div>
        </div>
        <button class="btn-secondary-sm" onclick="navegarA('notificaciones')">Ver</button>
      </div>
    ` : ''}

    <div class="dashboard-grid-2">
      <div class="app-section" style="margin:0;">
        <div class="app-section-title">Estado de tu tarjeta</div>
        ${tarjeta ? `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-family:monospace; font-size:14px; color:#64748B;">•••• ${String(tarjeta.numero).slice(-4)}</span>
            <span class="badge ${tarjeta.estado === 'activa' ? 'badge-green' : 'badge-red'}">${tarjeta.estado === 'activa' ? '🟢 Activa' : '🔒 Congelada'}</span>
          </div>
          <div style="font-size:12px; color:#64748B; margin-bottom:4px;">Cupo disponible</div>
          <div style="font-size:22px; font-weight:800; color:#820AD1;">${formatearDinero(tarjeta.cupo_disponible)}</div>
          <button class="btn-secondary-sm" style="margin-top:12px;" onclick="navegarA('flowcard')">Ver tarjeta</button>
        ` : `
          <p style="color:#64748B; margin-bottom:12px;">Aun no tienes tarjeta activa.</p>
          <button class="btn-primary" style="font-size:14px; padding:10px 20px;" onclick="navegarA('flowcard')">Crear tarjeta</button>
        `}
      </div>

      <div class="app-section" style="margin:0;">
        <div class="app-section-title">Proxima cuota</div>
        ${proximaCuota ? `
          <div style="font-size:12px; color:#64748B; margin-bottom:4px;">Vence el ${formatearFechaCorta(proximaCuota.fecha_vencimiento)}</div>
          <div style="font-size:22px; font-weight:800; color:#0F0F1E;">${formatearDinero(proximaCuota.valor)}</div>
          <div style="font-size:13px; color:#64748B; margin-top:6px;">Cuota #${proximaCuota.numero}</div>
          <button class="btn-primary" style="margin-top:12px; font-size:14px; padding:10px 20px;" onclick="navegarA('creditos')">Pagar cuota</button>
        ` : `
          <p style="color:#64748B; margin-bottom:12px;">No tienes cuotas pendientes.</p>
          <button class="btn-primary" style="font-size:14px; padding:10px 20px;" onclick="navegarA('creditos')">Solicitar credito</button>
        `}
      </div>
    </div>

    <div class="app-section">
      <div class="app-section-title">Ultimos movimientos</div>
      ${movimientos && movimientos.length > 0 ? `
        <table class="app-table">
          <thead><tr><th>Fecha</th><th>Descripcion</th><th style="text-align:right;">Monto</th></tr></thead>
          <tbody>
            ${movimientos.slice(0, 5).map(m => {
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
  const esAdmin = perfil && perfil.es_admin === true;

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

    ${esAdmin ? '<div class="alert alert-warning"><strong>👑 Panel de Administrador</strong><br>Tienes ' + codigosPendientes.length + ' codigos de retiro pendientes.</div>' : ''}

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
            ${otros.map(u => '<option value="' + u.email + '">' + u.email + '</option>').join('')}
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
        <p style="color:#64748B; margin-bottom:16px;">Simula una recarga desde banco externo.</p>
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
              ${misCodigos.map(c => '<tr><td style="font-family:monospace;font-weight:700;color:#820AD1;">' + c.codigo + '</td><td>' + formatearDinero(c.monto) + '</td><td><span class="badge ' + (c.estado === 'pendiente' ? 'badge-yellow' : 'badge-green') + '">' + c.estado + '</span></td><td>' + formatearFechaCorta(c.created_at) + '</td></tr>').join('')}
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
          ${codigosPendientes && codigosPendientes.length > 0 ? `
            <table class="app-table">
              <thead><tr><th>Codigo</th><th>Cliente</th><th>Monto</th><th></th></tr></thead>
              <tbody>
                ${codigosPendientes.map(c => '<tr><td style="font-family:monospace;font-weight:700;color:#820AD1;">' + c.codigo + '</td><td>' + c.cliente_email + '</td><td style="font-weight:700;">' + formatearDinero(c.monto) + '</td><td><button class="btn-primary" style="font-size:12px;padding:6px 12px;" onclick="validarCodigo(' + c.id + ', \'' + c.codigo + '\')">✅ Validar</button></td></tr>').join('')}
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
                return '<tr><td>' + formatearFecha(t.created_at) + '</td><td>' + (esEmisor ? '📤' : '📥') + '</td><td>' + contraparte + '</td><td class="' + clase + '" style="text-align:right;">' + signo + formatearDinero(t.monto) + '</td><td><button class="btn-secondary-sm" onclick="generarReciboPDF(' + t.id + ')" style="font-size:11px;padding:4px 8px;">📄</button></td></tr>';
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
    await crearNotificacion(localStorage.getItem('user_id'), '💰 Recarga exitosa', 'Recargaste ' + formatearDinero(monto), 'success');
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
    await crearNotificacion(localStorage.getItem('user_id'), '🎫 Codigo generado', 'Codigo: ' + data.codigo + ' por ' + formatearDinero(monto), 'info');
    msg.innerHTML = mostrarAlerta('✅ Codigo: <strong style="font-family:monospace;">' + data.codigo + '</strong>', 'success');
    await actualizarSaldoSidebar();
    setTimeout(() => navegarA('flowpay'), 3000);
  } else {
    msg.innerHTML = mostrarAlerta('❌ ' + (data ? data.message : 'Error'), 'error');
  }
}

async function validarCodigo(codigoId, codigo) {
  if (!confirm('¿Confirmas que entregaste el efectivo?\n\nCodigo: ' + codigo)) return;
  const userId = localStorage.getItem('user_id');
  const { error } = await supabaseClient.from('codigos_retiro').update({
    estado: 'usado', usado_at: new Date().toISOString(), usado_por: userId,
  }).eq('id', codigoId);
  if (error) { alert('Error: ' + error.message); return; }
  await crearNotificacion(userId, '✅ Codigo validado', 'Validaste el codigo ' + codigo, 'success');
  alert('✅ Codigo validado');
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
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text('Numero: #' + t.id, 20, 60);
  doc.text('Fecha: ' + formatearFecha(t.created_at), 20, 70);
  doc.text('Emisor: ' + t.emisor_email, 20, 80);
  doc.text('Receptor: ' + t.receptor_email, 20, 90);
  doc.text('Monto: ' + formatearDinero(t.monto) + ' COP', 20, 100);
  doc.text('Concepto: ' + (t.concepto || 'Sin concepto'), 20, 110);
  doc.save('recibo_flowbank_' + t.id + '.pdf');
}

// ============ FLOWCARD ============

async function renderFlowCard() {
  const userId = localStorage.getItem('user_id');
  let { data: tarjeta } = await supabaseClient.from('tarjetas').select('*').eq('user_id', userId).single();

  if (!tarjeta) {
    const numero = '4000 ' + Array.from({length: 3}, () => Math.floor(1000 + Math.random() * 9000)).join(' ');
    const cvv = String(Math.floor(100 + Math.random() * 900));
    const mes = String(Math.floor(1 + Math.random() * 12)).padStart(2, '0');
    const anio = String(new Date().getFullYear() + 4).slice(-2);
    const { data } = await supabaseClient.from('tarjetas').insert({
      user_id: userId, numero, cvv, fecha_expiracion: mes + '/' + anio, cupo_total: 3000000, cupo_disponible: 3000000
    }).select().single();
    tarjeta = data;
  }

  const nombreTitular = datosPersonales && datosPersonales.nombres
    ? (datosPersonales.nombres + ' ' + (datosPersonales.apellidos || '')).toUpperCase()
    : (localStorage.getItem('user_email').split('@')[0]).toUpperCase();

  const claseCard = tarjeta.estado === 'activa' ? 'card-credit' : 'card-credit frozen';
  const deuda = Number(tarjeta.cupo_total) - Number(tarjeta.cupo_disponible);

  const html = `
    <div class="${claseCard}">
      <div class="card-credit-header">
        <span class="card-credit-brand">FLOWBANK</span>
        <span style="font-size:24px;">💳</span>
      </div>
      <div class="card-credit-numero">${tarjeta.numero}</div>
      <div class="card-credit-footer">
        <div><div>TITULAR</div><div>${nombreTitular}</div></div>
        <div><div>VENCE</div><div>${tarjeta.fecha_expiracion}</div></div>
        <div><div>CVV</div><div>${tarjeta.cvv}</div></div>
      </div>
      <div style="margin-top:24px; text-align:right; font-weight:900; font-size:18px;">VISA</div>
    </div>

    <div style="max-width:420px; margin:0 auto;">
      <div class="metrics-grid" style="grid-template-columns:1fr 1fr;">
        <div class="metric-card"><div class="metric-label">Cupo total</div><div class="metric-value">${formatearDinero(tarjeta.cupo_total)}</div></div>
        <div class="metric-card"><div class="metric-label">Cupo disponible</div><div class="metric-value" style="color:#10B981;">${formatearDinero(tarjeta.cupo_disponible)}</div></div>
        <div class="metric-card" style="grid-column:span 2;"><div class="metric-label">Deuda actual</div><div class="metric-value" style="color:${deuda > 0 ? '#EF4444' : '#10B981'};">${formatearDinero(deuda)}</div></div>
      </div>

      <div class="app-section">
        <div class="app-section-title">Estado: ${tarjeta.estado === 'activa' ? '🟢 Activa' : '🔒 Congelada'}</div>
        <button class="btn-primary btn-large" style="width:100%;justify-content:center;" onclick="toggleTarjeta(${tarjeta.id}, '${tarjeta.estado}')">
          ${tarjeta.estado === 'activa' ? '🔒 Congelar' : '🔓 Descongelar'}
        </button>
      </div>

      <div class="app-tabs">
        <button class="app-tab active" data-tab="sacar-cupo">💸 Sacar cupo</button>
        <button class="app-tab" data-tab="pagar-tarjeta">💳 Pagar tarjeta</button>
      </div>

      <div class="app-tab-content active" id="tab-sacar-cupo">
        <div class="app-section">
          <div class="app-section-title">Sacar cupo a tu cuenta</div>
          <p style="color:#64748B;margin-bottom:16px;">Retira dinero de tu cupo hacia tu saldo principal.</p>
          <div class="app-form-group">
            <label class="app-form-label">Monto a retirar (COP)</label>
            <input class="app-form-input" type="number" id="montoSacarCupo" min="10000" value="100000">
          </div>
          <div id="sacarCupoMessage"></div>
          <button class="btn-primary btn-large" style="width:100%;justify-content:center;" onclick="sacarCupo()">💸 Sacar cupo</button>
        </div>
      </div>

      <div class="app-tab-content" id="tab-pagar-tarjeta">
        <div class="app-section">
          <div class="app-section-title">Pagar tarjeta</div>
          <p style="color:#64748B;margin-bottom:16px;">Paga tu deuda para recuperar cupo.</p>
          <div class="app-form-group">
            <label class="app-form-label">Monto a pagar (COP)</label>
            <input class="app-form-input" type="number" id="montoPagarTarjeta" min="1000" value="${deuda > 0 ? Math.min(deuda, 100000) : 0}">
          </div>
          <div id="pagarTarjetaMessage"></div>
          <button class="btn-primary btn-large" style="width:100%;justify-content:center;" onclick="pagarTarjeta()">💳 Pagar tarjeta</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('pageContent').innerHTML = html;
  activarTabs();
}

async function toggleTarjeta(id, estadoActual) {
  const nuevoEstado = estadoActual === 'activa' ? 'congelada' : 'activa';
  await supabaseClient.from('tarjetas').update({ estado: nuevoEstado }).eq('id', id);
  navegarA('flowcard');
}

async function sacarCupo() {
  const monto = parseFloat(document.getElementById('montoSacarCupo').value);
  const msg = document.getElementById('sacarCupoMessage');
  if (!monto || monto < 10000) {
    msg.innerHTML = mostrarAlerta('Monto minimo: $10.000', 'error');
    return;
  }
  msg.innerHTML = '<div class="alert alert-info">Procesando...</div>';
  const { data } = await supabaseClient.rpc('usar_cupo_tarjeta', { p_monto: monto });
  if (data && data.success) {
    await crearNotificacion(localStorage.getItem('user_id'), '💸 Avance de cupo', 'Retiraste ' + formatearDinero(monto), 'success');
    msg.innerHTML = mostrarAlerta('✅ Cupo retirado', 'success');
    await actualizarSaldoSidebar();
    setTimeout(() => navegarA('flowcard'), 1500);
  } else {
    msg.innerHTML = mostrarAlerta('❌ ' + (data ? data.message : 'Error'), 'error');
  }
}

async function pagarTarjeta() {
  const monto = parseFloat(document.getElementById('montoPagarTarjeta').value);
  const msg = document.getElementById('pagarTarjetaMessage');
  if (!monto || monto <= 0) {
    msg.innerHTML = mostrarAlerta('Monto invalido', 'error');
    return;
  }
  msg.innerHTML = '<div class="alert alert-info">Procesando...</div>';
  const { data } = await supabaseClient.rpc('pagar_tarjeta', { p_monto: monto });
  if (data && data.success) {
    const pagoReal = data.pago_real || monto;
    await crearNotificacion(localStorage.getItem('user_id'), '💳 Pago de tarjeta', 'Pagaste ' + formatearDinero(pagoReal), 'success');
    msg.innerHTML = mostrarAlerta('✅ Pago realizado: ' + formatearDinero(pagoReal), 'success');
    await actualizarSaldoSidebar();
    setTimeout(() => navegarA('flowcard'), 1500);
  } else {
    msg.innerHTML = mostrarAlerta('❌ ' + (data ? data.message : 'Error'), 'error');
  }
}

// ⬇️ CONTINUA EN LA PARTE 2 ⬇️
// ============================================================
// FlowBank - App Principal (SPA) - Parte 2 de 2
// FlowSave, FlowInvest, FlowShield, FlowBusiness,
// FlowAnalytics, Creditos, Contrato PDF, Verificacion,
// Notificaciones y Chat de soporte
// ============================================================

// ============ FLOWSAVE ============

async function renderFlowSave() {
  const userId = localStorage.getItem('user_id');
  const { data: metas } = await supabaseClient.from('metas_ahorro').select('*').eq('user_id', userId).order('created_at', { ascending: false });

  let html = '<div class="app-tabs"><button class="app-tab active" data-tab="mis-metas">Mis metas</button><button class="app-tab" data-tab="nueva-meta">Nueva meta</button></div><div class="app-tab-content active" id="tab-mis-metas">';

  if (metas && metas.length > 0) {
    metas.forEach(meta => {
      const progreso = meta.monto_objetivo > 0 ? (meta.monto_actual / meta.monto_objetivo) * 100 : 0;
      html += '<div class="meta-card">' +
        '<div class="meta-header"><div class="meta-nombre">' + (meta.icono || '🎯') + ' ' + meta.nombre + '</div><div class="badge badge-purple">' + progreso.toFixed(1) + '%</div></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:14px;color:#64748B;"><span>Ahorrado: <strong>' + formatearDinero(meta.monto_actual) + '</strong></span><span>Meta: <strong>' + formatearDinero(meta.monto_objetivo) + '</strong></span></div>' +
        '<div class="meta-progress-bar"><div class="meta-progress-fill" style="width:' + Math.min(progreso, 100) + '%"></div></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;"><input class="app-form-input" type="number" id="aporte-' + meta.id + '" placeholder="Aportar" style="flex:1;"><button class="btn-primary" onclick="aportarMeta(' + meta.id + ')">Aportar</button></div>' +
        '</div>';
    });
  } else {
    html += '<div class="app-section"><p style="color:#64748B;">Aun no tienes metas.</p></div>';
  }

  html += '</div><div class="app-tab-content" id="tab-nueva-meta"><div class="app-section"><div class="app-section-title">Crear meta</div>' +
    '<div class="app-form-group"><label class="app-form-label">Nombre</label><input class="app-form-input" type="text" id="metaNombre"></div>' +
    '<div class="app-form-group"><label class="app-form-label">Monto objetivo (COP)</label><input class="app-form-input" type="number" id="metaObjetivo" value="500000"></div>' +
    '<div class="app-form-group"><label class="app-form-label">Fecha limite</label><input class="app-form-input" type="date" id="metaFecha"></div>' +
    '<div class="app-form-group"><label class="app-form-label">Icono</label><select class="app-form-select" id="metaIcono"><option value="🎯">🎯 Meta</option><option value="✈️">✈️ Viaje</option><option value="🏠">🏠 Casa</option><option value="🚗">🚗 Auto</option><option value="💻">💻 Tecnologia</option><option value="🎓">🎓 Educacion</option></select></div>' +
    '<div id="metaMessage"></div>' +
    '<button class="btn-primary btn-large" style="width:100%;justify-content:center;" onclick="crearMeta()">Crear meta</button>' +
    '</div></div>';

  document.getElementById('pageContent').innerHTML = html;
  activarTabs();
}

async function crearMeta() {
  const userId = localStorage.getItem('user_id');
  const nombre = document.getElementById('metaNombre').value;
  const objetivo = parseFloat(document.getElementById('metaObjetivo').value);
  const fecha = document.getElementById('metaFecha').value || null;
  const icono = document.getElementById('metaIcono').value;
  if (!nombre || !objetivo) { alert('Completa los campos'); return; }
  await supabaseClient.from('metas_ahorro').insert({ user_id: userId, nombre, monto_objetivo: objetivo, fecha_limite: fecha, icono });
  navegarA('flowsave');
}

async function aportarMeta(metaId) {
  const input = document.getElementById('aporte-' + metaId);
  const monto = parseFloat(input.value);
  if (!monto || monto <= 0) return;
  const { data } = await supabaseClient.from('metas_ahorro').select('monto_actual').eq('id', metaId).single();
  const actual = data ? Number(data.monto_actual) : 0;
  await supabaseClient.from('metas_ahorro').update({ monto_actual: actual + monto }).eq('id', metaId);
  navegarA('flowsave');
}

// ============ FLOWINVEST ============

async function renderFlowInvest() {
  const userId = localStorage.getItem('user_id');
  const { data: inversiones } = await supabaseClient.from('inversiones').select('*').eq('user_id', userId).order('created_at', { ascending: false });

  const productos = [
    { nombre: 'CDT Digital', rendimiento: 10.5, desc: 'Bajo riesgo' },
    { nombre: 'Fondo Conservador', rendimiento: 12.0, desc: 'Riesgo medio' },
    { nombre: 'Fondo Crecimiento', rendimiento: 15.5, desc: 'Riesgo alto' },
    { nombre: 'Portafolio Emprendedor', rendimiento: 18.0, desc: 'Diversificado' },
  ];

  let totalInv = 0, totalAct = 0;
  if (inversiones) inversiones.forEach(i => { totalInv += Number(i.monto_invertido); totalAct += Number(i.valor_actual); });

  let html = '<div class="metrics-grid">' +
    '<div class="metric-card"><div class="metric-label">Total invertido</div><div class="metric-value">' + formatearDinero(totalInv) + '</div></div>' +
    '<div class="metric-card"><div class="metric-label">Valor actual</div><div class="metric-value">' + formatearDinero(totalAct) + '</div></div>' +
    '<div class="metric-card"><div class="metric-label">Rendimiento</div><div class="metric-value text-green">' + formatearDinero(totalAct - totalInv) + '</div></div>' +
    '</div>';

  html += '<div class="app-tabs"><button class="app-tab active" data-tab="mis-inv">Mis inversiones</button><button class="app-tab" data-tab="nueva-inv">Invertir</button></div><div class="app-tab-content active" id="tab-mis-inv">';

  if (inversiones && inversiones.length > 0) {
    inversiones.forEach(inv => {
      html += '<div class="product-item"><div class="product-item-info"><h4>' + inv.producto + '</h4><p>Rendimiento anual: ' + inv.rendimiento_anual + '%</p></div><div class="product-item-price">' + formatearDinero(inv.monto_invertido) + '</div></div>';
    });
  } else {
    html += '<div class="app-section"><p style="color:#64748B;">Aun no tienes inversiones.</p></div>';
  }

  html += '</div><div class="app-tab-content" id="tab-nueva-inv"><div class="app-section"><div class="app-section-title">Productos</div>';

  productos.forEach(p => {
    html += '<div class="product-item"><div class="product-item-info"><h4>' + p.nombre + '</h4><p>' + p.desc + '</p></div><div class="product-item-price">' + p.rendimiento + '%</div></div>';
  });

  html += '</div><div class="app-section"><div class="app-section-title">Nueva inversion</div>' +
    '<div class="app-form-group"><label class="app-form-label">Producto</label><select class="app-form-select" id="invProducto">';

  productos.forEach(p => {
    html += '<option value="' + p.nombre + '" data-rend="' + p.rendimiento + '">' + p.nombre + ' - ' + p.rendimiento + '%</option>';
  });

  html += '</select></div>' +
    '<div class="app-form-group"><label class="app-form-label">Monto (COP)</label><input class="app-form-input" type="number" id="invMonto" value="100000"></div>' +
    '<div id="invMessage"></div>' +
    '<button class="btn-primary btn-large" style="width:100%;justify-content:center;" onclick="crearInversion()">Invertir</button></div></div>';

  document.getElementById('pageContent').innerHTML = html;
  activarTabs();
}

async function crearInversion() {
  const userId = localStorage.getItem('user_id');
  const sel = document.getElementById('invProducto');
  const producto = sel.value;
  const rend = parseFloat(sel.options[sel.selectedIndex].getAttribute('data-rend'));
  const monto = parseFloat(document.getElementById('invMonto').value);
  const msg = document.getElementById('invMessage');
  if (!monto || monto < 100000) { msg.innerHTML = mostrarAlerta('Minimo $100.000', 'error'); return; }
  const saldo = await obtenerSaldo();
  if (saldo < monto) { msg.innerHTML = mostrarAlerta('Saldo insuficiente', 'error'); return; }
  await supabaseClient.from('inversiones').insert({ user_id: userId, producto, monto_invertido: monto, rendimiento_anual: rend, valor_actual: monto });
  await supabaseClient.rpc('retirar_saldo', { p_monto: monto });
  await actualizarSaldoSidebar();
  navegarA('flowinvest');
}

// ============ FLOWSHIELD ============

async function renderFlowShield() {
  const userId = localStorage.getItem('user_id');
  const { data: seguros } = await supabaseClient.from('seguros').select('*').eq('user_id', userId).order('created_at', { ascending: false });

  const tipos = [
    { tipo: 'Vida', cobertura: 50000000, prima: 45000 },
    { tipo: 'Negocio', cobertura: 20000000, prima: 28000 },
    { tipo: 'Fraude digital', cobertura: 5000000, prima: 12000 },
    { tipo: 'Incendio/Hurto', cobertura: 15000000, prima: 22000 },
    { tipo: 'Salud', cobertura: 10000000, prima: 35000 },
  ];

  let html = '<div class="app-tabs"><button class="app-tab active" data-tab="mis-seguros">Mis polizas</button><button class="app-tab" data-tab="nuevo-seguro">Contratar</button></div><div class="app-tab-content active" id="tab-mis-seguros">';

  if (seguros && seguros.length > 0) {
    seguros.forEach(s => {
      html += '<div class="product-item"><div class="product-item-info"><h4>Seguro de ' + s.tipo + '</h4><p>Cobertura: ' + formatearDinero(s.cobertura) + '</p></div><div class="product-item-price">' + formatearDinero(s.prima_mensual) + '/mes</div></div>';
    });
  } else {
    html += '<div class="app-section"><p style="color:#64748B;">No tienes polizas.</p></div>';
  }

  html += '</div><div class="app-tab-content" id="tab-nuevo-seguro"><div class="app-section"><div class="app-section-title">Disponibles</div>';

  tipos.forEach(t => {
    html += '<div class="product-item"><div class="product-item-info"><h4>Seguro de ' + t.tipo + '</h4><p>Cobertura: ' + formatearDinero(t.cobertura) + '</p></div><div class="product-item-price">' + formatearDinero(t.prima) + '/mes</div></div>';
  });

  html += '</div><div class="app-section"><div class="app-section-title">Contratar</div>' +
    '<div class="app-form-group"><label class="app-form-label">Tipo</label><select class="app-form-select" id="seguroTipo">';

  tipos.forEach(t => {
    html += '<option value="' + t.tipo + '" data-cob="' + t.cobertura + '" data-prima="' + t.prima + '">' + t.tipo + '</option>';
  });

  html += '</select></div><button class="btn-primary btn-large" style="width:100%;justify-content:center;" onclick="contratarSeguro()">Contratar</button></div></div>';

  document.getElementById('pageContent').innerHTML = html;
  activarTabs();
}

async function contratarSeguro() {
  const userId = localStorage.getItem('user_id');
  const sel = document.getElementById('seguroTipo');
  const tipo = sel.value;
  const cobertura = parseFloat(sel.options[sel.selectedIndex].getAttribute('data-cob'));
  const prima = parseFloat(sel.options[sel.selectedIndex].getAttribute('data-prima'));
  await supabaseClient.from('seguros').insert({ user_id: userId, tipo, cobertura, prima_mensual: prima });
  navegarA('flowshield');
}

// ============ FLOWBUSINESS ============

async function renderFlowBusiness() {
  const userId = localStorage.getItem('user_id');
  const { data: cuentas } = await supabaseClient.from('cuentas_empresariales').select('*').eq('user_id', userId).order('created_at', { ascending: false });

  let html = '<div class="app-tabs"><button class="app-tab active" data-tab="mis-empresas">Mis cuentas</button><button class="app-tab" data-tab="nueva-empresa">Nueva cuenta</button></div><div class="app-tab-content active" id="tab-mis-empresas">';

  if (cuentas && cuentas.length > 0) {
    cuentas.forEach(c => {
      html += '<div class="product-item"><div class="product-item-info"><h4>🏢 ' + c.nombre_negocio + '</h4><p>NIT: ' + (c.nit || 'N/A') + ' | ' + (c.categoria || 'General') + '</p></div><div class="product-item-price">' + formatearDinero(c.saldo) + '</div></div>';
    });
  } else {
    html += '<div class="app-section"><p style="color:#64748B;">No tienes cuentas empresariales.</p></div>';
  }

  html += '</div><div class="app-tab-content" id="tab-nueva-empresa"><div class="app-section"><div class="app-section-title">Crear cuenta</div>' +
    '<div class="app-form-group"><label class="app-form-label">Nombre del negocio</label><input class="app-form-input" type="text" id="empNombre"></div>' +
    '<div class="app-form-group"><label class="app-form-label">NIT (opcional)</label><input class="app-form-input" type="text" id="empNit"></div>' +
    '<div class="app-form-group"><label class="app-form-label">Categoria</label><select class="app-form-select" id="empCategoria"><option>E-commerce</option><option>Servicios</option><option>Tecnologia</option><option>Alimentos</option><option>Moda</option><option>Educacion</option><option>Otro</option></select></div>' +
    '<div id="empMessage"></div>' +
    '<button class="btn-primary btn-large" style="width:100%;justify-content:center;" onclick="crearEmpresa()">Crear cuenta</button></div></div>';

  document.getElementById('pageContent').innerHTML = html;
  activarTabs();
}

async function crearEmpresa() {
  const userId = localStorage.getItem('user_id');
  const nombre = document.getElementById('empNombre').value;
  const nit = document.getElementById('empNit').value;
  const categoria = document.getElementById('empCategoria').value;
  const msg = document.getElementById('empMessage');
  if (!nombre) { msg.innerHTML = mostrarAlerta('Escribe el nombre', 'error'); return; }
  await supabaseClient.from('cuentas_empresariales').insert({ user_id: userId, nombre_negocio: nombre, nit, categoria, saldo: 0 });
  navegarA('flowbusiness');
}

// ============ FLOWANALYTICS ============

async function renderFlowAnalytics() {
  const userId = localStorage.getItem('user_id');
  const { data: movs } = await supabaseClient.from('movimientos').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200);

  let ingresos = 0, egresos = 0;
  if (movs) movs.forEach(m => { if (m.tipo === 'ingreso') ingresos += Number(m.monto); else egresos += Number(m.monto); });
  const balance = ingresos - egresos;

  let html = '<div class="metrics-grid">' +
    '<div class="metric-card"><div class="metric-label">Ingresos</div><div class="metric-value text-green">' + formatearDinero(ingresos) + '</div></div>' +
    '<div class="metric-card"><div class="metric-label">Egresos</div><div class="metric-value text-red">' + formatearDinero(egresos) + '</div></div>' +
    '<div class="metric-card"><div class="metric-label">Balance</div><div class="metric-value">' + formatearDinero(balance) + '</div></div>' +
    '<div class="metric-card"><div class="metric-label">Movimientos</div><div class="metric-value">' + (movs ? movs.length : 0) + '</div></div>' +
    '</div>';

  html += '<div class="app-section"><div class="app-section-title">Historial completo</div>';

  if (movs && movs.length > 0) {
    html += '<table class="app-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripcion</th><th style="text-align:right;">Monto</th></tr></thead><tbody>';
    movs.slice(0, 30).forEach(m => {
      const signo = m.tipo === 'ingreso' ? '+' : '-';
      const clase = m.tipo === 'ingreso' ? 'text-green' : 'text-red';
      html += '<tr><td>' + formatearFechaCorta(m.created_at) + '</td><td>' + (m.tipo === 'ingreso' ? '🟢' : '🔴') + '</td><td>' + m.descripcion + '</td><td class="' + clase + '" style="text-align:right;">' + signo + formatearDinero(m.monto) + '</td></tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<p style="color:#64748B;">No hay movimientos.</p>';
  }

  html += '</div>';
  document.getElementById('pageContent').innerHTML = html;
}

// ============ CREDITOS ============

async function renderCreditos() {
  const userId = localStorage.getItem('user_id');
  const { data: solicitudes } = await supabaseClient.from('solicitudes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  const { data: creditos } = await supabaseClient.from('creditos').select('*').eq('user_id', userId).order('created_at', { ascending: false });

  let html = '<div class="app-tabs"><button class="app-tab active" data-tab="solicitar">Solicitar</button><button class="app-tab" data-tab="mis-creditos">Mis creditos</button><button class="app-tab" data-tab="historial-cred">Historial</button></div>';

  html += '<div class="app-tab-content active" id="tab-solicitar"><div class="app-section"><div class="app-section-title">Nueva solicitud</div>' +
    '<div class="app-form-group"><label class="app-form-label">Tipo de negocio</label><select class="app-form-select" id="credTipo"><option>E-commerce</option><option>Creador de contenido</option><option>Servicios digitales</option><option>SaaS / App</option><option>Marketing digital</option><option>Otro</option></select></div>' +
    '<div class="app-form-group"><label class="app-form-label">Ingresos mensuales (COP)</label><input class="app-form-input" type="number" id="credIngresos" value="3000000"></div>' +
    '<div class="app-form-group"><label class="app-form-label">Meses con el negocio</label><input class="app-form-input" type="number" id="credMeses" value="12"></div>' +
    '<div class="app-form-group"><label class="app-form-label">Monto (COP)</label><input class="app-form-input" type="number" id="credMonto" value="1000000"></div>' +
    '<div class="app-form-group"><label class="app-form-label">Plazo</label><select class="app-form-select" id="credPlazo"><option value="30">30 dias</option><option value="60">60 dias</option><option value="90" selected>90 dias</option><option value="120">120 dias</option><option value="180">180 dias</option></select></div>' +
    '<div class="app-form-group"><label class="app-form-label">Historial</label><select class="app-form-select" id="credHistorial"><option>Sin historial</option><option>1 credito pagado</option><option>2-3 creditos pagados</option><option>Mas de 3 creditos</option></select></div>' +
    '<div id="credMessage"></div>' +
    '<button class="btn-primary btn-large" style="width:100%;justify-content:center;" onclick="solicitarCredito()">Analizar con IA</button></div></div>';

  html += '<div class="app-tab-content" id="tab-mis-creditos">';

  if (creditos && creditos.length > 0) {
    creditos.forEach(c => {
      const progreso = c.num_cuotas > 0 ? (c.cuotas_pagadas / c.num_cuotas) * 100 : 0;
      html += '<div class="meta-card">' +
        '<div class="meta-header"><div class="meta-nombre">Credito #' + c.id + '</div><div class="badge ' + (c.estado === 'activo' ? 'badge-green' : 'badge-blue') + '">' + c.estado + '</div></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">' +
        '<div><div style="font-size:12px;color:#64748B;">Monto</div><div style="font-weight:700;">' + formatearDinero(c.monto_aprobado) + '</div></div>' +
        '<div><div style="font-size:12px;color:#64748B;">Tasa</div><div style="font-weight:700;">' + c.tasa_anual + '%</div></div>' +
        '<div><div style="font-size:12px;color:#64748B;">Saldo</div><div style="font-weight:700;">' + formatearDinero(c.saldo_pendiente) + '</div></div>' +
        '<div><div style="font-size:12px;color:#64748B;">Cuotas</div><div style="font-weight:700;">' + c.cuotas_pagadas + '/' + c.num_cuotas + '</div></div>' +
        '</div>' +
        '<div class="meta-progress-bar"><div class="meta-progress-fill" style="width:' + progreso + '%"></div></div>' +
        '<button class="btn-secondary-sm" style="margin-top:12px;" onclick="generarContratoPDF(' + c.id + ')">📄 Descargar contrato</button>' +
        '</div>';
    });
  } else {
    html += '<div class="app-section"><p style="color:#64748B;">No tienes creditos activos.</p></div>';
  }

  html += '</div><div class="app-tab-content" id="tab-historial-cred"><div class="app-section"><div class="app-section-title">Historial</div>';

  if (solicitudes && solicitudes.length > 0) {
    html += '<table class="app-table"><thead><tr><th>Fecha</th><th>Monto</th><th>Score</th><th>Decision</th></tr></thead><tbody>';
    solicitudes.forEach(s => {
      html += '<tr><td>' + formatearFechaCorta(s.created_at) + '</td><td>' + formatearDinero(s.monto_solicitado) + '</td><td>' + (s.score || '-') + '</td><td><span class="badge ' + (s.decision === 'APROBADO' ? 'badge-green' : s.decision === 'RECHAZADO' ? 'badge-red' : 'badge-yellow') + '">' + (s.decision || '-') + '</span></td></tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<p style="color:#64748B;">No hay solicitudes.</p>';
  }

  html += '</div></div>';
  document.getElementById('pageContent').innerHTML = html;
  activarTabs();
}

async function solicitarCredito() {
  const msg = document.getElementById('credMessage');
  msg.innerHTML = '<div class="alert alert-info">Analizando con IA...</div>';

  const datos = {
    tipo: document.getElementById('credTipo').value,
    ingresos: parseFloat(document.getElementById('credIngresos').value),
    meses: parseInt(document.getElementById('credMeses').value),
    monto: parseFloat(document.getElementById('credMonto').value),
    plazo: parseInt(document.getElementById('credPlazo').value),
    historial: document.getElementById('credHistorial').value,
    fuentes: 'Stripe, Nequi',
  };

  const prompt = 'Eres un analista de riesgo crediticio. Analiza esta solicitud de microcredito para un emprendedor digital colombiano.\n\nDATOS:\n- Tipo de negocio: ' + datos.tipo + '\n- Ingresos mensuales: ' + datos.ingresos + ' COP\n- Meses con el negocio: ' + datos.meses + '\n- Monto solicitado: ' + datos.monto + ' COP\n- Plazo: ' + datos.plazo + ' dias\n- Historial: ' + datos.historial + '\n\nResponde SOLO con este formato:\nSCORE: <numero 0-1000>\nDECISION: <APROBADO | REVISION | RECHAZADO>\nMONTO_APROBADO: <numero>\nTASA_ANUAL: <numero>\nRAZON_1: <texto>\nRAZON_2: <texto>\nRAZON_3: <texto>';

  try {
    const response = await fetch(CONFIG.AI_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'scoring', prompt }),
    });

    const result = await response.json();
    const texto = result.texto;

    let score = 0, decision = 'REVISION', montoAprobado = 0, tasa = 18;
    texto.split('\n').forEach(line => {
      const up = line.toUpperCase();
      if (up.startsWith('SCORE:')) score = parseInt(line.split(':')[1].trim());
      else if (up.startsWith('DECISION:')) decision = line.split(':')[1].trim().toUpperCase();
      else if (up.startsWith('MONTO_APROBADO:')) montoAprobado = parseFloat(line.split(':')[1].trim());
      else if (up.startsWith('TASA_ANUAL:')) tasa = parseFloat(line.split(':')[1].trim());
    });

    const userId = localStorage.getItem('user_id');
    await supabaseClient.from('solicitudes').insert({
      user_id: userId, monto_solicitado: datos.monto, plazo_dias: datos.plazo,
      tipo_negocio: datos.tipo, ingresos_mensuales: datos.ingresos,
      score, decision, monto_aprobado: montoAprobado, tasa_sugerida: tasa,
      razones: texto.substring(0, 500),
    });

    const titulo = decision === 'APROBADO' ? '🎉 Credito aprobado' : decision === 'RECHAZADO' ? '❌ Rechazado' : '⏳ En revision';
    const tipo = decision === 'APROBADO' ? 'success' : decision === 'RECHAZADO' ? 'error' : 'warning';
    await crearNotificacion(userId, titulo, 'Score: ' + score, tipo);

    msg.innerHTML = mostrarAlerta('✅ ' + decision + ' - Score: ' + score, decision === 'APROBADO' ? 'success' : 'info');
    setTimeout(() => navegarA('creditos'), 2000);
  } catch (e) {
    msg.innerHTML = mostrarAlerta('Error: ' + e.message, 'error');
  }
}

// ============ CONTRATO PDF ============

async function generarContratoPDF(creditoId) {
  const userId = localStorage.getItem('user_id');
  const { data: credito } = await supabaseClient.from('creditos').select('*').eq('id', creditoId).single();
  const { data: cuotas } = await supabaseClient.from('cuotas').select('*').eq('credito_id', creditoId).order('numero');
  const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
  if (!credito) { alert('Credito no encontrado'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(130, 10, 209);
  doc.text('FLOWBANK', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Contrato de Microcredito Digital', 105, 27, { align: 'center' });
  doc.setDrawColor(130, 10, 209);
  doc.setLineWidth(0.8);
  doc.line(20, 32, 190, 32);

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACION DEL CLIENTE', 20, 45);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const nombres = ((profile?.nombres || '') + ' ' + (profile?.apellidos || '')).trim() || 'No registrado';
  doc.text('Nombre: ' + nombres, 20, 54);
  doc.text('Cedula: ' + (profile?.cedula || 'N/A'), 20, 60);
  doc.text('Telefono: ' + (profile?.telefono || 'N/A'), 20, 66);
  doc.text('Email: ' + (localStorage.getItem('user_email') || ''), 20, 72);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CONDICIONES DEL CREDITO', 20, 86);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('Monto aprobado: ' + formatearDinero(credito.monto_aprobado), 20, 95);
  doc.text('Tasa anual: ' + credito.tasa_anual + '%', 20, 101);
  doc.text('Plazo: ' + credito.plazo_dias + ' dias', 20, 107);
  doc.text('Numero de cuotas: ' + credito.num_cuotas, 20, 113);
  doc.text('Valor por cuota: ' + formatearDinero(credito.valor_cuota), 20, 119);
  doc.text('Total intereses: ' + formatearDinero(credito.total_intereses), 20, 125);
  doc.text('Total a pagar: ' + formatearDinero(credito.total_pagar), 20, 131);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('PLAN DE PAGOS', 20, 145);

  doc.setFontSize(9);
  doc.setFillColor(30, 41, 59);
  doc.setTextColor(255, 255, 255);
  doc.rect(20, 150, 15, 7, 'F');
  doc.rect(35, 150, 35, 7, 'F');
  doc.rect(70, 150, 35, 7, 'F');
  doc.rect(105, 150, 35, 7, 'F');
  doc.rect(140, 150, 35, 7, 'F');
  doc.text('No.', 27, 155, { align: 'center' });
  doc.text('Vencimiento', 52, 155, { align: 'center' });
  doc.text('Valor', 87, 155, { align: 'center' });
  doc.text('Capital', 122, 155, { align: 'center' });
  doc.text('Intereses', 157, 155, { align: 'center' });

  let y = 162;
  doc.setTextColor(51, 65, 85);
  if (cuotas) {
    cuotas.forEach(c => {
      doc.rect(20, y, 15, 6);
      doc.rect(35, y, 35, 6);
      doc.rect(70, y, 35, 6);
      doc.rect(105, y, 35, 6);
      doc.rect(140, y, 35, 6);
      doc.text(String(c.numero), 27, y + 4, { align: 'center' });
      doc.text(c.fecha_vencimiento || '', 52, y + 4, { align: 'center' });
      doc.text(formatearDinero(c.valor), 87, y + 4, { align: 'center' });
      doc.text(formatearDinero(c.capital), 122, y + 4, { align: 'center' });
      doc.text(formatearDinero(c.intereses), 157, y + 4, { align: 'center' });
      y += 6;
      if (y > 260) { doc.addPage(); y = 20; }
    });
  }

  y += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMINOS Y CONDICIONES', 20, y);
  y += 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Contrato bajo modalidad de microcredito digital. Prototipo demostrativo. No representa obligacion financiera real.', 20, y);

  doc.save('contrato_flowbank_' + creditoId + '.pdf');
}

// ============ VERIFICACION ============

async function renderVerificacion() {
  const userId = localStorage.getItem('user_id');
  const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();

  let html = '<div class="app-section"><div class="app-section-title">Datos personales</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
    '<div><div style="font-size:12px;color:#64748B;">Nombres</div><div style="font-weight:700;">' + (profile?.nombres || 'No registrado') + '</div></div>' +
    '<div><div style="font-size:12px;color:#64748B;">Apellidos</div><div style="font-weight:700;">' + (profile?.apellidos || 'No registrado') + '</div></div>' +
    '<div><div style="font-size:12px;color:#64748B;">Cedula</div><div style="font-weight:700;">' + (profile?.cedula || 'No registrada') + '</div></div>' +
    '<div><div style="font-size:12px;color:#64748B;">Telefono</div><div style="font-weight:700;">' + (profile?.telefono || 'No registrado') + '</div></div>' +
    '</div></div>';

  html += '<div class="app-section"><div class="app-section-title">Verificacion con camara</div><p style="color:#64748B;margin-bottom:16px;">Toma una foto de tu rostro.</p>' +
    '<div style="text-align:center;"><video id="videoCam" autoplay playsinline style="width:100%;max-width:400px;border-radius:16px;background:#000;display:block;margin:0 auto 16px;"></video><canvas id="canvasFoto" style="display:none;"></canvas>' +
    '<div style="margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">' +
    '<button class="btn-primary" onclick="iniciarCamara()">📸 Activar camara</button>' +
    '<button class="btn-primary" onclick="capturarFoto(\'' + userId + '\')">✅ Tomar foto</button>' +
    '</div></div><div id="verifMessage"></div></div>';

  html += '<div class="app-section"><div class="app-section-title">Codigo de recuperacion</div>';

  if (profile?.recovery_code) {
    html += '<div class="alert alert-warning">Guarda este codigo</div><div style="background:#0F172A;color:#10B981;padding:20px;border-radius:12px;font-family:monospace;font-size:18px;font-weight:700;text-align:center;letter-spacing:2px;word-break:break-all;">' + profile.recovery_code + '</div>';
  } else {
    html += '<p style="color:#64748B;margin-bottom:16px;">Aun no has generado tu codigo.</p><button class="btn-primary" onclick="generarCodigo(\'' + userId + '\')">Generar codigo</button>';
  }

  html += '</div>';
  document.getElementById('pageContent').innerHTML = html;
}

async function iniciarCamara() {
  try {
    streamCamara = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    const video = document.getElementById('videoCam');
    video.srcObject = streamCamara;
  } catch (e) {
    document.getElementById('verifMessage').innerHTML = mostrarAlerta('No se pudo acceder: ' + e.message, 'error');
  }
}

async function capturarFoto(userId) {
  const video = document.getElementById('videoCam');
  const canvas = document.getElementById('canvasFoto');
  const msg = document.getElementById('verifMessage');
  if (!video.srcObject) { msg.innerHTML = mostrarAlerta('Primero activa la camara', 'error'); return; }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  canvas.toBlob(async function (blob) {
    const fileName = userId + '_' + Date.now() + '.jpg';
    const { error } = await supabaseClient.storage.from('verificaciones').upload(fileName, blob, { contentType: 'image/jpeg' });
    if (error) { msg.innerHTML = mostrarAlerta('Error: ' + error.message, 'error'); return; }
    const { data: publicData } = supabaseClient.storage.from('verificaciones').getPublicUrl(fileName);
    await supabaseClient.from('profiles').update({
      foto_verificacion_url: publicData.publicUrl,
      verificacion_estado: 'verificado',
      verificacion_fecha: new Date().toISOString(),
      verificado: true,
    }).eq('id', userId);
    if (streamCamara) streamCamara.getTracks().forEach(t => t.stop());
    msg.innerHTML = mostrarAlerta('✅ Verificacion completada', 'success');
    setTimeout(() => navegarA('verificacion'), 2000);
  }, 'image/jpeg', 0.85);
}

async function generarCodigo(userId) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bloques = [];
  for (let i = 0; i < 6; i++) {
    let bloque = '';
    for (let j = 0; j < 4; j++) bloque += chars[Math.floor(Math.random() * chars.length)];
    bloques.push(bloque);
  }
  const codigo = bloques.join('-');
  await supabaseClient.from('profiles').update({
    recovery_code: codigo,
    recovery_generated_at: new Date().toISOString(),
  }).eq('id', userId);
  navegarA('verificacion');
}

// ============ NOTIFICACIONES ============

async function renderNotificaciones() {
  const userId = localStorage.getItem('user_id');
  const { data: notifs } = await supabaseClient.from('notificaciones').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);

  let html = '';

  if (!notifs || notifs.length === 0) {
    html = '<div class="app-section"><p style="color:#64748B;">No tienes notificaciones.</p></div>';
  } else {
    const noLeidas = notifs.filter(n => !n.leida).length;
    if (noLeidas > 0) {
      html += '<div class="alert alert-warning">Tienes ' + noLeidas + ' sin leer <button class="btn-secondary-sm" onclick="marcarTodasLeidas(\'' + userId + '\')" style="margin-left:12px;">Marcar todas</button></div>';
    }
    notifs.forEach(n => {
      html += '<div class="notif-item ' + (n.leida ? '' : 'unread') + '"><div class="notif-icon">' + (n.leida ? '📭' : '📬') + '</div><div class="notif-content"><div class="notif-title">' + n.titulo + '</div><div class="notif-message">' + n.mensaje + '</div><div class="notif-date">' + formatearFecha(n.created_at) + '</div></div></div>';
    });
  }

  document.getElementById('pageContent').innerHTML = html;
}

async function marcarTodasLeidas(userId) {
  await supabaseClient.from('notificaciones').update({ leida: true }).eq('user_id', userId).eq('leida', false);
  navegarA('notificaciones');
}

// ============ CHAT DE SOPORTE ============

function toggleChat() {
  document.getElementById('chatWindow').classList.toggle('open');
}

async function enviarChat() {
  const input = document.getElementById('chatInput');
  const mensaje = input.value.trim();
  if (!mensaje) return;

  const mensajes = document.getElementById('chatMessages');
  mensajes.innerHTML += '<div class="chat-message chat-user">' + mensaje + '</div>';
  input.value = '';
  mensajes.scrollTop = mensajes.scrollHeight;

  const loading = document.createElement('div');
  loading.className = 'chat-message chat-bot chat-loading';
  loading.textContent = 'Escribiendo...';
  loading.id = 'chatLoading';
  mensajes.appendChild(loading);
  mensajes.scrollTop = mensajes.scrollHeight;

  try {
    const saldo = await obtenerSaldo();
    const nombre = (datosPersonales && datosPersonales.nombres ? datosPersonales.nombres : 'Usuario');

    const response = await fetch(CONFIG.AI_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'chat',
        prompt: [
          { role: 'system', content: 'Eres el asistente virtual de FlowBank, un banco digital colombiano para emprendedores. Respondes en espanol, amable y conciso (maximo 3 lineas). El usuario se llama ' + nombre + ' y tiene saldo ' + formatearDinero(saldo) + '.' },
          { role: 'user', content: mensaje }
        ],
      }),
    });

    const result = await response.json();
    const respuesta = result.texto;

    const loadingEl = document.getElementById('chatLoading');
    if (loadingEl) loadingEl.remove();

    mensajes.innerHTML += '<div class="chat-message chat-bot">' + respuesta + '</div>';
    mensajes.scrollTop = mensajes.scrollHeight;
  } catch (e) {
    const loadingEl = document.getElementById('chatLoading');
    if (loadingEl) loadingEl.remove();
    mensajes.innerHTML += '<div class="chat-message chat-bot">Lo siento, hubo un error.</div>';
  }
}

// ============ FIN DEL ARCHIVO ============
