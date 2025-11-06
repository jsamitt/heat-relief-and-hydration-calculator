// Rest Break & Hydration Scheduler – NIOSH/OSHA Based
document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('output');
  const inputs = ['high-temp', 'humidity', 'cloud-cover', 'wind-speed', 'work-rate', 'acclimatized'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', calculateSchedule);
    el.addEventListener('change', calculateSchedule);
  });

  // ZIP Code Search
  document.getElementById('search-zip').addEventListener('click', () => {
    const zip = document.getElementById('zip-input').value.trim();
    if (!zip) return;
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${zip}&country=US&count=1`)
      .then(r => r.json())
      .then(data => {
        if (data.results && data.results[0]) {
          const { latitude, longitude } = data.results[0];
          fetchWeather(latitude, longitude);
        } else {
          alert('ZIP not found');
        }
      });
  });

  function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const c = data.current;
        document.getElementById('high-temp').value = Math.round(c.temperature_2m);
        document.getElementById('humidity').value = c.relative_humidity_2m;
        document.getElementById('cloud-cover').value = c.cloud_cover;
        document.getElementById('wind-speed').value = c.wind_speed_10m.toFixed(1);
        calculateSchedule();
      })
      .catch(() => alert('Weather fetch failed – enter manually'));
  }

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
    const ouncesPer15Min = Math.round((hydrationQuarts * 32) / 4); // 1 quart = 32 oz, 4 intervals per hour

    const note = restMin > 30 ? 'Consider shifting to cooler area or indoors.' : 'Monitor for heat stress symptoms.';

        let resultsHTML = `
      <h3>Heat Stress Summary</h3>
      <p><strong>WBGT:</strong> ${wbgtF.toFixed(1)}°F 
        <span class="tooltip-trigger">?</span>
        <div class="tooltip-content">
          <p style="margin:0 0 0.5rem 0; font-weight:600;">What is WBGT?</p>
          <p style="margin:0;">WBGT stands for Wet Bulb Globe Temperature. It combines air temperature, humidity, wind, and sun to measure how hot it *feels* to the body. It's more accurate than heat index because it accounts for all factors that affect heat stress. The military, sports teams, and OSHA use WBGT to protect workers and athletes.</p>
        </div>
      </p>
      <p><strong>Limit Applied:</strong> ${acclimatized === 'yes' ? 'REL (acclimatized worker limit)' : 'RAL (un-acclimatized worker limit)'}</p>
      <p><strong>Work Intensity:</strong> ${workRate.charAt(0).toUpperCase() + workRate.slice(1)} (${m} W/m²)</p>

      <h3>Per-Hour Recommendation</h3>
      <div style="background:#fff; padding:1rem; border-radius:8px; margin:1rem 0; border:1px solid #ddd;">
        <p style="margin:0.5rem 0; font-size:1.1rem;"><strong>Work:</strong> ${workMin.toFixed(0)} minutes</p>
        <p style="margin:0.5rem 0; font-size:1.1rem;"><strong>Rest/seek cooler work area:</strong> ${restMin.toFixed(0)} minutes</p>
        <p style="margin:0.5rem 0; font-size:1.1rem;"><strong>Hydration:</strong> ${hydrationQuarts.toFixed(1)} quarts (${ouncesPer15Min} oz every 15 min)</p>
        <p style="margin:0.5rem 0; color:#d32f2f;"><strong>Note:</strong> ${note}</p>
      </div>

      <p class="note" style="margin-top:1rem; font-size:0.9rem; color:#555;">
        <em>Based on NIOSH 2016 Criteria and OSHA proposed heat rule. WBGT uses current or forecast conditions. Source: Open-Meteo (free API).</em>
      </p>
    `;

    output.innerHTML = resultsHTML;

    // TOOLTIP LOGIC — SAME AS INJURY CALCULATOR
    document.querySelectorAll('.tooltip-trigger').forEach(trigger => {
      const content = trigger.nextElementSibling;
      trigger.addEventListener('mouseenter', () => content.classList.add('show'));
      trigger.addEventListener('mouseleave', () => content.classList.remove('show'));
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = content.classList.contains('show');
        document.querySelectorAll('.tooltip-content').forEach(c => c.classList.remove('show'));
        if (!isOpen) content.classList.add('show');
      });
    });
  }

  // Initial
  calculateSchedule();
});
