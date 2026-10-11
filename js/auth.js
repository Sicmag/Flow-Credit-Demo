
// Manejo de login y registro con Supabase

document.addEventListener('DOMContentLoaded', function () {
  // Tabs
  document.querySelectorAll('.auth-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.auth-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.auth-form').forEach(function (f) { f.classList.remove('active'); });
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      document.getElementById('form' + (target === 'login' ? 'Login' : 'Registro')).classList.add('active');
    });
  });

  // LOGIN
  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    formLogin.addEventListener('submit', async function (e) {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const msg = document.getElementById('loginMessage');

      msg.className = 'form-message';
      msg.textContent = '';

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) throw error;

        localStorage.setItem('sb_access_token', data.session.access_token);
        localStorage.setItem('sb_refresh_token', data.session.refresh_token);
        localStorage.setItem('user_id', data.user.id);
        localStorage.setItem('user_email', data.user.email);

        const meta = data.user.user_metadata || {};
        if (meta.nombres || meta.apellidos) {
          await supabaseClient.from('profiles').update({
            nombres: meta.nombres || '',
            apellidos: meta.apellidos || '',
            cedula: meta.cedula || '',
            telefono: meta.telefono || '',
          }).eq('id', data.user.id);
        }

        msg.className = 'form-message success';
        msg.textContent = 'Ingresando...';

        setTimeout(function () {
          window.location.href = 'app.html';
        }, 400);
      } catch (error) {
        msg.className = 'form-message error';
        msg.textContent = 'Error: ' + (error.message || 'No se pudo iniciar sesion');
      }
    });
  }

  // REGISTRO
  const formRegistro = document.getElementById('formRegistro');
  if (formRegistro) {
    formRegistro.addEventListener('submit', async function (e) {
      e.preventDefault();
      const nombres = document.getElementById('regNombres').value.trim();
      const apellidos = document.getElementById('regApellidos').value.trim();
      const cedula = document.getElementById('regCedula').value.trim();
      const telefono = document.getElementById('regTelefono').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const msg = document.getElementById('registroMessage');

      msg.className = 'form-message';
      msg.textContent = '';

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              nombres: nombres,
              apellidos: apellidos,
              cedula: cedula,
              telefono: telefono,
            },
          },
        });

        if (error) throw error;

        msg.className = 'form-message success';
        msg.textContent = 'Cuenta creada. Revisa tu correo para confirmar.';
        formRegistro.reset();
      } catch (error) {
        msg.className = 'form-message error';
        msg.textContent = 'Error: ' + (error.message || 'No se pudo crear la cuenta');
      }
    });
  }
});

async function cerrarSesion() {
  await supabaseClient.auth.signOut();
  localStorage.clear();
  window.location.href = 'index.html';
}

async function verificarSesion() {
  const accessToken = localStorage.getItem('sb_access_token');
  const refreshToken = localStorage.getItem('sb_refresh_token');

  if (!accessToken || !refreshToken) {
    window.location.href = 'login.html';
    return null;
  }

  const { data, error } = await supabaseClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    localStorage.clear();
    window.location.href = 'login.html';
    return null;
  }

  return data.session;
}

async function obtenerDatosUsuario() {
  const userId = localStorage.getItem('user_id');
  if (!userId) return null;

  const { data } = await supabaseClient
    .from('profiles')
    .select('nombres, apellidos, cedula, telefono')
    .eq('id', userId)
    .single();

  return data;
}
