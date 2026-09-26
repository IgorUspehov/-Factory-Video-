import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  Coins,
  FileText,
  Image as ImageIcon,
  Lock,
  Megaphone,
  Music,
  Palette,
  Scissors,
  Smartphone,
  Type,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useI18n, type TKey } from '../i18n';
import { useAuth } from '../lib/auth';
import { landingPhotos, unsplash } from '../lib/libraryData';
import { formatPrice, pricing } from '../config/pricing';

const chain: { icon: LucideIcon; label: TKey; hint: TKey }[] = [
  { icon: Music, label: 'blocks.audio', hint: 'landing.chain.audio' },
  { icon: ImageIcon, label: 'blocks.visual', hint: 'landing.chain.visual' },
  { icon: Type, label: 'blocks.text', hint: 'landing.chain.text' },
  { icon: Palette, label: 'blocks.style', hint: 'landing.chain.style' },
  { icon: Scissors, label: 'blocks.montage', hint: 'landing.chain.montage' },
  { icon: Clapperboard, label: 'blocks.output', hint: 'landing.chain.output' },
];

const audiences: { icon: LucideIcon; photo: string; title: TKey; text: TKey }[] = [
  { icon: Music, photo: landingPhotos.performer, title: 'landing.for.clipTitle', text: 'landing.for.clipText' },
  { icon: Megaphone, photo: landingPhotos.restaurant, title: 'landing.for.promoTitle', text: 'landing.for.promoText' },
  { icon: Smartphone, photo: landingPhotos.neon, title: 'landing.for.reelsTitle', text: 'landing.for.reelsText' },
];

const compare: { icon: LucideIcon; label: TKey; us: TKey; them: TKey }[] = [
  { icon: Clock, label: 'landing.vs.time', us: 'landing.vs.timeUs', them: 'landing.vs.timeThem' },
  { icon: Coins, label: 'landing.vs.cost', us: 'landing.vs.costUs', them: 'landing.vs.costThem' },
  { icon: Users, label: 'landing.vs.people', us: 'landing.vs.peopleUs', them: 'landing.vs.peopleThem' },
  { icon: FileText, label: 'landing.vs.brief', us: 'landing.vs.briefUs', them: 'landing.vs.briefThem' },
  { icon: Lock, label: 'landing.vs.rights', us: 'landing.vs.rightsUs', them: 'landing.vs.rightsThem' },
];

const faqs: { q: TKey; a: TKey }[] = [
  { q: 'landing.faq.q1', a: 'landing.faq.a1' },
  { q: 'landing.faq.q2', a: 'landing.faq.a2' },
  { q: 'landing.faq.q3', a: 'landing.faq.a3' },
  { q: 'landing.faq.q4', a: 'landing.faq.a4' },
  { q: 'landing.faq.q5', a: 'landing.faq.a5' },
  { q: 'landing.faq.q6', a: 'landing.faq.a6' },
];

function SectionTitle({ kicker, line1, line2, hand }: { kicker: string; line1: string; line2: string; hand?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      <div className="label-caps mb-4 text-accent-light">{kicker}</div>
      <h2 className="h-display text-3xl sm:text-5xl">
        {line1}
        <br />
        <span className="text-gradient">{line2}</span>
      </h2>
      {hand && <div className="hand mt-3 text-2xl">{hand}</div>}
    </div>
  );
}

export default function Landing() {
  const { t, locale } = useI18n();
  const { isAuthed } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const startTo = isAuthed ? '/start' : '/register';

  return (
    <div className="overflow-hidden">
      {/* ---------- HERO ---------- */}
      <section className="relative">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/20 blur-[140px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <div className="label-caps mb-6 flex items-center gap-3">
              <span className="h-px w-8 bg-accent" />
              {t('landing.hero.kicker')}
            </div>
            <h1 className="h-display text-[40px] sm:text-6xl xl:text-7xl">
              {t('landing.hero.title1')}
              <br />
              <span className="text-gradient">{t('landing.hero.title2')}</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-white/75">{t('landing.hero.subtitle')}</p>
            <div className="hand mt-4 text-2xl sm:text-3xl">{t('landing.hero.hand')}</div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={startTo} className="btn-primary px-7 py-4 text-base">
                {t('landing.hero.cta')} →
              </Link>
              <a href="#examples" className="btn-secondary px-7 py-4 text-base">
                {t('landing.hero.examples')}
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-muted">
              {(['landing.hero.point1', 'landing.hero.point2', 'landing.hero.point3'] as TKey[]).map((k) => (
                <span key={k} className="flex items-center gap-2">
                  <Check size={16} className="text-accent" /> {t(k)}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <img
                src={unsplash(landingPhotos.studio, 700, 900)}
                alt={t('landing.alt.studio')}
                className="row-span-2 h-full min-h-[320px] w-full rounded-[20px] border border-line object-cover"
                loading="eager"
              />
              <img
                src={unsplash(landingPhotos.editing, 600, 420)}
                alt={t('landing.alt.editing')}
                className="aspect-[4/3] w-full rounded-[20px] border border-line object-cover"
              />
              <img
                src={unsplash(landingPhotos.dj, 600, 420)}
                alt={t('landing.alt.dj')}
                className="aspect-[4/3] w-full rounded-[20px] border border-line object-cover"
              />
            </div>
            <div className="card absolute -bottom-6 left-4 flex items-center gap-3 px-4 py-3 shadow-glow sm:-left-8">
              <span className="icon-tile h-10 w-10">
                <Music size={18} />
              </span>
              <div>
                <div className="label-caps">{t('blocks.audio')}</div>
                <div className="text-sm font-semibold">124 BPM · 0:42</div>
              </div>
            </div>
            <div className="card absolute -top-5 right-4 flex items-center gap-3 px-4 py-3 shadow-glow sm:-right-6">
              <span className="icon-tile h-10 w-10">
                <Clapperboard size={18} />
              </span>
              <div>
                <div className="label-caps">{t('blocks.output')}</div>
                <div className="text-sm font-semibold">9:16 · MP4</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CHAIN ---------- */}
      <section id="how" className="border-y border-line/70 bg-card/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionTitle kicker={t('landing.chain.kicker')} line1={t('landing.chain.title1')} line2={t('landing.chain.title2')} />
          <ol className="relative grid gap-6 lg:grid-cols-6 lg:gap-4">
            <span className="glow-line absolute bottom-8 left-8 top-8 w-[2px] lg:bottom-auto lg:left-[8%] lg:right-[8%] lg:top-8 lg:h-[2px] lg:w-auto" />
            {chain.map((c, i) => (
              <li key={c.label} className="relative flex items-center gap-4 lg:flex-col lg:text-center">
                <span
                  className={`icon-tile relative z-10 h-16 w-16 rounded-2xl ${i === chain.length - 1 ? 'border-accent bg-accent/20 shadow-glow' : 'shadow-glow-sm'}`}
                >
                  <c.icon size={26} />
                </span>
                <div>
                  <div className="label-caps text-accent-light">0{i + 1}</div>
                  <div className="font-display text-lg font-bold">{t(c.label)}</div>
                  <div className="mt-1 text-sm text-muted">{t(c.hint)}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- FOR WHOM ---------- */}
      <section id="examples" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionTitle
            kicker={t('landing.for.kicker')}
            line1={t('landing.for.title1')}
            line2={t('landing.for.title2')}
            hand={t('landing.for.hand')}
          />
          <div className="grid gap-6 md:grid-cols-3">
            {audiences.map((a) => (
              <article key={a.title} className="card group overflow-hidden transition hover:border-accent/60 hover:shadow-glow-sm">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={unsplash(a.photo, 800, 600)}
                    alt={t(a.title)}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
                  <span className="icon-tile absolute bottom-4 left-4 h-11 w-11">
                    <a.icon size={20} />
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-xl font-bold">{t(a.title)}</h3>
                  <p className="mt-2 text-sm text-muted">{t(a.text)}</p>
                  <Link to={startTo} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent-light hover:text-accent">
                    {t('landing.for.try')} →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- VS ---------- */}
      <section className="border-y border-line/70 bg-card/40 py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <SectionTitle kicker={t('landing.vs.kicker')} line1={t('landing.vs.title1')} line2={t('landing.vs.title2')} />
          <div className="card relative overflow-hidden">
            <div className="grid grid-cols-2 border-b border-line">
              <div className="flex items-center gap-2 p-5 font-display font-extrabold sm:p-6">
                Factory <span className="text-gradient">Video</span>
              </div>
              <div className="p-5 text-right font-display font-extrabold text-muted sm:p-6">{t('landing.vs.agency')}</div>
            </div>
            <div className="absolute left-1/2 top-[34px] z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-accent bg-bg font-display text-sm font-extrabold text-accent-light shadow-glow sm:top-[38px]">
              VS
            </div>
            {compare.map((row) => (
              <div key={row.label} className="border-b border-line last:border-b-0">
                <div className="flex items-center justify-center gap-2 pt-4">
                  <span className="icon-tile h-8 w-8">
                    <row.icon size={15} />
                  </span>
                  <span className="label-caps">{t(row.label)}</span>
                </div>
                <div className="grid grid-cols-2">
                  <div className="flex items-start gap-2 p-4 text-sm sm:p-5 sm:text-base">
                    <Check size={18} className="mt-0.5 shrink-0 text-accent" />
                    <span className="font-medium">{t(row.us)}</span>
                  </div>
                  <div className="border-l border-line p-4 text-right text-sm text-muted sm:p-5 sm:text-base">{t(row.them)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- PRICING ---------- */}
      <section id="pricing" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle kicker={t('landing.pricing.kicker')} line1={t('landing.pricing.title1')} line2={t('landing.pricing.title2')} />
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: 'Free',
                price: formatPrice(pricing.free.price, locale),
                period: '',
                desc: t('landing.pricing.freeDesc'),
                features: [t('landing.pricing.freeF1', { n: pricing.free.credits }), t('landing.pricing.freeF2'), t('landing.pricing.freeF3')],
                cta: t('landing.pricing.freeCta'),
                highlight: false,
              },
              {
                name: 'Pro',
                price: formatPrice(pricing.pro.priceMonthly, locale),
                period: t('landing.pricing.perMonth'),
                desc: t('landing.pricing.proDesc'),
                features: [t('landing.pricing.proF1', { n: pricing.pro.creditsPerMonth }), t('landing.pricing.proF2'), t('landing.pricing.proF3')],
                cta: t('landing.pricing.proCta'),
                highlight: true,
              },
              {
                name: 'Credits',
                price: formatPrice(pricing.credits.packPrice, locale),
                period: t('landing.pricing.perPack'),
                desc: t('landing.pricing.creditsDesc'),
                features: [t('landing.pricing.creditsF1', { n: pricing.credits.packCredits }), t('landing.pricing.creditsF2'), t('landing.pricing.creditsF3')],
                cta: t('landing.pricing.creditsCta'),
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`card relative flex flex-col p-7 ${plan.highlight ? 'border-accent/70 shadow-glow' : ''}`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-accent to-accent-light px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                    {t('landing.pricing.popular')}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="icon-tile h-9 w-9">
                    <Zap size={16} />
                  </span>
                  <span className="font-display text-xl font-extrabold">{plan.name}</span>
                </div>
                <div className="mt-5 flex items-end gap-1">
                  <span className="h-display text-4xl">{plan.price}</span>
                  <span className="pb-1 text-sm text-muted">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{plan.desc}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check size={16} className="mt-0.5 shrink-0 text-accent" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to={isAuthed ? '/account' : '/register'} className={`${plan.highlight ? 'btn-primary' : 'btn-secondary'} mt-7`}>
                  {plan.cta} →
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted">{t('landing.pricing.note')}</p>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="scroll-mt-20 border-t border-line/70 bg-card/40 py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <SectionTitle kicker={t('landing.faq.kicker')} line1={t('landing.faq.title1')} line2={t('landing.faq.title2')} />
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={f.q} className={`card overflow-hidden transition ${openFaq === i ? 'border-accent/50' : ''}`}>
                <button
                  className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  {t(f.q)}
                  <ChevronDown size={18} className={`shrink-0 text-accent transition ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{t(f.a)}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="relative py-24">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-72 max-w-3xl -translate-y-1/2 rounded-full bg-accent/15 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="h-display text-3xl sm:text-5xl">
            {t('landing.cta.title1')}
            <br />
            <span className="text-gradient">{t('landing.cta.title2')}</span>
          </h2>
          <div className="mt-4">
            <span className="hand text-2xl">{t('landing.cta.hand')}</span>
          </div>
          <div className="mt-8">
            <Link to={startTo} className="btn-primary px-8 py-4 text-base">
              {t('landing.hero.cta')} →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
