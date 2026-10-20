import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

import { formatMoneyInput, parseMoneyInput } from '@/utils/money';

import { ChipSelect, type ChipOption } from './ChipSelect';
import { DatePicker, type DatePickerProps } from './DatePicker';
import { FormField } from './FormField';
import { QuantityInput, type QuantityInputProps } from './QuantityInput';
import { TextInput, type TextInputProps } from './TextInput';
import { ToggleRow } from './ToggleRow';

/** React Hook Form bindings. Each wraps its control in a `FormField` with the validation message. */
interface BoundBase<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  required?: boolean;
  hint?: string;
}

export function ControlledTextInput<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  ...input
}: BoundBase<T> & Omit<TextInputProps, 'value' | 'onChangeText' | 'error'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField label={label} required={required} hint={hint} error={fieldState.error?.message}>
          <TextInput
            accessibilityLabel={label}
            {...input}
            value={field.value == null ? '' : String(field.value)}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error != null}
          />
        </FormField>
      )}
    />
  );
}

/** A `TextInput` for ₫ amounts: groups thousands with `.` while typing, stores the raw `1234.5`. */
export function ControlledMoneyInput<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  ...input
}: BoundBase<T> & Omit<TextInputProps, 'value' | 'onChangeText' | 'error'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField label={label} required={required} hint={hint} error={fieldState.error?.message}>
          <TextInput
            accessibilityLabel={label}
            keyboardType="decimal-pad"
            suffix="₫"
            {...input}
            value={formatMoneyInput(field.value == null ? '' : String(field.value))}
            onChangeText={(text) => field.onChange(parseMoneyInput(text))}
            onBlur={field.onBlur}
            error={fieldState.error != null}
          />
        </FormField>
      )}
    />
  );
}

export function ControlledQuantityInput<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  ...input
}: BoundBase<T> & Omit<QuantityInputProps, 'value' | 'onChangeText' | 'error'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField label={label} required={required} hint={hint} error={fieldState.error?.message}>
          <QuantityInput
            {...input}
            value={field.value == null ? '' : String(field.value)}
            onChangeText={field.onChange}
            error={fieldState.error != null}
          />
        </FormField>
      )}
    />
  );
}

export function ControlledDatePicker<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  ...picker
}: BoundBase<T> & Omit<DatePickerProps, 'value' | 'onChange' | 'error'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField label={label} required={required} hint={hint} error={fieldState.error?.message}>
          <DatePicker
            {...picker}
            value={field.value ?? null}
            onChange={field.onChange}
            error={fieldState.error != null}
          />
        </FormField>
      )}
    />
  );
}

export function ControlledChipSelect<T extends FieldValues, O extends string>({
  control,
  name,
  label,
  required,
  hint,
  options,
}: BoundBase<T> & { options: readonly ChipOption<O>[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField label={label} required={required} hint={hint} error={fieldState.error?.message}>
          <ChipSelect
            options={options}
            value={(field.value ?? null) as O | null}
            onChange={field.onChange}
          />
        </FormField>
      )}
    />
  );
}

export function ControlledMultiChipSelect<T extends FieldValues, O extends string>({
  control,
  name,
  label,
  required,
  hint,
  options,
}: BoundBase<T> & { options: readonly ChipOption<O>[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField label={label} required={required} hint={hint} error={fieldState.error?.message}>
          <ChipSelect
            multiple
            options={options}
            value={(field.value ?? []) as O[]}
            onChange={field.onChange}
          />
        </FormField>
      )}
    />
  );
}

export function ControlledToggleRow<T extends FieldValues>({
  control,
  name,
  label,
  hint,
}: Omit<BoundBase<T>, 'required'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ToggleRow
          title={label}
          hint={hint}
          value={Boolean(field.value)}
          onValueChange={field.onChange}
        />
      )}
    />
  );
}
