CREATE OR REPLACE FUNCTION cloud_menu_dashboard(v uuid,s timestamptz,e timestamptz,ps timestamptz,pe timestamptz,cs timestamptz,ce timestamptz)
RETURNS jsonb LANGUAGE sql STABLE AS $$
WITH periods AS (SELECT 0 AS id,s AS a,e AS b UNION ALL SELECT 1,ps,pe),
completed AS (SELECT o.id,max(i.served_at) AS completed_at,sum(i.line_total_tzs) AS amount_tzs FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.venue_id=v AND o.status='SERVED' AND i.status='SERVED' GROUP BY o.id),
stats AS (SELECT p.id,jsonb_build_object(
 'revenue_tzs',(SELECT COALESCE(sum(amount_tzs),0)::text FROM completed WHERE completed_at>=p.a AND completed_at<p.b),
 'ordered_sales_tzs',(SELECT COALESCE(sum(i.line_total_tzs),0)::text FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.venue_id=v AND o.created_at>=p.a AND o.created_at<p.b AND i.status NOT IN ('REJECTED','CANCELLED')),
 'orders',(SELECT count(*) FROM orders WHERE venue_id=v AND created_at>=p.a AND created_at<p.b),
 'average_bill_tzs',(SELECT COALESCE(round(avg(total_tzs)),0)::text FROM bills WHERE venue_id=v AND created_at>=p.a AND created_at<p.b AND status<>'VOID'),
 'payment_success_rate',(SELECT round(100.0*count(*) FILTER(WHERE status='SUCCESS')/nullif(count(*),0),1) FROM payment_transactions WHERE venue_id=v AND status IN ('SUCCESS','FAILED','CANCELLED','EXPIRED') AND completed_at>=p.a AND completed_at<p.b),
 'waiter_response_seconds',(SELECT round(avg(greatest(0,extract(epoch FROM acknowledged_at-created_at)))) FROM waiter_calls WHERE venue_id=v AND acknowledged_at IS NOT NULL AND created_at>=p.a AND created_at<p.b),
 'table_turnover',(SELECT round(count(*)::numeric/nullif((SELECT count(*) FROM dining_tables WHERE venue_id=v AND is_active),0),2) FROM table_sessions WHERE venue_id=v AND status='CLOSED' AND closed_at>=p.a AND closed_at<p.b)
 ) AS data FROM periods p),
hours AS (SELECT generate_series(0,23) AS hour),
seller AS (SELECT i.item_id,min(i.name_snapshot) AS name,sum(i.quantity)::text AS quantity,sum(i.line_total_tzs)::text AS sales_tzs FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.venue_id=v AND o.created_at>=s AND o.created_at<e AND i.status NOT IN ('REJECTED','CANCELLED') GROUP BY i.item_id ORDER BY sum(i.line_total_tzs) DESC,i.item_id LIMIT 10),
mix AS (SELECT provider::text AS provider,sum(amount_tzs)::text AS amount_tzs,count(*) AS count FROM payment_transactions WHERE venue_id=v AND status='SUCCESS' AND completed_at>=s AND completed_at<e GROUP BY provider ORDER BY sum(amount_tzs) DESC,provider),
floor AS (SELECT t.id,t.label,t.zone,
 CASE WHEN EXISTS(SELECT 1 FROM waiter_calls c WHERE c.venue_id=v AND c.session_id=ts.id AND c.status='OPEN') THEN 'CALL' WHEN EXISTS(SELECT 1 FROM bill_splits bs WHERE bs.venue_id=v AND bs.session_id=ts.id AND bs.status='LOCKED') THEN 'PAYING' WHEN ts.id IS NOT NULL THEN 'SEATED' ELSE 'FREE' END AS status,
 COALESCE(b.total_tzs-b.paid_tzs,0)::text AS balance_tzs FROM dining_tables t LEFT JOIN table_sessions ts ON ts.table_id=t.id AND ts.venue_id=v AND ts.status='ACTIVE' LEFT JOIN bills b ON b.session_id=ts.id AND b.venue_id=v WHERE t.venue_id=v AND t.is_active ORDER BY t.label,t.id)
SELECT jsonb_build_object(
 'current',(SELECT data FROM stats WHERE id=0),'previous',(SELECT data FROM stats WHERE id=1),
 'revenue_by_hour',(SELECT jsonb_agg(jsonb_build_object('hour',h.hour,'revenue_tzs',(SELECT COALESCE(sum(amount_tzs),0)::text FROM completed WHERE completed_at>=s AND completed_at<e AND extract(hour FROM completed_at AT TIME ZONE 'Africa/Dar_es_Salaam')=h.hour),'comparison_tzs',(SELECT COALESCE(sum(amount_tzs),0)::text FROM completed WHERE completed_at>=cs AND completed_at<ce AND extract(hour FROM completed_at AT TIME ZONE 'Africa/Dar_es_Salaam')=h.hour)) ORDER BY h.hour) FROM hours h),
 'orders_by_hour',(SELECT jsonb_agg(jsonb_build_object('hour',h.hour,'orders',(SELECT count(*) FROM orders WHERE venue_id=v AND created_at>=s AND created_at<e AND extract(hour FROM created_at AT TIME ZONE 'Africa/Dar_es_Salaam')=h.hour)) ORDER BY h.hour) FROM hours h),
 'top_sellers',COALESCE((SELECT jsonb_agg(to_jsonb(seller) order by seller.sales_tzs::numeric desc,seller.item_id) FROM seller),'[]'::jsonb),
 'payment_mix',COALESCE((SELECT jsonb_agg(to_jsonb(mix)) FROM mix),'[]'::jsonb),
 'floor',COALESCE((SELECT jsonb_agg(to_jsonb(floor)) FROM floor),'[]'::jsonb),
 'traffic',coalesce((select jsonb_agg(to_jsonb(x)) from (select extract(isodow from created_at at time zone 'Africa/Dar_es_Salaam')::int as day,extract(hour from created_at at time zone 'Africa/Dar_es_Salaam')::int as hour,count(*) as orders from orders where venue_id=v and created_at>=s and created_at<e group by 1,2) x),'[]'),
 'categories',coalesce((select jsonb_agg(to_jsonb(x) order by x.sales_tzs desc) from (select c.id,c.name_en,c.name_sw,sum(i.line_total_tzs) as sales_tzs from orders o join order_items i on i.order_id=o.id join items m on m.id=i.item_id and m.venue_id=v join categories c on c.id=m.category_id where o.venue_id=v and o.created_at>=s and o.created_at<e and i.status not in ('REJECTED','CANCELLED') group by c.id) x),'[]'),
 'stock_alerts',coalesce((select jsonb_agg(to_jsonb(x) order by x.stock_quantity,x.name_en) from (select name_en,name_sw,stock_quantity from items where venue_id=v and is_active and track_stock and stock_quantity<=low_stock_threshold order by stock_quantity,name_en limit 8) x),'[]'),
 'delivery_minutes',(select round(avg(extract(epoch from c.completed_at-o.created_at)/60),1) from completed c join orders o on o.id=c.id where c.completed_at>=s and c.completed_at<e),
 'low_stock',(SELECT count(*) FROM items WHERE venue_id=v AND is_active AND track_stock AND stock_quantity<=low_stock_threshold)
);
$$;
