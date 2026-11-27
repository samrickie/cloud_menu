-- Prevent new payment attempts while a business is inactive, even if a request raced deactivation.
-- Existing provider callbacks may still settle an already initiated payment.
CREATE TRIGGER payment_access_guard BEFORE INSERT ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION cloud_menu_order_access_guard();
