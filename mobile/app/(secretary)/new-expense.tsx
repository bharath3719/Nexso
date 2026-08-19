/**
 * Record or edit an expense.
 *
 * The same screen serves both — `?id=` switches it to edit, loading the row
 * from the month list rather than a by-id endpoint, because the API has none
 * (see routes/secretary.js: GET /expenses is a list, there is no /expenses/:id).
 *
 * The web equivalent is a modal over a table. Here it is a route, so the OS back
 * gesture cancels it and the list refetches on focus.
 */

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenScroll } from '../../src/components/Screen';
import { SelectField } from '../../src/components/SelectField';
import { DateTimeField } from '../../src/components/DateTimeField';
import { Button, Card, ChipGroup, ErrorNotice, Field, Loading } from '../../src/components/ui';
import { useApi, useMutation } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_TYPES,
  FUND_SOURCES,
  PAYMENT_MODES,
} from '../../src/constants';
import { SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { fromISODate, toISODate } from '../../src/utils/format';

type ExpenseRow = {
  id: number;
  date: string;
  category: string;
  subcategory: string | null;
  description: string;
  amount: string;
  payment_mode: string;
  fund_source: string;
  expense_type: string;
  payee_name: string | null;
  reference_no: string | null;
  notes: string | null;
};

export default function NewExpense() {
  const router = useRouter();
  const { id, month } = useLocalSearchParams<{ id?: string; month?: string }>();
  const editingId = id ? Number(id) : null;

  // Edit mode has to find the row first. The list is already filtered to the
  // month the user was looking at, so this is one small request, not a scan.
  const existing = useApi<{ expenses: ExpenseRow[] }>(
    (signal) => api.secretary.expenses.list(month ? { month } : {}, signal),
    [month],
    { enabled: editingId !== null, refetchOnFocus: false },
  );

  const row = editingId !== null ? existing.data?.expenses.find((e) => e.id === editingId) ?? null : null;

  if (editingId !== null && existing.loading) {
    return (
      <ScreenScroll>
        <Loading label="Loading entry…" />
      </ScreenScroll>
    );
  }

  if (editingId !== null && !row) {
    return (
      <ScreenScroll>
        <ErrorNotice
          message={existing.error ?? 'That entry no longer exists — it may have been deleted.'}
          onRetry={existing.reload}
        />
      </ScreenScroll>
    );
  }

  // Remounting per loaded row keeps the form's initial state honest without a
  // sync-from-props effect.
  return <ExpenseForm key={row?.id ?? 'new'} row={row} onDone={() => router.back()} />;
}

function ExpenseForm({ row, onDone }: { row: ExpenseRow | null; onDone: () => void }) {
  const isEdit = row !== null;

  const [date, setDate] = useState<Date>(row ? fromISODate(row.date) : new Date());
  const [amount, setAmount] = useState(row ? String(Number(row.amount)) : '');
  const [category, setCategory] = useState(row?.category ?? '');
  const [subcategory, setSubcategory] = useState(row?.subcategory ?? '');
  const [description, setDescription] = useState(row?.description ?? '');
  const [expenseType, setExpenseType] = useState<string>(row?.expense_type ?? 'OPEX');
  const [fundSource, setFundSource] = useState(row?.fund_source ?? 'MAINTENANCE_FUND');
  const [paymentMode, setPaymentMode] = useState(row?.payment_mode ?? 'BANK_TRANSFER');
  const [payeeName, setPayeeName] = useState(row?.payee_name ?? '');
  const [referenceNo, setReferenceNo] = useState(row?.reference_no ?? '');
  const [notes, setNotes] = useState(row?.notes ?? '');
  const [touched, setTouched] = useState(false);

  const save = useMutation((body: Record<string, unknown>) =>
    isEdit ? api.secretary.expenses.update(row.id, body) : api.secretary.expenses.create(body),
  );
  const remove = useMutation(() => api.secretary.expenses.delete(row!.id));

  const subOptions = useMemo(() => {
    const cat = EXPENSE_CATEGORIES.find((c) => c.value === category);
    return (cat?.sub ?? []).map((label) => ({ value: label, label }));
  }, [category]);

  const amountNum = Number(amount);
  // The backend rejects amount <= 0 with invalid_amount; catch it here so the
  // user is not told by a round trip.
  const amountError = touched && (!amount.trim() || !Number.isFinite(amountNum) || amountNum <= 0)
    ? 'Enter an amount greater than zero'
    : null;
  const categoryError = touched && !category ? 'Pick a category' : null;
  const descriptionError = touched && !description.trim() ? 'Say what this was for' : null;

  const valid = Boolean(category) && description.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0;
  const busy = save.pending || remove.pending;

  async function handleSubmit() {
    setTouched(true);
    if (!valid) return;

    const saved = await save.mutate({
      date: toISODate(date),
      category,
      subcategory: subcategory || null,
      description: description.trim(),
      amount: amountNum,
      expense_type: expenseType,
      fund_source: fundSource,
      payment_mode: paymentMode,
      payee_name: payeeName.trim() || null,
      reference_no: referenceNo.trim() || null,
      notes: notes.trim() || null,
    });
    if (saved) onDone();
  }

  function handleDelete() {
    Alert.alert(
      'Delete this entry?',
      'It will be removed from the ledger and from every report that includes this month.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const done = await remove.mutate();
            if (done) onDone();
          },
        },
      ],
    );
  }

  return (
    <ScreenScroll keyboardAware>
      <Card>
        <View style={s.form}>
          <View style={s.split}>
            {/* DateTimeField has no containerStyle prop, so the half-width
                sizing is done by the wrapper. */}
            <View style={s.flex}>
              <DateTimeField
                label="Date"
                mode="date"
                value={date}
                onChange={setDate}
                maximumDate={new Date()}
                required
              />
            </View>
            <Field
              label="Amount (₹)"
              required
              value={amount}
              onChangeText={setAmount}
              error={amountError}
              placeholder="0.00"
              keyboardType="decimal-pad"
              editable={!busy}
              containerStyle={s.flex}
            />
          </View>

          <SelectField
            label="Category"
            required
            value={category}
            error={categoryError}
            onChange={(next) => {
              setCategory(next);
              // Sub-categories belong to a category; keeping the old one would
              // save a Utilities sub-category under Insurance.
              setSubcategory('');
            }}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            placeholder="What kind of expense?"
            disabled={busy}
          />

          <SelectField
            label="Sub-category"
            value={subcategory}
            onChange={setSubcategory}
            options={subOptions}
            placeholder={category ? 'Optional' : 'Pick a category first'}
            disabled={busy}
          />

          <Field
            label="Description / purpose"
            required
            value={description}
            onChangeText={setDescription}
            error={descriptionError}
            placeholder="e.g. April salary for security guard"
            editable={!busy}
          />
        </View>
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Classification</Text>
        <Text style={[TYPE.caption, s.hint]}>
          OpEx is recurring running cost; CapEx is a one-off purchase or major work. The split is what
          your auditor reads first.
        </Text>
        <ChipGroup options={EXPENSE_TYPES} value={expenseType} onChange={setExpenseType} style={s.chips} />

        <View style={s.stack}>
          <SelectField
            label="Paid from"
            value={fundSource}
            onChange={setFundSource}
            options={FUND_SOURCES}
            disabled={busy}
          />
          <SelectField
            label="Payment mode"
            value={paymentMode}
            onChange={setPaymentMode}
            options={PAYMENT_MODES}
            disabled={busy}
          />
        </View>
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Paper trail</Text>
        <Text style={[TYPE.caption, s.hint]}>Optional, but it is what makes the entry auditable later.</Text>
        <View style={s.stack}>
          <Field
            label="Paid to"
            value={payeeName}
            onChangeText={setPayeeName}
            placeholder="Vendor or contractor name"
            editable={!busy}
          />
          <Field
            label="Bill / cheque / UTR no."
            value={referenceNo}
            onChangeText={setReferenceNo}
            placeholder="Reference number"
            editable={!busy}
          />
          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything worth remembering about this payment"
            multiline
            numberOfLines={3}
            editable={!busy}
          />
        </View>
      </Card>

      {save.error ? <ErrorNotice message={save.error} /> : null}
      {remove.error ? <ErrorNotice message={remove.error} /> : null}

      <Button
        title={isEdit ? 'Save changes' : 'Record expense'}
        onPress={handleSubmit}
        loading={save.pending}
        disabled={busy || (touched && !valid)}
        fullWidth
      />

      {isEdit ? (
        <Button
          title="Delete entry"
          variant="danger"
          icon="trash-outline"
          onPress={handleDelete}
          loading={remove.pending}
          disabled={busy}
          fullWidth
        />
      ) : null}
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: SPACING.lg },
  stack: { gap: SPACING.lg, marginTop: SPACING.lg },
  split: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  chips: { marginTop: SPACING.md },
  hint: { marginTop: SPACING.xs },
});
