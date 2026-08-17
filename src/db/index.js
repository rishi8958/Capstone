const knex = require('knex');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'social.db');

let _db;

function getDb() {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = knex({
    client: 'sqlite3',
    connection: { filename: DB_PATH },
    useNullAsDefault: true,
  });
  return _db;
}

// For tests: allow resetting the singleton
function resetDb() {
  if (_db) { _db.destroy(); _db = null; }
}

module.exports = { getDb, resetDb };
