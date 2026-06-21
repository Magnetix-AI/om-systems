
-- product_categories
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_categories_read ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY product_categories_admin_all ON public.product_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_product_categories_updated_at BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- products: add category_id, migrate existing text category values
ALTER TABLE public.products ADD COLUMN category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;
CREATE INDEX idx_products_category_id ON public.products(category_id);

INSERT INTO public.product_categories (name)
SELECT DISTINCT TRIM(category) FROM public.products
WHERE category IS NOT NULL AND TRIM(category) <> '';

UPDATE public.products p
SET category_id = c.id
FROM public.product_categories c
WHERE c.name = TRIM(p.category) AND p.category IS NOT NULL;

-- jobs: add project_id
ALTER TABLE public.jobs ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX idx_jobs_project_id ON public.jobs(project_id);
