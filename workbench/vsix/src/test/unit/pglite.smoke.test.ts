import assert from 'node:assert/strict';

// PGLite is ESM-only, so we use dynamic import() in CommonJS context
let PGlite: any;

describe('PGLite smoke test', () => {
  let db: any;

  before(async () => {
    const mod = await import('@electric-sql/pglite');
    PGlite = mod.PGlite;
    db = new PGlite(); // in-memory, no persistence
  });

  after(async () => {
    await db.close();
  });

  it('initializes WASM engine without error', () => {
    assert.ok(db, 'PGlite instance should exist');
  });

  it('executes CREATE TABLE and INSERT', async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.exec(`INSERT INTO test_table (name) VALUES ('smoke-test')`);

    const result = await db.query('SELECT name FROM test_table WHERE name = $1', ['smoke-test']);

    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].name, 'smoke-test');
  });

  it('supports JSON columns (PostgreSQL feature)', async () => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS json_test (
        id SERIAL PRIMARY KEY,
        data JSONB NOT NULL
      )
    `);

    await db.query(`INSERT INTO json_test (data) VALUES ($1::jsonb)`, [
      JSON.stringify({ severity: 'HIGH', count: 5 }),
    ]);

    const result = await db.query("SELECT data FROM json_test WHERE data->>'severity' = 'HIGH'");

    assert.equal(result.rows.length, 1);
  });

  it('works in in-memory mode (no filesystem artifacts)', async () => {
    const ephemeral = new PGlite();
    await ephemeral.exec('CREATE TABLE ephemeral_test (id INT)');
    await ephemeral.exec('INSERT INTO ephemeral_test VALUES (1)');
    const result = await ephemeral.query('SELECT * FROM ephemeral_test');
    assert.equal(result.rows.length, 1);
    await ephemeral.close();
  });
});
