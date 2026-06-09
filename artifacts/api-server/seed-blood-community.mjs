/**
 * Seeds the Emergency Blood Network community so "nearby donors" and
 * "nearby requests" are populated out of the box.
 *
 * Run AFTER `pnpm --filter @workspace/db run push` has created the
 * donor_profiles / blood_requests tables:
 *   node artifacts/api-server/seed-blood-community.mjs
 *
 * Idempotent — it clears only the *seeded* rows (those with no owning user)
 * and re-inserts them, leaving real users' profiles/requests untouched.
 */
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Donors clustered around a few localities (lat/lng) so proximity sorting works.
const DONORS = [
  { name: "Arjun Nair",      bloodType: "O-",  phone: "+91 98450 11001", area: "Koramangala",   city: "Bengaluru", lat: 12.9352, lng: 77.6245, days: 120 },
  { name: "Priya Reddy",     bloodType: "O+",  phone: "+91 98450 11002", area: "Indiranagar",   city: "Bengaluru", lat: 12.9719, lng: 77.6412, days: 45 },
  { name: "Mohit Sharma",    bloodType: "A+",  phone: "+91 98450 11003", area: "HSR Layout",    city: "Bengaluru", lat: 12.9116, lng: 77.6389, days: 200 },
  { name: "Fatima Khan",     bloodType: "B+",  phone: "+91 98450 11004", area: "Whitefield",    city: "Bengaluru", lat: 12.9698, lng: 77.7500, days: 90 },
  { name: "Rahul Verma",     bloodType: "AB+", phone: "+91 98450 11005", area: "Jayanagar",     city: "Bengaluru", lat: 12.9250, lng: 77.5938, days: 30 },
  { name: "Sneha Iyer",      bloodType: "A-",  phone: "+91 98450 11006", area: "BTM Layout",    city: "Bengaluru", lat: 12.9166, lng: 77.6101, days: 160 },
  { name: "Vikram Singh",    bloodType: "O-",  phone: "+91 98450 11007", area: "Marathahalli",  city: "Bengaluru", lat: 12.9569, lng: 77.7011, days: 75 },
  { name: "Ananya Das",      bloodType: "B-",  phone: "+91 98450 11008", area: "Electronic City", city: "Bengaluru", lat: 12.8452, lng: 77.6602, days: 110 },
  { name: "Karthik Menon",   bloodType: "O+",  phone: "+91 98450 11009", area: "Bellandur",     city: "Bengaluru", lat: 12.9260, lng: 77.6762, days: 20 },
  { name: "Divya Pillai",    bloodType: "AB-", phone: "+91 98450 11010", area: "Malleshwaram",  city: "Bengaluru", lat: 13.0033, lng: 77.5703, days: 240 },
  { name: "Imran Sheikh",    bloodType: "A+",  phone: "+91 98450 11011", area: "JP Nagar",      city: "Bengaluru", lat: 12.9063, lng: 77.5857, days: 55 },
  { name: "Meera Joshi",     bloodType: "O-",  phone: "+91 98450 11012", area: "Banashankari",  city: "Bengaluru", lat: 12.9255, lng: 77.5468, days: 95 },
];

const REQUESTS = [
  { patientName: "ICU Patient (Apollo)", bloodType: "O-",  units: 2, hospital: "Apollo Hospital",       area: "Bannerghatta Rd", city: "Bengaluru", lat: 12.8939, lng: 77.5970, urgency: "critical", phone: "+91 98860 22001", note: "Urgent — surgery scheduled tonight." },
  { patientName: "Ramesh K.",            bloodType: "B+",  units: 1, hospital: "Manipal Hospital",      area: "Old Airport Rd",  city: "Bengaluru", lat: 12.9580, lng: 77.6490, urgency: "normal",   phone: "+91 98860 22002", note: "Needed within 24 hours." },
  { patientName: "Lakshmi S.",           bloodType: "A+",  units: 3, hospital: "Fortis Hospital",       area: "Cunningham Rd",   city: "Bengaluru", lat: 12.9869, lng: 77.5950, urgency: "critical", phone: "+91 98860 22003", note: "Dengue — platelets dropping." },
];

const isoDaysAgo = (d) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
};

async function seedDonors() {
  await pool.query("DELETE FROM donor_profiles WHERE user_id IS NULL");
  let n = 0;
  for (const d of DONORS) {
    await pool.query(
      `INSERT INTO donor_profiles
         (name, blood_type, phone, area, city, latitude, longitude, is_available, last_donation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)`,
      [d.name, d.bloodType, d.phone, d.area, d.city, d.lat, d.lng, isoDaysAgo(d.days)]
    );
    n++;
  }
  console.log(`Seeded ${n} community donor(s).`);
}

async function seedRequests() {
  await pool.query("DELETE FROM blood_requests WHERE requester_id IS NULL");
  let n = 0;
  for (const r of REQUESTS) {
    await pool.query(
      `INSERT INTO blood_requests
         (patient_name, blood_type, units_needed, hospital, area, city, latitude, longitude, urgency, contact_phone, note, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open')`,
      [r.patientName, r.bloodType, r.units, r.hospital, r.area, r.city, r.lat, r.lng, r.urgency, r.phone, r.note]
    );
    n++;
  }
  console.log(`Seeded ${n} open blood request(s).`);
}

(async () => {
  try {
    await seedDonors();
    await seedRequests();
    console.log("Blood community seed complete.");
  } catch (e) {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
