-- Add audit log enum values for driver route/stop adjustments
ALTER TYPE "public"."audit_action" ADD VALUE 'STOP_SKIPPED';
ALTER TYPE "public"."audit_entity" ADD VALUE 'route_stop';
