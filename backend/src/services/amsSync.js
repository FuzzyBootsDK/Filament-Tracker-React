import { getDb, transaction } from '../db/index.js';

export function syncAmsSlots(printer, amsUnits) {
  const db = getDb();

  const upsertSlot = db.prepare(`
    INSERT INTO ams_slots (printer_id, ams_unit, slot_index, tag_uid, remain_percent, color_hex, material, sub_brand, tray_id_name, unit_temp, unit_humidity, unit_slot_count, spool_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(printer_id, ams_unit, slot_index) DO UPDATE SET
      tag_uid         = excluded.tag_uid,
      remain_percent  = excluded.remain_percent,
      color_hex       = excluded.color_hex,
      material        = excluded.material,
      sub_brand       = excluded.sub_brand,
      tray_id_name    = excluded.tray_id_name,
      unit_temp       = excluded.unit_temp,
      unit_humidity   = excluded.unit_humidity,
      unit_slot_count = excluded.unit_slot_count,
      spool_id        = COALESCE(excluded.spool_id, ams_slots.spool_id),
      updated_at      = excluded.updated_at
  `);

  const findSpool = db.prepare(`
    SELECT s.id, s.remaining_weight,
      f.spool_weight
    FROM spools s JOIN filaments f ON f.id = s.filament_id
    WHERE s.tag_uid = ? AND s.is_active = 1 LIMIT 1
  `);

  const updateWeight = db.prepare(`
    UPDATE spools SET remaining_weight = ? WHERE id = ? AND remaining_weight > ?
  `);

  try {
    transaction(() => {
      // Compute valid unit IDs from this payload — delete stale rows from old unit IDs
      const validUnitIds = amsUnits
        .map(u => (u.id != null ? parseInt(u.id) : 0))
        .filter(n => !isNaN(n));

      if (validUnitIds.length > 0) {
        const ph = validUnitIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM ams_slots WHERE printer_id = ? AND ams_unit NOT IN (${ph})`).run(printer.id, ...validUnitIds);
      }

      amsUnits.forEach((unit) => {
        const unitId = unit.id != null ? parseInt(unit.id) : 0;
        const trays  = unit.tray || [];

        // Per-unit environment data (may be absent when empty)
        const unitTemp     = unit.temp != null ? Number(unit.temp) : null;
        const unitHumidity = unit.humidity != null ? String(unit.humidity) : null;
        const unitSlotCount = trays.length;

        trays.forEach((tray) => {
          const slotId = tray.id != null ? parseInt(tray.id) : 0;

          // Bambu Lab sends tray_color as 8-char RRGGBBAA hex — strip alpha
          const rawColor = tray.tray_color || tray.color || null;
          const color    = rawColor ? `#${rawColor.slice(0, 6)}` : null;

          const tagUid     = tray.tag_uid || null;
          const remain     = tray.remain != null ? Number(tray.remain) : null;
          const material   = tray.tray_type || null;
          const subBrand   = tray.tray_sub_brands || null;
          const trayIdName = tray.tray_id_name || null;

          let matchedSpoolId = null;
          if (tagUid) {
            const spool = findSpool.get(tagUid);
            if (spool) {
              matchedSpoolId = spool.id;
              if (remain != null && spool.spool_weight) {
                const newWeight = remain * spool.spool_weight / 100.0;
                updateWeight.run(newWeight, spool.id, newWeight);
              }
            }
          }

          upsertSlot.run(
            printer.id, unitId, slotId,
            tagUid, remain, color, material, subBrand, trayIdName,
            unitTemp, unitHumidity, unitSlotCount,
            matchedSpoolId,
          );
        });
      });
    });
  } catch (err) {
    console.error('[AMS sync error]', err.message, err.stack);
  }
}
