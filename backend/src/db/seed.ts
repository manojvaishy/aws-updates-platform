/**
 * Dev seed — inserts sample data for local development.
 * Run with: npx ts-node src/db/seed.ts
 */
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("[seed] Seeding users...");
  const hash = await bcrypt.hash("password123", 10);

  await pool.query(`
    INSERT INTO users (email, password_hash, name, role, language_preference)
    VALUES
      ('architect@example.com', $1, 'Alice Architect', 'solution_architect', 'en'),
      ('dev@example.com',       $1, 'Bob Developer',   'developer',          'en'),
      ('devops@example.com',    $1, 'Carol DevOps',    'devops',             'hi'),
      ('data@example.com',      $1, 'Dave Data',       'data_engineer',      'hinglish')
    ON CONFLICT (email) DO NOTHING
  `, [hash]);

  console.log("[seed] Seeding sample updates...");
  await pool.query(`
    INSERT INTO updates (
      title, raw_content, simplified_en, source_url, content_hash,
      published_at, category, service_tags, role_tags, priority, is_processed, processed_at
    ) VALUES
    (
      'Amazon EC2 now supports new instance types',
      'AWS announces the availability of new EC2 instance types optimized for compute-intensive workloads...',
      'AWS added new EC2 server types that are faster for heavy computing tasks. If you run CPU-heavy apps, these could save you money.',
      'https://aws.amazon.com/about-aws/whats-new/2025/01/ec2-new-instance-types',
      md5('ec2-new-instance-types-2025-01'),
      '2025-01-15 10:00:00+00',
      'Compute',
      ARRAY['EC2'],
      ARRAY['developer', 'devops', 'solution_architect']::user_role[],
      'normal',
      TRUE,
      NOW()
    ),
    (
      'AWS Lambda deprecating Node.js 16 runtime',
      'AWS Lambda will end support for Node.js 16 on March 31, 2025. Functions using this runtime must be updated...',
      'Lambda is dropping Node.js 16 support on March 31, 2025. You must upgrade your Lambda functions to Node.js 18 or 20 before that date or they will stop working.',
      'https://aws.amazon.com/about-aws/whats-new/2025/01/lambda-nodejs16-deprecation',
      md5('lambda-nodejs16-deprecation-2025-01'),
      '2025-01-20 14:00:00+00',
      'Serverless',
      ARRAY['Lambda'],
      ARRAY['developer', 'devops']::user_role[],
      'critical',
      TRUE,
      NOW()
    ),
    (
      'Amazon S3 introduces automatic checksum validation',
      'Amazon S3 now automatically validates checksums on upload and download to ensure data integrity...',
      'S3 now automatically checks that your files are not corrupted when uploading or downloading. No extra setup needed — it just works.',
      'https://aws.amazon.com/about-aws/whats-new/2025/01/s3-checksum-validation',
      md5('s3-checksum-validation-2025-01'),
      '2025-01-22 09:00:00+00',
      'Storage',
      ARRAY['S3'],
      ARRAY['developer', 'devops', 'data_engineer', 'solution_architect']::user_role[],
      'normal',
      TRUE,
      NOW()
    )
    ON CONFLICT (content_hash) DO NOTHING
  `);

  await pool.end();
  console.log("[seed] Done.");
}

seed().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
