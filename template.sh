#!/bin/bash
# Template HTML commun pour les pages guides SimuAE

NAV='<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="logo">
      <div class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5" opacity=".6"/></svg></div>
      Simu<em>AE</em>
    </a>
    <span class="nav-tag">Copilote financier AE 2026</span>
    <div class="nav-right">
      <a href="/#guides" class="nav-link">Guides</a>
      <a href="/#faq" class="nav-link">FAQ</a>
      <a href="/#simulateur" class="btn-nav">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
        Simuler
      </a>
    </div>
  </div>
</nav>'

FOOTER='<footer>
  <div class="footer-inner">
    <div class="footer-brand">Simu<em>AE</em></div>
    <nav class="footer-nav">
      <a href="/mentions-legales">Mentions légales</a>
      <a href="/politique-confidentialite">Confidentialité</a>
      <a href="/cgu">CGU</a>
      <a href="/cgv">CGV</a>
      <a href="/#faq">FAQ</a>
      <a href="/#guides">Guides</a>
      <a href="/a-propos">À propos</a>
      <a href="mailto:contact@simuae.fr">Contact</a>
    </nav>
    <p class="footer-legal">SimuAE n&rsquo;est pas affilié à l&rsquo;URSSAF ni à l&rsquo;administration fiscale. © 2026 SimuAE</p>
  </div>
</footer>'

echo "Template loaded"
