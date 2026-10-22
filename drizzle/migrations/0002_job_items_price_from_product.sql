CREATE OR REPLACE FUNCTION public.set_job_item_price() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') OR NEW.unit_price IS NULL THEN
    SELECT price INTO NEW.unit_price FROM public.products WHERE id = NEW.product_id;
  END IF;
  NEW.unit_price := COALESCE(NEW.unit_price, 0);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_set_job_item_price ON public.job_items;
CREATE TRIGGER trg_set_job_item_price BEFORE INSERT ON public.job_items FOR EACH ROW EXECUTE FUNCTION public.set_job_item_price();