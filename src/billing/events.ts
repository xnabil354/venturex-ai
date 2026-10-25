import "server-only";

import { Client } from "pg";

import { getServerEnv } from "@/lib/env";

const CHANNEL = "venturex_billing_changed";
type Listener = (event: "ready" | "changed" | "unavailable") => void;

class BillingEventHub {
  private readonly listeners = new Map<string, Set<Listener>>();
  private client: Client | null = null;
  private connecting = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 1_000;

  private broadcast(event: "ready" | "unavailable"): void {
    for (const listeners of this.listeners.values()) for (const listener of listeners) listener(event);
  }

  private scheduleRetry(): void {
    if (this.listeners.size === 0 || this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      void this.connect();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
  }

  subscribe(userId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(userId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(userId, listeners);
    if (this.client) listener("ready");
    else {
      if (this.retry) listener("unavailable");
      void this.connect();
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(userId);
    };
  }

  private async connect(): Promise<void> {
    if (this.client || this.connecting || this.retry || this.listeners.size === 0) return;
    this.connecting = true;
    let client: Client;
    try {
      client = new Client({ connectionString: getServerEnv().DATABASE_URL });
    } catch (error) {
      this.connecting = false;
      console.error("venturex_billing_event_listener_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
      this.broadcast("unavailable");
      this.scheduleRetry();
      return;
    }
    const disconnected = () => {
      if (this.client !== client) return;
      this.client = null;
      void client.end().catch(() => {});
      this.broadcast("unavailable");
      this.scheduleRetry();
    };
    client.on("error", disconnected);
    client.on("end", disconnected);
    client.on("notification", (message) => {
      if (message.channel !== CHANNEL || !message.payload) return;
      for (const listener of this.listeners.get(message.payload) ?? []) listener("changed");
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      this.client = client;
      this.retryDelay = 1_000;
      this.broadcast("ready");
    } catch (error) {
      console.error("venturex_billing_event_listener_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
      void client.end().catch(() => {});
      this.broadcast("unavailable");
      this.scheduleRetry();
    } finally {
      this.connecting = false;
    }
  }
}

declare global {
  var __venturexBillingEventHub: BillingEventHub | undefined;
}

export function subscribeBillingEvents(userId: string, listener: Listener): () => void {
  globalThis.__venturexBillingEventHub ??= new BillingEventHub();
  return globalThis.__venturexBillingEventHub.subscribe(userId, listener);
}

export const BILLING_EVENT_CHANNEL = CHANNEL;
