/**
 * สร้าง backend/openapi.json จาก decorator ของ controller (tech-stack.md ข้อ 3 · CI กฎ API-01)
 * ไม่ต่อฐานข้อมูลและไม่ยิง Core Hub — ใช้ env ตัวอย่างแค่ให้แอปบูตได้
 *   pnpm --filter backend generate:openapi
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PLACEHOLDER_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  LOG_SILENT: '1',
  SUBSYSTEM_ID: 'csmju-elearning',
  CORE_HUB_URL: 'https://core-hub.invalid',
  CORE_HUB_WEB_URL: 'https://core-hub.invalid',
  CORE_HUB_ISSUER: 'core-hub',
  CORE_HUB_AUDIENCE: 'csmju2030',
  DATABASE_URL: 'postgresql://openapi@127.0.0.1:1/openapi',
};

async function main() {
  for (const [k, v] of Object.entries(PLACEHOLDER_ENV)) process.env[k] = v;
  const { createApp, buildOpenApi } = await import('../src/main');
  const { app } = await createApp();
  const doc = buildOpenApi(app);
  writeFileSync(join(__dirname, '..', 'openapi.json'), JSON.stringify(doc, null, 2) + '\n');
  await app.close();
}

void main();
