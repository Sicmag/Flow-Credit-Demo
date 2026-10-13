// ============================================================
// FlowBank - Landing Page Scripts
// ============================================================

document.addEventListener('DOMContentLoaded', function () {

  // ============ MENU MOVIL ============
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      navLinks.classList.toggle('active');
      menuToggle.classList.toggle('open');
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('active');
        menuToggle.classList.remove('open');
      });
    });

    document.addEventListener('click', function (e) {
      if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('active');
        menuToggle.classList.remove('open');
      }
    });
  }

  // ============ ANIMACIONES AL SCROLL ============
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.product-card, .step, .stat, .product-featured, .value-card, .team-card').forEach(function (el, i) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    el.style.transitionDelay = (i % 3) * 0.1 + 's';
    observer.observe(el);
  });

  // ============ SMOOTH SCROLL ============
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  // ============ FORMULARIO DE CONTACTO ============
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const nombre = document.getElementById('nombre').value.trim();
      const email = document.getElementById('email').value.trim();
      const mensaje = document.getElementById('mensaje').value.trim();
      const msgDiv = document.getElementById('formMessage');

      if (!nombre || !email || !mensaje) {
        msgDiv.className = 'form-message error';
        msgDiv.textContent = 'Por favor completa todos los campos.';
        return;
      }

      if (!email.includes('@')) {
        msgDiv.className = 'form-message error';
        msgDiv.textContent = 'Por favor ingresa un correo valido.';
        return;
      }

      msgDiv.className = 'form-message success';
      msgDiv.textContent = 'Gracias ' + nombre + '! Hemos recibido tu mensaje.';
      contactForm.reset();

      setTimeout(function () {
        msgDiv.className = 'form-message';
        msgDiv.textContent = '';
      }, 6000);
    });
  }

});
