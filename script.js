// Rest Break & Hydration Scheduler – 3 ways, 100% working
document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('output');

  // 1. Use My Location
  document.getElementById('use-location').addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(
      p => fetchWeather(p.coords.latitude.toFixed(4), p.coords.longitude.toFixed(4)),
      () => alert('Location denied – try ZIP or manual')
    );
  });

  // 2. ZIP Code
  document.getElementById('search-zip').addEventListener('click', () => {
    const zip = document.getElementById('zip-input').value.trim();
    if (!zip) return;
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${zip}&country=US&count=1`)
      .then(r => r.json())
      .then(d => d.results?.[0] ? fetchWeather(d.results[0].latitude, d.results[0].longitude) : alert('ZIP not found'));
  });

  // Manual inputs
  ['high-temp','humidity','cloud-cover','wind-speed','work-rate','acclimatized'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => setTimeout(calculateSchedule, 100));
  });

  // Fetch weather
  function fetchWeather(lat, lon) {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`)
      .then(r => r.json())
      .then(d => {
        const c = d.current;
        document.getElementById('high-temp').value = Math.round(c.temperature_2m);
        document.getElementById('humidity').value = c.relative_humidity_2m;
        document.getElementById('cloud-cover').value = c.cloud_cover;
        document.getElementById('wind-speed').value = c.wind_speed_10m.toFixed(1);
        calculateSchedule();
      });
  }

  // CALCULATE
  function calculateSchedule() {
    const highTempF = +document.getElementById('high-temp').value || 0;
    const humidity = +document.getElementById('humidity').value || 0;
    const cloudCover = +document.getElementById('cloud-cover').value || 0;
    const windSpeed = +document.getElementById('wind-speed').value || 0;
    const workRate = document.getElementById('work-rate').value;
    const acclimatized = document.getElementById('acclimatized').value;

    if (!highTempF || !humidity || !cloudCover || !windSpeed || !workRate || !acclimatized) {
      output.innerHTML = '<p class="placeholder">Please complete all fields.</p>';
      return;
    }

    const tempC = (highTempF - 32) * 5 / 9;
    const Ta = tempC;
    const Tw = tempC * Math.atan(0.151977 * Math.sqrt(humidity + 8.313659)) +
               Math.atan(tempC + humidity) - Math.atan(humidity - 1.67633) +
               0.00391838 * Math.pow(humidity, 1.5) * Math.atan(0.023101 * humidity) - 4.686035;
    const solar = 800 * (1 - cloudCover / 100);
    let Tg = tempC + solar / 100;
    if (windSpeed > 1) Tg -= 0.3 * Math.log(windSpeed);
    const wbgt = 0.7 * Tw + 0.2 * Tg + 0.1 * Ta;
    const wbgtF = wbgt * 9 / 5 + 32;

    const m = { light: 180, moderate: 300, heavy: 450 }[workRate];

    let workMin, restMin;
    const adj = m > 300 ? 1.2 : m > 180 ? 1.1 : 1;
    if (acclimatized === 'yes') {
      if (wbgtF < 80) [workMin, restMin] = [60, 0];
      else if (wbgtF < 85) [workMin, restMin] = [45, 15];
      else if (wbgtF < 90) [workMin, restMin] = [30, 30];
      else [workMin, restMin] = [15, 45];
    } else {
      if (wbgtF < 80) [workMin, restMin] = [60, 0];
      else if (wbgtF < 85) [workMin, restMin] = [40, 20];
      else if (wbgtF < 90) [workMin, restMin] = [25, 35];
      else [workMin, restMin] = [10, 50];
    }
    workMin = Math.max(5, workMin / adj);
    restMin = 60 - workMin;

    const hyd = m > 300 ? 1.5 : m > 180 ? 1.25 : 1;
    const note = restMin > 30 ? 'Consider shifting to cooler area or indoors.' : 'Monitor for heat stress symptoms.';

    output.innerHTML = `
      <h3>Heat Stress Summary</h3>
      <p><strong>WBGT:</strong> ${wbgtF.toFixed(1)}°F</p>
      <p><strong>Limit:</strong> ${acclimatized === 'yes' ? 'REL' : 'RAL'}</p>

      <h3>Per-Hour Recommendation</h3>
      <div style="background:#fff;padding:1rem;border-radius:8px;margin:1rem 0;border:1px solid #ddd;">
        <p style="margin:0.5rem 0;font-size:1.1rem;"><strong>Work:</strong> ${workMin.toFixed(0)} minutes</p>
        <p style="margin:0.5rem 0;font-size:1.1rem;"><strong>Rest/Hydrate:</strong> ${restMin.toFixed(0)} minutes</p>
        <p style="margin:0.5rem 0;font-size:1.1rem;"><strong>Hydration:</strong> ${hyd.toFixed(1)} quarts</p>
        <p style="margin:0.5rem 0;color:#d32f2f;"><strong>Note:</strong> ${note}</p>
      </div>
    `;
  }

  calculateSchedule();
});
