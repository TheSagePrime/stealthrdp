#!/bin/bash
# StealthRDP v2 preview tunnel wrapper
exec /opt/data/bin/cloudflared tunnel --url http://localhost:8080 --no-autoupdate
