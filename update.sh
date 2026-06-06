#!/bin/bash
# 서버에서 최신 코드를 GitHub에서 다운로드하고 서비스 재시작
# 사용법: bash update.sh

set -e
cd "$(dirname "$0")"

echo "=== 설정 백업 ==="
cp -f data/config.json /tmp/eco-config-backup.json 2>/dev/null || true
cp -f data/nps.json /tmp/eco-nps-backup.json 2>/dev/null || true

echo "=== 최신 코드 다운로드 ==="
curl -L https://github.com/luckluckgo/economic-dashboard/archive/refs/heads/main.zip -o /tmp/eco-update.zip
cd ..
rm -rf economic-dashboard-new
unzip -q /tmp/eco-update.zip -d .
mv economic-dashboard-main economic-dashboard-new

echo "=== 설정 복원 ==="
cp -f /tmp/eco-config-backup.json economic-dashboard-new/data/config.json 2>/dev/null || true
cp -f /tmp/eco-nps-backup.json economic-dashboard-new/data/nps.json 2>/dev/null || true

echo "=== 의존성 설치 ==="
cd economic-dashboard-new
npm install --production

echo "=== 교체 ==="
cd ..
if [ -d economic-dashboard ]; then
  rm -rf economic-dashboard-old
  mv economic-dashboard economic-dashboard-old
fi
mv economic-dashboard-new economic-dashboard

echo "=== 서비스 재시작 ==="
if command -v pm2 &> /dev/null; then
  pm2 restart eco 2>/dev/null || pm2 start economic-dashboard/server.js --name eco
else
  kill $(lsof -ti:3000) 2>/dev/null || true
  cd economic-dashboard
  nohup node server.js > server.log 2>&1 &
fi

echo "=== 완료! ==="
rm -f /tmp/eco-update.zip
