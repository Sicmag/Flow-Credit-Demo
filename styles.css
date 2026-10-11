* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --purple: #820AD1;
  --purple-dark: #6B08AE;
  --purple-light: #A855F7;
  --green: #10B981;
  --red: #EF4444;
  --yellow: #F59E0B;
  --dark: #0F0F1E;
  --text: #1E293B;
  --text-light: #64748B;
  --bg-soft: #F8FAFC;
  --border: #E2E8F0;
}

html { scroll-behavior: smooth; }

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--text);
  background: #FFFFFF;
  line-height: 1.6;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* NAVBAR */
.navbar {
  position: sticky;
  top: 0;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  z-index: 1000;
  padding: 16px 0;
}
.nav-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.logo {
  font-size: 24px;
  font-weight: 900;
  color: var(--dark);
  letter-spacing: -0.5px;
  text-decoration: none;
}
.logo span {
  background: linear-gradient(135deg, var(--purple) 0%, var(--purple-light) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.nav-links {
  display: flex;
  gap: 32px;
  align-items: center;
}
.nav-links a {
  color: var(--text);
  text-decoration: none;
  font-weight: 500;
  font-size: 15px;
  transition: color 0.2s;
}
.nav-links a:hover, .nav-links a.active { color: var(--purple); }
.menu-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  flex-direction: column;
  gap: 5px;
  padding: 6px;
}
.menu-toggle span {
  width: 24px;
  height: 2.5px;
  background: var(--dark);
  border-radius: 2px;
}

/* BUTTONS */
.btn-primary {
  background: var(--purple);
  color: #FFFFFF;
  padding: 12px 28px;
  border-radius: 100px;
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  cursor: pointer;
}
.btn-primary:hover {
  background: var(--purple-dark);
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(130,10,209,0.3);
}
.btn-secondary {
  background: #FFFFFF;
  color: var(--dark);
  padding: 12px 28px;
  border-radius: 100px;
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
  border: 2px solid var(--border);
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.btn-secondary:hover { border-color: var(--purple); color: var(--purple); }
.btn-white {
  background: #FFFFFF;
  color: var(--purple);
  padding: 16px 40px;
  border-radius: 100px;
  text-decoration: none;
  font-weight: 700;
  font-size: 17px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
}
.btn-white:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}
.btn-large { padding: 16px 32px; font-size: 16px; }

/* HERO */
.hero {
  padding: 80px 0 100px;
  background: linear-gradient(180deg, #FFFFFF 0%, #FAF5FF 100%);
  position: relative;
  overflow: hidden;
}
.hero::before {
  content: '';
  position: absolute;
  top: -200px; right: -200px;
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(130,10,209,0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
.hero-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
  position: relative;
  z-index: 1;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(130,10,209,0.08);
  color: var(--purple);
  padding: 8px 16px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 24px;
}
.dot {
  width: 8px; height: 8px;
  background: var(--purple);
  border-radius: 50%;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%,100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
.hero h1 {
  font-size: 56px;
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: -2px;
  margin-bottom: 24px;
  color: var(--dark);
}
.gradient-text {
  background: linear-gradient(135deg, var(--purple) 0%, var(--purple-light) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero p {
  font-size: 18px;
  color: var(--text-light);
  margin-bottom: 32px;
  max-width: 500px;
}
.hero-cta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 40px;
}
.hero-features { display: flex; gap: 24px; flex-wrap: wrap; }
.hero-feature {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-light);
  font-weight: 500;
}

/* CARD MOCKUP */
.card-mockup {
  background: #FFFFFF;
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 30px 80px rgba(15,15,30,0.15);
  transform: rotate(-2deg);
  transition: transform 0.3s;
}
.card-mockup:hover { transform: rotate(0deg) scale(1.02); }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.card-brand { font-weight: 900; color: var(--purple); font-size: 14px; letter-spacing: 1px; }
.card-status {
  background: #D1FAE5;
  color: #059669;
  padding: 4px 12px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 700;
}
.card-amount {
  font-size: 42px;
  font-weight: 900;
  color: var(--dark);
  margin-bottom: 8px;
  letter-spacing: -1px;
}
.card-label { color: var(--text-light); font-size: 14px; margin-bottom: 24px; }
.card-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.detail-label { font-size: 12px; color: var(--text-light); margin-bottom: 4px; }
.detail-value { font-size: 18px; font-weight: 700; color: var(--dark); }

/* STATS */
.stats { padding: 60px 0; border-bottom: 1px solid var(--border); }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 40px;
}
.stat { text-align: center; }
.stat-value {
  font-size: 42px;
  font-weight: 900;
  color: var(--dark);
  letter-spacing: -1px;
  margin-bottom: 8px;
}
.stat-label { color: var(--text-light); font-size: 14px; }

/* SECTIONS */
.section {
  padding: 100px 0;
}
.section-alt {
  padding: 100px 0;
  background: var(--bg-soft);
}
.section-header {
  text-align: center;
  margin-bottom: 60px;
}
.section-header h2 {
  font-size: 44px;
  font-weight: 900;
  color: var(--dark);
  letter-spacing: -1.5px;
  margin-bottom: 16px;
}
.section-header p {
  color: var(--text-light);
  font-size: 18px;
  max-width: 600px;
  margin: 0 auto;
}

/* PAGE HEADER (para productos, nosotros, contacto) */
.page-header {
  padding: 80px 0 60px;
  background: linear-gradient(180deg, #FFFFFF 0%, #FAF5FF 100%);
  text-align: center;
}
.page-header h1 {
  font-size: 56px;
  font-weight: 900;
  letter-spacing: -2px;
  margin-bottom: 16px;
  color: var(--dark);
}
.page-header p {
  font-size: 18px;
  color: var(--text-light);
  max-width: 600px;
  margin: 0 auto;
}

/* PRODUCTS */
.product-featured {
  background: linear-gradient(135deg, var(--dark) 0%, #1E1B4B 100%);
  border-radius: 24px;
  padding: 60px;
  color: #FFFFFF;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 60px;
  align-items: center;
  margin-bottom: 32px;
}
.featured-badge {
  display: inline-block;
  background: linear-gradient(135deg, var(--purple) 0%, var(--purple-light) 100%);
  color: #FFFFFF;
  padding: 6px 14px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin-bottom: 16px;
}
.product-featured h3 { color: #FFFFFF; font-size: 36px; font-weight: 900; margin-bottom: 16px; }
.product-featured p { color: rgba(255,255,255,0.7); font-size: 16px; margin-bottom: 24px; }
.featured-visual { text-align: center; }
.featured-icon { font-size: 120px; margin-bottom: 24px; }
.featured-stats { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.featured-stat { background: rgba(255,255,255,0.1); padding: 12px 24px; border-radius: 12px; }
.fs-label { font-size: 12px; opacity: 0.7; margin-bottom: 4px; }
.fs-value { font-size: 20px; font-weight: 800; }

.products-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
.product-card {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 32px;
  transition: all 0.3s;
  border: 2px solid transparent;
}
.product-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 60px rgba(15,15,30,0.1);
  border-color: rgba(130,10,209,0.2);
}
.product-icon {
  width: 56px; height: 56px;
  background: rgba(130,10,209,0.1);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.product-card h3 {
  font-size: 20px;
  font-weight: 800;
  color: var(--dark);
  margin-bottom: 12px;
}
.product-card p { color: var(--text-light); font-size: 15px; line-height: 1.6; margin-bottom: 16px; }
.product-tag {
  display: inline-block;
  background: rgba(16,185,129,0.1);
  color: var(--green);
  padding: 4px 12px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 700;
}

/* HOW */
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px;
  margin-top: 60px;
}
.step { text-align: center; }
.step-number {
  width: 64px; height: 64px;
  background: linear-gradient(135deg, var(--purple) 0%, var(--purple-light) 100%);
  color: #FFFFFF;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 900;
  margin: 0 auto 24px;
  box-shadow: 0 10px 30px rgba(130,10,209,0.3);
}
.step h3 { font-size: 20px; font-weight: 800; color: var(--dark); margin-bottom: 12px; }
.step p { color: var(--text-light); font-size: 15px; }

/* TEAM */
.team-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}
.team-card {
  text-align: center;
  padding: 32px;
  background: #FFFFFF;
  border-radius: 20px;
  border: 1px solid var(--border);
  transition: all 0.3s;
}
.team-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(15,15,30,0.1); }
.team-avatar {
  width: 100px; height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--purple) 0%, var(--purple-light) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  font-size: 40px;
  color: #FFFFFF;
  font-weight: 900;
}
.team-card h3 { font-size: 20px; font-weight: 800; margin-bottom: 6px; color: var(--dark); }
.team-role { color: var(--purple); font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.team-bio { color: var(--text-light); font-size: 14px; }

/* VALUES */
.values-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}
.value-card {
  padding: 32px;
  background: #FFFFFF;
  border-radius: 20px;
  border: 1px solid var(--border);
}
.value-icon {
  width: 56px; height: 56px;
  background: rgba(130,10,209,0.1);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  font-size: 28px;
}
.value-card h3 { font-size: 20px; font-weight: 800; margin-bottom: 12px; color: var(--dark); }
.value-card p { color: var(--text-light); font-size: 15px; line-height: 1.6; }

/* CONTACT */
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: start;
}
.contact-info {
  padding: 32px;
  background: var(--bg-soft);
  border-radius: 20px;
}
.contact-info h3 { font-size: 24px; font-weight: 800; margin-bottom: 16px; }
.contact-info p { color: var(--text-light); margin-bottom: 24px; }
.contact-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}
.contact-icon {
  width: 44px; height: 44px;
  background: #FFFFFF;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
}
.contact-item strong { display: block; margin-bottom: 4px; color: var(--dark); }
.contact-item span { color: var(--text-light); font-size: 14px; }

.form-group { margin-bottom: 20px; }
.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--dark);
}
.form-input,
.form-textarea {
  width: 100%;
  padding: 14px 18px;
  border: 2px solid var(--border);
  border-radius: 12px;
  font-family: inherit;
  font-size: 15px;
  transition: all 0.2s;
  background: #FFFFFF;
}
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(130,10,209,0.1);
}
.form-textarea {
  resize: vertical;
  min-height: 140px;
}
.form-message {
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
  font-weight: 500;
  display: none;
}
.form-message.success {
  background: #D1FAE5;
  color: #059669;
  display: block;
}
.form-message.error {
  background: #FEE2E2;
  color: #DC2626;
  display: block;
}

/* INGRESAR */
.ingresar-wrapper {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  background: linear-gradient(180deg, #FFFFFF 0%, #FAF5FF 100%);
}
.ingresar-card {
  background: #FFFFFF;
  border-radius: 24px;
  padding: 48px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 30px 80px rgba(15,15,30,0.1);
  text-align: center;
}
.ingresar-icon {
  width: 80px; height: 80px;
  background: linear-gradient(135deg, var(--purple) 0%, var(--purple-light) 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  font-size: 40px;
  color: #FFFFFF;
}
.ingresar-card h1 {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: -1px;
  margin-bottom: 12px;
}
.ingresar-card p {
  color: var(--text-light);
  margin-bottom: 32px;
  line-height: 1.6;
}
.ingresar-features {
  text-align: left;
  margin: 32px 0;
}
.ingresar-feature {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-size: 15px;
}
.ingresar-feature:last-child { border-bottom: none; }
.ingresar-feature svg { flex-shrink: 0; }

/* CTA */
.cta {
  padding: 80px 0;
  background: linear-gradient(135deg, var(--purple) 0%, var(--purple-dark) 100%);
  color: #FFFFFF;
}
.cta-content {
  text-align: center;
  max-width: 700px;
  margin: 0 auto;
}
.cta h2 {
  font-size: 44px;
  font-weight: 900;
  letter-spacing: -1.5px;
  margin-bottom: 20px;
}
.cta p {
  font-size: 18px;
  opacity: 0.9;
  margin-bottom: 32px;
}

/* FOOTER */
.footer {
  background: var(--dark);
  color: rgba(255,255,255,0.7);
  padding: 60px 0 30px;
}
.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 40px;
  margin-bottom: 40px;
}
.footer-brand {
  color: #FFFFFF;
  font-size: 24px;
  font-weight: 900;
  margin-bottom: 16px;
}
.footer-brand span { color: var(--purple-light); }
.footer-desc { font-size: 14px; line-height: 1.7; max-width: 320px; }
.footer h4 {
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.footer a {
  display: block;
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  font-size: 14px;
  margin-bottom: 10px;
  transition: color 0.2s;
}
.footer a:hover { color: var(--purple-light); }
.footer-bottom {
  padding-top: 30px;
  border-top: 1px solid rgba(255,255,255,0.1);
  text-align: center;
  font-size: 13px;
}

/* RESPONSIVE */
@media (max-width: 968px) {
  .hero-inner { grid-template-columns: 1fr; gap: 40px; }
  .hero h1 { font-size: 40px; }
  .products-grid { grid-template-columns: 1fr; }
  .product-featured { grid-template-columns: 1fr; padding: 40px 32px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 24px; }
  .steps { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr 1fr; }
  .nav-links {
    position: absolute;
    top: 100%; left: 0; right: 0;
    background: #FFFFFF;
    flex-direction: column;
    align-items: stretch;
    padding: 20px 24px;
    gap: 16px;
    border-bottom: 1px solid var(--border);
    display: none;
  }
  .nav-links.active { display: flex; }
  .menu-toggle { display: flex; }
  .section-header h2 { font-size: 32px; }
  .cta h2 { font-size: 32px; }
  .page-header h1 { font-size: 40px; }
  .team-grid, .values-grid { grid-template-columns: 1fr; }
  .contact-grid { grid-template-columns: 1fr; gap: 40px; }
}

@media (max-width: 640px) {
  .hero h1 { font-size: 32px; letter-spacing: -1px; }
  .hero { padding: 60px 0; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .stat-value { font-size: 28px; }
  .product-featured h3 { font-size: 26px; }
  .footer-grid { grid-template-columns: 1fr; }
  .hero-cta { flex-direction: column; align-items: stretch; }
  .hero-cta a { justify-content: center; }
  .page-header h1 { font-size: 32px; }
}