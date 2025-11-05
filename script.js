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
    const highTemp = parseFloat(document.getElementById('high-temp').value) || 0;
    const humidity = parseFloat(document.getElementById('humidity').value) || 0;
    const cloudCover = parseFloat(document.getElementById('cloud-cover').value) || 0;
    const windSpeed = parseFloat(document.getElementById('wind-speed').value) || 0;
    const workRate = document.getElementById('work-rate').value;
    const acclimatized = document.getElementById('acclimatized').value;
    const shiftHours = parseFloat(document.getElementById('shift-hours').value) || 0;

    // Validation
    if (highTemp <= 0 || humidity < 0 || cloudCover < 0 || windSpeed < 0 || !workRate || !acclimatized || shiftHours <= 0) {
      output.innerHTML = '<p class="placeholder">Please complete all fields.</p>';
      return;
    }

    // 1. WBGT Calculation (NIOSH formula for outdoor work)
    const tempC = (highTemp - 32) * 5/9;
    const solarIrradiance = 800 * (1 - cloudCover / 100); // Rough estimate, max 800 W/m²
    const wbgt = 0.7 * tempC + 0.2 * (humidity / 100 * tempC) + 0.1 * (solarIrradiance / 100); // Simplified NIOSH WBGT

    // 2. Metabolic Rate (M) in W/m²
    const metabolicRates = { light: 180, moderate: 300, heavy: 450 };
    const m = metabolicRates[workRate];

    // 3. REL (Acclimatized) or RAL (Unacclimatized) - NIOSH tables (simplified)
    const wbgtF = wbgt * 9/5 + 32; // Convert to °F for tables
    let workRestMinutes = [];
    if (acclimatized === 'yes') {
      // REL tables (acclimatized)
      if (wbgtF < 80) workRestMinutes = [60, 0]; // Full work
      else if (wbgtF < 85) workRestMinutes = [45, 15];
      else if (wbgtF < 90) workRestMinutes = [30, 30];
      else workRestMinutes = [15, 45];
    } else {
      // RAL (unacclimatized, 20% more rest)
      if (wbgtF < 80) workRestMinutes = [60, 0];
      else if (wbgtF < 85) workRestMinutes = [40, 20];
      else if (wbgtF < 90) workRestMinutes = [25, 35];
      else workRestMinutes = [10, 50];
    }

    // Adjust for metabolic rate (heavier work = more rest)
    const adjustment = m > 300 ? 1.2 : m > 180 ? 1.1 : 1;
    const workMin = Math.max(5, workRestMinutes[0] / adjustment);
    const restMin = 60 - workMin;

    // Hydration: NIOSH 1 quart/hour, adjusted for work rate
    const hydrationQuarts = m > 300 ? 1.5 : m > 180 ? 1.25 : 1;

    // Generate schedule for shift
    let scheduleHTML = `
      <h3>Calculated Values</h3>
      <p><strong>WBGT:</strong> ${wbgtF.toFixed(1)}°F</p>
      <p><strong>Limit:</strong> ${acclimatized === 'yes' ? 'REL (Acclimatized)' : 'RAL (Unacclimatized)'}</p>
      <p><strong>Work Rate Adjustment:</strong> ${workRate} (${m} W/m²)</p>
      <h3>Hourly Schedule</h3>
      <table class="schedule-table">
        <thead><tr><th>Hour</th><th>Work (min)</th><th>Rest (min)</th><th>Hydration (quarts)</th><th>Notes</th></tr></thead>
        <tbody>
    `;

    for (let hour = 1; hour <= shiftHours; hour++) {
      const note = restMin > 30 ? 'Shift indoors if possible' : 'Monitor symptoms';
      scheduleHTML += `
        <tr>
          <td>Hour ${hour}</td>
          <td>${workMin.toFixed(0)}</td>
          <td>${restMin.toFixed(0)}</td>
          <td>${hydrationQuarts.toFixed(1)}</td>
          <td>${note}</td>
        </tr>
      `;
    }

    scheduleHTML += `
        </tbody>
      </table>
      <p class="note" style="margin-top:1rem; font-size:0.9rem; color:#555;">
        <em>Breaks include hydration time. Adjust for wind/solar. Source: NIOSH Criteria Document (2016), OSHA Proposed Rule (2024).</em>
      </p>
    `;

    output.innerHTML = scheduleHTML;
  }

  // Initial
  calculateSchedule();
});
