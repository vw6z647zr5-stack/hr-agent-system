@echo off
cd /d C:\Users\v1taL\hr-agent-system
"C:\Program Files\nodejs\node.exe" apps\api\dist\main.js 1> api.detached.out.log 2> api.detached.err.log
