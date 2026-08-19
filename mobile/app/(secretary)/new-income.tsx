/**
 * Record other (non-maintenance) income — hall bookings, parking, FD interest.
 *
 * Add-only, matching the API: society_other_income has POST and DELETE but no
 * PATCH (routes/secretary.js), so a wrong entry is deleted and re-entered
 * rather than edited. Deletion lives on the ledger row, not here.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScroll } from '../../src/components/Screen';
import { SelectField } from '../../src/components/SelectField';
import { DateTimeField } from '../../src/components/DateTimeField';
import { Button, Card, ErrorNotice, Field } from '../../src/components/ui';
import { useMutation } from '../../src/hooks/useApi';
import { api } from '../../src/lib/api';
import { INCOME_CATEGORIES, PAYMENT_MODES } from '../../src/constants';
import { SPACING } from '../../src/theme/tokens';
import { TYPE } from '../../src/theme/type';
import { toISODate } from '../../src/utils/format';

export default function NewIncome() {
  const router = useRouter();

  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [payerName, setPayerName] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  const { mutate, pending, error } = useMutation(api.secretary.otherIncome.create);

  const amountNum = Number(amount);
  const amountError = touched && (!amount.trim() || !Number.isFinite(amountNum) || amountNum <= 0)
    ? 'Enter an amount greater than zero'
    : null;
  const categoryError = touched && !category ? 'Pick a category' : null;
  const descriptionError = touched && !description.trim() ? 'Say what this was for' : null;

  const valid = Boolean(category) && description.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0;

  async function handleSubmit() {
    setTouched(true);
    if (!valid) return;

    const created = await mutate({
      date: toISODate(date),
      category,
      description: description.trim(),
      amount: amountNum,
      payment_mode: paymentMode,
      payer_name: payerName.trim() || null,
      reference_no: referenceNo.trim() || null,
      notes: notes.trim() || null,
    });
    if (created) router.back();
  }

  return (
    <ScreenScroll keyboardAware>
      <Card>
        <View style={s.form}>
          <View style={s.split}>
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
              editable={!pending}
              containerStyle={s.flex}
            />
          </View>

          <SelectField
            label="Category"
            required
            value={category}
            onChange={setCategory}
            error={categoryError}
            options={INCOME_CATEGORIES}
            placeholder="Where did this come from?"
            disabled={pending}
          />

          <Field
            label="Description"
            required
            value={description}
            onChangeText={setDescription}
            error={descriptionError}
            placeholder="e.g. Community hall booking, flat B-402"
            editable={!pending}
          />

          <SelectField
            label="Received by"
            value={paymentMode}
            onChange={setPaymentMode}
            options={PAYMENT_MODES}
            disabled={pending}
          />
        </View>
      </Card>

      <Card>
        <Text style={TYPE.sectionHeader}>Paper trail</Text>
        <Text style={[TYPE.caption, s.hint]}>Optional, but it is what makes the entry auditable later.</Text>
        <View style={s.stack}>
          <Field
            label="Received from"
            value={payerName}
            onChangeText={setPayerName}
            placeholder="Resident, tenant or company name"
            editable={!pending}
          />
          <Field
            label="Receipt / UTR no."
            value={referenceNo}
            onChangeText={setReferenceNo}
            placeholder="Reference number"
            editable={!pending}
          />
          <Field
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything worth remembering about this receipt"
            multiline
            numberOfLines={3}
            editable={!pending}
          />
        </View>
      </Card>

      {error ? <ErrorNotice message={error} /> : null}

      <Button
        title="Record income"
        onPress={handleSubmit}
        loading={pending}
        disabled={pending || (touched && !valid)}
        fullWidth
      />
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: SPACING.lg },
  stack: { gap: SPACING.lg, marginTop: SPACING.lg },
  split: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  hint: { marginTop: SPACING.xs },
});
