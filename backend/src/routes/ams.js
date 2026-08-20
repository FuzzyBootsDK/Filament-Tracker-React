import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:printer_id', requireAuth, (req, res) => {
  const slots = getDb().prepare(`
    SELECT
      a.id, a.printer_id, a.ams_unit, a.slot_index,
      a.tag_uid, a.remain_percent, a.color_hex, a.material,
      a.sub_brand, a.tray_id_name, a.unit_temp, a.unit_humidity, a.unit_slot_count, a.updated_at,
      a.spool_id,
      s.remaining_weight, s.spool_type,
      f.id   as filament_id,
      f.name as filament_name,
      f.color_hex as filament_color,
      f.material  as filament_material,
      b.name as brand_name
    FROM ams_slots a
    LEFT JOIN spools    s ON a.spool_id    = s.id
    LEFT JOIN filaments f ON s.filament_id = f.id
    LEFT JOIN brands    b ON f.brand_id    = b.id
    WHERE a.printer_id = ?
    ORDER BY a.ams_unit, a.slot_index
  `).all(req.params.printer_id);
  res.json(slots);
});

// Link an inventory spool to an AMS slot
router.put('/:printer_id/:ams_unit/:slot_index/link', requireAuth, (req, res) => {
  const { printer_id, ams_unit, slot_index } = req.params;
  const { spool_id } = req.body;

  getDb().prepare(`
    INSERT INTO ams_slots (printer_id, ams_unit, slot_index, spool_id, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(printer_id, ams_unit, slot_index)
    DO UPDATE SET spool_id = excluded.spool_id, updated_at = excluded.updated_at
  `).run(printer_id, ams_unit, slot_index, spool_id || null);

  res.json({ ok: true });
});

// Unlink spool from slot
router.delete('/:printer_id/:ams_unit/:slot_index/link', requireAuth, (req, res) => {
  const { printer_id, ams_unit, slot_index } = req.params;
  getDb().prepare(`
    UPDATE ams_slots SET spool_id = NULL, updated_at = datetime('now')
    WHERE printer_id = ? AND ams_unit = ? AND slot_index = ?
  `).run(printer_id, ams_unit, slot_index);
  res.json({ ok: true });
});

export default router;
