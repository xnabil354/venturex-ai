"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingSkeleton,
  PageContainer,
  RiskBadge,
  ScoreIndicator,
  Select,
  Tabs,
} from "@/components/ui";

const colorTokens = [
  { className: "bg-warm-parchment", name: "Warm parchment", token: "canvas", value: "#f2f0eb" },
  { className: "bg-paper-white", name: "Paper white", token: "card", value: "#ffffff" },
  { className: "bg-midnight-wine", name: "Midnight wine", token: "primary", value: "#421d24" },
  { className: "bg-lilac-mist", name: "Lilac mist", token: "secondary", value: "#d4c7ff" },
  { className: "bg-royal-violet", name: "Royal violet", token: "link", value: "#714cb6" },
  { className: "bg-ink-charcoal", name: "Ink charcoal", token: "text", value: "#292827" },
] as const;

const selectOptions = [
  { label: "Choose a surface", value: "", disabled: true },
  { label: "Warm parchment", value: "parchment" },
  { label: "Paper white", value: "paper" },
];

export function FoundationSpecimen() {
  const [emptyActioned, setEmptyActioned] = useState(false);
  const [formMessage, setFormMessage] = useState("No submission yet.");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("Native form submission captured by the specimen.");
  }

  return (
    <PageContainer className="py-32 sm:py-48 lg:py-64">
      <header className="max-w-[760px]">
        <p className="text-caption font-w540 text-royal-violet">
          VENTUREX Design System Foundation
        </p>
        <h1 className="mt-16 max-w-[12ch] text-balance text-heading-lg font-w460 leading-heading-lg tracking-heading-lg text-ink-charcoal sm:text-display sm:leading-display sm:tracking-display">
          Warm editorial software primitives.
        </h1>
        <p className="mt-16 max-w-[60ch] text-body leading-body text-stone-gray">
          A light-only foundation for decision-support surfaces, built around parchment canvas, paper cards, restrained color, and clear states.
        </p>
      </header>

      <section aria-labelledby="tokens-heading" className="mt-48 grid gap-24 lg:mt-64 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="grid gap-24">
          <div className="grid gap-8">
            <p className="text-caption font-w540 text-royal-violet">Token cues</p>
            <h2 className="text-balance text-heading-sm font-w460 tracking-heading-sm" id="tokens-heading">Quiet surfaces, deliberate accents.</h2>
            <p className="max-w-[54ch] text-body-sm text-stone-gray">
              The token set keeps most surfaces neutral. Wine carries primary action, violet carries links and focus, and lilac marks secondary emphasis.
            </p>
          </div>
          <div className="grid gap-12 sm:grid-cols-2">
            {colorTokens.map((color) => (
              <div className="grid grid-cols-[40px_1fr] items-center gap-12" key={color.token}>
                <span aria-hidden="true" className={`h-40 w-40 rounded-small-buttons border border-soft-mist ${color.className}`} />
                <div className="grid gap-4">
                  <span className="text-body-sm font-w540">{color.name}</span>
                  <span className="text-caption text-stone-gray">{color.token} · {color.value}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="grid gap-24">
          <div className="grid gap-8">
            <p className="text-caption font-w540 text-royal-violet">Type scale</p>
            <h2 className="text-balance text-heading-sm font-w460 tracking-heading-sm">One sans voice, many useful weights.</h2>
          </div>
          <div className="grid gap-20">
            <p className="text-display font-w460 leading-display tracking-display">Display</p>
            <p className="text-heading-lg font-w460 leading-heading-lg tracking-heading-lg">Heading large</p>
            <p className="text-heading-sm font-w460 leading-heading-sm tracking-heading-sm">Heading small</p>
            <p className="text-body leading-body">Body copy stays readable and left aligned.</p>
            <p className="text-caption text-stone-gray">Caption text stays quiet and useful.</p>
          </div>
        </Card>
      </section>

      <section aria-labelledby="components-heading" className="mt-48 border-t border-soft-mist pt-24 sm:mt-64 sm:pt-48">
        <div className="grid gap-8">
          <p className="text-caption font-w540 text-royal-violet">Reusable components</p>
          <h2 className="text-balance text-heading-sm font-w460 tracking-heading-sm" id="components-heading">States and controls for the first real screens.</h2>
          <p className="max-w-[58ch] text-body-sm text-stone-gray">This page is a specimen only. It does not represent a dashboard or a finished business flow.</p>
        </div>

        <div className="mt-32 grid gap-24 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="grid gap-24">
            <h3 className="text-balance text-label-bold font-w460 leading-label-bold">Tabs and badges</h3>
            <Tabs items={[{ id: "tokens", label: "Tokens" }, { id: "states", label: "States" }]} defaultValue="tokens">
              {(activeValue) => {
                const tabCopy: Record<string, string> = {
                  tokens: "Tokens define the visual language before feature screens exist.",
                  states: "States make loading, empty, error, and incomplete data visible.",
                };
                return tabCopy[activeValue] ?? "Select a foundation section.";
              }}
            </Tabs>
            <div className="flex flex-wrap gap-8">
              <Badge>Neutral</Badge>
              <Badge tone="accent">Link accent</Badge>
              <Badge tone="wash">Selected</Badge>
            </div>
          </Card>

          <Card className="grid gap-24">
            <h3 className="text-balance text-label-bold font-w460 leading-label-bold">Form controls</h3>
            <form className="grid gap-20" onSubmit={handleSubmit}>
              <Input id="foundation-name" label="Decision note" placeholder="Write a short note" required />
              <Select id="foundation-surface" label="Surface" options={selectOptions} required />
              <div className="flex flex-wrap items-center gap-12">
                <Button type="submit">Submit specimen</Button>
                <Button disabled loading variant="secondary">Saving example</Button>
              </div>
              <p aria-live="polite" className="text-body-sm text-stone-gray" role="status">{formMessage}</p>
            </form>
          </Card>
        </div>

        <div className="mt-24 grid gap-24 md:grid-cols-2">
          <Card className="grid gap-24">
            <div className="grid gap-8">
              <h3 className="text-balance text-label-bold font-w460 leading-label-bold">Score and risk</h3>
              <p className="text-caption text-stone-gray">Mock example only. Scores are decision-support indicators, not success probabilities.</p>
            </div>
            <div className="grid gap-24">
              <ScoreIndicator description="Relative attractiveness from available inputs." label="Opportunity Score" score={{ status: "AVAILABLE", value: 82 }} />
              <ScoreIndicator description="Profile data is not complete yet." label="Fit Score" score={{ status: "INSUFFICIENT_DATA", value: null }} />
              <RiskBadge level="MEDIUM" reason="Example reason: competition is still changing." />
            </div>
          </Card>

          <Card className="grid gap-24">
            <h3 className="text-balance text-label-bold font-w460 leading-label-bold">Loading and empty states</h3>
            <div className="grid gap-8">
              <LoadingSkeleton className="h-16 w-3/4" />
              <LoadingSkeleton className="h-12 w-full" />
              <LoadingSkeleton className="h-12 w-5/6" />
            </div>
            <EmptyState
              action={
                <Button onClick={() => setEmptyActioned(true)} variant="ghost">
                  Acknowledge specimen
                </Button>
              }
              description="Use an empty state to explain what is missing and give the user a next action."
              title="Nothing to show yet"
            />
            {emptyActioned ? (
              <p className="text-body-sm text-royal-violet" role="status">
                Empty state action captured.
              </p>
            ) : null}
          </Card>
        </div>
      </section>
    </PageContainer>
  );
}
