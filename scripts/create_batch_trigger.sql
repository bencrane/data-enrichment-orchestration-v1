-- ============================================================================
-- Phase 3.8: Event-Driven Orchestration - Database Trigger Setup
-- ============================================================================
--
-- Purpose: Wire up the database to trigger the Prefect Orchestrator when a
--          new batch is created. Implements a "fire-and-forget" pattern.
--
-- Prerequisites:
--   1. Supabase Edge Function `trigger-prefect-orchestrator` must be deployed
--   2. Replace <PROJECT_REF> with your Supabase project reference
--   3. Replace <SUPABASE_ANON_KEY> with your Supabase anon/public key
--
-- Execution: Run this script manually in the Supabase Dashboard SQL Editor
-- ============================================================================

-- ============================================================================
-- CONFIGURATION: Replace these placeholders before running!
-- ============================================================================
--
-- <PROJECT_REF>       : Your Supabase project reference (found in project URL)
--                       Example: abcdefghijklmnop
--
-- <SUPABASE_ANON_KEY> : Your Supabase anon/public key (found in API settings)
--                       Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
--
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Step 1: Enable the pg_net extension for HTTP requests from Postgres
-- ----------------------------------------------------------------------------
-- pg_net allows Postgres to make asynchronous HTTP requests.
-- This is required for the trigger to call the Edge Function.
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";


-- ----------------------------------------------------------------------------
-- Step 2: Create the notification function
-- ----------------------------------------------------------------------------
-- This function is called by the trigger after a batch is inserted.
-- It uses pg_net's http_post to asynchronously call the Edge Function.
-- The call is fire-and-forget: it does not block the INSERT transaction.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_prefect_on_batch_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT := 'https://demdntaknhsjzylhmynq.supabase.co/functions/v1/trigger-prefect-orchestrator';
  request_id BIGINT;
BEGIN
  -- Make an asynchronous HTTP POST request to the Edge Function
  -- pg_net.http_post is non-blocking and returns immediately
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbWRudGFrbmhzanp5bGhteW5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMzEwNjgsImV4cCI6MjA4MjcwNzA2OH0.HUwfNVEn9AeK9Y3ugsGQ4lTBotQVrVh-124lyHPYURg'
    ),
    body := jsonb_build_object(
      'batch_id', NEW.id::TEXT
    )
  ) INTO request_id;

  -- Log the request for debugging (visible in Postgres logs)
  RAISE LOG '[notify_prefect_on_batch_insert] Triggered for batch_id: %, request_id: %', NEW.id, request_id;

  -- Always return NEW to allow the INSERT to complete
  -- This ensures fire-and-forget behavior: the INSERT succeeds regardless of HTTP call status
  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- Step 3: Create the trigger on the batches table
-- ----------------------------------------------------------------------------
-- This trigger fires AFTER UPDATE when status flips from INITIALIZING to PENDING.
-- This ensures all batch items and workflow states are inserted before triggering.
-- (Status Flip pattern prevents the "Empty House" race condition)
-- ----------------------------------------------------------------------------

-- Drop existing triggers if they exist (for idempotent re-runs)
DROP TRIGGER IF EXISTS trigger_batch_created ON public.batches;
DROP TRIGGER IF EXISTS trigger_batch_ready ON public.batches;

-- Create the new trigger that fires on status flip
CREATE TRIGGER trigger_batch_ready
  AFTER UPDATE ON public.batches
  FOR EACH ROW
  WHEN (OLD.status = 'INITIALIZING' AND NEW.status = 'PENDING')
  EXECUTE FUNCTION public.notify_prefect_on_batch_insert();


-- ----------------------------------------------------------------------------
-- Step 4: Verify the setup
-- ----------------------------------------------------------------------------
-- Run these queries to confirm the trigger and function are created correctly.
-- ----------------------------------------------------------------------------

-- Check that the function exists
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'notify_prefect_on_batch_insert';

-- Check that the trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_batch_ready';


-- ============================================================================
-- NOTES
-- ============================================================================
--
-- Fire-and-Forget Behavior:
--   - pg_net.http_post is asynchronous; it queues the request and returns immediately
--   - The INSERT transaction is NOT blocked waiting for the HTTP response
--   - If the Edge Function call fails, the batch INSERT still succeeds
--   - Check pg_net._http_response table for debugging failed requests
--
-- Debugging:
--   - View request logs: SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
--   - View Postgres logs for RAISE LOG messages
--   - Check Edge Function logs in Supabase Dashboard > Edge Functions > Logs
--
-- Security:
--   - Function uses SECURITY DEFINER to run with owner privileges
--   - Edge Function validates the request and handles auth via Supabase Anon Key
--   - Prefect API Key is stored securely in Edge Function environment variables
--
-- ============================================================================
