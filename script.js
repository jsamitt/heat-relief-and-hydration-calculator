// Rest Break & Hydration Scheduler – NIOSH/OSHA + Auto-Weather (FINAL FIX)
document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('output');

  // === 1. Use My Location ===
  document.getElementById('use-location').addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude.toFixed(4);
      const lon = pos.coords.longitude.toFixed(4);
      fetchWeather(lat, lon);
    }, () => alert('Location denied – use ZIP or manual'));
  });

  // === 2. ZIP Code Search ===
  document.getElementById('search-zip').addEventListener('click', () => {
    const zip = document.getElementById('zip-input').value.trim();
    if (!zip) return;
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${zip}&country=US&count=1`)
      .then(r => r.json())
      .then(data => {
        if (data.results?.[0]) {
          const { latitude, longitude } = data.results[0];
          fetchWeather(latitude, longitude);
        } else {
          alert('ZIP not found in US');
        }
      })
      .catch(() => alert('ZIP search failed'));
  });

  // === 3. Manual Inputs ===
  const inputs = ['high-temp', 'humidity', 'cloud-cover', 'wind-speed', 'work-rate', 'acclimatized'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => setTimeout(calculateSchedule, 50));
      el.addEventListener('change', calculateSchedule);
    }
  });

  // === Fetch Weather ===
  function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.current) throw new Error('No data');
        const c = data.current;
        document.getElementById('high-temp').value = Math.round(c.temperature_2m);
        document.getElementById('humidity').value = c.relative_humidity_2m;
        document.getElementById('cloud-cover').value = c.cloud_cover;
        document.getElementById('wind-speed').value = c.wind_speed_10m.toFixed(1);
        setTimeout(calculateSchedule, 100); // Force calc after fill
      })
      .catch(() => console.warn('Weather fetch failed'));
  }

  // === CALCULATE SCHEDULE ===
  function calculateSchedule() {
    const highTempF = parseFloat(document.getElementById('high-temp').value) || 0;
    const humidity = parseFloat(document.getElementById('humidity').value) || 0;
    const cloudCover = parseFloat(document.getElementById('cloud-cover').value) || 0;
    const windSpeed = parseFloat(document.getElementById('wind-speed').value) || 0;
    const workRate = document.getElementById('work-rate').value;
    const acclimatized = document.getElementById('acclimatized').value;

    if (highTempF <= 0 || humidity < 0 || cloudCover < 0 || windSpeed < 0 || !workRate || !acclimatized) {
      output.innerHTML = '<p class="placeholder">Please complete all fields.</p>';
      return;
    }

    const tempC = (highTempF - 32) * 5/9;
    const Ta = tempC;
    const Tw = tempC * Math.atan(0.151977 * Math.sqrt(humidity + 8.313659)) +
              Math.atan(tempC + humidity) - Math.atan(humidity - 1.67633) +
              0.00391838 * Math.pow(humidity, 1.5) * Math.atan(0.023101 * humidity) - 4.686035;
    const solarMax = 800;
    const solar = solarMax * (1 - cloudCover / 100);
    let Tg = tempC + (solar / 100);
    if (windSpeed > 1) Tg -= 0.3 * Math.log(windSpeed);
    const wbgt = 0.7 * Tw + 0.2 * Tg + 0.1 * Ta;
    const wbgtF = wbgt * 9/5 + 32;

    const metabolicRates = { light: 180, moderate: 300, heavy: 450 };
    const m = metabolicRates[workRate];

    let workMin, restMin;
    const adjustment = m > 300 ? 1.2 : m > 180 ? 1.1 : 1;

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

    workMin = Math.max(5, workMin / adjustment);
    restMin = 60 - workMin;
    const hydrationQuarts = m > 300 ? 1.5 : m > 180 ? 1.25 : 1;
    const note = restMin > 30 ? 'Consider shifting to cooler area or indoors.' : 'Monitor for heat stress symptoms.';

    output.innerHTML = `
      <h3>Heat Stress Summary</h3>
      <p><strong>WBGT:</strong> ${wbgtF.toFixed(1)}°F <em style="color:#666;">(Wind: ${windSpeed} mph ↓ WBGT)</em></p>
      <p><strong>Limit Applied:</strong> ${acclimatized === 'yes' ? 'REL (Acclimatized)' : 'RAL (Unacclimatized)'}</p>
      <p><strong>Work Intensity:</strong> ${workRate.charAt(0).toUpperCase() + workRate.slice(1)} (${m} W/m²)</p>

      <h3>Per-Hour Recommendation</h3>
      <div style="background:#fff; padding:1rem; border-radius:8px; margin:1rem 0; border:1px solid #ddd;">
        <p style="margin:0.5rem 0; font-size:1.1rem;"><strong>Work:</strong> ${workMin.toFixed(0)} minutes</p>
        <p style="margin:0.5rem 0; font-size:1.1rem;"><strong>Rest/Hydrate:</strong> ${restMin.toFixed(0)} minutes</p>
        <p style="margin:0.5rem 0; font-size:1.1rem;"><strong>Hydration:</strong> ${hydrationQuarts.toFixed(1)} quarts (about 1 cup every 15 min)</p>
        <p style="margin:0.5rem 0; color:#d32f2f;"><strong>Note:</strong> ${note}</p>
      </div>

      <p class="note" style="margin-top:1rem; font-size:0.9rem; color:#555;">
        <em>Based on NIOSH 2016 Criteria and OSHA proposed heat rule. WBGT uses current or forecast conditions. Source: Open-Meteo (free API).</em>
      </p>
    `;
  }

  // Initial
  calculateSchedule();
});
