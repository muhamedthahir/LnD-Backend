const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
// Override shell-exported DB_* so .env always wins for this script.
dotenv.config({ override: true });

function productionConfig() {
  return {
    host: process.env.PROD_DB_HOST || process.env.DB_HOST,
    user: process.env.PROD_DB_USER || process.env.DB_USER,
    password: process.env.PROD_DB_PASS || process.env.DB_PASS,
    database: process.env.PROD_DB_NAME || process.env.DB_NAME,
    port: Number(process.env.PROD_DB_PORT || process.env.DB_PORT || 3306)
  };
}

function localConfig() {
  return {
    host: process.env.LOCAL_DB_HOST || process.env.DB_HOST,
    user: process.env.LOCAL_DB_USER || process.env.DB_USER,
    password: process.env.LOCAL_DB_PASS || process.env.DB_PASS,
    database: process.env.LOCAL_DB_NAME || process.env.DB_NAME,
    port: Number(process.env.LOCAL_DB_PORT || process.env.DB_PORT || 3306)
  };
}

function withSsl(base) {
  if (process.env.USE_SSL === 'true') {
    return { ...base, ssl: { rejectUnauthorized: false } };
  }
  return base;
}

function assertConfig(config, label) {
  const missing = [];
  if (!config.host) missing.push('host');
  if (!config.user) missing.push('user');
  if (!config.password) missing.push('password');
  if (!config.database) missing.push('database');
  if (missing.length > 0) {
    throw new Error(`Missing ${label} config fields: ${missing.join(', ')}`);
  }
}

function tableNameSql(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

async function getTables(conn, dbName) {
  const [rows] = await conn.execute(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [dbName]
  );
  return rows.map((r) => r.TABLE_NAME);
}

async function createTargetDatabase(prodCfg) {
  const adminConn = await mysql.createConnection(withSsl({
    host: prodCfg.host,
    user: prodCfg.user,
    password: prodCfg.password,
    port: prodCfg.port
  }));

  try {
    await adminConn.execute(`CREATE DATABASE IF NOT EXISTS ${tableNameSql(prodCfg.database)}`);
  } finally {
    await adminConn.end();
  }
}

async function cloneSchemas(sourceConn, targetConn, tables) {
  for (const table of tables) {
    const [createRows] = await sourceConn.query(`SHOW CREATE TABLE ${tableNameSql(table)}`);
    const createSql = createRows[0]['Create Table'];

    await targetConn.query(`DROP TABLE IF EXISTS ${tableNameSql(table)}`);
    await targetConn.query(createSql);
    console.log(`✓ Schema: ${table}`);
  }
}

function normalizeValue(value, colType) {
  if (value === undefined) return null;
  if (value === null) return null;

  const type = String(colType || '').toLowerCase();

  if (type === 'json') {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || trimmed === '[object Object]') return null;
      try {
        JSON.parse(trimmed);
        return trimmed;
      } catch (_) {
        return null;
      }
    }
    if (Buffer.isBuffer(value)) {
      const asText = value.toString('utf8');
      try {
        JSON.parse(asText);
        return asText;
      } catch (_) {
        return null;
      }
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value;
  }

  // mysql2 may parse some JSON-looking fields as objects even when type metadata differs
  if (typeof value === 'object' && !Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return value;
}

async function copyTableData(sourceConn, targetConn, table) {
  const [cols] = await sourceConn.query(`SHOW COLUMNS FROM ${tableNameSql(table)}`);
  const colNames = cols.map((c) => c.Field);
  const colTypes = Object.fromEntries(cols.map((c) => [c.Field, c.Type]));
  const colSql = colNames.map((c) => tableNameSql(c)).join(', ');

  const [rows] = await sourceConn.query(`SELECT * FROM ${tableNameSql(table)}`);
  if (rows.length === 0) {
    console.log(`- Data: ${table} (0 rows)`);
    return;
  }

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk.map((r) =>
      colNames.map((c) => normalizeValue(r[c], colTypes[c]))
    );
    await targetConn.query(
      `INSERT INTO ${tableNameSql(table)} (${colSql}) VALUES ?`,
      [values]
    );
  }

  console.log(`✓ Data: ${table} (${rows.length} rows)`);
}

async function verifyCounts(sourceConn, targetConn, tables) {
  let mismatchCount = 0;
  for (const table of tables) {
    const [srcRows] = await sourceConn.query(`SELECT COUNT(*) AS c FROM ${tableNameSql(table)}`);
    const [dstRows] = await targetConn.query(`SELECT COUNT(*) AS c FROM ${tableNameSql(table)}`);
    const src = Number(srcRows[0].c);
    const dst = Number(dstRows[0].c);
    if (src !== dst) {
      mismatchCount += 1;
      console.log(`✗ Count mismatch ${table}: local=${src}, prod=${dst}`);
    }
  }

  if (mismatchCount > 0) {
    throw new Error(`Verification failed with ${mismatchCount} table count mismatches.`);
  }
}

async function run() {
  const srcCfg = localConfig();
  const prodCfg = productionConfig();

  assertConfig(srcCfg, 'local');
  assertConfig(prodCfg, 'production');

  console.log('Starting local -> production DB migration');
  console.log(`Local DB: ${srcCfg.host}/${srcCfg.database}`);
  console.log(`Target DB: ${prodCfg.host}/${prodCfg.database}`);

  if (srcCfg.host === prodCfg.host && srcCfg.database === prodCfg.database) {
    throw new Error('Source and target database resolve to the same endpoint/database. Aborting.');
  }

  await createTargetDatabase(prodCfg);

  const sourceConn = await mysql.createConnection(withSsl({
    ...srcCfg,
    multipleStatements: true
  }));

  const targetConn = await mysql.createConnection(withSsl({
    ...prodCfg,
    multipleStatements: true
  }));

  try {
    const tables = await getTables(sourceConn, srcCfg.database);
    if (tables.length === 0) {
      throw new Error('Source DB has no tables. Nothing to migrate.');
    }

    console.log(`Found ${tables.length} source tables`);

    await targetConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await cloneSchemas(sourceConn, targetConn, tables);

    for (const table of tables) {
      await copyTableData(sourceConn, targetConn, table);
    }

    await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
    await verifyCounts(sourceConn, targetConn, tables);

    console.log('Migration completed successfully and row counts match.');
  } finally {
    try {
      await targetConn.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (_) {
      // Ignore cleanup failures.
    }
    await sourceConn.end();
    await targetConn.end();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
