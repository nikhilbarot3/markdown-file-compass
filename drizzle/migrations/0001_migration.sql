CREATE TABLE public.policy_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  section text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  item_id text REFERENCES public.equipment_items(id) ON DELETE CASCADE
);
GRANT SELECT ON public.policy_sections TO anon, authenticated;
GRANT ALL ON public.policy_sections TO service_role;
ALTER TABLE public.policy_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read policy sections" ON public.policy_sections FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.policy_sections (plan_id, section, title, body, item_id) VALUES
 ('bluecare_ppo','2.1','Network','Use an in-network supplier to receive plan benefits. Out-of-network equipment is not covered except in emergencies (sample).',NULL),
 ('bluecare_ppo','4.2','DME coverage','Durable medical equipment is covered at 80% after deductible when prescribed by a licensed provider (sample).',NULL),
 ('bluecare_ppo','4.5','Prior authorization','A back brace needs prior authorization before purchase (sample).','back_brace'),
 ('bluecare_ppo','4.5','Prior authorization','A CPAP needs prior authorization and a sleep study on file (sample).','cpap'),
 ('bluecare_ppo','4.5','Prior authorization','A wheelchair needs prior authorization before purchase (sample).','wheelchair'),
 ('bluecare_ppo','4.7','Annual limit','Annual equipment limit for this item is $250 (sample).',NULL),
 ('metro_medicaid','2.1','Network','Equipment must come from a Medicaid-enrolled supplier (sample).',NULL),
 ('metro_medicaid','4.2','DME coverage','Durable medical equipment is covered with no copay when medically necessary (sample).',NULL),
 ('metro_medicaid','4.5','Prior authorization','A back brace needs prior authorization before purchase (sample).','back_brace'),
 ('metro_medicaid','4.5','Prior authorization','A CPAP needs prior authorization before purchase (sample).','cpap'),
 ('metro_medicaid','4.7','Annual limit','Annual equipment limit for this item is $400 (sample).',NULL);