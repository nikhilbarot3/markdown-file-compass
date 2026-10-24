CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  annual_limit numeric NOT NULL
);
CREATE TABLE public.equipment_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  hcpcs_code text,
  category text NOT NULL,
  material text,
  price numeric NOT NULL
);
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  area text,
  phone text
);
CREATE TABLE public.supplier_stock (
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 0,
  PRIMARY KEY (supplier_id, item_id)
);
CREATE TABLE public.supplier_networks (
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  PRIMARY KEY (supplier_id, plan_id)
);

GRANT SELECT ON public.plans, public.equipment_items, public.suppliers, public.supplier_stock, public.supplier_networks TO anon, authenticated;
GRANT ALL ON public.plans, public.equipment_items, public.suppliers, public.supplier_stock, public.supplier_networks TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read plans" ON public.plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read items" ON public.equipment_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read suppliers" ON public.suppliers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read stock" ON public.supplier_stock FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read networks" ON public.supplier_networks FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.plans VALUES
 ('bluecare_ppo','BlueCare PPO (sample)',250),
 ('metro_medicaid','Metro Medicaid (sample)',400);

INSERT INTO public.equipment_items VALUES
 ('back_brace','back brace','L0650','Orthotic','Neoprene with rigid plastic stays',180),
 ('walker','walker','E0135','Mobility','Folding aluminum frame',90),
 ('cpap','CPAP','E0601','Respiratory','Plastic housing, silicone mask',700),
 ('wheelchair','wheelchair','K0001','Mobility','Steel frame, vinyl seat',220),
 ('knee_brace','knee brace','L1833','Orthotic','Neoprene sleeve with hinged aluminum supports',140),
 ('cane','cane','E0100','Mobility','Adjustable aluminum',25);

INSERT INTO public.suppliers (id,name,address,area,phone) VALUES
 ('11111111-1111-1111-1111-111111111111','Motor City Medical Supply (sample)','1200 Sample St, Detroit, MI','East Side','(313) 555-0101'),
 ('22222222-2222-2222-2222-222222222222','Woodward Mobility (sample)','4400 Woodward Ave, Detroit, MI','Midtown','(313) 555-0102'),
 ('33333333-3333-3333-3333-333333333333','Eastside Home Care (sample)','800 Example Rd, Detroit, MI','East Side','(313) 555-0103'),
 ('44444444-4444-4444-4444-444444444444','Corktown Health Equipment (sample)','1500 Demo Ave, Detroit, MI','Corktown','(313) 555-0104');

INSERT INTO public.supplier_networks VALUES
 ('11111111-1111-1111-1111-111111111111','bluecare_ppo'),
 ('11111111-1111-1111-1111-111111111111','metro_medicaid'),
 ('22222222-2222-2222-2222-222222222222','bluecare_ppo'),
 ('22222222-2222-2222-2222-222222222222','metro_medicaid'),
 ('33333333-3333-3333-3333-333333333333','metro_medicaid'),
 ('44444444-4444-4444-4444-444444444444','metro_medicaid');

INSERT INTO public.supplier_stock VALUES
 ('11111111-1111-1111-1111-111111111111','back_brace',3),
 ('11111111-1111-1111-1111-111111111111','walker',5),
 ('11111111-1111-1111-1111-111111111111','cpap',1),
 ('11111111-1111-1111-1111-111111111111','knee_brace',2),
 ('22222222-2222-2222-2222-222222222222','back_brace',1),
 ('22222222-2222-2222-2222-222222222222','walker',2),
 ('22222222-2222-2222-2222-222222222222','wheelchair',3),
 ('22222222-2222-2222-2222-222222222222','cane',10),
 ('33333333-3333-3333-3333-333333333333','back_brace',0),
 ('33333333-3333-3333-3333-333333333333','cpap',2),
 ('44444444-4444-4444-4444-444444444444','back_brace',4),
 ('44444444-4444-4444-4444-444444444444','knee_brace',1),
 ('44444444-4444-4444-4444-444444444444','cane',6);