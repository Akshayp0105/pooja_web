import { Check } from 'lucide-react';
import { Reveal, SectionHeading } from './ui';
import { cn } from '../lib/cn';
import { usePlans } from '../lib/plans';

export function Plans() {
  const { plans, selected, select } = usePlans();
  return (
    <section id="plans" className="gutter section relative scroll-mt-24">
      <div className="mx-auto max-w-wide">
        <SectionHeading
          ml="സമർപ്പണ രീതികൾ"
          title="Choose how you submit"
          sub="Every plan seals your belongings until Vijayadashami and returns them with a blessing. Prasadam adds a return gift; Anugraham adds a slokam in your inbox every morning."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3 lg:gap-5">
          {plans.map((p, i) => {
            const active = p.id === selected.id;
            return (
              <Reveal key={p.id} delay={i * 0.06}>
                <div
                  className={cn(
                    'flex h-full flex-col rounded-[24px] border bg-white/75 p-6 transition-all duration-300 sm:p-7',
                    active ? 'border-saffron/60 shadow-lift' : 'border-gold/15 hover:-translate-y-1 hover:border-gold/40 hover:shadow-soft',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <p className="font-ml text-[15px] text-saffron">{p.name_ml}</p>
                      <h3 className="font-display text-[28px] font-medium leading-tight text-maroon">{p.name}</h3>
                    </div>
                    <p className="font-display text-[44px] font-semibold leading-none text-maroon [font-variant-numeric:lining-nums]">
                      <span className="mr-0.5 align-top text-[22px] font-medium">₹</span>
                      {p.price_inr}
                    </p>
                  </div>
                  <p className="mt-3 text-[14.5px] text-muted">{p.summary}</p>
                  <ul className="mt-5 flex-1 space-y-2.5 border-t border-gold/10 pt-5">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-[14.5px] leading-snug text-ink/85">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-leaf" strokeWidth={2.4} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => select(p.id, true)}
                    className={cn('mt-6 w-full', active ? 'btn-primary' : 'btn-ghost')}
                  >
                    {active ? `Continue with ${p.name}` : `Choose ${p.name}`}
                  </button>
                </div>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-5 text-[13px] text-muted">
          Payments go to Razorpay (razorpay.me/@akshayparambath). Your plan is confirmed once we verify the payment,
          usually within a few hours.
        </p>
      </div>
    </section>
  );
}
