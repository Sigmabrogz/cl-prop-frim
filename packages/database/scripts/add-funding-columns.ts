import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/index.js';

async function migrate() {
  console.log('Adding funding columns...');

  try {
    // Check if columns exist first
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'positions' AND column_name = 'accumulated_funding'
    `);

    if (result.length === 0) {
      console.log('Adding accumulated_funding to positions...');
      await db.execute(sql`
        ALTER TABLE "positions"
        ADD COLUMN "accumulated_funding" numeric(18, 8) DEFAULT '0' NOT NULL
      `);

      console.log('Adding last_funding_at to positions...');
      await db.execute(sql`
        ALTER TABLE "positions"
        ADD COLUMN "last_funding_at" timestamp with time zone
      `);
    } else {
      console.log('positions columns already exist');
    }

    // Check trades table
    const result2 = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'trades' AND column_name = 'funding_fee'
    `);

    if (result2.length === 0) {
      console.log('Adding funding_fee to trades...');
      await db.execute(sql`
        ALTER TABLE "trades"
        ADD COLUMN "funding_fee" numeric(18, 8) DEFAULT '0' NOT NULL
      `);
    } else {
      console.log('trades columns already exist');
    }

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }

  process.exit(0);
}

migrate();
