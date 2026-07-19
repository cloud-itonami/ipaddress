# Ipaddress XRPC Adapter

CF Worker exposing 37 kotoba commands as XRPC endpoints.

## Endpoints

Total: 37 commands across multiple tiers (see lexicons for full list).

## Setup

```bash
cd 60-apps/etzhayyim-project-ipaddress/xrpc-adapter && npm install && npm run dev
```

## Deploy

```bash
wrangler deploy
# Deploys to ipaddress.etzhayyim.com/xrpc/*
```

See ADR-2605210000 for design context.
