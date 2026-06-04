
CREATE TYPE public.project_status AS ENUM ('open','closed');

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.project_status NOT NULL DEFAULT 'open',
  start_date date,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_admin_all ON public.projects FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY projects_select_assigned ON public.projects FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR technician_id = auth.uid());

CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.project_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT (now()::date),
  arrival_time timestamptz,
  departure_time timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_visits TO authenticated;
GRANT ALL ON public.project_visits TO service_role;
ALTER TABLE public.project_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY pv_admin_all ON public.project_visits FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY pv_select_assigned ON public.project_visits FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR technician_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.technician_id = auth.uid()));
CREATE POLICY pv_tech_insert ON public.project_visits FOR INSERT TO authenticated
  WITH CHECK (technician_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.technician_id = auth.uid() AND p.status = 'open'));
CREATE POLICY pv_tech_update ON public.project_visits FOR UPDATE TO authenticated
  USING (technician_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.technician_id = auth.uid() AND p.status = 'open'))
  WITH CHECK (technician_id = auth.uid());

CREATE TRIGGER pv_set_updated_at BEFORE UPDATE ON public.project_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.project_visit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.project_visits(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_visit_items TO authenticated;
GRANT ALL ON public.project_visit_items TO service_role;
ALTER TABLE public.project_visit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pvi_admin_all ON public.project_visit_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY pvi_select_assigned ON public.project_visit_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM public.project_visits v JOIN public.projects p ON p.id = v.project_id
    WHERE v.id = visit_id AND (v.technician_id = auth.uid() OR p.technician_id = auth.uid())));
CREATE POLICY pvi_tech_modify ON public.project_visit_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_visits v JOIN public.projects p ON p.id = v.project_id
    WHERE v.id = visit_id AND v.technician_id = auth.uid() AND p.status = 'open'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_visits v JOIN public.projects p ON p.id = v.project_id
    WHERE v.id = visit_id AND v.technician_id = auth.uid() AND p.status = 'open'));
