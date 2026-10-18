import { Diya, Divider } from './ornaments';
import { Reveal, SectionHeading } from './ui';
import { useNow } from '../hooks/useNow';
import { cn } from '../lib/cn';
import { TRACKS } from '../lib/tracks';

const DAYS = [
  {
    iso: '2026-10-18',
    date: '18',
    dow: 'Sun',
    ml: 'പൂജവെയ്പ്',
    t: 'Pooja Veppu',
    when: 'Durgashtami evening, 6:00 to 7:05 PM',
    d: 'Books, pens, instruments and tools are cleaned and placed on a decorated peedham facing East or North.',
  },
  {
    iso: '2026-10-19',
    date: '19',
    dow: 'Mon',
    ml: 'പൂജ തുടരുന്നു',
    t: 'Saraswati Pooja',
    when: 'Morning and evening pooja at the peedham',
    d: 'The books stay on the peedham. Light the nilavilakku at dawn and dusk, offer flowers and naivedyam, and chant Saraswati slokams together.',
  },
  {
    iso: '2026-10-20',
    date: '20',
    dow: 'Tue',
    ml: 'മഹാനവമി · അടച്ചുപൂജ',
    t: 'Mahanavami',
    when: 'Adachupooja, the closed worship',
    d: 'All day the books stay unread and the tools untouched: a day of silence and inner learning.',
  },
  {
    iso: '2026-10-21',
    date: '21',
    dow: 'Wed',
    ml: 'വിജയദശമി · വിദ്യാരംഭം',
    t: 'Pooja Eduppu',
    when: 'Vijayadashami, from Brahma Muhurtham',
    d: 'After the morning puja everything is lifted. Children aged 2 to 3 write their first letters in rice: ഹരിഃ ശ്രീ.',
  },
];

function todayIST(now: number) {
  return new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function Ritual() {
  const today = todayIST(useNow(60_000));
  return (
    <section id="ritual" className="gutter section relative scroll-mt-24">
      <div className="mx-auto grid max-w-wide gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
        <Reveal>
          <p className="font-ml text-[15px] text-saffron">ഐതിഹ്യം</p>
          <h2 className="mt-1 font-display text-[clamp(34px,3.4vw,60px)] font-medium leading-[1.04] text-maroon">
            Nine nights of battle, one morning of victory
          </h2>
          <p className="mt-6 text-[clamp(15px,1vw,17.5px)] leading-relaxed text-muted">
            For nine nights Goddess Durga fought the demon Mahishasura. On Mahanavami the divine weapons were laid down
            to rest, and on Vijayadashami Dharma was restored.
          </p>
          <p className="mt-4 text-[clamp(15px,1vw,17.5px)] leading-relaxed text-muted">
            In Kerala our books, pens, instruments and tools are held to be gifts of the Divine Mother. So we lay them
            before Saraswati and let them rest, to begin again, renewed, on Vijayadashami.
          </p>
          <figure className="mt-8 border-l-2 border-saffron/40 pl-6">
            <blockquote className="font-ml text-[clamp(17px,1.25vw,21px)] leading-[1.85] text-maroon">
              യാ ദേവീ സർവ്വഭൂതേഷു വിദ്യാരൂപേണ സംസ്ഥിതാ
              <br />
              നമസ്തസ്യൈ നമസ്തസ്യൈ നമസ്തസ്യൈ നമോ നമഃ
            </blockquote>
            <figcaption className="mt-2 font-display text-[18px] italic text-ink/70">
              To the Goddess who dwells in every being as knowledge, salutations, again and again.
            </figcaption>
          </figure>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="text-[13px] font-semibold text-muted">October 2026</p>
          <ol className="mt-3 border-t border-gold/20">
            {DAYS.map((day) => {
              const isToday = day.iso === today;
              return (
                <li key={day.iso} className="grid grid-cols-[64px_1fr] gap-5 border-b border-gold/20 py-6 sm:grid-cols-[84px_1fr]">
                  <div className="text-center">
                    <p
                      className={cn(
                        'font-display text-[44px] font-semibold leading-none [font-variant-numeric:lining-nums]',
                        isToday ? 'text-saffron' : 'text-maroon',
                      )}
                    >
                      {day.date}
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-muted">{day.dow}</p>
                    {isToday && <p className="mt-1.5 rounded-full bg-saffron px-2 py-0.5 text-[10.5px] font-bold text-white">Today</p>}
                  </div>
                  <div>
                    <p className="font-ml text-[13.5px] text-saffron">{day.ml}</p>
                    <h3 className="font-display text-[26px] leading-tight text-maroon">{day.t}</h3>
                    <p className="text-[13px] font-semibold text-ink/60">{day.when}</p>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{day.d}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

const RULES = [
  ['ശുദ്ധി', 'Clean first', 'Dust every book, notebook, laptop or tool before it reaches the altar.'],
  ['നിയമം', 'Keep them closed', 'From Pooja Veppu to Pooja Eduppu, nobody reads the books or uses the tools.'],
  ['നിവേദ്യം', 'Naivedyam', 'Aval, malar, vellam, pottukadala, coconut pieces and bananas.'],
  ['നിലവിളക്ക്', 'Light the lamp', 'Keep the nilavilakku lit during the morning and evening prayers.'],
  ['പുനരാരംഭം', 'Begin again', 'After Pooja Eduppu, read one page or play one note to awaken the blessing.'],
];

export function Guidelines() {
  return (
    <section className="gutter section relative">
      <div className="mx-auto max-w-wide">
        <SectionHeading ml="ശ്രദ്ധിക്കേണ്ടവ" title="Keeping the observance" />
        <Reveal className="mt-8">
          <ol className="grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
            {RULES.map(([ml, t, d], i) => (
              <li key={t} className="flex gap-4 border-t border-gold/20 py-5">
                <span className="font-display text-[22px] leading-none text-gold [font-variant-numeric:lining-nums]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="font-semibold text-maroon">
                    {t} <span className="ml-1 font-ml text-[13px] font-normal text-saffron">{ml}</span>
                  </p>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="gutter relative pb-28 pt-6">
      <div className="mx-auto max-w-wide">
        <Divider />
        <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <Diya className="w-10" />
            <div>
              <p className="text-gilded font-ml text-[22px] font-semibold">ഏവർക്കും നവരാത്രി ആശംസകൾ</p>
              <p className="font-display text-[17px] italic text-ink/70">A blessed Navaratri to all</p>
            </div>
          </div>
          <div className="max-w-2xl text-[12px] leading-relaxed text-muted/80 md:text-right">
            <p>
              Pooja Veppu 2026. Dates follow the Kerala calendar; confirm local muhurtham timings with your temple.
              Payments are collected through Razorpay.
            </p>
            <p className="mt-2">
              Chant recordings from Wikimedia Commons:{' '}
              {TRACKS.map((t, i) => (
                <span key={t.id}>
                  <a href={t.page} target="_blank" rel="noreferrer" className="underline decoration-gold/30 underline-offset-2 hover:text-maroon">
                    {t.title}
                  </a>{' '}
                  ({t.artist}, {t.license}){i < TRACKS.length - 1 ? ' · ' : '.'}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
