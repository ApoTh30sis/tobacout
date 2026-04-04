'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

type Step = 'upload' | 'form' | 'timeline';

interface FormData {
  age: string;
  yearsSmoked: string;
  cigarettesPerDay: string;
}

interface YearData {
  year: number;
  healthScore: number;
  lungCapacity: number;
  heartRisk: string;
  co2Kg: number;
  cigarettesSmoked: number;
  waterUsedL: number;
  moneySpent: number;
  milestone: string;
  milestoneDetail: string;
  accentColor: string;
}

// Neutral grey → deep red as year increases
function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return `#${Math.round(ar + (br - ar) * t).toString(16).padStart(2, '0')}${Math.round(ag + (bg - ag) * t).toString(16).padStart(2, '0')}${Math.round(ab + (bb - ab) * t).toString(16).padStart(2, '0')}`;
}

function accentForYear(year: number): string {
  const stops: [number, string][] = [
    [0,  '#71717a'], // zinc-500 — neutral
    [8,  '#f97316'], // orange
    [18, '#ef4444'], // red
    [30, '#7f1d1d'], // dark red
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [y0, c0] = stops[i];
    const [y1, c1] = stops[i + 1];
    if (year >= y0 && year <= y1) return lerpColor(c0, c1, (year - y0) / (y1 - y0));
  }
  return '#7f1d1d';
}

function getMilestone(year: number): { milestone: string; detail: string } {
  if (year === 0)  return { milestone: 'Today',                   detail: 'This is where you are now. Every year on this line is another year of continued damage.' };
  if (year <= 2)   return { milestone: 'Early Damage Accumulating', detail: 'Lung cilia remain suppressed. Carbon monoxide binding to red blood cells. Elevated cardiovascular strain.' };
  if (year <= 5)   return { milestone: 'Cardiovascular Strain',   detail: 'Blood vessel walls thickening. Reduced circulation. Resting heart rate and blood pressure elevated.' };
  if (year <= 8)   return { milestone: 'Lung Function Declining', detail: 'FEV1 lung capacity measurably reduced. Chronic cough common. Increased respiratory infections.' };
  if (year <= 12)  return { milestone: 'Compounding Health Debt', detail: 'Pack-year count in dangerous territory. Cancer risk rising. Heart disease risk significantly elevated.' };
  if (year <= 16)  return { milestone: 'Serious Health Risk',     detail: 'Lung cancer risk multiplied. COPD likelihood high. Peripheral vascular disease a real concern.' };
  if (year <= 20)  return { milestone: 'Severe Long-term Damage', detail: 'Major organ damage compounding. Life expectancy impact now measured in years, not months.' };
  if (year <= 25)  return { milestone: 'Critical Stage',          detail: 'Irreversible damage to airways, arteries, and lung tissue. Quality of life significantly impacted.' };
  return { milestone: 'Maximum Risk Zone', detail: `${year} more years of smoking. The cumulative toll is severe. It is still not too late to stop.` };
}

function calculateForYear(form: FormData, year: number): YearData {
  const yearsSmoked = parseFloat(form.yearsSmoked) || 1;
  const cpd         = parseFloat(form.cigarettesPerDay) || 10;
  const age         = parseInt(form.age) || 30;

  const CO2_PER_CIG_G   = 14;   // g CO2e per cigarette (full lifecycle)
  const WATER_PER_CIG_L = 3.7;  // litres per cigarette
  const PACK_PRICE      = 14;   // $ per pack

  const annualCigs = cpd * 365;
  const totalPackYears = (cpd / 20) * (yearsSmoked + year); // cumulative at this point

  // Health score: already degraded at year 0, worsens each year
  const baseHealth = Math.max(20, 85 - ((cpd / 20) * yearsSmoked) * 2.5 - Math.max(0, age - 40) * 0.5);
  const healthScore = Math.max(10, Math.round(baseHealth - year * 1.8));

  // Lung capacity: already reduced, keeps declining
  const lungBase    = Math.max(40, 95 - ((cpd / 20) * yearsSmoked) * 3.5);
  const lungCapacity = Math.max(20, Math.round(lungBase - year * 1.6));

  const heartRisk =
    year === 0  ? 'Elevated' :
    year <= 3   ? 'Elevated and rising' :
    year <= 8   ? 'High' :
    year <= 15  ? 'Very high' :
                  'Severe';

  // Cumulative from continued smoking (year 0 = today, no past added here)
  const cigarettesSmoked = Math.round(annualCigs * year);
  const co2Kg            = Math.round((cigarettesSmoked * CO2_PER_CIG_G) / 1000 * 10) / 10;
  const waterUsedL       = Math.round(cigarettesSmoked * WATER_PER_CIG_L);
  const moneySpent       = Math.round((cigarettesSmoked / 20) * PACK_PRICE);

  const { milestone, detail: milestoneDetail } = getMilestone(year);

  return {
    year,
    healthScore,
    lungCapacity,
    heartRisk,
    co2Kg,
    cigarettesSmoked,
    waterUsedL,
    moneySpent,
    milestone,
    milestoneDetail,
    accentColor: accentForYear(year),
  };
}

// ─── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'upload',   label: 'Photo' },
    { id: 'form',     label: 'Data' },
    { id: 'timeline', label: 'Timeline' },
  ];
  const currentIdx = steps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-3 mb-10">
      {steps.map((s, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && (
              <div className="w-10 h-px" style={{ backgroundColor: done ? '#22c55e' : '#3f3f46' }} />
            )}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: done ? '#22c55e' : active ? '#f59e0b' : '#27272a',
                  color: done ? '#fff' : active ? '#000' : '#71717a',
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className="text-sm" style={{ color: active ? '#fff' : done ? '#a1a1aa' : '#52525b' }}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Upload Step ───────────────────────────────────────────────────────────────

function UploadStep({
  photo,
  onPhoto,
  onNext,
}: {
  photo: string | null;
  onPhoto: (src: string) => void;
  onNext: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => onPhoto(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#09090f] flex flex-col items-center justify-center p-6">
      <div className="mb-10 text-center">
        <div
          className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full border"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.2)' }}
        >
          <span style={{ color: '#f59e0b' }} className="text-sm font-medium">Health Timeline Generator</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
          Tobac<span style={{ color: '#f59e0b' }}>out</span>
        </h1>
        <p className="text-zinc-400 text-base max-w-sm mx-auto leading-relaxed">
          See the real cost of smoking — and what quitting today means for your next 30 years.
        </p>
      </div>

      <StepIndicator current="upload" />

      <div
        className="w-full max-w-md rounded-2xl border-2 border-dashed p-12 flex flex-col items-center justify-center cursor-pointer transition-all"
        style={{
          borderColor: isDragging ? '#f59e0b' : photo ? '#22c55e' : '#3f3f46',
          backgroundColor: isDragging
            ? 'rgba(245,158,11,0.05)'
            : photo
            ? 'rgba(34,197,94,0.05)'
            : 'rgba(24,24,27,0.6)',
        }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        {photo ? (
          <>
            <div
              className="relative w-28 h-28 rounded-full overflow-hidden mb-4"
              style={{ boxShadow: '0 0 0 4px rgba(34,197,94,0.3)' }}
            >
              <img src={photo} alt="Uploaded" className="w-full h-full object-cover" />
            </div>
            <p className="font-medium" style={{ color: '#22c55e' }}>Photo ready</p>
            <p className="text-zinc-500 text-sm mt-1">Click to change</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#18181b' }}>
              <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-white font-medium mb-1">Drop your photo here</p>
            <p className="text-zinc-500 text-sm">or click to browse</p>
            <p className="text-zinc-600 text-xs mt-3">JPG, PNG, WEBP supported</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      <button
        onClick={onNext}
        disabled={!photo}
        className="mt-6 px-8 py-3.5 rounded-full font-semibold text-sm transition-all"
        style={{
          backgroundColor: photo ? '#f59e0b' : '#27272a',
          color: photo ? '#000' : '#52525b',
          cursor: photo ? 'pointer' : 'not-allowed',
        }}
      >
        Continue →
      </button>
      <button
        onClick={onNext}
        className="mt-3 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        Skip photo and continue
      </button>
    </div>
  );
}

// ─── Form Step ─────────────────────────────────────────────────────────────────

function FormStep({
  form,
  onChange,
  onBack,
  onNext,
}: {
  form: FormData;
  onChange: (f: FormData) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const isValid = form.age && form.yearsSmoked && form.cigarettesPerDay;

  const field = (
    label: string,
    key: keyof FormData,
    placeholder: string,
    hint?: string,
    suffix?: string,
  ) => (
    <div>
      <label className="block text-sm font-medium mb-2" style={{ color: '#d4d4d8' }}>{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => onChange({ ...form, [key]: e.target.value })}
          className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
          style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
          onFocus={(e)  => (e.currentTarget.style.borderColor = '#f59e0b')}
          onBlur={(e)   => (e.currentTarget.style.borderColor = '#3f3f46')}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-zinc-600 text-xs mt-1.5">{hint}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090f] flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Tobac<span style={{ color: '#f59e0b' }}>out</span>
        </h1>
      </div>

      <StepIndicator current="form" />

      <div className="w-full max-w-md">
        <div className="rounded-2xl p-8" style={{ backgroundColor: '#111117', border: '1px solid #27272a' }}>
          <h2 className="text-xl font-semibold text-white mb-1">Your Smoking History</h2>
          <p className="text-zinc-500 text-sm mb-7">
            Used to model your personalised health impact across 30 years.
          </p>
          <div className="space-y-5">
            {field('Your Current Age',   'age',              '35', undefined,               'yrs')}
            {field('Years Smoking',      'yearsSmoked',      '10', 'Decimals OK — e.g. 2.5','yrs')}
            {field('Cigarettes Per Day', 'cigarettesPerDay', '10', '1 pack ≈ 20 cigarettes', 'cigs/day')}
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onBack}
            className="flex-1 py-3.5 rounded-full text-sm font-medium"
            style={{ border: '1px solid #3f3f46', color: '#71717a' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#71717a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#3f3f46'; }}
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            disabled={!isValid}
            className="flex-1 py-3.5 rounded-full text-sm font-semibold"
            style={{
              backgroundColor: isValid ? '#f59e0b' : '#27272a',
              color: isValid ? '#000' : '#52525b',
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            See My Timeline →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Step ─────────────────────────────────────────────────────────────

const MAX_YEARS = 30;
const TICKS = [0, 5, 10, 15, 20, 25, 30];

function TimelineStep({
  form,
  photo,
  onEdit,
  onReset,
}: {
  form: FormData;
  photo: string | null;
  onEdit: () => void;
  onReset: () => void;
}) {
  const [selectedYear, setSelectedYear] = useState(0);
  const [isFlipped, setIsFlipped]       = useState(false);

  useEffect(() => { setIsFlipped(false); }, [selectedYear]);

  const cpd           = parseFloat(form.cigarettesPerDay) || 10;
  const yrs           = parseFloat(form.yearsSmoked) || 1;
  const annualCO2kg   = Math.round((cpd * 365 * 14) / 1000);
  const totalPastCO2  = Math.round((cpd * 365 * yrs * 14) / 1000);
  const totalPastCigs = Math.round(cpd * 365 * yrs);
  const packYears     = Math.round((cpd / 20) * yrs * 10) / 10;

  const entry = calculateForYear(form, selectedYear);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#09090f' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #18181b' }}>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            {photo && (
              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ boxShadow: '0 0 0 2px rgba(245,158,11,0.35)' }}>
                <img src={photo} alt="You" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white leading-tight">
                Tobac<span style={{ color: '#f59e0b' }}>out</span>
              </h1>
              <p className="text-zinc-500 text-sm">
                {yrs}yr · {cpd} cigs/day · age {form.age} · {packYears} pack-years
              </p>
            </div>
            <button
              onClick={onEdit}
              className="shrink-0 text-sm px-3 py-1.5 rounded-lg"
              style={{ border: '1px solid #3f3f46', color: '#71717a' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#52525b'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#3f3f46'; }}
            >
              Edit
            </button>
          </div>

          {/* Past damage summary — small, subdued */}
          <div className="flex gap-6 mt-5 pt-5" style={{ borderTop: '1px solid #18181b' }}>
            {[
              { label: 'CO₂ emitted so far',  value: `${totalPastCO2.toLocaleString()} kg` },
              { label: 'Cigarettes smoked',    value: totalPastCigs.toLocaleString() },
              { label: 'Spent on cigarettes',  value: `$${Math.round((totalPastCigs / 20) * 14).toLocaleString()}` },
              { label: 'Annual CO₂',           value: `${annualCO2kg} kg/yr` },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-zinc-600 text-xs">{s.label}</div>
                <div className="text-zinc-300 text-sm font-semibold mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-10 pb-12">

        {/* ── Timeline Bar ── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-600 text-xs tracking-wide uppercase">
              Years from now if you continue smoking
            </span>
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: entry.accentColor }}
            >
              {selectedYear === 0 ? 'Today' : `+${selectedYear} years`}
            </span>
          </div>

          {/* The line */}
          <div className="relative" style={{ paddingTop: 12, paddingBottom: 28 }}>
            {/* Track line */}
            <div className="rounded-full" style={{ height: 2, backgroundColor: '#27272a' }} />

            {/* Tick points — visual only */}
            {TICKS.map((t) => {
              const isSelected = t === selectedYear;
              const isPast     = t < selectedYear;
              const tickColor  = accentForYear(t);
              return (
                <div
                  key={t}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${(t / MAX_YEARS) * 100}%`, top: 0, transform: 'translateX(-50%)' }}
                >
                  <div
                    style={{
                      width: isSelected ? 14 : 8,
                      height: isSelected ? 14 : 8,
                      borderRadius: '50%',
                      backgroundColor: isSelected ? tickColor : isPast ? '#3f3f46' : '#27272a',
                      boxShadow: isSelected ? `0 0 0 3px #09090f, 0 0 0 5px ${tickColor}60` : 'none',
                      marginTop: isSelected ? 3 : 6,
                    }}
                  />
                  <span
                    className="text-xs mt-2 tabular-nums"
                    style={{ color: isSelected ? tickColor : '#3f3f46' }}
                  >
                    {t === 0 ? 'Now' : `${t}yr`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Detail Card ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#111117',
            border: `1px solid #1c1c22`,
          }}
        >
          <div className="flex flex-col sm:flex-row" style={{ minHeight: 380 }}>

            {/* ── Left: flip card (only when a photo was uploaded) ── */}
            {photo && <div
              className="relative flex flex-col items-center justify-center sm:w-1/2"
              style={{ backgroundColor: '#0e0e14', borderRight: '1px solid #1c1c22', minHeight: 300, padding: '24px 0 64px' }}
            >
              {/* 3-D flip card */}
              <div style={{ perspective: '1100px', width: '62%', aspectRatio: '3/4' }}>
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* ── Front face — Photo 1 placeholder ── */}
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: '1px dashed #2a2a33',
                      backgroundColor: '#13131a',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <span style={{ color: '#52525b', fontSize: 11, textAlign: 'center', padding: '0 16px', lineHeight: 1.5 }}>
                      Photo 1<br />will appear here
                    </span>
                  </div>

                  {/* ── Back face — Photo 2 placeholder ── */}
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: `1px dashed ${entry.accentColor}40`,
                      backgroundColor: '#13131a',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={entry.accentColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <span style={{ color: '#52525b', fontSize: 11, textAlign: 'center', padding: '0 16px', lineHeight: 1.5 }}>
                      Photo 2<br />will appear here
                    </span>
                  </div>
                </div>
              </div>

              {/* Flip button — bottom center */}
              <button
                onClick={() => setIsFlipped((f) => !f)}
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  borderRadius: 99,
                  backgroundColor: '#13131a',
                  border: `1px solid ${entry.accentColor}45`,
                  color: entry.accentColor,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${entry.accentColor}15`; e.currentTarget.style.borderColor = entry.accentColor; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#13131a'; e.currentTarget.style.borderColor = `${entry.accentColor}45`; }}
              >
                {/* Flip icon — nudges on idle */}
                <svg
                  width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: 'flipNudge 3s ease-in-out infinite' }}
                >
                  <path d="M1 4v6h6" />
                  <path d="M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
                {isFlipped ? 'Photo 1' : 'Photo 2'}
              </button>

              {/* Year badge */}
              <div
                style={{
                  position: 'absolute', bottom: 16, left: 16,
                  padding: '3px 10px',
                  borderRadius: 8,
                  fontSize: 11, fontWeight: 600,
                  backgroundColor: `${entry.accentColor}18`,
                  color: entry.accentColor,
                  border: `1px solid ${entry.accentColor}30`,
                }}
              >
                {selectedYear === 0 ? 'Today' : `+${selectedYear} years`}
              </div>
            </div>}

            {/* ── Right: data (full-width when no photo) ── */}
            <div className="flex flex-col justify-between p-6" style={{ width: photo ? '50%' : '100%' }}>

              {/* Title + description */}
              <div className="mb-5">
                <h2 className="text-white font-semibold text-lg mb-1">{entry.milestone}</h2>
                <p className="text-zinc-500 text-sm leading-relaxed">{entry.milestoneDetail}</p>
              </div>

              {/* Health bars */}
              <div className="space-y-3 mb-5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-zinc-500 text-xs">Health Score</span>
                    <span className="text-white font-bold text-sm tabular-nums">{entry.healthScore}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: '#27272a' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${entry.healthScore}%`, backgroundColor: entry.accentColor }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-zinc-500 text-xs">Lung Capacity</span>
                    <span className="text-white font-bold text-sm tabular-nums">{entry.lungCapacity}%</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: '#27272a' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${entry.lungCapacity}%`, backgroundColor: entry.accentColor }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg p-3" style={{ backgroundColor: '#18181b' }}>
                  <div className="text-zinc-600 text-xs mb-0.5">Heart Risk</div>
                  <div className="text-white text-sm font-medium">{entry.heartRisk}</div>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#18181b' }}>
                  <div className="text-zinc-600 text-xs mb-0.5">
                    {selectedYear === 0 ? 'Annual CO₂' : 'CO₂ Added'}
                  </div>
                  <div className="font-semibold text-sm" style={{ color: entry.accentColor }}>
                    {selectedYear === 0
                      ? `${Math.round((cpd * 365 * 14) / 1000)} kg/yr`
                      : `${entry.co2Kg.toLocaleString()} kg`}
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#18181b' }}>
                  <div className="text-zinc-600 text-xs mb-0.5">Water Used</div>
                  <div className="font-semibold text-sm" style={{ color: entry.accentColor }}>
                    {selectedYear === 0
                      ? `${Math.round((cpd * 365 * 3.7) / 1000)} kL/yr`
                      : entry.waterUsedL > 999
                      ? `${Math.round(entry.waterUsedL / 1000)} kL`
                      : `${entry.waterUsedL} L`}
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#18181b' }}>
                  <div className="text-zinc-600 text-xs mb-0.5">Money Spent</div>
                  <div className="font-semibold text-sm" style={{ color: entry.accentColor }}>
                    {selectedYear === 0
                      ? `$${Math.round((cpd / 20) * 365 * 14).toLocaleString()}/yr`
                      : `$${entry.moneySpent.toLocaleString()}`}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={onReset}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ border: '1px solid #27272a', color: '#52525b' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#3f3f46'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#52525b'; e.currentTarget.style.borderColor = '#27272a'; }}
          >
            Start over
          </button>

          <div className="flex items-center gap-3">
            {selectedYear > 0 && (
              <button
                onClick={() => setSelectedYear(selectedYear - 5)}
                className="text-sm px-4 py-2 rounded-lg"
                style={{ border: '1px solid #27272a', color: '#71717a' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#3f3f46'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#27272a'; }}
              >
                ← Back
              </button>
            )}

            {selectedYear < MAX_YEARS ? (
              <button
                onClick={() => setSelectedYear(selectedYear + 5)}
                className="text-sm px-5 py-2 rounded-lg font-semibold"
                style={{ backgroundColor: entry.accentColor, color: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                +5 years →
              </button>
            ) : (
              <button
                onClick={() => window.print()}
                className="text-sm px-5 py-2 rounded-lg font-semibold"
                style={{ backgroundColor: '#f59e0b', color: '#000' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fbbf24')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
              >
                Save Timeline
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [step, setStep]   = useState<Step>('upload');
  const [photo, setPhoto] = useState<string | null>(null);
  const [form, setForm]   = useState<FormData>({ age: '', yearsSmoked: '', cigarettesPerDay: '' });

  if (step === 'upload') {
    return <UploadStep photo={photo} onPhoto={setPhoto} onNext={() => setStep('form')} />;
  }

  if (step === 'form') {
    return (
      <FormStep
        form={form}
        onChange={setForm}
        onBack={() => setStep('upload')}
        onNext={() => setStep('timeline')}
      />
    );
  }

  return (
    <TimelineStep
      form={form}
      photo={photo}
      onEdit={() => setStep('form')}
      onReset={() => {
        setStep('upload');
        setPhoto(null);
        setForm({ age: '', yearsSmoked: '', cigarettesPerDay: '' });
      }}
    />
  );
}
