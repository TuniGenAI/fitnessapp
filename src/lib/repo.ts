/**
 * Generic table access shared by every feature's `api.ts`.
 *
 * One thin layer over the two backends:
 *   • signed in  → Supabase (RLS scopes rows to the user automatically)
 *   • demo mode  → the local store in `localDb.ts`
 *
 * Feature code stays backend-agnostic and keeps its own types via the generic
 * `T`; the `as never` casts here only bridge Supabase's strict per-table typing
 * through a generic table name (queries and results are still correct at runtime).
 */
import { supabase } from "./supabase";
import { usingBackend } from "./session";
import { localDb } from "./localDb";
import type { Database } from "@/types/database";

type TableName = keyof Database["public"]["Tables"];
type Filter = Record<string, unknown>;
export interface Order {
  column: string;
  ascending?: boolean;
}

function sortRows<T>(rows: T[], order?: Order): T[] {
  if (!order) return rows;
  const { column, ascending = true } = order;
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[column] as string | number | null;
    const bv = (b as Record<string, unknown>)[column] as string | number | null;
    if (av === bv) return 0;
    if (av == null) return ascending ? -1 : 1;
    if (bv == null) return ascending ? 1 : -1;
    const cmp = av < bv ? -1 : 1;
    return ascending ? cmp : -cmp;
  });
}

/** Select rows by equality filter, optionally ordered. */
export async function selectRows<T>(
  table: TableName,
  filter: Filter = {},
  order?: Order,
): Promise<T[]> {
  if (usingBackend()) {
    let q = supabase!.from(table).select("*").match(filter as never);
    if (order) q = q.order(order.column as never, { ascending: order.ascending ?? true });
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as T[];
  }
  return sortRows(localDb.select<never>(table, filter) as T[], order);
}

/** Insert one row and return it. */
export async function insertRow<T>(table: TableName, row: unknown): Promise<T> {
  if (usingBackend()) {
    const { data, error } = await supabase!
      .from(table)
      .insert(row as never)
      .select()
      .single();
    if (error) throw error;
    return data as T;
  }
  return localDb.insert<never>(table, row as never) as T;
}

/**
 * Insert or update one row, idempotent on its primary key, and return it. Pass a
 * client-generated `id` so the same call run twice (e.g. via `retry` after a
 * dropped response) collapses to one row instead of creating a duplicate.
 */
export async function upsertRow<T>(table: TableName, row: unknown): Promise<T> {
  if (usingBackend()) {
    const { data, error } = await supabase!
      .from(table)
      .upsert(row as never)
      .select()
      .single();
    if (error) throw error;
    return data as T;
  }
  const r = row as { id?: string };
  if (r.id && localDb.select<never>(table, { id: r.id } as never).length > 0) {
    return localDb.update<never>(table, r.id, row as never) as T;
  }
  return localDb.insert<never>(table, row as never) as T;
}

/** Insert many rows and return them. */
export async function insertRows<T>(table: TableName, rows: unknown[]): Promise<T[]> {
  if (rows.length === 0) return [];
  if (usingBackend()) {
    const { data, error } = await supabase!
      .from(table)
      .insert(rows as never)
      .select();
    if (error) throw error;
    return (data ?? []) as T[];
  }
  return rows.map((r) => localDb.insert<never>(table, r as never) as T);
}

/** Patch a row by id and return the updated row. */
export async function updateRow<T>(
  table: TableName,
  id: string,
  patch: unknown,
): Promise<T> {
  if (usingBackend()) {
    const { data, error } = await supabase!
      .from(table)
      .update(patch as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as T;
  }
  return localDb.update<never>(table, id, patch as never) as T;
}

/** Delete rows matching a filter. */
export async function deleteWhere(table: TableName, filter: Filter): Promise<void> {
  if (usingBackend()) {
    const { error } = await supabase!.from(table).delete().match(filter as never);
    if (error) throw error;
    return;
  }
  localDb.delete(table, filter);
}
