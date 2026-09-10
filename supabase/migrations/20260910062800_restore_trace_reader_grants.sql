begin;

-- The analytics dashboard authenticates with a JWT whose database role is
-- analytics_reader. Replacing these wrappers in 20260910040500 correctly kept
-- them closed to public client roles, but omitted the restricted reader grant.
-- Keep the wrappers SECURITY DEFINER so that reader can execute only this
-- bounded contract without receiving access to pipeline_requests or analytics.
alter function public.analytics_requests_page(text, int, int)
  security definer;
alter function public.analytics_trace_detail(uuid, int)
  security definer;

revoke all on function public.analytics_requests_page(text, int, int)
  from public, anon, authenticated;
revoke all on function public.analytics_trace_detail(uuid, int)
  from public, anon, authenticated;

grant execute on function public.analytics_requests_page(text, int, int)
  to analytics_reader, service_role;
grant execute on function public.analytics_trace_detail(uuid, int)
  to analytics_reader, service_role;

commit;
