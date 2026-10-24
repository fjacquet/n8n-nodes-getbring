// Ports Bring.batch_update_list (bring-api): one change set per list.
import { randomUUID } from 'node:crypto';
import { type BringChange, type BringOperation, buildChange, type ItemInput } from './batch';

export interface ItemRow {
	index: number;
	listUuid: string;
	locale: string;
	input: ItemInput;
	operation: BringOperation;
	translate: boolean;
}

/** Builds every change up front (per-item errors collected) and groups them by list, input order kept. */
export function planBatches(rows: ItemRow[], newUuid: () => string = randomUUID) {
	const batches = new Map<string, { index: number; change: BringChange }[]>();
	const errors: { index: number; error: Error }[] = [];
	for (const r of rows) {
		try {
			const change = buildChange(r.input, r.operation, r.locale, r.translate, newUuid);
			const group = batches.get(r.listUuid) ?? [];
			group.push({ index: r.index, change });
			batches.set(r.listUuid, group);
		} catch (error) {
			errors.push({ index: r.index, error: error as Error });
		}
	}
	return { batches, errors };
}
