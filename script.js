document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('output');

  // ZIP ONLY
  document.getElementById('search-zip').addEventListener('click', () => {
    const zip = document.getElementById('zip-input').value.trim();
    if (!zip) return;
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${zip}&country=US&count=1`)
      .then(r => r.json())
      .then(d => d.results?.[0] ? fetchWeather(d.results[0].latitude, d.results[0].longitude) : alert('ZIP not found'));
  });

  // Fetch Weather
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

  // Manual Inputs
  ['high-temp','humidity','cloud-cover','wind-speed','work-rate','acclimatized'].forEach(id => {
    document.getElementById(id).addEventListener('input', calculateSchedule);
  });

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
    const ouncesPer15Min = Math.round((hyd * 32) / 4);
    const note = restMin > 30 ? 'Consider shifting to cooler area or indoors.' : 'Monitor for heat stress symptoms.';

    let riskMessage = '';
    if (wbgtF < 70) riskMessage = '<p style="color:#1976d2; font-weight:bold; margin:0.5rem 0;">Low risk of heat stress.</p>';
    if (wbgtF >= 90) riskMessage = '<p style="color:#d32f2f; font-weight:bold; margin:0.5rem 0;">Danger: High risk of heat stress!</p>';

    output.innerHTML = `
      <h3>Heat Stress Summary</h3>
      <p style="position:relative; display:inline-block;">
        <strong>WBGT:</strong> ${wbgtF.toFixed(1)}°F 
        <span class="tooltip-trigger">?</span>
        <div class="tooltip-content">
          <p style="margin:0 0 0.5rem 0; font-weight:600;">What is WBGT?</p>
          <p style="margin:0;">WBGT stands for Wet Bulb Globe Temperature. It combines air temperature, humidity, wind, and sun to measure how hot it *feels* to the body. It's more accurate than heat index because it accounts for all factors that affect heat stress. The military, sports teams, and OSHA use WBGT to protect workers and athletes.</p>
        </div>
      </p>
      <p><strong>Limit Applied:</strong> ${acclimatized === 'yes' ? 'REL (acclimatized worker limit)' : 'RAL (un-acclimatized worker limit)'}</p>
      <p><strong>Work Intensity:</strong> ${workRate.charAt(0).toUpperCase() + workRate.slice(1)} (${m} W/m²)</p>

      <h3>Per-Hour Recommendation</h3>
      ${riskMessage}
      <div style="background:#fff; padding:1rem; border-radius:8px; margin:1rem 0; border:1px solid #ddd;">
        <p style="margin:0.5rem 0; font-size:1.1rem;"><strong>Work:</strong> ${workMin.toFixed(0)} minutes</p>
        <p style="margin:0.5rem 0; font-size:1.1rem;"><strong>Rest/seek cooler work area:</strong> ${restMin.toFixed(0)} minutes</p>
        <p style="margin:0.5rem 0; font-size:1.1rem;"><strong>Hydration:</strong> ${hyd.toFixed(1)} quarts (${ouncesPer15Min} oz every 15 min)</p>
        <p style="margin:0.5rem 0; color:#d32f2f;"><strong>Note:</strong> ${note}</p>
      </div>

      <p class="note" style="margin-top:1rem; font-size:0.9rem; color:#555;">
        <em>Based on NIOSH 2016 Criteria and OSHA proposed heat rule. WBGT uses current or forecast conditions. Source: Open-Meteo (free API).</em>
      </p>
    `;

    // TOOLTIP LOGIC
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

  calculateSchedule();
});
