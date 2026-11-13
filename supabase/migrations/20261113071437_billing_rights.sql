-- The billing tables are the pay function's alone (service_role). Row level security already keeps the page's roles
-- out of the rows; take away the table rights they still held by default (truncate, references, trigger) as well.
revoke all on public.billing, public.billing_events, public.billing_config from anon, authenticated;
