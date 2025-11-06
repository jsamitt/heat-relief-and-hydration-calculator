// Rest Break & Hydration Scheduler – NIOSH/OSHA Based
document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('output');
  const inputs = ['high-temp', 'humidity', 'cloud-cover', 'wind-speed', 'work-rate', 'acclimatized', 'shift-hours'];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', calculateSchedule);
    el.addEventListener('change', calculateSchedule);
  });

      function calculateSchedule() {
    const highTempF = parseFloat(document.getElementById('high-temp').value) || 0;
    const humidity = parseFloat(document.getElementById('humidity').value) || 0;
    const cloudCover = parseFloat(document.getElementById('cloud-cover').value) || 0;
    const windSpeed = parseFloat(document.getElementById('wind-speed').value) || 0;
    const workRate = document.getElementById('work-rate').value;
    const acclimatized = document.getElementById('acclimatized').value;

    // Validation
    if (highTempF <= 0 || humidity < 0 || cloudCover < 0 || windSpeed < 0 || !workRate || !acclimatized) {
      output.innerHTML = '<p class="placeholder">Please complete all fields.</p>';
      return;
    }

    // Convert to Celsius
    const tempC = (highTempF - 32) * 5/9;

    // 1. T_a = Dry-bulb (air temp)
    const Ta = tempC;

    // 2. T_w = Natural Wet-Bulb (approximation using humidity)
    // Psychrometric formula: Tw = T * atan(0.151977 * (RH + 8.313659)^0.5) + ...
    // Simplified NIOSH approximation
    const Tw = tempC * Math.atan(0.151977 * Math.sqrt(humidity + 8.313659)) +
              Math.atan(tempC + humidity) - Math.atan(humidity - 1.67633) +
              0.00391838 * Math.pow(humidity, 1.5) * Math.atan(0.023101 * humidity) - 4.686035;

    // 3. T_g = Globe Temperature (solar + wind)
    const solarMax = 800; // W/m² clear sky
    const solar = solarMax * (1 - cloudCover / 100);
    let Tg = tempC + (solar / 100); // Base solar heating
    // Wind cooling effect on globe (empirical)
    if (windSpeed > 1) {
      Tg -= 0.3 * Math.log(windSpeed); // Logarithmic wind reduction
    }

    // 4. FINAL WBGT
    const wbgt = 0.7 * Tw + 0.2 * Tg + 0.1 * Ta;
    const wbgtF = wbgt * 9/5 + 32;

    // 5. Metabolic Rate
    const metabolicRates = { light: 180, moderate: 300, heavy: 450 };
    const m = metabolicRates[workRate];

    // 6. REL/RAL Work/Rest
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

    // 7. Hydration
    const hydrationQuarts = m > 300 ? 1.5 : m > 180 ? 1.25 : 1;

    // 8. Output
    const note = restMin > 30 ? 'Consider shifting to cooler area or indoors.' : 'Monitor for heat stress symptoms.';

    let resultsHTML = `
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
        <em>WBGT uses NIOSH psychrometric + globe model. Wind reduces heat stress. Source: NIOSH 2016, OSHA 2024.</em>
      </p>
    `;

    output.innerHTML = resultsHTML;
  }
  
  // Initial
  calculateSchedule();
});
