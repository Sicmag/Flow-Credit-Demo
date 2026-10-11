
// Router principal de la SPA

let usuarioActual = null;
let datosPersonales = null;

// ============ INICIALIZACION ============

document.addEventListener('DOMContentLoaded', async function () {
  const session = await verificarSesion();
  if (!session) return;

  usuarioActual = session.user;
  datosPersonales = await obtenerDatosUsuario();

  await cargarSidebar();

  // Navegacion
  document.querySelectorAll('.sidebar-link[data-page]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const page = btn.getAttribute('data-page');
      navegarA(page);
    });
  });

  // Menu movil
  const toggle = document.getElementById('menuMobileToggle');
  const sidebar = document.getElementById('appSidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }

  // Cargar pagina inicial
  navegarA('dashboard');
});

// ============ NAVEGACION ============

async function navegarA(page) {
  // Actualizar sidebar
  document.querySelectorAll('.sidebar-link').forEach(function (b) { b.classList.remove('active'); });
  const btnActivo = document.querySelector('.sidebar-link[data-page="' + page + '"]');
  if (btnActivo) btnActivo.classList.add('active');

  // Cerrar sidebar en movil
  const sidebar = document.getElementById('appSidebar');
  if (sidebar) sidebar.classList.remove('open');

  // Configurar titulos
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

  // Contenido
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
    content.innerHTML = '<div class="app-section"><p style="color:#EF4444;">Error cargando la pagina: ' + error.message + '</p></div>';
  }
}

// ============ SIDEBAR ============

async function cargarSidebar() {
  const userId = localStorage.getItem('user_id');
  const email = localStorage.getItem('user_email');

  let nombreCompleto = email.split('@')[0];
  if (datosPersonales && datosPersonales.nombres) {
    nombreCompleto = (datosPersonales.nombres + ' ' + (datosPersonales.apellidos || '')).trim();
  }

  document.getElementById('sidebarNombre').textContent = nombreCompleto;
  document.getElementById('sidebarEmail').textContent = email;

  // Saldo
  const saldo = await obtenerSaldo();
  document.getElementById('sidebarSaldo').textContent = formatearDinero(saldo);
}

async function actualizarSaldoSidebar() {
  const saldo = await obtenerSaldo();
  document.getElementById('sidebarSaldo').textContent = formatearDinero(saldo);
}

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

// ============ DATOS ============

async function obtenerSaldo() {
  const userId = localStorage.getItem('user_id');
  try {
    const { data } = await supabaseClient
      .from('cuentas')
      .select('saldo')
      .eq('user_id', userId)
      .single();

    if (data) return Number(data.saldo) || 0;

    // Crear cuenta si no existe
    const numero = 'FC-' + userId.slice(0, 8);
    const { data: nueva } = await supabaseClient
      .from('cuentas')
      .insert({ user_id: userId, numero_cuenta: numero, saldo: 1000000 })
      .select()
      .single();

    return nueva ? Number(nueva.saldo) : 0;
  } catch (e) {
    return 0;
  }
}

async function obtenerCuenta() {
  const userId = localStorage.getItem('user_id');
  const { data } = await supabaseClient
    .from('cuentas')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

// ============ DASHBOARD ============

async function renderDashboard() {
  const userId = localStorage.getItem('user_id');
  const saldo = await obtenerSaldo();

  const { data: solicitudes } = await supabaseClient
    .from('solicitudes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data: creditos } = await supabaseClient
    .from('creditos')
    .select('*')
    .eq('user_id', userId)
    .eq('estado', 'activo');

  const { data: movimientos } = await supabaseClient
    .from('movimientos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  let score = 742;
  if (solicitudes && solicitudes.length > 0) {
    const aprobadas = solicitudes.filter(function (s) { return s.decision === 'APROBADO'; });
    if (aprobadas.length > 0) score = aprobadas[0].score;
  }

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
        <div class="metric-value">${creditos ? creditos.length : 0}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Solicitudes</div>
        <div class="metric-value">${solicitudes ? solicitudes.length : 0}</div>
      </div>
    </div>

    <div class="app-section">
      <div class="app-section-title">Ultimos movimientos</div>
      ${movimientos && movimientos.length > 0 ? `
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid #E2E8F0;">
              <th style="padding:10px 0; color:#64748B; font-size:13px; font-weight:600;">Fecha</th>
              <th style="padding:10px 0; color:#64748B; font-size:13px; font-weight:600;">Descripcion</th>
              <th style="padding:10px 0; color:#64748B; font-size:13px; font-weight:600; text-align:right;">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${movimientos.map(function (m) {
              const signo = m.tipo === 'ingreso' ? '+' : '-';
              const color = m.tipo === 'ingreso' ? '#10B981' : '#EF4444';
              return '<tr style="border-bottom:1px solid #F1F5F9;">' +
                '<td style="padding:12px 0; font-size:14px; color:#64748B;">' + formatearFecha(m.created_at) + '</td>' +
                '<td style="padding:12px 0; font-size:14px;">' + m.descripcion + '</td>' +
                '<td style="padding:12px 0; font-size:14px; text-align:right; color:' + color + '; font-weight:600;">' + signo + formatearDinero(m.monto) + '</td>' +
                '</tr>';
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

// ============ PLACEHOLDER PARA LOS DEMAS MODULOS ============

async function renderFlowPay() {
  document.getElementById('pageContent').innerHTML = `
    <div class="app-section">
      <div class="app-section-title">FlowPay</div>
      <p style="color:#64748B;">Modulo en construccion. Lo agregamos en el siguiente paso.</p>
    </div>
  `;
}

async function renderFlowCard() {
  document.getElementById('pageContent').innerHTML = `
    <div class="app-section">
      <div class="app-section-title">FlowCard</div>
      <p style="color:#64748B;">Modulo en construccion.</p>
    </div>
  `;
}

async function renderFlowSave() {
  document.getElementById('pageContent').innerHTML = `
    <div class="app-section">
      <div class="app-section-title">FlowSave</div>
      <p style="color:#64748B;">Modulo en construccion.</p>
    </div>
  `;
}

async function renderFlowInvest() {
  document.getElementById('pageContent').innerHTML = `
    <div class="app-section">
      <div class="app-section-title">FlowInvest</div>
      <p style="color:#64748B;">Modulo en construccion.</p>
    </div>
  `;
}

async function renderFlowShield() {
  document.getElementById('pageContent').innerHTML = `
    <div class="app-section">
      <div class="app-section-title">FlowShield</div>
      <p style="color:#64748B;">Modulo en construccion.</p>
    </div>
  `;
}

async function renderFlowBusiness() {
  document.getElementById('pageContent').innerHTML = `
    <div class="app-section">
      <div class="app-section-title">FlowBusiness</div>
      <p style="color:#64748B;">Modulo en construccion.</p>
    </div>
  `;
}

async function renderFlowAnalytics() {
  document.getElementById('pageContent').innerHTML = `
    <div class="app-section">
      <div class="app-section-title">FlowAnalytics</div>
      <p style="color:#64748B;">Modulo en construccion.</p>
    </div>
  `;
}

async function renderCreditos() {
  document.getElementById('pageContent').innerHTML = `
    <div class="app-section">
      <div class="app-section-title">Creditos</div>
      <p style="color:#64748B;">Modulo en construccion.</p>
    </div>
  `;
}

async function renderVerificacion() {
  document.getElementById('pageContent').innerHTML = `
    <div class="app-section">
      <div class="app-section-title">Verificacion</div>
      <p style="color:#64748B;">Modulo en construccion.</p>
    </div>
  `;
}

async function renderNotificaciones() {
  document.getElementById('pageContent').innerHTML = `
    <div class="app-section">
      <div class="app-section-title">Notificaciones</div>
      <p style="color:#64748B;">Modulo en construccion.</p>
    </div>
  `;
}
