// FLASHYAF™ — shared site script
document.addEventListener('DOMContentLoaded', function () {
  // Pioneer Beta application form — placeholder submit handler.
  // This is separate from the waitlist (which now uses live Brevo forms).
  // Replace with a real Brevo/CRM embed or API call when Pioneer Beta intake is automated.
  document.querySelectorAll('form.pioneer-signup').forEach(function (form) {
    if (form.dataset.bound) return; // avoid double-binding
    form.dataset.bound = "true";
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('Thanks! Your Pioneer Beta application has been received.');
      form.reset();
    });
  });

  // Back-to-top buttons
  document.querySelectorAll('.back-to-top').forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
});
