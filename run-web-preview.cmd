@echo off
cd /d C:\Users\v1taL\hr-agent-system
"C:\Program Files\nodejs\npm.cmd" --workspace @hr-agent-system/web run preview -- --host 0.0.0.0 --port 4173
