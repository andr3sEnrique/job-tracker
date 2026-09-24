#!/bin/sh
# Demo environment for screenshots and videos: a separate local database with sample data
# and a synthetic Gmail inbox. Your real data (database `job_tracker`) is never touched.
#
#   pnpm demo:setup   create/refresh the demo database with sample applications
#   pnpm dev:demo     run web + api against it, with the fake mailbox (MAIL_PROVIDER=fake)
set -e

DEMO_DB=job_tracker_demo
export DATABASE_URL="postgresql://jat:jat@localhost:5432/${DEMO_DB}"
export MAIL_PROVIDER=fake

case "$1" in
  setup)
    pnpm db:up
    if ! docker exec jat-postgres psql -U jat -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='${DEMO_DB}'" | grep -q 1; then
      docker exec jat-postgres createdb -U jat "${DEMO_DB}"
      echo "Created database ${DEMO_DB}."
    fi
    pnpm db:migrate
    # Replaces the demo owner's applications with the deterministic sample set.
    pnpm db:seed -- --force
    echo "Demo database ready. Start it with: pnpm dev:demo"
    ;;
  dev)
    pnpm db:up
    pnpm db:migrate
    turbo run dev
    ;;
  *)
    echo "usage: sh scripts/demo.sh setup|dev" >&2
    exit 1
    ;;
esac
