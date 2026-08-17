require('dotenv').config();
const { getDb } = require('./index');

async function migrate() {
  const db = getDb();

  await db.schema.createTableIfNotExists('campaigns', (t) => {
    t.string('id').primary();
    t.string('title').notNullable();
    t.text('body').notNullable();
    t.string('url').notNullable();
    t.string('source_image_path');
    t.datetime('created_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('social_posts', (t) => {
    t.string('id').primary();
    t.string('campaign_id').notNullable().references('id').inTable('campaigns');
    t.string('platform').notNullable();
    t.text('caption').notNullable();
    t.string('image_path');
    t.string('status').notNullable().defaultTo('queued');
    t.string('idempotency_key').notNullable().unique();
    t.string('platform_post_id');
    t.datetime('scheduled_at');
    t.datetime('published_at');
    t.text('error');
    t.datetime('created_at').defaultTo(db.fn.now());
    t.datetime('updated_at').defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('platform_tokens', (t) => {
    t.string('platform').primary();
    t.text('encrypted_token').notNullable();
    t.datetime('updated_at').defaultTo(db.fn.now());
  });

  console.log('Migration complete.');
  await db.destroy();
}

migrate().catch((e) => { console.error(e); process.exit(1); });
