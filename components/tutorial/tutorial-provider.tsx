"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  LOGIN_STEPS,
  TRACK_STEPS,
  type TourStep,
  type TutorialTrack,
} from "@/lib/tutorial-steps";

const STORAGE_KEY = "historai:tutorial:v1";

interface TutorialPrefs {
  welcomeSeen: boolean;
  pendingTour: boolean;
  completed: Partial<Record<TutorialTrack, boolean>>;
}

const DEFAULT_PREFS: TutorialPrefs = {
  welcomeSeen: false,
  pendingTour: false,
  completed: {},
};

type TourKind = "login" | TutorialTrack;
type TourMode = "welcome" | "tour" | null;

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialContextValue {
  replay: () => void;
}

const TutorialContext = createContext<TutorialContextValue>({ replay: () => {} });

export function useTutorial(): TutorialContextValue {
  return useContext(TutorialContext);
}

function loadPrefs(): TutorialPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<TutorialPrefs> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_PREFS;
    return {
      welcomeSeen: parsed.welcomeSeen === true,
      pendingTour: parsed.pendingTour === true,
      completed:
        parsed.completed && typeof parsed.completed === "object"
          ? parsed.completed
          : {},
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: TutorialPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // A blocked storage area only means the tour may appear again.
  }
}

function stepsFor(kind: TourKind): readonly TourStep[] {
  return kind === "login" ? LOGIN_STEPS : TRACK_STEPS[kind];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function TutorialProvider({
  track,
  children,
}: {
  track: TutorialTrack | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [prefs, setPrefs] = useState<TutorialPrefs | null>(null);
  const [mode, setMode] = useState<TourMode>(null);
  const [tourKind, setTourKind] = useState<TourKind>("login");
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [viewport, setViewport] = useState({ width: 1024, height: 768 });
  const [cardHeight, setCardHeight] = useState(260);
  const wantLoginTour = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(() => stepsFor(tourKind), [tourKind]);
  const step = mode === "tour" ? steps[stepIndex] ?? null : null;

  const remember = useCallback((next: TutorialPrefs) => {
    setPrefs(next);
    savePrefs(next);
  }, []);

  const beginTour = useCallback((kind: TourKind) => {
    setTourKind(kind);
    setStepIndex(0);
    setSpotlight(null);
    setWaiting(false);
    setMode("tour");
  }, []);

  const skipWelcome = useCallback(() => {
    setPrefs((current) => {
      const next = {
        ...(current ?? DEFAULT_PREFS),
        welcomeSeen: true,
        pendingTour: false,
      };
      savePrefs(next);
      return next;
    });
    setMode(null);
  }, []);

  const skipTour = useCallback(() => {
    setPrefs((current) => {
      const base = current ?? DEFAULT_PREFS;
      const next: TutorialPrefs = {
        ...base,
        welcomeSeen: true,
        pendingTour: false,
        completed:
          tourKind === "login"
            ? base.completed
            : { ...base.completed, [tourKind]: true },
      };
      savePrefs(next);
      return next;
    });
    setMode(null);
    setSpotlight(null);
  }, [tourKind]);

  const finishTour = useCallback(() => {
    setPrefs((current) => {
      const base = current ?? DEFAULT_PREFS;
      const next: TutorialPrefs = {
        ...base,
        welcomeSeen: true,
        pendingTour: tourKind !== "login",
        completed:
          tourKind === "login"
            ? base.completed
            : { ...base.completed, [tourKind]: true },
      };
      if (tourKind === "login") next.pendingTour = true;
      savePrefs(next);
      return next;
    });
    setMode(null);
    setSpotlight(null);
  }, [tourKind]);

  const startWelcomeTour = useCallback(() => {
    remember({
      ...(prefs ?? DEFAULT_PREFS),
      welcomeSeen: true,
      pendingTour: true,
    });

    if (track) {
      beginTour(track);
      return;
    }
    if (pathname === "/login") {
      beginTour("login");
      return;
    }
    wantLoginTour.current = true;
    setMode(null);
    router.push("/login");
  }, [beginTour, pathname, prefs, remember, router, track]);

  const replay = useCallback(() => {
    if (track) {
      beginTour(track);
      return;
    }
    if (pathname === "/login") {
      beginTour("login");
      return;
    }
    wantLoginTour.current = true;
    router.push("/login");
  }, [beginTour, pathname, router, track]);

  // Load saved state and start tracking the viewport after hydration.
  useEffect(() => {
    setPrefs(loadPrefs());
    setViewport({ width: window.innerWidth, height: window.innerHeight });
  }, []);

  // Resume a pre-sign-in tour after navigating to /login.
  useEffect(() => {
    if (!wantLoginTour.current || pathname !== "/login") return;
    wantLoginTour.current = false;
    beginTour("login");
  }, [beginTour, pathname]);

  // Show the welcome once, then continue with the role-specific tour.
  useEffect(() => {
    if (!prefs || mode !== null) return;
    if (!prefs.welcomeSeen) {
      if (pathname === "/onboarding") return;
      setMode("welcome");
      return;
    }
    if (
      prefs.pendingTour &&
      track &&
      !prefs.completed[track] &&
      pathname !== "/login" &&
      pathname !== "/onboarding"
    ) {
      remember({
        ...prefs,
        pendingTour: false,
        completed: { ...prefs.completed, [track]: true },
      });
      beginTour(track);
    }
  }, [beginTour, mode, pathname, prefs, remember, track]);

  // If someone clicks a highlighted login control, let the tour continue inside
  // the site instead of blocking the navigation.
  useEffect(() => {
    if (mode !== "tour" || tourKind !== "login" || pathname === "/login") return;
    setPrefs((current) => {
      if (!current) return current;
      const next: TutorialPrefs = {
        ...current,
        welcomeSeen: true,
        pendingTour: true,
      };
      savePrefs(next);
      return next;
    });
    setMode(null);
    setSpotlight(null);
  }, [mode, pathname, tourKind]);

  // Find the current target, scroll it into view, and keep the highlight in
  // sync while the page scrolls or resizes.
  useEffect(() => {
    if (mode !== "tour" || !step) {
      setSpotlight(null);
      return;
    }

    const currentUrl = window.location.pathname + window.location.search;
    if (step.path && currentUrl !== step.path) {
      setWaiting(true);
      setSpotlight(null);
      router.push(step.path);
      return;
    }

    setWaiting(false);
    let disposed = false;
    let attempts = 0;
    const timers: number[] = [];

    const later = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(callback, delay);
      timers.push(timer);
    };

    const measure = () => {
      if (disposed || !step.target) return;
      const element = document.querySelector<HTMLElement>(step.target);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      setSpotlight({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    const locate = () => {
      if (disposed) return;
      if (!step.target) {
        setSpotlight(null);
        return;
      }
      const element = document.querySelector<HTMLElement>(step.target);
      if (element) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        element.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: reduced ? "auto" : "smooth",
        });
        later(measure, reduced ? 0 : 360);
        return;
      }
      attempts += 1;
      if (attempts < 40) {
        later(locate, 150);
        return;
      }
      setSpotlight(null);
    };

    locate();

    const onViewportChange = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      measure();
    };
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", measure, { passive: true });

    return () => {
      disposed = true;
      for (const timer of timers) window.clearTimeout(timer);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", measure);
    };
  }, [mode, routeKey, router, step]);

  // Move focus into each card and let Escape dismiss the tour.
  useEffect(() => {
    if (!mode) return;
    const focusTimer = window.setTimeout(() => cardRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (mode === "welcome") skipWelcome();
      else skipTour();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mode, skipTour, skipWelcome, stepIndex]);

  // Measure the card content so placement never pushes it off-screen.
  useLayoutEffect(() => {
    if (!mode) return;
    const element = cardRef.current;
    if (!element) return;
    const height = Math.min(element.scrollHeight, window.innerHeight - 32);
    setCardHeight((current) => (Math.abs(current - height) > 1 ? height : current));
  }, [mode, step, stepIndex, viewport.height, viewport.width]);

  const contextValue = useMemo(() => ({ replay }), [replay]);

  const total = steps.length;
  const isLast = stepIndex >= total - 1;

  // Read the live viewport while a tour is open so a stale initial size cannot
  // push the card off-screen or over the highlighted control.
  const viewportWidth =
    mode && typeof window !== "undefined" ? window.innerWidth : viewport.width;
  const viewportHeight =
    mode && typeof window !== "undefined" ? window.innerHeight : viewport.height;
  const pad = 8;
  const hole = spotlight
    ? {
        top: Math.max(0, spotlight.top - pad),
        left: Math.max(0, spotlight.left - pad),
        right: Math.min(viewportWidth, spotlight.left + spotlight.width + pad),
        bottom: Math.min(viewportHeight, spotlight.top + spotlight.height + pad),
      }
    : null;
  const holeWidth = hole ? Math.max(0, hole.right - hole.left) : 0;
  const holeHeight = hole ? Math.max(0, hole.bottom - hole.top) : 0;
  const isMobile = viewportWidth < 640;
  const cardWidth = Math.min(384, viewportWidth - 32);

  let cardClass =
    "fixed left-1/2 top-1/2 z-[82] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/70 bg-white/95 shadow-2xl backdrop-blur";
  let cardStyle: CSSProperties = { width: cardWidth, maxHeight: "calc(100vh - 2rem)" };

  if (hole) {
    if (isMobile) {
      cardClass =
        "fixed inset-x-4 bottom-4 z-[82] rounded-2xl border border-white/70 bg-white/95 shadow-2xl backdrop-blur";
      cardStyle = { maxHeight: "70vh" };
    } else {
      const spaceRight = viewportWidth - hole.right;
      const spaceLeft = hole.left;
      const spaceBelow = viewportHeight - hole.bottom;
      const spaceAbove = hole.top;
      const sideBySide = cardWidth + 24;

      let top: number;
      let left: number;

      if (spaceRight >= sideBySide) {
        left = hole.right + 16;
        top = clamp(hole.top, 16, viewportHeight - cardHeight - 16);
      } else if (spaceLeft >= sideBySide) {
        left = hole.left - cardWidth - 16;
        top = clamp(hole.top, 16, viewportHeight - cardHeight - 16);
      } else if (spaceBelow >= cardHeight + 24) {
        left = clamp(hole.left, 16, viewportWidth - cardWidth - 16);
        top = hole.bottom + 16;
      } else if (spaceAbove >= cardHeight + 24) {
        left = clamp(hole.left, 16, viewportWidth - cardWidth - 16);
        top = hole.top - cardHeight - 16;
      } else {
        left = clamp(hole.left, 16, viewportWidth - cardWidth - 16);
        top = clamp(hole.bottom + 16, 16, viewportHeight - cardHeight - 16);
      }

      cardClass =
        "fixed z-[82] rounded-2xl border border-white/70 bg-white/95 shadow-2xl backdrop-blur";
      cardStyle = {
        top,
        left,
        width: cardWidth,
        maxHeight: Math.max(180, viewportHeight - top - 16),
      };
    }
  }

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}

      {mode === "welcome" ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-ocean/70 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-welcome-title"
            tabIndex={-1}
            className="relative w-full max-w-xl rounded-3xl border border-white/70 bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-8"
          >
            <button
              type="button"
              onClick={skipWelcome}
              aria-label="Close the welcome message"
              className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-xl text-xl font-bold text-ink/70 transition hover:bg-seaglass/30 hover:text-ink"
            >
              ✕
            </button>

            <p className="text-sm font-semibold uppercase tracking-wide text-brand">
              Welcome to HistorAI
            </p>
            <h2
              id="tour-welcome-title"
              className="mt-2 pr-10 text-3xl font-bold tracking-tight text-ink"
            >
              A quick look around?
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-ink/80">
              HistorAI connects younger Drops with older Rivers. We will point out the
              important parts of the site in about a minute.
            </p>

            <ul className="mt-5 space-y-2 text-lg text-ink/80">
              <li className="flex gap-3">
                <span aria-hidden="true">🌊</span>
                <span>Create a profile as a River or a Drop — no password needed.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true">🎙️</span>
                <span>Find out how to ask, answer, record, and review a story.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true">💬</span>
                <span>See how to read stories and search for a memory.</span>
              </li>
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={startWelcomeTour}>
                Show me around
              </Button>
              <Button size="lg" variant="secondary" onClick={skipWelcome}>
                Skip for now
              </Button>
            </div>
            <p className="mt-3 text-base text-ink/70">
              You can replay the tour later from the Help page.
            </p>
          </div>
        </div>
      ) : null}

      {mode === "tour" && step ? (
        <div aria-live="polite">
          {hole ? (
            <>
              <div
                aria-hidden="true"
                className="fixed z-[80] bg-ocean/70"
                style={{ top: 0, left: 0, right: 0, height: hole.top }}
              />
              <div
                aria-hidden="true"
                className="fixed z-[80] bg-ocean/70"
                style={{ top: hole.bottom, left: 0, right: 0, bottom: 0 }}
              />
              <div
                aria-hidden="true"
                className="fixed z-[80] bg-ocean/70"
                style={{
                  top: hole.top,
                  left: 0,
                  width: hole.left,
                  height: holeHeight,
                }}
              />
              <div
                aria-hidden="true"
                className="fixed z-[80] bg-ocean/70"
                style={{
                  top: hole.top,
                  left: hole.right,
                  right: 0,
                  height: holeHeight,
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none fixed z-[81] rounded-2xl"
                style={{
                  top: hole.top,
                  left: hole.left,
                  width: holeWidth,
                  height: holeHeight,
                  boxShadow:
                    "0 0 0 3px #e3a23c, 0 0 0 9px rgba(227,162,60,0.30), 0 0 36px rgba(227,162,60,0.45)",
                }}
              />
            </>
          ) : (
            <div aria-hidden="true" className="fixed inset-0 z-[80] bg-ocean/70" />
          )}

          <div
            ref={cardRef}
            role="dialog"
            aria-labelledby="tour-step-title"
            aria-describedby="tour-step-body"
            tabIndex={-1}
            className={cn("overflow-y-auto p-5 outline-none", cardClass)}
            style={cardStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand">
                Step {stepIndex + 1} of {total}
              </p>
              <button
                type="button"
                onClick={skipTour}
                aria-label="Skip the tour"
                className="ripple grid h-9 w-9 place-items-center rounded-lg text-lg font-bold text-ink/70 hover:bg-seaglass/30 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <h2 id="tour-step-title" className="mt-1 text-2xl font-bold leading-snug text-ink">
              {step.title}
            </h2>
            <p id="tour-step-body" className="mt-2 text-lg leading-relaxed text-ink/80">
              {step.body}
            </p>

            {waiting ? (
              <p className="mt-3 text-base font-medium text-brand" role="status">
                Taking you there…
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="secondary"
                onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
                disabled={stepIndex === 0}
              >
                Back
              </Button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={skipTour}
                  className="rounded-lg px-2 py-1 text-base font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline"
                >
                  Skip
                </button>
                <Button
                  onClick={() =>
                    isLast ? finishTour() : setStepIndex((index) => index + 1)
                  }
                >
                  {isLast ? "Finish" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </TutorialContext.Provider>
  );
}