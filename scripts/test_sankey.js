const http = require('http');

http.get('http://127.0.0.1:8000/api/simulate?start=2026-05-26+00:00:00&end=2026-05-26+23:00:00&strategy=optimised_lp', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const data = JSON.parse(d);
    let solar_to_load = 0;
    let solar_to_batt = 0;
    let solar_to_export = 0;
    let batt_to_load = 0;
    let grid_to_load = 0;
    let grid_to_batt = 0;
    let total_load = 0;
    let total_solar = 0;
    let total_import = 0;

    data.hourly_series.forEach(h => {
      const s = h.solar_actual_kw;
      const l = h.load_kw;
      const ch = h.battery_charge_kw;
      const dis = h.battery_discharge_kw;
      const imp = h.grid_import_kw;
      const exp = h.grid_export_kw;

      total_solar += s;
      total_load += l;
      total_import += imp;

      // In each hour:
      // Solar directly serving load: min(s, l)
      const s_to_l = Math.min(s, l);
      // Remaining solar available for battery or export:
      const s_rem = Math.max(0, s - s_to_l);
      const s_to_b = Math.min(s_rem, ch);
      const s_to_exp = Math.max(0, s - s_to_l - s_to_b);

      solar_to_load += s_to_l;
      solar_to_batt += s_to_b;
      solar_to_export += s_to_exp;

      // Battery discharge goes to load:
      batt_to_load += dis;

      // Grid to battery is whatever charging wasn't supplied by solar:
      const g_to_b = Math.max(0, ch - s_to_b);
      // Grid to load is the rest of grid import:
      const g_to_l = Math.max(0, imp - g_to_b);

      grid_to_batt += g_to_b;
      grid_to_load += g_to_l;
    });

    console.log('Total Solar:', total_solar.toFixed(4), 'vs Sum(PV out):', (solar_to_load + solar_to_batt + solar_to_export).toFixed(4));
    console.log('Total Load:', total_load.toFixed(4), 'vs Sum(Load in):', (solar_to_load + batt_to_load + grid_to_load).toFixed(4));
    console.log('Total Grid Import:', total_import.toFixed(4), 'vs Sum(Grid in):', (grid_to_load + grid_to_batt).toFixed(4));
    console.log('Total Battery In:', (solar_to_batt + grid_to_batt).toFixed(4), 'vs Total Battery Out:', batt_to_load.toFixed(4));
    console.log('Flows:');
    console.log('  Solar -> Load:', solar_to_load.toFixed(2), 'kWh');
    console.log('  Solar -> Battery:', solar_to_batt.toFixed(2), 'kWh');
    console.log('  Solar -> Grid Export:', solar_to_export.toFixed(2), 'kWh');
    console.log('  Battery -> Load:', batt_to_load.toFixed(2), 'kWh');
    console.log('  Grid Import -> Load:', grid_to_load.toFixed(2), 'kWh');
    console.log('  Grid Import -> Battery:', grid_to_batt.toFixed(2), 'kWh');
  });
});

