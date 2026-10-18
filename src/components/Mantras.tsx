import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Headphones, Pause, Play, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAudio } from './AudioProvider';
import { Bars } from './MusicDock';
import { Lotus } from './ornaments';
import { Reveal, SectionHeading } from './ui';
import { cn } from '../lib/cn';
import { recite, useReciteVoice } from '../lib/recite';
import { TRACKS } from '../lib/tracks';

type Mantra = {
  id: string;
  t: string;
  tMl: string;
  source: string;
  ml: string[];
  tr: string[];
  deva: string[];
  meaning: string;
};

const DEVI_FORMS: [string, string, string][] = [
  ['വിദ്യാരൂപേണ', 'Vidyaa Roopena', 'विद्यारूपेण'],
  ['ബുദ്ധിരൂപേണ', 'Buddhi Roopena', 'बुद्धिरूपेण'],
  ['ശക്തിരൂപേണ', 'Shakti Roopena', 'शक्तिरूपेण'],
  ['ശാന്തിരൂപേണ', 'Shaanti Roopena', 'शान्तिरूपेण'],
  ['ശ്രദ്ധാരൂപേണ', 'Shraddhaa Roopena', 'श्रद्धारूपेण'],
  ['ലക്ഷ്മീരൂപേണ', 'Lakshmee Roopena', 'लक्ष्मीरूपेण'],
  ['മാതൃരൂപേണ', 'Maatru Roopena', 'मातृरूपेण'],
];

const MANTRAS: Mantra[] = [
  {
    id: 'namastubhyam',
    t: 'Saraswati Dhyana Shloka',
    tMl: 'സരസ്വതീ ധ്യാനശ്ലോകം',
    source: 'Chanted before every study',
    ml: ['സരസ്വതി നമസ്തുഭ്യം വരദേ കാമരൂപിണി', 'വിദ്യാരംഭം കരിഷ്യാമി സിദ്ധിർഭവതു മേ സദാ'],
    tr: ['Saraswati Namasthubhyam, Varade Kaama Roopini', 'Vidyaarambham Karishyaami, Siddhir Bhavathu Me Sadaa'],
    deva: ['सरस्वति नमस्तुभ्यं वरदे कामरूपिणि', 'विद्यारम्भं करिष्यामि सिद्धिर्भवतु मे सदा'],
    meaning:
      'Salutations to you, Goddess Saraswati, giver of boons and fulfiller of wishes. As I begin my studies, may success always be mine.',
  },
  {
    id: 'vidyarambham',
    t: 'Vidyarambham Mantra',
    tMl: 'വിദ്യാരംഭമന്ത്രം',
    source: 'The first letters, written on Vijayadashami',
    ml: ['ഹരിഃ ശ്രീ ഗണപതയേ നമഃ', 'അവിഘ്നമസ്തു', 'ശ്രീ ഗുരുഭ്യോ നമഃ'],
    tr: ['Harih Sree Ganapathaye Namah', 'Avighnamasthu', 'Sree Gurubhyo Namah'],
    deva: ['हरिः श्री गणपतये नमः', 'अविघ्नमस्तु', 'श्री गुरुभ्यो नमः'],
    meaning:
      'Salutations to Lord Ganesha. May there be no obstacles. Salutations to the Gurus. The child’s index finger traces these words in raw rice, and they are written on the tongue with a gold ring.',
  },
  {
    id: 'vakratunda',
    t: 'Ganapathi Dhyanam',
    tMl: 'ഗണപതി ധ്യാനം',
    source: 'Invoked before every beginning',
    ml: ['വക്രതുണ്ഡ മഹാകായ സൂര്യകോടി സമപ്രഭ', 'നിർവിഘ്നം കുരു മേ ദേവ സർവ്വകാര്യേഷു സർവ്വദാ'],
    tr: ['Vakratunda Mahaakaaya Sooryakoti Samaprabha', 'Nirvighnam Kuru Me Deva Sarvakaaryeshu Sarvadaa'],
    deva: ['वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ', 'निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा'],
    meaning:
      'O Lord with the curved trunk and mighty form, radiant as a million suns: make all my undertakings free of obstacles, always.',
  },
  {
    id: 'vandana',
    t: 'Saraswati Vandana',
    tMl: 'സരസ്വതീ വന്ദനം',
    source: 'Both verses, complete',
    ml: [
      'യാ കുന്ദേന്ദു തുഷാരഹാരധവളാ യാ ശുഭ്രവസ്ത്രാവൃതാ',
      'യാ വീണാവരദണ്ഡമണ്ഡിതകരാ യാ ശ്വേതപത്മാസനാ',
      'യാ ബ്രഹ്മാച്യുതശങ്കരപ്രഭൃതിഭിർദേവൈഃ സദാ വന്ദിതാ',
      'സാ മാം പാതു സരസ്വതീ ഭഗവതീ നിഃശേഷജാഡ്യാപഹാ',
      'ശുക്ലാം ബ്രഹ്മവിചാരസാരപരമാമാദ്യാം ജഗദ്വ്യാപിനീം',
      'വീണാപുസ്തകധാരിണീമഭയദാം ജാഡ്യാന്ധകാരാപഹാം',
      'ഹസ്തേ സ്ഫടികമാലികാം വിദധതീം പത്മാസനേ സംസ്ഥിതാം',
      'വന്ദേ താം പരമേശ്വരീം ഭഗവതീം ബുദ്ധിപ്രദാം ശാരദാം',
    ],
    tr: [
      'Yaa Kundendu Tushaarahaara Dhavalaa, Yaa Shubhra Vastraavritaa',
      'Yaa Veenaa Varadanda Manditakaraa, Yaa Shweta Padmaasanaa',
      'Yaa Brahmaachyuta Shankara Prabhritibhir Devaih Sadaa Vanditaa',
      'Saa Maam Paatu Saraswatee Bhagavatee Nihshesha Jaadyaapahaa',
      'Shuklaam Brahmavichaara Saara Paramaam Aadyaam Jagadvyaapineem',
      'Veenaa Pustaka Dhaarineem Abhayadaam Jaadyaandhakaaraapahaam',
      'Haste Sphatika Maalikaam Vidadhateem Padmaasane Samsthitaam',
      'Vande Taam Parameshvareem Bhagavateem Buddhipradaam Shaaradaam',
    ],
    deva: [
      'या कुन्देन्दुतुषारहारधवला या शुभ्रवस्त्रावृता',
      'या वीणावरदण्डमण्डितकरा या श्वेतपद्मासना',
      'या ब्रह्माच्युतशङ्करप्रभृतिभिर्देवैः सदा वन्दिता',
      'सा मां पातु सरस्वती भगवती निःशेषजाड्यापहा',
      'शुक्लां ब्रह्मविचारसारपरमामाद्यां जगद्व्यापिनीं',
      'वीणापुस्तकधारिणीमभयदां जाड्यान्धकारापहाम्',
      'हस्ते स्फटिकमालिकां विदधतीं पद्मासने संस्थिताम्',
      'वन्दे तां परमेश्वरीं भगवतीं बुद्धिप्रदां शारदाम्',
    ],
    meaning:
      'She who is fair as the jasmine, the moon and a garland of frost, robed in white, her hands graced by the veena, seated on a white lotus, ever worshipped by Brahma, Vishnu and Shiva: may that Goddess Saraswati protect me and remove all dullness. I bow to Sharada, the supreme Goddess, radiant white, essence of the highest knowledge, primordial and all-pervading. She holds the veena and the book, grants fearlessness, dispels the darkness of ignorance, holds a crystal rosary and is seated on the lotus, the giver of wisdom.',
  },
  {
    id: 'dvadasha',
    t: 'Saraswati Dvadasha Nama Stotram',
    tMl: 'സരസ്വതീ ദ്വാദശനാമ സ്തോത്രം',
    source: 'The twelve names, complete',
    ml: [
      'സരസ്വതീ മയാ ദൃഷ്ട്വാ വീണാപുസ്തകധാരിണീ',
      'ഹംസവാഹസമായുക്താ വിദ്യാദാനകരീ മമ',
      'പ്രഥമം ഭാരതീ നാമ ദ്വിതീയം ച സരസ്വതീ',
      'തൃതീയം ശാരദാ ദേവീ ചതുർത്ഥം ഹംസവാഹിനീ',
      'പഞ്ചമം ജഗതീ ഖ്യാതാ ഷഷ്ഠം വാഗീശ്വരീ തഥാ',
      'സപ്തമം കുമുദീ പ്രോക്താ അഷ്ടമം ബ്രഹ്മചാരിണീ',
      'നവമം ബുദ്ധിദാത്രീ ച ദശമം വരദായിനീ',
      'ഏകാദശം ചന്ദ്രകാന്തിർ ദ്വാദശം ഭുവനേശ്വരീ',
      'ദ്വാദശൈതാനി നാമാനി ത്രിസന്ധ്യം യഃ പഠേന്നരഃ',
      'ജിഹ്വാഗ്രേ വസതേ നിത്യം ബ്രഹ്മരൂപാ സരസ്വതീ',
    ],
    tr: [
      'Saraswatee Mayaa Drishtvaa Veenaa Pustaka Dhaarinee',
      'Hamsavaaha Samaayuktaa Vidyaadaanakaree Mama',
      'Prathamam Bhaaratee Naama Dviteeyam Cha Saraswatee',
      'Triteeyam Shaaradaa Devee Chaturtham Hamsavaahinee',
      'Panchamam Jagatee Khyaataa Shashtham Vaageeshvaree Tathaa',
      'Saptamam Kumudee Proktaa Ashtamam Brahmachaarinee',
      'Navamam Buddhidaatree Cha Dashamam Varadaayinee',
      'Ekaadasham Chandrakaantir Dvaadasham Bhuvaneshvaree',
      'Dvaadashaitaani Naamaani Trisandhyam Yah Pathennarah',
      'Jihvaagre Vasate Nityam Brahmaroopaa Saraswatee',
    ],
    deva: [
      'सरस्वती मया दृष्ट्वा वीणापुस्तकधारिणी',
      'हंसवाहसमायुक्ता विद्यादानकरी मम',
      'प्रथमं भारती नाम द्वितीयं च सरस्वती',
      'तृतीयं शारदा देवी चतुर्थं हंसवाहिनी',
      'पञ्चमं जगती ख्याता षष्ठं वागीश्वरी तथा',
      'सप्तमं कुमुदी प्रोक्ता अष्टमं ब्रह्मचारिणी',
      'नवमं बुद्धिदात्री च दशमं वरदायिनी',
      'एकादशं चन्द्रकान्तिर्द्वादशं भुवनेश्वरी',
      'द्वादशैतानि नामानि त्रिसन्ध्यं यः पठेन्नरः',
      'जिह्वाग्रे वसते नित्यं ब्रह्मरूपा सरस्वती',
    ],
    meaning:
      'I behold Saraswati holding the veena and the book, riding the swan, granting me knowledge. Her twelve names are Bharati, Saraswati, Sharada, Hamsavahini, Jagati, Vageeshwari, Kumudi, Brahmacharini, Buddhidatri, Varadayini, Chandrakanti and Bhuvaneshwari. Whoever recites these twelve names at dawn, noon and dusk, on the tip of their tongue Saraswati, the form of Brahman, dwells forever.',
  },
  {
    id: 'yadevi',
    t: 'Devi Stuti · Ya Devi Sarvabhuteshu',
    tMl: 'ദേവീസ്തുതി',
    source: 'Devi Mahatmyam, chapter 5',
    ml: DEVI_FORMS.flatMap(([m]) => [`യാ ദേവീ സർവ്വഭൂതേഷു ${m} സംസ്ഥിതാ`, 'നമസ്തസ്യൈ നമസ്തസ്യൈ നമസ്തസ്യൈ നമോ നമഃ']),
    tr: DEVI_FORMS.flatMap(([, t]) => [`Yaa Devee Sarvabhooteshu ${t} Samsthitaa`, 'Namastasyai Namastasyai Namastasyai Namo Namah']),
    deva: DEVI_FORMS.flatMap(([, , d]) => [`या देवी सर्वभूतेषु ${d} संस्थिता`, 'नमस्तस्यै नमस्तस्यै नमस्तस्यै नमो नमः']),
    meaning:
      'To the Goddess who dwells in every being as knowledge, as intelligence, as strength, as peace, as faith, as prosperity and as the Mother: salutations to Her, salutations to Her, salutations to Her, again and again.',
  },
];

type View = 'ml' | 'tr' | 'meaning';

function MantraCard({ m }: { m: Mantra }) {
  const [view, setView] = useState<View>('ml');
  const [line, setLine] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const voice = useReciteVoice();
  const audio = useAudio();
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  const listening = line !== null;
  const toggleListen = () => {
    if (listening) return stop.current?.();
    if (!voice) return;
    if (view === 'meaning') setView('ml');
    audio.duck(true);
    setLine(0);
    stop.current = recite(voice.script === 'deva' ? m.deva : m.ml, voice, setLine, () => {
      setLine(null);
      audio.duck(false);
      stop.current = null;
    });
  };

  const lines = view === 'tr' ? m.tr : m.ml;

  return (
    <div className={cn('card flex h-full flex-col p-6 transition-shadow duration-500 sm:p-8', listening && 'shadow-lift ring-1 ring-saffron/30')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Lotus className="h-5 w-8" />
          <p className="mt-3 font-ml text-[13px] text-saffron">{m.tMl}</p>
          <h3 className="font-display text-[clamp(24px,1.7vw,30px)] font-medium leading-tight text-maroon">{m.t}</h3>
          <p className="mt-1 text-[12.5px] text-muted">{m.source}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${m.ml.join('\n')}\n\n${m.tr.join('\n')}\n\n${m.meaning}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* clipboard blocked */
            }
          }}
          className="shrink-0 rounded-full border border-gold/20 bg-white/80 p-2.5 text-muted transition hover:border-saffron/40 hover:text-saffron"
          aria-label={`Copy ${m.t}`}
        >
          {copied ? <Check className="h-4 w-4 text-leaf" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <div className="flex rounded-full border border-gold/15 bg-parchment/60 p-1 text-[12.5px] font-semibold">
          {(
            [
              ['ml', 'മലയാളം'],
              ['tr', 'English'],
              ['meaning', 'Meaning'],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'relative rounded-full px-3 py-1.5 transition-colors',
                view === v ? 'text-maroon' : 'text-muted hover:text-maroon',
                v === 'ml' && 'font-mlsans',
              )}
            >
              {view === v && (
                <motion.span layoutId={`tab-${m.id}`} className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {view === 'meaning' ? (
              <p className="text-[15px] leading-relaxed text-muted">{m.meaning}</p>
            ) : (
              <div className="space-y-1">
                {lines.map((l, i) => (
                  <p
                    key={i}
                    className={cn(
                      'rounded-xl px-2 py-1 transition-all duration-500 -mx-2',
                      view === 'ml' ? 'font-ml text-[clamp(16px,1.15vw,20px)] leading-[1.85]' : 'font-display text-[clamp(17px,1.2vw,21px)] italic leading-relaxed',
                      line === i ? 'bg-[#FFF1DA] text-maroon' : listening ? 'text-ink/45' : 'text-maroon/90',
                      i % 2 === 1 && m.id !== 'vidyarambham' && 'mb-2',
                    )}
                  >
                    {l}
                  </p>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-gold/10 pt-5">
        <button
          type="button"
          onClick={toggleListen}
          disabled={!voice}
          title={voice ? undefined : 'Your device has no Indian-language voice installed for reading aloud'}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition',
            listening ? 'bg-maroon text-white' : 'bg-gradient-to-br from-[#E8892A] to-[#C75D17] text-white shadow-glow hover:-translate-y-px',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
          )}
        >
          {listening ? <Square className="h-3.5 w-3.5" fill="currentColor" /> : <Volume2 className="h-4 w-4" />}
          {listening ? 'Stop' : 'Listen'}
        </button>
        {listening ? (
          <span className="flex items-center gap-2 text-[12.5px] text-muted">
            <Bars active /> Line {(line ?? 0) + 1} of {m.ml.length}
          </span>
        ) : (
          <span className="text-[12px] text-muted/70">{m.ml.length} lines</span>
        )}
      </div>
    </div>
  );
}

function ChantStrip() {
  const a = useAudio();
  return (
    <Reveal className="mx-auto mt-6 max-w-wide">
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-display text-[22px] text-maroon">
              <Headphones className="h-5 w-5 text-saffron" /> Recorded chants <span className="font-ml text-[15px] text-saffron">· മന്ത്രങ്ങൾ</span>
            </p>
            <p className="mt-2 text-[14px] text-muted">
              Recitations by Vedic scholars. One plays softly in the background, a different one each visit.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {TRACKS.map((t) => {
            const current = t.id === a.track.id;
            const live = current && a.playing;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => (live ? a.pause() : a.play(t.id, Math.max(a.volume, 0.55)))}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl border p-3 text-left transition-all',
                  live ? 'border-saffron/40 bg-[#FFF4E3]' : 'border-gold/12 bg-white/70 hover:-translate-y-0.5 hover:border-gold/35 hover:bg-white',
                )}
              >
                <span
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition',
                    live ? 'bg-saffron text-white' : 'bg-parchment text-maroon group-hover:bg-saffron group-hover:text-white',
                  )}
                >
                  {live ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{t.title}</span>
                  <span className="block truncate font-mlsans text-[12px] text-muted">{t.ml}</span>
                </span>
                {live && <Bars active />}
              </button>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

export function Mantras() {
  return (
    <section id="mantras" className="gutter section relative scroll-mt-24">
      <div className="mx-auto max-w-wide">
      <SectionHeading
        ml="സ്തോത്രങ്ങൾ"
        title="Slokams for the peedham"
        sub="Complete, in Malayalam with transliteration and meaning. Listen reads each one aloud, line by line."
      />
      </div>
      <div className="mx-auto mt-10 grid max-w-wide gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MANTRAS.map((m, i) => (
          <Reveal key={m.id} delay={(i % 3) * 0.08}>
            <MantraCard m={m} />
          </Reveal>
        ))}
      </div>
      <ChantStrip />
    </section>
  );
}
