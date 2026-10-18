import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { FALLBACK_PLANS, fetchPlans, type Plan } from './api';

type PlansApi = { plans: Plan[]; selected: Plan; select: (id: Plan['id'], scroll?: boolean) => void };

const Ctx = createContext<PlansApi | null>(null);

export function usePlans() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlans outside PlansProvider');
  return v;
}

export function PlansProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [selectedId, setSelectedId] = useState<Plan['id']>('prasadam');

  useEffect(() => {
    fetchPlans().then(setPlans);
  }, []);

  const selected = plans.find((p) => p.id === selectedId) ?? plans[0];
  return (
    <Ctx.Provider
      value={{
        plans,
        selected,
        select: (id, scroll) => {
          setSelectedId(id);
          if (scroll) document.getElementById('offer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
