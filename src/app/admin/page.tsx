"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EventData } from "@/types";
import EventWizard from "./EventWizard";

export default function AdminPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const response = await fetch("/api/event", { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as {
          events?: EventData[];
          error?: string;
        } | null;

        if (response.status === 401) {
          window.location.assign("/login?redirect=/admin");
          return;
        }
        if (!response.ok) {
          throw new Error(result?.error || "Unable to load events");
        }
        if (!cancelled) setEvents(result?.events ?? []);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Unable to load events",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return events;
    return events.filter(
      (event) =>
        event.event_name.toLowerCase().includes(query) ||
        event.db_name.toLowerCase().includes(query) ||
        event.id.toLowerCase().includes(query),
    );
  }, [events, search]);

  function openNewEvent() {
    setSelectedEvent(null);
    setWizardOpen(true);
  }

  function openExistingEvent(event: EventData) {
    setSelectedEvent(event);
    setWizardOpen(true);
  }

  function handleSaved(savedEvent: EventData) {
    setSelectedEvent(savedEvent);
    setEvents((current) => {
      const exists = current.some((event) => event.id === savedEvent.id);
      return exists
        ? current.map((event) =>
            event.id === savedEvent.id ? savedEvent : event,
          )
        : [savedEvent, ...current];
    });
  }

  return (
    <main className="dark min-h-screen bg-[#070b12] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      {wizardOpen ? (
        <EventWizard
          event={selectedEvent}
          onCancel={() => setWizardOpen(false)}
          onSaved={handleSaved}
        />
      ) : (
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
                BWM Attendance
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Event administration
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Create events, reconnect Google Sheets, select scanner fields, and
                generate QR formulas from one guided setup.
              </p>
            </div>
            <Button type="button" size="lg" onClick={openNewEvent}>
              <Plus /> New event
            </Button>
          </header>

          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
              <Input
                className="border-slate-700 bg-slate-950 pl-9 text-slate-100 placeholder:text-slate-600"
                value={search}
                onChange={(input) => setSearch(input.target.value)}
                placeholder="Search events or UUID..."
              />
            </div>
            <p className="text-sm text-slate-500">
              {visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"}
            </p>
          </div>

          {isLoading ? (
            <div className="flex min-h-80 items-center justify-center text-slate-500">
              <Loader2 className="mr-2 animate-spin" /> Loading events...
            </div>
          ) : visibleEvents.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-800 p-12 text-center text-slate-500">
              No events found.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {visibleEvents.map((event) => (
                <article
                  key={event.id}
                  className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-slate-700 hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-white">
                        {event.event_name}
                      </h2>
                      <p className="mt-1 truncate font-mono text-xs text-slate-600">
                        {event.id}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-400">
                      {event.db_name}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {new Intl.DateTimeFormat("en-SG", {
                        dateStyle: "medium",
                      }).format(new Date(event.created_at))}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FileSpreadsheet className="size-3.5" />
                      {event.attendance_name}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openExistingEvent(event)}
                    >
                      <Settings2 /> Manage & formulas
                    </Button>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a href={`/${event.id}`} target="_blank" rel="noreferrer">
                        Scanner <ExternalLink />
                      </a>
                    </Button>
                    <Button type="button" variant="ghost" size="sm" asChild>
                      <a
                        href={event.sheet_link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Sheet <ExternalLink />
                      </a>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
