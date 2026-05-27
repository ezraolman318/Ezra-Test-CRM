#!/usr/bin/env bash
# Push this project to https://github.com/ezraolman318/Ezra-Test-CRM
# Run from inside the crm folder.
set -e
[ -d .git ] && rm -rf .git
git init -b main
git config user.email "ezra.olman@gmail.com"
git config user.name "Ezra Olman"
git add .
git commit -m "Initial commit: personal CRM (React + Express + node:sqlite)"
git remote add origin https://github.com/ezraolman318/Ezra-Test-CRM.git
git push -u origin main
