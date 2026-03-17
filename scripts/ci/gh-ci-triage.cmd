@echo off
setlocal
cd /d %~dp0\..\..
bash scripts/ci/gh-ci-triage.sh %*
