// ============================================================
// NexusPay - App Principal (SPA) - Parte 1 de 2
// Utilidades, menú, Dashboard, NexusPagos, NexusCard, Perfil
// ============================================================

let usuarioActual = null;
let datosPersonales = null;
let streamCamara = null;
let chatHistorial = [];

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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
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

  await cargarMenuPerfil();
  actualizarIconoTema();

  document.querySelectorAll('.menu-link[data-page]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navegarA(btn.getAttribute('data-page'));
    });
  });

  navegarA('dashboard');
});

// ============ MENU FULLSCREEN ============

function toggleMenu() {
  const menu = document.getElementById('appMenu');
  const btn = document.getElementById('menuBtn');
  const fab = document.getElementById('chatFab');
  if (!menu) return;

  const abierto = menu.classList.toggle('abierto');
  if (btn) btn.classList.toggle('abierto', abierto);
  if (fab) fab.classList.toggle('oculto', abierto);

  document.body.style.overflow = abierto ? 'hidden' : '';
}

function cerrarMenu() {
  const menu = document.getElementById('appMenu');
  const btn = document.getElementById('menuBtn');
  const fab = document.getElementById('chatFab');
  if (!menu) return;

  menu.classList.remove('abierto');
  if (btn) btn.classList.remove('abierto');
  if (fab) fab.classList.remove('oculto');
  document.body.style.overflow = '';
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('appMenu');
  const btn = document.getElementById('menuBtn');
  if (!menu || !menu.classList.contains('abierto')) return;
  if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
  cerrarMenu();
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    cerrarMenu();
    const chat = document.getElementById('chatWindow');
    if (chat && chat.classList.contains('open')) chat.classList.remove('open');
  }
});

async function cargarMenuPerfil() {
  const email = localStorage.getItem('user_email') || '';
  let nombre = email.split('@')[0];
  if (datosPersonales && datosPersonales.nombres) {
    nombre = (datosPersonales.nombres + ' ' + (datosPersonales.apellidos || '')).trim();
  }

  const menuNombre = document.getElementById('menuNombre');
  const menuEmail = document.getElementById('menuEmail');
  const menuSaldo = document.getElementById('menuSaldo');
  const menuAvatar = document.getElementById('menuAvatar');

  if (menuNombre) menuNombre.textContent = nombre;
  if (menuEmail) menuEmail.textContent = email;

  if (menuAvatar) {
    const userId = localStorage.getItem('user_id');
    try {
      const { data: profile } = await supabaseClient
        .from('profiles').select('foto_perfil_url').eq('id', userId).single();

      if (profile && profile.foto_perfil_url) {
        menuAvatar.innerHTML = '<img src="' + profile.foto_perfil_url + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      } else {
        const inicial = nombre.charAt(0).toUpperCase() || '👤';
        menuAvatar.textContent = inicial;
      }
    } catch (e) {
      const inicial = nombre.charAt(0).toUpperCase() || '👤';
      menuAvatar.textContent = inicial;
    }
  }

  const saldo = await obtenerSaldo();
  if (menuSaldo) menuSaldo.textContent = formatearDinero(saldo);
}

function actualizarIconoTema() {
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeToggleLabel');
  if (!icon || !label) return;
  const esOscuro = document.body.classList.contains('dark-mode');
  icon.textContent = esOscuro ? '☀️' : '🌙';
  label.textContent = esOscuro ? 'Modo claro' : 'Modo oscuro';
}

// ============ NAVEGACION ============

async function navegarA(page) {
  cerrarMenu();

  document.querySelectorAll('.menu-link').forEach(function (b) { b.classList.remove('active'); });
  const linkActivo = document.querySelector('.menu-link[data-page="' + page + '"]');
  if (linkActivo) linkActivo.classList.add('active');

  const titulos = {
    dashboard: ['Dashboard', 'Vista general de tu banco digital'],
    flowpay: ['NexusPagos', 'Transferencias digitales instantaneas'],
    flowcard: ['NexusCard', 'Tu tarjeta digital NexusPay'],
    flowsave: ['NexusSave', 'Ahorro programado para tus metas'],
    flowinvest: ['NexusInvest', 'Haz crecer tu dinero'],
    flowshield: ['NexusShield', 'Seguros digitales para emprendedores'],
    flowbusiness: ['NexusBusiness', 'Cuenta empresarial para tu negocio'],
    flowanalytics: ['NexusAnalytics', 'Analisis financiero de tu actividad'],
    nexusbox: ['NexusBox', 'Cajitas con rendimiento diario'],
    creditos: ['NexusCredit', 'Solicita tu credito con IA'],
    perfil: ['Mi perfil', 'Administra tu informacion personal'],
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
      case 'nexusbox': await renderNexusBox(); break;
      case 'creditos': await renderCreditos(); break;
      case 'perfil': await renderPerfil(); break;
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
  const menuSaldo = document.getElementById('menuSaldo');
  if (menuSaldo) menuSaldo.textContent = formatearDinero(saldo);
}

// ============ DATOS ============

async function obtenerSaldo() {
  const userId = localStorage.getItem('user_id');
  try {
    const { data } = await supabaseClient.from('cuentas').select('saldo').eq('user_id', userId).single();
    if (data) return Number(data.saldo) || 0;

    const numero = 'NP-' + userId.slice(0, 8);
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
          <div style="font-size:22px; font-weight:800; color:#2563EB;">${formatearDinero(tarjeta.cupo_disponible)}</div>
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

// ============ NEXUSBOX - CAJITAS CON RENDIMIENTO DIARIO ============

async function renderNexusBox() {
  const userId = localStorage.getItem('user_id');
  const { data: cajitas } = await supabaseClient
    .from('cajitas').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false });

  let saldoTotal = 0;
  let rendimientoTotal = 0;
  let rendimientoHoy = 0;

  if (cajitas) {
    cajitas.forEach(c => {
      saldoTotal += Number(c.saldo);
      rendimientoTotal += Number(c.rendimiento_acumulado);
      rendimientoHoy += Number(c.saldo) * Number(c.tasa_diaria);
    });
  }

  let html = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total en cajitas</div>
        <div class="metric-value">${formatearDinero(saldoTotal)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Rendimiento acumulado</div>
        <div class="metric-value text-green">+${formatearDinero(rendimientoTotal)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Rendimiento hoy</div>
        <div class="metric-value text-green">+${formatearDinero(rendimientoHoy)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Cajitas activas</div>
        <div class="metric-value">${cajitas ? cajitas.length : 0}</div>
      </div>
    </div>

    <div class="app-section" style="background: linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%); border: 2px solid #2563EB;">
      <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #2563EB, #10B981); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">🎁</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 800; color: var(--dark); margin-bottom: 4px;">Tus cajitas generan rendimiento diario</div>
          <div style="font-size: 14px; color: var(--text-light);">Guarda plata para tus metas y gana hasta 10.5% anual. Sin plazos, sin complicaciones.</div>
        </div>
      </div>
      <button class="btn-primary btn-large" style="width: 100%; justify-content: center;" onclick="abrirNuevaCajita()">
        + Crear nueva cajita
      </button>
    </div>
  `;

  if (cajitas && cajitas.length > 0) {
    html += '<div class="cajitas-grid">';
    cajitas.forEach(c => {
      const rendimientoHoyCajita = Number(c.saldo) * Number(c.tasa_diaria);
      const progreso = c.meta ? Math.min((Number(c.saldo) / Number(c.meta)) * 100, 100) : null;

      html += `
        <div class="cajita-card" style="border-left: 4px solid ${c.color || '#2563EB'};" onclick="verCajita(${c.id})">
          <div class="cajita-header">
            <div class="cajita-icono">${c.icono || '🎯'}</div>
            <div class="cajita-nombre">${escapeHtml(c.nombre)}</div>
          </div>
          <div class="cajita-saldo">${formatearDinero(c.saldo)}</div>
          <div class="cajita-rendimiento">
            <span style="color: #10B981; font-weight: 700;">+${formatearDinero(rendimientoHoyCajita)} hoy</span>
            <span style="color: var(--text-light); font-size: 13px;">+${formatearDinero(c.rendimiento_acumulado)} total</span>
          </div>
          ${c.meta ? `
            <div class="cajita-progreso">
              <div class="cajita-progreso-label">
                <span>${formatearDinero(c.saldo)}</span>
                <span>${formatearDinero(c.meta)}</span>
              </div>
              <div class="cajita-progreso-bar">
                <div class="cajita-progreso-fill" style="width: ${progreso}%; background: ${c.color || '#2563EB'};"></div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    });
    html += '</div>';
  } else {
    html += `
      <div class="app-section" style="text-align: center; padding: 48px 24px;">
        <div style="font-size: 64px; margin-bottom: 16px;">🎁</div>
        <div style="font-size: 20px; font-weight: 800; color: var(--dark); margin-bottom: 8px;">Aun no tienes cajitas</div>
        <div style="color: var(--text-light); margin-bottom: 24px;">Crea tu primera cajita y empieza a ganar rendimiento diario</div>
        <button class="btn-primary btn-large" onclick="abrirNuevaCajita()">+ Crear mi primera cajita</button>
      </div>
    `;
  }

  document.getElementById('pageContent').innerHTML = html;
}

function abrirNuevaCajita() {
  const html = `
    <div id="modalCajita" class="modal-overlay" onclick="if(event.target.id==='modalCajita') cerrarModalCajita()">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">Nueva cajita</div>
          <button class="modal-close" onclick="cerrarModalCajita()">×</button>
        </div>

        <div class="app-form-group">
          <label class="app-form-label">Nombre de la cajita</label>
          <input class="app-form-input" type="text" id="cajitaNombre" placeholder="Viaje a Japon" maxlength="40">
        </div>

        <div class="app-form-group">
          <label class="app-form-label">Icono</label>
          <div class="cajita-iconos-picker" id="cajitaIconoPicker">
            ${['🎯','🏝️','🛡️','💻','📱','🚗','🏠','🎓','💍','🎁','💰','✈️','📚','🎮','🏋️'].map(ic => 
              '<button type="button" class="cajita-icono-btn" data-icono="' + ic + '" onclick="seleccionarIcono(\'' + ic + '\')">' + ic + '</button>'
            ).join('')}
          </div>
        </div>

        <div class="app-form-group">
          <label class="app-form-label">Monto inicial (minimo $10.000)</label>
          <input class="app-form-input" type="number" id="cajitaMonto" placeholder="100000" min="10000" value="100000">
        </div>

        <div class="app-form-group">
          <label class="app-form-label">Meta (opcional)</label>
          <input class="app-form-input" type="number" id="cajitaMeta" placeholder="5000000" min="0">
        </div>

        <div class="app-form-group">
          <label class="app-form-label">Color</label>
          <div class="cajita-colores-picker">
            ${[
              {c: '#2563EB', n: 'Azul'},
              {c: '#10B981', n: 'Verde'},
              {c: '#F59E0B', n: 'Naranja'},
              {c: '#EF4444', n: 'Rojo'},
              {c: '#8B5CF6', n: 'Morado'},
              {c: '#EC4899', n: 'Rosa'},
            ].map(x => 
              '<button type="button" class="cajita-color-btn" data-color="' + x.c + '" style="background:' + x.c + ';" onclick="seleccionarColor(\'' + x.c + '\')" title="' + x.n + '"></button>'
            ).join('')}
          </div>
        </div>

        <div id="cajitaMessage"></div>

        <button class="btn-primary btn-large" style="width: 100%; justify-content: center;" onclick="crearCajita()">
          Crear cajita
        </button>
      </div>
    </div>
  `;

  const contenedor = document.createElement('div');
  contenedor.innerHTML = html;
  document.body.appendChild(contenedor.firstElementChild);

  seleccionarIcono('🎯');
  seleccionarColor('#2563EB');
}

let cajitaIconoSeleccionado = '🎯';
let cajitaColorSeleccionado = '#2563EB';

function seleccionarIcono(icono) {
  cajitaIconoSeleccionado = icono;
  document.querySelectorAll('.cajita-icono-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.getAttribute('data-icono') === icono);
  });
}

function seleccionarColor(color) {
  cajitaColorSeleccionado = color;
  document.querySelectorAll('.cajita-color-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.getAttribute('data-color') === color);
  });
}

function cerrarModalCajita() {
  const modal = document.getElementById('modalCajita');
  if (modal) modal.remove();
}

async function crearCajita() {
  const nombre = document.getElementById('cajitaNombre').value.trim();
  const monto = parseFloat(document.getElementById('cajitaMonto').value);
  const meta = parseFloat(document.getElementById('cajitaMeta').value) || null;
  const msg = document.getElementById('cajitaMessage');

  if (!nombre) {
    msg.innerHTML = mostrarAlerta('Escribe un nombre', 'error');
    return;
  }

  if (!monto || monto < 10000) {
    msg.innerHTML = mostrarAlerta('Minimo $10.000', 'error');
    return;
  }

  msg.innerHTML = '<div class="alert alert-info">Creando cajita...</div>';

  const { data, error } = await supabaseClient.rpc('crear_cajita', {
    p_nombre: nombre,
    p_icono: cajitaIconoSeleccionado,
    p_saldo_inicial: monto,
    p_meta: meta,
    p_color: cajitaColorSeleccionado,
  });

  if (error) {
    msg.innerHTML = mostrarAlerta('Error: ' + error.message, 'error');
    return;
  }

  if (data && data.success) {
    if (window.toast) toast.success('Cajita creada', nombre + ' con ' + formatearDinero(monto));
    await actualizarSaldoSidebar();
    cerrarModalCajita();
    navegarA('nexusbox');
  } else {
    msg.innerHTML = mostrarAlerta(data ? data.message : 'Error', 'error');
  }
}

async function verCajita(cajitaId) {
  const userId = localStorage.getItem('user_id');
  const { data: cajita } = await supabaseClient
    .from('cajitas').select('*').eq('id', cajitaId).eq('user_id', userId).single();

  if (!cajita) {
    if (window.toast) toast.error('No encontrada', 'Cajita no encontrada');
    return;
  }

  const { data: movimientos } = await supabaseClient
    .from('cajitas_movimientos').select('*').eq('cajita_id', cajitaId)
    .order('created_at', { ascending: false }).limit(20);

  const rendimientoHoy = Number(cajita.saldo) * Number(cajita.tasa_diaria);
  const tasaAnual = Number(cajita.tasa_diaria) * 365 * 100;
  const progreso = cajita.meta ? Math.min((Number(cajita.saldo) / Number(cajita.meta)) * 100, 100) : null;

  let html = `
    <button class="btn-secondary-sm" onclick="navegarA('nexusbox')" style="margin-bottom: 16px;">← Volver a cajitas</button>

    <div class="app-section" style="text-align: center; background: linear-gradient(135deg, ${cajita.color}15 0%, ${cajita.color}05 100%); border: 2px solid ${cajita.color};">
      <div style="font-size: 56px; margin-bottom: 8px;">${cajita.icono || '🎯'}</div>
      <div style="font-size: 20px; font-weight: 800; color: var(--dark); margin-bottom: 4px;">${escapeHtml(cajita.nombre)}</div>
      <div style="font-size: 32px; font-weight: 900; color: var(--dark); margin-bottom: 4px; letter-spacing: -1px;">${formatearDinero(cajita.saldo)}</div>
      <div style="color: #10B981; font-weight: 700; font-size: 15px;">+${formatearDinero(rendimientoHoy)} hoy</div>
      <div style="color: var(--text-light); font-size: 12px; margin-top: 4px;">Tasa: ${tasaAnual.toFixed(1)}% anual</div>
    </div>

    <div class="metrics-grid" style="grid-template-columns: 1fr 1fr;">
      <div class="metric-card">
        <div class="metric-label">Rendimiento acumulado</div>
        <div class="metric-value text-green">+${formatearDinero(cajita.rendimiento_acumulado)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Aportado total</div>
        <div class="metric-value">${formatearDinero(cajita.saldo_inicial)}</div>
      </div>
    </div>

    ${cajita.meta ? `
      <div class="app-section">
        <div class="app-section-title">Progreso hacia tu meta</div>
        <div style="display: flex; justify-content: space-between; font-size: 14px; color: var(--text-light); margin-bottom: 8px;">
          <span>${formatearDinero(cajita.saldo)}</span>
          <span>${formatearDinero(cajita.meta)}</span>
        </div>
        <div class="meta-progress-bar" style="height: 12px;">
          <div class="meta-progress-fill" style="width: ${progreso}%; background: ${cajita.color};"></div>
        </div>
        <div style="text-align: center; margin-top: 8px; font-size: 13px; color: var(--text-light);">
          ${progreso.toFixed(1)}% completado
        </div>
      </div>
    ` : ''}

    <div class="app-tabs">
      <button class="app-tab active" data-tab="meter">📥 Meter plata</button>
      <button class="app-tab" data-tab="sacar">📤 Sacar plata</button>
      <button class="app-tab" data-tab="historial-cajita">📋 Historial</button>
    </div>

    <div class="app-tab-content active" id="tab-meter">
      <div class="app-section">
        <div class="app-section-title">Meter plata a esta cajita</div>
        <div class="app-form-group">
          <label class="app-form-label">Monto (minimo $1.000)</label>
          <input class="app-form-input" type="number" id="meterMonto" placeholder="50000" min="1000" value="50000">
        </div>
        <button class="btn-primary btn-large" style="width:100%; justify-content:center;" onclick="meterPlata(${cajitaId})">
          📥 Meter a la cajita
        </button>
      </div>
    </div>

    <div class="app-tab-content" id="tab-sacar">
      <div class="app-section">
        <div class="app-section-title">Sacar plata de esta cajita</div>
        <div class="app-form-group">
          <label class="app-form-label">Monto (minimo $1.000)</label>
          <input class="app-form-input" type="number" id="sacarMonto" placeholder="50000" min="1000" value="50000">
        </div>
        <button class="btn-primary btn-large" style="width:100%; justify-content:center;" onclick="sacarPlata(${cajitaId})">
          📤 Sacar a mi cuenta
        </button>
      </div>
    </div>

    <div class="app-tab-content" id="tab-historial-cajita">
      <div class="app-section">
        <div class="app-section-title">Ultimos movimientos</div>
        ${movimientos && movimientos.length > 0 ? `
          <table class="app-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th style="text-align:right;">Monto</th></tr></thead>
            <tbody>
              ${movimientos.map(m => {
                const icono = m.tipo === 'ingreso' ? '📥' : m.tipo === 'retiro' ? '📤' : '💰';
                const clase = m.tipo === 'retiro' ? 'text-red' : 'text-green';
                const signo = m.tipo === 'retiro' ? '-' : '+';
                return '<tr><td>' + formatearFechaCorta(m.created_at) + '</td><td>' + icono + ' ' + (m.descripcion || m.tipo) + '</td><td class="' + clase + '" style="text-align:right;">' + signo + formatearDinero(m.monto) + '</td></tr>';
              }).join('')}
            </tbody>
          </table>
        ` : '<p style="color:#64748B;">No hay movimientos.</p>'}
      </div>
    </div>

    <div class="app-section">
      <button class="btn-secondary" style="width: 100%; justify-content: center; color: var(--red); border-color: var(--red);" onclick="confirmarEliminarCajita(${cajita.id}, '${escapeHtml(cajita.nombre)}', ${cajita.saldo})">
        🗑️ Eliminar cajita
      </button>
    </div>
  `;

  document.getElementById('pageContent').innerHTML = html;
  activarTabs();
}

async function meterPlata(cajitaId) {
  const monto = parseFloat(document.getElementById('meterMonto').value);
  if (!monto || monto < 1000) {
    if (window.toast) toast.error('Monto minimo', 'Minimo $1.000');
    return;
  }

  if (window.toast) toast.info('Procesando...', 'Metiendo plata a la cajita');

  const { data, error } = await supabaseClient.rpc('meter_a_cajita', {
    p_cajita_id: cajitaId,
    p_monto: monto,
  });

  if (error) {
    if (window.toast) toast.error('Error', error.message);
    return;
  }

  if (data && data.success) {
    if (window.toast) toast.success('Listo', 'Metiste ' + formatearDinero(monto));
    await actualizarSaldoSidebar();
    verCajita(cajitaId);
  } else {
    if (window.toast) toast.error('Error', data ? data.message : 'No se pudo');
  }
}

async function sacarPlata(cajitaId) {
  const monto = parseFloat(document.getElementById('sacarMonto').value);
  if (!monto || monto < 1000) {
    if (window.toast) toast.error('Monto minimo', 'Minimo $1.000');
    return;
  }

  if (window.toast) toast.info('Procesando...', 'Sacando plata de la cajita');

  const { data, error } = await supabaseClient.rpc('sacar_de_cajita', {
    p_cajita_id: cajitaId,
    p_monto: monto,
  });

  if (error) {
    if (window.toast) toast.error('Error', error.message);
    return;
  }

  if (data && data.success) {
    if (window.toast) toast.success('Listo', 'Sacaste ' + formatearDinero(monto));
    await actualizarSaldoSidebar();
    verCajita(cajitaId);
  } else {
    if (window.toast) toast.error('Error', data ? data.message : 'No se pudo');
  }
}

async function confirmarEliminarCajita(cajitaId, nombre, saldo) {
  const html = `
    <div id="modalEliminar" class="modal-overlay" onclick="if(event.target.id==='modalEliminar') cerrarModalEliminar()">
      <div class="modal-card" style="max-width: 400px;">
        <div class="modal-header">
          <div class="modal-title">Eliminar cajita</div>
          <button class="modal-close" onclick="cerrarModalEliminar()">×</button>
        </div>
        <div style="text-align: center; padding: 8px 0 16px;">
          <div style="font-size: 48px; margin-bottom: 12px;">🗑️</div>
          <div style="font-weight: 700; font-size: 16px; margin-bottom: 8px; color: var(--dark);">¿Eliminar "${nombre}"?</div>
          <div style="font-size: 14px; color: var(--text-light);">
            Se devolveran <strong>${formatearDinero(saldo)}</strong> a tu cuenta principal. Esta accion no se puede deshacer.
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button class="btn-secondary" style="flex: 1; justify-content: center;" onclick="cerrarModalEliminar()">Cancelar</button>
          <button class="btn-primary" style="flex: 1; justify-content: center; background: var(--red);" onclick="eliminarCajita(${cajitaId})">Eliminar</button>
        </div>
      </div>
    </div>
  `;

  const contenedor = document.createElement('div');
  contenedor.innerHTML = html;
  document.body.appendChild(contenedor.firstElementChild);
}

function cerrarModalEliminar() {
  const modal = document.getElementById('modalEliminar');
  if (modal) modal.remove();
}

async function eliminarCajita(cajitaId) {
  cerrarModalEliminar();

  if (window.toast) toast.info('Eliminando...', 'Cerrando la cajita');

  const { data, error } = await supabaseClient.rpc('eliminar_cajita', {
    p_cajita_id: cajitaId,
  });

  if (error) {
    if (window.toast) toast.error('Error', error.message);
    return;
  }

  if (data && data.success) {
    if (window.toast) toast.success('Cajita eliminada', 'El saldo volvio a tu cuenta');
    await actualizarSaldoSidebar();
    navegarA('nexusbox');
  } else {
    if (window.toast) toast.error('Error', data ? data.message : 'No se pudo');
  }
}

// ⬇️ CONTINUA EN LA PARTE 2 ⬇️
// ============================================================
// NexusPay - App Principal (SPA) - Parte 3 de 3
// NexusSave, NexusInvest, NexusShield, NexusBusiness,
// NexusAnalytics, NexusCredit, Verificacion, Notificaciones,
// Chat Luci (Gemini)
// ============================================================

// ============ NEXUSSAVE ============

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
  if (!nombre || !objetivo) {
    if (window.toast) toast.error('Campos incompletos', 'Nombre y monto son obligatorios');
    return;
  }
  await supabaseClient.from('metas_ahorro').insert({ user_id: userId, nombre, monto_objetivo: objetivo, fecha_limite: fecha, icono });
  if (window.toast) toast.success('Meta creada', nombre + ' por ' + formatearDinero(objetivo));
  navegarA('flowsave');
}

async function aportarMeta(metaId) {
  const input = document.getElementById('aporte-' + metaId);
  const monto = parseFloat(input.value);
  if (!monto || monto <= 0) {
    if (window.toast) toast.error('Monto invalido', 'Ingresa un monto mayor a 0');
    return;
  }
  const { data } = await supabaseClient.from('metas_ahorro').select('monto_actual').eq('id', metaId).single();
  const actual = data ? Number(data.monto_actual) : 0;
  await supabaseClient.from('metas_ahorro').update({ monto_actual: actual + monto }).eq('id', metaId);
  if (window.toast) toast.success('Aporte registrado', formatearDinero(monto) + ' guardados');
  navegarA('flowsave');
}

// ============ NEXUSINVEST ============

async function renderFlowInvest() {
  const userId = localStorage.getItem('user_id');
  const { data: inversiones } = await supabaseClient.from('inversiones').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  const saldo = await obtenerSaldo();

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
    '<div class="metric-card"><div class="metric-label">Saldo libre</div><div class="metric-value">' + formatearDinero(saldo) + '</div></div>' +
    '</div>';

  html += `
    <div class="app-section" style="background: linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%); border: 2px solid #2563EB;">
      <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #2563EB, #10B981); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">💡</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 800; color: var(--dark); margin-bottom: 4px;">Luci puede recomendarte una inversion</div>
          <div style="font-size: 14px; color: var(--text-light);">Analiza tu saldo, tu score crediticio y tu perfil para sugerirte la mejor opcion.</div>
        </div>
      </div>
      <button class="btn-primary" style="width: 100%; justify-content: center;" onclick="recomendarInversion()">
        ✨ Analizar con Luci
      </button>
      <div id="recomendacionLuci" style="margin-top: 16px;"></div>
    </div>
  `;

  html += '<div class="app-tabs"><button class="app-tab active" data-tab="mis-inv">Mis inversiones</button><button class="app-tab" data-tab="nueva-inv">Invertir</button></div><div class="app-tab-content active" id="tab-mis-inv">';

  if (inversiones && inversiones.length > 0) {
    inversiones.forEach(inv => {
      html += '<div class="product-item"><div class="product-item-info"><h4>' + inv.producto + '</h4><p>Rendimiento anual: ' + inv.rendimiento_anual + '%</p></div><div class="product-item-price">' + formatearDinero(inv.monto_invertido) + '</div></div>';
    });
  } else {
    html += '<div class="app-section"><p style="color:#64748B;">Aun no tienes inversiones.</p></div>';
  }

  html += '</div><div class="app-tab-content" id="tab-nueva-inv"><div class="app-section"><div class="app-section-title">Productos disponibles</div>';

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
  if (!monto || monto < 100000) {
    if (window.toast) toast.error('Monto minimo', 'Minimo $100.000');
    return;
  }
  const saldo = await obtenerSaldo();
  if (saldo < monto) {
    if (window.toast) toast.error('Saldo insuficiente', 'No tienes suficiente dinero');
    return;
  }
  await supabaseClient.from('inversiones').insert({ user_id: userId, producto, monto_invertido: monto, rendimiento_anual: rend, valor_actual: monto });
  await supabaseClient.rpc('retirar_saldo', { p_monto: monto });
  await actualizarSaldoSidebar();
  if (window.toast) toast.success('Inversion creada', producto + ' por ' + formatearDinero(monto));
  navegarA('flowinvest');
}

// ============ LUCI: RECOMENDACION DE INVERSION (GEMINI) ============

async function recomendarInversion() {
  if (window.toast) toast.info('Analizando...', 'Luci esta revisando tu perfil');

  const contenedor = document.getElementById('recomendacionLuci');
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const userId = localStorage.getItem('user_id');
    const saldo = await obtenerSaldo();

    const { data: solicitudes } = await supabaseClient
      .from('solicitudes').select('score, decision, ingresos_mensuales, tipo_negocio')
      .eq('user_id', userId).eq('decision', 'APROBADO')
      .order('created_at', { ascending: false }).limit(1);

    const { data: inversiones } = await supabaseClient
      .from('inversiones').select('*').eq('user_id', userId);

    const { data: movimientos } = await supabaseClient
      .from('movimientos').select('tipo, monto')
      .eq('user_id', userId).eq('tipo', 'ingreso')
      .order('created_at', { ascending: false }).limit(30);

    let ingresosReales = 0;
    if (movimientos && movimientos.length > 0) {
      const totalMovs = movimientos.reduce((s, m) => s + Number(m.monto), 0);
      ingresosReales = Math.round(totalMovs / Math.max(movimientos.length, 1));
    }

    const score = (solicitudes && solicitudes.length > 0) ? solicitudes[0].score : 500;
    const perfilNegocio = (solicitudes && solicitudes.length > 0) ? solicitudes[0].tipo_negocio : 'Freelancer';
    const ingresosDeclarados = (solicitudes && solicitudes.length > 0) ? solicitudes[0].ingresos_mensuales : ingresosReales;

    const totalInvertido = (inversiones || []).reduce((s, i) => s + Number(i.monto_invertido), 0);
    const numInversiones = inversiones ? inversiones.length : 0;

    const prompt = `Eres Luci, la asistente financiera de NexusPay. Recomienda UNA inversion personalizada a un emprendedor digital colombiano.

DATOS DEL USUARIO:
- Nombre: ${datosPersonales?.nombres || 'Emprendedor'}
- Saldo disponible: ${formatearDinero(saldo)} COP
- Score crediticio: ${score}/1000
- Tipo de negocio: ${perfilNegocio}
- Ingresos mensuales declarados: ${formatearDinero(ingresosDeclarados)} COP
- Ingresos reales promedio: ${formatearDinero(ingresosReales)} COP
- Inversiones actuales: ${numInversiones} por ${formatearDinero(totalInvertido)} COP

PRODUCTOS DISPONIBLES:
1. CDT Digital - 10.5% anual - Bajo riesgo - Plazo 90 dias
2. Fondo Conservador - 12.0% anual - Riesgo medio - Liquidez inmediata
3. Fondo Crecimiento - 15.5% anual - Riesgo alto - Plazo 1 año
4. Portafolio Emprendedor - 18.0% anual - Riesgo muy alto - Diversificado

REGLAS:
- Saldo menor a $200.000: recomendar NO invertir, sugerir ahorrar
- Score mayor a 750 y saldo mayor a $1.000.000: opciones agresivas
- Score menor a 600: opciones conservadoras
- Nunca mas del 40% del saldo

Responde SOLO con este formato JSON valido, sin markdown, sin texto extra:

{
  "perfil_riesgo": "conservador",
  "producto_recomendado": "CDT Digital",
  "monto_sugerido": 500000,
  "porcentaje_saldo": 25,
  "plazo_recomendado": "90 dias",
  "rendimiento_estimado_anual": 10.5,
  "ganancia_estimada_anual": 52500,
  "razon": "explicacion corta",
  "alternativa": "producto alternativo",
  "advertencia": "advertencia breve"
}`;

    const response = await fetch(CONFIG.URL_GEMINI + CONFIG.MODELO_GEMINI + ':generateContent?key=' + CONFIG.GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 600,
          responseMimeType: "application/json"
        }
      }),
    });

    const result = await response.json();

    if (!result.candidates || !result.candidates[0]) {
      const errMsg = result.error?.message || 'Error al consultar IA';
      throw new Error(errMsg);
    }

    let rec;
    const texto = result.candidates[0].content.parts[0].text;
    try {
      rec = JSON.parse(texto);
    } catch (e) {
      const match = texto.match(/\{[\s\S]*\}/);
      rec = match ? JSON.parse(match[0]) : null;
    }

    if (!rec) throw new Error('Respuesta IA invalida');

    contenedor.innerHTML = `
      <div style="background: linear-gradient(135deg, #2563EB, #10B981); color: #FFFFFF; padding: 24px; border-radius: 16px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 22px;">💡</div>
          <div>
            <div style="font-weight: 800; font-size: 16px;">Recomendacion de Luci</div>
            <div style="font-size: 13px; opacity: 0.85;">Basada en tu saldo y perfil</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 10px;">
            <div style="font-size: 11px; opacity: 0.85; margin-bottom: 4px;">PERFIL</div>
            <div style="font-weight: 800; font-size: 15px; text-transform: capitalize;">${rec.perfil_riesgo || 'moderado'}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 10px;">
            <div style="font-size: 11px; opacity: 0.85; margin-bottom: 4px;">PRODUCTO</div>
            <div style="font-weight: 800; font-size: 15px;">${rec.producto_recomendado || 'N/A'}</div>
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.15); padding: 16px; border-radius: 12px; margin-bottom: 12px;">
          <div style="font-size: 11px; opacity: 0.85; margin-bottom: 6px;">MONTO SUGERIDO</div>
          <div style="font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">${formatearDinero(rec.monto_sugerido || 0)}</div>
          <div style="font-size: 12px; opacity: 0.85; margin-top: 4px;">${rec.porcentaje_saldo || 0}% de tu saldo disponible</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px;">
          <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 10px; text-align: center;">
            <div style="font-size: 10px; opacity: 0.85; margin-bottom: 2px;">PLAZO</div>
            <div style="font-weight: 700; font-size: 13px;">${rec.plazo_recomendado || 'N/A'}</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 10px; text-align: center;">
            <div style="font-size: 10px; opacity: 0.85; margin-bottom: 2px;">RENDIMIENTO</div>
            <div style="font-weight: 700; font-size: 13px;">${rec.rendimiento_estimado_anual || 0}%</div>
          </div>
          <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 10px; text-align: center;">
            <div style="font-size: 10px; opacity: 0.85; margin-bottom: 2px;">GANANCIA/AÑO</div>
            <div style="font-weight: 700; font-size: 13px;">${formatearDinero(rec.ganancia_estimada_anual || 0)}</div>
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.15); padding: 14px; border-radius: 12px;">
          <div style="font-weight: 700; margin-bottom: 6px; font-size: 13px;">💬 ¿Por qué?</div>
          <div style="font-size: 13px; line-height: 1.6;">${rec.razon || ''}</div>
        </div>
      </div>

      ${rec.alternativa ? `
        <div style="background: var(--bg-soft); padding: 14px; border-radius: 12px; margin-bottom: 12px; border: 1px solid var(--border);">
          <div style="font-size: 12px; color: var(--text-light); margin-bottom: 4px;">Alternativa</div>
          <div style="font-weight: 700; color: var(--text);">${rec.alternativa}</div>
        </div>
      ` : ''}

      ${rec.advertencia ? `
        <div class="alert alert-warning" style="margin-bottom: 16px;">
          <strong>⚠️ Advertencia:</strong> ${rec.advertencia}
        </div>
      ` : ''}

      <button class="btn-primary btn-large" style="width:100%; justify-content:center;" onclick="aplicarRecomendacion(${rec.monto_sugerido || 0}, '${(rec.producto_recomendado || '').replace(/'/g, "\\'")}')">
        Invertir ${formatearDinero(rec.monto_sugerido || 0)} en ${rec.producto_recomendado || 'este producto'}
      </button>
    `;

    if (window.toast) toast.success('Recomendacion lista', 'Revisa la sugerencia de Luci');

  } catch (e) {
    console.error('Error recomendacion:', e);
    contenedor.innerHTML = `
      <div class="alert alert-error">
        <strong>Error:</strong> ${e.message}
      </div>
      <button class="btn-primary" onclick="recomendarInversion()">Intentar de nuevo</button>
    `;
    if (window.toast) toast.error('Error', e.message);
  }
}

function aplicarRecomendacion(monto, producto) {
  const montoInput = document.getElementById('invMonto');
  const selectProducto = document.getElementById('invProducto');

  if (montoInput) montoInput.value = monto;

  if (selectProducto && producto) {
    const opciones = selectProducto.options;
    for (let i = 0; i < opciones.length; i++) {
      if (opciones[i].value.toLowerCase().includes(producto.toLowerCase().split(' ')[0])) {
        selectProducto.selectedIndex = i;
        break;
      }
    }
  }

  if (window.toast) toast.success('Aplicado', 'Revisa el formulario y confirma la inversion');

  const formInv = document.querySelector('#tab-nueva-inv');
  if (formInv) formInv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============ NEXUSSHIELD ============

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
  if (window.toast) toast.success('Poliza contratada', 'Seguro de ' + tipo + ' activo');
  navegarA('flowshield');
}

// ============ NEXUSBUSINESS ============

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
    '<button class="btn-primary btn-large" style="width:100%;justify-content:center;" onclick="crearEmpresa()">Crear cuenta</button></div></div>';

  document.getElementById('pageContent').innerHTML = html;
  activarTabs();
}

async function crearEmpresa() {
  const userId = localStorage.getItem('user_id');
  const nombre = document.getElementById('empNombre').value;
  const nit = document.getElementById('empNit').value;
  const categoria = document.getElementById('empCategoria').value;
  if (!nombre) {
    if (window.toast) toast.error('Falta nombre', 'Escribe el nombre del negocio');
    return;
  }
  await supabaseClient.from('cuentas_empresariales').insert({ user_id: userId, nombre_negocio: nombre, nit, categoria, saldo: 0 });
  if (window.toast) toast.success('Cuenta empresarial creada', nombre);
  navegarA('flowbusiness');
}

// ============ NEXUSANALYTICS ============

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

// ============ NEXUSCREDIT ============

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
  if (window.toast) toast.info('Analizando...', 'La IA esta revisando tu solicitud');

  const datos = {
    tipo: document.getElementById('credTipo').value,
    ingresos: parseFloat(document.getElementById('credIngresos').value),
    meses: parseInt(document.getElementById('credMeses').value),
    monto: parseFloat(document.getElementById('credMonto').value),
    plazo: parseInt(document.getElementById('credPlazo').value),
    historial: document.getElementById('credHistorial').value,
  };

  const prompt = `Eres un analista de riesgo crediticio. Analiza esta solicitud de microcredito para un emprendedor digital colombiano.

DATOS:
- Tipo de negocio: ${datos.tipo}
- Ingresos mensuales: ${datos.ingresos} COP
- Meses con el negocio: ${datos.meses}
- Monto solicitado: ${datos.monto} COP
- Plazo: ${datos.plazo} dias
- Historial: ${datos.historial}

Responde SOLO con este formato, sin markdown, sin texto extra:

SCORE: <numero 0-1000>
DECISION: <APROBADO | REVISION | RECHAZADO>
MONTO_APROBADO: <numero>
TASA_ANUAL: <numero>
RAZON_1: <texto corto>
RAZON_2: <texto corto>
RAZON_3: <texto corto>

REGLAS:
- RECHAZADO: MONTO_APROBADO = 0 y TASA = 0
- REVISION: monto maximo 1x ingresos, tasa 18-22%
- APROBADO: monto entre 1x y 5x ingresos, tasa 8-16%
- Score: rechazado menor 500, revision 500-700, aprobado mayor 700`;

  try {
    const response = await fetch(CONFIG.URL_GEMINI + CONFIG.MODELO_GEMINI + ':generateContent?key=' + CONFIG.GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
      }),
    });

    const result = await response.json();

    if (!result.candidates || !result.candidates[0]) {
      const errMsg = result.error?.message || 'Error al consultar IA';
      throw new Error(errMsg);
    }

    const texto = result.candidates[0].content.parts[0].text;

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

    await crearNotificacion(userId, '📋 Solicitud procesada', 'Score: ' + score + ' - ' + decision, decision === 'APROBADO' ? 'success' : 'info');

    if (window.toast) {
      const tipo = decision === 'APROBADO' ? 'success' : decision === 'RECHAZADO' ? 'error' : 'warning';
      const titulo = decision === 'APROBADO' ? 'Credito aprobado' : decision === 'RECHAZADO' ? 'Credito rechazado' : 'En revision';
      toast[tipo](titulo, 'Score: ' + score + (montoAprobado > 0 ? ' · ' + formatearDinero(montoAprobado) : ''));
    }
    setTimeout(() => navegarA('creditos'), 2000);
  } catch (e) {
    if (window.toast) toast.error('Error IA', e.message);
  }
}

// ============ CONTRATO PDF ============

async function generarContratoPDF(creditoId) {
  const userId = localStorage.getItem('user_id');
  const { data: credito } = await supabaseClient.from('creditos').select('*').eq('id', creditoId).single();
  const { data: cuotas } = await supabaseClient.from('cuotas').select('*').eq('credito_id', creditoId).order('numero');
  const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
  if (!credito) {
    if (window.toast) toast.error('No encontrado', 'Credito no encontrado');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text('NEXUSPAY', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Contrato de Microcredito Digital', 105, 27, { align: 'center' });
  doc.setDrawColor(37, 99, 235);
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

  doc.save('contrato_nexuspay_' + creditoId + '.pdf');
  if (window.toast) toast.success('PDF descargado', 'Contrato #' + creditoId);
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
    '<div style="text-align:center;"><video id="videoCam" autoplay playsinline muted style="width:100%;max-width:400px;border-radius:16px;background:#000;display:block;margin:0 auto 16px;"></video><canvas id="canvasFoto" style="display:none;"></canvas>' +
    '<div style="margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">' +
    '<button class="btn-primary" onclick="iniciarCamara()">📸 Activar camara</button>' +
    '<button class="btn-primary" onclick="capturarFoto(\'' + userId + '\')">✅ Tomar foto</button>' +
    '</div></div>' +
    '</div>';

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
    if (window.toast) toast.info('Camara activa', 'Ubicate bien y presiona Tomar foto');
  } catch (e) {
    if (window.toast) toast.error('Sin acceso a camara', e.message);
  }
}

async function capturarFoto(userId) {
  const video = document.getElementById('videoCam');
  const canvas = document.getElementById('canvasFoto');
  if (!video.srcObject) {
    if (window.toast) toast.error('Camara apagada', 'Primero activa la camara');
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  if (window.toast) toast.info('Procesando...', 'Guardando foto');

  canvas.toBlob(async function (blob) {
    const fileName = userId + '_' + Date.now() + '.jpg';
    const { error } = await supabaseClient.storage.from('verificaciones').upload(fileName, blob, { contentType: 'image/jpeg' });
    if (error) {
      if (window.toast) toast.error('Error al subir', error.message);
      return;
    }
    const { data: publicData } = supabaseClient.storage.from('verificaciones').getPublicUrl(fileName);
    await supabaseClient.from('profiles').update({
      foto_verificacion_url: publicData.publicUrl,
      verificacion_estado: 'verificado',
      verificacion_fecha: new Date().toISOString(),
      verificado: true,
    }).eq('id', userId);
    if (streamCamara) streamCamara.getTracks().forEach(t => t.stop());
    if (window.toast) toast.success('Verificacion completada', 'Tu identidad fue verificada');
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
  if (window.toast) toast.success('Codigo generado', 'Guardalo en un lugar seguro');
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
  if (window.toast) toast.success('Notificaciones leidas', 'Todas marcadas como leidas');
  navegarA('notificaciones');
}

// ============ CHAT CON LUCI (GEMINI) ============

function toggleChat() {
  document.getElementById('chatWindow').classList.toggle('open');
}

async function enviarChat() {
  const input = document.getElementById('chatInput');
  const mensaje = input.value.trim();
  if (!mensaje) return;

  const mensajes = document.getElementById('chatMessages');

  mensajes.innerHTML += '<div class="chat-message chat-user">' + escapeHtml(mensaje) + '</div>';
  input.value = '';
  mensajes.scrollTop = mensajes.scrollHeight;

  const loading = document.createElement('div');
  loading.className = 'chat-message chat-bot chat-loading';
  loading.textContent = 'Luci esta escribiendo...';
  loading.id = 'chatLoading';
  mensajes.appendChild(loading);
  mensajes.scrollTop = mensajes.scrollHeight;

  try {
    const saldo = await obtenerSaldo();
    const nombre = (datosPersonales && datosPersonales.nombres) ? datosPersonales.nombres : 'Emprendedor';

    const systemPrompt = `Eres ${CONFIG.ASISTENTE_NOMBRE}, la asistente virtual de NexusPay, un banco digital colombiano para emprendedores.

PERSONALIDAD:
- Te llamas ${CONFIG.ASISTENTE_NOMBRE}. Eres cálida, cercana y eficiente.
- Hablas en español y tuteas al usuario
- Máximo 3 líneas por respuesta
- Usas emojis con moderación (1-2 máximo)
- Nunca inventas datos, solo usas la info real

CONTEXTO DEL USUARIO:
- Nombre: ${nombre}
- Saldo disponible: ${formatearDinero(saldo)}

PRODUCTOS DE NEXUSPAY:
- NexusCredit: microcréditos con IA, hasta $5.000.000, tasa desde 8% anual
- NexusPagos: transferencias, recargas, retiros, pago de servicios
- NexusCard: tarjeta débito digital con cupo de $3.000.000
- NexusSave: ahorro programado con metas
- NexusInvest: portafolios del 10% al 18% anual
- NexusShield: seguros desde $12.000/mes
- NexusBusiness: cuenta empresarial con NIT
- NexusAnalytics: análisis financiero
- NexusBox: cajitas con rendimiento diario del 10.5% anual

Responde de forma útil, breve y con la personalidad de Luci.`;

    const historialTexto = chatHistorial.slice(-6).map(m => {
      const quien = m.rol === 'user' ? 'Usuario' : 'Luci';
      return quien + ': ' + m.texto;
    }).join('\n');

    const promptCompleto = systemPrompt + '\n\n' +
      (historialTexto ? 'CONVERSACION PREVIA:\n' + historialTexto + '\n\n' : '') +
      'Usuario: ' + mensaje;

    const response = await fetch(CONFIG.URL_GEMINI + CONFIG.MODELO_GEMINI + ':generateContent?key=' + CONFIG.GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptCompleto }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 250 }
      }),
    });

    const result = await response.json();

    if (!result.candidates || !result.candidates[0]) {
      const errMsg = result.error?.message || 'Error al consultar IA';
      throw new Error(errMsg);
    }

    const respuesta = result.candidates[0].content.parts[0].text;

    const loadingEl = document.getElementById('chatLoading');
    if (loadingEl) loadingEl.remove();

    chatHistorial.push({ rol: 'user', texto: mensaje });
    chatHistorial.push({ rol: 'bot', texto: respuesta });
    if (chatHistorial.length > 10) chatHistorial = chatHistorial.slice(-10);

    mensajes.innerHTML += '<div class="chat-message chat-bot">' + escapeHtml(respuesta) + '</div>';
    mensajes.scrollTop = mensajes.scrollHeight;

  } catch (e) {
    const loadingEl = document.getElementById('chatLoading');
    if (loadingEl) loadingEl.remove();
    console.error('Error chat:', e);

    let msgError = 'Lo siento, hubo un error.';
    if (e.message.includes('API_KEY') || e.message.includes('401') || e.message.includes('403')) {
      msgError = 'La API key de Luci no es valida.';
    } else if (e.message.includes('429')) {
      msgError = 'Luci esta muy ocupada. Intenta en un momento.';
    } else if (e.message.includes('503') || e.message.includes('UNAVAILABLE')) {
      msgError = 'Luci esta saturada. Intenta en un minuto.';
    } else if (e.message.includes('model')) {
      msgError = 'Error de configuracion del modelo.';
    }

    mensajes.innerHTML += '<div class="chat-message chat-bot">' + msgError + '</div>';
    mensajes.scrollTop = mensajes.scrollHeight;

    if (window.toast) toast.error('Error en chat', msgError);
  }
}

// ============ FIN DEL ARCHIVO ============
