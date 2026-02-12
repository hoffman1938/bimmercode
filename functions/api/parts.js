/**
 * Parts Finder API
 * GET /api/parts/by-code
 * Returns parts needed for a specific error code
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  if (request.method === "GET") {
    const errorCode = url.searchParams.get('code');
    const vin = url.searchParams.get('vin'); // Optional VIN for compatibility check
    const lang = url.searchParams.get('lang') || 'en';
    
    if (!errorCode) {
      return new Response(JSON.stringify({ error: 'Error code required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    try {
      const db = env.DB;
      
      // 1. Get all parts for this error code
      const partsQuery = `
        SELECT 
          p.*,
          COUNT(DISTINCT r.id) as review_count,
          AVG(r.rating) as avg_rating
        FROM error_code_parts p
        LEFT JOIN part_reviews r ON p.id = r.part_id
        WHERE p.error_code = ?
        GROUP BY p.id
        ORDER BY p.priority ASC, p.is_original DESC
      `;
      
      const { results: parts } = await db.prepare(partsQuery).bind(errorCode).all();
      
      if (parts.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No parts found for this error code',
          code: errorCode 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 2. For each part, get affiliate links
      for (let part of parts) {
        const linksQuery = `
          SELECT *
          FROM part_affiliate_links
          WHERE part_id = ? AND in_stock = 1
          ORDER BY current_price ASC
        `;
        
        const { results: links } = await db.prepare(linksQuery).bind(part.id).all();
        part.buy_links = links;
        
        // 3. Get compatibility info
        const compatQuery = `
          SELECT *
          FROM part_compatibility
          WHERE part_id = ? AND is_compatible = 1
        `;
        
        const { results: compatibility } = await db.prepare(compatQuery).bind(part.id).all();
        part.compatibility = compatibility;
        
        // 4. If VIN provided, check specific compatibility
        if (vin) {
          part.vin_compatible = await checkVINCompatibility(vin, part.id, db);
        }
      }
      
      // 5. Group parts by priority
      const response = {
        error_code: errorCode,
        parts: {
          primary: parts.filter(p => p.priority === 1),
          secondary: parts.filter(p => p.priority === 2),
          optional: parts.filter(p => p.priority === 3)
        },
        total_parts: parts.length,
        estimated_cost: {
          min: parts.reduce((sum, p) => sum + (p.price_min || 0), 0),
          max: parts.reduce((sum, p) => sum + (p.price_max || 0), 0),
          currency: 'USD'
        }
      };
      
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      });
      
    } catch (error) {
      console.error('Parts API Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return new Response('Method not allowed', { status: 405 });
}

/**
 * Check if a part is compatible with a specific VIN
 */
async function checkVINCompatibility(vin, partId, db) {
  // Basic VIN decoding (simplified)
  // Real implementation would use proper VIN decoder
  const series = extractSeriesFromVIN(vin);
  const year = extractYearFromVIN(vin);
  
  const compatQuery = `
    SELECT COUNT(*) as count
    FROM part_compatibility
    WHERE part_id = ?
      AND bmw_series = ?
      AND (year_from IS NULL OR year_from <= ?)
      AND (year_to IS NULL OR year_to >= ?)
      AND is_compatible = 1
  `;
  
  const result = await db.prepare(compatQuery)
    .bind(partId, series, year, year)
    .first();
  
  return result.count > 0;
}

/**
 * Extract BMW series from VIN (simplified)
 */
function extractSeriesFromVIN(vin) {
  // This is a simplified version
  // Real implementation would decode VIN properly
  const wmi = vin.substring(0, 3);
  const vds = vin.substring(3, 9);
  
  // BMW VIN patterns (simplified)
  // Would need proper VIN decoder in production
  return 'E90'; // Placeholder
}

/**
 * Extract year from VIN
 */
function extractYearFromVIN(vin) {
  const yearCode = vin.charAt(9);
  const yearMap = {
    'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013,
    'E': 2014, 'F': 2015, 'G': 2016, 'H': 2017,
    'J': 2018, 'K': 2019, 'L': 2020, 'M': 2021,
    'N': 2022, 'P': 2023, 'R': 2024, 'S': 2025,
    'T': 2026
  };
  
  return yearMap[yearCode] || 2020;
}
