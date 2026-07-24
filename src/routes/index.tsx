import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { z } from "zod";
import { PdfDownloadLink, generateAuthorizationPdfBlob } from "@/lib/pdf-download-link";
import type { PDFAuthData } from "@/lib/authorization-pdf";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Form M2-AUTH — Recurring Payment Authorization | M2 Phenom" },
      { name: "description", content: "Authorize a recurring monthly charge to M2 Phenom. Complete, sign, and submit Form M2-AUTH to create your authorization of record." },
      { property: "og:title", content: "Form M2-AUTH — Recurring Payment Authorization" },
      { property: "og:description", content: "Recurring payment authorization for M2 Phenom customers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

/* ---------------- constants ---------------- */

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI",
  "SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const AMOUNT_PRESETS = [97, 197, 297, 497, 997];

const FIRST_CHARGE_OPTIONS = [
  "Today, then monthly",
  "The 1st of each month",
  "The 15th of each month",
] as const;

type CardBrand = "Visa" | "Mastercard" | "Amex" | "Discover" | "Unknown";

/* ---------------- helpers ---------------- */

function detectBrand(num: string): CardBrand {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^(6011|65|64[4-9])/.test(n)) return "Discover";
  return "Unknown";
}

function formatCardNumber(v: string, brand: CardBrand): string {
  const d = v.replace(/\D/g, "").slice(0, brand === "Amex" ? 15 : 16);
  if (brand === "Amex") {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  }
  return d.replace(/(.{4})/g, "$1 ").trim();
}

function expectedCardLength(brand: CardBrand): number[] {
  if (brand === "Amex") return [15];
  if (brand === "Discover") return [16];
  return [16];
}

function luhnValid(num: string): boolean {
  const d = num.replace(/\D/g, "");
  if (d.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function formatExpiry(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length < 3) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function longDate(): string {
  return new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function timestampStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function amountFromInput(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatAmountDisplay(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function genRefId(): string {
  const alph = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alph[Math.floor(Math.random() * alph.length)];
  return `M2A-${s}`;
}

function startDateTextFor(firstCharge: string, signedAt: Date): string {
  if (firstCharge === "Today, then monthly") {
    return signedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  return firstCharge;
}

function buildPdfData(args: {
  payload: FormState; ref: string; signedAt: Date; consentAcceptedAt: Date;
  signatureDataUrl: string; brand: CardBrand; last4: string; ip: string; userAgent: string;
}): PDFAuthData {
  const p = args.payload;
  const amount = amountFromInput(p.amount);
  return {
    ref: args.ref,
    signedAt: args.signedAt,
    consentAcceptedAt: args.consentAcceptedAt,
    signatureDataUrl: args.signatureDataUrl,
    brand: args.brand,
    last4: args.last4,
    firstName: p.firstName,
    middleName: p.middleName,
    lastName: p.lastName,
    email: p.email,
    phone: p.phone,
    street: p.street,
    apt: p.apt,
    city: p.city,
    state: p.state,
    zip: p.zip,
    amountFormatted: formatAmountDisplay(amount),
    firstCharge: p.firstCharge,
    startDateText: startDateTextFor(p.firstCharge, args.signedAt),
    planName: p.planName,
    cardName: p.cardName,
    expiry: p.expiry,
    typedName: p.typedName,
    ip: args.ip,
    userAgent: args.userAgent,
    agreementVersion: "2026.1",
  };
}

/* ---------------- schema ---------------- */

const schema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  middleName: z.string().trim().max(60).optional().or(z.literal("")),
  lastName: z.string().trim().min(1, "Required").max(60),
  email: z.string().trim().email("Enter a valid email").max(160),
  phone: z.string().refine(v => v.replace(/\D/g, "").length === 10, "Enter a 10-digit phone"),
  street: z.string().trim().min(1, "Required").max(120),
  apt: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().min(1, "Required").max(60),
  state: z.string().refine(v => US_STATES.includes(v), "Select a state"),
  zip: z.string().refine(v => /^\d{5}$/.test(v), "5-digit ZIP"),
  amount: z.string().refine(v => amountFromInput(v) >= 1, "Minimum $1.00"),
  firstCharge: z.enum(FIRST_CHARGE_OPTIONS),
  planName: z.string().trim().max(80).optional().or(z.literal("")),
  cardName: z.string().trim().min(1, "Required").max(80),
  cardNumber: z.string(),
  expiry: z.string(),
  cvv: z.string(),
  consent: z.boolean().refine(v => v === true, "Consent required"),
  typedName: z.string().trim().min(1, "Required"),
});

type FormState = z.infer<typeof schema>;

const initial: FormState = {
  firstName: "", middleName: "", lastName: "",
  email: "", phone: "",
  street: "", apt: "", city: "", state: "", zip: "",
  amount: "", firstCharge: FIRST_CHARGE_OPTIONS[0], planName: "",
  cardName: "", cardNumber: "", expiry: "", cvv: "",
  consent: false, typedName: "",
};

type Errors = Partial<Record<keyof FormState | "signature", string>>;

/* ---------------- reveal on scroll hook ---------------- */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("reveal-in");
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ---------------- page ---------------- */

function Page() {
  const [f, setF] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [attempted, setAttempted] = useState(false);
  const [signed, setSigned] = useState(false);
  const [strokes, setStrokes] = useState(0);
  const [firstStrokeAt, setFirstStrokeAt] = useState<Date | null>(null);
  const [submitted, setSubmitted] = useState<null | {
    ref: string;
    signedAt: Date;
    consentAcceptedAt: Date;
    signatureDataUrl: string;
    payload: FormState;
    brand: CardBrand;
    last4: string;
    ip: string;
    userAgent: string;
    pdfBlobUrl: string | null;
  }>(null);
  const [today] = useState(todayISO());

  const brand = useMemo(() => detectBrand(f.cardNumber), [f.cardNumber]);
  const cvvMax = brand === "Amex" ? 4 : 3;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF(prev => ({ ...prev, [k]: v }));
    if (attempted) {
      setErrors(prev => ({ ...prev, [k]: undefined }));
    }
  };

  const fullName = useMemo(() =>
    [f.firstName, f.middleName, f.lastName].filter(Boolean).join(" ").trim(),
    [f.firstName, f.middleName, f.lastName]);

  const amountNum = amountFromInput(f.amount);

  /* -------- progress calc (required fields) -------- */
  const progress = useMemo(() => {
    const checks: boolean[] = [
      !!f.firstName.trim(),
      !!f.lastName.trim(),
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email),
      f.phone.replace(/\D/g, "").length === 10,
      !!f.street.trim(),
      !!f.city.trim(),
      US_STATES.includes(f.state),
      /^\d{5}$/.test(f.zip),
      amountNum >= 1,
      !!f.cardName.trim(),
      luhnValid(f.cardNumber) && expectedCardLength(brand).includes(f.cardNumber.replace(/\D/g, "").length),
      /^\d{2}\/\d{2}$/.test(f.expiry),
      /^\d+$/.test(f.cvv) && f.cvv.length === cvvMax,
      f.consent,
      !!f.typedName.trim() && f.typedName.trim().toLowerCase() === fullName.toLowerCase(),
      signed,
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [f, brand, cvvMax, amountNum, fullName, signed]);

  /* -------- validation -------- */

  function validate(includeSignature = true): Errors {
    const errs: Errors = {};
    const r = schema.safeParse(f);
    if (!r.success) {
      for (const iss of r.error.issues) {
        const k = iss.path[0] as keyof FormState;
        if (!errs[k]) errs[k] = iss.message;
      }
    }
    const digits = f.cardNumber.replace(/\D/g, "");
    if (!digits) errs.cardNumber = "Required";
    else if (!expectedCardLength(brand).includes(digits.length)) errs.cardNumber = "Check card number length";
    else if (!luhnValid(digits)) errs.cardNumber = "Card number is invalid";
    const em = f.expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!em) errs.expiry = "MM/YY";
    else {
      const mm = parseInt(em[1], 10);
      const yy = 2000 + parseInt(em[2], 10);
      if (mm < 1 || mm > 12) errs.expiry = "Invalid month";
      else {
        const end = new Date(yy, mm, 0, 23, 59, 59);
        if (end < new Date()) errs.expiry = "Card is expired";
      }
    }
    if (!/^\d+$/.test(f.cvv) || f.cvv.length !== cvvMax) {
      errs.cvv = `${cvvMax} digits`;
    }
    if (f.typedName && fullName && f.typedName.trim().toLowerCase() !== fullName.toLowerCase()) {
      errs.typedName = "Must match Section 01 name";
    }
    if (includeSignature && !signed) {
      errs.signature = "Signature required";
    }
    return errs;
  }

  /* -------- submit -------- */

  const formRef = useRef<HTMLFormElement>(null);
  const sigPadRef = useRef<SigPadHandle>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    const errs = validate(true);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      requestAnimationFrame(() => {
        const first = formRef.current?.querySelector<HTMLElement>('[data-invalid="true"]');
        if (first) {
          first.scrollIntoView({ behavior: "smooth", block: "center" });
          const focusable = first.querySelector<HTMLElement>("input,select,textarea,button");
          (focusable ?? first).focus?.();
        }
      });
      return;
    }
    const digits = f.cardNumber.replace(/\D/g, "");
    const signedAt = new Date();
    const ref = genRefId();
    const signatureDataUrl = sigPadRef.current?.toDataURL() ?? "";
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";

    setSubmitted({
      ref,
      signedAt,
      consentAcceptedAt: signedAt,
      signatureDataUrl,
      payload: f,
      brand,
      last4: digits.slice(-4),
      ip: "resolving…",
      userAgent,
      pdfBlobUrl: null,
    });

    (async () => {
      let ip = "unavailable";
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        if (r.ok) ip = (await r.json()).ip ?? ip;
      } catch { /* offline / blocked */ }

      const pdfData = buildPdfData({
        payload: f, ref, signedAt, consentAcceptedAt: signedAt,
        signatureDataUrl, brand, last4: digits.slice(-4), ip, userAgent,
      });

      let pdfBlobUrl: string | null = null;
      try {
        const blob = await generateAuthorizationPdfBlob(pdfData);
        pdfBlobUrl = URL.createObjectURL(blob);
      } catch (err) {
        console.error("PDF generation failed", err);
      }

      setSubmitted(prev => prev ? { ...prev, ip, pdfBlobUrl } : prev);
    })();
  }

  function onBlurRevalidate() {
    if (!attempted) return;
    setErrors(validate(true));
  }

  function pickPreset(n: number) {
    set("amount", n.toFixed(2));
  }

  if (submitted) {
    return <Confirmation data={submitted} />;
  }

  return (
    <main className="bg-mesh min-h-dvh px-5 py-10 sm:py-14">
      <div className="mx-auto max-w-[760px]">
        {/* ============ HERO ============ */}
        <Hero progress={progress} />

        {/* ============ META CARDS ============ */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetaCard label="Merchant" value="M2 Phenom" />
          <MetaCard label="Frequency" value="Monthly" />
          <MetaCard label="Term" value="Until cancelled" />
        </div>

        {/* ============ FORM ============ */}
        <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-10 space-y-8">
          {/* 01 ACCOUNT HOLDER */}
          <Section num="01" title="Account holder">
            <Row cols="1fr 1fr 1fr">
              <Field label="First name" required error={errors.firstName}>
                <input className={inputCls(errors.firstName, f.firstName)} value={f.firstName}
                  onChange={e => set("firstName", e.target.value)} onBlur={onBlurRevalidate} autoComplete="given-name" />
              </Field>
              <Field label="Middle" hint="Optional" error={errors.middleName}>
                <input className={inputCls(errors.middleName, f.middleName)} value={f.middleName ?? ""}
                  onChange={e => set("middleName", e.target.value)} onBlur={onBlurRevalidate} autoComplete="additional-name" />
              </Field>
              <Field label="Last name" required error={errors.lastName}>
                <input className={inputCls(errors.lastName, f.lastName)} value={f.lastName}
                  onChange={e => set("lastName", e.target.value)} onBlur={onBlurRevalidate} autoComplete="family-name" />
              </Field>
            </Row>
            <Row cols="1fr 1fr">
              <Field label="Email" required error={errors.email}>
                <input type="email" inputMode="email" className={inputCls(errors.email, f.email)} value={f.email}
                  onChange={e => set("email", e.target.value)} onBlur={onBlurRevalidate}
                  autoComplete="email" placeholder="you@example.com" />
              </Field>
              <Field label="Phone" required error={errors.phone}>
                <input inputMode="tel" className={inputCls(errors.phone, f.phone, true)} value={f.phone}
                  onChange={e => set("phone", formatPhone(e.target.value))} onBlur={onBlurRevalidate}
                  autoComplete="tel" placeholder="(555) 555-0134" />
              </Field>
            </Row>
          </Section>

          {/* 02 BILLING ADDRESS */}
          <Section num="02" title="Billing address" hint="Must match the card">
            <Field label="Street address" required error={errors.street}>
              <input className={inputCls(errors.street, f.street)} value={f.street}
                onChange={e => set("street", e.target.value)} onBlur={onBlurRevalidate} autoComplete="address-line1" />
            </Field>
            <Field label="Apt / Suite" hint="Optional" error={errors.apt}>
              <input className={inputCls(errors.apt, f.apt)} value={f.apt ?? ""}
                onChange={e => set("apt", e.target.value)} onBlur={onBlurRevalidate} autoComplete="address-line2" />
            </Field>
            <Row cols="1fr 120px 140px">
              <Field label="City" required error={errors.city}>
                <input className={inputCls(errors.city, f.city)} value={f.city}
                  onChange={e => set("city", e.target.value)} onBlur={onBlurRevalidate} autoComplete="address-level2" />
              </Field>
              <Field label="State" required error={errors.state}>
                <select className={inputCls(errors.state, f.state) + " field-input-mono appearance-none"} value={f.state}
                  onChange={e => set("state", e.target.value)} onBlur={onBlurRevalidate} autoComplete="address-level1">
                  <option value="">—</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="ZIP" required error={errors.zip}>
                <input inputMode="numeric" className={inputCls(errors.zip, f.zip, true)} value={f.zip}
                  onChange={e => set("zip", e.target.value.replace(/\D/g, "").slice(0, 5))}
                  onBlur={onBlurRevalidate} autoComplete="postal-code" maxLength={5} />
              </Field>
            </Row>
          </Section>

          {/* 03 SUBSCRIPTION AMOUNT */}
          <Section num="03" title="Subscription amount" hint="Charged monthly">
            <div className="flex flex-wrap gap-2 mb-2">
              {AMOUNT_PRESETS.map(n => {
                const active = amountNum === n;
                return (
                  <button key={n} type="button" onClick={() => pickPreset(n)}
                    className={"pill-amount " + (active ? "pill-amount-active" : "")}>
                    ${n}<span className={active ? "text-white/70" : "text-ink-45"}>/mo</span>
                  </button>
                );
              })}
              <button type="button" onClick={() => document.getElementById("amount")?.focus()}
                className={"pill-amount " + (amountNum > 0 && !AMOUNT_PRESETS.includes(amountNum) ? "pill-amount-active" : "")}>
                Custom
              </button>
            </div>
            <Row cols="1fr 1fr">
              <Field label="Monthly amount (USD)" required error={errors.amount}>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-ink-45 text-[19px] pointer-events-none">$</span>
                  <input id="amount" inputMode="decimal"
                    className={
                      "field-input field-input-mono " +
                      (f.amount ? "field-filled " : "") +
                      (errors.amount ? "field-error " : "") +
                      "pl-9 !text-[19px] !py-3.5"
                    }
                    value={f.amount}
                    onChange={e => set("amount", e.target.value.replace(/[^0-9.]/g, ""))}
                    onBlur={e => {
                      const n = amountFromInput(e.target.value);
                      if (n > 0) set("amount", n.toFixed(2));
                      onBlurRevalidate();
                    }}
                    placeholder="0.00" />
                </div>
              </Field>
              <Field label="First charge" required error={errors.firstCharge}>
                <select className={inputCls(errors.firstCharge, f.firstCharge) + " appearance-none"} value={f.firstCharge}
                  onChange={e => set("firstCharge", e.target.value as FormState["firstCharge"])} onBlur={onBlurRevalidate}>
                  {FIRST_CHARGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </Row>
            <Field label="Product or plan name" hint="Optional" error={errors.planName}>
              <input className={inputCls(errors.planName, f.planName)} value={f.planName ?? ""}
                onChange={e => set("planName", e.target.value)} onBlur={onBlurRevalidate} placeholder="e.g. Phenom Pro" />
            </Field>
          </Section>

          {/* 04 CARD DETAILS */}
          <Section num="04" title="Card details" hint={brand !== "Unknown" ? brand : "Live preview"}>
            <CardPreview
              name={f.cardName || fullName}
              number={f.cardNumber}
              expiry={f.expiry}
              brand={brand}
            />
            <div className="mt-6 space-y-5">
              <Field label="Name as printed on card" required error={errors.cardName}>
                <input className={inputCls(errors.cardName, f.cardName)} value={f.cardName}
                  onChange={e => set("cardName", e.target.value)} onBlur={onBlurRevalidate} autoComplete="cc-name" />
              </Field>
              <Field label="Card number" required error={errors.cardNumber}>
                <input inputMode="numeric" className={inputCls(errors.cardNumber, f.cardNumber, true)} value={f.cardNumber}
                  onChange={e => {
                    const b = detectBrand(e.target.value);
                    set("cardNumber", formatCardNumber(e.target.value, b));
                  }}
                  onBlur={onBlurRevalidate} autoComplete="cc-number" placeholder="0000 0000 0000 0000" />
              </Field>
              <Row cols="1fr 1fr">
                <Field label="Expires (MM/YY)" required error={errors.expiry}>
                  <input inputMode="numeric" className={inputCls(errors.expiry, f.expiry, true)} value={f.expiry}
                    onChange={e => set("expiry", formatExpiry(e.target.value))} onBlur={onBlurRevalidate}
                    autoComplete="cc-exp" placeholder="MM/YY" maxLength={5} />
                </Field>
                <Field label={`Security code (${cvvMax})`} required error={errors.cvv}>
                  <input inputMode="numeric" className={inputCls(errors.cvv, f.cvv, true)} value={f.cvv}
                    onChange={e => set("cvv", e.target.value.replace(/\D/g, "").slice(0, cvvMax))}
                    onBlur={onBlurRevalidate} autoComplete="cc-csc" maxLength={cvvMax} />
                </Field>
              </Row>
            </div>
          </Section>

          {/* 05 AUTHORIZATION */}
          <Section num="05" title="Authorization" hint="Read before signing">
            <p className="font-serif text-ink" style={{ fontSize: 17.5, lineHeight: 1.68 }}>
              I, <FillSpan value={fullName} placeholder="full name" />, authorize M2 Phenom and any affiliated M2 product
              to charge the card listed above <FillSpan value={amountNum > 0 ? `$${formatAmountDisplay(amountNum)}` : ""} placeholder="$amount" mono /> every
              month, beginning <FillSpan value={f.firstCharge === "Today, then monthly" ? longDate() : f.firstCharge} placeholder="start date" />.
            </p>
            <p className="font-serif text-ink mt-4" style={{ fontSize: 16, lineHeight: 1.65 }}>
              This is a subscription. It repeats indefinitely, with no end date, and continues until I cancel it myself.
            </p>

            <div className="border-t border-rule my-6" />

            <ul className="space-y-3 font-serif text-ink" style={{ fontSize: 15, lineHeight: 1.6 }}>
              {[
                "I am the authorized holder of this card, or I have permission from the holder to use it.",
                "The charge will appear on my statement as M2 PHENOM.",
                "To cancel, I notify M2 Phenom in writing at least 3 business days before my next billing date. Cancelling stops future charges; it does not refund charges already processed.",
                "If the recurring amount changes, M2 Phenom will notify me at least 10 days before the new amount is charged.",
                "If a charge fails, M2 Phenom may retry it and may suspend my access until payment clears.",
                "I will raise any billing question with M2 Phenom directly before disputing a charge with my card issuer.",
              ].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-brand font-mono shrink-0 pt-[3px]" style={{ color: "#D45E0F" }}>—</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-rule my-6" />

            <label className="flex items-start gap-3 cursor-pointer group" data-invalid={errors.consent ? "true" : undefined}>
              <input type="checkbox" checked={f.consent} onChange={e => set("consent", e.target.checked)} className="sr-only peer" />
              <span
                className={
                  "mt-[2px] shrink-0 inline-flex items-center justify-center w-5 h-5 border-[1.5px] transition-colors rounded-[6px] " +
                  (f.consent ? "border-transparent" : "bg-card border-rule-strong group-hover:border-[color:var(--color-brand)] ") +
                  (errors.consent ? "!border-flag " : "")
                }
                style={f.consent ? { background: "linear-gradient(140deg,#D45E0F,#F17A24)", borderColor: "transparent" } : undefined}
                aria-hidden="true"
              >
                {f.consent && (
                  <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
                    <path d="M4 10.5l4 4 8-9" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="font-serif text-ink" style={{ fontSize: 15.5, lineHeight: 1.55 }}>
                I have read this authorization, I agree to it, and I accept my typed and drawn signature below as my legal electronic signature.
              </span>
            </label>
            {errors.consent && <div className="error-text ml-8">{errors.consent}</div>}
          </Section>

          {/* 06 SIGNATURE */}
          <Section num="06" title="Signature">
            <SigPad
              ref={sigPadRef}
              onStroke={() => {
                setSigned(true);
                setStrokes(n => {
                  const next = n + 1;
                  if (next === 1) setFirstStrokeAt(new Date());
                  return next;
                });
                if (attempted) setErrors(p => ({ ...p, signature: undefined }));
              }}
              onClear={() => { setSigned(false); setStrokes(0); setFirstStrokeAt(null); }}
              strokes={strokes}
              firstStrokeAt={firstStrokeAt}
              hasError={!!errors.signature}
            />
            {errors.signature && <div className="error-text">{errors.signature}</div>}

            <div className="mt-6">
              <Row cols="1fr 200px">
                <Field label="Type your full legal name" required error={errors.typedName}>
                  <input className={inputCls(errors.typedName, f.typedName)} value={f.typedName}
                    onChange={e => set("typedName", e.target.value)} onBlur={onBlurRevalidate} />
                </Field>
                <Field label="Date">
                  <input readOnly value={today} className="field-input field-input-mono" />
                </Field>
              </Row>
            </div>
          </Section>

          {/* SUBMIT */}
          <div className="pt-2">
            {attempted && Object.keys(errors).length > 0 && (
              <div
                className="mb-5 border p-4 font-mono text-[11.5px] uppercase tracking-[0.08em] text-flag bg-[#FBEBE9] border-flag rounded-[12px]"
                role="alert"
              >
                <div className="mb-1 font-semibold">Cannot submit — please review:</div>
                <ul className="normal-case tracking-normal font-sans text-[13px] text-flag mt-2 space-y-1">
                  {!f.consent && <li>· Consent checkbox is required</li>}
                  {!signed && <li>· Signature is required</li>}
                  {errors.typedName && <li>· Typed name must match Section 01</li>}
                  {(errors.cardNumber || errors.expiry || errors.cvv) && <li>· Card details are incomplete or invalid</li>}
                </ul>
              </div>
            )}
            <button type="submit" className="cta-shimmer group inline-flex items-center justify-center gap-3">
              <span className="relative z-10">Authorize recurring charge</span>
              <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">→</span>
            </button>
            <p className="mt-4 text-center hint-mono">
              Encrypted in transit · Card data tokenized before storage · Revoke anytime
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}

/* ---------------- HERO ---------------- */

function Hero({ progress }: { progress: number }) {
  return (
    <header>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="https://www.m2phenom.com/images/m2phenom_logo.png?t=5"
            alt="M2 Phenom"
            className="h-9 w-auto"
            style={{ mixBlendMode: "multiply" }}
          />
        </div>
        <div className="secure-pill">
          <span className="pulse-dot" aria-hidden="true" />
          <span>Secure session</span>
        </div>
      </div>

      <div className="mt-10">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-70">
          Form M2-AUTH · Rev. 2026.1
        </div>
        <h1 className="mt-4 font-serif text-ink leading-[0.98] tracking-[-0.02em]"
            style={{ fontSize: "clamp(44px, 7.2vw, 76px)", fontWeight: 500 }}>
          Authorize your <span className="hero-word">recurring payment</span><span className="text-brand" style={{ color: "#D45E0F" }}>.</span>
        </h1>
        <p className="mt-6 font-serif text-ink-70 max-w-[560px]" style={{ fontSize: 17.5, lineHeight: 1.55 }}>
          Complete every section below. Your signature at the end authorizes M2 Phenom to charge
          the card you provide on the same day each month, at the amount you select, until you cancel.
        </p>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-2.5">
          <span className="label-mono">Authorization progress</span>
          <span className="font-mono text-[11px] tracking-[0.1em]" style={{ color: "#D45E0F" }}>{progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </header>
  );
}

/* ---------------- helper components ---------------- */

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-card">
      <div className="label-mono">{label}</div>
      <div className="mt-1.5 font-serif text-ink" style={{ fontSize: 19 }}>{value}</div>
    </div>
  );
}

function inputCls(err: string | undefined, val: string | undefined | boolean, mono = false) {
  return [
    "field-input",
    mono ? "field-input-mono" : "",
    val ? "field-filled" : "",
    err ? "field-error" : "",
  ].filter(Boolean).join(" ");
}

function Section({ num, title, hint, children }: {
  num: string; title: string; hint?: React.ReactNode; children: React.ReactNode;
}) {
  const revealRef = useReveal<HTMLElement>();
  return (
    <section ref={revealRef} className="card-elevated reveal p-6 sm:p-8">
      <SectionHeader num={num} title={title} hint={hint} />
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function SectionHeader({ num, title, hint }: { num: string; title: string; hint?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="badge-step">{num}</span>
      <h2 className="section-title m-0">{title}</h2>
      {hint && <span className="ml-auto hint-mono">{hint}</span>}
    </div>
  );
}

function Row({ cols, children }: { cols: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: cols }}>
      {children}
    </div>
  );
}

function Field({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div data-invalid={error ? "true" : undefined} className="min-w-0">
      <label className="flex items-baseline gap-2 mb-1.5">
        <span className="label-mono">{label}</span>
        {required && <span className="font-mono text-[10.5px]" style={{ color: "#D45E0F" }} aria-hidden="true">*</span>}
        {hint && <span className="font-mono text-[10px] text-ink-45 normal-case tracking-[0.04em] lowercase">({hint})</span>}
      </label>
      <div>{children}</div>
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

function FillSpan({ value, placeholder, mono }: { value: string; placeholder: string; mono?: boolean }) {
  if (value) {
    return (
      <span
        className={"font-semibold underline decoration-1 underline-offset-[3px] " + (mono ? "font-mono" : "")}
        style={{ color: "#D45E0F", textDecorationColor: "#D45E0F" }}
      >
        {value}
      </span>
    );
  }
  return (
    <span className="text-ink-45 underline decoration-rule-strong decoration-1 underline-offset-[3px]">
      [{placeholder}]
    </span>
  );
}

/* ---------------- LIVE CARD PREVIEW ---------------- */

function CardPreview({ name, number, expiry, brand }: {
  name: string; number: string; expiry: string; brand: CardBrand;
}) {
  const display = number
    ? number.padEnd(brand === "Amex" ? 17 : 19, "•").slice(0, brand === "Amex" ? 17 : 19)
    : (brand === "Amex" ? "•••• •••••• •••••" : "•••• •••• •••• ••••");

  return (
    <div className="card-preview">
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">M2 Phenom</div>
          <div className="mt-1 font-serif text-white/95" style={{ fontSize: 15 }}>Recurring authorization</div>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/85 px-2.5 py-1 rounded-full border border-white/25">
          {brand !== "Unknown" ? brand : "Card"}
        </div>
      </div>

      <div className="relative z-10 mt-8 font-mono text-white/95" style={{ fontSize: 20, letterSpacing: "0.14em" }}>
        {display}
      </div>

      <div className="relative z-10 mt-5 flex items-end justify-between">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">Cardholder</div>
          <div className="mt-1 font-sans text-white/95 uppercase tracking-[0.06em]" style={{ fontSize: 13 }}>
            {name || "Your name"}
          </div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">Expires</div>
          <div className="mt-1 font-mono text-white/95" style={{ fontSize: 13 }}>
            {expiry || "MM/YY"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- signature pad ---------------- */

type SigPadHandle = {
  toDataURL: () => string;
  clear: () => void;
};

const SigPad = (function () {
  return function SigPadImpl({
    ref, onStroke, onClear, strokes, firstStrokeAt, hasError,
  }: {
    ref: React.RefObject<SigPadHandle | null>;
    onStroke: () => void;
    onClear: () => void;
    strokes: number;
    firstStrokeAt: Date | null;
    hasError: boolean;
  }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const lastPoint = useRef<{ x: number; y: number } | null>(null);
    const hasInk = useRef(false);
    const [hasInkState, setHasInkState] = useState(false);
    const [nowStamp, setNowStamp] = useState<string>("—");

    const paintBaseline = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const y = h - 40;
      ctx.save();
      ctx.strokeStyle = "#10161C";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(w - 30, y);
      ctx.stroke();
      ctx.fillStyle = "#10161C";
      ctx.font = "500 20px Newsreader, Georgia, serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("✕", 14, y + 3);
      ctx.restore();
    };

    const setupCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      paintBaseline(ctx, rect.width, rect.height);
    };

    useEffect(() => {
      setupCanvas();
      const onResize = () => {
        const canvas = canvasRef.current; if (!canvas) return;
        setupCanvas();
        hasInk.current = false;
        setHasInkState(false);
        onClear();
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (!firstStrokeAt) { setNowStamp("—"); return; }
      const iv = setInterval(() => setNowStamp(timestampStamp(new Date())), 1000);
      setNowStamp(timestampStamp(new Date()));
      return () => clearInterval(iv);
    }, [firstStrokeAt]);

    const getPos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      drawing.current = true;
      lastPoint.current = getPos(e);
    };

    const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const p = getPos(e);
      const lp = lastPoint.current ?? p;
      ctx.strokeStyle = "#10161C";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lp.x, lp.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPoint.current = p;
      if (!hasInk.current) {
        hasInk.current = true;
        setHasInkState(true);
      }
    };

    const end = () => {
      if (!drawing.current) return;
      drawing.current = false;
      lastPoint.current = null;
      if (hasInk.current) onStroke();
    };

    useEffect(() => {
      if (!ref) return;
      ref.current = {
        toDataURL: () => canvasRef.current?.toDataURL("image/png") ?? "",
        clear: () => {
          setupCanvas();
          hasInk.current = false;
          setHasInkState(false);
          onClear();
        },
      };
    });

    return (
      <div>
        <div
          className={
            "relative bg-card border-2 border-dashed rounded-[14px] " +
            (hasError ? "border-flag" : "border-rule-strong")
          }
          style={{ height: 170 }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full touch-none rounded-[14px]"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            aria-label="Signature pad — draw your signature"
            role="img"
          />
          {!hasInkState && (
            <div className="absolute inset-x-0 top-6 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-45 pointer-events-none">
              Sign here
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <button type="button"
            onClick={() => {
              const canvas = canvasRef.current; if (!canvas) return;
              setupCanvas();
              hasInk.current = false;
              setHasInkState(false);
              onClear();
            }}
            className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-70 hover:text-[color:var(--color-brand)] underline underline-offset-[3px]"
          >
            Clear signature
          </button>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-45">
            {firstStrokeAt ? nowStamp : "—"} · {strokes} {strokes === 1 ? "stroke" : "strokes"}
          </div>
        </div>
      </div>
    );
  };
})();

/* ---------------- confirmation ---------------- */

function Confirmation({ data }: {
  data: {
    ref: string; signedAt: Date; consentAcceptedAt: Date; signatureDataUrl: string;
    payload: FormState; brand: CardBrand; last4: string;
    ip: string; userAgent: string; pdfBlobUrl: string | null;
  };
}) {
  const pdfData = useMemo(() => buildPdfData({
    payload: data.payload, ref: data.ref, signedAt: data.signedAt,
    consentAcceptedAt: data.consentAcceptedAt, signatureDataUrl: data.signatureDataUrl,
    brand: data.brand, last4: data.last4, ip: data.ip, userAgent: data.userAgent,
  }), [data]);
  const fileName = `M2-AUTH_${(data.payload.lastName || "signer").replace(/[^A-Za-z0-9-]/g, "")}_${data.ref}.pdf`;

  const { payload: p } = data;
  const amount = amountFromInput(p.amount);
  const startText = p.firstCharge === "Today, then monthly" ? "today" : p.firstCharge.toLowerCase();
  const summary = `$${formatAmountDisplay(amount)} will be charged to the ${data.brand} ending ${data.last4} every month, starting ${startText}, until cancelled.`;

  const rows: [string, string][] = [
    ["Account holder", [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ")],
    ["Email", p.email],
    ["Phone", p.phone],
    ["Billing address", [p.street, p.apt, `${p.city}, ${p.state} ${p.zip}`].filter(Boolean).join(" · ")],
    ["Monthly amount", `$${formatAmountDisplay(amount)} USD`],
    ["Card", `${data.brand} ···· ${data.last4}`],
    ["Expires", p.expiry],
    ["Frequency", "Monthly, until cancelled"],
    ["First charge", p.firstCharge],
    ["Signed", timestampStamp(data.signedAt)],
    ["Reference", data.ref],
  ];

  return (
    <main className="bg-mesh min-h-dvh px-5 py-10 sm:py-14">
      <div className="mx-auto max-w-[760px]">
        <header>
          <div className="flex items-start justify-between gap-4">
            <img
              src="https://www.m2phenom.com/images/m2phenom_logo.png?t=5"
              alt="M2 Phenom"
              className="h-9 w-auto"
              style={{ mixBlendMode: "multiply" }}
            />
            <div className="secure-pill">
              <span className="pulse-dot" aria-hidden="true" />
              <span>Authorization active</span>
            </div>
          </div>
          <div className="mt-10">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-70">
              Form M2-AUTH · Rev. 2026.1 · Executed
            </div>
            <h1 className="mt-4 font-serif text-ink leading-[0.98] tracking-[-0.02em]"
                style={{ fontSize: "clamp(40px, 6vw, 60px)", fontWeight: 500 }}>
              Recurring charge <span className="hero-word">authorized</span><span style={{ color: "#D45E0F" }}>.</span>
            </h1>
          </div>
        </header>

        <div className="mt-10 card-elevated p-6 sm:p-8" style={{ borderColor: "rgba(212,94,15,0.35)" }}>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] mb-3" style={{ color: "#D45E0F" }}>
            Confirmation
          </div>
          <p className="font-serif text-ink" style={{ fontSize: 19, lineHeight: 1.55 }}>{summary}</p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <PdfDownloadLink
            data={pdfData}
            fileName={fileName}
            className="cta-shimmer group inline-flex items-center justify-center gap-3 !w-auto !py-3.5 !px-5 !text-[11.5px]"
          >
            <span className="relative z-10">Download PDF</span>
            <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">↓</span>
          </PdfDownloadLink>
          {data.pdfBlobUrl && (
            <a
              href={data.pdfBlobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center border border-ink text-ink font-mono text-[11.5px] uppercase tracking-[0.16em] px-5 py-3.5 rounded-[14px] hover:bg-ink hover:text-white transition-colors"
            >
              Open in new tab
            </a>
          )}
          <span className="hint-mono sm:ml-2">
            {data.pdfBlobUrl ? "PDF ready · archived for records" : "Preparing PDF…"}
          </span>
        </div>

        <section className="mt-10 card-elevated p-6 sm:p-8">
          <SectionHeader num="A" title="Record of authorization" />
          <dl className="mt-5 divide-y divide-rule">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[180px_1fr] gap-4 py-3">
                <dt className="label-mono self-center">{k}</dt>
                <dd className={"text-ink " + (["Card","Expires","Reference","Signed","Phone","Monthly amount"].includes(k) ? "font-mono text-[13px]" : "font-sans text-[14px]")}>{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-8 card-elevated p-6 sm:p-8">
          <SectionHeader num="B" title="Signature" />
          <div className="mt-5 bg-card border border-rule-strong p-4 rounded-[14px]">
            {data.signatureDataUrl ? (
              <img src={data.signatureDataUrl} alt="Client signature" className="max-h-[170px] mx-auto" />
            ) : (
              <div className="text-ink-45 font-mono text-[11px]">Signature unavailable</div>
            )}
            <div className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-45 text-center">
              Typed name: {p.typedName} · Signed {timestampStamp(data.signedAt)}
            </div>
          </div>
        </section>

        <p className="mt-10 text-center hint-mono">
          Retain this reference: <span className="text-ink">{data.ref}</span>
        </p>
      </div>
    </main>
  );
}
