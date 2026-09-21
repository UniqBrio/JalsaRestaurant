import { NextResponse } from 'next/server';
import { body, fail, handler, ok } from '@/lib/route';
import { actorFor, currentStaff } from '@/lib/db/auth';
import {
  cancelItem,
  changeQty,
  closeBill,
  completeRequest,
  detachTableFromBill,
  freeTable,
  reassignBillStaff,
  joinTableToBill,
  replyToSuggestion,
  reprintKot,
  printElsewhere,
  retryPrintJob,
  setItemAvailability,
} from '@/lib/db/mutations';
import {
  addCategory,
  deleteExpense,
  issuePin,
  removeStaff,
  setOnDuty,
  setPermissions,
  settleTips,
  joinWaitlist,
  notifyWaitlist,
  seatWaitlist,
  removeFromWaitlist,
  upsertExpense,
  upsertMenuItem,
  upsertPrinter,
  upsertStaff,
  upsertTable,
  writeEmployment,
  writeIdentity,
  writeSetting,
} from '@/lib/db/owner-mutations';

type Action =
  | {
      action: 'close-bill';
      billId: string;
      mode: string;
      reference?: string;
      /* ONE discount, two views. The screen sends which box was typed and its value; the
         other figure is derived on the server, so the two can never disagree and the
         discount can never be taken twice. */
      discountType?: 'percentage' | 'amount';
      discountValue?: number;
    }
  | { action: 'change-qty'; kotItemId: string; qty: number }
  | { action: 'cancel-item'; kotItemId: string; reason: string }
  | { action: 'reprint'; kotId: string }
  | { action: 'complete-request'; requestId: string }
  | { action: 'join-table'; billId: string; tableId: string }
  | { action: 'free-table'; tableId: string }
  | { action: 'reassign-bill-staff'; billId: string; role: 'captain' | 'waiter'; staffId: string | null }
  | { action: 'reply-suggestion'; suggestionId: string; reply: string }
  | { action: 'set-availability'; itemId: string; available: boolean; reason?: string }
  | {
      action: 'upsert-item';
      id?: string;
      name: string;
      price: number;
      categoryId: string;
      foodType: 'veg' | 'non_veg' | 'egg';
      description?: string;
    }
  | { action: 'add-category'; name: string }
  | { action: 'upsert-table'; id?: string; name: string; zone: string; seats: number; active: boolean }
  | { action: 'upsert-staff'; id?: string; name: string; role: string; mobile?: string }
  | { action: 'issue-pin'; staffId: string }
  | { action: 'set-permissions'; staffId: string; granted: string[] }
  | { action: 'remove-staff'; staffId: string; reason: string }
  | { action: 'set-on-duty'; staffId: string; onDuty: boolean }
  | { action: 'write-setting'; key: string; value: Record<string, unknown> }
  | { action: 'write-identity'; patch: Record<string, unknown> }
  | {
      action: 'upsert-expense';
      id?: string;
      spentOn: string;
      category: string;
      note: string;
      amount: number;
      reason?: string;
    }
  | { action: 'delete-expense'; id: string; reason: string }
  | { action: 'settle-tips'; staffId: string }
  | { action: 'join-waitlist'; partySize: number; pair: string; phone?: string; source?: 'scanned' | 'walk_in' }
  | { action: 'notify-waitlist'; id: string }
  | { action: 'seat-waitlist'; id: string; tableId?: string }
  | { action: 'remove-waitlist'; id: string; reason: string }
  | {
      action: 'upsert-printer';
      id?: string;
      machineId: string;
      name: string;
      purpose: string;
      station: string;
      paperMm: number;
      connection: string;
      address: string;
      port: number;
      routes: string[];
      enabled: boolean;
    }
  | { action: 'retry-print'; jobId: string }
  /* Print elsewhere. The printer is REQUIRED and comes from the operator: this is the one
     path to a machine other than the assigned one, and it exists so no automatic path has
     to. A redirect nobody asked for is indistinguishable, from a kitchen, from routing. */
  | { action: 'print-elsewhere'; jobId: string; printerId: string }
  | { action: 'detach-table'; billId: string; tableId: string }
  | { action: 'write-employment'; staffId: string; patch: Record<string, string | number | null> };

/**
 * Everything the owner DOES.
 *
 * One identity check, one permission model, one audit obligation — the same reason the staff
 * surface has one. The permission for each verb lives in the mutation it calls, never here, so
 * this file cannot accidentally become a second, more generous, copy of the matrix.
 */
export const POST = handler(async (req: Request): Promise<NextResponse> => {
  const staff = await currentStaff();
  if (!staff) return fail(401, { code: 'unauthenticated', message: 'Sign in with your PIN before doing that.' });
  const actor = actorFor(staff);
  const input = await body<Action>(req);

  switch (input.action) {
    case 'close-bill':
      return ok(
        await closeBill({
          billId: input.billId,
          mode: input.mode,
          ...(input.reference ? { reference: input.reference } : {}),
          ...(input.discountType && input.discountValue
            ? { discountType: input.discountType, discountValue: input.discountValue }
            : {}),
          actor,
        })
      );

    case 'change-qty':
      await changeQty({ kotItemId: input.kotItemId, qty: input.qty, actor });
      return ok({ done: true });

    case 'cancel-item':
      return ok(await cancelItem({ kotItemId: input.kotItemId, reason: input.reason, actor }));

    case 'reprint':
      await reprintKot({ kotId: input.kotId, actor });
      return ok({ done: true });

    case 'complete-request':
      await completeRequest({ requestId: input.requestId, actor });
      return ok({ done: true });

    case 'join-table':
      await joinTableToBill({ billId: input.billId, tableId: input.tableId, actor });
      return ok({ done: true });

    case 'reassign-bill-staff': {
      const res = await reassignBillStaff({
        billId: input.billId,
        role: input.role,
        staffId: input.staffId,
        actor,
      });
      return ok({ done: true, tipMoved: res.tipMoved });
    }

    case 'free-table':
      // Guarded in freeTable, not here: the permission and the "nothing with the kitchen" rule
      // are properties of the operation, and a second copy at a second entry point is how the
      // two eventually disagree.
      await freeTable({ tableId: input.tableId, actor });
      return ok({ done: true });

    case 'reply-suggestion':
      await replyToSuggestion({ suggestionId: input.suggestionId, reply: input.reply, actor });
      return ok({ done: true });

    case 'set-availability':
      await setItemAvailability({
        itemId: input.itemId,
        available: input.available,
        ...(input.reason ? { reason: input.reason } : {}),
        actor,
      });
      return ok({ done: true });

    case 'upsert-item':
      return ok(
        await upsertMenuItem({
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          price: input.price,
          categoryId: input.categoryId,
          foodType: input.foodType,
          ...(input.description !== undefined ? { description: input.description } : {}),
          actor,
        })
      );

    case 'add-category': {
      // The id comes back so the Add-item combobox can select the category it just created,
      // in the same form, before the item is saved.
      const categoryId = await addCategory({ name: input.name, actor });
      return ok({ done: true, id: categoryId });
    }

    case 'upsert-table':
      await upsertTable({
        ...(input.id ? { id: input.id } : {}),
        name: input.name,
        zone: input.zone,
        seats: input.seats,
        active: input.active,
        actor,
      });
      return ok({ done: true });

    case 'upsert-staff':
      return ok(
        await upsertStaff({
          ...(input.id ? { id: input.id } : {}),
          name: input.name,
          role: input.role,
          ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
          actor,
        })
      );

    case 'issue-pin':
      // The ONLY response in the application that carries a credential. It is returned once,
      // never stored anywhere readable, and never logged — the audit entry records that a PIN
      // was issued, not what it was.
      return ok(await issuePin({ staffId: input.staffId, actor }));

    case 'set-permissions':
      await setPermissions({ staffId: input.staffId, granted: input.granted, actor });
      return ok({ done: true });

    case 'remove-staff':
      await removeStaff({ staffId: input.staffId, reason: input.reason, actor });
      return ok({ done: true });

    case 'set-on-duty':
      await setOnDuty({ staffId: input.staffId, onDuty: input.onDuty, actor });
      return ok({ done: true });

    case 'write-setting':
      await writeSetting({ key: input.key, value: input.value, actor });
      return ok({ done: true });

    case 'write-identity':
      await writeIdentity({ patch: input.patch, actor });
      return ok({ done: true });

    case 'upsert-expense':
      await upsertExpense({
        ...(input.id ? { id: input.id } : {}),
        spentOn: input.spentOn,
        category: input.category,
        note: input.note,
        amount: input.amount,
        ...(input.reason ? { reason: input.reason } : {}),
        actor,
      });
      return ok({ done: true });

    case 'delete-expense':
      await deleteExpense({ id: input.id, reason: input.reason, actor });
      return ok({ done: true });

    case 'settle-tips':
      return ok(await settleTips({ staffId: input.staffId, actor }));

    case 'join-waitlist':
      return ok(
        await joinWaitlist({
          partySize: input.partySize,
          pair: input.pair,
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.source ? { source: input.source } : {}),
          actor,
        })
      );

    case 'notify-waitlist':
      await notifyWaitlist({ id: input.id, actor });
      return ok({ done: true });

    case 'seat-waitlist':
      await seatWaitlist({ id: input.id, ...(input.tableId ? { tableId: input.tableId } : {}), actor });
      return ok({ done: true });

    case 'remove-waitlist':
      await removeFromWaitlist({ id: input.id, reason: input.reason, actor });
      return ok({ done: true });

    case 'upsert-printer':
      return ok(
        await upsertPrinter({
          ...(input.id ? { id: input.id } : {}),
          machineId: input.machineId,
          name: input.name,
          purpose: input.purpose,
          station: input.station,
          paperMm: input.paperMm,
          connection: input.connection,
          address: input.address,
          port: input.port,
          routes: input.routes,
          enabled: input.enabled,
          actor,
        })
      );

    case 'retry-print':
      return ok(await retryPrintJob({ jobId: input.jobId, actor }));

    case 'print-elsewhere':
      return ok(await printElsewhere({ jobId: input.jobId, printerId: input.printerId, actor }));

    case 'detach-table':
      return ok(await detachTableFromBill({ billId: input.billId, tableId: input.tableId, actor }));

    case 'write-employment':
      await writeEmployment({ staffId: input.staffId, patch: input.patch, actor });
      return ok({ done: true });

    default:
      return fail(400, { code: 'validation', message: 'That is not something this console can do.' });
  }
});
