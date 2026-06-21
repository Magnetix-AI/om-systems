
CREATE TABLE public.job_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.job_categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_categories TO authenticated;
GRANT ALL ON public.job_categories TO service_role;

ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_categories_read ON public.job_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY job_categories_admin_all ON public.job_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_job_categories_updated_at BEFORE UPDATE ON public.job_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.jobs ADD COLUMN category_id uuid REFERENCES public.job_categories(id) ON DELETE SET NULL;
CREATE INDEX idx_jobs_category_id ON public.jobs(category_id);

INSERT INTO public.job_categories (name, is_default) VALUES ('כללי', true);

UPDATE public.jobs SET category_id = (SELECT id FROM public.job_categories WHERE is_default LIMIT 1)
WHERE category_id IS NULL;
