/**
 * Idempotent, additive schema application for the Emergency Blood Network.
 * Used instead of `drizzle-kit push` because push's interactive table/enum
 * resolver requires a TTY (it cannot run in non-interactive shells / CI).
 *
 *   node artifacts/api-server/apply-blood-schema.mjs
 */
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  // Enums (CREATE TYPE has no IF NOT EXISTS — guard via catalog check).
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_type') THEN
       CREATE TYPE blood_type AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
     END IF;
   END $$;`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_urgency') THEN
       CREATE TYPE blood_urgency AS ENUM ('low','normal','critical');
     END IF;
   END $$;`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_request_status') THEN
       CREATE TYPE blood_request_status AS ENUM ('open','fulfilled','cancelled');
     END IF;
   END $$;`,
  // Donor community registry.
  `CREATE TABLE IF NOT EXISTS donor_profiles (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id uuid REFERENCES users(id),
     name text NOT NULL,
     blood_type blood_type NOT NULL,
     phone text NOT NULL,
     area text,
     city text,
     latitude numeric(9,6),
     longitude numeric(9,6),
     is_available boolean NOT NULL DEFAULT true,
     last_donation date,
     created_at timestamp DEFAULT now(),
     CONSTRAINT donor_profiles_user_unique UNIQUE (user_id)
   );`,
  // Blood requests broadcast to the community.
  `CREATE TABLE IF NOT EXISTS blood_requests (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     requester_id uuid REFERENCES users(id),
     patient_name text NOT NULL,
     blood_type blood_type NOT NULL,
     units_needed integer NOT NULL DEFAULT 1,
     hospital text NOT NULL,
     area text,
     city text,
     latitude numeric(9,6),
     longitude numeric(9,6),
     urgency blood_urgency NOT NULL DEFAULT 'normal',
     contact_phone text NOT NULL,
     note text,
     status blood_request_status NOT NULL DEFAULT 'open',
     created_at timestamp DEFAULT now()
   );`,
];

(async () => {
  const client = await pool.connect();
  try {
    for (const sql of statements) {
      await client.query(sql);
      console.log("✓", sql.split("\n")[0].trim().slice(0, 70));
    }
    console.log("Blood network schema applied successfully.");
  } catch (e) {
    console.error("Schema apply failed:", e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
