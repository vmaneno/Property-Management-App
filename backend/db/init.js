const fs   = require('fs');
const path = require('path');
const pool = require('./index');

async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema initialized.');
  await pool.end();
}

initSchema().catch(err => { console.error(err); process.exit(1); });
