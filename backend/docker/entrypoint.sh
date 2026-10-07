#!/bin/sh
# เริ่ม api ใน container: migration ก่อน แล้วค่อยเปิด server (docs/deployment.md ข้อ 3.4)
# ห้าม prisma migrate dev / db push / seed ตอนสตาร์ต
set -e
cd /app/backend
./node_modules/.bin/prisma migrate deploy
exec node dist/main.js
