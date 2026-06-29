// FLASHYAF™ — shared site script
document.addEventListener('DOMContentLoaded', function () {
  // Back-to-top buttons
  document.querySelectorAll('.back-to-top').forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
});
