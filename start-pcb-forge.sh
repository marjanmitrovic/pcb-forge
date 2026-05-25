#!/bin/bash

export NVM_DIR="$HOME/.nvm"

if [ -s "$NVM_DIR/nvm.sh" ]; then
  source "$NVM_DIR/nvm.sh"
  nvm use 22
fi

cd /home/marjan/pcb-forge || exit 1

echo "Starting PCB Forge Catalog API..."
npm run server &
SERVER_PID=$!

sleep 2

echo "Starting PCB Forge Frontend..."
npm run dev &
FRONTEND_PID=$!

sleep 3

xdg-open http://localhost:5173 >/dev/null 2>&1 &

echo ""
echo "PCB Forge is running."
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:5174"
echo ""
echo "Press ENTER to stop both servers."
read

kill $SERVER_PID
kill $FRONTEND_PID

echo "PCB Forge stopped."
