"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CalendarDays,
  MapPin,
  PartyPopper,
  Mic2,
  Users,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
type Category = "planner" | "performer" | "crew";
type Values = {
  eventName: string;
  eventType: string;
  startDate: string;
  endDate: string;
  location: string;
  venue: string;
  category: Category;
  details: Record<string, string>;
  idempotencyKey: string;
};
const categories = [
  {
    id: "planner",
    title: "Event planner",
    sub: "Bring the whole vision together",
    icon: PartyPopper,
  },
  {
    id: "performer",
    title: "Performer",
    sub: "Give your guests a moment to remember",
    icon: Mic2,
  },
  {
    id: "crew",
    title: "Crew",
    sub: "Get the right hands behind the scenes",
    icon: Users,
  },
] as const;
const steps = [
  "Event basics",
  "Your requirements",
  "The finer details",
  "Review & submit",
];
const blank = (): Values => ({
  eventName: "",
  eventType: "Wedding",
  startDate: "",
  endDate: "",
  location: "",
  venue: "",
  category: "planner",
  details: {},
  idempotencyKey: crypto.randomUUID(),
});
export default function Page() {
  const [v, setV] = useState<Values | null>(null),
    [step, setStep] = useState(0),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<{ id: string; category: string } | null>(
      null,
    ),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("gopratle-draft");
      const data = raw ? JSON.parse(raw) : null;
      setV(
        data && ["planner", "performer", "crew"].includes(data.category)
          ? data
          : blank(),
      );
    } catch {
      setV(blank());
    }
  }, []);
  useEffect(() => {
    if (v && !receipt) {
      try {
        sessionStorage.setItem("gopratle-draft", JSON.stringify(v));
        setSaved(true);
      } catch {
        setSaved(false);
      }
    }
  }, [v, receipt]);
  if (!v)
    return <main className="loading">Opening your event workspace...</main>;
  function update(key: keyof Values, value: string) {
    setV((old) => (old ? { ...old, [key]: value } : old));
    setErrors({});
  }
  function detail(key: string, value: string) {
    setV((old) =>
      old ? { ...old, details: { ...old.details, [key]: value } } : old,
    );
    setErrors({});
  }
  const data = v;
  function validate(index: number) {
    const e: Record<string, string> = {};
    const d = data.details;
    if (index === 0) {
      if (data.eventName.trim().length < 3)
        e.eventName = "Give your event a name (at least 3 characters).";
      if (!data.startDate) e.startDate = "Choose a start date.";
      else if (data.startDate < new Date().toISOString().slice(0, 10))
        e.startDate = "Choose today or a future date (UTC).";
      if (!data.endDate)
        e.endDate = "Choose an end date, even for a one-day event.";
      else if (data.endDate < data.startDate)
        e.endDate = "End date cannot be before the start date.";
      if (data.location.trim().length < 2)
        e.location = "Add a city or location.";
    }
    if (index === 1) {
      const keys =
        data.category === "planner"
          ? ["service", "guests"]
          : data.category === "performer"
            ? ["act", "audience"]
            : ["department", "count"];
      for (const k of keys)
        if (
          !d[k] ||
          (["guests", "audience", "count"].includes(k) && Number(d[k]) < 1)
        )
          e[k] = "Please complete this field.";
    }
    if (index === 2) {
      const key =
        data.category === "planner"
          ? "style"
          : data.category === "performer"
            ? "duration"
            : "hours";
      if (
        !d[key] ||
        (["duration", "hours"].includes(key) &&
          Number(d[key]) < (key === "duration" ? 15 : 1))
      )
        e[key] = "Please complete this field.";
      if (!d.budget || Number(d.budget) < 1)
        e.budget = "Add a budget of at least ₹1.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  function goNext() {
    if (validate(step)) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setErrors({});
    try {
      const response = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) {
        const e: Record<string, string> = {
          submit:
            body.error || "Could not save your request. Please try again.",
        };
        for (const f of body.fields || [])
          e[f.path.replace("details.", "")] = f.message;
        setErrors(e);
        return;
      }
      setReceipt(body);
      sessionStorage.removeItem("gopratle-draft");
      window.scrollTo({ top: 0 });
    } catch {
      setErrors({
        submit:
          "The server is unavailable. Nothing has been confirmed. Your form is still here; please try again.",
      });
    } finally {
      setBusy(false);
    }
  }
  function Field({
    name,
    label,
    type = "text",
    required = true,
    options,
    wide = false,
  }: {
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    options?: string[];
    wide?: boolean;
  }) {
    const basic = name in data && name !== "details";
    const value = basic
      ? String(data[name as keyof Values] || "")
      : data.details[name] || "";
    const onChange = (value: string) =>
      basic ? update(name as keyof Values, value) : detail(name, value);
    return (
      <div className={`field ${wide ? "wide" : ""}`}>
        <label htmlFor={name}>
          {label}
          {!required && <span>Optional</span>}
        </label>
        {options ? (
          <select
            id={name}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!errors[name]}
          >
            <option value="" disabled>
              Select an option
            </option>
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        ) : type === "textarea" ? (
          <textarea
            id={name}
            value={value}
            maxLength={2000}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
          />
        ) : (
          <input
            id={name}
            type={type}
            value={value}
            min={
              type === "date"
                ? new Date().toISOString().slice(0, 10)
                : type === "number"
                  ? "1"
                  : undefined
            }
            maxLength={name === "eventName" ? 120 : 160}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!errors[name]}
            aria-describedby={errors[name] ? `${name}-error` : undefined}
          />
        )}
        {errors[name] && (
          <small role="alert" id={`${name}-error`}>
            {errors[name]}
          </small>
        )}
      </div>
    );
  }
  const cat = categories.find((c) => c.id === data.category)!;
  return (
    <>
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brandmark">
            g<span>p</span>
          </span>
          GoPratle<span className="branddot">.</span>
        </a>
        <span className="topnote">Good events start here.</span>
        <span className="private">
          <ShieldCheck size={15} /> Assignment preview
        </span>
      </header>
      <main className="shell">
        <aside>
          <p className="eyebrow">FOR YOUR NEXT BIG MOMENT</p>
          <h1>
            Make it
            <br />
            <em>an occasion.</em>
          </h1>
          <p className="asidecopy">
            Tell us what you have in mind.
            <br />
            Let's get the right people around it.
          </p>
          <nav className="steps" aria-label="Form progress">
            {steps.map((s, i) => (
              <button
                type="button"
                key={s}
                disabled={i > step || !!receipt}
                aria-current={i === step ? "step" : undefined}
                onClick={() => {
                  setStep(i);
                  setErrors({});
                }}
                className={i === step ? "active" : i < step ? "done" : ""}
              >
                <span className="stepnumber">
                  {i < step || receipt ? (
                    <Check size={15} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span>{s}</span>
                {i === step && !receipt && <ChevronRight size={15} />}
              </button>
            ))}
          </nav>
          <div className="asidefooter">
            <span className="tinyline" />
            <p>
              A clear brief.
              <br />A better beginning.
            </p>
            <p className="caption">
              No personal contact details needed.
              <br />
              Draft stays in this browser tab.
            </p>
          </div>
        </aside>
        <section className="workspace">
          {receipt ? (
            <div className="success">
              <CheckCircle2 size={50} strokeWidth={1.4} />
              <p className="eyebrow">SAVED TO MONGODB</p>
              <h2>Your brief is in.</h2>
              <p>
                Your {receipt.category} requirement has been saved.
                <br />
                This is an assignment demo, not a marketplace booking.
              </p>
              <div className="receipt">
                <span>Request reference</span>
                <code>{receipt.id}</code>
              </div>
              <button
                className="primary"
                onClick={() => {
                  setV(blank());
                  setReceipt(null);
                  setStep(0);
                  setErrors({});
                }}
              >
                Create another requirement <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="workspacehead">
                <span className="eyebrow">NEW REQUIREMENT</span>
                <span className="draft">
                  <span />
                  {saved ? "Draft saved in this tab" : "Draft not saved"}
                </span>
              </div>
              <div className="mobileprogress">
                Step {step + 1} of 4 · {steps[step]}
              </div>
              <div className="heading">
                <p className="stepcaption">
                  STEP {String(step + 1).padStart(2, "0")} / 04
                </p>
                <h2>
                  {
                    [
                      "First, set the scene.",
                      "Who do you need?",
                      "A little more detail.",
                      "Looking good?",
                    ][step]
                  }
                </h2>
                <p>
                  {
                    [
                      "A few essentials to get your event off the ground.",
                      "Help us understand the people and services you need.",
                      "Set expectations so the right professionals can say yes.",
                      "Check your brief before saving it to the backend.",
                    ][step]
                  }
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  step === 3 ? submit() : goNext();
                }}
                noValidate
              >
                <div className="formbody" key={step}>
                  {step === 0 && (
                    <>
                      <div className="formgrid">
                        {Field({
                          name: "eventName",
                          label: "What are we celebrating?",
                          wide: true,
                        })}
                        {Field({
                          name: "eventType",
                          label: "Event type",
                          options: [
                            "Wedding",
                            "Corporate",
                            "Private party",
                            "Concert",
                            "Community",
                            "Other",
                          ],
                        })}
                        {Field({ name: "location", label: "City / location" })}
                        {Field({
                          name: "startDate",
                          label: "Start date",
                          type: "date",
                        })}
                        {Field({
                          name: "endDate",
                          label: "End date",
                          type: "date",
                        })}
                        {Field({
                          name: "venue",
                          label: "Venue name",
                          required: false,
                          wide: true,
                        })}
                      </div>
                      <div className="categoryhead">
                        <h3>Who are you looking for?</h3>
                        <p>Choose one category for this requirement.</p>
                      </div>
                      <div
                        className="categories"
                        role="group"
                        aria-label="Professional category"
                      >
                        {categories.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={data.category === c.id}
                            className={
                              data.category === c.id
                                ? "category selected"
                                : "category"
                            }
                            onClick={() => {
                              setV({ ...data, category: c.id, details: {} });
                              setErrors({});
                            }}
                          >
                            <c.icon size={22} strokeWidth={1.5} />
                            <strong>{c.title}</strong>
                            <span>{c.sub}</span>
                            <i>
                              {data.category === c.id && <Check size={11} />}
                            </i>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {step === 1 && (
                    <>
                      <div className="selectedbanner">
                        <cat.icon size={21} />
                        <div>
                          <strong>{cat.title}</strong>
                          <span>Requirements tailored to your category</span>
                        </div>
                        <button type="button" onClick={() => setStep(0)}>
                          Change
                        </button>
                      </div>
                      <div className="formgrid">
                        {data.category === "planner" ? (
                          <>
                            {Field({
                              name: "service",
                              label: "Planning support",
                              options: [
                                "Full event planning",
                                "On-the-day coordination",
                                "Design and styling",
                                "Vendor coordination",
                              ],
                            })}
                            {Field({
                              name: "guests",
                              label: "Expected guests",
                              type: "number",
                            })}
                          </>
                        ) : data.category === "performer" ? (
                          <>
                            {Field({
                              name: "act",
                              label: "Performance type",
                              options: [
                                "Live band",
                                "DJ",
                                "Singer",
                                "Dancer",
                                "Host / emcee",
                                "Other act",
                              ],
                            })}
                            {Field({
                              name: "audience",
                              label: "Expected audience",
                              type: "number",
                            })}
                          </>
                        ) : (
                          <>
                            {Field({
                              name: "department",
                              label: "Crew department",
                              options: [
                                "Production",
                                "Sound and lighting",
                                "Hospitality",
                                "Setup and logistics",
                                "Photography / video",
                                "Other crew",
                              ],
                            })}
                            {Field({
                              name: "count",
                              label: "Number of crew members",
                              type: "number",
                            })}
                          </>
                        )}
                      </div>
                      <div className="notebox">
                        <ShieldCheck size={19} />
                        <p>
                          These category fields are design assumptions for this
                          assignment. GoPratle's brief did not specify the exact
                          questions.
                        </p>
                      </div>
                    </>
                  )}
                  {step === 2 && (
                    <div className="formgrid">
                      {data.category === "planner"
                        ? Field({
                            name: "style",
                            label: "Event style",
                            options: [
                              "Minimal and intimate",
                              "Classic and elegant",
                              "Bold and festive",
                              "Contemporary",
                              "Open to ideas",
                            ],
                          })
                        : data.category === "performer"
                          ? Field({
                              name: "duration",
                              label: "Performance duration (minutes)",
                              type: "number",
                            })
                          : Field({
                              name: "hours",
                              label: "Shift length (hours, 1-24)",
                              type: "number",
                            })}
                      {Field({
                        name: "budget",
                        label: "Total category budget (INR)",
                        type: "number",
                      })}
                      {Field({
                        name: "notes",
                        label: "Anything else we should know?",
                        type: "textarea",
                        required: false,
                        wide: true,
                      })}
                      <p className="helper wide">
                        Use sample details for this demo. Don't include phone
                        numbers, email addresses or other sensitive information.
                      </p>
                    </div>
                  )}
                  {step === 3 && (
                    <>
                      <div className="reviewhero">
                        <span className="pill">{cat.title}</span>
                        <h3>{data.eventName}</h3>
                        <p>
                          <CalendarDays size={15} />
                          {data.startDate}
                          {data.endDate !== data.startDate
                            ? ` to ${data.endDate}`
                            : ""}
                        </p>
                        <p>
                          <MapPin size={15} />
                          {data.location}
                          {data.venue ? ` · ${data.venue}` : ""}
                        </p>
                      </div>
                      <dl className="reviewlist">
                        <div>
                          <dt>Event type</dt>
                          <dd>{data.eventType}</dd>
                        </div>
                        {Object.entries(data.details)
                          .filter(([, val]) => val)
                          .map(([key, val]) => (
                            <div key={key}>
                              <dt>
                                {{
                                  service: "Planning support",
                                  guests: "Expected guests",
                                  style: "Event style",
                                  act: "Performance",
                                  audience: "Audience",
                                  duration: "Duration (minutes)",
                                  department: "Department",
                                  count: "Crew members",
                                  hours: "Shift (hours)",
                                  budget: "Budget (INR)",
                                  notes: "Notes",
                                }[key] || key}
                              </dt>
                              <dd>
                                {key === "budget"
                                  ? `₹${Number(val).toLocaleString("en-IN")}`
                                  : val}
                              </dd>
                            </div>
                          ))}
                      </dl>
                      <div className="notebox">
                        <ShieldCheck size={19} />
                        <p>
                          Submitting saves a requirement only. It does not book
                          a professional or make a payment.
                        </p>
                      </div>
                    </>
                  )}
                  {errors.submit && (
                    <div className="errorbox" role="alert">
                      {errors.submit}
                      {Object.entries(errors)
                        .filter(([k]) => k !== "submit")
                        .map(([k, msg]) => (
                          <p key={k}>
                            {k}: {msg}
                          </p>
                        ))}
                    </div>
                  )}
                </div>
                <footer className="formfooter">
                  {step > 0 ? (
                    <button
                      type="button"
                      className="back"
                      disabled={busy}
                      onClick={() => {
                        setStep(step - 1);
                        setErrors({});
                      }}
                    >
                      <ArrowLeft size={16} /> Back
                    </button>
                  ) : (
                    <span className="footnote">
                      About 3 minutes. All fields required unless marked.
                    </span>
                  )}
                  <button className="primary" type="submit" disabled={busy}>
                    {busy
                      ? "Saving requirement..."
                      : step === 3
                        ? "Submit requirement"
                        : "Continue"}
                    {!busy && <ArrowRight size={16} />}
                  </button>
                </footer>
              </form>
            </>
          )}
        </section>
      </main>
      <footer className="bottomline">
        <span>GoPratle · Requirement posting flow</span>
        <span>Built for a better brief.</span>
      </footer>
    </>
  );
    }
