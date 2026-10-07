# API ของระบบย่อย (NestJS) — docs/deployment.md ข้อ 3
# build จากรากของ repo เพราะ pnpm workspace เก็บ lockfile ไว้ที่ราก:
#   docker build -f backend/Dockerfile -t csmju-elearning-api .
#
# - ค่าทุกอย่าง (DATABASE_URL · CORE_HUB_* ...) มาจาก env ตอนรัน — ห้ามใส่ secret ใน ARG / ENV
# - ตอนสตาร์ตรันแค่ prisma migrate deploy แล้วเปิด server (ไม่ seed)

# ---------- build stage ----------
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CHECKPOINT_DISABLE=1
RUN corepack enable pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/
# ลบ store และ cache ของ pnpm ใน RUN เดียวกับ install — ไม่งั้นติดไปใน layer อีกหลายร้อย MB
# (ไม่ใส่ --ignore-scripts: @prisma/engines ต้องโหลด engine ที่ migrate deploy ใช้)
RUN pnpm install --frozen-lockfile --filter backend... \
    && rm -rf /root/.local/share/pnpm /root/.cache /root/.npm

COPY backend/ backend/
# prisma generate + nest build (ไม่ต้องต่อฐานข้อมูล)
RUN pnpm --filter backend build

# ---------- runtime stage ----------
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    TZ=Asia/Bangkok \
    HOME=/tmp \
    CHECKPOINT_DISABLE=1

# node_modules ของ pnpm เป็น symlink สัมพัทธ์ — copy ทั้งต้นไม้ให้โครงเดิมไว้ (ไม่ใช้ chown -R)
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/package.json backend/package.json
COPY --from=builder /app/backend/node_modules backend/node_modules
COPY --from=builder /app/backend/dist backend/dist
COPY --from=builder /app/backend/prisma backend/prisma
COPY --from=builder /app/backend/prisma.config.ts backend/prisma.config.ts
COPY backend/docker/entrypoint.sh backend/docker/entrypoint.sh

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "backend/docker/entrypoint.sh"]
