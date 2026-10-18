@echo off
rem Starts a local web server for the game and opens it in the browser.
rem (Opening index.html directly does not work: browsers block loading the JS modules and house.json from file://)
cd /d "%~dp0"
start "" http://localhost:8080/
npx --yes http-server -p 8080 -c-1 .
