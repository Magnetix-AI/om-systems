CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  -- SECURITY: Never trust client-supplied role metadata. Always default to 'technician'.
  -- Admins must be promoted explicitly by an existing admin via the user_roles table.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'technician');
  RETURN NEW;
END; $function$;