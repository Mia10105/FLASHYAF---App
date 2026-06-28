// FLASHYAF™ — shared site script

document.addEventListener('DOMContentLoaded', function () {

  // Generic waitlist / Pioneer Beta signup forms — placeholder submit handler.
  // Replace this with a real Brevo/Mailchimp/etc. embed or API call when ready.
  document.querySelectorAll('form.signup').forEach(function (form) {
    if (form.dataset.bound) return; // avoid double-binding
    form.dataset.bound = "true";
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btnText = form.querySelector('button[type="submit"]')?.textContent.trim() || 'Submitted';
      alert('Thanks! ' + (btnText.toLowerCase().includes('beta') ?
        'Your Pioneer Beta application has been received.' :
        'You\'re on the waitlist — we\'ll be in touch.'));
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
