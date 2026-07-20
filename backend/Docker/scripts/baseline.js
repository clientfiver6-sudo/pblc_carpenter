const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const provider = process.env.DATABASE_PROVIDER || 'postgresql';
  const connectionUri = process.env.DATABASE_CONNECTION_URI;

  if (!connectionUri) {
    console.error('DATABASE_CONNECTION_URI is not set.');
    process.exit(1);
  }

  // Determine correct migrations source directory
  const migrationsSourceDir = path.join(__dirname, '..', '..', 'prisma', `${provider}-migrations`);
  if (!fs.existsSync(migrationsSourceDir)) {
    console.error(`Migrations source directory not found at: ${migrationsSourceDir}`);
    process.exit(1);
  }

  // Read all migrations in the source folder
  const localMigrations = fs.readdirSync(migrationsSourceDir)
    .filter(file => fs.statSync(path.join(migrationsSourceDir, file)).isDirectory())
    .sort();

  console.log(`Found ${localMigrations.length} local migrations in source folder.`);

  // Connect to database to check already applied migrations
  const client = new Client({
    connectionString: connectionUri,
    ssl: { rejectUnauthorized: false } // Supabase requires SSL
  });

  let appliedMigrations = new Set();
  try {
    await client.connect();
    // Query applied migrations from the tracking table
    const res = await client.query('SELECT migration_name FROM evolution."_prisma_migrations" WHERE finished_at IS NOT NULL');
    appliedMigrations = new Set(res.rows.map(row => row.migration_name));
    console.log(`Found ${appliedMigrations.size} already applied migrations in the database.`);
  } catch (err) {
    // If the table doesn't exist, we assume 0 applied migrations
    console.log('Could not read applied migrations (table might not exist yet):', err.message);
  } finally {
    await client.end();
  }

  // Find missing migrations
  const missingMigrations = localMigrations.filter(name => !appliedMigrations.has(name));
  console.log(`Total migrations to resolve: ${missingMigrations.length}`);

  if (missingMigrations.length === 0) {
    console.log('All migrations are already applied. No baselining needed.');
    return;
  }

  // Determine correct schema file
  const schemaFile = provider === 'psql_bouncer'
    ? './prisma/postgresql-schema.prisma'
    : `./prisma/${provider}-schema.prisma`;

  // Synchronously resolve each missing migration
  for (let i = 0; i < missingMigrations.length; i++) {
    const migrationName = missingMigrations[i];
    console.log(`[${i + 1}/${missingMigrations.length}] Resolving migration: ${migrationName}...`);
    try {
      execSync(`npx prisma migrate resolve --applied "${migrationName}" --schema "${schemaFile}"`, {
        stdio: 'inherit'
      });
    } catch (err) {
      console.error(`Failed to resolve migration ${migrationName}:`, err.message);
      process.exit(1);
    }
  }

  console.log('Successfully resolved all missing migrations.');
}

main().catch(err => {
  console.error('Fatal error in baseline script:', err);
  process.exit(1);
});
