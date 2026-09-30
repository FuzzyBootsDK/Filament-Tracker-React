// Public, unauthenticated read-only API for the webstore: which colours can we
// print in right now. Deliberately exposes only cosmetic fields — no prices,
// stock locations, notes or printer details.
import { Router } from 'express';
import cors from 'cors';
import { getDb } from '../db/index.js';

const router = Router();

// Open CORS: this is meant to be fetched from the webstore's own origin(s), and
// carries no credentials. Mounted before the app's credentialed CORS layer.
router.use(cors({ origin: '*', credentials: false }));

// 'Basic' is the default in the UI, not a real modifier — normalise it away.
function modifierOf(finish) {
  const f = (finish ?? '').trim();
  if (!f || f.toLowerCase() === 'basic') return null;
  return f;
}

const COLORS_SELECT = `
  SELECT
    f.id,
    f.name                                  AS full_name,
    COALESCE(NULLIF(TRIM(f.color_name), ''), f.name) AS name,
    UPPER(f.color_hex)                      AS color_hex,
    f.material                              AS material,
    f.finish                                AS finish,
    b.name                                  AS brand,
    f.low_stock_threshold                   AS low_stock_threshold,
    COALESCE((SELECT SUM(remaining_weight) FROM spools
              WHERE filament_id = f.id AND is_active = 1), 0) AS remaining_g
  FROM filaments f
  LEFT JOIN brands b ON f.brand_id = b.id
`;

// GET /api/public/colors
//   ?include_out_of_stock=1   also return colours with no filament left
//   ?material=PLA             filter by material (case-insensitive)
router.get('/colors', (req, res) => {
  const includeOut = ['1', 'true', 'yes'].includes(String(req.query.include_out_of_stock).toLowerCase());
  const material = req.query.material?.trim();

  const where = [];
  const params = [];
  if (!includeOut) where.push('remaining_g > 0');
  if (material) { where.push('LOWER(material) = LOWER(?)'); params.push(material); }

  const sql = `SELECT * FROM (${COLORS_SELECT}) ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY material ASC, name ASC`;

  const colors = getDb().prepare(sql).all(...params).map(r => ({
    id: r.id,
    name: r.name,
    color_hex: r.color_hex,
    material: r.material,
    modifier: modifierOf(r.finish),
    brand: r.brand ?? null,
    full_name: r.full_name,
    in_stock: r.remaining_g > 0,
    low_stock: r.remaining_g > 0 && r.remaining_g <= r.low_stock_threshold,
  }));

  // Cheap caching for a store front page; stock changes are not urgent here.
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ count: colors.length, colors });
});

export default router;
