-- Fish Audio POC — richer call detail.
-- Store the agent's tool calls and the full raw session payload so the UI can
-- surface everything Fish returns (not just the fields we parse explicitly).

alter table public.calls add column if not exists tool_calls jsonb;
alter table public.calls add column if not exists raw jsonb;
alter table public.calls add column if not exists language text;
