/**
 * Replace starter code templates that use "Asslamu alaikum" with Hello World examples.
 *
 * Usage: node scripts/updateDefaultCodeTemplates.js
 */
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ override: true });

const HELLO_WORLD_BY_LANGUAGE = {
  JavaScript: `console.log("Hello World");
`,
  Python: `print("Hello World")
`,
  Java: `public class Solution {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
`,
  'C++': `#include <iostream>
using namespace std;

int main() {
    cout << "Hello World" << endl;
    return 0;
}
`,
  C: `#include <stdio.h>

int main() {
    printf("Hello World\\n");
    return 0;
}
`
};

function dbConfig() {
  return {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ...(process.env.USE_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
  };
}

function containsLegacyGreeting(code) {
  if (!code) return false;
  return /asslamu|assalamu|alaikum/i.test(code);
}

async function main() {
  const config = dbConfig();
  if (!config.host || !config.user || !config.database) {
    throw new Error('Missing DB_HOST, DB_USER, or DB_NAME in environment');
  }

  const connection = await mysql.createConnection(config);

  try {
    const [rows] = await connection.execute(
      `SELECT ct.id, ct.template_code, ct.solution_code, l.name AS language_name
       FROM code_templates ct
       JOIN languages l ON l.id = ct.language_id
       WHERE ct.template_code REGEXP 'asslamu|assalamu|alaikum'
          OR ct.solution_code REGEXP 'asslamu|assalamu|alaikum'`
    );

    if (rows.length === 0) {
      console.log('No legacy default code templates found.');
      return;
    }

    let updated = 0;
    for (const row of rows) {
      const helloWorld = HELLO_WORLD_BY_LANGUAGE[row.language_name];
      const nextTemplate = containsLegacyGreeting(row.template_code)
        ? (helloWorld || row.template_code.replace(/Asslamu alaikum|asslamu alaikum|Assalamu alaikum/gi, 'Hello World'))
        : row.template_code;
      const nextSolution = containsLegacyGreeting(row.solution_code)
        ? (helloWorld || row.solution_code.replace(/Asslamu alaikum|asslamu alaikum|Assalamu alaikum/gi, 'Hello World'))
        : row.solution_code;

      await connection.execute(
        'UPDATE code_templates SET template_code = ?, solution_code = ? WHERE id = ?',
        [nextTemplate, nextSolution, row.id]
      );
      updated += 1;
      console.log(`Updated template ${row.id} (${row.language_name})`);
    }

    console.log(`Done. Updated ${updated} code template(s).`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Failed to update code templates:', error.message);
  process.exit(1);
});
