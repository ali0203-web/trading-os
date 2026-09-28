-- Migration: Add unique constraint to agent_health.agent_name
-- This fixes the "no unique or exclusion constraint matching the ON CONFLICT specification" error

-- First, check if the constraint already exists (it won't in existing databases)
-- If it does exist, this will fail safely and can be ignored

-- Add unique constraint to agent_name column
ALTER TABLE agent_health ADD CONSTRAINT agent_health_agent_name_unique UNIQUE (agent_name);
