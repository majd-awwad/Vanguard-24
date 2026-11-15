@echo off
setlocal
cd /d "%~dp0"
echo Branch:
git branch --show-current
git add web/studio web/studio.html web/visual/studio.css web/pages/studio.html dist/studio dist/studio.html dist/visual/studio.css dist/pages/studio.html start-demo.bat publish-studio.bat DEMO_AR.md
git status --short
git commit -m "Studio: share night-lights map engine (map-core) with GEOS-FP dust studio" -m "pages/studio.html now uses the same pan/zoom/probe/visible-area scan engine with real numeric dust values." -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_017J91oFLmmeUeGALNQ3mb1j"
git push origin HEAD
pause
